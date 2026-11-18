# BoundaryFlow AI reasoning engine — version 3 engineering gate

**Status:** architecture and acceptance specification; not an implemented model integration.
**Applies to:** the candidate branch `work/production-readiness-hardening-v1`.
**Decision principle:** the engine thinks; the freelancer decides.

## 1. Current verified baseline

The current application executes `analyze()` in the browser. Request decomposition, classification, evidence matching, contradiction diagnostics, revision accounting and commercial safeguards are primarily deterministic JavaScript rules.

The latest recorded CI run on candidate commit `b7de1dbdc0445b917b3147946e33ced373d5a9aa` passed:
- 10 private-preview isolation checks;
- 34 billing migration contract checks;
- 134 engine regression scenarios;
- 87 browser end-to-end scenarios.

These results establish regression consistency for the tested candidate. They do not establish general AI reasoning quality, live Supabase behaviour, payment-provider integration or production readiness. No active model-provider API invocation or trusted server-side analysis endpoint is present in the current application.

## 2. Target reasoning architecture

Use a provider-neutral server-side model adapter. The model must never receive provider credentials from the browser, and the browser must never call a paid model provider directly.

### Stage A — input normalisation and provenance
- Accept the agreement/SOW text and the latest client message as separate, explicitly labelled sources.
- Preserve source text and stable source identifiers; do not silently rewrite the supplied evidence.
- Treat client messages, agreements, imported files and ledger entries as untrusted data, not executable instructions.
- Do not allow instructions embedded inside client text or documents to override system rules, expose secrets or change the task.

### Stage B — request and claim decomposition
- Extract each distinct actionable request independently.
- Separate requests from explanations, assumptions, entitlement claims, approvals, objections and conversational filler.
- Preserve dependencies and references between requests without merging their classifications.
- Ask for clarification when the requested deliverable cannot be identified safely.

### Stage C — evidence retrieval and grounding
- Retrieve only clauses relevant to the specific request, while retaining nearby exceptions, definitions and conditions.
- Return exact source quotations and character offsets or stable span references.
- Distinguish agreement text, approved amendments, written approvals, meeting records, user-entered ledger records and client assertions.
- Never treat a source label as proof of signature, identity, authority, completeness or legal effect.
- If evidence is missing, conflicting, indirect or unrelated, state that explicitly.

### Stage D — independent decision proposal
For each request, return a validated structured object containing:
- request text and request type;
- proposed classification: Likely included, Likely additional, Scope conflict, Clarify, Conditional or Client claim;
- supporting and opposing evidence spans;
- assumptions and missing information;
- confidence in the evidence-supported decision;
- boundary risk as a separate measure;
- dependencies and unresolved conditions;
- a concise explanation and practical next move.

The model must not invent a fee, deadline, revision count, approval, contract term, legal conclusion or delivery commitment.

### Stage E — deterministic challenge and validation
- Validate every evidence reference against the original supplied text.
- Reject quotations or offsets that do not exist in the source.
- Check for contradictory clauses, negation, exceptions, conditional approval, supersession language and missing chronology.
- Check that the explanation agrees with the classification and that confidence is not overstated.
- Run commercial-output safeguards against unsupported prices, dates and promises.
- Keep deterministic safeguards authoritative for format, provenance, identity, quotas and security; they must not pretend to prove semantic truth.

### Stage F — calibrated output
- Show the evidence and reasoning path, not hidden chain-of-thought.
- Explain the decisive evidence, uncertainty, alternative interpretation and what would change the decision.
- Keep confidence distinct from boundary risk.
- If the model or evidence validator fails, return a safe, explicit unavailable/needs-review result. Do not silently present an unverified model answer as a completed analysis.
- The freelancer remains responsible for scope, pricing, delivery and legal decisions.

## 3. Model adapter and provider controls

- Provider selection must be configurable server-side; no provider-specific SDK or key belongs in `index.html`.
- Store model credentials only in the server-side secret manager / Supabase Edge Function secrets.
- Pin model identifiers and prompt/schema versions; record non-sensitive version metadata with each analysis.
- Use bounded input/output sizes, timeouts, rate limits and per-account quotas.
- Do not log client agreement text, access tokens, payment details or model credentials.
- Review provider retention, data-processing, training-use and regional-processing terms before sending real client material.
- Use synthetic data for development until privacy terms and user-facing disclosures are approved.

