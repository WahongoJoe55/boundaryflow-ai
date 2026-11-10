# Live Supabase integration review plan

## Actual review status — 6 November 2026

This section records the results reported from the live BoundaryFlow production environment. It supersedes the earlier statement below that the live checks had not yet been run, but it does not turn the review into a full security certification.

### Production cloud persistence and duplicate handling

The deployed app at https://wahongojoe55.github.io/boundaryflow-ai/ was tested with a disposable synthetic project, synthetic scope and synthetic client message. The user confirmed all three outcomes:

- First cloud sync succeeded.
- The analysis remained in History after refreshing.
- A second sequential sync did not create a duplicate entry.

**Result: passed for this tested production workflow.** This does not establish that every retry, network interruption, concurrent sync or candidate-branch path behaves identically.

### Account separation and database inspection

Previously completed checks reported by the user:

- Account A and Account B each saw their own test project and not the other account's project.
- The cross-account deletion checks reported zero rows affected in both directions.
- Supabase catalog inspection returned RLS enabled for all four application tables:
  - `public.projects`
  - `public.agreements`
  - `public.analyses`
  - `public.profiles`
- RLS was not forced on those tables. This is not by itself proof of a vulnerability; table owners and privileged roles may bypass RLS in some contexts.

The returned authenticated policies were reviewed. Project policies bind CRUD operations to `user_id = auth.uid()`. Agreement read/insert/update policies additionally check parent-project ownership. Analysis insert/update policies validate user ownership and project/agreement association. Profiles are restricted by `id = auth.uid()`. Agreement and analysis delete policies use the row's `user_id` condition without the same explicit parent-project subquery; this is a defence-in-depth observation, not a demonstrated cross-account vulnerability. No policy or schema change is recommended on the evidence currently available.

### Important separation of environments

The live sync test was run on the **deployed production build**. The development candidate in PR #1 was tested by a separate automated browser harness that stubs Supabase and blocks external cloud requests. Do not describe the candidate branch as having passed live Supabase sync unless that candidate itself is separately tested.

## Scope and limitations

The checks above provide useful evidence, not a complete security audit. In particular, they do not prove:
- resistance to every direct API/RLS bypass attempt;
- correct behaviour under all session expiry, refresh-token, offline and concurrent-sync conditions;
- that the candidate branch and production build are identical;
- that browser-local evidence ledger data is encrypted or cloud-synced.

Do not expose passwords, recovery links, access tokens or secret keys. Continue using synthetic data only. Do not run broad delete, truncate, reset or schema-change SQL. No Supabase schema, policy or production record changes are authorised by this review.

## Original controlled test plan

Use only the two dedicated test accounts already established for BoundaryFlow security testing. Use clearly labelled, disposable test projects and synthetic agreement/message content. Do not use real client names, agreements, messages or confidential project data.

### Authentication and session
For each dedicated test account:
1. Sign in normally through the app.
2. Confirm the correct account identity is displayed.
3. Reload and confirm the session restores to the same account.
4. Sign out and confirm the signed-out view is shown.

### Account separation
1. Sign in as Account A and create a unique synthetic project.
2. Save and sync a synthetic analysis.
3. Sign in as Account B in a separate browser profile.
4. Confirm B sees only B's project and analysis; A's unique marker must not appear.
5. Return to A and confirm A's own records remain available.

### RLS catalog inspection

The following queries are read-only. They inspect policy configuration; they do not alter data or schema.

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

Review the returned definitions, not just policy names. For child tables (`agreements`, `analyses`), verify row ownership and referenced project ownership. An UPDATE policy normally needs a suitable `USING` expression for the old row and `WITH CHECK` expression for the new row. A policy name containing "own" does not prove its expression is correct.

### Sync recovery and duplicate handling

The production test covered a successful first sync, refresh persistence and a second sequential sync without duplication. A controlled offline/reconnect retry and concurrent-sync test have not been established by the evidence recorded here. If candidate code changes cloud persistence, test those behaviours against that candidate using only disposable synthetic data.

## Release decision

**Not yet approved for production release.** The deployed production build passed the narrow live persistence test, and the previously reported account-isolation and RLS inspection results are positive. The development candidate has passed its isolated automated checks, but it has not been exercised against live Supabase. Keep PR #1 in draft until the branch/base divergence is reconciled, the combined diff is reviewed, and any candidate-specific live checks required by its actual changes are complete.
