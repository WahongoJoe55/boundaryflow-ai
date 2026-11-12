# BoundaryFlow AI — Monetization, Pricing and Payment Architecture

**Status: design proposal only — no checkout, payment credentials, merchant account, subscription table or entitlement enforcement is live.**
**Target branch:** `work/production-readiness-hardening-v1`
**Decision rule:** validate customer value before committing to prices; payment confirmation and plan entitlements must be server-authoritative.

## 1. Product positioning and value

BoundaryFlow should not compete as another all-in-one freelancer CRM. Bonsai, HoneyBook and Indy already bundle combinations of proposals, contracts, invoices, client management, scheduling and payments. BoundaryFlow's wedge is narrower and more defensible if the product consistently does one high-value job exceptionally well:

> Convert a messy client request and an agreed scope into an evidence-led decision, a clear next action and a professional response the freelancer can stand behind.

The value proposition is not “better AI” in the abstract. It is fewer avoidable scope disputes, less time interpreting long agreements and client threads, more consistent decisions, and a safer change-request conversation. Claims such as “prevents lost revenue” or “always gets scope right” must not be made without measured evidence.

### Competitor benchmark (public list prices observed 11 Nov 2026)

| Product | Public pricing observed | What it sells | Implication for BoundaryFlow |
|---|---:|---|---|
| Bonsai | Basic $9/user/month, Essentials $19, Premium $29 (annual-billing prices shown); monthly prices higher | Broad freelancer business management: CRM, projects, contracts, invoices/payments, scheduling, reporting | A specialist product at $12–24 must make its unique scope-decision value obvious; do not imitate the full suite |
| HoneyBook (US pricing page) | Starter $29/month, Essentials $49, Premium $109 (yearly-billing display) | Client experience platform: projects, proposals/contracts, invoices/payments, automation, scheduler, AI | Customers pay more for broad workflow consolidation; BoundaryFlow should price below broad suites until it proves a similarly recurring workflow |
| Indy | Free; Pro Bundle shown at $12.50/month on a two-year billing term | Affordable bundled proposals, contracts, invoices, clients, projects and AI assistant | Free/low-cost competition sets a real ceiling for freelancers who see BoundaryFlow as a small utility |
 
Sources:
- Bonsai: https://www.hellobonsai.com/pricing
- HoneyBook: https://www.honeybook.com/pricing
- Indy: https://weareindy.com/pricing

**Evidence limitations:** list prices and feature claims are not evidence of active users, retention, revenue, profitability, customer satisfaction or product performance. Public competitor pricing pages do not expose reliable comparative revenue or churn. This is a pricing/positioning benchmark, not a market-share or performance ranking. Recheck regional availability, currency, tax and billing terms before publishing any comparison.

## 2. Proposed commercial plan — test prices, not permanent promises

Use a simple 3-level ladder. Avoid feature-gating basic safety or hiding core reasoning behind a paywall.

| Plan | Proposed test price | Intended customer | Included value |
|---|---:|---|---|
| Free | $0 | Curious / occasional freelancer | 3 completed analyses per month; core request decomposition, classifications, evidence and reasoning, basic client-ready response; local workspace; no cloud history |
| Solo | $12/month or $120/year | Independent freelancer with recurring client work | 30 analyses/month; private cloud history and sync; multiple projects and agreements; saved analysis history; response tone controls; export/copy workflow |
| Pro | $24/month or $240/year | High-volume freelancer / consultant | 100 analyses/month; advanced change-request workflow; compare revisions/contract amendments; richer project history and reusable response patterns; priority support only once it can actually be delivered |

Prices are proposed experiments in USD, not finalized or published prices. Display localized KES estimates at checkout using a current exchange-rate source and disclose the actual charge currency and conversion/processor fees. Do not silently charge a KES equivalent from a USD plan.

### Why this is a better starting point than pricing purely from reasoning quality

