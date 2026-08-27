-- ---------------------------------------------------------------
-- Migration 267 — a payment learns who paid it
--   (Coach money centralization, P4 — owner-approved 2026-08-27)
--
-- Plan: docs/projects/active/COACH_MONEY_CENTRALIZATION_PLAN.md §8c.
-- Brief: COACH_MONEY_CENTRALIZATION_P4_PM_BRIEF.md. Owner QA §116.
--
-- ⚠⚠ THE CASE, AND WHY THE COST-LEVEL COLUMN COULD NOT CARRY IT.
-- A $600 tournament entry the team owes; a parent pays the $200 deposit
-- straight to the tournament. The team's cash never moves for that $200 and
-- the team now owes that family $200 against their dues.
--
-- `rep_team_expenses.paid_by_player_id` (mig 234) says a family fronted the
-- WHOLE cost — all or nothing. It cannot express one piece of a bill the team
-- is paying the rest of, which is exactly this case. So the same fact moves
-- one level down, onto the payment, under the SAME NAME because it means the
-- same thing: whose money actually moved.
--
-- ⚠ THIS IS NOT `rep_team_money_in` (that table's gotcha 1). A coach describes
-- both as "a parent paid me back" and they are opposites. Paid out of pocket:
-- the team's cash never moved and the team OWES that family. Money back: the
-- team's cash went out and some returned, and the team owes NOBODY. This
-- migration extends the first and touches the second not at all.
--
-- ⚠ NOTHING HERE CHANGES A DUES SCHEDULE (money-in gotcha 4, honoured). The
-- credit lowers what a family is ASKED TO SEND, which is derived at read time
-- by lib/dues-credits.ts, exactly as every other credit already does.
-- ---------------------------------------------------------------

-- ── 1. Whose money moved, on the payment ────────────────────────────────────
--
-- ⚠ ON DELETE SET NULL, matching the cost-level column deliberately: losing a
-- provenance pointer must never delete the record of money that moved. The
-- REAL protection is elsewhere and stays there — `rep_dues_credits.player_id`
-- is NOT NULL and the roster undo-guard refuses to remove a player who carries
-- credits, so this SET NULL is a backstop for a path that should not arise. If
-- it ever does, the payment reads "A family paid direct" with no name, which is
-- the fallback lib/coach-register-book.ts already prints.
ALTER TABLE rep_payable_payments
  ADD COLUMN IF NOT EXISTS paid_by_player_id uuid
    REFERENCES rep_roster_players(id) ON DELETE SET NULL;

COMMENT ON COLUMN rep_payable_payments.paid_by_player_id IS
  'The family who paid THIS payment directly (P4, mig 267). NULL = the team paid it, which is the '
  'ordinary case. Set means no team cash moved and the team owes that household a reimbursement '
  'credit. The EFFECTIVE payer of a payment is this column ?? rep_team_expenses.paid_by_player_id — '
  'a cost that names a fronting family owns every payment against it, and the record form states '
  'that rather than asking again.';

-- Partial: the overwhelming majority of payments are the team's own, and every
-- reader that cares asks "which payments on THIS commitment were fronted?".
CREATE INDEX IF NOT EXISTS idx_rep_payable_payments_paid_by
  ON rep_payable_payments (expense_id)
  WHERE paid_by_player_id IS NOT NULL;

-- ── 2. ONE reimbursement credit per (cost, household) — structurally ────────
--
-- ⚠⚠ THIS IS THE GUARANTEE THAT REPLACES A `.maybeSingle()`. Before P4 there
-- was exactly one reimbursement credit per expense, so the reconciler could
-- fetch it with maybeSingle and set its amount to the sum of every payment on
-- the cost. A cost can now carry payments from more than one household, so the
-- credit set is keyed by (expense, payer) and the reconciler groups. Without
-- this index a retry racing itself could write a second row for one household
-- and the family's figure would silently double.
--
-- No new link column is needed: (expense_id, player_id, credit_type) IS the
-- natural key. ⚠ `rep_dues_credits.payment_id` is ALREADY TAKEN and means
-- something else entirely — a rep_dues_payments FK on auto-created overpayment
-- credits (that table's gotcha 6). It is not overloaded here.
DO $$
DECLARE
  dupes integer;
BEGIN
  SELECT count(*) INTO dupes FROM (
    SELECT expense_id, player_id
    FROM rep_dues_credits
    WHERE credit_type = 'reimbursement' AND expense_id IS NOT NULL
    GROUP BY expense_id, player_id
    HAVING count(*) > 1
  ) d;
  IF dupes > 0 THEN
    RAISE EXCEPTION
      'Cannot add the reimbursement uniqueness index: % (expense_id, player_id) pairs already carry '
      'more than one reimbursement credit. Reconcile those households by hand first — each duplicate '
      'is a family the product may be double-crediting today.', dupes;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_rep_dues_credits_reimbursement_per_household
  ON rep_dues_credits (expense_id, player_id)
  WHERE credit_type = 'reimbursement' AND expense_id IS NOT NULL;

-- ── Nothing is backfilled, deliberately ─────────────────────────────────────
--
-- Every existing payment on an out-of-pocket cost is ALREADY that family's, by
-- way of the cost's own column, and the effective-payer rule reads it that way
-- without a single row being rewritten. Stamping the column onto them would be
-- the same fact stored twice, which is how the two start disagreeing.
