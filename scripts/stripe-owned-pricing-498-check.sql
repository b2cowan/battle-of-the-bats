-- DEV only. Stripe-owned pricing Stage 2 (mig 498): every payment keeps what FieldLogicHQ took, the guard freezes it, the
-- house-league opening refuses a missing or impossible figure, and every payouts account records its fee setting.
-- Run: node scripts/db-query.mjs --dev -f scripts/stripe-owned-pricing-498-check.sql
-- The final exception rolls back every fixture row; the run passes only when it ends in STRIPE_OWNED_PRICING_498_PASSED.
DO $sop498$
DECLARE
  v_org uuid; v_event uuid; v_team uuid; v_op uuid; v_season uuid; v_reg uuid; v_err text;
BEGIN
  -- Backfill: no payment without the figure, and none above its fee; no account without its setting.
  IF EXISTS (SELECT 1 FROM online_payments WHERE application_fee_amount IS NULL OR application_fee_amount > fee_amount) THEN
    RAISE EXCEPTION 'FAIL B1: a payment lacks what we took, or took more than its fee';
  END IF;
  IF EXISTS (SELECT 1 FROM org_payment_accounts WHERE fees_collector IS NULL) THEN RAISE EXCEPTION 'FAIL B2: an account lacks its setting'; END IF;
  IF EXISTS (SELECT 1 FROM org_payment_accounts WHERE fees_collector = 'application' AND disconnected_at IS NULL) THEN
    RAISE EXCEPTION 'FAIL B3: an old-setting account is still connected';
  END IF;

  INSERT INTO organizations(name, slug, plan_id)
  VALUES ('CHECK 498', 'check-498-' || substr(md5(random()::text), 1, 10), 'club') RETURNING id INTO v_org;
  INSERT INTO tournaments(org_id, year, name, slug, deposit_amount, total_fee_amount, settings)
  VALUES (v_org, 2026, 'Check 498 Cup', 'check-498-cup', 100, 400, '{}'::jsonb) RETURNING id INTO v_event;
  INSERT INTO teams(tournament_id, name, email, status) VALUES (v_event, 'Margin Mets', 'm@example.invalid', 'accepted') RETURNING id INTO v_team;

  -- T1: a payment opened without the figure is refused (NOT NULL), one above its fee by the CHECK.
  BEGIN
    INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
      fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
    VALUES (v_org, 'acct_check498', 'tournament_team', v_event, v_team, 'full', 'x', 100, 5, 105, 'family', 0.035, 1.50, 'cs_498_' || gen_random_uuid());
    RAISE EXCEPTION 'FAIL T1a: opened without what we took';
  EXCEPTION WHEN not_null_violation THEN NULL; END;
  BEGIN
    INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
      fee_amount, application_fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
    VALUES (v_org, 'acct_check498', 'tournament_team', v_event, v_team, 'full', 'x', 100, 5, 5.01, 105, 'family', 0.035, 1.50, 'cs_498_' || gen_random_uuid());
    RAISE EXCEPTION 'FAIL T1b: took more than the fee';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- T2: the $100 card payment of the probe: fee $5.00, ours $1.65. Stored, then frozen.
  INSERT INTO online_payments(org_id, stripe_account_id, flow, tournament_id, team_id, scope, description, base_amount,
    fee_amount, application_fee_amount, total_amount, fee_payer, fee_pct, fee_flat, stripe_checkout_session_id)
  VALUES (v_org, 'acct_check498', 'tournament_team', v_event, v_team, 'full', 'Margin Mets · full', 100, 5, 1.65, 105,
    'family', 0.035, 1.50, 'cs_498_' || gen_random_uuid()) RETURNING id INTO v_op;
  BEGIN
    UPDATE online_payments SET application_fee_amount = 5 WHERE id = v_op;
    RAISE EXCEPTION 'FAIL T2: what we took was changed after the Checkout opened';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err LIKE 'FAIL%' THEN RAISE; END IF;
  END;

  -- T3: the house-league opening requires the figure and refuses one of zero or above the fee.
  INSERT INTO league_seasons(org_id, name, slug, registration_fee) VALUES (v_org, 'Check 498 Season', 'check-498', 150) RETURNING id INTO v_season;
  INSERT INTO league_registrations(org_id, season_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name,
    guardian_email, status, fee_amount)
  VALUES (v_org, v_season, 'Ada', 'Margin', 'P', 'M', 'm@example.invalid', 'active', 150) RETURNING id INTO v_reg;
  BEGIN
    PERFORM online_payment_league_open(gen_random_uuid(), v_org, 'acct_check498', v_season, 'k498a', 'Ada', NULL,
      6.75, 0, 'family', 0.035, 1.50, false, 'cs_498_' || gen_random_uuid(),
      jsonb_build_array(jsonb_build_object('registrationId', v_reg, 'description', 'Ada · B', 'amount', 150, 'feeShare', 6.75)));
    RAISE EXCEPTION 'FAIL T3a: opened with nothing taken';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err LIKE 'FAIL%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM online_payment_league_open(gen_random_uuid(), v_org, 'acct_check498', v_season, 'k498b', 'Ada', NULL,
      6.75, 6.76, 'family', 0.035, 1.50, false, 'cs_498_' || gen_random_uuid(),
      jsonb_build_array(jsonb_build_object('registrationId', v_reg, 'description', 'Ada · B', 'amount', 150, 'feeShare', 6.75)));
    RAISE EXCEPTION 'FAIL T3b: opened taking more than the fee';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err LIKE 'FAIL%' THEN RAISE; END IF;
  END;
  v_op := online_payment_league_open(gen_random_uuid(), v_org, 'acct_check498', v_season, 'k498c', 'Ada', NULL,
    6.75, 2.92, 'family', 0.035, 1.50, false, 'cs_498_' || gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('registrationId', v_reg, 'description', 'Ada · B', 'amount', 150, 'feeShare', 6.75)));
  IF (SELECT application_fee_amount FROM online_payments WHERE id = v_op) <> 2.92 THEN RAISE EXCEPTION 'FAIL T3c: the league opening did not store what we took'; END IF;

  -- T4: an account's setting is one of the two.
  BEGIN
    INSERT INTO org_payment_accounts(org_id, stripe_account_id, livemode, fee_payer, fees_collector) VALUES (v_org, 'acct_check498', false, 'family', 'platform');
    RAISE EXCEPTION 'FAIL T4: an unknown fee setting was stored';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_err = CONSTRAINT_NAME;
    IF v_err <> 'org_payment_accounts_fees_collector_chk' THEN RAISE EXCEPTION 'FAIL T4: refused by % instead', v_err; END IF;
  END;

  RAISE EXCEPTION 'STRIPE_OWNED_PRICING_498_PASSED';
END $sop498$;
