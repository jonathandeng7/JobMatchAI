# JobMatch AI

Analyze your resume against a job description, review tailored resume edits, and use a Chrome extension to fill common application fields on Greenhouse and Lever. You review the application and submit it yourself.

## Open the Apply workspace

Start the app with `python run.py` from the repository root after installing dependencies (see below). It uses your `.venv` automatically and opens the Apply workspace in your browser.

1. Open **My profile & resume**. Upload or paste your base resume once and enter your details. Changes save automatically on this computer.
2. Return to **Application** and paste a job description. Click **Tailor my saved resume** to generate a job-specific copy without uploading again.
3. Inspect the tailored draft and changes. You can edit the draft and click **Download DOCX**. Your original base resume is never overwritten by tailoring.
4. For direct autofill on a job site, use the Chrome extension below. You do not need to export/import a bundle for each job.

Existing browser-only profiles migrate automatically when you first open the updated app. If you have a private profile JSON from an earlier version, restore it once under **Import a captured job or restore a backup**. This saves its base resume and profile to the local app. Use **Export backup** in the profile tab to create a private backup.

AI features require `OPENAI_API_KEY` in your local `.env` file. Set `JOBMATCH_OPENAI_MODEL` optionally; the default is `gpt-5`. The app is configured for local development; Vercel-specific files have been removed. An existing Vercel project must be disconnected or deleted separately in the Vercel dashboard to stop hosted deployments.

## Use the extension side panel

Keep the local app running without opening a browser page:

```bash
python run.py --no-browser
```

The local app still stores your profile and API key and makes OpenAI requests. All normal application work happens inside the extension; the web workspace is optional.

### Install / update once

1. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and choose this repository's `extension` folder. Chrome 116 or later is required. Alternatively, download `/extension.zip` from the local app and extract it first.
2. Pin **JobMatch AI Autofill** using Chrome's Extensions menu.
3. For an existing installation, run `git pull`, click Reload at `chrome://extensions`, accept the new side-panel permission if prompted, and refresh the job tab. If you installed from a ZIP, replace the files first. Your saved resume/profile remains in `.local`.
4. Click the extension icon on your Greenhouse or Lever job tab. A side panel opens next to the application; no progress tab or popup is created.
5. In **Connection settings** inside the panel, use the same local address/port as your server (default `http://127.0.0.1:8000`). Only local HTTP addresses are accepted.

### Everything in the panel

- **Apply:** Click **Autofill with my information** to tailor your saved resume for the current job and fill common empty fields. Uncheck **Tailor my saved resume for this job**, or click **Fill saved information without AI**, to fill from your saved profile and unchanged base resume with no OpenAI request. Attaching the selected DOCX is optional and may upload it to the recruiting site immediately.
- **Tailor resume only:** Generate a job-specific draft without filling the form. Read and edit it under **Resume**, then use **Autofill with this resume** or download the DOCX.
- **Resume:** Preview/download the job-specific draft, inspect its edits/questions, and upload or edit your saved base resume once. Tailoring never overwrites the base resume.
- **My information:** Edit contact, education, and application details. Changes save automatically to the same local profile used by the app.

You stay on the job page. Keep the side panel and local server open while generating/filling. Closing the panel during a run can interrupt it. When switching to a different job tab, click the extension icon there to grant temporary access. The panel prevents applying a draft to a different tab or URL. If job text cannot be read, paste it under **View or paste the job description** and retry.

### OpenAI quota / rate-limit errors

The screenshot message **OpenAI quota or rate limit exceeded** is an API-side failure, independent of the UI. Exhausted API credits/project budgets need attention in OpenAI API billing; temporary rate limits may clear after waiting. A ChatGPT/Codex subscription does not supply API credits. Failed tailoring does not modify the application. You can still choose **Fill saved information without AI**, including attaching your unchanged base resume. An OpenAI key is not required for that mode.

Existing answers and attachments are preserved. Custom dropdowns, work authorization/sponsorship, demographic questions, consent, and work-history widgets remain manual. You review and submit. For embedded forms, open the actual Greenhouse/Lever form in its own tab. LinkedIn and Workday are not supported. See [extension details](extension/README.md).

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

The backend tests cover streaming analysis, structured tailoring, profile persistence, private-data access restrictions, document export, and error handling using mocked OpenAI responses. For browser fixture checks, start the server with `python run.py --port 8001 --no-browser` and run `node tests/browser_apply.cjs` with Playwright installed. Set `APP_URL` or `CHROMIUM_PATH` to override the defaults. Browser tests use synthetic profiles, mocked model responses, and bridged Chrome APIs to exercise the side-panel workflow and AI-free fallback. They do not prove compatibility with every live employer form. The managed cloud browser blocks unpacked extension loading, so installation must be checked in your own Chrome. Live AI calls require a working API key with available credits.

Your base resume/profile is saved to `.local/candidate.json` in the repository folder, which Git ignores. `JOBMATCH_DATA_DIR` can point to a different private data folder. Keep this single-user app bound to loopback; it is not a shared hosted profile service. Browser drafts are also kept locally for recovery. **Delete saved information** removes the app copy and this browser's backup. Resume uploads go to the app for parsing; tailoring sends resume/job text to OpenAI. Generated drafts do not replace your base resume. Keep profile JSON, resumes, backups, keys, and browser data out of Git. DOCX export uses simple paragraphs and does not preserve the original PDF layout.

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
