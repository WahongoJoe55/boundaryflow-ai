# BoundaryFlow reasoning safeguards v2

## Purpose

This layer adds conservative diagnostics around the existing scope classifier. It is decision support, not a legal-document parser, document authenticator, contract-management system, or complete project ledger.

## 1. Contradiction detection

- Scans supplied agreement text for included/excluded language attached to recognised work topics.
- Flags opposing statements about the same topic, including mixed wording in a single clause.
- Marks express superseding language as a possible superseding term.
- Does not decide which clause legally controls. The user must check dates, execution, authority, amendment conditions and the full document set.
- A missing approval record is not proof that approval never occurred.

## 2. Revision accounting

- Extracts a numeric revision allowance only where the supplied agreement states one.
- Extracts completed/current round information only where the supplied message explicitly states it.
- Leaves remaining rounds unknown if either side of the calculation is missing.
- Does not count individual edits as revision rounds.
- The displayed snapshot must be checked against project history and any later variations before being relied on.

## 3. Dependency mapping

- Detects explicit sequence/condition language such as “after”, “once”, “depends on” and “subject to”.
- Can flag a likely prerequisite where one detected request creates a page and another adds a link to it.
- Every inferred edge is labelled as inferred and should be confirmed.
- Dependencies do not change the independent scope classification of either request.

## 4. Evidence source labels

The diagnostic layer distinguishes supplied text that appears to refer to:
1. Signed/executed agreement or SOW.
2. Signed/approved amendment, variation or change order.
3. Written approval or email confirmation.
4. Meeting notes or call records.
5. Client assertions or unsupported claims.

These are source labels inferred from wording. BoundaryFlow does not authenticate signatures, sender identity, authority, timestamps, document integrity or completeness. Evidence priority is not a universal legal hierarchy: the relevant agreement may specify its own amendment and approval requirements.

## 5. Commercial safeguards

- Generated client actions/responses are checked for numeric fees and explicit deadlines not found in the supplied agreement or message.
- Unsupported values are replaced with “fee to be agreed” or “delivery timing to be agreed”.
- Supplied figures are preserved when they appear in the source text.
- This is a pattern-based guard, not a guarantee that every possible price, date, currency or commercial promise is detected.
- BoundaryFlow must never invent a fee, rate, deadline, payment term, approval or commitment.

## Regression coverage

The isolated Playwright regression runner now executes exactly 108 named scenarios and fails on a count mismatch. The scenario matrix is maintained separately; its IDs and expectations must be reconciled with the runner before release. The runner checks the actual application build in isolated regression mode; CI blocks non-local network requests and does not use Save, Sync or History.

## Release requirements

- Review every failed and passed case's actual detected request rows.
- Test representative real-world agreements and client messages, including ambiguous, contradictory and incomplete evidence.
- Verify the diagnostics are useful and do not create misleading certainty.
- Keep production unchanged until the candidate is reviewed and accepted.


## 6. Project evidence and change ledger (local candidate)

The project ledger is a separate, append-only register keyed by the signed-in account context and a normalized project name. It supports original scope baselines, amendments, approval records, change requests, revision events, dependencies, client decisions/clarifications and other evidence.

Each entry stores a user-entered title and detail, record type, source type, optional source date, optional related item, and a local recorded timestamp. A client assertion is explicitly labelled as an assertion and does not establish approval. Records are appended; the interface does not offer silent edits or deletion. Export produces a JSON copy for the user to store with the original project records.

Important boundaries:
- This implementation is browser-local only. It is not cloud-synced and does not change the Supabase schema, RLS policies, or production data.
- The project name is the local ledger key; use a consistent project name to return to the same ledger.
- A recorded source label is user-entered metadata, not authentication of a signature, sender, authority, date, integrity or completeness.
- A ledger entry is not proof that a contract term is legally effective or that a change is approved.
- No automated inference converts a claim into approval, amendment, revision usage or a delivery commitment.
- Exported JSON should be kept securely; browser local storage is not encrypted by BoundaryFlow.

Any future cloud-backed ledger requires a separately reviewed database design, tenant ownership model, RLS policies, migration plan, backup/retention review and cross-account tests. Do not automatically upload browser-local records.

## 7. Ledger-to-analysis context (local candidate)

When a project name is present, the analysis reads only the current signed-in account's local ledger for that exact normalized project name.

- Original-scope baseline entries labelled as Agreement / SOW are added as supplemental context; the agreement text entered in the analysis workspace remains intact.
- Amendments, approval records and client decisions are added to scope context only when their status is explicitly user-recorded as Approved and their source type is Agreement / SOW, Amendment / change order, or Email / written message.
- When an approved ledger entry appears to cover a request that the base agreement reserves for separate approval, the request remains Conditional until the original approval is checked. A user-recorded status alone never converts the request directly to Likely included.
- The applied context is visibly labelled user-recorded and not independently authenticated. It does not establish who signed, who had authority, whether the document is complete, or whether a date/sequence is valid.
- Client assertions, proposed or awaiting-approval records, declined records and superseded records are not applied as scope facts. They are surfaced separately in the reasoning panel where relevant.
- Revision records are shown as user-recorded history. A revision affects the allowance assessment only when its status is Delivered / completed and its title/details explicitly identify an ordinal revision round (for example, “First revision round”). For agreements that state a per-page allowance, the record must also identify the relevant page; another page’s rounds are not counted. Missing page association remains unknown. Individual edits are not counted as rounds.
- The reasoning panel identifies which ledger entries were used and which were excluded. The user must check original source documents before relying on any entry.
- If no project name or no eligible ledger records exist, the analysis follows its prior agreement/message path.

