-- DEV only. The final exception rolls back every fixture row.
DO $stage7a$
DECLARE
  v_org uuid; v_event uuid; v_div uuid; v_team uuid; v_second uuid; v_own uuid;
  v_rep uuid; v_season uuid; v_reg uuid; v_reg2 uuid; v_book uuid; v_entry uuid; v_shared uuid;
  v_cat uuid; v_item uuid; v_count int; v_sum numeric;
BEGIN
  INSERT INTO organizations(name,slug,plan_id)
  VALUES('ATOMICITY Stage 7a','atomicity-stage7a-' || substr(md5(random()::text),1,10),'club') RETURNING id INTO v_org;
  INSERT INTO tournaments(org_id,year,name,slug,total_fee_amount,settings)
  VALUES(v_org,2026,'Stage 7a invitational','stage7a-invitational',600,'{"fee_scope":"tournament"}'::jsonb)
  RETURNING id INTO v_event;
  INSERT INTO divisions(tournament_id,name) VALUES(v_event,'U15') RETURNING id INTO v_div;

  -- Saving the filing word creates one category and item before the first fee.
  SELECT category_id,item_id INTO v_cat,v_item FROM club_tournament_fee_word(v_event,'Stage 7a invitational');
  PERFORM club_tournament_fee_word(v_event,'Stage 7a invitational');
  IF (SELECT count(*) FROM tournament_fee_book_settings WHERE tournament_id=v_event)<>1
     OR (SELECT count(*) FROM budget_items WHERE category_id=v_cat)<>1 THEN
    RAISE EXCEPTION 'FAIL T39: category or item duplicated'; END IF;
  IF EXISTS(SELECT 1 FROM accounting_ledgers WHERE entity_type='tournament' AND entity_id=v_event) THEN
    RAISE EXCEPTION 'FAIL T39: saving filing opened a book before payment'; END IF;

  INSERT INTO teams(tournament_id,division_id,name,email,status,payment_status)
  VALUES(v_event,v_div,'Visitor A','a@example.invalid','accepted','pending') RETURNING id INTO v_team;
  INSERT INTO teams(tournament_id,division_id,name,email,status,payment_status)
  VALUES(v_event,v_div,'Visitor B','b@example.invalid','accepted','pending') RETURNING id INTO v_second;
  UPDATE teams SET deposit_paid=150 WHERE id=v_team;
  UPDATE teams SET total_paid=600,payment_status='paid' WHERE id=v_team;
  SELECT id INTO v_book FROM accounting_ledgers WHERE entity_type='tournament' AND entity_id=v_event;
  IF v_book IS NULL OR (SELECT count(*) FROM accounting_ledgers WHERE entity_type='tournament' AND entity_id=v_event)<>1
     OR (SELECT array_agg(amount ORDER BY amount) FROM accounting_entries WHERE ledger_id=v_book AND status='posted') <> ARRAY[150.00,450.00]::numeric[] THEN
    RAISE EXCEPTION 'FAIL T39: deposit and balance did not open one book with two lines'; END IF;
  IF EXISTS(SELECT 1 FROM accounting_entries WHERE ledger_id=v_book AND status='posted'
    AND (budget_category_id<>v_cat OR budget_item_id<>v_item OR source_module<>'tournament_fee_receipt')) THEN
    RAISE EXCEPTION 'FAIL T39: a fee missed its filing or source'; END IF;

  UPDATE teams SET total_paid=550 WHERE id=v_team;
  SELECT coalesce(sum(amount),0) INTO v_sum FROM accounting_entries WHERE ledger_id=v_book AND status='posted';
  IF v_sum<>550 OR NOT EXISTS(SELECT 1 FROM accounting_entries WHERE ledger_id=v_book AND status='void' AND amount=450)
     OR NOT EXISTS(SELECT 1 FROM accounting_entries WHERE ledger_id=v_book AND status='posted' AND amount=400) THEN
    RAISE EXCEPTION 'FAIL T39: corrected amount did not void and replace (sum %, void450 %, post400 %)',
      v_sum,
      (SELECT count(*) FROM accounting_entries WHERE ledger_id=v_book AND status='void' AND amount=450),
      (SELECT count(*) FROM accounting_entries WHERE ledger_id=v_book AND status='posted' AND amount=400); END IF;
  UPDATE teams SET payment_status='pending' WHERE id=v_team;
  IF EXISTS(SELECT 1 FROM accounting_entries WHERE ledger_id=v_book AND status='posted') THEN
    RAISE EXCEPTION 'FAIL T39: undo kept a live fee'; END IF;
  UPDATE teams SET payment_status='paid' WHERE id=v_team;
  IF (SELECT count(*) FROM accounting_entries WHERE ledger_id=v_book AND status='posted')<>1
     OR (SELECT amount FROM accounting_entries WHERE ledger_id=v_book AND status='posted')<>600 THEN
    RAISE EXCEPTION 'FAIL T39: re-mark did not write a new line'; END IF;

  v_shared := club_tournament_shared_payment(v_event,ARRAY[v_team,v_second],ARRAY[50,100]::numeric[],NULL,current_date,'etransfer','one transfer');
  SELECT entry_id INTO v_entry FROM tournament_fee_receipts WHERE id=v_shared;
  IF (SELECT amount FROM accounting_entries WHERE id=v_entry)<>150
     OR (SELECT description FROM accounting_entries WHERE id=v_entry) NOT LIKE '%Visitor A%Visitor B%'
     OR (SELECT count(*) FROM tournament_fee_receipt_allocations WHERE receipt_id=v_shared)<>2
     OR (SELECT total_paid FROM teams WHERE id=v_second)<>100 THEN
    RAISE EXCEPTION 'FAIL T39: one transfer was not one line for both teams'; END IF;
  SELECT coalesce(sum(amount),0) INTO v_sum FROM accounting_entries WHERE ledger_id=v_book
    AND source_module='tournament_fee_receipt' AND status='posted';
  IF v_sum IS DISTINCT FROM (
    SELECT coalesce(sum(greatest(coalesce(total_paid,0),coalesce(deposit_paid,0))-fee_book_baseline),0)
    FROM teams WHERE id IN (v_team,v_second)
  ) THEN RAISE EXCEPTION 'FAIL T39: fee book total differs from teams after baseline'; END IF;

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
  UPDATE teams SET total_paid=600,payment_status='paid' WHERE id=v_own;
  IF EXISTS(SELECT 1 FROM tournament_fee_receipt_allocations WHERE team_id=v_own) THEN
    RAISE EXCEPTION 'FAIL T39: own team wrote a fee'; END IF;
  BEGIN
    DELETE FROM rep_team_tournament_registrations WHERE tournament_team_id=v_own;
    RAISE EXCEPTION 'FAIL T39: paid own team unlinked without undo';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='FAIL T39: paid own team unlinked without undo' THEN RAISE; END IF;
  END;
  UPDATE teams SET payment_status='pending' WHERE id=v_own;
  DELETE FROM rep_team_tournament_registrations WHERE tournament_team_id=v_own;
  UPDATE teams SET payment_status='paid' WHERE id=v_own;
  IF NOT EXISTS(SELECT 1 FROM tournament_fee_receipt_allocations a
      JOIN tournament_fee_receipts r ON r.id=a.receipt_id
      JOIN accounting_entries e ON e.id=r.entry_id
      WHERE a.team_id=v_own AND e.status='posted') THEN
    RAISE EXCEPTION 'FAIL T39: unlinked visitor payment wrote no fee'; END IF;

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
  PERFORM club_league_fee_end(v_org,v_season,v_reg,'withdrawn',NULL,NULL);
  IF EXISTS(SELECT 1 FROM accounting_entries WHERE source_module='league_registration'
      AND source_entity_id=v_reg AND status='posted')
     OR (SELECT registration_fee_paid FROM league_registrations WHERE id=v_reg)
     OR (SELECT status FROM league_registrations WHERE id=v_reg)<>'withdrawn' THEN
    RAISE EXCEPTION 'FAIL T39: house undo/withdrawal left a live fee'; END IF;
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

  -- A row that was already paid with no amounts (an old status-only row) books nothing when "paid" is sent again,
  -- and taking a paid team's amounts back to 0 sticks (review 2026-10-20).
  INSERT INTO teams(tournament_id,division_id,name,email,status,payment_status,fee_book_baseline)
  VALUES(v_event,v_div,'Legacy C','c@example.invalid','accepted','pending',0) RETURNING id INTO v_own;
  ALTER TABLE teams DISABLE TRIGGER teams_club_fee_before;
  ALTER TABLE teams DISABLE TRIGGER teams_club_fee_reconcile;
  UPDATE teams SET payment_status='paid' WHERE id=v_own;
  ALTER TABLE teams ENABLE TRIGGER teams_club_fee_before;
  ALTER TABLE teams ENABLE TRIGGER teams_club_fee_reconcile;
  SELECT coalesce(sum(amount),0) INTO v_sum FROM accounting_entries WHERE ledger_id=v_book AND status='posted';
  UPDATE teams SET payment_status='paid', name='Legacy C renamed' WHERE id=v_own;
  IF (SELECT total_paid FROM teams WHERE id=v_own)<>0
     OR (SELECT coalesce(sum(amount),0) FROM accounting_entries WHERE ledger_id=v_book AND status='posted')<>v_sum THEN
    RAISE EXCEPTION 'FAIL T39: re-sending paid on an old status-only row booked income'; END IF;
  UPDATE teams SET total_paid=100 WHERE id=v_own;
  UPDATE teams SET total_paid=0,deposit_paid=0 WHERE id=v_own;
  IF (SELECT total_paid FROM teams WHERE id=v_own)<>0
     OR (SELECT coalesce(sum(amount),0) FROM accounting_entries WHERE ledger_id=v_book AND status='posted')<>v_sum THEN
    RAISE EXCEPTION 'FAIL T39: a paid team could not be taken back to nothing'; END IF;

  -- A registration with receipts can be removed.
  DELETE FROM teams WHERE id=v_team;
  IF EXISTS(SELECT 1 FROM tournament_fee_receipt_allocations WHERE team_id=v_team) THEN
    RAISE EXCEPTION 'FAIL T39: deleting a team left receipt links behind'; END IF;

  RAISE EXCEPTION 'CLUB_STAGE7A_ATOMICITY_PASSED';
END $stage7a$;
