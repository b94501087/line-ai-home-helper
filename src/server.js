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
  skipLineSignatureVerification:
    process.env.SKIP_LINE_SIGNATURE_VERIFICATION === "true",
  lineChannelSecret: process.env.LINE_CHANNEL_SECRET,
  lineChannelSecretFallbacks: (process.env.LINE_CHANNEL_SECRET_FALLBACKS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  aiProvider: process.env.AI_PROVIDER || "openai",
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.5-flash",
  geminiGoogleSearch: process.env.GEMINI_GOOGLE_SEARCH === "true",
  botName: process.env.BOT_NAME || "客服小幫手",
  businessName: process.env.BUSINESS_NAME || "我們",
  replyLanguage: process.env.REPLY_LANGUAGE || "繁體中文",
  humanHandoffText:
    process.env.HUMAN_HANDOFF_TEXT || "我已幫你記錄，稍後會由真人協助你。"
};

const conversations = new Map();

function requireEnv() {
  const required = {
    LINE_CHANNEL_SECRET: config.lineChannelSecret,
    LINE_CHANNEL_ACCESS_TOKEN: config.lineChannelAccessToken
  };

  if (config.aiProvider === "gemini") {
    required.GEMINI_API_KEY = config.geminiApiKey;
    required.GEMINI_MODEL = config.geminiModel;
  } else {
    required.OPENAI_API_KEY = config.openaiApiKey;
    required.OPENAI_MODEL = config.openaiModel;
  }

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function rawBodySaver(req, _res, buf) {
  req.rawBody = buf;
}

function lineSignatureMatch(req) {
  const signature = req.get("x-line-signature");
  if (!signature || !req.rawBody) return { ok: false, matchedSecretIndex: -1 };

  const secrets = [config.lineChannelSecret, ...config.lineChannelSecretFallbacks].filter(Boolean);

  const signatureBuffer = Buffer.from(signature);

  for (const [index, secret] of secrets.entries()) {
    const digest = crypto.createHmac("sha256", secret).update(req.rawBody).digest("base64");
    const digestBuffer = Buffer.from(digest);

    if (
      signatureBuffer.length === digestBuffer.length &&
      crypto.timingSafeEqual(signatureBuffer, digestBuffer)
    ) {
      return { ok: true, matchedSecretIndex: index };
    }
  }

  return { ok: false, matchedSecretIndex: -1 };
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

function sanitizeLineReply(text) {
  return String(text || "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`/g, "")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .trim();
}

async function createAiReply(userId, userText) {
  if (wantsHuman(userText)) return sanitizeLineReply(config.humanHandoffText);

  const reply =
    config.aiProvider === "gemini"
      ? await createGeminiReply(userId, userText)
      : await createOpenAiReply(userId, userText);

  return sanitizeLineReply(reply);
}

async function createOpenAiReply(userId, userText) {
  const history = getConversation(userId)
    .map((message) => `${message.role === "user" ? "使用者" : "助理"}：${message.content}`)
    .join("\n");

  const input = [
    {
      role: "system",
      content:
        `你是 ${config.businessName} 的 ${config.botName}。` +
        `請用${config.replyLanguage}回覆，語氣自然、清楚、簡短。` +
        "公司服務、費用、名額、資格、報名、個案照護與承諾事項只能根據知識庫和對話上下文回答；" +
        "一般公開資訊或生活資訊可用保守方式協助回答，並提醒以最新網路資訊或官方公告為準；" +
        "若仍不清楚或涉及公司判斷，請請客戶來電 02-2912-1860 向公司確認。"
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

async function createGeminiReply(userId, userText) {
  const history = getConversation(userId)
    .map((message) => `${message.role === "user" ? "使用者" : "助理"}：${message.content}`)
    .join("\n");

  const systemInstruction =
    `你是 ${config.businessName} 的 ${config.botName}。` +
    `請用${config.replyLanguage}回覆，語氣自然、清楚、簡短。` +
    "公司服務、費用、名額、資格、報名、個案照護與承諾事項只能根據知識庫和對話上下文回答；" +
    "一般公開資訊或生活資訊可用保守方式協助回答，並提醒以最新網路資訊或官方公告為準；" +
    "若仍不清楚或涉及公司判斷，請請客戶來電 02-2912-1860 向公司確認。";

  const input =
    `知識庫：\n${getKnowledge()}\n\n` +
    `最近對話：\n${history || "尚無"}\n\n` +
    `使用者最新訊息：${userText}`;

  const requestBody = {
    model: config.geminiModel,
    system_instruction: systemInstruction,
    input,
    generation_config: {
      thinking_level: "low"
    }
  };

  if (config.geminiGoogleSearch) {
    requestBody.tools = [{ type: "google_search" }];
  }

  let response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "x-goog-api-key": config.geminiApiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok && config.geminiGoogleSearch) {
    const detail = await response.text();
    console.warn(
      JSON.stringify({
        at: new Date().toISOString(),
        warning: "Gemini google_search failed; retrying without search",
        status: response.status,
        detail
      })
    );
    delete requestBody.tools;
    response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "x-goog-api-key": config.geminiApiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const text =
    data.output_text ||
    data.outputText ||
    data.steps
      ?.flatMap((step) => step.content || step.contents || [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n")
      .trim();

  return text || "我目前無法產生回覆，稍後請真人協助你。";
}

async function replyToLine(replyToken, text) {
  const cleanText = sanitizeLineReply(text) || "目前系統忙碌中，請稍後再試。";

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.lineChannelAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: cleanText.slice(0, 5000) }]
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
  const signatureMatch = lineSignatureMatch(req);

  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      path: "/webhook",
      hasSignature: Boolean(req.get("x-line-signature")),
      bodyBytes: req.rawBody?.length || 0,
      eventCount: req.body?.events?.length || 0,
      signatureOk: signatureMatch.ok,
      matchedSecretIndex: signatureMatch.matchedSecretIndex,
      signatureVerificationSkipped: config.skipLineSignatureVerification
    })
  );

  if (!config.skipLineSignatureVerification && !signatureMatch.ok) {
    console.warn(
      JSON.stringify({
        at: new Date().toISOString(),
        path: "/webhook",
        error: "Invalid LINE signature",
        secretCandidateCount: 1 + config.lineChannelSecretFallbacks.length
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
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      message: `LINE AI bot is running on port ${config.port}`,
      skipLineSignatureVerification: config.skipLineSignatureVerification,
      lineSecretCandidateCount: 1 + config.lineChannelSecretFallbacks.length
    })
  );
});
