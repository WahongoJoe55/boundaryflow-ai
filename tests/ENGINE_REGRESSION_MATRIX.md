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

## Reasoning and commercial safeguards

The next 12 scenarios exercise the new diagnostics layer. These are advisory checks, not document authentication or a complete project ledger.


| BF-R29 | New pages are included in the project. New pages are excluded unless separately approved in writing. | Create a new Careers page. | Flag opposing included/excluded statements about the same work category; do not silently choose one. |
| BF-R30 | The signed agreement says new pages are excluded. A later signed amendment expressly supersedes that term and says new pages are included. | Create a new Careers page. | Identify possible superseding language while preserving the need to verify chronology, authority and approval. |
| BF-R31 | One revision round is included; additional rounds require written approval. | The first revision round has been used. Please make the changes in the second revision round. | Calculate one included round, one completed round and zero remaining only from the explicit statements. |
| BF-R32 | Two revision rounds are included. | Please revise the About page heading. | Do not infer completed or remaining rounds without project history. |
| BF-R33 | The project includes the agreed pages and minor links. | After the Careers page is approved, add the navigation link to it. | Detect sequence/dependency and label it as inferred pending confirmation. |
| BF-R34 | New pages require separate approval; minor links on existing pages are included. | Create a new Careers page. Add a button on the Contact page linking to it. | Preserve separate scope decisions and identify the new page as a likely prerequisite for the link. |
| BF-R35 | Supplied text labels a signed agreement, approved change order, email confirmation and meeting notes. | The client says this was agreed on the call. | Distinguish source types without authenticating documents or treating labels as proof. |
| BF-R36 | New functionality is excluded unless approved in writing. | We discussed the booking feature on the call and you promised it was included. | Keep the statement as a client assertion, not proof or a verified contradiction. |
| BF-R37 | New page creation requires separate approval; no fee or deadline is supplied. | Create a new Careers page. | Inject a deliberately unsupported fee/deadline into a test response and verify the guard replaces it with terms to be agreed. |
| BF-R38 | The approved change order states a fee of $500 and delivery within 5 business days. | Proceed with the approved change order for $500 within 5 business days. | Preserve figures that are explicitly present in the supplied evidence. |
| BF-R39 | A supplied text label says: Signed agreement: SEO metadata for five pages is included. | The client says the PDF is signed and approved. | Clearly state that a source label does not authenticate signatures, identity, authority or document integrity. |
| BF-R40 | New integrations require separate written approval. No fee or deadline is stated. | Connect the website to the external CRM. | Verify generated client-facing actions do not invent numeric fees or delivery deadlines. |
| BF-R41 | New functionality is excluded unless approved in writing. | Build a customer portal so customers can log in, view order history and download invoices. | Likely additional; identify the portal's access, data and invoice capabilities and show the professional work context. |
| BF-R42 | Responsive design for desktop and mobile is included; defect-correction responsibility is not specified. | Fix the mobile navigation menu; it is not opening on small screens. | Clarify whether this is a defect in the delivered design or a new/changed behaviour request. |
| BF-R43 | Two rounds of revisions per page are included; usage history is missing. | I have a few more changes to the homepage layout after the previous feedback. | Clarify and check the homepage revision history before deciding whether another round is included. |

## Release gate

Before a production version is promoted:

1. Run all 83 scenarios against the exact candidate build.
2. Record the actual detected request rows and classifications.
3. Investigate every mismatch; do not weaken an expected result merely to make a test pass.
4. Add a regression case for every confirmed defect.
5. Re-run the complete matrix after each engine change.
6. Keep the production `main` branch unchanged until the candidate is reviewed and accepted.

