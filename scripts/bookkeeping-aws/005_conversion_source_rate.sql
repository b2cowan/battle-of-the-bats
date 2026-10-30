-- Historical revisions retain NULL. Only a new revision records the owner's source choice.
ALTER TABLE bookkeeping.expense_revisions ADD COLUMN IF NOT EXISTS conversion_source text;
ALTER TABLE bookkeeping.expense_revisions ADD COLUMN IF NOT EXISTS conversion_rate numeric(30, 18);
