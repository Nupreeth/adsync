from __future__ import annotations

import sys
from pathlib import Path
from urllib.parse import urlparse, urlunparse

from flask import Flask, jsonify, request

# Ensure root imports work on Vercel Python runtime.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from engine.models import AdInput
from engine.pipeline import run_personalization_pipeline
from engine.utils import clean_text


app = Flask(__name__)


def _normalize_url(raw_url: str, field_name: str) -> tuple[str, str]:
    value = clean_text(raw_url)
    if not value:
        return "", f"{field_name} is required."

    normalized = value if "://" in value else f"https://{value}"
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return "", f"{field_name} must be a valid URL."

    cleaned = urlunparse(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path or "",
            parsed.params,
            parsed.query,
            "",
        )
    )
    return cleaned, ""


def _normalize_optional_url(raw_url: str, field_name: str) -> tuple[str, str]:
    value = clean_text(raw_url)
    if not value:
        return "", ""
    normalized, error = _normalize_url(value, field_name)
    return (normalized, error) if not error else ("", error)


@app.get("/api/health")
def health() -> tuple[dict[str, str], int]:
    return {"status": "ok"}, 200


@app.post("/api/personalize")
def personalize():
    payload = request.get_json(silent=True) or {}

    ad_url = payload.get("ad_url", "")
    landing_page_url = payload.get("landing_page_url", "")
    ad_image_base64 = payload.get("ad_image_base64", "")
    ad_image_mime = payload.get("ad_image_mime", "")

    if not clean_text(ad_url) and not clean_text(ad_image_base64):
        return jsonify({"error": "Provide ad creative link or upload ad creative image."}), 400

    normalized_landing, landing_err = _normalize_url(landing_page_url, "Landing page URL")
    if landing_err:
        return jsonify({"error": landing_err}), 400

    normalized_ad, ad_err = _normalize_optional_url(ad_url, "Ad creative link")
    if ad_err:
        return jsonify({"error": ad_err}), 400

    ad_input = AdInput(
        ad_url=normalized_ad,
        ad_copy_hint=clean_text(payload.get("ad_copy_hint", "")),
        audience_hint=clean_text(payload.get("audience_hint", "")),
        ad_image_base64=clean_text(ad_image_base64),
        ad_image_mime=clean_text(ad_image_mime),
    )

    try:
        result = run_personalization_pipeline(normalized_landing, ad_input)
    except Exception as exc:  # pragma: no cover
        return jsonify({"error": f"Personalization failed: {exc}"}), 500

    return (
        jsonify(
            {
                "personalized_html": result.personalized_html,
                "landing_page_url": result.landing_page_url,
                "headline": result.generated_copy.headline,
                "subheadline": result.generated_copy.subheadline,
                "cta_text": result.generated_copy.cta_text,
                "trust_bar": result.generated_copy.trust_bar,
                "risk_reversal": result.generated_copy.risk_reversal,
                "change_log": result.change_log,
                "warnings": result.warnings,
                "similarity_score": result.similarity_score,
                "debug_payload": result.debug_payload,
            }
        ),
        200,
    )


if __name__ == "__main__":  # pragma: no cover
    app.run(host="0.0.0.0", port=8000, debug=True)

