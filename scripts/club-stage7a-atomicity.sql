-- DEV only. The final exception rolls back every fixture row.
-- Stage 7a fee book, as rebuilt by mig 345 (a team's payment is a dated record, each one one ledger line).
DO $stage7a$
DECLARE
  v_org uuid; v_event uuid; v_div uuid; v_team uuid; v_second uuid; v_own uuid;
  v_rep uuid; v_season uuid; v_reg uuid; v_reg2 uuid; v_book uuid; v_entry uuid; v_shared uuid;
  v_cat uuid; v_item uuid; v_sum numeric; v_r jsonb; v_pid uuid; v_pid2 uuid; v_org2 uuid; v_event2 uuid; v_div2 uuid; v_free uuid;
  v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
BEGIN
  INSERT INTO organizations(name,slug,plan_id)
  VALUES('ATOMICITY Stage 7a','atomicity-stage7a-' || substr(md5(random()::text),1,10),'club') RETURNING id INTO v_org;
  INSERT INTO tournaments(org_id,year,name,slug,deposit_amount,total_fee_amount,settings)
  VALUES(v_org,2026,'Stage 7a invitational','stage7a-invitational',150,600,'{"fee_scope":"tournament"}'::jsonb)
  RETURNING id INTO v_event;
  INSERT INTO divisions(tournament_id,name) VALUES(v_event,'U15') RETURNING id INTO v_div;

  -- Saving the filing word creates one category and item before the first fee.
  SELECT category_id,item_id INTO v_cat,v_item FROM club_tournament_fee_word(v_event,'Stage 7a invitational');
  PERFORM club_tournament_fee_word(v_event,'Stage 7a invitational');
  IF (SELECT count(*) FROM tournament_fee_book_settings WHERE tournament_id=v_event)<>1
     OR (SELECT count(*) FROM budget_items WHERE category_id=v_cat)<>9
     OR (SELECT count(DISTINCT lower(name)) FROM budget_items WHERE category_id=v_cat)<>9
     OR NOT EXISTS (SELECT 1 FROM budget_items WHERE id=v_item AND category_id=v_cat AND name='Entry fees') THEN
    -- Mig 344: a hosted event's shelf is created with its nine words (Entry fees is the one fees file under); a
    -- second call must add none, and Entry fees must stay the settings item.
    RAISE EXCEPTION 'FAIL T39: category or words duplicated, or Entry fees is not the filing word'; END IF;
  IF EXISTS(SELECT 1 FROM accounting_ledgers WHERE entity_type='tournament' AND entity_id=v_event) THEN
    RAISE EXCEPTION 'FAIL T39: saving filing opened a book before payment'; END IF;

  INSERT INTO teams(tournament_id,division_id,name,email,status,payment_status)
  VALUES(v_event,v_div,'Visitor A','a@example.invalid','accepted','pending') RETURNING id INTO v_team;
  INSERT INTO teams(tournament_id,division_id,name,email,status,payment_status)
  VALUES(v_event,v_div,'Visitor B','b@example.invalid','accepted','pending') RETURNING id INTO v_second;

  -- A recorded payment is one row and one ledger line, dated the day it arrived and filed under the event's word.
  v_r := tournament_team_payment_record(v_team, 100, v_today - 5, 'Deposit', 'etransfer', NULL);
  v_pid := (v_r->>'paymentId')::uuid;
  SELECT id INTO v_book FROM accounting_ledgers WHERE entity_type='tournament' AND entity_id=v_event;
  IF v_book IS NULL OR (SELECT count(*) FROM accounting_ledgers WHERE entity_type='tournament' AND entity_id=v_event)<>1
     OR (SELECT count(*) FROM accounting_entries WHERE ledger_id=v_book AND status='posted')<>1
     OR NOT EXISTS(SELECT 1 FROM accounting_entries e JOIN tournament_team_payments p ON p.entry_id=e.id
        WHERE p.id=v_pid AND e.amount=100 AND e.entry_date=v_today-5 AND e.payment_method='etransfer'
          AND e.description='Visitor A — entry fee (deposit)' AND e.budget_category_id=v_cat AND e.budget_item_id=v_item
          AND e.source_module='tournament_fee_receipt') THEN
    RAISE EXCEPTION 'FAIL T39: a payment was not one dated, filed ledger line'; END IF;
  IF (SELECT total_paid FROM teams WHERE id=v_team)<>100 OR (SELECT deposit_paid FROM teams WHERE id=v_team)<>100
     OR (SELECT payment_status FROM teams WHERE id=v_team)<>'pending' THEN
    RAISE EXCEPTION 'FAIL T39: the cached figures did not follow the payment'; END IF;

  -- A future date and a non-positive amount are refused, and write nothing.
  BEGIN
    PERFORM tournament_team_payment_record(v_team, 10, v_today + 1, 'Payment', NULL, NULL);
    RAISE EXCEPTION 'FAIL T39: a future-dated payment was recorded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL T39:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM tournament_team_payment_record(v_team, 0, v_today, 'Payment', NULL, NULL);
    RAISE EXCEPTION 'FAIL T39: a zero payment was recorded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL T39:%' THEN RAISE; END IF;
  END;

  -- The rest of the fee in one step, and a second press records nothing more. Completing it stamps when it was collected.
  v_r := tournament_team_payment_pay_due(v_team, NULL, 'all');
  IF NOT (v_r->>'recorded')::boolean OR (v_r->>'total')::numeric<>600 OR (v_r->>'status')<>'paid' OR NOT (v_r->>'becamePaid')::boolean THEN
    RAISE EXCEPTION 'FAIL T39: pay-the-rest did not complete the fee: %', v_r; END IF;
  v_r := tournament_team_payment_pay_due(v_team, NULL, 'all');
  IF (v_r->>'recorded')::boolean OR (SELECT count(*) FROM accounting_entries WHERE ledger_id=v_book AND status='posted')<>2
     OR (SELECT payment_collected_at FROM teams WHERE id=v_team) IS NULL OR (SELECT deposit_paid FROM teams WHERE id=v_team)<>150 THEN
    RAISE EXCEPTION 'FAIL T39: a second press wrote a second line, or the paid stamp / deposit figure is wrong'; END IF;

  -- Changing a payment voids its line and posts a corrected one (the book keeps both); the team stops being paid.
  SELECT id INTO v_pid2 FROM tournament_team_payments WHERE team_id=v_team AND status='posted' AND amount=500;
  v_r := tournament_team_payment_change(v_pid2, 400, v_today - 1, 'cash', NULL);
  IF (SELECT count(*) FROM accounting_entries WHERE ledger_id=v_book AND status='void' AND amount=500)<>1
     OR NOT EXISTS(SELECT 1 FROM accounting_entries WHERE ledger_id=v_book AND status='posted' AND amount=400 AND entry_date=v_today-1 AND payment_method='cash')
     OR (SELECT total_paid FROM teams WHERE id=v_team)<>500 OR (SELECT payment_status FROM teams WHERE id=v_team)<>'pending'
     OR (SELECT payment_collected_at FROM teams WHERE id=v_team) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL T39: a corrected payment did not void and replace, or the team stayed paid'; END IF;

  -- Removing a payment voids its line, who and when are kept, and it is never revived.
  v_r := tournament_team_payment_remove(v_pid, NULL);
  IF (SELECT status FROM tournament_team_payments WHERE id=v_pid)<>'removed'
     OR (SELECT removed_at FROM tournament_team_payments WHERE id=v_pid) IS NULL
     OR (SELECT e.status FROM accounting_entries e JOIN tournament_team_payments p ON p.entry_id=e.id WHERE p.id=v_pid)<>'void'
     OR (SELECT total_paid FROM teams WHERE id=v_team)<>400 THEN
    RAISE EXCEPTION 'FAIL T39: a removed payment left a live line or a live total'; END IF;
  v_r := tournament_team_payment_remove(v_pid, NULL);
  IF (v_r->>'removed')::boolean THEN RAISE EXCEPTION 'FAIL T39: a payment was removed twice'; END IF;

  -- One transfer for two teams is one line and one row each; removing a team's share keeps the other's, as one corrected line.
  v_shared := club_tournament_shared_payment(v_event,ARRAY[v_team,v_second],ARRAY[50,100]::numeric[],NULL,v_today,'etransfer','one transfer');
  SELECT entry_id INTO v_entry FROM tournament_team_payments WHERE id=v_shared;
  IF (SELECT amount FROM accounting_entries WHERE id=v_entry)<>150
     OR (SELECT description FROM accounting_entries WHERE id=v_entry) NOT LIKE '%Visitor A%Visitor B%'
     OR (SELECT count(*) FROM tournament_team_payments WHERE entry_id=v_entry AND status='posted')<>2
     OR (SELECT total_paid FROM teams WHERE id=v_second)<>100 THEN
    RAISE EXCEPTION 'FAIL T39: one transfer was not one line for both teams'; END IF;
  -- Changing one team's share moves the whole transfer: one date, one way it arrived, one corrected line for the same total
  -- (review 2026-10-21: the other team's row and its ledger line had been left behind).
  PERFORM tournament_team_payment_change(v_shared, 50, v_today - 1, 'cash', NULL);
  SELECT entry_id INTO v_entry FROM tournament_team_payments WHERE id=v_shared;
  IF (SELECT count(*) FROM tournament_team_payments WHERE entry_id=v_entry AND status='posted' AND paid_on=v_today-1 AND method='cash')<>2
     OR (SELECT amount FROM accounting_entries WHERE id=v_entry)<>150
     OR (SELECT entry_date FROM accounting_entries WHERE id=v_entry)<>v_today-1
     OR (SELECT payment_method FROM accounting_entries WHERE id=v_entry)<>'cash' THEN
    RAISE EXCEPTION 'FAIL T39: changing one share of a transfer did not move the whole transfer'; END IF;
  v_r := tournament_team_payment_remove(v_shared, NULL);
  IF (SELECT status FROM accounting_entries WHERE id=v_entry)<>'void'
     OR NOT EXISTS(SELECT 1 FROM accounting_entries e JOIN tournament_team_payments p ON p.entry_id=e.id
        WHERE p.team_id=v_second AND p.status='posted' AND e.status='posted' AND e.amount=100 AND e.description='Visitor B — entry fee')
     OR (SELECT total_paid FROM teams WHERE id=v_second)<>100 THEN
    RAISE EXCEPTION 'FAIL T39: removing one team''s share lost the other''s line'; END IF;

  -- The book always equals the teams' payments.
  SELECT coalesce(sum(amount),0) INTO v_sum FROM accounting_entries WHERE ledger_id=v_book
    AND source_module='tournament_fee_receipt' AND status='posted';
  IF v_sum IS DISTINCT FROM (SELECT coalesce(sum(p.amount),0) FROM tournament_team_payments p WHERE p.tournament_id=v_event AND p.status='posted' AND p.entry_id IS NOT NULL)
     OR v_sum IS DISTINCT FROM (SELECT coalesce(sum(total_paid),0) FROM teams WHERE id IN (v_team,v_second)) THEN
    RAISE EXCEPTION 'FAIL T39: fee book total differs from the teams'' payments'; END IF;

  -- The club's own team has no fee and cannot be linked once money is recorded.
  INSERT INTO rep_teams(org_id,name,slug) VALUES(v_org,'Host team','stage7a-host') RETURNING id INTO v_rep;
  BEGIN
    INSERT INTO rep_team_tournament_registrations(tournament_team_id,rep_team_id,org_id)
    VALUES(v_team,v_rep,v_org);
    RAISE EXCEPTION 'FAIL T39: paid visitor linked as no-fee team';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='FAIL T39: paid visitor linked as no-fee team' THEN RAISE; END IF;
  END;
  INSERT INTO teams(tournament_id,division_id,name,email,status,payment_status)
  VALUES(v_event,v_div,'Host team','host@example.invalid','accepted','pending') RETURNING id INTO v_own;
  INSERT INTO rep_team_tournament_registrations(tournament_team_id,rep_team_id,org_id)
  VALUES(v_own,v_rep,v_org);
  BEGIN
    PERFORM tournament_team_payment_record(v_own, 100, v_today, 'Payment', NULL, NULL);
    RAISE EXCEPTION 'FAIL T39: own team recorded a fee';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='FAIL T39: own team recorded a fee' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM tournament_team_payments WHERE team_id=v_own) THEN
    RAISE EXCEPTION 'FAIL T39: own team wrote a fee'; END IF;
  DELETE FROM rep_team_tournament_registrations WHERE tournament_team_id=v_own;

  -- The collected day is the day the payment that completed the fee arrived, and follows that payment when it is re-dated.
  INSERT INTO teams(tournament_id,division_id,name,email,status,payment_status)
  VALUES(v_event,v_div,'Visitor E','e@example.invalid','accepted','pending') RETURNING id INTO v_own;
  v_r := tournament_team_payment_record(v_own, 600, v_today - 3, 'Payment', NULL, NULL);
  v_pid := (v_r->>'paymentId')::uuid;
  IF (SELECT (payment_collected_at AT TIME ZONE 'America/Toronto')::date FROM teams WHERE id=v_own)<>v_today-3 THEN
    RAISE EXCEPTION 'FAIL T39: the collected day is not the day the fee was completed'; END IF;
  PERFORM tournament_team_payment_change(v_pid, 600, v_today - 2, NULL, NULL);
  IF (SELECT (payment_collected_at AT TIME ZONE 'America/Toronto')::date FROM teams WHERE id=v_own)<>v_today-2 THEN
    RAISE EXCEPTION 'FAIL T39: the collected day did not follow a re-dated completing payment'; END IF;
  DELETE FROM teams WHERE id=v_own;

  -- A legacy team marked paid with too little recorded is not made unpaid by an unrelated payment (review 2026-10-21).
  INSERT INTO teams(tournament_id,division_id,name,email,status,payment_status)
  VALUES(v_event,v_div,'Legacy D','d@example.invalid','accepted','paid') RETURNING id INTO v_own;
  PERFORM tournament_team_payment_record(v_own, 50, v_today, 'Payment', NULL, NULL);
  IF (SELECT payment_status FROM teams WHERE id=v_own)<>'paid' THEN
    RAISE EXCEPTION 'FAIL T39: a part payment made a legacy paid team unpaid'; END IF;
  DELETE FROM teams WHERE id=v_own;

  -- A fee edit refreshes the cached deposit (review 2026-10-21): $100 received, the deposit corrected from $150 to $80.
  INSERT INTO teams(tournament_id,division_id,name,email,status,payment_status)
  VALUES(v_event,v_div,'Visitor F','f@example.invalid','accepted','pending') RETURNING id INTO v_own;
  PERFORM tournament_team_payment_record(v_own, 100, v_today, 'Payment', NULL, NULL);
  IF (SELECT deposit_paid FROM teams WHERE id=v_own)<>100 THEN RAISE EXCEPTION 'FAIL T39: deposit cache before the fee edit'; END IF;
  UPDATE tournaments SET deposit_amount=80 WHERE id=v_event;
  IF (SELECT deposit_paid FROM teams WHERE id=v_own)<>80 OR (SELECT payment_status FROM teams WHERE id=v_own)<>'pending' THEN
    RAISE EXCEPTION 'FAIL T39: a fee edit did not refresh the cached deposit (or touched the status)'; END IF;
  UPDATE tournaments SET deposit_amount=150 WHERE id=v_event;
  -- "Mark paid" on a team whose payments already cover the fee brings its status in line instead of doing nothing.
  UPDATE tournaments SET total_fee_amount=100 WHERE id=v_event;
  v_r := tournament_team_payment_pay_due(v_own, NULL, 'all');
  IF (v_r->>'recorded')::boolean OR (SELECT payment_status FROM teams WHERE id=v_own)<>'paid' THEN
    RAISE EXCEPTION 'FAIL T39: Mark paid on a covered team did not bring its status in line'; END IF;
  UPDATE tournaments SET total_fee_amount=600 WHERE id=v_event;
  DELETE FROM teams WHERE id=v_own;

  -- An amount that rounds to nothing is refused with the sentence, not a constraint error.
  BEGIN
    PERFORM tournament_team_payment_record(v_second, 0.004, v_today, 'Payment', NULL, NULL);
    RAISE EXCEPTION 'FAIL T39: an amount that rounds to $0 was recorded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL T39:%' THEN RAISE; END IF;
    IF SQLERRM <> 'Enter an amount above $0.' THEN RAISE EXCEPTION 'FAIL T39: wrong refusal for a rounded-away amount: %', SQLERRM; END IF;
  END;

  -- A plan with no Accounting keeps the payments on the team and posts nothing; adding Accounting later posts nothing back.
  INSERT INTO organizations(name,slug,plan_id)
  VALUES('ATOMICITY Stage 7a plain','atomicity-stage7a-plain-' || substr(md5(random()::text),1,10),'tournament_plus') RETURNING id INTO v_org2;
  INSERT INTO tournaments(org_id,year,name,slug,total_fee_amount,settings)
  VALUES(v_org2,2026,'Plain invitational','plain-invitational',300,'{"fee_scope":"tournament"}'::jsonb) RETURNING id INTO v_event2;
  INSERT INTO divisions(tournament_id,name) VALUES(v_event2,'U13') RETURNING id INTO v_div2;
  INSERT INTO teams(tournament_id,division_id,name,email,status,payment_status)
  VALUES(v_event2,v_div2,'Plain C','c@example.invalid','accepted','pending') RETURNING id INTO v_free;
  v_r := tournament_team_payment_record(v_free, 120, v_today, 'Payment', NULL, NULL);
  v_pid := (v_r->>'paymentId')::uuid;
  IF (SELECT entry_id FROM tournament_team_payments WHERE id=v_pid) IS NOT NULL OR (SELECT total_paid FROM teams WHERE id=v_free)<>120
     OR EXISTS(SELECT 1 FROM accounting_ledgers WHERE entity_type='tournament' AND entity_id=v_event2) THEN
    RAISE EXCEPTION 'FAIL T39: a plan with no Accounting posted a line'; END IF;
  UPDATE organizations SET plan_id='club' WHERE id=v_org2;
  PERFORM tournament_team_payment_change(v_pid, 130, v_today, NULL, NULL);
  IF EXISTS(SELECT 1 FROM accounting_ledgers WHERE entity_type='tournament' AND entity_id=v_event2)
     OR (SELECT total_paid FROM teams WHERE id=v_free)<>130 THEN
    RAISE EXCEPTION 'FAIL T39: gaining Accounting posted an earlier payment back'; END IF;
  PERFORM tournament_team_payment_record(v_free, 50, v_today, 'Payment', NULL, NULL);
  IF (SELECT count(*) FROM accounting_entries e JOIN accounting_ledgers l ON l.id=e.ledger_id WHERE l.entity_id=v_event2 AND e.status='posted')<>1 THEN
    RAISE EXCEPTION 'FAIL T39: only the payment recorded after Accounting began should post'; END IF;

  -- A team with no fee schedule records nothing through pay-the-rest (the status alone is marked, by the route).
  UPDATE tournaments SET total_fee_amount=NULL WHERE id=v_event2;
  v_r := tournament_team_payment_pay_due(v_free, NULL, 'all');
  IF (v_r->>'recorded')::boolean OR NOT (v_r->>'noFee')::boolean THEN
    RAISE EXCEPTION 'FAIL T39: a team with no fee recorded a payment'; END IF;

  INSERT INTO league_seasons(org_id,name,slug,registration_fee)
  VALUES(v_org,'Stage 7a house league','stage7a-house',100) RETURNING id INTO v_season;
  INSERT INTO league_registrations(org_id,season_id,player_first_name,player_last_name,
    guardian_first_name,guardian_last_name,guardian_email,status)
  VALUES(v_org,v_season,'Sam','Player','Pat','Guardian','guardian@example.invalid','active') RETURNING id INTO v_reg;
  PERFORM club_league_fee_set(v_org,v_season,v_reg,true,NULL,current_date);
  PERFORM club_league_fee_set(v_org,v_season,v_reg,true,NULL,current_date);
  IF (SELECT count(*) FROM accounting_entries WHERE source_module='league_registration'
      AND source_entity_id=v_reg AND status='posted')<>1 THEN
    RAISE EXCEPTION 'FAIL T39: house fee double press wrote twice'; END IF;
  PERFORM club_league_fee_set(v_org,v_season,v_reg,false,NULL,current_date);
  PERFORM club_league_fee_set(v_org,v_season,v_reg,true,NULL,current_date);
  -- Stage 9b-2 (mig 368): ending a paid registration never voids its payment. The old ending refuses; the new one asks
  -- what happened to the money and records a refund as its own line out, beside the payment.
  BEGIN
    PERFORM club_league_fee_end(v_org,v_season,v_reg,'withdrawn',NULL,NULL);
    RAISE EXCEPTION 'FAIL T39: the old ending voided a paid registration';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'money_unsettled%' THEN RAISE; END IF;
  END;
  PERFORM 1 FROM league_registration_close(v_org,v_season,v_reg,'withdrawn',NULL,NULL,false,false,
    'refunded','Moved away',current_date,'cash');
  IF (SELECT count(*) FROM accounting_entries WHERE source_module='league_registration'
      AND source_entity_id=v_reg AND status='posted' AND entry_type='income')<>1
     OR (SELECT count(*) FROM accounting_entries WHERE source_module='league_registration'
      AND source_entity_id=v_reg AND status='posted' AND entry_type='expense')<>1
     OR league_reg_received(v_reg)<>0
     OR (SELECT registration_fee_paid FROM league_registrations WHERE id=v_reg)
     OR (SELECT status FROM league_registrations WHERE id=v_reg)<>'withdrawn' THEN
    RAISE EXCEPTION 'FAIL T39: house withdrawal did not record its refund beside the payment'; END IF;
  BEGIN
    PERFORM club_league_fee_set(v_org,v_season,v_reg,true,NULL,current_date);
    RAISE EXCEPTION 'FAIL T39: withdrawn registration could be marked paid';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='FAIL T39: withdrawn registration could be marked paid' THEN RAISE; END IF;
  END;
  INSERT INTO league_registrations(org_id,season_id,player_first_name,player_last_name,
    guardian_first_name,guardian_last_name,guardian_email,status)
  VALUES(v_org,v_season,'Old','Receivable','Pat','Guardian','old@example.invalid','active') RETURNING id INTO v_reg2;
  v_entry := club_fee_post(club_league_season_ledger(v_org,v_season),'league_registration',v_reg2,
    current_date,'Old Receivable — registration fee',100,NULL);
  UPDATE accounting_entries SET status='pending' WHERE id=v_entry;
  UPDATE league_registrations SET fee_entry_id=v_entry WHERE id=v_reg2;
  PERFORM club_league_fee_set(v_org,v_season,v_reg2,false,NULL,current_date);
  IF (SELECT status FROM accounting_entries WHERE id=v_entry)<>'void' THEN
    RAISE EXCEPTION 'FAIL T39: legacy pending house line survived the paid-only rule'; END IF;

  -- A registration with payments can be removed, and its payment rows go with it.
  DELETE FROM teams WHERE id=v_team;
  IF EXISTS(SELECT 1 FROM tournament_team_payments WHERE team_id=v_team) THEN
    RAISE EXCEPTION 'FAIL T39: deleting a team left payment rows behind'; END IF;

  RAISE EXCEPTION 'CLUB_STAGE7A_ATOMICITY_PASSED';
END $stage7a$;
