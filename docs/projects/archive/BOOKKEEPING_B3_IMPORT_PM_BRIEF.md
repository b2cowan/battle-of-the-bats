# Bookkeeping B3 import preview — PM brief

> **Lifecycle:** Stopped and archived by owner on 2026-10-23 before B3 completion. Fixture preview exists; real source acceptance/import/reconciliation remain incomplete.

**Proposed functionality:** Give the bookkeeping owner a controlled way to inspect a Stripe movement CSV before money is recorded. The current preview reads the selected file locally and shows source/account scope, separate currency totals, row counts, and rows that are incomplete, repeated within the file, or not understood. The synthetic-data flow does not upload or post anything.

**Why it matters:** A CSV can contain multiple movements for one payment, refunds, processor fees, and payouts. Reviewing those identities and relationships first helps prevent duplicate sales and treating a payout as new income.

**Customer impact:** Internal bookkeeping only. The owner can eventually review imported data before accepting it; clubs and their users see no change. No Stripe customer checkout or organizer payment behavior changes.

**Priority:** B3 prerequisite, after B2 expense-only readiness.

**Success criteria:** Synthetic rows preview deterministically; duplicate identities and incomplete/unsupported rows are clearly blocked; totals remain separated by currency; no file is uploaded and no row is persisted or posted. Real imports remain gated on Revenue accepting the source contract and accounting attribution.

See the [implementation plan](../archive/BOOKKEEPING_B3_IMPORT_PLAN.md) and [review mockup](../archive/BOOKKEEPING_B3_IMPORT_MOCKUP.html).
