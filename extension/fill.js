/* Runs in Chrome's isolated world, only after the user clicks Fill. */
async function jobmatchFill(bundle, attachResume) {
  if (!/(^|\.)greenhouse\.io$/.test(location.hostname) && location.hostname !== 'jobs.lever.co') {
    throw new Error('Only Greenhouse and Lever application pages are supported.');
  }
  const profile = bundle.profile || {};
  const rules = [
    [/^(first name|given name)$/, 'firstName'], [/^(last name|family name|surname)$/, 'lastName'],
    [/^(full name|name|your name)$/, 'fullName'], [/^(email|email address|your email)$/, 'email'],
    [/^(phone|phone number|mobile|mobile phone|telephone)$/, 'phone'],
    [/^(linkedin|linkedin profile|linkedin url|linkedin profile url)$/, 'linkedin'],
    [/^(github|github url|github profile|github profile url)$/, 'github'],
    [/^(website|personal website|portfolio|portfolio url|website url)$/, 'website'],
    [/^(city|current city)$/, 'city'], [/^(state|state province|state region)$/, 'state'],
    [/^(zip|zip code|postal code)$/, 'postalCode'], [/^(country)$/, 'country'],
    [/^(school|university|school name)$/, 'school'], [/^(degree)$/, 'degree']
  ];
  const report = {filled: [], uploaded: [], remaining: [], existing: 0};
  const normalize = s => s.toLowerCase().replace(/[*:()\/\-_]/g, ' ').replace(/\s+/g, ' ').trim();
  const labelFor = el => [Array.from(el.labels || []).map(l => l.textContent).join(' '), el.getAttribute('aria-label'),
    el.closest('.application-question')?.querySelector('.application-label')?.textContent,
    (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' '),
    el.placeholder, el.name].filter(Boolean);
  const visible = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  for (const el of document.querySelectorAll('input, textarea, select')) {
    if (el.disabled || el.readOnly) continue;
    const type = (el.type || '').toLowerCase();
    // Recruiting sites often hide the native file input behind a visible label.
    const visibleUpload = type === 'file' && Array.from(el.labels || []).some(visible);
    if (!visible(el) && !visibleUpload) continue;
    const labels = labelFor(el);
    const label = labels[0] || 'Unlabelled field';
    if (['hidden','submit','button','reset','checkbox','radio'].includes(type)) {
      if (['checkbox','radio'].includes(type)) report.remaining.push(`${label} (choose manually)`);
      continue;
    }
    if (type === 'file') {
      if (el.files?.length) {report.existing++; continue;}
      const isResume = labels.some(l => /\b(resume|cv)\b/i.test(l)) && !labels.some(l => /cover/i.test(l));
      if (attachResume && isResume && (bundle.approved === true || bundle.generatedForJob === true) && bundle.document?.base64) {
        const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const accepted = (el.accept || '').toLowerCase().split(',').map(x=>x.trim());
        if (el.accept && !accepted.some(x => ['.docx',mime,'application/*','*/*'].includes(x))) {
          report.remaining.push(`${label} (DOCX not accepted; upload manually)`); continue;
        }
        try {
          const bytes = Uint8Array.from(atob(bundle.document.base64), c => c.charCodeAt(0));
          const transfer = new DataTransfer();
          transfer.items.add(new File([bytes], 'resume.docx', {type:mime}));
          el.files = transfer.files;
          el.dispatchEvent(new Event('change', {bubbles:true}));
          report.uploaded.push(label);
        } catch {report.remaining.push(`${label} (upload manually)`);}
      } else report.remaining.push(`${label} (upload manually)`);
      continue;
    }
    if (el.value?.trim()) {report.existing++;continue;}
    if (!['text','email','tel','url','search','textarea'].includes(type) || el.tagName === 'SELECT' || el.getAttribute('role') === 'combobox' || el.getAttribute('aria-autocomplete')) {
      report.remaining.push(`${label} (choose manually)`);continue;
    }
    let field;
    for (const candidate of labels) {
      field = rules.find(([rule]) => rule.test(normalize(candidate)))?.[1];
      if (field) break;
    }
    const value = field === 'fullName' ? [profile.firstName,profile.lastName].filter(Boolean).join(' ') : profile[field];
    if (typeof value !== 'string' || !value.trim()) {report.remaining.push(label);continue;}
    const prototype = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', {bubbles:true}));
    el.dispatchEvent(new Event('change', {bubbles:true}));
    if (el.value === value) report.filled.push(label);
    else report.remaining.push(`${label} (site did not retain the value)`);
  }
  return report;
}
