# Deploy JobMatch AI to Vercel

## 1. Prerequisites

- A Vercel account
- Anthropic API key with available credits
- This repository pushed to GitHub

## 2. Project setup included in this repo

- `api/index.py` exports the FastAPI app for Vercel
- `vercel.json` routes all requests to the Python serverless function
- Root `requirements.txt` installs backend dependencies

## 3. Set environment variable in Vercel

In Vercel Project Settings -> Environment Variables, add:

- `ANTHROPIC_API_KEY` = your key

Apply it to:

- Production
- Preview
- Development (optional)

## 4. Deploy

### Option A: Vercel dashboard

1. Import this GitHub repository in Vercel.
2. Keep default framework preset (Other).
3. Confirm build settings are auto-detected.
4. Deploy.

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel link
vercel env add ANTHROPIC_API_KEY
vercel --prod
```

## 5. Verify

After deploy, open your Vercel URL and test:

1. Upload/paste resume
2. Paste job description
3. Run Analyze Fit

If you see an API credit error, add credits in Anthropic Plans & Billing.

## 6. Troubleshooting

- `ANTHROPIC_API_KEY not set`:
  - Confirm env var exists in Vercel Project Settings.
  - Redeploy after adding/updating env vars.
- 400 billing error from Anthropic:
  - Key is valid, but account/project needs credits.
- Upload parsing issues:
  - Use PDF/DOCX/TXT only.
