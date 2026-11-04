-- ---------------------------------------------------------------
-- Migration 431 — Plans end at the renewal date, Stage 2: one waiting plan change per account
-- (build prompt docs/projects/active/PLAN_ENDS_AT_RENEWAL_STAGE2_BUILD_PROMPT.md; plan PLAN_ENDS_AT_RENEWAL_PLAN.md §3, G2).
--
-- WHY: a move to the free plan now waits for the renewal date too (owner ruling 2026-10-31; Stage 2 rulings 2026-11-03).
-- It is a billing_retention_intents row with intent_type 'downgrade' and status 'pending' (target_plan and
-- keep_tournament_ids already exist; the CHECKs have allowed 'downgrade' and 'pending' since migration 038 — read from
-- the dev snapshot's live CHECK clauses, 2026-11-03). Owner ruling 4: ONE waiting change at a time — a cancel REPLACES
-- a waiting move to free (the move's row is withdrawn first), and a second move or a move over a waiting cancel is
-- refused. Migration 424's index guarded waiting cancels only; this one guards a waiting change of either kind.
--
-- WHAT CHANGES (billing_retention_intents only): the partial unique index on (org_id) widens from
-- "pending cancellation" to "pending" (the intent_type CHECK allows only 'cancellation' and 'downgrade').
--
-- Safe: no row has ever been written as a pending downgrade (the downgrade route wrote 'applied' only), so no account
-- holds two pending rows; the DO block refuses to build the index if one somehow does, rather than failing half-way.
-- Re-runnable. Prod order: after 424, BEFORE the Stage 2 code.
-- ---------------------------------------------------------------

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT org_id FROM public.billing_retention_intents
    WHERE status = 'pending'
    GROUP BY org_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'An account holds more than one waiting plan change; resolve it before migration 431.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS billing_retention_intents_one_pending_change
  ON public.billing_retention_intents (org_id)
  WHERE status = 'pending';

DROP INDEX IF EXISTS public.billing_retention_intents_one_pending_cancellation;

COMMIT;
