-- DEV only. The final exception rolls back every fixture row.
-- Stage 7b, Add our teams (mig 346): a set of the club's teams is entered, accepted and linked in one step, or not at all.
DO $stage7b$
DECLARE
  v_org uuid; v_org2 uuid; v_event uuid; v_event2 uuid; v_u15 uuid; v_u13 uuid; v_div2 uuid;
  v_a uuid; v_b uuid; v_c uuid; v_d uuid; v_e uuid; v_g uuid; v_h uuid; v_k uuid;
  v_r jsonb; v_reg_a uuid; v_reg_k uuid; v_hand uuid;
BEGIN
  INSERT INTO organizations(name,slug,plan_id)
  VALUES('ATOMICITY Stage 7b','atomicity-stage7b-' || substr(md5(random()::text),1,10),'club') RETURNING id INTO v_org;
  INSERT INTO organizations(name,slug,plan_id)
  VALUES('ATOMICITY Stage 7b other','atomicity-stage7b-o-' || substr(md5(random()::text),1,10),'club') RETURNING id INTO v_org2;
  INSERT INTO tournaments(org_id,year,name,slug,deposit_amount,total_fee_amount,settings,status)
  VALUES(v_org,2026,'Stage 7b invitational','stage7b-invitational',150,600,'{"fee_scope":"tournament"}'::jsonb,'active')
  RETURNING id INTO v_event;
  INSERT INTO tournaments(org_id,year,name,slug,settings,status)
  VALUES(v_org2,2026,'Another club''s event','stage7b-other','{"fee_scope":"tournament"}'::jsonb,'active') RETURNING id INTO v_event2;
  INSERT INTO divisions(tournament_id,name) VALUES(v_event,'U15') RETURNING id INTO v_u15;
  INSERT INTO divisions(tournament_id,name) VALUES(v_event,'U13') RETURNING id INTO v_u13;
  INSERT INTO divisions(tournament_id,name) VALUES(v_event2,'U15') RETURNING id INTO v_div2;

  -- A and B run a season; C has none; D is archived; E belongs to another club; G, H, K run a season.
  INSERT INTO rep_teams(org_id,name,slug) VALUES(v_org,'Lions U15','s7b-a') RETURNING id INTO v_a;
  INSERT INTO rep_teams(org_id,name,slug) VALUES(v_org,'Lions U13','s7b-b') RETURNING id INTO v_b;
  INSERT INTO rep_teams(org_id,name,slug) VALUES(v_org,'Lions U11','s7b-c') RETURNING id INTO v_c;
  INSERT INTO rep_teams(org_id,name,slug,is_archived) VALUES(v_org,'Lions U18','s7b-d',true) RETURNING id INTO v_d;
  INSERT INTO rep_teams(org_id,name,slug) VALUES(v_org2,'Tigers U15','s7b-e') RETURNING id INTO v_e;
  INSERT INTO rep_teams(org_id,name,slug) VALUES(v_org,'Lions U9','s7b-g') RETURNING id INTO v_g;
  INSERT INTO rep_teams(org_id,name,slug) VALUES(v_org,'lions  u7','s7b-h') RETURNING id INTO v_h;
  INSERT INTO rep_teams(org_id,name,slug) VALUES(v_org,'Lions U10','s7b-k') RETURNING id INTO v_k;
  INSERT INTO rep_program_years(team_id,org_id,name,year,status)
  SELECT t, CASE WHEN t = v_e THEN v_org2 ELSE v_org END, '2026 Season', 2026, 'active'
    FROM unnest(ARRAY[v_a, v_b, v_d, v_e, v_g, v_h, v_k]) t;
  INSERT INTO rep_program_years(team_id,org_id,name,year,status) VALUES(v_c,v_org,'2025 Season',2025,'completed');

  -- 1. Two teams in one press: each entered, accepted, linked, owing nothing, and nothing written to any book.
  v_r := club_enter_own_teams(v_org, v_event, jsonb_build_array(
    jsonb_build_object('rep_team_id',v_a,'division_id',v_u15,'coach','Jordan Lee','email',' Jordan@Example.invalid '),
    jsonb_build_object('rep_team_id',v_b,'division_id',v_u13,'coach',NULL,'email',NULL)), NULL);
  IF jsonb_array_length(v_r) <> 2 THEN RAISE EXCEPTION 'FAIL T40: two teams did not come back: %', v_r; END IF;
  v_reg_a := (v_r->0->>'registrationId')::uuid;
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id=v_reg_a AND tournament_id=v_event AND division_id=v_u15 AND name='Lions U15'
                 AND status='accepted' AND payment_status='paid' AND total_paid=0 AND deposit_paid=0
                 AND coach='Jordan Lee' AND email='jordan@example.invalid') THEN
    RAISE EXCEPTION 'FAIL T40: the first entry is not accepted, no-fee, with its head coach'; END IF;
  IF NOT EXISTS (SELECT 1 FROM teams t JOIN rep_team_tournament_registrations l ON l.tournament_team_id=t.id
                 WHERE t.tournament_id=v_event AND l.rep_team_id=v_b AND l.org_id=v_org AND l.link_source='explicit'
                   AND t.coach IS NULL AND t.email='' AND t.division_id=v_u13) THEN
    RAISE EXCEPTION 'FAIL T40: a team with no head coach was not entered with a blank coach'; END IF;
  IF (SELECT count(*) FROM rep_team_tournament_registrations l JOIN teams t ON t.id=l.tournament_team_id WHERE t.tournament_id=v_event) <> 2 THEN
    RAISE EXCEPTION 'FAIL T40: an entry was not linked'; END IF;
  IF EXISTS (SELECT 1 FROM tournament_team_payments WHERE tournament_id=v_event)
     OR EXISTS (SELECT 1 FROM accounting_ledgers WHERE entity_type='tournament' AND entity_id=v_event) THEN
    RAISE EXCEPTION 'FAIL T40: entering our teams wrote money'; END IF;
  -- The new entry reads as our team to the fee writer (Stage 7a): a payment is refused.
  BEGIN
    PERFORM tournament_team_payment_record(v_reg_a, 100, (now() AT TIME ZONE 'America/Toronto')::date, 'Payment', NULL, NULL);
    RAISE EXCEPTION 'FAIL T40: our new team recorded a fee';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL T40:%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'Our team has no entry fee%' THEN RAISE EXCEPTION 'FAIL T40: wrong refusal for our team''s fee: %', SQLERRM; END IF;
  END;

  -- 2. The same team again (a second press): refused by name, nothing added.
  BEGIN
    PERFORM club_enter_own_teams(v_org, v_event, jsonb_build_array(jsonb_build_object('rep_team_id',v_a,'division_id',v_u15)), NULL);
    RAISE EXCEPTION 'FAIL T40: a team was entered twice';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL T40:%' THEN RAISE; END IF;
    IF SQLERRM <> 'Lions U15 is already in this tournament.' THEN RAISE EXCEPTION 'FAIL T40: wrong twice refusal: %', SQLERRM; END IF;
  END;

  -- 3. All or none: a good team and a refused one in one set leaves the good one out too, and the refusal names the team.
  BEGIN
    PERFORM club_enter_own_teams(v_org, v_event, jsonb_build_array(
      jsonb_build_object('rep_team_id',v_g,'division_id',v_u15),
      jsonb_build_object('rep_team_id',v_c,'division_id',v_u13)), NULL);
    RAISE EXCEPTION 'FAIL T40: a team with no season was entered';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL T40:%' THEN RAISE; END IF;
    IF SQLERRM <> 'Lions U11 has no season running, so it can''t be entered.' THEN RAISE EXCEPTION 'FAIL T40: wrong season refusal: %', SQLERRM; END IF;
  END;
  IF EXISTS (SELECT 1 FROM teams WHERE tournament_id=v_event AND name='Lions U9') THEN
    RAISE EXCEPTION 'FAIL T40: a refused set left a team half-entered'; END IF;

  -- 4. Archived, another club's team, another club's tournament, a division of another tournament, the same team twice in a set.
  BEGIN
    PERFORM club_enter_own_teams(v_org, v_event, jsonb_build_array(jsonb_build_object('rep_team_id',v_d,'division_id',v_u15)), NULL);
    RAISE EXCEPTION 'FAIL T40: an archived team was entered';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL T40:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM club_enter_own_teams(v_org, v_event, jsonb_build_array(jsonb_build_object('rep_team_id',v_e,'division_id',v_u15)), NULL);
    RAISE EXCEPTION 'FAIL T40: another club''s team was entered';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL T40:%' THEN RAISE; END IF;
    IF SQLERRM <> 'That rep team is not in your organization.' THEN RAISE EXCEPTION 'FAIL T40: wrong club refusal: %', SQLERRM; END IF;
  END;
  BEGIN
    PERFORM club_enter_own_teams(v_org, v_event2, jsonb_build_array(jsonb_build_object('rep_team_id',v_g,'division_id',v_div2)), NULL);
    RAISE EXCEPTION 'FAIL T40: our team was entered in another club''s tournament';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL T40:%' THEN RAISE; END IF;
    IF SQLERRM <> 'Tournament not found' THEN RAISE EXCEPTION 'FAIL T40: wrong tournament refusal: %', SQLERRM; END IF;
  END;
  BEGIN
    PERFORM club_enter_own_teams(v_org, v_event, jsonb_build_array(jsonb_build_object('rep_team_id',v_g,'division_id',v_div2)), NULL);
    RAISE EXCEPTION 'FAIL T40: a division of another tournament was used';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL T40:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM club_enter_own_teams(v_org, v_event, jsonb_build_array(
      jsonb_build_object('rep_team_id',v_g,'division_id',v_u15), jsonb_build_object('rep_team_id',v_g,'division_id',v_u13)), NULL);
    RAISE EXCEPTION 'FAIL T40: one team was chosen twice in a set';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL T40:%' THEN RAISE; END IF;
  END;

  -- 5. A team of the same name already in the division (spacing and case aside) is refused with today's sentence.
  INSERT INTO teams(tournament_id,division_id,name,email,status,payment_status)
  VALUES(v_event,v_u15,'Lions U7','v@example.invalid','accepted','pending');
  BEGIN
    PERFORM club_enter_own_teams(v_org, v_event, jsonb_build_array(jsonb_build_object('rep_team_id',v_h,'division_id',v_u15)), NULL);
    RAISE EXCEPTION 'FAIL T40: a same-named team was entered in one division';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL T40:%' THEN RAISE; END IF;
    IF SQLERRM <> 'A team named "lions  u7" already exists in this division.' THEN RAISE EXCEPTION 'FAIL T40: wrong name refusal: %', SQLERRM; END IF;
  END;

  -- 6. A completed tournament is locked.
  UPDATE tournaments SET status='completed' WHERE id=v_event;
  BEGIN
    PERFORM club_enter_own_teams(v_org, v_event, jsonb_build_array(jsonb_build_object('rep_team_id',v_g,'division_id',v_u15)), NULL);
    RAISE EXCEPTION 'FAIL T40: a completed tournament took a team';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL T40:%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'This tournament is completed%' THEN RAISE EXCEPTION 'FAIL T40: wrong lock refusal: %', SQLERRM; END IF;
  END;
  UPDATE tournaments SET status='active' WHERE id=v_event;

  -- 7. The record's "Link to a rep team" cannot make a second entry of a team already in (the guard, not the window).
  INSERT INTO teams(tournament_id,division_id,name,email,status,payment_status)
  VALUES(v_event,v_u13,'Typed by hand','h@example.invalid','accepted','pending') RETURNING id INTO v_hand;
  BEGIN
    INSERT INTO rep_team_tournament_registrations(tournament_team_id,rep_team_id,org_id) VALUES(v_hand,v_a,v_org);
    RAISE EXCEPTION 'FAIL T40: a team already in was linked to a second entry';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL T40:%' THEN RAISE; END IF;
    IF SQLERRM <> 'Lions U15 is already in this tournament.' THEN RAISE EXCEPTION 'FAIL T40: wrong link refusal: %', SQLERRM; END IF;
  END;
  -- …while a team not yet in links as before, and relinking the same entry to itself is not a second entry.
  INSERT INTO rep_team_tournament_registrations(tournament_team_id,rep_team_id,org_id) VALUES(v_hand,v_k,v_org);
  UPDATE rep_team_tournament_registrations SET linked_by_user_id=NULL, rep_team_id=v_k WHERE tournament_team_id=v_hand;
  v_reg_k := v_hand;
  IF NOT EXISTS (SELECT 1 FROM rep_team_tournament_registrations WHERE tournament_team_id=v_reg_k AND rep_team_id=v_k) THEN
    RAISE EXCEPTION 'FAIL T40: the long way stopped linking'; END IF;

  RAISE EXCEPTION 'CLUB_STAGE7B_ATOMICITY_PASSED';
END $stage7b$;
