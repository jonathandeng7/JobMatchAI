/* Synthetic Greenhouse-style controls; no real application is submitted. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/lib/chromium/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();
 const html=`<!doctype html><meta charset="utf-8"><form>
 <label for="first_name">First Name *</label><input id="first_name" autocomplete="given-name">
 <label>Email<input id="email" type="email" value="existing@example.test"></label>
 <label>Are you legally authorized to work in the United States?<select id="auth"><option value="">Select…</option><option>Yes</option><option>No</option></select></label>
 <fieldset><legend>Will you now or in the future require visa sponsorship?</legend><label><input id="sponsorYes" name="sponsor" type="radio" value="Yes">Yes</label><label><input id="sponsorNo" name="sponsor" type="radio" value="No">No</label></fieldset>
 <label>Please indicate your citizenship status<select id="citizen"><option value="">Select…</option><option>U.S. Citizen or National</option><option>Lawful Permanent Resident</option></select></label>
 <label style="display:none">Please select your race *<select id="race"><option value="">Select…</option><option>Asian (Not Hispanic or Latino)</option><option>White</option><option>I don't wish to self-identify</option></select></label>
 <label>Are you Hispanic or Latino?<select id="ethnicity"><option value="">Select…</option><option>Yes</option><option>No</option><option>I don't wish to answer</option></select></label>
 <label>Degree<select id="degree"><option value="">Select…</option><option>Bachelor's Degree</option><option>Master's Degree</option></select></label>
 <label>Country<select id="country"><option value="">Select…</option><option>United States (+1)</option></select></label>
 <div class="field"><label for="location">Current location</label><div class="select__control"><span data-testid="selected-value"></span><input id="location" role="combobox" aria-controls="location-options" aria-expanded="false"><div role="listbox" id="location-options" hidden></div></div></div>
 <div class="field"><label for="school">School</label><div class="select__control"><span data-testid="selected-value"></span><input id="school" role="combobox" aria-controls="school-options" aria-expanded="false"><div role="listbox" id="school-options" hidden></div></div></div>
 <label>Are you legally authorized to work in the United Kingdom?<select id="uk"><option value="">Select…</option><option>Yes</option><option>No</option></select></label>
 <label>Gender<select id="gender"><option value="">Select…</option><option>Male</option></select></label><label>Consent<input id="consent" type="checkbox"></label>
 <div class="field" id="resume_field"><span class="field-label">Resume/CV</span><input id="resume" name="resume" type="file" accept=".docx,.pdf" style="display:none"></div>
 <button type="submit">Submit application</button></form>
 <script>
 document.getElementById('ethnicity').onchange=()=>{document.getElementById('race').parentElement.style.display='';};
 window.submitted=false;document.querySelector('form').onsubmit=e=>{e.preventDefault();window.submitted=true;};
 for(const [id,choices]of [['location',['Austin, Texas, United States','Boca Raton, Florida, United States']],['school',['University of Florida','Florida State University']]]){
 const input=document.getElementById(id),menu=document.getElementById(id+'-options');
 input.oninput=()=>{menu.hidden=false;input.setAttribute('aria-expanded','true');menu.replaceChildren();for(const text of choices){const option=document.createElement('div');option.setAttribute('role','option');option.textContent=text;option.onclick=()=>{input.closest('.select__control').querySelector('span').textContent=text;input.value='';menu.hidden=true;input.setAttribute('aria-expanded','false');};menu.append(option);}};
 }
 </script>`;
 await page.route('https://job-boards.greenhouse.io/**',r=>r.fulfill({contentType:'text/html',body:html}));
 async function reset(){await page.goto('https://job-boards.greenhouse.io/example/jobs/1');for(const file of ['sites.js','fill.js'])await page.addScriptTag({path:path.resolve(__dirname,'../extension',file)});}
 const profile={firstName:'Alex',email:'alex@example.test',city:'Boca Raton',state:'FL',country:'United States',school:'University of Florida',degree:'B.S. in Computer Science',workAuthorization:'U.S. citizen; authorized to work in the United States',sponsorship:'No sponsorship required',race:'Asian',ethnicity:'Not Hispanic or Latino'};
 try{
 await reset();
 await page.evaluate(p=>jobmatchFill({profile:p},false,{textOnly:true}),profile);
 assert.equal(await page.locator('#first_name').inputValue(),'Alex');assert.equal(await page.locator('#auth').inputValue(),'');
 const report=await page.evaluate(p=>jobmatchFill({profile:p},false,{widgetsOnly:true}),profile);
 assert.equal(await page.locator('#auth').inputValue(),'Yes');assert.equal(await page.locator('#sponsorNo').isChecked(),true);
 assert.equal(await page.locator('#citizen').inputValue(),'U.S. Citizen or National');
 assert.equal(await page.locator('#race').inputValue(),'Asian (Not Hispanic or Latino)');assert.equal(await page.locator('#ethnicity').inputValue(),'No');
 assert.equal(await page.locator('#degree').inputValue(),"Bachelor's Degree");assert.equal(await page.locator('#country').inputValue(),'United States (+1)');
 assert.equal(await page.locator('#location').evaluate(el=>el.closest('.select__control').querySelector('span').textContent),'Boca Raton, Florida, United States');
 assert.equal(await page.locator('#school').evaluate(el=>el.closest('.select__control').querySelector('span').textContent),'University of Florida');
 assert.equal(await page.locator('#uk').inputValue(),'');assert.equal(await page.locator('#gender').inputValue(),'');assert.equal(await page.locator('#consent').isChecked(),false);
 assert.equal(await page.locator('#email').inputValue(),'existing@example.test');assert(!await page.evaluate(()=>window.submitted));
 console.log('PASS native fields/selects, sponsorship radio, citizenship, explicit demographics, education and React-style comboboxes');
 const doc={filename:'Alex-Example-Engineer.docx',base64:Buffer.from('test document').toString('base64')};
 await page.evaluate(doc=>jobmatchFill({profile:{},document:doc,generatedForJob:true},true,{filesOnly:true}),doc);
 assert.equal(await page.locator('#resume').evaluate(el=>el.files[0].name),doc.filename);
 const preserved=await page.evaluate(doc=>jobmatchFill({profile:{},document:{...doc,filename:'replacement.docx'},generatedForJob:true},true,{filesOnly:true}),doc);
 assert.equal(await page.locator('#resume').evaluate(el=>el.files[0].name),doc.filename);assert(preserved.remaining.some(x=>x.includes('existing attachment preserved')));
 console.log('PASS hidden Greenhouse upload input, named resume, and explicit existing-file warning');
 await reset();await page.evaluate(p=>jobmatchFill({profile:p},false),{...profile,race:'',ethnicity:''});
 assert.equal(await page.locator('#race').inputValue(),'');assert.equal(await page.locator('#ethnicity').inputValue(),'');
 console.log('PASS race/ethnicity are left unanswered without explicit saved choices');
 await reset();await page.evaluate(p=>jobmatchFill({profile:p},false),{...profile,race:'Asian',ethnicity:''});
 assert.equal(await page.locator('#race').inputValue(),'');
 await reset();await page.evaluate(p=>jobmatchFill({profile:p},false),{...profile,workAuthorization:'Not a U.S. citizen; not authorized to work in the United States'});
 assert.equal(await page.locator('#auth').inputValue(),'No');assert.equal(await page.locator('#citizen').inputValue(),'');
 console.log('PASS demographic qualifiers and negative citizenship/authorization are not inferred away');
 await reset();await page.evaluate(p=>jobmatchFill({profile:p},false),{...profile,race:'Prefer not to answer',ethnicity:'Prefer not to answer'});
 assert.equal(await page.locator('#race').inputValue(),"I don't wish to self-identify");assert.equal(await page.locator('#ethnicity').inputValue(),"I don't wish to answer");
 console.log('PASS explicit decline-to-disclose preferences');
 }catch(error){console.error(error);process.exitCode=1;}finally{await browser.close();}
})();