| BF-L01 | Record original scope baseline with provenance. | Add a baseline record with source date. | Verify source type, date and recorded timestamp. |
| BF-L02 | Append amendment without replacing baseline. | Add an amendment after baseline. | Both entries remain separate and chronological. |
| BF-L03 | Require a project name. | Attempt a write with no project name. | Reject ambiguous project association. |
| BF-L04 | Require record details. | Attempt an approval with empty details. | Reject incomplete evidence records. |
| BF-L05 | Distinguish client assertion from approval. | Record a client assertion. | Display that an assertion does not establish approval. |
| BF-L06 | Isolate project ledgers. | Add a record to Alpha, then open Beta. | Beta remains empty. |
| BF-L07 | Isolate account ledgers. | Add under Account A, then switch to B. | Account B cannot read A's record. |
| BF-L08 | Append revision events. | Record two revisions. | Preserve both in original order. |
| BF-L09 | Require signed-in context. | Attempt a write without user ID. | Reject unauthenticated writes. |
| BF-L10 | Escape untrusted content. | Record markup-like title and details. | No injected HTML elements are rendered. |

## Ledger release gate

The ledger is browser-local and append-only. It is not cloud-synced, independently authenticated, or a replacement for original agreements and approval records. Any future cloud persistence requires a separately reviewed tenant-scoped schema and RLS migration. No local ledger records are silently uploaded.

| BF-L11 | Client assertion cannot be marked approved. | Attempt to assign approved status to a client-claim source. | Reject the status transition. |
| BF-L12 | Display recorded request status and source. | Add an awaiting-approval change request. | Show status and source type in the timeline. |
| BF-L13 | Approved amendment is recorded in the project ledger. | Analyse a new Careers page request with a user-recorded approved amendment. | Use the amendment as supplemental context; classify the request as Conditional until the original approval is verified. |
| BF-L14 | A client claim is recorded in the project ledger. | Analyse a new Careers page request with a client assertion in the ledger. | Keep the claim visible but exclude it from scope facts and preserve the underlying boundary. |
| BF-L15 | An amendment is awaiting approval. | Analyse a new Careers page request with a pending amendment. | Do not apply the pending amendment to the scope classification. |
| BF-L16 | The first revision round is recorded as completed. | Analyse a later About-page edit. | Use the user-recorded revision event in the allowance assessment while showing that the record is not independently verified. |

| BF-L17 | Per-page revision history is isolated by page. | Record a completed Home-page round and assess About-page usage. | Home-page history does not count against About. |
| BF-L18 | Two completed rounds exhaust the same page allowance. | Record first and second homepage rounds, then assess another homepage request. | Two completed rounds are recorded against the two-round homepage allowance. |
| BF-L19 | One completed page round leaves one possible round. | Record the first homepage round, then assess further homepage feedback. | One round remains possible; confirm the feedback is consolidated within it. |

| BF-L20 | Conflicting approved ledger records are not resolved silently. | Record two conflicting approval entries for one page. | Classify Clarify and require original records to be checked. |
| BF-L21 | Negative approval wording cannot be overridden by a manually approved status. | Record an entry marked Approved whose text says the page is not approved. | Classify Clarify and flag the status/text conflict. |

| BF-L22 | Per-page revision history is evaluated separately for each request. | Record one completed Home-page round and analyse About- and Home-page requests together. | About history remains unknown; Home history shows one completed round. |
| BF-L23 | Project switching does not reuse prior project evidence. | Add an approval to Project Alpha, then analyse the same request under Project Beta. | Beta analysis contains no Alpha records. |

| BF-L24 | Variable per-page revision allowances use the stated number. | Record one Portfolio-page round against a three-round allowance. | One completed and two remaining rounds are reported. |

| BF-L25 | Related-item metadata associates a revision event with its page. | Record the page name in Related item rather than title/detail. | The matching page allowance uses the recorded revision event. |
| BF-L26 | Page names in approval titles are matched to the requested deliverable. | Record a written approval title naming the Careers page. | The request remains Conditional pending original approval verification. |

