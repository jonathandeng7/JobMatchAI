# JobMatch AI

Analyze your resume against a job description, review tailored resume edits, and use a Chrome extension to fill common application fields on Greenhouse and Lever. You review the application and submit it yourself.

## Open the Apply workspace

Start the app with `python run.py` from the repository root after installing dependencies (see below). It uses your `.venv` automatically and opens the Apply workspace in your browser.

1. Open **My profile & resume**. Upload or paste your base resume once and enter your details. Changes save automatically on this computer.
2. Return to **Application** and paste a job description. Click **Tailor my saved resume** to generate a job-specific copy without uploading again.
3. Inspect the tailored draft and changes. You can edit the draft and click **Download DOCX**. Your original base resume is never overwritten by tailoring.
4. For direct autofill on a job site, use the Chrome extension below. You do not need to export/import a bundle for each job.

Existing browser-only profiles migrate automatically when you first open the updated app. If you have a private profile JSON from an earlier version, restore it once under **Import a captured job or restore a backup**. This saves its base resume and profile to the local app. Use **Export backup** in the profile tab to create a private backup.

Resume tailoring supports **Codex with a ChatGPT subscription** or **OpenAI API credits**. Choose the provider in the extension’s Connection settings. OpenAI API mode uses `OPENAI_API_KEY` in `.env` and optional `JOBMATCH_OPENAI_MODEL` (default `gpt-5`). The separate Resume Analysis page currently uses OpenAI API mode. The app is configured for local development; Vercel-specific files have been removed. An existing Vercel project must be disconnected or deleted separately in the Vercel dashboard to stop hosted deployments.

## Use the extension side panel

Keep the local app running without opening a browser page:

```bash
python run.py --no-browser
```

The local app stores your profile and runs either the official Codex CLI or the OpenAI API client. All normal application work happens inside the extension; the web workspace is optional.

### Install / update once

1. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and choose this repository's `extension` folder. Chrome 116 or later is required. Alternatively, download `/extension.zip` from the local app and extract it first.
2. Pin **JobMatch AI Autofill** using Chrome's Extensions menu.
3. For an existing installation, run `git pull`, click Reload at `chrome://extensions`, accept the new side-panel permission if prompted, and refresh the job tab. If you installed from a ZIP, replace the files first. Your saved resume/profile remains in `.local`.
4. Click the extension icon on your Greenhouse or Lever job tab. A side panel opens next to the application; no progress tab or popup is created.
5. In **Connection settings** inside the panel, use the same local address/port as your server (default `http://127.0.0.1:8000`). Only local HTTP addresses are accepted.

### Everything in the panel

- **Apply:** Click **Autofill with my information** to fill saved text fields immediately, complete supported dropdowns, and tailor a resume in parallel. Uncheck **Tailor my saved resume for this job**, or click **Fill saved information without AI**, to fill from your saved profile and unchanged base resume with no OpenAI request. Attaching the selected DOCX is optional and may upload it to the recruiting site immediately.
- **Tailor resume only:** Generate a job-specific draft without filling the form. Read and edit it under **Resume**, then use **Autofill with this resume** or download the DOCX.
- **Resume:** Preview/download the job-specific draft, restore an earlier generated resume from **Saved resumes from previous jobs**, inspect edits/questions, and upload or edit your saved base resume once. Tailoring never overwrites the base resume.
- **My information:** Edit contact, education, and application details. Changes save automatically to the same local profile used by the app.

You stay on the job page. Keep the side panel and local server open while generating/filling. Closing the panel during a run can interrupt it. When switching to a different job tab, click the extension icon there to grant temporary access. The panel prevents applying a draft to a different tab or URL. If job text cannot be read, paste it under **View or paste the job description** and retry.

### Where your completed resume goes

After tailoring, the Apply tab shows a **Your tailored resume is ready** card with its job-specific filename, **Download DOCX**, and **Review resume** buttons. **Download the tailored DOCX when ready** is enabled by default; the file goes through Chrome Downloads (`Ctrl+J` on Windows/Linux, `Cmd+J` on Mac). You can turn automatic downloading off. Chrome may require accepting the new downloads permission after extension reload.

