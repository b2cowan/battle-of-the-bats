-- ---------------------------------------------------------------
-- Migration 387 — Club Tier Stage 12c Part 6: a bank debit at the desk.
-- Plan: docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md §0j, §0k; words
-- docs/projects/active/CLUB_TIER_STAGE12C_PARTREFUND_BANKDEBIT_COPY.md §3.
--
-- WHY: a bank debit takes days. The desk may end a registration (or decline a team) while one clears, and must say then
-- what happens to the money WHEN it clears (send it back, or keep it with a reason) — nothing is in the book yet, so the
-- answer is stored and carried out by the landing. A debit can also be reversed by the bank AFTER it cleared (a dispute,
-- auto-lost): a returned line goes beside the receipt, never deleting it. And each returned or reversed debit costs the
-- platform Stripe's failure fee, which the owner ruled is the club's: recorded here, billed on the club's next invoice.
--
-- WHAT CHANGES:
--   1. online_payment_clear_decisions (NEW): what happens to a clearing debit's money when it clears — per child (an item)
--      or per team payment. Written by the ending (service role), carried out by the landing; outcome stamped once.
--   2. club_league_money: two actions under the online write flag only —
--        'receive_decided' a debit that clears for a child whose registration ended while it cleared, with a decision
--                          stored (the ordinary 'receive' refuses an ended registration);
--        'reverse'         the bank reversed a cleared debit: a returned line (category 'registration_returned', an
--                          expense), outside Refunds, the receipt untouched.
--   3. online_payment_league_land: a decided child lands through 'receive_decided'; a "keep" decision is answered on the
--      registration then (end_money 'kept' + the reason), as the card window answers it at the ending.
--   4. online_payment_reverse (NEW): a cleared bank debit reversed by the bank → status 'reversed' with the dispute and
--      reason; house league writes each landed child's returned line; a tournament team's payment row reads 'reversed'
--      (out of the paid figure) with a "Returned by the bank" line on the tournament's book. Idempotent, bank rail only.
--   5. tournament_team_payments.status gains 'reversed'.
--   6. platform_debit_fees (NEW): one row per returned or reversed debit — the fee FieldLogicHQ recovers from the club on
--      its next invoice, or the reason it is not billed (a comped or free club). Service role only.
--   7. Two Needs attention kinds: debit_returned, debit_reversed (the partial indexes list every kind; the one-open index
--      keys them on onlinePaymentId).
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. What happens to a clearing debit when it clears ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.online_payment_clear_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  online_payment_id uuid NOT NULL REFERENCES public.online_payments(id) ON DELETE CASCADE,
  online_payment_item_id uuid REFERENCES public.online_payment_items(id) ON DELETE CASCADE,
  choice text NOT NULL CHECK (choice IN ('send_back', 'keep')),
  fee_back boolean NOT NULL DEFAULT false,
  reason text CHECK (reason IS NULL OR char_length(btrim(reason)) BETWEEN 1 AND 500),
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  outcome text CHECK (outcome IS NULL OR outcome IN ('sent_back', 'kept', 'returned', 'failed')),
  outcome_at timestamptz,
  refund_id uuid REFERENCES public.online_payment_refunds(id) ON DELETE SET NULL,
  CONSTRAINT online_payment_clear_decisions_keep_reason_chk CHECK (choice <> 'keep' OR reason IS NOT NULL),
  CONSTRAINT online_payment_clear_decisions_outcome_chk CHECK ((outcome IS NULL) = (outcome_at IS NULL))
);
COMMENT ON TABLE public.online_payment_clear_decisions IS 'Club Tier 12c (mig 387): what happens to a bank debit''s money when it clears, answered when the registration (or team) ended while it was clearing. One per child (item) or per team payment (item NULL).';
CREATE UNIQUE INDEX IF NOT EXISTS online_payment_clear_decisions_key
  ON public.online_payment_clear_decisions (online_payment_id, (coalesce(online_payment_item_id, '00000000-0000-0000-0000-000000000000'::uuid)));
CREATE INDEX IF NOT EXISTS online_payment_clear_decisions_open_idx
  ON public.online_payment_clear_decisions (online_payment_id) WHERE outcome IS NULL;
ALTER TABLE public.online_payment_clear_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.online_payment_clear_decisions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.online_payment_clear_decisions TO service_role;

