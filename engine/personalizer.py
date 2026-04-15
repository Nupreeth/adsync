from __future__ import annotations

import json
import os
import re
from typing import Tuple

from bs4 import BeautifulSoup, NavigableString, Tag

from .models import AdInput, AdInsights, PageSnapshot, PersonalizationCopy
from .utils import cap_words, clean_text, extract_numbers


CTA_HINTS = (
    "start",
    "get",
    "book",
    "buy",
    "try",
    "demo",
    "sign",
    "join",
    "claim",
    "shop",
    "download",
    "apply",
    "contact",
    "learn",
)


def generate_personalization_copy(
    ad_input: AdInput, page: PageSnapshot, insights: AdInsights
) -> Tuple[PersonalizationCopy, list[str]]:
    warnings: list[str] = []
    api_key = os.getenv("OPENAI_API_KEY", "").strip()

    if api_key:
        generated = _generate_with_openai(ad_input, page, insights, warnings)
        if generated is not None:
            return generated, warnings

    return _fallback_copy(ad_input, page, insights), warnings


def _generate_with_openai(
    ad_input: AdInput,
    page: PageSnapshot,
    insights: AdInsights,
    warnings: list[str],
) -> PersonalizationCopy | None:
    try:
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

        source_text = clean_text(
            " ".join(
                [
                    f"Audience: {insights.audience}",
                    f"Promise: {insights.promise}",
                    f"Offer: {insights.offer}",
                    f"Tone: {insights.tone}",
                    f"Pain points: {', '.join(insights.pain_points)}",
                    f"Claims: {' | '.join(insights.claims)}",
                    f"Landing headline: {page.headline}",
                    f"Landing subheadline: {page.subheadline}",
                    f"Landing CTAs: {', '.join(page.cta_texts)}",
                    f"Ad hints: {ad_input.ad_copy_hint}",
                ]
            )
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
                                "You are Personalization Agent. Return strict JSON only with keys: "
                                "headline, subheadline, cta_text, trust_bar, risk_reversal, notes. "
                                "Constraints: keep page structure intact, avoid making up numbers or claims, "
                                "headline <= 12 words, cta_text <= 4 words."
                            ),
                        }
                    ],
                },
                {
                    "role": "user",
                    "content": [{"type": "input_text", "text": source_text}],
                },
            ],
            text={"format": {"type": "json_object"}},
        )

        raw = _response_to_text(response)
        parsed = json.loads(raw)

        return PersonalizationCopy(
            headline=clean_text(parsed.get("headline", "")) or _fallback_headline(page, insights),
            subheadline=clean_text(parsed.get("subheadline", ""))
            or _fallback_subheadline(page, insights),
            cta_text=clean_text(parsed.get("cta_text", "")) or _fallback_cta(insights),
            trust_bar=clean_text(parsed.get("trust_bar", "")) or _fallback_trust_bar(page),
            risk_reversal=clean_text(parsed.get("risk_reversal", "")) or _fallback_risk_reversal(),
            notes=clean_text(parsed.get("notes", "")),
        )
    except Exception as exc:  # pragma: no cover - online path
        warnings.append(f"LLM copy generation failed, fallback used: {exc}")
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


def _fallback_copy(ad_input: AdInput, page: PageSnapshot, insights: AdInsights) -> PersonalizationCopy:
    low_signal = _is_low_signal(ad_input, insights)
    headline = _fallback_headline(page, insights, low_signal)
    subheadline = _fallback_subheadline(page, insights, low_signal)
    cta_text = _fallback_cta(insights, page, low_signal)
    note = "Heuristic generation used (no API key)."
    if low_signal:
        note = (
            "Low ad-signal mode: conservative personalization applied to avoid hallucinated messaging."
        )
    return PersonalizationCopy(
        headline=headline,
        subheadline=subheadline,
        cta_text=cta_text,
        trust_bar=_fallback_trust_bar(page),
        risk_reversal=_fallback_risk_reversal(),
        notes=note,
    )


def _is_low_signal(ad_input: AdInput, insights: AdInsights) -> bool:
    has_ad_url = bool(clean_text(ad_input.ad_url))
    has_ad_text = bool(clean_text(ad_input.ad_copy_hint))
    has_audience_hint = bool(clean_text(ad_input.audience_hint))
    heuristic_marker = "no detailed ad metadata provided"
    summary = clean_text(insights.source_summary).lower()
    return not (has_ad_url or has_ad_text or has_audience_hint) or heuristic_marker in summary


def _fallback_headline(page: PageSnapshot, insights: AdInsights, low_signal: bool) -> str:
    if low_signal and clean_text(page.headline):
        return cap_words(clean_text(page.headline), 12)
    base = clean_text(f"{insights.promise} for {insights.audience}")
    if len(base.split()) < 4:
        base = clean_text(f"Built for {insights.audience}")
    if len(base.split()) > 0 and clean_text(page.headline):
        page_tokens = set(clean_text(page.headline).lower().split())
        base_tokens = clean_text(base).lower().split()
        if len(base_tokens) >= 2 and all(token in page_tokens for token in base_tokens[:2]):
            return cap_words(clean_text(page.headline), 12)
    return cap_words(base, 12)


