const express = require("express");
const cors = require("cors");
const personalize = require("../server/routes/personalize");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" }));
app.use(personalize);

module.exports = (req, res) => {
  req.url = "/";
  return app(req, res);
};

