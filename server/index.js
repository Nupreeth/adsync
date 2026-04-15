const express = require("express");
const cors = require("cors");
const multer = require("multer");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use("/api/analyze-ad", require("./routes/analyzeAd")(upload));
app.use("/api/scrape-page", require("./routes/scrapePage"));
app.use("/api/personalize", require("./routes/personalize"));
app.use("/api/render-page", require("./routes/renderPage"));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`AdSync server running on http://localhost:${port}`);
});

