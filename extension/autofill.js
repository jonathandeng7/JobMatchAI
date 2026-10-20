const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search), targetTab = Number(params.get('tab'));
let documentData;
function status(text, error=false) {$('status').textContent=text;$('status').classList.toggle('error',error);}
function step(id, state) {$(id).className='step '+state;}
$('back').onclick = () => chrome.tabs.update(targetTab,{active:true}).catch(()=>status('The application tab was closed. Reopen it and run Autofill again.',true));
$('download').onclick = () => {
  if (!documentData) return;
  const bytes=Uint8Array.from(atob(documentData.base64),c=>c.charCodeAt(0));
  const url=URL.createObjectURL(new Blob([bytes],{type:documentData.mime}));
  const a=document.createElement('a');a.href=url;a.download=documentData.filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};
async function run() {
  if (!Number.isInteger(targetTab) || targetTab <= 0) throw Error('Open this page by clicking Autofill in the extension on a job application.');
  await chrome.scripting.executeScript({target:{tabId:targetTab},files:['job.js']});
  const contextResult=await chrome.scripting.executeScript({target:{tabId:targetTab},func:()=>jobmatchJobContext()});
  const job=contextResult[0]?.result;
  if (!job?.jobDescription) throw Error('Could not read this job. Select its description or open the full posting, then retry.');
  $('jobTitle').textContent=job.title;
  step('readStep','done');step('tailorStep','active');status('Tailoring your saved base resume to this job…');
  await JobMatchApi.checkConnection();
  const bundle=await JobMatchApi.request('/autofill',{job_description:job.jobDescription,job_url:job.url});
  documentData=bundle.document;
  $('resume').value=bundle.resume;
  $('changes').textContent=bundle.changes.map(c=>`ORIGINAL\n${c.original}\nREVISED\n${c.revised}\nWHY\n${c.reason}`).join('\n\n')+
    (bundle.questions.length?'\n\nTO CHECK\n'+bundle.questions.join('\n'):'');
  $('results').hidden=false;
  step('tailorStep','done');step('fillStep','active');status('Resume tailored. Filling your empty application fields…');
  await chrome.scripting.executeScript({target:{tabId:targetTab},files:['fill.js']});
  const results=await chrome.scripting.executeScript({target:{tabId:targetTab},func:(data,attach,expectedUrl)=>{
    if(location.href!==expectedUrl)throw Error('The job page changed while tailoring. Run Autofill again on the current job.');
    return jobmatchFill(data,attach);
  },args:[bundle,params.get('attach')==='true',job.url]});
  const report=results[0]?.result;
  if(!report)throw Error('The job page could not be filled. Your tailored resume is available below.');
  $('report').textContent=`${report.filled.length} fields filled\n${report.uploaded.length} resume(s) attached\n${report.existing} existing answers preserved\n\nNEEDS YOUR ATTENTION\n${report.remaining.join('\n')||'Review the complete application before submitting.'}`;
  step('fillStep','done');$('heading').textContent='Your next move is ready.';
  status('Autofill complete. Review the resume and application, then submit on the job site.');
  // Return focus to the filled form. This tab stays available for the resume and report.
  await chrome.tabs.update(targetTab,{active:true});
}
run().catch(error=>{
  $('heading').textContent='Let’s check one thing.';
  status(error.message||'Could not complete autofill. Keep the local app and job page open, then retry.',true);
});
