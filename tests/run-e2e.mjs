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
  check('Request context uses clear Client Request Context terminology',/Client Request Context/i.test(guideText)&&! /Language & work context/i.test(guideText));
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
    await page.locator('#a').fill(scope);
    await page.locator('#r').fill(message);
    await page.locator('#analyzeBtn').click();
    await page.waitForFunction(()=>Array.isArray(window.rows)&&window.rows.length>0&&document.getElementById('out')?.innerText.length>0);
    return page.evaluate(()=>({
      rows:(window.rows||[]).map(x=>({request:x.q,status:x.c?.status,type:x.c?.type})),
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
  await addRecord({type:'baseline',title:'Original signed SOW',detail:scope,source:'agreement'});
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
  check('Analysis visibly explains ledger provenance and unverified claims',/user-recorded/i.test(alpha.output)&&/client assertions/i.test(alpha.output));

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
