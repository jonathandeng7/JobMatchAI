/* Recruiting-site fixtures, not live applications. No accounts or submissions. */
const {chromium}=require('playwright'),path=require('path'),assert=require('assert');

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/lib/chromium/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();
 const extension=path.resolve(__dirname,'../extension');
 const description='Build reliable backend services with Python and Java. Collaborate with product engineers and write automated tests. '.repeat(3);
 const profile={firstName:'Alex',lastName:'Sample',email:'alex@example.test',phone:'555-0100',
   country:'United States',city:'Boca Raton',state:'FL',linkedin:'https://www.linkedin.com/in/example',
   sponsorship:'No sponsorship required',citizenship:'U.S. Citizen',race:'',ethnicity:''};
 const doc={filename:'Alex-Sample-Engineer.docx',base64:Buffer.from('fixture document').toString('base64')};
 const common=`<button type="submit">Submit application</button></form><script>
 window.submitted=false;document.querySelectorAll('form').forEach(form=>form.onsubmit=e=>{e.preventDefault();window.submitted=true;});</script>`;
 const fixtures=[
   {id:'ashby',url:'https://jobs.ashbyhq.com/example/abc/application',html:`
     <div class="ashby-job-posting-description">${description}</div><form>
     <div class="ashby-application-form-field-entry"><div class="ashby-application-form-question-title">Full name *</div><input id="name"></div>
     <div class="ashby-application-form-field-entry"><div class="ashby-application-form-question-title">Email *</div><input id="emailInput" type="email"></div>
     <div class="ashby-application-form-field-entry"><div class="ashby-application-form-question-title">LinkedIn URL</div><input id="linkedin"></div>
     <div class="ashby-application-form-field-entry"><div class="ashby-application-form-question-title">Will you now or in the future require sponsorship?</div><button type="button" aria-pressed="false" id="sponsorYes">Yes</button><button type="button" aria-pressed="false" id="sponsorNo">No</button></div>
     <div role="radiogroup" aria-label="Are you legally authorized to work in the United States?"><div tabindex="0" role="radio" aria-checked="false" id="authYes">Yes</div><div tabindex="0" role="radio" aria-checked="false" id="authNo">No</div></div>
     <div class="ashby-application-form-field-entry"><div class="ashby-application-form-question-title">Resume</div><input type="file" id="resume" accept=".pdf,.docx" hidden></div>
     <div class="ashby-application-form-field-entry"><div class="ashby-application-form-question-title">Why are you interested?</div><textarea id="custom"></textarea></div>
     <label>Consent<input type="checkbox" id="consent"></label>${common}<script>
       document.querySelectorAll('button[aria-pressed]').forEach(el=>el.onclick=()=>el.setAttribute('aria-pressed','true'));
       document.querySelectorAll('[role=radio]').forEach(el=>el.onclick=()=>el.setAttribute('aria-checked','true'));
     </script>`},
   {id:'smartrecruiters',url:'https://jobs.smartrecruiters.com/Example/123-engineer',html:`
     <section itemprop="description">${description}</section><form>
     <div class="form-group"><label for="firstName">First name *</label><input id="firstName"></div>
     <div class="form-group"><label for="lastName">Last name *</label><input id="lastName"></div>
     <div class="form-group"><label for="emailInput">Email *</label><input type="email" id="emailInput"></div>
     <div class="form-group"><label for="phoneInput">Phone number *</label><input type="tel" id="phoneInput"></div>
     <div class="form-group"><label for="countryInput">Country</label><select id="countryInput"><option value="">Select one</option><option>United States</option></select></div>
     <div class="form-group"><label for="resume">Resume</label><input type="file" id="resume" accept=".docx" hidden></div>
     <label>Privacy consent<input id="consent" type="checkbox"></label><label>Message to hiring team<textarea id="custom"></textarea></label>${common}`}
 ];
 async function load(url,html){
   await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Example Engineer</title><main>'+html+'</main>'}));
   await page.goto(url);
   for(const file of ['sites.js','job.js','fill.js'])await page.addScriptTag({path:path.join(extension,file)});
 }
 try{
   for(const fixture of fixtures){
     await load(fixture.url,fixture.html);
     const job=await page.evaluate(()=>jobmatchJobContext());
     assert.equal(job.site,fixture.id);assert.equal(job.jobDescription,description.trim());assert(!job.jobDescription.includes('Consent'));
     const report=await page.evaluate(({profile,doc})=>jobmatchFill({profile,document:doc},true),{profile,doc});
     assert.equal(await page.locator('#emailInput').inputValue(),profile.email);
     if(fixture.id==='ashby'){
       assert.equal(await page.locator('#name').inputValue(),'Alex Sample');
       assert.equal(await page.locator('#linkedin').inputValue(),profile.linkedin);
       assert.equal(await page.locator('#sponsorNo').getAttribute('aria-pressed'),'true');
       assert.equal(await page.locator('#authYes').getAttribute('aria-checked'),'true');
     }else{
       assert.equal(await page.locator('#firstName').inputValue(),'Alex');
       assert.equal(await page.locator('#lastName').inputValue(),'Sample');
       assert.equal(await page.locator('#phoneInput').inputValue(),profile.phone);
       assert.equal(await page.locator('#countryInput').inputValue(),'United States');
     }
     assert.equal(await page.locator('#resume').evaluate(el=>el.files[0]?.name),doc.filename);
     assert.equal(await page.locator('#consent').isChecked(),false);assert.equal(await page.locator('#custom').inputValue(),'');
     assert(!await page.evaluate(()=>window.submitted));assert(report.remaining.length);
     await page.locator('#emailInput').fill('keep@example.test');
     await page.evaluate(profile=>jobmatchFill({profile},false),profile);
     assert.equal(await page.locator('#emailInput').inputValue(),'keep@example.test');
     console.log(`PASS ${fixture.id} description, labels, contact fields, choice controls, hidden upload, preserved answers and manual custom/consent`);
   }
   const workday='https://example.wd5.myworkdayjobs.com/en-US/External/job/Engineer_R123/apply';
   const workdayHtml=`<div data-automation-id="jobPostingDescription">${description}</div><form>
     <div data-automation-id="formField-legalNameSection_firstName"><label data-automation-id="formLabel">First Name *</label><input data-automation-id="firstName" id="wdFirst"></div>
     <div data-automation-id="formField-legalNameSection_lastName"><label data-automation-id="formLabel">Last Name *</label><input data-automation-id="lastName" id="wdLast"></div>
     <div data-automation-id="formField-email"><label>Email address</label><input data-automation-id="email" type="email" id="emailInput"></div>
     <div data-automation-id="formField-country"><label id="countryLabel">Country / Region</label><button type="button" id="wdCountry" aria-labelledby="countryLabel" aria-haspopup="listbox" aria-controls="countryMenu">Select One</button><div role="listbox" id="countryMenu" hidden><div role="option" data-automation-id="promptOption">United States</div><div role="option" data-automation-id="promptOption">Canada</div></div></div>
     <div data-automation-id="formField-address"><label>Town / City</label><input id="city"></div>
     <div data-automation-id="formField-phone"><label>Phone Number</label><input data-automation-id="phoneNumber" type="tel" id="phoneInput"></div>
     <div data-automation-id="formField-resume"><label data-automation-id="formLabel">Resume/CV</label><input data-automation-id="file-upload-input-ref" type="file" id="resume" accept=".docx,.pdf" hidden></div>
     <div data-automation-id="formField-experience"><label>Current employer</label><input id="employer"></div>
     <div data-automation-id="workExperienceSection"><label>City<input id="employerCity"></label></div>
     <label>Consent<input id="consent" type="checkbox"></label><button type="submit">Save and Continue</button></form>
     <script>window.submitted=false;document.querySelector('form').onsubmit=e=>{e.preventDefault();window.submitted=true;};
     const button=document.getElementById('wdCountry'),menu=document.getElementById('countryMenu');button.onclick=()=>{menu.hidden=!menu.hidden;};
     menu.querySelectorAll('[role=option]').forEach(option=>option.onclick=()=>{button.textContent=option.textContent;menu.hidden=true;});</script>`;
   await load(workday,workdayHtml);
   const job=await page.evaluate(()=>jobmatchJobContext());assert.equal(job.site,'workday');assert.equal(job.jobDescription,description.trim());
   const report=await page.evaluate(({profile,doc})=>jobmatchFill({profile,document:doc},true),{profile,doc});
   assert.equal(await page.locator('#wdFirst').inputValue(),'Alex');assert.equal(await page.locator('#wdLast').inputValue(),'Sample');
   assert.equal(await page.locator('#emailInput').inputValue(),profile.email);assert.equal(await page.locator('#city').inputValue(),profile.city);
   assert.equal(await page.locator('#phoneInput').inputValue(),profile.phone);assert.equal(await page.locator('#wdCountry').textContent(),'United States');
   assert(report.filled.includes('Country / Region'));assert.equal(await page.locator('#resume').evaluate(el=>el.files[0]?.name),doc.filename);
   assert.equal(await page.locator('#employer').inputValue(),'');assert.equal(await page.locator('#employerCity').inputValue(),'');assert(!await page.locator('#consent').isChecked());assert(!await page.evaluate(()=>window.submitted));
   // An existing button dropdown answer must survive, even when it differs from the profile.
   await page.locator('#wdCountry').evaluate(el=>el.textContent='Canada');
   await page.evaluate(profile=>jobmatchFill({profile},false),profile);assert.equal(await page.locator('#wdCountry').textContent(),'Canada');
   // A later step can be filled explicitly; no Next/Continue/Submit button is clicked.
   await page.evaluate(()=>document.querySelector('form').innerHTML=`<div data-automation-id="formField-auth"><label id="authLabel">Are you legally authorized to work in the United States?</label><button type="button" id="auth" role="combobox" aria-labelledby="authLabel" aria-controls="authMenu">Select One</button><div role="listbox" id="authMenu" hidden><div role="option">Yes</div><div role="option">No</div></div></div>
     <div data-automation-id="formField-sponsor"><label>Do you require sponsorship?</label><select id="sponsor"><option value="">Select</option><option>Yes</option><option>No</option></select></div>
     <label>Race<select id="race"><option value="">Select One</option><option>Asian</option></select></label><button type="submit">Submit</button>`);
   await page.evaluate(()=>{const el=document.getElementById('auth'),menu=document.getElementById('authMenu');el.onclick=()=>menu.hidden=false;menu.querySelectorAll('[role=option]').forEach(option=>option.onclick=()=>{el.textContent=option.textContent;menu.hidden=true;});});
   await page.evaluate(profile=>jobmatchFill({profile},false),profile);
   assert.equal(await page.locator('#auth').textContent(),'Yes');assert.equal(await page.locator('#sponsor').inputValue(),'No');
   assert.equal(await page.locator('#race').inputValue(),'');assert(!await page.evaluate(()=>window.submitted));
   console.log('PASS Workday labeled fields, button comboboxes, retained selections, file upload, and explicit subsequent-step fill without navigation');
   await load('https://wd5.myworkdaysite.com/recruiting/example/external/login',`<form><label>Email<input id="accountEmail" type="email" autocomplete="email"></label><label>Password<input type="password" id="password"></label><button type="submit">Sign in</button></form>`);
   const account=await page.evaluate(profile=>jobmatchFill({profile},false),profile);
   assert.equal(await page.locator('#accountEmail').inputValue(),'');assert.equal(await page.locator('#password').inputValue(),'');assert(account.remaining.some(x=>x.includes('sign-in stays manual')));
   console.log('PASS account forms remain manual');
   const allowed=[['https://boards.greenhouse.io/acme/1','greenhouse'],['https://jobs.lever.co/acme/1','lever'],
     ['https://jobs.ashbyhq.com/acme/id','ashby'],['https://careers.smartrecruiters.com/Acme','smartrecruiters'],
     [workday,'workday'],['https://wd5.myworkdaysite.com/recruiting/acme/external/job/123','workday']];
   for(const [url,id]of allowed)assert.equal(await page.evaluate(url=>jobmatchSite(url)?.id,url),id);
   for(const url of ['http://jobs.ashbyhq.com/acme/id','https://jobs.ashbyhq.com.evil.test/id','https://notmyworkdayjobs.com/job',
     'https://example.myworkdaysite.com.evil.test/job','https://evilsmartrecruiters.com/job','https://name:password@jobs.ashbyhq.com/job',
     'https://jobs.ashbyhq.com:8443/job','https://www.linkedin.com/jobs/view/1'])assert.equal(await page.evaluate(url=>jobmatchSite(url),url),null);
   await load('https://jobs.ashbyhq.com.evil.test/job',fixtures[0].html);
   const denied=await page.evaluate(async profile=>{try{await jobmatchFill({profile},false);return false;}catch{return true;}},profile);
   assert(denied);assert.equal(await page.locator('#emailInput').inputValue(),'');
   console.log('PASS supported hosts and spoofed-host / credential / scheme / port rejection');
 }catch(error){console.error(error);process.exitCode=1;}finally{await browser.close();}
})();
