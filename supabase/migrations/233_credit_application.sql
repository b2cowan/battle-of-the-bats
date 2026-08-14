-- 233 — Credits meet the bills (Pass 1 of the season-refund revamp).
--
-- A credit is money the team owes a family (owner model, 2026-08-14), settled exactly one of
-- three ways: it lowers their remaining bills, it is paid out in cash, or it is handed back at
-- season's end. This migration carries only Pass 1's schema: HOW credits meet bills (the
-- team-wide setting) and the two new credit kinds. The payout table (Pass 2) and the refund
-- sheet's settings (Pass 3) ride their own migrations.
--
-- WHERE a credit lands is DERIVED AT READ TIME (lib/dues-credits.ts) and never stored — the same
-- discipline as payment coverage (mig 232), for the same reason: a stored allocation goes stale
-- the moment dues change, a payment lands, or a credit resizes. No installment id ever lands on
-- a credit row.

-- ── The team-wide setting (owner Call 2) ─────────────────────────────────────────────────────
-- Default 'last_first' for EVERY season, new and existing (owner 2026-08-14: no teams on
-- production, so no split-default/staged-backfill machinery — every team starts on the behaviour
-- the product wants to demonstrate). 'keep_separate' is a choice a coach makes, never a state
-- anyone is silently left in.
ALTER TABLE rep_program_years
  ADD COLUMN IF NOT EXISTS credit_application text NOT NULL DEFAULT 'last_first'
    CHECK (credit_application IN ('last_first', 'next_first', 'keep_separate'));

COMMENT ON COLUMN rep_program_years.credit_application IS
  'How this team''s dues credits meet its bills (owner Call 2, 2026-08-14): last_first (default) '
  '— credits eat the schedule from the far end; next_first — relief lands on the next bill due; '
  'keep_separate — credits never touch bills (forgiveness excepted) and settle at season''s end. '
  'Application is DERIVED at read time (lib/dues-credits.ts), never stored.';

-- ── Two new credit kinds (owner Calls 5 and 10) ──────────────────────────────────────────────
-- 'forgiven' — debt relief: lowers bills like any credit but is never owed back and can never be
--             paid out (excluded from the three-state identity by type).
-- 'reimbursement' — a family covered a team cost out of pocket (rep_team_expenses.paid_by_player_id,
--             Pass 2): counts in the budget, moves no team cash, and the team owes the family.
ALTER TABLE rep_dues_credits
  DROP CONSTRAINT IF EXISTS rep_dues_credits_credit_type_check;
ALTER TABLE rep_dues_credits
  ADD CONSTRAINT rep_dues_credits_credit_type_check
    CHECK (credit_type = ANY (ARRAY[
      'contribution'::text,
      'fundraiser'::text,
      'overpayment'::text,
      'other'::text,
      'forgiven'::text,
      'reimbursement'::text
    ]));

COMMENT ON COLUMN rep_dues_credits.credit_type IS
  'contribution | fundraiser | overpayment | other | forgiven | reimbursement. ''forgiven'' is '
  'debt relief — applies to bills first, is never owed back, can never be paid out. '
  '''reimbursement'' is created by an out-of-pocket expense (Pass 2). One credit mechanism for '
  'every kind (CLAUDE.md standing constraint) — no parallel systems.';
