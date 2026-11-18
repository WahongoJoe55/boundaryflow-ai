# BoundaryFlow production operations runbook

## Release posture
- General public launch is NO-GO until the acceptance gates in `PRODUCTION_READINESS_PLAN.md` are evidenced and approved.
- Candidate registration is deliberately paused in this branch because the displayed Terms and Privacy Notice remain draft documents.
- Do not merge or deploy this candidate merely because isolated CI is green.
- Use synthetic data only for release testing. Do not place customer agreements, client messages, credentials or recovery links in CI logs or issue reports.

## Ownership required before launch
The product owner must name and record:
- accountable service operator and legal entity/person;
- security/incident decision-maker and backup contact;
- privacy/data-subject request contact;
- customer support contact and response target;
- database/hosting operator with emergency access;
- qualified legal/privacy reviewer.
These are intentionally unfilled; inventing contacts or responsibilities would be unsafe.

## Monitoring baseline
Current verified evidence is GitHub Actions regression CI. No independent production uptime monitor, Supabase alert routing, application error aggregation or on-call notification channel has been evidenced by this review.
Before launch, configure and test:
1. External uptime check for the deployed static application.
2. Supabase database/auth availability and resource alerts.
3. Browser-side error monitoring that captures stack/route/build metadata only; redact agreement text, client messages, email addresses, access tokens and local-storage values.
4. Alert routing to a named operator and backup.
5. A synthetic sign-in/sync canary using a dedicated test account and non-customer content.
6. A documented review cadence and alert acknowledgement target.
Do not claim an SLA until uptime and incident response can support it.

## Incident response
1. Record UTC start time, affected build SHA, symptom, scope and reporter; do not copy user content into the incident log.
2. Classify severity: suspected cross-account access, credential/token exposure, confirmed XSS or data loss is critical and triggers immediate launch/pilot suspension.
3. Preserve relevant logs and evidence with access restricted; never publish secrets or raw customer content.
4. Disable new registrations and pause sync/deployment if continued writes could worsen impact. Do not disable access controls or make speculative database edits.
5. Notify the named security/privacy owner and obtain qualified advice on applicable notification obligations and deadlines.
6. Contain the issue, prepare a reviewed fix, test it against synthetic cases and obtain independent review.
7. Communicate confirmed impact and remediation through the approved support/privacy channel.
8. Document root cause, affected data, recovery, notifications, follow-up owner and closure approval.

## Backup and recovery
Before launch, the database owner must:
- confirm the actual Supabase plan, backup/PITR entitlement, retention window and point-in-time coverage;
- record the last successful backup and restore point;
- create an isolated non-production restore target;
- perform a restore drill, verify projects/agreements/analyses/profiles relationships and RLS policies, and record timing;
- test application rollback separately from database migration rollback;
- define and approve achievable recovery point objective (RPO) and recovery time objective (RTO).
No backup entitlement or restore drill was verified during this code-only review. Do not tell customers that backups are enabled until verified.

## Static-site rollback
1. Record the exact deployed commit and deployment URL.
2. If a release regression occurs, revert the deployment source to the last known-good reviewed commit through the normal GitHub Pages deployment workflow.
3. Verify the deployed asset SHA/commit and run smoke tests for page load, sign-in, read-only History, and sync using synthetic accounts.
4. Keep a written record of who approved rollback and whether any database migration also requires rollback.
5. Never assume reverting static HTML reverses database schema changes.

## Customer data requests
The operator must implement a verified identity-check process for access, export, correction and deletion requests. Distinguish local browser data, live Supabase rows and backup copies. Document what the Clear local workspace control does (local-only) and what account/cloud deletion requires. Record completion and backup expiry without putting sensitive data into support tickets.

## Status
This runbook is a prepared operating procedure, not evidence that monitoring, backup, staffing, legal review or restore capability has been configured. Those remain launch blockers until the named owner completes and records them.
