# Live Supabase integration review plan

## Current status

The local browser end-to-end workflow passed 18/18 checks and the engine/ledger suite passed 69/69. Those checks deliberately stubbed Supabase and did not exercise real authentication, Postgres Row Level Security (RLS), cloud writes, cloud reads, or account separation in the live service.

A source review of the candidate's cloud integration was completed. The application uses the public Supabase publishable key in the browser, Supabase Auth sessions, and user-scoped queries for project and analysis listing. Project and agreement lookups by primary key rely on RLS to prevent cross-account access. Analysis updates additionally filter by the current user ID. These client-side filters are useful but are not a substitute for database RLS.

No SQL migration or RLS policy definition is present in this repository branch. The actual policies therefore cannot be independently verified from the repository alone.

## Safety boundary

- Use only the two dedicated test accounts already established for BoundaryFlow security testing.
- Do not share passwords, recovery links, access tokens, or secret keys in chat or commit them to GitHub.
- Use clearly labelled, disposable test projects, e.g. `BF-LIVE-A-<date>` and `BF-LIVE-B-<date>`.
- Do not use real client names, agreements, messages, or confidential project data.
- Do not run broad delete, truncate, reset, or schema-change SQL.
- Do not alter existing production projects or analyses.
- Keep the candidate on the draft PR. Do not merge or deploy as part of this review.
- The browser's local evidence ledger is not cloud-synced; this review checks cloud History/projects/agreements/analyses only.

## Live test sequence

### 1. Authentication and session
For each dedicated test account:
1. Open the candidate in a separate private/incognito browser profile or separate browser profile.
2. Sign in normally through the app's Cloudflare Turnstile flow.
3. Confirm the correct account email is displayed.
4. Reload once and confirm the session restores to the same account without showing the other account's workspace.
5. Sign out and confirm the signed-out view is shown.

Expected: no session crossover; no account-specific project, agreement, analysis, or draft appears under the other identity.

### 2. Account A cloud write/read
1. Sign in as Account A.
2. Create a unique project named `BF-LIVE-A-<date>`.
3. Enter a synthetic agreement and synthetic client message, then analyse and manually save.
4. Tap Sync now and wait for the explicit successful status.
5. Open History and confirm the saved analysis is present.
6. Reload and confirm cloud History is restored.

Expected: one project, one matching agreement snapshot and a saved analysis are visible to A. The local-only evidence ledger must not be described as cloud-synced.

### 3. Account B isolation
1. In a separate browser profile, sign in as Account B.
2. Create `BF-LIVE-B-<date>`, save a different synthetic analysis and sync.
3. Confirm B sees only B's project and analysis.
4. Search the visible History and project list for A's unique marker; it must not appear.

Expected: B cannot read A's records. A UI-level absence is necessary but not sufficient; database RLS verification is still required.

### 4. Cross-account direct access / RLS
Use Supabase SQL Editor only with read-only queries and the existing authenticated test setup. Verify RLS is enabled for `projects`, `agreements`, `analyses`, and `profiles`; inspect each policy's command, role, USING and WITH CHECK expressions. Confirm policies bind rows to `auth.uid()` and enforce parent-project ownership where applicable.

Start with these **read-only** catalog queries in Supabase SQL Editor. They inspect policy configuration; they do not alter data or schema.

```sql
-- RLS enabled/forced state for the four application tables
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('projects', 'agreements', 'analyses', 'profiles')
  and c.relkind = 'r'
order by c.relname;

-- Every policy, including command, roles, USING and WITH CHECK expressions
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
  and tablename in ('projects', 'agreements', 'analyses', 'profiles')
order by tablename, policyname;
```

Review the returned definitions, not just policy names. For each table, check the applicable SELECT, INSERT, UPDATE and DELETE policies. For child tables (`agreements`, `analyses`), verify both the row's `user_id` and the ownership of the referenced project are constrained consistently. An UPDATE policy normally needs a suitable `USING` expression for the old row and `WITH CHECK` expression for the new row. A policy name containing "own" does not prove its expression is correct.

If either query returns no row for one of the expected tables, stop and inspect the actual schema before drawing a conclusion. Do not run a migration or change a policy as part of this review.

Do not test this by changing JWT claims in the live project or issuing cross-account update/delete statements against real data. If direct policy simulation is needed, use a separate disposable Supabase project with a copied schema and synthetic rows.

Expected: all four tables have RLS enabled; authenticated users can read/write only their own rows; child rows cannot be attached to another user's project; no anonymous access is granted.

### 5. Sync recovery and duplicate handling
1. Save one analysis and wait for cloud save completion.
2. Tap Sync now twice sequentially, waiting for each completion.
3. Reload and check that History does not contain duplicate copies.
4. With a test-only network interruption (e.g. browser offline), attempt a save; confirm local History remains available and a clear sync failure/pending status is shown.
5. Restore connectivity and tap Sync now; confirm the pending analysis uploads once.

Expected: retries do not create duplicates; local data remains available after a cloud error; the status does not claim success while uploads remain pending.

### 6. Account switching and local cache
1. Sign out of A and sign in as B in the same browser profile only after recording the expected state.
2. Confirm the project/agreement/message fields are cleared or restored only from B's own account-scoped draft.
3. Sign back into A and confirm A's own History returns.

Expected: local autosave and History remain scoped by authenticated user identity.

## Evidence to record

For each check, record:
- test account label (A/B only; never email or credentials),
- synthetic project marker,
- visible status message,
- whether History persisted after reload,
- whether any foreign marker appeared,
- screenshot with email and personal data redacted if a visual record is needed.

## Pass criteria

All authentication, persistence, isolation, retry and duplicate checks pass. RLS is confirmed from actual policy definitions, not inferred from UI behavior. Any foreign record visibility, unexpected deletion, duplicate upload, false-success status, or RLS uncertainty is a release blocker.

## Current release decision

**Not yet approved for production.** This document is a controlled test plan, not evidence that live Supabase checks have passed. The actual Supabase policy definitions and live test outcomes must be reviewed before the draft PR can be considered for release.
