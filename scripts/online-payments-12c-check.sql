-- DEV only. Club Tier Stage 12c Part 1 (mig 382): a team's part refund lowers its entry; a bank debit clears, comes back
-- or lands, in both flows; a refund made in Stripe needs no reason and may be split between children.
-- Run: node scripts/db-query.mjs --dev -f scripts/online-payments-12c-check.sql
-- The final exception rolls back every fixture row; the run passes only when it ends in ONLINE_PAYMENTS_12C_PASSED.
DO $op12c$
DECLARE
  v_org uuid; v_event uuid; v_div uuid; v_team uuid; v_full uuid; v_bankteam uuid; v_dash uuid;
  v_op uuid; v_op2 uuid; v_ref uuid; v_ref2 uuid; v_res jsonb; v_err text; v_ok boolean;
  v_season uuid; v_reg uuid; v_reg2 uuid; v_lop uuid; v_item uuid; v_item2 uuid; v_entry uuid; v_refusal text;
  v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
BEGIN
  INSERT INTO organizations(name, slug, plan_id)
  VALUES ('CHECK 12c', 'check-12c-' || substr(md5(random()::text), 1, 10), 'club') RETURNING id INTO v_org;
  INSERT INTO tournaments(org_id, year, name, slug, deposit_amount, total_fee_amount, settings)
  VALUES (v_org, 2026, '12c invitational', 'check-12c-invitational', 100, 400, '{"fee_scope":"tournament"}'::jsonb)
  RETURNING id INTO v_event;
  INSERT INTO divisions(tournament_id, name) VALUES (v_event, '12U') RETURNING id INTO v_div;
  INSERT INTO teams(tournament_id, division_id, name, email, status, payment_status)
  VALUES (v_event, v_div, 'Riverside Rockets', 'r@example.invalid', 'accepted', 'pending') RETURNING id INTO v_team;

  -- A $100 deposit paid online by card, landed through the tournament's writer.
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
  VALUES (v_org, 'acct_check12c', 'tournament_team', v_event, v_team, 'deposit', 'Riverside Rockets · deposit', 100, 5, 105,
    'family', 0.035, 1.50, 'cs_check12c_' || gen_random_uuid()) RETURNING id INTO v_op;
  v_res := online_payment_land(v_op, now(), 'pi_c12_' || gen_random_uuid(), 'ch_c12_' || gen_random_uuid(), 'visa', '4242');
  IF (SELECT total_paid FROM teams WHERE id = v_team) <> 100 THEN RAISE EXCEPTION 'FAIL T1: the deposit did not land'; END IF;

  -- T2 · a team's part refund needs a reason.
  v_err := NULL;
  BEGIN PERFORM online_payment_refund_open(v_op, false, NULL, NULL, NULL, 'app', NULL, 40, NULL);
  EXCEPTION WHEN others THEN v_err := SQLERRM; END;
  IF v_err IS DISTINCT FROM 'A partial refund needs a reason.' THEN RAISE EXCEPTION 'FAIL T2: part refund without a reason (%)', v_err; END IF;

  -- T3 · $40 back, with a reason: no fee, booked when Stripe accepts it; the entry drops by the same $40, so the balance
  -- does not move ($400 − $40 = $360 entry, $60 net paid, $300 still owed — the drawing's corrected arithmetic).
  v_ref := online_payment_refund_open(v_op, true, NULL, NULL, NULL, 'app', NULL, 40, 'One game cancelled for weather');
  IF NOT (SELECT part_refund FROM online_payment_refunds WHERE id = v_ref)
     OR (SELECT fee_refunded FROM online_payment_refunds WHERE id = v_ref) <> 0
     OR (SELECT amount FROM online_payment_refunds WHERE id = v_ref) <> 40 THEN
    RAISE EXCEPTION 'FAIL T3: the part refund row is wrong (or carries the fee)'; END IF;
  v_res := online_payment_team_refund_book(v_ref, 're_c12_a', false);
  IF (SELECT refunded_amount FROM tournament_team_payments WHERE online_payment_id = v_op) <> 40
     OR (SELECT status FROM tournament_team_payments WHERE online_payment_id = v_op) <> 'posted'
     OR (SELECT entry_lowered FROM teams WHERE id = v_team) <> 40
     OR (SELECT total_paid FROM teams WHERE id = v_team) <> 60
     OR (SELECT total FROM tournament_team_fee(v_team)) <> 360
     OR (SELECT status FROM online_payments WHERE id = v_op) <> 'partly_refunded'
     OR (SELECT count(*) FROM tournament_team_entry_adjustments WHERE team_id = v_team AND amount = 40
           AND reason = 'One game cancelled for weather' AND origin = 'app') <> 1
     OR (SELECT e.amount FROM accounting_entries e JOIN online_payment_refunds r ON r.refund_entry_id = e.id WHERE r.id = v_ref) <> 40 THEN
    RAISE EXCEPTION 'FAIL T3: the part refund did not book as ruled (%)', v_res; END IF;

  -- T4 · a replayed booking writes nothing twice; Stripe's "succeeded" only marks it.
  v_res := online_payment_team_refund_book(v_ref, 're_c12_a', true);
  IF (SELECT refunded_amount FROM tournament_team_payments WHERE online_payment_id = v_op) <> 40
     OR (SELECT entry_lowered FROM teams WHERE id = v_team) <> 40
     OR (SELECT count(*) FROM tournament_team_entry_adjustments WHERE team_id = v_team) <> 1
     OR (SELECT status FROM online_payment_refunds WHERE id = v_ref) <> 'succeeded' THEN
    RAISE EXCEPTION 'FAIL T4: a replay wrote again'; END IF;

  -- T5 · "All of it" is gone once part is refunded; T6 · a part refund is capped at what is left ($60).
  v_err := NULL;
  BEGIN PERFORM online_payment_refund_open(v_op, true, 'organizer_ended', NULL, NULL, 'app');
  EXCEPTION WHEN others THEN v_err := SQLERRM; END;
  IF v_err IS DISTINCT FROM 'This payment is already being refunded.' THEN RAISE EXCEPTION 'FAIL T5: a full refund after a part (%)', v_err; END IF;
  v_err := NULL;
  BEGIN PERFORM online_payment_refund_open(v_op, false, NULL, NULL, NULL, 'app', NULL, 70, 'Too much');
  EXCEPTION WHEN others THEN v_err := SQLERRM; END;
  IF v_err NOT LIKE 'A refund is more than zero and no more than what is left: 60%' THEN RAISE EXCEPTION 'FAIL T6: over the cap (%)', v_err; END IF;

  -- T7 · a second part refund of the rest: the row reads refunded in full, the fee never went back, the entry is lowered
  -- by both ($100), and the team owes $300.
  v_ref2 := online_payment_refund_open(v_op, false, NULL, NULL, NULL, 'app', NULL, 60, 'Second game cancelled');
  PERFORM online_payment_team_refund_book(v_ref2, 're_c12_b', true);
  IF (SELECT status FROM tournament_team_payments WHERE online_payment_id = v_op) <> 'refunded'
     OR (SELECT refunded_amount FROM tournament_team_payments WHERE online_payment_id = v_op) <> 100
     OR (SELECT status FROM online_payments WHERE id = v_op) <> 'refunded'
     OR (SELECT coalesce(sum(fee_refunded), 0) FROM online_payment_refunds WHERE online_payment_id = v_op) <> 0
     OR (SELECT entry_lowered FROM teams WHERE id = v_team) <> 100
     OR (SELECT total_paid FROM teams WHERE id = v_team) <> 0
     OR (SELECT total FROM tournament_team_fee(v_team)) <> 300 THEN
    RAISE EXCEPTION 'FAIL T7: the second part refund'; END IF;

  -- T7b · Mark paid after part refunds records what is really due ($300: $400 less the $100 lowered, nothing net paid),
  -- never the fee less whole rows (/dba).
  v_res := tournament_team_payment_pay_due(v_team, NULL, 'all', NULL);
  IF (SELECT total_paid FROM teams WHERE id = v_team) <> 300 OR (SELECT payment_status FROM teams WHERE id = v_team) <> 'paid' THEN
    RAISE EXCEPTION 'FAIL T7b: Mark paid after part refunds (%)', v_res; END IF;
  -- Take that hand payment back off so the later tests start from $0 net.
  PERFORM tournament_team_payment_remove((SELECT id FROM tournament_team_payments WHERE team_id = v_team AND online_payment_id IS NULL
    AND status = 'posted' ORDER BY created_at DESC LIMIT 1), NULL);
  -- T7c · a part refund never lands through the full-refund function (/dba).
  v_err := NULL;
  BEGIN PERFORM online_payment_refund_land(v_ref2, 're_c12_b');
  EXCEPTION WHEN others THEN v_err := SQLERRM; END;
  IF v_err IS DISTINCT FROM 'A part refund books through online_payment_team_refund_book.' THEN RAISE EXCEPTION 'FAIL T7c: (%)', v_err; END IF;

  -- T8 · the guards: no hand change to a refunded amount, no typed entry adjustment.
  v_err := NULL;
  BEGIN UPDATE tournament_team_payments SET refunded_amount = 0 WHERE online_payment_id = v_op;
  EXCEPTION WHEN others THEN v_err := SQLERRM; END;
  IF v_err IS NULL THEN RAISE EXCEPTION 'FAIL T8: a refunded amount changed by hand'; END IF;
  v_err := NULL;
  BEGIN INSERT INTO tournament_team_entry_adjustments(team_id, tournament_id, org_id, amount, reason, refund_id)
        VALUES (v_team, v_event, v_org, 5, 'typed', v_ref);
  EXCEPTION WHEN others THEN v_err := SQLERRM; END;
  IF v_err IS DISTINCT FROM 'A team''s entry is lowered only by a part refund.' THEN RAISE EXCEPTION 'FAIL T8: typed adjustment (%)', v_err; END IF;

  -- T9 · a team that paid in full ($400) gets $40 back: entry $360, paid $360 — still paid in full.
  INSERT INTO teams(tournament_id, division_id, name, email, status, payment_status)
  VALUES (v_event, v_div, 'Paid Whole', 'w@example.invalid', 'accepted', 'pending') RETURNING id INTO v_full;
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
  VALUES (v_org, 'acct_check12c', 'tournament_team', v_event, v_full, 'full', 'Paid Whole · entry', 400, 15.50, 415.50,
    'family', 0.035, 1.50, 'cs_check12c_' || gen_random_uuid()) RETURNING id INTO v_op2;
  PERFORM online_payment_land(v_op2, now(), 'pi_c12_' || gen_random_uuid(), NULL, 'visa', '4242');
  IF (SELECT payment_status FROM teams WHERE id = v_full) <> 'paid' THEN RAISE EXCEPTION 'FAIL T9: not paid in full'; END IF;
  v_ref := online_payment_refund_open(v_op2, false, NULL, NULL, NULL, 'app', NULL, 40, 'Rain-shortened');
  PERFORM online_payment_team_refund_book(v_ref, 're_c12_c', true);
  IF (SELECT payment_status FROM teams WHERE id = v_full) <> 'paid' OR (SELECT total_paid FROM teams WHERE id = v_full) <> 360
     OR (SELECT total FROM tournament_team_fee(v_full)) <> 360 THEN
    RAISE EXCEPTION 'FAIL T9: a part refund made a paid team owe'; END IF;

  -- T10 · a part refund made in Stripe needs no reason; its adjustment reads "made in Stripe" (no reason).
  INSERT INTO teams(tournament_id, division_id, name, email, status, payment_status)
  VALUES (v_event, v_div, 'Dashboard Team', 'd@example.invalid', 'accepted', 'pending') RETURNING id INTO v_dash;
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
  VALUES (v_org, 'acct_check12c', 'tournament_team', v_event, v_dash, 'deposit', 'Dashboard Team · deposit', 100, 5, 105,
    'family', 0.035, 1.50, 'cs_check12c_' || gen_random_uuid()) RETURNING id INTO v_op2;
  PERFORM online_payment_land(v_op2, now(), 'pi_c12_' || gen_random_uuid(), NULL, 'visa', '4242');
  v_ref := online_payment_refund_open(v_op2, false, NULL, NULL, NULL, 'stripe_dashboard', NULL, 25, NULL);
  PERFORM online_payment_team_refund_book(v_ref, 're_c12_d', true);
  IF (SELECT count(*) FROM tournament_team_entry_adjustments WHERE team_id = v_dash AND reason IS NULL AND origin = 'stripe_dashboard') <> 1 THEN
    RAISE EXCEPTION 'FAIL T10: a dashboard part refund'; END IF;

  -- T11 · a full refund (12a, "All of it") still makes the team owe: no adjustment.
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
  VALUES (v_org, 'acct_check12c', 'tournament_team', v_event, v_team, 'deposit', 'Riverside Rockets · deposit again', 100, 5, 105,
    'family', 0.035, 1.50, 'cs_check12c_' || gen_random_uuid()) RETURNING id INTO v_op2;
  PERFORM online_payment_land(v_op2, now(), 'pi_c12_' || gen_random_uuid(), NULL, 'visa', '4242');
  v_ref := online_payment_refund_open(v_op2, true, 'team_left', NULL, NULL, 'app');
  PERFORM online_payment_refund_land(v_ref, 're_c12_e');
  IF (SELECT entry_lowered FROM teams WHERE id = v_team) <> 100 OR (SELECT total_paid FROM teams WHERE id = v_team) <> 0
     OR (SELECT fee_refunded FROM online_payment_refunds WHERE id = v_ref) <> 5 THEN
    RAISE EXCEPTION 'FAIL T11: a full refund lowered the entry or lost its fee'; END IF;

  -- ── Bank debit ──
  INSERT INTO teams(tournament_id, division_id, name, email, status, payment_status)
  VALUES (v_event, v_div, 'Bank Team', 'b@example.invalid', 'accepted', 'pending') RETURNING id INTO v_bankteam;
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id, rail)
  VALUES (v_org, 'acct_check12c', 'tournament_team', v_event, v_bankteam, 'deposit', 'Bank Team · deposit', 100, 3.50, 103.50,
    'family', 0.025, 1.00, 'cs_check12c_' || gen_random_uuid(), 'bank_debit') RETURNING id INTO v_op;

  -- T12 · clearing: no book, no receipt number, the team's paid figure unmoved; a second payment can't open.
  IF NOT online_payment_clearing(v_op, 'pi_c12_bank1', '6789') THEN RAISE EXCEPTION 'FAIL T12: did not clear'; END IF;
  IF (SELECT status FROM online_payments WHERE id = v_op) <> 'clearing' OR (SELECT receipt_no FROM online_payments WHERE id = v_op) IS NOT NULL
     OR (SELECT bank_last4 FROM online_payments WHERE id = v_op) <> '6789'
     OR (SELECT total_paid FROM teams WHERE id = v_bankteam) <> 0
     OR EXISTS (SELECT 1 FROM tournament_team_payments WHERE online_payment_id = v_op) THEN
    RAISE EXCEPTION 'FAIL T12: a clearing debit counted as received'; END IF;
  IF online_payment_clearing(v_op, 'pi_c12_bank1', '6789') THEN RAISE EXCEPTION 'FAIL T12: cleared twice'; END IF;
  v_err := NULL;
  BEGIN
    INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
      fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
    VALUES (v_org, 'acct_check12c', 'tournament_team', v_event, v_bankteam, 'full', 'Bank Team · entry', 400, 15.50, 415.50,
      'family', 0.035, 1.50, 'cs_check12c_' || gen_random_uuid());
  EXCEPTION WHEN unique_violation THEN v_err := 'unique';
  END;
  IF v_err IS DISTINCT FROM 'unique' THEN RAISE EXCEPTION 'FAIL T12: a second payment opened while a debit clears'; END IF;

  -- T13 · returned while clearing: nothing taken, no book; a late "succeeded" never lands it; land_failed never stamps it paid.
  IF NOT online_payment_returned(v_op, 'insufficient_funds', 'insufficient_funds') THEN RAISE EXCEPTION 'FAIL T13: not returned'; END IF;
  v_res := online_payment_land(v_op, now(), 'pi_c12_bank1', NULL, NULL, NULL);
  PERFORM online_payment_land_failed(v_op, now(), 'pi_c12_bank1', NULL, NULL, NULL, 'late');
  IF (SELECT status FROM online_payments WHERE id = v_op) <> 'returned' OR NOT (v_res ->> 'returned')::boolean
     OR (SELECT receipt_no FROM online_payments WHERE id = v_op) IS NOT NULL
     OR EXISTS (SELECT 1 FROM tournament_team_payments WHERE online_payment_id = v_op)
     OR (SELECT total_paid FROM teams WHERE id = v_bankteam) <> 0 THEN
    RAISE EXCEPTION 'FAIL T13: a returned debit landed (%)', v_res; END IF;

  -- T14 · a debit that clears lands as 'online_bank', with its receipt number given then; a replay writes nothing; a late
  -- "completed" can't move it back to clearing.
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id, rail)
  VALUES (v_org, 'acct_check12c', 'tournament_team', v_event, v_bankteam, 'deposit', 'Bank Team · deposit', 100, 3.50, 103.50,
    'family', 0.025, 1.00, 'cs_check12c_' || gen_random_uuid(), 'bank_debit') RETURNING id INTO v_op;
  PERFORM online_payment_clearing(v_op, 'pi_c12_bank2', '6789');
  v_res := online_payment_land(v_op, now(), 'pi_c12_bank2', 'ch_c12_bank2', NULL, NULL);
  IF (SELECT status FROM online_payments WHERE id = v_op) <> 'paid' OR (SELECT receipt_no FROM online_payments WHERE id = v_op) IS NULL
     OR (SELECT method FROM tournament_team_payments WHERE online_payment_id = v_op) <> 'online_bank'
     OR (SELECT e.payment_method FROM accounting_entries e JOIN tournament_team_payments p ON p.entry_id = e.id WHERE p.online_payment_id = v_op) <> 'online_bank'
     OR (SELECT total_paid FROM teams WHERE id = v_bankteam) <> 100 THEN
    RAISE EXCEPTION 'FAIL T14: the cleared debit (%)', v_res; END IF;
  v_res := online_payment_land(v_op, now(), 'pi_c12_bank2', 'ch_c12_bank2', NULL, NULL);
  IF NOT (v_res ->> 'already')::boolean OR online_payment_clearing(v_op, 'pi_c12_bank2', '6789')
     OR (SELECT total_paid FROM teams WHERE id = v_bankteam) <> 100 THEN
    RAISE EXCEPTION 'FAIL T14: a replay or a late completed moved it'; END IF;
  -- A card payment never clears. (Review 2026-10-26: this used a payment that was already refunded, so it passed on the
  -- status alone; an OPEN card payment is the case that can fail on the rail.)
  DECLARE v_card uuid;
  BEGIN
    INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
      fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
    VALUES (v_org, 'acct_check12c', 'tournament_team', v_event, v_bankteam, 'balance', 'Card Team · balance', 50, 2, 52,
      'family', 0.035, 1.50, 'cs_check12c_' || gen_random_uuid()) RETURNING id INTO v_card;
    IF (SELECT status FROM online_payments WHERE id = v_card) <> 'open' THEN RAISE EXCEPTION 'FAIL T14: the card fixture is not open'; END IF;
    IF online_payment_clearing(v_card, 'pi_x', NULL) THEN RAISE EXCEPTION 'FAIL T14: a card payment cleared'; END IF;
  END;
  -- T14b · a part refund of the bank debit: its "Refunds" line says online_bank and "to bank account" (/dba).
  v_ref := online_payment_refund_open(v_op, false, NULL, NULL, NULL, 'app', NULL, 10, 'Short game');
  PERFORM online_payment_team_refund_book(v_ref, 're_c12_bank', false);
  IF (SELECT e.payment_method FROM accounting_entries e JOIN online_payment_refunds r ON r.refund_entry_id = e.id WHERE r.id = v_ref) <> 'online_bank'
     OR (SELECT e.description FROM accounting_entries e JOIN online_payment_refunds r ON r.refund_entry_id = e.id WHERE r.id = v_ref) NOT LIKE 'Part refunded to bank account · %' THEN
    RAISE EXCEPTION 'FAIL T14b: a bank part refund''s line'; END IF;
  -- T14c · deleting an adjustment (service role only) keeps the cache right (/dba).
  DELETE FROM tournament_team_entry_adjustments WHERE refund_id = v_ref;
  IF (SELECT entry_lowered FROM teams WHERE id = v_bankteam) <> 0 THEN RAISE EXCEPTION 'FAIL T14c: a stale lowered entry'; END IF;
  -- T14d · a part refund on a payment that never reached the team's record is refused (/dba).
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
  VALUES (v_org, 'acct_check12c', 'tournament_team', v_event, v_dash, 'balance', 'Dashboard Team · balance', 300, 12, 312,
    'family', 0.035, 1.50, 'cs_check12c_' || gen_random_uuid()) RETURNING id INTO v_op2;
  PERFORM online_payment_land_failed(v_op2, now(), 'pi_c12_' || gen_random_uuid(), NULL, 'visa', '4242', 'test: not recorded');
  v_err := NULL;
  BEGIN PERFORM online_payment_refund_open(v_op2, false, NULL, NULL, NULL, 'app', NULL, 10, 'x');
  EXCEPTION WHEN others THEN v_err := SQLERRM; END;
  IF v_err IS DISTINCT FROM 'This payment isn''t in the team''s record yet.' THEN RAISE EXCEPTION 'FAIL T14d: (%)', v_err; END IF;
  -- T14e · deleting a team with adjustments cascades cleanly.
  DELETE FROM teams WHERE id = v_full;
  IF EXISTS (SELECT 1 FROM tournament_team_entry_adjustments WHERE team_id = v_full) THEN RAISE EXCEPTION 'FAIL T14e'; END IF;

  -- ── House league ──
  INSERT INTO league_seasons(org_id, name, slug, registration_fee) VALUES (v_org, 'Check 12c', 'check-12c', 150) RETURNING id INTO v_season;
  INSERT INTO league_registrations(org_id, season_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name,
    guardian_email, status, fee_amount)
  VALUES (v_org, v_season, 'Henry', 'Grant', 'P', 'G', 'g@example.invalid', 'active', 150) RETURNING id INTO v_reg;
  INSERT INTO league_registrations(org_id, season_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name,
    guardian_email, status, fee_amount)
  VALUES (v_org, v_season, 'Lily', 'Grant', 'P', 'G', 'g@example.invalid', 'active', 150) RETURNING id INTO v_reg2;

  -- T15 · "Online, bank debit" is Stripe's answer: a person can't type it.
  SELECT m.entry, m.refusal INTO v_entry, v_refusal FROM club_league_money(v_org, v_season, v_reg, 'receive', NULL, v_today, 'online_bank', NULL, NULL) m;
  IF v_refusal IS DISTINCT FROM 'method' THEN RAISE EXCEPTION 'FAIL T15: online_bank typed by hand (%)', v_refusal; END IF;

  -- T16 · siblings on one bank debit: while it clears neither child can be put in another payment; it lands as 'online_bank'.
  v_lop := gen_random_uuid();
  PERFORM online_payment_league_open(v_lop, v_org, 'acct_check12c', v_season, 'grant-signup', 'Grant family', 'g@example.invalid',
    8.50, 'family', 0.025, 1.00, false, 'cs_check12c_' || gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('registrationId', v_reg, 'description', 'Henry Grant · U11', 'amount', 150, 'feeShare', 4.25),
                      jsonb_build_object('registrationId', v_reg2, 'description', 'Lily Grant · U9', 'amount', 150, 'feeShare', 4.25)),
    'bank_debit');
  IF (SELECT rail FROM online_payments WHERE id = v_lop) <> 'bank_debit' THEN RAISE EXCEPTION 'FAIL T16: rail not kept'; END IF;
  PERFORM online_payment_clearing(v_lop, 'pi_c12_lbank', '1234');
  v_err := NULL;
  BEGIN
    PERFORM online_payment_league_open(gen_random_uuid(), v_org, 'acct_check12c', v_season, 'lily-alone', 'Lily', 'g@example.invalid',
      5.25, 'family', 0.035, 1.50, false, 'cs_check12c_' || gen_random_uuid(),
      jsonb_build_array(jsonb_build_object('registrationId', v_reg2, 'description', 'Lily Grant · U9', 'amount', 150, 'feeShare', 5.25)));
  EXCEPTION WHEN others THEN v_err := SQLERRM; END;
  IF v_err IS DISTINCT FROM 'A payment for a child in this sign-up is already open' THEN
    RAISE EXCEPTION 'FAIL T16: a child on a clearing debit was put in a second payment (%)', v_err; END IF;
  IF league_reg_received(v_reg) <> 0 THEN RAISE EXCEPTION 'FAIL T16: clearing counted as received'; END IF;
  -- T16b · (mig 386) a sister NOT on the clearing debit still pays, under the same sign-up key; a second OPEN page for the
  -- sign-up is still refused.
  INSERT INTO league_registrations(org_id, season_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name,
    guardian_email, status, fee_amount)
  VALUES (v_org, v_season, 'Rose', 'Grant', 'P', 'G', 'g@example.invalid', 'active', 150) RETURNING id INTO v_op2;
  v_op := gen_random_uuid();
  PERFORM online_payment_league_open(v_op, v_org, 'acct_check12c', v_season, 'grant-signup', 'Rose', 'g@example.invalid',
    5.25, 'family', 0.035, 1.50, false, 'cs_check12c_' || gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('registrationId', v_op2, 'description', 'Rose Grant · U7', 'amount', 150, 'feeShare', 5.25)));
  IF (SELECT status FROM online_payments WHERE id = v_op) <> 'open' THEN RAISE EXCEPTION 'FAIL T16b: a sibling off the debit could not pay'; END IF;
  v_ok := false;
  BEGIN
    PERFORM online_payment_league_open(gen_random_uuid(), v_org, 'acct_check12c', v_season, 'grant-signup', 'Rose', 'g@example.invalid',
      5.25, 'family', 0.035, 1.50, false, 'cs_check12c_' || gen_random_uuid(),
      jsonb_build_array(jsonb_build_object('registrationId', v_op2, 'description', 'Rose Grant · U7', 'amount', 150, 'feeShare', 5.25)));
  EXCEPTION WHEN others THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T16b: two open pages for one sign-up'; END IF;
  UPDATE online_payments SET status = 'expired' WHERE id = v_op;
  v_res := online_payment_league_land(v_lop, now(), 'pi_c12_lbank', 'ch_c12_lbank', NULL, NULL);
  IF league_reg_received(v_reg) <> 150 OR league_reg_received(v_reg2) <> 150
     OR (SELECT count(*) FROM accounting_entries e JOIN online_payment_items i ON i.entry_id = e.id
          WHERE i.online_payment_id = v_lop AND e.payment_method = 'online_bank') <> 2 THEN
    RAISE EXCEPTION 'FAIL T16: siblings did not land together as bank debit (%)', v_res; END IF;
  SELECT id INTO v_item FROM online_payment_items WHERE online_payment_id = v_lop AND registration_id = v_reg;
  SELECT id INTO v_item2 FROM online_payment_items WHERE online_payment_id = v_lop AND registration_id = v_reg2;

  -- T17 · a part refund made in Stripe needs no reason; one Stripe refund split between the two children is two rows
  -- (one per child), and never two rows for one child. A bank refund's line says "online_bank" / "to bank account".
  v_ref := online_payment_refund_open(v_lop, false, NULL, NULL, NULL, 'stripe_dashboard', v_item, 30, NULL);
  v_ref2 := online_payment_refund_open(v_lop, false, NULL, NULL, NULL, 'stripe_dashboard', v_item2, 20, NULL);
  PERFORM online_payment_league_refund_book(v_ref, 're_c12_split', true);
  PERFORM online_payment_league_refund_book(v_ref2, 're_c12_split', true);
  IF league_reg_received(v_reg) <> 120 OR league_reg_received(v_reg2) <> 130
     OR (SELECT e.payment_method FROM accounting_entries e JOIN online_payment_refunds r ON r.refund_entry_id = e.id WHERE r.id = v_ref) <> 'online_bank'
     OR (SELECT e.notes FROM accounting_entries e JOIN online_payment_refunds r ON r.refund_entry_id = e.id WHERE r.id = v_ref) <> 'Refunded to bank account'
     OR (SELECT status FROM online_payments WHERE id = v_lop) <> 'partly_refunded' THEN
    RAISE EXCEPTION 'FAIL T17: the split dashboard refund'; END IF;
  v_ok := false;
  BEGIN
    v_ref := online_payment_refund_open(v_lop, false, NULL, NULL, NULL, 'stripe_dashboard', v_item, 10, NULL);
    PERFORM online_payment_league_refund_book(v_ref, 're_c12_split', true);
  EXCEPTION WHEN unique_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T17: one Stripe refund booked twice on one child'; END IF;
  -- A part refund from the app still needs its reason (mig 376's rule, unchanged).
  v_err := NULL;
  BEGIN PERFORM online_payment_refund_open(v_lop, false, 'club_ended', NULL, NULL, 'app', v_item, 10, NULL);
  EXCEPTION WHEN others THEN v_err := SQLERRM; END;
  IF v_err IS DISTINCT FROM 'A partial refund needs a reason.' THEN RAISE EXCEPTION 'FAIL T17: app part refund without a reason (%)', v_err; END IF;

  -- ── A refund made in Stripe records itself (mig 384) ──
  -- T18 · Henry's share has $120 left (T17 took $30): a $20 refund made in Stripe records on him, no reason, with Stripe's
  -- moment; the same Stripe refund recorded again answers the same row (a replayed event writes nothing twice).
  v_ref := online_payment_refund_record_dashboard(v_lop, v_item, 20, 0, 're_c12_dash', now() - interval '1 day', NULL, NULL);
  IF online_payment_refund_record_dashboard(v_lop, v_item, 20, 0, 're_c12_dash', now(), NULL, NULL) <> v_ref THEN
    RAISE EXCEPTION 'FAIL T18: a replay wrote a second row'; END IF;
  PERFORM online_payment_league_refund_book(v_ref, 're_c12_dash', true);
  IF league_reg_received(v_reg) <> 100 OR (SELECT origin FROM online_payment_refunds WHERE id = v_ref) <> 'stripe_dashboard'
     OR (SELECT stripe_created_at FROM online_payment_refunds WHERE id = v_ref) IS NULL THEN
    RAISE EXCEPTION 'FAIL T18: the dashboard refund did not record'; END IF;
  -- T19 · the processing fee goes back only with the whole of an untouched share; never more than is left.
  v_err := NULL;
  BEGIN PERFORM online_payment_refund_record_dashboard(v_lop, v_item, 10, 4.25, 're_c12_fee', now(), NULL, NULL);
  EXCEPTION WHEN others THEN v_err := SQLERRM; END;
  IF v_err IS DISTINCT FROM 'The processing fee goes back only with the whole of an untouched share.' THEN RAISE EXCEPTION 'FAIL T19: fee on a part (%)', v_err; END IF;
  v_err := NULL;
  BEGIN PERFORM online_payment_refund_record_dashboard(v_lop, v_item, 101, 0, 're_c12_over', now(), NULL, NULL);
  EXCEPTION WHEN others THEN v_err := SQLERRM; END;
  IF v_err NOT LIKE 'A refund is more than zero and no more than what is left: 100%' THEN RAISE EXCEPTION 'FAIL T19: over the cap (%)', v_err; END IF;
  -- T20 · a team's part refund made in Stripe: a part refund, booked, lowering the entry "made in Stripe" (no reason).
  INSERT INTO teams(tournament_id, division_id, name, email, status, payment_status)
  VALUES (v_event, v_div, 'Stripe Team', 's@example.invalid', 'accepted', 'pending') RETURNING id INTO v_dash;
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
  VALUES (v_org, 'acct_check12c', 'tournament_team', v_event, v_dash, 'deposit', 'Stripe Team · deposit', 100, 5, 105,
    'family', 0.035, 1.50, 'cs_check12c_' || gen_random_uuid()) RETURNING id INTO v_op2;
  PERFORM online_payment_land(v_op2, now(), 'pi_c12_' || gen_random_uuid(), NULL, 'visa', '4242');
  v_ref := online_payment_refund_record_dashboard(v_op2, NULL, 30, 0, 're_c12_tdash', now(), NULL, NULL);
  PERFORM online_payment_team_refund_book(v_ref, 're_c12_tdash', true);
  IF NOT (SELECT part_refund FROM online_payment_refunds WHERE id = v_ref)
     OR (SELECT entry_lowered FROM teams WHERE id = v_dash) <> 30
     OR (SELECT count(*) FROM tournament_team_entry_adjustments WHERE refund_id = v_ref AND origin = 'stripe_dashboard' AND reason IS NULL) <> 1 THEN
    RAISE EXCEPTION 'FAIL T20: a team dashboard part refund'; END IF;
  -- T21 · "whose was it?" holds one row per Stripe refund.
  INSERT INTO online_refunds_unassigned(org_id, online_payment_id, stripe_refund_id, amount) VALUES (v_org, v_lop, 're_c12_whose', 25);
  v_ok := false;
  BEGIN INSERT INTO online_refunds_unassigned(org_id, online_payment_id, stripe_refund_id, amount) VALUES (v_org, v_lop, 're_c12_whose', 25);
  EXCEPTION WHEN unique_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T21: one Stripe refund held twice'; END IF;

  -- ── Part 6 (mig 387) ──
  -- T22 · the Stripe-only actions are never a person's.
  v_err := NULL;
  BEGIN PERFORM 1 FROM club_league_money(v_org, v_season, v_reg, 'reverse', 10, v_today, NULL, NULL, NULL);
  EXCEPTION WHEN others THEN v_err := SQLERRM; END;
  IF v_err IS DISTINCT FROM 'Only the online-payment functions record this.' THEN RAISE EXCEPTION 'FAIL T22: a person reversed (%)', v_err; END IF;

  -- T23 · ended while a bank debit cleared, "keep it": it lands into the book anyway, and the registration reads kept with
  -- the reason; the decision is done.
  INSERT INTO league_registrations(org_id, season_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name,
    guardian_email, status, fee_amount, signup_ref)
  VALUES (v_org, v_season, 'Iris', 'Lee', 'P', 'L', 'l@example.invalid', 'active', 150, 'IRISLEE1') RETURNING id INTO v_reg;
  v_lop := gen_random_uuid();
  PERFORM online_payment_league_open(v_lop, v_org, 'acct_check12c', v_season, 'IRISLEE1', 'Iris', 'l@example.invalid',
    4.75, 'family', 0.025, 1.00, false, 'cs_check12c_' || gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('registrationId', v_reg, 'description', 'Iris Lee · U9', 'amount', 150, 'feeShare', 4.75)),
    'bank_debit');
  PERFORM online_payment_clearing(v_lop, 'pi_c12_iris', '4321');
  SELECT c.refusal INTO v_refusal FROM league_registration_close(v_org, v_season, v_reg, 'declined', NULL, NULL, false, false, NULL, NULL, NULL, NULL) c;
  IF v_refusal IS NOT NULL THEN RAISE EXCEPTION 'FAIL T23: ending while clearing refused (%)', v_refusal; END IF;
  SELECT id INTO v_item FROM online_payment_items WHERE online_payment_id = v_lop;
  INSERT INTO online_payment_clear_decisions(org_id, online_payment_id, online_payment_item_id, choice, reason)
  VALUES (v_org, v_lop, v_item, 'keep', 'Spot was held for a week');
  v_res := online_payment_league_land(v_lop, now(), 'pi_c12_iris', 'ch_c12_iris', NULL, NULL);
  IF league_reg_received(v_reg) <> 150 OR (SELECT end_money FROM league_registrations WHERE id = v_reg) <> 'kept'
     OR (SELECT end_money_reason FROM league_registrations WHERE id = v_reg) <> 'Spot was held for a week'
     OR (SELECT outcome FROM online_payment_clear_decisions WHERE online_payment_id = v_lop) <> 'kept'
     OR jsonb_array_length(v_res -> 'sendBack') <> 0 THEN
    RAISE EXCEPTION 'FAIL T23: a kept decision (%)', v_res; END IF;

  -- T24 · "send it back": it lands, and the landing hands the app the child to refund (the fee box with it); the outcome
  -- waits for the refund. With no decision, an ended child still refuses (unrecorded, as 12b).
  INSERT INTO league_registrations(org_id, season_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name,
    guardian_email, status, fee_amount, signup_ref)
  VALUES (v_org, v_season, 'Jack', 'Lee', 'P', 'L', 'l@example.invalid', 'active', 150, 'JACKLEE1') RETURNING id INTO v_reg2;
  v_lop := gen_random_uuid();
  PERFORM online_payment_league_open(v_lop, v_org, 'acct_check12c', v_season, 'JACKLEE1', 'Jack', 'l@example.invalid',
    4.75, 'family', 0.025, 1.00, false, 'cs_check12c_' || gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('registrationId', v_reg2, 'description', 'Jack Lee · U9', 'amount', 150, 'feeShare', 4.75)),
    'bank_debit');
  PERFORM online_payment_clearing(v_lop, 'pi_c12_jack', '4321');
  PERFORM 1 FROM league_registration_close(v_org, v_season, v_reg2, 'withdrawn', NULL, NULL, false, false, NULL, NULL, NULL, NULL);
  SELECT id INTO v_item2 FROM online_payment_items WHERE online_payment_id = v_lop;
  INSERT INTO online_payment_clear_decisions(org_id, online_payment_id, online_payment_item_id, choice, fee_back)
  VALUES (v_org, v_lop, v_item2, 'send_back', false);
  v_res := online_payment_league_land(v_lop, now(), 'pi_c12_jack', 'ch_c12_jack', NULL, NULL);
  IF league_reg_received(v_reg2) <> 150 OR jsonb_array_length(v_res -> 'sendBack') <> 1
     OR (v_res -> 'sendBack' -> 0 ->> 'itemId')::uuid <> v_item2
     OR (SELECT outcome FROM online_payment_clear_decisions WHERE online_payment_id = v_lop) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL T24: a send-back decision (%)', v_res; END IF;

  -- T25 · a cleared house-league debit reversed by the bank: a returned line per child (not in Refunds), the receipt kept,
  -- received drops; a second dispute event changes nothing; a card payment and a never-cleared debit are refused.
  v_res := online_payment_reverse(v_lop, 'dp_c12_jack', 'insufficient_funds', 'insufficient_funds');
  IF league_reg_received(v_reg2) <> 0 OR (SELECT status FROM online_payments WHERE id = v_lop) <> 'reversed'
     OR (SELECT count(*) FROM accounting_entries WHERE source_entity_id = v_reg2 AND category = 'registration_returned'
          AND entry_type = 'expense' AND payment_method = 'online_bank') <> 1
     OR (SELECT count(*) FROM accounting_entries WHERE source_entity_id = v_reg2 AND category = 'registration_fee' AND status = 'posted') <> 1 THEN
    RAISE EXCEPTION 'FAIL T25: the reversal (%)', v_res; END IF;
  -- Review 2026-10-26: the amount of the returned line was never read — nothing refunded, so the whole $150 comes back.
  IF (SELECT sum(amount) FROM accounting_entries WHERE source_entity_id = v_reg2 AND category = 'registration_returned') <> 150 THEN
    RAISE EXCEPTION 'FAIL T25: the returned line is not the $150 received (%)',
      (SELECT sum(amount) FROM accounting_entries WHERE source_entity_id = v_reg2 AND category = 'registration_returned'); END IF;
  v_res := online_payment_reverse(v_lop, 'dp_c12_jack', 'insufficient_funds', NULL);
  IF NOT (v_res ->> 'already')::boolean THEN RAISE EXCEPTION 'FAIL T25: reversed twice'; END IF;
  v_err := NULL;
  BEGIN PERFORM online_payment_reverse((SELECT id FROM online_payments WHERE org_id = v_org AND rail = 'card' AND landed_at IS NOT NULL LIMIT 1), 'dp_x', NULL, NULL);
  EXCEPTION WHEN others THEN v_err := SQLERRM; END;
  IF v_err IS DISTINCT FROM 'Only a bank debit is reversed here.' THEN RAISE EXCEPTION 'FAIL T25: a card payment reversed (%)', v_err; END IF;

  -- T26 · a team's cleared debit reversed: its row reads reversed and leaves the paid figure; a "Returned by the bank" line.
  SELECT id INTO v_op FROM online_payments WHERE team_id = v_bankteam AND rail = 'bank_debit' AND landed_at IS NOT NULL LIMIT 1;
  -- Review 2026-10-26: the line's AMOUNT was never read. This payment had a $10 part refund (T14b), so what the bank takes
  -- back and the book returns is $90, never the $100 it started as.
  IF (SELECT refunded_amount FROM tournament_team_payments WHERE online_payment_id = v_op) <> 10 THEN
    RAISE EXCEPTION 'FAIL T26: the fixture lost its $10 part refund'; END IF;
  v_res := online_payment_reverse(v_op, 'dp_c12_team', NULL, NULL);
  IF (SELECT amount FROM accounting_entries WHERE source_entity_id = v_op AND description LIKE 'Returned by the bank · %' AND payment_method = 'online_bank') <> 90 THEN
    RAISE EXCEPTION 'FAIL T26: the returned line is not the $90 still received (%)',
      (SELECT amount FROM accounting_entries WHERE source_entity_id = v_op AND description LIKE 'Returned by the bank · %' AND payment_method = 'online_bank'); END IF;
  IF (SELECT status FROM tournament_team_payments WHERE online_payment_id = v_op) <> 'reversed'
     OR (SELECT total_paid FROM teams WHERE id = v_bankteam) <> 0
     OR NOT EXISTS (SELECT 1 FROM accounting_entries WHERE source_entity_id = v_op AND description LIKE 'Returned by the bank · %' AND payment_method = 'online_bank') THEN
    RAISE EXCEPTION 'FAIL T26: a team''s reversal (%)', v_res; END IF;

  -- T27 · one failure fee per debit and kind; a billed row carries its invoice item; an exempt one is never billed.
  INSERT INTO platform_debit_fees(org_id, online_payment_id, kind, amount) VALUES (v_org, v_op, 'reversed', 5);
  v_ok := false;
  BEGIN INSERT INTO platform_debit_fees(org_id, online_payment_id, kind, amount) VALUES (v_org, v_op, 'reversed', 5);
  EXCEPTION WHEN unique_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T27: a fee recorded twice'; END IF;
  v_ok := false;
  BEGIN INSERT INTO platform_debit_fees(org_id, online_payment_id, kind, amount, exempt_reason, stripe_invoice_item_id, billed_at)
    VALUES (v_org, v_lop, 'reversed', 5, 'comped', 'ii_x', now());
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T27: an exempt fee billed'; END IF;

  -- ── /review of the whole (mig 388) ──
  -- T28 · a child the desk put back before its debit cleared has simply paid: the send-back is void, never handed out.
  INSERT INTO league_registrations(org_id, season_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name,
    guardian_email, status, fee_amount, signup_ref)
  VALUES (v_org, v_season, 'Kai', 'Lee', 'P', 'L', 'l@example.invalid', 'active', 150, 'KAILEE01') RETURNING id INTO v_reg;
  v_lop := gen_random_uuid();
  PERFORM online_payment_league_open(v_lop, v_org, 'acct_check12c', v_season, 'KAILEE01', 'Kai', 'l@example.invalid',
    4.75, 'family', 0.025, 1.00, false, 'cs_check12c_' || gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('registrationId', v_reg, 'description', 'Kai Lee · U9', 'amount', 150, 'feeShare', 4.75)),
    'bank_debit');
  PERFORM online_payment_clearing(v_lop, 'pi_c12_kai', '4321');
  SELECT id INTO v_item FROM online_payment_items WHERE online_payment_id = v_lop;
  INSERT INTO online_payment_clear_decisions(org_id, online_payment_id, online_payment_item_id, choice, fee_back)
  VALUES (v_org, v_lop, v_item, 'send_back', true);  -- decided while ended, then the child was put back (still active here)
  v_res := online_payment_league_land(v_lop, now(), 'pi_c12_kai', 'ch_c12_kai', NULL, NULL);
  IF league_reg_received(v_reg) <> 150 OR jsonb_array_length(v_res -> 'sendBack') <> 0
     OR (SELECT outcome FROM online_payment_clear_decisions WHERE online_payment_id = v_lop) <> 'void' THEN
    RAISE EXCEPTION 'FAIL T28: a reinstated child''s send-back (%)', v_res; END IF;

  -- T29 · a reversal takes back only what is still received: a $40 booked refund leaves $110 to return.
  v_ref := online_payment_refund_open(v_lop, false, 'price_corrected', NULL, NULL, 'app', v_item, 40, 'Sibling price');
  PERFORM online_payment_league_refund_book(v_ref, 're_c12_kai', true);
  IF league_reg_received(v_reg) <> 110 THEN RAISE EXCEPTION 'FAIL T29: the refund did not book'; END IF;
  v_res := online_payment_reverse(v_lop, 'dp_c12_kai', NULL, NULL);
  IF league_reg_received(v_reg) <> 0
     OR (SELECT sum(amount) FROM accounting_entries WHERE source_entity_id = v_reg AND category = 'registration_returned') <> 110 THEN
    RAISE EXCEPTION 'FAIL T29: the reversal took back more than was received (%)', league_reg_received(v_reg); END IF;

  -- T30 · reversed is sticky: a refund finishing later can't move it back; the same dispute never reverses twice.
  PERFORM set_config('flhq.online_payment_write', 'on', true);
  UPDATE online_payments SET status = 'partly_refunded' WHERE id = v_lop;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  IF (SELECT status FROM online_payments WHERE id = v_lop) <> 'reversed' THEN RAISE EXCEPTION 'FAIL T30: reversed came undone'; END IF;
  v_res := online_payment_reverse(v_lop, 'dp_c12_kai', NULL, NULL);
  IF NOT (v_res ->> 'already')::boolean
     OR (SELECT count(*) FROM accounting_entries WHERE source_entity_id = v_reg AND category = 'registration_returned') <> 1 THEN
    RAISE EXCEPTION 'FAIL T30: reversed twice'; END IF;

  RAISE EXCEPTION 'ONLINE_PAYMENTS_12C_PASSED';
END $op12c$;
