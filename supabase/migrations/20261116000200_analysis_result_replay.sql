-- Private, idempotent storage for validated AI analysis results.
-- REVIEW / STAGING ONLY. Never apply to production without runtime verification.
BEGIN;

ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS result_payload jsonb
  CHECK (result_payload IS NULL OR jsonb_typeof(result_payload) = 'object');

-- The result may contain confidential agreement/client-message quotations.
-- Preserve safe usage metadata reads, but never grant browser roles this column.
REVOKE SELECT ON public.usage_events FROM authenticated;
GRANT SELECT (
  id, user_id, analysis_local_id, idempotency_key, plan_key, plan_version,
  currency, period_start, period_end, units, created_at,
  reservation_status, reservation_expires_at
) ON public.usage_events TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_analysis_usage_result(
  p_usage_event_id uuid,
  p_result jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_updated integer;
BEGIN
  IF p_usage_event_id IS NULL
     OR p_result IS NULL
     OR jsonb_typeof(p_result) <> 'object'
     OR octet_length(p_result::text) > 65536 THEN
    RAISE EXCEPTION 'invalid_analysis_result' USING ERRCODE = '22023';
  END IF;

  UPDATE public.usage_events
  SET reservation_status = 'completed',
      result_payload = p_result
  WHERE id = p_usage_event_id
    AND reservation_status = 'reserved'
    AND reservation_expires_at > clock_timestamp()
    AND result_payload IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_analysis_usage_result(
  p_user_id uuid,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_event public.usage_events%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_idempotency_key IS NULL
     OR length(p_idempotency_key) NOT BETWEEN 16 AND 200 THEN
    RAISE EXCEPTION 'invalid_analysis_lookup' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_event
  FROM public.usage_events
  WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'reservation_status', v_event.reservation_status,
    'reservation_expires_at', v_event.reservation_expires_at,
    'result_payload', v_event.result_payload
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_analysis_usage_result(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_analysis_usage_result(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_analysis_usage_result(uuid, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_analysis_usage_result(uuid, text)
  TO service_role;

COMMENT ON COLUMN public.usage_events.result_payload IS
  'Private validated analysis result for idempotent server replay; never selectable by browser roles.';
COMMIT;
