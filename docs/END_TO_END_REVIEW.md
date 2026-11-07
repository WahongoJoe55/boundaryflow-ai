# BoundaryFlow browser end-to-end review

## Latest automated candidate verification

- GitHub Actions run: **#169**
- Run: https://github.com/WahongoJoe55/boundaryflow-ai/actions/runs/42289938482
- Result: **69 / 69 reasoning and ledger regression scenarios passed; 26 / 26 browser end-to-end checks passed**
- Tested candidate commit: `bbd054d530e892e7a1be744c3d1069e2d9e21652`
- Workflow job: `engine-regression` — completed successfully.
- Artifact: `boundaryflow-engine-regression-results` (contains regression and browser reports).
- Mode: local browser execution against the candidate `index.html`, with deterministic simulated account identities.
- External network access was blocked except for a stubbed Supabase library response. No real sign-in, Supabase queries, cloud writes, or production records were used.

The 69 regression scenarios cover the reasoning engine and project-local evidence ledger. The 26 browser checks cover application loading, ledger entry, evidence use/exclusion, clarification specificity, visible explanation, local History, reload persistence, project/account-key isolation, guide content and absence of uncaught browser errors.

The stricter clarification checks independently verified the deliverable name in each of title, needed, question and why for Careers page, Portfolio page and Contact form. Generic requests did not acquire an invented deliverable name.

## Subsequent theme-only patch — 7 November 2026

After run #169, commit `e2461c03b9a26c1d644db8aeac5334cb885b8856` corrected dark-theme presentation for:
- response-style selector;
- project-ledger inputs, dropdowns, textareas and placeholders;
- authenticated cloud sync message;
- cloud sync status badges.

The user downloaded this updated candidate, served it through the local HTTP server, signed in, and confirmed that the previously inconsistent interface elements now follow the selected theme. **This was a user-confirmed manual browser check, not a new automated workflow run.** Run #169 predates this CSS-only commit.

## Scenarios exercised by the automated browser review

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

The browser harness also checks that professional-language diagnostics remain internal while the visible analysis stays factual, and that the User Guide explains the ledger's local-only storage and export limitations.

## Cloud and authentication boundary

The candidate automated browser run deliberately stubs Supabase and blocks external cloud requests. It does **not** exercise real candidate-branch:
- sign-in, sign-up, password recovery or session restoration;
- Supabase queries, inserts, updates or deletes;
- candidate cloud sync and cloud History restoration;
- retry after an ambiguous network failure or concurrent sync;
- two real authenticated accounts and RLS enforcement.

A separate live smoke test on the **deployed production build** on 6 November 2026 confirmed:
- first cloud sync succeeded;
- the analysis remained in History after refresh;
- a second sequential sync did not create a duplicate;
- Account A and Account B could not see each other's test projects;
- the two cross-account deletion checks affected zero rows;
- RLS was enabled on `projects`, `agreements`, `analyses` and `profiles`.

Those are useful production observations, not candidate-branch live test results or a complete security audit. See [LIVE_SUPABASE_REVIEW_PLAN.md](LIVE_SUPABASE_REVIEW_PLAN.md).

## Remaining release acceptance checks

Before release, perform a controlled candidate-specific live test using only the two established disposable test accounts and synthetic content:

1. Sign in, refresh, confirm session restoration, then sign out.
2. Create a uniquely named synthetic project by entering a project/client label, agreed scope and client message; analyze and verify the expected output.
3. Switch between Professional, Warm and Firm response styles. Confirm the client-ready response changes while classifications and evidence remain unchanged.
4. Save the analysis, open it from History, refresh, and confirm it can be restored.
5. Sync the candidate. Confirm project, agreed scope and analysis are saved; refresh and confirm cloud History restores the record.
6. Sync again and confirm no duplicate analysis appears.
7. With Account B in a separate browser profile, confirm it cannot see Account A's synthetic project or analysis. Return to A and confirm its records remain.
8. If practical, test a controlled offline sync failure followed by reconnect and retry. Confirm local work remains available and retry does not create duplicates.
9. Confirm the project evidence ledger is intentionally local-only, remains available for the same account/project on that browser, exports correctly, and is not represented as cloud-synced.
10. Confirm Clear local workspace removes only the intended local data and does not imply that cloud records were deleted.

Do not use real client data. Do not expose passwords, recovery links, access tokens or secret keys. Do not run broad delete, truncate, reset or schema-change SQL.

## Release decision

**Keep PR #1 in draft. Do not merge or deploy yet.** Automated candidate reasoning/ledger and browser checks passed on commit `bbd054d`; the subsequent theme patch was manually confirmed by the user but has not had a new automated run. Most importantly, the development candidate has not yet been exercised against live Supabase. The production live checks do not substitute for candidate-specific verification. Reconcile the PR/base divergence, complete the candidate live acceptance checks, review the combined diff, and obtain explicit user approval before release.