-- ── 2. The house-league writer learns a decided landing and a reversal ───────────────────────────────
CREATE OR REPLACE FUNCTION public.club_league_money(
  p_org uuid, p_season uuid, p_registration uuid, p_action text,
  p_amount numeric, p_day date, p_method text, p_reason text, p_actor uuid, p_entry uuid DEFAULT NULL
) RETURNS TABLE (entry uuid, refusal text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reg league_registrations%ROWTYPE; v_season league_seasons%ROWTYPE;
  v_fee numeric; v_got numeric; v_amt numeric; v_book uuid; v_id uuid; v_line accounting_entries%ROWTYPE;
  v_who text; v_reason text := nullif(btrim(coalesce(p_reason,'')), '');
  v_method text := nullif(btrim(coalesce(p_method,'')), '');
  v_price numeric := round(p_amount, 2);
  v_online boolean := coalesce(current_setting('flhq.online_payment_write', true), 'off') = 'on';
BEGIN
  IF p_action NOT IN ('receive','refund','undo','price','receive_decided','reverse') THEN RAISE EXCEPTION 'Invalid money action'; END IF; -- ▶ 387
  SELECT * INTO v_reg FROM league_registrations r
   WHERE r.id = p_registration AND r.org_id = p_org AND r.season_id = p_season FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;
  SELECT * INTO v_season FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  v_fee := coalesce(v_reg.fee_amount, v_season.registration_fee, 0);
  v_got := league_reg_received(p_registration);
  v_who := v_reg.player_first_name || ' ' || v_reg.player_last_name;
  IF v_method IS NOT NULL AND char_length(v_method) > 100 THEN RAISE EXCEPTION 'A method is at most 100 characters'; END IF;
  IF v_reason IS NOT NULL AND char_length(v_reason) > 500 THEN RAISE EXCEPTION 'A reason is at most 500 characters'; END IF;
  -- A card or bank-debit payment or refund is Stripe's answer, written only by the online-payment functions (under their
  -- write flag). A person never types "Online, card" or "Online, bank debit" (the hand pickers don't offer them).
  IF v_method IN ('online_card', 'online_bank') AND NOT v_online THEN
    RETURN QUERY SELECT NULL::uuid, 'method'::text; RETURN;
  END IF;
  -- ▶ 387: the two Stripe-only actions are never a person's.
  IF p_action IN ('receive_decided', 'reverse') AND NOT v_online THEN RAISE EXCEPTION 'Only the online-payment functions record this.'; END IF;

  IF p_action IN ('receive', 'receive_decided') THEN
    -- 'receive_decided' (▶ 387): the registration ended while a bank debit for it cleared, and the desk answered then what
    -- happens to the money when it clears; it lands into the book so that answer can be carried out (sent back or kept).
    IF p_action = 'receive' AND v_reg.status IN ('declined','withdrawn') THEN RETURN QUERY SELECT NULL::uuid, 'ended'::text; RETURN; END IF;
    IF p_action = 'receive' AND v_reg.status <> 'active' THEN RETURN QUERY SELECT NULL::uuid, 'not_accepted'::text; RETURN; END IF;
    IF v_fee - v_got <= 0 THEN RETURN QUERY SELECT NULL::uuid, 'already_received'::text; RETURN; END IF;
    v_amt := coalesce(v_price, v_fee - v_got);
    IF v_amt <= 0 THEN RETURN QUERY SELECT NULL::uuid, 'amount'::text; RETURN; END IF;
    IF v_amt > v_fee - v_got THEN RETURN QUERY SELECT NULL::uuid, 'over'::text; RETURN; END IF;
    IF p_day IS NULL THEN RETURN QUERY SELECT NULL::uuid, 'date'::text; RETURN; END IF;
    v_book := club_league_season_ledger(p_org, p_season);
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, payment_method, notes, created_at)
    VALUES (v_book, p_day, v_who || ' — registration fee', v_amt, 'income', 'posted', 'registration_fee',
      'league_registration', p_registration, p_actor, v_method, v_reason, clock_timestamp())
    RETURNING id INTO v_id;

  ELSIF p_action = 'reverse' THEN
    -- ▶ 387: the bank reversed a debit that had cleared. A returned line, out of the book beside the receipt (never by
    -- deleting it), in its own category so the Money page's Refunds (the club's own act) never shows it. Any status: an
    -- ended child's kept fee can be reversed too. The amount is what the bank took back, even past what is still received.
    v_amt := v_price;
    IF v_amt IS NULL OR v_amt <= 0 THEN RETURN QUERY SELECT NULL::uuid, 'amount'::text; RETURN; END IF;
    IF p_day IS NULL THEN RETURN QUERY SELECT NULL::uuid, 'date'::text; RETURN; END IF;
    v_book := club_league_season_ledger(p_org, p_season);
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, payment_method, notes, created_at)
    VALUES (v_book, p_day, v_who || ' — returned by the bank', v_amt, 'expense', 'posted', 'registration_returned',
      'league_registration', p_registration, p_actor, v_method, v_reason, clock_timestamp())
    RETURNING id INTO v_id;

  ELSIF p_action = 'refund' THEN
    IF v_got <= 0 THEN RETURN QUERY SELECT NULL::uuid, 'nothing_received'::text; RETURN; END IF;
    v_amt := coalesce(v_price, v_got);
    IF v_amt <= 0 OR v_amt > v_got THEN RETURN QUERY SELECT NULL::uuid, 'amount'::text; RETURN; END IF;
    IF p_day IS NULL THEN RETURN QUERY SELECT NULL::uuid, 'date'::text; RETURN; END IF;
    v_book := club_league_season_ledger(p_org, p_season);
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, payment_method, notes, created_at)
    VALUES (v_book, p_day, v_who || ' — refund', v_amt, 'expense', 'posted', 'registration_refund',
      'league_registration', p_registration, p_actor, v_method, v_reason, clock_timestamp())
    RETURNING id INTO v_id;

  ELSIF p_action = 'undo' THEN
    -- A mistake fix on a live registration only: an ended one's money was answered (refunded or kept) when it ended.
    IF v_reg.status IN ('declined','withdrawn') THEN RETURN QUERY SELECT NULL::uuid, 'ended'::text; RETURN; END IF;
    SELECT * INTO v_line FROM accounting_entries e
     WHERE e.source_module = 'league_registration' AND e.source_entity_id = p_registration
       AND e.status = 'posted' AND e.entry_type = 'income'
     ORDER BY e.created_at DESC LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN RETURN QUERY SELECT NULL::uuid, 'nothing_received'::text; RETURN; END IF;
    -- The window named the payment it shows; a different latest one means a second press or a stale window.
    IF p_entry IS NOT NULL AND p_entry IS DISTINCT FROM v_line.id THEN RETURN QUERY SELECT NULL::uuid, 'changed'::text; RETURN; END IF;
    -- An online payment really arrived; it comes off only by a refund (drawings m4).
    IF EXISTS (SELECT 1 FROM online_payment_items i WHERE i.entry_id = v_line.id) THEN
      RETURN QUERY SELECT NULL::uuid, 'card'::text; RETURN;
    END IF;
    IF v_got - v_line.amount < 0 THEN RETURN QUERY SELECT NULL::uuid, 'refunded'::text; RETURN; END IF;
    PERFORM club_fee_void(v_line.id, p_actor, coalesce(v_reason, 'Marked received by mistake'));
    v_id := v_line.id;

  ELSE -- price
    IF v_reg.status IN ('declined','withdrawn') THEN RETURN QUERY SELECT NULL::uuid, 'ended'::text; RETURN; END IF;
    IF v_price IS NULL OR v_price < 0 THEN RETURN QUERY SELECT NULL::uuid, 'amount'::text; RETURN; END IF;
    IF v_price = v_fee THEN RETURN QUERY SELECT NULL::uuid, 'same'::text; RETURN; END IF;
    IF v_reason IS NULL THEN RETURN QUERY SELECT NULL::uuid, 'reason'::text; RETURN; END IF;
    IF v_got > v_price THEN
      -- Paid more than the new price: the difference goes back to the family, its own line out.
      IF p_day IS NULL THEN RETURN QUERY SELECT NULL::uuid, 'date'::text; RETURN; END IF;
      v_book := club_league_season_ledger(p_org, p_season);
      INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
        source_module, source_entity_id, created_by, payment_method, notes, created_at)
      VALUES (v_book, p_day, v_who || ' — refund', v_got - v_price, 'expense', 'posted', 'registration_refund',
        'league_registration', p_registration, p_actor, v_method, v_reason, clock_timestamp())
      RETURNING id INTO v_id;
    END IF;
    INSERT INTO league_registration_price_changes(org_id, season_id, registration_id, kind, old_amount, new_amount,
      reason, refund_entry_id, changed_by)
    VALUES (p_org, p_season, p_registration, 'corrected', v_fee, v_price, v_reason, v_id, p_actor);
    UPDATE league_registrations r SET fee_amount = v_price, updated_at = now() WHERE r.id = p_registration;
  END IF;

  PERFORM league_reg_money_sync(p_registration);
  RETURN QUERY SELECT v_id, NULL::text;
