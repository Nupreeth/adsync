import re
from urllib.parse import urlparse


STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "to",
    "with",
    "you",
    "your",
}

_MULTI_SPACE_RE = re.compile(r"\s+")
_NUMBER_RE = re.compile(r"\b\d+(?:[.,]\d+)?%?\b")
_WORD_RE = re.compile(r"\b[a-zA-Z][a-zA-Z0-9'-]*\b")
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")


def clean_text(text: str) -> str:
    return _MULTI_SPACE_RE.sub(" ", (text or "")).strip()


def split_sentences(text: str) -> list[str]:
    if not text:
        return []
    return [clean_text(part) for part in _SENTENCE_SPLIT_RE.split(text) if clean_text(part)]


def extract_numbers(text: str) -> list[str]:
    if not text:
        return []
    seen: set[str] = set()
    ordered: list[str] = []
    for match in _NUMBER_RE.finditer(text):
        token = match.group(0)
        if token not in seen:
            seen.add(token)
            ordered.append(token)
    return ordered


def top_terms(text: str, limit: int = 8) -> list[str]:
    counts: dict[str, int] = {}
    for match in _WORD_RE.finditer((text or "").lower()):
        token = match.group(0)
        if token in STOPWORDS or len(token) < 3:
            continue
        counts[token] = counts.get(token, 0) + 1
    ordered = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return [token for token, _ in ordered[:limit]]


def domain_to_phrase(url: str) -> str:
    if not url:
        return ""
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    if not host:
        return ""
    host = host.replace("www.", "")
    name = host.split(".")[0].replace("-", " ").replace("_", " ")
    return clean_text(name)


def first_non_empty(candidates: list[str], fallback: str = "") -> str:
    for value in candidates:
        if clean_text(value):
            return clean_text(value)
    return fallback


def cap_words(text: str, max_words: int) -> str:
    words = clean_text(text).split()
    if len(words) <= max_words:
        return clean_text(text)
    return " ".join(words[:max_words]).strip()

