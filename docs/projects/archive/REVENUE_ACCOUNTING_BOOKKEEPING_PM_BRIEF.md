# Internal bookkeeping — PM brief

> Updated 2026-10-23 · B2 expense-only reports and review workflow added to the development build.
> [B0 audit and first slice](../archive/BOOKKEEPING_B0_AUDIT_AND_CONTRACT.md) · [B0 screen designs](../archive/BOOKKEEPING_B0_SCREEN_DESIGNS.html).
> [Plan](../archive/REVENUE_ACCOUNTING_BOOKKEEPING_PLAN.md) · [Project index](../archive/BOOKKEEPING_REVIEW.html#index) · [Initial build prompt](../archive/BOOKKEEPING_BUILD_PROMPT.md) · [B2 build prompt](../archive/BOOKKEEPING_B2_BUILD_PROMPT.md)

> **Lifecycle:** Stopped and archived by owner on 2026-10-23. Archived as incomplete; B2.5 passed, but B3 and B4 readiness gates remain open. See [closure record](../archive/BOOKKEEPING_CLOSURE_RECORD.md).

## Outcome

Build a small private FieldLogicHQ bookkeeping tool that the owner can change as reporting needs evolve. Record income and expenses, attach receipts, see useful reports and deliver organized records to an accountant. This owner decision supersedes the previous Wave/QuickBooks selection strategy.

Starting scale: fewer than 50 historical receipts since May 1 and fewer than ten new expenses monthly. Manual expense entry and receipt attachment are appropriate.

## Owner experience and access

The owner can filter active expenses by missing receipt, missing USD conversion evidence, personal payment, or USD invoice. Period reports show recorded spend, category totals, purchase-tax status and payment source. CSV and accountant ZIP follow the selected filters and preserve each matching expense's revisions. Reports describe recorded expenses; they do not calculate profit or recoverable tax. Income and owner-movement entries remain future work under the accepted B3 and later contracts.

Only the authorized bookkeeping owner, `fieldlogichq@gmail.com`, has access in this build. Signed-out users, other platform-admin accounts, club administrators, coaches and families remain denied. The workspace stays in the platform-admin area behind its existing access boundary.

## First version

Expense/receipt register, simple configurable reports, controlled CSV imports, Stripe/bank transfer reconciliation, private storage, correction history and accountant exports. Keep foreign invoices and documented CAD values. Defer OCR, automatic bank feeds, scheduled API sync, payroll and tax filing.

## Parallel delivery

B0 defines the model, reuse, access/storage and screens. B1 builds expenses/receipts; B2 delivers reports/export and an expense-only gate. These can move ahead while the revenue project settles its Canadian tax and payment details.

B3 proves Stripe subscriptions and platform-fee imports when their source mappings are ready. The Stripe project owns charges/tax/provider decisions and source export; bookkeeping owns intake and reports. Its B3 proof remains required for national A+B launch. B4 proves operations and the first real close; B5 holds optional expansion.

Each project has its own progress tracker. Old Phase 1B stage IDs remain linked in the revenue index, avoiding duplicate completion claims.

## Timing and next step

Estimate the custom build after the B0 technical/UX audit. The old 1–3-day software-configuration allowance no longer applies; custom development adds work to the overall program. Parallel workstreams share real engineering capacity and do not guarantee a shorter calendar.

The B0 code/schema/auth/storage audit is recorded, and four screen designs show the proposed expense register, focused entry, receipt/correction detail and report/export flow. The owner reported all 19 core steps in the [core QA walk](../archive/BOOKKEEPING_OWNER_QA_WALK.html) and all 13 B2 steps in the [B2 QA walk](../archive/BOOKKEEPING_B2_OWNER_QA_WALK.html) passed on 2026-10-23; the [B2 result record](../archive/BOOKKEEPING_B2_OWNER_QA_RESULTS.md) captures the verdict. B2 adds period/category reports, purchase-tax status and payment-source totals, active missing-evidence review, USD invoice detail and aligned filtered exports. A personally paid expense is counted once and remains identifiable; reimbursement movements have no record type yet and must not be entered as another expense. USD evidence requires a named source and valid date. The dated implementation and focused code evidence are in [BOOKKEEPING_PROGRESS.json](../archive/BOOKKEEPING_PROGRESS.json); the [expense-only gate is complete](../archive/BOOKKEEPING_PROGRESS.json). A [manual historical receipt backfill process](../archive/REVENUE_ACCOUNTING_BOOKKEEPING_PLAN.md#historical-receipt-backfill-b2) covers ordering, duplicate avoidance and interruption recovery. The owner corrected the bookkeeping login to `fieldlogichq@gmail.com`, matching platform-admin access. The owner selected AWS storage in the app's Ohio Region. Separate development and production DSQL databases and private S3 receipt buckets are recorded in [AWS resources](../archive/BOOKKEEPING_AWS_RESOURCES.md). A manual encrypted backup and synthetic development restore drill are proven; recurring backup custody and production recovery remain B4. The proposed Stripe CSV v1 mapping needs acceptance by the revenue workstream; Stripe integration remains B3.

## Success criteria

The owner can book an expense, retrieve its receipt and obtain reports that match the underlying records. Stripe reimports and corrections preserve money and history. Organizer funds stay distinct from proprietor income. Exports, access checks, backups and accountant review make the result usable at tax time.

For the B2 expense-only gate, the owner can review a chosen period's recorded spend, categories, purchase-tax statuses, missing evidence, payment sources and USD invoices. Filtered CSV/ZIP output follows the visible report. Personally paid expenses are identifiable without duplicating the expense; movements await their own safe model. The implementation and focused verification are recorded in [B2 verification](../archive/BOOKKEEPING_B2_VERIFICATION.md), and the owner reported the full B2 browser walk passed. The B2.5 expense-only gate is complete.
