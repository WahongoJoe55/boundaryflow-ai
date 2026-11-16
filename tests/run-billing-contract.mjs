import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationDir = path.join(root, 'supabase', 'migrations');
const files = [
  '20261111000200_billing_foundation.sql',
  '20261111000300_atomic_analysis_usage.sql',
  '20261111000400_usage_reservation_lease.sql',
  '20261116000100_monthly_quota_windows.sql',
  '20261116000200_analysis_result_replay.sql',
];
const sql = files.map(name => {
  const file = path.join(migrationDir, name);
  if (!fs.existsSync(file)) throw new Error('Missing billing migration: ' + name);
  return fs.readFileSync(file, 'utf8');
});
const [foundation, atomic, lease, monthlyQuota, resultReplay] = sql;
const entitlementPath = path.join(root, 'supabase', 'functions', 'get-entitlement', 'index.ts');
if (!fs.existsSync(entitlementPath)) throw new Error('Missing get-entitlement function');
const entitlement = fs.readFileSync(entitlementPath, 'utf8');
const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, result: ok ? 'PASS' : 'FAIL', detail });
}
function has(source, pattern) { return pattern.test(source); }

for (let i = 0; i < files.length; i++) {
  check(files[i] + ' has explicit transaction boundaries',
    /\bBEGIN;[\s\S]*\bCOMMIT;\s*$/i.test(sql[i]) &&
    (sql[i].match(/\bBEGIN;/gi) ?? []).length === 1 &&
    (sql[i].match(/\bCOMMIT;/gi) ?? []).length === 1);
}
for (const table of ['plan_catalog','billing_customers','billing_subscriptions','billing_payments','billing_webhook_events','usage_events']) {
  check('Foundation defines ' + table, has(foundation, new RegExp('CREATE TABLE IF NOT EXISTS public\\.' + table + '\\b','i')));
  check('RLS enabled for ' + table, has(foundation, new RegExp('ALTER TABLE public\\.' + table + ' ENABLE ROW LEVEL SECURITY','i')));
}
check('Client roles cannot mutate billing subscription rows',
  has(foundation,/REVOKE ALL ON public\.billing_subscriptions FROM anon, authenticated/i));
check('Client roles cannot mutate payment rows',
  has(foundation,/REVOKE ALL ON public\.billing_payments FROM anon, authenticated/i));
check('Client roles cannot mutate usage rows',
  has(foundation,/REVOKE ALL ON public\.usage_events FROM anon, authenticated/i));
check('Webhook inbox is not client-readable',
  has(foundation,/REVOKE ALL ON public\.billing_webhook_events FROM anon, authenticated/i));
check('Usage idempotency is unique per user',
  has(foundation,/UNIQUE\s*\(user_id, idempotency_key\)/i));
check('Usage rows are tied to a versioned plan',
  has(foundation,/FOREIGN KEY\s*\(plan_key, plan_version, currency\)[\s\S]*?REFERENCES public\.plan_catalog/i));

check('Quota decisions are serialized by per-user advisory transaction lock',
  has(atomic,/pg_advisory_xact_lock\(hashtextextended\(p_user_id::text, 0\)\)/i));
check('Quota derives from server-owned plan entitlements',
  has(atomic,/v_plan\.entitlements->>'analysis_limit_monthly'/i));
check('Only reserved and completed units count against quota',
  has(atomic,/reservation_status IN \('reserved', 'completed'\)/i));
check('Reservation RPC is not executable by browser roles',
  has(atomic,/REVOKE ALL ON FUNCTION public\.reserve_analysis_usage\(uuid, text, text\) FROM PUBLIC, anon, authenticated/i));
check('Finalization RPC is not executable by browser roles',
  has(atomic,/REVOKE ALL ON FUNCTION public\.finalize_analysis_usage\(uuid, text\) FROM PUBLIC, anon, authenticated/i));
check('Reservation RPC is granted only to service role',
  has(atomic,/GRANT EXECUTE ON FUNCTION public\.reserve_analysis_usage\(uuid, text, text\) TO service_role/i));
check('Finalization RPC is granted only to service role',
  has(atomic,/GRANT EXECUTE ON FUNCTION public\.finalize_analysis_usage\(uuid, text\) TO service_role/i));

