-- ---------------------------------------------------------------
-- Migration 375 — Club Tier Stage 12b Part 5: a house-league refund goes back to the card, in full or in part.
-- Plan: docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md §0c, §0e (owner rulings 2026-10-25; L1 partial refunds).
--
-- WHY: 12a refunds a team's whole payment, once (mig 358, one live refund per payment). A house-league payment covers
-- one or more children (mig 374): a refund names ONE child, and may return part of what that child paid (a price
-- correction, "Refund part of it" on an ending). FieldLogicHQ's fee is never refunded (§0c); with A2's box ticked on a
-- FULL refund, the club pays the family's fee share back as a "Payment processing" cost. A partial refund never
-- includes the fee (owner §0e).
--
-- WHAT CHANGES:
--   1. online_payment_refunds.booked_at: when a house-league refund's book lines were written. A house-league refund is
--      BOOKED the moment Stripe accepts it (succeeded or pending), in the same act as the ending or the price correction,
--      so the season's book, the card and the registration never disagree. A refund Stripe later returns keeps its line
--      and raises "didn't reach the card" (send it another way, then record it).
--   2. The one-full-refund index is dropped (its own comment said 12b would) and online_payment_refund_open is replaced
--      (one signature; the 12a call still resolves: the new arguments default to NULL). It locks the payment, and:
--        - a tournament payment: exactly 12a's rule — the whole payment, one live refund ("already being refunded");
--        - a house-league payment: names its child; the amount is what is left of that child's share (or a part of it,
--          with a reason unless it is a price correction); the fee share only on a full refund of an untouched share.
--   3. online_payment_league_refund_book: writes the refund's lines through THE house-league writer (club_league_money
--      'refund', method 'online_card', under the online-payment write flag) and the club's "Payment processing" cost for a
--      fee given back; a child's share that never landed (Needs attention) has no line to reverse. Marks the payment
--      paid / partly refunded / refunded. Idempotent: a booked refund only moves to succeeded.
--   4. online_payment_league_refund_resolve: a booked refund that couldn't reach the card, sent another way by the club.
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. When a house-league refund was booked ────────────────────────────────────────────────────
ALTER TABLE public.online_payment_refunds ADD COLUMN IF NOT EXISTS booked_at timestamptz;

-- The guard (mig 374) keeps booked_at, like the entries, the functions' alone.
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
       OR NEW.processing_cost_entry_id IS NOT NULL OR NEW.booked_at IS NOT NULL THEN
      RAISE EXCEPTION 'A refund starts pending; Stripe''s answer records the rest.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount OR NEW.fee_refunded IS DISTINCT FROM OLD.fee_refunded
     OR NEW.online_payment_id IS DISTINCT FROM OLD.online_payment_id OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.online_payment_item_id IS DISTINCT FROM OLD.online_payment_item_id
     OR NEW.partial_reason IS DISTINCT FROM OLD.partial_reason OR NEW.booked_at IS DISTINCT FROM OLD.booked_at
     OR NEW.refund_entry_id IS DISTINCT FROM OLD.refund_entry_id OR NEW.processing_cost_entry_id IS DISTINCT FROM OLD.processing_cost_entry_id
     OR NEW.succeeded_at IS DISTINCT FROM OLD.succeeded_at
     OR (NEW.stripe_refund_id IS DISTINCT FROM OLD.stripe_refund_id AND OLD.stripe_refund_id IS NOT NULL)
     OR (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'pending' AND NEW.status IN ('failed', 'canceled'))) THEN
    RAISE EXCEPTION 'A refund changes only through its landing.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.online_payment_refunds_guard() FROM PUBLIC, anon, authenticated;

-- ── 2. Opening a refund ─────────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.online_payment_refunds_one_full_refund;
DROP FUNCTION IF EXISTS public.online_payment_refund_open(uuid, boolean, text, text, uuid, text);

