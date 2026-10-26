-- ---------------------------------------------------------------
-- Migration 376 — Club Tier Stage 12b, /review fixes to mig 375: a card refund never outruns the season's book.
-- Plan: docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md §0e.
--
-- WHY (/review 2026-10-25, correctness lens):
--   1. A child's card share could be refunded beyond what the season's book still shows received — e.g. a price lowered
--      and the difference refunded by cheque, then "Refund to the card" for the whole share: Stripe paid, and the book's
--      writer then refused the line ('amount'). Money out, nothing booked. Now the OPEN refuses first, before Stripe is
--      asked: a refund of a landed share is at most what the registration still shows received, less refunds already
--      opened and not yet booked.
--   2. Refunding ALL of what is left of a share that was refunded in part before needed a reason, as if it were partial.
--      A reason is asked only when the refund leaves something of the share behind.
-- Function only: online_payment_refund_open replaced with the same signature and grants.
-- ---------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.online_payment_refund_open(
  p_online_payment uuid, p_fee_included boolean, p_reason text, p_note text, p_actor uuid, p_origin text,
  p_item uuid DEFAULT NULL, p_amount numeric DEFAULT NULL, p_partial_reason text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op public.online_payments%ROWTYPE; v_it public.online_payment_items%ROWTYPE;
  v_back numeric(12,2); v_left numeric(12,2); v_amt numeric(12,2); v_fee numeric(12,2) := 0; v_id uuid;
  v_book_left numeric(12,2);
  v_why text := nullif(btrim(coalesce(p_partial_reason, '')), '');
  v_reg uuid;
BEGIN
  -- Lock order is the booking's (mig 375): the child's registration BEFORE the payment, so an open and a booking on one
  -- child queue rather than deadlock.
  IF p_item IS NOT NULL THEN
    SELECT i.registration_id INTO v_reg FROM online_payment_items i WHERE i.id = p_item;
    IF v_reg IS NOT NULL THEN PERFORM 1 FROM league_registrations g WHERE g.id = v_reg FOR UPDATE; END IF;
  END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  IF v_op.status NOT IN ('paid', 'partly_refunded') THEN RAISE EXCEPTION 'This payment can no longer be refunded.'; END IF;

  IF v_op.flow = 'tournament_team' THEN
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

  IF p_item IS NULL THEN RAISE EXCEPTION 'A house-league refund names the child it refunds.'; END IF;
  SELECT * INTO v_it FROM online_payment_items i WHERE i.id = p_item AND i.online_payment_id = v_op.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That child is not on this payment.'; END IF;
  IF p_reason IS NOT NULL AND p_reason NOT IN ('club_ended', 'family_left', 'price_corrected') THEN RAISE EXCEPTION 'Invalid refund reason'; END IF;
  SELECT coalesce(sum(r.amount - r.fee_refunded), 0) INTO v_back FROM online_payment_refunds r
   WHERE r.online_payment_item_id = v_it.id AND (r.status IN ('pending', 'succeeded') OR r.booked_at IS NOT NULL);
  v_left := v_it.amount - v_back;
  -- ▶ 376: a landed share's refund is also capped by the season's book — what the registration still shows received,
  -- less refunds of its card shares opened and not booked yet (they will take a line when Stripe accepts them).
  IF v_it.entry_id IS NOT NULL AND v_it.registration_id IS NOT NULL THEN
    SELECT league_reg_received(v_it.registration_id) - coalesce(sum(r.amount - r.fee_refunded), 0) INTO v_book_left
      FROM online_payment_refunds r JOIN online_payment_items i ON i.id = r.online_payment_item_id
     WHERE i.registration_id = v_it.registration_id AND r.status = 'pending' AND r.booked_at IS NULL;
    v_left := least(v_left, v_book_left);
  END IF;
  IF v_left <= 0 THEN RAISE EXCEPTION 'This child''s payment is already refunded.'; END IF;
  v_amt := coalesce(round(p_amount, 2), v_left);
  IF v_amt <= 0 OR v_amt > v_left THEN RAISE EXCEPTION 'A refund is more than zero and no more than what is left: %', v_left; END IF;
  -- ▶ 376: a reason only when the refund leaves part of the share behind (all of what is left needs none).
  IF v_amt < v_left AND v_why IS NULL AND coalesce(p_reason, '') <> 'price_corrected' THEN
    RAISE EXCEPTION 'A partial refund needs a reason.';
  END IF;
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

COMMIT;
