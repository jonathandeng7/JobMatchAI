/* Exact recruiting hosts only. Keep backend/candidate.py and URL tests in sync. */
function jobmatchSite(value = location.href) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
  const host = url.hostname;
  const sites = [
    {id:'greenhouse', name:'Greenhouse', matches:/(^|\.)greenhouse\.io$/,
      descriptions:['[data-testid="job-description"]','#content .content']},
    {id:'lever', name:'Lever', matches:/^jobs\.lever\.co$/,
      descriptions:['.job__description','.posting-page .content','.section-wrapper.page-full-width']},
    {id:'ashby', name:'Ashby', matches:/^jobs\.ashbyhq\.com$/,
      descriptions:['.ashby-job-posting-description','[data-testid="job-description"]']},
    {id:'smartrecruiters', name:'SmartRecruiters', matches:/^(jobs|careers)\.smartrecruiters\.com$/,
      descriptions:['[itemprop="description"]','.job-description','#job-description','.job-sections']},
    {id:'workday', name:'Workday', matches:/(^|\.)(myworkdayjobs|myworkdaysite)\.com$/,
      descriptions:['[data-automation-id="jobPostingDescription"]'],
      hint:'Workday preview · fills the visible step. Advance steps yourself, then click Fill saved information without AI again. Accounts and work-history widgets stay manual.'}
  ];
  const site = sites.find(item => item.matches.test(host));
  return site ? {id:site.id, name:site.name, descriptions:site.descriptions,
    hint:site.hint || `${site.name} connected · fills visible fields. Review custom questions and the completed upload.`} : null;
}
