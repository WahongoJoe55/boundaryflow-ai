import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server = http.createServer((req,res)=>{
  let pathname;
  try { pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname); } catch { res.writeHead(400).end('Bad request'); return; }
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep) && file!==root){res.writeHead(403).end('Forbidden');return;}
  fs.stat(file,(err,st)=>{
    if(err||!st.isFile()){res.writeHead(404).end('Not found');return;}
    res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
    fs.createReadStream(file).pipe(res);
  });
});

let browser;
try {
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4173,'127.0.0.1',resolve);});
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext();
  // Keep the test fully local: no Supabase, CDN, or third-party requests.
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1' || url.hostname==='localhost') return route.continue();
    return route.abort();
  });
  const page=await context.newPage();
  page.on('pageerror',error=>console.error('Browser page error:',error.stack||error.message));
  page.on('console',message=>{if(message.type()==='error')console.error('Browser console error:',message.text());});
  const response=await page.goto('http://127.0.0.1:4173/tests/engine-regression-runner.html',{waitUntil:'domcontentloaded'});
  if(!response?.ok()) throw new Error('Regression runner failed to load.');
  await page.locator('#run').click();
  await page.waitForFunction(()=>document.getElementById('runStatus')?.textContent.includes('Completed'),null,{timeout:30000});
  const results=await page.locator('.case').evaluateAll(cards=>cards.map(card=>({
    id:card.querySelector('.casehead b')?.textContent||'',
    result:card.querySelector('.casehead .pass,.casehead .fail')?.textContent||'UNKNOWN',
    detail:card.querySelector('.casebody')?.innerText||''
  })));
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  fs.writeFileSync(path.join(root,'test-results','engine-regression-results.json'),JSON.stringify({generatedAt:new Date().toISOString(),results},null,2));
  const passed=results.filter(x=>x.result==='PASS').length;
  const failed=results.length-passed;
  console.log(JSON.stringify({total:results.length,passed,failed,results},null,2));
  if(results.length!==78 || failed>0) process.exitCode=1;
} catch(error) {
  console.error(error);
  process.exitCode=1;
} finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
