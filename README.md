# LINE AI 自動回覆 Bot

這是一個最小可用版本：使用者加入你的 LINE 官方帳號並傳訊息後，LINE 會把訊息送到 `/webhook`，後端會呼叫 AI 產生回覆，再回覆到 LINE。

## 你需要準備

1. LINE 官方帳號
2. LINE Developers 的 Messaging API channel
3. OpenAI API Key
4. 一個可公開連線的網址，例如 Render、Railway、Fly.io、Vercel serverless function，或先用 ngrok 測試本機

## 設定

```bash
npm install
copy .env.example .env
npm run dev
```

打開 `.env`，填入：

- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `BUSINESS_NAME`

`OPENAI_MODEL` 請填你帳號目前可用的文字模型。若你不確定，先到 OpenAI Platform 的模型列表確認。

## LINE 後台設定

在 LINE Developers Console 的 Messaging API channel：

1. 啟用 `Use webhook`
2. Webhook URL 填入：

```text
https://你的網域/webhook
```

3. 按下 Verify
4. 到 LINE Official Account Manager 關閉或調整預設自動回覆，避免和 webhook 回覆互相打架

## 部署到 Render

這個專案已包含 `render.yaml`，可以用 Render Blueprint 部署。

1. 把 `line-ai-bot` 專案上傳到 GitHub
2. 到 Render Dashboard，選 `New` > `Blueprint`
3. 選擇這個 GitHub repo
4. Render 會讀取 `render.yaml`
5. 在 Render 要求輸入祕密變數時填入：

- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `OPENAI_API_KEY`

其他變數已經預設好，包括：

- `OPENAI_MODEL=gpt-5.4-mini`
- `BOT_NAME=和芮居家小幫手`
- `BUSINESS_NAME=和芮居家`

部署完成後，Render 會給你一個網址，例如：

如果 Render 讓你選方案，免費方案可能會休眠；正式客服建議選不會休眠的方案。

```text
https://line-ai-home-helper.onrender.com
```

請把 LINE Developers 的 Webhook URL 設成：

```text
https://line-ai-home-helper.onrender.com/webhook
```

如果你的 Render 網址不同，請用你的實際網址。

## 修改知識庫

把你的品牌資訊、產品、價格、常見問題、營業時間放進：

```text
data/knowledge.md
```

AI 會優先根據這份內容回答。不確定時，它會回覆需要真人確認。

## 真人轉接

使用者訊息中出現「真人、人工、客服、轉接、聯絡人、專人、電話」時，會直接回覆 `.env` 裡的 `HUMAN_HANDOFF_TEXT`。

## 注意

- 這是 LINE 官方帳號的合規做法，不是用一般個人 LINE 帳號自動代聊。
- 如果要正式上線，建議把對話紀錄改存資料庫，並加上隱私告知。
- LINE reply token 有時效，收到 webhook 後應盡快回覆；這份範本已先回應 LINE webhook，再非同步處理事件。
