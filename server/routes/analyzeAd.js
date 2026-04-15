const express = require("express");
const client = require("../utils/claudeClient");

const SYSTEM_PROMPT = `
You are an expert ad analyst and CRO specialist. Analyze the ad image provided and extract
structured information. Return ONLY a valid JSON object — no markdown, no backticks,
no explanation. Just raw JSON.
`.trim();

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

If you cannot read text clearly, make your best inference. Never return empty strings —
always provide your best guess based on visual context.
`.trim();

function extractText(response) {
  if (!response || !Array.isArray(response.content)) return "";
  const block = response.content.find((item) => item.type === "text");
  return block?.text || "";
}

function cleanClaudeJson(rawText) {
  return rawText.replace(/```json|```/gi, "").trim();
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
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: "ANTHROPIC_API_KEY_MISSING" });
      }

      const imageUrl = req.body?.imageUrl;
      const file = req.file;

      if (!file && !imageUrl) {
        return res.status(400).json({ error: "AD_IMAGE_REQUIRED" });
      }

      const content = [{ type: "text", text: USER_PROMPT }];

      if (file) {
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: file.mimetype || "image/png",
            data: file.buffer.toString("base64"),
          },
        });
      } else {
        content.push({
          type: "image",
          source: {
            type: "url",
            url: imageUrl,
          },
        });
      }

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      });

      const raw = cleanClaudeJson(extractText(response));
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

