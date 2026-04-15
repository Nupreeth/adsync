const express = require("express");
const axios = require("axios");
const { cleanJson, getGeminiModel, getText } = require("../utils/geminiClient");

const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

const SYSTEM_PROMPT = `You are an expert ad analyst and CRO specialist. Analyze the ad image provided and extract structured information. Return ONLY a valid JSON object. No markdown. No backticks. No explanation. Just raw JSON.`;

const USER_PROMPT = `
Analyze this ad creative and return this exact JSON structure:
{
  "headline": "main headline text visible in the ad",
  "cta_text": "the call-to-action button or text",
  "value_proposition": "the core offer or benefit being communicated",
  "tone": "one of: urgent / playful / luxurious / technical / friendly / professional",
  "target_audience": "who this ad seems to be targeting",
  "pain_point": "the problem this ad addresses",
  "key_benefit": "the primary benefit promised",
  "color_palette": ["#hex1", "#hex2"],
  "offer_details": "any specific offer like discount, free trial, etc. Write null if none"
}

If you cannot read text clearly, make your best inference. Never return empty strings -
always provide your best guess based on visual context.
`.trim();

async function fetchImageAsInlineData(imageUrl) {
  const response = await axios.get(imageUrl, {
    timeout: 15000,
    responseType: "arraybuffer",
    headers: { "User-Agent": USER_AGENT },
    validateStatus: () => true,
  });

  if (response.status !== 200) {
    const error = new Error("IMAGE_FETCH_FAILED");
    error.code = "IMAGE_FETCH_FAILED";
    throw error;
  }

  const mimeType = response.headers?.["content-type"] || "image/jpeg";
  const data = Buffer.from(response.data).toString("base64");
  return { data, mimeType };
}

function buildFallback(payload) {
  return {
    headline: payload.headline || "High-impact offer",
    cta_text: payload.cta_text || "Get Started",
    value_proposition: payload.value_proposition || "Faster results with less friction",
    tone: payload.tone || "professional",
    target_audience: payload.target_audience || "high-intent visitors",
    pain_point: payload.pain_point || "low conversion from ad traffic",
    key_benefit: payload.key_benefit || "clear path from click to conversion",
    color_palette: Array.isArray(payload.color_palette) && payload.color_palette.length
      ? payload.color_palette
      : ["#6B38FB", "#20C4B3"],
    offer_details: payload.offer_details ?? null,
  };
}

module.exports = (upload) => {
  const router = express.Router();

  router.post("/", upload.single("image"), async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY_MISSING" });
      }

      const imageUrl = req.body?.imageUrl;
      const file = req.file;

      if (!file && !imageUrl) {
        return res.status(400).json({ error: "AD_IMAGE_REQUIRED" });
      }

      const prompt = `${SYSTEM_PROMPT}\n\n${USER_PROMPT}`;
      const model = getGeminiModel(MODEL, { maxOutputTokens: 1500, temperature: 0.2 });

      const inlineData = file
        ? { data: file.buffer.toString("base64"), mimeType: file.mimetype || "image/png" }
        : await fetchImageAsInlineData(imageUrl);

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: inlineData.data,
            mimeType: inlineData.mimeType,
          },
        },
      ]);

      const raw = cleanJson(getText(result));
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        return res.status(422).json({ error: "AI_OUTPUT_INVALID" });
      }

      const normalized = buildFallback(parsed);
      return res.json(normalized);
    } catch (error) {
      return res.status(500).json({
        error: "ANALYZE_AD_FAILED",
        message: error?.message || "Unknown error",
      });
    }
  });

  return router;
};
