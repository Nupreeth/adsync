# Troopod AI PM Assignment - Ad-to-Landing Personalizer

This project delivers a practical MVP for the assignment:

1. Input ad creative (URL and/or upload image).
2. Input landing page URL.
3. Output a personalized version of the **same** page, enhanced with CRO principles.
4. UI is styled with Troopod brand colors from the live stylesheet (`#6B38FB`, `#8C67FF`, `#4B1B96`, `#20C4B3`, `#0D0D0D`).
5. Includes both:
   - Streamlit app (`app.py`) for local demo
   - Vercel-native web app (`index.html` + `api/personalize.py`) for hosted demo

The app preserves original structure and only edits high-impact conversion areas:
- Hero headline
- Supporting subheadline
- CTA copy
- Lightweight CRO inserts (trust proof, risk-reversal, sticky CTA)
- Dynamic output variants:
  - Typical mode: `Balanced`, `Trust-First`, `Offer-First`
  - Low-signal mode: `Balanced`, `Structure-Safe`
- CRO quality scorecard (before vs after)

## Assumptions

1. Some ad metadata may be unavailable (closed ad links, image-only creatives).
2. Landing pages can block scraping or JS-render key content.
3. We prioritize stable DOM-safe edits over aggressive rewriting.
4. OpenAI API key is optional; app works without it via deterministic heuristics.

## Architecture (Agent-style Workflow)

1. **Ad Insight Agent** (`engine/ad_analyzer.py`)
   - Understands ad context from URL/copy/image (LLM optional).
   - Produces audience, promise, offer, tone, pain points.

2. **Page Audit Agent** (`engine/page_fetcher.py`)
   - Fetches and parses landing page.
   - Extracts hero, subheadline, CTA candidates, facts, numeric claims.

3. **Personalization Agent** (`engine/personalizer.py`)
   - Generates personalized conversion copy.
   - Applies changes on original DOM with minimal edits.

4. **QA Guardrail Agent** (`engine/guardrails.py`)
   - Detects random drift / broken UI risk / hallucinated numbers.
   - Falls back to original when output is unsafe.

5. **Orchestrator** (`engine/pipeline.py`)
   - Runs all agents in sequence and returns final output + logs.

6. **Variant Studio (UI layer)** (`app.py`)
   - Creates multiple personalization variants from one run.
   - Lets reviewer preview and download each variant HTML.

## Guardrails for Assignment Requirements

### Random changes
- Sequence similarity check between original and personalized HTML.
- If drift is too high, output reverts to original.

### Broken UI
- Validates output body presence and basic page length sanity.
- Protects critical structures (for example forms cannot disappear).
- Maintains `<base>` tag so preview keeps relative assets intact.

### Hallucinations
- Generated numbers are restricted to numbers already present in ad/page context.
- Unapproved numbers are sanitized from generated copy.

### Inconsistent outputs
- Deterministic fallback path exists even without LLM.
- LLM runs with low temperature and constrained JSON schema.
- Same pipeline always returns debug payload and explicit change log.

## Local Run

```bash
python -m pip install -r requirements.txt
python -m streamlit run app.py
```

Open `http://localhost:8501`.

If port `8501` is busy:

```bash
python -m streamlit run app.py --server.port 8508
```

## Create a Public Demo Link Fast (Cloudflare Tunnel)

This creates a live public URL for demo sharing without deployment setup:

```bash
python -m streamlit run app.py --server.port 8501
```

In another terminal:

```bash
cloudflared tunnel --url http://localhost:8501
```

Use the generated `https://<random>.trycloudflare.com` URL as your temporary live demo.

Or run the helper script:

```bash
powershell -ExecutionPolicy Bypass -File scripts/run_public_demo.ps1
```

## Optional: Stable Deploy (Recommended)

Deploy this repo to Streamlit Community Cloud:
1. Push repo to GitHub.
2. Go to https://share.streamlit.io/.
3. New app -> select repo -> `app.py`.
4. Add `OPENAI_API_KEY` in app secrets if desired.

This gives a persistent live link for submission.

## Vercel Deploy (Recommended if you want a branded hosted URL)

This repo now includes a Vercel-native interface:
- frontend: `index.html`
- API: `api/personalize.py`
- config: `vercel.json`

Deploy steps:
1. Import the GitHub repo into Vercel.
2. Framework preset: `Other`.
3. Keep project root as repository root.
4. Add env var (optional but recommended):
   - `OPENAI_API_KEY`
5. Deploy.

After deploy, open `/` and test:
- ad link or upload
- landing page URL
- generate personalized page
- download HTML

## Demo Quality Tips

1. Avoid `https://example.com` for final demo quality (it is placeholder content).
2. Use a real landing page with clear headline/CTA structure.
3. Best output quality is with `OPENAI_API_KEY` set.
4. If ad signal is weak, app intentionally switches to conservative (`Structure-Safe`) mode.

## Submission Files Included

- App implementation: `app.py` + `engine/`
- Vercel implementation: `index.html`, `api/personalize.py`, `vercel.json`
- Upload-ready sample ad creative: `assets/sample_ad_creative.png`
- Google-doc draft content: `docs/GOOGLE_DOC_DRAFT.md`
- Submission email template: `docs/SUBMISSION_EMAIL_TEMPLATE.txt`
- Basic pipeline test: `tests/test_personalizer.py`
