# Internal bookkeeping B2: expense-only readiness build prompt

> Written 2026-10-23 after the owner reported that all 19 steps in the B1/B2 browser QA walk passed. Paste this prompt into a new chat in the same workspace. Work only on the shared `dev` branch, preserve unrelated changes in the shared working tree, and do not promote or configure the bookkeeping tool for production in this phase.

Continue FieldLogicHQ's private internal-bookkeeping project through **B2: reports, exports and expense-only readiness**. This is an implementation session, not another planning-only pass. Recheck the code and tracker before relying on this handoff, present the required plain-language UX summary before editing feature code, then complete the independent work that is supported by the existing expense model.

## Read first

- `AGENTS.md` and `AGENCY_RULES.md`
- [Bookkeeping plan](../archive/REVENUE_ACCOUNTING_BOOKKEEPING_PLAN.md), especially sections 5, 7 and 8
- [PM brief](../archive/REVENUE_ACCOUNTING_BOOKKEEPING_PM_BRIEF.md)
- [Canonical progress register](../archive/BOOKKEEPING_PROGRESS.json)
- [B0 audit and posting contract](../archive/BOOKKEEPING_B0_AUDIT_AND_CONTRACT.md)
- [AWS resources and recovery handoff](../archive/BOOKKEEPING_AWS_RESOURCES.md)
- [Passed owner QA walk](../archive/BOOKKEEPING_OWNER_QA_WALK.html)
- Existing implementation under `app/platform-admin/bookkeeping/`, `app/api/platform-admin/bookkeeping/`, and `lib/bookkeeping-*.ts`
- Focused unit coverage in `tests/unit/bookkeeping-expenses.test.ts` and `tests/unit/bookkeeping-export.test.ts`

Read the relevant Next.js 16 guides in `node_modules/next/dist/docs/` before changing framework code. This repository uses `proxy.ts`; do not create `middleware.ts`.

## Verified starting point

- The owner reported a pass for all 19 browser QA steps on 2026-10-23. The pass covers owner access, expense entry, report arithmetic, correction history, original and replacement receipts, CSV, accountant ZIP, void history, signed-out and non-owner denial, direct receipt denial, persistence and phone layout.
- `fieldlogichq@gmail.com` is the authorized bookkeeping owner.
- Development uses the separate Ohio Aurora DSQL cluster and private S3 receipt bucket recorded in `BOOKKEEPING_AWS_RESOURCES.md`. Product Supabase is not the selected bookkeeping store. Migration 354 remains held from product production.
- The current page already records CAD or USD invoices, CAD value, purchase tax, business-use percentage, payment source, conversion evidence, notes and optional receipt. It derives current expense totals and category totals, flags missing receipts, preserves immutable revisions and exports filtered CSV/ZIP packages.
- A manual AES-256-GCM backup and synthetic development restore drill passed. Recurring backup operations and production recovery belong to B4 and must not be represented as complete here.
- Production promotion is intentionally deferred. Do not change the Amplify `master` branch, production bookkeeping role attachment, production environment variables or production data.

## Product outcome for B2

The owner can use the development bookkeeping workspace as a complete **expense-only** register before Stripe revenue is connected. The owner can answer, for a chosen period:

- How much business spending was recorded, by category?
- Which purchase-tax amounts remain pending review, and which entries contain them?
- Which active expenses are missing receipts or required supporting evidence?
- Which expenses were paid personally, and what amount may need a separate reimbursement or owner-movement record?
- For a USD invoice, what was the original amount, recorded CAD value and documented conversion source/date?

The tool and exports must continue to describe recorded spending. They must not call it taxable profit, calculate an input tax credit, decide whether a cost is an asset or current expense, or invent income before B3 supplies accepted revenue movements.

## Build scope

### 1. Finish B1.4: review and missing evidence

Make missing evidence a usable review view rather than a quiet row annotation. The owner must be able to isolate active expenses with no receipt and USD expenses without valid conversion evidence. Keep filters and totals internally consistent. Voided records remain available through history/export but do not count as active missing-evidence work.

Use the existing access boundary and private receipt routes. Do not expose S3 paths or public receipt URLs.

### 2. Finish B2.1: expense-only reports

Build the smallest useful reviewed report set from the current expense records:

