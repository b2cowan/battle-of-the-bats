-- DEV only. Stripe-owned pricing Stage 3 (mig 501): the club's books match what Stripe really takes. Stripe's fee is
-- stored once and only its extra is booked (either payer mode); old accounts are left alone; the guard freezes the new
-- columns; a dispute's fee is booked once; a family-paid fee is the club's cost when the payment is reversed; and a
-- stand-alone Stripe fee line is matched to exactly one payment, booked once, or recorded unmatched.
-- Run: node scripts/db-query.mjs --dev -f scripts/stripe-owned-pricing-501-check.sql
-- The final exception rolls back every fixture row; the run passes only when it ends in STRIPE_OWNED_PRICING_501_PASSED.
DO $sop501$
DECLARE
  v_org uuid; v_old_org uuid; v_event uuid; v_old_event uuid; v_div uuid; v_t1 uuid; v_t2 uuid; v_t3 uuid; v_t4 uuid;
  v_club uuid; v_fam uuid; v_old uuid; v_deb uuid; v_ans uuid; v_t5 uuid; v_bnc uuid; v_lop uuid; v_season uuid; v_reg uuid;
  v_res jsonb; v_err text; v_n int; v_e public.accounting_entries%ROWTYPE;
  v_utc date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  INSERT INTO organizations(name, slug, plan_id)
  VALUES ('CHECK 501', 'check-501-' || substr(md5(random()::text), 1, 10), 'club') RETURNING id INTO v_org;
  INSERT INTO org_payment_accounts(org_id, stripe_account_id, livemode, fee_payer, fees_collector)
  VALUES (v_org, 'acct_check501', false, 'family', 'stripe');
  INSERT INTO organizations(name, slug, plan_id)
  VALUES ('CHECK 501 OLD', 'check-501o-' || substr(md5(random()::text), 1, 10), 'club') RETURNING id INTO v_old_org;
  INSERT INTO org_payment_accounts(org_id, stripe_account_id, livemode, fee_payer, fees_collector)
  VALUES (v_old_org, 'acct_check501_old', false, 'family', 'application');

  INSERT INTO tournaments(org_id, year, name, slug, deposit_amount, total_fee_amount, settings)
  VALUES (v_org, 2026, '501 Cup', 'check-501-cup', 100, 400, '{"fee_scope":"tournament"}'::jsonb) RETURNING id INTO v_event;
  INSERT INTO divisions(tournament_id, name) VALUES (v_event, '12U') RETURNING id INTO v_div;
  INSERT INTO teams(tournament_id, division_id, name, email, status, payment_status)
  VALUES (v_event, v_div, 'Club Cardinals', 'c@example.invalid', 'accepted', 'pending') RETURNING id INTO v_t1;
  INSERT INTO teams(tournament_id, division_id, name, email, status, payment_status)
  VALUES (v_event, v_div, 'Family Falcons', 'f@example.invalid', 'accepted', 'pending') RETURNING id INTO v_t2;
  INSERT INTO teams(tournament_id, division_id, name, email, status, payment_status)
  VALUES (v_event, v_div, 'Debit Ducks', 'd@example.invalid', 'accepted', 'pending') RETURNING id INTO v_t3;
  INSERT INTO teams(tournament_id, division_id, name, email, status, payment_status)
  VALUES (v_event, v_div, 'Answer Ants', 'a@example.invalid', 'accepted', 'pending') RETURNING id INTO v_t4;
  INSERT INTO teams(tournament_id, division_id, name, email, status, payment_status)
  VALUES (v_event, v_div, 'Bounce Bees', 'b@example.invalid', 'accepted', 'pending') RETURNING id INTO v_t5;
  INSERT INTO tournaments(org_id, year, name, slug, deposit_amount, total_fee_amount, settings)
  VALUES (v_old_org, 2026, '501 Old Cup', 'check-501-old', 100, 400, '{"fee_scope":"tournament"}'::jsonb) RETURNING id INTO v_old_event;

  -- T1 · club pays, domestic card (probe: $100, fee $5.00, ours $1.65, Stripe $3.35). The landing's whole-fee line stays the
  -- only cost; Stripe's fee is stored, no extra line; a second read changes nothing.
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, application_fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
  VALUES (v_org, 'acct_check501', 'tournament_team', v_event, v_t1, 'full', 'Club Cardinals · fee', 100, 5.00, 1.65, 100,
    'club', 0.035, 1.50, 'cs_501_' || gen_random_uuid()) RETURNING id INTO v_club;
  PERFORM online_payment_land(v_club, now(), 'pi_501_c', 'ch_501_c', 'visa', '4242');
  v_res := online_payment_stripe_fee_set(v_club, 3.35);
  IF (v_res ->> 'already')::boolean OR (v_res ->> 'entryId') IS NOT NULL
     OR (SELECT stripe_fee_amount FROM online_payments WHERE id = v_club) <> 3.35
     OR (SELECT stripe_extra_entry_id FROM online_payments WHERE id = v_club) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL T1a: a domestic card booked an extra or did not store Stripe''s fee (%)', v_res; END IF;
  IF NOT (online_payment_stripe_fee_set(v_club, 9.99) ->> 'already')::boolean
     OR (SELECT stripe_fee_amount FROM online_payments WHERE id = v_club) <> 3.35 THEN
    RAISE EXCEPTION 'FAIL T1b: a second read moved Stripe''s fee'; END IF;
  SELECT count(*) INTO v_n FROM accounting_entries WHERE source_module = 'online_payment' AND source_entity_id = v_club;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL T1c: % cost lines on a domestic club-pays payment, expected the one', v_n; END IF;

  -- T2 · family pays, US card (probe: Stripe $4.19 = $3.35 + 0.8%): "Stripe's extra" $0.84 on the tournament's book.
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, application_fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
  VALUES (v_org, 'acct_check501', 'tournament_team', v_event, v_t2, 'full', 'Family Falcons · fee', 100, 5.00, 1.65, 105,
    'family', 0.035, 1.50, 'cs_501_' || gen_random_uuid()) RETURNING id INTO v_fam;
  PERFORM online_payment_land(v_fam, now(), 'pi_501_f', 'ch_501_f', 'visa', '4242');
  IF (SELECT processing_cost_entry_id FROM online_payments WHERE id = v_fam) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL T2a: family-pays landing booked a processing cost'; END IF;
  v_res := online_payment_stripe_fee_set(v_fam, 4.19);
  SELECT * INTO v_e FROM accounting_entries WHERE id = (SELECT stripe_extra_entry_id FROM online_payments WHERE id = v_fam);
  IF v_e.id IS NULL OR v_e.amount <> 0.84 OR v_e.entry_type <> 'expense' OR v_e.status <> 'posted'
     OR v_e.description <> 'Stripe’s extra · Family Falcons · fee' OR v_e.ledger_id <> club_tournament_ledger(v_event)
     OR v_e.payment_method <> 'online_card' THEN
    RAISE EXCEPTION 'FAIL T2b: the extra line is wrong (% / %)', v_res, row_to_json(v_e); END IF;

  -- T3 · an old 'application' account is left alone: nothing stored, nothing booked.
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, application_fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
  VALUES (v_old_org, 'acct_check501_old', 'tournament_team', v_old_event,
    (SELECT t.id FROM teams t WHERE t.tournament_id = v_event AND t.name = 'Club Cardinals'), 'full', 'x', 100, 5.00, 5.00, 105,
    'family', 0.035, 1.50, 'cs_501_' || gen_random_uuid()) RETURNING id INTO v_old;
  v_res := online_payment_stripe_fee_set(v_old, 4.19);
  IF v_res ->> 'skipped' <> 'old_account' OR (SELECT stripe_fee_amount FROM online_payments WHERE id = v_old) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL T3: an old account''s payment was read (%)', v_res; END IF;
  IF online_payment_dispute_fee_book(v_old, 15) ->> 'skipped' <> 'old_account' THEN
    RAISE EXCEPTION 'FAIL T3b: an old account''s dispute fee was booked'; END IF;

  -- T4 · the guard: the new columns start NULL and change only through their writers.
  BEGIN
    UPDATE online_payments SET stripe_fee_amount = 1 WHERE id = v_club;
    RAISE EXCEPTION 'FAIL T4a: Stripe''s fee changed outside its writer';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err LIKE 'FAIL%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE online_payments SET reversal_fee_entry_id = (SELECT stripe_extra_entry_id FROM online_payments WHERE id = v_fam)
     WHERE id = v_club;
    RAISE EXCEPTION 'FAIL T4b: a reversal line was linked outside its writer';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err LIKE 'FAIL%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
      fee_amount, application_fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id, stripe_fee_amount)
    VALUES (v_org, 'acct_check501', 'tournament_team', v_event, v_t3, 'full', 'x', 100, 5, 1.65, 105, 'family', 0.035, 1.50,
      'cs_501_' || gen_random_uuid(), 3.35);
    RAISE EXCEPTION 'FAIL T4c: a payment opened with Stripe''s fee';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err LIKE 'FAIL%' THEN RAISE; END IF;
  END;

  -- T5 · a dispute's attached fee: "Dispute fee · receipt N", booked once.
  v_res := online_payment_dispute_fee_book(v_fam, 15);
  SELECT * INTO v_e FROM accounting_entries WHERE id = (SELECT dispute_fee_entry_id FROM online_payments WHERE id = v_fam);
  IF v_e.id IS NULL OR v_e.amount <> 15 OR v_e.description <> 'Dispute fee · receipt ' || (SELECT receipt_no FROM online_payments WHERE id = v_fam) THEN
    RAISE EXCEPTION 'FAIL T5a: the dispute fee line is wrong (%)', v_res; END IF;
  IF NOT (online_payment_dispute_fee_book(v_fam, 15) ->> 'already')::boolean THEN RAISE EXCEPTION 'FAIL T5b: booked twice'; END IF;
  IF online_payment_dispute_fee_book(v_fam, 0) ->> 'skipped' <> 'no_fee' THEN RAISE EXCEPTION 'FAIL T5c: a zero fee was not skipped'; END IF;

  -- T6 · ruling (f): family pays, the dispute is lost: the base goes back AND the family's $5 fee is the club's cost.
  v_res := online_payment_reverse(v_fam, 'du_501_f', NULL, NULL);
  SELECT * INTO v_e FROM accounting_entries WHERE id = (SELECT reversal_fee_entry_id FROM online_payments WHERE id = v_fam);
  IF v_e.id IS NULL OR v_e.amount <> 5.00 OR v_e.description <> 'Payment processing · Family Falcons · fee' OR (v_res ->> 'taken')::numeric <> 100 THEN
    RAISE EXCEPTION 'FAIL T6a: the family''s fee was not booked at the reversal (%)', v_res; END IF;
  -- Probe (e) lost, $105 US card: the club netted 105 − 5.84 − 105 − 15 = −20.84; the books now say the same (the receipt's
  -- income line is the team payment's; every other line names the payment).
  IF (SELECT sum(CASE WHEN e.entry_type = 'income' THEN e.amount ELSE -e.amount END) FROM accounting_entries e
       WHERE e.status = 'posted' AND (e.source_entity_id = v_fam
          OR e.id = (SELECT entry_id FROM tournament_team_payments WHERE online_payment_id = v_fam))) <> -20.84 THEN
    RAISE EXCEPTION 'FAIL T6b: a lost family-pays US-card dispute does not net −20.84 in the books'; END IF;

  -- T6c · club pays: a reversal adds no fee line (the landing's line already says it).
  v_res := online_payment_reverse(v_club, 'du_501_c', NULL, NULL);
  IF (v_res ->> 'feeEntryId') IS NOT NULL OR (SELECT reversal_fee_entry_id FROM online_payments WHERE id = v_club) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL T6c: a club-pays reversal booked the fee twice'; END IF;

  -- T7 · a stand-alone "Payment Failure" ($5) matched to the one debit that failed before it cleared.
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, application_fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id, rail)
  VALUES (v_org, 'acct_check501', 'tournament_team', v_event, v_t3, 'full', 'Debit Ducks · fee', 100, 3.50, 2.06, 103.50,
    'family', 0.025, 1.00, 'cs_501_' || gen_random_uuid(), 'bank_debit') RETURNING id INTO v_deb;
  PERFORM online_payment_returned(v_deb, 'insufficient_funds', 'insufficient_funds');
  v_res := online_payment_stripe_fee_line_take(v_org, 'acct_check501', 'txn_501_fail', false, -5,
    'Pre-Authorized Debit in Canada (' || v_utc || '): Payment Failure', now(), 'debit_failure', v_utc);
  SELECT e.* INTO v_e FROM online_payment_stripe_fee_lines l JOIN accounting_entries e ON e.id = l.entry_id WHERE l.stripe_txn_id = 'txn_501_fail';
  IF NOT (v_res ->> 'matched')::boolean OR v_e.amount <> 5 OR v_e.description <> 'Returned debit fee · Debit Ducks · fee'
     OR v_e.payment_method <> 'online_bank' THEN
    RAISE EXCEPTION 'FAIL T7a: the failure fee was not booked on its debit (%)', v_res; END IF;
  IF NOT (online_payment_stripe_fee_line_take(v_org, 'acct_check501', 'txn_501_fail', false, -5, 'x', now(), 'debit_failure', v_utc) ->> 'already')::boolean THEN
    RAISE EXCEPTION 'FAIL T7b: a replayed line was taken twice'; END IF;
  -- A second failure line that day has no debit left to match: recorded, never guessed.
  v_res := online_payment_stripe_fee_line_take(v_org, 'acct_check501', 'txn_501_fail2', false, -5, 'Pre-Authorized Debit in Canada: Payment Failure', now(), 'debit_failure', v_utc);
  IF (v_res ->> 'matched')::boolean OR v_res ->> 'reason' <> 'no_payment' THEN RAISE EXCEPTION 'FAIL T7c: %', v_res; END IF;
  -- Read again the next day (hardening 2026-11-18): an unmatched line is tried again, still recorded once.
  v_res := online_payment_stripe_fee_line_take(v_org, 'acct_check501', 'txn_501_fail2', false, -5, 'Pre-Authorized Debit in Canada: Payment Failure', now(), 'debit_failure', v_utc);
  IF NOT (v_res ->> 'retried')::boolean OR (v_res ->> 'matched')::boolean OR v_res ->> 'reason' <> 'no_payment'
     OR (SELECT count(*) FROM online_payment_stripe_fee_lines WHERE stripe_txn_id = 'txn_501_fail2') <> 1 THEN
    RAISE EXCEPTION 'FAIL T7g: an unmatched line was not tried again (%)', v_res; END IF;
  v_res := online_payment_stripe_fee_line_take(v_org, 'acct_check501', 'txn_501_credit', false, 15, 'Card Dispute Countered Fee Refund', now(), 'other', v_utc);
  IF v_res ->> 'reason' <> 'not_a_charge' THEN RAISE EXCEPTION 'FAIL T7d: a credit was not left unmatched (%)', v_res; END IF;
  v_res := online_payment_stripe_fee_line_take(v_org, 'acct_check501', 'txn_501_other', false, -2, 'Something new', now(), 'other', v_utc);
  IF v_res ->> 'reason' <> 'unknown_kind' THEN RAISE EXCEPTION 'FAIL T7e: %', v_res; END IF;
  BEGIN
    PERFORM online_payment_stripe_fee_line_take(v_old_org, 'acct_check501_old', 'txn_501_old', false, -5, 'x', now(), 'debit_failure', v_utc);
    RAISE EXCEPTION 'FAIL T7f: a line was taken for an old account';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err LIKE 'FAIL%' THEN RAISE; END IF;
  END;

  -- T8 · a "Dispute Countered Fee" ($15) matched to the one dispute the club answered near the day.
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, application_fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
  VALUES (v_org, 'acct_check501', 'tournament_team', v_event, v_t4, 'full', 'Answer Ants · fee', 100, 5.00, 1.65, 100,
    'club', 0.035, 1.50, 'cs_501_' || gen_random_uuid()) RETURNING id INTO v_ans;
  PERFORM online_payment_land(v_ans, now(), 'pi_501_a', 'ch_501_a', 'visa', '4242');
  PERFORM online_payment_dispute_apply(v_ans, 'du_501_a', 'under_review', 'fraudulent', 100, 100, NULL, true, 15, 'club', false, now());
  v_res := online_payment_stripe_fee_line_take(v_org, 'acct_check501', 'txn_501_ctr', false, -15,
    'Card Dispute Countered Fee (' || v_utc || ')', now(), 'dispute_countered', v_utc);
  SELECT e.* INTO v_e FROM online_payment_stripe_fee_lines l JOIN accounting_entries e ON e.id = l.entry_id WHERE l.stripe_txn_id = 'txn_501_ctr';
  IF NOT (v_res ->> 'matched')::boolean OR v_e.amount <> 15
     OR v_e.description <> 'Dispute fee · answered · receipt ' || (SELECT receipt_no FROM online_payments WHERE id = v_ans) THEN
    RAISE EXCEPTION 'FAIL T8: the countered fee was not booked on its dispute (%)', v_res; END IF;

  -- T8b · a bank debit taken back after it cleared: its $5 reads as a returned debit's fee, never a dispute's.
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, application_fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id, rail)
  VALUES (v_org, 'acct_check501', 'tournament_team', v_event, v_t5, 'full', 'Bounce Bees · fee', 100, 3.50, 2.06, 100,
    'club', 0.025, 1.00, 'cs_501_' || gen_random_uuid(), 'bank_debit') RETURNING id INTO v_bnc;
  PERFORM online_payment_land(v_bnc, now(), 'pi_501_b', 'py_501_b', NULL, NULL);
  v_res := online_payment_dispute_fee_book(v_bnc, 5);
  SELECT * INTO v_e FROM accounting_entries WHERE id = (SELECT dispute_fee_entry_id FROM online_payments WHERE id = v_bnc);
  IF v_e.id IS NULL OR v_e.amount <> 5
     OR v_e.description <> 'Returned debit fee · receipt ' || (SELECT receipt_no FROM online_payments WHERE id = v_bnc) THEN
    RAISE EXCEPTION 'FAIL T8b: a debit''s dispute fee is worded as a dispute (% / %)', v_res, v_e.description; END IF;

  -- T9 · house league, family pays, US card: the extra lands on the SEASON's book.
  INSERT INTO league_seasons(org_id, name, slug, registration_fee) VALUES (v_org, 'Check 501 Season', 'check-501', 150) RETURNING id INTO v_season;
  INSERT INTO league_registrations(org_id, season_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name,
    guardian_email, status, fee_amount)
  VALUES (v_org, v_season, 'Ada', 'Margin', 'P', 'M', 'm@example.invalid', 'active', 150) RETURNING id INTO v_reg;
  v_lop := online_payment_league_open(gen_random_uuid(), v_org, 'acct_check501', v_season, 'k501', 'Ada', NULL,
    6.75, 2.20, 'family', 0.035, 1.50, false, 'cs_501_' || gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('registrationId', v_reg, 'description', 'Ada · B', 'amount', 150, 'feeShare', 6.75)));
  PERFORM online_payment_league_land(v_lop, now(), 'pi_501_l', 'ch_501_l', 'visa', '4242');
  v_res := online_payment_stripe_fee_set(v_lop, 5.82);
  SELECT * INTO v_e FROM accounting_entries WHERE id = (SELECT stripe_extra_entry_id FROM online_payments WHERE id = v_lop);
  IF v_e.id IS NULL OR v_e.amount <> 1.27 OR v_e.ledger_id <> club_league_season_ledger(v_org, v_season) THEN
    RAISE EXCEPTION 'FAIL T9: the league extra is wrong (% / %)', v_res, row_to_json(v_e); END IF;

  RAISE EXCEPTION 'STRIPE_OWNED_PRICING_501_PASSED';
END $sop501$;
