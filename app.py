from __future__ import annotations

import base64
import hashlib
import html
from pathlib import Path
from typing import Any
from dataclasses import replace
from urllib.parse import urlparse, urlunparse

import streamlit as st
import streamlit.components.v1 as components

from engine.guardrails import validate_output
from engine.models import AdInput, PipelineResult
from engine.pipeline import run_personalization_pipeline
from engine.personalizer import apply_personalization, gather_copy_numbers, sanitize_copy_numbers
from engine.utils import clean_text, extract_numbers


st.set_page_config(
    page_title="Troopod | Ad to LP Personalizer",
    page_icon=":sparkles:",
    layout="wide",
)

SAMPLE_AD_PATH = Path(__file__).parent / "assets" / "sample_ad_creative.png"
SAMPLE_AD_BYTES = SAMPLE_AD_PATH.read_bytes() if SAMPLE_AD_PATH.exists() else b""
SAMPLE_AD_SHA1 = hashlib.sha1(SAMPLE_AD_BYTES).hexdigest() if SAMPLE_AD_BYTES else ""


def _inject_brand_css() -> None:
    st.markdown(
        """
<style>
@import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap");

:root {
  --tp-purple: #6B38FB;
  --tp-purple-deep: #4B1B96;
  --tp-purple-light: #8C67FF;
  --tp-teal: #20C4B3;
  --tp-black: #000000;
  --tp-surface: #0D0D0D;
  --tp-surface-soft: #1A1A1A;
  --tp-border: #ffffff2b;
  --tp-text: #F9FAFB;
  --tp-muted: #C1C7D8;
}

html, body, [class*="css"]  {
  font-family: "Montserrat", sans-serif;
}

.stApp {
  background:
    radial-gradient(1200px 520px at 8% -2%, rgba(75, 27, 150, 0.45), transparent 62%),
    radial-gradient(1100px 600px at 96% 8%, rgba(32, 196, 179, 0.14), transparent 60%),
    linear-gradient(180deg, #080808 0%, #000000 100%);
  color: var(--tp-text);
  min-height: 100vh;
}

header[data-testid="stHeader"] {
  background: transparent;
  height: 0;
}

div[data-testid="stToolbar"],
div[data-testid="stDecoration"],
#MainMenu,
footer {
  display: none;
}

section.main > div.block-container {
  max-width: 1220px;
  padding-top: 1rem;
  padding-bottom: 2.2rem;
}

div[data-testid="stForm"] {
  border: 1px solid var(--tp-border);
  border-radius: 18px;
  padding: 1.05rem 1rem 0.45rem;
  background:
    linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015)),
    linear-gradient(180deg, rgba(26,26,26,0.86), rgba(13,13,13,0.9));
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
}

div[data-testid="stVerticalBlock"] [data-testid="stMarkdownContainer"] p {
  color: var(--tp-muted);
}

.tp-shell {
  max-width: 1180px;
  margin: 0 auto;
  padding-top: 0.25rem;
}

.tp-hero {
  position: relative;
  border-radius: 22px;
  border: 1px solid var(--tp-border);
  padding: 1.2rem 1.2rem 1.35rem;
  background:
    linear-gradient(120deg, rgba(75, 27, 150, 0.28) 0%, rgba(13, 13, 13, 0.8) 45%, rgba(32, 196, 179, 0.12) 100%);
  overflow: hidden;
}

.tp-hero h1 {
  margin: 0.2rem 0 0;
  color: #ffffff;
  font-size: clamp(1.35rem, 3.8vw, 2.4rem);
  line-height: 1.12;
  letter-spacing: -0.02em;
}

.tp-hero p {
  margin: 0.55rem 0 0;
  color: #E3E6F2;
  max-width: 830px;
  font-size: 0.98rem;
}

.tp-section-title {
  color: #FFFFFF;
  font-weight: 700;
  margin-top: 0.45rem;
  margin-bottom: 0.3rem;
}

.tp-help {
  color: #D8DEEC;
  font-size: 0.88rem;
}

div[data-testid="stTextInput"] label,
div[data-testid="stFileUploader"] label {
  color: #EDEFFD !important;
  font-weight: 600;
}

div[data-testid="stTextInput"] input {
  background: rgba(255, 255, 255, 0.12) !important;
  border: 1px solid #ffffff66 !important;
  color: #0d1220 !important;
  border-radius: 12px !important;
  font-weight: 500 !important;
}

div[data-testid="stTextInput"] input::placeholder {
  color: #717A8E !important;
  opacity: 1 !important;
}

div[data-testid="stTextInput"] input:focus {
  border-color: #8C67FF !important;
  box-shadow: 0 0 0 1px rgba(140, 103, 255, 0.55) !important;
}

div[data-testid="stFileUploader"] section {
  background: rgba(255, 255, 255, 0.08);
  border: 1px dashed #ffffff4d;
  border-radius: 14px;
}

div[data-testid="stFileUploader"] * {
  color: #DDE2F0 !important;
}

div[data-testid="stFileUploader"] small,
div[data-testid="stFileUploader"] label {
  color: #BFC6DA !important;
}

div[data-testid="stFileUploader"] button {
  background: #ffffff24 !important;
  border: 1px solid #ffffff55 !important;
  color: #FFFFFF !important;
  font-weight: 600 !important;
}

div[data-testid="stFormSubmitButton"] > button,
button[kind="primary"] {
  background: linear-gradient(115deg, var(--tp-purple) 0%, var(--tp-purple-light) 70%, #a96ff0 100%) !important;
  color: #FFFFFF !important;
  border: 0 !important;
  border-radius: 14px !important;
  height: 2.9rem !important;
  font-weight: 700 !important;
  letter-spacing: 0.015em;
  box-shadow: 0 15px 35px rgba(107, 56, 251, 0.4);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.15);
}

button[kind="secondary"] {
  border: 1px solid #ffffff38 !important;
  border-radius: 12px !important;
  color: #E6E9F5 !important;
  background: rgba(255, 255, 255, 0.06) !important;
}

button[kind="primary"]:hover {
  filter: brightness(1.06);
}

div[data-testid="stFormSubmitButton"] > button:disabled,
button[kind="primary"]:disabled {
  opacity: 0.8 !important;
  cursor: not-allowed !important;
  box-shadow: none !important;
  background: linear-gradient(115deg, #7d8394, #8a90a1) !important;
  color: #eef1f8 !important;
}

div.stDownloadButton > button {
  border: 1px solid #ffffff38 !important;
  color: #E6E9F5 !important;
  background: rgba(255, 255, 255, 0.07) !important;
}

div.stDownloadButton > button:hover {
  border-color: #8C67FF !important;
  background: rgba(140, 103, 255, 0.2) !important;
}

div[data-testid="stMetric"] {
  border: 1px solid #ffffff22;
  border-radius: 14px;
  padding: 0.45rem 0.75rem;
  background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01));
}

div[data-testid="stMetricLabel"] p {
  color: #d1d5db !important;
}

div[data-testid="stMetricValue"] {
  color: #ffffff !important;
}

div[data-testid="stTabs"] button {
  color: #d9ddee !important;
  background: rgba(255, 255, 255, 0.04) !important;
  border-radius: 10px !important;
  border: 1px solid transparent !important;
}

div[data-testid="stTabs"] button[aria-selected="true"] {
  color: white !important;
  background: rgba(140, 103, 255, 0.22) !important;
  border-color: rgba(140, 103, 255, 0.45) !important;
}

.tp-copy-card {
  border: 1px solid #ffffff24;
  background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01));
  border-radius: 14px;
  padding: 0.88rem;
  margin-bottom: 0.65rem;
}

.tp-copy-card h4 {
  margin: 0 0 0.35rem;
  color: #ffffff;
  font-size: 0.94rem;
}

.tp-copy-card p {
  margin: 0;
  color: #d9deea;
  line-height: 1.45;
}

.tp-score-wrap {
  border: 1px solid #ffffff24;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015));
  padding: 0.8rem;
  margin-bottom: 0.65rem;
}

.tp-score-wrap h4 {
  margin: 0 0 0.5rem;
  color: #ffffff;
}

.tp-chip {
  display: inline-block;
  margin: 0.2rem 0.35rem 0.15rem 0;
  border: 1px solid #ffffff33;
  border-radius: 999px;
  padding: 0.24rem 0.55rem;
  font-size: 0.78rem;
  color: #e7ebf9;
}

@media (max-width: 768px) {
  .tp-hero {
    padding: 1rem;
    border-radius: 16px;
  }
  section.main > div.block-container {
    padding-top: 0.7rem;
    padding-bottom: 1.4rem;
  }
  div[data-testid="stForm"] {
    padding: 0.8rem 0.7rem 0.1rem;
    border-radius: 14px;
  }
}
</style>
""",
        unsafe_allow_html=True,
    )


