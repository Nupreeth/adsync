from __future__ import annotations

from .ad_analyzer import derive_ad_insights
from .guardrails import validate_output
from .models import AdInput, PipelineResult
from .page_fetcher import fetch_landing_page
from .personalizer import (
    apply_personalization,
    gather_copy_numbers,
    generate_personalization_copy,
    sanitize_copy_numbers,
)
from .utils import extract_numbers


def run_personalization_pipeline(landing_page_url: str, ad_input: AdInput) -> PipelineResult:
    page = fetch_landing_page(landing_page_url)

    ad_insights, insight_warnings = derive_ad_insights(ad_input, page)
    copy, copy_warnings = generate_personalization_copy(ad_input, page, ad_insights)

    allowed_numbers = set(page.numeric_claims)
    allowed_numbers.update(extract_numbers(ad_input.ad_copy_hint))
    sanitized_copy = sanitize_copy_numbers(copy, allowed_numbers)

    personalized_html, change_log = apply_personalization(page, sanitized_copy)
    final_html, guardrail_warnings, similarity = validate_output(
        original_html=page.html,
        personalized_html=personalized_html,
        allowed_numbers=allowed_numbers.union(gather_copy_numbers(sanitized_copy)),
        change_count=len(change_log),
    )

    warnings = [*insight_warnings, *copy_warnings, *guardrail_warnings]

    return PipelineResult(
        landing_page_url=landing_page_url,
        personalized_html=final_html,
        original_snapshot=page,
        ad_insights=ad_insights,
        generated_copy=sanitized_copy,
        change_log=change_log,
        warnings=warnings,
        similarity_score=similarity,
        debug_payload={
            "allowed_numbers": ", ".join(sorted(allowed_numbers)) or "(none)",
            "copy_numbers": ", ".join(sorted(gather_copy_numbers(sanitized_copy))) or "(none)",
        },
    )