| BF-L27 | Baseline preparation is a draft, not an automatic write. | Prepare the original scope from the agreement field. | Copy the exact text into the ledger form; do not save until the user explicitly adds the record. |
| BF-L28 | Proposed baselines are not operative scope evidence. | Record a baseline as Proposed and analyse a new page request. | Exclude the proposed record from operative scope context. |
| BF-L29 | The same agreement may appear in both analysis and ledger. | Paste the agreement and record the identical baseline. | Use the text once; do not duplicate clauses in the analysis scope. |
| BF-L30 | Structured page metadata conflicts with the free-text revision record. | Record a Portfolio revision but set Related item to Contact. | Keep the Portfolio per-page revision balance unknown; require review. |
| BF-L31 | Pronouns may refer to objects other than the most recently named page. | Create a Careers page, then say “check whether it is ready”, “check that carefully” and “review the work there”. | Do not silently rewrite ambiguous pronouns; resolve only an explicit “link to it” destination. |
| BF-L32 | One revision record mentions multiple different pages in its title/details. | Record a Portfolio revision whose details also name Contact. | Detect the conflict and leave the affected per-page allowance unknown. |
| BF-L33 | Broad spelling inclusion conflicts with a page-specific spelling exclusion. | Correct the About-page spelling where the agreement both includes spelling corrections generally and excludes them for About. | Clarify; preserve both clauses and do not choose one automatically. |
| BF-L34 | Heading-change regression checks the actual generated client response. | Change the About-page heading to “Our Approach”. | Preserve the requested heading in the response and never substitute an invented title. |

| BF-L35 | New-page classification uses a generic rule for any page. | Create a new Careers page under a new-page approval exclusion. | Name Careers, not a hard-coded Pricing-page example. |
| BF-R72 | Mixed response combines included, additional, conditional and client-claim rows. | Correct About spelling, create Careers, fix the Contact form submit button, and assert Careers was included. | Refer to the actual Careers and Contact-form items; do not insert fixture-specific Pricing or Contact wording. |

| BF-L36 | A scope claim names one of several requests. | Create Careers and Pricing pages, then say Pricing was included. | Link the claim to Pricing only; do not attach it to Careers. |
| BF-L37 | A vague scope claim could refer to multiple requests. | Create Careers and add a newsletter form, then say “that was included”. | Keep the claim unlinked and ask which deliverable it concerns. |


| BF-R73 | Mixed-scope order invariance | Same new Careers page and included About spelling correction are analysed in both request orders. | Careers remains Likely additional with written-approval evidence; spelling remains Likely included subject to the one-round allowance; allowance usage stays unknown. | Reordering requests must not alter request-level decisions or transfer evidence between requests. |

| BF-R74 | General non-page entitlement claim is extracted separately. | Request a newsletter signup form, then state that the form was already included in the package. | Keep the form as the actionable request and extract the inclusion assertion as a separate client claim. |
| BF-R75 | Already-used revision wording is counted explicitly. | Two revision rounds are included. The first revision round has already been used; correct the About-page spelling in the second round. | Count one completed round, identify the current second round and report one possible round remaining. |

| BF-R76 | A spelling correction in round two exceeds a one-round allowance. | One revision round is included; the first has been used; spelling correction requested in round two. | Classify as Likely additional, while preserving the explicit revision count. |

| BF-C01 | Customer-portal contradiction outside original topic list. | Customer portal included in one clause and excluded in another. | Detect the same-topic conflict and require review of chronology and authority. |
| BF-C02 | Analytics/reporting contradiction outside original topic list. | Reporting dashboards included in one clause and excluded in another. | Detect the same-topic conflict without choosing a governing term. |

| BF-E01 | Exact evidence relevance for a newsletter signup request. | Separate page inventory, new-functionality exclusion and hosting clauses. | Quote only the matched new-functionality clause as boundary evidence. |
| BF-E02 | Exact evidence relevance for a new-page request. | Included minor edits, new-page approval requirement and hosting clauses. | Quote the new-page approval clause, not unrelated clauses. |

| BF-E03 | Client assertion names a deliverable but supplies no approval record. | New pages require written approval; client says it was agreed on a call. | Keep the written-approval boundary; label the call statement as an unverified assertion, not approval evidence. |

| BF-L36 | User-entered approval metadata must not rewrite classifier agreement input. | Ledger email manually marked approved conflicts with base exclusion. | Keep ledger text out of classifier scope; surface as candidate metadata for manual verification. |
