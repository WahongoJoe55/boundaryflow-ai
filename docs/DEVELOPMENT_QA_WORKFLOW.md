# Development QA workflow

## Source of truth

`index.html` is the only canonical candidate. Do not use archived/versioned HTML snapshots for acceptance testing. Automated tests always load the repository's current `index.html`.

## Automatic checks

Every candidate update in the open pull request triggers GitHub Actions:

- deterministic reasoning and project-ledger regression cases;
- Playwright browser end-to-end tests;
- checks for mixed-message decomposition, evidence provenance, revision usage, tone invariance, client-response safeguards, History persistence, project/account-local ledger separation, and browser errors;
- desktop and mobile screenshots for visual review.

The workflow artifact packages the exact candidate HTML with test reports. The assistant can inspect the reports and screenshots from the run without asking the user to reproduce the same test locally.

## Review rules

- A passing automated suite is evidence for the tested behaviours, not proof of correctness for every possible contract or client message.
- Synthetic browser identities do not validate live Supabase authentication or authorization.
- Cloud sync, RLS, idempotency, and cross-account isolation need a controlled integration test against a non-production Supabase project or disposable test tenant.
- Never run destructive tests against real user records.
- A green CI result does not authorize merging or deployment.

## Human review reserved for

The user should only need to review material product decisions or subjective UX concerns that automated checks cannot settle. Routine regressions, repeatable edge cases, code review, and browser checks should be handled in the development workflow.
