/* Browser fixtures use synthetic data and mocked model/Chrome APIs. No live applications. */
const {chromium} = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

(async () => {
  const repo = path.resolve(__dirname, '..');
  const extension = path.join(repo, 'extension');
  const app = process.env.APP_URL || 'http://127.0.0.1:8001';
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jobmatch-browser-'));
  const ctx = await chromium.launchPersistentContext(path.join(temp, 'chrome'), {
    executablePath: process.env.CHROMIUM_PATH || '/usr/lib/chromium/chromium', headless: true,
    args: ['--no-sandbox'], acceptDownloads: true, viewport: {width:1360,height:1050}
  });
  let saved = {profile:{},resume:'',resumeName:'My resume'};
  const initial = {profile:{firstName:'Alex',lastName:'Sample',email:'alex@example.test',phone:'555-0100',
    github:'https://github.com/example',linkedin:'https://www.linkedin.com/in/example',sponsorship:'No sponsorship required'},
    resume:'Alex Sample\nBuilt Python APIs and reliable services.',resumeName:'resume.txt'};
  let bundle, aiConfigured=true, aiProvider='openai';
  try {
    await ctx.route('**/candidate', async route => {
      const method = route.request().method();
      if (method === 'PUT') { saved = route.request().postDataJSON(); return route.fulfill({json:{saved:true,ready:!!saved.resume}}); }
      if (method === 'DELETE') {saved={profile:{},resume:'',resumeName:'My resume'};return route.fulfill({json:{deleted:true}});}
      return route.fulfill({json:{...saved,ready:!!saved.resume,aiConfigured,aiProvider,aiSetupMessage:aiProvider==='codex'?(aiConfigured?'Codex is signed in with ChatGPT. Tailoring uses your Codex plan limits.':'Run codex login and sign in with ChatGPT.'):undefined}});
    });
    await ctx.route('**/ai/provider',route=>{aiProvider=route.request().postDataJSON().provider;return route.fulfill({json:{aiProvider,aiConfigured}});});
    const page = await ctx.newPage();
    // Existing browser-only profiles migrate automatically, without a repeat upload.
    await page.addInitScript(data => {
      if (!localStorage.getItem('migration-seeded')) {
        localStorage.setItem('jobmatch-apply-v1', JSON.stringify(data));
        localStorage.setItem('migration-seeded','yes');
      }
    }, {...initial,version:1});
    await page.goto(app);
    await page.waitForFunction(()=>document.getElementById('readyText').textContent.includes('Alex'));
    await page.locator('#profileTab').click();
    assert.equal(await page.locator('#original').inputValue(), initial.resume);
    await page.locator('#phone').fill('555-0199');
    await page.waitForFunction(()=>document.getElementById('saveState').textContent==='All changes saved');
    assert.equal(saved.profile.phone,'555-0199');
    // Removing browser storage must not remove the server's saved resume/profile.
    await page.evaluate(()=>{localStorage.clear();localStorage.setItem('migration-seeded','yes');});
    await page.reload();
    await page.waitForFunction(()=>document.getElementById('readyText').textContent.includes('Alex'));
    await page.locator('#profileTab').click();
    assert.equal(await page.locator('#original').inputValue(),initial.resume);
    assert.equal(await page.locator('#phone').inputValue(),'555-0199');
    console.log('PASS legacy migration, automatic profile save, and resume restored without browser storage');
    await page.locator('#resumeFile').setInputFiles({name:'updated-resume.txt',mimeType:'text/plain',buffer:Buffer.from('Alex Sample\nBuilt Python APIs. Led testing and backend development.')});
    await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Resume saved.'));
    assert(saved.resume.includes('Led testing'));
    assert.equal(saved.resumeName,'updated-resume.txt');
    console.log('PASS one-time upload automatically saves the base resume');

    const docResponse = await page.request.post(app+'/resume-document',{data:{resume:'Alex Sample\nTailored Python API experience.'}});
    const doc = await docResponse.json();
    bundle = {draftId:'test-draft',jobUrl:'https://job-boards.greenhouse.io/example/jobs/1',profile:saved.profile,resume:'Alex Sample\nTailored Python API experience.',document:doc,generatedForJob:true,
      changes:[{original:'Built Python APIs.',revised:'<img src=x onerror=alert(1)>',reason:'Safe text rendering'}],questions:['Confirm start date']};
    bundle.document.filename='Alex-Sample-Backend-Engineer.docx';
    await ctx.route('**/drafts',r=>r.fulfill({json:{drafts:[{id:'test-draft',jobTitle:'Backend Engineer',jobUrl:bundle.jobUrl,createdAt:'2026-10-26T12:00:00Z'}]}}));
    await ctx.route('**/drafts/test-draft',r=>r.fulfill({json:{...bundle,id:'test-draft',jobTitle:'Backend Engineer',createdAt:'2026-10-26T12:00:00Z'}}));
    let modelCalls=0;
    await ctx.route('**/autofill',route=>{
      const input=route.request().postDataJSON();
      assert(!Object.hasOwn(input,'resume')); assert(input.job_description.length>=80);
      modelCalls++;
      return route.fulfill({json:bundle});
    });
    const job='Software engineer building Python backend APIs and reliable services. Work with a collaborative team to ship tested software. '.repeat(2);
    await page.locator('#applicationTab').click();
    await page.locator('#job').fill(job);
    await page.locator('#tailor').click();
    await page.waitForFunction(()=>!document.getElementById('result').hidden);
    assert.equal(await page.locator('#approved').inputValue(),bundle.resume);
    assert.equal(await page.locator('#changes img').count(),0);
    assert(saved.resume.includes('Led testing'));
    assert(!saved.resume.includes('Tailored'));
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#document').click();
    const download = await downloadEvent; await download.saveAs(path.join(temp,'tailored.docx'));
    assert(fs.statSync(path.join(temp,'tailored.docx')).size>1000);
    assert.equal(modelCalls,1);
    console.log('PASS tailoring saved resume with only job text, safe preview, DOCX download, unchanged base');
    await page.locator('#job').fill(job+'Different job.');
    assert.equal(await page.locator('#result').isVisible(),false);
    await page.screenshot({path:process.env.SCREENSHOT_PATH || path.join(temp,'apply-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    console.log('PASS stale draft invalidation and responsive mobile layout');

    const fixture=`<!doctype html><title>Backend Engineer · Example</title><main><div class="job__description">${job}</div><form>
      <label>First name<input id="first"></label><label>Last name<input id="last"></label>
      <label>Email<input id="email" type="email" value="existing@example.test"></label>
      <div class="application-question"><div class="application-label">GitHub</div><input id="github" name="urls[GitHub]"></div>
      <label>Company phone<input id="company"></label><label>Do you require sponsorship?<input id="sponsor"></label>
      <label>Resume<input id="resume" type="file" accept=".docx" style="display:none"></label><label>Consent<input id="consent" type="checkbox"></label>
      <button type="submit">Submit</button></form></main><script>window.submitted=false;document.querySelector('form').onsubmit=e=>{e.preventDefault();window.submitted=true}</script>`;
    await ctx.route('https://job-boards.greenhouse.io/**',r=>r.fulfill({contentType:'text/html',body:fixture}));
    await ctx.route('https://jobs.lever.co/**',r=>r.fulfill({contentType:'text/html',body:fixture}));
    const form = await ctx.newPage();
    await form.goto('https://job-boards.greenhouse.io/example/jobs/1');
    for(const file of ['sites.js','job.js'])await form.addScriptTag({path:path.join(extension,file)});
    const capture=await form.evaluate(()=>jobmatchJobContext());
    assert(capture.jobDescription.includes('Python'));assert(!capture.jobDescription.includes('Do you require sponsorship'));

    // The real side-panel scripts run against a form fixture with bridged
    // Chrome APIs; actual installation is blocked by managed-browser policy.
    await ctx.route(app+'/__extension/**',route=>{
      const name=new URL(route.request().url()).pathname.split('/').pop();
      if(!['panel.html','panel.js','panel.css','config.js','sites.js'].includes(name))return route.abort();
      return route.fulfill({path:path.join(extension,name),contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
    });
    await ctx.route('**/autofill/saved',route=>route.fulfill({json:{...bundle,profile:saved.profile,resume:saved.resume,changes:[],questions:[],savedResume:true,generatedForJob:false}}));
    const panel=await ctx.newPage();
    await panel.setViewportSize({width:390,height:940});
    await panel.exposeFunction('getActiveJob',async()=>({id:42,url:form.url(),title:await form.title()}));
    await panel.exposeFunction('executeOnJob',async details=>{
      if(details.files){for(const file of details.files)await form.addScriptTag({path:path.join(extension,file)});return[];}
      const result=await form.evaluate(async details=>{const fn=(0,eval)('('+details.source+')');return fn(...(details.args||[]));},details);
      return[{result}];
    });
    await panel.addInitScript(origin=>{
      window.createdTabs=0;window.downloadsStarted=[];
      window.chrome={downloads:{download:async options=>{window.downloadsStarted.push(options);return window.downloadsStarted.length;}},storage:{local:{get:async()=>({appOrigin:origin}),set:async()=>{}}},
        scripting:{executeScript:details=>window.executeOnJob({files:details.files,source:details.func?.toString(),args:details.args})},
        tabs:{query:async()=>[await window.getActiveJob()],create:async()=>{window.createdTabs++;},
          onActivated:{addListener:fn=>{window.activateJob=fn;}},onUpdated:{addListener:()=>{}}}};
    },app);
    await panel.goto(app+'/__extension/panel.html');
    await panel.waitForFunction(()=>!document.getElementById('fill').disabled);
    await panel.getByRole('button',{name:'Autofill with my information →'}).click();
    await panel.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Autofill complete'));
    assert.equal(await form.locator('#first').inputValue(),'Alex');
    assert.equal(await form.locator('#email').inputValue(),'existing@example.test');
    assert.equal(await form.locator('#github').inputValue(),'https://github.com/example');
    assert.equal(await form.locator('#sponsor').inputValue(),'No');assert.equal(await form.locator('#company').inputValue(),'');
    assert.equal(await form.locator('#consent').isChecked(),false);assert.equal(await form.evaluate(()=>window.submitted),false);
    assert.equal(await form.locator('#resume').evaluate(e=>e.files[0].name),'Alex-Sample-Backend-Engineer.docx');
    assert.equal(await panel.evaluate(()=>window.createdTabs),0);
    assert.equal(await panel.locator('#resumeReady').isVisible(),true);
    assert.equal(await panel.locator('#readyFilename').textContent(),'Alex-Sample-Backend-Engineer.docx');
    assert.equal(await panel.evaluate(()=>window.downloadsStarted[0].filename),'Alex-Sample-Backend-Engineer.docx');
    await panel.locator('#reviewReady').click();
    assert.equal(await panel.locator('#draft').inputValue(),bundle.resume);
    assert.equal(await panel.locator('#changes img').count(),0);
    assert(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(process.env.PANEL_SCREENSHOT_PATH)await panel.screenshot({path:process.env.PANEL_SCREENSHOT_PATH,fullPage:true});
    console.log('PASS side-panel capture, tailoring, resume preview, attachment and autofill without opening tabs');

    await form.goto('https://jobs.lever.co/example/job-2');await panel.evaluate(()=>window.activateJob());
    await panel.locator('#applyTab').click();await panel.locator('#attach').uncheck();
    await panel.locator('#tailorOnly').click();
    await panel.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Tailored resume ready'));
    assert.equal(await panel.locator('#resumeView').isVisible(),true);
    assert.equal(await form.locator('#first').inputValue(),'');
    await panel.locator('#draft').fill('Edited reviewed resume');
    await panel.locator('#applyDraft').click();
    await panel.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Autofill complete'));
    assert.equal(await form.locator('#first').inputValue(),'Alex');
    assert.equal(await form.locator('#resume').evaluate(e=>e.files.length),0);
    console.log('PASS tailor-only review/edit followed by autofill from the same panel');

    await panel.locator('#profileTab').click();await panel.locator('#phone').fill('555-0188');
    await panel.waitForFunction(()=>document.getElementById('saveState').textContent==='All changes saved');
    assert.equal(saved.profile.phone,'555-0188');
    await panel.locator('#resumeTab').click();
    await panel.locator('#resumeFile').setInputFiles({name:'panel-resume.txt',mimeType:'text/plain',buffer:Buffer.from('Saved from the extension')});
    await panel.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Base resume saved'));
    assert.equal(saved.resume,'Saved from the extension');
    console.log('PASS profile editing and one-time resume upload/save entirely inside the extension');
    await panel.getByText('Connection settings',{exact:true}).click();
    await panel.locator('#aiProvider').selectOption('codex');
    await panel.locator('#saveProvider').click();
    await panel.waitForFunction(()=>document.getElementById('status').textContent.includes('signed in with ChatGPT'));
    assert.equal(aiProvider,'codex');
    assert.equal(await panel.locator('#tailorOnly').isDisabled(),false);
    console.log('PASS subscription provider selection and ChatGPT readiness display inside the panel');
    await panel.getByText('Connection settings',{exact:true}).click();


    await ctx.unroute('**/autofill');
    await ctx.route('**/autofill',r=>r.fulfill({status:429,json:{detail:'OpenAI quota or rate limit exceeded. You can still fill saved information without AI.'}}));
    await form.goto('https://jobs.lever.co/example/job-3');await panel.evaluate(()=>window.activateJob());
    await panel.locator('#applyTab').click();await panel.locator('#fill').click();
    await panel.waitForFunction(()=>document.getElementById('status').textContent.includes('quota or rate limit'));
    assert.equal(await form.locator('#first').inputValue(),'Alex');
    const callsBeforeBasic=modelCalls;
    await panel.locator('#attach').check();
    await panel.locator('#fillSaved').click();
    await panel.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Autofill complete'));
    assert.equal(await form.locator('#first').inputValue(),'Alex');assert.equal(modelCalls,callsBeforeBasic);
    assert.equal(await form.locator('#resume').evaluate(e=>e.files[0].name),'Alex-Sample-Backend-Engineer.docx');
    console.log('PASS quota failure preserves fast profile fill and saved-information autofill remains available');

    aiConfigured=false;await panel.reload();
    await panel.waitForFunction(()=>!document.getElementById('fill').disabled);
    assert.equal(await panel.locator('#tailorBeforeFill').isChecked(),false);
    assert.equal(await panel.locator('#tailorOnly').isDisabled(),true);
    await form.goto('https://jobs.lever.co/example/job-4');await panel.evaluate(()=>window.activateJob());
    await panel.locator('#fill').click();
    await panel.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Autofill complete'));
    assert.equal(await form.locator('#first').inputValue(),'Alex');
    console.log('PASS primary autofill works without an AI key or job tailoring');

    aiConfigured=true;await panel.reload();await panel.waitForFunction(()=>!document.getElementById('fill').disabled);
    await ctx.unroute('**/autofill');
    let release,started;
    const startedPromise=new Promise(resolve=>started=resolve);
    await ctx.route('**/autofill',async r=>{started();await new Promise(resolve=>release=resolve);await r.fulfill({json:bundle});});
    await panel.locator('#fill').click();await startedPromise;
    assert.equal(await form.locator('#first').inputValue(),'Alex');
    console.log('PASS profile fields fill before the tailoring response arrives');
    await form.goto('https://jobs.lever.co/example/different-job');release();
    await panel.waitForFunction(()=>document.getElementById('status').textContent.includes('job page changed'));
    assert.equal(await form.locator('#first').inputValue(),'');
    console.log('PASS changing jobs while tailoring stops stale autofill');
    await panel.reload();await panel.waitForFunction(()=>!document.getElementById('fill').disabled);
    await panel.locator('#resumeTab').click();await panel.locator('#historyDetails').evaluate(el=>el.open=true);
    await panel.locator('#historySelect').selectOption('test-draft');await panel.locator('#restoreDraft').click();
    await panel.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Saved resume restored'));
    assert.equal(await panel.locator('#draft').inputValue(),bundle.resume);
    assert.equal(await panel.locator('#applyDraft').isDisabled(),true);
    console.log('PASS generated resume can be restored after panel reload without applying to a different job');

    await ctx.unroute('**/autofill');
    await ctx.route('**/autofill',r=>r.fulfill({json:{...bundle,jobUrl:r.request().postDataJSON().job_url}}));
    for(const [url,name]of [['https://jobs.ashbyhq.com/example/job-1','Ashby'],
      ['https://jobs.smartrecruiters.com/Example/123-engineer','SmartRecruiters'],
      ['https://example.wd5.myworkdayjobs.com/en-US/External/job/Engineer_R123/apply','Workday']]){
      await ctx.route(url,r=>r.fulfill({contentType:'text/html',body:fixture}));
      await form.goto(url);await panel.evaluate(()=>window.activateJob());
      await panel.locator('#applyTab').click();
      assert((await panel.locator('#jobSite').textContent()).includes(name));
      if(name==='Workday')assert((await panel.locator('#jobHint').textContent()).includes('visible step'));
      await panel.locator('#fill').click();
      await panel.waitForFunction(()=>!document.getElementById('fill').disabled&&document.getElementById('status').textContent.startsWith('Autofill complete'));
      assert.equal(await form.locator('#first').inputValue(),'Alex');
      assert.equal(await form.locator('#resume').evaluate(el=>el.files[0]?.name),bundle.document.filename);
      assert.equal(await panel.locator('#resumeReady').isVisible(),true);
      assert.equal(await panel.evaluate(()=>window.createdTabs),0);
    }
    console.log('PASS Ashby, SmartRecruiters and Workday panel detection, tailoring, downloads and autofill');
    await panel.locator('#fillSaved').click();
    await panel.waitForFunction(()=>!document.getElementById('fill').disabled&&document.getElementById('status').textContent.startsWith('No new fields filled'));
    assert((await panel.locator('#report').textContent()).includes('existing attachment preserved'));
    console.log('PASS a page with only existing answers is reported without claiming new fields were filled');

    await panel.getByText('Connection settings',{exact:true}).click();
    await panel.locator('#appOrigin').fill('https://external.example');await panel.locator('#saveOrigin').click();
    await panel.waitForFunction(()=>document.getElementById('status').textContent.includes('local app address only'));
    console.log('PASS connection settings reject external addresses');
    await ctx.route('**/health',r=>r.fulfill({status:404,json:{detail:'Not Found'}}));
    await panel.reload();
    await panel.waitForFunction(()=>document.getElementById('connection').textContent==='Wrong or outdated server');
    assert.equal(await panel.locator('#fill').isDisabled(),true);
    console.log('PASS wrong-server error stays actionable inside the panel');
    await ctx.unroute('**/health');await ctx.route('**/health',r=>r.abort());
    await panel.reload();await panel.waitForFunction(()=>document.getElementById('connection').textContent==='Local app offline');
    console.log('PASS offline local-app error is distinct from wrong-server errors');

    const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json')));
    assert.equal(manifest.side_panel.default_path,'panel.html');assert(!manifest.action.default_popup);
    let onClick,opened;
    require('vm').runInNewContext(fs.readFileSync(path.join(extension,'background.js'),'utf8'),{
      chrome:{action:{onClicked:{addListener:fn=>onClick=fn}},sidePanel:{open:async value=>{opened=value;}}},console});
    onClick({windowId:7});assert.equal(opened.windowId,7);
    assert.equal(await panel.evaluate(()=>window.createdTabs),0);
    console.log('PASS toolbar opens the side panel and the workflow never creates an extension tab');
    console.log('NOTE: Chrome APIs were bridged in fixtures. Actual unpacked-extension installation remains a manual check due to managed-browser policy.');
  } catch (error) {console.error(error);process.exitCode=1;}
  finally {await ctx.close();fs.rmSync(temp,{recursive:true,force:true});}
})();
