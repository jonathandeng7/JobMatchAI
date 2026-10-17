# Deploy JobMatch AI to Vercel

## 1. Prerequisites

- A Vercel account
- OpenAI API key with available credits
- This repository pushed to GitHub

## 2. Project setup included in this repo

- `api/index.py` exports the FastAPI app for Vercel
- `vercel.json` routes all requests to the Python serverless function
- Root `requirements.txt` installs backend dependencies

## 3. Set environment variable in Vercel

In Vercel Project Settings -> Environment Variables, add:

- `OPENAI_API_KEY` = your key

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
vercel env add OPENAI_API_KEY
vercel --prod
```

## 5. Verify

After deploy, open your Vercel URL and test:

1. Upload/paste resume
2. Paste job description
3. Run Analyze Fit

If you see an API credit error, add credits in OpenAI API billing.

## 6. Troubleshooting

- `OPENAI_API_KEY not set`:
  - Confirm env var exists in Vercel Project Settings.
  - Redeploy after adding/updating env vars.
- 429 quota error from OpenAI:
  - Key is valid, but account/project needs credits.
- Upload parsing issues:
  - Use PDF/DOCX/TXT only.

## Local and cloud development

Install with `python -m venv .venv` and
`.venv/bin/python -m pip install -r backend/requirements.txt`, then run
`.venv/bin/python -m uvicorn backend.main:app --reload --port 8000`.

The backend uses the OpenAI Responses API with `gpt-5` by default. Set
`JOBMATCH_OPENAI_MODEL` to another Responses-compatible model if needed.
`OPENAI_API_KEY` takes precedence. In Codex cloud environment settings, use the
secret name `JOBMATCH_OPENAI_API_KEY` with destination `api.openai.com` because
the platform reserves names beginning with `OPENAI_`. The backend accepts
that alias as well. Enter keys securely in environment settings; never commit them.
ChatGPT/Codex subscriptions do not supply API credits.

Run backend checks with `.venv/bin/python -m unittest discover -s tests -v`.
