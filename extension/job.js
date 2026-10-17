function jobmatchJobContext() {
  if (!/(^|\.)greenhouse\.io$/.test(location.hostname) && location.hostname !== 'jobs.lever.co') {
    throw new Error('Open a Greenhouse or Lever job application.');
  }
  let text = getSelection()?.toString().trim();
  if (!text || text.length < 80) {
    const source = ['[data-testid="job-description"]', '.job__description', '#content .content', '.posting-page .content', 'main']
      .map(selector => document.querySelector(selector)).find(Boolean) || document.body;
    const copy = source.cloneNode(true);
    copy.querySelectorAll('form, input, textarea, select, button, script, style, nav, header, footer, [contenteditable], .application-form, .postings-btn-wrapper').forEach(el => el.remove());
    // innerText is unavailable for detached nodes; textContent retains the job.
    text = copy.textContent.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
  }
  if (text.length < 80) throw new Error('No full job description found. Open the full posting, or select the job description before clicking Autofill.');
  return {title:document.title, url:location.href, jobDescription:text.slice(0,30000)};
}
