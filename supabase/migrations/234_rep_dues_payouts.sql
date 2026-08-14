-- 234 — Money goes out (Pass 2 of the season-refund revamp).
--
-- A credit is money the team owes a family (owner model 2026-08-14). Pass 1 let credits lower
-- bills; this pass gives the books their OUTBOX: paying a credit out in cash. Two pieces:
--
--   · rep_dues_payouts — deliberately the mirror of rep_dues_payments (mig 232), including its
--     RLS-enabled-no-policies (service-role only) treatment. One money-out ledger entry per
--     payout, dated the day the money left; removal VOIDS the entry (never deletes it).
--     WHICH credits a payout settles is DERIVED at read time (lib/dues-credits.ts paidOut input)
--     — never stored, same discipline as credit application and payment coverage.
--
--   · rep_team_expenses.paid_by_player_id — "a family paid this out of pocket" (owner Call 5).
--     Presence means: counts in the budget as usual, NO cash left the team (the cash line
--     excludes it), and a 'reimbursement' credit was created for that family. The credit is the
--     debt; this column is the provenance trail from the expense to it.

CREATE TABLE IF NOT EXISTS rep_dues_payouts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_year_id     uuid NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  player_id           uuid NOT NULL REFERENCES rep_roster_players(id) ON DELETE CASCADE,
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id             uuid NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  amount              numeric(10,2) NOT NULL CHECK (amount > 0),
  -- The day the money LEFT (org-timezone date, coach-typed, default today) — the ledger entry
  -- takes this date, like rep_dues_payments.received_date takes the arrival day.
  paid_date           date NOT NULL,
  method              text NOT NULL DEFAULT 'etransfer'
                        CHECK (method IN ('etransfer', 'cash', 'cheque', 'other')),
  note                text,
  accounting_entry_id uuid REFERENCES accounting_entries(id),
  -- 'recorded' = the Pay out sheet; 'season_settlement' = Pass 3's bulk Pay all.
  source              text NOT NULL DEFAULT 'recorded'
                        CHECK (source IN ('recorded', 'season_settlement')),
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rep_dues_payouts_year_player
  ON rep_dues_payouts (program_year_id, player_id);

-- Service-role only, like rep_dues_payments: RLS on, no policies — every reader goes through
-- the coach API's capability checks, never straight from the browser.
ALTER TABLE rep_dues_payouts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE rep_dues_payouts IS
  'The outbox (owner model 2026-08-14, Pass 2): cash paid out to a family against their credits. '
  'Mirror of rep_dues_payments. WHICH credits a payout settles is derived at read time '
  '(lib/dues-credits.ts) — never stored. One money-out accounting entry per payout, dated '
  'paid_date; removal voids the entry.';

ALTER TABLE rep_team_expenses
  ADD COLUMN IF NOT EXISTS paid_by_player_id uuid REFERENCES rep_roster_players(id) ON DELETE SET NULL;

-- The credit an out-of-pocket expense creates, tied to the expense that created it — exactly the
-- treatment mig 232 gave an overpayment credit and its payment (`rep_dues_credits.payment_id`,
-- CASCADE). Without it the relationship lives only in application code, so deleting the expense
-- would strand a credit claiming the team owes a family for a cost that no longer exists.
ALTER TABLE rep_dues_credits
  ADD COLUMN IF NOT EXISTS expense_id uuid REFERENCES rep_team_expenses(id) ON DELETE CASCADE;

COMMENT ON COLUMN rep_dues_credits.expense_id IS
  'Set only on `reimbursement` credits, pointing at the out-of-pocket expense that created them '
  '(mig 234). ON DELETE CASCADE: removing the expense removes the debt it created — the mirror '
  'of payment_id/overpayment. Manual and fundraiser credits: NULL.';

COMMENT ON COLUMN rep_team_expenses.paid_by_player_id IS
  'Out-of-pocket (owner Call 5, 2026-08-14): a family covered this cost directly. Counts in the '
  'budget and Budget vs. Actual exactly as a team-paid expense; the CASH line excludes it (no '
  'money left the team''s account); a reimbursement credit (rep_dues_credits, credit_type '
  '''reimbursement'') was created for the family in the same act. NULL = the team paid.';