END $$;
REVOKE ALL ON FUNCTION public.club_league_money(uuid,uuid,uuid,text,numeric,date,text,text,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_league_money(uuid,uuid,uuid,text,numeric,date,text,text,uuid,uuid) TO service_role;

-- ── 3. The house-league landing carries out a decision made while it cleared ─────────────────────────
-- Mig 382's (marked ▶ 387): a child whose registration ended while the debit cleared, with a decision stored, lands through
-- 'receive_decided'; a "keep" is answered on the registration now (end_money 'kept' + the reason) and stamped done. A "send
-- back" is the app's to send (a refund needs Stripe), after this commits; its outcome is stamped then.
CREATE OR REPLACE FUNCTION public.online_payment_league_land(
  p_online_payment uuid, p_paid_at timestamptz, p_payment_intent text, p_charge text, p_brand text, p_last4 text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op public.online_payments%ROWTYPE; v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_day date; v_closed date; v_receipt bigint; v_it public.online_payment_items%ROWTYPE;
  v_entry uuid; v_refusal text; v_cost uuid; v_landed integer := 0; v_unrecorded jsonb := '[]'::jsonb; v_method text;
  v_dec public.online_payment_clear_decisions%ROWTYPE; v_send_back jsonb := '[]'::jsonb;
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
      -- ▶ 387: the decision made while it cleared.
      IF v_dec.id IS NOT NULL AND v_dec.choice = 'keep' THEN
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

-- ── 4 + 5. A cleared bank debit reversed by the bank ───────────────────────────────────────────────
ALTER TABLE public.tournament_team_payments DROP CONSTRAINT IF EXISTS tournament_team_payments_status_chk;
ALTER TABLE public.tournament_team_payments ADD CONSTRAINT tournament_team_payments_status_chk
  CHECK (status IN ('posted', 'removed', 'refunded', 'reversed'));

-- charge.dispute.created on a bank-debit charge (§0k answer 4; card disputes are 12d). Once: the payment reads reversed
-- with the dispute and the bank's reason; each landed child's returned line (house league) or the team's payment row out
-- of the paid figure with a "Returned by the bank" line (tournament). Never deletes a receipt. A payment that never landed
-- is refused (nothing to reverse), as is a card payment.
CREATE OR REPLACE FUNCTION public.online_payment_reverse(p_online_payment uuid, p_dispute text, p_reason text, p_detail text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op public.online_payments%ROWTYPE; v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_it public.online_payment_items%ROWTYPE; v_row public.tournament_team_payments%ROWTYPE;
  v_entry uuid; v_refusal text; v_children jsonb := '[]'::jsonb; v_refresh jsonb; v_back numeric(12,2);
BEGIN
  IF p_reason IS NOT NULL AND p_reason NOT IN ('insufficient_funds', 'account_closed', 'invalid_account', 'not_authorized') THEN
    RAISE EXCEPTION 'Invalid return reason';
  END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  IF v_op.rail <> 'bank_debit' THEN RAISE EXCEPTION 'Only a bank debit is reversed here.'; END IF;
  IF v_op.status = 'reversed' THEN RETURN jsonb_build_object('already', true); END IF;
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
      SELECT m.entry, m.refusal INTO v_entry, v_refusal
        FROM club_league_money(v_op.org_id, v_op.season_id, v_it.registration_id, 'reverse', v_it.amount, v_today,
                               'online_bank', NULL, NULL) m;
      IF v_refusal IS NOT NULL THEN RAISE EXCEPTION 'The returned line was refused (%).', v_refusal; END IF;
      v_children := v_children || jsonb_build_array(jsonb_build_object('registrationId', v_it.registration_id,
        'amount', v_it.amount, 'entryId', v_entry, 'description', v_it.description));
    END LOOP;
  ELSE
    SELECT * INTO v_row FROM tournament_team_payments WHERE online_payment_id = v_op.id FOR UPDATE;
    IF FOUND AND v_row.status IN ('posted', 'refunded') THEN
      -- What the team still had counted from it goes out of the paid figure; the book line is the whole debit the bank
      -- took back (a part refund already made is the club's own line, kept).
      UPDATE tournament_team_payments SET status = 'reversed', updated_at = now() WHERE id = v_row.id;
      IF v_row.entry_id IS NOT NULL AND v_op.tournament_id IS NOT NULL THEN
        v_entry := online_payment_post_out(v_op.tournament_id, 'Returned by the bank', v_today,
          'Returned by the bank · ' || v_op.description, v_op.base_amount, v_op.id, NULL, 'online_bank');
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

-- ── 6. Stripe's failure fee, recovered from the club ───────────────────────────────────────────────
-- Stripe charges the PLATFORM a fee for each returned or reversed bank debit (fees_collector = application). The owner ruled
-- it is the club's (§0k answer 2): one row per debit, billed as a "Returned bank debit" line on the club's next FieldLogicHQ
-- invoice (a pending invoice item on its customer); a comped or free club is not billed (exempt + why). The amount is the
-- app's constant at the time, kept so a later price never rewrites what was charged.
CREATE TABLE IF NOT EXISTS public.platform_debit_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  online_payment_id uuid NOT NULL REFERENCES public.online_payments(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('returned', 'reversed')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  livemode boolean NOT NULL DEFAULT false,
  exempt_reason text CHECK (exempt_reason IS NULL OR exempt_reason IN ('comped', 'no_subscription', 'test_mode')),
  stripe_invoice_item_id text,
  billed_at timestamptz,
  bill_error text CHECK (bill_error IS NULL OR char_length(bill_error) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_debit_fees_billed_chk CHECK ((stripe_invoice_item_id IS NULL) = (billed_at IS NULL)),
  CONSTRAINT platform_debit_fees_exempt_chk CHECK (exempt_reason IS NULL OR billed_at IS NULL)
);
COMMENT ON TABLE public.platform_debit_fees IS 'Club Tier 12c (mig 387): Stripe''s fee for a returned or reversed bank debit, which the platform pays and recovers from the club on its next invoice; exempt_reason when not billed (owner ruling 2026-10-26).';
CREATE UNIQUE INDEX IF NOT EXISTS platform_debit_fees_key ON public.platform_debit_fees (online_payment_id, kind);
CREATE INDEX IF NOT EXISTS platform_debit_fees_unbilled_idx ON public.platform_debit_fees (org_id)
  WHERE billed_at IS NULL AND exempt_reason IS NULL;
ALTER TABLE public.platform_debit_fees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_debit_fees FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_debit_fees TO service_role;

-- ── 7. Two Needs attention kinds: the partial indexes list every kind (mig 338 / 370 / 384 precedent) ──
--   debit_returned — a bank debit came back while it was clearing: nothing taken; the family emailed a way to pay
--   debit_reversed — the bank reversed a debit after it cleared: out of the book, owing again
drop index if exists public.notifications_user_needs_attention_idx;
create index notifications_user_needs_attention_idx
  on public.notifications (user_id, event_type)
  where cleared_at is null
    and event_type in ('assistant_coach_approval_requested', 'card_refund_failed', 'card_refund_still_enrolled', 'card_refund_unmatched',
                         'card_refund_whose', 'club_hand_back_asked', 'club_hand_back_unasked',
                         'club_payment_handed_off', 'club_schedule_review', 'debit_returned', 'debit_reversed',
                         'house_league_withdraw_request', 'online_payment_not_recorded',
                         'payment_failed', 'payouts_need_attention', 'team_coach_payment_reminder', 'team_money_sent',
                         'team_move_requested', 'team_no_show', 'team_request_filed', 'team_request_holding_payout');

drop index if exists public.notifications_org_needs_attention_idx;
create index notifications_org_needs_attention_idx
  on public.notifications (org_id, event_type)
  where cleared_at is null
    and event_type in ('assistant_coach_approval_requested', 'card_refund_failed', 'card_refund_still_enrolled', 'card_refund_unmatched',
                         'card_refund_whose', 'club_hand_back_asked', 'club_hand_back_unasked',
                         'club_payment_handed_off', 'club_schedule_review', 'debit_returned', 'debit_reversed',
                         'house_league_withdraw_request', 'online_payment_not_recorded',
                         'payment_failed', 'payouts_need_attention', 'team_coach_payment_reminder', 'team_money_sent',
                         'team_move_requested', 'team_no_show', 'team_request_filed', 'team_request_holding_payout');

-- One open copy per person and debit (the onlinePaymentId key). No such notice exists before this migration.
DROP INDEX IF EXISTS public.notifications_one_open_online_payments_notice;
CREATE UNIQUE INDEX notifications_one_open_online_payments_notice
  ON public.notifications (org_id, user_id, event_type,
    (COALESCE(metadata->>'stripeAccountId', metadata->>'onlinePaymentItemId', metadata->>'onlinePaymentId',
              metadata->>'unassignedRefundId', metadata->>'enrolledRefundId', metadata->>'unmatchedStripeRefundId')))
  WHERE cleared_at IS NULL
    AND event_type IN ('payouts_need_attention', 'online_payment_not_recorded', 'card_refund_failed',
                       'card_refund_whose', 'card_refund_still_enrolled', 'card_refund_unmatched',
                       'debit_returned', 'debit_reversed');

COMMIT;
