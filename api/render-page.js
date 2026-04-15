const express = require("express");
const cors = require("cors");
const renderPage = require("../server/routes/renderPage");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" }));
app.use(renderPage);

module.exports = (req, res) => {
  req.url = "/";
  return app(req, res);
};