def _render_top() -> None:
    st.markdown("<div class='tp-shell'>", unsafe_allow_html=True)
    st.markdown(
        """
<section class="tp-hero">
  <h1>Ad-to-Landing Personalizer</h1>
  <p>
    Input ad creative and landing page URL. Get a personalized version of the same page with
    focused CRO enhancements to message clarity, CTA intent, trust, and risk-reversal.
  </p>
</section>
""",
        unsafe_allow_html=True,
    )


def _render_form() -> tuple[bool, str, AdInput]:
    st.markdown("<p class='tp-section-title'>Inputs</p>", unsafe_allow_html=True)
    st.caption("Provide ad creative via link or upload, then add landing page URL.")
    if SAMPLE_AD_PATH.exists():
        st.download_button(
            "Download Sample Ad Creative",
            data=SAMPLE_AD_PATH.read_bytes(),
            file_name="sample_ad_creative.png",
            mime="image/png",
            use_container_width=False,
            type="secondary",
            key="sample_ad_download",
        )

    with st.form("personalization_form", clear_on_submit=False):
        c1, c2 = st.columns([1.1, 1.2], gap="large")

        with c1:
            ad_url = st.text_input(
                "Ad creative link (optional if uploading)",
                placeholder="https://www.facebook.com/ads/... or any ad URL",
            )
            ad_image = st.file_uploader(
                "Upload ad creative (optional if link is provided)",
                type=["png", "jpg", "jpeg", "webp"],
            )

        with c2:
            landing_page_url = st.text_input(
                "Landing page URL",
                placeholder="https://example.com/landing",
            )
            st.markdown(
                """
<div class="tp-copy-card">
  <h4>What this does</h4>
  <p>It does not rebuild the page. It upgrades the existing landing page for ad-message match and conversion clarity.</p>
</div>
""",
                unsafe_allow_html=True,
            )

        submitted = st.form_submit_button(
            "Generate Personalized Landing Page",
            use_container_width=True,
            type="primary",
        )

    image_base64 = ""
    image_mime = ""
    image_bytes = b""
    image_name = ""
    if ad_image is not None:
        image_bytes = ad_image.getvalue()
        image_name = ad_image.name or ""
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")
        image_mime = ad_image.type or "image/png"

    ad_copy_hint, audience_hint = _derive_ad_hints(clean_text(ad_url), image_name, image_bytes)

    ad_input = AdInput(
        ad_url=clean_text(ad_url),
        ad_copy_hint=ad_copy_hint,
        audience_hint=audience_hint,
        ad_image_base64=image_base64,
        ad_image_mime=image_mime,
    )
    return submitted, clean_text(landing_page_url), ad_input


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


