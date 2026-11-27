# BoundaryFlow Edge Functions — staging setup

**Status (21 Nov 2026):** `get-entitlement` and `analyze-scope` implementations are present in the candidate branch. `analyze-scope` is deployed to the isolated staging project (`zockowhjvharddpmdagh`, active function version 1) and has been invoked. The live provider benchmark is blocked by HTTP 429 due to no remaining OpenAI API credit. The browser server-AI feature flag remains disabled; do not infer production readiness or a completed live browser integration from deployment or mocked tests.

## Implemented endpoints

### `supabase/functions/get-entitlement/index.ts`

Read-only entitlement endpoint described below.

### `supabase/functions/analyze-scope/index.ts`

Server-side analysis endpoint deployed to staging (active version 1). It validates the caller JWT, derives the user identity from Supabase Auth, reserves usage through service-role-only RPCs, calls the configured model provider server-side, validates structured output/evidence, and finalizes or releases usage. Its live provider execution has not completed successfully in the current staging test because the provider returned HTTP 429 for exhausted API credit. Do not call the model benchmark passed.

- Accepts POST and CORS preflight only.
- Requires an explicit allow-listed Origin.
- Requires a Supabase access token and validates it with Supabase Auth.
- Derives the user ID from the validated token; ignores client-supplied identity.
- Reads subscription and plan data using the service-role client on the server.
- Returns only safe plan/subscription fields.
- Fails closed on ambiguous active subscriptions, missing/inactive plans, configuration errors and database errors.
- Sets `cache-control: no-store`.
- Does not mutate billing state, create checkout, reserve usage or execute analysis.

## Gateway JWT configuration

`supabase/config.toml` sets `verify_jwt = false` only for this function so unauthenticated browser CORS preflight can reach the handler. This does **not** make the endpoint public: the handler requires a Bearer token and validates it with Supabase Auth before reading any account data. Keep this manual validation in place. Do not disable JWT verification for other functions.

## Required function secrets

Set these in the isolated Supabase staging project's Edge Function secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BOUNDARYFLOW_ALLOWED_ORIGINS` — comma-separated exact HTTPS origins, with no paths or wildcard.

Never place the service-role key in `index.html`, GitHub, browser storage, logs, chat messages or a public environment variable. Do not ask a customer to provide it in the browser.

## Deployment record and prerequisites

**Completed for staging:** the seven migration versions in `docs/STAGING_DEPLOYMENT_RUNBOOK.md` were applied and migration history checked; `analyze-scope` was deployed to staging and function version 1 was observed. The staging test account and entitlement fixture were also provisioned. The provider benchmark then failed at the provider boundary with HTTP 429 because no API credit remained. No production function deployment or production migration is authorised.

For a new isolated environment, do not deploy until:
1. The billing migration has been reviewed and applied to an isolated staging project.
2. The Edge Function runtime supports the pinned Supabase JS v2 npm import.
3. Function secrets are set directly in Supabase.
4. The exact staging origin is configured.
5. A test user and controlled subscription/plan fixtures exist.
6. Staging database backups and rollback procedure are confirmed.

Deploy only this function to staging first. Do not apply migrations to production or enable billing UI as part of this step.

## Required staging tests

**Outstanding live tests:** complete a successful synthetic provider run when a legitimate provider test allowance is available; verify successful result persistence/replay, changed-payload idempotency rejection, reservation release on provider failure, expiry, quota-boundary concurrency, and a real controlled browser-to-function request. Current mocked tests are not substitutes for these live checks.



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

`get-entitlement` is an entitlement **read** only. It does not itself enforce analysis quotas or verify a payment. `analyze-scope` is the separate trusted server-side analysis endpoint and includes atomic usage reservation, but its live provider execution and browser integration still require successful staging verification. Do not enable paid metered analysis or public billing until those tests and the remaining pricing, payment, privacy and operational gates are approved.
