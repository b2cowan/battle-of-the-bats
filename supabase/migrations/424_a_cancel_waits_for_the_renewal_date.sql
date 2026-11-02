-- ---------------------------------------------------------------
-- Migration 424 — Plans end at the renewal date, Stage 1: a cancel waits for the renewal date
-- (build prompt docs/projects/active/PLAN_ENDS_AT_RENEWAL_STAGE1_BUILD_PROMPT.md; plan PLAN_ENDS_AT_RENEWAL_PLAN.md §3, §3a).
--
-- WHY: a cancel used to end the plan at the click. It now ends on the renewal date the customer already paid for
-- (owner ruling 2026-10-31). The waiting cancel is a billing_retention_intents row with status 'pending' (scheduled;
-- 'canceled' = withdrawn by Keep {Plan}) and effective_at = the end date. Both status values have been allowed by the
-- table's CHECK since migration 038 (dev and prod snapshots, 2026-11-01), so no constraint changes here.
--
-- WHAT CHANGES (billing_retention_intents only):
--   (1) one waiting cancel per account: a partial unique index on (org_id) for pending cancellations. The route and the
--       webhook's `subscription.updated` arm both find-then-write; this is the real guard against a double click or the
--       two racing (review S2).
--   (2) stripe_subscription_id — the subscription the row is about (keys the webhook's writes; lets the deletion arm
--       recognise its own applied row instead of "the latest applied one, at any age" — review S4).
--   (3) held_move_plan — a cheaper-plan move that was waiting at renewal when the cancel was scheduled; Keep {Plan}
--       puts it back (gap review G1). Not target_plan, which means a downgrade's destination.
--   (4) notify_owner — the platform admin's "tell the owner" tick, honoured by the ending's emails (decision 6).
--   (5) once-only stamps for the four emails of a waiting cancel (gap review G6): ends on, the seven-day reminder,
--       kept, ended.
--   (6) change_log — who scheduled, kept, withdrew or ended it, and what happened to a waiting move (carried, put back,
--       dropped). Plans & pricing's "Changed by the customer" state reads it later.
--
-- Additive, re-runnable, no row changes (no pending row exists anywhere: nothing has ever written one). Safe on a
-- database with live subscriptions. Prod order: this migration BEFORE the code (the code writes these columns).
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.billing_retention_intents
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS held_move_plan text,
  ADD COLUMN IF NOT EXISTS notify_owner boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ends_on_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS kept_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS change_log jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'billing_retention_intents_change_log_check'
      AND conrelid = 'public.billing_retention_intents'::regclass
  ) THEN
    ALTER TABLE public.billing_retention_intents
      ADD CONSTRAINT billing_retention_intents_change_log_check CHECK (jsonb_typeof(change_log) = 'array');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS billing_retention_intents_one_pending_cancellation
  ON public.billing_retention_intents (org_id)
  WHERE intent_type = 'cancellation' AND status = 'pending';

COMMIT;