def _fallback_subheadline(page: PageSnapshot, insights: AdInsights, low_signal: bool) -> str:
    if low_signal and clean_text(page.subheadline):
        return cap_words(clean_text(page.subheadline), 30)
    pain = insights.pain_points[0] if insights.pain_points else "conversion friction"
    offer = insights.offer if insights.offer != "core offer" else "an offer tailored to your intent"
    return cap_words(
        clean_text(
            f"Reduce {pain} and move faster with {offer}. "
            "Keep message match from ad click to landing experience."
        ),
        30,
    )


def _fallback_cta(insights: AdInsights, page: PageSnapshot, low_signal: bool) -> str:
    if low_signal and page.cta_texts:
        return cap_words(clean_text(page.cta_texts[0]), 4)
    if "demo" in insights.offer.lower():
        return "Book Demo"
    if "trial" in insights.offer.lower():
        return "Start Trial"
    if "free" in insights.offer.lower():
        return "Claim Offer"
    return "Get Started"


def _fallback_trust_bar(page: PageSnapshot) -> str:
    if page.facts:
        return clean_text(page.facts[0])[:160]
    return "Built with proven CRO patterns: clear value, focused CTA, reduced friction."


def _fallback_risk_reversal() -> str:
    return "No long-term lock-ins. Evaluate the fit before you commit."


def sanitize_copy_numbers(copy: PersonalizationCopy, allowed_numbers: set[str]) -> PersonalizationCopy:
    def sanitize(text: str) -> str:
        def replace(match: re.Match[str]) -> str:
            token = match.group(0)
            return token if token in allowed_numbers else ""

        cleaned = re.sub(r"\b\d+(?:[.,]\d+)?%?\b", replace, text)
        return clean_text(cleaned)

    return PersonalizationCopy(
        headline=sanitize(copy.headline),
        subheadline=sanitize(copy.subheadline),
        cta_text=sanitize(copy.cta_text),
        trust_bar=sanitize(copy.trust_bar),
        risk_reversal=sanitize(copy.risk_reversal),
        notes=copy.notes,
    )


def apply_personalization(
    snapshot: PageSnapshot, copy: PersonalizationCopy
) -> Tuple[str, list[str]]:
    soup = BeautifulSoup(snapshot.html, "lxml")
    change_log: list[str] = []
    low_signal_mode = "low ad-signal mode" in clean_text(copy.notes).lower()

    _ensure_base_tag(soup, snapshot.url, change_log)
    _ensure_style_tag(soup)

    hero = _find_hero_node(soup)
    if hero is not None:
        old = clean_text(hero.get_text(" ", strip=True))
        _replace_node_text(hero, copy.headline)
        change_log.append(f"Hero headline updated: '{old}' -> '{copy.headline}'")

    subheadline = _find_subheadline_node(soup, hero)
    if subheadline is not None:
        old = clean_text(subheadline.get_text(" ", strip=True))
        _replace_node_text(subheadline, copy.subheadline)
        change_log.append(f"Subheadline updated: '{old}' -> '{copy.subheadline}'")

    cta_nodes = _find_cta_nodes(soup)
    cta_limit = 1 if low_signal_mode else 2
    for index, cta_node in enumerate(cta_nodes[:cta_limit]):
        old = clean_text(_node_text(cta_node))
        new_cta = clean_text(copy.cta_text)
        if new_cta and old.lower() != new_cta.lower():
            _replace_node_text(cta_node, new_cta)
            change_log.append(f"CTA #{index + 1} updated: '{old}' -> '{new_cta}'")

    if not low_signal_mode:
        _inject_cro_block(soup, copy, cta_nodes, change_log, hero, subheadline, True)
    else:
        change_log.append("Low ad-signal mode: skipped heavy CRO inserts to preserve page quality.")

    return str(soup), change_log


def _ensure_base_tag(soup: BeautifulSoup, url: str, change_log: list[str]) -> None:
    if soup.head is None:
        return
    if soup.head.find("base") is None:
        base = soup.new_tag("base", href=url)
        soup.head.insert(0, base)
        change_log.append("Inserted <base> tag to preserve relative asset loading in preview.")