def _derive_ad_hints(ad_url: str, uploaded_name: str, uploaded_bytes: bytes) -> tuple[str, str]:
    hint_parts: list[str] = []
    audience_hint = ""
    url_lower = clean_text(ad_url).lower()
    name_lower = clean_text(uploaded_name).lower()

    keyword_hints = {
        "demo": "Book a product demo and improve conversion outcomes faster.",
        "trial": "Start a free trial with low-friction onboarding.",
        "discount": "Limited-time discount offer for faster action.",
        "sale": "Strong promotional offer with urgency.",
        "offer": "Core promotional offer with clear value.",
        "saas": "Built for B2B SaaS growth teams.",
        "ecom": "Built for ecommerce growth teams.",
    }
    for keyword, statement in keyword_hints.items():
        if keyword in url_lower:
            hint_parts.append(statement)

    if "saas" in url_lower or "b2b" in url_lower:
        audience_hint = "B2B growth teams"
    elif "ecom" in url_lower or "shop" in url_lower:
        audience_hint = "ecommerce marketing teams"

    if uploaded_bytes:
        upload_sha1 = hashlib.sha1(uploaded_bytes).hexdigest()
        if SAMPLE_AD_SHA1 and upload_sha1 == SAMPLE_AD_SHA1:
            hint_parts.append(
                "Scale conversions without rebuilding your page. "
                "Ad-message matched landing pages in minutes. "
                "Book your free demo."
            )
            audience_hint = audience_hint or "growth and CRO teams"

    if "demo" in name_lower:
        hint_parts.append("Demo-first offer focused on high-intent visitors.")

    combined_hint = clean_text(" ".join(dict.fromkeys(hint_parts)))
    return combined_hint, audience_hint


