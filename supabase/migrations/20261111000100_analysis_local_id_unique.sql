-- BoundaryFlow analysis idempotency prerequisite.
-- REVIEW ONLY: do not run against production until schema, duplicate rows,
-- backups and rollback have been independently checked and approved.
BEGIN;

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS local_id text;

-- Backfill only well-formed local IDs already embedded in JSON payloads.
UPDATE public.analyses
SET local_id = NULLIF(BTRIM(result_json->>'localId'), '')
WHERE local_id IS NULL
  AND jsonb_typeof(result_json) = 'object'
  AND result_json ? 'localId'
  AND jsonb_typeof(result_json->'localId') = 'string'
  AND NULLIF(BTRIM(result_json->>'localId'), '') IS NOT NULL;

-- Abort safely if historical data already contains duplicate per-user IDs.
-- No records are deleted, merged or arbitrarily selected.
DO $$
DECLARE duplicate_summary text;
BEGIN
  SELECT string_agg(
    format('user_id=%s local_id=%s rows=%s', user_id::text, local_id, row_count),
    '; '
  )
  INTO duplicate_summary
  FROM (
    SELECT user_id, local_id, COUNT(*) AS row_count
    FROM public.analyses
    WHERE local_id IS NOT NULL
    GROUP BY user_id, local_id
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 20
  ) duplicates;

  IF duplicate_summary IS NOT NULL THEN
    RAISE EXCEPTION
      'BoundaryFlow migration aborted: duplicate (user_id, local_id) values require manual review: %',
      duplicate_summary;
  END IF;
END $$;

-- PostgreSQL permits multiple NULL local_id values while enforcing uniqueness
-- for every populated (user_id, local_id) pair.
CREATE UNIQUE INDEX IF NOT EXISTS analyses_user_local_id_uidx
  ON public.analyses (user_id, local_id);

COMMENT ON COLUMN public.analyses.local_id IS
  'Stable client-generated BoundaryFlow analysis identifier; unique per user when populated.';

COMMIT;
