from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class AdInput:
    ad_url: str = ""
    ad_copy_hint: str = ""
    audience_hint: str = ""
    ad_image_base64: str = ""
    ad_image_mime: str = ""


@dataclass
class PageSnapshot:
    url: str
    html: str
    title: str
    headline: str
    subheadline: str
    cta_texts: List[str]
    facts: List[str]
    numeric_claims: List[str]
    extracted_text_sample: str


@dataclass
class AdInsights:
    audience: str
    promise: str
    offer: str
    pain_points: List[str]
    tone: str
    claims: List[str]
    key_terms: List[str]
    source_summary: str = ""


@dataclass
class PersonalizationCopy:
    headline: str
    subheadline: str
    cta_text: str
    trust_bar: str
    risk_reversal: str
    notes: str = ""


@dataclass
class PipelineResult:
    landing_page_url: str
    personalized_html: str
    original_snapshot: PageSnapshot
    ad_insights: AdInsights
    generated_copy: PersonalizationCopy
    change_log: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    similarity_score: float = 0.0
    debug_payload: Dict[str, str] = field(default_factory=dict)

