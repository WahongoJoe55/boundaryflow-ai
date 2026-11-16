# BoundaryFlow AI — Isolated staging deployment runbook

**Status:** Prepared; not executed. The repository currently has no separately created staging Supabase project.  
**Safety rule:** Do not link this procedure to the production project. Do not apply these migrations to production.

## 1. Required staging environment

Create a new Supabase project dedicated to BoundaryFlow testing. Keep its project reference, URL and credentials separate from production. Use a test account and synthetic agreement/client-message text only.

Before proceeding, confirm the project reference belongs to the new staging project. In the Supabase dashboard, verify the project name and project URL before using the CLI.

## 2. Apply the reviewed migrations to staging only

From the repository root, authenticate the Supabase CLI and link it to the staging project:

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

## 6. Important integration status

The server-side `analyze-scope` function is implemented and its static/contract checks pass in CI. The existing browser `analyze()` workflow still uses the established deterministic analysis path; it has not yet been switched to invoke this Edge Function. Therefore a successful function deployment alone would not mean the application is using AI analysis. Frontend integration and end-to-end verification are a separate release gate.

## 7. Rollback and production protection

These migrations are not approved for production. There is no automatic destructive rollback script. If staging validation fails, stop traffic to the staging function, preserve logs and test evidence, and prepare a reviewed forward-fix migration. Restore staging from its backup only if necessary and after preserving diagnostic evidence.

Production remains unchanged. Do not merge the draft engineering PR or deploy these changes to production until staging, frontend integration, model-quality evaluation, security review and release approval are complete.

## 8. Merchant/payment setup boundary

Merchant credentials and provider onboarding remain under the owner's control. Configure provider accounts only in accordance with each provider's eligibility, identity and account terms. Do not bypass age or account restrictions or use another person's credentials without their explicit authorization. Keep all payment secrets server-side.
