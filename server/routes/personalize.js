const express = require("express");
const { generateContentWithFallback, safeJsonParse, getText } = require("../utils/geminiClient");
const validateOutput = require("../utils/validateOutput");

const router = express.Router();

const SYSTEM_PROMPT = `
You are a world-class CRO expert and conversion copywriter. You will receive analysis of an
ad creative and a landing page. Your job is to rewrite the landing page copy to create perfect
message match with the ad, improving conversion by ensuring users who clicked the ad feel
they landed in exactly the right place.

Return ONLY a valid JSON object. No markdown. No backticks. No explanation. Raw JSON only.
`.trim();

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function clampScore(value, fallback) {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeOutput(payload, adAnalysis, pageContent) {
  const output = payload && typeof payload === "object" ? { ...payload } : {};

  output.new_headline =
    cleanText(output.new_headline) ||
    cleanText(adAnalysis?.headline) ||
    cleanText(pageContent?.h1) ||
    "A better fit for your ad click";

  output.new_subheadline =
    cleanText(output.new_subheadline) ||
    cleanText(adAnalysis?.value_proposition) ||
    cleanText(pageContent?.h2) ||
    "A clearer next step, aligned to what you just clicked.";

  output.new_cta_text =
    cleanText(output.new_cta_text) ||
    cleanText(adAnalysis?.cta_text) ||
    cleanText(pageContent?.cta_text) ||
    "Get Started";

  output.new_hero_body =
    cleanText(output.new_hero_body) ||
    cleanText(pageContent?.body_copy) ||
    "Continue your journey with a clearer offer, less friction, and a single next step.";

  output.message_match_score_before = clampScore(output.message_match_score_before, 35);
  output.message_match_score_after = clampScore(output.message_match_score_after, 70);

  output.cro_rationale = output.cro_rationale && typeof output.cro_rationale === "object" ? output.cro_rationale : {};
  output.cro_rationale.headline =
    cleanText(output.cro_rationale.headline) || "Aligned the headline to mirror the ad promise for continuity.";
  output.cro_rationale.subheadline =
    cleanText(output.cro_rationale.subheadline) || "Added supporting value context to reduce uncertainty after the click.";
  output.cro_rationale.cta =
    cleanText(output.cro_rationale.cta) || "Matched the CTA intent to the ad so the next step feels obvious.";
  output.cro_rationale.body =
    cleanText(output.cro_rationale.body) || "Reduced friction with shorter, benefit-led hero copy.";

  const recommendations = ensureArray(output.additional_recommendations).map((item) => ({
    title: cleanText(item?.title),
    description: cleanText(item?.description),
    principle: cleanText(item?.principle),
  }));

  output.additional_recommendations = recommendations.filter(
    (item) => item.title && item.description && item.principle
  );

  if (output.additional_recommendations.length === 0) {
    output.additional_recommendations = [
      {
        title: "Add high-signal trust near the CTA",
        description: "Place a short proof point (logos, ratings, or a number) directly under the primary CTA.",
        principle: "Trust",
      },
      {
        title: "Tighten hero into one promise + one next step",
        description: "Keep the hero focused: one outcome, one CTA, and one supporting line to reduce choice overload.",
        principle: "Clarity",
      },
      {
        title: "Add risk reversal next to the CTA",
        description: "Call out free cancellation, no credit card, or money-back terms to reduce hesitation.",
        principle: "Trust",
      },
      {
        title: "Make the offer specific",
        description: "Use concrete details from the ad (numbers, timeframe, or inclusions) to increase credibility.",
        principle: "Specificity",
      },
    ];
  }

  if (output.grounding_notes === undefined) output.grounding_notes = null;
  if (output.grounding_notes !== null) {
    const grounding = cleanText(output.grounding_notes);
    output.grounding_notes = grounding ? grounding : null;
  }

  return output;
}

function buildPrompt(adAnalysis, pageContent, retry = false) {
  const retryNote = retry
    ? '\nIMPORTANT: Your previous response was invalid. Return ONLY the raw JSON object, nothing else. No markdown formatting.'
    : "";

  return `
Ad Analysis:
${JSON.stringify(adAnalysis, null, 2)}

Landing Page Content:
${JSON.stringify(pageContent, null, 2)}

Rewrite the landing page copy to match the ad's messaging. Apply these CRO principles:
- Message match: mirror the ad's exact language and promise
- Benefit-led headline: lead with the outcome, not the feature
- Single clear CTA: one action, specific and verb-led
- Specificity: use numbers and concrete details where possible
- Continuity of tone: match the ad's emotional tone exactly

Return this exact JSON:
{
  "new_headline": "rewritten h1 headline",
  "new_subheadline": "rewritten h2 or subheadline",
  "new_cta_text": "rewritten CTA button text",
  "new_hero_body": "2-3 sentence rewritten hero body copy",
  "message_match_score_before": 0,
  "message_match_score_after": 0,
  "cro_rationale": {
    "headline": "one sentence explaining why you changed it",
    "subheadline": "one sentence explaining why you changed it",
    "cta": "one sentence explaining why you changed it",
    "body": "one sentence explaining why you changed it"
  },
  "additional_recommendations": [
    {
      "title": "short recommendation title",
      "description": "1-2 sentence explanation",
      "principle": "one of: Social Proof / Urgency / Clarity / Trust / Specificity / Visual Hierarchy"
    }
  ],
  "grounding_notes": null
}

Generate at least 4 additional_recommendations. Be specific to this page and ad, not generic.
message_match_score_before and message_match_score_after must be numbers from 0 to 100.
${retryNote}
`.trim();
}

async function callGemini(userPrompt) {
  const { result } = await generateContentWithFallback({
    vision: false,
    generationConfig: { maxOutputTokens: 2500, temperature: 0.3 },
    content: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
  });
  return getText(result);
}

router.post("/", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY_MISSING" });
    }

    const { adAnalysis, pageContent } = req.body || {};
    if (!adAnalysis || !pageContent) {
      return res.status(400).json({ error: "MISSING_INPUTS" });
    }

    const firstPrompt = buildPrompt(adAnalysis, pageContent, false);
    let parsed = null;

    try {
      parsed = safeJsonParse(await callGemini(firstPrompt));
    } catch (err) {
      parsed = null;
    }

    parsed = normalizeOutput(parsed, adAnalysis, pageContent);
    if (!validateOutput(parsed)) {
      const secondPrompt = buildPrompt(adAnalysis, pageContent, true);
      try {
        parsed = safeJsonParse(await callGemini(secondPrompt));
      } catch (err) {
        parsed = null;
      }
    }

    parsed = normalizeOutput(parsed, adAnalysis, pageContent);
    if (!validateOutput(parsed)) {
      return res.status(422).json({ error: "AI_OUTPUT_INVALID" });
    }

    return res.json(parsed);
  } catch (error) {
    const message = String(error?.message || "Unknown personalization error");
    if (
      error?.code === "GEMINI_MODEL_UNAVAILABLE" ||
      /\[503\b/i.test(message) ||
      /high demand/i.test(message) ||
      /service unavailable/i.test(message)
    ) {
      return res.status(503).json({ error: "MODEL_BUSY", message });
    }

    if (/\[429\b/i.test(message) || /too many requests/i.test(message)) {
      return res.status(429).json({ error: "RATE_LIMITED", message });
    }

    return res.status(500).json({ error: "PERSONALIZE_FAILED", message });
  }
});

module.exports = router;
