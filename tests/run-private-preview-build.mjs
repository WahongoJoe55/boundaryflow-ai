import assert from 'node:assert/strict';
import fs from 'node:fs';

const preview = fs.readFileSync('preview/index.html', 'utf8');
const production = fs.readFileSync('index.html', 'utf8');

assert.ok(preview.length > 100000, 'Preview HTML should contain the complete application');
assert.ok(preview.includes("const CFG_KEY='boundaryflow_private_preview_supabase_config_v1';"));
assert.ok(preview.includes("const BUILD_CONFIG={url:'',key:''};"));
assert.ok(preview.includes("const BF_TURNSTILE_SITE_KEY='';"));
assert.ok(preview.includes("const BF_PUBLIC_SIGNUP_ENABLED=true;"));
assert.ok(preview.includes("if(!BF_TURNSTILE_SITE_KEY)return '';"));
assert.ok(!preview.includes('kqgtevksdlzgquvdpvha.supabase.co'));
assert.ok(!preview.includes('sb_publishable_l145nCqyNAIkrHaMcGOUGg_XoZjiBQz'));
assert.ok(!preview.includes('0x4AAAAAAF16wqI6tNuRGW9Z'));
assert.ok(production.includes("const BUILD_CONFIG={url:'https://kqgtevksdlzgquvdpvha.supabase.co',key:'sb_publishable_l145nCqyNAIkrHaMcGOUGg_XoZjiBQz'};"), 'Production source must remain unchanged by preview generation');

console.log(JSON.stringify({suite:'private-preview-build',passed:10,failed:0}, null, 2));