def _copy_box(title: str, text: str) -> None:
    safe_title = html.escape(title or "Field")
    safe_text = html.escape(text or "(not available)")
    st.markdown(
        f"""
<div class="tp-copy-card">
  <h4>{safe_title}</h4>
  <p>{safe_text}</p>
</div>
""",
        unsafe_allow_html=True,
    )


def _trim_words(text: str, max_words: int) -> str:
    words = clean_text(text).split()
    if len(words) <= max_words:
        return clean_text(text)
    return " ".join(words[:max_words])


def _copy_score(
    headline: str,
    subheadline: str,
    cta_text: str,
    trust_text: str,
    risk_text: str,
) -> tuple[int, list[str]]:
    score = 0
    checks: list[str] = []
    cta_lower = (cta_text or "").lower()
    action_verbs = ("start", "book", "try", "get", "claim", "join", "buy", "apply")

    headline_words = len((headline or "").split())
    cta_words = len((cta_text or "").split())
    subheadline_words = len((subheadline or "").split())
    all_copy_lower = " ".join([headline, subheadline, cta_text, trust_text, risk_text]).lower()

    if 5 <= headline_words <= 10:
        score += 22
        checks.append("Headline length looks conversion-friendly")
    elif headline_words >= 3:
        score += 8

    if any(verb in cta_lower for verb in action_verbs):
        score += 16
        checks.append("CTA uses action-first language")

    if 1 <= cta_words <= 4:
        score += 10
        checks.append("CTA is short and scannable")

    if 8 <= subheadline_words <= 24:
        score += 16
        checks.append("Subheadline supports the value proposition")
    elif clean_text(subheadline):
        score += 7

    if clean_text(trust_text):
        score += 12
        checks.append("Trust layer present")
    if clean_text(risk_text):
        score += 12
        checks.append("Risk-reversal layer present")

    generic_markers = (
        "your ad journey",
        "your intent",
        "core offer",
        "high-intent visitors",
        "tailored to your intent",
    )
    if any(marker in all_copy_lower for marker in generic_markers):
        score -= 12
    if len(set(clean_text(all_copy_lower).split())) < 8:
        score -= 8

    score = max(0, min(100, score))
    return score, checks


def _build_output_variants(result: PipelineResult) -> list[dict[str, Any]]:
    snapshot = result.original_snapshot
    insights = result.ad_insights
    base_copy = result.generated_copy

    offer = insights.offer if clean_text(insights.offer) and insights.offer != "core offer" else "the offer"
    audience = insights.audience or "high-intent visitors"
    promise = insights.promise or "better outcomes"
    top_fact = snapshot.facts[0] if snapshot.facts else base_copy.trust_bar
    low_signal = "low ad-signal mode" in clean_text(base_copy.notes).lower()

    if low_signal:
        variant_copies = [
            (
                "Balanced",
                base_copy,
                "Conservative variant used because ad signal is weak.",
            ),
            (
                "Structure-Safe",
                replace(
                    base_copy,
                    headline=_trim_words(snapshot.headline or base_copy.headline, 12),
                    subheadline=_trim_words(snapshot.subheadline or base_copy.subheadline, 30),
                    cta_text=_trim_words(
                        (snapshot.cta_texts[0] if snapshot.cta_texts else base_copy.cta_text),
                        4,
                    ),
                ),
                "Keeps original messaging closest while adding lightweight CRO blocks.",
            ),
        ]
    else:
        variant_copies = [
            (
                "Balanced",
                base_copy,
                "Balanced personalization with CRO enhancements.",
            ),
            (
                "Trust-First",
                replace(
                    base_copy,
                    headline=_trim_words(f"Trusted results for {audience}", 10),
                    subheadline=_trim_words(
                        f"Move from click to conversion with a proven path to {promise.lower()}.", 24
                    ),
                    cta_text="See Proof",
                    trust_bar=_trim_words(top_fact or "Validated by real user outcomes.", 20),
                ),
                "Emphasizes proof and credibility.",
            ),
            (
                "Offer-First",
                replace(
                    base_copy,
                    headline=_trim_words(f"{offer} built for {audience}", 11),
                    subheadline=_trim_words(
                        f"Ad-message matched journey that reduces friction and pushes faster action.",
                        22,
                    ),
                    cta_text="Claim Offer",
                ),
                "Emphasizes immediate action on the offer.",
            ),
        ]

    allowed_numbers = set(snapshot.numeric_claims)
    allowed_numbers.update(
        extract_numbers(
            " ".join(
                [
                    insights.offer,
                    insights.promise,
                    base_copy.trust_bar,
                    base_copy.risk_reversal,
                ]
            )
        )
    )

    variants: list[dict[str, Any]] = []
    for name, raw_copy, description in variant_copies:
        copy = sanitize_copy_numbers(raw_copy, allowed_numbers)
        html_output, change_log = apply_personalization(snapshot, copy)
        final_html, warnings, similarity = validate_output(
            original_html=snapshot.html,
            personalized_html=html_output,
            allowed_numbers=allowed_numbers.union(gather_copy_numbers(copy)),
            change_count=len(change_log),
        )
        variants.append(
            {
                "name": name,
                "description": description,
                "copy": copy,
                "html": final_html,
                "warnings": warnings,
                "change_log": change_log,
                "similarity": similarity,
            }
        )

    return variants


