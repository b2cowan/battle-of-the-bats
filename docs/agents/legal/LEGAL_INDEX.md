# Legal Research Index

Every topic the Legal Agent (`/legal`) has researched, every document it keeps, and the open questions
waiting on it. Read this file and `LEGAL_FACTS.md` on activation. **Do not open the topic files or drafts
until a question needs one.**

## Documents

One home per document: a draft under `drafts/` until the product renders it, then the product's copy
and a pointer here.

| Document | Home | Version | Status | Last reviewed |
|---|---|---|---|---|
| Terms of Service (subscriptions) | `drafts/TERMS_OF_SERVICE.md` | 0.1 | draft — Stage 6 plan 2026-11-08 (`docs/projects/active/GST_HST_STAGE6_TERMS_PLAN.md`): owner sheet O1–O8, truth table §1; the renewal-date cancel is on prod since 2026-11-05 | 2026-11-08 (notes) |
| Payments terms (clubs taking online payments) | product placeholder only | placeholder | not started | — |
| Privacy policy (FieldLogicHQ's own) | `drafts/PRIVACY_POLICY.md` | 0.1 | draft — owner items P1–P7 before publish; 9 product findings (2026-11-07: tax records never end, §9 note 6); the §3/§5/§6/§9 edits for Stage 14, tax records, staff lists and our bookkeeping are listed in the Stage 6 plan §2 (not yet applied) | 2026-11-07 |
| Data-processing terms for clubs (FieldLogicHQ as service provider) | — | — | not started | — |
| Subprocessor list | — | — | not started | — |
| Guardian consent wording (Signed-in family Stage 4: accept page, first-screen line, invitation fine print, Stop and Leave confirms) | `drafts/GUARDIAN_CONSENT_STAGE4.md` (product still holds the placeholder in `lib/family-guardian-consent.ts`) | 0.1 | draft — build conditions 1–6 in the file; owner call on Terms line; Parts 4–5 read against the shipped words 2026-11-08 (five answers in the file's closeout block): no word changed; **privacy policy page owed before the tier is on for real families**; R2 (record = words shown) to build first | 2026-11-08 |

## Topics researched

| Topic | File | Last verified | Re-verify trigger |
|---|---|---|---|
| Privacy policy requirements — PIPEDA openness, providers, retention, access, cross-border, breaches, children's age line | `PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md` | 2026-11-05 | Bill C-36 passes; first Québec customer; guardian accounts ship |
| A second parent's email typed by the first parent — CASL (does s.6(6) reach a non-party?), PIPEDA indirect collection, the stop link (BUILT 2026-11-06, Stage 3b; 5 open flags a–e for the owner; mig 448 prod owed) | `CASL_SECOND_PARENT_EMAIL.md` | 2026-11-06 (CASL text read; PIPEDA 4.3 text not fetched) | Québec customer; Bill C-36; family accounts Stage 4 ships |
| What a coach is told the club sees (in-club visibility promises) — club-owned team's families are the club's records; old "never your families' payments" line was a broken product promise, not a privacy breach; new wording approved with "other spending" | `IN_CLUB_VISIBILITY_PROMISES.md` | 2026-11-07 | Club on sale; club data-processing terms drafted; family accounts ship |
| Staff lists of customers' billing across clubs (Plans & pricing Part 4 Renewals) + sales records for our accountant — an individual coach's unpaid portal IS personal info (OPC: "a simple reference to an outstanding debt"); need-to-know staff use is our own purpose; "every record they open is logged" true only as "club or person record" (lists never logged); Renewals exports `included_justified`; sales.csv no address; policy §5/§6 wording owner items | `STAFF_CROSS_CLUB_BILLING_LISTS.md` | 2026-11-07 | Bill C-36; first Québec buyer; a list shows a person's name, email or card |
| The club's member invitations (new-account invite, "added" email) — not commercial messages as long as no plan, price, offer or pricing/sign-up link is added; the product line must be true for every sender; Reply-To reaches nobody and unaccepted invitations are kept (pre-existing, owner) | `CASL_MEMBER_INVITE_EMAILS.md` | 2026-11-07 | Either email gains commercial content; Bill C-36 |
| Selling a plan online to an individual in Ontario (CPA 2002 internet agreements; CPA 2023 status) | `ONTARIO_CONSUMER_INTERNET_AGREEMENTS.md` | 2026-11-05 (primary text not fetched) | CPA 2023 proclaimed in force |

## Open questions — the backlog

Seeded 2026-11-04 from the repo. Each is a lead to the place it was raised; **the source is the
record**, this list is not. When one is answered, the answer goes in a topic file and the row moves to
the table above.

| # | Question | Raised in | Blocks |
|---|---|---|---|
| L1 | **Drafted 2026-11-05 (v0.1)** — Terms of Service for subscriptions: seller, CAD + tax, renewal and "plans end at the renewal date", refunds, governing law; click-through acceptance with version recorded | `docs/projects/active/GST_HST_COLLECTION_PLAN.md` Stage 6 | The first paid subscription |
| L2 | **Drafted 2026-11-05 (v0.1)** — FieldLogicHQ's own privacy policy (both roles: own organization + service provider to clubs; data held outside Canada) | GST/HST plan Stage 6; TODO (platform privacy page, 2026-07-17) | L1 (signup links to it) |
| L3 | Payments terms: club as merchant of record, the fee as our charge, fee not refunded, disputes, indemnity, event cancellation; **and (2026-11-05, GST/HST Stage 2 Part 2b) that the club's Stripe fees (disputes, returned debits, cards from outside Canada) are invoiced to it monthly with sales tax, and setting up payouts needs its billing address** | `FACILITATED_PAYMENTS_COUNSEL_BRIEF.md` Qs; `BUSINESS_DECISIONS.md` T3 | Online payments in prod (not a gate since 2026-11-04) |
| L4 | RPAA / FINTRAC money-services status under direct charges — the one with statutory penalties; worth researching before payments go live | `FACILITATED_PAYMENTS_COUNSEL_BRIEF.md` | Online payments in prod (not a gate since 2026-11-04) |
| L5 | Children's information: consent wording, the age line (under 13; Québec under 14), guardian consent — the wording is still a placeholder in the product | `COACH_PORTAL_CHUNK_D_COUNSEL_PACKET.md` Qs 1–7 | Guardian tier (not a gate since 2026-11-04) |
| L6 | CASL: transactional vs commercial line for tryout and club emails; signup opt-out vs express consent; the Basic-tier unsubscribe gap; how long to keep consent records | Chunk D packet; `BUSINESS_DECISIONS.md` ~L2909, ~L3537 | Any commercial email; guardian tier |
| L7 | Québec: Law 25 obligations; French-language standard-form contracts; consumer cancellation and renewal notices; card-surcharge ban | Revenue backlog D20; `BUSINESS_DECISIONS.md` ~L698, ~L882 | The first Québec customer |
| L8 | Consumer-protection rules for a coach buying a plan as an individual (internet agreements, renewal notice, cancellation) | Revenue backlog D20 | Coach plans on sale |
| L9 | Retention and purge of player information; what happens to a club's data on downgrade or cancellation | TODO (player-information purge, 2026-07-17; billing downgrade retention) | L2 (the policy must state it truthfully) |
| L10 | The club export's "everything this organization holds" statement is untrue; the family file's statement wants a counsel read | `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` E04, ~L1530 | Club tier on sale |
| L11 | What a coach on one team may see of a child on another team | `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` ~L3242 | — |
| L12 | Refund, dispute and cancellation policy | Revenue backlog D16 | L1, L3 |
| L13 | **DONE 2026-11-06** — business name registered with ServiceOntario (owner's dashboard, status Completed). Left: record the renewal date; name the seller in L1 as "the owner, trading as FieldLogicHQ" | `ACCOUNTING_FACTS.md` | — |
| L14 | Personal liability as a sole proprietor — incorporation and insurance as a legal question (tax side → `/accounting`) | Revenue backlog (incorporation cutover) | — |
| L15 | Trademark: file the word mark or not; the search was Canada-only | `docs/agents/brand/VISUAL_IDENTITY.md` ~L195 | — |
| L16 | Staff change-log reasons are free text, permanent (append-only, mig 429) and can name a customer (a replayed Stripe update, a refund, a plan change). A correction or erasure request cannot reach them, and the privacy draft says only "every change our staff make is permanently recorded". Decide: a "do not name a customer" line on every reason field, and whether §9 (access, correction) should say staff reasons are kept as a record. Replays (Plans & pricing Part 5 Session 2, 2026-11-08) add no new data kind: the reason and the club billing record are held already; replay reasons are read only by Super admin, Billing and Support, like refunds | `PLANS_PRICING_STAGE2_PART5_BUILD_PROMPT.md` | — |
