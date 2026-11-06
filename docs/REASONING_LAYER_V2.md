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

The regression matrix contains 52 scenarios: 40 reasoning-engine cases and 12 project-ledger integrity cases. The Playwright runner must execute exactly 50 cases and fail on a count mismatch. The runner checks the actual application build in isolated regression mode; CI blocks non-local network requests and does not use Save, Sync or History.

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

## Ledger regression coverage

Twelve additional tests verify baseline provenance, amendment append behavior, required project and record fields, client-claim labelling, project/account isolation, append-only revision events, signed-in write context and safe rendering of untrusted text. The complete automated suite now contains 52 cases.
