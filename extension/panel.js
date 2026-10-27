'use strict';
const $ = id => document.getElementById(id);
const labels = {firstName:'First name',lastName:'Last name',email:'Email',phone:'Phone',linkedin:'LinkedIn URL',github:'GitHub URL',website:'Portfolio',city:'City',state:'State / region',postalCode:'Postal code',country:'Country',school:'School',degree:'Degree',graduation:'Graduation',targetRoles:'Target roles',targetLocations:'Target locations',workAuthorization:'Work authorization',sponsorship:'Sponsorship needs',availableFrom:'Available start date',citizenship:'Citizenship status',race:'Race (optional; exact saved choice)',ethnicity:'Hispanic/Latino ethnicity (optional)'};
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
  $('downloadReady').disabled=busy||!$('draft').value.trim();
  $('restoreDraft').disabled=busy||!$('historySelect').value;
  for(const id of ['original','resumeFile','saveProfile',...Object.keys(labels)])$(id).disabled=!ready;
  for(const id of ['tailorBeforeFill','attach','job','saveOrigin','saveProvider','aiProvider','autoDownload'])$(id).disabled=busy;
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
  await refreshHistory();
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
  const site=jobmatchSite(tab?.url||'');
  $('jobTitle').textContent=tab?.title||'Open a supported job application';
  $('jobSite').textContent=site?`CURRENT APPLICATION · ${site.name}`:'CURRENT APPLICATION';
  $('jobHint').textContent=site?site.hint:'Supported: Greenhouse, Lever, Ashby, SmartRecruiters, and Workday (preview). Click the extension icon on the job tab to enable access.';
  controls();return tab;
}
function supported(value){return !!jobmatchSite(value);}
async function target(){const tab=await refreshTarget();if(!tab?.id||!supported(tab.url))throw Error('Open a Greenhouse, Lever, Ashby, SmartRecruiters, or Workday job, then click the extension icon on that tab.');return {id:tab.id,url:tab.url,title:tab.title};}
async function execute(details){
  try{return await chrome.scripting.executeScript(details);}
  catch(error){if(/cannot access|permission|not allowed/i.test(error.message))throw Error('Click the JobMatch extension icon on this job tab again to grant access, then retry here.');throw error;}
}
async function readJob(tab){
  if(sameJob(jobOwner,tab)&&$('job').value.trim().length>=80)return {title:tab.title,url:tab.url,jobDescription:$('job').value};
  await execute({target:{tabId:tab.id},files:['sites.js','job.js']});
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
  $('resumeReady').hidden=!bundle.generatedForJob;$('readyFilename').textContent=bundle.document?.filename||'Tailored resume.docx';
  $('historyState').textContent=bundle.draftId?'Saved in local resume history.':bundle.saveWarning||'';
  $('deliveryState').textContent='Use Download DOCX to keep a copy.';
  controls();
}
async function fillBundle(bundle,tab,options={}){
  const active=await refreshTarget();
  if(!sameJob(tab,active))throw Error('The job page changed or you switched tabs. Return to the original job before autofilling this resume.');
  if(!options.quiet){step('fillStep','active');status('Filling your empty application fields…');}
  await execute({target:{tabId:tab.id},files:['sites.js','fill.js']});
  const results=await execute({target:{tabId:tab.id},func:(data,attach,expectedUrl,fillOptions)=>{
    if(location.href!==expectedUrl)throw Error('The job page changed while preparing your information. Read the new job and retry.');
    return jobmatchFill(data,attach,fillOptions);
  },args:[bundle,options.attach===false?false:$('attach').checked,tab.url,options]});
  const report=results[0]?.result;if(!report)throw Error('Could not fill this form. Your resume is available in the Resume tab.');
  if(!options.quiet)displayReport(report);
  return report;
}
function combineReports(...reports){
  return {filled:[...new Set(reports.flatMap(r=>r?.filled||[]))],uploaded:[...new Set(reports.flatMap(r=>r?.uploaded||[]))],
    remaining:[...new Set(reports.flatMap(r=>r?.remaining||[]))],existing:reports.reduce((n,r)=>n+(r?.existing||0),0)};
}
function displayReport(report){
  $('report').textContent=`${report.filled.length} fields filled\n${report.uploaded.length} resume file(s) selected for upload\n${report.existing} existing answers preserved\n\nNEEDS REVIEW\n${report.remaining.join('\n')||'Check the complete form before submitting.'}`+
    (report.uploaded.length?'\n\nConfirm the job site finished uploading the selected resume.':'');
  $('reportDetails').hidden=false;$('reportDetails').open=true;step('fillStep','done');
}
function fillSummary(report){
  return report.filled.length||report.uploaded.length?'Autofill complete for this page.':'No new fields filled on this page. Open Autofill results to review existing answers and manual steps.';
}
async function refreshHistory(){
  try{
    const data=await JobMatchApi.request('/drafts');const selected=$('historySelect').value;
    $('historySelect').replaceChildren(new Option(data.drafts.length?'Choose a saved resume':'No saved resumes yet',''));
    for(const item of data.drafts)$('historySelect').add(new Option(`${item.jobTitle} · ${new Date(item.createdAt).toLocaleString()}`,item.id));
    if(Array.from($('historySelect').options).some(x=>x.value===selected))$('historySelect').value=selected;
    controls();
  }catch{$('historySelect').replaceChildren(new Option('History unavailable — reconnect to the updated app',''));}
}
async function downloadDocument(doc){
  if(!doc?.base64)throw Error('No resume document is available yet.');
  const filename=String(doc.filename||'tailored-resume.docx').replace(/[\\/:*?"<>|\x00-\x1f]/g,'-');
  const url=URL.createObjectURL(new Blob([Uint8Array.from(atob(doc.base64),c=>c.charCodeAt(0))],{type:doc.mime}));
  try{
    await chrome.downloads.download({url,filename,saveAs:false});
    $('deliveryState').textContent=`Download started: ${filename}. Find it in Chrome Downloads (Ctrl/Cmd+J).`;
  }finally{setTimeout(()=>URL.revokeObjectURL(url),60000);}
}
async function prepare(tailor,fill){
  status('Connecting to the current application…');
  const tab=await target();steps();step('readStep','active');
  let fast,widgets,resumeProduced=false;
  if(fill){
    fast=await fillBundle({profile:candidate().profile},tab,{textOnly:true,attach:false,quiet:true});
    displayReport(fast);status('Your saved text fields are filled. Completing dropdowns…');
    widgets=fillBundle({profile:candidate().profile},tab,{widgetsOnly:true,attach:false,quiet:true}).catch(error=>({filled:[],uploaded:[],remaining:[error.message],existing:0}));
  }
  try{
    await persist();await JobMatchApi.checkConnection();
    let bundle;
    if(tailor){
      if(!$('original').value.trim())throw Error('Add your base resume once in the Resume tab first.');
      const job=await readJob(tab);step('readStep','done');step('tailorStep','active');status(fill?'Your profile is filled. Tailoring the job-specific resume…':'Tailoring your saved resume…');
      bundle=await JobMatchApi.request('/autofill',{job_description:job.jobDescription,job_url:tab.url,job_title:(tab.title||job.title||'').slice(0,300)});
    }else{
      step('readStep','done');step('tailorStep','active');
      bundle=await JobMatchApi.request('/autofill/saved',{job_url:tab.url});
    }
    step('tailorStep','done');showDraft(bundle,tab);resumeProduced=!!bundle.generatedForJob;await refreshHistory();
    let downloadNote='';
    if(bundle.generatedForJob&&$('autoDownload').checked){try{await downloadDocument(bundle.document);downloadNote=' Your tailored DOCX download has started.';}catch{downloadNote=' Automatic download failed; use Download DOCX on the resume card.';}}
    if(fill){
      const widgetReport=await widgets;
      const files=await fillBundle(bundle,tab,{filesOnly:true,quiet:true});
      const report=combineReports(fast,widgetReport,files);displayReport(report);
      const resumeNote=bundle.generatedForJob?' Your tailored resume is on the card above and in the Resume tab.':bundle.resume?' Your saved base resume is in the Resume tab.':'';
      status(fillSummary(report)+downloadNote+resumeNote+' Review the form and confirm any resume upload before submitting.');
    }else{view('resume');status('Tailored resume ready to review here.'+downloadNote+' Your application has not been filled.');}
  }catch(error){
    if(fill){const done=combineReports(fast,await widgets);displayReport(done);throw Error(`${done.filled.length} saved fields filled. `+(resumeProduced?'Your tailored resume is available on the resume card; the remaining form step failed. ':'The resume step did not finish. ')+error.message);}
    throw error;
  }
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
  doc.filename=draftBundle.document?.filename||doc.filename;
  return {...draftBundle,resume:$('draft').value,document:doc};
}
$('draft').addEventListener('input',()=>{$('draftState').textContent='Edited locally · download to keep changes';controls();});
action('applyDraft',async()=>{if(draftRevision!==revision)throw Error('Your saved information changed. Prepare a fresh resume first.');steps();step('readStep','done');step('tailorStep','done');const report=await fillBundle(await editedBundle(),draftJob);status(fillSummary(report)+' Confirm any selected resume finished uploading and review the form.');});
async function downloadCurrent(){const bundle=await editedBundle();await downloadDocument(bundle.document);}
action('download',downloadCurrent);action('downloadReady',downloadCurrent);
$('reviewReady').onclick=()=>{view('resume');$('draft').focus();};
$('historySelect').onchange=controls;
action('restoreDraft',async()=>{
  if(!$('historySelect').value)throw Error('Choose a saved resume first.');
  const data=await JobMatchApi.request('/drafts/'+encodeURIComponent($('historySelect').value));
  const tab=await refreshTarget();
  showDraft({...data,profile:candidate().profile,draftId:data.id}, {id:tab?.url===data.jobUrl?tab.id:null,url:data.jobUrl,title:data.jobTitle});
  view('resume');status('Saved resume restored. Download it here, or review it before using it on its original job.');
});
$('autoDownload').onchange=()=>chrome.storage.local.set({autoDownload:$('autoDownload').checked});
chrome.storage.local.get('autoDownload').then(data=>{if(data.autoDownload===false)$('autoDownload').checked=false;}).catch(()=>{});
$('resumeFile').onchange=async event=>{
  const file=event.target.files?.[0];if(!file||busy)return;setBusy(true);
  try{const form=new FormData();form.append('file',file);const data=await JobMatchApi.request('/extract-text',form);$('original').value=data.text;resumeName=file.name;invalidDraft();await persist();status('Base resume saved. You will not need to upload it for each job.');}
  catch(error){status(error.message,true);}finally{event.target.value='';setBusy(false);}
};
chrome.tabs.onActivated?.addListener(()=>refreshTarget().catch(()=>{}));
chrome.tabs.onUpdated?.addListener((id,change)=>{if(id===currentTab?.id&&(change.url||change.status==='complete'))refreshTarget().catch(()=>{});});
controls();refreshTarget().catch(()=>{});connect().catch(connectionError);
