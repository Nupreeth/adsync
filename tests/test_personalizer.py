from engine.guardrails import validate_output
from engine.models import AdInsights, AdInput, PageSnapshot
from engine.personalizer import apply_personalization, sanitize_copy_numbers
from engine.personalizer import _fallback_copy  # noqa: SLF001


def _sample_snapshot() -> PageSnapshot:
    html = """
<!DOCTYPE html>
<html>
<head><title>Demo Product</title></head>
<body>
  <header>
    <h1>Grow your pipeline faster</h1>
    <p>All-in-one automation for modern teams.</p>
    <a href="/signup">Start free</a>
  </header>
  <main>
    <form action="/signup"><input type="email" /><button>Get started</button></form>
  </main>
</body>
</html>
"""
    return PageSnapshot(
        url="https://example.com",
        html=html,
        title="Demo Product",
        headline="Grow your pipeline faster",
        subheadline="All-in-one automation for modern teams.",
        cta_texts=["Start free", "Get started"],
        facts=["Trusted by 200+ teams."],
        numeric_claims=["200+"],
        extracted_text_sample="Grow your pipeline faster",
    )


def test_apply_personalization_preserves_structure() -> None:
    snapshot = _sample_snapshot()
    insights = AdInsights(
        audience="growth marketers",
        promise="Increase qualified leads",
        offer="free trial",
        pain_points=["slow campaign execution"],
        tone="direct",
        claims=["Trusted by 200+ teams."],
        key_terms=["leads", "growth"],
        source_summary="Test summary",
    )
    generated = _fallback_copy(AdInput(ad_url="https://ads.example.com"), snapshot, insights)
    generated = sanitize_copy_numbers(generated, {"200+"})
    html, changes = apply_personalization(snapshot, generated)

    assert "Increase qualified leads" in html
    assert "troopod-cro-block" in html
    assert len(changes) >= 3
    assert "<form" in html


def test_guardrail_similarity_rejects_extreme_drift() -> None:
    snapshot = _sample_snapshot()
    bad_output = "<html><body><h1>totally replaced</h1></body></html>"
    final_html, warnings, score = validate_output(
        original_html=snapshot.html,
        personalized_html=bad_output,
        allowed_numbers={"200+"},
        change_count=5,
    )
    assert final_html == snapshot.html
    assert warnings
    assert score < 0.45
