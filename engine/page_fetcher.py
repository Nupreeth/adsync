from __future__ import annotations

import re

import requests
import urllib3
from bs4 import BeautifulSoup
from requests.exceptions import SSLError

from .models import PageSnapshot
from .utils import clean_text, extract_numbers, split_sentences


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)

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

FACT_HINT_RE = re.compile(
    r"\b(\d+%|\d+\+|trusted|customers|users|reviews|rating|since|years?|results?)\b",
    re.IGNORECASE,
)


def fetch_landing_page(url: str, timeout: int = 25) -> PageSnapshot:
    request_kwargs = {
        "timeout": timeout,
        "headers": {
            "User-Agent": USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
        },
    }

    try:
        response = requests.get(url, **request_kwargs)
    except SSLError:
        # Some environments miss CA roots; retry insecurely to keep the demo unblocked.
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        response = requests.get(url, verify=False, **request_kwargs)
    response.raise_for_status()

    html = response.text
    soup = BeautifulSoup(html, "lxml")

    title = clean_text((soup.title.string if soup.title and soup.title.string else ""))
    headline = _extract_headline(soup)
    subheadline = _extract_subheadline(soup)
    cta_texts = _extract_cta_texts(soup)
    text_blob = clean_text(soup.get_text(" ", strip=True))
    text_sample = text_blob[:4500]
    facts = _extract_facts(text_sample)
    numeric_claims = extract_numbers(" ".join([text_sample, *facts]))[:25]

    return PageSnapshot(
        url=url,
        html=html,
        title=title,
        headline=headline,
        subheadline=subheadline,
        cta_texts=cta_texts,
        facts=facts,
        numeric_claims=numeric_claims,
        extracted_text_sample=text_sample,
    )


def _extract_headline(soup: BeautifulSoup) -> str:
    for tag in ("h1", "h2"):
        for node in soup.find_all(tag):
            text = clean_text(node.get_text(" ", strip=True))
            if 1 <= len(text.split()) <= 18:
                return text
    return ""


def _extract_subheadline(soup: BeautifulSoup) -> str:
    for node in soup.find_all("p"):
        text = clean_text(node.get_text(" ", strip=True))
        if 8 <= len(text.split()) <= 45:
            return text
    return ""


def _extract_cta_texts(soup: BeautifulSoup) -> list[str]:
    candidates: list[str] = []

    for node in soup.find_all(["a", "button", "input"]):
        if node.name == "input":
            text = clean_text(node.get("value", ""))
        else:
            text = clean_text(node.get_text(" ", strip=True))
        if not text or len(text.split()) > 8:
            continue
        lower = text.lower()
        if any(hint in lower for hint in CTA_HINTS):
            candidates.append(text)

    if not candidates:
        for node in soup.find_all(["a", "button"]):
            text = clean_text(node.get_text(" ", strip=True))
            if 1 <= len(text.split()) <= 5:
                candidates.append(text)
            if len(candidates) >= 3:
                break

    seen: set[str] = set()
    deduped: list[str] = []
    for text in candidates:
        if text not in seen:
            deduped.append(text)
            seen.add(text)
    return deduped[:4]


def _extract_facts(text_blob: str) -> list[str]:
    facts: list[str] = []
    for sentence in split_sentences(text_blob):
        if FACT_HINT_RE.search(sentence):
            facts.append(sentence)
        if len(facts) >= 5:
            break
    return facts
