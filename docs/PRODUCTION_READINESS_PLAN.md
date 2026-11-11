# BoundaryFlow AI — Production Readiness Programme

**Status: NOT APPROVED FOR GENERAL PRODUCTION LAUNCH**  
**Audit baseline:** `main` commit `ddeed3b1a8a0e8a4b4a34dfbb38b8c8fb0153002`  
**Candidate hardening PR:** #22 — adversarial rendering regression tests  
**Scope:** single-page browser application, GitHub Pages hosting, Supabase Auth/Postgres, browser-local History and evidence ledger.

This document is a release gate, not a claim of certification. A green test suite cannot prove the absence of every defect, security weakness or incorrect scope decision. Production readiness means the listed risks have been tested to a defined level, operational owners have accepted the residual risks, and all launch-critical evidence is current.

## 1. Current evidence

| Area | Evidence currently available | Status |
|---|---|---|
| Deterministic reasoning and ledger | Candidate CI run `43015252253`: 133 engine + 82 browser E2E scenarios passed on the exact candidate SHA; stored-HTML payloads in History and ledger were verified inert | Passed for those scenarios; not a proof of all application paths |
| Production deployment | GitHub Pages deployment workflow succeeded for merge commit `ddeed3b` | Passed for that deployment |
| Live cloud persistence | One synthetic project: first sync, refresh restore and second sequential sync without duplicate | Partial pass |
| Account isolation | Two dedicated test accounts reportedly could not see each other's project; cross-account delete tests returned zero affected rows | Reported pass; repeat and preserve evidence |
| RLS configuration | Four application tables reported RLS enabled; policies reviewed from catalog | Partial; not independent security audit |
| Candidate live integration | Candidate E2E deliberately stubs Supabase and blocks external cloud requests | Not tested live |
| XSS/rendering hardening | Candidate CI run `43015252253`: 133/133 engine and 82/82 browser E2E passed, including stored-HTML tests for History and ledger | Partial pass; not full sink audit or independent penetration test |
| Legal and privacy documents | UI explicitly labels Terms and Privacy Notice Draft 0.1; operator and privacy contact, retention and deletion details incomplete | Blocked |
| Hosting security headers | No verifiable server-level CSP, HSTS, frame, MIME or referrer policy evidence in repository HTML | Unverified |
| Backup and restore | No documented tested restore drill or retention schedule found in reviewed docs | Blocked |
| Monitoring and incident response | No verified operational monitoring, support route, incident owner or response runbook found | Blocked |
| Accessibility and browser compatibility | Existing Playwright desktop/mobile screenshots; no full accessibility or supported-browser audit evidenced | Incomplete |
| Product decision quality | Adversarial synthetic regression cases; no independently reviewed representative customer benchmark | Incomplete |

## 2. Release gates

### Gate A — Source integrity and release controls
- Confirm one canonical production source and identify the exact deployed commit.
- Protect `main` with pull-request review, required CI checks and no direct pushes where repository plan/settings permit.
- Pin third-party GitHub Actions to immutable commit SHAs; review dependency provenance and updates.
- Require successful engine, browser, static security and build checks on the exact candidate SHA.
- Generate a release artifact and record its SHA-256; verify the deployed artifact corresponds to the approved commit.
- Maintain a tested rollback procedure and a preserved pre-release commit.

**Acceptance:** a reproducible release from a reviewed immutable commit, required checks green, deployment identity recorded, rollback demonstrated.

### Gate B — Application security
- Complete XSS review for every untrusted field reaching HTML/DOM sinks: project/client names, agreement text, messages, ledger metadata, History, restored cloud payloads and generated responses.
- Prefer DOM text APIs and safe node construction; retain contextual escaping wherever HTML templates remain.
- Test stored/reflected XSS, URL injection, attribute injection, malformed JSON, oversized inputs and prototype-shaped objects.
- Verify no service-role key, secret token, private key or privileged credential is shipped to the browser. A Supabase publishable/anon key is public by design; RLS is the authorization boundary.
- Configure hosting-level security headers where supported: Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy and frame restrictions. A meta CSP is not equivalent to all response headers; GitHub Pages configuration must be independently verified.
- Review Supabase Auth settings, CAPTCHA, redirect allow-list, email confirmation, password recovery, rate limits and session expiry.
- Review all browser storage, cross-tab logout, session switching, cache clearing and same-origin threat assumptions.
- Run independent dependency and static security scanning; triage all high/critical findings.

**Acceptance:** no unresolved critical/high findings; all untrusted sinks covered by adversarial tests; headers and auth settings verified in the served response/dashboard.

