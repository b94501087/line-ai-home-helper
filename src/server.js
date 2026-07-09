import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const knowledgePath = path.join(__dirname, "..", "data", "knowledge.md");

const config = {
  port: Number(process.env.PORT || 3000),
  lineChannelSecret: process.env.LINE_CHANNEL_SECRET,
  lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL,
  botName: process.env.BOT_NAME || "客服小幫手",
  businessName: process.env.BUSINESS_NAME || "我們",
  replyLanguage: process.env.REPLY_LANGUAGE || "繁體中文",
  humanHandoffText:
    process.env.HUMAN_HANDOFF_TEXT || "我已幫你記錄，稍後會由真人協助你。"
};

const conversations = new Map();

function requireEnv() {
  const missing = Object.entries({
    LINE_CHANNEL_SECRET: config.lineChannelSecret,
    LINE_CHANNEL_ACCESS_TOKEN: config.lineChannelAccessToken,
    OPENAI_API_KEY: config.openaiApiKey,
    OPENAI_MODEL: config.openaiModel
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function rawBodySaver(req, _res, buf) {
  req.rawBody = buf;
}

function verifyLineSignature(req) {
  const signature = req.get("x-line-signature");
  if (!signature || !req.rawBody) return false;

  const digest = crypto
    .createHmac("sha256", config.lineChannelSecret)
    .update(req.rawBody)
    .digest("base64");

  const signatureBuffer = Buffer.from(signature);
  const digestBuffer = Buffer.from(digest);

  return (
    signatureBuffer.length === digestBuffer.length &&
    crypto.timingSafeEqual(signatureBuffer, digestBuffer)
  );
}

function getKnowledge() {
  return fs.existsSync(knowledgePath)
    ? fs.readFileSync(knowledgePath, "utf8")
    : "目前沒有額外知識庫。";
}

function getConversation(userId) {
  const history = conversations.get(userId) || [];
  conversations.set(userId, history);
  return history;
}

function remember(userId, role, content) {
  const history = getConversation(userId);
  history.push({ role, content });
  conversations.set(userId, history.slice(-12));
}

function sourceId(source) {
  if (source?.userId) return source.userId;
  if (source?.groupId) return source.groupId;
  if (source?.roomId) return source.roomId;
  return "unknown";
}

function wantsHuman(text) {
  return /真人|人工|客服|轉接|聯絡人|專人|電話/.test(text);
}

async function createAiReply(userId, userText) {
  if (wantsHuman(userText)) return config.humanHandoffText;

  const history = getConversation(userId)
    .map((message) => `${message.role === "user" ? "使用者" : "助理"}：${message.content}`)
    .join("\n");

  const input = [
    {
      role: "system",
      content:
        `你是 ${config.businessName} 的 ${config.botName}。` +
        `請用${config.replyLanguage}回覆，語氣自然、清楚、簡短。` +
        "只能根據知識庫和對話上下文回答；不確定時請說需要真人確認。"
    },
    {
      role: "user",
      content:
        `知識庫：\n${getKnowledge()}\n\n` +
        `最近對話：\n${history || "尚無"}\n\n` +
        `使用者最新訊息：${userText}`
    }
  ];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.openaiModel,
      input,
      max_output_tokens: 600
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const text =
    data.output_text ||
    data.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n")
      .trim();

  return text || "我目前無法產生回覆，稍後請真人協助你。";
}

async function replyToLine(replyToken, text) {
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.lineChannelAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: text.slice(0, 5000) }]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LINE reply error ${response.status}: ${detail}`);
  }
}

app.use(express.json({ verify: rawBodySaver }));

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "line-ai-bot" });
});

app.post("/webhook", async (req, res) => {
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      path: "/webhook",
      hasSignature: Boolean(req.get("x-line-signature")),
      bodyBytes: req.rawBody?.length || 0,
      eventCount: req.body?.events?.length || 0
    })
  );

  if (!verifyLineSignature(req)) {
    console.warn(
      JSON.stringify({
        at: new Date().toISOString(),
        path: "/webhook",
        error: "Invalid LINE signature"
      })
    );
    res.status(401).json({ error: "Invalid LINE signature" });
    return;
  }

  res.status(200).end();

  for (const event of req.body.events || []) {
    try {
      console.log(
        JSON.stringify({
          at: new Date().toISOString(),
          eventType: event.type,
          messageType: event.message?.type,
          sourceType: event.source?.type
        })
      );

      if (event.type === "follow" && event.replyToken) {
        await replyToLine(event.replyToken, `你好，我是${config.botName}，很高興為你服務。`);
        console.log(JSON.stringify({ at: new Date().toISOString(), result: "follow replied" }));
        continue;
      }

      if (event.type !== "message" || event.message?.type !== "text") {
        continue;
      }

      const userId = sourceId(event.source);
      const userText = event.message.text.trim();
      remember(userId, "user", userText);

      const reply = await createAiReply(userId, userText);
      remember(userId, "assistant", reply);

      await replyToLine(event.replyToken, reply);
      console.log(JSON.stringify({ at: new Date().toISOString(), result: "message replied" }));
    } catch (error) {
      console.error(
        JSON.stringify({
          at: new Date().toISOString(),
          error: error.message,
          stack: error.stack
        })
      );
      if (event.replyToken) {
        try {
          await replyToLine(event.replyToken, "目前系統忙碌中，請稍後再試。");
        } catch (replyError) {
          console.error(
            JSON.stringify({
              at: new Date().toISOString(),
              error: replyError.message,
              stack: replyError.stack
            })
          );
        }
      }
    }
  }
});

requireEnv();

app.listen(config.port, () => {
  console.log(`LINE AI bot is running on port ${config.port}`);
});
