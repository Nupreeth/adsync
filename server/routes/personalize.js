const express = require("express");
const client = require("../utils/claudeClient");
const validateOutput = require("../utils/validateOutput");

const router = express.Router();

const SYSTEM_PROMPT = `
You are a world-class CRO expert and conversion copywriter. You will receive analysis of an
ad creative and a landing page. Your job is to rewrite the landing page copy to create perfect
message match with the ad, improving conversion by ensuring users who clicked the ad feel
they landed in exactly the right place.

Return ONLY a valid JSON object. No markdown. No backticks. No explanation. Raw JSON only.
`.trim();

function clean(text) {
  return (text || "").replace(/```json|```/gi, "").trim();
}

function extractText(response) {
  if (!response || !Array.isArray(response.content)) return "";
  const block = response.content.find((item) => item.type === "text");
  return block?.text || "";
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
  "message_match_score_before": <number 0-100, how well original page matched the ad>,
  "message_match_score_after": <number 0-100, how well your new copy matches the ad>,
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
  "grounding_notes": "note any claims you could not verify from either the ad or page - write null if all claims are grounded"
}

Generate at least 4 additional_recommendations. Be specific to this page and ad, not generic.
${retryNote}
`.trim();
}

async function callClaude(userPrompt) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    temperature: 0.3,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: userPrompt }],
      },
    ],
  });

  return clean(extractText(response));
}

router.post("/", async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "ANTHROPIC_API_KEY_MISSING" });
    }

    const { adAnalysis, pageContent } = req.body || {};
    if (!adAnalysis || !pageContent) {
      return res.status(400).json({ error: "MISSING_INPUTS" });
    }

    const firstPrompt = buildPrompt(adAnalysis, pageContent, false);
    let parsed = null;

    try {
      parsed = JSON.parse(await callClaude(firstPrompt));
    } catch (err) {
      parsed = null;
    }

    if (!validateOutput(parsed)) {
      const secondPrompt = buildPrompt(adAnalysis, pageContent, true);
      try {
        parsed = JSON.parse(await callClaude(secondPrompt));
      } catch (err) {
        parsed = null;
      }
    }

    if (!validateOutput(parsed)) {
      return res.status(422).json({ error: "AI_OUTPUT_INVALID" });
    }

    return res.json(parsed);
  } catch (error) {
    return res.status(500).json({
      error: "PERSONALIZE_FAILED",
      message: error?.message || "Unknown personalization error",
    });
  }
});

module.exports = router;