### Gate C — Supabase authorization and tenant isolation
- Export current schema, constraints, indexes, triggers and all RLS policy expressions from the live project using read-only inspection.
- Verify SELECT/INSERT/UPDATE/DELETE separately for `projects`, `agreements`, `analyses`, `profiles`.
- Verify both `USING` and `WITH CHECK` semantics for UPDATE; child-row ownership and parent-project/agreement ownership must be consistent.
- Test direct REST/API access as Account A, Account B and unauthenticated user. UI hiding is not an authorization test.
- Attempt cross-tenant read, insert with foreign project/agreement IDs, update owner/project IDs, delete foreign rows and access guessed UUIDs.
- Test expired/revoked sessions, refresh failure and sign-out across tabs.
- Review indexes and constraints that support tenant scoping and uniqueness. Do not change production schema or policies without a reviewed migration and rollback.

**Acceptance:** documented pass for every table/operation/role combination using disposable accounts; zero cross-tenant disclosure or mutation; independent policy review.

### Gate D — Cloud sync correctness and recovery
- Test first sync, sequential repeat, parallel double-click, concurrent tabs and simultaneous devices.
- Simulate timeout after server commit but before response, browser reload during upload, offline transition, reconnect, token refresh and retry.
- Verify stable local IDs and database uniqueness make writes idempotent under races; client-side lookup alone is not a concurrency guarantee.
- Test deletion queue confirmation, retry, already-deleted rows, authorization errors and sign-out during deletion.
- Verify old analyses cannot overwrite newer agreements or local edits.
- Verify project-name normalization/collisions and project/ledger rename semantics.
- Test pagination/limits beyond 50 analyses and 100 projects; ensure the UI does not imply complete history if limits truncate results.
- Confirm local-only ledger and localStorage limitations are accurately described.

**Acceptance:** no duplicate or lost analyses across fault-injection matrix; confirmed deletion semantics; pagination and sync completeness accurately surfaced.

### Gate E — Privacy, legal and data governance
- Replace draft Terms/Privacy Notice with reviewed, accurate, dated documents.
- Identify the operating legal entity/person, contact address, support email and privacy contact.
- Map data flows, purposes, lawful basis, processors/subprocessors, hosting regions, international transfers and retention.
- Determine applicable obligations in Kenya and target markets (including UK/EU/Canada/Australia as applicable) with qualified counsel/privacy support.
- Publish retention periods, backup expiry, data export, account closure, deletion request and incident/breach response processes.
- Explain local browser storage, shared-device risk, cloud storage, session sign-out and Clear local data accurately.
- Verify consent wording/version capture and ensure it matches actual legal documents and product behaviour.
- Define whether confidential client contracts may be submitted and what users should redact; do not promise encryption or confidentiality controls not actually implemented.

**Acceptance:** final legal/privacy review, real operator contacts, accurate processor/data-flow inventory, tested export/deletion process and approved retention schedule.

### Gate F — Reliability, operations and recovery
- Establish uptime/error monitoring for app load, auth, Supabase operations and deployment.
- Add privacy-safe error reporting; never log agreement text, client messages, credentials or tokens.
- Define incident severity, triage owner, escalation contact, customer communications and recovery objectives.
- Verify Supabase backup/PITR entitlement and configuration; perform a restore drill to an isolated project.
- Document RPO/RTO appropriate to the service and communicate actual service availability; do not promise an SLA without operational capability.
- Test GitHub Pages rollback and Supabase migration rollback.
- Establish support intake and customer data-access request handling.

**Acceptance:** a completed restore drill, monitored critical paths, named owner/on-call route, incident and rollback runbooks.

### Gate G — Product quality and human factors
- Build an independently reviewed benchmark of representative synthetic agreements/messages: simple, compound, contradictory, amended, incomplete, adversarial and multilingual/formatting variants.
- Have experienced freelancers and a qualified legal reviewer assess decision quality, evidence citations, false positives/negatives and uncertainty calibration.
- Verify the six classifications, confidence/risk separation, decomposition, provenance, revision chronology, commercial guardrails and tone invariance.
- Confirm all output labels are understandable and do not imply legal certainty or authenticated evidence.
- Complete accessibility checks (keyboard, focus, labels, contrast, screen reader basics) and supported-browser/device checks.
- Test large agreements/messages, Unicode, pasted email threads, tables and malformed input.
- Define support, feedback, correction and incident pathways.

**Acceptance:** benchmark reviewed and signed off; no critical misleading decisions; accessibility and browser acceptance recorded; customer-facing limitations clear.

