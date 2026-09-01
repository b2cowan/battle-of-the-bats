-- ---------------------------------------------------------------
-- Migration 271 — money from the club says WHICH KIND it is
--
-- Owner ruling 2026-08-15, re-ratified as D1 on 2026-08-30:
-- *"the coach chooses — new money, or money back. Forcing one reading
-- would be wrong about half the money."*
-- Plan of record: docs/projects/active/COACH_ORG_MONEY_IN_THE_BUDGET_PLAN.md
--
-- ⚠⚠ WHAT WAS WRONG — AND IT IS THE CODE ANSWERING A QUESTION THAT BELONGS
-- TO THE COACH, not a missing column.
--
-- Migration 250 taught club money to file itself under the team's own words,
-- and Budget vs. Actual learned to read it. But it read every approved
-- `charge_to_org` as a REIMBURSEMENT, unconditionally — the club covering a
-- cost, netting into the item it repaid. That is right for a repayment and
-- wrong for a grant, and the two arrive as the same transaction:
--
--   * read a genuine grant as a reversal and it vanishes into a cost line it
--     was never about, so the report hides that the club contributed at all
--     and next season is planned off an understated line;
--   * read a reimbursed permit as funding and the cost line still claims
--     spending the club ultimately carried.
--
-- Both net out at the season level. The harm is entirely in the report a coach
-- actually uses — which is why no arithmetic guard could ever have caught it.
--
-- ⚠ ONLY THE COACH KNOWS. Nothing on the record distinguishes them: same
-- direction, same amount, same club, same approval. So this column is ASKED,
-- never derived, and the ask is REQUIRED on create — which is how the standing
-- rule *"never guess a reversal"* is satisfied without a default existing.
--
-- ⚠⚠ NULL IS NOT "UNANSWERED", IT IS **LEGACY** — and there is NO BACKFILL,
-- deliberately (the standing no-backfill rule, and mig 250 shipped under it
-- too). Every request approved before this reads as a reimbursement exactly as
-- it has since it was approved, so no report restates itself and no treasurer's
-- reconciled month moves under them. A coach can re-file any one of them
-- deliberately, from the row's own "Change" — re-filing moves no money.
--
-- ⚠ THE SECOND CHECK IS THE ONE WORTH READING. A meaning is only meaningful on
-- money coming IN: a `payment_to_org` is the team sending the club money, which
-- is a cost and has no second reading. The write paths null it when a coach
-- flips a pending request's direction; this constraint is what makes that a
-- rule rather than a habit, because a row carrying `funding` on an outgoing
-- request would be read by nothing and quietly believed by the next person to
-- write a query.
--
-- ⚠ NO INDEX. This column is never a lookup key and never a filter — every
-- reader has already selected the season's requests by team and season and is
-- branching per row. An index here would be maintained and never used.
--
-- ⚠ NOTHING ABOUT APPROVAL, SETTLEMENT, CASH OR A DOLLAR CHANGES. The two
-- answers are identical to the cash book and to the season close-out pot: money
-- arrived, and the team is holding it. What differs is one line of one report.
-- ⚠⚠ AND NEITHER ANSWER EVER TOUCHES A PAYMENT SCHEDULE OR ANYONE'S DUES.
--
-- Safety: additive only, nullable with no default, every statement IF NOT
-- EXISTS / conditional, so re-running is a no-op.
--
-- Applies to: DEV. Production is a separate, explicit owner step.
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE rep_team_payment_requests
  ADD COLUMN IF NOT EXISTS money_in_meaning text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rep_team_payment_requests_money_in_meaning_check'
  ) THEN
    ALTER TABLE rep_team_payment_requests
      ADD CONSTRAINT rep_team_payment_requests_money_in_meaning_check
      CHECK (money_in_meaning IS NULL OR money_in_meaning IN ('funding', 'reimbursement'));
  END IF;

  -- A meaning belongs to money coming IN and to nothing else (see the header).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rep_team_payment_requests_meaning_is_incoming_check'
  ) THEN
    ALTER TABLE rep_team_payment_requests
      ADD CONSTRAINT rep_team_payment_requests_meaning_is_incoming_check
      CHECK (money_in_meaning IS NULL OR request_type = 'charge_to_org');
  END IF;
END $$;

COMMENT ON COLUMN rep_team_payment_requests.money_in_meaning IS
  'What money arriving FROM the club means, in the coach''s own reading — the one thing about a '
  'club arrival that no record can tell you (mig 271, owner ruling 2026-08-15 / D1 2026-08-30). '
  '''funding'' = new money for the season (a grant, or a cost the club agreed to carry): it lands '
  'as its own REVENUE row on Budget vs. Actual, filed against the money-IN side of the item '
  'library. ''reimbursement'' = the club paying the team back: it NETS into the cost it repaid, '
  'filed against the money-OUT side, and is never counted as income. '
  '⚠ NULL means LEGACY, not unanswered — every request approved before this migration keeps the '
  'reimbursement reading it already reports under (no backfill, by rule), and readers must treat '
  'NULL as ''reimbursement''. Required by the write paths on every NEW charge_to_org request, which '
  'is how "never guess a reversal" is satisfied without a default. '
  '⚠ Only ever set on request_type = ''charge_to_org'' (CHECK-enforced): a payment_to_org is the '
  'team paying the club, which is a cost and has no second reading. '
  '⚠ Changes ONE LINE OF ONE REPORT. Cash on hand, the register, the season close-out pot and '
  'every family''s dues read both answers identically — a dollar arrived either way.';

COMMIT;
