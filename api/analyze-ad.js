const express = require("express");
const cors = require("cors");
const multer = require("multer");
const analyzeAd = require("../server/routes/analyzeAd");

const upload = multer({
  storage: multer.memoryStorage(),
  // Keep this low to avoid serverless body limits.
  limits: { fileSize: 4 * 1024 * 1024 },
});

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(analyzeAd(upload));

module.exports = (req, res) => {
  req.url = "/";
  return app(req, res);
};

