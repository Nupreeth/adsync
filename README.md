# AdSync

AdSync is an AI-powered full-stack web app that takes:
- ad creative input (upload or image URL)
- landing page URL

and returns a personalized, CRO-aligned version of the landing page copy with:
- rewritten headline/subheadline/body/CTA
- message-match score before vs after
- field-level CRO rationale
- recommendation cards
- export actions (JSON / copy / HTML snippet)

## Tech Stack

- Frontend: React + Vite
- Styling: Tailwind via CDN + custom CSS
- Backend: Node.js + Express
- AI: Google Gemini API (`GEMINI_MODEL`)
- Scraping: axios + cheerio
- Upload: multer

## One-command local setup

```bash
npm install && npm run dev
```

This starts:
- backend: `http://localhost:3001`
- frontend: `http://localhost:5173`

## Environment variables

Copy `.env.example` to `.env` in project root:

```env
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-1.5-flash
PORT=3001
```

You can also copy `client/.env.example` to `client/.env` if needed.

## Gemini settings used

- Model: `GEMINI_MODEL` (default `gemini-1.5-flash`)
- Ad analysis: `maxOutputTokens: 1500`, `temperature: 0.2`
- Personalization: `maxOutputTokens: 2500`, `temperature: 0.3`

## API routes

- `POST /api/analyze-ad`
  - multipart file (`image`) OR JSON `{ imageUrl }`
- `POST /api/scrape-page`
  - JSON `{ url }`
- `POST /api/personalize`
  - JSON `{ adAnalysis, pageContent }`

## Screenshot

![AdSync UI Screenshot](./docs/ui-screenshot.png)

## Live demo

`[PASTE LIVE DEMO LINK HERE]`

## Deploy (Free Tier)

### Vercel (Frontend + API, no Render)

- Create a new Vercel project from the GitHub repo.
- Env vars (Vercel Project Settings -> Environment Variables):
  - `GEMINI_API_KEY` (required)
  - `GEMINI_MODEL` (optional)
- Deploy.
