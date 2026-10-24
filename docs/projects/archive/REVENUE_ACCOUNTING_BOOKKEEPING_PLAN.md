# FieldLogicHQ internal bookkeeping — parallel project

> Owner decision, 2026-10-23: build our own small private bookkeeping tool and run it in parallel with Stripe/revenue readiness.
> [Project index](../archive/BOOKKEEPING_REVIEW.html#index) · [PM brief](../archive/REVENUE_ACCOUNTING_BOOKKEEPING_PM_BRIEF.md) · [Progress](../archive/BOOKKEEPING_PROGRESS.json) · [New-chat build prompt](../archive/BOOKKEEPING_BUILD_PROMPT.md)
> Companion: [active Stripe/revenue project](../active/REVENUE_ACCOUNTING_READINESS_PLAN.md). This custom build superseded the former Phase 1B vendor-selection recommendation and its setup allowance.
> Status: Stopped and archived by owner on 2026-10-23, after B2.5 expense-only readiness passed. This project is **not complete**: real Stripe source acceptance/import/reconciliation and B4 backup custody, production recovery, accountant review and first operating close remain open. See [closure record](../archive/BOOKKEEPING_CLOSURE_RECORD.md).
> [B0 audit, posting rules and proposed CSV v1](../archive/BOOKKEEPING_B0_AUDIT_AND_CONTRACT.md) · [B0 screen designs for owner review](../archive/BOOKKEEPING_B0_SCREEN_DESIGNS.html).

## 1. Outcome and owner experience

Give the Ontario sole proprietor a private place to record FieldLogicHQ income and expenses, attach and retrieve original receipts, review the reports they want, and deliver organized records to an accountant. The owner prefers control over functionality and reporting. Confirmed starting volume: fewer than 50 expense receipts since May 1, 2026, and fewer than ten new expenses monthly.

For B2, the owner opens a private finance workspace, adds an expense and receipt, assigns category/payment source and business purpose, reviews period expense and purchase-tax summaries, and exports filtered records for an accountant. Revenue activity and profit reporting wait for B3's accepted source contract. An accountant package links recorded totals to transactions and original documents.

Only the authorized bookkeeping owner, `fieldlogichq@gmail.com`, can access this development workspace. Signed-out users and other accounts, including club admins, coaches and families, remain denied. The workspace is in the existing app's platform-admin area behind its reviewed auth/storage boundary. A dedicated project does not imply another repository, deployment or public product.

Account creation, public pricing and organizer checkout remain the Stripe project's customer experience. This bookkeeping project adds no club entitlement or consumer billing flow.

## 2. Bounded first version

- Manual expense entry: supplier, invoice/service dates, category, original amount/currency, CAD amount, actual tax, payment source, business-use share and notes.
- Private receipt upload and retrieval, initially PDF/JPEG/PNG as appropriate after storage review. Manual attachment is sufficient; automatic receipt reading is deferred.
- Income/source register with subscription revenue, platform service income, actual tax, fees, refunds and corrections recorded distinctly.
- Controlled Stripe CSV import first, with repeat-import protection and a preview/review step. Scheduled API synchronization can follow once the importer is proven.
- Separate Stripe balance, receiving bank movements and owner contributions/draws. A payout is a transfer, not another sale. Personally paid expenses and later reimbursements must not duplicate costs.
- Clear income/expense/profit reports, category and tax summaries, transaction detail and reconciliation exceptions. Add reports incrementally from the owner's actual questions.
- CSV transaction export, readable reports and an original-receipt package with a transaction/document index. Accountant adjustments remain traceable.
- Correction/void history, backups and a recovery check. Reporting changes must preserve the meaning of past records.

Initial CAD books can retain original USD invoices and their documented CAD conversion rather than implementing a foreign-currency ledger. Record pending purchase-tax treatment explicitly; May 1 capture does not establish the GST/HST effective date or approve all earlier tax credits.

Do not expand the MVP into payroll, tax-return filing, automated bank feeds, a complete invoicing suite, budgets, a public accounting product or a second tax-calculation engine. Statutory tax classification and registration effective dates remain reviewed facts from the revenue project/advisor.

## 3. Main engineering problem and reuse

The hardest part is reliable transaction meaning and traceability: imports, fees, refunds, payouts, corrections and later report changes must reconcile without duplicates or silently rewriting history. Low expense volume makes manual review practical; it does not remove these rules.

The repository contains club/team ledger classification and reversal patterns (including lib/club-ledger.ts and lib/expense-ledger.ts). Review their actual implementation before choosing reusable pure helpers. They are tied to club/team ownership and cannot be assumed to be the proprietor's general ledger.

B0 must inspect current auth, database dictionary/snapshots, storage access, export utilities and money representation before designing migrations. This plan does not assert that any new table exists. Shared schema/auth/API changes require the repo's prescribed dictionary, snapshot and verification workflow.

Use integer minor-unit money and documented rounding/recognition rules. Decide the smallest journal representation and posting rules that support reconcilable balances and accountant exports before writing the register UI. Avoid both unstructured spreadsheet-like rows with ambiguous meaning and unnecessary accounting-engine scope.

## 4. Parallel ownership and shared data handoff

| Responsibility | Canonical owner | Other project's dependency |
|---|---|---|
| Canadian price/tax/fee supply, seller/recipient, registrations and effective dates | Stripe/revenue project and advisors | Bookkeeping records the reviewed outcome and pending facts; it does not invent tax decisions |
| Checkout, Connect configuration, customer/organizer payments and Stripe event handling | Stripe/revenue project | Bookkeeping consumes source records/imports; it does not create charges or enable another processor |
| Private expense register, receipt files, categories, corrections and owner reports | Bookkeeping project | Can build with sample/manual data while payment decisions are open |
| Canonical payment identifiers, amount breakdowns, source status and export mapping | Joint handoff, owned by revenue at the source | Bookkeeping owns its import adapter, duplicate control, posting and reconciliation |
| Real subscription and application-fee import acceptance | Both projects | One shared proof satisfies the dependency; do not implement two competing Stripe ingest systems |
| Expense-only readiness | Bookkeeping B2 gate | Can finish independently of Stripe paid launch |
| National paid launch accounting readiness | Bookkeeping B3 gate + revenue A/B | Required before A+B; separate projects do not waive financial proof |
| First full operating close | Bookkeeping B4, evidence referenced by revenue Phase 5 | Perform once and link the same result |

Proposed handoff fields, to be confirmed in B0: source provider, environment, platform/connected account, stable source object and financial-movement identity, parent payment/invoice/fee/refund/payout references, effective timestamp and service period where known, currency, gross/net/tax/fee breakdown, seller/recipient and tax-liability attribution, status, policy version and evidence links. Preserve source values and provenance.

Stripe event identity and financial posting identity serve different purposes. Replaying the same movement, or receiving two event types about it, must not create two sales. Linked refunds reverse the relevant revenue/tax amounts; payouts move balances. Organizer registration gross is not automatically proprietor revenue.

Start with fixtures and a versioned CSV mapping. Do not lock a production format or tax posting rule until the source model is settled. The bookkeeping adapter and Stripe source exporter each have one owner, and changes to the handoff are recorded in both plans or a linked contract record.

## 5. Phases and readiness gates

The [progress register](../archive/BOOKKEEPING_PROGRESS.json) is canonical for stages, dates and evidence. The [artifact](../archive/BOOKKEEPING_REVIEW.html#index) shows every phase/stub with read-only completion ticks. Research/design, implementation, verification and owner QA are separate deliverables.

| Phase | Can start when | Exit evidence |
|---|---|---|
| B0 — scope, audit, model and screen design | Now | Current code/schema/auth/storage audit; transaction rules, sample import contract and owner-oriented expense/report screens reviewed |
| B1 — private workspace and expense/receipt core | B0 technical and UX design ready | Manual expense, receipt retrieval, categories/search and correction history work; unauthorized roles denied |
| B2 — reports, export and expense-only readiness | B1 | Period reports and accountant exports trace to entries/receipts; personal/foreign purchases work; owner walkthrough and receipt backfill process proven |
| B3 — Stripe revenue imports and reconciliation | Adapter work can start with fixtures alongside B1/B2 | Subscription and Connect fee/refund/payout imports reconcile under the actual source/tax model; interrupted/repeated imports do not duplicate money |
| B4 — hardening and operating close | Backup/access proof before live use; full close after activity | Backup/restore, accountant review and the first real full close have retained evidence and named owners |
| B5 — optional expansion | Separate priority decision | OCR, scheduled API sync and additional accounting/reporting features only when justified |

B2 enables useful pre-revenue bookkeeping without waiting for Canadian tax conclusions. Records requiring a tax decision stay pending. B3 is the shared accounting prerequisite for national A+B payment launch. B4's first full close follows launch; it is not an impossible pre-revenue gate.

The former revenue stages 1.6–1.13 remain visible as linked dependencies with their historical IDs. Their work is now tracked here, not independently ticked in two places.

## 6. Timing and practical parallel execution

The previous 1–3 owner/bookkeeper setup days referred to configuring existing software and are retired. A custom app needs its own estimate after B0's reuse/auth/storage/model audit and screen review. Its effort is additional to the Stripe project's existing engineering scenario.

Expense/receipt/manual-report development can run alongside the revenue project's tax/provider/banking decisions. Stripe-import design uses fixtures while production mappings are unsettled. Integration acceptance waits only for the relevant settled source model, not every unrelated future feature.

Two workstreams can progress independently in separate chats/work sessions. They still share engineering capacity, so do not assume simultaneous full-time output from one implementer. Follow this repository's shared dev branch and concurrent-edit rules. Assign files/work packages clearly, re-read before editing shared modules, and coordinate schema/auth/API changes; do not create competing migrations or per-project branches.

No additional agent or background development process is started by this planning split. The [build prompt](../archive/BOOKKEEPING_BUILD_PROMPT.md) makes the bookkeeping stream ready for a separate chat.

## 7. Financial controls, records and verification

Across the full project, required proof includes import/reimport, interrupted import, partial/full refund, fee refund, payout versus income, personally paid expense, a USD cost with documented CAD value, an unknown tax treatment, an archived/voided entry, correction history and receipt export/retrieval. B2 proves personal payments are counted once and separately reported. A later reimbursement needs its own safe movement contract; until then, do not enter it as a second expense. Use synthetic data first; real receipts and financial identifiers stay in the authorized private system, not Git or public project artifacts.

Test access through routes/APIs and receipt storage, including a normal club admin who must not read proprietor records. Exports must preserve original receipts and stable mappings after an entry is corrected or voided. Keep backup/restore evidence and identify the actual records-retention/storage location.

Meaningful unit/integration tests cover posting/deduplication/access rules; resource-aware repo checks cover actual touched code. Shared module/auth/schema changes require typecheck and the relevant database documentation workflow. Owner performs browser/visual QA unless explicitly delegated. A layout whole-product sweep belongs on staging/local production, per repo rules.

The accountant confirms recognition, tax recovery, asset/deferred-income schedules and the final income-tax/GST package. Reports and exports support filings; the app does not submit returns in this version. Current reference sources: [Stripe balance reports](https://docs.stripe.com/reports/balance), [Stripe payout reconciliation](https://docs.stripe.com/reports/payout-reconciliation), and [CRA electronic record keeping](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/ic05-1/electronic-record-keeping.html). Apply their actual requirements during design, including readable retained records.

### Historical receipt backfill (B2)

The owner reported fewer than 50 historical receipts from May 1, 2026. Enter them through the same manual expense form, in ascending expense date, one at a time. Before saving each item, search the register for the supplier and compare the expense date, invoice amount, and receipt to avoid entering an existing purchase twice. Treat a likely match as a review item; do not create a second expense to make a receipt appear attached. Use the correction flow only when the existing transaction is actually incomplete or wrong, and enter a correction reason.

Keep the source files in a private, backed-up folder outside Git. Give each source file a readable name before upload, such as `2026-06-14_supplier_invoice-123.45.pdf`; retain the invoice's original name in a note if renaming obscures its identity. Enter the purchase date, invoice currency and amount, CAD value, purchase tax, business-use share, payment source, and business purpose from the evidence. For USD, the conversion note must name the rate source and contain its valid `YYYY-MM-DD` date. Upload the original receipt or invoice; do not substitute a screenshot of the register.

After each saved entry, confirm that the supplier, date, amount and receipt appear in the register, then record the completed source filename in a private progress list. Resume from the first unchecked filename after interruption. Search the register again before saving that item; this makes a repeated attempt safe if the interruption occurred after save but before the progress list was updated. Finish by reviewing the missing-evidence view and comparing the register against the source-file list. No bulk importer is justified at this reported volume.

## 8. Decisions and immediate next package

Confirmed: custom internal build; parallel project; low expense volume; manual receipts; customizable reports; Stripe remains the revenue source; national CAD subscriptions and registration payments remain the companion project's scope.

The [B0 audit](../archive/BOOKKEEPING_B0_AUDIT_AND_CONTRACT.md) records the actual code/schema/auth/storage boundary, posting rules and proposed CSV v1. The [four B0 screen designs](../archive/BOOKKEEPING_B0_SCREEN_DESIGNS.html) show the proposed expense register, entry, receipt/correction detail and report/export flow for owner review. The owner reported all 19 core browser QA steps and all 13 B2 browser QA steps passed on 2026-10-23; the B2 result is recorded in [BOOKKEEPING_B2_OWNER_QA_RESULTS.md](../archive/BOOKKEEPING_B2_OWNER_QA_RESULTS.md). B2's expense reports, active evidence review and filtered exports have focused code coverage; personal payment totals and USD source/date validation use the existing revision record. There is no owner-movement record type, so a reimbursement is not entered as a second expense; the expense remains separately identified as personally paid for follow-up. The historical receipt backfill workflow above is owner-walked and B2.5 is complete. B3 fixture-only CSV preview implementation is tracked in the [B3 import plan](../archive/BOOKKEEPING_B3_IMPORT_PLAN.md), [PM brief](../archive/BOOKKEEPING_B3_IMPORT_PM_BRIEF.md), [review mockup](../archive/BOOKKEEPING_B3_IMPORT_MOCKUP.html), [synthetic fixtures](../archive/BOOKKEEPING_B3_IMPORT_FIXTURES.csv) and [owner QA walk](../archive/BOOKKEEPING_B3_FIXTURE_PREVIEW_QA_WALK.html). Its preview cannot post records; source acceptance still belongs with the revenue stream.

The owner confirmed private hosted storage and rejected a new fixed-fee Supabase project. On 2026-10-23 the AWS option was selected and [separate Aurora DSQL clusters and private S3 buckets](../archive/BOOKKEEPING_AWS_RESOURCES.md) were created in `us-east-2`, the Amplify app's Region. The expense page, receipt routes and exports now use AWS. The accountant package contains a filtered revision CSV, original receipt files and a SHA-256 document index. A manual AES-256-GCM archive includes all revisions and referenced receipts, and a synthetic development restore drill preserved a revision, timestamp and PDF bytes. The owner reported all 19 steps in the [core QA walk](../archive/BOOKKEEPING_OWNER_QA_WALK.html) and all 13 steps in the [B2 walk](../archive/BOOKKEEPING_B2_OWNER_QA_WALK.html) passed on 2026-10-23. Only the Amplify dev branch has a bookkeeping compute role and AWS environment settings; production release configuration remains a release step. Migration 354 is historical product-dev work and is held from product production in `supabase/migrations/MANUAL_PROD_STEPS.json`. Aurora DSQL has a monthly free allowance for SQL records; S3 receipts and backup are metered, so zero total cost is not guaranteed. Remaining work includes recurring backup custody and production restore; tax/recognition policies; production Stripe mapping; accountant reviewer; and estimated build capacity. Personal reimbursements need a safe movement record contract and are not duplicated as expenses. No new bank account, tax registration or accountant engagement is created by this project.

## 9. Definition of done

The owner can record and correct a business expense, retrieve the original receipt, inspect the desired period reports, import Stripe revenue without duplicates, reconcile through fees/taxes/refunds/payouts and export a usable accountant package. Access protection, audit history and restoration are proven. The custom tool, source contract and monthly routine have maintainable ownership. Preparation ticks alone do not satisfy those outcomes.