Generated originals are also saved privately under `.local/drafts/`. Closing/reopening the panel does not remove them. Open **Resume → Saved resumes from previous jobs** to restore/download one. History keeps the generated version; edits made in the preview are marked local and must be downloaded to retain them. Drafts for another job cannot be autofilled onto the current job. These generated files are separate from the base resume and profile, and remain until removed from the private local data folder.

The form report says whether a resume was **selected for upload**. Confirm the recruiting site completed the upload before submitting. If Greenhouse already attached a resume, the extension preserves it and reports that you must replace it manually to use the tailored copy. A DOCX download alone does not attach it to the application.

### Saved answers on Greenhouse

The extension supports conventional text fields, native selects, common React-style comboboxes, and matching radio choices. It can reuse explicit saved U.S. citizenship/work authorization and sponsorship answers. Race and Hispanic/Latino ethnicity are **optional, explicit preferences**: enter your choices once in **My information**, or save a decline-to-disclose choice. Blank preferences remain unanswered. They are never inferred from your name, resume, citizenship, or other profile details. A race choice containing an ethnicity qualifier is not selected unless that qualifier is explicitly supported by your saved answer. Consent and unrelated demographic questions remain manual.

Browser fixtures cover these controls and early profile filling. The cloud network blocks access to the supplied live ID.me Greenhouse URL, so that exact employer form has not been verified live. Custom controls that cannot be matched confidently are reported for manual review.

### Use your ChatGPT subscription for tailoring

If your ChatGPT plan includes Codex, you do not need separate OpenAI API credits for this extension's resume tailoring.

1. Install Node.js LTS if `npm` is not available, then run:

```bash
npm install -g @openai/codex
codex login
```

2. In the official login flow, choose **Sign in with ChatGPT** and use your subscription account. Do not choose API-key login. `codex login status` can confirm the login method locally; do not share its output if it contains key fragments.
3. Pull the latest app, restart the local server on your existing port, and reload the extension.
4. Open **Connection settings → AI tailoring provider**, select **Codex — ChatGPT subscription**, and click **Save AI provider & check sign-in**.
5. Tailor/autofill as usual. The app runs `codex exec` locally with your native CLI authentication. Your resume and job text are sent through Codex and count against your plan's usage limits. There is no separate API-key request and no automatic fallback to paid API mode.

The latest Codex CLI is required for its ephemeral/structured-output options. Login is a one-time local step; the app never extracts or copies authentication tokens. It runs in an isolated temporary folder with read-only sandboxing, user tool configuration ignored, shell/browsing/agent tools disabled, and a JSON response schema. Personal inputs go through stdin. Temporary outputs are removed when the request finishes; the base resume remains unchanged. `JOBMATCH_CODEX_BIN` may specify the native CLI executable path if needed.

The provider preference is saved in `.local/ai-provider.json` (ignored by Git). Without a saved preference, `JOBMATCH_AI_PROVIDER=codex` can set the initial mode; otherwise it defaults to `openai`. A saved panel choice takes precedence. Switching providers does not delete profiles/resumes. The standalone Resume Analysis page continues to require an OpenAI API key; subscription mode covers tailoring and extension autofill.

### OpenAI quota / rate-limit errors

The screenshot message **OpenAI quota or rate limit exceeded** is an API-side failure, independent of the UI. Exhausted API credits/project budgets need attention in OpenAI API billing; temporary rate limits may clear after waiting. A ChatGPT/Codex subscription does not supply API credits, but you can choose the separate Codex subscription mode above. Known temporary API rate limits are retried once after a short wait (at most five seconds); exhausted-credit and unknown 429 errors are not retried. If tailoring fails, the already-filled profile fields remain; no new resume is attached. You can still choose **Fill saved information without AI**, including attaching your unchanged base resume. An OpenAI key is not required for that mode.

Existing answers and attachments are preserved. Unsupported dropdowns, unanswered custom/demographic questions, consent, and complex work-history widgets remain manual. You review and submit. For embedded forms, open the actual Greenhouse/Lever form in its own tab. LinkedIn and Workday are not supported. See [extension details](extension/README.md).

## Run locally

Use Python 3.12 and run these commands from the repository root.

### macOS / Linux

```bash
git clone https://github.com/jonathandeng7/JobMatchAI.git
cd JobMatchAI
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
```

### Windows PowerShell

```powershell
git clone https://github.com/jonathandeng7/JobMatchAI.git
cd JobMatchAI
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
```

