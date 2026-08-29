-- ---------------------------------------------------------------
-- Migration 270 — the two halves are let go (Payables Rebuild, cleanup)
--
-- Owner-directed 2026-08-28. This is the migration migration 255 promised and
-- deliberately did not do:
--
--   "⚠ THE OLD COLUMNS ARE NOT DROPPED HERE. deposit_*/balance_*/expense_paid_at
--    stay in place and keep being written by the existing code until every reader
--    has moved. Dropping them is a LATER migration, once the drift check proves
--    nothing reads them. A drop in this migration would make the 'books did not
--    move' test unfalsifiable, because there would be nothing left to compare
--    against."
--
-- That test has since been run and passed (Owner QA §64, 2026-08-21), and P2
-- moved the last writer off these columns: `createRepTeamExpense` writes a plan
-- and payments, the seeders go through `insertCommitmentWithRecords`, and the
-- budget-vs-actual route's own SELECT carries a comment saying it names no paid
-- stamp any more. So the comparison the columns existed for is finished, and
-- what is left is nine columns that look like an answer to "what has this paid?"
-- and are not one. That is the actual hazard: a future reader finding
-- `deposit_paid_at` on the table and believing it.
--
-- ⚠⚠ WHAT REPLACED THEM, so nobody looks for them: a commitment's schedule is
-- `rep_payable_installments` and its settlement is `rep_payable_payments`. The
-- one legacy column that STAYS is `amount` — deliberately kept equal to the sum
-- of the installments (the rebuild's R2 rule). It is not in scope here.
--
-- ⚠ PROVEN DEAD BEFORE DROPPING, not assumed. Every column name and its
-- camelCase twin was swept across app/ lib/ components/ scripts/ tests/ and each
-- hit attributed to its table — `deposit_amount` alone has ~93 occurrences, and
-- nearly all of them are the tournament registration fee block
-- (`tournaments.deposit_amount`, `divisions.deposit_amount`) or in-memory field
-- names in the budget importer and `composeTwoPieceInstallments`, which speak
-- deposit/balance because coaches' own spreadsheets do while storing
-- installments. Those are untouched. The only real readers left were the row
-- mapping in lib/db.ts, the type it fills, and three fixtures; all are deleted
-- in the same unit of work.
--
-- ⚠ AND PROVEN LOSSLESS ON DATA. Before applying: of 57 dev commitments, every
-- one has at least one installment; every row carrying `expense_paid_at` or a
-- leg stamp has a real payment row; and every leg entry link is already carried
-- on a payment's own `accounting_entry_id`. Nothing recorded here exists only
-- here.
--
-- ⚠ PROD SEQUENCING — a drop is only safe once the DEPLOYED code has stopped
-- reading the column (the migration-040 failure mode: 500s on every coach money
-- screen). Prod-safe only at or after the release carrying the Payables Rebuild.
-- Prod HEAD `7f21df47` (2026-08-27, Amplify job 260) already contains it, so
-- this migration is safe to apply to prod whenever the owner asks.
--
-- ⚠ TWO FK CONSTRAINTS AND TWO PARTIAL INDEXES GO WITH THE ENTRY COLUMNS, so
-- their disappearance from the committed snapshots is explained rather than
-- mysterious: `rep_team_expenses_deposit_entry_id_fkey`,
-- `rep_team_expenses_balance_entry_id_fkey`,
-- `idx_rep_team_expenses_deposit_entry`, `idx_rep_team_expenses_balance_entry`.
-- (Mig 255's header named only the deposit index; there are two.)
-- ---------------------------------------------------------------

BEGIN;

-- ── the payable's two halves: what each was, when it was due, when it settled ──
ALTER TABLE rep_team_expenses
  DROP COLUMN IF EXISTS deposit_amount,
  DROP COLUMN IF EXISTS deposit_due_date,
  DROP COLUMN IF EXISTS deposit_paid_at,
  DROP COLUMN IF EXISTS balance_amount,
  DROP COLUMN IF EXISTS balance_due_date,
  DROP COLUMN IF EXISTS balance_paid_at;

-- ── the per-half ledger links (mig 236); mig 255 carried these onto the payments ──
ALTER TABLE rep_team_expenses
  DROP COLUMN IF EXISTS deposit_entry_id,
  DROP COLUMN IF EXISTS balance_entry_id;

-- ── the lump expense's paid stamp. It predates the deposit/balance split, which
--    is why it was verified hardest: the money form's `expensePaidAt` FIELD is
--    alive and well, but it is a request-body name that becomes a payment's
--    paid date — it has not written this column since the rebuild.
ALTER TABLE rep_team_expenses
  DROP COLUMN IF EXISTS expense_paid_at;

COMMIT;
