# BoundaryFlow AI — Engine Regression Matrix

**Baseline:** `main` / v87  
**Purpose:** Record expected decision behaviour before expanding language coverage.  
**Rule:** Tests must preserve uncertainty. A missing clause or missing approval record must not be converted into a confident scope conclusion.

## Classification contract

- **Likely included:** The supplied agreement positively supports the specific work.
- **Likely additional:** The agreement expressly excludes/reserves the work, or the supplied facts establish that the included allowance has been exhausted.
- **Scope conflict:** A relevant later record appears to conflict with an earlier term and needs careful comparison.
- **Clarify:** The agreement or request leaves a material fact unresolved.
- **Conditional:** The decision depends on an identifiable condition with materially different outcomes.
- **Client claim:** An assertion about entitlement/approval, not proof and not itself an actionable deliverable.
- **Confidence and boundary risk:** Separate measures; never infer one from the other.

## Core regression scenarios

| ID | Agreement / context | Client message | Expected behaviour |
|---|---|---|---|
| BF-R01 | Minor content edits to existing pages are included in the unused revision round. | Correct a spelling error on the existing About page. | Likely included; cite the revision allowance and identify the About page. |
| BF-R02 | New pages require separate approval. | Create a new Booking page. | Likely additional; do not confuse page creation with a link to that page. |
| BF-R03 | New functionality is excluded unless approved. | Add a booking form so visitors can reserve appointments. | Likely additional; explain the new visitor-facing capability. |
| BF-R04 | Third-party integrations require separate approval. | Connect the Contact form to HubSpot so enquiries enter the CRM automatically. | Likely additional; distinguish the existing form from the CRM integration. |
| BF-R05 | New functionality is excluded; minor corrections to existing functionality may be included. | Fix the submit button on the Contact form. No other facts are supplied. | Conditional or Clarify; ask whether an existing form is being corrected or a new capability is being added. |
| BF-R06 | New functionality is excluded. | Add a booking form. I thought we agreed it was included in the package. | Two distinct rows: the booking-form request is evaluated against the agreement; the entitlement statement remains a separate Client claim. |
| BF-R07 | Uploading/formatting up to five final, publication-ready client-supplied articles is included; original writing is excluded. | Upload and format three finished articles supplied with the message. | Likely included if the supplied content is final and within the allowance. |
| BF-R08 | Writing new blog articles is expressly excluded. | Write two new blog articles and research the topics. | Likely additional; distinguish original writing/research from uploading client-supplied final copy. |
| BF-R09 | New content sections are excluded unless separately approved in writing. | Add a testimonial section to the existing Home page; no approval record is supplied. | Likely additional; operational details such as layout or supplied testimonials must not be mistaken for approval. |
| BF-R10 | New pages and new functionality require approval; the agreement says nothing about new content sections. | Add a testimonial section to the existing Home page. | Clarify; do not silently equate a content section with a new page or new functionality. |
| BF-R11 | One revision round is included; the client confirms it has been used; additional rounds require approval. | Change the About-page heading in a second revision round. | Likely additional; the exhausted allowance must override the ordinary minor-edit rule. |
| BF-R12 | Minor links/buttons on existing pages are included; new pages require separate approval. | Add a normal button on the Contact page linking to a new Booking page. | Evaluate the existing-page button separately from creation of the destination page. |
| BF-R13 | New pages require separate approval. | Create a new Pricing page, then add a link to it from Services. | Decompose page creation and the existing-page link; preserve their dependency without allowing one decision to contaminate the other. |
| BF-R14 | No clause identifies the underlying work. | I thought this was included in the current revision. | Client claim / underlying request missing; ask what specific work is being discussed. |
| BF-R15 | The agreement is silent on whether a requested structural change is included. | Make the existing Services page more engaging and reorganise its sections. | Clarify unless the supplied agreement gives specific support; do not invent an allowance. |
| BF-R16 | The agreement requires written approval for changes beyond the agreed deliverables. | We discussed this on a call, so please treat the new feature as approved. | Preserve the statement as a claim; a claimed conversation is not the written approval record. |
| BF-R17 | Search engine optimisation and keyword research are excluded. | Please do keyword research and optimise the Services page for search engines. | Likely additional; match the specific SEO work to the express exclusion. |
| BF-R18 | Exported assets are included; editable source/working files are not. | Please send the editable design source files. | Likely additional; distinguish exported deliverables from editable working files. |
| BF-R19 | Initial launch is included; ongoing maintenance/support is excluded. | Provide ongoing website maintenance and support after launch. | Likely additional; do not imply that launch includes ongoing care. |
| BF-R20 | Migration of customer records and legacy content is excluded. | Migrate existing customer records and blog content. | Likely additional; identify migration as a distinct workstream. |
| BF-R21 | Written handover documentation is included; live staff training is excluded. | Run a live training session for staff. | Likely additional; distinguish documentation from live training. |
| BF-R22 | SEO metadata and page titles for five pages are included; no keyword-research exclusion is stated. | Add the agreed SEO metadata to the five pages. | Do not infer an exclusion; use Clarify if the exact included work is unresolved. |
| BF-R23 | Keyword research and SEO are expressly excluded. | Could you just do a quick bit of SEO and keyword research as a tiny favour? | Likely additional; minimising language does not change the written exclusion. |
| BF-R24 | One discovery workshop is included; additional workshops require a separate fee and approval. | Schedule another strategy workshop for the next phase. | Likely additional; evaluate the allowance and the extra workshop separately. |
| BF-R25 | Five pages of SEO metadata and page titles are included; keyword research and ongoing SEO are not specified. | Add the agreed SEO metadata to the five pages. | Likely included; explicit included evidence must outrank generic page-count/deliverable heuristics. |
| BF-R26 | Migration of existing customer records and legacy content is excluded. | Migrate the existing customer records and legacy blog content. | Likely additional; recognise migration verbs with intervening modifiers. |
| BF-R27 | One discovery workshop is included; additional workshops and strategy sessions require a separate fee and approval. | Arrange another strategy workshop. | Likely additional; recognise strategy workshops against the additional-workshop allowance. |
| BF-R28 | The agreement does not mention customer-record or content migration. | Migrate the existing customer records. | Clarify; do not invent an exclusion absent matching agreement evidence. |

## Language coverage to add and verify

The engine should recognise common professional wording without treating synonyms as proof of entitlement:

- **Agreement artefacts:** proposal, statement of work (SOW), scope of work, brief, project specification, service agreement, order form, approved estimate.
- **Work units:** deliverable, workstream, task, feature, functionality, component, content block, integration, implementation, handover.
- **Change language:** change request, variation, scope change, amendment, out-of-scope item, additional work, extra, add-on, enhancement, revision, rework.
- **Commercial terms:** fee, rate, estimate, quote, budget, payment, chargeable, billable, fixed price, retainer.
- **Delivery terms:** milestone, deadline, turnaround, acceptance criteria, sign-off, dependency, prerequisite, client-supplied material.
- **Approval language:** written approval, sign-off, authorised change, change order, email confirmation, verbal agreement, meeting discussion.

These terms must be interpreted in context. For example, mentioning a fee does not prove that a fee was agreed; mentioning approval does not prove that approval was given; and calling work a “small tweak” does not make it included.

## Release gate

Before a production version is promoted:

1. Run all 28 scenarios against the exact candidate build.
2. Record the actual detected request rows and classifications.
3. Investigate every mismatch; do not weaken an expected result merely to make a test pass.
4. Add a regression case for every confirmed defect.
5. Re-run the complete matrix after each engine change.
6. Keep the production `main` branch unchanged until the candidate is reviewed and accepted.