- period summary with recorded business spend and active expense count;
- category breakdown;
- purchase-tax review breakdown that distinguishes pending, reviewed and none recorded without calculating recoverable tax;
- missing-evidence view;
- payment-source breakdown, including personally paid expenses;
- foreign-invoice view showing original currency/amount, CAD amount and conversion note.

Keep CSV and accountant-package filters aligned with the visible report. If a report filter selects a subset, the downloaded detail/package must represent that same subset unless the screen clearly offers a separately named full-history export.

Do not build income, profit, Stripe balance or payout reports in B2. Those require the accepted B3 source contract.

### 3. Finish B2.3: personal payments, owner movements and USD proof

Prove these cases with code and focused tests:

- a personally paid business expense contributes once to expense totals and is separately identifiable for follow-up;
- a later reimbursement/owner movement cannot accidentally duplicate the original expense. If the existing model cannot represent a movement safely, document the boundary and provide the report/export follow-up needed for B2; do not add a partial journal model that conflicts with B3;
- a USD expense retains its original USD amount, entered CAD value, and required conversion source/date;
- business-use percentages apply consistently to spend, tax review and payment-source totals;
- corrections and voids use only the latest revision in summaries while all revisions remain in exports/history.

Do not settle tax, recognition, reimbursement or capital-asset policy in code. Keep uncertain treatment reviewable and exportable for an accountant.

### 4. Finish B2.4: historical receipt backfill

The owner reported fewer than 50 historical receipts since May 1, 2026. Add a practical, documented backfill workflow using the existing manual entry form. It must explain ordering, duplicate avoidance, receipt naming/evidence, USD conversion notes, and how to resume after interruption. Avoid building a bulk importer unless the actual workflow demonstrates that manual entry is inadequate at this volume.

Create a new checkable local HTML QA walk for the remaining B2 cases. Follow the owner's standing preference: every step says exactly what to do, what to look for, and the measure of success; store progress locally in the browser and provide a downloadable result summary. Do not repeat the already-passed 19-step core walk except where a short prerequisite is essential.

### 5. Evaluate and close B2.5

Mark the expense-only gate complete only when B1.4, B2.1, B2.3 and the backfill process have dated evidence and the focused verification passes. The new owner browser walk can remain the final owner-owned evidence if code is otherwise ready; do not mark that browser walk passed before the owner reports it.

## Boundaries

- Do not start B3 Stripe import/reconciliation work in this session.
- Do not promote to production or modify production AWS/Amplify configuration.
- Do not apply migration 354 to product production.
- Prefer extending the existing DSQL revision record and derived reports. Add schema only if the B2 outcome cannot be represented correctly without it. If schema changes are necessary, update the authoritative AWS schema/runbook and relevant data documentation in the same unit of work; do not infer live schema from historical migrations.
- Do not add recurring jobs or shared automation. Those require an explicit owner request in the current conversation under `AGENCY_RULES.md`.
- Do not store real receipts, financial identifiers, backup archives or credentials in Git.
- Preserve the append-only correction history, stable receipt access and exact-email authorization boundary.
- Do not delete the existing permanent-delete action unless the owner explicitly changes that accepted behavior.

## Delivery and verification

Before feature code, provide the required product-manager UX summary: what the owner will see and do, the benefit, and that other roles remain denied. Then give a short implementation task list.

Use focused tests for report math, filters, latest-revision behavior, personal-payment totals, USD requirements, missing evidence and export alignment. Run the resource-appropriate changed-file verification required by `AGENCY_RULES.md`; run typecheck if shared modules or API/data contracts change. If the dev server is needed, start it with network access using `npm run dev` and obey the restart rules in `AGENTS.md`.

Update these records with dated evidence:

- `BOOKKEEPING_PROGRESS.json`
- `REVENUE_ACCOUNTING_BOOKKEEPING_PLAN.md` and its PM brief when the delivered owner experience changes
- the high-level bookkeeping line in `TODO.md`
- `BOOKKEEPING_AWS_RESOURCES.md` if storage/schema/operations change

Refresh `BOOKKEEPING_REVIEW.html` with `node scripts/build-bookkeeping-review.mjs`. Stage explicit paths only if committing; never sweep unrelated shared-worktree changes into the commit.

Stop at a reviewable B2 result: implemented development code, focused automated evidence, an updated tracker, and the new checkable B2 owner QA walk. Leave production release and B3 for later sessions.
