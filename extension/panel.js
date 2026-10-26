'use strict';
const $ = id => document.getElementById(id);
const labels = {firstName:'First name',lastName:'Last name',email:'Email',phone:'Phone',linkedin:'LinkedIn URL',github:'GitHub URL',website:'Portfolio',city:'City',state:'State / region',postalCode:'Postal code',country:'Country',school:'School',degree:'Degree',graduation:'Graduation',targetRoles:'Target roles',targetLocations:'Target locations',workAuthorization:'Work authorization',sponsorship:'Sponsorship needs',availableFrom:'Available start date'};
let connected=false, busy=false, aiConfigured=false, resumeName='My resume', revision=0;
let currentTab=null, jobOwner=null, draftJob=null, draftBundle=null, draftRevision=-1;
let saveTimer, saveQueue=Promise.resolve();
for(const [name,label] of Object.entries(labels)) {
  const wrap=document.createElement('label');wrap.textContent=label;
  const input=document.createElement('input');input.id=name;input.type=name==='email'?'email':name==='phone'?'tel':'text';input.disabled=true;
  wrap.append(input);$('fields').append(wrap);
}
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function view(name){for(const item of ['apply','resume','profile']){$(item+'View').hidden=item!==name;$(item+'Tab').setAttribute('aria-selected',String(item===name));}}
for(const name of ['apply','resume','profile'])$(name+'Tab').onclick=()=>view(name);
function candidate(){return {profile:Object.fromEntries(Object.keys(labels).map(k=>[k,$(k).value.trim()])),resume:$('original').value,resumeName};}
function sameJob(a,b){return !!a&&!!b&&a.id===b.id&&a.url===b.url;}
function hasInfo(){return $('original').value.trim()||Object.keys(labels).some(k=>$(k).value.trim());}
function controls(){
  const ready=connected&&!busy;
  for(const id of ['fill','fillSaved'])$(id).disabled=!ready||!hasInfo();
  $('tailorOnly').disabled=!ready||!aiConfigured||!$('original').value.trim();
  $('read').disabled=busy;
  $('applyDraft').disabled=!ready||!draftBundle||!$('draft').value.trim()||draftRevision!==revision||!sameJob(draftJob,currentTab);
  $('download').disabled=busy||!$('draft').value.trim();
  for(const id of ['original','resumeFile','saveProfile',...Object.keys(labels)])$(id).disabled=!ready;
  for(const id of ['tailorBeforeFill','attach','job','saveOrigin','saveProvider','aiProvider'])$(id).disabled=busy;
}
function setBusy(value){busy=value;controls();}
function invalidDraft(){revision++;draftRevision=-1;if(draftBundle)$('draftState').textContent='Profile changed · tailor again';controls();}
function populate(saved){
  for(const key of Object.keys(labels))$(key).value=typeof saved.profile?.[key]==='string'?saved.profile[key]:'';
  $('original').value=saved.resume||'';resumeName=saved.resumeName||'My resume';$('resumeName').textContent=saved.resume?.trim()?resumeName:'Upload once. Changes save on this computer.';
}
async function connect(){
  connected=false;controls();
  const origin=await JobMatchApi.origin();$('appOrigin').value=origin;
  await JobMatchApi.checkConnection();
  const saved=await JobMatchApi.request('/candidate');
  if(!saved.profile||typeof saved.ready!=='boolean')throw JobMatchApi.incompatible(origin);
  populate(saved);aiConfigured=saved.aiConfigured;connected=true;$('aiProvider').value=saved.aiProvider||'openai';
  if(!aiConfigured)$('tailorBeforeFill').checked=false;
  $('connection').textContent='Connected locally';$('saveState').textContent='All changes saved';controls();
  status(!aiConfigured?(saved.aiSetupMessage||'Configure an AI provider in Connection settings. Saved-information autofill works without it.'):(saved.aiSetupMessage||'Your saved information is ready. Everything happens in this panel.'));
  if(!aiConfigured)$('settings').open=true;
}
function connectionError(error){connected=false;$('connection').textContent=error.code==='INCOMPATIBLE_SERVER'?'Wrong or outdated server':error.code==='OFFLINE'?'Local app offline':'Connection needs attention';$('settings').open=true;status(error.message,true);controls();}
function persist(){
  clearTimeout(saveTimer);
  if(!connected)return Promise.reject(Error('Reconnect to the local app before saving.'));
  const data=candidate();$('saveState').textContent='Saving…';
  saveQueue=saveQueue.catch(()=>{}).then(()=>JobMatchApi.request('/candidate',data,'PUT'));
  return saveQueue.then(()=>{$('saveState').textContent='All changes saved';$('resumeName').textContent=data.resume.trim()?resumeName:'Add your base resume once.';controls();})
    .catch(error=>{$('saveState').textContent='Not saved — retry';status(error.message,true);throw error;});
}
for(const id of ['original',...Object.keys(labels)])$(id).addEventListener('input',()=>{invalidDraft();$('saveState').textContent='Unsaved changes';clearTimeout(saveTimer);saveTimer=setTimeout(()=>persist().catch(()=>{}),650);});
async function refreshTarget(){
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!sameJob(currentTab,tab)){jobOwner=null;$('job').value='';}
  currentTab=tab;
  $('jobTitle').textContent=tab?.title||'Open a Greenhouse or Lever job';
  $('jobHint').textContent=tab?.url&&supported(tab.url)?'Job tab connected · no extra tabs will open.':'Click the extension icon on a Greenhouse or Lever job tab to enable access.';
  controls();return tab;
}
function supported(value){try{const url=new URL(value);return url.protocol==='https:'&&(/(^|\.)greenhouse\.io$/.test(url.hostname)||url.hostname==='jobs.lever.co');}catch{return false;}}
async function target(){const tab=await refreshTarget();if(!tab?.id||!supported(tab.url))throw Error('Open a Greenhouse or Lever job, then click the extension icon on that tab.');return {id:tab.id,url:tab.url,title:tab.title};}
async function execute(details){
  try{return await chrome.scripting.executeScript(details);}
  catch(error){if(/cannot access|permission|not allowed/i.test(error.message))throw Error('Click the JobMatch extension icon on this job tab again to grant access, then retry here.');throw error;}
}
async function readJob(tab){
  if(sameJob(jobOwner,tab)&&$('job').value.trim().length>=80)return {title:tab.title,url:tab.url,jobDescription:$('job').value};
  await execute({target:{tabId:tab.id},files:['job.js']});
  const result=await execute({target:{tabId:tab.id},func:()=>jobmatchJobContext()});
  const job=result[0]?.result;
  if(!job?.jobDescription)throw Error('No job description found. Paste it under View or paste the job description.');
  if(job.url!==tab.url)throw Error('The job page changed. Read the current job again.');
  $('job').value=job.jobDescription;jobOwner=tab;return job;
}
$('job').addEventListener('input',()=>{jobOwner=currentTab;draftRevision=-1;controls();});
function step(id,state){$(id).className=state;}
function steps(){ $('steps').hidden=false;for(const id of ['readStep','tailorStep','fillStep'])step(id,''); }
function showDraft(bundle,tab){
  draftBundle=bundle;draftJob=tab;draftRevision=revision;$('draft').value=bundle.resume||'';
  $('draftTitle').textContent=bundle.savedResume?'Saved base resume':'This job’s resume';
  $('draftState').textContent=bundle.savedResume?'Unchanged base copy':tab.title||'Ready for review';
  $('changes').textContent=(bundle.changes||[]).map(c=>`ORIGINAL\n${c.original}\n\nREVISED\n${c.revised}\n\nWHY\n${c.reason}`).join('\n\n────────\n\n')+
    (bundle.questions?.length?'\n\nTO CHECK\n'+bundle.questions.join('\n'):'');
  controls();
}
async function fillBundle(bundle,tab){
  const active=await refreshTarget();
  if(!sameJob(tab,active))throw Error('The job page changed or you switched tabs. Return to the original job before autofilling this resume.');
  step('fillStep','active');status('Filling your empty application fields…');
  await execute({target:{tabId:tab.id},files:['fill.js']});
  const results=await execute({target:{tabId:tab.id},func:(data,attach,expectedUrl)=>{
    if(location.href!==expectedUrl)throw Error('The job page changed while preparing your information. Read the new job and retry.');
    return jobmatchFill(data,attach);
  },args:[bundle,$('attach').checked,tab.url]});
  const report=results[0]?.result;if(!report)throw Error('Could not fill this form. Your resume is available in the Resume tab.');
  $('report').textContent=`${report.filled.length} fields filled\n${report.uploaded.length} resume(s) attached\n${report.existing} existing answers preserved\n\nNEEDS REVIEW\n${report.remaining.join('\n')||'Check the complete form before submitting.'}`;
  $('reportDetails').hidden=false;$('reportDetails').open=true;step('fillStep','done');
  status('Autofill complete. Review the form and resume, then submit on the job site.');
}
async function prepare(tailor,fill){
  await persist();await JobMatchApi.checkConnection();const tab=await target();steps();step('readStep','active');
  let bundle;
  if(tailor){
    if(!$('original').value.trim())throw Error('Add your base resume once in the Resume tab first.');
    const job=await readJob(tab);step('readStep','done');step('tailorStep','active');status('Tailoring your saved resume to this job…');
    bundle=await JobMatchApi.request('/autofill',{job_description:job.jobDescription,job_url:tab.url});
  }else{
    step('readStep','done');step('tailorStep','active');status('Preparing your saved information. No AI request is made.');
    bundle=await JobMatchApi.request('/autofill/saved',{job_url:tab.url});
  }
  step('tailorStep','done');showDraft(bundle,tab);
  if(fill)await fillBundle(bundle,tab);else{view('resume');status('Tailored resume ready to review here. Your application has not been filled.');}
}
function action(id,fn){$(id).onclick=async()=>{if(busy)return;setBusy(true);try{await fn();}catch(error){status(error.message||'Could not finish. Please retry.',true);}finally{setBusy(false);}};}
action('fill',()=>prepare($('tailorBeforeFill').checked,true));
action('fillSaved',()=>prepare(false,true));
action('tailorOnly',()=>prepare(true,false));
action('read',async()=>{const tab=await target();await readJob(tab);$('jobDetails').open=true;status('Job description loaded in this panel.');});
action('saveProfile',async()=>{await persist();status('Profile and base resume saved.');});
action('saveOrigin',async()=>{
  const origin=JobMatchApi.validateOrigin($('appOrigin').value.trim());
  clearTimeout(saveTimer);if(connected)await persist();else await saveQueue.catch(()=>{});
  await chrome.storage.local.set({appOrigin:origin});invalidDraft();
  try{await connect();}catch(error){connectionError(error);}
});
action('saveProvider',async()=>{
  clearTimeout(saveTimer);if(connected)await persist();
  await JobMatchApi.request('/ai/provider',{provider:$('aiProvider').value},'PUT');
  draftRevision=-1;if(draftBundle)$('draftState').textContent='Provider changed · tailor again';
  try{await connect();}catch(error){connectionError(error);}
});
async function editedBundle(){
  if(!draftBundle||!$('draft').value.trim())throw Error('Prepare a resume first.');
  const doc=await JobMatchApi.request('/resume-document',{resume:$('draft').value});
  return {...draftBundle,resume:$('draft').value,document:doc};
}
$('draft').addEventListener('input',controls);
action('applyDraft',async()=>{if(draftRevision!==revision)throw Error('Your saved information changed. Prepare a fresh resume first.');steps();step('readStep','done');step('tailorStep','done');await fillBundle(await editedBundle(),draftJob);});
action('download',async()=>{
  const bundle=await editedBundle();const doc=bundle.document;
  const url=URL.createObjectURL(new Blob([Uint8Array.from(atob(doc.base64),c=>c.charCodeAt(0))],{type:doc.mime}));
  const a=document.createElement('a');a.href=url;a.download=doc.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('resumeFile').onchange=async event=>{
  const file=event.target.files?.[0];if(!file||busy)return;setBusy(true);
  try{const form=new FormData();form.append('file',file);const data=await JobMatchApi.request('/extract-text',form);$('original').value=data.text;resumeName=file.name;invalidDraft();await persist();status('Base resume saved. You will not need to upload it for each job.');}
  catch(error){status(error.message,true);}finally{event.target.value='';setBusy(false);}
};
chrome.tabs.onActivated?.addListener(()=>refreshTarget().catch(()=>{}));
chrome.tabs.onUpdated?.addListener((id,change)=>{if(id===currentTab?.id&&(change.url||change.status==='complete'))refreshTarget().catch(()=>{});});
controls();refreshTarget().catch(()=>{});connect().catch(connectionError);
