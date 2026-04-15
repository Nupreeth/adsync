const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const CTA_KEYWORDS = ["get", "start", "try", "buy", "sign", "free", "join", "book", "claim", "now"];

function clean(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function pickFirst(arr) {
  for (const item of arr) {
    const t = clean(item);
    if (t) return t;
  }
  return "";
}

function findCta($) {
  const candidates = [];
  $("button, a").each((_, el) => {
    const text = clean($(el).text());
    if (!text) return;
    const lower = text.toLowerCase();
    if (CTA_KEYWORDS.some((keyword) => lower.includes(keyword))) {
      candidates.push(text);
    }
  });
  return pickFirst(candidates);
}

function extractTrustSignals($) {
  const results = [];
  const pattern = /\b(\d+%|\d+\+|trusted|customers|reviews|rating|★)\b/i;
  $("p, li, span, div").each((_, el) => {
    const text = clean($(el).text());
    if (!text || text.length < 8) return;
    if (pattern.test(text)) results.push(text);
  });
  return results.slice(0, 5);
}

router.post("/", async (req, res) => {
  try {
    const url = clean(req.body?.url);
    if (!/^https:\/\//i.test(url)) {
      return res.status(400).json({ error: "INVALID_URL" });
    }

    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      validateStatus: () => true,
    });

    if (response.status !== 200) {
      return res.status(502).json({ error: "SCRAPE_FAILED" });
    }

    const $ = cheerio.load(response.data);
    const paragraphs = $("p")
      .map((_, el) => clean($(el).text()))
      .get()
      .filter(Boolean);

    const payload = {
      url,
      title: clean($("title").text()),
      meta_description: clean($('meta[name="description"]').attr("content")),
      h1: clean($("h1").first().text()),
      h2: clean($("h2").first().text()),
      cta_text: findCta($),
      body_copy: paragraphs.slice(0, 3).join(" "),
      trust_signals: extractTrustSignals($),
    };

    return res.json(payload);
  } catch (error) {
    return res.status(502).json({
      error: "SCRAPE_FAILED",
      message: error?.message || "Failed to scrape page",
    });
  }
});

module.exports = router;

