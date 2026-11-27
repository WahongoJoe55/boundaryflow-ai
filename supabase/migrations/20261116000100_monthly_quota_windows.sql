-- Monthly quota windows for monthly and annual subscriptions.
-- Review/staging only. Do not apply to production without runtime verification.
BEGIN;
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
  v_month_offset integer;
  v_quota_period_start timestamptz;
  v_quota_period_end timestamptz;
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
    IF v_existing.analysis_local_id <> p_analysis_local_id THEN
      RAISE EXCEPTION 'idempotency_key_analysis_mismatch' USING ERRCODE = '22023';
    END IF;
    IF v_existing.reservation_status = 'reserved'
       AND v_existing.reservation_expires_at <= v_now THEN
      UPDATE public.usage_events
      SET reservation_status = 'released'
      WHERE id = v_existing.id AND reservation_status = 'reserved';
      RETURN jsonb_build_object(
        'allowed', false, 'reason', 'reservation_expired',
        'idempotent_replay', true, 'usage_event_id', v_existing.id
      );
    END IF;
    RETURN jsonb_build_object(
      'allowed', v_existing.reservation_status IN ('reserved', 'completed'),
      'idempotent_replay', true,
      'reservation_status', v_existing.reservation_status,
      'usage_event_id', v_existing.id,
      'period_start', v_existing.period_start,
      'period_end', v_existing.period_end
    );
  END IF;

  -- Expire stale reservations before counting quota. Only this user's rows
  -- are changed while holding the same per-account advisory transaction lock.
  UPDATE public.usage_events
  SET reservation_status = 'released'
  WHERE user_id = p_user_id AND reservation_status = 'reserved'
    AND reservation_expires_at <= v_now;

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

  -- Calculate monthly quota windows even for annual subscriptions.
  -- Anchor each window to the original billing start to avoid calendar drift.
  v_month_offset := (
    (date_part('year', v_now AT TIME ZONE 'UTC') - date_part('year', v_subscription.current_period_start AT TIME ZONE 'UTC')) * 12
    + date_part('month', v_now AT TIME ZONE 'UTC') - date_part('month', v_subscription.current_period_start AT TIME ZONE 'UTC')
  )::integer;
  v_quota_period_start := v_subscription.current_period_start + make_interval(months => v_month_offset);
  IF v_quota_period_start > v_now THEN
    v_month_offset := v_month_offset - 1;
    v_quota_period_start := v_subscription.current_period_start + make_interval(months => v_month_offset);
  END IF;
  v_quota_period_end := LEAST(
    v_subscription.current_period_start + make_interval(months => v_month_offset + 1),
    v_subscription.current_period_end
  );

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
    AND period_start = v_quota_period_start
    AND period_end = v_quota_period_end
    AND reservation_status IN ('reserved', 'completed');
  IF v_used >= v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'usage_limit_reached',
      'used', v_used, 'limit', v_limit, 'period_end', v_quota_period_end);
  END IF;

  INSERT INTO public.usage_events (
    user_id, analysis_local_id, idempotency_key, plan_key, plan_version, currency,
    period_start, period_end, units, reservation_status, reservation_expires_at
  ) VALUES (
    p_user_id, p_analysis_local_id, p_idempotency_key,
    v_subscription.plan_key, v_subscription.plan_version, v_subscription.currency,
    v_quota_period_start, v_quota_period_end,
    1, 'reserved', v_now + interval '15 minutes'
  ) RETURNING * INTO v_existing;

  RETURN jsonb_build_object('allowed', true, 'idempotent_replay', false,
    'reservation_status', v_existing.reservation_status, 'usage_event_id', v_existing.id,
    'used', v_used + 1, 'limit', v_limit, 'period_end', v_existing.period_end,
    'reservation_expires_at', v_existing.reservation_expires_at);
END;
$function$;

COMMENT ON FUNCTION public.reserve_analysis_usage(uuid, text, text) IS
  'Atomic service-only usage reservation with monthly quota windows anchored to billing start; annual plans reset monthly.';
COMMIT;
