-- House League Stage 9e-2 Part 1 (mig 427): the Rainout press and Put all back. Rolled back; run on dev with
--   node scripts/db-query.mjs --dev -f scripts/house-league-9e2-rainout-check.sql
-- Each T row is 'pass' or says what it found. Dev has few published games, so the fixture publishes two divisions of one
-- active season inside the transaction (rolled back with everything else).
BEGIN;
CREATE TEMP TABLE r(t text, result text) ON COMMIT DROP;
DO $$
DECLARE v_season uuid; v_org uuid; v_d1 uuid; v_d2 uuid; v_g1 uuid; v_g2 uuid; v_g3 uuid; v_day date := current_date;
        v_ref text; v_rain uuid; v_x text; v_n integer; v_games jsonb; v_moved timestamptz; v_line text;
BEGIN
  -- Two divisions of one active season, each with a scheduled game.
  SELECT d1.season_id, d1.id, d2.id INTO v_season, v_d1, v_d2
    FROM league_divisions d1 JOIN league_divisions d2 ON d2.season_id = d1.season_id AND d2.id > d1.id
    JOIN league_seasons s ON s.id = d1.season_id AND s.status NOT IN ('completed', 'archived')
   WHERE EXISTS (SELECT 1 FROM league_games g WHERE g.division_id = d1.id AND g.status = 'scheduled')
     AND EXISTS (SELECT 1 FROM league_games g WHERE g.division_id = d2.id AND g.status = 'scheduled')
     AND (SELECT count(*) FROM league_games g WHERE g.division_id = d1.id AND g.status = 'scheduled') >= 2
   LIMIT 1;
  IF v_season IS NULL THEN INSERT INTO r VALUES ('setup', 'no season with two divisions of scheduled games'); RETURN; END IF;
  SELECT org_id INTO v_org FROM league_seasons WHERE id = v_season;
  SELECT id INTO v_g1 FROM league_games WHERE division_id = v_d1 AND status = 'scheduled' ORDER BY id LIMIT 1;
  SELECT id INTO v_g3 FROM league_games WHERE division_id = v_d1 AND status = 'scheduled' AND id <> v_g1 ORDER BY id LIMIT 1;
  SELECT id INTO v_g2 FROM league_games WHERE division_id = v_d2 AND status = 'scheduled' ORDER BY id LIMIT 1;
  DELETE FROM league_game_changes WHERE game_id IN (v_g1, v_g2, v_g3);
  -- All three on the fixture day, 6:00 p.m. in the org's zone (the press checks each game is on the record's day).
  UPDATE league_games SET scheduled_at = (v_day + time '18:00') AT TIME ZONE 'America/Toronto' WHERE id IN (v_g1, v_g2, v_g3);

  -- T1 a draft division's game is refused, nothing written.
  UPDATE league_divisions SET schedule_published_at = now() WHERE id = v_d1;
  UPDATE league_divisions SET schedule_published_at = NULL WHERE id = v_d2;
  SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', g.updated_at)) INTO v_games FROM league_games g WHERE g.id IN (v_g1, v_g2);
  SELECT p.refusal INTO v_ref FROM league_rainout_press(v_org, v_season, NULL, v_day, 'postponed', NULL, v_games) p;
  INSERT INTO r VALUES ('T1 draft refused', CASE WHEN v_ref = 'draft'
    AND NOT EXISTS (SELECT 1 FROM league_games WHERE id IN (v_g1, v_g2) AND status <> 'scheduled') THEN 'pass' ELSE coalesce(v_ref, 'null') END);
  UPDATE league_divisions SET schedule_published_at = now() WHERE id = v_d2;

  -- T2 a game the window saw at another moment: changed, nothing written.
  SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', CASE WHEN g.id = v_g2 THEN g.updated_at - interval '1 second' ELSE g.updated_at END))
    INTO v_games FROM league_games g WHERE g.id IN (v_g1, v_g2);
  SELECT p.refusal INTO v_ref FROM league_rainout_press(v_org, v_season, NULL, v_day, 'postponed', NULL, v_games) p;
  INSERT INTO r VALUES ('T2 stale refused', CASE WHEN v_ref = 'changed'
    AND NOT EXISTS (SELECT 1 FROM league_game_changes WHERE game_id IN (v_g1, v_g2)) THEN 'pass' ELSE coalesce(v_ref, 'null') END);

  -- T3 the line's limit, and a bad verb.
  SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', g.updated_at)) INTO v_games FROM league_games g WHERE g.id IN (v_g1, v_g2);
  SELECT p.refusal INTO v_ref FROM league_rainout_press(v_org, v_season, NULL, v_day, 'postponed', repeat('x', 121), v_games) p;
  SELECT p.refusal INTO v_x FROM league_rainout_press(v_org, v_season, NULL, v_day, 'moved', NULL, v_games) p;
  INSERT INTO r VALUES ('T3 invalid', CASE WHEN v_ref = 'invalid' AND v_x = 'invalid' THEN 'pass' ELSE format('%s %s', v_ref, v_x) END);

  -- T4 the press across two divisions: both postponed, one held row each, the record keeps the trimmed line.
  SELECT p.refusal, p.rainout INTO v_ref, v_rain
    FROM league_rainout_press(v_org, v_season, NULL, v_day, 'postponed', '  Rain: the fields are closed tonight.  ', v_games) p;
  SELECT count(*) INTO v_n FROM league_game_changes WHERE game_id IN (v_g1, v_g2) AND sent_at IS NULL AND kind = 'postponed' AND source = 'league';
  SELECT line INTO v_line FROM league_rainouts WHERE id = v_rain;
  INSERT INTO r VALUES ('T4 press', CASE WHEN v_ref IS NULL AND v_n = 2
    AND (SELECT count(*) FROM league_games WHERE id IN (v_g1, v_g2) AND status = 'postponed') = 2
    AND v_line = 'Rain: the fields are closed tonight.'
    AND (SELECT cardinality(division_ids) FROM league_rainouts WHERE id = v_rain) = 2 THEN 'pass' ELSE format('%s %s %s', v_ref, v_n, v_line) END);

  -- T5 the banner lists it; a second press on the same games is refused (no longer to play).
  SELECT p.refusal INTO v_x FROM league_rainout_press(v_org, v_season, NULL, v_day, 'postponed', NULL,
    (SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', g.updated_at)) FROM league_games g WHERE g.id IN (v_g1, v_g2))) p;
  INSERT INTO r VALUES ('T5 waiting + no second press', CASE WHEN EXISTS (SELECT 1 FROM league_rainouts_waiting(v_org, v_season) w WHERE w.id = v_rain AND w.games = 2 AND cardinality(w.division_ids) = 2)
    AND EXISTS (SELECT 1 FROM league_rainouts_waiting(v_org, v_season, v_d1) w WHERE w.id = v_rain)
    AND v_x = 'changed' THEN 'pass' ELSE coalesce(v_x, 'null') END);

  -- T6 Put all back: both scheduled, no held rows, stamped, the banner empty; pressing again is harmless.
  v_x := league_rainout_put_back(v_org, v_season, v_rain, NULL);
  INSERT INTO r VALUES ('T6 put back', CASE WHEN v_x IS NULL
    AND (SELECT count(*) FROM league_games WHERE id IN (v_g1, v_g2) AND status = 'scheduled') = 2
    AND NOT EXISTS (SELECT 1 FROM league_game_changes WHERE game_id IN (v_g1, v_g2))
    AND (SELECT put_back_at FROM league_rainouts WHERE id = v_rain) IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM league_rainouts_waiting(v_org, v_season) w WHERE w.id = v_rain)
    AND league_rainout_put_back(v_org, v_season, v_rain, NULL) IS NULL THEN 'pass' ELSE coalesce(v_x, 'null') END);

  -- T7 a game changed after the rainout (a later held change): nothing is put back, and the banner drops it.
  SELECT p.rainout INTO v_rain FROM league_rainout_press(v_org, v_season, NULL, v_day, 'cancelled', NULL,
    (SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', g.updated_at)) FROM league_games g WHERE g.id IN (v_g1, v_g2))) p;
  UPDATE league_games SET location = coalesce(location, '') || ' (moved)' WHERE id = v_g2;
  v_x := league_rainout_put_back(v_org, v_season, v_rain, NULL);
  INSERT INTO r VALUES ('T7 refused after a later change', CASE WHEN v_x = 'refused'
    AND (SELECT count(*) FROM league_games WHERE id IN (v_g1, v_g2) AND status = 'cancelled') = 2
    AND NOT EXISTS (SELECT 1 FROM league_rainouts_waiting(v_org, v_season) w WHERE w.id = v_rain) THEN 'pass' ELSE coalesce(v_x, 'null') END);

  -- T8 one change undone on its own (Changes to send): refused.
  PERFORM league_game_undo(v_org, v_season, v_g2);
  PERFORM league_game_undo(v_org, v_season, v_g1);
  SELECT p.rainout INTO v_rain FROM league_rainout_press(v_org, v_season, NULL, v_day, 'postponed', NULL,
    (SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', g.updated_at)) FROM league_games g WHERE g.id IN (v_g1, v_g2))) p;
  PERFORM league_game_undo(v_org, v_season, v_g1);
  v_x := league_rainout_put_back(v_org, v_season, v_rain, NULL);
  INSERT INTO r VALUES ('T8 refused after an undo', CASE WHEN v_x = 'refused'
    AND (SELECT status FROM league_games WHERE id = v_g2) = 'postponed' THEN 'pass' ELSE coalesce(v_x, 'null') END);
  PERFORM league_game_undo(v_org, v_season, v_g2);

  -- T9 a change sent: gone.
  SELECT p.rainout INTO v_rain FROM league_rainout_press(v_org, v_season, NULL, v_day, 'postponed', NULL,
    (SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', g.updated_at)) FROM league_games g WHERE g.id IN (v_g1, v_g2))) p;
  UPDATE league_game_changes SET sent_at = now() WHERE game_id = v_g2 AND sent_at IS NULL;
  v_x := league_rainout_put_back(v_org, v_season, v_rain, NULL);
  INSERT INTO r VALUES ('T9 gone after a send', CASE WHEN v_x = 'gone' THEN 'pass' ELSE coalesce(v_x, 'null') END);
  PERFORM league_game_undo(v_org, v_season, v_g1);
  UPDATE league_games SET status = 'scheduled' WHERE id = v_g2;
  DELETE FROM league_game_changes WHERE game_id IN (v_g1, v_g2, v_g3);

  -- T10 an older held change survives Put all back (a move made before the rain, not yet sent).
  UPDATE league_games SET scheduled_at = scheduled_at + interval '1 day' WHERE id = v_g3;
  SELECT moved_from INTO v_moved FROM league_games WHERE id = v_g3;
  -- T14 a game on another day than the record's: changed, nothing written.
  SELECT p.refusal INTO v_ref FROM league_rainout_press(v_org, v_season, NULL, v_day, 'postponed', NULL,
    (SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', g.updated_at)) FROM league_games g WHERE g.id = v_g3)) p;
  INSERT INTO r VALUES ('T14 another day refused', CASE WHEN v_ref = 'changed' THEN 'pass' ELSE coalesce(v_ref, 'null') END);
  SELECT p.rainout INTO v_rain FROM league_rainout_press(v_org, v_season, NULL, v_day + 1, 'postponed', NULL,
    (SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', g.updated_at)) FROM league_games g WHERE g.id = v_g3)) p;
  v_x := league_rainout_put_back(v_org, v_season, v_rain, NULL);
  INSERT INTO r VALUES ('T10 older change kept', CASE WHEN v_x IS NULL
    AND (SELECT status FROM league_games WHERE id = v_g3) = 'scheduled'
    AND (SELECT moved_from FROM league_games WHERE id = v_g3) IS NOT DISTINCT FROM v_moved AND v_moved IS NOT NULL
    AND (SELECT count(*) FROM league_game_changes WHERE game_id = v_g3 AND sent_at IS NULL) = 1
    AND (SELECT kind FROM league_game_changes WHERE game_id = v_g3 AND sent_at IS NULL) = 'moved' THEN 'pass' ELSE coalesce(v_x, 'null') END);

  -- T11 a game from another season is not found.
  SELECT p.refusal INTO v_ref FROM league_rainout_press(v_org, v_season, NULL, v_day, 'postponed', NULL,
    (SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', g.updated_at)) FROM league_games g WHERE g.season_id <> v_season LIMIT 1)) p;
  INSERT INTO r VALUES ('T11 other season', CASE WHEN v_ref = 'not_found' OR NOT EXISTS (SELECT 1 FROM league_games WHERE season_id <> v_season)
    THEN 'pass' ELSE coalesce(v_ref, 'null') END);

  -- T13 the line is found through the change rows: while held (Changes to send's preview), and after a later send through
  -- the notice that sent them (the read lib/league-rainout-server.ts makes), every time it is asked.
  DECLARE v_notice uuid; v_held text; v_sent1 text; v_sent2 text;
  BEGIN
    SELECT p.rainout INTO v_rain FROM league_rainout_press(v_org, v_season, NULL, v_day, 'postponed', 'Fields closed.',
      (SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', g.updated_at)) FROM league_games g WHERE g.id = v_g2)) p;
    SELECT r2.line INTO v_held FROM league_rainouts r2
     WHERE r2.change_ids && (SELECT array_agg(c.id) FROM league_game_changes c WHERE c.game_id = v_g2 AND c.sent_at IS NULL)
       AND r2.line IS NOT NULL AND r2.put_back_at IS NULL;
    INSERT INTO league_season_notices(org_id, season_id, division_id, kind, family_count)
    VALUES (v_org, v_season, v_d2, 'games_changed', 1) RETURNING id INTO v_notice;
    UPDATE league_game_changes SET sent_at = now(), notice_id = v_notice WHERE game_id = v_g2 AND sent_at IS NULL;
    SELECT r2.line INTO v_sent1 FROM league_rainouts r2
     WHERE r2.change_ids && (SELECT array_agg(c.id) FROM league_game_changes c WHERE c.notice_id = v_notice) AND r2.line IS NOT NULL AND r2.put_back_at IS NULL;
    SELECT r2.line INTO v_sent2 FROM league_rainouts r2
     WHERE r2.change_ids && (SELECT array_agg(c.id) FROM league_game_changes c WHERE c.notice_id = v_notice) AND r2.line IS NOT NULL AND r2.put_back_at IS NULL;
    INSERT INTO r VALUES ('T13 line at send time', CASE WHEN v_held = 'Fields closed.' AND v_sent1 = 'Fields closed.' AND v_sent2 = v_sent1
      AND league_rainout_put_back(v_org, v_season, v_rain, NULL) = 'gone' THEN 'pass' ELSE format('%s %s %s', v_held, v_sent1, v_sent2) END);
  END;

  -- T12 a played game is refused.
  UPDATE league_games SET status = 'completed', home_score = 1, away_score = 0 WHERE id = v_g1;
  SELECT p.refusal INTO v_ref FROM league_rainout_press(v_org, v_season, NULL, v_day, 'postponed', NULL,
    (SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', g.updated_at)) FROM league_games g WHERE g.id = v_g1)) p;
  INSERT INTO r VALUES ('T12 played refused', CASE WHEN v_ref = 'changed' THEN 'pass' ELSE coalesce(v_ref, 'null') END);
END $$;
SELECT * FROM r;
ROLLBACK;