- The $12 Solo test is close to Indy Pro's low-cost price point and below Bonsai Essentials, while selling a more specialized workflow.
- The $24 Pro test sits between Bonsai Essentials and Premium, but is justified only after advanced change-request and revision workflows are delivered and used.
- Annual plans offer a modest effective discount (two months free) and improve cash flow, but should be offered only after refund/cancellation terms and service reliability are clear.
- Do not launch Pro merely because the engine has many tests. Automated tests prove specific software behaviours, not customer-perceived value or decision accuracy in real contracts.

### Value-based pricing validation

Run a small, consent-based pilot with freelancers using synthetic or redacted material. Record:
1. Time to reach a scope decision before vs after BoundaryFlow.
2. Whether evidence and reasoning are judged useful and correct by the freelancer.
3. Reviewer disagreement and harmful false positives/false negatives.
4. Whether the drafted response is usable with light edits.
5. Weekly active use, repeat analyses, and retention.
6. Willingness to pay at $9, $12, $15 and $24 (do not lead respondents toward a preferred answer).
7. Support burden and average inference/hosting cost per completed analysis.

Choose the price that produces sustainable contribution margin and genuine repeat use, not the highest hypothetical willingness-to-pay answer. Publish no quantified savings or ROI claim until supported by pilot measurements.

## 3. Revenue scenarios (illustrative, gross subscription revenue)

| Paying customers | At $12/month | At $24/month |
|---:|---:|---:|
| 25 | $300/month | $600/month |
| 50 | $600/month | $1,200/month |
| 100 | $1,200/month | $2,400/month |
| 250 | $3,000/month | $6,000/month |

These are arithmetic scenarios, not forecasts. They exclude payment fees, taxes, refunds, chargebacks, AI/API costs, hosting, support, discounts and currency conversion. Track net revenue and gross margin, not only headline MRR.

## 4. Payments: M-Pesa plus international checkout

### M-Pesa

Integrate through Safaricom's official Daraja platform after the merchant/operator is eligible, approved and has the required business/individual onboarding completed. Official developer portal: https://developer.safaricom.co.ke/apis

For Kenya, the likely first flow is a customer-initiated M-Pesa Express/STK Push:
1. User selects a plan and billing period.
2. Server creates a pending order with a random immutable order reference, user ID, amount, currency and expiry.
3. Server initiates STK Push using server-held credentials.
4. User authorizes on their own phone.
5. Server receives the callback, validates the expected transaction/order/amount/shortcode and records the provider transaction ID.
6. Server performs a status reconciliation for ambiguous/missing callbacks; a browser success screen is never proof of payment.
7. Only after verified settlement does the server activate/extend the subscription and append a payment event.
8. Duplicate callbacks are idempotent; a callback for another user's order or a mismatched amount cannot activate entitlement.

Do not assume M-Pesa is universally accepted internationally. M-Pesa is a strong local option and has cross-border/mobile-money products in some corridors, but a Kenya Daraja merchant integration does not automatically let a customer in every target country pay. International checkout must be a separate adapter.

For an initial MVP, use customer-initiated monthly renewal with clear reminders if automatic recurring collection is not explicitly approved and implemented. Do not describe a manual STK Push as an automatic subscription. Confirm the exact Daraja products, callback requirements, transaction limits, fees, settlement and merchant eligibility with Safaricom before launch.

### International checkout

Keep a provider adapter so a future card/wallet provider can be added without changing the subscription/entitlement core. PayPal is a candidate to investigate because the operator already has an account, but verify that the account type, country, product, recurring billing and merchant settlement features are supported for the actual operating entity. Do not assume a personal PayPal account can receive commercial subscription payments or that every country is supported.

Never place provider secrets, PayPal client secrets, Daraja consumer secrets/passkeys, Supabase service-role keys or webhook signing secrets in `index.html`, browser JavaScript, Git history or public repository settings. Use server-side secrets only.

## 5. Server-authoritative billing model

The browser may display a plan, but it must never decide that a user is paid. The server must verify payment and enforce limits.