### Gate H — Controlled launch
- Start with a small, invited pilot and synthetic or redacted data.
- Obtain explicit user consent for pilot terms and data handling.
- Review failures and user feedback weekly; provide a safe way to report incorrect analyses.
- Define stop conditions: cross-tenant access, data loss, confirmed XSS, credential exposure, materially misleading outputs, or uncontained sync duplication.
- Expand access only after the pilot review and all prior gates are signed.

**Acceptance:** pilot exit criteria met and residual risks accepted by the product owner.

## 3. Required evidence pack

The release record must include:
1. Approved commit SHA, PR review and CI run links.
2. Build artifact SHA-256 and deployed commit verification.
3. Engine/browser/accessibility/security scan reports.
4. XSS and input-boundary test report.
5. Supabase schema, RLS policy export and tenant-isolation matrix (secrets redacted).
6. Sync fault-injection and retry/idempotency report.
7. Backup/restore drill evidence.
8. Privacy/data-flow/retention inventory and final legal documents.
9. Monitoring, incident, support and rollback runbooks.
10. Product benchmark results and human-review sign-off.
11. Residual-risk register with owner, severity, mitigation and acceptance.

## 4. Explicit release blockers at audit start

- Draft legal documents and missing operator/privacy contacts.
- Candidate-specific live Supabase verification not established.
- Full direct API/RLS test matrix not evidenced.
- Concurrent and ambiguous-outcome sync idempotency not established.
- Hosting response security headers not verified.
- Backup/restore drill not evidenced.
- Operational monitoring, incident and support arrangements not evidenced.
- Independent product benchmark and accessibility sign-off not evidenced.

## 5. Change-control rules

- Do not perform destructive SQL or alter live policies/schema during this readiness review.
- Do not merge a test-only PR simply to make a dashboard green; inspect its actual diff and exact-head CI first.
- Do not deploy a candidate until the product owner explicitly approves the release after the evidence pack is complete.
- Do not claim a control is complete based only on code comments, a UI label, a test stub or an unverified prior report.
- Record failed tests, accepted limitations and unresolved findings; never silently downgrade severity.

## 6. Current decision

**NO-GO for general public production launch.** The application has a useful tested foundation and a successful recent deployment, but the evidence does not support a claim of fully proven production readiness. The blockers above require a combination of engineering work, live controlled verification, operational setup and owner/legal decisions. No automated workflow can legitimately complete the latter on behalf of the product owner.


## 7. Additional code-review findings (11 Nov 2026)

### Confirmed: short deterministic analysis identifiers
The application previously generated analysis IDs with an eight-hex-character (32-bit) FNV-style hash over agreement text, request text and project name. A collision is possible and can cause unrelated analyses to be treated as the same local History item. New analyses now receive random UUID/cryptographic-random identifiers, while an exact previously saved analysis reuses its existing ID. A regression test uses a known pair of distinct inputs that collide under the old 32-bit hash.

**Status:** implementation is on the candidate branch; candidate CI `43015252253` passed all 133 engine and 82 browser E2E tests.

### Confirmed: ledger-key collision and legacy migration
The browser-local ledger key previously used a 32-bit hash of the normalized ledger display name. It now uses a normalized, reversible code-point key with a `v2` namespace. The old `v1` key remains available for migration; records are migrated only when their recorded project identity matches, and ambiguous legacy entries are preserved rather than silently reassigned.

**Status:** implementation and migration cases passed in the candidate's 133 engine regression tests and 82 browser E2E tests. This is local-browser evidence, not a cross-device or cloud ledger guarantee.

### Additional: hostile stored values and rendering
Ledger identity and alias maps now use null-prototype objects, project IDs are validated before reuse, and History counters are constrained to bounded non-negative numeric text. Candidate browser tests seed stored HTML payloads into both History and the evidence ledger and verify that they remain inert text rather than creating `img`, `svg` or `script` elements.

**Status:** these focused adversarial tests passed in candidate CI `43015252253`. The complete application still needs a sink-by-sink XSS audit and independent security review.

### Still open: cloud idempotency
The saveItem flow performs a lookup by result_json localId and then inserts if none is found. The local in-memory queue only serializes writes within one tab. It does not protect concurrent tabs/devices. The database must enforce uniqueness on an appropriate per-user local ID, with a conflict-safe upsert/recovery path. Do not apply a production migration until the live schema and duplicate rows have been inspected and a rollback is prepared.

### Still open: legal and operational ownership
The deployed UI itself states that Terms and Privacy Notice are draft 0.1, and requires operator details, privacy contact, retention periods and deletion procedures. These cannot be completed by code changes alone; they require accurate owner input and qualified review.

### Evidence boundary
The candidate's Playwright workflow explicitly blocks Supabase network access and cloud writes. Passing that workflow does not establish live RLS, authentication, backup, restore, sync-race or hosting-header behaviour.
