-- House League Stage 9e-3 Part 1 (mig 428): the coach's score, the report, the club's Keep and write. Rolled back; run on
-- dev with
--   node scripts/db-query.mjs --dev -f scripts/house-league-9e3-scores-check.sql
-- Each T row is 'pass' or says what it found. The fixture publishes one division of an active season, makes three of its
-- games the Reds (home) v the Blues (away), and gives each team a coach, all inside the transaction.
BEGIN;
CREATE TEMP TABLE r(t text, result text) ON COMMIT DROP;
DO $$
DECLARE v_season uuid; v_org uuid; v_div uuid; v_home uuid; v_away uuid; v_g1 uuid; v_g2 uuid; v_g3 uuid;
        v_hu uuid; v_au uuid; v_staff uuid; v_ref text; v_seen timestamptz; v_rec league_game_scores%ROWTYPE;
        v_g league_games%ROWTYPE; v_n integer;
BEGIN
  SELECT d.season_id, d.id INTO v_season, v_div
    FROM league_divisions d JOIN league_seasons s ON s.id = d.season_id AND s.status NOT IN ('completed', 'archived')
   WHERE (SELECT count(*) FROM league_games g WHERE g.division_id = d.id) >= 3
     AND (SELECT count(*) FROM league_teams t WHERE t.division_id = d.id) >= 2
   LIMIT 1;
  IF v_season IS NULL THEN INSERT INTO r VALUES ('setup', 'no division with 3 games and 2 teams'); RETURN; END IF;
  SELECT org_id INTO v_org FROM league_seasons WHERE id = v_season;
  SELECT id INTO v_home FROM league_teams WHERE division_id = v_div ORDER BY id LIMIT 1;
  SELECT id INTO v_away FROM league_teams WHERE division_id = v_div AND id <> v_home ORDER BY id LIMIT 1;
  SELECT id INTO v_g1 FROM league_games WHERE division_id = v_div ORDER BY id LIMIT 1;
  SELECT id INTO v_g2 FROM league_games WHERE division_id = v_div AND id <> v_g1 ORDER BY id LIMIT 1;
  SELECT id INTO v_g3 FROM league_games WHERE division_id = v_div AND id NOT IN (v_g1, v_g2) ORDER BY id LIMIT 1;
  SELECT id INTO v_hu FROM auth.users ORDER BY id LIMIT 1;
  SELECT id INTO v_au FROM auth.users WHERE id <> v_hu ORDER BY id LIMIT 1;
  SELECT id INTO v_staff FROM auth.users WHERE id NOT IN (v_hu, v_au) ORDER BY id LIMIT 1;

  UPDATE league_divisions SET schedule_published_at = now() WHERE id = v_div;
  DELETE FROM league_game_scores WHERE game_id IN (v_g1, v_g2, v_g3);
  -- g1 started an hour ago, g2 tomorrow, g3 yesterday; all on, no score, Reds v Blues.
  UPDATE league_games SET home_team_id = v_home, away_team_id = v_away, status = 'scheduled', home_score = NULL, away_score = NULL,
         scheduled_at = now() - interval '1 hour' WHERE id = v_g1;
  UPDATE league_games SET home_team_id = v_home, away_team_id = v_away, status = 'scheduled', home_score = NULL, away_score = NULL,
         scheduled_at = now() + interval '1 day' WHERE id = v_g2;
  UPDATE league_games SET home_team_id = v_home, away_team_id = v_away, status = 'scheduled', home_score = NULL, away_score = NULL,
         scheduled_at = now() - interval '1 day' WHERE id = v_g3;
  DELETE FROM league_team_coaches WHERE team_id IN (v_home, v_away) AND user_id IN (v_hu, v_au);
  INSERT INTO league_team_coaches (org_id, season_id, team_id, name, email, user_id, accepted_at)
  VALUES (v_org, v_season, v_home, 'Morgan Reid', 'fixture-home@example.invalid', v_hu, now()),
         (v_org, v_season, v_away, 'Sam Blake', 'fixture-away@example.invalid', v_au, now());

  -- T1 the away coach can't enter.
  SELECT updated_at INTO v_seen FROM league_games WHERE id = v_g1;
  v_ref := league_game_coach_score(v_org, v_g1, v_away, v_au, 'Sam Blake', 7, 4, v_seen);
  INSERT INTO r VALUES ('T1 away refused', CASE WHEN v_ref = 'notHome' THEN 'pass' ELSE coalesce(v_ref, 'null') END);

  -- T2 before the start time.
  SELECT updated_at INTO v_seen FROM league_games WHERE id = v_g2;
  v_ref := league_game_coach_score(v_org, v_g2, v_home, v_hu, 'Morgan Reid', 7, 4, v_seen);
  INSERT INTO r VALUES ('T2 not started', CASE WHEN v_ref = 'notStarted' THEN 'pass' ELSE coalesce(v_ref, 'null') END);

  -- T3 a stale window.
  v_ref := league_game_coach_score(v_org, v_g1, v_home, v_hu, 'Morgan Reid', 7, 4, now() - interval '1 year');
  INSERT INTO r VALUES ('T3 stale', CASE WHEN v_ref = 'changed' THEN 'pass' ELSE coalesce(v_ref, 'null') END);

  -- T4 the home coach enters: completed, the record, no change row (a score is never a held change). (A moved updated_at
  -- can't be told apart inside one transaction, where now() stands still; the route tests cover it.)
  SELECT updated_at INTO v_seen FROM league_games WHERE id = v_g1;
  SELECT count(*) INTO v_n FROM league_game_changes WHERE game_id = v_g1;
  v_ref := league_game_coach_score(v_org, v_g1, v_home, v_hu, 'Morgan Reid', 7, 4, v_seen);
  SELECT * INTO v_g FROM league_games WHERE id = v_g1;
  SELECT * INTO v_rec FROM league_game_scores WHERE game_id = v_g1;
  INSERT INTO r VALUES ('T4 home enters', CASE WHEN v_ref IS NULL AND v_g.status = 'completed' AND v_g.home_score = 7 AND v_g.away_score = 4
    AND v_rec.entered_side = 'coach' AND v_rec.entered_by = v_hu AND v_rec.entered_by_name = 'Morgan Reid' AND v_rec.entered_for_team = v_home
    AND (SELECT count(*) FROM league_game_changes WHERE game_id = v_g1) = v_n
    THEN 'pass' ELSE format('%s %s %s', v_ref, v_g.status, v_rec.entered_side) END);

  -- T5 they change it while unreported.
  v_ref := league_game_coach_score(v_org, v_g1, v_home, v_hu, 'Morgan Reid', 8, 4, v_g.updated_at);
  SELECT * INTO v_g FROM league_games WHERE id = v_g1;
  INSERT INTO r VALUES ('T5 home changes', CASE WHEN v_ref IS NULL AND v_g.home_score = 8 THEN 'pass' ELSE coalesce(v_ref, 'null') END);

  -- T6 the home coach can't report their own; the away coach reports; then the home coach can't change it.
  v_ref := league_game_score_report(v_org, v_g1, v_home, v_hu, 'Morgan Reid', NULL, v_g.updated_at);
  INSERT INTO r VALUES ('T6a home report refused', CASE WHEN v_ref = 'notAway' THEN 'pass' ELSE coalesce(v_ref, 'null') END);
  -- The mark is backdated first: now() is frozen inside this transaction, so only an old mark can show that a report MOVES it
  -- (a window opened before the report must then refuse `changed`, so a Keep can't pass an unseen report).
  UPDATE league_games SET updated_at = now() - interval '1 hour' WHERE id = v_g1;
  SELECT * INTO v_g FROM league_games WHERE id = v_g1;
  v_ref := league_game_score_report(v_org, v_g1, v_away, v_au, 'Sam Blake', '  We had it 6–4.  ', v_g.updated_at);
  SELECT * INTO v_rec FROM league_game_scores WHERE game_id = v_g1;
  INSERT INTO r VALUES ('T6b away reports', CASE WHEN v_ref IS NULL AND v_rec.reported_by = v_au AND v_rec.report_note = 'We had it 6–4.'
    AND v_rec.reported_for_team = v_away AND (SELECT updated_at FROM league_games WHERE id = v_g1) > v_g.updated_at
    THEN 'pass' ELSE coalesce(v_ref, 'null') END);
  v_ref := league_game_score_keep(v_org, v_g1, v_staff, 'Sam Lee', v_g.updated_at);
  INSERT INTO r VALUES ('T6b2 keep from a window older than the report', CASE WHEN v_ref = 'changed' THEN 'pass' ELSE coalesce(v_ref, 'null') END);
  SELECT * INTO v_g FROM league_games WHERE id = v_g1;
  v_ref := league_game_coach_score(v_org, v_g1, v_home, v_hu, 'Morgan Reid', 9, 4, v_g.updated_at);
  INSERT INTO r VALUES ('T6c change after report', CASE WHEN v_ref = 'closed' THEN 'pass' ELSE coalesce(v_ref, 'null') END);
  v_ref := league_game_score_report(v_org, v_g1, v_away, v_au, 'Sam Blake', NULL, v_g.updated_at);
  INSERT INTO r VALUES ('T6d second report', CASE WHEN v_ref = 'closed' THEN 'pass' ELSE coalesce(v_ref, 'null') END);

  -- T7 the club corrects it: corrected stamp, entry and report kept.
  v_ref := league_game_club_write(v_org, v_g1, v_g.updated_at, jsonb_build_object('home_score', 6, 'away_score', 4, 'status', 'completed'), v_staff, 'Sam Lee');
  SELECT * INTO v_rec FROM league_game_scores WHERE game_id = v_g1;
  SELECT * INTO v_g FROM league_games WHERE id = v_g1;
  INSERT INTO r VALUES ('T7 club corrects', CASE WHEN v_ref IS NULL AND v_g.home_score = 6 AND v_rec.corrected_by = v_staff
    AND v_rec.corrected_by_name = 'Sam Lee' AND v_rec.entered_by = v_hu AND v_rec.reported_by = v_au THEN 'pass' ELSE coalesce(v_ref, 'null') END);

  -- T8 g3 (yesterday): entered, the club keeps it, then the coach can't change it; Keep again is a no-op.
  SELECT updated_at INTO v_seen FROM league_games WHERE id = v_g3;
  v_ref := league_game_coach_score(v_org, v_g3, v_home, v_hu, 'Morgan Reid', 5, 5, v_seen);
  SELECT updated_at INTO v_seen FROM league_games WHERE id = v_g3;
  v_ref := coalesce(v_ref, '') || coalesce(league_game_score_keep(v_org, v_g3, v_staff, 'Sam Lee', v_seen), '');
  v_ref := v_ref || coalesce(league_game_score_keep(v_org, v_g3, v_staff, 'Sam Lee', v_seen), '');
  SELECT * INTO v_rec FROM league_game_scores WHERE game_id = v_g3;
  INSERT INTO r VALUES ('T8a yesterday entered + kept', CASE WHEN v_ref = '' AND v_rec.checked_by = v_staff THEN 'pass' ELSE v_ref END);
  v_ref := league_game_coach_score(v_org, v_g3, v_home, v_hu, 'Morgan Reid', 6, 5, v_seen);
  INSERT INTO r VALUES ('T8b change after keep', CASE WHEN v_ref = 'closed' THEN 'pass' ELSE coalesce(v_ref, 'null') END);
  v_ref := league_game_score_report(v_org, v_g3, v_away, v_au, 'Sam Blake', NULL, v_seen);
  INSERT INTO r VALUES ('T8c report after keep', CASE WHEN v_ref = 'closed' THEN 'pass' ELSE coalesce(v_ref, 'null') END);

  -- T9 the club clears g3: back to scheduled, record gone, the coach may enter again.
  v_ref := league_game_club_write(v_org, v_g3, v_seen, jsonb_build_object('home_score', NULL, 'away_score', NULL, 'status', 'scheduled'), v_staff, 'Sam Lee');
  SELECT * INTO v_g FROM league_games WHERE id = v_g3;
  INSERT INTO r VALUES ('T9a club clears', CASE WHEN v_ref IS NULL AND v_g.status = 'scheduled' AND v_g.home_score IS NULL
    AND NOT EXISTS (SELECT 1 FROM league_game_scores WHERE game_id = v_g3) THEN 'pass' ELSE coalesce(v_ref, 'null') END);
  v_ref := league_game_coach_score(v_org, v_g3, v_home, v_hu, 'Morgan Reid', 3, 2, v_g.updated_at);
  INSERT INTO r VALUES ('T9b re-enter after clear', CASE WHEN v_ref IS NULL THEN 'pass' ELSE v_ref END);

  -- T10 the home coach clears both boxes: scheduled, record gone.
  SELECT updated_at INTO v_seen FROM league_games WHERE id = v_g3;
  v_ref := league_game_coach_score(v_org, v_g3, v_home, v_hu, 'Morgan Reid', NULL, NULL, v_seen);
  SELECT * INTO v_g FROM league_games WHERE id = v_g3;
  INSERT INTO r VALUES ('T10 coach clears', CASE WHEN v_ref IS NULL AND v_g.status = 'scheduled' AND v_g.home_score IS NULL
    AND NOT EXISTS (SELECT 1 FROM league_game_scores WHERE game_id = v_g3) THEN 'pass' ELSE coalesce(v_ref, 'null') END);

  -- T11 the club enters a score nobody had: club record; the coach is then closed.
  v_ref := league_game_club_write(v_org, v_g3, v_g.updated_at, jsonb_build_object('home_score', 2, 'away_score', 1, 'status', 'completed', 'notes', 'kept'), v_staff, 'Sam Lee');
  SELECT * INTO v_rec FROM league_game_scores WHERE game_id = v_g3;
  SELECT * INTO v_g FROM league_games WHERE id = v_g3;
  INSERT INTO r VALUES ('T11a club enters', CASE WHEN v_ref IS NULL AND v_rec.entered_side = 'club' AND v_rec.entered_for_team IS NULL
    AND v_g.notes = 'kept' THEN 'pass' ELSE coalesce(v_ref, 'null') END);
  v_ref := league_game_coach_score(v_org, v_g3, v_home, v_hu, 'Morgan Reid', 3, 1, v_g.updated_at);
  INSERT INTO r VALUES ('T11b coach after club', CASE WHEN v_ref = 'closed' THEN 'pass' ELSE coalesce(v_ref, 'null') END);
  v_ref := league_game_score_keep(v_org, v_g3, v_staff, 'Sam Lee', v_g.updated_at);
  INSERT INTO r VALUES ('T11c keep a club score', CASE WHEN v_ref = 'nothing' THEN 'pass' ELSE coalesce(v_ref, 'null') END);

  -- T12 a postponed game is refused.
  UPDATE league_games SET status = 'postponed' WHERE id = v_g2;
  UPDATE league_games SET scheduled_at = now() - interval '2 hours' WHERE id = v_g2;
  SELECT updated_at INTO v_seen FROM league_games WHERE id = v_g2;
  v_ref := league_game_coach_score(v_org, v_g2, v_home, v_hu, 'Morgan Reid', 1, 0, v_seen);
  INSERT INTO r VALUES ('T12 postponed', CASE WHEN v_ref = 'calledOff' THEN 'pass' ELSE coalesce(v_ref, 'null') END);

  -- T13 a coach of both teams: they enter as home and can't report their own.
  UPDATE league_games SET status = 'scheduled' WHERE id = v_g2;
  INSERT INTO league_team_coaches (org_id, season_id, team_id, name, email, user_id, accepted_at)
  VALUES (v_org, v_season, v_away, 'Morgan Reid', 'fixture-home2@example.invalid', v_hu, now());
  SELECT updated_at INTO v_seen FROM league_games WHERE id = v_g2;
  v_ref := coalesce(league_game_coach_score(v_org, v_g2, v_home, v_hu, 'Morgan Reid', 1, 0, v_seen), '');
  SELECT updated_at INTO v_seen FROM league_games WHERE id = v_g2;
  v_ref := v_ref || '|' || coalesce(league_game_score_report(v_org, v_g2, v_away, v_hu, 'Morgan Reid', NULL, v_seen), 'null');
  INSERT INTO r VALUES ('T13 both teams', CASE WHEN v_ref = '|own' THEN 'pass' ELSE v_ref END);

  -- T14 a removed coach loses entry; their entry keeps their name.
  UPDATE league_team_coaches SET removed_at = now() WHERE user_id = v_hu AND team_id = v_home;
  v_ref := league_game_coach_score(v_org, v_g2, v_home, v_hu, 'Morgan Reid', 2, 0, v_seen);
  INSERT INTO r VALUES ('T14 removed coach', CASE WHEN v_ref = 'gone'
    AND (SELECT entered_by_name FROM league_game_scores WHERE game_id = v_g2) = 'Morgan Reid' THEN 'pass' ELSE coalesce(v_ref, 'null') END);

  -- T15 a draft division and a finished season are refused.
  UPDATE league_team_coaches SET removed_at = NULL WHERE user_id = v_hu AND team_id = v_home;
  UPDATE league_divisions SET schedule_published_at = NULL WHERE id = v_div;
  v_ref := league_game_coach_score(v_org, v_g2, v_home, v_hu, 'Morgan Reid', 2, 0, v_seen);
  UPDATE league_divisions SET schedule_published_at = now() WHERE id = v_div;
  UPDATE league_seasons SET status = 'completed' WHERE id = v_season;
  v_ref := v_ref || '|' || coalesce(league_game_coach_score(v_org, v_g2, v_home, v_hu, 'Morgan Reid', 2, 0, v_seen), 'null');
  INSERT INTO r VALUES ('T15 draft + finished', CASE WHEN v_ref = 'notFound|finished' THEN 'pass' ELSE v_ref END);

  -- T16 one score alone raises.
  BEGIN
    v_ref := league_game_coach_score(v_org, v_g2, v_home, v_hu, 'Morgan Reid', 2, NULL, v_seen);
    INSERT INTO r VALUES ('T16 one score', 'no exception');
  EXCEPTION WHEN raise_exception THEN
    INSERT INTO r VALUES ('T16 one score', 'pass');
  END;
END $$;
SELECT * FROM r;
ROLLBACK;