This is a conservative local integration, not a contract-priority engine or legal determination. Cloud sync is not enabled.

## Ledger regression coverage

Twenty-six ledger tests verify baseline provenance, amendment append behavior, required project and record fields, client-claim labelling, project/account isolation, append-only revision events, signed-in write context, safe rendering of untrusted text, and controlled ledger-to-analysis context. The complete automated suite now contains 69 cases.


## 8. Page-specific revision accounting safeguards

- A per-page revision allowance is evaluated against records that explicitly identify the same page.
- A revision event recorded for the Home page does not count against the About page.
- A delivered revision event with no ordinal round or no identifiable page is retained in the ledger but is not silently assigned to a page allowance.
- The app does not infer that a feedback message is a consolidated round merely because it contains several edits; that must be confirmed against the agreed revision process.
- User-recorded events remain unverified history and must be checked against the original project record.

- Page matching for approval and revision records uses the ledger title, detail and Related item field; this is still a text match, not document authentication.


## 9 November 2026 — regression harness correction

The first 108-case CI execution reported 106 passes and 3 failures, including one malformed empty array slot and two incorrectly escaped placeholder assertions. The runner has been corrected; the new run must independently verify the full suite. The prior result is retained as a failed run, not overwritten or described as passing.


## 9 November 2026 — negated scope-language safeguard

A negated exclusion (for example, “not excluded” or “not outside the scope”) is not affirmative proof that work is included. The topic-state parser now removes these negated exclusion phrases before checking for exclusion markers, leaving the topic unresolved unless separate positive scope language exists. Direct exclusion and “not expressly included” wording remain conservative exclusion signals. Three regression cases (BF-C12 to BF-C14) cover the neutral, direct-exclusion and not-expressly-included paths. This is a bounded language safeguard, not a general natural-language contract interpreter.


## 9 November 2026 — parser and harness correction

Run #314 failed at JavaScript parse time (`Unexpected token '{'`) before executing the scenarios. Inspection found a duplicate array separator before BF-C12 and a missing separator before BF-C08. The negated-exclusion normalizer also now recognises the phrase “not outside the agreed scope”. This run is a harness failure, not evidence about the underlying regression cases.


## 10 November 2026 — written-approval matcher correction

Run #316 executed the regression suite and found one failure: “requires separate written approval” was not recognised by the topic-state exclusion matcher, which only accepted “requires separate approval”. The matcher now accepts the optional word “written” in both “requires separate … approval” and “subject to separate … approval”. BF-C13 preserves this phrase as a direct exclusion/approval condition. Re-run the full suite before relying on the change.


## 10 November 2026 — request-to-clause evidence matching

Added `bfR2MatchEvidence(request, agreement)` as a conservative diagnostic. It extracts recognised request topics, matches only clauses sharing the same mapped topic, and reports `matched`, `partial`, `needs_review` or `unmatched`. It does not use general keyword proximity to borrow a clause from another topic, and explicitly states that textual matching does not authenticate a source or establish legal effect. Three adversarial regression cases (BF-E06–BF-E08) cover unrelated nearby clauses, absent topic evidence and mixed/conditional topic language. This helper is diagnostic only; it does not silently override the primary classifier.

The request-to-clause matching diagnostic is now included in the Reasoning safeguards panel for each actionable request. Each row displays its match state, directly matched clauses, and the reason for any unmatched or partial result. The result remains advisory and does not replace or silently alter the primary classification.


## 10 November 2026 — evidence conflict and confidence calibration

`bfR2MatchEvidence` now detects opposing included/excluded states across separate clauses for the same request topic and returns `needs_review`. Added `bfR2ApplyEvidenceConfidenceGuard`: for actionable requests with recognised topics, a non-matched evidence result caps an existing High confidence rating at Medium and records the match status, reason and matched clauses on the request. It never promotes confidence from lexical matching, does not change the scope classification, and does not downgrade solely because the topic map cannot recognise the request. Regression cases BF-E09–BF-E11 cover cross-clause contradiction, partial multi-topic coverage and the confidence cap.


## 10 November 2026 — regression test fixture corrections

Run #327 exposed two test-fixture issues, not a need to weaken the engine safeguards. BF-E10 correctly mapped “online payments” to the canonical topic `e-commerce and payments`; the test expectation now uses that exact canonical topic. BF-E11 originally inspected a naturally classified row whose confidence was already Medium, so it did not prove the cap transition. The revised test supplies a controlled High-confidence row to the guard and asserts the transition to Medium with an unmatched evidence status and recorded cap reason. Re-run all 117 scenarios before accepting the implementation.
