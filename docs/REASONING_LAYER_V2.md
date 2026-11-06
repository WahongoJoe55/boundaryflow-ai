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

The regression matrix contains 40 scenarios. The Playwright runner must execute exactly 40 cases and fail on a count mismatch. The runner checks the actual application build in isolated regression mode; CI blocks non-local network requests and does not use Save, Sync or History.

## Release requirements

- Review every failed and passed case's actual detected request rows.
- Test representative real-world agreements and client messages, including ambiguous, contradictory and incomplete evidence.
- Verify the diagnostics are useful and do not create misleading certainty.
- Keep production unchanged until the candidate is reviewed and accepted.
