function isString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidScore(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function validateOutput(payload) {
  if (!payload || typeof payload !== "object") return false;

  const requiredTextKeys = [
    "new_headline",
    "new_subheadline",
    "new_cta_text",
    "new_hero_body",
    "grounding_notes",
  ];

  for (const key of requiredTextKeys) {
    if (key === "grounding_notes" && payload[key] === null) continue;
    if (!isString(payload[key])) return false;
  }

  if (!isValidScore(payload.message_match_score_before)) return false;
  if (!isValidScore(payload.message_match_score_after)) return false;

  if (!payload.cro_rationale || typeof payload.cro_rationale !== "object") return false;
  const rationaleKeys = ["headline", "subheadline", "cta", "body"];
  for (const key of rationaleKeys) {
    if (!isString(payload.cro_rationale[key])) return false;
  }

  if (!Array.isArray(payload.additional_recommendations)) return false;
  if (payload.additional_recommendations.length < 1) return false;

  for (const item of payload.additional_recommendations) {
    if (!item || typeof item !== "object") return false;
    if (!isString(item.title) || !isString(item.description) || !isString(item.principle)) return false;
  }

  return true;
}

module.exports = validateOutput;

