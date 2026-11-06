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

The regression matrix contains 69 scenarios: 43 reasoning-engine cases and 26 project-ledger integrity / analysis-integration cases. The Playwright runner must execute exactly 69 cases and fail on a count mismatch. The runner checks the actual application build in isolated regression mode; CI blocks non-local network requests and does not use Save, Sync or History.

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
