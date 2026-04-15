const { GoogleGenerativeAI } = require("@google/generative-ai");

function getGeminiModel(modelName, generationConfig = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error("GEMINI_API_KEY_MISSING");
    error.code = "GEMINI_API_KEY_MISSING";
    throw error;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig,
  });
}

function getText(result) {
  try {
    return result?.response?.text?.() || "";
  } catch (err) {
    return "";
  }
}

function cleanJson(text) {
  return String(text || "")
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();
}

module.exports = {
  getGeminiModel,
  getText,
  cleanJson,
};