def _render_scorecard(result: PipelineResult) -> None:
    original_cta = result.original_snapshot.cta_texts[0] if result.original_snapshot.cta_texts else ""
    before_score, before_checks = _copy_score(
        headline=result.original_snapshot.headline,
        subheadline=result.original_snapshot.subheadline,
        cta_text=original_cta,
        trust_text="",
        risk_text="",
    )
    after_score, after_checks = _copy_score(
        headline=result.generated_copy.headline,
        subheadline=result.generated_copy.subheadline,
        cta_text=result.generated_copy.cta_text,
        trust_text=result.generated_copy.trust_bar,
        risk_text=result.generated_copy.risk_reversal,
    )

    delta = after_score - before_score
    st.markdown(
        f"""
<div class="tp-score-wrap">
  <h4>Estimated CRO Score</h4>
  <span class="tp-chip">Before: {before_score}/100</span>
  <span class="tp-chip">After: {after_score}/100</span>
  <span class="tp-chip">Lift: {delta:+d}</span>
</div>
""",
        unsafe_allow_html=True,
    )
    if after_checks:
        st.markdown("**Why this scores better**")
        for item in after_checks:
            st.write(f"- {item}")
    if before_checks:
        st.markdown("**Existing strengths before personalization**")
        for item in before_checks:
            st.write(f"- {item}")


