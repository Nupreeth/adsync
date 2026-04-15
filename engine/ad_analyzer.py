from __future__ import annotations

import json
import os
import re
from typing import Tuple

from .models import AdInput, AdInsights, PageSnapshot
from .utils import clean_text, domain_to_phrase, first_non_empty, top_terms


def derive_ad_insights(ad_input: AdInput, page: PageSnapshot) -> Tuple[AdInsights, list[str]]:
    warnings: list[str] = []

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if api_key:
        insights = _analyze_with_openai(ad_input, page, warnings)
        if insights is not None:
            return insights, warnings

    return _fallback_ad_insights(ad_input, page), warnings


def _analyze_with_openai(
    ad_input: AdInput, page: PageSnapshot, warnings: list[str]
) -> AdInsights | None:
    try:
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

        ad_summary_text = clean_text(
            " ".join(
                [
                    ad_input.ad_copy_hint,
                    f"Ad URL hint: {ad_input.ad_url}" if ad_input.ad_url else "",
                    f"Audience hint: {ad_input.audience_hint}" if ad_input.audience_hint else "",
                ]
            )
        )
        page_summary_text = clean_text(
            " ".join(
                [
                    f"Page title: {page.title}",
                    f"Current headline: {page.headline}",
                    f"Current subheadline: {page.subheadline}",
                    f"Current CTAs: {', '.join(page.cta_texts)}",
                    f"Known facts: {' | '.join(page.facts)}",
                ]
            )
        )

        user_content = [
            {"type": "input_text", "text": f"Ad context: {ad_summary_text}"},
            {"type": "input_text", "text": f"Landing context: {page_summary_text}"},
        ]

        if ad_input.ad_image_base64 and ad_input.ad_image_mime:
            user_content.append(
                {
                    "type": "input_image",
                    "image_url": (
                        f"data:{ad_input.ad_image_mime};base64,{ad_input.ad_image_base64}"
                    ),
                }
            )

        response = client.responses.create(
            model=model,
            temperature=0.2,
            input=[
                {
                    "role": "system",
                    "content": [
                        {
                            "type": "input_text",
                            "text": (
                                "You are Ad Insight Agent for conversion optimization. "
                                "Return strict JSON only with keys: "
                                "audience, promise, offer, pain_points, tone, claims, key_terms, source_summary. "
                                "Use only information from inputs; no made-up facts."
                            ),
                        }
                    ],
                },
                {"role": "user", "content": user_content},
            ],
            text={"format": {"type": "json_object"}},
        )

        raw = _response_to_text(response)
        parsed = json.loads(raw)
        return AdInsights(
            audience=clean_text(parsed.get("audience", "")) or "high-intent visitors",
            promise=clean_text(parsed.get("promise", "")) or "clearer value proposition",
            offer=clean_text(parsed.get("offer", "")) or "the featured offer",
            pain_points=[clean_text(x) for x in parsed.get("pain_points", []) if clean_text(x)],
            tone=clean_text(parsed.get("tone", "")) or "direct",
            claims=[clean_text(x) for x in parsed.get("claims", []) if clean_text(x)],
            key_terms=[clean_text(x) for x in parsed.get("key_terms", []) if clean_text(x)],
            source_summary=clean_text(parsed.get("source_summary", "")),
        )
    except Exception as exc:  # pragma: no cover - online path
        warnings.append(f"LLM ad analysis failed, fallback used: {exc}")
        return None


def _response_to_text(response: object) -> str:
    output_text = getattr(response, "output_text", "")
    if output_text:
        return output_text

    output = getattr(response, "output", None)
    if isinstance(output, list):
        for item in output:
            content = getattr(item, "content", None)
            if isinstance(content, list):
                for block in content:
                    text_value = getattr(block, "text", None)
                    if text_value:
                        return text_value
    raise ValueError("Could not extract JSON text from LLM response")


def _fallback_ad_insights(ad_input: AdInput, page: PageSnapshot) -> AdInsights:
    ad_text = clean_text(ad_input.ad_copy_hint)
    ad_domain = domain_to_phrase(ad_input.ad_url)
    page_domain = domain_to_phrase(page.url)
    source_summary = first_non_empty(
        [
            ad_text[:180],
            ad_domain,
            page.headline,
            page.title,
        ],
        fallback="No detailed ad metadata provided; using heuristic interpretation.",
    )

    audience = first_non_empty(
        [
            ad_input.audience_hint,
            _infer_audience(ad_text),
            "high-intent visitors",
        ]
    )
    offer = _infer_offer(ad_text)
    promise = first_non_empty(
        [
            _infer_promise(ad_text),
            page.headline,
            f"better outcomes with {page_domain or 'your product'}",
        ]
    )
    tone = _infer_tone(ad_text)
    pain_points = _infer_pain_points(ad_text)

    terms = top_terms(" ".join([ad_text, page.headline, page.subheadline, ad_domain]))[:8]
    claims = [fact for fact in page.facts[:2]]

    return AdInsights(
        audience=audience,
        promise=promise,
        offer=offer,
        pain_points=pain_points,
        tone=tone,
        claims=claims,
        key_terms=terms,
        source_summary=source_summary,
    )


def _infer_offer(text: str) -> str:
    text = text.lower()
    patterns = [
        r"\b\d+% off\b",
        r"\bfree trial\b",
        r"\bfree demo\b",
        r"\bbook (a )?demo\b",
        r"\blimited offer\b",
        r"\blaunch offer\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0)
    if "free" in text:
        return "free offer"
    return "core offer"


def _infer_promise(text: str) -> str:
    if not text:
        return ""
    sentence = re.split(r"[.!?]", text)[0]
    return clean_text(sentence)


def _infer_audience(text: str) -> str:
    lowered = text.lower()
    mapping = {
        "marketer": "growth marketers",
        "startup": "startup teams",
        "founder": "founders",
        "developer": "developers",
        "agency": "agency teams",
        "ecommerce": "ecommerce brands",
        "student": "students",
    }
    for key, audience in mapping.items():
        if key in lowered:
            return audience
    return ""


def _infer_tone(text: str) -> str:
    lowered = text.lower()
    if any(token in lowered for token in ["limited", "today", "last chance", "urgent"]):
        return "urgent"
    if any(token in lowered for token in ["premium", "elegant", "exclusive"]):
        return "premium"
    if any(token in lowered for token in ["simple", "easy", "fast"]):
        return "friendly"
    return "direct"


def _infer_pain_points(text: str) -> list[str]:
    lowered = text.lower()
    points: list[str] = []
    if "slow" in lowered or "time" in lowered:
        points.append("slow execution")
    if "cost" in lowered or "expensive" in lowered or "budget" in lowered:
        points.append("high acquisition cost")
    if "confusing" in lowered or "complex" in lowered:
        points.append("complex workflows")
    if not points:
        points.append("unclear value at first glance")
    return points[:3]

