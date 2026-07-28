---
name: line-smoke-test
description: 在本機把 LINE bot 跑起來，用偽造的簽章打一個假的 webhook 事件，確認它真的回得出東西。改完 src/server.js 之後、部署之前使用。
disable-model-invocation: true
---

# 本機煙霧測試

`npm run check` 只驗語法。這個 skill 驗的是「它到底跑不跑得起來、回不回得出話」。

## 前提

需要真的 AI API key 才能走完整條路徑。使用者如果不想燒 token，就只做第 1–3 步（啟動 + 健康檢查 + 簽章驗證），跳過第 4 步。**先問清楚要不要走完整條。**

金鑰從使用者本機的 `.env` 讀。**絕對不要**把讀到的金鑰印在輸出裡、寫進檔案、或放進 commit。

## 1. 啟動

背景跑 `npm start`，記下 PID。等 log 出現 `LINE AI bot is running on port`。

如果啟動就掛，看錯誤訊息：`Missing required environment variables: ...` 代表 `.env` 沒填齊，去對 `requireEnv()`（`src/server.js:39`）的動態必填清單——必填項目取決於 `AI_PROVIDER`。

## 2. 健康檢查

```bash
curl -s localhost:3000/
```

預期 `{"ok":true,"service":"line-ai-bot"}`。

## 3. 簽章驗證

先確認**壞簽章會被擋**——這比正常路徑更重要，因為它擋的是偽造請求。

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/webhook \
  -H 'content-type: application/json' \
  -H 'x-line-signature: obviously-wrong' \
  -d '{"events":[]}'
```

預期 `401`。**如果回 200，代表 `SKIP_LINE_SIGNATURE_VERIFICATION` 是開的**——立刻停下來告訴使用者，這個狀態不能上正式環境。

再測正確簽章。演算法是 HMAC-SHA256 對 **raw body** 取 base64（`src/server.js:66`），key 是 `LINE_CHANNEL_SECRET`：

```bash
BODY='{"events":[]}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$LINE_CHANNEL_SECRET" -binary | base64)
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/webhook \
  -H 'content-type: application/json' \
  -H "x-line-signature: $SIG" \
  -d "$BODY"
```

預期 `200`。簽章對的是**位元組原文**，所以 body 字串要一字不差，用 `printf '%s'` 不要用 `echo`（會多一個換行導致簽章對不上）。

## 4. 真實訊息事件

只在使用者同意燒 token 時做。`replyToken` 是假的，所以 LINE 的 reply API 一定會失敗——**這是預期行為**。要看的是失敗**之前**的 log：AI 有沒有被呼叫、有沒有產生回覆內容。

```bash
BODY='{"events":[{"type":"message","replyToken":"smoke-test-token","source":{"type":"user","userId":"U-smoke-test"},"message":{"type":"text","text":"請問你們營業時間？"}}]}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$LINE_CHANNEL_SECRET" -binary | base64)
curl -s -X POST localhost:3000/webhook \
  -H 'content-type: application/json' \
  -H "x-line-signature: $SIG" \
  -d "$BODY"
```

`/webhook` 是**先回 200 再非同步處理**（reply token 有時效），所以 curl 會馬上返回。要等幾秒讓背景處理跑完，再去看 server log。

判讀 log：

- AI 有回應，reply API 因假 token 失敗 → **通過**
- AI 呼叫就報錯（401/403/400）→ 金鑰或模型名稱有問題，去跑 `/line-deploy-check` 第 4 項
- 完全沒有 AI 相關 log → 事件沒被處理，檢查事件格式

用 `data/knowledge.md` 裡真的有的問題（營業時間、地址、電話）去問，才驗得到知識庫有沒有被讀進去。

## 5. 收尾

**一定要 kill 掉背景的 server**，否則會佔住 port 3000 影響後續。回報每一步的實際結果，不要只說「通過」——把 HTTP status 和關鍵 log 摘出來。