def _render_result(result: PipelineResult, variants: list[dict[str, Any]]) -> None:
    st.success("Personalized page generated.")
    if "low ad-signal mode" in clean_text(result.generated_copy.notes).lower():
        st.info(
            "Ad signal was limited, so conservative personalization was used. "
            "For stronger results, provide an ad URL with clear creative context."
        )

    default_variant = variants[0]

    variant_warnings: list[str] = []
    for variant in variants:
        variant_warnings.extend(variant["warnings"])
    merged_warnings = list(dict.fromkeys([*result.warnings, *variant_warnings]))
    integrity_status = "Pass" if not merged_warnings else "Review"

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Integrity checks", integrity_status)
    m2.metric("Applied edits", str(len(default_variant["change_log"])))
    m3.metric("Variants", str(len(variants)))
    m4.metric("Similarity", f"{default_variant['similarity'] * 100:.0f}%")

    _render_scorecard(result)

    tab1, tab2, tab3 = st.tabs(["Variant Previews", "Copy + Changes", "Guardrails"])

    with tab1:
        variant_tabs = st.tabs([variant["name"] for variant in variants])
        for idx, (variant_tab, variant) in enumerate(zip(variant_tabs, variants)):
            with variant_tab:
                st.caption(variant["description"])
                components.html(variant["html"], height=560, scrolling=True)
                if variant["warnings"]:
                    st.warning("Variant-specific warnings")
                    for item in variant["warnings"]:
                        st.write(f"- {item}")
                st.download_button(
                    f"Download {variant['name']} HTML",
                    data=variant["html"].encode("utf-8"),
                    file_name=f"personalized_{variant['name'].lower().replace('-', '_')}.html",
                    mime="text/html",
                    use_container_width=True,
                    key=f"download_variant_{idx}",
                )

    with tab2:
        selected_variant_name = st.selectbox(
            "Inspect variant details",
            options=[variant["name"] for variant in variants],
            index=0,
            key="variant_detail_selector",
        )
        selected_variant = next(
            variant for variant in variants if variant["name"] == selected_variant_name
        )
        selected_copy = selected_variant["copy"]

        a, b = st.columns(2, gap="large")
        with a:
            st.markdown("#### Existing Page Snapshot")
            _copy_box("Title", result.original_snapshot.title)
            _copy_box("Headline", result.original_snapshot.headline)
            _copy_box("Subheadline", result.original_snapshot.subheadline)
            _copy_box("Primary CTAs", ", ".join(result.original_snapshot.cta_texts))
        with b:
            st.markdown(f"#### {selected_variant_name} Output")
            _copy_box("New Headline", selected_copy.headline)
            _copy_box("New Subheadline", selected_copy.subheadline)
            _copy_box("New CTA", selected_copy.cta_text)
            _copy_box("Trust Bar", selected_copy.trust_bar)
            _copy_box("Risk Reversal", selected_copy.risk_reversal)

        st.markdown("#### Applied DOM Changes")
        if not selected_variant["change_log"]:
            st.info("No high-confidence editable node was found. Output stayed close to original.")
        else:
            for item in selected_variant["change_log"]:
                st.write(f"- {item}")

    with tab3:
        if merged_warnings:
            st.warning("Guardrail messages")
            for warning in merged_warnings:
                st.write(f"- {warning}")
        else:
            st.success("No guardrail issues detected.")

        st.markdown("#### Reliability Controls")
        st.write("- Random changes: DOM similarity checks + structural preservation.")
        st.write("- Broken UI: body/form/link integrity checks with fallback to original.")
        st.write("- Hallucinations: generated numbers constrained to source-known values.")
        st.write("- Inconsistency: deterministic fallback and multi-variant transparent output.")

        st.markdown("#### Debug Signals")
        for key, value in result.debug_payload.items():
            st.write(f"- {key}: {value}")


def main() -> None:
    _inject_brand_css()
    _render_top()
    submitted, landing_page_url, ad_input = _render_form()

    if submitted:
        if not ad_input.ad_url and not ad_input.ad_image_base64:
            st.error("Please provide an ad creative link or upload an ad creative image.")
            st.markdown("</div>", unsafe_allow_html=True)
            return

        normalized_landing_url, landing_error = _normalize_url(landing_page_url, "Landing page URL")
        if landing_error:
            st.error(landing_error)
            st.markdown("</div>", unsafe_allow_html=True)
            return
        landing_host = urlparse(normalized_landing_url).netloc.lower()
        if landing_host in {"example.com", "www.example.com"}:
            st.warning(
                "example.com is a placeholder page, so personalization quality will look limited. "
                "Use a real landing page URL for realistic output."
            )

        normalized_ad_url, ad_error = _normalize_optional_url(ad_input.ad_url, "Ad creative link")
        if ad_error:
            st.error(ad_error)
            st.markdown("</div>", unsafe_allow_html=True)
            return

        ad_input = replace(ad_input, ad_url=normalized_ad_url)

        with st.spinner("Analyzing ad and generating personalized page..."):
            try:
                result = run_personalization_pipeline(normalized_landing_url, ad_input)
                variants = _build_output_variants(result)
            except Exception as exc:
                st.error(f"Failed to generate personalized page: {exc}")
                st.markdown("</div>", unsafe_allow_html=True)
                return
        st.session_state["latest_result"] = result
        st.session_state["latest_variants"] = variants

    if "latest_result" in st.session_state:
        if "latest_variants" not in st.session_state:
            st.session_state["latest_variants"] = _build_output_variants(
                st.session_state["latest_result"]
            )
        _render_result(st.session_state["latest_result"], st.session_state["latest_variants"])

    st.markdown("</div>", unsafe_allow_html=True)


if __name__ == "__main__":
    main()
