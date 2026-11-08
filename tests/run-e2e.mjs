import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=http.createServer((req,res)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname)}catch{res.writeHead(400).end('Bad request');return}
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end('Forbidden');return}
  fs.stat(file,(err,st)=>{
    if(err||!st.isFile()){res.writeHead(404).end('Not found');return}
    res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
    fs.createReadStream(file).pipe(res);
  });
});

const checks=[];
function check(name,ok,detail=''){checks.push({name,result:ok?'PASS':'FAIL',detail});if(!ok)console.error('FAIL:',name,detail)}
let browser;
try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4174,'127.0.0.1',resolve)});
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext();
  await context.addInitScript(()=>{
    // Deterministic local test identity only. No real account or Supabase session is used.
    let current='e2e-account-a';
    Object.defineProperty(window,'__bfUserId',{configurable:true,enumerable:true,get(){return current},set(value){if(value)current=String(value)}});
    window.confirm=()=>true;
    document.addEventListener('DOMContentLoaded',()=>document.body.classList.remove('bf-auth-checking'),{once:true});
    try{if(sessionStorage.getItem('__bf_e2e_seed')!=='1'){localStorage.clear();sessionStorage.setItem('__bf_e2e_seed','1')}}catch(e){}
  });
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1'||url.hostname==='localhost')return route.continue();
    // Keep the security-widget UI deterministic without contacting Cloudflare
    // or minting a real verification token. Authentication/cloud writes remain disabled.
    if(url.hostname==='challenges.cloudflare.com')return route.fulfill({
      status:200,
      contentType:'text/javascript',
      body:"window.turnstile={render:function(el,opts){el.innerHTML='<span class=\\\"bf-test-verification\\\">Security verification simulated for automated testing</span>';if(opts&&opts.callback)opts.callback('e2e-turnstile-token');return 1;},reset:function(){}};"
    });
    if(url.hostname==='unpkg.com')return route.fulfill({status:200,contentType:'text/javascript',body:'/* Supabase deliberately stubbed in local end-to-end test. */'});
    return route.abort();
  });
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.stack||e.message));
  const response=await page.goto('http://127.0.0.1:4174/index.html',{waitUntil:'domcontentloaded'});
  if(!response?.ok())throw new Error('Candidate application did not load.');
  // Enter the authenticated workspace presentation with a synthetic test identity; no real sign-in or cloud client is used.
  await page.evaluate(()=>{document.body.classList.remove('bf-auth-checking');document.body.classList.add('bf-authenticated')});
  await page.locator('#analyzeBtn').waitFor({state:'visible',timeout:10000});
  await page.waitForFunction(()=>typeof window.analyze==='function'&&typeof window.bfLedgerAdd==='function');
  check('Candidate application loads with analysis and ledger controls',true);

  await page.locator('#guideBtn').click();
  const guideText=await page.locator('#userGuide').innerText();
  const guideSteps=await page.locator('#userGuide .guide-step').count();
  check('User guide opens and presents the complete 12-step visual walkthrough',guideSteps===12&&/Project Evidence & Change Ledger/i.test(guideText)&&/Additional information/i.test(guideText)&&/History/i.test(guideText),`steps=${guideSteps}`);
  check('User guide explains ledger purpose, local-only storage and export limitations',/running record/i.test(guideText)&&/not cloud-synced/i.test(guideText)&&/Export ledger/i.test(guideText));
  check('User Guide explains request-language analysis is internal and not client-facing',/in the background/i.test(guideText)&&/deliberately not displayed/i.test(guideText)&&!/Client Request Context/i.test(guideText));
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  await page.screenshot({path:path.join(root,'test-results','boundaryflow-user-guide-desktop.png'),fullPage:true,animations:'disabled'});
  await page.locator('#closeGuide').click();

  async function select(id,value){await page.locator('#'+id).selectOption(value)}
  async function addRecord({type,title,detail,source='email',status='not_specified',related=''}) {
    await select('bfLedgerType',type);
    await page.locator('#bfLedgerTitle').fill(title);
    await page.locator('#bfLedgerDetail').fill(detail);
    await select('bfLedgerSource',source);
    await select('bfLedgerStatusValue',status);
    await page.locator('#bfLedgerRelated').fill(related);
    await page.locator('#bfLedgerAdd').click();
    const message=await page.locator('#bfLedgerStatus').innerText();
    if(!message.includes('Record added'))throw new Error('Ledger entry was not added: '+message);
  }
  async function setProject(name){
    await page.locator('#projectName').fill(name);
    await page.locator('#projectName').dispatchEvent('change');
  }
  async function analyse(scope,message){
    const previousOutput=await page.locator('#out').innerText();
    await page.locator('#a').fill(scope);
    await page.locator('#r').fill(message);
    await page.locator('#analyzeBtn').click();
    await page.waitForFunction(previous=>{const current=document.getElementById('out')?.innerText||'';return Array.isArray(window.rows)&&window.rows.length>0&&current.length>0&&current!==previous;},previousOutput,{timeout:20000});
    return page.evaluate(()=>({
      rows:(window.rows||[]).map(x=>({request:x.q,status:x.c?.status,type:x.c?.type,evidence:x.c?.evidence||'',boundary:x.c?.boundary||'',hasInternalLanguageAnalysis:!!x.c?.languageAnalysis})),
      meta:window.bfLedgerAnalysisMeta?{
        projectName:window.bfLedgerAnalysisMeta.projectName,
        totalEntries:window.bfLedgerAnalysisMeta.totalEntries,
        used:window.bfLedgerAnalysisMeta.used,
        unverifiedClaims:window.bfLedgerAnalysisMeta.unverifiedClaims,
        requestRevisionUsage:window.bfLedgerAnalysisMeta.requestRevisionUsage
      }:null,
      output:document.getElementById('out')?.innerText||''
    }));
  }

  const scope='The website includes Home, About and Services. New pages require separate approval. Two rounds of revisions per page are included.';
  await setProject('E2E Project Alpha');
  await page.locator('#a').fill(scope);
  await page.locator('#bfLedgerPrepareBaseline').click();
  check('Prepare baseline drafts agreement text without saving automatically',await page.locator('#bfLedgerCount').innerText().then(x=>x==='0 records')&&await page.locator('#bfLedgerTitle').inputValue()==='Original agreed scope / baseline'&&await page.locator('#bfLedgerDetail').inputValue()===scope);
  await page.locator('#bfLedgerAdd').click();
  check('Prepared baseline is saved only after explicit Add ledger record action',await page.locator('#bfLedgerCount').innerText().then(x=>x==='1 record'));
  await addRecord({type:'amendment',title:'Careers page approval',detail:'The Careers page is approved and included in the agreed project scope.',source:'amendment',status:'approved',related:'Careers page'});
  await addRecord({type:'evidence',title:'Client says Careers was already approved',detail:'The client says the Careers page was agreed during a call.',source:'client_claim'});
  await addRecord({type:'revision',title:'First revision round completed',detail:'First revision round completed for the Portfolio page.',source:'email',status:'delivered',related:'Portfolio page'});
  check('Baseline, approval, client claim and revision records can be added through the UI',await page.locator('#bfLedgerCount').innerText().then(x=>x==='4 records'));

  const alpha=await analyse(scope,'Create a new Careers page. Update the Portfolio page layout.');
  const careers=alpha.rows.find(x=>/careers/i.test(x.request||''));
  const portfolio=alpha.meta?.requestRevisionUsage?.find(x=>x.page==='portfolio');
  check('Approved amendment is included as supplemental analysis context',alpha.meta?.used?.some(x=>x.title==='Careers page approval')===true);
  check('Client assertion remains excluded from approval evidence',alpha.meta?.unverifiedClaims?.some(x=>x.title==='Client says Careers was already approved')===true&&!alpha.meta?.used?.some(x=>x.title==='Client says Careers was already approved'));
  check('Specific Careers approval remains Conditional pending source verification',careers?.status==='Conditional',JSON.stringify(careers||null));
  check('Portfolio revision usage is matched to the correct page',portfolio?.allowance===2&&portfolio?.completed===1&&portfolio?.remaining===1,JSON.stringify(portfolio||null));
  await setProject('E2E Mixed Message Acceptance');
  const mixedScope='WEBSITE DEVELOPMENT AGREEMENT. The agreed website includes the Home page and About page. The project includes one revision round for the agreed deliverables. Spelling corrections and minor adjustments to existing agreed pages are included, subject to the agreed revision allowance. Any new website page, including a Careers page, is outside the original agreed scope and requires separate written approval before work begins. No additional fees or delivery timelines have been agreed for work outside the original scope.';
  const mixedMessage='Hi,\n\nI have reviewed the website and would like you to make two changes.\n\nFirst, please create a new Careers page where potential employees can learn about available opportunities and submit their applications.\n\nSecond, I noticed a spelling mistake on the existing About page. Please correct it.\n\nI would appreciate it if you could handle both changes as part of the current project.\n\nThanks.';
  const mixed=await analyse(mixedScope,mixedMessage);
  check('Mixed-scope response includes both distinct follow-up actions',/separate written approval/i.test(mixed.output)&&/confirm the remaining revision allowance/i.test(mixed.output),mixed.output);
  check('Mixed-scope response does not invent a fee or delivery deadline',!/(?:[$£€]\\s?\\d|KSh\\s?\\d|within\\s+\\d+\\s+days)/i.test(mixed.output),mixed.output); 
  check('Mixed client message produces exactly two actionable requests',mixed.rows.length===2,JSON.stringify(mixed.rows));
  const careersMixed=mixed.rows.find(x=>/careers page/i.test(x.request||''));
  const spellingMixed=mixed.rows.find(x=>/spelling/i.test(x.request||''));
  check('New Careers page cites the express written-approval exclusion',careersMixed?.status==='Likely additional'&&/separate written approval/i.test(String(careersMixed?.evidence||'')),JSON.stringify(careersMixed||null));
  check('About spelling correction is included subject to the allowance',spellingMixed?.status==='Likely included'&&/subject to the agreed revision allowance/i.test(String(spellingMixed?.boundary||'')),JSON.stringify(spellingMixed||null));
  check('Analysis visibly explains ledger provenance and unverified claims',/user-recorded/i.test(alpha.output)&&/client assertions/i.test(alpha.output));
  check('Professional-language diagnostics remain internal while the visible decision stays factual',alpha.rows.some(x=>x.hasInternalLanguageAnalysis)&&! /Client Request Context|Related professional terms|Action language|Boundary dimensions in this exchange/i.test(alpha.output)&&! /language-context/i.test(await page.locator('#out').innerHTML()));
  const specificity=await page.evaluate(()=>{
    const cases=[
      {name:'Careers page',status:'Conditional',request:'Create a new Careers page',expected:'careers page'},
      {name:'Portfolio page',status:'Clarify',request:'Update the Portfolio page layout after the included revision',expected:'portfolio page'},
      {name:'Contact form',status:'Conditional',request:'Fix the Contact form submit button',expected:'contact form'}
    ];
    return cases.map(x=>{
      const base=window.clarificationPlan({status:x.status},x.request);
      const plan=window.preserveClarificationSubject(base,{status:x.status},x.request);
      return {name:x.name,expected:x.expected,needed:plan.needed||'',question:plan.question||'',why:plan.why||'',title:plan.title||''};
    });
  });
  check('Careers-page clarification names the page in every user-facing clarification field',(()=>{const x=specificity[0];return [x.title,x.needed,x.question,x.why].every(v=>String(v||'').toLowerCase().includes('careers page'))})(),JSON.stringify(specificity[0]));
  check('Portfolio-page clarification names the page in every user-facing clarification field',(()=>{const x=specificity[1];return [x.title,x.needed,x.question,x.why].every(v=>String(v||'').toLowerCase().includes('portfolio page'))})(),JSON.stringify(specificity[1]));
  check('Contact-form clarification names the form in every user-facing clarification field',(()=>{const x=specificity[2];return [x.title,x.needed,x.question,x.why].every(v=>String(v||'').toLowerCase().includes('contact form'))})(),JSON.stringify(specificity[2]));
  check('Revision safeguard detects one round while leaving usage unknown',await page.evaluate(()=>window.bfReasoningV2?.revisions?.allowance===1&&window.bfReasoningV2?.revisions?.completed===null&&window.bfReasoningV2?.revisions?.remaining===null),JSON.stringify(await page.evaluate(()=>window.bfReasoningV2?.revisions||null)));
  await select('responseStyle','professional');
  const professionalDraft=await page.locator('#out').innerText();
  const classificationSnapshot=await page.evaluate(()=>(window.rows||[]).map(x=>({status:x.c?.status,evidence:x.c?.evidence,boundary:x.c?.boundary})));
  await select('responseStyle','warm');
  const warmDraft=await page.locator('#out').innerText();
  await select('responseStyle','firm');
  const firmDraft=await page.locator('#out').innerText();
  const firmIncludedDraft=await page.evaluate(()=>window.styleIndividualResponse('The spelling correction is included, subject to confirming the remaining revision allowance and checking the project revision history.','Likely included'));
  check('Firm included-response preserves the unresolved revision-allowance condition',
    /subject to confirming the remaining revision allowance/i.test(firmIncludedDraft)&&
    /project revision history/i.test(firmIncludedDraft),firmIncludedDraft);
  check('Professional full-scope response keeps the revision allowance caveat visible',
    /subject to confirming the remaining revision allowance/i.test(professionalDraft),professionalDraft);
  const classificationsAfterTone=await page.evaluate(()=>(window.rows||[]).map(x=>({status:x.c?.status,evidence:x.c?.evidence,boundary:x.c?.boundary})));
  check('Professional, Warm and Firm generate distinct client-ready wording',professionalDraft!==warmDraft&&warmDraft!==firmDraft&&professionalDraft!==firmDraft);
  check('Changing response tone does not change classifications or evidence',JSON.stringify(classificationSnapshot)===JSON.stringify(classificationsAfterTone));
  check('Full-scope response does not invent a fee or delivery deadline',!/(?:[$£€]\s?\d|(?:USD|GBP|EUR|KES|KSh)\s?\d|within\s+\d+\s+days|by\s+(?:monday|tuesday|wednesday|thursday|friday))/i.test(professionalDraft));
  const genericSpecificity=await page.evaluate(()=>{
    const request='Please review the current work';
    const base=window.clarificationPlan({status:'Conditional'},request);
    return window.preserveClarificationSubject(base,{status:'Conditional'},request);
  });
  check('Generic request does not acquire an invented deliverable name',! /careers|portfolio|contact form|booking page/i.test([genericSpecificity.title,genericSpecificity.needed,genericSpecificity.question,genericSpecificity.why].join(' ')));


  // Capture the real candidate UI for human visual review; test identities and cloud remain simulated.
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  await page.screenshot({path:path.join(root,'test-results','boundaryflow-candidate-desktop.png'),fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(root,'test-results','boundaryflow-candidate-mobile.png'),fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:1440,height:1000});

  const saveButton=page.locator('[data-save]').first();
  await saveButton.waitFor({state:'visible',timeout:10000});
  await saveButton.click();
  check('Analysis can be manually saved to History',await page.locator('#status').innerText().then(x=>/analysis saved|already saved/i.test(x)));
  await page.locator('#historyBtn').click();
  check('Saved analysis appears in History',await page.locator('#historyList .history-item').count().then(n=>n>=1));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{document.body.classList.remove('bf-auth-checking');document.body.classList.add('bf-authenticated')});
  await page.locator('#analyzeBtn').waitFor({state:'visible'});
  // The local-only harness does not restore an authenticated session from Supabase.
  // Re-select the project as a real signed-in user would when opening a project.
  await setProject('E2E Project Alpha');
  const reloadedLedgerCount=await page.locator('#bfLedgerCount').innerText();
  await page.locator('#historyBtn').click();
  const reloadedHistoryCount=await page.locator('#historyList .history-item').count();
  check('Project ledger survives reload when the project is reopened',reloadedLedgerCount==='4 records',reloadedLedgerCount);
  check('Saved History survives a browser reload',reloadedHistoryCount>=1,String(reloadedHistoryCount));
  await page.locator('#closeHistory').click();

  await setProject('E2E Project Beta');
  check('Switching projects isolates the ledger',await page.locator('#bfLedgerCount').innerText().then(x=>x==='0 records'));
  await addRecord({type:'baseline',title:'Beta original SOW',detail:scope,source:'agreement'});
  await addRecord({type:'evidence',title:'Beta client approval assertion',detail:'The client says the Careers page was approved.',source:'client_claim'});
  const beta=await analyse(scope,'Create a new Careers page.');
  const betaCareers=beta.rows.find(x=>/careers/i.test(x.request||''));
  check('Client claim alone cannot approve a new page',betaCareers?.status==='Likely additional',JSON.stringify(betaCareers||null));
  check('Beta analysis does not inherit Alpha approval or revisions',beta.meta?.used?.every(x=>x.title!=='Careers page approval')&&beta.meta?.requestRevisionUsage?.every(x=>x.completed===null),JSON.stringify(beta.meta||null));

  await setProject('E2E Project Alpha');
  check('Returning to Alpha restores only Alpha ledger entries',await page.locator('#bfLedgerCount').innerText().then(x=>x==='4 records'));
  await page.evaluate(()=>{window.__bfUserId='e2e-account-b';document.getElementById('projectName').dispatchEvent(new Event('input',{bubbles:true}))});
  check('Switching account identity isolates the same project name',await page.locator('#bfLedgerCount').innerText().then(x=>x==='0 records'));
  await page.evaluate(()=>{window.__bfUserId='e2e-account-a';document.getElementById('projectName').dispatchEvent(new Event('input',{bubbles:true}))});
  check('Returning to the original account restores its ledger',await page.locator('#bfLedgerCount').innerText().then(x=>x==='4 records'));

  check('No uncaught browser JavaScript errors occurred',pageErrors.length===0,pageErrors.join('\n'));
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  const report={generatedAt:new Date().toISOString(),mode:'local browser end-to-end; deterministic simulated user IDs; Supabase network and cloud writes disabled',total:checks.length,passed:checks.filter(x=>x.result==='PASS').length,failed:checks.filter(x=>x.result==='FAIL').length,checks};
  fs.writeFileSync(path.join(root,'test-results','end-to-end-results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  if(report.failed)process.exitCode=1;
}catch(error){
  console.error(error);
  process.exitCode=1;
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
