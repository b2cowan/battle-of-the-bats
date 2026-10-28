-- DEV only. House League Stage 9d-2b Part 1 (mig 409): Publish schedule, the change record, Changes to send, Undo and
-- Generate's atomic Save, proved on the database.
-- Run: node scripts/db-query.mjs --dev -f scripts/house-league-schedule-publish-check.sql
-- The final exception rolls back every fixture row; the run passes only when it ends in HOUSE_LEAGUE_SCHEDULE_PASSED.
DO $hlsched$
DECLARE
  v_org uuid; v_season uuid; v_div uuid; v_t1 uuid; v_t2 uuid; v_t3 uuid; v_g1 uuid; v_g2 uuid; v_g3 uuid; v_g4 uuid;
  v_res record; v_n integer; v_ids uuid[]; v_r text;
  v_d1 timestamptz := '2027-06-17 22:00+00'; v_d2 timestamptz := '2027-06-24 22:00+00'; v_d3 timestamptz := '2027-07-01 22:00+00';
BEGIN
  INSERT INTO organizations(name, slug, plan_id)
  VALUES ('SCHEDULE CHECK 9d2b', 'schedule-check-9d2b-' || substr(md5(random()::text), 1, 10), 'league') RETURNING id INTO v_org;
  INSERT INTO league_seasons(org_id, name, slug, registration_fee, status)
  VALUES (v_org, 'Schedule check', 'schedule-check', 100, 'active') RETURNING id INTO v_season;
  INSERT INTO league_divisions(season_id, name) VALUES (v_season, 'U12') RETURNING id INTO v_div;
  INSERT INTO league_teams(season_id, division_id, name) VALUES (v_season, v_div, 'Twins') RETURNING id INTO v_t1;
  INSERT INTO league_teams(season_id, division_id, name) VALUES (v_season, v_div, 'Rays') RETURNING id INTO v_t2;
  INSERT INTO league_teams(season_id, division_id, name) VALUES (v_season, v_div, 'Jays') RETURNING id INTO v_t3;
  -- The Kims: two children on two teams, one email. The Chens: one. A child with no email is nobody's row.
  INSERT INTO league_registrations(org_id, season_id, division_id, team_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status) VALUES
    (v_org, v_season, v_div, v_t1, 'Ava', 'Kim', 'Sun', 'Kim', 'Kim@Example.invalid ', 'active'),
    (v_org, v_season, v_div, v_t2, 'Henry', 'Kim', 'Sun', 'Kim', 'kim@example.invalid', 'active'),
    (v_org, v_season, v_div, v_t3, 'Liam', 'Chen', 'Wei', 'Chen', 'chen@example.invalid', 'active'),
    (v_org, v_season, v_div, v_t3, 'Noor', 'Ali', 'Sara', 'Ali', '', 'active');

  -- T1 · Generate's Save, a draft: no change rows; a second Save refuses.
  SELECT * INTO v_res FROM league_games_generate_save(v_org, v_season, v_div, jsonb_build_array(
    jsonb_build_object('homeTeamId', v_t1, 'awayTeamId', v_t2, 'scheduledAt', v_d1, 'endsAt', v_d1 + interval '90 min', 'location', 'Park A'),
    jsonb_build_object('homeTeamId', v_t2, 'awayTeamId', v_t3, 'scheduledAt', v_d2, 'endsAt', v_d2 + interval '90 min', 'location', 'Park A'),
    jsonb_build_object('homeTeamId', v_t3, 'awayTeamId', v_t1, 'scheduledAt', v_d3, 'endsAt', v_d3 + interval '90 min', 'location', 'Park A')));
  IF v_res.refusal IS NOT NULL OR cardinality(v_res.ids) <> 3 THEN RAISE EXCEPTION 'FAIL T1a: the Save did not write 3 games'; END IF;
  SELECT id INTO v_g1 FROM league_games WHERE division_id = v_div AND scheduled_at = v_d1;
  SELECT id INTO v_g2 FROM league_games WHERE division_id = v_div AND scheduled_at = v_d2;
  SELECT id INTO v_g3 FROM league_games WHERE division_id = v_div AND scheduled_at = v_d3;
  IF EXISTS (SELECT 1 FROM league_game_changes WHERE division_id = v_div) THEN RAISE EXCEPTION 'FAIL T1b: a draft recorded a change'; END IF;
  SELECT * INTO v_res FROM league_games_generate_save(v_org, v_season, v_div, '[]'::jsonb);
  IF v_res.refusal IS DISTINCT FROM 'has_games' THEN RAISE EXCEPTION 'FAIL T1c: a second Save got %', v_res.refusal; END IF;
  UPDATE league_games SET scheduled_at = v_d1 + interval '1 hour' WHERE id = v_g1;
  IF EXISTS (SELECT 1 FROM league_game_changes WHERE division_id = v_div) THEN RAISE EXCEPTION 'FAIL T1d: a draft move recorded'; END IF;
  UPDATE league_games SET scheduled_at = v_d1 WHERE id = v_g1;

  -- T2 · Publish refuses: teams first; then a stale count; then publishes once.
  SELECT * INTO v_res FROM league_division_schedule_publish(v_org, v_season, v_div, NULL, 3);
  IF v_res.refusal IS DISTINCT FROM 'teams_first' THEN RAISE EXCEPTION 'FAIL T2a: unpublished teams got %', v_res.refusal; END IF;
  UPDATE league_divisions SET teams_published_at = now() WHERE id = v_div;
  SELECT * INTO v_res FROM league_division_schedule_publish(v_org, v_season, v_div, NULL, 2);
  IF v_res.refusal IS DISTINCT FROM 'changed' THEN RAISE EXCEPTION 'FAIL T2b: a stale count got %', v_res.refusal; END IF;
  SELECT * INTO v_res FROM league_division_schedule_publish(v_org, v_season, v_div, NULL, 3);
  IF v_res.refusal IS NOT NULL OR v_res.families <> 2 OR v_res.notice IS NULL THEN
    RAISE EXCEPTION 'FAIL T2c: publish got % families %', v_res.refusal, v_res.families; END IF;
  IF (SELECT kind FROM league_season_notices WHERE id = v_res.notice) <> 'schedule_published' THEN RAISE EXCEPTION 'FAIL T2d: notice kind'; END IF;
  IF (SELECT cardinality(registration_ids) FROM league_schedule_emails WHERE notice_id = v_res.notice AND guardian_email = 'kim@example.invalid') <> 2 THEN
    RAISE EXCEPTION 'FAIL T2e: the Kims are not one row with two children'; END IF;
  IF (SELECT count(*) FROM league_schedule_emails WHERE notice_id = v_res.notice AND status = 'pending') <> 2 THEN
    RAISE EXCEPTION 'FAIL T2f: family rows are not 2 pending'; END IF;
  SELECT * INTO v_res FROM league_division_schedule_publish(v_org, v_season, v_div, NULL, 3);
  IF v_res.refusal IS DISTINCT FROM 'already' THEN RAISE EXCEPTION 'FAIL T2g: a second publish got %', v_res.refusal; END IF;
  SELECT * INTO v_res FROM league_games_generate_save(v_org, v_season, v_div, '[]'::jsonb);
  IF v_res.refusal IS DISTINCT FROM 'published' THEN RAISE EXCEPTION 'FAIL T2h: Save on a published division got %', v_res.refusal; END IF;

  -- T3 · The recorder: a score and a note are not news; a move is; moved twice keeps the date families heard.
  UPDATE league_games SET home_score = 3, away_score = 2, status = 'completed', notes = 'rain delay' WHERE id = v_g3;
  IF EXISTS (SELECT 1 FROM league_game_changes WHERE game_id = v_g3) THEN RAISE EXCEPTION 'FAIL T3a: a score recorded a change'; END IF;
  UPDATE league_games SET scheduled_at = v_d1 + interval '90 min', ends_at = v_d1 + interval '180 min' WHERE id = v_g1;
  UPDATE league_games SET scheduled_at = v_d1 + interval '1 day' WHERE id = v_g1;
  IF (SELECT moved_from FROM league_games WHERE id = v_g1) IS DISTINCT FROM v_d1 THEN
    RAISE EXCEPTION 'FAIL T3b: moved twice, moved_from is not the date families heard'; END IF;
  IF (SELECT count(*) FROM league_game_changes WHERE game_id = v_g1 AND sent_at IS NULL AND kind = 'moved') <> 2 THEN
    RAISE EXCEPTION 'FAIL T3c: two moves are not two held rows'; END IF;
  UPDATE league_games SET scheduled_at = v_d1 WHERE id = v_g1;
  IF (SELECT moved_from FROM league_games WHERE id = v_g1) IS NOT NULL THEN RAISE EXCEPTION 'FAIL T3d: moved back still reads Moved'; END IF;
  UPDATE league_games SET location = 'Park B' WHERE id = v_g2;
  IF (SELECT kind FROM league_game_changes WHERE game_id = v_g2) <> 'place' THEN RAISE EXCEPTION 'FAIL T3e: a place change kind'; END IF;

  -- T4 · Undo: the game as families last heard it, its rows gone.
  v_r := league_game_undo(v_org, v_season, v_g2);
  IF v_r IS NOT NULL OR (SELECT location FROM league_games WHERE id = v_g2) <> 'Park A'
     OR EXISTS (SELECT 1 FROM league_game_changes WHERE game_id = v_g2) THEN RAISE EXCEPTION 'FAIL T4a: undo of a place'; END IF;
  IF league_game_undo(v_org, v_season, v_g2) IS DISTINCT FROM 'nothing' THEN RAISE EXCEPTION 'FAIL T4b: undo with nothing held'; END IF;
  -- An added game, undone, is gone.
  INSERT INTO league_games(org_id, season_id, division_id, home_team_id, away_team_id, scheduled_at, location)
  VALUES (v_org, v_season, v_div, v_t1, v_t3, v_d3 + interval '7 days', 'Park A') RETURNING id INTO v_g4;
  IF (SELECT kind FROM league_game_changes WHERE game_id = v_g4) <> 'added' THEN RAISE EXCEPTION 'FAIL T4c: an add was not recorded'; END IF;
  v_r := league_game_undo(v_org, v_season, v_g4);
  IF EXISTS (SELECT 1 FROM league_games WHERE id = v_g4) THEN RAISE EXCEPTION 'FAIL T4d: an undone add is still a game'; END IF;

  -- T5 · Postpone, then a new date: given_date, Moved from the date families heard.
  UPDATE league_games SET status = 'postponed' WHERE id = v_g2;
  UPDATE league_games SET status = 'scheduled', scheduled_at = v_d3 + interval '14 days' WHERE id = v_g2;
  IF (SELECT array_agg(kind ORDER BY created_at) FROM league_game_changes WHERE game_id = v_g2) <> ARRAY['postponed', 'given_date'] THEN
    RAISE EXCEPTION 'FAIL T5a: postpone then a new date'; END IF;
  IF (SELECT moved_from FROM league_games WHERE id = v_g2) IS DISTINCT FROM v_d2 THEN RAISE EXCEPTION 'FAIL T5b: given a date, moved_from'; END IF;

  -- T6 · Send: a stale set refuses; the exact set sends once; a second press says already.
  SELECT array_agg(id) INTO v_ids FROM league_game_changes WHERE division_id = v_div AND sent_at IS NULL;
  SELECT * INTO v_res FROM league_division_changes_send(v_org, v_season, v_div, NULL, v_ids[1:1], ARRAY[v_g2]);
  IF v_res.refusal IS DISTINCT FROM 'changed' THEN RAISE EXCEPTION 'FAIL T6a: a partial set got %', v_res.refusal; END IF;
  -- g1 was moved and moved back (net nothing): only g2 is news. g2 is Rays vs Jays: the Kims (Henry) and the Chens.
  SELECT * INTO v_res FROM league_division_changes_send(v_org, v_season, v_div, NULL, v_ids, ARRAY[v_g2]);
  IF v_res.refusal IS NOT NULL OR v_res.families <> 2 THEN RAISE EXCEPTION 'FAIL T6b: send got % families %', v_res.refusal, v_res.families; END IF;
  IF EXISTS (SELECT 1 FROM league_game_changes WHERE division_id = v_div AND sent_at IS NULL) THEN RAISE EXCEPTION 'FAIL T6c: rows left held'; END IF;
  IF (SELECT registration_ids FROM league_schedule_emails WHERE notice_id = v_res.notice AND guardian_email = 'kim@example.invalid')
     <> (SELECT array_agg(id) FROM league_registrations WHERE season_id = v_season AND player_first_name = 'Henry') THEN
    RAISE EXCEPTION 'FAIL T6d: the Kims'' email is not about Henry alone'; END IF;
  SELECT * INTO v_res FROM league_division_changes_send(v_org, v_season, v_div, NULL, v_ids, ARRAY[v_g2]);
  IF v_res.refusal IS DISTINCT FROM 'already' OR v_res.sent_at IS NULL THEN RAISE EXCEPTION 'FAIL T6e: a second press got %', v_res.refusal; END IF;
  SELECT * INTO v_res FROM league_division_changes_send(v_org, v_season, v_div, NULL, ARRAY[]::uuid[], ARRAY[]::uuid[]);
  IF v_res.refusal IS DISTINCT FROM 'nothing' THEN RAISE EXCEPTION 'FAIL T6f: nothing held got %', v_res.refusal; END IF;

  -- T7 · An urgent cancel sends one game's rows; the rest stay held. Net-nothing sends no notice.
  UPDATE league_games SET location = 'Park C' WHERE id = v_g1;
  UPDATE league_games SET status = 'cancelled' WHERE id = v_g2;
  SELECT array_agg(id) INTO v_ids FROM league_game_changes WHERE game_id = v_g2 AND sent_at IS NULL;
  SELECT * INTO v_res FROM league_division_changes_send(v_org, v_season, v_div, NULL, v_ids, ARRAY[v_g2]);
  IF v_res.refusal IS NOT NULL THEN RAISE EXCEPTION 'FAIL T7a: urgent send got %', v_res.refusal; END IF;
  IF NOT EXISTS (SELECT 1 FROM league_game_changes WHERE game_id = v_g1 AND sent_at IS NULL) THEN RAISE EXCEPTION 'FAIL T7b: the other change went'; END IF;
  UPDATE league_games SET location = 'Park A' WHERE id = v_g1;
  SELECT array_agg(id) INTO v_ids FROM league_game_changes WHERE game_id = v_g1 AND sent_at IS NULL;
  SELECT * INTO v_res FROM league_division_changes_send(v_org, v_season, v_div, NULL, v_ids, ARRAY[]::uuid[]);
  IF v_res.refusal IS NOT NULL OR v_res.notice IS NOT NULL OR v_res.families <> 0 THEN RAISE EXCEPTION 'FAIL T7c: a net-nothing send emailed'; END IF;

  -- T8 · The club's time move re-keys a use; the link follows (ON UPDATE CASCADE) and records nothing on its own.
  IF NOT EXISTS (SELECT 1 FROM information_schema.referential_constraints rc
                  JOIN information_schema.key_column_usage k ON k.constraint_name = rc.constraint_name
                 WHERE k.table_name = 'league_games' AND k.column_name = 'slot_use_id'
                   AND rc.update_rule = 'CASCADE' AND rc.delete_rule = 'SET NULL') THEN
    RAISE EXCEPTION 'FAIL T8: slot_use_id does not cascade on update and set null on delete'; END IF;

  -- T9 · Service role only.
  IF has_function_privilege('authenticated', 'public.league_division_changes_send(uuid, uuid, uuid, uuid, uuid[], uuid[])', 'EXECUTE')
     OR has_table_privilege('anon', 'public.league_game_changes', 'SELECT') THEN RAISE EXCEPTION 'FAIL T9: not service-role only'; END IF;

  RAISE EXCEPTION 'HOUSE_LEAGUE_SCHEDULE_PASSED';
END $hlsched$;