Proposed tables (names are provisional; inspect the live schema before any migration):
- `billing_customers`: user_id, provider_customer_ref, created_at.
- `billing_orders`: id, user_id, provider, plan_code, billing_period, amount_minor, currency, status, provider_checkout_ref, created_at, expires_at.
- `billing_events`: provider, provider_event_id, order_id, event_type, verified_at, payload_digest, processed_at; unique(provider, provider_event_id).
- `subscriptions`: user_id, plan_code, status, current_period_start, current_period_end, cancel_at_period_end, provider, provider_subscription_ref, updated_at.
- `usage_events`: id, user_id, analysis_id, event_type, units, created_at; unique user/analysis/event for idempotent charging.
- `plan_limits`: plan_code, period, analysis_limit, feature_flags, effective_from.

Security requirements:
- RLS denies users the ability to grant themselves a plan, change payment status, forge usage events or edit provider references.
- All plan changes and usage consumption happen in trusted server-side functions/database procedures after auth checks.
- Atomic quota consumption prevents simultaneous requests from exceeding limits.
- One successful payment event activates one matching order at most once.
- Webhook handlers verify provider authenticity, validate amount/currency/reference, tolerate retries, reject replay/duplicate events and record an audit trail.
- Handle pending, succeeded, failed, expired, refunded, disputed, cancelled and past_due states explicitly.
- Downgrade preserves user data; it only limits new premium actions. Cancellation should not unexpectedly delete customer history.
- Grace periods, refunds, tax treatment and renewal reminders must be explicit product policies.
- Do not store full card data or M-Pesa PINs.

## 6. Implementation sequence (do not skip gates)

1. **Schema discovery:** export current live Supabase schema, policies, indexes and functions read-only; verify candidate environment and backup. No billing migration until this exists.
2. **Commercial specification:** confirm plan names, limits, currency, trial, refund/cancellation and support terms.
3. **Entitlement core:** create migration and server-side functions with RLS, atomic quota enforcement and audit tests. No payment provider yet.
4. **Provider-neutral orders:** add order lifecycle and a sandbox/mock provider with replay, mismatch, duplicate and timeout tests.
5. **M-Pesa sandbox adapter:** Daraja sandbox STK Push, callback validation, status query, duplicate/replay handling and reconciliation.
6. **International provider adapter:** verify actual merchant account eligibility and provider recurring-payment/webhook documentation before selecting implementation.
7. **End-to-end billing:** free-to-paid, renewal, failure, cancellation, refund, downgrade, restore, cross-device and account-isolation tests.
8. **Pilot:** invite-only, no public paid launch until privacy/legal, support, refund and security release gates are signed off.

## 7. Acceptance tests for billing

- A user cannot grant themselves Solo/Pro by editing localStorage, network requests or browser state.
- A forged callback, invalid signature, wrong amount, wrong currency, wrong order, expired order or another user's order does not grant access.
- Replayed callback is processed once; duplicate event cannot extend a subscription twice.
- A valid provider settlement activates the correct user and plan once.
- Simultaneous analysis requests cannot exceed quota.
- Failed/pending payments do not grant paid access.
- Refund/chargeback/cancellation updates entitlement according to published policy.
- Existing customer data remains available after downgrade/cancellation.
- Account A cannot inspect or mutate Account B billing/order/usage records through UI or direct API.
- M-Pesa and international checkout both map to the same provider-neutral order and entitlement contract.

## 8. Open decisions requiring the account/operator owner

- Confirm the legally responsible merchant/operator and whether the payment accounts are eligible for commercial use. Do not bypass age, identity, merchant or provider eligibility checks; the responsible adult/legal operator must complete any required onboarding and approvals.
- Confirm M-Pesa merchant status/Paybill or Till availability and Daraja production approval.
- Confirm PayPal merchant/recurring-payment eligibility for the operating country and account type.
- Choose whether launch currency is USD with KES display estimate, or separate KES and USD price books.
- Approve pilot terms, final privacy notice, refunds, cancellation and support contact.

## 9. Decision

Proceed with **Free / Solo / Pro at proposed test prices of $0 / $12 / $24 monthly**, but do not publish or charge those prices yet. Build the provider-neutral entitlement foundation first, then M-Pesa sandbox, then a verified international provider. Keep the existing production branch and live app untouched until release approval.
