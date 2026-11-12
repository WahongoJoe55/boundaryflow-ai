# Reservation lease and idempotency hardening

**Status: migration committed for review; not applied or database-tested.**

Migration: `supabase/migrations/20261111000400_usage_reservation_lease.sql`

## Changes
- Binds an idempotency key to its original `analysis_local_id`. Reuse for a different analysis raises an error rather than returning another analysis's reservation.
- Gives each reservation a 15-minute lease.
- Expires stale reservations for the same account before quota calculation.
- A retry of an expired reservation is denied rather than silently opening a new reservation with the same key.
- Finalization only changes a still-live reservation.
- Adds a partial index for locating unexpired/reserved work.

## Required staging verification
1. Apply migrations 00200, 00300 and 00400 in order on an isolated database.
2. Confirm the ALTER migration is repeat-safe on a disposable clone.
3. Same idempotency key + same analysis returns same reservation.
4. Same idempotency key + different analysis raises `22023`.
5. Expired reservation is released and no longer consumes quota.
6. Expired reservation cannot be finalized.
7. Active reservation can be completed once; repeated finalization returns false.
8. Concurrent reservations at quota boundary never exceed the limit.
9. RLS and function execute grants reject anon/authenticated callers.
10. Verify transaction rollback leaves no partial reservation.

## Operational constraint
The lease duration must exceed the maximum supported server-side analysis duration and allow a bounded timeout. A future Edge Function must abort work before lease expiry or fail/release it. The function currently has no heartbeat/lease extension; do not deploy it for long-running analysis without a measured execution-time bound.
