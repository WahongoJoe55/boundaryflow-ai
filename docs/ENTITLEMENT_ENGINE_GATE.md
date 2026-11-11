# Monetisation engineering gate — entitlement boundary

**Status: design and schema draft only. No production billing has been enabled.**

## Critical finding from the current application

The current `index.html` runs the reasoning engine in the browser: the Analyze button invokes the local `analyze()` function. Supabase is currently used for authentication and cloud persistence, not as the execution boundary for the reasoning engine.

This means a browser-side plan check, hidden button, localStorage counter, or subscription badge is bypassable. It cannot securely enforce paid analysis limits or protect Pro-only reasoning. The browser contains the engine code and can be modified by the user.

**Therefore:** do not represent a client-side entitlement check as payment protection. Before paid analysis limits are enforced, move the metered analysis execution behind a trusted server-side endpoint, or explicitly accept that the current local engine is a free/offline feature and charge only for server-backed services. The first option is preferred if analysis is the paid core value.

## Repository findings

- The canonical app is a single-page `index.html`.
- Supabase Auth and Postgres are accessed directly by the browser using a public publishable key.
- The application calls `analyze()` locally from the Analyze button.
- The repository currently has a Supabase migrations folder but no `supabase/functions` directory or deployed billing endpoint evidenced here.
- Existing database tables reported in the live environment are `projects`, `agreements`, `analyses` and `profiles`.
- Existing analysis idempotency migration is review-only and must not be applied as part of this billing work.

## Schema draft

The adjacent migration `20261111000200_billing_foundation.sql` creates:
- `plan_catalog`: versioned prices and entitlement JSON.
- `billing_customers`: user mapping, no payment credentials.
- `billing_subscriptions`: provider, plan version, status and billing period.
- `billing_payments`: expected amount/currency, checkout reference and provider transaction ID.
- `billing_webhook_events`: deduplicated provider event inbox.
- `usage_events`: unique per-user idempotency key and metered analysis record.

RLS allows users to read only active public plans and their own subscription/payment/usage summaries. Client roles have no write access to billing state. Provider event inbox and customer mapping are not client-readable.

The migration deliberately does not seed prices, insert subscriptions, activate accounts, or create provider credentials. It is a review/staging migration only.

## Required server-side functions (not yet implemented)

1. `create-checkout`: authenticate user; load active server-owned plan; create checkout reference; call provider from server secret; persist pending payment; return only safe checkout instructions.
2. `mpesa-callback`: validate callback shape and merchant configuration; reconcile checkout reference, expected amount/currency, account reference and provider result; persist idempotently.
3. `paypal-webhook`: verify signature using PayPal's verification API; deduplicate event ID; reconcile resource/subscription/amount/currency; process out-of-order events safely.
4. `get-entitlement`: derive plan and usage from trusted rows; never accept plan/status from client.
5. `reserve-analysis-usage`: atomic reservation keyed by user + idempotency key; enforce active subscription and plan quota; avoid double counting on retry.
6. `complete-analysis` / `release-analysis-reservation`: commit or release reserved units after the server-side engine completes or fails.
7. `analysis`: execute the reasoning engine behind authentication and entitlement checks. This is required for enforceable paid analysis limits; a client-side engine cannot be secured by a browser check.

All provider secrets must be stored in Supabase Edge Function secrets or an equivalent secret manager. Never commit secrets or expose service-role keys in the browser.

## Migration review checklist

Before applying the migration to an isolated staging project:
- Export current schema and inspect extensions, grants, RLS defaults and naming conflicts.
- Confirm `auth.users` FK and UUID conventions.
- Verify supported PostgreSQL version and Supabase role grants.
- Check migration transaction behavior and rollback strategy.
- Confirm plan-catalog composite foreign keys and indexes.
- Test RLS as anon, Account A, Account B and service role.
- Test duplicate provider event IDs, duplicate transaction IDs and duplicate usage idempotency keys.
- Verify client cannot INSERT/UPDATE/DELETE subscription, payment, webhook or usage rows through PostgREST.
- Do not apply to production until independent review and explicit approval.

## Monetization acceptance gate

- Analysis execution is server-authoritative if analysis quotas/features are paywalled.
- Subscription activation occurs only after verified provider evidence.
- M-Pesa and PayPal events are signature/authenticity checked and idempotent.
- Amount, currency, user, plan and checkout reference are reconciled server-side.
- Failed, refunded, reversed, expired and out-of-order events cannot leave paid access incorrectly active.
- Usage reservation is atomic and retry-safe.
- Cancellation, downgrade, grace period, account deletion and refunds have tested behaviour.
- Free and paid customer journeys pass in staging.
