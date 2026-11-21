/**
 * No-cost negative/security smoke tests for the deployed staging Edge Function.
 *
 * These cases do not call the model, reserve quota, or write database rows.
 * Required local environment:
 *   BF_STAGING_FUNCTION_URL=https://zockowhjvharddpmdagh.supabase.co/functions/v1/analyze-scope
 *   BF_STAGING_ANON_KEY=<staging anon key>
 *   BF_STAGING_ORIGIN=<exact allow-listed staging/browser origin>
 *
 * Never point this script at production. Never paste credentials into chat.
 */
const endpoint = process.env.BF_STAGING_FUNCTION_URL;
const anonKey = process.env.BF_STAGING_ANON_KEY;
const origin = process.env.BF_STAGING_ORIGIN;
const expectedHost = "zockowhjvharddpmdagh.supabase.co";

function fail(message) {
  console.error("FAIL: " + message);
  process.exitCode = 1;
}
if (!endpoint || !anonKey || !origin) {
  console.error("Missing BF_STAGING_FUNCTION_URL, BF_STAGING_ANON_KEY or BF_STAGING_ORIGIN.");
  process.exit(2);
}
let parsed;
try { parsed = new URL(endpoint); } catch { parsed = null; }
if (!parsed || parsed.protocol !== "https:" || parsed.hostname !== expectedHost
    || !(parsed.pathname === "/functions/v1/analyze-scope" || parsed.pathname === "/functions/v1/analyze-scope/")) {
  console.error("Refusing target: expected the exact isolated staging analyze-scope endpoint.");
  process.exit(2);
}
if (!origin.toLowerCase().startsWith("https://") || origin.includes("*") || new URL(origin).origin !== origin) {
  console.error("Refusing invalid origin: provide one exact HTTPS origin without a path or wildcard.");
  process.exit(2);
}

const common = { apikey: anonKey, origin };
const cases = [
  {
    name: "allow-listed CORS preflight succeeds without invoking analysis",
    run: () => fetch(endpoint, { method: "OPTIONS", headers: { ...common, "access-control-request-method": "POST" } }),
    check: r => r.status === 204 && r.headers.get("access-control-allow-origin") === origin
      && /POST/.test(r.headers.get("access-control-allow-methods") || ""),
  },
  {
    name: "unapproved origin is rejected",
    run: () => fetch(endpoint, { method: "OPTIONS", headers: { apikey: anonKey, origin: "https://not-allowed.invalid" } }),
    check: r => r.status === 403 && !r.headers.has("access-control-allow-origin"),
  },
  {
    name: "unsupported GET method is rejected",
    run: () => fetch(endpoint, { method: "GET", headers: common }),
    check: r => r.status === 405,
  },
  {
    name: "non-JSON POST is rejected before authentication/model execution",
    run: () => fetch(endpoint, { method: "POST", headers: { ...common, "content-type": "text/plain" }, body: "nope" }),
    check: r => r.status === 415,
  },
  {
    name: "missing bearer token is rejected",
    run: () => fetch(endpoint, { method: "POST", headers: { ...common, "content-type": "application/json" }, body: "{}" }),
    check: r => r.status === 401,
  },
  {
    name: "malformed JSON is rejected before JWT lookup/model execution",
    run: () => fetch(endpoint, { method: "POST", headers: { ...common, authorization: "Bearer invalid-test-token", "content-type": "application/json" }, body: "{" }),
    check: r => r.status === 400,
  },
  {
    name: "oversized body is rejected before authentication/model execution",
    run: () => fetch(endpoint, { method: "POST", headers: { ...common, "content-type": "application/json" }, body: JSON.stringify({ padding: "x".repeat(81_000) }) }),
    check: r => r.status === 413,
  },
];

let passed = 0;
for (const test of cases) {
  try {
    const response = await test.run();
    const ok = test.check(response);
    if (ok) {
      passed++;
      console.log("PASS: " + test.name + " (HTTP " + response.status + ")");
    } else {
      fail(test.name + " (unexpected HTTP " + response.status + ")");
    }
    await response.body?.cancel().catch(() => {});
  } catch (error) {
    fail(test.name + " (request error: " + (error instanceof Error ? error.message : "unknown") + ")");
  }
}
console.log(JSON.stringify({ suite: "staging-edge-security-smoke", total: cases.length, passed, failed: cases.length - passed }));
