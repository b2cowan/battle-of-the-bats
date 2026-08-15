-- 236 — Remember which ledger entry a payment created, so a delete can undo it.
--
-- Owner review 2026-08-15 (Q4): expenses and payables gained Edit and Delete, and a delete of
-- something already PAID has to reverse the money it posted. It could not.
--
-- ⚠ THE LINK WAS BEING THROWN AWAY. Marking an expense paid creates an accounting_entries row and
-- then discarded the id — the code did `void entry` with a comment claiming "the expense table
-- doesn't have a single entryId column". rep_team_expenses.accounting_entry_id has existed, with a
-- foreign key, the whole time; it was simply never written. So the column was not missing, it was
-- unused, and the comment sent every later reader away from the fix.
--
-- One column is genuinely not enough, though, and that is the real reason this migration exists: a
-- PAYABLE is paid in two halves that post SEPARATELY. A coach can pay the deposit in November and
-- the balance in March, producing two ledger entries months apart, either of which may be the one
-- a reversal has to void. Two more columns, one per half.
--
-- ⚠ ROWS PAID BEFORE THIS MIGRATION HAVE NO LINK and cannot get one — nothing recorded it. Those
-- are reversed by MATCHING the ledger entry on its description, amount and type (see
-- reverseLedgerEntryForExpense in lib/db.ts). That fallback is trustworthy for exactly this set and
-- no other: there was no Edit feature before now, so a historic expense's description is guaranteed
-- to be the one its ledger entry was written with. The moment Edit ships, that guarantee dies for
-- anything edited afterwards — which is precisely why new rows store the id instead of relying on
-- it. Where a match is ambiguous the delete REFUSES rather than voiding the wrong entry.
--
-- No backfill. Matching handles history at the moment it is needed, and a backfill would have to
-- make the same guess this migration exists to stop making silently.

ALTER TABLE rep_team_expenses
  ADD COLUMN IF NOT EXISTS deposit_entry_id uuid REFERENCES accounting_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS balance_entry_id uuid REFERENCES accounting_entries(id) ON DELETE SET NULL;

COMMENT ON COLUMN rep_team_expenses.accounting_entry_id IS
  'The ledger entry created when a LUMP EXPENSE was marked paid, so deleting the expense can void '
  'it (mig 236). Null on payables — they use deposit_entry_id/balance_entry_id — and null on any '
  'row paid before 2026-08-15, which reverses by matching instead. Existed unwritten before mig '
  '236; a null here does NOT mean unpaid, check expense_paid_at for that.';

COMMENT ON COLUMN rep_team_expenses.deposit_entry_id IS
  'The ledger entry created when a payable''s DEPOSIT was marked paid (mig 236). Separate from '
  'balance_entry_id because the two halves post months apart and either may need reversing alone. '
  'Null when the deposit is unpaid, or when it was paid before 2026-08-15.';

COMMENT ON COLUMN rep_team_expenses.balance_entry_id IS
  'The ledger entry created when a payable''s BALANCE was marked paid (mig 236). See '
  'deposit_entry_id — same rule, other half.';

-- ⚠ NOT UNIQUE, deliberately. A unique index would be the tighter invariant, but it would also
-- turn a duplicated link — which harms nothing, since voiding an already-void entry is a no-op —
-- into a failed save on a coach's money form. The reversal path re-reads the entry before voiding.

CREATE INDEX IF NOT EXISTS idx_rep_team_expenses_deposit_entry
  ON rep_team_expenses (deposit_entry_id) WHERE deposit_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rep_team_expenses_balance_entry
  ON rep_team_expenses (balance_entry_id) WHERE balance_entry_id IS NOT NULL;
