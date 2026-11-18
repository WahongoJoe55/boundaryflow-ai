-- Atomic, server-only analysis usage reservations. Review/staging only.
BEGIN;
ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS reservation_status text NOT NULL DEFAULT 'reserved'
  CHECK (reservation_status IN ('reserved', 'completed', 'released'));
CREATE INDEX IF NOT EXISTS usage_events_quota_count_idx
  ON public.usage_events(user_id, period_start, period_end, reservation_status);

CREATE OR REPLACE FUNCTION public.reserve_analysis_usage(
  p_user_id uuid, p_analysis_local_id text, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_subscription public.billing_subscriptions%ROWTYPE;
  v_plan public.plan_catalog%ROWTYPE;
  v_existing public.usage_events%ROWTYPE;
  v_limit integer;
  v_used bigint;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_user_id IS NULL OR p_analysis_local_id IS NULL
     OR length(p_analysis_local_id) NOT BETWEEN 1 AND 160
     OR p_idempotency_key IS NULL
     OR length(p_idempotency_key) NOT BETWEEN 16 AND 200 THEN
    RAISE EXCEPTION 'invalid_reservation_arguments' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT * INTO v_existing FROM public.usage_events
  WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'allowed', v_existing.reservation_status IN ('reserved', 'completed'),
      'idempotent_replay', true,
      'reservation_status', v_existing.reservation_status,
      'usage_event_id', v_existing.id,
      'period_start', v_existing.period_start,
      'period_end', v_existing.period_end
    );
  END IF;

  SELECT * INTO v_subscription FROM public.billing_subscriptions
  WHERE user_id = p_user_id AND status IN ('active', 'trialing')
    AND current_period_start IS NOT NULL AND current_period_end IS NOT NULL
    AND current_period_start <= v_now AND current_period_end > v_now
  ORDER BY current_period_end DESC LIMIT 2;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_active_subscription');
  END IF;
  IF (SELECT count(*) FROM public.billing_subscriptions
      WHERE user_id = p_user_id AND status IN ('active', 'trialing')
        AND current_period_start IS NOT NULL AND current_period_end IS NOT NULL
        AND current_period_start <= v_now AND current_period_end > v_now) <> 1 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'ambiguous_subscription_state');
  END IF;

  SELECT * INTO v_plan FROM public.plan_catalog
  WHERE plan_key = v_subscription.plan_key AND version = v_subscription.plan_version
    AND currency = v_subscription.currency AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'active_plan_unavailable');
  END IF;
  IF COALESCE(v_plan.entitlements->>'analysis_limit_monthly', '') !~ '^[0-9]{1,9}$' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'plan_quota_not_configured');
  END IF;
  v_limit := (v_plan.entitlements->>'analysis_limit_monthly')::integer;
  IF v_limit < 1 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'plan_quota_not_configured');
  END IF;

  SELECT COALESCE(sum(units), 0) INTO v_used FROM public.usage_events
  WHERE user_id = p_user_id
    AND period_start = v_subscription.current_period_start
    AND period_end = v_subscription.current_period_end
    AND reservation_status IN ('reserved', 'completed');
  IF v_used >= v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'usage_limit_reached',
      'used', v_used, 'limit', v_limit, 'period_end', v_subscription.current_period_end);
  END IF;

  INSERT INTO public.usage_events (
    user_id, analysis_local_id, idempotency_key, plan_key, plan_version, currency,
    period_start, period_end, units, reservation_status
  ) VALUES (
    p_user_id, p_analysis_local_id, p_idempotency_key,
    v_subscription.plan_key, v_subscription.plan_version, v_subscription.currency,
    v_subscription.current_period_start, v_subscription.current_period_end, 1, 'reserved'
  ) RETURNING * INTO v_existing;

  RETURN jsonb_build_object('allowed', true, 'idempotent_replay', false,
    'reservation_status', v_existing.reservation_status, 'usage_event_id', v_existing.id,
    'used', v_used + 1, 'limit', v_limit, 'period_end', v_existing.period_end);
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_analysis_usage(
  p_usage_event_id uuid, p_outcome text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_updated integer;
BEGIN
  IF p_usage_event_id IS NULL OR p_outcome NOT IN ('completed', 'released') THEN
    RAISE EXCEPTION 'invalid_finalization_arguments' USING ERRCODE = '22023';
  END IF;
  UPDATE public.usage_events SET reservation_status = p_outcome
  WHERE id = p_usage_event_id AND reservation_status = 'reserved';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_analysis_usage(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_analysis_usage(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_analysis_usage(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_analysis_usage(uuid, text) TO service_role;
COMMENT ON FUNCTION public.reserve_analysis_usage(uuid, text, text) IS
  'Atomic per-account quota reservation; service-role only; requires verified server identity.';
COMMENT ON FUNCTION public.finalize_analysis_usage(uuid, text) IS
  'Server-only completion or release of an existing reservation.';
COMMIT;
