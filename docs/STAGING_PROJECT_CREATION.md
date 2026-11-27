# Create the BoundaryFlow AI staging Supabase project

This guide creates an isolated Supabase project for engineering verification. It does not modify or connect to the existing production database.

## A. Create the project in the dashboard

1. Open https://supabase.com/dashboard and sign in to the organisation that owns BoundaryFlow.
2. Select **New project**.
3. Choose the same organisation as production, if appropriate.
4. Set the project name to `boundaryflow-staging`.
5. Generate a new strong database password. Save it in a password manager; do not reuse the production password.
6. Choose a region close to the intended test users. Prefer the production region if available and suitable.
7. Select a plan that supports the database and Edge Functions required by the test. Check current plan limits before relying on free-tier capacity.
8. Create the project and wait until provisioning is complete.

## B. Verify isolation before any CLI command

1. Open the new project's **Project Settings** and confirm its name is `boundaryflow-staging`.
2. Record its project reference and project URL in a private engineering note.
3. Confirm the project reference and URL differ from production.
4. Open the staging project's API settings and identify its publishable/anon key.
5. Keep the database password, secret/service-role key, provider API key and test-user access token private. Never paste them into ChatGPT, GitHub issues, source code or browser JavaScript.
6. Do not import real customer agreements, client messages, production users or production billing records. Use synthetic test data only.

## C. Record the staging values locally

Keep these values in a password manager or an ignored local environment file, never in a committed file:

- Staging project reference
- Staging project URL
- Staging publishable/anon key
- Staging database password
- Provider name and model identifier
- Provider API key (secret)
- Exact staging browser origin

The project URL and publishable key are used by the client integration; provider and service-role credentials are server-only.

## D. Stop point

Creating the project does not apply migrations, deploy functions or enable AI. After creation, verify the project name and reference once more. Then follow `STAGING_DEPLOYMENT_RUNBOOK.md` from section 2. Before running `supabase link` or `supabase db push`, confirm the CLI target is the new staging project. If there is any doubt, stop.

**Never link this runbook to production. Never run the staging migration procedure against production.**
