const { GoogleGenerativeAI } = require("@google/generative-ai");

const MODEL_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const DEFAULT_TEXT_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-pro",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-pro",
];

const DEFAULT_VISION_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-pro",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-pro-vision",
];

let cachedModels = null;
let cachedModelsAt = 0;

function requireApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error("GEMINI_API_KEY_MISSING");
    error.code = "GEMINI_API_KEY_MISSING";
    throw error;
  }
  return apiKey;
}

function normalizeModelName(value) {
  return String(value || "").trim().replace(/^models\//i, "");
}

function uniquePush(list, value) {
  if (!value) return;
  if (!list.includes(value)) list.push(value);
}

async function listModels(apiKey) {
  if (typeof fetch !== "function") return [];

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) return [];
    const json = await response.json();
    return Array.isArray(json?.models) ? json.models : [];
  } catch (error) {
    return [];
  }
}

function scoreModelName(name, vision) {
  const lower = String(name || "").toLowerCase();
  let score = 0;
  if (lower.includes("flash")) score += 5;
  if (lower.includes("pro")) score += 3;
  if (lower.includes("vision")) score += vision ? 6 : 1;
  // Mild preference for newer families when present.
  if (lower.includes("2.")) score += 2;
  return score;
}

async function getModelCandidates({ vision = false } = {}) {
  const apiKey = requireApiKey();
  const candidates = [];

  const envModel = normalizeModelName(
    vision ? process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL : process.env.GEMINI_MODEL
  );
  uniquePush(candidates, envModel);

  const now = Date.now();
  if (!cachedModels || now - cachedModelsAt > MODEL_CACHE_TTL_MS) {
    cachedModels = await listModels(apiKey);
    cachedModelsAt = now;
  }

  const fromApi = cachedModels
    .filter((model) =>
      Array.isArray(model?.supportedGenerationMethods)
        ? model.supportedGenerationMethods.includes("generateContent")
        : true
    )
    .map((model) => normalizeModelName(model?.name))
    .filter(Boolean);

  fromApi
    .map((name) => ({ name, score: scoreModelName(name, vision) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .forEach((entry) => uniquePush(candidates, entry.name));

  const defaults = vision ? DEFAULT_VISION_MODELS : DEFAULT_TEXT_MODELS;
  defaults.forEach((name) => uniquePush(candidates, name));

  // Keep the retry list small to avoid long tail latency.
  return candidates.filter(Boolean).slice(0, 6);
}

function shouldTryNextModel(error) {
  const message = String(error?.message || "");
  return (
    /is not found/i.test(message) ||
    /not found for api version/i.test(message) ||
    /not supported for generatecontent/i.test(message) ||
    /does not support/i.test(message) ||
    /unsupported/i.test(message)
  );
}

async function generateContentWithFallback({ vision = false, generationConfig = {}, content }) {
  const apiKey = requireApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);

  const modelCandidates = await getModelCandidates({ vision });
  let lastError = null;

  for (const modelName of modelCandidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig });
      const result = await model.generateContent(content);
      return { result, modelName };
    } catch (error) {
      lastError = error;
      if (shouldTryNextModel(error)) continue;
      throw error;
    }
  }

  const error = new Error("GEMINI_MODEL_UNAVAILABLE");
  error.code = "GEMINI_MODEL_UNAVAILABLE";
  error.details = String(lastError?.message || "");
  throw error;
}

function getText(result) {
  try {
    return result?.response?.text?.() || "";
  } catch (err) {
    return "";
  }
}

function cleanJson(text) {
  const stripped = String(text || "")
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return stripped.slice(start, end + 1).trim();
  }
  return stripped;
}

function safeJsonParse(text) {
  const candidate = cleanJson(text);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    return null;
  }
}

module.exports = {
  generateContentWithFallback,
  getText,
  cleanJson,
  safeJsonParse,
};
