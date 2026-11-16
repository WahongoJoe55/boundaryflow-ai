import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const edgePath = path.join(root, 'supabase', 'functions', 'analyze-scope', 'index.ts');
const source = fs.readFileSync(edgePath, 'utf8');
const checks = [];
function check(name, ok) { checks.push({ name, result: ok ? 'PASS' : 'FAIL' }); }
check('Analysis endpoint validates the caller JWT through Supabase Auth',
  /authClient\.auth\.getUser\(\)/.test(source));
check('User identity is derived from the verified JWT, not request JSON',
  /p_user_id:\s*authData\.user\.id/.test(source) && !/input\.user_id/.test(source));
check('Provider key is read only from server environment',
  /Deno\.env\.get\("BF_AI_API_KEY"\)/.test(source) && !/BF_AI_API_KEY\s*=\s*["']/.test(source));
check('Browser does not select provider endpoint or model',
  /Deno\.env\.get\("BF_AI_PROVIDER"\)/.test(source) && /Deno\.env\.get\("BF_AI_MODEL"\)/.test(source));
check('Usage is reserved before model execution',
  source.indexOf('reserve_analysis_usage') >= 0 && source.indexOf('reserve_analysis_usage') < source.indexOf('await callModel(input)'));
check('Both OpenAI and Gemini are supported server-side',
  /api\.openai\.com\/v1\/chat\/completions/.test(source) && /generativelanguage\.googleapis\.com/.test(source));
check('Evidence quotations are validated against exact source text',
  /sourceText\.indexOf\(quote\)/.test(source) && /char|start/.test(source));
check('Unsubstantiated included/additional decisions abstain to clarification',
  /classification = "Clarify"/.test(source) && /!evidence\.some\(\(entry\) => entry\.source === "agreement"\)/.test(source));
check('Completed result is stored before successful response',
  source.indexOf('finalize_analysis_usage_result') < source.indexOf('return reply(result, 200, origin)'));
check('Idempotent retries retrieve the stored completed result',
  /get_analysis_usage_result/.test(source) && /replayed: true/.test(source));
check('Model/provider failures release reservations',
  /finalize_analysis_usage/.test(source) && /p_outcome: "released"/.test(source));
check('Agreement and client message sizes are bounded',
  /agreement\.length > 50_000/.test(source) && /message\.length > 20_000/.test(source));
check('Model output is bounded and schema-validated',
  /MAX_RESULT_BYTES/.test(source) && /validateModelResult\(/.test(source));
check('CORS is restricted to configured origins',
  /ALLOWED_ORIGINS\.has\(origin\)/.test(source));
check('No request content or API key is logged',
  !/console\.(log|error)\([^\n]*(agreement_text|client_message|AI_API_KEY)/.test(source));
const failed = checks.filter(x => x.result === 'FAIL');
console.log(JSON.stringify({ suite: 'ai-analysis-endpoint-contract', total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));
if (failed.length) process.exitCode = 1;
