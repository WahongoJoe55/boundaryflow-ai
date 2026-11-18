# BoundaryFlow AI — Monetisation, Pricing and Payments Architecture

**Status:** proposed commercial design; not a live payment integration.  
**Branch:** `work/production-readiness-hardening-v1`  
**Rule:** no checkout, payment credentials, subscription activation or production schema changes until the server-side architecture and provider eligibility are verified.

## 1. Positioning and value hypothesis

BoundaryFlow is not another general freelancer CRM. Its differentiated job is to help a freelancer interpret a new client request against the actual agreement, isolate each request, distinguish evidence from client assertions, surface uncertainty and prepare a measured response. The paid value proposition should be reduced scope leakage, faster decisions, better documentation and more confident client communication.

Do not market reasoning sophistication as proof of correctness. The product needs a reviewed benchmark and a small paid pilot before making quantified claims about money saved, accuracy or return on investment.

## 2. Competitor landscape: pricing signals, not performance claims

Public pricing pages checked 11 November 2026 provide useful willingness-to-pay anchors:

| Product | Publicly listed entry / relevant tier | Primary proposition | BoundaryFlow implication |
|---|---:|---|---|
| Bonsai | Basic $9/user/month annually; Essentials $19 annually / $25 monthly | Freelancer CRM, time, projects; proposals/contracts/invoices in Essentials | Broad workflow suite; BoundaryFlow should not compete feature-for-feature |
| HoneyBook | Starter $29/month billed yearly; Essentials $49; Premium $109 | Client experience, proposals, contracts, invoices, scheduling, automation and AI | Higher all-in-one price ceiling, but broader scope and market limitations |
| Moxie | Public comparison reports Starter $10/month annually / $12 monthly; Pro $20 / $25 monthly | Freelancer business management | Useful lower-priced freelancer benchmark; verify current official page before launch |
| Indy | Public comparison reports free tier and Pro around $12.50/month | Proposals, contracts, invoices and client workflow | Free-to-paid conversion pattern is relevant; independently verify current terms |

These are list-price observations, not evidence of revenue, retention, customer satisfaction, profitability or market share. Competitor performance cannot be inferred from price pages. We need customer interviews, trial-to-paid conversion, retention and willingness-to-pay data from our own pilot.

Sources:
- Bonsai: https://www.hellobonsai.com/pricing
- HoneyBook: https://www.honeybook.com/pricing
- Moxie/Indy comparison: https://www.dealinsec.com/bonsai-alternatives

## 3. Recommended initial packaging (hypothesis to validate)

Use USD as the international reference price and a locally displayed KES price for Kenya. Avoid claiming a fixed FX equivalence; set local price bands and review periodically.

| Plan | Initial test price | Intended user | Entitlement concept |
|---|---:|---|---|
| Free | $0 | Evaluating BoundaryFlow | Small monthly analysis allowance; core classifications and evidence explanation; local workspace; no advanced change-request workflow |
| Solo | $12/month or $120/year | Independent freelancer using it regularly | Higher monthly analysis allowance; cloud history and sync; project/agreement workspace; response styles; saved decision trail |
| Pro | $24/month or $240/year | High-volume freelancer / consultant | Higher fair-use allowance; advanced change-request proposal workflow; revisions and comparison; richer project history; priority support only when operationally staffed |
| Founding cohort | $9/month for first 12 months, limited seats | Early pilot participants providing structured feedback | Solo feature set; explicit time limit and renewal price disclosure |

Indicative Kenya price tests: Free; Solo KSh 1,500/month; Pro KSh 3,000/month. These are research hypotheses, not final published prices. Do not silently convert USD prices using a hard-coded exchange rate. Offer annual billing only after monthly retention and value are evidenced.

Avoid unlimited AI usage at launch. Define fair-use limits from measured inference, storage and support costs. Show usage clearly and never silently block a workflow in progress.

## 4. ROI model and validation

Measure value per active customer rather than claiming a universal ROI:
- Time saved per analysis × customer's own hourly value.
- Avoided uncompensated work only when the customer confirms a boundary decision prevented it.
- Improved change-request capture only when a customer records a real approved additional-work outcome.
- Subtract subscription price and any customer-side operating costs.

Pilot measures: activation, first useful analysis, weekly active use, analyses per active user, user-rated usefulness, correction/override rate, false-positive and false-negative review, paid conversion, monthly retention, cancellations and support burden. Do not claim revenue saved from an analysis unless the user confirms the outcome.

## 5. Payment channels

### Kenya: M-Pesa via Safaricom Daraja

Daraja provides APIs connecting M-Pesa to web/mobile applications and has a sandbox. A future implementation can use an approved merchant/till/paybill arrangement and an STK Push flow where the merchant account and product eligibility permit.

Important distinctions:
- M-Pesa is a strong local payment rail, not a universally accepted international checkout method.
- Safaricom API access, merchant onboarding, production credentials, callbacks, settlement and business eligibility must be confirmed with Safaricom.
- Do not assume cross-border collection or foreign-currency settlement is included.
- Do not store a customer's M-Pesa PIN or request it in BoundaryFlow.
- An STK prompt is not proof of payment. Activate only after validating the server callback and reconciling the transaction with the expected account, amount, currency, checkout reference and status.
- Start with one-off monthly renewals if recurring collection is not explicitly supported and approved for the merchant arrangement. Do not label manual renewal as automatic subscription billing.

