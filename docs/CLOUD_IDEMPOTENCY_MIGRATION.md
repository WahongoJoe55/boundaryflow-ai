# Candidate cloud idempotency migration — review only

## Purpose
The current client checks `result_json->>localId` and then inserts when no row is found. Two tabs/devices can both observe no row and insert duplicates. The candidate now serializes same-analysis writes across same-origin tabs using the Web Locks API where supported. That reduces same-browser races, but it cannot coordinate devices or guarantee idempotency after an ambiguous timeout.

## Proposed database prerequisite
`migrations/20261111000100_analysis_local_id_unique.sql` adds nullable `public.analyses.local_id`, backfills it from existing JSON payloads, aborts if duplicate per-user IDs exist, and adds a unique index on `(user_id, local_id)`. Multiple NULL values remain permitted. The migration is transactional and deliberately does not delete or merge records.

## Required preflight — not yet completed
1. Export the live schema and confirm `public.analyses.result_json` is `jsonb`, `user_id` is the expected UUID ownership field, and the proposed column/index names do not conflict.
2. Inspect current constraints/indexes and row counts.
3. Run read-only duplicate detection:
   ```sql
   select user_id, result_json->>'localId' as local_id, count(*) as rows
   from public.analyses
   where jsonb_typeof(result_json) = 'object'
     and nullif(btrim(result_json->>'localId'), '') is not null
   group by user_id, result_json->>'localId'
   having count(*) > 1;
   ```
4. Verify a recoverable backup/PITR point and perform the migration in an isolated staging project first.
5. Review the migration and rollback with the database owner. Do not paste service-role keys into chat.

## Application rollout dependency
The current candidate still uses the legacy lookup-then-insert cloud save path. Do **not** switch the application to `upsert(..., { onConflict: 'user_id,local_id' })` until this migration has been applied and verified in staging and then explicitly approved for production. After that, change the save path to write `local_id` and use conflict-safe upsert; test timeout-after-commit, simultaneous devices, update ownership and stale-write behaviour. A unique index alone does not resolve last-writer-wins edits from separate devices.

## Rollback
If the migration is applied but the application has not started writing `local_id`, rollback can remove the index and nullable column:
```sql
begin;
drop index if exists public.analyses_user_local_id_uidx;
alter table public.analyses drop column if exists local_id;
commit;
```
Do not use this rollback after application writes depend on the column without first coordinating an application rollback and preserving/re-exporting affected data.

## Status
Prepared in the candidate repository only. **Not executed against staging or production.** No live Supabase schema or data was changed by this work.
