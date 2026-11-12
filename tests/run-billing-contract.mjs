import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationDir = path.join(root, 'supabase', 'migrations');
const files = [
  '20261111000200_billing_foundation.sql',
  '20261111000300_atomic_analysis_usage.sql',
  '20261111000400_usage_reservation_lease.sql',
];
const sql = files.map(name => {
  const file = path.join(migrationDir, name);
  if (!fs.existsSync(file)) throw new Error('Missing billing migration: ' + name);
  return fs.readFileSync(file, 'utf8');
});
const [foundation, atomic, lease] = sql;
const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, result: ok ? 'PASS' : 'FAIL', detail });
}
function has(source, pattern) { return pattern.test(source); }

for (let i = 0; i < files.length; i++) {
  check(files[i] + ' has explicit transaction boundaries',
    /^BEGIN;[\s\S]*COMMIT;\s*$/i.test(sql[i].trim()));
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

const failed = checks.filter(x => x.result === 'FAIL');
console.log(JSON.stringify({ suite: 'billing-schema-contract', total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));
if (failed.length) process.exitCode = 1;
