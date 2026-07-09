# Render 部署步驟

這份專案已經準備好部署到 Render。部署後，即使你的電腦關掉，LINE 也會打到 Render 的公開網址，自動回覆會繼續運作。

## 1. 上傳到 GitHub

建立一個新的 GitHub repo，把 `line-ai-bot` 這個資料夾內容上傳。

不要上傳 `.env`，裡面有金鑰。專案已經有 `.gitignore` 會排除 `.env`。

## 2. 用 Render Blueprint 建服務

1. 到 [Render Dashboard](https://dashboard.render.com/)
2. 選 `New`
3. 選 `Blueprint`
4. 連接你的 GitHub repo
5. Render 會讀取 `render.yaml`

方案選擇時要注意：免費方案如果會休眠，LINE 第一次訊息可能會延遲或失敗。若你要穩定 24 小時客服，請選不會休眠的方案。

Render 官方文件說，Node Express App 可用 `npm install` 作為 build command、`npm start` 作為 start command；Blueprint 則是用 repo 根目錄的 `render.yaml` 管理服務設定。

## 3. 填入祕密變數

Render 會提示你輸入這三個值：

- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `OPENAI_API_KEY`

模型已經設定為：

```text
OPENAI_MODEL=gpt-5.4-mini
```

## 4. 設定 LINE Webhook

部署完成後，Render 會給你一個公開網址，例如：

```text
https://line-ai-home-helper.onrender.com
```

到 LINE Developers Console，把 Webhook URL 設成：

```text
https://line-ai-home-helper.onrender.com/webhook
```

如果 Render 給你的網址不同，請用你的實際網址。

## 5. 檢查

打開：

```text
https://你的-render-網址/
```

看到下面內容就代表服務活著：

```json
{"ok":true,"service":"line-ai-bot"}
```

再到 LINE Developers 按 `Verify`，成功後就可以用 LINE 傳訊息測試。

## 重要提醒

你已經在聊天中貼過 LINE token 和 OpenAI API key。正式部署前，建議到 LINE Developers 和 OpenAI Platform 重新產生新的金鑰，然後把新的值填進 Render。
