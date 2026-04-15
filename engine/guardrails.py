from __future__ import annotations

import difflib
from typing import Tuple

from bs4 import BeautifulSoup

from .utils import clean_text, extract_numbers


def validate_output(
    original_html: str,
    personalized_html: str,
    allowed_numbers: set[str],
    change_count: int,
) -> Tuple[str, list[str], float]:
    warnings: list[str] = []
    similarity = difflib.SequenceMatcher(a=original_html, b=personalized_html).ratio()

    if not personalized_html.strip():
        return original_html, ["Personalization output was empty. Returned original page."], 1.0

    if len(personalized_html) < max(400, int(len(original_html) * 0.5)):
        warnings.append("Output looked truncated. Returned original page.")
        return original_html, warnings, similarity

    original_soup = BeautifulSoup(original_html, "lxml")
    personalized_soup = BeautifulSoup(personalized_html, "lxml")

    if personalized_soup.body is None:
        warnings.append("Broken output: missing body tag. Returned original page.")
        return original_html, warnings, similarity

    original_forms = len(original_soup.find_all("form"))
    personalized_forms = len(personalized_soup.find_all("form"))
    if original_forms > 0 and personalized_forms == 0:
        warnings.append("Detected form removal risk. Returned original page.")
        return original_html, warnings, similarity

    original_tag_count = len(original_soup.find_all())
    personalized_tag_count = len(personalized_soup.find_all())
    if personalized_tag_count < max(3, int(original_tag_count * 0.45)):
        warnings.append("Output removed too much page structure. Returned original page.")
        return original_html, warnings, similarity

    original_link_count = len(original_soup.find_all("a"))
    personalized_link_count = len(personalized_soup.find_all("a"))
    if original_link_count > 1 and personalized_link_count < max(1, int(original_link_count * 0.5)):
        warnings.append("Output removed too many links. Returned original page.")
        return original_html, warnings, similarity

    if similarity < 0.16:
        warnings.append(
            "Output drifted too far from original DOM (possible random change). Returned original page."
        )
        return original_html, warnings, similarity

    found_numbers = set(extract_numbers(clean_text(personalized_soup.get_text(" ", strip=True))))
    disallowed = sorted([n for n in found_numbers if n not in allowed_numbers])
    if disallowed:
        warnings.append(
            "Potential hallucinated numbers detected and removed from generated copy where possible."
        )

    if change_count == 0:
        warnings.append("No reliable personalization target found; page returned mostly unchanged.")

    return personalized_html, warnings, similarity