## 4. Evaluation programme

The existing 134-case deterministic regression suite must remain intact as a baseline. Add a separately versioned, human-reviewed model benchmark; do not replace deterministic tests with model tests or weaken existing assertions to obtain a pass.

Benchmark categories must include:
1. Atomic decomposition of multi-request messages.
2. Claims versus actionable work.
3. Direct inclusion, exclusion and conditional clauses.
4. Negation, exceptions and contradictory clauses.
5. Amendments, chronology, supersession and approval conditions.
6. Ambiguous references and missing agreement evidence.
7. Multi-deliverable requests and dependencies.
8. Revision allowances, page-specific accounting and incomplete history.
9. Client assertions that conflict with supplied evidence.
10. Prompt injection inside messages and supplied documents.
11. Unsupported fees, dates, currencies and delivery commitments.
12. Long, noisy, poorly formatted and multilingual inputs.
13. False positives and false negatives on borderline scope decisions.
14. Provider timeout, malformed output, refusal and partial failure.

Each benchmark case needs a reviewed expected decomposition, evidence spans, acceptable classification(s), uncertainty conditions and prohibited claims. Have independent reviewers adjudicate disagreements. Measure per-class precision/recall, request-decomposition accuracy, evidence-span validity, unsupported-claim rate, calibration, abstention quality and latency/cost. Report results by scenario category; an aggregate score must not conceal a weak category.

## 5. Server-side execution and billing boundary

A paid analysis must execute behind a trusted server endpoint:
1. Validate the Supabase JWT.
2. Derive the account ID from the validated identity; never trust a browser-supplied user ID.
3. Apply server-owned free/paid entitlement policy.
4. Reserve usage atomically with an idempotency key.
5. Execute the model-assisted reasoning pipeline server-side.
6. Validate structured output and evidence references.
7. Finalise usage only on a completed analysis; release reservations on safe failure.
8. Return only the validated result and safe metadata.

The existing `get-entitlement` function is read-only and does not implement this pipeline. The current usage reservation RPC is service-role-only, but its `p_user_id` argument is safe only when called by a trusted function that derives the identity itself. The SQL migrations remain review/staging-only until runtime-tested.

## 6. Release acceptance gates

Do not describe the engine as AI-powered or production-ready until all of these are demonstrated:
- provider adapter deployed to an isolated staging project;
- model credentials configured privately by the project owner;
- JWT/account isolation and server-side entitlement tests pass;
- all current deterministic regression tests still pass;
- model benchmark results are reviewed and meet agreed category-level thresholds;
- evidence quotations and source spans validate against the original text;
- injection, hallucination, uncertainty and failure-path tests pass;
- reservation, retry, timeout, concurrency and quota-boundary runtime tests pass;
- privacy, retention, support, monitoring, backup and recovery controls are approved;
- candidate UI accurately communicates what the engine can and cannot establish.

No production migration, production secret change, public registration enablement, payment activation or merge is authorised by this specification.


## 7. First server-side endpoint implementation

The candidate now includes `supabase/functions/analyze-scope/index.ts` as an initial implementation for review and isolated staging tests.

- Supports OpenAI and Gemini adapters selected only through Edge Function environment secrets.
- Validates the Supabase caller JWT and derives the account ID from the verified user.
- Reserves monthly quota before calling the model.
- Uses bounded inputs, output schema checks, exact evidence-quotation validation and a conservative clarification fallback.
- Stores the validated result in a private result column for idempotent replay; browser roles receive column-level grants that exclude this confidential payload.
- Finalises usage only while the reservation lease is live; model/validation failures attempt to release the reservation.
- Logs error codes/categories only, not agreement text, client messages, tokens or provider keys.

**Not yet complete:** the endpoint is not deployed or runtime-tested; no provider secret is configured; the frontend still uses its existing browser-side `analyze()` path; plan pricing/free entitlement policy and live provider terms remain unapproved. The current paid-subscription reservation path has no free-tier entitlement path. The new SQL migration is review/staging-only.
