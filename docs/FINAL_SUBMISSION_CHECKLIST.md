# Final Submission Checklist

## A) Local Validation

1. Install dependencies:
   - `python -m pip install -r requirements.txt`
2. Run app:
   - `python -m streamlit run app.py --server.port 8508`
3. Quick QA:
   - ad link/upload works
   - landing URL input works
   - page preview loads
   - download HTML works
   - guardrail messages appear when expected

## B) Live Demo Link (Mandatory)

Option 1: Temporary link (fastest)
1. Start app locally.
2. Run:
   - `powershell -ExecutionPolicy Bypass -File scripts/run_public_demo.ps1`
3. Copy generated `https://*.trycloudflare.com` URL.

Option 2: Stable link (recommended)
1. Deploy GitHub repo on Streamlit Community Cloud.
2. Set secret: `OPENAI_API_KEY` (optional but recommended).
3. Copy app URL.

## C) Google Doc

1. Open [GOOGLE_DOC_DRAFT.md](./GOOGLE_DOC_DRAFT.md).
2. Paste content into a Google Doc.
3. Replace:
   - `[PASTE LIVE LINK]`
4. Set sharing to `Anyone with the link can view`.
5. Copy share URL.

## D) Email Submission

1. Open [SUBMISSION_EMAIL_TEMPLATE.txt](./SUBMISSION_EMAIL_TEMPLATE.txt).
2. Replace:
   - `[PASTE LIVE LINK]`
   - `[PASTE GOOGLE DOC LINK]`
   - `[YOUR NAME]`
3. Send to:
   - `nj@troopod.io`
   - Subject: `Assignment AI PM - Troopod`

## E) Final Quality Reminder

1. Do not use `example.com` for final demo screenshots/video.
2. Use a real landing page URL for meaningful personalization output.
