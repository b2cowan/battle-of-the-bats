-- Additive Aurora DSQL migration for the owner-approved two-date expense form.
-- Existing expense_date values stay untouched and remain "recorded date; meaning unconfirmed".
-- A later correction inserts a new revision with both dates; no historical row is rewritten.
ALTER TABLE bookkeeping.expense_revisions ADD COLUMN IF NOT EXISTS incurred_date date;
ALTER TABLE bookkeeping.expense_revisions ADD COLUMN IF NOT EXISTS paid_date date;
