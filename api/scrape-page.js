const express = require("express");
const cors = require("cors");
const scrapePage = require("../server/routes/scrapePage");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" }));
app.use(scrapePage);

module.exports = (req, res) => {
  req.url = "/";
  return app(req, res);
};

