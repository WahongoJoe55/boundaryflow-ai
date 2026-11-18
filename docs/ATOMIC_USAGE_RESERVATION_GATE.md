# Atomic usage reservation — staging review

**Status: SQL migration committed for review; not applied or executed against a database.**

Migration: `supabase/migrations/20261111000300_atomic_analysis_usage.sql`

## Contract
- Reservation is callable only by Supabase service_role.
- The trusted caller must validate the user's JWT first and derive the account UUID from that identity.
- A transaction-scoped advisory lock serializes quota decisions for one account.
- The function reads exactly one current active/trialing subscription and its active plan.
- Monthly quota is read from server-owned `plan_catalog.entitlements.analysis_limit_monthly`.
- Reserved and completed units count; released reservations do not.
- Per-user idempotency keys make retries return the original reservation.
- Ambiguous subscription state, missing plan/quota and exhausted quota fail closed.
- Finalization is service-role only and transitions reserved to completed or released once.

## Required staging tests
1. anon/authenticated roles cannot execute either function.
2. service_role can execute using a verified test user's UUID.
3. Missing, expired, cancelled subscription and inactive plan are denied.
4. Missing, malformed, zero and negative quota configuration are denied.
5. First valid reservation consumes one unit.
6. Repeated idempotency key returns the same event without consuming another unit.
7. Same key for another user creates a separate reservation.
8. At quota minus one, concurrent requests allow exactly one.
9. Concurrent requests never exceed quota.
10. Release restores one available unit; completion keeps the unit consumed.
11. Repeated finalization cannot change completed/released records.
12. Account A cannot inspect or mutate Account B's usage through PostgREST or RPC.

## Integration boundary
Do not expose these RPCs to browser clients. The future authenticated analysis Edge Function validates the caller, derives the account ID, reserves usage, executes server-side analysis, then finalizes or releases. Current browser-local `analyze()` remains unmetered and must not be represented as paid server analysis.

## Known limitations
- No server-created Free entitlement path yet.
- Annual subscriptions need a monthly sub-period calculation before annual plans are offered.
- A crash after reservation can leave usage counted. Add a bounded reservation lease/reaper before production.
- Database execution, concurrency tests, grants and staging compatibility remain unverified.
