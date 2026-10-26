-- ---------------------------------------------------------------
-- Migration 383 — Club Tier Stage 12c Part 2: a card refund remembers when the card's bank sent it back, and when the
-- family was emailed about it.
-- Plan: docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md §0g (owner rulings 2026-10-26); words
-- CLUB_TIER_STAGE12C_REFUND_VISIBLE_COPY.md §1–2 ("sent back {day}", "Family emailed").
--
-- WHY: the refund is now visible on the registration. Its Fee cell and record say the day the card's bank sent a refund
-- back ("$156.75 to the card · sent back Oct 23"), and keep saying it after the club records the refund as sent another
-- way ("The card refund (re_…) was sent back Oct 23"). `updated_at` can't carry that: recording it sent another way moves
-- it. The record also says whether and when the family was emailed (ruling 6: when Stripe accepts it, never for a failed
-- one), which nothing stored.
--
-- WHAT CHANGES:
--   1. online_payment_refunds.failed_at — set by online_payment_refund_failed (mig 358, replaced here: the same body plus
--      the stamp), kept afterwards; guarded like the other answers from Stripe. Backfilled from updated_at for the refunds
--      already failed (dev only: prod has no club taking payments).
--   2. online_payment_refunds.family_emailed_at / family_email_failed_at — when the refund email went, or could not be
--      sent. Written by the app's email step (like online_payments.receipt_emailed_at, not guarded).
--   3. online_payment_refunds.resolved_by — who recorded a returned refund as sent another way ("recorded by {who}");
--      online_payment_league_refund_resolve (mig 375) always took the person and never kept them. Replaced here to keep it.
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.online_payment_refunds ADD COLUMN IF NOT EXISTS failed_at timestamptz;
ALTER TABLE public.online_payment_refunds ADD COLUMN IF NOT EXISTS family_emailed_at timestamptz;
ALTER TABLE public.online_payment_refunds ADD COLUMN IF NOT EXISTS family_email_failed_at timestamptz;
ALTER TABLE public.online_payment_refunds ADD COLUMN IF NOT EXISTS resolved_by uuid;
ALTER TABLE public.online_payment_refunds DROP CONSTRAINT IF EXISTS online_payment_refunds_resolved_by_fk;
ALTER TABLE public.online_payment_refunds ADD CONSTRAINT online_payment_refunds_resolved_by_fk
  FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS online_payment_refunds_resolved_by_idx ON public.online_payment_refunds(resolved_by) WHERE resolved_by IS NOT NULL;

-- Mig 382's guard with failed_at (marked ▶ 383).
CREATE OR REPLACE FUNCTION public.online_payment_refunds_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.online_payment_item_id IS NULL
     AND EXISTS (SELECT 1 FROM online_payments p WHERE p.id = NEW.online_payment_id AND p.flow = 'league_signup') THEN
    RAISE EXCEPTION 'A house-league refund names the child it refunds.';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.online_payment_item_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM online_payment_items i
                      WHERE i.id = NEW.online_payment_item_id AND i.online_payment_id = NEW.online_payment_id AND i.org_id = NEW.org_id) THEN
    RAISE EXCEPTION 'A refund''s child belongs to its own payment.';
  END IF;
  IF coalesce(current_setting('flhq.online_payment_write', true), 'off') = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' OR NEW.succeeded_at IS NOT NULL OR NEW.refund_entry_id IS NOT NULL
       OR NEW.processing_cost_entry_id IS NOT NULL OR NEW.booked_at IS NOT NULL OR NEW.part_refund
       OR NEW.failed_at IS NOT NULL OR NEW.resolved_by IS NOT NULL THEN -- ▶ 383
      RAISE EXCEPTION 'A refund starts pending; Stripe''s answer records the rest.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount OR NEW.fee_refunded IS DISTINCT FROM OLD.fee_refunded
     OR NEW.online_payment_id IS DISTINCT FROM OLD.online_payment_id OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.online_payment_item_id IS DISTINCT FROM OLD.online_payment_item_id
     OR NEW.partial_reason IS DISTINCT FROM OLD.partial_reason OR NEW.booked_at IS DISTINCT FROM OLD.booked_at
     OR NEW.part_refund IS DISTINCT FROM OLD.part_refund
     OR NEW.failed_at IS DISTINCT FROM OLD.failed_at OR NEW.resolved_by IS DISTINCT FROM OLD.resolved_by -- ▶ 383
     OR NEW.refund_entry_id IS DISTINCT FROM OLD.refund_entry_id OR NEW.processing_cost_entry_id IS DISTINCT FROM OLD.processing_cost_entry_id
     OR NEW.succeeded_at IS DISTINCT FROM OLD.succeeded_at
     OR (NEW.stripe_refund_id IS DISTINCT FROM OLD.stripe_refund_id AND OLD.stripe_refund_id IS NOT NULL)
     OR (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'pending' AND NEW.status IN ('failed', 'canceled'))) THEN
    RAISE EXCEPTION 'A refund changes only through its landing.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.online_payment_refunds_guard() FROM PUBLIC, anon, authenticated;

-- Mig 358's (marked ▶ 383): the stamp of when it came back. Runs under the write flag now, so the guard lets the stamp in.
CREATE OR REPLACE FUNCTION public.online_payment_refund_failed(p_refund uuid, p_stripe_refund text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('flhq.online_payment_write', 'on', true);
  UPDATE online_payment_refunds SET status = 'failed', failure_reason = left(coalesce(p_reason, 'failed'), 500),
    stripe_refund_id = coalesce(p_stripe_refund, stripe_refund_id), failed_at = coalesce(failed_at, now()), updated_at = now() -- ▶ 383
  WHERE id = p_refund AND status = 'pending';
  PERFORM set_config('flhq.online_payment_write', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_refund_failed(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_refund_failed(uuid, text, text) TO service_role;

-- Mig 375's (marked ▶ 383): the person who recorded it is kept. Flow-blind: a team's returned part refund uses it too.
CREATE OR REPLACE FUNCTION public.online_payment_league_refund_resolve(p_refund uuid, p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_r public.online_payment_refunds%ROWTYPE;
BEGIN
  SELECT * INTO v_r FROM online_payment_refunds WHERE id = p_refund FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  IF v_r.booked_at IS NULL OR v_r.status <> 'failed' THEN RAISE EXCEPTION 'Only a refund that couldn''t reach the card is sent another way.'; END IF;
  PERFORM set_config('flhq.online_payment_write', 'on', true);
  UPDATE online_payment_refunds SET status = 'succeeded', succeeded_at = now(), resolved_by = p_actor, -- ▶ 383
    note = left(concat_ws(' · ', nullif(note, ''), 'Sent another way after the card refund came back'), 1000), updated_at = now()
  WHERE id = v_r.id;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_league_refund_resolve(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_league_refund_resolve(uuid, uuid) TO service_role;

DO $backfill$
BEGIN
  PERFORM set_config('flhq.online_payment_write', 'on', true);
  UPDATE online_payment_refunds SET failed_at = updated_at WHERE status = 'failed' AND failed_at IS NULL;
  -- A refund recorded sent another way after it came back (mig 375's resolve keeps the card's failure_reason).
  UPDATE online_payment_refunds SET failed_at = updated_at
   WHERE status = 'succeeded' AND failure_reason IS NOT NULL AND failed_at IS NULL;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
END $backfill$;

COMMIT;
