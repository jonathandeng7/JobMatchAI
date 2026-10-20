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

## Install and use the Chrome extension

Install once:

1. Click **Get Chrome extension** in the app header and extract the ZIP to a permanent folder. Alternatively, use this repository's `extension` folder.
2. In Chrome, open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the folder containing `manifest.json`.
3. Pin **JobMatch AI Autofill**. This version needs access to the local app (`127.0.0.1` / `localhost`) to read the saved profile and request tailored resumes. It still uses temporary active-tab access on job sites.

For each application:

1. Keep the local app running with `python run.py`.
2. Open the actual Greenhouse (`*.greenhouse.io`) or Lever (`jobs.lever.co`) job application.
3. Open the extension and click **Autofill with my information**.
4. A progress tab reads the job, tailors your saved base resume, generates a DOCX, and fills common empty application fields. By default it attaches the tailored DOCX to an empty resume field; uncheck the attachment option first if you prefer manual upload. Attaching can immediately upload the file to the recruiting site.
5. The extension returns you to the application. Review the filled answers and resume before submitting. The progress tab remains open with the resume, download button, changes, and unresolved fields/questions.

No repeated resume uploads, job pasting, or per-application JSON transfers are required. The progress tab stays open during generation so closing the small extension popup does not interrupt it. If the page changes to a different URL during tailoring, the extension stops before filling it. If no full job description is found, open the full posting or select the description before retrying.

The app must be reachable at `http://127.0.0.1:8000` by default. For a different port, open **Connection settings** in the extension and save your local app address. The extension only connects to local HTTP addresses; the OpenAI key stays in the app's `.env`, never in the extension.

To update an existing extension, pull this repository (or replace the extracted files with a fresh ZIP), click its reload button at `chrome://extensions`, and refresh the job page. Chrome may ask you to accept the new local-app permissions. Keep the extension folder on disk.

Existing answers and existing file attachments are preserved. Custom dropdowns, work authorization/sponsorship questions, demographic questions, consent, and complex work-history widgets require manual entry. For an embedded application, open the actual Greenhouse/Lever form in a new tab. LinkedIn and Workday are not supported. See [extension details](extension/README.md).

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

The backend tests cover streaming analysis, structured tailoring, profile persistence, private-data access restrictions, document export, and error handling using mocked OpenAI responses. For browser fixture checks, start the server with `python run.py --port 8001 --no-browser` and run `node tests/browser_apply.cjs` with Playwright installed. Set `APP_URL` or `CHROMIUM_PATH` to override the defaults. Browser tests use synthetic profiles, mocked model responses, and bridged Chrome APIs to exercise the one-click orchestration. They do not prove compatibility with every live employer form. The managed cloud browser blocks unpacked extension loading, so installation must be checked in your own Chrome. Live AI calls require a working API key with available credits.

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
