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
  let bundle;
  try {
    await ctx.route('**/candidate', async route => {
      const method = route.request().method();
      if (method === 'PUT') { saved = route.request().postDataJSON(); return route.fulfill({json:{saved:true,ready:!!saved.resume}}); }
      if (method === 'DELETE') {saved={profile:{},resume:'',resumeName:'My resume'};return route.fulfill({json:{deleted:true}});}
      return route.fulfill({json:{...saved,ready:!!saved.resume,aiConfigured:true}});
    });
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
    await page.waitForFunction(()=>document.getElementById('resumeName').textContent==='updated-resume.txt');
    assert(saved.resume.includes('Led testing'));
    assert.equal(saved.resumeName,'updated-resume.txt');
    console.log('PASS one-time upload automatically saves the base resume');

    const docResponse = await page.request.post(app+'/resume-document',{data:{resume:'Alex Sample\nTailored Python API experience.'}});
    const doc = await docResponse.json();
    bundle = {profile:saved.profile,resume:'Alex Sample\nTailored Python API experience.',document:doc,generatedForJob:true,
      changes:[{original:'Built Python APIs.',revised:'<img src=x onerror=alert(1)>',reason:'Safe text rendering'}],questions:['Confirm start date']};
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
    await form.addScriptTag({path:path.join(extension,'job.js')});
    const capture=await form.evaluate(()=>jobmatchJobContext());
    assert(capture.jobDescription.includes('Python'));assert(!capture.jobDescription.includes('Do you require sponsorship'));

    // Exercise the actual persistent extension flow, with Chrome APIs bridged to
    // a real fixture tab. Managed Chromium prevents installing unpacked extensions.
    await ctx.route(app+'/__extension/**',route=>{
      const name=new URL(route.request().url()).pathname.split('/').pop();
      const file=path.join(extension,name);
      if(!['autofill.html','autofill.js','popup.html','popup.js','ui.css','config.js'].includes(name))return route.abort();
      return route.fulfill({path:file,contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
    });
    async function progressPage(attach=true) {
      const progress=await ctx.newPage();
      await progress.exposeFunction('executeOnJob',async details=>{
        if(details.files){for(const file of details.files)await form.addScriptTag({path:path.join(extension,file)});return[];}
        const result=await form.evaluate(async details=>{
          const fn=(0,eval)('('+details.source+')');return fn(...(details.args||[]));
        },details);
        return[{result}];
      });
      await progress.addInitScript(origin=>{
        window.chrome={storage:{local:{get:async()=>({appOrigin:origin})}},
          scripting:{executeScript:details=>window.executeOnJob({files:details.files,source:details.func?.toString(),args:details.args})},
          tabs:{update:async()=>{window.returnedToJob=true;}}};
      },app);
      await progress.goto(app+'/__extension/autofill.html?tab=42&attach='+attach);
      return progress;
    }
    const progress=await progressPage();
    await progress.waitForFunction(()=>document.getElementById('heading').textContent==='Your next move is ready.');
    assert.equal(await form.locator('#first').inputValue(),'Alex');
    assert.equal(await form.locator('#email').inputValue(),'existing@example.test');
    assert.equal(await form.locator('#github').inputValue(),'https://github.com/example');
    assert.equal(await form.locator('#sponsor').inputValue(),'');assert.equal(await form.locator('#company').inputValue(),'');
    assert.equal(await form.locator('#consent').isChecked(),false);assert.equal(await form.evaluate(()=>window.submitted),false);
    assert.equal(await form.locator('#resume').evaluate(e=>e.files[0].name),'resume.docx');
    assert.equal(await progress.evaluate(()=>window.returnedToJob),true);
    assert.equal(await progress.locator('#changes img').count(),0);
    console.log('PASS one-click orchestration: capture → tailor saved resume → attach DOCX → autofill → return to job');
    await form.goto('https://jobs.lever.co/example/job-2');
    const lever=await progressPage(false);
    await lever.waitForFunction(()=>document.getElementById('heading').textContent==='Your next move is ready.');
    assert.equal(await form.locator('#first').inputValue(),'Alex');assert.equal(await form.locator('#resume').evaluate(e=>e.files.length),0);
    console.log('PASS Lever autofill, opt-out of attachment, preservation of answers/consent, no submission');

    await ctx.unroute('**/autofill');
    await ctx.route('**/autofill',r=>r.fulfill({status:503,json:{detail:'OpenAI key missing'}}));
    await form.goto('https://jobs.lever.co/example/job-3');
    const failed=await progressPage();
    await failed.waitForFunction(()=>document.getElementById('status').textContent==='OpenAI key missing');
    assert.equal(await form.locator('#first').inputValue(),'');assert.equal(await form.locator('#resume').evaluate(e=>e.files.length),0);
    console.log('PASS model failure leaves form and resume fields untouched');

    await ctx.unroute('**/autofill');
    let release,started;
    const startedPromise=new Promise(resolve=>started=resolve);
    await ctx.route('**/autofill',async r=>{started();await new Promise(resolve=>release=resolve);await r.fulfill({json:bundle});});
    const changed=await progressPage();await startedPromise;
    await form.goto('https://jobs.lever.co/example/different-job');release();
    await changed.waitForFunction(()=>document.getElementById('status').textContent.includes('page changed'));
    assert.equal(await form.locator('#first').inputValue(),'');
    console.log('PASS navigating to another job during tailoring prevents stale autofill');

    const popup=await ctx.newPage();
    await popup.addInitScript(origin=>{
      window.chrome={storage:{local:{get:async()=>({appOrigin:origin}),set:async()=>{}}},
        tabs:{query:async()=>[{id:42,url:'https://jobs.lever.co/example/123'}],create:async data=>{window.createdRun=data.url;}},
        runtime:{getURL:file=>location.origin+'/__extension/'+file}};
      window.close=()=>{};
    },app);
    await popup.goto(app+'/__extension/popup.html');
    await popup.waitForFunction(()=>!document.getElementById('fill').disabled);
    await popup.getByRole('button',{name:/Autofill with my information/}).click();
    const runUrl=await popup.evaluate(()=>window.createdRun);
    assert(runUrl.includes('autofill.html?tab=42&attach=true'));
    console.log('PASS popup button starts a persistent autofill run without file imports');
    await popup.getByText('Connection settings', {exact:true}).click();
    await popup.locator('#appOrigin').fill('https://external.example');
    await popup.locator('#saveOrigin').click();
    await popup.waitForFunction(()=>document.getElementById('status').textContent.includes('local app address only'));
    console.log('PASS extension connection settings reject external app addresses');
    await ctx.route('**/health',r=>r.fulfill({status:404,json:{detail:'Not Found'}}));
    await popup.reload();
    await popup.waitForFunction(()=>document.getElementById('profile').textContent==='Wrong or outdated server at this address');
    assert.equal(await popup.locator('#fill').isDisabled(),true);
    assert((await popup.locator('#status').textContent()).includes('Stop the old server'));
    assert(!(await popup.locator('#profile').textContent()).includes('offline'));
    console.log('PASS reachable server with missing routes is diagnosed as wrong/outdated, with restart instructions');
    await ctx.unroute('**/health');
    await ctx.route('**/health',r=>r.fulfill({contentType:'text/html',body:'Unrelated local website'}));
    await popup.reload();
    await popup.waitForFunction(()=>document.getElementById('profile').textContent==='Wrong or outdated server at this address');
    console.log('PASS unrelated HTML server is identified without a JSON parsing error');
    await ctx.unroute('**/health');
    await ctx.route('**/health',r=>r.fulfill({json:{service:'jobmatch-ai',apiVersion:2,features:{}}}));
    await popup.reload();
    await popup.waitForFunction(()=>document.getElementById('profile').textContent==='Wrong or outdated server at this address');
    console.log('PASS malformed health metadata is diagnosed without a TypeError');
    await ctx.unroute('**/health');
    await ctx.route('**/health',r=>r.abort());
    await popup.reload();
    await popup.waitForFunction(()=>document.getElementById('profile').textContent==='Local workspace offline');
    console.log('PASS unreachable local app is distinguished from a reachable incompatible server');
    console.log('NOTE: Chrome APIs were bridged in fixtures. Actual unpacked-extension installation remains a manual check due to managed-browser policy.');
  } catch (error) {console.error(error);process.exitCode=1;}
  finally {await ctx.close();fs.rmSync(temp,{recursive:true,force:true});}
})();
