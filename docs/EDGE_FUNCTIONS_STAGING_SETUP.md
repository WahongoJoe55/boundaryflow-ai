# BoundaryFlow Edge Functions — staging setup

**Status: first read-only endpoint committed; not deployed or connected to the UI.**

## Implemented endpoint

`supabase/functions/get-entitlement/index.ts`

- Accepts POST and CORS preflight only.
- Requires an explicit allow-listed Origin.
- Requires a Supabase access token and validates it with Supabase Auth.
- Derives the user ID from the validated token; ignores client-supplied identity.
- Reads subscription and plan data using the service-role client on the server.
- Returns only safe plan/subscription fields.
- Fails closed on ambiguous active subscriptions, missing/inactive plans, configuration errors and database errors.
- Sets `cache-control: no-store`.
- Does not mutate billing state, create checkout, reserve usage or execute analysis.

## Required function secrets

Set these in the isolated Supabase staging project's Edge Function secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BOUNDARYFLOW_ALLOWED_ORIGINS` — comma-separated exact HTTPS origins, with no paths or wildcard.

Never place the service-role key in `index.html`, GitHub, browser storage, logs, chat messages or a public environment variable. Do not ask a customer to provide it in the browser.

## Deployment prerequisites

Do not deploy until:
1. The billing migration has been reviewed and applied to an isolated staging project.
2. The Edge Function runtime supports the pinned Supabase JS v2 npm import.
3. Function secrets are set directly in Supabase.
4. The exact staging origin is configured.
5. A test user and controlled subscription/plan fixtures exist.
6. Staging database backups and rollback procedure are confirmed.

Deploy only this function to staging first. Do not apply migrations to production or enable billing UI as part of this step.

## Required staging tests

- Missing Origin, unknown Origin and wildcard-like Origin are rejected.
- OPTIONS succeeds only for the exact configured Origin.
- GET/PUT are rejected.
- Missing, malformed, expired and revoked JWTs are rejected.
- Account A cannot retrieve Account B's subscription by altering request JSON.
- No active subscription returns `no_active_subscription`.
- One valid active subscription returns the matching active plan.
- Expired, cancelled, unpaid and past-due subscriptions are not treated as active.
- Duplicate active subscriptions fail closed with 409.
- Missing/inactive plan and database outage fail closed.
- Response contains no user email, provider IDs, payment data, secrets or service-role material.
- Response is not cacheable.

## Known limitation

This endpoint is an entitlement **read** only. It does not yet enforce analysis quotas because the current analysis engine runs locally in `index.html`. It is not payment verification and cannot make browser-side analysis paywalling secure. A trusted analysis execution endpoint and atomic usage reservation are still required before charging for metered analysis.
