-- 534 — Two money cases the 2026-11-24 /review left open (Board Ready Stage 6, Part 3b, after the walk; owner: "write 534 for 1 and 2").
--   1. A dispute WON after the sponsor paid again another way (a cheque, a second card). The first payment is restored, so the deal
--      holds more than the invoice asks. The win now says how much is EXTRA (kept on the dispute row's won_back) so the club is
--      told to refund it, as the team flow does; and voiding a payment no longer un-pays a deal the rest still covers (it used to
--      flip to Invoiced although the restored payment covered the invoice, after which the deal could never be Paid again).
--   2. A refund opened BEFORE a dispute was lost and booked AFTER it. The refund really went out of Stripe, so its two lines are
--      booked (the books say what happened), but it no longer ends the deal or moves its state: the loss already put the deal
--      back to owing, and the sponsor still owes.
-- A NEW migration: 530 to 533 are applied to dev and pending on production.

BEGIN;

CREATE OR REPLACE FUNCTION public.club_sponsor_card_refund_book(p_refund uuid, p_stripe_refund text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r        club_sponsor_deal_refunds%ROWTYPE;
  d        club_sponsor_deals%ROWTYPE;
  p        club_sponsor_deal_payments%ROWTYPE;
  v_day    date;
  v_number text;
  v_business text;
  v_ledger uuid;
  v_cat    uuid;
  v_income uuid;
  v_taxline uuid;
  v_seq    integer;
  v_full   boolean;
  v_ends   boolean;
  c_item   constant uuid := '5b0d0528-0528-4c1b-8a50-7ea0507c0001';
BEGIN
  SELECT * INTO r FROM club_sponsor_deal_refunds WHERE id = p_refund;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_refund_not_found'; END IF;
  SELECT * INTO d FROM club_sponsor_deals WHERE id = r.deal_id FOR UPDATE;
  SELECT * INTO r FROM club_sponsor_deal_refunds WHERE id = p_refund FOR UPDATE;
  IF r.status = 'succeeded' THEN RETURN jsonb_build_object('already', true, 'dealId', r.deal_id, 'endsDeal', r.ends_deal); END IF;
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE id = r.payment_id FOR UPDATE;

  v_day := club_sponsor_book_day(r.org_id, NULL);
  SELECT coalesce(d.business_name, s.name) INTO v_business FROM club_sponsors s WHERE s.id = d.sponsor_id;
  v_number := d.invoice_year::text || '-' || lpad(d.invoice_seq::text, 3, '0');
  v_ledger := club_general_ledger(r.org_id);
  SELECT category_id INTO v_cat FROM budget_items WHERE id = c_item;
  -- Every refund on a taxed invoice carries a credit note, even one whose tax rounds to $0.00 (/accounting 2026-11-23).
  IF coalesce(d.tax_amount, 0) > 0 THEN
    v_seq := coalesce((SELECT max(x.credit_seq) FROM club_sponsor_deal_refunds x WHERE x.deal_id = d.id), 0) + 1;
  END IF;
  IF r.amount - r.tax_part > 0 THEN
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, budget_category_id, budget_item_id, payment_method, notes)
    VALUES (v_ledger, v_day, left('Refund to ' || coalesce(v_business, 'the sponsor') || ' · invoice ' || v_number, 200), r.amount - r.tax_part,
      'expense', 'posted', 'club_sponsorship', 'sponsorship_deal', d.id, r.created_by, v_cat, c_item, 'online_card', left(r.reason, 500))
    RETURNING id INTO v_income;
  END IF;
  IF r.tax_part > 0 THEN
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, payment_method, notes)
    VALUES (v_ledger, v_day, left('Refund to ' || coalesce(v_business, 'the sponsor') || ' · invoice ' || v_number || ' · credit note ' || v_number || '-C' || v_seq, 200), r.tax_part,
      'expense', 'posted', 'gst_hst_collected', 'sponsorship_deal', d.id, r.created_by, 'online_card', left(r.reason, 500))
    RETURNING id INTO v_taxline;
  END IF;
  UPDATE club_sponsor_deal_refunds SET status = 'succeeded', succeeded_at = now(), refunded_on = v_day, failed_at = NULL,
    failure_reason = NULL, stripe_refund_id = coalesce(p_stripe_refund, stripe_refund_id), credit_seq = v_seq,
    income_entry_id = v_income, tax_entry_id = v_taxline
   WHERE id = r.id;

  -- Is every refundable dollar of this payment back on the card now? (Refunds that SUCCEEDED, this one included.)
  v_full := club_sponsor_card_returned(p.id) >= p.amount - p.fee_charged - p.fee_tax;
  IF v_full THEN UPDATE club_sponsor_deal_payments SET returned_at = coalesce(returned_at, now()) WHERE id = p.id; END IF;
  PERFORM club_sponsor_card_op_state(r.payment_id);
  -- The deal ends only when that was the last of its money: nothing else standing (a cheque never comes back by card).
  v_ends := v_full AND p.dispute_lost_at IS NULL AND NOT EXISTS (
    SELECT 1 FROM club_sponsor_deal_payments o WHERE o.deal_id = d.id AND o.id <> p.id AND o.voided_at IS NULL AND o.returned_at IS NULL);
  IF v_ends IS DISTINCT FROM r.ends_deal THEN UPDATE club_sponsor_deal_refunds SET ends_deal = v_ends WHERE id = r.id; END IF;
  IF v_ends AND d.state <> 'withdrawn' THEN
    PERFORM set_config('flhq.sponsor_deal_money', 'on', true);
    UPDATE club_sponsor_deals SET state = 'withdrawn', paid_on = NULL, withdrawn_at = now(), withdrawn_by = r.created_by,
      withdrawn_by_name = r.created_by_name, withdrawn_reason = r.reason, updated_at = now()
     WHERE id = d.id;
    PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
  ELSIF v_full AND p.dispute_lost_at IS NULL AND d.state = 'paid' THEN
    -- Call (g): this payment came back in full, another stands: the invoice is owing again (as when a payment is voided).
    PERFORM set_config('flhq.sponsor_deal_money', 'on', true);
    UPDATE club_sponsor_deals SET state = 'invoiced', paid_on = NULL, receipt_emailed_at = NULL, updated_at = now() WHERE id = d.id;
    PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
  END IF;
  RETURN jsonb_build_object('already', false, 'dealId', d.id, 'endsDeal', v_ends, 'creditSeq', v_seq,
    'owingAgain', v_full AND NOT v_ends AND d.state = 'paid');
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_refund_book(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_card_refund_book(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.club_sponsor_card_dispute_won(p_online_payment uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op online_payments%ROWTYPE;
  d    club_sponsor_deals%ROWTYPE;
  p    club_sponsor_deal_payments%ROWTYPE;
  v_day date; v_number text; v_business text; v_ledger uuid; v_cat uuid; v_income uuid; v_taxline uuid; v_back jsonb := '[]'::jsonb; v_paid numeric; v_refunded numeric; v_extra numeric := 0;
  c_item constant uuid := '5b0d0528-0528-4c1b-8a50-7ea0507c0001';
BEGIN
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND OR v_op.flow <> 'sponsorship' THEN RAISE EXCEPTION 'Not a sponsorship payment'; END IF;
  SELECT * INTO d FROM club_sponsor_deals WHERE id = v_op.sponsor_deal_id FOR UPDATE;
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE online_payment_id = p_online_payment FOR UPDATE;
  IF NOT FOUND OR p.dispute_lost_at IS NULL THEN RETURN jsonb_build_object('already', true, 'back', v_back); END IF;

  v_day := club_sponsor_book_day(v_op.org_id, NULL);
  SELECT coalesce(d.business_name, s.name) INTO v_business FROM club_sponsors s WHERE s.id = d.sponsor_id;
  v_number := d.invoice_year::text || '-' || lpad(d.invoice_seq::text, 3, '0');
  v_ledger := club_general_ledger(v_op.org_id);
  SELECT category_id INTO v_cat FROM budget_items WHERE id = c_item;
  IF p.amount - p.tax_part > 0 THEN
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, budget_category_id, budget_item_id, payment_method, notes)
    VALUES (v_ledger, v_day, left('Dispute won · ' || coalesce(v_business, 'the sponsor') || ' · invoice ' || v_number, 200), p.amount - p.tax_part,
      'income', 'posted', 'club_sponsorship', 'sponsorship_deal', d.id, NULL, v_cat, c_item, 'online_card',
      'The club won the dispute. The payment stands again.')
    RETURNING id INTO v_income;
    v_back := v_back || jsonb_build_array(jsonb_build_object('entryId', v_income, 'amount', p.amount - p.tax_part));
  END IF;
  IF p.tax_part > 0 THEN
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, payment_method, notes)
    VALUES (v_ledger, v_day, left('Dispute won · ' || coalesce(v_business, 'the sponsor') || ' · invoice ' || v_number || ' · ' || coalesce(d.tax_kind, 'GST/HST'), 200),
      p.tax_part, 'income', 'posted', 'gst_hst_collected', 'sponsorship_deal', d.id, NULL, 'online_card',
      'The club won the dispute. The payment stands again.')
    RETURNING id INTO v_taxline;
    v_back := v_back || jsonb_build_array(jsonb_build_object('entryId', v_taxline, 'amount', p.tax_part));
  END IF;
  UPDATE club_sponsor_deal_payments SET dispute_lost_at = NULL,
    returned_at = CASE WHEN club_sponsor_card_returned(p.id) >= p.amount - p.fee_charged - p.fee_tax THEN returned_at ELSE NULL END
   WHERE id = p.id;
  IF d.state = 'invoiced' AND d.total IS NOT NULL THEN
    SELECT coalesce(sum(amount), 0) INTO v_paid FROM club_sponsor_deal_payments WHERE deal_id = d.id AND voided_at IS NULL AND returned_at IS NULL;
    IF v_paid >= d.total THEN
      PERFORM set_config('flhq.sponsor_deal_money', 'on', true);
      UPDATE club_sponsor_deals SET state = 'paid', updated_at = now(),
        paid_on = (SELECT max(received_on) FROM club_sponsor_deal_payments WHERE deal_id = d.id AND voided_at IS NULL AND returned_at IS NULL)
       WHERE id = d.id;
      PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
    END IF;
  END IF;
  -- What now stands against the invoice beyond what it asks: the sponsor paid again while the money was gone (a cheque, a second
  -- card), then the bank gave the first back. On a deal the club withdrew meanwhile, all of it stands against nothing.
  SELECT coalesce(sum(amount), 0) INTO v_paid FROM club_sponsor_deal_payments WHERE deal_id = d.id AND voided_at IS NULL AND returned_at IS NULL;
  SELECT coalesce(sum(r.amount), 0) INTO v_refunded FROM club_sponsor_deal_refunds r WHERE r.deal_id = d.id AND r.status = 'succeeded';
  SELECT state INTO d.state FROM club_sponsor_deals WHERE id = d.id;
  v_extra := greatest(0, v_paid - v_refunded - CASE WHEN d.state = 'withdrawn' THEN 0 ELSE coalesce(d.total, 0) END);
  RETURN jsonb_build_object('already', false, 'back', v_back, 'dealId', d.id, 'extra', v_extra);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_dispute_won(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_card_dispute_won(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.online_payment_dispute_apply(
  p_online_payment uuid, p_dispute text, p_status text, p_reason text, p_amount numeric, p_held numeric,
  p_due_by timestamptz, p_answered boolean, p_stripe_fee numeric, p_fee_paid_from text, p_livemode boolean,
  p_opened_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op public.online_payments%ROWTYPE; v_d public.online_payment_disputes%ROWTYPE; v_prev text; v_created boolean := false;
  v_rev jsonb; v_lost_now boolean := false; v_won_back boolean := false; v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_child jsonb; v_entry uuid; v_refusal text; v_back jsonb := '[]'::jsonb; v_refused jsonb := '[]'::jsonb;
  v_row public.tournament_team_payments%ROWTYPE; v_amt numeric(12,2); v_put numeric(12,2); v_closed timestamptz;
  v_stale boolean := false; v_fee numeric; v_paid numeric; v_over numeric(12,2) := 0; v_owed numeric; v_refunded numeric(12,2);
  v_reg public.league_registrations%ROWTYPE; v_lost_entry uuid;
BEGIN
  IF p_status NOT IN ('warning_needs_response', 'warning_under_review', 'warning_closed', 'needs_response', 'under_review',
                      'won', 'lost', 'prevented') THEN RAISE EXCEPTION 'Unknown dispute status'; END IF;
  IF p_fee_paid_from IS NOT NULL AND p_fee_paid_from NOT IN ('club', 'platform') THEN RAISE EXCEPTION 'Unknown fee payer'; END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  IF p_livemode IS DISTINCT FROM v_op.livemode THEN RAISE EXCEPTION 'The dispute and the payment are in different modes.'; END IF;

  -- Lock order, as every money writer takes it: tournament (its book) → team (or season → registrations by id) → the
  -- payment → the dispute last. ▶ 391: the tournament row is held FOR NO KEY UPDATE, which a payment row's foreign key
  -- (FOR KEY SHARE) never waits on, so a landing or Mark paid holding the team on a club whose book is off cannot deadlock
  -- with this; the book's own word (club_tournament_fee_word, FOR UPDATE) still comes first when the book is on.
  IF v_op.tournament_id IS NOT NULL THEN
    IF tournament_fee_book_on(v_op.tournament_id) THEN PERFORM 1 FROM club_tournament_fee_word(v_op.tournament_id); END IF;
    PERFORM 1 FROM tournaments WHERE id = v_op.tournament_id FOR NO KEY UPDATE;
  END IF;
  IF v_op.team_id IS NOT NULL THEN PERFORM 1 FROM teams WHERE id = v_op.team_id FOR UPDATE; END IF;
  IF v_op.season_id IS NOT NULL THEN
    PERFORM 1 FROM league_seasons s WHERE s.id = v_op.season_id FOR NO KEY UPDATE;
    PERFORM 1 FROM league_registrations r
     WHERE r.id IN (SELECT i.registration_id FROM online_payment_items i WHERE i.online_payment_id = v_op.id)
     ORDER BY r.id FOR UPDATE;
  END IF;
  -- ▶ 532: a sponsorship's deal comes before its payment (every sponsor money writer takes them in that order).
  IF v_op.sponsor_deal_id IS NOT NULL THEN PERFORM 1 FROM club_sponsor_deals WHERE id = v_op.sponsor_deal_id FOR UPDATE; END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment FOR UPDATE;

  v_closed := CASE WHEN p_status IN ('won', 'lost', 'warning_closed', 'prevented') THEN now() END;
  INSERT INTO online_payment_disputes(org_id, online_payment_id, stripe_dispute_id, status, reason, amount, held, due_by,
    answered, answered_at, stripe_fee, fee_paid_from, livemode, opened_at, closed_at)
  VALUES (v_op.org_id, v_op.id, p_dispute, p_status, left(p_reason, 60), p_amount, greatest(coalesce(p_held, 0), 0),
    p_due_by, coalesce(p_answered, false), CASE WHEN p_answered THEN now() END, p_stripe_fee, p_fee_paid_from,
    coalesce(p_livemode, false), coalesce(p_opened_at, now()), v_closed)
  ON CONFLICT (stripe_dispute_id) DO NOTHING
  RETURNING * INTO v_d;
  v_created := FOUND;
  IF NOT v_created THEN
    SELECT * INTO v_d FROM online_payment_disputes WHERE stripe_dispute_id = p_dispute FOR UPDATE;
    IF v_d.online_payment_id <> v_op.id THEN RAISE EXCEPTION 'This dispute belongs to another payment.'; END IF;
    v_prev := v_d.status;
    -- ▶ 391: a stale read changes nothing (review). Won is final; a lost dispute moves only to won (Stripe's late win); a
    -- closed inquiry or a prevented dispute stays closed; any decided one ignores an open read. A stale read touches only
    -- `read_at`, so the held amount, the due date and the reason never slide back either.
    v_stale := (v_prev = 'won' AND p_status <> 'won')
            OR (v_prev = 'lost' AND p_status NOT IN ('lost', 'won'))
            OR (v_prev IN ('warning_closed', 'prevented') AND p_status <> v_prev)
            -- ▶ 396: an open read behind the stored open status (a slow `needs_response` after `under_review`). Stripe moves
            -- an open dispute forward only: inquiry asked → answered → escalated to a chargeback → answered.
            OR coalesce(array_position(ARRAY['warning_needs_response', 'warning_under_review', 'needs_response', 'under_review'], p_status)
                < array_position(ARRAY['warning_needs_response', 'warning_under_review', 'needs_response', 'under_review'], v_prev), false);
    IF v_stale THEN
      UPDATE online_payment_disputes SET read_at = now() WHERE id = v_d.id RETURNING * INTO v_d;
    ELSE
      UPDATE online_payment_disputes SET status = p_status, reason = coalesce(left(p_reason, 60), reason), amount = p_amount,
        held = greatest(coalesce(p_held, held), 0), due_by = coalesce(p_due_by, due_by),
        answered = answered OR coalesce(p_answered, false),
        answered_at = CASE WHEN answered_at IS NULL AND coalesce(p_answered, false) THEN now() ELSE answered_at END,
        stripe_fee = coalesce(p_stripe_fee, stripe_fee), fee_paid_from = coalesce(p_fee_paid_from, fee_paid_from),
        closed_at = CASE WHEN v_closed IS NULL THEN NULL ELSE coalesce(closed_at, v_closed) END,
        read_at = now(), updated_at = now()
      WHERE id = v_d.id RETURNING * INTO v_d;
    END IF;
  END IF;

  -- A card dispute lost: the money is out of the book, once. (A bank debit's loss is 12c's, at `created`.) A payment that
  -- never landed in a record has no line to take back; the caller holds an unlanded one for Stripe to redeliver. Known,
  -- not built (reviews 2026-10-27, as 12c's /review ruled for a reversed debit): the line is what is STILL received from
  -- the payment — a payment refunded first, a family-paid processing fee and a dispute for part of a payment are not
  -- booked past it; the dispute row keeps Stripe's own amount.
  IF v_op.rail = 'card' AND v_d.status = 'lost' AND v_d.lost_booked_at IS NULL AND v_op.landed_at IS NOT NULL THEN
    -- ▶ 391: the cardholder's raw reason never reaches return_detail (a screen may print it; "fraud" never is).
    -- ▶ 532: a sponsorship's loss is its own books (no credit note; the deal owes again).
    v_rev := CASE WHEN v_op.flow = 'sponsorship' THEN club_sponsor_card_dispute_lost(v_op.id, p_amount)
      ELSE online_payment_reverse(v_op.id, p_dispute, NULL, NULL) END;
    IF NOT coalesce((v_rev ->> 'already')::boolean, false) THEN
      UPDATE online_payment_disputes SET lost_booked_at = now(),
        taken_back = jsonb_build_object('amount', v_rev -> 'taken', 'entryId', v_rev -> 'entryId', 'children', v_rev -> 'children'),
        updated_at = now()
      WHERE id = v_d.id RETURNING * INTO v_d;
      v_lost_now := true;
    END IF;
  END IF;

  -- ▶ 391: won after it was lost goes back to plain paid (words §1.2): the SAME payment is restored — the team's row
  -- posted again, each child received again — and the book gets a "Dispute won" line beside the "Dispute lost" one
  -- (nothing deleted). What the team or child paid again another way meanwhile is extra, flagged for the refund door.
  IF v_op.rail = 'card' AND v_d.status = 'won' AND v_d.lost_booked_at IS NOT NULL AND v_d.won_back_at IS NULL THEN
    PERFORM set_config('flhq.online_payment_write', 'on', true);
    PERFORM set_config('flhq.dispute_won', 'on', true);
    v_lost_entry := nullif(v_d.taken_back ->> 'entryId', '')::uuid;
    IF v_op.flow = 'sponsorship' THEN
      -- ▶ 532: two lines beside the loss, the deal Paid again when the money covers the invoice.
      v_rev := club_sponsor_card_dispute_won(v_op.id);
      v_back := coalesce(v_rev -> 'back', '[]'::jsonb);
    ELSIF v_op.flow = 'league_signup' THEN
      FOR v_child IN SELECT * FROM jsonb_array_elements(coalesce(v_d.taken_back -> 'children', '[]'::jsonb)) LOOP
        v_amt := (v_child ->> 'amount')::numeric;
        SELECT * INTO v_reg FROM league_registrations WHERE id = (v_child ->> 'registrationId')::uuid;
        -- What the child still owes now; the put-back is at most that, and the rest is extra (paid again another way).
        v_owed := greatest(coalesce(v_reg.fee_amount, (SELECT s.registration_fee FROM league_seasons s WHERE s.id = v_reg.season_id), 0)
                           - league_reg_received(v_reg.id), 0);
        v_put := least(v_amt, v_owed);
        v_entry := NULL; v_refusal := NULL;
        IF v_put > 0 THEN
          SELECT m.entry, m.refusal INTO v_entry, v_refusal
            FROM club_league_money(v_op.org_id, v_op.season_id, v_reg.id, 'receive_decided', v_put, v_today, 'online_card', NULL, NULL) m;
          IF v_refusal IS NOT NULL THEN v_put := 0; END IF;
        END IF;
        IF v_put > 0 THEN
          v_back := v_back || jsonb_build_array(jsonb_build_object('registrationId', v_reg.id, 'amount', v_put, 'entryId', v_entry));
        END IF;
        IF v_amt - v_put > 0 THEN
          v_refused := v_refused || jsonb_build_array(jsonb_build_object('registrationId', v_reg.id, 'amount', v_amt - v_put,
            'refusal', coalesce(v_refusal, 'already_received')));
        END IF;
      END LOOP;
    ELSE
      SELECT * INTO v_row FROM tournament_team_payments WHERE online_payment_id = v_op.id FOR UPDATE;
      v_amt := coalesce((v_d.taken_back ->> 'amount')::numeric, 0);
      IF FOUND AND v_row.status = 'reversed' AND v_amt > 0 AND v_op.team_id IS NOT NULL THEN
        SELECT f.total INTO v_fee FROM tournament_team_fee(v_op.team_id) f;
        IF v_fee IS NOT NULL THEN
          SELECT coalesce(sum(amount - refunded_amount), 0) INTO v_paid FROM tournament_team_payments
           WHERE team_id = v_op.team_id AND status = 'posted';
          v_owed := greatest(v_fee - v_paid, 0);
          v_over := greatest(v_amt - v_owed, 0);
        END IF;
        UPDATE tournament_team_payments SET status = CASE WHEN refunded_amount >= amount THEN 'refunded' ELSE 'posted' END,
          updated_at = now() WHERE id = v_row.id;
        -- The won line copies the lost line's book and filing, as income: the two sit side by side.
        IF v_lost_entry IS NOT NULL THEN
          INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category, source_module,
            source_entity_id, created_by, budget_category_id, budget_item_id, payment_method)
          SELECT e.ledger_id, v_today, 'Dispute won · receipt ' || v_op.receipt_no, v_amt, 'income', 'posted', e.category,
            'online_payment', v_op.id, NULL, e.budget_category_id, e.budget_item_id, 'online_card'
          FROM accounting_entries e WHERE e.id = v_lost_entry
          RETURNING id INTO v_entry;
        END IF;
        PERFORM team_payments_refresh(v_op.team_id, NULL, 'live', NULL);
        IF v_over > 0 THEN
          -- A new extra needs its own answer: any earlier "Keep it" note was about the earlier extra.
          UPDATE online_payments SET over_amount = v_over, over_whole = v_owed = 0, over_kept_at = NULL, over_kept_reason = NULL,
            over_kept_by = NULL, updated_at = now() WHERE id = v_op.id;
        END IF;
        v_back := jsonb_build_array(jsonb_build_object('teamPaymentId', v_row.id, 'amount', v_amt, 'entryId', v_entry, 'over', v_over));
      END IF;
    END IF;
    -- The payment reads as its refunds say again (the sticky "reversed" lifts for this path only).
    IF v_op.flow <> 'sponsorship' THEN   -- ▶ 532: a sponsorship's payment state follows its own refunds, untouched here
      SELECT coalesce(sum(r.amount - r.fee_refunded), 0) INTO v_refunded FROM online_payment_refunds r
       WHERE r.online_payment_id = v_op.id AND (r.booked_at IS NOT NULL OR r.status = 'succeeded');
      UPDATE online_payments SET status = CASE WHEN v_refunded >= v_op.base_amount THEN 'refunded'
        WHEN v_refunded > 0 THEN 'partly_refunded' ELSE 'paid' END, updated_at = now()
      WHERE id = v_op.id;
    END IF;
    PERFORM set_config('flhq.dispute_won', 'off', true);
    PERFORM set_config('flhq.online_payment_write', 'off', true);
    UPDATE online_payment_disputes SET won_back_at = now(),
      won_back = jsonb_build_object('back', v_back, 'refused', v_refused,
        'extra', CASE WHEN v_op.flow = 'sponsorship' THEN coalesce((v_rev ->> 'extra')::numeric, 0) ELSE 0 END), updated_at = now()
    WHERE id = v_d.id RETURNING * INTO v_d;
    v_won_back := true;
  END IF;

  RETURN jsonb_build_object('disputeId', v_d.id, 'created', v_created, 'from', v_prev, 'status', v_d.status,
    'stale', v_stale, 'lostNow', v_lost_now, 'wonBack', v_won_back, 'refused', v_refused, 'over', v_over,
    'teamId', v_op.team_id, 'flow', v_op.flow);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_dispute_apply(uuid, text, text, text, numeric, numeric, timestamptz, boolean, numeric, text, boolean, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_dispute_apply(uuid, text, text, text, numeric, numeric, timestamptz, boolean, numeric, text, boolean, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.club_sponsor_deal_payment_void(
  p_org uuid, p_payment uuid, p_reason text, p_actor uuid, p_actor_name text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p   club_sponsor_deal_payments%ROWTYPE;
  d   club_sponsor_deals%ROWTYPE;
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
  v_left numeric;
BEGIN
  IF v_reason = '' THEN RAISE EXCEPTION USING ERRCODE = 'SP003', MESSAGE = 'club_sponsor_void_needs_a_reason'; END IF;
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE id = p_payment AND org_id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_payment_not_found'; END IF;
  IF p.online_payment_id IS NOT NULL THEN                                                 -- ▶ 530
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_card_payment_refund_only';
  END IF;
  SELECT * INTO d FROM club_sponsor_deals WHERE id = p.deal_id AND org_id = p_org FOR UPDATE;
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE id = p_payment FOR UPDATE;
  IF p.voided_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_payment_already_void'; END IF;

  PERFORM set_config('flhq.sponsor_deal_money', 'on', true);
  UPDATE accounting_entries SET status = 'void', void_reason = left(v_reason, 500), voided_by = p_actor, voided_at = now(), updated_at = now()
   WHERE id IN (p.income_entry_id, p.tax_entry_id) AND status <> 'void';
  UPDATE club_sponsor_deal_payments SET voided_at = now(), voided_by = p_actor, voided_by_name = left(btrim(p_actor_name), 120), void_reason = v_reason
   WHERE id = p_payment;
  -- Owing again only if what is LEFT no longer covers the invoice (a payment restored by a won dispute may cover it alone).
  SELECT coalesce(sum(amount), 0) INTO v_left FROM club_sponsor_deal_payments WHERE deal_id = d.id AND voided_at IS NULL AND returned_at IS NULL;
  IF d.state = 'paid' AND (d.total IS NULL OR v_left < d.total) THEN
    UPDATE club_sponsor_deals SET state = 'invoiced', paid_on = NULL, receipt_emailed_at = NULL, updated_at = now() WHERE id = d.id;
  ELSIF d.state = 'paid' THEN
    UPDATE club_sponsor_deals SET updated_at = now(),
      paid_on = (SELECT max(received_on) FROM club_sponsor_deal_payments WHERE deal_id = d.id AND voided_at IS NULL AND returned_at IS NULL)
     WHERE id = d.id;
  END IF;
  PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
  RETURN jsonb_build_object('deal_id', d.id,
    'state', CASE WHEN d.state = 'paid' AND (d.total IS NULL OR v_left < d.total) THEN 'invoiced' ELSE d.state END);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_deal_payment_void(uuid, uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_deal_payment_void(uuid, uuid, text, uuid, text) TO service_role;

COMMIT;
