# Private candidate preview — setup and safety gate

**Status: CI candidate is green; no live preview has been deployed. Production has not been changed.**

## Verified candidate

- Candidate branch: `work/production-readiness-hardening-v1`
- Candidate commit: `783733bb1467d48c7f03b18acb3f4b733c8729d0`
- GitHub Actions run: `43229920778`
- Billing migration contract checks: 34 passed, 0 failed.
- Engine regression cases: 134 passed, 0 failed.
- Browser end-to-end checks: 87 passed, 0 failed.
- The browser E2E job uses deterministic simulated users and explicitly disables Supabase network access and cloud writes. It is not a live Supabase validation.

## Why a private live preview is not deployed yet

The GitHub repository is public. A preview published through its existing public Pages site or a public branch URL would not be private. The GitHub Pages settings endpoint could not be verified through the available repository interface, so this gate does not assume a separate Pages environment exists.

The candidate also must not be connected to production Supabase just to make a preview work. The current app's Supabase configuration and redirect allow-list need to be reviewed for a separate staging project before enabling authenticated cloud features.

## Required private-preview architecture

1. Create a separate staging Supabase project. Do not reuse production tables, users, service-role keys, or payment credentials.
2. Create a separate preview deployment in a hosting account controlled by the product owner. Enable access protection/password protection or an equivalent private access policy.
3. Deploy only the exact candidate commit above (or a later CI-green candidate), never the production branch.
4. Configure the preview origin in the staging Supabase Auth redirect allow-list. Keep production redirect settings unchanged.
5. Use only staging anon/public client configuration in the preview. Never put service-role keys, provider secrets, or merchant credentials in the HTML.
6. Verify sign-up/sign-in, password reset, sign-out, account isolation, local History, cloud sync, refresh behaviour, and theme persistence against staging.
7. Confirm the preview cannot read or write production data. Run negative tests with two staging accounts.
8. Keep billing disabled. Merchant setup is a later, owner-operated task using provider dashboards and a server-side secret manager.

## Candidate artifact for offline UI inspection

The CI run uploads the exact candidate HTML and test reports as a GitHub Actions artifact. This is suitable for inspecting the UI and source locally, but it is not a private hosted application and local-file authentication/cloud sync may not work. Artifact retention is limited; use the run's artifact link while it remains available.

## Acceptance gate before sharing a private URL

- Hosting owner and private-access method confirmed.
- Staging Supabase project provisioned and isolated.
- Preview origin and redirect allow-list verified.
- No production secrets or data present.
- Browser smoke tests pass against staging.
- Preview URL tested in a clean browser session.

Do not merge PR #22, alter production Pages, or enable payments as part of preview setup. These require separate approval.
