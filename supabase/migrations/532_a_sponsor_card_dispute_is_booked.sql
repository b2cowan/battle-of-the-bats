-- 532 — A sponsor's card dispute is booked (Board Ready Stage 6, Part 3b, after the walk: §564 owner call (b), ruled 2026-11-24
-- "build a notice and the books reversal first"; /accounting's answer is the 2026-11-24 addendum to CLUB_SPONSOR_INVOICE_REVIEW.md).
-- A NEW migration: 531 is applied to dev and pending on production.
--
-- What it changes:
--   1. A dispute the club LOSES on a sponsor's card payment reverses the payment's receipt lines (the sponsorship income, with the
--      passed-on fee income inside it, and the GST/HST collected), with NO credit note: the club did not refund anyone and the
--      sponsor still owes the invoice. The deal goes back to Invoiced with that amount owing again (not Withdrawn). The
--      card-fee cost line and the dispute's own fee stay as booked. Only a dispute of the WHOLE charge is booked; a part
--      dispute books nothing and the club is told to record it by hand.
--   2. A dispute WON after a loss puts it back: two lines beside the loss ("Dispute won", nothing deleted, as a team's and a
--      house league's do) and the deal Paid again when the money covers the invoice.
--   3. The one dispute writer (online_payment_dispute_apply, mig 396's) learns the sponsorship flow: it takes the deal's lock
--      first (every sponsor money writer locks the deal before the payment), then books through the two functions above.
--   4. A payment whose dispute was lost refuses a refund (the money is gone), and a refund that fails later cannot lift the
--      "no longer counts" mark that the loss set.

BEGIN;

ALTER TABLE public.club_sponsor_deal_payments ADD COLUMN IF NOT EXISTS dispute_lost_at timestamptz;
COMMENT ON COLUMN public.club_sponsor_deal_payments.dispute_lost_at IS
  'A card payment (mig 532): when the club LOST a dispute on it. Its receipt lines were reversed (no credit note), returned_at was set so it stops counting toward the invoice, and the deal went back to owing. Cleared when the dispute is later won.';

-- ── 1. A dispute lost ─────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.club_sponsor_card_dispute_lost(p_online_payment uuid, p_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op online_payments%ROWTYPE;
  d    club_sponsor_deals%ROWTYPE;
  p    club_sponsor_deal_payments%ROWTYPE;
  v_day date; v_number text; v_business text; v_ledger uuid; v_cat uuid; v_income uuid; v_taxline uuid;
  c_item constant uuid := '5b0d0528-0528-4c1b-8a50-7ea0507c0001';
BEGIN
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND OR v_op.flow <> 'sponsorship' THEN RAISE EXCEPTION 'Not a sponsorship payment'; END IF;
  SELECT * INTO d FROM club_sponsor_deals WHERE id = v_op.sponsor_deal_id FOR UPDATE;
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE online_payment_id = p_online_payment FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('already', true, 'noPayment', true); END IF;
  IF p.dispute_lost_at IS NOT NULL THEN RETURN jsonb_build_object('already', true); END IF;
  -- Only a dispute of the whole charge is booked: a part dispute (the charge was partly refunded first) is the club's to record by hand.
  IF p_amount IS NULL OR p_amount < v_op.total_amount THEN RETURN jsonb_build_object('already', true, 'partial', true); END IF;

  v_day := club_sponsor_book_day(v_op.org_id, NULL);
  SELECT coalesce(d.business_name, s.name) INTO v_business FROM club_sponsors s WHERE s.id = d.sponsor_id;
  v_number := d.invoice_year::text || '-' || lpad(d.invoice_seq::text, 3, '0');
  v_ledger := club_general_ledger(v_op.org_id);
  SELECT category_id INTO v_cat FROM budget_items WHERE id = c_item;
  IF p.amount - p.tax_part > 0 THEN
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, budget_category_id, budget_item_id, payment_method, notes)
    VALUES (v_ledger, v_day, left('Card dispute lost · ' || coalesce(v_business, 'the sponsor') || ' · invoice ' || v_number, 200), p.amount - p.tax_part,
      'expense', 'posted', 'club_sponsorship', 'sponsorship_deal', d.id, NULL, v_cat, c_item, 'online_card',
      'The sponsor''s bank took the payment back. The sponsor still owes the invoice.')
    RETURNING id INTO v_income;
  END IF;
  IF p.tax_part > 0 THEN
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, payment_method, notes)
    VALUES (v_ledger, v_day, left('Card dispute lost · ' || coalesce(v_business, 'the sponsor') || ' · invoice ' || v_number || ' · ' || coalesce(d.tax_kind, 'GST/HST'), 200),
      p.tax_part, 'expense', 'posted', 'gst_hst_collected', 'sponsorship_deal', d.id, NULL, 'online_card',
      'The sponsor''s bank took the payment back. The sponsor still owes the invoice.')
    RETURNING id INTO v_taxline;
  END IF;
  UPDATE club_sponsor_deal_payments SET dispute_lost_at = now(), returned_at = coalesce(returned_at, now()) WHERE id = p.id;
  IF d.state = 'paid' THEN
    PERFORM set_config('flhq.sponsor_deal_money', 'on', true);
    UPDATE club_sponsor_deals SET state = 'invoiced', paid_on = NULL, receipt_emailed_at = NULL, updated_at = now() WHERE id = d.id;
    PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
  END IF;
  -- The same keys the team and league loss answers with, so the dispute row's `taken_back` and the bank check read it alike:
  -- `entryId` is the income line; the tax line rides in `children` (no registration, so no screen takes it for a child).
  RETURN jsonb_build_object('already', false, 'taken', p.amount, 'entryId', v_income, 'dealId', d.id, 'wasPaid', d.state = 'paid',
    'children', CASE WHEN v_taxline IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('entryId', v_taxline, 'amount', p.tax_part)) END);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_dispute_lost(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_card_dispute_lost(uuid, numeric) TO service_role;

-- ── 2. A dispute won after the loss ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.club_sponsor_card_dispute_won(p_online_payment uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op online_payments%ROWTYPE;
  d    club_sponsor_deals%ROWTYPE;
  p    club_sponsor_deal_payments%ROWTYPE;
  v_day date; v_number text; v_business text; v_ledger uuid; v_cat uuid; v_income uuid; v_taxline uuid; v_back jsonb := '[]'::jsonb; v_paid numeric;
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
  RETURN jsonb_build_object('already', false, 'back', v_back, 'dealId', d.id);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_dispute_won(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_card_dispute_won(uuid) TO service_role;

-- ── 3. The one dispute writer, now answering a sponsorship (mig 396's, with the marked changes ▶ 532) ──────
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
      won_back = jsonb_build_object('back', v_back, 'refused', v_refused), updated_at = now()
    WHERE id = v_d.id RETURNING * INTO v_d;
    v_won_back := true;
  END IF;

  RETURN jsonb_build_object('disputeId', v_d.id, 'created', v_created, 'from', v_prev, 'status', v_d.status,
    'stale', v_stale, 'lostNow', v_lost_now, 'wonBack', v_won_back, 'refused', v_refused, 'over', v_over,
    'teamId', v_op.team_id, 'flow', v_op.flow);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_dispute_apply(uuid, text, text, text, numeric, numeric, timestamptz, boolean, numeric, text, boolean, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_dispute_apply(uuid, text, text, text, numeric, numeric, timestamptz, boolean, numeric, text, boolean, timestamptz) TO service_role;

-- ── 4. A lost dispute refuses a refund; a refund that fails later cannot lift the mark the loss set ───
CREATE OR REPLACE FUNCTION public.club_sponsor_card_refund_open(
  p_org uuid, p_payment uuid, p_amount numeric, p_reason text, p_actor uuid, p_actor_name text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p        club_sponsor_deal_payments%ROWTYPE;
  v_op     online_payments%ROWTYPE;
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
  v_refundable numeric; v_left numeric; v_tax_left numeric; v_amount numeric; v_tax numeric := 0;
  v_whole  boolean; v_ends boolean; v_id uuid;
BEGIN
  IF v_reason = '' THEN RAISE EXCEPTION USING ERRCODE = 'SP003', MESSAGE = 'club_sponsor_refund_needs_a_reason'; END IF;
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE id = p_payment AND org_id = p_org;
  IF NOT FOUND OR p.online_payment_id IS NULL OR p.voided_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_refund_not_a_card_payment';
  END IF;
  PERFORM 1 FROM club_sponsor_deals WHERE id = p.deal_id FOR UPDATE;
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE id = p_payment FOR UPDATE;
  -- ▶ 532: the sponsor's bank already took this money back.
  IF p.dispute_lost_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_refund_disputed'; END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = p.online_payment_id;
  IF v_op.stripe_payment_intent_id IS NULL OR v_op.status NOT IN ('paid', 'partly_refunded') THEN
    RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_refund_card_not_paid';
  END IF;
  SELECT l.refundable, l.money_left, l.tax_left INTO v_refundable, v_left, v_tax_left FROM club_sponsor_card_refund_left(p.id) l;
  IF v_left <= 0 THEN RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_refund_nothing_left'; END IF;
  v_amount := coalesce(p_amount, v_left);
  IF v_amount <= 0 OR v_amount <> round(v_amount, 2) OR v_amount > v_left THEN
    RAISE EXCEPTION USING ERRCODE = 'SP003', MESSAGE = 'club_sponsor_refund_amount';
  END IF;
  v_whole := v_amount = v_left;
  -- The tax share of the sponsorship part (never the fee's tax): in proportion, the refund that empties it taking the rest.
  IF v_tax_left > 0 THEN
    v_tax := CASE WHEN v_whole THEN v_tax_left ELSE round(v_amount * (p.tax_part - p.fee_tax) / v_refundable, 2) END;
    v_tax := greatest(0, least(v_tax, v_tax_left, v_amount));
  END IF;
  -- It ends the deal when it gives back the last of the deal's money: nothing left on this payment after it, and no other
  -- payment standing with money on it (a cheque never comes back by card; a card payment already given back counts for nothing).
  v_ends := v_whole AND NOT EXISTS (
    SELECT 1 FROM club_sponsor_deal_payments o
     WHERE o.deal_id = p.deal_id AND o.id <> p.id AND o.voided_at IS NULL
       AND (o.online_payment_id IS NULL OR (SELECT l.money_left FROM club_sponsor_card_refund_left(o.id) l) > 0));
  INSERT INTO club_sponsor_deal_refunds(org_id, deal_id, payment_id, online_payment_id, amount, tax_part, whole, ends_deal,
    reason, created_by, created_by_name)
  VALUES (p_org, p.deal_id, p.id, p.online_payment_id, v_amount, v_tax, v_whole, v_ends, v_reason, p_actor, left(btrim(p_actor_name), 120))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('refundId', v_id, 'amount', v_amount, 'taxPart', v_tax, 'endsDeal', v_ends, 'dealId', p.deal_id,
    'onlinePaymentId', v_op.id, 'stripeAccountId', v_op.stripe_account_id, 'paymentIntent', v_op.stripe_payment_intent_id);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_refund_open(uuid, uuid, numeric, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_card_refund_open(uuid, uuid, numeric, text, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.club_sponsor_card_refund_failed(p_refund uuid, p_stripe_refund text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r club_sponsor_deal_refunds%ROWTYPE;
  d club_sponsor_deals%ROWTYPE;
  p club_sponsor_deal_payments%ROWTYPE;
  v_was text; v_paid numeric;
BEGIN
  SELECT * INTO r FROM club_sponsor_deal_refunds WHERE id = p_refund;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_refund_not_found'; END IF;
  SELECT * INTO d FROM club_sponsor_deals WHERE id = r.deal_id FOR UPDATE;
  SELECT * INTO r FROM club_sponsor_deal_refunds WHERE id = p_refund FOR UPDATE;
  IF r.status = 'failed' THEN RETURN jsonb_build_object('already', true, 'wasBooked', r.income_entry_id IS NOT NULL OR r.tax_entry_id IS NOT NULL); END IF;
  v_was := r.status;
  UPDATE accounting_entries SET status = 'void', void_reason = 'The refund didn''t reach the card', voided_at = now(), updated_at = now()
   WHERE id IN (r.income_entry_id, r.tax_entry_id) AND status <> 'void';
  UPDATE club_sponsor_deal_refunds SET status = 'failed', failed_at = now(), succeeded_at = NULL, refunded_on = NULL,
    stripe_refund_id = coalesce(p_stripe_refund, stripe_refund_id), failure_reason = left(coalesce(nullif(btrim(p_reason), ''), 'failed'), 300)
   WHERE id = r.id;
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE id = r.payment_id FOR UPDATE;
  IF p.returned_at IS NOT NULL AND p.dispute_lost_at IS NULL AND club_sponsor_card_returned(p.id) < p.amount - p.fee_charged - p.fee_tax THEN
    UPDATE club_sponsor_deal_payments SET returned_at = NULL WHERE id = p.id;
    IF d.state = 'invoiced' THEN
      SELECT coalesce(sum(amount), 0) INTO v_paid FROM club_sponsor_deal_payments WHERE deal_id = d.id AND voided_at IS NULL AND returned_at IS NULL;
      IF d.total IS NOT NULL AND v_paid >= d.total THEN
        PERFORM set_config('flhq.sponsor_deal_money', 'on', true);
        UPDATE club_sponsor_deals SET state = 'paid', updated_at = now(),
          paid_on = (SELECT max(received_on) FROM club_sponsor_deal_payments WHERE deal_id = d.id AND voided_at IS NULL AND returned_at IS NULL)
         WHERE id = d.id;
        PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
      END IF;
    END IF;
  END IF;
  PERFORM club_sponsor_card_op_state(r.payment_id);
  RETURN jsonb_build_object('already', false, 'wasBooked', v_was = 'succeeded', 'dealId', r.deal_id,
    'dealEnded', v_was = 'succeeded' AND r.ends_deal AND d.state = 'withdrawn');
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_refund_failed(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_card_refund_failed(uuid, text, text) TO service_role;

COMMIT;
