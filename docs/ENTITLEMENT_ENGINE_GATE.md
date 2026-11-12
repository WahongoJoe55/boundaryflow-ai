# BoundaryFlow monetisation engineering gate — entitlement boundary

**Status: partial server-side foundation committed for review; not deployed or connected to the application. No billing migration has been applied to staging or production.**

## Current repository state

- The canonical application remains a single-page `index.html`.
- The reasoning engine still runs locally in the browser through `analyze()`.
- Supabase Auth and Postgres support identity and cloud persistence; browser-side plan checks cannot enforce paid analysis limits.
- `supabase/functions/get-entitlement/index.ts` now provides a read-only entitlement endpoint. It validates the caller's Supabase JWT, derives the account ID from that identity, enforces an exact Origin allow-list, reads subscription and plan data server-side, and fails closed on ambiguous or missing state.
- The entitlement endpoint is a candidate source file only. It is not deployed, not connected to the UI, and has not been tested against a real staging Supabase project.
- Billing schema, atomic usage reservation, and reservation lease migrations are committed for review only. They have not been applied or executed against PostgreSQL.
- CI currently runs static billing-contract checks plus isolated browser tests. Static checks are not database execution, concurrency, RLS, webhook, or payment-provider tests.

## Non-negotiable enforcement boundary

The current browser-side `analyze()` function is bypassable. A hidden button, localStorage counter, subscription badge, or client-side entitlement response cannot protect paid analysis or Pro-only reasoning.

**Do not charge for enforceable metered analysis until the analysis execution itself is moved behind a trusted server-side endpoint.** Alternatively, the current browser engine must remain explicitly free/offline and paid value must be delivered only by independently enforceable server-backed services.

## Implemented candidate foundation

1. `get-entitlement`: read-only server-side subscription/plan lookup; no payment mutation.
2. Billing schema migration: provider-neutral customers, subscriptions, payments, webhook inbox and usage records.
3. Atomic usage reservation/finalization RPCs: service-role-only, per-account locking, idempotency binding and quota checks.
4. Reservation lease: 15-minute expiry and release of stale reservations on the next reservation attempt.

These components are design/code foundations, not a live monetisation system.

## Required implementation before paid analysis

1. **Staging database validation:** apply migrations only to an isolated Supabase staging project after schema, grants, indexes, constraints and rollback review.
2. **Entitlement endpoint tests:** exact CORS origin checks; missing/invalid/revoked JWT; account isolation; no subscription; one valid subscription; duplicate active subscriptions; expired periods; inactive plan; database outage; no sensitive fields in responses.
3. **Reservation runtime tests:** role grants, invalid quota, idempotent retry, mismatched idempotency key, concurrent quota boundary, completion/release, lease expiry, abandoned reservations and annual-period behaviour.
4. **Trusted analysis endpoint:** validate JWT, derive user ID from validated identity, check entitlement, reserve usage, run the reasoning engine server-side, then finalize or release usage. Never accept user ID, plan, quota or subscription state from the browser.
5. **Engine parity:** run the existing 133-case reasoning suite against the server execution path and compare deterministic outputs with the browser baseline before switching any user traffic.
6. **Failure handling:** timeouts, retries, cancellation, duplicate requests, server crash after reservation, bounded cleanup/reaper, rate limits and safe error responses.
7. **Free-tier policy:** define a server-owned free entitlement path if free users can use server analysis. Do not create an unmetered bypass accidentally.
8. **Privacy and operations:** data minimisation, retention, logging without client agreement text or tokens, monitoring, backup/restore and incident response.

## Payment integration boundary

Merchant credentials and provider onboarding are intentionally user-controlled and must be entered directly into the relevant provider dashboard or secret manager during the private setup walkthrough. Do not request credentials in chat, commit them to GitHub, put them in `index.html`, or expose them to browser storage.

Still required before accepting money:
- authenticated server-side checkout creation;
- M-Pesa callback authenticity and transaction reconciliation;
- PayPal webhook signature verification;
- event and transaction idempotency;
- reconciliation of account, plan, expected amount, currency and provider result;
- pending, paid, failed, expired, refunded, reversed and out-of-order event handling;
- cancellation, renewal, grace period, downgrade and refund behaviour;
- test-mode end-to-end checks using merchant-owned test credentials.

A browser redirect, receipt screenshot, STK prompt, or client-supplied payment status must never activate a subscription.

## Acceptance decision

The candidate is **not production-ready for paid analysis or payment collection**. The next engineering gate is isolated staging validation and a trusted server-side analysis path. Keep public registration and billing disabled until the relevant privacy, legal, security and operational gates are approved.
