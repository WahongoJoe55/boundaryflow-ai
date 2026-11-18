# BoundaryFlow AI — Isolated staging deployment runbook

**Status:** Staging project `boundaryflow-staging` is created and verified empty. A production-metadata-derived core baseline migration has been added to the engineering branch; it has not been applied. The dedicated project reference is `zockowhjvharddpmdagh`.  
**Safety rule:** Do not link this procedure to the production project. Do not apply these migrations to production.

## 1. Required staging environment

Create a new Supabase project dedicated to BoundaryFlow testing. Keep its project reference, URL and credentials separate from production. Use a test account and synthetic agreement/client-message text only.

Before proceeding, confirm the project reference `zockowhjvharddpmdagh` belongs to `boundaryflow-staging` and that the project URL is `https://zockowhjvharddpmdagh.supabase.co`. In the dashboard, verify the project name and project URL before using the CLI. Production project reference is different; never link this workflow to production.

## 2. Verify the baseline schema, then apply reviewed migrations to staging only

**Baseline migration now present:** `20261110000100_core_application_baseline.sql` creates the four core tables (`profiles`, `projects`, `agreements`, `analyses`), production-matched defaults, constraints, foreign keys, indexes and 15 authenticated RLS policies. It intentionally uses plain `CREATE TABLE` so it fails closed if the target is not a fresh database. It has static contract coverage but still requires SQL review and execution against staging before it is considered validated. Never copy production customer data into staging.

Only after the baseline schema exists and has been reviewed, from the repository root authenticate the Supabase CLI and link it to the staging project:

```sh
supabase login
supabase link --project-ref <STAGING_PROJECT_REF>
supabase migration list
supabase db push
supabase migration list
```

The repository migrations are intended to run in filename order:

1. `20261111000100_analysis_local_id_unique.sql`
2. `20261111000200_billing_foundation.sql`
3. `20261111000300_atomic_analysis_usage.sql`
4. `20261111000400_usage_reservation_lease.sql`
5. `20261116000100_monthly_quota_windows.sql`
6. `20261116000200_analysis_result_replay.sql`

Review the CLI's target project before confirming any database change. If the linked project is not the dedicated staging project, stop. Do not use `db push` against production.

## 3. Configure Edge Function secrets

The function reads provider configuration only from server environment variables. Set the following in the staging project's Edge Function secrets:

- `BF_AI_PROVIDER`: `openai` or `gemini`
- `BF_AI_API_KEY`: the provider API key
- `BF_AI_MODEL`: a model identifier supported by the selected provider
- `BOUNDARYFLOW_ALLOWED_ORIGINS`: comma-separated exact browser origins permitted to call the function

Supabase supplies its standard `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` function environment values. Verify these exist in the function environment; never copy the service-role key into browser code or GitHub.

Example CLI shape (replace placeholders locally; do not commit values):

```sh
supabase secrets set \
  BF_AI_PROVIDER=<openai-or-gemini> \
  BF_AI_API_KEY=<PROVIDER_KEY> \
  BF_AI_MODEL=<MODEL_ID> \
  BOUNDARYFLOW_ALLOWED_ORIGINS=<EXACT_STAGING_ORIGIN> \
  --project-ref <STAGING_PROJECT_REF>
```

Use the actual staging browser origin. Do not add wildcard origins. Do not put provider keys, service-role keys, access tokens or customer agreement text in source files, screenshots, issues or chat messages.

## 4. Deploy the server function to staging

```sh
supabase functions deploy analyze-scope --project-ref <STAGING_PROJECT_REF>
supabase functions list --project-ref <STAGING_PROJECT_REF>
```

The function validates the caller's Supabase JWT itself and uses server-only credentials for usage reservation and provider calls. Keep platform JWT verification enabled unless a separately reviewed deployment design explicitly requires otherwise.

## 5. Required staging verification

Use synthetic data and a dedicated staging user. Do not use real client contracts or personal data.

- Confirm unauthenticated requests are rejected.
- Confirm a signed-in user can call the function only from an allowed origin.
- Confirm invalid JSON, malformed content length and oversized requests are rejected.
- Confirm provider failure releases a usage reservation.
- Confirm a successful request stores a replayable result.
- Retry the same idempotency key and payload; verify the stored result is returned without a second charge.
- Reuse the same idempotency key with a different payload; verify it is rejected.
- Submit simultaneous requests at the quota boundary; verify the per-account reservation lock prevents overspending.
- Confirm one test account cannot read another account's usage or results.
- Confirm expired reservations are released and do not consume quota.
- Confirm no agreement text, client message or provider key appears in logs.
- Run the browser end-to-end suite against the staging integration after the frontend is wired to the endpoint.

Record the project reference, migration versions, function deployment version, test timestamp and pass/fail evidence. Never record secrets or access tokens.

## 5A. Live model-reasoning benchmark

After the function is deployed, the staging user has a test entitlement, and the frontend origin is allow-listed, run the manual synthetic benchmark from a trusted local terminal:

```sh
BF_STAGING_FUNCTION_URL=<STAGING_FUNCTION_URL> \\
BF_STAGING_ANON_KEY=<STAGING_ANON_KEY> \\
BF_STAGING_USER_JWT=<STAGING_TEST_USER_JWT> \\
BF_STAGING_ORIGIN=<EXACT_STAGING_ORIGIN> \\
node tests/run-ai-reasoning-benchmark.mjs
```

The script sends eight synthetic scenarios covering included work, additional work, missing evidence, a client claim, contradictory clauses, independent mixed requests, irrelevant evidence and prompt injection. It checks actual provider outputs, exact evidence quotations, classifications, confidence/risk fields and request separation. It prints scenario IDs and pass/fail results, not source documents or credentials. Run it only against staging. A complete pass is required before model-quality review; this is a compact release gate, not a statistically comprehensive benchmark.

The staging account must have a valid test subscription and quota. Provision that entitlement through a reviewed server-side staging fixture; do not insert billing state from browser code.

## 6. Important integration status

The browser `analyze()` workflow now contains a guarded integration path that invokes the signed-in Supabase client Edge Function, maps validated server results into the existing BoundaryFlow result renderer, displays boundary risk independently from classification, and preserves local autosave. A mocked browser regression exercises this path.

**The integration is deliberately disabled by default** through `window.BF_SERVER_AI_ENABLED = false`. The current public application must continue using the deterministic analysis path. Do not enable the flag in a public GitHub Pages deployment. For staging browser verification, use a controlled staging-only build/origin and a reviewed, temporary enablement procedure; never publish an enabled build to the public production origin. The direct live benchmark in section 5A can independently verify the deployed function before the UI flag is enabled.

A successful static CI run or function deployment alone does not establish live model quality, real database correctness, or a complete browser-to-provider production workflow.

## 7. Rollback and production protection

These migrations are not approved for production. There is no automatic destructive rollback script. If staging validation fails, stop traffic to the staging function, preserve logs and test evidence, and prepare a reviewed forward-fix migration. Restore staging from its backup only if necessary and after preserving diagnostic evidence.

Production remains unchanged. Do not merge the draft engineering PR or deploy these changes to production until staging, frontend integration, model-quality evaluation, security review and release approval are complete.

## 8. Merchant/payment setup boundary

Merchant credentials and provider onboarding remain under the owner's control. Configure provider accounts only in accordance with each provider's eligibility, identity and account terms. Do not bypass age or account restrictions or use another person's credentials without their explicit authorization. Keep all payment secrets server-side.
