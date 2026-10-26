/* Deterministic form filling. No inferred demographic answers or submission. */
async function jobmatchFill(bundle, attachResume, options={}) {
  if(!/(^|\.)greenhouse\.io$/.test(location.hostname)&&location.hostname!=='jobs.lever.co')throw Error('Only Greenhouse and Lever applications are supported.');
  const p=bundle.profile||{}, report={filled:[],uploaded:[],remaining:[],existing:0,attachments:[]};
  const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\bu[. ]s[.]?\b/g,'us').replace(/\([^)]*\)/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
  const visible=el=>!!el&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const scope=el=>el.closest('.field,.application-question,.application-field,.input-wrapper,[data-testid*="upload"],.file-upload,fieldset');
  function labels(el){
    const box=scope(el), question=box?.querySelector('legend,label:not([for]),.application-label,[class*="label"]');
    return [Array.from(el.labels||[]).map(x=>x.textContent).join(' '),el.getAttribute('aria-label'),
      (el.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' '),
      question?.textContent,el.getAttribute('autocomplete'),el.placeholder,el.name,el.id].filter(Boolean);
  }
  const simple=[[/^(first name|given name|given-name)$/,'firstName'],[/^(last name|family name|surname|family-name)$/,'lastName'],
    [/^(full name|name|your name)$/,'fullName'],[/^(email|email address|your email)$/,'email'],[/^(phone|phone number|mobile|mobile phone|telephone|tel)$/,'phone'],
    [/^(linkedin|linkedin profile|linkedin url|linkedin profile url)$/,'linkedin'],[/^(github|github url|github profile|github profile url)$/,'github'],
    [/^(website|personal website|portfolio|portfolio url|website url|url)$/,'website'],[/^(city|current city|address level2)$/,'city'],
    [/^(location|current location|location city|where are you located)$/,'location'],[/^(state|state province|state region|address level1)$/,'state'],
    [/^(zip|zip code|postal code)$/,'postalCode'],[/^(country|country name)$/,'country'],[/^(school|university|school name)$/,'school'],
    [/^(degree|degree level)$/,'degree'],[/^(citizenship|citizenship status|us citizenship status)$/,'citizenship'],
    [/^(race|race ethnicity|please (?:select|indicate) your race)$/,'race'],[/^(ethnicity|hispanic latino ethnicity)$/,'ethnicity']];
  function field(el){
    const candidates=labels(el);
    for(const raw of candidates){const s=norm(raw).replace(/\s+required$/,'');
      if(/^(?:are you|do you|will you|would you).*(?:require|need).*sponsor|^sponsorship(?: required| status)?$/.test(s)&&!s.includes('not require'))return 'sponsorAnswer';
      if(/(?:legally )?authorized to work.*(?:united states|\bus\b)|authorization to work.*(?:united states|\bus\b)/.test(s))return 'authorizedUS';
      if(/citizenship status/.test(s))return 'citizenship';
      if(/^(?:please )?(?:select|identify|indicate|provide).*race/.test(s))return 'race';
      if(/(?:are you|do you have).*(?:us citizen|united states citizen)/.test(s))return 'citizenAnswer';
      if(/(?:are you|do you identify as).*hispanic|^hispanic or latino$/.test(s))return 'ethnicity';
      const match=simple.find(([rx])=>rx.test(s));if(match)return match[1];
      if(/^(?:job application )?(?:first name|last name|email|phone)$/.test(s))return ({'job application first name':'firstName','job application last name':'lastName','job application email':'email','job application phone':'phone'})[s];
      if(/^job application location$/.test(s))return 'location';
      if(/^school(?: \d+)?$/.test(s))return 'school';
      if(/^degree(?: \d+)?$/.test(s))return 'degree';
    }
  }
  const citizen=norm(p.citizenship||p.workAuthorization);
  const isUSCitizen=/\b(?:us citizen|united states citizen)\b/.test(citizen)&&!/\b(?:not|non) (?:a )?(?:us|united states) citizen\b/.test(citizen);
  function yesNo(value){const v=norm(value);if(/^(no|no sponsorship required|no sponsorship needed|not required|does not require sponsorship)$/.test(v))return 'No';if(/^(yes|sponsorship required|requires sponsorship|will require sponsorship)$/.test(v))return 'Yes';return '';}
  function value(key){
    if(key==='fullName')return [p.firstName,p.lastName].filter(Boolean).join(' ');
    if(key==='location')return [p.city,p.state,p.country].filter(Boolean).join(', ');
    if(key==='sponsorAnswer')return yesNo(p.sponsorship);
    if(key==='citizenAnswer')return isUSCitizen?'Yes':yesNo(p.citizenship);
    if(key==='citizenship')return p.citizenship||(isUSCitizen?'U.S. Citizen':'');
    if(key==='authorizedUS'&&/not authorized.*work.*(?:united states|\bus\b)/.test(norm(p.workAuthorization)))return 'No';
    if(key==='authorizedUS')return isUSCitizen||/authorized.*work.*(?:united states|\bus\b)/.test(norm(p.workAuthorization))?'Yes':yesNo(p.workAuthorization);
    return p[key]||'';
  }
  function aliases(key,wanted){
    const v=norm(wanted), result=new Set([v]);
    if(key==='country'&&['us','usa','united states','united states of america'].includes(v))for(const x of ['us','usa','united states','united states of america'])result.add(x);
    if(key==='state'&&['fl','florida'].includes(v))for(const x of ['fl','florida'])result.add(x);
    if(key==='degree'&&/^(b s|bs|b sc|bsc|bachelor)/.test(v))for(const x of ['bachelor s degree','bachelors degree','bachelor','bachelor of science','b s','bs'])result.add(x);
    if(key==='citizenship'&&isUSCitizen)for(const x of ['us citizen','united states citizen','us citizen or national'])result.add(x);
    if(['race','ethnicity'].includes(key)&&/^(prefer not|decline|i (?:do not|don t|choose not))/.test(v))for(const x of ['decline to self identify','decline to state','prefer not to answer','i do not wish to answer','i don t wish to answer','i don t wish to self identify','i do not wish to self identify','i do not wish to provide this information'])result.add(x);
    if(key==='ethnicity'&&['no','not hispanic or latino','not hispanic or latina or latino','non hispanic'].includes(v))for(const x of ['no','not hispanic or latino','not hispanic or latino spain'])result.add(x);
    if(key==='ethnicity'&&['yes','hispanic or latino','hispanic latino'].includes(v))for(const x of ['yes','hispanic or latino'])result.add(x);
    return result;
  }
  function matches(key,wanted,text){
    const actual=norm(text);
    if(key==='race'&&/not hispanic|non hispanic/i.test(text)&&!/not hispanic|non hispanic/i.test(wanted)&&!['no','not hispanic or latino','non hispanic'].includes(norm(p.ethnicity)))return false;
    if(aliases(key,wanted).has(actual))return true;
    if(key==='country'&&norm(wanted)==='united states'&&/^united states (?:1|plus 1)$/.test(actual))return true;
    if(key==='location'){
      const city=norm(p.city),state=norm(p.state);if(!city)return false;
      const stateAliases=aliases('state',state);
      return actual.includes(city)&&(!state||Array.from(stateAliases).some(x=>new RegExp('(?:^| )'+x+'(?: |$)').test(actual)));
    }
    return false;
  }
  function setText(el,text){const prototype=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,text);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
  const widgets=[];
  for(const el of document.querySelectorAll('input,textarea,select')){
    if(el.disabled||el.readOnly)continue;
    const type=(el.type||'').toLowerCase(),box=scope(el),ls=labels(el);
    const label=(['radio','checkbox'].includes(type)?box?.querySelector('legend,.application-label')?.textContent.trim():null)||ls[0]||'Unlabelled field';
    const uploadVisible=type==='file'&&(Array.from(el.labels||[]).some(visible)||visible(box));
    const hiddenSelect=el.tagName==='SELECT'&&Array.from(el.labels||[]).some(visible);
    if(!visible(el)&&!uploadVisible&&!hiddenSelect)continue;
    if(['hidden','submit','button','reset'].includes(type))continue;
    if(type==='file'){
      if(options.widgetsOnly||options.textOnly)continue;
      const isResume=ls.some(x=>/\b(resume|cv)\b/i.test(x))&&!ls.some(x=>/cover/i.test(x));
      const existingChip=(box||el.parentElement)?.querySelector('[class*="file-name"],[class*="filename"],[data-testid*="file-name"],a[download]');
      if(el.files?.length||existingChip&&/\.(pdf|docx?|txt|rtf)\b/i.test(existingChip.textContent||existingChip.getAttribute('download')||'')){report.existing++;if(isResume&&attachResume)report.remaining.push(`${label}: existing attachment preserved; replace it manually if you want the tailored resume.`);continue;}
      if(!isResume||!attachResume||!bundle.document?.base64) {report.remaining.push(`${label} (upload manually)`);continue;}
      const mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if(el.accept&&!el.accept.toLowerCase().split(',').some(x=>['.docx',mime,'application/*','*/*'].includes(x.trim()))){report.remaining.push(`${label}: DOCX not accepted; download and upload manually.`);continue;}
      const name=String(bundle.document.filename||'resume.docx').split(/[\\/]/).pop();
      try{const transfer=new DataTransfer();transfer.items.add(new File([Uint8Array.from(atob(bundle.document.base64),x=>x.charCodeAt(0))],name,{type:mime}));el.files=transfer.files;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));report.uploaded.push(label);report.attachments.push({label,filename:name,status:'selected'});}catch{report.remaining.push(`${label}: upload manually.`);}
      continue;
    }
    if(options.filesOnly)continue;
    const key=field(el),wanted=key?value(key):'';
    const isWidget=el.tagName==='SELECT'||['radio','checkbox'].includes(type)||el.getAttribute('role')==='combobox'||!!el.getAttribute('aria-autocomplete');
    if(isWidget){if(!options.textOnly)widgets.push({el,key,wanted,label});continue;}
    if(options.widgetsOnly)continue;
    if(el.value?.trim()){report.existing++;continue;}
    if(!wanted||!['text','email','tel','url','search','textarea'].includes(type)){report.remaining.push(label);continue;}
    setText(el,wanted);
    if(el.value===wanted)report.filled.push(label);else report.remaining.push(`${label}: value not retained.`);
  }
  const deadline=Date.now()+5000, processedGroups=new Set();
  const seenWidgets=new Set(widgets.map(item=>item.el));
  function discoverWidgets(){
    if(widgets.length>=40||Date.now()>deadline)return;
    for(const el of document.querySelectorAll('input,select')){
      if(seenWidgets.has(el)||el.disabled||el.readOnly||!visible(el))continue;
      const kind=el.tagName==='SELECT'||['radio','checkbox'].includes(el.type)||el.getAttribute('role')==='combobox'||el.getAttribute('aria-autocomplete');
      if(!kind)continue;
      const key=field(el),wanted=key?value(key):'';if(!wanted)continue;
      seenWidgets.add(el);widgets.push({el,key,wanted,label:labels(el)[0]||'New application field'});
      if(widgets.length>=40)break;
    }
  }

  for(const {el,key,wanted,label} of widgets){
    if(Date.now()>deadline){report.remaining.push(`${label}: finish manually.`);continue;}
    if(!key||!wanted){report.remaining.push(`${label}: no saved answer.`);continue;}
    if(['radio','checkbox'].includes(el.type)){
      const group=Array.from(document.querySelectorAll(`input[type="${el.type}"]`)).filter(x=>el.name?x.name===el.name&&x.form===el.form:scope(x)===scope(el));
      const groupKey=group[0]||el;if(processedGroups.has(groupKey))continue;processedGroups.add(groupKey);
      if(el.type==='checkbox'&&!['race','ethnicity'].includes(key)){report.remaining.push(`${label}: choose manually.`);continue;}
      if(group.some(x=>x.checked)){report.existing++;continue;}
      const choice=group.find(x=>labels(x).some(text=>matches(key,wanted,text))||matches(key,wanted,x.value));
      if(choice){choice.click();await wait(30);discoverWidgets();if(choice.checked)report.filled.push(label);else report.remaining.push(`${label}: selection not retained.`);}else report.remaining.push(`${label}: no matching choice.`);
      continue;
    }
    if(el.tagName==='SELECT'){
      const current=el.selectedOptions?.[0];
      if(el.value&&current&&!current.disabled&&!/^(select|choose|please select)( |$)/.test(norm(current.textContent))){report.existing++;continue;}
      const choices=Array.from(el.options).filter(x=>!x.disabled&&(matches(key,wanted,x.textContent)||matches(key,wanted,x.value)));
      if(choices.length!==1){report.remaining.push(`${label}: choose manually.`);continue;}
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,choices[0].value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));await wait(30);discoverWidgets();
      if(el.value===choices[0].value)report.filled.push(label);else report.remaining.push(`${label}: selection not retained.`);continue;
    }
    const control=el.closest('[class*="control"],.select')||el.parentElement.parentElement;
    const selected=control?.querySelector('[class*="singleValue"],[class*="single-value"],[data-testid="selected-value"]');
    if(selected?.textContent.trim()){report.existing++;continue;}
    if(el.value?.trim()){report.existing++;continue;}
    el.focus();el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));el.click();setText(el,key==='location'?(p.city||wanted):wanted);
    let choice;
    for(const delay of [0,100,200,300]){
      if(delay)await wait(delay);
      const controlled=(el.getAttribute('aria-controls')||el.getAttribute('aria-owns')||'').split(/\s+/).map(id=>document.getElementById(id)).filter(visible);
      const lists=controlled.length?controlled:Array.from(document.querySelectorAll('[role="listbox"]')).filter(visible);
      if(lists.length!==1)continue;
      const choices=Array.from(lists[0].querySelectorAll('[role="option"]')).filter(x=>visible(x)&&x.getAttribute('aria-disabled')!=='true'&&matches(key,wanted,x.textContent));
      if(choices.length===1){choice=choices[0];break;}
    }
    if(!choice){setText(el,'');el.blur();report.remaining.push(`${label}: no matching dropdown choice.`);continue;}
    choice.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));choice.click();await wait(30);discoverWidgets();
    const retained=control?.querySelector('[class*="singleValue"],[class*="single-value"],[data-testid="selected-value"]');
    if(retained&&matches(key,wanted,retained.textContent))report.filled.push(label);
    else report.remaining.push(`${label}: option selected; verify the site kept it.`);
  }
  report.filled=[...new Set(report.filled)];report.remaining=[...new Set(report.remaining)];return report;
}
