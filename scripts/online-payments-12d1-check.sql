-- DEV only. Club Tier Stage 12d-1 Part 1 (mig 390): a team's online payment past what it owed books in full and is
-- flagged; a card dispute is recorded from Stripe's read (replays and out-of-order reads write once); a loss takes the
-- payment out of the book beside its receipt; a win leaves the book as it was; a win after a loss puts back what the loss
-- took (and hands back a child paid again another way); every Stripe fee is one row per kind, and never billed twice.
-- Run: node scripts/db-query.mjs --dev -f scripts/online-payments-12d1-check.sql
-- The final exception rolls back every fixture row; the run passes only when it ends in ONLINE_PAYMENTS_12D1_PASSED.
DO $op12d1$
DECLARE
  v_org uuid; v_event uuid; v_div uuid; v_whole uuid; v_part uuid; v_exact uuid; v_op uuid; v_op2 uuid; v_op3 uuid;
  v_res jsonb; v_err text; v_ok boolean; v_season uuid; v_reg uuid; v_reg2 uuid; v_lop uuid; v_d uuid; v_inv uuid;
  v_today date := (now() AT TIME ZONE 'America/Toronto')::date; v_n int; v_two uuid; v_xa uuid; v_xb uuid;
BEGIN
  INSERT INTO organizations(name, slug, plan_id)
  VALUES ('CHECK 12d1', 'check-12d1-' || substr(md5(random()::text), 1, 10), 'club') RETURNING id INTO v_org;
  INSERT INTO tournaments(org_id, year, name, slug, deposit_amount, total_fee_amount, settings)
  VALUES (v_org, 2026, '12d1 invitational', 'check-12d1-invitational', 100, 400, '{"fee_scope":"tournament"}'::jsonb)
  RETURNING id INTO v_event;
  INSERT INTO divisions(tournament_id, name) VALUES (v_event, '12U') RETURNING id INTO v_div;
  INSERT INTO teams(tournament_id, division_id, name, email, status, payment_status)
  VALUES (v_event, v_div, 'Riverside Rockets', 'r@example.invalid', 'accepted', 'pending') RETURNING id INTO v_whole;
  INSERT INTO teams(tournament_id, division_id, name, email, status, payment_status)
  VALUES (v_event, v_div, 'Oakville Owls', 'o@example.invalid', 'accepted', 'pending') RETURNING id INTO v_part;
  INSERT INTO teams(tournament_id, division_id, name, email, status, payment_status)
  VALUES (v_event, v_div, 'Milton Mets', 'm@example.invalid', 'accepted', 'pending') RETURNING id INTO v_exact;

  -- T1 · paid twice: the team paid its $400 by e-transfer, then a card payment of $400 lands. It books in full (the book
  -- says what Stripe says), and the whole of it is flagged extra.
  PERFORM tournament_team_payment_record(v_whole, 400, v_today, 'Payment', 'etransfer', NULL);
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
  VALUES (v_org, 'acct_check12d1', 'tournament_team', v_event, v_whole, 'balance', 'Riverside Rockets · balance', 400,
    15.50, 415.50, 'family', 0.035, 1.50, 'cs_check12d1_' || gen_random_uuid()) RETURNING id INTO v_op;
  v_res := online_payment_land(v_op, now(), 'pi_d1_w', 'ch_d1_w', 'visa', '4242');
  IF (SELECT total_paid FROM teams WHERE id = v_whole) <> 800
     OR (SELECT over_amount FROM online_payments WHERE id = v_op) <> 400
     OR NOT (SELECT over_whole FROM online_payments WHERE id = v_op)
     OR (v_res ->> 'over')::numeric <> 400 OR NOT (v_res ->> 'overWhole')::boolean
     OR online_payment_over_left(v_op) <> 400 THEN
    RAISE EXCEPTION 'FAIL T1: paid twice (%)', v_res; END IF;

  -- T2 · more than owed: $300 by cheque, then $300 by card on a $400 entry. Booked in full; $200 extra, not "whole".
  PERFORM tournament_team_payment_record(v_part, 300, v_today, 'Payment', 'cheque', NULL);
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
  VALUES (v_org, 'acct_check12d1', 'tournament_team', v_event, v_part, 'balance', 'Oakville Owls · balance', 300,
    12, 312, 'family', 0.035, 1.50, 'cs_check12d1_' || gen_random_uuid()) RETURNING id INTO v_op2;
  v_res := online_payment_land(v_op2, now(), 'pi_d1_p', 'ch_d1_p', 'visa', '4242');
  IF (SELECT total_paid FROM teams WHERE id = v_part) <> 600
     OR (SELECT over_amount FROM online_payments WHERE id = v_op2) <> 200
     OR (SELECT over_whole FROM online_payments WHERE id = v_op2)
     OR online_payment_over_left(v_op2) <> 200 THEN
    RAISE EXCEPTION 'FAIL T2: more than owed (%)', v_res; END IF;

  -- T3 · exactly what is owed: no flag. A replayed landing writes nothing and leaves the flag as it was.
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
  VALUES (v_org, 'acct_check12d1', 'tournament_team', v_event, v_exact, 'full', 'Milton Mets · full', 400,
    15.50, 415.50, 'family', 0.035, 1.50, 'cs_check12d1_' || gen_random_uuid()) RETURNING id INTO v_op3;
  PERFORM online_payment_land(v_op3, now(), 'pi_d1_e', 'ch_d1_e', 'visa', '4242');
  IF (SELECT over_amount FROM online_payments WHERE id = v_op3) IS NOT NULL OR online_payment_over_left(v_op3) <> 0 THEN
    RAISE EXCEPTION 'FAIL T3: an exact payment was flagged'; END IF;
  v_res := online_payment_land(v_op, now(), 'pi_d1_w', 'ch_d1_w', 'visa', '4242');
  IF NOT (v_res ->> 'already')::boolean OR (SELECT over_amount FROM online_payments WHERE id = v_op) <> 400
     OR (SELECT total_paid FROM teams WHERE id = v_whole) <> 800 THEN
    RAISE EXCEPTION 'FAIL T3: a replayed landing changed something (%)', v_res; END IF;

  -- T4 · the extra still standing is read live: raising the entry by $200 leaves nothing extra on the part case, with
  -- nothing stamped; "Keep it" needs a reason and clears the whole case.
  INSERT INTO teams(tournament_id, division_id, name, email, status, payment_status)
  VALUES (v_event, v_div, 'Fixture spare', 's@example.invalid', 'accepted', 'pending');
  UPDATE tournaments SET total_fee_amount = 600 WHERE id = v_event;
  IF online_payment_over_left(v_op2) <> 0 OR online_payment_over_left(v_op) <> 200 THEN
    RAISE EXCEPTION 'FAIL T4: the live extra after a raised entry (part %, whole %)', online_payment_over_left(v_op2), online_payment_over_left(v_op); END IF;
  UPDATE tournaments SET total_fee_amount = 400 WHERE id = v_event;
  v_ok := false;
  BEGIN UPDATE online_payments SET over_kept_at = now() WHERE id = v_op;
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T4: kept with no reason'; END IF;
  UPDATE online_payments SET over_kept_at = now(), over_kept_reason = 'The team asked us to keep it for next year' WHERE id = v_op;
  IF online_payment_over_left(v_op) <> 0 THEN RAISE EXCEPTION 'FAIL T4: a kept extra still stands'; END IF;

  -- T4b · (mig 391) refunding the extra $200 through the refund door clears it, and never lowers the team's $400 entry:
  -- a part refund returns what was paid past the entry first.
  v_d := online_payment_refund_open(v_op2, true, NULL, NULL, NULL, 'app', NULL, 200, 'Paid more than the team owed');
  PERFORM online_payment_team_refund_book(v_d, 're_d1_extra', true);
  IF online_payment_over_left(v_op2) <> 0 OR (SELECT entry_lowered FROM teams WHERE id = v_part) <> 0
     OR (SELECT total_paid FROM teams WHERE id = v_part) <> 400 OR (SELECT payment_status FROM teams WHERE id = v_part) <> 'paid' THEN
    RAISE EXCEPTION 'FAIL T4b: refunding the extra (left %, lowered %, paid %)', online_payment_over_left(v_op2),
      (SELECT entry_lowered FROM teams WHERE id = v_part), (SELECT total_paid FROM teams WHERE id = v_part); END IF;
  -- A part refund on a team that has NOT overpaid still lowers its entry (12c, §0j 3).
  v_d := online_payment_refund_open(v_op2, true, NULL, NULL, NULL, 'app', NULL, 50, 'One game cancelled');
  PERFORM online_payment_team_refund_book(v_d, 're_d1_part', true);
  IF (SELECT entry_lowered FROM teams WHERE id = v_part) <> 50 THEN
    RAISE EXCEPTION 'FAIL T4b: an ordinary part refund no longer lowers the entry (%)', (SELECT entry_lowered FROM teams WHERE id = v_part); END IF;

  -- T4c · (mig 396) two extras on one team are counted once: $400 by cheque, then $100 and $60 by card (both extra, $160).
  -- $50 of the first is refunded (the extra goes back first), so $110 is extra: the newest keeps its $60, the first $50 —
  -- never $100 + $60 as each read the team's whole surplus before.
  INSERT INTO teams(tournament_id, division_id, name, email, status, payment_status)
  VALUES (v_event, v_div, 'Halton Hawks', 'h@example.invalid', 'accepted', 'pending') RETURNING id INTO v_two;
  PERFORM tournament_team_payment_record(v_two, 400, v_today, 'Payment', 'cheque', NULL);
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
  VALUES (v_org, 'acct_check12d1', 'tournament_team', v_event, v_two, 'balance', 'Halton Hawks · balance', 100,
    5, 105, 'family', 0.035, 1.50, 'cs_check12d1_' || gen_random_uuid()) RETURNING id INTO v_xa;
  PERFORM online_payment_land(v_xa, now() - interval '1 hour', 'pi_d1_xa', 'ch_d1_xa', 'visa', '4242');
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
  VALUES (v_org, 'acct_check12d1', 'tournament_team', v_event, v_two, 'balance', 'Halton Hawks · balance', 60,
    3.60, 63.60, 'family', 0.035, 1.50, 'cs_check12d1_' || gen_random_uuid()) RETURNING id INTO v_xb;
  PERFORM online_payment_land(v_xb, now(), 'pi_d1_xb', 'ch_d1_xb', 'visa', '4242');
  IF online_payment_over_left(v_xa) <> 100 OR online_payment_over_left(v_xb) <> 60 THEN
    RAISE EXCEPTION 'FAIL T4c: two extras before a refund (% and %)', online_payment_over_left(v_xa), online_payment_over_left(v_xb); END IF;
  v_d := online_payment_refund_open(v_xa, true, NULL, NULL, NULL, 'app', NULL, 50, 'Paid more than the team owed');
  PERFORM online_payment_team_refund_book(v_d, 're_d1_xa', true);
  IF online_payment_over_left(v_xa) <> 50 OR online_payment_over_left(v_xb) <> 60 THEN
    RAISE EXCEPTION 'FAIL T4c: two extras after a part refund (% and %, want 50 and 60)', online_payment_over_left(v_xa), online_payment_over_left(v_xb); END IF;

  -- T5 · a card dispute opens (needs_response): recorded once; the book is untouched (ask 3: the line stays while open).
  v_res := online_payment_dispute_apply(v_op3, 'du_d1_one', 'needs_response', 'fraudulent', 415.50, 415.50,
    now() + interval '14 days', false, 15, 'club', false, now());
  v_d := (v_res ->> 'disputeId')::uuid;
  IF NOT (v_res ->> 'created')::boolean OR (v_res ->> 'lostNow')::boolean
     OR (SELECT total_paid FROM teams WHERE id = v_exact) <> 400
     OR (SELECT status FROM online_payments WHERE id = v_op3) <> 'paid' THEN
    RAISE EXCEPTION 'FAIL T5: a dispute opened (%)', v_res; END IF;

  -- T6 · a replay writes the same row; a later read (answered) updates it in place.
  v_res := online_payment_dispute_apply(v_op3, 'du_d1_one', 'needs_response', 'fraudulent', 415.50, 415.50,
    now() + interval '14 days', false, 15, 'club', false, now());
  IF (v_res ->> 'created')::boolean OR (SELECT count(*) FROM online_payment_disputes WHERE online_payment_id = v_op3) <> 1 THEN
    RAISE EXCEPTION 'FAIL T6: a replay wrote twice (%)', v_res; END IF;
  PERFORM online_payment_dispute_apply(v_op3, 'du_d1_one', 'under_review', 'fraudulent', 415.50, 415.50, NULL, true, 15, 'club', false, now());
  IF NOT (SELECT answered FROM online_payment_disputes WHERE id = v_d) OR (SELECT answered_at FROM online_payment_disputes WHERE id = v_d) IS NULL
     OR (SELECT due_by FROM online_payment_disputes WHERE id = v_d) IS NULL THEN
    RAISE EXCEPTION 'FAIL T6: the answered read'; END IF;
  -- T6b · (mig 396) a slow needs_response read after under_review changes nothing: the status, the answer and the due date stay.
  v_res := online_payment_dispute_apply(v_op3, 'du_d1_one', 'needs_response', 'fraudulent', 415.50, 415.50,
    now() + interval '3 days', false, 15, 'club', false, now());
  IF NOT (v_res ->> 'stale')::boolean OR (SELECT status FROM online_payment_disputes WHERE id = v_d) <> 'under_review'
     OR (SELECT due_by FROM online_payment_disputes WHERE id = v_d) < now() + interval '13 days' THEN
    RAISE EXCEPTION 'FAIL T6b: an open read went backwards (%)', v_res; END IF;

  -- T7 · won: plain paid, the book as it was, nothing to put back.
  v_res := online_payment_dispute_apply(v_op3, 'du_d1_one', 'won', 'fraudulent', 415.50, 0, NULL, true, 15, 'club', false, now());
  IF (v_res ->> 'lostNow')::boolean OR (v_res ->> 'wonBack')::boolean
     OR (SELECT total_paid FROM teams WHERE id = v_exact) <> 400 OR (SELECT status FROM online_payments WHERE id = v_op3) <> 'paid'
     OR (SELECT closed_at FROM online_payment_disputes WHERE id = v_d) IS NULL
     OR EXISTS (SELECT 1 FROM accounting_entries WHERE source_entity_id = v_op3 AND description LIKE 'Dispute lost%') THEN
    RAISE EXCEPTION 'FAIL T7: a won dispute moved the book (%)', v_res; END IF;

  -- T8 · a second dispute on the same payment (Stripe: possible, rare) is its own row; a loss arriving BEFORE any earlier
  -- read (out of order) books once: the team's row reads reversed, a "Dispute lost · receipt N" line beside the receipt
  -- (never deleting it), the team owes again.
  v_res := online_payment_dispute_apply(v_op3, 'du_d1_two', 'lost', 'duplicate', 415.50, 415.50, NULL, false, 15, 'club', false, now() - interval '20 days');
  IF NOT (v_res ->> 'created')::boolean OR NOT (v_res ->> 'lostNow')::boolean
     OR (SELECT count(*) FROM online_payment_disputes WHERE online_payment_id = v_op3) <> 2
     OR (SELECT status FROM online_payments WHERE id = v_op3) <> 'reversed'
     OR (SELECT status FROM tournament_team_payments WHERE online_payment_id = v_op3) <> 'reversed'
     OR (SELECT total_paid FROM teams WHERE id = v_exact) <> 0
     OR (SELECT count(*) FROM accounting_entries e JOIN tournament_team_payments p ON p.entry_id = e.id
          WHERE p.online_payment_id = v_op3 AND e.status = 'posted') <> 1
     OR (SELECT amount FROM accounting_entries WHERE source_entity_id = v_op3
          AND description = 'Dispute lost · receipt ' || (SELECT receipt_no FROM online_payments WHERE id = v_op3)
          AND payment_method = 'online_card') <> 400 THEN
    RAISE EXCEPTION 'FAIL T8: a lost dispute (%)', v_res; END IF;
  -- Its earlier read arriving late changes nothing booked.
  v_res := online_payment_dispute_apply(v_op3, 'du_d1_two', 'lost', 'duplicate', 415.50, 415.50, NULL, false, 15, 'club', false, now());
  IF (v_res ->> 'lostNow')::boolean OR (SELECT count(*) FROM accounting_entries WHERE source_entity_id = v_op3 AND description LIKE 'Dispute lost%') <> 1 THEN
    RAISE EXCEPTION 'FAIL T8: a replayed loss booked twice (%)', v_res; END IF;

  -- T9 · (mig 391) the lost dispute turns to won (Stripe: a late win): the SAME payment is plain paid again — its row
  -- posted, the payment 'paid', a "Dispute won" line beside the "Dispute lost" one (nothing deleted to undo money).
  v_res := online_payment_dispute_apply(v_op3, 'du_d1_two', 'won', 'duplicate', 415.50, 0, NULL, true, 15, 'club', false, now());
  IF NOT (v_res ->> 'wonBack')::boolean OR (SELECT total_paid FROM teams WHERE id = v_exact) <> 400
     OR (SELECT status FROM tournament_team_payments WHERE online_payment_id = v_op3) <> 'posted'
     OR (SELECT count(*) FROM tournament_team_payments WHERE team_id = v_exact AND status = 'posted') <> 1
     OR (SELECT status FROM online_payments WHERE id = v_op3) <> 'paid'
     OR (SELECT over_amount FROM online_payments WHERE id = v_op3) IS NOT NULL
     OR (SELECT count(*) FROM accounting_entries WHERE source_entity_id = v_op3 AND description LIKE 'Dispute lost%') <> 1
     OR (SELECT amount FROM accounting_entries WHERE source_entity_id = v_op3 AND entry_type = 'income'
          AND description = 'Dispute won · receipt ' || (SELECT receipt_no FROM online_payments WHERE id = v_op3)) <> 400 THEN
    RAISE EXCEPTION 'FAIL T9: a win after a loss (%)', v_res; END IF;
  v_res := online_payment_dispute_apply(v_op3, 'du_d1_two', 'won', 'duplicate', 415.50, 0, NULL, true, 15, 'club', false, now());
  IF (v_res ->> 'wonBack')::boolean OR (SELECT total_paid FROM teams WHERE id = v_exact) <> 400 THEN
    RAISE EXCEPTION 'FAIL T9: put back twice (%)', v_res; END IF;
  -- A stale "lost" arriving after the win changes nothing: won is final.
  v_res := online_payment_dispute_apply(v_op3, 'du_d1_two', 'lost', 'duplicate', 415.50, 415.50, NULL, false, 15, 'club', false, now());
  IF NOT (v_res ->> 'stale')::boolean OR (SELECT status FROM online_payment_disputes WHERE stripe_dispute_id = 'du_d1_two') <> 'won'
     OR (SELECT held FROM online_payment_disputes WHERE stripe_dispute_id = 'du_d1_two') <> 0
     OR (SELECT status FROM online_payments WHERE id = v_op3) <> 'paid' THEN
    RAISE EXCEPTION 'FAIL T9: a stale loss after a win (%)', v_res; END IF;

  -- T10 · a card payment is never reversed without its dispute.
  v_err := NULL;
  BEGIN PERFORM online_payment_reverse(v_op2, NULL, NULL, NULL);
  EXCEPTION WHEN others THEN v_err := SQLERRM; END;
  IF v_err IS DISTINCT FROM 'A card payment is reversed only by a lost dispute.' THEN RAISE EXCEPTION 'FAIL T10: (%)', v_err; END IF;

  -- ── House league: a lost card dispute on siblings, then a late win with one child paid again another way ──
  INSERT INTO league_seasons(org_id, name, slug, registration_fee) VALUES (v_org, 'Check 12d1', 'check-12d1', 150) RETURNING id INTO v_season;
  INSERT INTO league_registrations(org_id, season_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name,
    guardian_email, status, fee_amount)
  VALUES (v_org, v_season, 'Henry', 'Kim', 'G', 'K', 'k@example.invalid', 'active', 150) RETURNING id INTO v_reg;
  INSERT INTO league_registrations(org_id, season_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name,
    guardian_email, status, fee_amount)
  VALUES (v_org, v_season, 'Ivy', 'Kim', 'G', 'K', 'k@example.invalid', 'active', 150) RETURNING id INTO v_reg2;
  v_lop := gen_random_uuid();
  PERFORM online_payment_league_open(v_lop, v_org, 'acct_check12d1', v_season, 'kim-signup', 'Kim family', 'k@example.invalid',
    11.50, 'family', 0.035, 1.50, false, 'cs_check12d1_' || gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('registrationId', v_reg, 'description', 'Henry Kim · U11', 'amount', 150, 'feeShare', 5.75),
                      jsonb_build_object('registrationId', v_reg2, 'description', 'Ivy Kim · U9', 'amount', 150, 'feeShare', 5.75)));
  PERFORM online_payment_league_land(v_lop, now(), 'pi_d1_kim', 'ch_d1_kim', 'visa', '0259');
  IF league_reg_received(v_reg) <> 150 OR league_reg_received(v_reg2) <> 150 THEN RAISE EXCEPTION 'FAIL T11: the fixture did not land'; END IF;

  -- T11 · lost: each child's returned line, received drops to 0, every receipt line kept.
  v_res := online_payment_dispute_apply(v_lop, 'du_d1_kim', 'lost', 'product_not_received', 311.50, 311.50, NULL, false, 15, 'club', false, now());
  IF NOT (v_res ->> 'lostNow')::boolean OR league_reg_received(v_reg) <> 0 OR league_reg_received(v_reg2) <> 0
     OR (SELECT count(*) FROM accounting_entries WHERE source_entity_id IN (v_reg, v_reg2) AND category = 'registration_returned'
          AND payment_method = 'online_card') <> 2
     OR (SELECT count(*) FROM accounting_entries WHERE source_entity_id IN (v_reg, v_reg2) AND category = 'registration_fee' AND status = 'posted') <> 2 THEN
    RAISE EXCEPTION 'FAIL T11: a lost house-league dispute (%)', v_res; END IF;

  -- T12 · (mig 391) Ivy pays $60 of her fee again by e-transfer; then the dispute turns to won. Henry's $150 comes back;
  -- Ivy is put back the $90 she still owed, and the other $60 is handed back as extra for the desk. The payment is paid.
  PERFORM 1 FROM club_league_money(v_org, v_season, v_reg2, 'receive', 60, v_today, 'etransfer', NULL, NULL);
  v_res := online_payment_dispute_apply(v_lop, 'du_d1_kim', 'won', 'product_not_received', 311.50, 0, NULL, true, 15, 'club', false, now());
  IF NOT (v_res ->> 'wonBack')::boolean OR league_reg_received(v_reg) <> 150 OR league_reg_received(v_reg2) <> 150
     OR jsonb_array_length(v_res -> 'refused') <> 1 OR (v_res -> 'refused' -> 0 ->> 'registrationId')::uuid <> v_reg2
     OR (v_res -> 'refused' -> 0 ->> 'amount')::numeric <> 60
     OR (SELECT status FROM online_payments WHERE id = v_lop) <> 'paid' THEN
    RAISE EXCEPTION 'FAIL T12: a house-league win after a loss (%)', v_res; END IF;

  -- ── Every Stripe fee ──
  -- T13 · one fee per kind and payment, and per dispute for a dispute's kinds: a second dispute's fee is its own row.
  INSERT INTO platform_stripe_fees(org_id, online_payment_id, kind, amount, amount_source, dispute_id)
  VALUES (v_org, v_op3, 'dispute', 15, 'stripe', v_d);
  INSERT INTO platform_stripe_fees(org_id, online_payment_id, kind, amount, amount_source, dispute_id)
  VALUES (v_org, v_op3, 'dispute', 15, 'stripe', (SELECT id FROM online_payment_disputes WHERE stripe_dispute_id = 'du_d1_two'));
  v_ok := false;
  BEGIN INSERT INTO platform_stripe_fees(org_id, online_payment_id, kind, amount, amount_source, dispute_id)
    VALUES (v_org, v_op3, 'dispute', 15, 'stripe', v_d);
  EXCEPTION WHEN unique_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T13: a dispute fee recorded twice'; END IF;
  INSERT INTO platform_stripe_fees(org_id, online_payment_id, kind, amount, amount_source) VALUES (v_org, v_op, 'foreign_card', 3.32, 'rate');
  v_ok := false;
  BEGIN INSERT INTO platform_stripe_fees(org_id, online_payment_id, kind, amount, amount_source) VALUES (v_org, v_op, 'foreign_card', 3.32, 'rate');
  EXCEPTION WHEN unique_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T13: a foreign-card fee recorded twice'; END IF;
  v_ok := false;
  BEGIN INSERT INTO platform_stripe_fees(org_id, online_payment_id, kind, amount) VALUES (v_org, v_op, 'dispute', 15);
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T13: a dispute fee without its dispute'; END IF;

  -- T14 · a fee is billed one way only: on the subscription's invoice (no own invoice), or on its own invoice (with it);
  -- an exempt fee is never billed.
  v_ok := false;
  BEGIN UPDATE platform_stripe_fees SET stripe_invoice_item_id = 'ii_x', billed_at = now() WHERE online_payment_id = v_op AND kind = 'foreign_card';
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T14: billed without saying how'; END IF;
  INSERT INTO platform_fee_invoices(org_id, period_start, stripe_customer_id) VALUES (v_org, date_trunc('month', v_today)::date, 'cus_check12d1')
  RETURNING id INTO v_inv;
  v_ok := false;
  BEGIN UPDATE platform_stripe_fees SET stripe_invoice_item_id = 'ii_x', billed_at = now(), billed_on = 'subscription', fee_invoice_id = v_inv
    WHERE online_payment_id = v_op AND kind = 'foreign_card';
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T14: billed on the subscription AND an own invoice'; END IF;
  UPDATE platform_stripe_fees SET stripe_invoice_item_id = 'ii_x', billed_at = now(), billed_on = 'own_invoice', fee_invoice_id = v_inv
    WHERE online_payment_id = v_op AND kind = 'foreign_card';
  v_ok := false;
  BEGIN UPDATE platform_stripe_fees SET exempt_reason = 'test_mode' WHERE online_payment_id = v_op AND kind = 'foreign_card';
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T14: an exempt fee billed'; END IF;
  -- One own invoice a month per club; an invoice that has gone out names Stripe's invoice; paid is stamped.
  v_ok := false;
  BEGIN INSERT INTO platform_fee_invoices(org_id, period_start, stripe_customer_id) VALUES (v_org, date_trunc('month', v_today)::date, 'cus_check12d1');
  EXCEPTION WHEN unique_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T14: two own invoices in one month'; END IF;
  v_ok := false;
  BEGIN UPDATE platform_fee_invoices SET status = 'open' WHERE id = v_inv;
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T14: an open invoice with no Stripe invoice'; END IF;
  v_ok := false;
  BEGIN DELETE FROM platform_fee_invoices WHERE id = v_inv;
  EXCEPTION WHEN foreign_key_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T14: an invoice with billed fees deleted'; END IF;

  -- T15 · (mig 396) an inquiry escalated to a chargeback moves forward (the same id, warning_under_review → needs_response).
  v_res := online_payment_dispute_apply(v_xb, 'du_d1_inq', 'warning_under_review', 'general', 63.60, 0, NULL, true, NULL, NULL, false, now());
  v_res := online_payment_dispute_apply(v_xb, 'du_d1_inq', 'needs_response', 'general', 63.60, 63.60, now() + interval '14 days', false, 15, 'club', false, now());
  IF (v_res ->> 'stale')::boolean OR (SELECT status FROM online_payment_disputes WHERE stripe_dispute_id = 'du_d1_inq') <> 'needs_response' THEN
    RAISE EXCEPTION 'FAIL T15: an escalated inquiry did not move forward (%)', v_res; END IF;

  RAISE EXCEPTION 'ONLINE_PAYMENTS_12D1_PASSED';
END $op12d1$;