If you already have a checkout, use it instead of cloning again. Create a `.env` file in the repository root containing your own key:

```dotenv
OPENAI_API_KEY=your-api-key
# Optional:
JOBMATCH_OPENAI_MODEL=gpt-5
```

`.env` is ignored by Git. Do not commit keys. ChatGPT/Codex subscriptions do not include OpenAI API credits. In Codex cloud environment settings, configure the secret as `JOBMATCH_OPENAI_API_KEY` with destination `api.openai.com` because the platform reserves `OPENAI_` names. The backend accepts this alias; `OPENAI_API_KEY` takes precedence.

With the virtual environment activated, start the app:

```bash
python run.py
```

The browser opens automatically at the Apply workspace. The home page and `/apply` both show Apply; `/analysis` shows resume analysis. Keep the terminal running; press Ctrl+C to stop. No Node build or database is required.

### Start it again later

From your existing `JobMatchAI` folder, activate the virtual environment and start the server:

```bash
# macOS / Linux
source .venv/bin/activate
python run.py
```

```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
python run.py
```

After pulling updates, run `python -m pip install -r backend/requirements.txt` again if dependencies changed. Restart the server after changing `.env`. If port 8000 is occupied, run `python run.py --port 8001`. Add `--no-browser` to suppress automatic browser opening.

## Checks and limitations

```bash
python -m unittest discover -s tests -v
python -m pip check
```

The backend tests cover streaming analysis, structured tailoring, profile persistence, private-data access restrictions, document export, API rate-limit handling, and subscription routing. Codex adapter tests use a fake CLI process to verify ChatGPT-only authentication, input handling, cleanup, timeouts, and no API-key fallback. A real subscription-authenticated generation requires your local CLI login; it has not been executed in the cloud workspace. For browser fixture checks, start the server with `python run.py --port 8001 --no-browser` and run `node tests/browser_apply.cjs` with Playwright installed. Set `APP_URL` or `CHROMIUM_PATH` to override the defaults. Browser tests use synthetic profiles, mocked model responses, and bridged Chrome APIs to exercise the side-panel workflow and AI-free fallback. They do not prove compatibility with every live employer form. The managed cloud browser blocks unpacked extension loading, so installation must be checked in your own Chrome. Live AI calls require a working API key with available credits.

Your base resume/profile is saved to `.local/candidate.json` in the repository folder, which Git ignores. `JOBMATCH_DATA_DIR` can point to a different private data folder. Keep this single-user app bound to loopback; it is not a shared hosted profile service. Browser drafts are also kept locally for recovery. **Delete saved information** removes the app copy and this browser's backup. Resume uploads go to the app for parsing; tailoring sends resume/job text to OpenAI. Generated drafts do not replace your base resume and are retained separately in `.local/drafts`. Keep profile JSON, resumes, backups, keys, and browser data out of Git. DOCX export uses simple paragraphs and does not preserve the original PDF layout.

## Fixing “Not Found” or extension connection errors

If both the home page and the extension return **Not Found**, a server is responding at that address but does not have the current JobMatch AI routes. This usually means a stale process, an older checkout, or another local app is using that port. It is not an OpenAI API key error.

1. Stop the old app terminal with **Ctrl+C**, if you know which terminal owns it.
2. From your actual `JobMatchAI` repository folder, update and start on a free port:

```bash
git pull --ff-only origin main
python run.py --port 8001
```

3. Open the address printed by the launcher. In the extension, expand **Connection settings**, set the address to `http://127.0.0.1:8001`, and click **Save address & reconnect**. The browser and extension must point to the same port.
4. Reload the updated extension at `chrome://extensions`. If installed from a ZIP, replace the extracted files with the latest download first. Refresh the job page.

The launcher prints its source folder, reserves the selected port, and reports a useful error if another process is already using it. It never stops unrelated processes. To check the app directly, open `/health` at its local address: the response must contain `"service":"jobmatch-ai"`, `"apiVersion":2`, and the saved-profile/autofill features. The home page and `/candidate` must both exist. The extension distinguishes an offline app from a reachable wrong/outdated server.

You can continue using port 8000 when it is available; use that same port in the extension. After changing `.env`, restart the app. Saved resumes/profiles remain in `.local` when you switch ports.
