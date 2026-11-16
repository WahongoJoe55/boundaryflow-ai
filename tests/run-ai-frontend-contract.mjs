import fs from 'node:fs';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const checks=[];
function check(name,ok){checks.push({name,result:ok?'PASS':'FAIL'});}
check('Server AI is disabled by default pending staging verification',source.includes('window.BF_SERVER_AI_ENABLED = false'));
check('Existing Analyze workflow has a guarded server AI branch',source.includes('if(window.BF_SERVER_AI_ENABLED===true)')&&source.includes('bfRunServerAIAnalysis(a,r)'));
check('Server AI output is mapped to the existing BoundaryFlow result shape',source.includes('function bfMapServerAIResult(result)')&&source.includes("status:item.classification")&&source.includes('response:String(item.client_response'));
check('AI endpoint is invoked through the signed-in Supabase client',source.includes("c.functions.invoke('analyze-scope',{body:payload})")&&source.includes('requireUser();'));
check('AI request uses stable analysis and idempotency identity',source.includes('analysis_local_id:analysisId,idempotency_key:analysisId'));
check('AI mode preserves local autosave and existing result renderer',source.includes('renderResults();')&&source.includes("autoSaveCurrentAnalysis==='function'"));
check('No provider API key is embedded in browser source',!/BF_AI_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY/.test(source));
const failed=checks.filter(x=>x.result==='FAIL');
console.log(JSON.stringify({suite:'ai-frontend-integration-contract',total:checks.length,passed:checks.length-failed.length,failed:failed.length,checks},null,2));
if(failed.length)process.exitCode=1;
