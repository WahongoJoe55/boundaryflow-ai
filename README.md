# BoundaryFlow AI

BoundaryFlow AI is a decision-support workspace for freelancers and professionals. It compares a client's latest message with the scope and evidence supplied by the user, separates actionable requests, explains boundary decisions, and drafts client-ready responses.

## Current development candidate

- Production baseline: `main` at `ddeed3b1a8a0e8a4b4a34dfbb38b8c8fb0153002`
- Candidate branch: `work/production-readiness-hardening-v1`
- Candidate review: [Pull request #22](https://github.com/WahongoJoe55/boundaryflow-ai/pull/22)
- Canonical application file: `index.html`
- Regression workflow: [GitHub Actions](https://github.com/WahongoJoe55/boundaryflow-ai/actions)

Historical HTML snapshots and earlier development branches are not release candidates. Review and test the exact commit on PR #22, not an older downloaded copy.

## Automated verification

The candidate workflow runs:
1. The deterministic engine and evidence-ledger regression matrix.
2. The browser end-to-end suite against the candidate `index.html`.
3. Adversarial rendering checks for untrusted content in generated analysis output, History and the evidence ledger.

The latest successful full candidate workflow before the preview-build addition is [run 43229920778](https://github.com/WahongoJoe55/boundaryflow-ai/actions/runs/43229920778) on commit `783733bb1467d48c7f03b18acb3f4b733c8729d0`: 34/34 billing contract checks, 134/134 engine regression cases and 87/87 browser E2E cases passed. The updated workflow now also builds and verifies an isolated preview artifact; its results must be checked on the new commit before sharing that artifact. Re-run CI after every subsequent code or test change.

## Important test boundary

The automated browser suite uses synthetic identities and blocks real Supabase network access and cloud writes. It verifies local application behaviour, not live authentication, cloud persistence, cross-device retry/idempotency or production RLS. Web Locks reduce same-browser-tab races only; a database uniqueness constraint and conflict-safe write path are still required. Those require a separately controlled integration environment and must not be inferred from a green isolated CI run.

## Product safeguards

- Scope decisions remain evidence-led and request-specific.
- Confidence and boundary risk are separate.
- Unknown revision usage, fees, deadlines, approval status and dependencies must remain unknown.
- Client assertions and user-entered ledger labels are not treated as authenticated evidence.
- The freelancer remains the decision-maker; BoundaryFlow is not legal advice.

## Release boundary

Development changes remain on `work/production-readiness-hardening-v1`. PR #22 is open as a draft and is not merged. Production `main`, the live GitHub Pages application and Supabase must not be changed unless release is explicitly approved. Public registration is paused in the candidate while legal/privacy approval is outstanding. The candidate includes a baseline meta CSP/referrer policy, but response security headers remain unverified and the policy still permits inline scripts/styles. A reviewed database idempotency migration is prepared but has not been applied. The candidate is not approved for general production launch until live Supabase, direct API/RLS, cross-device sync, response security headers, legal/privacy, backup/restore, monitoring and independent review gates are evidenced.