CREATE OR REPLACE FUNCTION public.online_payment_refund_open(
  p_online_payment uuid, p_fee_included boolean, p_reason text, p_note text, p_actor uuid, p_origin text,
  p_item uuid DEFAULT NULL, p_amount numeric DEFAULT NULL, p_partial_reason text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op public.online_payments%ROWTYPE; v_it public.online_payment_items%ROWTYPE;
  v_back numeric(12,2); v_left numeric(12,2); v_amt numeric(12,2); v_fee numeric(12,2) := 0; v_id uuid;
  v_why text := nullif(btrim(coalesce(p_partial_reason, '')), '');
BEGIN
  -- The payment's row lock is the one-refund-at-a-time rule now (the 12a index is gone): a second press waits, then
  -- sees the first refund's amount.
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  IF v_op.status NOT IN ('paid', 'partly_refunded') THEN RAISE EXCEPTION 'This payment can no longer be refunded.'; END IF;

  IF v_op.flow = 'tournament_team' THEN
    -- 12a's rule, unchanged: the whole payment, one live refund.
    IF p_item IS NOT NULL OR p_amount IS NOT NULL THEN RAISE EXCEPTION 'A team''s card payment is refunded in full.'; END IF;
    IF p_reason IS NOT NULL AND p_reason NOT IN ('organizer_ended', 'team_left') THEN RAISE EXCEPTION 'Invalid refund reason'; END IF;
    IF EXISTS (SELECT 1 FROM online_payment_refunds r WHERE r.online_payment_id = v_op.id AND r.status IN ('pending', 'succeeded')) THEN
      RAISE EXCEPTION 'This payment is already being refunded.';
    END IF;
    v_fee := CASE WHEN p_fee_included AND v_op.fee_payer = 'family' THEN v_op.fee_amount ELSE 0 END;
    INSERT INTO online_payment_refunds(online_payment_id, org_id, amount, fee_refunded, reason, note, origin, created_by)
    VALUES (v_op.id, v_op.org_id, v_op.base_amount + v_fee, v_fee,
      CASE WHEN v_op.fee_payer = 'family' THEN p_reason END, nullif(trim(p_note), ''), coalesce(p_origin, 'app'), p_actor)
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  -- A house-league payment: one child's share.
  IF p_item IS NULL THEN RAISE EXCEPTION 'A house-league refund names the child it refunds.'; END IF;
  SELECT * INTO v_it FROM online_payment_items i WHERE i.id = p_item AND i.online_payment_id = v_op.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That child is not on this payment.'; END IF;
  IF p_reason IS NOT NULL AND p_reason NOT IN ('club_ended', 'family_left', 'price_corrected') THEN RAISE EXCEPTION 'Invalid refund reason'; END IF;
  SELECT coalesce(sum(r.amount - r.fee_refunded), 0) INTO v_back FROM online_payment_refunds r
   WHERE r.online_payment_item_id = v_it.id AND (r.status IN ('pending', 'succeeded') OR r.booked_at IS NOT NULL);
  v_left := v_it.amount - v_back;
  IF v_left <= 0 THEN RAISE EXCEPTION 'This child''s payment is already refunded.'; END IF;
  v_amt := coalesce(round(p_amount, 2), v_left);
  IF v_amt <= 0 OR v_amt > v_left THEN RAISE EXCEPTION 'A refund is more than zero and no more than what is left: %', v_left; END IF;
  -- Part of a share needs a reason (copy §6.1), except a price correction, whose reason is the correction's.
  IF (v_amt < v_it.amount) AND v_why IS NULL AND coalesce(p_reason, '') <> 'price_corrected' THEN
    RAISE EXCEPTION 'A partial refund needs a reason.';
  END IF;
  -- The fee share goes back only on a FULL refund of an untouched share, while the family paid the fee (owner §0e).
  IF p_fee_included AND v_op.fee_payer = 'family' AND v_amt = v_it.amount AND v_back = 0 THEN v_fee := v_it.fee_share; END IF;
  INSERT INTO online_payment_refunds(online_payment_id, online_payment_item_id, org_id, amount, fee_refunded, reason,
    partial_reason, note, origin, created_by)
  VALUES (v_op.id, v_it.id, v_op.org_id, v_amt + v_fee, v_fee,
    CASE WHEN v_op.fee_payer = 'family' THEN p_reason END, v_why, nullif(trim(p_note), ''), coalesce(p_origin, 'app'), p_actor)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.online_payment_refund_open(uuid, boolean, text, text, uuid, text, uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_refund_open(uuid, boolean, text, text, uuid, text, uuid, numeric, text) TO service_role;

-- ── 3. Booking a house-league refund ────────────────────────────────────────────────────────────
-- Stripe accepted the refund (p_succeeded: it already succeeded; else it is pending) → its lines, once. Lock order is the
-- ending's (mig 369): the season, the child's registration, the payment, the refund. The child's money goes out through
-- THE house-league writer ('refund', 'online_card', dated today — never refused by a closed year, mig 358's refund rule);
-- the fee share the club gives back is a "Payment processing" cost (never a fee refund line). A share that never landed
-- has no line to reverse: the refund only returns Stripe's money. A booked refund is only marked succeeded on a repeat.
CREATE OR REPLACE FUNCTION public.online_payment_league_refund_book(p_refund uuid, p_stripe_refund text, p_succeeded boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_r public.online_payment_refunds%ROWTYPE; v_op public.online_payments%ROWTYPE; v_it public.online_payment_items%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'America/Toronto')::date; v_entry uuid; v_refusal text; v_cost uuid;
  v_back numeric(12,2); v_word text;
BEGIN
  SELECT * INTO v_r FROM online_payment_refunds WHERE id = p_refund;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = v_r.online_payment_id;
  IF v_op.flow <> 'league_signup' OR v_r.online_payment_item_id IS NULL THEN RAISE EXCEPTION 'Not a house-league refund'; END IF;
  SELECT * INTO v_it FROM online_payment_items WHERE id = v_r.online_payment_item_id;

  IF v_op.season_id IS NOT NULL THEN PERFORM 1 FROM league_seasons s WHERE s.id = v_op.season_id FOR NO KEY UPDATE; END IF;
  IF v_it.registration_id IS NOT NULL THEN PERFORM 1 FROM league_registrations g WHERE g.id = v_it.registration_id FOR UPDATE; END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = v_r.online_payment_id FOR UPDATE;
  SELECT * INTO v_r FROM online_payment_refunds WHERE id = p_refund FOR UPDATE;

  PERFORM set_config('flhq.online_payment_write', 'on', true);
  IF v_r.booked_at IS NULL THEN
    IF v_r.status NOT IN ('pending', 'succeeded') THEN RAISE EXCEPTION 'This refund did not go through.'; END IF;
    IF v_it.entry_id IS NOT NULL AND v_it.registration_id IS NOT NULL AND v_op.season_id IS NOT NULL THEN
      v_word := coalesce(v_r.partial_reason, CASE v_r.reason WHEN 'club_ended' THEN 'Refunded to card' WHEN 'family_left' THEN 'Refunded to card'
        WHEN 'price_corrected' THEN 'Price corrected · refunded to card' ELSE 'Refunded to card' END);
      SELECT m.entry, m.refusal INTO v_entry, v_refusal
        FROM club_league_money(v_op.org_id, v_op.season_id, v_it.registration_id, 'refund', v_r.amount - v_r.fee_refunded, v_today,
                               'online_card', v_word, v_r.created_by) m;
      IF v_refusal IS NOT NULL THEN RAISE EXCEPTION 'The refund could not go in the season''s book: %', v_refusal; END IF;
    END IF;
    IF v_r.fee_refunded > 0 AND v_op.season_id IS NOT NULL THEN
      v_cost := online_payment_league_post_out(v_op.season_id, 'Payment processing', v_today,
        'Processing fee refunded · ' || v_it.description, v_r.fee_refunded, v_r.id, v_r.created_by);
    END IF;
    UPDATE online_payment_refunds SET booked_at = now(), refund_entry_id = v_entry, processing_cost_entry_id = v_cost,
      stripe_refund_id = coalesce(p_stripe_refund, stripe_refund_id), updated_at = now()
    WHERE id = v_r.id;
  END IF;
  IF p_succeeded THEN
    UPDATE online_payment_refunds SET status = 'succeeded', succeeded_at = coalesce(succeeded_at, now()), failure_reason = NULL,
      stripe_refund_id = coalesce(p_stripe_refund, stripe_refund_id), updated_at = now()
    WHERE id = v_r.id AND status <> 'succeeded';
  END IF;
  -- The payment reads what has gone back: everything booked or succeeded, against the base.
  SELECT coalesce(sum(r.amount - r.fee_refunded), 0) INTO v_back FROM online_payment_refunds r
   WHERE r.online_payment_id = v_op.id AND (r.booked_at IS NOT NULL OR r.status = 'succeeded');
  UPDATE online_payments SET status = CASE WHEN v_back >= v_op.base_amount THEN 'refunded' WHEN v_back > 0 THEN 'partly_refunded' ELSE status END,
    updated_at = now()
  WHERE id = v_op.id;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN jsonb_build_object('refundEntryId', v_entry, 'processingCostEntryId', v_cost, 'returned', v_back);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_league_refund_book(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_league_refund_book(uuid, text, boolean) TO service_role;

-- ── 4. A booked refund that couldn't reach the card, sent another way ───────────────────────────
-- The book already holds the refund (it was booked when Stripe accepted it); the club sent the money another way after
-- Stripe returned it. The refund is marked done, its card failure kept as the record of why.
CREATE OR REPLACE FUNCTION public.online_payment_league_refund_resolve(p_refund uuid, p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_r public.online_payment_refunds%ROWTYPE;
BEGIN
  SELECT * INTO v_r FROM online_payment_refunds WHERE id = p_refund FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  IF v_r.booked_at IS NULL OR v_r.status <> 'failed' THEN RAISE EXCEPTION 'Only a refund that couldn''t reach the card is sent another way.'; END IF;
  PERFORM set_config('flhq.online_payment_write', 'on', true);
  UPDATE online_payment_refunds SET status = 'succeeded', succeeded_at = now(),
    note = left(concat_ws(' · ', nullif(note, ''), 'Sent another way after the card refund came back'), 1000), updated_at = now()
  WHERE id = v_r.id;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_league_refund_resolve(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_league_refund_resolve(uuid, uuid) TO service_role;

COMMIT;
