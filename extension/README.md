# JobMatch AI side panel (v0.4)

## Start and install

1. From the repository root, run `python run.py --no-browser`. Keep the local server running; no app webpage is required. The server stores your profile and uses either the Codex CLI ChatGPT sign-in or an OpenAI API key.
2. Open `chrome://extensions`, enable Developer mode, click **Load unpacked**, and choose the repository's `extension` folder (or a downloaded/extracted extension ZIP). Chrome 116+ is required.
3. Pin JobMatch AI Autofill. When updating, pull changes and click Reload on its extension card. Accept the side-panel permission if prompted, then refresh the job page. Saved information stays in the local app.
4. Click the toolbar icon on the Greenhouse (`*.greenhouse.io`) or Lever (`jobs.lever.co`) job tab. The extension opens beside it as a side panel. No new tabs are created.
5. The panel connects to `http://127.0.0.1:8000` by default. Use **Connection settings** for a different local port. Server and panel must point to the same address. A reachable outdated app is distinguished from an offline app.

## Apply, tailor, and edit here

**Apply:** With tailoring enabled, **Autofill with my information** reads the current job, tailors a copy of your saved base resume, and fills common empty fields. The attachment checkbox controls whether the generated DOCX is attached to an empty resume field. You can inspect results and the resume without leaving the panel.

**Without AI:** Uncheck **Tailor my saved resume for this job** or click **Fill saved information without AI**. This uses saved details and the unchanged base resume, does not call OpenAI, and works without an API key or credits. Contact-only filling also works without a saved resume. No full job description is needed in this mode.

**Tailor resume only:** Generate a draft without modifying the application. The Resume tab shows editable text, changes, questions, and a DOCX download. **Autofill with this resume** applies the edited draft to its original job. Navigating/switching to another job prevents stale autofill.

**Resume:** Upload your PDF/DOCX/TXT base resume once, or paste/edit the saved text. It saves automatically. Tailored drafts never replace it. DOCX uses simple paragraphs and does not preserve your original PDF layout.

**My information:** Edit profile fields here. Changes save automatically and are shared with the local app. No per-job imports, exports, or repeated uploads are required.

Keep the side panel, local server, and application tab open during a run. Closing the panel can interrupt a run. After switching job tabs, click the extension icon on the new tab to grant temporary access. If the job description cannot be extracted, read/select its text or paste it into **View or paste the job description**.

## Tailoring with your subscription

For an eligible ChatGPT plan that includes Codex, install the official CLI (`npm install -g @openai/codex`) and run `codex login`. Choose **Sign in with ChatGPT** using your subscription account. Then select **Connection settings → AI tailoring provider → Codex — ChatGPT subscription → Save AI provider & check sign-in** in the panel. No OpenAI API key or separately billed API credits are needed for this tailoring mode. It still uses Codex plan limits.

Keep the CLI updated. The local app calls `codex exec` with ChatGPT-only authentication, an ephemeral read-only temporary workspace, tools disabled, and a structured response schema. It does not copy login tokens, pass personal inputs in process arguments, or fall back to API billing if Codex fails. The selector/status checks authentication availability; they do not prove remaining plan usage. The separate web Resume Analysis page still uses OpenAI API mode.

The provider choice is retained in `.local/ai-provider.json`; profiles/resumes are not replaced. If the CLI is not on PATH, `JOBMATCH_CODEX_BIN` can point to its executable. API mode remains available as **OpenAI API — separate API credits**.

## API errors and form limits

In OpenAI API mode, a quota/credit/rate-limit error cannot be resolved by moving the UI. Check OpenAI API billing and project budgets for exhausted credits; retry later for temporary rate limits. Failed tailoring leaves the form untouched. The explicit saved-information mode remains available and does not incur an AI request. API keys stay in the local app, never in the extension. Known short temporary API rate limits get one bounded retry; exhausted credits do not.

Only conventional empty fields with known labels are filled. Existing answers and files are preserved. Custom widgets, eligibility, consent, demographics, dates, and complex work-history questions remain manual. Embedded cross-origin forms must be opened directly. LinkedIn and Workday are unsupported. The extension never submits, creates accounts, extracts login sessions, or bypasses CAPTCHAs.

Attaching can upload the DOCX to the recruiting site before final submission. If a custom widget does not accept it, download it in the Resume tab and upload manually. Review the AI draft and full application before submitting yourself.

## Data and verification

The local app stores the base resume/profile in `.local/candidate.json` (ignored by Git). Edits made in the panel update that same file. Keep the app loopback-only for this single-user workflow. Tailoring sends resume and job text to OpenAI. Generated drafts live in the open panel. Profile backups/downloads contain personal data and should not be committed.

Permissions: `sidePanel` opens the extension beside the job; `activeTab` and `scripting` read/fill the tab you invoke it on; `storage` saves the connection address; loopback HTTP host access connects to the app. No permanent Greenhouse/Lever site permission is requested. The toolbar handler opens the panel directly in response to your click.

Automated browser fixtures cover the panel UI, tailored and saved-only filling, profile editing, upload, errors, and no tab creation using bridged Chrome APIs. Managed cloud Chromium blocks unpacked extension installation, so actual Chrome installation/permissions and live employer compatibility still require local verification.

Subscription adapter tests use a fake CLI and browser tests use bridged Chrome APIs. A real ChatGPT-authenticated generation must be verified after your local `codex login`; the cloud task does not borrow its own agent credentials to test your subscription.
