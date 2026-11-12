// BoundaryFlow server-authoritative entitlement read endpoint.
// Deploy only after the billing migration has been reviewed and applied to staging.
// The function intentionally does not create or mutate subscriptions or payments.

import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const allowedOrigins = new Set(
  (Deno.env.get("BOUNDARYFLOW_ALLOWED_ORIGINS") ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean),
);

const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function response(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...jsonHeaders,
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
      "access-control-allow-methods": "POST, OPTIONS",
      "vary": "Origin",
    },
  });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") ?? "";
  if (!origin || !allowedOrigins.has(origin)) {
    return new Response(JSON.stringify({ error: "origin_not_allowed" }), {
      status: 403,
      headers: jsonHeaders,
    });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-max-age": "600",
        "vary": "Origin",
      },
    });
  }

  if (request.method !== "POST") {
    return response({ error: "method_not_allowed" }, 405, origin);
  }

  if (!supabaseUrl || !anonKey || !serviceRoleKey || allowedOrigins.size === 0) {
    return response({ error: "server_configuration_incomplete" }, 503, origin);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) return response({ error: "authentication_required" }, 401, origin);

  try {
    // Validate the caller's JWT with Supabase Auth; never trust a user_id from JSON.
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${match[1]}` } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return response({ error: "invalid_session" }, 401, origin);
    }

    // Service-role access is confined to this function. It is never returned.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const now = new Date().toISOString();
    const { data: subscriptions, error: subscriptionError } = await admin
      .from("billing_subscriptions")
      .select("id, plan_key, plan_version, currency, status, current_period_start, current_period_end, grace_period_end")
      .eq("user_id", authData.user.id)
      .in("status", ["active", "trialing"])
      .gt("current_period_end", now)
      .order("current_period_end", { ascending: false })
      .limit(2);

    if (subscriptionError) {
      console.error("entitlement_subscription_lookup_failed", subscriptionError.code);
      return response({ error: "entitlement_unavailable" }, 503, origin);
    }
    if ((subscriptions ?? []).length > 1) {
      return response({ error: "subscription_state_requires_review" }, 409, origin);
    }

    const subscription = subscriptions?.[0] ?? null;
    if (!subscription) {
      return response({
        authenticated: true,
        entitlement_status: "no_active_subscription",
        plan: null,
        subscription: null,
        server_time: now,
      }, 200, origin);
    }

    const { data: plan, error: planError } = await admin
      .from("plan_catalog")
      .select("plan_key, version, display_name, currency, amount_minor, billing_interval, entitlements")
      .eq("plan_key", subscription.plan_key)
      .eq("version", subscription.plan_version)
      .eq("currency", subscription.currency)
      .eq("is_active", true)
      .maybeSingle();

    if (planError || !plan) {
      console.error("entitlement_plan_lookup_failed", planError?.code ?? "inactive_or_missing_plan");
      return response({ error: "entitlement_unavailable" }, 503, origin);
    }

    return response({
      authenticated: true,
      entitlement_status: subscription.status,
      plan: {
        key: plan.plan_key,
        version: plan.version,
        name: plan.display_name,
        currency: plan.currency,
        amount_minor: plan.amount_minor,
        billing_interval: plan.billing_interval,
        entitlements: plan.entitlements,
      },
      subscription: {
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        grace_period_end: subscription.grace_period_end,
      },
      server_time: now,
    }, 200, origin);
  } catch (error) {
    console.error("entitlement_unexpected_error", error instanceof Error ? error.message : "unknown");
    return response({ error: "entitlement_unavailable" }, 503, origin);
  }
});
