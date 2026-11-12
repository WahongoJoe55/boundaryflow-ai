import fs from 'node:fs';
import path from 'node:path';

const sourcePath = 'index.html';
const outputPath = 'preview/index.html';
let html = fs.readFileSync(sourcePath, 'utf8');

function replaceExactlyOnce(input, before, after, label) {
  const count = input.split(before).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one ${label}; found ${count}. Refusing to build preview.`);
  return input.replace(before, after);
}

// Isolate preview browser storage from any normal/production configuration.
html = replaceExactlyOnce(
  html,
  "const CFG_KEY='boundaryflow_supabase_config_v1';",
  "const CFG_KEY='boundaryflow_private_preview_supabase_config_v1';",
  'Supabase config storage key'
);

// A preview must never silently fall back to the production Supabase project.
html = replaceExactlyOnce(
  html,
  "const BUILD_CONFIG={url:'https://kqgtevksdlzgquvdpvha.supabase.co',key:'sb_publishable_l145nCqyNAIkrHaMcGOUGg_XoZjiBQz'};",
  "const BUILD_CONFIG={url:'',key:''};",
  'build-time Supabase config'
);

// Staging preview uses its own Auth project and does not reuse production Turnstile.
html = replaceExactlyOnce(
  html,
  "const BF_TURNSTILE_SITE_KEY='0x4AAAAAAF16wqI6tNuRGW9Z';",
  "const BF_TURNSTILE_SITE_KEY='';",
  'Turnstile site key'
);
html = replaceExactlyOnce(
  html,
  "async function getTurnstileToken(){\n    await ensureTurnstileWidget();\n    if(!bfTurnstileToken)throw new Error('Please complete the Cloudflare security verification before continuing.');\n    return bfTurnstileToken;\n  }",
  "async function getTurnstileToken(){\n    if(!BF_TURNSTILE_SITE_KEY)return '';\n    await ensureTurnstileWidget();\n    if(!bfTurnstileToken)throw new Error('Please complete the Cloudflare security verification before continuing.');\n    return bfTurnstileToken;\n  }",
  'Turnstile token function'
);
html = replaceExactlyOnce(
  html,
  "const BF_PUBLIC_SIGNUP_ENABLED=false; // Keep public registration closed until final legal/privacy approval and live release gates are signed off.",
  "const BF_PUBLIC_SIGNUP_ENABLED=true; // Private preview only: staging Auth project, private hosting access and test data.",
  'preview-only signup switch'
);

if (html.includes('kqgtevksdlzgquvdpvha.supabase.co') ||
    html.includes('sb_publishable_l145nCqyNAIkrHaMcGOUGg_XoZjiBQz') ||
    html.includes('0x4AAAAAAF16wqI6tNuRGW9Z')) {
  throw new Error('Production service configuration leaked into the preview build.');
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html);
process.stdout.write(`Created ${outputPath} with blank Supabase config, isolated browser storage, and preview-only registration.\n`);
