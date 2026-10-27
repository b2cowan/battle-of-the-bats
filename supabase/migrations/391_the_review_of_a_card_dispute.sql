-- ---------------------------------------------------------------
-- Migration 391 — Club Tier Stage 12d-1 Part 1, the /review of migration 390.
-- Plan: docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md §0 (12d-1 build state).
--
-- WHY (four review lenses, 2026-10-27, on c938e871a):
--   • Refunding a team's overpayment never cleared it: a team part refund lowers the entry by the same amount (§0j 3), so
--     what was paid past the entry did not move, and the team's entry dropped for money it never owed.
--   • A dispute lost and then won left the payment "reversed" for good (12c's sticky rule): not refundable, its receipt's
--     label lost to a plain Payment. The words say a won dispute is plain paid.
--   • A child who paid part of the fee another way after a loss got nothing put back on the win (refused whole).
--   • A stale read could turn a won dispute back to lost, or slide the held amount and due date back.
--   • A club whose tournament book is off could deadlock a dispute against a landing or Mark paid on the same team.
--   • The cardholder's raw reason reached return_detail.
--
-- WHAT CHANGES:
--   1. online_payments_reversed_sticky: "reversed" lifts ONLY for a won dispute's put-back (flhq.dispute_won).
--   2. online_payment_team_refund_book: a part refund first returns what the team paid past its entry; only the rest
--      lowers the entry. The tournament row is held FOR NO KEY UPDATE.
--   3. online_payment_reverse: the tournament row FOR NO KEY UPDATE (a payment row's foreign key never waits on it).
--   4. online_payment_dispute_apply: stale reads change nothing; a win after a loss restores the same payment (its row
--      posted again, a "Dispute won · receipt N" line beside the lost one, each child received up to what it owes, the
--      rest extra); no raw reason; the tournament row FOR NO KEY UPDATE.
-- Signatures unchanged. Re-runnable.
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. "Reversed" lifts only for a won dispute ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.online_payments_reversed_sticky()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'reversed' AND NEW.status IS DISTINCT FROM 'reversed'
     AND coalesce(current_setting('flhq.dispute_won', true), 'off') <> 'on' THEN -- ▶ 391
    NEW.status := 'reversed';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.online_payments_reversed_sticky() FROM PUBLIC, anon, authenticated;

-- ── 2. A part refund returns the extra first (mig 382's, marked ▶ 391) ───────────────────────────
CREATE OR REPLACE FUNCTION public.online_payment_team_refund_book(p_refund uuid, p_stripe_refund text, p_succeeded boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_r public.online_payment_refunds%ROWTYPE; v_op public.online_payments%ROWTYPE; v_row public.tournament_team_payments%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'America/Toronto')::date; v_entry uuid; v_back numeric(12,2); v_refresh jsonb;
  v_adjusted boolean := false; v_fee numeric; v_paid numeric; v_lower numeric(12,2); -- ▶ 391
BEGIN
  SELECT * INTO v_r FROM online_payment_refunds WHERE id = p_refund;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = v_r.online_payment_id;
  IF v_op.flow <> 'tournament_team' OR NOT v_r.part_refund THEN RAISE EXCEPTION 'Not a team''s part refund'; END IF;

  -- Lock order: tournament → team → payment → refund.
  IF v_op.tournament_id IS NOT NULL THEN PERFORM 1 FROM tournaments WHERE id = v_op.tournament_id FOR NO KEY UPDATE; END IF; -- ▶ 391
  IF v_op.team_id IS NOT NULL THEN PERFORM 1 FROM teams WHERE id = v_op.team_id FOR UPDATE; END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = v_r.online_payment_id FOR UPDATE;
  SELECT * INTO v_r FROM online_payment_refunds WHERE id = p_refund FOR UPDATE;

  PERFORM set_config('flhq.online_payment_write', 'on', true);
  IF v_r.booked_at IS NULL THEN
    IF v_r.status NOT IN ('pending', 'succeeded') THEN RAISE EXCEPTION 'This refund did not go through.'; END IF;
    -- ▶ 391: what the team has paid past its entry before this refund. A part refund first returns that (money the team
    -- never owed, words §2.2); only the rest lowers the entry (§0j 3), so refunding an overpayment never moves what it owes.
    IF v_op.team_id IS NOT NULL THEN
      SELECT f.total INTO v_fee FROM tournament_team_fee(v_op.team_id) f;
      SELECT coalesce(sum(amount - refunded_amount), 0) INTO v_paid FROM tournament_team_payments
       WHERE team_id = v_op.team_id AND status = 'posted';
    END IF;
    v_lower := CASE WHEN v_fee IS NULL THEN v_r.amount ELSE v_r.amount - least(v_r.amount, greatest(v_paid - v_fee, 0)) END;
    SELECT * INTO v_row FROM tournament_team_payments WHERE online_payment_id = v_op.id AND status = 'posted' FOR UPDATE;
    IF FOUND THEN
      IF v_row.refunded_amount + v_r.amount > v_row.amount THEN RAISE EXCEPTION 'A refund is more than what is left of this payment.'; END IF;
      UPDATE tournament_team_payments SET refunded_amount = refunded_amount + v_r.amount,
        status = CASE WHEN refunded_amount + v_r.amount >= amount THEN 'refunded' ELSE status END, updated_at = now()
      WHERE id = v_row.id;
      IF v_row.entry_id IS NOT NULL AND v_op.tournament_id IS NOT NULL THEN
        v_entry := online_payment_post_out(v_op.tournament_id, 'Refunds', v_today,
          CASE WHEN v_op.rail = 'bank_debit' THEN 'Part refunded to bank account · ' ELSE 'Part refunded to card · ' END || v_op.description,
          v_r.amount, v_r.id, v_r.created_by, CASE WHEN v_op.rail = 'bank_debit' THEN 'online_bank' ELSE 'online_card' END);
      END IF;
      IF v_op.team_id IS NOT NULL AND v_op.tournament_id IS NOT NULL AND v_lower > 0 THEN -- ▶ 391
        INSERT INTO tournament_team_entry_adjustments(team_id, tournament_id, org_id, amount, reason, origin, refund_id, created_by)
        VALUES (v_op.team_id, v_op.tournament_id, v_op.org_id, v_lower, v_r.partial_reason, v_r.origin, v_r.id, v_r.created_by)
        ON CONFLICT (refund_id) DO NOTHING;
        v_adjusted := true;
      END IF;
    END IF;
    UPDATE online_payment_refunds SET booked_at = now(), refund_entry_id = v_entry,
      stripe_refund_id = coalesce(p_stripe_refund, stripe_refund_id), updated_at = now()
    WHERE id = v_r.id;
  END IF;
  IF p_succeeded THEN
    UPDATE online_payment_refunds SET status = 'succeeded', succeeded_at = coalesce(succeeded_at, now()), failure_reason = NULL,
      stripe_refund_id = coalesce(p_stripe_refund, stripe_refund_id), updated_at = now()
    WHERE id = v_r.id AND status <> 'succeeded';
  END IF;
  SELECT coalesce(sum(r.amount - r.fee_refunded), 0) INTO v_back FROM online_payment_refunds r
   WHERE r.online_payment_id = v_op.id AND (r.booked_at IS NOT NULL OR r.status = 'succeeded');
  UPDATE online_payments SET status = CASE WHEN v_back >= v_op.base_amount THEN 'refunded' WHEN v_back > 0 THEN 'partly_refunded' ELSE status END,
    updated_at = now()
  WHERE id = v_op.id;
  IF v_op.team_id IS NOT NULL THEN v_refresh := team_payments_refresh(v_op.team_id, v_r.created_by, 'live', NULL); END IF;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN coalesce(v_refresh, '{}'::jsonb) || jsonb_build_object('refundEntryId', v_entry, 'returned', v_back, 'adjusted', v_adjusted);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_team_refund_book(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_team_refund_book(uuid, text, boolean) TO service_role;

-- ── 3. A reversal holds the tournament row FOR NO KEY UPDATE (mig 390's, marked ▶ 391) ─────────
CREATE OR REPLACE FUNCTION public.online_payment_reverse(p_online_payment uuid, p_dispute text, p_reason text, p_detail text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op public.online_payments%ROWTYPE; v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_it public.online_payment_items%ROWTYPE; v_row public.tournament_team_payments%ROWTYPE;
  v_entry uuid; v_refusal text; v_children jsonb := '[]'::jsonb; v_refresh jsonb; v_left numeric(12,2);
  v_card boolean; v_method text; v_taken numeric(12,2) := 0;
BEGIN
  IF p_reason IS NOT NULL AND p_reason NOT IN ('insufficient_funds', 'account_closed', 'invalid_account', 'not_authorized') THEN
    RAISE EXCEPTION 'Invalid return reason';
  END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  v_card := v_op.rail = 'card'; -- ▶ 390
  IF v_card AND p_dispute IS NULL THEN RAISE EXCEPTION 'A card payment is reversed only by a lost dispute.'; END IF;
  v_method := CASE WHEN v_card THEN 'online_card' ELSE 'online_bank' END;
  -- ▶ 388: once per dispute, whatever the payment reads now.
  IF v_op.status = 'reversed' OR (p_dispute IS NOT NULL AND EXISTS (SELECT 1 FROM online_payments o WHERE o.stripe_dispute_id = p_dispute)) THEN
    RETURN jsonb_build_object('already', true);
  END IF;
  IF v_op.landed_at IS NULL OR v_op.status NOT IN ('paid', 'partly_refunded', 'refunded') THEN
    RAISE EXCEPTION 'This payment never landed, so there is nothing to reverse.';
  END IF;

  -- Lock order: tournament → team (or season → registrations) → payment.
  IF v_op.tournament_id IS NOT NULL THEN PERFORM 1 FROM tournaments WHERE id = v_op.tournament_id FOR NO KEY UPDATE; END IF; -- ▶ 391
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
      SELECT v_it.amount - coalesce(sum(r.amount - r.fee_refunded), 0) INTO v_left
        FROM online_payment_refunds r
       WHERE r.online_payment_item_id = v_it.id AND (r.booked_at IS NOT NULL OR r.status = 'succeeded');
      IF v_left > 0 THEN
        SELECT m.entry, m.refusal INTO v_entry, v_refusal
          FROM club_league_money(v_op.org_id, v_op.season_id, v_it.registration_id, 'reverse', v_left, v_today,
                                 v_method, NULL, NULL) m;
        IF v_refusal IS NOT NULL THEN RAISE EXCEPTION 'The returned line was refused (%).', v_refusal; END IF;
        v_children := v_children || jsonb_build_array(jsonb_build_object('registrationId', v_it.registration_id,
          'amount', v_left, 'entryId', v_entry, 'description', v_it.description));
        v_taken := v_taken + v_left;
      END IF;
    END LOOP;
  ELSE
    SELECT * INTO v_row FROM tournament_team_payments WHERE online_payment_id = v_op.id FOR UPDATE;
    IF FOUND AND v_row.status IN ('posted', 'refunded') THEN
      v_left := CASE WHEN v_row.status = 'refunded' THEN 0 ELSE v_row.amount - v_row.refunded_amount END;
      UPDATE tournament_team_payments SET status = 'reversed', updated_at = now() WHERE id = v_row.id;
      IF v_left > 0 AND v_row.entry_id IS NOT NULL AND v_op.tournament_id IS NOT NULL THEN
        v_entry := online_payment_post_out(v_op.tournament_id, 'Returned by the bank', v_today,
          CASE WHEN v_card THEN 'Dispute lost · receipt ' || v_op.receipt_no                       -- ▶ 390
               ELSE 'Returned by the bank · ' || v_op.description END, v_left, v_op.id, NULL, v_method);
      END IF;
      v_taken := greatest(v_left, 0);
    END IF;
    IF v_op.team_id IS NOT NULL THEN v_refresh := team_payments_refresh(v_op.team_id, NULL, 'live', NULL); END IF;
  END IF;
  UPDATE online_payments SET status = 'reversed', reversed_at = now(), stripe_dispute_id = p_dispute,
    return_reason = p_reason, return_detail = left(nullif(btrim(coalesce(p_detail, '')), ''), 200), updated_at = now()
  WHERE id = v_op.id;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN coalesce(v_refresh, '{}'::jsonb) || jsonb_build_object('already', false, 'flow', v_op.flow,
    'children', v_children, 'teamId', v_op.team_id, 'entryId', v_entry, 'taken', v_taken);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_reverse(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_reverse(uuid, text, text, text) TO service_role;

-- ── 4. Stripe's read of a dispute (mig 390's, marked ▶ 391) ──────────────────────────────────────
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
            OR (v_prev IN ('warning_closed', 'prevented') AND p_status <> v_prev);
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
    v_rev := online_payment_reverse(v_op.id, p_dispute, NULL, NULL);
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
    IF v_op.flow = 'league_signup' THEN
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
    SELECT coalesce(sum(r.amount - r.fee_refunded), 0) INTO v_refunded FROM online_payment_refunds r
     WHERE r.online_payment_id = v_op.id AND (r.booked_at IS NOT NULL OR r.status = 'succeeded');
    UPDATE online_payments SET status = CASE WHEN v_refunded >= v_op.base_amount THEN 'refunded'
      WHEN v_refunded > 0 THEN 'partly_refunded' ELSE 'paid' END, updated_at = now()
    WHERE id = v_op.id;
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

COMMIT;
