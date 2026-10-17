const {chromium}=require('playwright');
const fs=require('fs'), assert=require('assert');
(async()=>{
const path=require('path'), os=require('os');
const repo=path.resolve(__dirname,'..');
const extension=path.join(repo,'extension');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'jobmatch-browser-'));
const profilePath=path.join(temp,'profile.json'), bundlePath=path.join(temp,'bundle.json');
fs.writeFileSync(profilePath, JSON.stringify({version:1,profile:{firstName:'Alex',lastName:'Sample',email:'alex@example.test',sponsorship:'No sponsorship required',linkedin:'https://www.linkedin.com/in/example',github:'https://github.com/example'},resume:'Alex Sample\nBuilt Python APIs'}));
const ctx=await chromium.launchPersistentContext(path.join(temp,'chrome'),{executablePath:process.env.CHROMIUM_PATH||'/usr/lib/chromium/chromium',headless:true,args:['--no-sandbox'],acceptDownloads:true});
try{
const page=await ctx.newPage();await page.goto((process.env.APP_URL||'http://127.0.0.1:8001')+'/apply');
await page.locator('#profileFile').setInputFiles(profilePath);
await page.waitForFunction(()=>document.getElementById('firstName').value==='Alex');
assert.equal(await page.locator('#sponsorship').inputValue(),'No sponsorship required');
await page.locator('#save').click();await page.reload();assert.equal(await page.locator('#firstName').inputValue(),'Alex');
await page.locator('#useOriginal').click();await page.locator('#bundle').click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('approve'));
await page.locator('#reviewed').check();
const dlPromise=page.waitForEvent('download');await page.locator('#bundle').click();const dl=await dlPromise;await dl.saveAs(bundlePath);
assert.equal(JSON.parse(fs.readFileSync(bundlePath)).approved,true);
console.log('PASS profile import, persistence, approval gate, DOCX bundle export');
await page.route('**/tailor',route=>route.fulfill({json:{resume:'Reviewed sample',changes:[{original:'Original',revised:'<img src=x onerror=alert(1)>',reason:'Test safe rendering'}],questions:['Confirm dates']}}));
await page.locator('#job').fill('Software engineer');await page.locator('#tailor').click();await page.waitForFunction(()=>document.getElementById('approved').value==='Reviewed sample');assert.equal(await page.locator('#reviewed').isChecked(),false);assert.equal(await page.locator('#changes img').count(),0);console.log('PASS tailoring review reset and safe suggestion rendering');
const fixture=`<form><label>First name<input id="first"></label><label>Last name<input id="last"></label><label>Email<input id="email" type="email" value="existing@example.com"></label><label>LinkedIn URL<input id="linkedin"></label><div class="application-question"><div class="application-label">GitHub</div><input id="github" name="urls[GitHub]"></div><label>Company phone<input id="company"></label><label>Do you require sponsorship?<input id="sponsor"></label><label>Country<select id="country"><option value="">Choose</option><option>United States</option></select></label><label>Resume<input id="resume" type="file" accept=".docx"></label><label>Consent<input id="consent" type="checkbox"></label><input type="hidden" id="hidden"><button type="submit">Submit</button></form><script>window.submitted=false;document.querySelector('form').onsubmit=e=>{e.preventDefault();window.submitted=true}</script>`;
await ctx.route('https://job-boards.greenhouse.io/jobmatch-test',r=>r.fulfill({contentType:'text/html',body:fixture}));
const form=await ctx.newPage();await form.goto('https://job-boards.greenhouse.io/jobmatch-test');
await form.addScriptTag({path:extension+'/fill.js'});
const bundle=JSON.parse(fs.readFileSync(bundlePath));
const result=await form.evaluate(async b=>jobmatchFill(b,true),bundle);
assert.equal(await form.locator('#first').inputValue(),'Alex');assert.equal(await form.locator('#last').inputValue(),'Sample');assert.equal(await form.locator('#email').inputValue(),'existing@example.com');assert.equal(await form.locator('#github').inputValue(),'https://github.com/example');assert.equal(await form.locator('#company').inputValue(),'');assert.equal(await form.locator('#sponsor').inputValue(),'');assert.equal(await form.locator('#consent').isChecked(),false);assert.equal(await form.evaluate(()=>window.submitted),false);assert.equal(await form.locator('#resume').evaluate(e=>e.files[0].name),'resume.docx');assert(result.remaining.some(s=>s.includes('sponsorship')));console.log('PASS Greenhouse fixture autofill, DOCX attachment, preserved answers, manual eligibility and consent, no submission');
await ctx.route('https://jobs.lever.co/jobmatch-test',r=>r.fulfill({contentType:'text/html',body:fixture}));await form.goto('https://jobs.lever.co/jobmatch-test');await form.addScriptTag({path:extension+'/fill.js'});await form.evaluate(async b=>jobmatchFill(b,false),bundle);assert.equal(await form.locator('#first').inputValue(),'Alex');assert.equal(await form.locator('#resume').evaluate(e=>e.files.length),0);console.log('PASS Lever fixture autofill and opt-in attachment');
console.log('NOTE: unpacked-extension installation must be checked in an unmanaged Chrome browser; managed cloud Chromium blocks extension loading.');
}catch(e){console.error(e);process.exitCode=1}finally{await ctx.close();fs.rmSync(temp,{recursive:true,force:true})}
})();