check('Idempotency key is bound to the original analysis ID',
  has(lease,/v_existing\.analysis_local_id <> p_analysis_local_id[\s\S]*?idempotency_key_analysis_mismatch/i));
check('New reservations receive a bounded lease',
  has(lease,/v_now \+ interval '15 minutes'/i));
check('Expired reservations are released before quota counting',
  has(lease,/UPDATE public\.usage_events[\s\S]*?reservation_status = 'released'[\s\S]*?reservation_expires_at <= v_now/i));
check('Finalization refuses expired reservations',
  has(lease,/reservation_expires_at > clock_timestamp\(\)/i));
check('Expired reservations have a partial recovery index',
  has(lease,/CREATE INDEX IF NOT EXISTS usage_events_expired_reservations_idx[\s\S]*?WHERE reservation_status = 'reserved'/i));
check('Reservation and finalization retain service-role-only grants',
  has(lease,/REVOKE ALL ON FUNCTION public\.reserve_analysis_usage\(uuid, text, text\) FROM PUBLIC, anon, authenticated/i) &&
  has(lease,/REVOKE ALL ON FUNCTION public\.finalize_analysis_usage\(uuid, text\) FROM PUBLIC, anon, authenticated/i));
check('Entitlement lookup excludes subscriptions whose billing period has not started',
  has(entitlement,/\.lte\("current_period_start", now\)/i));
check('Entitlement lookup excludes subscriptions whose billing period has ended',
  has(entitlement,/\.gt\("current_period_end", now\)/i));

check('Annual and monthly plans calculate a separate monthly quota window',
  has(monthlyQuota,/v_quota_period_start[\s\S]*v_quota_period_end/i));
check('Monthly quota window is anchored to the subscription billing start',
  has(monthlyQuota,/current_period_start \+ make_interval\(months => v_month_offset\)/i));
check('Monthly quota window steps back when the current month anchor is still in the future',
  has(monthlyQuota,/IF v_quota_period_start > v_now THEN[\s\S]*v_month_offset := v_month_offset - 1/i));
check('Quota counting uses the derived monthly window',
  has(monthlyQuota,/period_start = v_quota_period_start[\s\S]*period_end = v_quota_period_end/i));
check('Monthly quota window is capped at subscription expiry',
  has(monthlyQuota,/LEAST\([\s\S]*current_period_end/i));


check('Analysis result payload is stored as a JSON object and size-limited by the finalizer',
  has(resultReplay,/jsonb_typeof\(p_result\) <> 'object'[\s\S]*octet_length\(p_result::text\) > 65536/i));
const safeGrant = resultReplay.match(/GRANT SELECT \\(([\\s\\S]*?)\\) ON public\\.usage_events TO authenticated/i)?.[1] ?? '';
check('Browser roles cannot read confidential analysis result payloads',
  /REVOKE SELECT ON public\\.usage_events FROM authenticated/i.test(resultReplay)
  && safeGrant.length > 0
  && !/result_payload/i.test(safeGrant)
  && /reservation_expires_at/i.test(safeGrant));
check('Result finalization requires a live reservation lease',
  has(resultReplay,/reservation_status = 'reserved'[\s\S]*reservation_expires_at > clock_timestamp\(\)/i));
check('Result finalization is restricted to service role',
  has(resultReplay,/REVOKE ALL ON FUNCTION public\.finalize_analysis_usage_result\(uuid, jsonb\)[\s\S]*GRANT EXECUTE ON FUNCTION public\.finalize_analysis_usage_result\(uuid, jsonb\)\s+TO service_role/i));
check('Idempotent result retrieval is restricted to service role',
  has(resultReplay,/REVOKE ALL ON FUNCTION public\.get_analysis_usage_result\(uuid, text\)[\s\S]*GRANT EXECUTE ON FUNCTION public\.get_analysis_usage_result\(uuid, text\)\s+TO service_role/i));

const failed = checks.filter(x => x.result === 'FAIL');
console.log(JSON.stringify({ suite: 'billing-schema-contract', total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));
if (failed.length) process.exitCode = 1;
