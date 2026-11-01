-- DEV only. House League Stage 9d-3 Part 1 (mig 415): the press that tells families their practice times, its claim, and
-- a team marked told only once one of its families is reached — proved on the database.
-- Run: node scripts/db-query.mjs --dev -f scripts/house-league-9d3-check.sql
-- The final exception rolls back every fixture row; the run passes only when it ends in HOUSE_LEAGUE_9D3_PASSED.
-- (That a past date in a snapshot is not a change is the app's compare, proved in tests/unit/league-practice-tell.test.ts.)
DO $hl9d3$
DECLARE
  v_org uuid; v_season uuid; v_div uuid; v_t1 uuid; v_t2 uuid; v_r1 uuid; v_r2 uuid; v_r3 uuid;
  v_res record; v_n integer; v_ids uuid[]; v_e1 uuid; v_e2 uuid; v_told timestamptz; v_r4 uuid;
  v_snap jsonb := '[{"s":"2027-06-16T22:00:00.000Z","e":"2027-06-16T23:00:00.000Z","v":null,"f":null,"l":"Park A"}]';
  v_teams jsonb; v_hh jsonb; v_notice uuid;
BEGIN
  INSERT INTO organizations(name, slug, plan_id)
  VALUES ('PRACTICE TELL CHECK 9d3', 'practice-tell-check-9d3-' || substr(md5(random()::text), 1, 10), 'league') RETURNING id INTO v_org;
  INSERT INTO league_seasons(org_id, name, slug, registration_fee, status)
  VALUES (v_org, 'Tell check', 'tell-check', 100, 'active') RETURNING id INTO v_season;
  INSERT INTO league_divisions(season_id, name) VALUES (v_season, 'U12') RETURNING id INTO v_div;
  INSERT INTO league_teams(season_id, division_id, name) VALUES (v_season, v_div, 'Twins') RETURNING id INTO v_t1;
  INSERT INTO league_teams(season_id, division_id, name) VALUES (v_season, v_div, 'Rays') RETURNING id INTO v_t2;
  INSERT INTO league_registrations(org_id, season_id, division_id, team_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status)
  VALUES (v_org, v_season, v_div, v_t1, 'Ava', 'Kim', 'Sun', 'Kim', 'kim@example.invalid', 'active') RETURNING id INTO v_r1;
  INSERT INTO league_registrations(org_id, season_id, division_id, team_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status)
  VALUES (v_org, v_season, v_div, v_t2, 'Henry', 'Kim', 'Sun', 'Kim', 'kim@example.invalid', 'active') RETURNING id INTO v_r2;
  INSERT INTO league_registrations(org_id, season_id, division_id, team_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status)
  VALUES (v_org, v_season, v_div, v_t2, 'Liam', 'Chen', 'Wei', 'Chen', 'chen@example.invalid', 'active') RETURNING id INTO v_r3;

  v_teams := jsonb_build_array(
    jsonb_build_object('teamId', v_t1, 'saw', NULL, 'kind', 'first', 'snapshot', v_snap),
    jsonb_build_object('teamId', v_t2, 'saw', NULL, 'kind', 'first', 'snapshot', v_snap));
  v_hh := jsonb_build_array(
    jsonb_build_object('email', 'Kim@Example.invalid ', 'registrationIds', jsonb_build_array(v_r1, v_r2), 'teamIds', jsonb_build_array(v_t1, v_t2)),
    jsonb_build_object('email', 'chen@example.invalid', 'registrationIds', jsonb_build_array(v_r3), 'teamIds', jsonb_build_array(v_t2)));

  -- T1 · Refusals before anything is written: no teams, nobody, a team from elsewhere.
  SELECT * INTO v_res FROM league_practices_tell(v_org, v_season, v_div, NULL, '[]'::jsonb, v_hh);
  IF v_res.refusal IS DISTINCT FROM 'nothing' THEN RAISE EXCEPTION 'FAIL T1a: no teams got %', v_res.refusal; END IF;
  SELECT * INTO v_res FROM league_practices_tell(v_org, v_season, v_div, NULL, v_teams, '[]'::jsonb);
  IF v_res.refusal IS DISTINCT FROM 'nobody' THEN RAISE EXCEPTION 'FAIL T1b: no households got %', v_res.refusal; END IF;
  SELECT * INTO v_res FROM league_practices_tell(v_org, v_season, v_div, NULL,
    jsonb_build_array(jsonb_build_object('teamId', gen_random_uuid(), 'saw', NULL, 'kind', 'first', 'snapshot', v_snap)), v_hh);
  IF v_res.refusal IS DISTINCT FROM 'changed' THEN RAISE EXCEPTION 'FAIL T1c: a stranger team got %', v_res.refusal; END IF;

  -- T2 · The press: one notice (kind practices_sent, accepted by the check), one row per household, lower-cased, the
  -- Kims one row about two teams. Nobody is told yet.
  SELECT * INTO v_res FROM league_practices_tell(v_org, v_season, v_div, NULL, v_teams, v_hh);
  IF v_res.refusal IS NOT NULL OR v_res.families <> 2 OR v_res.notice IS NULL THEN
    RAISE EXCEPTION 'FAIL T2a: the press got % families %', v_res.refusal, v_res.families; END IF;
  v_notice := v_res.notice;
  IF (SELECT kind FROM league_season_notices WHERE id = v_notice) <> 'practices_sent' THEN RAISE EXCEPTION 'FAIL T2b: kind'; END IF;
  IF (SELECT cardinality(team_ids) FROM league_practice_emails WHERE notice_id = v_res.notice AND guardian_email = 'kim@example.invalid') <> 2 THEN
    RAISE EXCEPTION 'FAIL T2c: the Kims are not one row about two teams'; END IF;
  IF (SELECT count(*) FROM league_practice_tells WHERE notice_id = v_res.notice) <> 2 THEN RAISE EXCEPTION 'FAIL T2d: tells'; END IF;
  IF EXISTS (SELECT 1 FROM league_team_practices_told WHERE team_id IN (v_t1, v_t2)) THEN RAISE EXCEPTION 'FAIL T2e: told before any email went'; END IF;

  -- T3 · A double press while the first is going: refused, nothing written.
  SELECT * INTO v_res FROM league_practices_tell(v_org, v_season, v_div, NULL, v_teams, v_hh);
  IF v_res.refusal IS DISTINCT FROM 'sending' THEN RAISE EXCEPTION 'FAIL T3a: a double press got %', v_res.refusal; END IF;
  IF (SELECT count(*) FROM league_season_notices WHERE season_id = v_season) <> 1 THEN RAISE EXCEPTION 'FAIL T3b: a second notice'; END IF;

  -- T4 · The claim: once. A second claim of the same rows takes nothing.
  SELECT array_agg(id ORDER BY guardian_email) INTO v_ids FROM league_practice_emails WHERE season_id = v_season;
  v_e1 := v_ids[1]; v_e2 := v_ids[2];  -- chen, kim
  SELECT count(*) INTO v_n FROM league_practice_emails_claim(v_org, v_ids);
  IF v_n <> 2 THEN RAISE EXCEPTION 'FAIL T4a: the claim took %', v_n; END IF;
  SELECT count(*) INTO v_n FROM league_practice_emails_claim(v_org, v_ids);
  IF v_n <> 0 THEN RAISE EXCEPTION 'FAIL T4b: a second claim took %', v_n; END IF;

  -- T5 · Chen's email goes: Rays is told (with the snapshot), Twins is not (only the Kims are on it, still going).
  SELECT league_practice_emails_sent(v_org, ARRAY[v_e1]) INTO v_n;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL T5a: % teams told', v_n; END IF;
  SELECT told_at INTO v_told FROM league_team_practices_told WHERE team_id = v_t2;
  IF v_told IS DISTINCT FROM (SELECT created_at FROM league_season_notices WHERE id = v_notice) THEN RAISE EXCEPTION 'FAIL T5b: told_at'; END IF;
  IF (SELECT snapshot FROM league_team_practices_told WHERE team_id = v_t2) <> v_snap THEN RAISE EXCEPTION 'FAIL T5c: snapshot'; END IF;
  IF EXISTS (SELECT 1 FROM league_team_practices_told WHERE team_id = v_t1) THEN RAISE EXCEPTION 'FAIL T5d: Twins told'; END IF;
  -- Marking a row not `sending` changes nothing.
  SELECT league_practice_emails_sent(v_org, ARRAY[v_e1]) INTO v_n;
  IF v_n <> 0 THEN RAISE EXCEPTION 'FAIL T5e: a second mark told % teams', v_n; END IF;

  -- T6 · The Kims' email fails; the next press saw Rays untold, so it is refused as changed (Rays was told since).
  UPDATE league_practice_emails SET status = 'failed' WHERE id = v_e2;
  SELECT * INTO v_res FROM league_practices_tell(v_org, v_season, v_div, NULL, v_teams, v_hh);
  IF v_res.refusal IS DISTINCT FROM 'changed' THEN RAISE EXCEPTION 'FAIL T6a: a stale press got %', v_res.refusal; END IF;
  -- Only Rays, and Rays already told as the window read before: every team told since = 'already'.
  SELECT * INTO v_res FROM league_practices_tell(v_org, v_season, v_div, NULL,
    jsonb_build_array(jsonb_build_object('teamId', v_t2, 'saw', NULL, 'kind', 'first', 'snapshot', v_snap)),
    jsonb_build_array(jsonb_build_object('email', 'chen@example.invalid', 'registrationIds', jsonb_build_array(v_r3), 'teamIds', jsonb_build_array(v_t2))));
  IF v_res.refusal IS DISTINCT FROM 'already' THEN RAISE EXCEPTION 'FAIL T6b: a second press got %', v_res.refusal; END IF;

  -- T7 · A fresh press for Twins (as read now) takes Ava off the Kims' failed row; the row keeps Henry (Rays) as a missed
  -- household, still offered as "Send again" (review 2026-10-31: it used to be skipped whole, dropping Henry's family).
  -- The new one goes; Twins is told.
  SELECT * INTO v_res FROM league_practices_tell(v_org, v_season, v_div, NULL,
    jsonb_build_array(jsonb_build_object('teamId', v_t1, 'saw', NULL, 'kind', 'first', 'snapshot', v_snap)),
    jsonb_build_array(jsonb_build_object('email', 'kim@example.invalid', 'registrationIds', jsonb_build_array(v_r1), 'teamIds', jsonb_build_array(v_t1))));
  IF v_res.refusal IS NOT NULL THEN RAISE EXCEPTION 'FAIL T7a: the fresh press got %', v_res.refusal; END IF;
  IF (SELECT status FROM league_practice_emails WHERE id = v_e2) <> 'failed'
     OR (SELECT registration_ids FROM league_practice_emails WHERE id = v_e2) <> ARRAY[v_r2]
     OR (SELECT team_ids FROM league_practice_emails WHERE id = v_e2) <> ARRAY[v_t2] THEN
    RAISE EXCEPTION 'FAIL T7b: the old row did not keep only Henry on Rays and stay missed'; END IF;
  SELECT array_agg(id) INTO v_ids FROM league_practice_emails WHERE notice_id = v_res.notice;
  PERFORM league_practice_emails_claim(v_org, v_ids);
  PERFORM league_practice_emails_sent(v_org, v_ids);
  IF NOT EXISTS (SELECT 1 FROM league_team_practices_told WHERE team_id = v_t1) THEN RAISE EXCEPTION 'FAIL T7c: Twins not told'; END IF;
  -- A press that covers a row's every child skips it (nothing left to say).
  UPDATE league_practice_emails SET status = 'failed' WHERE notice_id = v_notice AND guardian_email = 'chen@example.invalid';
  SELECT count(*) INTO v_n FROM league_practices_tell(v_org, v_season, v_div, NULL,
    jsonb_build_array(jsonb_build_object('teamId', v_t2, 'saw', (SELECT told_at FROM league_team_practices_told WHERE team_id = v_t2), 'kind', 'change', 'snapshot', '[]'::jsonb)),
    jsonb_build_array(jsonb_build_object('email', 'chen@example.invalid', 'registrationIds', jsonb_build_array(v_r3), 'teamIds', jsonb_build_array(v_t2)),
                      jsonb_build_object('email', 'kim@example.invalid', 'registrationIds', jsonb_build_array(v_r2), 'teamIds', jsonb_build_array(v_t2))));
  IF (SELECT status FROM league_practice_emails WHERE notice_id = v_notice AND guardian_email = 'chen@example.invalid') <> 'skipped'
     OR (SELECT status FROM league_practice_emails WHERE id = v_e2) <> 'skipped' THEN
    RAISE EXCEPTION 'FAIL T7d: rows the new press covers entirely were not skipped'; END IF;
  -- (That press told nobody yet: its rows are pending. Clear them so the next steps start from Twins told, Rays told.)
  DELETE FROM league_season_notices WHERE id = (SELECT notice_id FROM league_practice_tells WHERE team_id = v_t2 ORDER BY created_at DESC LIMIT 1);

  -- T8 · An old notice's row marked sent never moves a team back to the older snapshot.
  UPDATE league_practice_emails SET status = 'sending', team_ids = ARRAY[v_t1, v_t2], registration_ids = ARRAY[v_r1, v_r2] WHERE id = v_e2;
  v_told := (SELECT told_at FROM league_team_practices_told WHERE team_id = v_t1);
  PERFORM league_practice_emails_sent(v_org, ARRAY[v_e2]);
  IF (SELECT told_at FROM league_team_practices_told WHERE team_id = v_t1) <> v_told THEN RAISE EXCEPTION 'FAIL T8: told moved back'; END IF;

  -- T8b · A change press: the Was side is read under the lock from what families were told, not the caller's word.
  SELECT * INTO v_res FROM league_practices_tell(v_org, v_season, v_div, NULL,
    jsonb_build_array(jsonb_build_object('teamId', v_t1, 'saw', v_told, 'kind', 'change', 'snapshot', '[]'::jsonb)),
    jsonb_build_array(jsonb_build_object('email', 'kim@example.invalid', 'registrationIds', jsonb_build_array(v_r1), 'teamIds', jsonb_build_array(v_t1))));
  IF v_res.refusal IS NOT NULL THEN RAISE EXCEPTION 'FAIL T8b-a: the change press got %', v_res.refusal; END IF;
  IF (SELECT told_before FROM league_practice_tells WHERE notice_id = v_res.notice AND team_id = v_t1) <> v_snap THEN
    RAISE EXCEPTION 'FAIL T8b-b: the Was side is not what families were told'; END IF;

  -- T8c · Send again: the Kims' address is fixed to a new one; it joins the send and the old row is skipped.
  UPDATE league_practice_emails SET status = 'failed' WHERE notice_id = v_res.notice;
  SELECT league_practice_emails_add(v_org, v_res.notice, jsonb_build_array(
    jsonb_build_object('email', 'kim.new@example.invalid', 'registrationIds', jsonb_build_array(v_r1), 'teamIds', jsonb_build_array(v_t1)),
    jsonb_build_object('email', 'kim.new@example.invalid', 'registrationIds', jsonb_build_array(v_r1), 'teamIds', jsonb_build_array(v_t1)))) INTO v_n;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL T8c-a: % rows added', v_n; END IF;
  IF (SELECT status FROM league_practice_emails WHERE notice_id = v_res.notice AND guardian_email = 'kim@example.invalid') <> 'skipped' THEN
    RAISE EXCEPTION 'FAIL T8c-b: the refused row still counts as missed'; END IF;
  IF (SELECT family_count FROM league_season_notices WHERE id = v_res.notice) <> 1 THEN RAISE EXCEPTION 'FAIL T8c-c: family_count %', (SELECT family_count FROM league_season_notices WHERE id = v_res.notice); END IF;
  BEGIN
    PERFORM league_practice_emails_add(v_org, v_res.notice, jsonb_build_array(
      jsonb_build_object('email', 'chen@example.invalid', 'registrationIds', jsonb_build_array(v_r3), 'teamIds', jsonb_build_array(v_t2))));
    RAISE EXCEPTION 'FAIL T8c-d: a household of another team joined the send';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  END;

  -- T8d · A child added under an address whose row was skipped joins that row (it is pending again, with both children);
  -- the same household offered again, with no new child, changes nothing.
  INSERT INTO league_registrations(org_id, season_id, division_id, team_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status)
  VALUES (v_org, v_season, v_div, v_t1, 'Zoe', 'Kim', 'Sun', 'Kim', 'kim@example.invalid', 'active') RETURNING id INTO v_r4;
  SELECT league_practice_emails_add(v_org, v_res.notice, jsonb_build_array(
    jsonb_build_object('email', 'kim@example.invalid', 'registrationIds', jsonb_build_array(v_r4), 'teamIds', jsonb_build_array(v_t1)))) INTO v_n;
  IF v_n <> 1 OR (SELECT status FROM league_practice_emails WHERE notice_id = v_res.notice AND guardian_email = 'kim@example.invalid') <> 'pending'
     OR (SELECT cardinality(registration_ids) FROM league_practice_emails WHERE notice_id = v_res.notice AND guardian_email = 'kim@example.invalid') <> 2 THEN
    RAISE EXCEPTION 'FAIL T8d-a: Zoe did not join the Kims'' skipped row'; END IF;
  SELECT league_practice_emails_add(v_org, v_res.notice, jsonb_build_array(
    jsonb_build_object('email', 'kim@example.invalid', 'registrationIds', jsonb_build_array(v_r4), 'teamIds', jsonb_build_array(v_t1)))) INTO v_n;
  IF v_n <> 0 THEN RAISE EXCEPTION 'FAIL T8d-b: the same household again added %', v_n; END IF;

  -- T9 · A finished season refuses.
  UPDATE league_seasons SET status = 'completed' WHERE id = v_season;
  SELECT * INTO v_res FROM league_practices_tell(v_org, v_season, v_div, NULL, v_teams, v_hh);
  IF v_res.refusal IS DISTINCT FROM 'finished' THEN RAISE EXCEPTION 'FAIL T9: a finished season got %', v_res.refusal; END IF;

  -- T10 · The kind check still refuses a made-up kind.
  BEGIN
    INSERT INTO league_season_notices(org_id, season_id, kind) VALUES (v_org, v_season, 'practices_whatever');
    RAISE EXCEPTION 'FAIL T10: a made-up kind was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  RAISE EXCEPTION 'HOUSE_LEAGUE_9D3_PASSED';
END $hl9d3$;
