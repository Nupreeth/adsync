# Troopod Assignment - AI Personalization System Brief

Live Demo Link:
[PASTE LIVE LINK]

Repository:
https://github.com/Nupreeth/troopod-ad-to-landing-personalizer

Deployment:
Vercel-hosted web app (`index.html` + Python API `api/personalize.py`)

## 1) What this system does

This system takes:
1. Ad creative input (URL and/or uploaded creative)
2. Landing page URL

Then produces:
1. A personalized version of the **same landing page**
2. CRO enhancements on key conversion touchpoints
3. Change log + guardrail notes for transparency
4. Reviewer-ready variants for comparison:
   - Typical mode: Balanced, Trust-First, Offer-First
   - Low-signal mode: Balanced, Structure-Safe

The output is not a full redesign. It keeps the original page and applies focused improvements to conversion-critical sections.

## 2) End-to-end flow

1. User enters ad input and landing page URL.
2. Ad Insight Agent extracts campaign intent:
   - audience
   - core promise
   - offer
   - tone
   - pain points
3. Page Audit Agent fetches and maps current page:
   - hero headline
   - subheadline
   - CTA buttons/links
   - trust/fact signals
   - numeric claims
4. Personalization Agent writes personalized copy and applies it directly to original DOM:
   - updated hero messaging
   - aligned CTA copy
   - trust + risk-reversal CRO block
   - sticky CTA continuity
5. QA Guardrail Agent validates safety:
   - random drift check
   - UI integrity checks
   - hallucinated number filtering
6. Final personalized page is shown in preview and downloadable as HTML.
7. Demo UI follows Troopod brand palette for visual consistency.
8. CRO quality scorecard shows before vs after quality lift.
9. If ad signal is weak, system automatically falls back to conservative personalization.
10. Hosted deployment uses Vercel frontend + Python API while preserving the same engine modules.

## 3) Key components / agent design

1. **Ad Insight Agent**
   - File: `engine/ad_analyzer.py`
   - Purpose: understand ad message from mixed signals.
   - Mode: LLM-enhanced when key present, deterministic fallback otherwise.

2. **Page Audit Agent**
   - File: `engine/page_fetcher.py`
   - Purpose: extract current conversion surface from existing page.

3. **Personalization Agent**
   - File: `engine/personalizer.py`
   - Purpose: generate and apply copy changes without rebuilding page.

4. **QA Guardrail Agent**
   - File: `engine/guardrails.py`
   - Purpose: prevent broken or unreliable outputs.

5. **Pipeline Orchestrator**
   - File: `engine/pipeline.py`
   - Purpose: runs all agents and returns final result + debug payload.

6. **Variant Studio + Scorecard**
   - File: `app.py`
   - Purpose: generate multiple personalization styles and visualize quality lift.

## 4) How we handle failure modes

### A) Random changes
- We compute similarity between original and output HTML.
- If output drifts too far from source, system reverts to original page.
- This guarantees we do not return accidental full rewrites.

### B) Broken UI
- We check for required HTML body and structural sanity.
- We guard against accidental form removal.
- We preserve relative assets in preview with base URL injection.
- Unsafe outputs are rejected and replaced by original.

### C) Hallucinations
- Numbers in generated copy are constrained to ad/page known numbers.
- Unsupported numeric claims are removed.
- Prompt rules enforce source-grounded copy only.

### D) Inconsistent outputs
- Deterministic fallback ensures stable output even without LLM.
- Low-temperature JSON-constrained generation for consistency.
- Each run returns change logs + warning messages for auditability.

## 5) Demo assumptions (explicit)

1. Landing URL quality impacts personalization quality heavily.
2. `example.com` is placeholder-only and not used for final quality demo.
3. For strongest results, OpenAI API key is provided in deployment secrets.
4. If ad signal is weak, conservative mode is preferable to unsafe over-editing.

## 6) Product assumptions

1. Some ad signals are missing or low quality.
2. Some landing pages block scraping or rely heavily on client-side rendering.
3. Assignment values practical prototype behavior over edge-perfect extraction.
4. Main objective is measurable conversion clarity, not visual redesign.

## 7) What can be improved next

1. JS-rendered page support via Playwright snapshotting.
2. More robust selector confidence scoring.
3. Brand voice memory and experiments per persona segment.
4. Auto-generated A/B variants and experiment tracking hooks.
