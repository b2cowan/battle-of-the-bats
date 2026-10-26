-- Keep historical amounts intact. NULL marks revisions created before this distinction.
-- Old pending/zero rows are treated as unknown in the app; a correction records a new explicit state.
ALTER TABLE bookkeeping.expense_revisions ADD COLUMN IF NOT EXISTS tax_amount_known boolean;
