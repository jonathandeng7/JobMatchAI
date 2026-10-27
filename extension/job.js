function jobmatchJobContext() {
  const site = jobmatchSite();
  if (!site) throw new Error('Open a supported job application: Greenhouse, Lever, Ashby, SmartRecruiters, or Workday.');
  let text = getSelection()?.toString().trim();
  if (!text || text.length < 80) {
    const source = [...site.descriptions, 'main']
      .map(selector => document.querySelector(selector)).find(el => el?.textContent.trim().length >= 80) || document.body;
    const copy = source.cloneNode(true);
    copy.querySelectorAll('form, input, textarea, select, button, script, style, nav, header, footer, [contenteditable], [role="form"], .application-form, .ashby-application-form-container, [data-automation-id^="formField-"], .postings-btn-wrapper').forEach(el => el.remove());
    // innerText is unavailable for detached nodes; textContent retains the job.
    text = copy.textContent.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
  }
  if (text.length < 80) throw new Error('No full job description found on this step. Paste it in the panel, or read it on the full posting before applying. Saved-information filling works without a description.');
  return {title:document.title, url:location.href, site:site.id, jobDescription:text.slice(0,30000)};
}
