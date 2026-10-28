-- House League Stage 9d-2b Part 6 (mig 412): a season's schedule rules are kept. Rolled back; run on dev with
--   node scripts/db-query.mjs --dev -f scripts/house-league-9d2b-part6-check.sql
-- Each T row is 'pass' or says what it found.
BEGIN;
CREATE TEMP TABLE r(t text, result text) ON COMMIT DROP;
DO $$
DECLARE v_org uuid; v_season uuid; v_a uuid; v_b uuid; v_other uuid; v_x text; v_n smallint; v_t smallint; v_w boolean;
BEGIN
  SELECT s.org_id, s.id INTO v_org, v_season FROM league_seasons s
   WHERE s.status NOT IN ('completed', 'archived') AND (SELECT count(*) FROM league_divisions d WHERE d.season_id = s.id) >= 2 LIMIT 1;
  SELECT id INTO v_a FROM league_divisions WHERE season_id = v_season ORDER BY sort_order, id LIMIT 1;
  SELECT id INTO v_b FROM league_divisions WHERE season_id = v_season ORDER BY sort_order, id OFFSET 1 LIMIT 1;
  SELECT id INTO v_other FROM league_divisions WHERE season_id <> v_season LIMIT 1;

  -- T1 defaults: every season reads as 9d-2a assumed.
  INSERT INTO r VALUES ('T1 defaults', CASE WHEN (SELECT count(*) FROM league_seasons WHERE twice_in_a_day_allowed OR home_away_tolerance <> 1) = 0
    AND (SELECT count(*) FROM league_divisions WHERE games_per_team IS NOT NULL) = 0 THEN 'pass' ELSE 'a season or division is not on the defaults' END);

  -- T2 saves all three.
  v_x := league_season_rules_save(v_org, v_season, true, 2, jsonb_build_array(jsonb_build_object('division', v_a, 'games', 10), jsonb_build_object('division', v_b, 'games', null)));
  SELECT twice_in_a_day_allowed, home_away_tolerance INTO v_w, v_t FROM league_seasons WHERE id = v_season;
  SELECT games_per_team INTO v_n FROM league_divisions WHERE id = v_a;
  INSERT INTO r VALUES ('T2 saves', CASE WHEN v_x IS NULL AND v_w AND v_t = 2 AND v_n = 10 AND (SELECT games_per_team FROM league_divisions WHERE id = v_b) IS NULL THEN 'pass' ELSE format('%s %s %s %s', v_x, v_w, v_t, v_n) END);

  -- T3 a foreign division undoes the whole save (A stays 10, the season stays 2).
  v_x := league_season_rules_save(v_org, v_season, false, 3, jsonb_build_array(jsonb_build_object('division', v_a, 'games', 4), jsonb_build_object('division', v_other, 'games', 5)));
  SELECT home_away_tolerance INTO v_t FROM league_seasons WHERE id = v_season;
  SELECT games_per_team INTO v_n FROM league_divisions WHERE id = v_a;
  INSERT INTO r VALUES ('T3 foreign division', CASE WHEN v_x = 'division' AND v_t = 2 AND v_n = 10 THEN 'pass' ELSE format('%s %s %s', v_x, v_t, v_n) END);

  -- T4 out-of-range counts are refused, nothing written.
  v_x := league_season_rules_save(v_org, v_season, false, 1, jsonb_build_array(jsonb_build_object('division', v_a, 'games', 0)));
  INSERT INTO r VALUES ('T4 games 0', CASE WHEN v_x = 'invalid' AND (SELECT games_per_team FROM league_divisions WHERE id = v_a) = 10 THEN 'pass' ELSE coalesce(v_x, 'saved') END);
  v_x := league_season_rules_save(v_org, v_season, false, 10, '[]'::jsonb);
  INSERT INTO r VALUES ('T4 tolerance 10', CASE WHEN v_x = 'invalid' THEN 'pass' ELSE coalesce(v_x, 'saved') END);

  -- T5 a finished season is refused.
  UPDATE league_seasons SET status = 'completed' WHERE id = v_season;
  v_x := league_season_rules_save(v_org, v_season, false, 1, '[]'::jsonb);
  INSERT INTO r VALUES ('T5 finished', CASE WHEN v_x = 'finished' THEN 'pass' ELSE coalesce(v_x, 'saved') END);

  -- T6 another club's season is not found.
  BEGIN
    PERFORM league_season_rules_save(gen_random_uuid(), v_season, false, 1, '[]'::jsonb);
    INSERT INTO r VALUES ('T6 other club', 'saved');
  EXCEPTION WHEN raise_exception THEN INSERT INTO r VALUES ('T6 other club', CASE WHEN SQLERRM = 'Season not found' THEN 'pass' ELSE SQLERRM END);
  END;
END $$;
SELECT * FROM r;
ROLLBACK;
