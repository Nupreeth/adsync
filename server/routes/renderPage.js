const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const CTA_KEYWORDS = ["get", "start", "try", "buy", "sign", "free", "join", "book", "claim", "now"];

function clean(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeHref(value) {
  const href = clean(value);
  if (!href) return "#";
  if (/^(#|https?:\/\/|mailto:|tel:)/i.test(href)) return href;
  return "#";
}

function effectiveUrl(response, fallbackUrl) {
  return (
    response?.request?.res?.responseUrl ||
    response?.request?._redirectable?._currentUrl ||
    fallbackUrl
  );
}

function ensureBaseTag($, baseUrl) {
  if (!$("base").length) {
    const head = $("head");
    if (head.length) head.prepend(`<base href="${baseUrl}">`);
  } else {
    $("base").attr("href", baseUrl);
  }
}

function stripScripts($) {
  $("script").remove();
  // Drop noscript to avoid duplicated content blocks in preview.
  $("noscript").remove();
}

function findCtaElement($) {
  let best = null;
  $("button, a").each((_, el) => {
    const text = clean($(el).text());
    if (!text) return;
    const lower = text.toLowerCase();
    if (CTA_KEYWORDS.some((keyword) => lower.includes(keyword))) {
      best = $(el);
      return false;
    }
    return undefined;
  });
  return best;
}

function insertAfter($, anchor, html) {
  if (anchor && anchor.length) {
    anchor.after(html);
    return true;
  }
  return false;
}

router.post("/", async (req, res) => {
  try {
    const url = clean(req.body?.url);
    const personalized = req.body?.personalized;

    if (!/^https:\/\//i.test(url)) return res.status(400).json({ error: "INVALID_URL" });
    if (!personalized || typeof personalized !== "object") {
      return res.status(400).json({ error: "MISSING_PERSONALIZATION" });
    }

    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      validateStatus: () => true,
    });

    if (response.status !== 200 || !response.data) {
      return res.status(502).json({ error: "RENDER_FAILED" });
    }

    const baseUrl = effectiveUrl(response, url);
    const $ = cheerio.load(response.data);

    ensureBaseTag($, baseUrl);
    stripScripts($);

    const h1 = $("h1").first();
    if (h1.length && clean(personalized.new_headline)) {
      h1.text(clean(personalized.new_headline));
    }

    let h2 = $("h2").first();
    const subheadline = clean(personalized.new_subheadline);
    if (subheadline) {
      if (h2.length) {
        h2.text(subheadline);
      } else if (h1.length) {
        insertAfter(
          $,
          h1,
          `<h2 style="margin-top:0.75rem; font-weight:600;">${escapeHtml(subheadline)}</h2>`
        );
        h2 = $("h2").first();
      }
    }

    const heroBody = clean(personalized.new_hero_body);
    if (heroBody) {
      const anchor = h2.length ? h2 : h1;
      if (anchor.length) {
        insertAfter(
          $,
          anchor,
          `<p style="margin-top:0.75rem; max-width:70ch; line-height:1.5;">${escapeHtml(heroBody)}</p>`
        );
      }
    }

    const ctaEl = findCtaElement($);
    if (ctaEl && clean(personalized.new_cta_text)) {
      ctaEl.text(clean(personalized.new_cta_text));
    }

    const croCard = `
      <div style="margin-top:1rem; padding:1rem; border:1px solid rgba(15,23,42,0.15); border-radius:12px; background:rgba(255,255,255,0.6); backdrop-filter: blur(6px); max-width: 72ch;">
        <div style="font-weight:700; margin-bottom:0.35rem;">Why this page now matches your ad</div>
        <div style="opacity:0.9; line-height:1.5;">
          We aligned the hero promise, clarified the call-to-action, and added lightweight trust + risk reversal to reduce hesitation.
        </div>
      </div>
    `;

    // Best-effort placement near the hero.
    const heroAnchor = $("h1").first();
    if (heroAnchor.length) insertAfter($, heroAnchor, croCard);

    const stickyCtaText = clean(personalized.new_cta_text) || "Get Started";
    const stickyHref = sanitizeHref(ctaEl?.attr("href")) || "#";
    const sticky = `
      <div style="position:fixed; left:0; right:0; bottom:0; padding:0.75rem 1rem; background:rgba(10,10,15,0.86); border-top:1px solid rgba(148,163,184,0.25); z-index:9999;">
        <div style="max-width:1100px; margin:0 auto; display:flex; align-items:center; justify-content:space-between; gap:0.75rem;">
          <div style="color:rgba(248,250,252,0.92); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            Ready to continue?
          </div>
          <a href="${stickyHref}" style="display:inline-flex; align-items:center; justify-content:center; padding:0.65rem 0.95rem; border-radius:12px; background:linear-gradient(135deg,#6B38FB,#20C4B3); color:white; font-weight:700; text-decoration:none;">
            ${escapeHtml(stickyCtaText)}
          </a>
        </div>
      </div>
    `;

    $("body").append(sticky);

    return res.json({ url: baseUrl, html: $.html() });
  } catch (error) {
    return res.status(502).json({
      error: "RENDER_FAILED",
      message: error?.message || "Failed to render preview",
    });
  }
});

module.exports = router;