Official entry point: https://developer.safaricom.co.ke/

### International: PayPal

PayPal subscriptions and payment webhooks are a candidate international route. Before implementation, verify the user's PayPal account type, Kenya merchant receiving eligibility, subscriptions availability, supported currencies, withdrawal/settlement route, fees and business verification requirements. PayPal's current developer documentation states a Business account is required to go live and test outside the US; country-specific service availability can differ.

Never put PayPal client secrets in browser code. Create checkout and verify webhooks on a trusted server/edge function. Verify each webhook signature, event type, merchant account, amount, currency, subscription and idempotency key before changing entitlements.

Official docs:
- https://developer.paypal.com/api/rest
- https://developer.paypal.com/subscriptions/webhooks
- https://developer.paypal.com/api/rest/webhooks/

## 6. Shared server-authoritative billing model

Provider-neutral records should be designed before either provider is connected:

- `billing_customers`: one row per auth user; provider customer references; no payment credentials.
- `billing_subscriptions`: user, plan, status, provider, provider subscription reference, current period start/end, cancellation and grace-period timestamps.
- `billing_payments`: provider transaction reference, checkout reference, user, amount in minor units, currency, state, received/settled timestamps and safe metadata.
- `billing_webhook_events`: provider + unique event ID, signature verification result, received/processed timestamps and processing outcome.
- `usage_events`: user, analysis ID, plan period, units, idempotency key and creation timestamp.
- `plan_catalog`: versioned plan IDs and entitlements; price changes must not retroactively alter existing subscriptions without a disclosed migration.

All tables require RLS. Users may read their own safe billing and usage summaries but must not write their own plan, payment status, usage balance or entitlement fields. Only trusted server functions with narrowly scoped privileges may mutate those records.

The analysis endpoint must check the current server-side entitlement and reserve usage atomically before expensive work; successful completion commits usage, while safe failure paths release or reconcile reservations. Repeated requests must not double-charge usage. Define behaviour for refunds, reversals, disputes, expired subscriptions, failed renewals, grace periods, downgrades and cancellation-at-period-end.

## 7. Payment state machine and safety requirements

Suggested states: `created` → `pending` → `paid` / `failed` / `expired` / `refunded` / `reversed`.

- Every checkout has a random server-generated reference and expected user, plan, amount and currency.
- Provider callbacks are authenticated and persisted before processing.
- Enforce unique provider event IDs and provider transaction IDs.
- Replayed callbacks are harmless; out-of-order events cannot reactivate a cancelled/refunded subscription.
- Never activate from a browser redirect, screenshot, client-supplied receipt or unverified callback.
- Reconcile provider settlement records against internal payments.
- Record immutable audit events for entitlement changes.
- No service-role key or provider secret in HTML, localStorage, public GitHub repository or client JavaScript.
- Use a server-side function or equivalent trusted backend. GitHub Pages alone cannot securely hold provider secrets or verify callbacks.

## 8. Engineering sequence

1. Inspect and document current Supabase schema, auth, Edge Function availability and deployment model.
2. Confirm merchant/provider eligibility and legal operator requirements; no secrets shared in chat or committed.
3. Add reviewed schema migration for plan catalog, subscriptions, payments, webhook inbox and usage events. Test on isolated staging only.
4. Implement provider-neutral entitlement read/check and atomic usage reservation on the server.
5. Add M-Pesa sandbox integration and callback verification; test duplicate, forged, delayed, mismatched and failed callbacks.
6. Add PayPal sandbox subscriptions and signature verification; test activation, renewal, cancellation, failure, refund, reversal and duplicate events.
7. Add account billing UI and transparent plan/usage states; browser UI is display only.
8. Run full free/paid end-to-end tests including downgrade, expiry, support and account deletion.
9. Pilot with invited users; publish pricing only after cost and willingness-to-pay review.

## 9. Release blockers and decisions

- Existing PR #22 is a draft hardening PR and is not a payment release. Do not merge it as a billing implementation.
- Current repository has a review-only analysis idempotency migration; no billing schema or provider integration has been verified.
- Live Supabase schema, Edge Functions, secrets management and production callback URL are not confirmed in this review.
- Merchant eligibility, legal entity/operator identity, privacy terms, refund/cancellation terms, tax/accounting obligations and settlement are owner/provider decisions.
- Never apply migrations or change production payment settings without staging evidence and explicit approval.

## 10. Initial success criteria

Before charging customers:
- 10–20 invited freelancers complete realistic tasks and review the result quality.
- At least 5 independently confirm recurring value and willingness to pay at one of the test prices.
- No unresolved critical/high security or tenant-isolation findings.
- Verified payment callback and entitlement test matrix passes in sandbox.
- Unit economics are positive at realistic usage, including inference, database, payment fees, support and tax.
- Clear cancellation, refund, data export and deletion paths exist.

**Decision:** adopt the Free / Solo / Pro packaging as a test hypothesis, build server-authoritative entitlements first, support M-Pesa for Kenya and PayPal for eligible international customers, and do not claim M-Pesa is a global payment method or that BoundaryFlow is production-ready for paid subscriptions yet.
