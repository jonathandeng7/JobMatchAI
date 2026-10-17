const $ = id => document.getElementById(id);
function status(text, error=false) {$('status').textContent=text; $('status').classList.toggle('error',error);}
async function connect() {
  $('fill').disabled = true;
  const origin = await JobMatchApi.origin();
  $('appOrigin').value = origin; $('workspace').href = origin + '/';
  const saved = await JobMatchApi.request('/candidate');
  const name = [saved.profile.firstName, saved.profile.lastName].filter(Boolean).join(' ') || 'Your profile';
  $('profile').textContent = saved.ready ? `${name} · Base resume saved` : 'Save your resume once in the Apply workspace.';
  $('fill').disabled = !saved.ready || !saved.aiConfigured;
  if (saved.ready && !saved.aiConfigured) status('Add an OpenAI API key to the local app’s .env file and restart it to enable tailoring.', true);
  else if (!saved.ready) status('Open your workspace below to finish the one-time setup.');
  else status('Ready. Open a Greenhouse or Lever application, then click Autofill.');
}
$('saveOrigin').onclick = async () => {
  try {
    const origin = JobMatchApi.validateOrigin($('appOrigin').value.trim());
    await chrome.storage.local.set({appOrigin:origin}); await connect();
  } catch (e) {status(e.message,true);}
};
$('fill').onclick = async () => {
  $('fill').disabled = true;
  try {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    let host;
    try {host = new URL(tab?.url).hostname;} catch {throw Error('Open a Greenhouse or Lever job application first.');}
    if (!/(^|\.)greenhouse\.io$/.test(host) && host !== 'jobs.lever.co') throw Error('Open the actual Greenhouse or Lever job application first.');
    // Run in a persistent extension tab so closing the popup cannot interrupt tailoring.
    const parameters = new URLSearchParams({tab:String(tab.id),attach:String($('attach').checked)});
    await chrome.tabs.create({url:chrome.runtime.getURL('autofill.html')+'?'+parameters});
    window.close();
  } catch (e) {status(e.message,true); $('fill').disabled=false;}
};
connect().catch(e => {$('profile').textContent='Local workspace offline';status(e.message,true);});
