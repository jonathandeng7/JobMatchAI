'use strict';
const $ = id => document.getElementById(id);
const storageKey = 'jobmatch-apply-v1';
const labels = {
  firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone',
  linkedin: 'LinkedIn URL', github: 'GitHub URL', website: 'Portfolio URL', city: 'City',
  state: 'State / region', postalCode: 'Postal code', country: 'Country', school: 'School',
  degree: 'Degree', graduation: 'Graduation date', targetRoles: 'Target roles',
  targetLocations: 'Target locations', workAuthorization: 'Work authorization',
  sponsorship: 'Sponsorship needs', availableFrom: 'Available start date'
};
let resumeName = 'My resume';
let saveTimer, toastTimer, lastResult = null, revision = 0;
let saveQueue = Promise.resolve();
let loaded = false;
for (const [name, label] of Object.entries(labels)) {
  const wrap = document.createElement('label');
  wrap.textContent = label;
  const input = document.createElement('input');
  input.id = name;
  input.type = name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text';
  wrap.append(input);
  $('fields').append(wrap);
}
function status(message, error = false) {
  clearTimeout(toastTimer);
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
  if (!error) toastTimer = setTimeout(() => {$('status').textContent = '';}, 7000);
}
function showView(view) {
  for (const name of ['application', 'profile']) {
    const active = view === name;
    $(`${name}View`).hidden = !active;
    $(`${name}Tab`).classList.toggle('active', active);
    $(`${name}Tab`).setAttribute('aria-selected', String(active));
  }
}
$('applicationTab').onclick = () => showView('application');
$('profileTab').onclick = $('setupShortcut').onclick = () => showView('profile');
function candidate() {
  return {profile: Object.fromEntries(Object.keys(labels).map(k => [k, $(k).value.trim()])),
    resume: $('original').value, resumeName};
}
function summary(saved = true) {
  const ready = Boolean($('original').value.trim());
  const name = [$('firstName').value, $('lastName').value].filter(Boolean).join(' ');
  $('readyText').textContent = ready ? `${name || 'Your profile'} · resume ${saved ? 'saved' : 'saving'}` : 'Set up your profile once';
  $('readyDetail').textContent = ready ? 'Ready for the next opportunity. No repeat uploads.' : 'Add your resume in My profile & resume to get started.';
  $('readyDot').classList.toggle('ready', ready && saved);
  $('savedMark').textContent = ready ? 'SAVED LOCALLY' : 'SET UP ONCE';
  $('resumeName').textContent = ready ? resumeName : 'Add your resume';
  $('uploadLabel').textContent = ready ? 'Replace saved resume' : 'Choose PDF, DOCX, or TXT';
  $('setupShortcut').textContent = ready ? 'View saved resume →' : 'Set up your saved resume →';
}
function populate(data) {
  for (const k of Object.keys(labels)) $(k).value = typeof data.profile?.[k] === 'string' ? data.profile[k] : '';
  $('original').value = typeof data.resume === 'string' ? data.resume : '';
  resumeName = typeof data.resumeName === 'string' && data.resumeName ? data.resumeName : 'My resume';
  summary();
}
async function api(path, data, method = 'POST') {
  const response = await fetch(path, {method, headers: data === undefined ? {} : {'Content-Type':'application/json'},
    body: data === undefined ? undefined : JSON.stringify(data)});
  const body = await response.json();
  if (!response.ok) throw Error(typeof body.detail === 'string' ? body.detail : 'Check your input and try again.');
  return body;
}
function remember() {
  // This also preserves the old browser-only format for seamless migration.
  try {localStorage.setItem(storageKey, JSON.stringify({...candidate(), version:1, jobDescription:$('job').value}));}
  catch {status('Browser backup could not be saved. The local app copy is still used.', true);}
}
function invalidate() {
  revision++;
  lastResult = null;
  $('result').hidden = true;
  $('emptyPreview').hidden = false;
  $('previewState').textContent = 'PREVIEW';
}
function persist() {
  clearTimeout(saveTimer);
  if (!loaded) return Promise.reject(Error('Wait for your saved profile to load.'));
  const snapshot = candidate();
  remember();
  $('saveState').textContent = 'Saving…';
  summary(false);
  saveQueue = saveQueue.catch(() => {}).then(() => api('/candidate', snapshot, 'PUT'));
  return saveQueue.then(() => {$('saveState').textContent = 'All changes saved'; summary();})
    .catch(error => {$('saveState').textContent = 'Not saved — retry'; $('readyDot').classList.remove('ready'); status(error.message, true); throw error;});
}
function scheduleSave() {
  invalidate();
  remember();
  $('saveState').textContent = 'Unsaved changes';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persist().catch(() => {}), 650);
}
for (const id of ['original', ...Object.keys(labels)]) $(id).addEventListener('input', scheduleSave);
$('job').addEventListener('input', () => {
  invalidate(); remember(); $('jobCount').textContent = `${$('job').value.length.toLocaleString()} characters`;
});
function action(id, fn) {
  $(id).onclick = async () => {
    $(id).disabled = true;
    try {await fn();} catch (e) {status(e.message || 'Something went wrong. Please retry.', true);}
    finally {$(id).disabled = false;}
  };
}
function download(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], {type}));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function displayResult(data) {
  lastResult = data;
  $('approved').value = data.resume;
  $('changes').textContent = (data.changes || []).map(c => `ORIGINAL\n${c.original}\n\nREVISED\n${c.revised}\n\nWHY\n${c.reason}`).join('\n\n────────────\n\n') +
    (data.questions?.length ? `\n\nTO CHECK\n${data.questions.join('\n')}` : '');
  $('changesSummary').textContent = `${data.changes?.length || 0} changes · ${data.questions?.length || 0} questions to check`;
  $('previewState').textContent = 'READY TO REVIEW';
  $('result').hidden = false; $('emptyPreview').hidden = true;
}
$('resumeFile').onchange = async event => {
  const file = event.target.files?.[0]; if (!file) return;
  $('resumeFile').disabled = true;
  status('Reading and saving your resume…');
  try {
    const form = new FormData(); form.append('file', file);
    const response = await fetch('/extract-text', {method:'POST', body:form});
    const data = await response.json();
    if (!response.ok) throw Error(data.detail || 'Could not read the resume.');
    $('original').value = data.text; resumeName = file.name; invalidate();
    await persist(); status('Resume saved. Every new job will use this base version.');
  } catch (error) {status(error.message, true);}
  finally {$('resumeFile').disabled = false; event.target.value = '';}
};
$('profileFile').onchange = async event => {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== 'object' || typeof data.resume !== 'string' || !data.profile || typeof data.profile !== 'object') throw Error('Choose a profile backup with resume text and profile fields.');
    populate(data); invalidate(); await persist(); status('Profile and resume restored and saved.');
  } catch (e) {status(e.message, true);}
  finally {event.target.value = '';}
};
$('jobFile').onchange = async event => {
  const file = event.target.files?.[0]; if (!file) return;
  try {const data = JSON.parse(await file.text()); if (typeof data.jobDescription !== 'string') throw Error('Choose a captured job JSON file.');
    $('job').value = data.jobDescription; $('job').dispatchEvent(new Event('input')); status('Job description imported. Your saved resume is ready.');
  } catch (e) {status(e.message, true);} finally {event.target.value = '';}
};
action('save', async () => {await persist(); status('Profile and base resume saved.');});
action('backup', () => download(JSON.stringify({...candidate(),version:1}, null, 2), 'jobmatch-profile.json', 'application/json'));
action('clear', async () => {
  if (!confirm('Delete the saved profile and base resume from this computer and this browser?')) return;
  clearTimeout(saveTimer); await saveQueue.catch(() => {});
  await api('/candidate', undefined, 'DELETE');
  localStorage.removeItem(storageKey); populate({}); $('job').value = ''; $('jobCount').textContent = '0 characters'; invalidate();
  $('saveState').textContent = 'No saved information'; status('Saved profile and base resume deleted.');
});
action('tailor', async () => {
  if (!$('original').value.trim()) {showView('profile'); throw Error('Add your base resume once in My profile & resume.');}
  if ($('job').value.trim().length < 80) throw Error('Paste the full job description (at least 80 characters).');
  await persist();
  const version = revision;
  status('Tailoring your saved resume to this opportunity…');
  const data = await api('/autofill', {job_description:$('job').value});
  if (version !== revision) throw Error('Your job or profile changed. Tailor again to use the latest version.');
  displayResult(data); status('Tailored draft ready. Your base resume is unchanged.');
});
action('useOriginal', () => displayResult({resume:$('original').value,changes:[],questions:[]}));
$('setupShortcut').onclick = () => showView('profile');
action('document', async () => {
  if (!lastResult || !$('approved').value.trim()) throw Error('Tailor a resume first.');
  const doc = await api('/resume-document', {resume:$('approved').value});
  download(Uint8Array.from(atob(doc.base64), c => c.charCodeAt(0)), doc.filename, doc.mime);
  status('Resume downloaded. Review it before submitting.');
});
async function initialize() {
  let legacy;
  try {legacy = JSON.parse(localStorage.getItem(storageKey) || 'null');} catch { /* Keep the server copy. */ }
  try {
    const saved = await api('/candidate', undefined, 'GET');
    populate(saved); loaded = true; $('candidateControls').disabled = false;
    if (legacy?.jobDescription) {$('job').value = legacy.jobDescription; $('jobCount').textContent = `${$('job').value.length.toLocaleString()} characters`;}
    if (!saved.resume.trim() && legacy?.resume?.trim()) {
      populate(legacy); await persist(); status('Your previous resume and profile are now saved automatically.');
    } else { $('saveState').textContent = saved.resume ? 'All changes saved' : 'Ready to set up'; status(saved.resume ? 'Your saved resume is ready. Paste a job or use the Chrome extension.' : 'Add your profile and resume once to get started.'); }
    if (!saved.aiConfigured && saved.resume) status('Resume loaded. Add an OpenAI API key to .env to enable tailoring.', true);
  } catch (error) {status(error.message, true); $('readyText').textContent = 'Workspace unavailable'; $('saveState').textContent = 'Could not load saved data';}
}
initialize();
