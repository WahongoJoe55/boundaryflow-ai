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

The last recorded successful candidate workflow is [run 43016828233](https://github.com/WahongoJoe55/boundaryflow-ai/actions/runs/43016828233) on candidate commit `74c520afa2bb4668f675f7eb56987fd11f57fb8c`, which reported 133 engine and 84 browser E2E scenarios passing. Re-run CI after every subsequent code or test change; documentation-only changes do not replace verification of application code.

## Important test boundary

The automated browser suite uses synthetic identities and blocks real Supabase network access and cloud writes. It verifies local application behaviour, not live authentication, cloud persistence, retry/idempotency under real network failures, or production RLS. Those require a separately controlled integration environment and must not be inferred from a green isolated CI run.

## Product safeguards

- Scope decisions remain evidence-led and request-specific.
- Confidence and boundary risk are separate.
- Unknown revision usage, fees, deadlines, approval status and dependencies must remain unknown.
- Client assertions and user-entered ledger labels are not treated as authenticated evidence.
- The freelancer remains the decision-maker; BoundaryFlow is not legal advice.

## Release boundary

Development changes remain on `work/production-readiness-hardening-v1`. PR #22 is not merged. Production `main`, the live GitHub Pages application and Supabase must not be changed unless release is explicitly approved. The candidate is not approved for general production launch until the outstanding live Supabase, security-header, legal/privacy, backup/restore, monitoring and independent review gates are evidenced.
