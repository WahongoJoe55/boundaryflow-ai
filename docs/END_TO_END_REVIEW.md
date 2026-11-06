# BoundaryFlow browser end-to-end review

## Candidate automated verification

- GitHub Actions run: #150
- Result: **18 / 18 checks passed**
- Candidate commit: `695c527bcd5d02e07ab5b69cc63e541c95ffc861`
- Run: https://github.com/WahongoJoe55/boundaryflow-ai/actions/runs/42267033170
- Mode: local browser execution against the actual candidate `index.html`, with deterministic simulated account identities.
- External network access was blocked except for a stubbed Supabase library response. No real sign-in, Supabase queries, cloud writes, or production records were used.

The engine/ledger regression suite also completed successfully: **69 / 69 scenarios passed** in the same workflow run.

## Scenarios exercised

1. Candidate application loads with analysis and ledger controls.
2. Original scope, approval, client assertion and revision records can be entered through the UI.
3. A recorded approval is supplied as supplemental analysis context.
4. Client assertion remains excluded from approval evidence.
5. A specific new-page approval remains Conditional pending source verification.
6. Portfolio revision usage is matched to the correct page and allowance.
7. Analysis visibly explains ledger provenance and unverified claims.
8. Analysis can be manually saved to History.
9. Saved analysis appears in History.
10. Project ledger survives reload when the project is reopened.
11. Saved History survives browser reload.
12. Switching projects isolates ledger records.
13. A client claim alone cannot approve a new page.
14. Beta analysis does not inherit Alpha approvals or revision events.
15. Returning to Alpha restores only Alpha ledger entries.
16. Switching account identity isolates the same project name.
17. Returning to the original account restores its ledger.
18. No uncaught browser JavaScript errors occurred.

## Separate live production smoke test — 6 November 2026

The deployed production app at https://wahongojoe55.github.io/boundaryflow-ai/ was tested separately using a disposable synthetic project and synthetic agreement/message. The user confirmed:

- First cloud sync completed successfully.
- The saved analysis remained in History after refreshing the app.
- A second sequential sync did not create a duplicate entry.

This is useful evidence for the **currently deployed production build's** cloud persistence and repeat-sync behavior. It is not evidence that the development candidate in this pull request was tested against live Supabase. The automated candidate run above deliberately stubbed Supabase and blocked external cloud requests.

Earlier production checks also reported:
- Account A and Account B could not see each other's project data in the UI.
- The two cross-account deletion checks each affected zero rows.
- Supabase catalog inspection showed RLS enabled on `projects`, `agreements`, `analyses` and `profiles`.

See [docs/LIVE_SUPABASE_REVIEW_PLAN.md](LIVE_SUPABASE_REVIEW_PLAN.md) for the observed policy structure, scope and remaining limitations.

## What the automated result establishes

The browser-level candidate workflow passed for the analysis engine, project-local evidence ledger, explanation output, local History, reload persistence and project/account-key isolation under simulated identities.

## What these results do not establish

- The automated candidate run did **not** exercise real Supabase authentication, token refresh, RLS, cloud sync, cloud History, real two-account access, or live deployment.
- The production smoke test was performed on the deployed production build, not on this candidate branch.
- UI-level absence of another account's records and zero-row deletion checks are useful evidence, but are not a complete penetration test or security certification.
- RLS being enabled does not alone prove every possible access path is safe. The reviewed policies and test setup have the limitations described in the live review plan.
- Source labels and recorded statuses are user-entered metadata, not authentication of signatures, identity, authority, chronology, integrity or completeness. The ledger does not determine legal priority or prove that a change was approved.

## Release decision

**Keep this pull request in draft. Do not merge or deploy yet.** Candidate automated tests pass, and the deployed production build passed the narrow live sync/persistence/retry check. Before release, update the development branch against the current base, inspect the resulting combined diff, and run an appropriate candidate-specific live smoke test if the candidate changes cloud-related behavior. Any release must be explicitly approved before merging or deploying.
