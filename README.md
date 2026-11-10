# BoundaryFlow AI

BoundaryFlow AI is a decision-support workspace for freelancers and professionals. It compares a client's latest message with the scope and evidence supplied by the user, separates actionable requests, explains boundary decisions, and drafts client-ready responses.

## Canonical development candidate

**Use `index.html` as the only current application file on this branch.** It is the source used by the automated browser and regression suites.

Older root-level files named `BoundaryFlow_AI_v88_test.html` and `v87-test.html` are historical snapshots, not the current candidate. Do not use them for QA. The canonical candidate is maintained in the development branch:

- Branch: `work/engine-regression-suite-v1`
- Candidate file: [index.html](https://github.com/WahongoJoe55/boundaryflow-ai/blob/work/engine-regression-suite-v1/index.html)
- Draft review: [Pull request #1](https://github.com/WahongoJoe55/boundaryflow-ai/pull/1)
- Automated runs: [GitHub Actions](https://github.com/WahongoJoe55/boundaryflow-ai/actions)

## Backend-led QA

Changes to the development branch trigger the pull-request workflow. It runs:

1. The deterministic engine and project-ledger regression matrix.
2. The browser end-to-end suite against the canonical `index.html`.
3. Desktop and mobile screenshots plus machine-readable JSON reports.

The workflow artifact includes the exact tested `index.html` and the test reports. This means routine code changes can be inspected and verified from GitHub without repeatedly downloading a candidate, extracting it, starting a local server, and manually re-entering the same test scenario.

## Important test boundary

The automated browser suite uses synthetic identities and blocks real Supabase network access and cloud writes. It verifies local application behaviour, not live authentication, cloud persistence, retry/idempotency under real network failures, or production RLS. Those require a separately controlled integration environment and must not be inferred from a green local CI run.

## Product safeguards

- Scope decisions remain evidence-led and request-specific.
- Confidence and boundary risk are separate.
- Unknown revision usage, fees, deadlines, approval status, and dependencies must remain unknown.
- Client assertions and user-entered ledger labels are not treated as authenticated evidence.
- The freelancer remains the decision-maker; BoundaryFlow is not legal advice.

## Release boundary

Development changes stay on `work/engine-regression-suite-v1`. Production `main`, the live application, and Supabase must not be changed unless the user explicitly approves release.
