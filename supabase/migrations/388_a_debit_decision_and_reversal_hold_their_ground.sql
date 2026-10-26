-- ---------------------------------------------------------------
-- Migration 388 — Club Tier Stage 12c: the /review of the whole (2026-10-26), four database fixes to mig 387.
-- Plan: docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md §0k.
--
-- WHY / WHAT CHANGES:
--   1. A decision made while a debit cleared is VOID when the registration is no longer ended by the time it clears (the
--      desk put the child back): online_payment_clear_decisions.outcome gains 'void', and the house-league landing voids
--      instead of keeping or sending back. (A send-back would have refunded an enrolled child's fee.) The app re-checks a
--      team the same way.
--   2. A reversal takes back only what is STILL received from that payment: each child's share less its booked refunds
--      (net of any fee given back); a team's row less its part refunds (a row refunded in full adds no line). Before, a
--      reversal after a refund booked the whole amount again, so the family "owed" more than its fee.
--   3. A reversal is once per dispute: a second call with the same dispute answers already, whatever the payment reads.
--   4. "Reversed" is sticky: a refund that finishes after the bank reversed the debit (a bank refund waits for days) no
--      longer turns the payment back to refunded or partly refunded — which also let a retried dispute reverse it twice.
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. A void decision ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.online_payment_clear_decisions DROP CONSTRAINT IF EXISTS online_payment_clear_decisions_outcome_check;
ALTER TABLE public.online_payment_clear_decisions ADD CONSTRAINT online_payment_clear_decisions_outcome_check
  CHECK (outcome IS NULL OR outcome IN ('sent_back', 'kept', 'returned', 'failed', 'void'));

-- Mig 387's house-league landing (marked ▶ 388): the decision is carried out only while the registration is still ended.
CREATE OR REPLACE FUNCTION public.online_payment_league_land(
  p_online_payment uuid, p_paid_at timestamptz, p_payment_intent text, p_charge text, p_brand text, p_last4 text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op public.online_payments%ROWTYPE; v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_day date; v_closed date; v_receipt bigint; v_it public.online_payment_items%ROWTYPE;
  v_entry uuid; v_refusal text; v_cost uuid; v_landed integer := 0; v_unrecorded jsonb := '[]'::jsonb; v_method text;
  v_dec public.online_payment_clear_decisions%ROWTYPE; v_send_back jsonb := '[]'::jsonb; v_status text;
BEGIN
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  IF v_op.flow <> 'league_signup' THEN RAISE EXCEPTION 'Not a house-league payment'; END IF;
  IF v_op.landed_at IS NOT NULL OR v_op.status IN ('partly_refunded', 'refunded', 'returned', 'reversed') THEN
    RETURN jsonb_build_object('already', true, 'receiptNo', v_op.receipt_no, 'returned', v_op.status = 'returned');
  END IF;
  IF v_op.season_id IS NULL THEN RAISE EXCEPTION 'The house-league season is gone.'; END IF;

  PERFORM 1 FROM league_seasons s WHERE s.id = v_op.season_id FOR NO KEY UPDATE;
  PERFORM 1 FROM league_registrations r
   WHERE r.id IN (SELECT i.registration_id FROM online_payment_items i WHERE i.online_payment_id = v_op.id)
   ORDER BY r.id FOR UPDATE;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment FOR UPDATE;
  IF v_op.landed_at IS NOT NULL OR v_op.status IN ('partly_refunded', 'refunded', 'returned', 'reversed') THEN
    RETURN jsonb_build_object('already', true, 'receiptNo', v_op.receipt_no, 'returned', v_op.status = 'returned');
  END IF;

  v_day := least((p_paid_at AT TIME ZONE 'America/Toronto')::date, v_today);
  v_closed := club_books_closed_through(v_op.org_id);
  IF v_closed IS NOT NULL AND v_day <= v_closed THEN v_day := v_today; END IF;
  v_receipt := coalesce(v_op.receipt_no, nextval('online_payment_receipt_seq'));
  v_method := CASE WHEN v_op.rail = 'bank_debit' THEN 'online_bank' ELSE 'online_card' END;

  PERFORM set_config('flhq.online_payment_write', 'on', true);
  FOR v_it IN SELECT * FROM online_payment_items i WHERE i.online_payment_id = v_op.id AND i.entry_id IS NULL
               ORDER BY i.created_at, i.id FOR UPDATE LOOP
    v_entry := NULL; v_refusal := NULL;
    SELECT * INTO v_dec FROM online_payment_clear_decisions d
     WHERE d.online_payment_id = v_op.id AND d.online_payment_item_id = v_it.id AND d.outcome IS NULL FOR UPDATE; -- ▶ 387
    IF v_it.registration_id IS NULL THEN
      v_refusal := 'gone';
    ELSE
      BEGIN
        -- THE house-league writer (mig 369), with no person behind it: Stripe's answer.
        SELECT m.entry, m.refusal INTO v_entry, v_refusal
          FROM club_league_money(v_op.org_id, v_op.season_id, v_it.registration_id,
                                 CASE WHEN v_dec.id IS NOT NULL THEN 'receive_decided' ELSE 'receive' END, -- ▶ 387
                                 v_it.amount, v_day, v_method, NULL, NULL) m;
      EXCEPTION WHEN others THEN
        -- A passing failure is the WHOLE landing's to retry (Stripe redelivers); kept, it would stamp a child unrecorded
        -- for good. Classes 40 (rollback), 53 (resources), 57 (operator), and 55P03 (lock not available).
        IF SQLSTATE ~ '^(40|53|57)' OR SQLSTATE = '55P03' THEN RAISE; END IF;
        v_entry := NULL; v_refusal := left('error: ' || SQLERRM, 500);
      END;
    END IF;
    IF v_refusal IS NULL AND v_entry IS NOT NULL THEN
      UPDATE online_payment_items SET entry_id = v_entry, land_error = NULL, updated_at = now() WHERE id = v_it.id;
      v_landed := v_landed + 1;
      -- ▶ 387/388: the decision made while it cleared — only while the registration is still ended. A child the desk put
      -- back meanwhile has simply paid: the answer is void (review 2026-10-26: a send-back would refund an enrolled child).
      SELECT r.status INTO v_status FROM league_registrations r WHERE r.id = v_it.registration_id;
      IF v_dec.id IS NOT NULL AND v_status NOT IN ('declined', 'withdrawn') THEN
        UPDATE online_payment_clear_decisions SET outcome = 'void', outcome_at = now() WHERE id = v_dec.id;
      ELSIF v_dec.id IS NOT NULL AND v_dec.choice = 'keep' THEN
        UPDATE league_registrations r SET end_money = 'kept', end_money_reason = v_dec.reason, updated_at = now()
         WHERE r.id = v_it.registration_id AND r.status IN ('declined', 'withdrawn');
        UPDATE online_payment_clear_decisions SET outcome = 'kept', outcome_at = now() WHERE id = v_dec.id;
      ELSIF v_dec.id IS NOT NULL THEN
        v_send_back := v_send_back || jsonb_build_array(jsonb_build_object('decisionId', v_dec.id, 'itemId', v_it.id,
          'registrationId', v_it.registration_id, 'feeBack', v_dec.fee_back, 'actor', v_dec.decided_by));
      END IF;
    ELSE
      v_refusal := coalesce(v_refusal, 'not_recorded');
      UPDATE online_payment_items SET land_error = v_refusal, updated_at = now() WHERE id = v_it.id;
      v_unrecorded := v_unrecorded || jsonb_build_array(jsonb_build_object('itemId', v_it.id,
        'registrationId', v_it.registration_id, 'refusal', v_refusal, 'amount', v_it.amount, 'description', v_it.description));
    END IF;
  END LOOP;

  -- The club pays the fee (A14): one "Payment processing" cost per payment — never less fee revenue. Stripe charged the
  -- fee on the whole payment, so it is the club's cost even when a child's share couldn't land.
  IF v_op.fee_payer = 'club' AND v_op.fee_amount > 0 AND v_op.processing_cost_entry_id IS NULL THEN
    v_cost := online_payment_league_post_out(v_op.season_id, 'Payment processing', v_day,
      'Payment processing · ' || v_op.description, v_op.fee_amount, v_op.id, NULL, v_method);
  END IF;

  UPDATE online_payments SET status = 'paid', paid_at = p_paid_at, paid_on = v_day, landed_at = now(),
    land_error = CASE WHEN jsonb_array_length(v_unrecorded) > 0
      THEN left('Not recorded for ' || jsonb_array_length(v_unrecorded) || ' of ' || (v_landed + jsonb_array_length(v_unrecorded))
                || ' children', 500) END,
    stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
    stripe_charge_id = coalesce(p_charge, stripe_charge_id), card_brand = coalesce(p_brand, card_brand),
    card_last4 = coalesce(p_last4, card_last4), receipt_no = v_receipt,
    processing_cost_entry_id = coalesce(v_cost, processing_cost_entry_id), updated_at = now()
  WHERE id = v_op.id;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN jsonb_build_object('already', false, 'receiptNo', v_receipt, 'day', v_day, 'landed', v_landed,
    'unrecorded', v_unrecorded, 'sendBack', v_send_back);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_league_land(uuid, timestamptz, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_league_land(uuid, timestamptz, text, text, text, text) TO service_role;

-- ── 2 + 3. A reversal takes back what is still received, once per dispute ─────────────────────────
CREATE OR REPLACE FUNCTION public.online_payment_reverse(p_online_payment uuid, p_dispute text, p_reason text, p_detail text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op public.online_payments%ROWTYPE; v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_it public.online_payment_items%ROWTYPE; v_row public.tournament_team_payments%ROWTYPE;
  v_entry uuid; v_refusal text; v_children jsonb := '[]'::jsonb; v_refresh jsonb; v_left numeric(12,2);
BEGIN
  IF p_reason IS NOT NULL AND p_reason NOT IN ('insufficient_funds', 'account_closed', 'invalid_account', 'not_authorized') THEN
    RAISE EXCEPTION 'Invalid return reason';
  END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  IF v_op.rail <> 'bank_debit' THEN RAISE EXCEPTION 'Only a bank debit is reversed here.'; END IF;
  -- ▶ 388: once per dispute, whatever the payment reads now.
  IF v_op.status = 'reversed' OR (p_dispute IS NOT NULL AND EXISTS (SELECT 1 FROM online_payments o WHERE o.stripe_dispute_id = p_dispute)) THEN
    RETURN jsonb_build_object('already', true);
  END IF;
  IF v_op.landed_at IS NULL OR v_op.status NOT IN ('paid', 'partly_refunded', 'refunded') THEN
    RAISE EXCEPTION 'This bank debit never cleared, so there is nothing to reverse.';
  END IF;

  -- Lock order: tournament → team (or season → registrations) → payment.
  IF v_op.tournament_id IS NOT NULL THEN PERFORM 1 FROM tournaments WHERE id = v_op.tournament_id FOR UPDATE; END IF;
  IF v_op.team_id IS NOT NULL THEN PERFORM 1 FROM teams WHERE id = v_op.team_id FOR UPDATE; END IF;
  IF v_op.season_id IS NOT NULL THEN
    PERFORM 1 FROM league_seasons s WHERE s.id = v_op.season_id FOR NO KEY UPDATE;
    PERFORM 1 FROM league_registrations r
     WHERE r.id IN (SELECT i.registration_id FROM online_payment_items i WHERE i.online_payment_id = v_op.id)
     ORDER BY r.id FOR UPDATE;
  END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment FOR UPDATE;
  IF v_op.status = 'reversed' THEN RETURN jsonb_build_object('already', true); END IF;

  PERFORM set_config('flhq.online_payment_write', 'on', true);
  IF v_op.flow = 'league_signup' THEN
    FOR v_it IN SELECT * FROM online_payment_items i WHERE i.online_payment_id = v_op.id AND i.entry_id IS NOT NULL
                 AND i.registration_id IS NOT NULL ORDER BY i.created_at, i.id LOOP
      -- ▶ 388: what is still received from this child's share — its booked refunds (net of a fee given back) are the
      -- club's own lines already out of the book.
      SELECT v_it.amount - coalesce(sum(r.amount - r.fee_refunded), 0) INTO v_left
        FROM online_payment_refunds r
       WHERE r.online_payment_item_id = v_it.id AND (r.booked_at IS NOT NULL OR r.status = 'succeeded');
      IF v_left > 0 THEN
        SELECT m.entry, m.refusal INTO v_entry, v_refusal
          FROM club_league_money(v_op.org_id, v_op.season_id, v_it.registration_id, 'reverse', v_left, v_today,
                                 'online_bank', NULL, NULL) m;
        IF v_refusal IS NOT NULL THEN RAISE EXCEPTION 'The returned line was refused (%).', v_refusal; END IF;
        v_children := v_children || jsonb_build_array(jsonb_build_object('registrationId', v_it.registration_id,
          'amount', v_left, 'entryId', v_entry, 'description', v_it.description));
      END IF;
    END LOOP;
  ELSE
    SELECT * INTO v_row FROM tournament_team_payments WHERE online_payment_id = v_op.id FOR UPDATE;
    IF FOUND AND v_row.status IN ('posted', 'refunded') THEN
      -- What the team still had counted from it goes out of the paid figure; the book line is what is still received
      -- (▶ 388: the row less its part refunds; a row refunded in full adds none).
      v_left := CASE WHEN v_row.status = 'refunded' THEN 0 ELSE v_row.amount - v_row.refunded_amount END;
      UPDATE tournament_team_payments SET status = 'reversed', updated_at = now() WHERE id = v_row.id;
      IF v_left > 0 AND v_row.entry_id IS NOT NULL AND v_op.tournament_id IS NOT NULL THEN
        v_entry := online_payment_post_out(v_op.tournament_id, 'Returned by the bank', v_today,
          'Returned by the bank · ' || v_op.description, v_left, v_op.id, NULL, 'online_bank');
      END IF;
    END IF;
    IF v_op.team_id IS NOT NULL THEN v_refresh := team_payments_refresh(v_op.team_id, NULL, 'live', NULL); END IF;
  END IF;
  UPDATE online_payments SET status = 'reversed', reversed_at = now(), stripe_dispute_id = p_dispute,
    return_reason = p_reason, return_detail = left(nullif(btrim(coalesce(p_detail, '')), ''), 200), updated_at = now()
  WHERE id = v_op.id;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN coalesce(v_refresh, '{}'::jsonb) || jsonb_build_object('already', false, 'flow', v_op.flow,
    'children', v_children, 'teamId', v_op.team_id, 'entryId', v_entry);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_reverse(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_reverse(uuid, text, text, text) TO service_role;

-- ── 4. "Reversed" is sticky ────────────────────────────────────────────────────────────────────────
-- The refund functions (migs 374/375/382) set the payment's status from what has gone back; after a reversal that must not
-- move it. A trigger, so no function has to remember.
CREATE OR REPLACE FUNCTION public.online_payments_reversed_sticky()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'reversed' AND NEW.status IS DISTINCT FROM 'reversed' THEN NEW.status := 'reversed'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.online_payments_reversed_sticky() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS online_payments_reversed_sticky ON public.online_payments;
CREATE TRIGGER online_payments_reversed_sticky BEFORE UPDATE OF status ON public.online_payments
  FOR EACH ROW EXECUTE FUNCTION public.online_payments_reversed_sticky();

COMMIT;
