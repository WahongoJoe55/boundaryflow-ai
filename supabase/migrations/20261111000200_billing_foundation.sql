-- BoundaryFlow billing foundation (schema only; no live provider integration).
-- REVIEW / STAGING ONLY. Do not apply to production without schema review,
-- backup/rollback evidence, provider eligibility confirmation and approval.
BEGIN;

CREATE TABLE IF NOT EXISTS public.plan_catalog (
  plan_key text NOT NULL CHECK (plan_key ~ '^[a-z][a-z0-9_-]{1,31}$'),
  version integer NOT NULL CHECK (version > 0),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  billing_interval text NOT NULL CHECK (billing_interval IN ('none', 'month', 'year')),
  entitlements jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(entitlements) = 'object'),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_key, version, currency),
  CHECK ((billing_interval = 'none' AND amount_minor = 0) OR billing_interval <> 'none')
);

CREATE TABLE IF NOT EXISTS public.billing_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_key text NOT NULL,
  plan_version integer NOT NULL,
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  provider text NOT NULL CHECK (provider IN ('mpesa', 'paypal', 'manual')),
  provider_subscription_id text,
  status text NOT NULL CHECK (status IN ('incomplete', 'trialing', 'active', 'past_due', 'cancelled', 'expired', 'unpaid')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  grace_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (plan_key, plan_version, currency)
    REFERENCES public.plan_catalog(plan_key, version, currency),
  CHECK (current_period_end IS NULL OR current_period_start IS NULL OR current_period_end > current_period_start),
  UNIQUE (provider, provider_subscription_id)
);

CREATE INDEX IF NOT EXISTS billing_subscriptions_user_status_idx
  ON public.billing_subscriptions(user_id, status, current_period_end DESC);

CREATE TABLE IF NOT EXISTS public.billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN ('mpesa', 'paypal', 'manual')),
  checkout_reference text NOT NULL UNIQUE,
  provider_transaction_id text,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL CHECK (status IN ('created', 'pending', 'paid', 'failed', 'expired', 'refunded', 'reversed')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_transaction_id)
);

CREATE INDEX IF NOT EXISTS billing_payments_user_created_idx
  ON public.billing_payments(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('mpesa', 'paypal')),
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  signature_verified boolean NOT NULL DEFAULT false,
  processing_status text NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processing', 'processed', 'ignored', 'failed')),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  failure_code text,
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_local_id text NOT NULL CHECK (length(analysis_local_id) BETWEEN 1 AND 160),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 200),
  plan_key text NOT NULL,
  plan_version integer NOT NULL,
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}
  period_end timestamptz NOT NULL CHECK (period_end > period_start),
  units integer NOT NULL DEFAULT 1 CHECK (units > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (plan_key, plan_version, currency)
    REFERENCES public.plan_catalog(plan_key, version, currency)
    DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (user_id, idempotency_key)
);

-- RLS is enabled on every billing table. The client may read only safe,
-- user-owned summaries. No client role may create or mutate billing state.
ALTER TABLE public.plan_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_catalog_read_active ON public.plan_catalog;
CREATE POLICY plan_catalog_read_active ON public.plan_catalog
  FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS billing_subscriptions_read_own ON public.billing_subscriptions;
CREATE POLICY billing_subscriptions_read_own ON public.billing_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS billing_payments_read_own ON public.billing_payments;
CREATE POLICY billing_payments_read_own ON public.billing_payments
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS usage_events_read_own ON public.usage_events;
CREATE POLICY usage_events_read_own ON public.usage_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.billing_customers FROM anon, authenticated;
REVOKE ALL ON public.billing_webhook_events FROM anon, authenticated;
REVOKE ALL ON public.billing_subscriptions FROM anon, authenticated;
REVOKE ALL ON public.billing_payments FROM anon, authenticated;
REVOKE ALL ON public.usage_events FROM anon, authenticated;
REVOKE ALL ON public.plan_catalog FROM anon, authenticated;

GRANT SELECT ON public.plan_catalog TO anon, authenticated;
GRANT SELECT ON public.billing_subscriptions TO authenticated;
GRANT SELECT ON public.billing_payments TO authenticated;
GRANT SELECT ON public.usage_events TO authenticated;

COMMENT ON TABLE public.plan_catalog IS
  'Versioned server-owned plan and price catalogue; seed only after pricing approval.';
COMMENT ON TABLE public.billing_subscriptions IS
  'Server-owned subscription state. Never accept plan or status changes from browser clients.';
COMMENT ON TABLE public.billing_payments IS
  'Server-owned payment ledger. Payment state changes require verified provider evidence.';
COMMENT ON TABLE public.billing_webhook_events IS
  'Webhook inbox with provider event idempotency; raw secrets and payment credentials must not be stored.';
COMMENT ON TABLE public.usage_events IS
  'Server-owned usage ledger; idempotency key prevents duplicate usage charges.';

COMMIT;
),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL CHECK (period_end > period_start),
  units integer NOT NULL DEFAULT 1 CHECK (units > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (plan_key, plan_version)
    REFERENCES public.plan_catalog(plan_key, version)
    DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (user_id, idempotency_key)
);

-- RLS is enabled on every billing table. The client may read only safe,
-- user-owned summaries. No client role may create or mutate billing state.
ALTER TABLE public.plan_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_catalog_read_active ON public.plan_catalog;
CREATE POLICY plan_catalog_read_active ON public.plan_catalog
  FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS billing_subscriptions_read_own ON public.billing_subscriptions;
CREATE POLICY billing_subscriptions_read_own ON public.billing_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS billing_payments_read_own ON public.billing_payments;
CREATE POLICY billing_payments_read_own ON public.billing_payments
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS usage_events_read_own ON public.usage_events;
CREATE POLICY usage_events_read_own ON public.usage_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.billing_customers FROM anon, authenticated;
REVOKE ALL ON public.billing_webhook_events FROM anon, authenticated;
REVOKE ALL ON public.billing_subscriptions FROM anon, authenticated;
REVOKE ALL ON public.billing_payments FROM anon, authenticated;
REVOKE ALL ON public.usage_events FROM anon, authenticated;
REVOKE ALL ON public.plan_catalog FROM anon, authenticated;

GRANT SELECT ON public.plan_catalog TO anon, authenticated;
GRANT SELECT ON public.billing_subscriptions TO authenticated;
GRANT SELECT ON public.billing_payments TO authenticated;
GRANT SELECT ON public.usage_events TO authenticated;

COMMENT ON TABLE public.plan_catalog IS
  'Versioned server-owned plan and price catalogue; seed only after pricing approval.';
COMMENT ON TABLE public.billing_subscriptions IS
  'Server-owned subscription state. Never accept plan or status changes from browser clients.';
COMMENT ON TABLE public.billing_payments IS
  'Server-owned payment ledger. Payment state changes require verified provider evidence.';
COMMENT ON TABLE public.billing_webhook_events IS
  'Webhook inbox with provider event idempotency; raw secrets and payment credentials must not be stored.';
COMMENT ON TABLE public.usage_events IS
  'Server-owned usage ledger; idempotency key prevents duplicate usage charges.';

COMMIT;
