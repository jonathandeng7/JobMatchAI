# JobMatch AI

Analyze your resume against a job description, review tailored resume edits, and use a Chrome extension to fill common application fields on Greenhouse and Lever. You review the application and submit it yourself.

## Use the deployed app

No local server is needed if your Vercel deployment is running.

1. Open your Vercel app's URL. The home page provides resume fit analysis.
2. Click **Apply workspace & Chrome extension**, or add `/apply` to your app's URL.
3. Import your private profile JSON, or enter your details. Upload your resume and paste a job description. **Save in this browser** retains your profile and drafts locally.
4. Click **Suggest tailored resume**, inspect the changes and full resume, and edit as needed. Alternatively, click **Use original resume**.
5. Check **I reviewed this resume and approve it for this application**.
6. Click **Export for extension** to download an application JSON bundle. **Download approved DOCX** downloads the resume separately.

AI features require `OPENAI_API_KEY` in Vercel Project Settings → Environment Variables. Enable it for the relevant deployment environments and redeploy after changing it. Set `JOBMATCH_OPENAI_MODEL` optionally; the default is `gpt-5`. See [Vercel deployment instructions](DEPLOY_VERCEL.md).

## Install and use the Chrome extension

Install once:

1. On `/apply`, click **Download Chrome extension** and extract the ZIP to a permanent folder. Alternatively, use this repository's `extension` folder.
2. In Chrome, open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
4. Pin **JobMatch AI Autofill** using Chrome's Extensions menu.

For each application:

1. Prepare and export an approved application JSON from `/apply` as described above.
2. Open the actual Greenhouse (`*.greenhouse.io`) or Lever (`jobs.lever.co`) application page.
3. Open the JobMatch AI extension and import the exported JSON using **Application JSON**.
4. Optionally check **Also attach the approved DOCX to an empty resume field**. Attaching a file may immediately upload it to the recruiting site.
5. Click **Fill empty fields**, inspect the results, and complete the remaining questions yourself.
6. Review all answers and the attached resume, then submit on the job site.

To capture a job description, select its text on a supported job page and click **Save job text for the Apply page** in the extension. Import the resulting JSON using **Import captured job** on `/apply`.

The extension stays installed after restarting Chrome as long as you keep its folder. To update it, replace the folder's files with a fresh download, click the extension's reload button at `chrome://extensions`, and refresh the job page. Import a newly approved bundle whenever your details or tailored resume change.

Existing answers are preserved. Custom dropdowns, work authorization/sponsorship questions, demographic questions, consent, and complex work-history widgets require manual entry. For an embedded application, open the actual Greenhouse/Lever form in a new tab. LinkedIn and Workday are not supported. See [extension details](extension/README.md).

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
python -m uvicorn backend.main:app --reload --port 8000
```

Open `http://127.0.0.1:8000` for analysis or `http://127.0.0.1:8000/apply` for the Apply workspace. Keep the terminal running; press Ctrl+C to stop. No Node build or database is required.

### Start it again later

From your existing `JobMatchAI` folder, activate the virtual environment and start the server:

```bash
# macOS / Linux
source .venv/bin/activate
python -m uvicorn backend.main:app --reload --port 8000
```

```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
python -m uvicorn backend.main:app --reload --port 8000
```

After pulling updates, run `python -m pip install -r backend/requirements.txt` again if dependencies changed. Restart the server after changing `.env`. If port 8000 is occupied, use `--port 8001` and open that port instead.

## Checks and limitations

```bash
python -m unittest discover -s tests -v
python -m pip check
```

The backend tests cover streaming analysis, structured tailoring, document export, and error handling using mocked OpenAI responses. Browser fixture checks are documented in [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md); they do not prove compatibility with every live employer form. The managed cloud browser blocks unpacked extension loading, so installation must be checked in your own Chrome. Live AI calls require a working API key with available credits.

Profiles and drafts are stored in your browser; extension bundles are stored in Chrome extension local storage. Resume uploads go to the app for parsing, and AI requests send resume/job text to OpenAI. Keep personal profile JSON, exported bundles, resumes, and keys out of the repository. Clear browser/extension data when using a shared computer. DOCX export uses simple paragraphs and does not preserve your original PDF layout.
