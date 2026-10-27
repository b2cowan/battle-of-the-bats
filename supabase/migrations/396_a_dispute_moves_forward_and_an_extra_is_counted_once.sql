-- ---------------------------------------------------------------
-- Migration 396 — Club Tier Stage 12d-1 Part 4b: the SQL deferred from Part 2's and Part 3's /review.
-- Plan: docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md §0 (12d-1 build state, "Part 4b").
--
-- WHY:
--   • A dispute's open statuses were not ordered: a slow `needs_response` read arriving after `under_review` wrote the
--     status back, and with it `held` and `due_by`, until the next event.
--   • `online_payment_over_left` measured the team's WHOLE surplus, capped only by each payment's own extra. With two
--     extras on one team, each read up to all of it, so the record and the item showed more extra than the team paid
--     (a loss then a win can now make the second extra, mig 391).
--
-- WHAT CHANGES:
--   1. online_payment_dispute_apply: an open read that is behind the stored open status changes nothing (inquiry asked
--      → inquiry answered → chargeback asked → chargeback answered). Mig 391's body otherwise, marked ▶ 396.
--   2. online_payment_over_left: the team's surplus is shared out across its extras — a kept extra first (the club's
--      answer stands), then the newest payment first — each capped by what of its own payment is still received.
--
-- NOT CHANGED, and why (Part 4b's reading of the deferred list):
--   • "A refused returned line rolls back the dispute write": club_league_money('reverse') (mig 387) refuses only a
--     non-positive amount or a missing date; online_payment_reverse passes neither, so there is no refusal to catch.
--   • "Does warning_closed escalate on the same id?": Stripe's docs (How disputes work → Inquiries): warning_closed is an
--     inquiry "open for 120 days without escalation… the card network won't escalate it". Mig 391 is right; a later
--     chargeback is a new dispute (a new row).
--   • A lost dispute on a payment that never landed is booked when the payment lands (the landing re-applies it from
--     Stripe, lib/online-payment-landing.ts) — no SQL.
-- Signatures unchanged. Re-runnable.
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. A dispute moves forward only (mig 391's, marked ▶ 396) ────────────────────────────────────
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

-- ── 2. A team's extra is counted once across its payments ─────────────────────────────────────────
-- What still stands on THIS payment: the team's surplus (paid net of refunds, less the fee) shared out across the team's
-- flagged payments — kept ones first, then newest first — each taking at most its own extra and at most what of its own
-- payment is still received (a refunded, reversed or removed payment holds none). 0 once kept, or with nothing to measure.
CREATE OR REPLACE FUNCTION public.online_payment_over_left(p_online_payment uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT o.id, o.team_id, o.over_amount, o.over_kept_at FROM online_payments o WHERE o.id = p_online_payment
  ), fee AS (
    SELECT f.total FROM me CROSS JOIN LATERAL tournament_team_fee(me.team_id) f
  ), surplus AS (
    SELECT (SELECT coalesce(sum(t.amount - t.refunded_amount), 0) FROM tournament_team_payments t
             WHERE t.team_id = me.team_id AND t.status = 'posted') - fee.total AS s
    FROM me, fee
  ), extras AS (
    SELECT o.id, o.over_kept_at, o.landed_at,
      greatest(least(o.over_amount, coalesce((SELECT t.amount - t.refunded_amount FROM tournament_team_payments t
        WHERE t.online_payment_id = o.id AND t.status = 'posted'), 0)), 0) AS cap
    FROM online_payments o, me
    WHERE o.team_id = me.team_id AND o.over_amount IS NOT NULL
  ), shared AS (
    SELECT e.id, e.cap, coalesce(sum(e.cap) OVER (ORDER BY e.over_kept_at IS NULL, e.landed_at DESC NULLS LAST, e.id DESC
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS before
    FROM extras e
  )
  SELECT CASE
    WHEN me.over_amount IS NULL OR me.over_kept_at IS NOT NULL OR me.team_id IS NULL OR fee.total IS NULL THEN 0
    ELSE coalesce((SELECT greatest(least(sh.cap, surplus.s - sh.before), 0) FROM shared sh, surplus WHERE sh.id = me.id), 0)
  END
  FROM me LEFT JOIN fee ON true
$$;
REVOKE ALL ON FUNCTION public.online_payment_over_left(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_over_left(uuid) TO service_role;

COMMIT;
