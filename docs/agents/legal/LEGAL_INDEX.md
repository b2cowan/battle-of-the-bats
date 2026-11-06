# Legal Research Index

Every topic the Legal Agent (`/legal`) has researched, every document it keeps, and the open questions
waiting on it. Read this file and `LEGAL_FACTS.md` on activation. **Do not open the topic files or drafts
until a question needs one.**

## Documents

One home per document: a draft under `drafts/` until the product renders it, then the product's copy
and a pointer here.

| Document | Home | Version | Status | Last reviewed |
|---|---|---|---|---|
| Terms of Service (subscriptions) | `drafts/TERMS_OF_SERVICE.md` | 0.1 | draft — owner decisions O1–O6 + 4 product items before publish | 2026-11-05 |
| Payments terms (clubs taking online payments) | product placeholder only | placeholder | not started | — |
| Privacy policy (FieldLogicHQ's own) | `drafts/PRIVACY_POLICY.md` | 0.1 | draft — owner items P1–P6 before publish; 8 product findings | 2026-11-06 |
| Data-processing terms for clubs (FieldLogicHQ as service provider) | — | — | not started | — |
| Subprocessor list | — | — | not started | — |
| Guardian consent wording | product placeholder only | placeholder | not started | — |

## Topics researched

| Topic | File | Last verified | Re-verify trigger |
|---|---|---|---|
| Privacy policy requirements — PIPEDA openness, providers, retention, access, cross-border, breaches, children's age line | `PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md` | 2026-11-05 | Bill C-36 passes; first Québec customer; guardian accounts ship |
| A second parent's email typed by the first parent — CASL (does s.6(6) reach a non-party?), PIPEDA indirect collection, the stop link (BUILT 2026-11-06, Stage 3b; 5 open flags a–e for the owner; mig 448 prod owed) | `CASL_SECOND_PARENT_EMAIL.md` | 2026-11-06 (CASL text read; PIPEDA 4.3 text not fetched) | Québec customer; Bill C-36; family accounts Stage 4 ships |
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
| L13 | Business-name registration (Ontario Business Names Act) — is it registered, is it required for "FieldLogicHQ" | `ACCOUNTING_FACTS.md` (unconfirmed) | Naming the seller in L1 |
| L14 | Personal liability as a sole proprietor — incorporation and insurance as a legal question (tax side → `/accounting`) | Revenue backlog (incorporation cutover) | — |
| L15 | Trademark: file the word mark or not; the search was Canada-only | `docs/agents/brand/VISUAL_IDENTITY.md` ~L195 | — |