def _ensure_style_tag(soup: BeautifulSoup) -> None:
    if soup.head is None:
        return
    existing = soup.head.find("style", attrs={"id": "troopod-cro-style"})
    if existing is not None:
        existing.decompose()
    style = soup.new_tag("style", id="troopod-cro-style")
    style.string = """
.troopod-cro-block {
  margin: 16px 0;
  padding: 16px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 12px;
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
  font-family: ui-sans-serif, -apple-system, Segoe UI, sans-serif;
  box-shadow: 0 8px 24px rgba(2, 6, 23, 0.08);
}
.troopod-cro-block h3 {
  margin: 0 0 8px;
  font-size: 16px;
  color: #0f172a;
}
.troopod-cro-block p {
  margin: 0;
  line-height: 1.45;
  color: #0f172a;
}
.troopod-sticky-cta {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 9999;
  background: #101828;
  color: #ffffff;
  text-decoration: none;
  padding: 10px 14px;
  border-radius: 999px;
  font-family: ui-sans-serif, -apple-system, Segoe UI, sans-serif;
  box-shadow: 0 10px 25px rgba(16, 24, 40, 0.25);
}
@media (max-width: 768px) {
  .troopod-sticky-cta {
    left: 16px;
    right: 16px;
    text-align: center;
  }
}
@media (min-width: 769px) {
  .troopod-sticky-cta {
    display: none;
  }
}
"""
    soup.head.append(style)


def _find_hero_node(soup: BeautifulSoup) -> Tag | None:
    for tag in ("h1", "h2"):
        for node in soup.find_all(tag):
            text = clean_text(node.get_text(" ", strip=True))
            if 1 <= len(text.split()) <= 18:
                return node
    return None


def _find_subheadline_node(soup: BeautifulSoup, hero: Tag | None) -> Tag | None:
    if hero is not None:
        for sibling in hero.find_next_siblings(limit=4):
            if sibling.name == "p":
                text = clean_text(sibling.get_text(" ", strip=True))
                if 6 <= len(text.split()) <= 45:
                    return sibling
        parent = hero.parent
        if parent is not None:
            for node in parent.find_all("p", limit=3):
                text = clean_text(node.get_text(" ", strip=True))
                if 6 <= len(text.split()) <= 45:
                    return node
    for node in soup.find_all("p"):
        text = clean_text(node.get_text(" ", strip=True))
        if 8 <= len(text.split()) <= 45:
            return node
    return None


def _find_cta_nodes(soup: BeautifulSoup) -> list[Tag]:
    candidates: list[Tag] = []
    for node in soup.find_all(["a", "button", "input"]):
        text = clean_text(_node_text(node))
        if not text:
            continue
        if len(text.split()) > 8:
            continue
        lower = text.lower()
        if any(hint in lower for hint in CTA_HINTS):
            candidates.append(node)

    if not candidates:
        for node in soup.find_all(["a", "button"]):
            text = clean_text(_node_text(node))
            if 1 <= len(text.split()) <= 5:
                candidates.append(node)
                if len(candidates) >= 3:
                    break
    return candidates


def _inject_cro_block(
    soup: BeautifulSoup,
    copy: PersonalizationCopy,
    cta_nodes: list[Tag],
    change_log: list[str],
    hero: Tag | None,
    subheadline: Tag | None,
    enable_sticky_cta: bool,
) -> None:
    existing = soup.find("section", attrs={"id": "troopod-cro-block"})
    if existing is not None:
        existing.decompose()

    block = soup.new_tag("section", id="troopod-cro-block")
    block["class"] = "troopod-cro-block"

    title = soup.new_tag("h3")
    title.string = "Why this is a better fit for your ad intent"
    block.append(title)

    trust = soup.new_tag("p")
    trust.string = copy.trust_bar
    block.append(trust)

    risk = soup.new_tag("p")
    risk.string = copy.risk_reversal
    risk["style"] = "margin-top:8px;"
    block.append(risk)

    container = None
    if hero is not None:
        container = hero.parent if isinstance(hero.parent, Tag) else None
    if container is None:
        container = soup.body

    anchor = subheadline or (cta_nodes[0] if cta_nodes else hero)
    if anchor is not None:
        anchor.insert_after(block)
    elif container is not None:
        container.append(block)
    else:
        return
    change_log.append("Injected CRO support block (trust + risk reversal).")

    if enable_sticky_cta:
        sticky = soup.find("a", attrs={"id": "troopod-sticky-cta"})
        if sticky is not None:
            sticky.decompose()

        sticky = soup.new_tag("a", id="troopod-sticky-cta")
        sticky["class"] = "troopod-sticky-cta"
        sticky.string = copy.cta_text
        href = "#"
        if cta_nodes and cta_nodes[0].name == "a":
            href = cta_nodes[0].get("href", "#")
        sticky["href"] = href
        if soup.body is not None:
            soup.body.append(sticky)
            change_log.append("Injected sticky CTA for mobile conversion continuity.")


def _replace_node_text(node: Tag, text: str) -> None:
    if node.name == "input":
        node["value"] = text
        return
    for child in list(node.children):
        child.extract()
    node.append(NavigableString(text))


def _node_text(node: Tag) -> str:
    if node.name == "input":
        return node.get("value", "")
    return node.get_text(" ", strip=True)


def gather_copy_numbers(copy: PersonalizationCopy) -> set[str]:
    all_text = " ".join(
        [
            copy.headline,
            copy.subheadline,
            copy.cta_text,
            copy.trust_bar,
            copy.risk_reversal,
        ]
    )
    return set(extract_numbers(all_text))
