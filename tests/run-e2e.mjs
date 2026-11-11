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

  const cloudDeleteContract=await page.evaluate(async()=>{
    const fakeClient=(existing,deletedRows,error=null)=>({
      from(){
        const state={deleting:false};
        return {
          select(){return state.deleting?Promise.resolve({data:deletedRows,error}):this;},
          delete(){state.deleting=true;return this;},
          eq(){return this;},
          maybeSingle(){return Promise.resolve({data:existing?{id:'analysis-1'}:null,error:null});}
        };
      }
    });
    const pending=await window.bfCloudDeleteQueuedRow(fakeClient(true,[]),'account-a','analysis-1');
    const confirmed=await window.bfCloudDeleteQueuedRow(fakeClient(true,[{id:'analysis-1'}]),'account-a','analysis-1');
    const absent=await window.bfCloudDeleteQueuedRow(fakeClient(false,[]),'account-a','analysis-1');
    const failed=await window.bfCloudDeleteQueuedRow(fakeClient(true,null,{message:'simulated delete failure'}),'account-a','analysis-1');
    return {pending,confirmed,absent,failed};
  });
  check('Cloud deletion retry is retained unless Supabase confirms the row was deleted',
    cloudDeleteContract.pending.retry===true&&cloudDeleteContract.pending.deleted===false&&
    cloudDeleteContract.confirmed.deleted===true&&cloudDeleteContract.confirmed.retry===false&&
    cloudDeleteContract.absent.retry===false&&cloudDeleteContract.failed.retry===true,
    JSON.stringify(cloudDeleteContract));

  const ledgerNormalizationContract=await page.evaluate(()=>{
    const reviewed=window.bfLedgerReviewAmendments([
      {id:'baseline-1',type:' BASELINE ',sourceType:' AGREEMENT ',status:' APPROVED ',sourceDate:'2026-01-01'},
      {id:'approval-1',type:' AMENDMENT ',sourceType:' EMAIL ',status:' APPROVED ',sourceDate:'2026-02-01',related:'Careers page'}
    ]);
    const claim=window.bfLedgerReviewAmendments([
      {id:'claim-1',type:' APPROVAL ',sourceType:' CLIENT_CLAIM ',status:' APPROVED ',sourceDate:'2026-02-01',related:'Careers page'}
    ]);
    const incomplete=window.bfLedgerReviewAmendments([
      {id:'approval-2',type:' APPROVAL ',sourceType:' EMAIL ',status:' APPROVED ',related:'Careers page'}
    ]);
    const declined=window.bfLedgerReviewAmendments([
      {id:'declined-1',type:' AMENDMENT ',sourceType:' EMAIL ',status:' DECLINED ',sourceDate:'2026-02-01',related:'Careers page'}
    ]);
    const pending=window.bfLedgerReviewAmendments([
      {id:'pending-1',type:' AMENDMENT ',sourceType:' EMAIL ',status:' AWAITING_APPROVAL ',sourceDate:'2026-02-01',related:'Careers page'}
    ]);
    const unconfirmed=window.bfLedgerReviewAmendments([
      {id:'unconfirmed-1',type:' AMENDMENT ',sourceType:' EMAIL ',status:' NOT_SPECIFIED ',sourceDate:'2026-02-01',related:'Careers page'}
    ]);
    const priorUser=window.__bfUserId;
    const projectInput=document.getElementById('projectName');
    const priorProject=projectInput.value;
    window.__bfUserId='ledger-normalization-test';
    projectInput.value='Normalization Project';
    const key=window.bfLedgerKey();
    const priorLedger=localStorage.getItem(key);
    let context;
    try{
      localStorage.setItem(key,JSON.stringify([
        {id:'base',type:' BASELINE ',sourceType:' AGREEMENT ',status:' APPROVED ',title:'Baseline',detail:'Original scope'},
        {id:'approval',type:' AMENDMENT ',sourceType:' EMAIL ',status:' APPROVED ',title:'Careers page approval',detail:'Careers page approved and included',related:'Careers page',sourceDate:'2026-02-01'}
      ]));
      context=window.bfLedgerAnalysisContext('Original scope');
    }finally{
      if(priorLedger===null)localStorage.removeItem(key);else localStorage.setItem(key,priorLedger);
      window.__bfUserId=priorUser;
      projectInput.value=priorProject;
    }
    return {reviewed:reviewed[0]?.state,claim:claim[0]?.state,incomplete:incomplete[0]?.state,declined:declined[0]?.state,pending:pending[0]?.state,unconfirmed:unconfirmed[0]?.state,
      used:context.used.map(x=>({type:x.type,sourceType:x.sourceType,status:x.status})),reviewType:context.amendmentReview[0]?.type};
  });
  check('Ledger review normalizes case and surrounding whitespace without promoting claims or incomplete records',
    ledgerNormalizationContract.reviewed==='candidate_for_manual_verification'&&
    ledgerNormalizationContract.claim==='claim_only'&&
    ledgerNormalizationContract.incomplete==='metadata_incomplete'&&
    ledgerNormalizationContract.declined==='not_applicable'&&
    ledgerNormalizationContract.pending==='pending_not_applied'&&
    ledgerNormalizationContract.unconfirmed==='status_unconfirmed'&&
    ledgerNormalizationContract.used.some(x=>x.type==='amendment'&&x.sourceType==='email'&&x.status==='approved')&&
    ledgerNormalizationContract.reviewType==='amendment',
    JSON.stringify(ledgerNormalizationContract));

  const hostileStorageContract=await page.evaluate(()=>{
    const user=window.__bfUserId,project=document.getElementById('projectName'),priorProject=project.value;
    window.__bfUserId='hostile-storage-test';
    const identityKey=window.bfScopedKey('boundaryflow_project_ledger_identity_v1');
    const aliasKey=window.bfScopedKey('boundaryflow_project_ledger_alias_v1');
    const oldIdentity=localStorage.getItem(identityKey),oldAlias=localStorage.getItem(aliasKey);
    try{
      localStorage.setItem(identityKey,'{"__proto__":"forged-prototype","constructor":"forged-constructor","toString":"forged-string"}');
      localStorage.setItem(aliasKey,'{"__proto__":"forged-alias","constructor":"forged-constructor-alias","toString":"forged-string-alias"}');
      const identities=window.bfLedgerIdentityMap(),aliases=window.bfLedgerAliasMap();
      const names=['__proto__','constructor','toString'];
      const ids=names.map(name=>window.bfLedgerProjectId(name));
      project.value='__proto__';
      const display=window.bfLedgerDisplayName();
      return {nullPrototype:Object.getPrototypeOf(identities)===null&&Object.getPrototypeOf(aliases)===null,
        ownIdentityValues:names.every(name=>!Object.prototype.hasOwnProperty.call(identities,name)),
        uniqueIds:new Set(ids).size===3&&ids.every(x=>typeof x==='string'&&x.startsWith('bfp-')),
        displayNameNotForged:display==='__proto__',
        historyCounts:['<img src=x onerror=alert(1)>','-1','1e9',null,7].map(x=>window.bfHistoryCount(x))};
    }finally{
      if(oldIdentity===null)localStorage.removeItem(identityKey);else localStorage.setItem(identityKey,oldIdentity);
      if(oldAlias===null)localStorage.removeItem(aliasKey);else localStorage.setItem(aliasKey,oldAlias);
      project.value=priorProject;window.__bfUserId=user;
    }
  });
  check('Prototype-shaped project names cannot inherit forged ledger identities or aliases',
    hostileStorageContract.nullPrototype&&hostileStorageContract.ownIdentityValues&&
    hostileStorageContract.uniqueIds&&hostileStorageContract.displayNameNotForged,
    JSON.stringify(hostileStorageContract));
  check('Untrusted history counters are rendered as bounded plain numeric text',
    JSON.stringify(hostileStorageContract.historyCounts)===JSON.stringify(['0','0','0','0','7']),
    JSON.stringify(hostileStorageContract.historyCounts));

  const cloudIdempotencyContract=await page.evaluate(async()=>{
    const calls=[];
    const fakeClient={from(table){
      calls.push(['from',table]);
      const builder={
        select(columns){calls.push(['select',columns]);return this;},
        eq(column,value){calls.push(['eq',column,value]);return this;},
        order(column,options){calls.push(['order',column,options.ascending]);return this;},
        limit(value){calls.push(['limit',value]);return this;},
        maybeSingle(){return Promise.resolve({data:{id:'existing-cloud-analysis'},error:null});}
      };
      return builder;
    }};
    const found=await window.bfCloudFindExistingAnalysis(fakeClient,'account-a','local-analysis-42');
    return {found,calls};
  });
  check('Cloud save retry looks up the existing row by user-scoped local analysis ID before inserting',
    cloudIdempotencyContract.found?.id==='existing-cloud-analysis'&&
    cloudIdempotencyContract.calls.some(x=>x[0]==='eq'&&x[1]==='user_id'&&x[2]==='account-a')&&
    cloudIdempotencyContract.calls.some(x=>x[0]==='eq'&&x[1]==='result_json->>localId'&&x[2]==='local-analysis-42')&&
    cloudIdempotencyContract.calls.some(x=>x[0]==='limit'&&x[1]===1),
    JSON.stringify(cloudIdempotencyContract));

  const cloudSaveRaceContract=await page.evaluate(()=>{
    const metadata={cloudAnalysisId:'remote-1',cloudProjectId:'project-1',cloudAgreementId:'agreement-1',cloudSyncedAt:'2026-11-08T00:00:00.000Z'};
    const deleted=window.bfCloudMergeSyncMetadata([],'deleted-analysis',metadata);
    const latest=window.bfCloudMergeSyncMetadata([{id:'analysis-1',scope:'newer scope',request:'newer request',name:'Current project'}],'analysis-1',metadata);
    return {deletedFound:deleted.found,deletedHistoryLength:deleted.history.length,
      latestFound:latest.found,scope:latest.item&&latest.item.scope,request:latest.item&&latest.item.request,
      cloudId:latest.item&&latest.item.cloudAnalysisId};
  });
  check('A pending cloud save cannot resurrect a deleted analysis or overwrite newer local edits',
    cloudSaveRaceContract.deletedFound===false&&cloudSaveRaceContract.deletedHistoryLength===0&&
    cloudSaveRaceContract.latestFound===true&&cloudSaveRaceContract.scope==='newer scope'&&
    cloudSaveRaceContract.request==='newer request'&&cloudSaveRaceContract.cloudId==='remote-1',
    JSON.stringify(cloudSaveRaceContract));

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
  async function addRecord({type,title,detail,source='email',status='not_specified',related='',sourceDate=''}) {
    await select('bfLedgerType',type);
    await page.locator('#bfLedgerTitle').fill(title);
    await page.locator('#bfLedgerDetail').fill(detail);
    await select('bfLedgerSource',source);
    await select('bfLedgerStatusValue',status);
    await page.locator('#bfLedgerRelated').fill(related);
    await page.locator('#bfLedgerSourceDate').fill(sourceDate);
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
  await addRecord({type:'amendment',title:'Careers page approval',detail:'The Careers page is approved and included in the agreed project scope.',source:'amendment',status:'approved',related:'Careers page',sourceDate:'2026-02-01'});
  await addRecord({type:'evidence',title:'Client says Careers was already approved',detail:'The client says the Careers page was agreed during a call.',source:'client_claim'});
  await addRecord({type:'revision',title:'First revision round completed',detail:'First revision round completed for the Portfolio page.',source:'email',status:'delivered',related:'Portfolio page',sourceDate:'2026-02-13'});
  check('Baseline, approval, client claim and revision records can be added through the UI',await page.locator('#bfLedgerCount').innerText().then(x=>x==='4 records'));

  const alpha=await analyse(scope,'Create a new Careers page. Update the Portfolio page layout.');
  const careers=alpha.rows.find(x=>/careers/i.test(x.request||''));
  const portfolio=alpha.meta?.requestRevisionUsage?.find(x=>x.page==='portfolio');
  check('Approved amendment is included as supplemental analysis context',alpha.meta?.used?.some(x=>x.title==='Careers page approval')===true);
  check('Client assertion remains excluded from approval evidence',alpha.meta?.unverifiedClaims?.some(x=>x.title==='Client says Careers was already approved')===true&&!alpha.meta?.used?.some(x=>x.title==='Client says Careers was already approved'));
  check('Specific Careers approval with incomplete chronology remains Clarify pending source verification',careers?.status==='Clarify'&&/chronology|review/i.test(String(careers?.type||'')+' '+String(careers?.boundary||'')),JSON.stringify(careers||null));

  await setProject('E2E Missing Approval Identity');
  await addRecord({type:'baseline',title:'Original agreed scope',detail:scope,source:'agreement',status:'approved',related:'All agreed pages'});
  await addRecord({type:'amendment',title:'Careers page approval',detail:'The Careers page is approved and included in the agreed project scope.',source:'amendment',status:'approved',related:'Careers page'});
  await page.evaluate(()=>{
    const key=window.bfLedgerKey();
    const records=JSON.parse(localStorage.getItem(key)||'[]');
    records.forEach(record=>{if(record.type==='amendment')delete record.id;});
    localStorage.setItem(key,JSON.stringify(records));
  });
  const missingApprovalIdentity=await analyse(scope,'Create a new Careers page.');
  const missingIdentityCareers=missingApprovalIdentity.rows.find(x=>/careers/i.test(x.request||''));
  check('An approval record without a stable ID cannot bypass chronology review or become conditional approval',
    missingIdentityCareers?.status==='Clarify'&&/chronology|review/i.test(String(missingIdentityCareers?.type||'')+' '+String(missingIdentityCareers?.boundary||'')),
    JSON.stringify(missingIdentityCareers||null));

  await setProject('E2E Compound Deliverable Approval');
  await addRecord({type:'baseline',title:'Original agreed scope',detail:scope,source:'agreement',status:'approved',related:'All agreed pages'});
  await addRecord({type:'amendment',title:'Careers and Team pages approval',detail:'Careers and Team pages are approved and included in the project scope.',source:'amendment',status:'approved',related:'Careers and Team pages',sourceDate:'2026-02-01'});
  const compoundApproval=await analyse(scope,'Create a new Careers page.');
  const compoundCareers=compoundApproval.rows.find(x=>/careers/i.test(x.request||''));
  check('A compound deliverable label cannot be treated as exact approval for one page',
    compoundCareers?.status==='Clarify'&&/ambiguous|broader|compound|partial/i.test(String(compoundCareers?.type||'')+' '+String(compoundCareers?.boundary||'')),
    JSON.stringify(compoundCareers||null));

  await setProject('E2E Conflicting Page Approvals');
  await addRecord({type:'baseline',title:'Original agreed scope',detail:scope,source:'agreement',status:'approved',related:'All agreed pages'});
  await addRecord({type:'amendment',title:'Careers page approval v1',detail:'The Careers page is approved and included in the project scope.',source:'amendment',status:'approved',related:'Careers page',sourceDate:'2026-02-01'});
  await addRecord({type:'amendment',title:'Careers page approval v2',detail:'The Careers page is approved and included in the project scope with revised requirements.',source:'amendment',status:'approved',related:'Careers page',sourceDate:'2026-02-03'});
  const conflictingPageApprovals=await analyse(scope,'Create a new Careers page.');
  const conflictingCareers=conflictingPageApprovals.rows.find(x=>/careers/i.test(x.request||''));
  check('Multiple active approvals for the same page remain Clarify',
    conflictingCareers?.status==='Clarify'&&/conflicting|multiple/i.test(String(conflictingCareers?.type||'')+' '+String(conflictingCareers?.boundary||'')),
    JSON.stringify(conflictingCareers||null));
  check('Portfolio revision usage is matched to the correct page',portfolio?.allowance===2&&portfolio?.completed===1&&portfolio?.remaining===1,JSON.stringify(portfolio||null));
  const revisionSequenceChecks=await page.evaluate(()=>{
    const agreement='Each page includes up to 3 revision rounds.';
    const missingEarly=window.bfLedgerRevisionUsage({revisionEvents:[
      {status:'delivered',sourceType:'email',sourceDate:'2026-02-06',title:'Third revision round completed for the Portfolio page',detail:'',related:'Portfolio page'}
    ]},'Portfolio page',agreement);
    const contiguous=window.bfLedgerRevisionUsage({revisionEvents:[
      {status:'delivered',sourceType:'email',sourceDate:'2026-02-06',title:'First revision round completed for the Portfolio page',detail:'',related:'Portfolio page'},
      {status:'delivered',sourceType:'email',sourceDate:'2026-02-06',title:'Second revision round completed for the Portfolio page',detail:'',related:'Portfolio page'}
    ]},'Portfolio page',agreement);
    return {missingEarly,contiguous};
  });
  check('A later revision round cannot imply missing earlier rounds were completed',
    revisionSequenceChecks.missingEarly.completed===null&&revisionSequenceChecks.missingEarly.remaining===null&&
    revisionSequenceChecks.missingEarly.historyUnknown===true&&
    JSON.stringify(revisionSequenceChecks.missingEarly.sequenceGaps)==='[1,2]',
    JSON.stringify(revisionSequenceChecks.missingEarly));
  const reversedChronology=await page.evaluate(()=>window.bfLedgerRevisionUsage({revisionEvents:[
    {status:'delivered',sourceType:'email',sourceDate:'2026-02-07',title:'First revision round completed for the Portfolio page',related:'Portfolio page'},
    {status:'delivered',sourceType:'email',sourceDate:'2026-02-06',title:'Second revision round completed for the Portfolio page',related:'Portfolio page'}
  ]},'Portfolio page','Up to 3 revision rounds per page.'));
  const pageChronologyIsolation=await page.evaluate(()=>window.bfLedgerRevisionUsage({revisionEvents:[
    {status:'delivered',sourceType:'email',sourceDate:'2026-02-01',title:'First revision round completed for the Portfolio page',related:'Portfolio page'},
    {status:'delivered',sourceType:'email',sourceDate:'2026-02-02',title:'Second revision round completed for the Portfolio page',related:'Portfolio page'},
    {status:'delivered',sourceType:'email',sourceDate:'2026-02-05',title:'First revision round completed for the Careers page',related:'Careers page'},
    {status:'delivered',sourceType:'email',sourceDate:'2026-02-04',title:'Second revision round completed for the Careers page',related:'Careers page'}
  ]},'Portfolio page','Up to 3 revision rounds per page.'));
  check('Chronology conflicts on another page do not contaminate the requested page',
    pageChronologyIsolation.historyUnknown===false&&pageChronologyIsolation.completed===2&&
      pageChronologyIsolation.remaining===1&&pageChronologyIsolation.chronologyConflicts.length===0,
    JSON.stringify(pageChronologyIsolation));
  check('A later numbered revision round dated before an earlier round makes history unknown',
    reversedChronology.historyUnknown===true&&reversedChronology.completed===null&&
      reversedChronology.remaining===null&&reversedChronology.chronologyConflicts?.length===1,
    JSON.stringify(reversedChronology));
  check('A contiguous recorded revision sequence can still be counted',
    revisionSequenceChecks.contiguous.completed===2&&revisionSequenceChecks.contiguous.remaining===1&&
    revisionSequenceChecks.contiguous.historyUnknown===false,
    JSON.stringify(revisionSequenceChecks.contiguous));
  const unnumberedRevision=await page.evaluate(()=>{
    return window.bfLedgerRevisionUsage({revisionEvents:[
      {status:'delivered',sourceType:'email',sourceDate:'2026-02-06',title:'Revision work completed for the Portfolio page',detail:'Client-requested revisions delivered.',related:'Portfolio page'}
    ]},'Portfolio page','Each page includes up to 3 revision rounds.');
  });
  check('Unnumbered delivered revision record keeps the remaining allowance unknown',
    unnumberedRevision.completed===null&&unnumberedRevision.remaining===null&&
    unnumberedRevision.historyUnknown===true&&unnumberedRevision.unresolvedRoundEvents?.length===1,
    JSON.stringify(unnumberedRevision));
  const malformedRevisionCollections=await page.evaluate(()=>{
    const agreement='Each page includes up to 3 revision rounds.';
    const cases=[
      ['missing',{},'Portfolio page'],
      ['null',{revisionEvents:null},'Portfolio page'],
      ['object',{revisionEvents:{status:'delivered'}},'Portfolio page'],
      ['null-entry',{revisionEvents:[null,{status:'delivered',sourceType:'email',sourceDate:'2026-02-06',title:'First revision round completed for the Portfolio page',related:'Portfolio page'}]},'Portfolio page']
    ];
    return cases.map(([name,context,request])=>({name,result:window.bfLedgerRevisionUsage(context,request,agreement)}));
  });
  const unknownRevisionCollections=malformedRevisionCollections.filter(x=>x.name!=='null-entry');
  const nullEntryRevisionCollection=malformedRevisionCollections.find(x=>x.name==='null-entry');
  check('Missing or malformed revision collections keep allowance unknown',
    unknownRevisionCollections.every(x=>x.result.historyUnknown===true&&x.result.collectionUnknown===true&&x.result.completed===null&&x.result.remaining===null),
    JSON.stringify(unknownRevisionCollections));
  check('Null entries are ignored safely without discarding valid delivered evidence',
    nullEntryRevisionCollection.result.collectionUnknown===false&&
    nullEntryRevisionCollection.result.historyUnknown===false&&
    nullEntryRevisionCollection.result.completed===1&&
    nullEntryRevisionCollection.result.remaining===2,
    JSON.stringify(nullEntryRevisionCollection));
  const normalizedRevisionStatus=await page.evaluate(()=>{
    return window.bfLedgerRevisionUsage({revisionEvents:[
      {status:'  DELIVERED  ',sourceType:'email',sourceDate:'2026-02-05',title:'First revision round completed for the Portfolio page',detail:'',related:'Portfolio page'}
    ]},'Portfolio page','Each page includes up to 3 revision rounds.');
  });
  check('Whitespace and case variations in delivered status are normalized',
    normalizedRevisionStatus.completed===1&&normalizedRevisionStatus.remaining===2&&
    normalizedRevisionStatus.historyUnknown===false,
    JSON.stringify(normalizedRevisionStatus));

  const ledgerRenameMigration=await page.evaluate(()=>{
    const input=document.getElementById('projectName');
    if(!input||typeof window.bfLedgerRename!=='function'||typeof window.bfLedgerKeyForName!=='function'||typeof window.bfLedgerAliasMap!=='function')return {supported:false};
    const priorName=input.value,priorUser=window.__bfUserId,priorPrompt=window.prompt;
    const oldName='Rename Migration Source',newName='Rename Migration Destination',collisionName='Collision Destination';
    window.__bfUserId='bf-rename-migration-test';
    const oldKey=window.bfLedgerKeyForName(oldName),newKey=window.bfLedgerKeyForName(newName),collisionKey=window.bfLedgerKeyForName(collisionName);
    const oldBefore=localStorage.getItem(oldKey),newBefore=localStorage.getItem(newKey),collisionBefore=localStorage.getItem(collisionKey);
    const identityKey=window.bfScopedKey('boundaryflow_project_ledger_identity_v1'),identityBefore=localStorage.getItem(identityKey);
    const aliasKey=window.bfScopedKey('boundaryflow_project_ledger_alias_v1'),aliasBefore=localStorage.getItem(aliasKey);
    const records=[{id:'rename-preserve-1',type:'baseline',title:'Original agreement',detail:'Baseline scope text',sourceType:'agreement',status:'approved',projectName:oldName,recordedAt:'2026-02-01T00:00:00.000Z'}];
    localStorage.setItem(oldKey,JSON.stringify(records));localStorage.removeItem(newKey);
    input.value=oldName;window.prompt=()=>newName;
    const renamed=window.bfLedgerRename();
    const migrated=JSON.parse(localStorage.getItem(newKey)||'null');
    const oldRemoved=localStorage.getItem(oldKey)===null;
    const identityMap=JSON.parse(localStorage.getItem(identityKey)||'{}'),aliasMap=JSON.parse(localStorage.getItem(aliasKey)||'{}');
    const migrationOk=renamed&&oldRemoved&&input.value===oldName&&Array.isArray(migrated)&&migrated.length===1&&migrated[0].id==='rename-preserve-1'&&migrated[0].projectName===oldName&&migrated[0].ledgerName===newName&&!!migrated[0].projectIdentity&&identityMap[window.bfLedgerProjectIdentityName(oldName)]===migrated[0].projectIdentity&&aliasMap[window.bfLedgerProjectIdentityName(oldName)]===newName&&window.bfLedgerKey()===newKey&&window.bfLedgerDisplayName()===newName&&window.bfLedgerRead().some(x=>x.id==='rename-preserve-1');
    localStorage.setItem(oldKey,JSON.stringify(records));localStorage.setItem(collisionKey,JSON.stringify([{id:'collision-existing'}]));
    input.value=oldName;window.prompt=()=>collisionName;
    const collisionResult=window.bfLedgerRename();
    const collisionPreserved=Array.isArray(JSON.parse(localStorage.getItem(oldKey)||'null'))&&JSON.parse(localStorage.getItem(oldKey))[0].id==='rename-preserve-1'&&JSON.parse(localStorage.getItem(collisionKey))[0].id==='collision-existing'&&input.value===oldName;
    if(oldBefore===null)localStorage.removeItem(oldKey);else localStorage.setItem(oldKey,oldBefore);
    if(newBefore===null)localStorage.removeItem(newKey);else localStorage.setItem(newKey,newBefore);
    if(collisionBefore===null)localStorage.removeItem(collisionKey);else localStorage.setItem(collisionKey,collisionBefore);
    if(identityBefore===null)localStorage.removeItem(identityKey);else localStorage.setItem(identityKey,identityBefore);
    if(aliasBefore===null)localStorage.removeItem(aliasKey);else localStorage.setItem(aliasKey,aliasBefore);
    input.value=priorName;window.__bfUserId=priorUser;window.prompt=priorPrompt;
    return {supported:true,migrationOk,collisionResult,collisionPreserved};
  });
  check('Local ledger rename preserves cloud project name and persists a separate ledger alias',
    ledgerRenameMigration.supported&&ledgerRenameMigration.migrationOk,
    JSON.stringify(ledgerRenameMigration));
  check('Ledger rename refuses collisions without overwriting either project history',
    ledgerRenameMigration.supported&&!ledgerRenameMigration.collisionResult&&ledgerRenameMigration.collisionPreserved,
    JSON.stringify(ledgerRenameMigration));
  const ledgerRenameHardening=await page.evaluate(()=>{
    const input=document.getElementById('projectName');
    if(!input||typeof window.bfLedgerRename!=='function'||typeof window.bfLedgerProjectIdentityName!=='function')return {supported:false};
    const priorName=input.value,priorUser=window.__bfUserId,priorPrompt=window.prompt;
    const oldName='Malformed Source Ledger',newName='Malformed Destination Ledger';
    window.__bfUserId='bf-rename-rollback-test';
    const oldKey=window.bfLedgerKeyForName(oldName),newKey=window.bfLedgerKeyForName(newName);
    const oldBefore=localStorage.getItem(oldKey),newBefore=localStorage.getItem(newKey);
    const identityKey=window.bfScopedKey('boundaryflow_project_ledger_identity_v1'),identityBefore=localStorage.getItem(identityKey);
    const aliasKey=window.bfScopedKey('boundaryflow_project_ledger_alias_v1'),aliasBefore=localStorage.getItem(aliasKey);
    localStorage.setItem(oldKey,JSON.stringify([null]));localStorage.removeItem(newKey);
    input.value=oldName;window.prompt=()=>newName;
    const malformedResult=window.bfLedgerRename();
    const malformedRollback=malformedResult===false&&localStorage.getItem(oldKey)==='[null]'&&localStorage.getItem(newKey)===null&&input.value===oldName;
    const whitespaceNormalized=window.bfLedgerProjectIdentityName('  Alpha   Project  ')==='alpha project';
    if(oldBefore===null)localStorage.removeItem(oldKey);else localStorage.setItem(oldKey,oldBefore);
    if(newBefore===null)localStorage.removeItem(newKey);else localStorage.setItem(newKey,newBefore);
    if(identityBefore===null)localStorage.removeItem(identityKey);else localStorage.setItem(identityKey,identityBefore);
    if(aliasBefore===null)localStorage.removeItem(aliasKey);else localStorage.setItem(aliasKey,aliasBefore);
    input.value=priorName;window.__bfUserId=priorUser;window.prompt=priorPrompt;
    return {supported:true,malformedResult,malformedRollback,whitespaceNormalized};
  });
  check('Project identity normalization collapses repeated whitespace',
    ledgerRenameHardening.supported&&ledgerRenameHardening.whitespaceNormalized,
    JSON.stringify(ledgerRenameHardening));
  check('Malformed ledger records abort rename and preserve cloud project name and storage',
    ledgerRenameHardening.supported&&ledgerRenameHardening.malformedRollback,
    JSON.stringify(ledgerRenameHardening));
  const ledgerProjectSwitching=await page.evaluate(()=>{
    const input=document.getElementById('projectName');
    if(!input||typeof window.bfLedgerRename!=='function'||typeof window.bfLedgerRead!=='function'||typeof window.bfLedgerDisplayName!=='function')return {supported:false};
    const priorName=input.value,priorUser=window.__bfUserId,priorPrompt=window.prompt;
    const user='bf-ledger-switch-test-user',projectA='Cloud Project Alpha',projectB='Cloud Project Beta';
    window.__bfUserId=user;
    const keyA=window.bfLedgerKeyForName(projectA),keyB=window.bfLedgerKeyForName(projectB);
    const alias1='Alpha Evidence Ledger',alias2='Alpha Archive Ledger';
    const keyAlias1=window.bfLedgerKeyForName(alias1),keyAlias2=window.bfLedgerKeyForName(alias2);
    const identityKey=window.bfScopedKey('boundaryflow_project_ledger_identity_v1'),aliasKey=window.bfScopedKey('boundaryflow_project_ledger_alias_v1');
    const keys=[keyA,keyB,keyAlias1,keyAlias2,identityKey,aliasKey],before=keys.map(k=>localStorage.getItem(k));
    const identityBefore=window.bfLedgerProjectId(projectA);
    localStorage.setItem(keyA,JSON.stringify([{id:'alpha-record',title:'Alpha evidence',projectName:projectA}]));
    localStorage.setItem(keyB,JSON.stringify([{id:'beta-record',title:'Beta evidence',projectName:projectB}]));
    input.value=projectA;window.prompt=()=>alias1;
    const firstRename=window.bfLedgerRename();
    input.value=projectA;window.prompt=()=>alias2;
    const secondRename=window.bfLedgerRename();
    const afterSecond=window.bfLedgerRead();
    const secondIdentity=window.bfLedgerProjectId(projectA);
    const alphaStable=firstRename&&secondRename&&identityBefore===secondIdentity&&window.bfLedgerDisplayName()===alias2&&afterSecond.length===1&&afterSecond[0].id==='alpha-record'&&afterSecond[0].ledgerName===alias2&&localStorage.getItem(keyA)===null&&localStorage.getItem(keyAlias1)===null;
    input.value=projectB;
    const betaRead=window.bfLedgerRead(),betaIsolated=window.bfLedgerDisplayName()===projectB&&betaRead.length===1&&betaRead[0].id==='beta-record';
    input.value=projectA;
    const alphaAfterSwitch=window.bfLedgerRead(),alphaRestored=window.bfLedgerDisplayName()===alias2&&alphaAfterSwitch.length===1&&alphaAfterSwitch[0].id==='alpha-record'&&input.value===projectA;
    keys.forEach((k,i)=>{if(before[i]===null)localStorage.removeItem(k);else localStorage.setItem(k,before[i])});
    input.value=priorName;window.__bfUserId=priorUser;window.prompt=priorPrompt;
    return {supported:true,firstRename,secondRename,alphaStable,betaIsolated,alphaRestored};
  });
  check('Repeated local ledger renames preserve stable identity and the latest alias',
    ledgerProjectSwitching.supported&&ledgerProjectSwitching.alphaStable,
    JSON.stringify(ledgerProjectSwitching));
  check('Switching projects restores each project ledger without cross-project leakage',
    ledgerProjectSwitching.supported&&ledgerProjectSwitching.betaIsolated&&ledgerProjectSwitching.alphaRestored,
    JSON.stringify(ledgerProjectSwitching));
  const projectIdentityIsolation=await page.evaluate(()=>{
    const input=document.getElementById('projectName');
    if(!input||typeof window.bfLedgerKey!=='function'||typeof window.bfLedgerRead!=='function')return {supported:false};
    const previousName=input.value,previousUser=window.__bfUserId;
    window.__bfUserId='bf-identity-test-user';
    input.value='Identity Isolation Project';const alphaKey=window.bfLedgerKey();
    input.value='A Different Project';const betaKey=window.bfLedgerKey();
    input.value=previousName;window.__bfUserId=previousUser;
    return {supported:true,distinctProjectKeys:alphaKey!==betaKey,legacyRecordsRemainReadable:Array.isArray(window.bfLedgerRead())};
  });
  check('Project-scoped ledger keys isolate projects without rejecting legacy records',
    projectIdentityIsolation.supported&&projectIdentityIsolation.distinctProjectKeys&&projectIdentityIsolation.legacyRecordsRemainReadable,
    JSON.stringify(projectIdentityIsolation));
  const revisionDateMatrix=await page.evaluate(()=>{
    const agreement='Each page includes up to 3 revision rounds.';
    const event=(round,date,sourceType='email')=>({status:'delivered',sourceType,sourceDate:date,title:(round===1?'First':'Second')+' revision round completed for the Portfolio page',related:'Portfolio page'});
    const cases=[
      {name:'valid leap day',date:'2024-02-29',expected:true},
      {name:'invalid non-leap February 29',date:'2025-02-29',expected:false},
      {name:'impossible February 30',date:'2026-02-30',expected:false},
      {name:'impossible month 13',date:'2026-13-01',expected:false},
      {name:'locale date',date:'02/06/2026',expected:false},
      {name:'timestamp instead of date-only',date:'2026-02-06T10:00:00Z',expected:false}
    ].map(test=>{
      const result=window.bfLedgerRevisionUsage({revisionEvents:[event(1,test.date)]},'Portfolio page',agreement);
      return {name:test.name,expected:test.expected,actual:result.historyUnknown===false&&result.completed===1&&result.remaining===2,result};
    });
    const normalizedSource=window.bfLedgerRevisionUsage({revisionEvents:[event(1,'2026-02-06','  EMAIL  ')]},'Portfolio page',agreement);
    const sameDayRounds=window.bfLedgerRevisionUsage({revisionEvents:[
      event(1,'2026-02-06'),event(2,'2026-02-06')
    ]},'Portfolio page',agreement);
    return {cases,normalizedSource,sameDayRounds};
  });
  check('Revision source dates accept valid leap days and reject impossible or non-ISO dates',
    revisionDateMatrix.cases.every(x=>x.actual===x.expected),
    JSON.stringify(revisionDateMatrix.cases));
  check('Email source labels are trimmed and case-normalized without weakening provenance',
    revisionDateMatrix.normalizedSource.completed===1&&revisionDateMatrix.normalizedSource.remaining===2&&
      revisionDateMatrix.normalizedSource.historyUnknown===false,
    JSON.stringify(revisionDateMatrix.normalizedSource));
  check('Two sequential numbered rounds recorded on the same calendar day remain countable',
    revisionDateMatrix.sameDayRounds.completed===2&&revisionDateMatrix.sameDayRounds.remaining===1&&
      revisionDateMatrix.sameDayRounds.historyUnknown===false,
    JSON.stringify(revisionDateMatrix.sameDayRounds));

  const revisionProvenanceChecks=await page.evaluate(()=>{
    const agreement='Each page includes up to 3 revision rounds.';
    const cases=[
      ['missing-source',{status:'delivered',title:'First revision round completed for the Portfolio page',related:'Portfolio page'}],
      ['missing-date',{status:'delivered',sourceType:'email',title:'First revision round completed for the Portfolio page',related:'Portfolio page'}],
      ['invalid-date',{status:'delivered',sourceType:'email',sourceDate:'2026-02-31',title:'First revision round completed for the Portfolio page',related:'Portfolio page'}],
      ['internal-note',{status:'delivered',sourceType:'internal_note',title:'First revision round completed for the Portfolio page',related:'Portfolio page'}],
      ['generic-other',{status:'delivered',sourceType:'other',title:'First revision round completed for the Portfolio page',related:'Portfolio page'}],
      ['meeting-note',{status:'delivered',sourceType:'meeting',title:'First revision round completed for the Portfolio page',related:'Portfolio page'}],
      ['client-claim',{status:'delivered',sourceType:'client_claim',title:'First revision round completed for the Portfolio page',related:'Portfolio page'}]
    ];
    const unresolved=cases.map(([name,event])=>({name,result:window.bfLedgerRevisionUsage({revisionEvents:[event]},'Portfolio page',agreement)}));
    const duplicate=window.bfLedgerRevisionUsage({revisionEvents:[
      {status:'delivered',sourceType:'email',sourceDate:'2026-02-06',title:'First revision round completed for the Portfolio page',related:'Portfolio page'},
      {status:'delivered',sourceType:'email',sourceDate:'2026-02-06',title:'First revision round delivered for the Portfolio page',related:'Portfolio page'}
    ]},'Portfolio page',agreement);
    return {unresolved,duplicate};
  });
  check('Delivered revision records without an email source reference remain unresolved',
    revisionProvenanceChecks.unresolved.every(x=>x.result.completed===null&&x.result.remaining===null&&
      x.result.historyUnknown===true&&x.result.unresolvedRoundEvents?.length===1&&
      x.result.unresolvedRoundEvents[0].unverifiedSource===true),
    JSON.stringify(revisionProvenanceChecks.unresolved));
  const conflictingDuplicateDates=await page.evaluate(()=>window.bfLedgerRevisionUsage({revisionEvents:[
    {status:'delivered',sourceType:'email',sourceDate:'2026-02-06',title:'First revision round completed for the Portfolio page',related:'Portfolio page'},
    {status:'delivered',sourceType:'email',sourceDate:'2026-02-07',title:'First revision round delivered for the Portfolio page',related:'Portfolio page'}
  ]},'Portfolio page','Up to 3 revision rounds per page.'));
  check('Duplicate round records with conflicting dates make history unknown',
    conflictingDuplicateDates.historyUnknown===true&&conflictingDuplicateDates.completed===null&&
      conflictingDuplicateDates.remaining===null&&conflictingDuplicateDates.duplicateDateConflicts?.length===1,
    JSON.stringify(conflictingDuplicateDates));
  check('Duplicate records for the same numbered page revision do not inflate usage',
    revisionProvenanceChecks.duplicate.completed===1&&revisionProvenanceChecks.duplicate.remaining===2&&
      revisionProvenanceChecks.duplicate.historyUnknown===false&&
      revisionProvenanceChecks.duplicate.matchedEvents.length===2,
    JSON.stringify(revisionProvenanceChecks.duplicate));



  await setProject('E2E Unverified Client Revision Claim');
  const unverifiedClientRevision=await page.evaluate(()=>{
    const key=window.bfLedgerKey();
    localStorage.setItem(key,JSON.stringify([{id:'legacy-client-claim-revision',type:'revision',title:'First revision round completed for the Portfolio page',detail:'The client says the first revision round was delivered.',sourceType:'client_claim',status:'delivered',sourceDate:'2026-02-01',related:'Portfolio page',projectName:'E2E Unverified Client Revision Claim',recordedAt:'2026-02-02T10:00:00.000Z'}]));
    const context=window.bfLedgerAnalysisContext('Two rounds of revisions per page are included.');
    const usage=window.bfLedgerRevisionUsage(context,'Update the Portfolio page layout','Two rounds of revisions per page are included.');
    return {context,usage};
  });
  check('A legacy client-claim revision is not narrated or counted as completed work',
    unverifiedClientRevision.context.completedRevisionRounds.length===0&&
    !unverifiedClientRevision.context.analysisMessage.includes('User-recorded completed revision event')&&
    unverifiedClientRevision.usage.completed===null&&unverifiedClientRevision.usage.remaining===null&&
    unverifiedClientRevision.usage.historyUnknown===true&&
    unverifiedClientRevision.usage.unresolvedRoundEvents?.some(x=>x.sourceType==='client_claim'),
    JSON.stringify(unverifiedClientRevision));
  await setProject('E2E Ambiguous Active Baselines');
  await addRecord({type:'baseline',title:'Original SOW v1',detail:scope,source:'agreement',status:'approved',related:'Project',sourceDate:'2026-01-01'});
  await addRecord({type:'baseline',title:'Original SOW v2',detail:scope,source:'agreement',status:'approved',related:'Project',sourceDate:'2026-01-15'});
  await addRecord({type:'amendment',title:'Careers page approval',detail:'The Careers page is approved and included in the project scope.',source:'amendment',status:'approved',related:'Careers page',sourceDate:'2026-01-10'});
  const ambiguousBaselineAnalysis=await analyse(scope,'Create a new Careers page.');
  const ambiguousBaselineCareers=ambiguousBaselineAnalysis.rows.find(x=>/careers/i.test(x.request||''));
  check('Multiple active agreement baselines prevent an amendment from passing chronology review',
    ambiguousBaselineCareers?.status==='Clarify'&&/chronology|review/i.test(String(ambiguousBaselineCareers?.type||'')+' '+String(ambiguousBaselineCareers?.boundary||'')),
    JSON.stringify(ambiguousBaselineCareers||null));

  await setProject('E2E Evidence Deliverable Isolation');
  await page.locator('#a').fill(scope);
  await addRecord({type:'baseline',title:'Original agreed scope',detail:scope,source:'agreement',status:'approved',related:'All agreed pages'});
  await addRecord({type:'amendment',title:'Careers page approval',detail:'Careers page was approved and included.',source:'amendment',status:'approved',related:'Careers page'});
  const unrelatedEvidence=await analyse(scope,'Create a new Portfolio page.');
  const unrelatedPage=unrelatedEvidence.rows.find(x=>/portfolio/i.test(x.request||''));
  check('Approval for Careers page cannot transfer to a different Portfolio page',unrelatedPage?.status==='Likely additional'&&!/Careers page approval/i.test(unrelatedPage?.evidence||''),JSON.stringify(unrelatedPage||null));
  const unrelatedContext=unrelatedEvidence.meta?.used||[];
  check('Structured related-deliverable field remains explicit in analysis context',unrelatedContext.some(x=>x.title==='Careers page approval'&&x.related==='Careers page'));

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

  const xssPayload='<img src=x onerror=window.__bfXssExecuted=true>';
  await setProject('XSS '+xssPayload);
  await addRecord({type:'evidence',title:xssPayload,detail:xssPayload,source:'internal_note'});
  const ledgerXss=await page.evaluate(payload=>({
    injected:document.querySelectorAll('#bfLedgerList img, #bfLedgerList svg, #bfLedgerList script').length,
    literalTitle:document.querySelector('#bfLedgerList')?.innerText.includes(payload)||false,
    executed:!!window.__bfXssExecuted
  }),xssPayload);
  check('Untrusted ledger title and detail render as text, never executable HTML',
    ledgerXss.injected===0&&ledgerXss.literalTitle&&!ledgerXss.executed,JSON.stringify(ledgerXss));
  await analyse(scope,'Please review this request '+xssPayload);
  const analysisXss=await page.evaluate(payload=>({
    injected:document.querySelectorAll('#out img, #out svg, #out script').length,
    literalText:document.querySelector('#out')?.innerText.includes(payload)||false,
    executed:!!window.__bfXssExecuted
  }),xssPayload);
  check('Untrusted client-message text is escaped in analysis output',
    analysisXss.injected===0&&analysisXss.literalText&&!analysisXss.executed,JSON.stringify(analysisXss));
  const xssSave=page.locator('[data-save]').first();
  if(await xssSave.count())await xssSave.click();
  await page.locator('#historyBtn').click();
  const historyXss=await page.evaluate(payload=>({
    injected:document.querySelectorAll('#historyList img, #historyList svg, #historyList script').length,
    literalName:document.querySelector('#historyList')?.innerText.includes(payload)||false,
    executed:!!window.__bfXssExecuted
  }),xssPayload);
  check('Untrusted project names render safely in local History',
    historyXss.injected===0&&historyXss.literalName&&!historyXss.executed,JSON.stringify(historyXss));
  await page.locator('#closeHistory').click();
  const analysisIdentity=await page.evaluate(()=>{
    const a=document.getElementById('a'),r=document.getElementById('r'),p=document.getElementById('projectName');
    const before=[a.value,r.value,p.value],cacheSource=window.__bfAnalysisIdentitySource,cacheId=window.__bfAnalysisIdentityId;
    p.value='Project';
    a.value='SOW';r.value='request-46u1pzoj';
    const first=window.bfAnalysisId(),repeat=window.bfAnalysisId();
    r.value='request-6mqdtqjf';
    const second=window.bfAnalysisId();
    a.value=before[0];r.value=before[1];p.value=before[2];
    window.__bfAnalysisIdentitySource=cacheSource;window.__bfAnalysisIdentityId=cacheId;
    return {first,repeat,second,stable:first===repeat,distinct:first!==second};
  });
  check('Analysis IDs remain stable for identical inputs and distinct for colliding legacy hashes',
    analysisIdentity.stable&&analysisIdentity.distinct,JSON.stringify(analysisIdentity));

  const ledgerCollision=await page.evaluate(()=>{
    if(typeof window.bfLedgerKeyForName!=='function'||typeof window.bfLedgerLegacyKeyForName!=='function')return {supported:false};
    const a='collision-x2nvv0h3',b='collision-8m7my3ma';
    return {supported:true,distinctKeys:window.bfLedgerKeyForName(a)!==window.bfLedgerKeyForName(b),
      legacyCollision:window.bfLedgerLegacyKeyForName(a)===window.bfLedgerLegacyKeyForName(b)};
  });
  check('New ledger keys distinguish names that collided under the legacy 32-bit hash',
    ledgerCollision.supported&&ledgerCollision.distinctKeys&&ledgerCollision.legacyCollision,JSON.stringify(ledgerCollision));

  const legacyLedgerMigration=await page.evaluate(()=>{
    const input=document.getElementById('projectName');
    if(!input||typeof window.bfLedgerRead!=='function'||typeof window.bfLedgerLegacyKeyForName!=='function')return {supported:false};
    const oldName=input.value,oldUser=window.__bfUserId,oldStatus=document.getElementById('bfLedgerStatus')?.textContent;
    const testName='Legacy Migration Exact Project',testUser='bf-legacy-migration-test';
    window.__bfUserId=testUser;input.value=testName;
    const legacy=window.bfLedgerLegacyKeyForName(testName),current=window.bfLedgerKeyForName(testName);
    const oldLegacy=localStorage.getItem(legacy),oldCurrent=localStorage.getItem(current);
    const identityKey=window.bfScopedKey('boundaryflow_project_ledger_identity_v1'),oldIdentity=localStorage.getItem(identityKey);
    const record={id:'legacy-exact-1',title:'Legacy baseline',detail:'Recorded under the exact project',projectName:testName,type:'baseline'};
    localStorage.setItem(legacy,JSON.stringify([record]));localStorage.removeItem(current);
    const read=window.bfLedgerRead();
    const exactMigrated=read.length===1&&read[0].id==='legacy-exact-1'&&JSON.parse(localStorage.getItem(current)||'[]').length===1&&localStorage.getItem(legacy)===null;
    const ambiguousName='Legacy Ambiguous Project';input.value=ambiguousName;
    const ambiguousKey=window.bfLedgerLegacyKeyForName(ambiguousName),ambiguousCurrent=window.bfLedgerKeyForName(ambiguousName);
    const oldAmbiguous=localStorage.getItem(ambiguousKey),oldAmbiguousCurrent=localStorage.getItem(ambiguousCurrent);
    localStorage.setItem(ambiguousKey,JSON.stringify([{id:'ambiguous-1',title:'No project identity'}]));
    const ambiguousRead=window.bfLedgerRead();
    const ambiguousPreserved=ambiguousRead.length===0&&localStorage.getItem(ambiguousKey)!==null&&localStorage.getItem(ambiguousCurrent)===null;
    const restore=(key,value)=>value===null?localStorage.removeItem(key):localStorage.setItem(key,value);
    restore(legacy,oldLegacy);restore(current,oldCurrent);restore(ambiguousKey,oldAmbiguous);restore(ambiguousCurrent,oldAmbiguousCurrent);restore(identityKey,oldIdentity);
    input.value=oldName;window.__bfUserId=oldUser;
    const status=document.getElementById('bfLedgerStatus');if(status&&oldStatus!==undefined)status.textContent=oldStatus;
    return {supported:true,exactMigrated,ambiguousPreserved};
  });
  check('Legacy ledger migration preserves records with matching project identity',
    legacyLedgerMigration.supported&&legacyLedgerMigration.exactMigrated,JSON.stringify(legacyLedgerMigration));
  check('Ambiguous legacy ledger records are preserved, not reassigned to a project',
    legacyLedgerMigration.supported&&legacyLedgerMigration.ambiguousPreserved,JSON.stringify(legacyLedgerMigration));

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
