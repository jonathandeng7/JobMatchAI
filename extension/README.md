# JobMatch AI Chrome extension (v0.2)

## One-time setup

1. Start the local app with `python run.py` from the repository root. Configure the app's OpenAI key in `.env`.
2. Open **My profile & resume** in the app. Upload your base resume once and enter your details. Both save automatically on this computer. Previous browser-only saved profiles migrate when you open the updated app.
3. Download `/extension.zip` from the app and extract it to a permanent folder, or use the repository's `extension` folder.
4. Open `chrome://extensions`, enable Developer mode, click **Load unpacked**, and choose the folder containing `manifest.json`. Pin JobMatch AI Autofill.
5. The extension connects to `http://127.0.0.1:8000` by default. If you use another port, change **Connection settings** in the popup. Only `http://127.0.0.1` and `http://localhost` app addresses are accepted.

## Each job: one button

Open a Greenhouse (`*.greenhouse.io`) or Lever (`jobs.lever.co`) job application, open the extension, and click **Autofill with my information**.

A persistent progress tab reads the current job description, asks the local app to tailor your saved base resume, creates a job-specific DOCX, and fills common empty form fields. The default option attaches that DOCX to an empty resume field. You can uncheck attachment first. The extension returns focus to the application when done; the progress tab remains available for the generated resume, download, changes, and unresolved questions.

No per-job JSON exports/imports or repeat resume uploads are needed. Closing the small popup does not cancel a run. Keep the local app, job tab, and progress tab open during generation. Navigating to a different job while tailoring prevents autofill. Select the full job description before clicking if the page does not expose it clearly, or open the full posting rather than an application-only form.

You review the resume and application and submit yourself. AI edits may be wrong. The base resume is never replaced by generated text. DOCX export uses simple paragraphs and does not preserve the original PDF layout.

## Updates and limitations

After pulling changes or replacing the extracted extension files, click Reload at `chrome://extensions` and refresh the job page. Version 0.2 adds local-app permissions; Chrome may prompt you to accept them. Keep the extension folder on disk.

Only conventional, visible, empty text fields with recognized labels are filled. Existing answers and file attachments are preserved. Custom dropdowns, consent, demographics, work authorization/sponsorship, dates, and work-history widgets remain manual. Dynamically revealed fields may require another run. Embedded cross-origin forms must be opened in a new tab. LinkedIn and Workday are not supported. No applications are submitted, accounts created, login sessions extracted, or CAPTCHAs bypassed.

Attaching a resume can immediately upload it to the recruiting site, before final submission. If a resume widget is hidden, custom, or does not accept DOCX, download the document from the progress tab and upload it manually.

## Data handling

The local app stores your base resume/profile in `.local/candidate.json` (ignored by Git); browser drafts provide a local backup. Tailoring sends resume and job text to OpenAI through the app. The extension never needs or stores an API key. Generated text and document data live in the progress tab until it closes. **Delete saved information** in the app removes the local app copy and that browser's backup; delete downloaded backups separately.

The extension uses `activeTab` and `scripting` to access the application you invoke it on, `storage` for its connection address, and HTTP host access only to loopback addresses for the local app. It has no permanent Greenhouse/Lever site permissions. Keep the app loopback-only for this single-user workflow.

Browser fixture tests cover the pipeline with synthetic profiles and bridged Chrome APIs. The managed cloud browser blocks installing unpacked extensions, so real installation/popup permission behavior and compatibility with live employer forms still require manual verification in your Chrome.
