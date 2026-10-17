# JobMatch AI Chrome extension (v0.1)

1. Start the local app with `python run.py` from the repository root. The home page is the Apply workspace; `/apply` works too.
2. Download the extension ZIP and extract it to a folder.
3. Open `chrome://extensions`, enable Developer mode, click **Load unpacked**, and select that folder (the one containing manifest.json). Pin JobMatch AI if desired. This is a local development extension, not a Chrome Web Store listing.
4. On the Apply page, import a private profile or enter your details; upload your resume and paste a job description. Optionally capture selected job text using the extension and import that JSON into the page.
5. Request tailoring, inspect the suggested changes and full resume, edit as needed, and check the review box. You can also use the original resume text. Export the approved application JSON. DOCX export uses simple paragraphs and does not preserve the original PDF layout.
6. On the actual Greenhouse (`*.greenhouse.io`) or Lever (`jobs.lever.co`) application, import that JSON in the extension and click **Fill empty fields**. Optionally enable DOCX attachment. Review every field, remaining question, and resume before submitting yourself.

Only conventional, visible, empty text fields with recognized labels are filled. Existing answers are preserved. Custom dropdowns, consent, demographic questions, work authorization/sponsorship questions, dates, and work-history widgets need manual input. Unsupported fields are reported where visible. Dynamically revealed fields may need another click. Embedded cross-origin forms must be opened in a new tab. No applications are submitted, accounts created, login sessions extracted, or CAPTCHAs bypassed.

The extension uses activeTab access only after you invoke it, scripting to fill the current page, and local storage for the imported bundle. It has no permanent site permissions and makes no network requests. Your app sends resume/job text to OpenAI only when you request tailoring. Local browser storage and exported bundles contain personal data; clear them when done and do not use on shared computers. Resume attachment sends the file to the recruiting site's upload handler when selected, even before final submission.

The application bundle and profile are data, not executable instructions. Do not include API keys. Tailoring requires the server's OpenAI API key, never a key in the extension. LinkedIn, Workday, and other systems are not supported in this version.
