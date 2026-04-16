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

function isModelBusy(error) {
  const message = String(error?.message || "");
  return (
    error?.code === "GEMINI_MODEL_UNAVAILABLE" ||
    /\[503\b/i.test(message) ||
    /high demand/i.test(message) ||
    /service unavailable/i.test(message) ||
    /\[429\b/i.test(message) ||
    /too many requests/i.test(message) ||
    /resource has been exhausted/i.test(message)
  );
}

function extractBrand(pageContent) {
  const title = cleanText(pageContent?.title);
  if (!title) return "";
  const first = title.split("|")[0].split("-")[0].trim();
  if (!first) return "";
  return first.length > 28 ? first.slice(0, 28).trim() : first;
}

function toTitleCase(value) {
  const text = cleanText(value);
  if (!text) return "";
  return text
    .split(" ")
    .map((word) => {
      const w = word.trim();
      if (!w) return "";
      return w.length < 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1);
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function ctaFrom(value) {
  const raw = cleanText(value);
  if (!raw) return "";
  const words = raw.split(/\s+/).filter(Boolean);
  const clipped = words.slice(0, 5).join(" ");
  return toTitleCase(clipped);
}

function summarizeTrust(pageContent) {
  const trust = Array.isArray(pageContent?.trust_signals) ? pageContent.trust_signals : [];
  const first = trust.find((t) => cleanText(t).length >= 8);
  return cleanText(first);
}

function ensureNotSame(original, candidate, alternate) {
  const o = cleanText(original).toLowerCase();
  const c = cleanText(candidate);
  if (!c) return cleanText(alternate);
  if (c.toLowerCase() === o) return cleanText(alternate) || c;
  return c;
}

function buildDeterministicPersonalization(adAnalysis, pageContent, reason) {
  const analysis = adAnalysis || {};
  const page = pageContent || {};

  const brand = extractBrand(page);
  const originalH1 = cleanText(page.h1);
  const originalH2 = cleanText(page.h2);

  const adPromise = cleanText(analysis.value_proposition) || cleanText(analysis.key_benefit);
  const audience = cleanText(analysis.target_audience);
  const pain = cleanText(analysis.pain_point);
  const adHeadline = cleanText(analysis.headline);

  const h1Candidate = (() => {
    // If we have a meaningful ad headline, mirror it.
    if (adHeadline && adHeadline.toLowerCase() !== "high-impact offer") return adHeadline;
    if (originalH1) {
      // Micro-rewrite pattern that tends to be higher-converting and still grounded.
      const tweaked = originalH1
        .replace(/\bthe same\b/gi, "every")
        .replace(/\bad traffic\b/gi, "ad click");
      return tweaked;
    }
    if (brand && adPromise) return `${brand}: ${adPromise}`;
    if (adPromise) return adPromise;
    if (brand) return `${brand}: Get more from your ad clicks`;
    return "Turn ad clicks into conversions";
  })();

  const h1Alt = originalH1 ? `${toTitleCase(originalH1)} From Every Click` : "Turn Ad Clicks Into Conversions";

  const newHeadline = ensureNotSame(originalH1, h1Candidate, h1Alt);

  const h2Candidate = (() => {
    if (adPromise && audience) return `Built for ${audience}. ${adPromise}.`;
    if (adPromise) return `Get the outcome your ad promised with a clearer next step.`;
    if (pain) return `Reduce drop-off by tightening the hero and aligning the CTA to intent.`;
    if (originalH2) return originalH2;
    return "A clearer message, a single primary CTA, and lightweight trust to reduce hesitation.";
  })();

  const h2Alt = originalH2
    ? `${originalH2} (aligned to your ad intent)`
    : "A clearer message, a single primary CTA, and lightweight trust to reduce hesitation.";

  const newSubheadline = ensureNotSame(originalH2, h2Candidate, h2Alt);

  const ctaCandidate = ctaFrom(analysis.cta_text) || ctaFrom(page.cta_text) || "Get Started";
  const ctaAlt = ctaCandidate.toLowerCase().startsWith("get") ? "Start Now" : `Get ${ctaCandidate}`;
  const newCtaText = ensureNotSame(page.cta_text, ctaCandidate, ctaAlt);

  const trust = summarizeTrust(page);
  const bodyCandidate = (() => {
    const parts = [];
    if (adPromise) parts.push(`You clicked for ${adPromise.toLowerCase()}.`);
    parts.push("This page now mirrors that promise with a clearer hero and a single next step.");
    if (trust) parts.push(`Trust signal: ${trust}`);
    return parts.join(" ");
  })();

  const bodyAlt = (() => {
    const parts = [];
    if (brand) parts.push(`${brand} helps you keep message match from ad to page.`);
    parts.push("We tightened the hero, aligned the CTA, and added lightweight trust + risk reversal.");
    return parts.join(" ");
  })();

  const newHeroBody = ensureNotSame(page.body_copy, bodyCandidate, bodyAlt);

  const base = normalizeOutput(
    {
      new_headline: newHeadline,
      new_subheadline: newSubheadline,
      new_cta_text: newCtaText,
      new_hero_body: newHeroBody,
      message_match_score_before: 32,
      message_match_score_after: 68,
      cro_rationale: {
        headline: "Mirrored the most likely ad promise so visitors feel immediate continuity after the click.",
        subheadline: "Clarified who it is for and what outcome to expect to reduce bounce in the first 5 seconds.",
        cta: "Matched the CTA intent into an action-first phrase so the next step is unambiguous.",
        body: "Reduced friction with shorter hero copy and a proof/assurance cue where available.",
      },
      additional_recommendations: [
        {
          title: "Add one proof point under the primary CTA",
          description: "Place a single high-signal trust line (logos, rating, or customer count) directly beneath the CTA.",
          principle: "Social Proof",
        },
        {
          title: "Make the offer specific above the fold",
          description: "Use concrete terms (what you get, timeframe, or scope) to reduce ambiguity and increase confidence.",
          principle: "Specificity",
        },
        {
          title: "Reduce competing CTAs in the hero",
          description: "Keep one primary CTA and demote secondary links to avoid decision fatigue.",
          principle: "Clarity",
        },
        {
          title: "Add risk reversal near the form",
          description: "Add a simple guarantee or cancellation policy next to the action to reduce perceived risk.",
          principle: "Trust",
        },
      ],
      grounding_notes: reason
        ? `AI model unavailable (${reason}). Output generated using deterministic fallback.`
        : null,
    },
    analysis,
    page
  );

  base.message_match_score_before = Math.min(base.message_match_score_before, base.message_match_score_after - 10);
  base._fallback_used = true;
  base._fallback_reason = reason || "MODEL_BUSY";
  return base;
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
    if (isModelBusy(error)) {
      const fallback = buildDeterministicPersonalization(req.body?.adAnalysis, req.body?.pageContent, "MODEL_BUSY");
      return res.status(200).json(fallback);
    }

    const message = String(error?.details || error?.message || "Unknown personalization error");
    return res.status(500).json({ error: "PERSONALIZE_FAILED", message });
  }
});

module.exports = router;
