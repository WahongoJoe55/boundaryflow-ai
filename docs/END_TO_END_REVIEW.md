# BoundaryFlow browser end-to-end review

## Candidate automated verification

- GitHub Actions run: #159
- Result: **22 / 22 browser checks passed** and **69 / 69 reasoning/ledger regression scenarios passed**
- Candidate commit: `be6c5f4b0f5967db1a5a0c86bb58307ed081ca59`
- Run: https://github.com/WahongoJoe55/boundaryflow-ai/actions/runs/42283784032
- Mode: local browser execution against the actual candidate `index.html`, with deterministic simulated account identities.
- External network access was blocked except for a stubbed Supabase library response. No real sign-in, Supabase queries, cloud writes, or production records were used.

The engine/ledger regression suite also completed successfully: **69 / 69 scenarios passed** in the same workflow run. The 21 browser checks include the updated `Client Request Context` label, the complete 12-step visual guide, explanations of ledger purpose/storage/export limitations, and a guide screenshot. All three guide-specific assertions passed.

## Current clarification-specificity change

The development candidate now includes a reusable clarification-subject preservation step. Where the request contains a reliably identifiable deliverable, it carries that subject into generic clarification titles, missing-information prompts, questions, explanations and outcome statements. Named page and form extraction is supported; when no reliable subject is available, the original generic wording is retained rather than inventing one.

Four new browser checks have been added to `tests/run-e2e.mjs`:
- Careers page specificity across title, explanation and question.
- Portfolio page specificity across title, explanation and question.
- Contact form specificity.
- Generic request fallback does not invent a deliverable.

**These four new checks have not yet been executed.** The previously recorded run #159 (22/22 browser checks and 69/69 engine/ledger scenarios) predates this change and must not be treated as validation of it. The next candidate workflow run must confirm the updated browser suite and existing 69-scenario regression suite before this change is considered verified.

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

The guide-specific checks are included in the browser result above. The candidate also verifies that request-language/professional-context diagnostics remain available internally while the analysis UI does not expose those labels or commentary.

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

The browser-level candidate workflow passed for the analysis engine, project-local evidence ledger, factual explanation output without client-language commentary, local History, reload persistence and project/account-key isolation under simulated identities.

## What these results do not establish

- The automated candidate run did **not** exercise real Supabase authentication, token refresh, RLS, cloud sync, cloud History, real two-account access, or live deployment.
- The production smoke test was performed on the deployed production build, not on this candidate branch.
- UI-level absence of another account's records and zero-row deletion checks are useful evidence, but are not a complete penetration test or security certification.
- RLS being enabled does not alone prove every possible access path is safe. The reviewed policies and test setup have the limitations described in the live review plan.
- Source labels and recorded statuses are user-entered metadata, not authentication of signatures, identity, authority, chronology, integrity or completeness. The ledger does not determine legal priority or prove that a change was approved.

## Release decision

**Keep this pull request in draft. Do not merge or deploy yet.** Candidate automated tests pass, and the deployed production build passed the narrow live sync/persistence/retry check. The latest base comparison shows the development branch is 118 commits ahead and 1 behind main. The sole base-only commit (80a80694) adds a separate BoundaryFlow_AI_v89_test.html test build; it does not modify production index.html or conflict with the candidate. GitHub currently reports the PR as mergeable. Keep the PR in draft until the combined diff is reviewed and release approval is given. Run an appropriate candidate-specific live smoke test if candidate cloud-related behavior changes. Any release must be explicitly approved before merging or deploying.
