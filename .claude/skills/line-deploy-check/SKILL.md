---
name: line-deploy-check
description: 部署前檢查 LINE bot 的環境變數與安全設定是否三方一致。在推 main、改 render.yaml、改 .env.example、或動到 src/server.js 的 config 區塊之後使用。
disable-model-invocation: true
---

# 部署前檢查

這個專案的環境變數散在三個地方，任何一邊漏掉都會在 Render 上炸掉或行為不一致：

| 來源 | 角色 |
|---|---|
| `src/server.js` 第 14–35 行 `config` 物件 | 程式實際讀什麼（唯一真相） |
| `.env.example` | 給人看的範本，本機開發照這份填 |
| `render.yaml` `envVars` | 正式環境實際會有什麼 |

依序做完以下五項，每項回報 pass / fail 與具體行號。**不要自己動手改**，把發現列出來讓使用者決定。

## 1. 必填變數有沒有到位

`requireEnv()`（`src/server.js:39`）在啟動時會擋。必填清單是**動態的**，取決於 `AI_PROVIDER`：

- 一律必填：`LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN`
- `AI_PROVIDER=gemini` → 再加 `GEMINI_API_KEY`、`GEMINI_MODEL`
- 其他值（含未設定，預設 `openai`）→ 再加 `OPENAI_API_KEY`、`OPENAI_MODEL`

讀 `render.yaml` 現在的 `AI_PROVIDER`，用那個分支去核對 `envVars` 有沒有列全。`sync: false` 的項目算「有列」——那是 Render 上手動填的祕密，不在 repo 裡。

## 2. 簽章驗證開關

**這項最重要。** `SKIP_LINE_SIGNATURE_VERIFICATION=true` 會讓 `/webhook` 完全跳過 LINE 簽章驗證（`src/server.js:390`），等於任何人都能偽造請求打進來，觸發 AI 呼叫並以你的名義回訊息。

檢查：

- `render.yaml` 的 `envVars` **不可以**出現這個 key。目前沒有，維持這樣。
- 如果有人加了，直接標成 fail，不要當作一般設定漂移。

## 3. 三邊漂移

比對 `config` 物件讀的每個 `process.env.X`，對照 `.env.example` 和 `render.yaml`。

已知漂移（不算 fail，但每次要重新確認還在不在）：

- `SKIP_LINE_SIGNATURE_VERIFICATION` — 程式讀，兩份設定檔都沒有。**刻意不寫進 `.env.example`**，避免有人照抄後打開它。
- `LINE_CHANNEL_SECRET_FALLBACKS` — 程式讀（逗號分隔，用於換 secret 時的過渡期），兩份設定檔都沒有。

除這兩個以外的漂移都要回報。特別注意 `.env.example` 的預設值和 `render.yaml` 的值不一致（例如 `AI_PROVIDER`），這通常代表有人只改了一邊。

## 4. 模型名稱

`OPENAI_MODEL` 和 `GEMINI_MODEL` 是寫死的字串，模型下架時不會有編譯期錯誤，會變成 runtime 的 API 400。

回報 `render.yaml` 目前的值，並提醒使用者：只有正在用的那個 provider 的模型需要有效。另一個 provider 的模型名稱失效不影響運作，但切換時會踩到。

## 5. 語法

跑 `npm run check`（等同 `node --check src/server.js`）。這只驗語法，不驗執行——過了不代表能跑起來。要真的驗證行為請用 `/line-smoke-test`。

## 回報格式

五項逐一列 pass / fail，fail 的附上檔案行號和建議動作。最後一行給總結：可以部署 / 有 N 項要先處理。
