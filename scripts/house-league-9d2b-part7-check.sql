-- House League Stage 9d-2b Part 7 (mig 413): Undo puts a game back on its time, and the rules save takes a lock that lets
-- Publish through. Rolled back; run on dev with
--   node scripts/db-query.mjs --dev -f scripts/house-league-9d2b-part7-check.sql
-- Each T row is 'pass' or says what it found.
BEGIN;
CREATE TEMP TABLE r(t text, result text) ON COMMIT DROP;
DO $$
DECLARE v_g league_games%ROWTYPE; v_use uuid; v_x text; v_slot uuid; v_def text;
BEGIN
  SELECT g.* INTO v_g FROM league_games g JOIN league_divisions d ON d.id = g.division_id
   WHERE d.schedule_published_at IS NOT NULL AND g.status = 'scheduled' AND g.scheduled_at IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM league_game_changes c WHERE c.game_id = g.id AND c.sent_at IS NULL) LIMIT 1;
  SELECT u.slot_id INTO v_use FROM league_slot_uses u LIMIT 1;
  IF v_g.id IS NULL OR v_use IS NULL THEN INSERT INTO r VALUES ('setup', 'no published dev game or slot use to test with'); RETURN; END IF;

  -- T1 the snapshot names the link.
  UPDATE league_games SET slot_use_id = v_use WHERE id = v_g.id;
  INSERT INTO r VALUES ('T1 snapshot', CASE WHEN jsonb_exists(league_game_snapshot((SELECT g FROM league_games g WHERE g.id = v_g.id)), 'slotUseId') THEN 'pass' ELSE 'no slotUseId' END);

  -- T2 a move off the time, then Undo: the link comes back with the date.
  UPDATE league_games SET scheduled_at = scheduled_at + interval '1 day', slot_use_id = NULL WHERE id = v_g.id;
  v_x := league_game_undo(v_g.org_id, v_g.season_id, v_g.id);
  SELECT slot_use_id INTO v_slot FROM league_games WHERE id = v_g.id;
  INSERT INTO r VALUES ('T2 undo restores the link', CASE WHEN v_x IS NULL AND v_slot = v_use
    AND (SELECT scheduled_at FROM league_games WHERE id = v_g.id) = v_g.scheduled_at THEN 'pass' ELSE format('%s %s', v_x, v_slot) END);

  -- T3 a change recorded before this migration has no key: Undo leaves the link alone.
  UPDATE league_games SET scheduled_at = scheduled_at + interval '1 day' WHERE id = v_g.id;
  UPDATE league_game_changes SET before = before - 'slotUseId' WHERE game_id = v_g.id AND sent_at IS NULL;
  UPDATE league_games SET slot_use_id = NULL WHERE id = v_g.id;
  v_x := league_game_undo(v_g.org_id, v_g.season_id, v_g.id);
  SELECT slot_use_id INTO v_slot FROM league_games WHERE id = v_g.id;
  INSERT INTO r VALUES ('T3 old row leaves the link', CASE WHEN v_x IS NULL AND v_slot IS NULL THEN 'pass' ELSE format('%s %s', v_x, v_slot) END);

  -- T4 a played game is not put back.
  UPDATE league_games SET scheduled_at = scheduled_at + interval '1 day' WHERE id = v_g.id;
  UPDATE league_games SET status = 'completed', home_score = 1, away_score = 0 WHERE id = v_g.id;
  v_x := league_game_undo(v_g.org_id, v_g.season_id, v_g.id);
  INSERT INTO r VALUES ('T4 played', CASE WHEN v_x = 'played' THEN 'pass' ELSE coalesce(v_x, 'undone') END);

  -- T5 the rules save locks the season without blocking key-share readers.
  v_def := pg_get_functiondef('public.league_season_rules_save(uuid,uuid,boolean,integer,jsonb)'::regprocedure);
  INSERT INTO r VALUES ('T5 lock', CASE WHEN v_def LIKE '%FOR NO KEY UPDATE%' AND v_def NOT LIKE '%FOR UPDATE;%' THEN 'pass' ELSE 'still FOR UPDATE' END);
END $$;
SELECT * FROM r;
ROLLBACK;
