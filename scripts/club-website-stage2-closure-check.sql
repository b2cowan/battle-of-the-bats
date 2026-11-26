-- Club Website Stage 2, Session 2A (mig 539): Close a place — the press, "Link both", the retry, Reopen and the marks.
-- Rolled back; run on dev with
--   node scripts/db-query.mjs --dev -f scripts/club-website-stage2-closure-check.sql
-- Each T row is 'pass' or says what it found. The fixture is Kestrel Bay's (dev): its live season, its finished season
-- made live inside the transaction (so a press spans two seasons), one of its places, and two of its rep games — every
-- fixture edit is rolled back with everything else.
BEGIN;
CREATE TEMP TABLE r(t text, result text) ON COMMIT DROP;
DO $$
DECLARE
  v_org uuid; v_s1 uuid; v_s2 uuid; v_v uuid; v_vname text; v_other uuid; v_f uuid;
  v_a uuid; v_c uuid; v_b uuid; v_d uuid; v_r uuid; v_r2 uuid;
  v_day date := (now() AT TIME ZONE 'America/Toronto')::date + 1;
  v_key uuid := gen_random_uuid(); v_key2 uuid := gen_random_uuid();
  v_res record; v_res2 record; v_n integer; v_x text; v_places jsonb; v_league jsonb; v_rep jsonb; v_links jsonb;
  v_at10 timestamptz;
BEGIN
  SELECT id INTO v_org FROM organizations WHERE slug = 'kestrel-bay';
  IF v_org IS NULL THEN INSERT INTO r VALUES ('setup', 'no kestrel-bay on this database'); RETURN; END IF;
  SELECT s.id INTO v_s1 FROM league_seasons s WHERE s.org_id = v_org AND s.status NOT IN ('completed', 'archived', 'draft')
     AND (SELECT count(*) FROM league_games g WHERE g.season_id = s.id) >= 2 ORDER BY s.created_at LIMIT 1;
  SELECT s.id INTO v_s2 FROM league_seasons s WHERE s.org_id = v_org AND s.id <> v_s1
     AND (SELECT count(*) FROM league_games g WHERE g.season_id = s.id) >= 2 ORDER BY s.created_at LIMIT 1;
  SELECT v.id, v.name INTO v_v, v_vname FROM org_venues v WHERE v.org_id = v_org
     AND EXISTS (SELECT 1 FROM org_venue_facilities f WHERE f.org_venue_id = v.id) ORDER BY v.name LIMIT 1;
  SELECT f.id INTO v_f FROM org_venue_facilities f WHERE f.org_venue_id = v_v ORDER BY f.display_order, f.id LIMIT 1;
  SELECT v.id INTO v_other FROM org_venues v WHERE v.org_id = v_org AND v.id <> v_v
     AND position(lower(v_vname) IN lower(v.name)) = 0 ORDER BY v.name LIMIT 1;
  IF v_s1 IS NULL OR v_s2 IS NULL OR v_v IS NULL OR v_other IS NULL THEN
    INSERT INTO r VALUES ('setup', format('seasons %s %s, place %s, other %s', v_s1, v_s2, v_v, v_other)); RETURN;
  END IF;
  UPDATE league_seasons SET status = 'active' WHERE id = v_s2;

  SELECT id INTO v_a FROM league_games WHERE season_id = v_s1 ORDER BY id LIMIT 1;
  SELECT id INTO v_c FROM league_games WHERE season_id = v_s1 AND id <> v_a ORDER BY id LIMIT 1;
  SELECT id INTO v_b FROM league_games WHERE season_id = v_s2 ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM league_games WHERE season_id = v_s2 AND id <> v_b ORDER BY id LIMIT 1;
  SELECT id INTO v_r FROM rep_team_events WHERE org_id = v_org AND event_type = 'league_game' ORDER BY id LIMIT 1;
  SELECT id INTO v_r2 FROM rep_team_events WHERE org_id = v_org AND event_type = 'league_game' AND id <> v_r ORDER BY id LIMIT 1;
  IF v_r IS NULL OR v_r2 IS NULL THEN INSERT INTO r VALUES ('setup', 'Kestrel Bay has fewer than two rep games'); RETURN; END IF;

  -- Every fixture game to play on the fixture day at 10:00 a.m. (the club's zone), its division's schedule out.
  v_at10 := (v_day + time '10:00') AT TIME ZONE 'America/Toronto';
  UPDATE league_divisions SET schedule_published_at = coalesce(schedule_published_at, now())
   WHERE id IN (SELECT division_id FROM league_games WHERE id IN (v_a, v_b, v_c, v_d));
  UPDATE league_games SET status = 'scheduled', home_score = NULL, away_score = NULL, scheduled_at = v_at10, ends_at = NULL,
         org_venue_facility_id = NULL WHERE id IN (v_a, v_b, v_c, v_d);
  UPDATE league_games SET org_venue_id = v_v, location = NULL WHERE id = v_a;                       -- on the place
  UPDATE league_games SET org_venue_id = NULL, location = upper(v_vname) || ' — Diamond 2' WHERE id = v_b;  -- typed, upper case
  UPDATE league_games SET org_venue_id = NULL, location = lower(v_vname) || ' d9' WHERE id = v_c;   -- typed, lower case
  UPDATE league_games SET org_venue_id = v_other, location = NULL WHERE id = v_d;                   -- another place
  UPDATE rep_team_events SET status = 'scheduled', team_score = NULL, opponent_score = NULL, result = NULL,
         source_tournament_game_id = NULL, starts_at = v_at10 + interval '2 hours', org_venue_id = v_v,
         org_venue_facility_id = NULL WHERE id = v_r;
  UPDATE rep_team_events SET status = 'scheduled', team_score = NULL, opponent_score = NULL, result = NULL,
         source_tournament_game_id = NULL, starts_at = v_at10 + interval '3 hours', org_venue_id = NULL,
         org_venue_facility_id = NULL, place_id = NULL, location = v_vname || ' diamond 1 (turf)' WHERE id = v_r2;
  DELETE FROM league_game_changes WHERE game_id IN (v_a, v_b, v_c, v_d);
  DELETE FROM rep_event_closure_marks WHERE event_id IN (v_r, v_r2);

  v_places := jsonb_build_array(jsonb_build_object('venueId', v_v));

  -- T1 the request's shape: a bad verb, Until before the Day, more than 14 days, the Day before today.
  SELECT p.refusal INTO v_x FROM org_place_closure_press(v_org, NULL, gen_random_uuid(), v_places, v_day, v_day, 'moved', NULL, '[]', '[]', '[]') p;
  INSERT INTO r SELECT 'T1a bad verb', CASE WHEN v_x = 'invalid' THEN 'pass' ELSE coalesce(v_x, 'null') END;
  SELECT p.refusal INTO v_x FROM org_place_closure_press(v_org, NULL, gen_random_uuid(), v_places, v_day, v_day - 1, 'postponed', NULL, '[]', '[]', '[]') p;
  INSERT INTO r SELECT 'T1b until before day', CASE WHEN v_x = 'invalid' THEN 'pass' ELSE coalesce(v_x, 'null') END;
  SELECT p.refusal INTO v_x FROM org_place_closure_press(v_org, NULL, gen_random_uuid(), v_places, v_day, v_day + 14, 'postponed', NULL, '[]', '[]', '[]') p;
  INSERT INTO r SELECT 'T1c fifteen days', CASE WHEN v_x = 'invalid' THEN 'pass' ELSE coalesce(v_x, 'null') END;
  SELECT p.refusal INTO v_x FROM org_place_closure_press(v_org, NULL, gen_random_uuid(), v_places, v_day - 2, v_day - 2, 'postponed', NULL, '[]', '[]', '[]') p;
  INSERT INTO r SELECT 'T1d past', CASE WHEN v_x = 'past' THEN 'pass' ELSE coalesce(v_x, 'null') END;
  SELECT p.refusal INTO v_x FROM org_place_closure_press(v_org, NULL, gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('venueId', v_v), jsonb_build_object('venueId', v_v, 'facilityId', v_f)),
    v_day, v_day, 'postponed', NULL, '[]', '[]', '[]') p;
  INSERT INTO r SELECT 'T1e a place twice', CASE WHEN v_x = 'invalid' THEN 'pass' ELSE coalesce(v_x, 'null') END;

  -- T2 ALL OR NOTHING: season 1's game is fine; season 2's was edited since the window read it. Changed names only B, and
  -- nothing is written anywhere — not season 1's game, not the link, not the rep mark, not the closure.
  SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', CASE WHEN g.id = v_b THEN g.updated_at - interval '1 second' ELSE g.updated_at END))
    INTO v_league FROM league_games g WHERE g.id IN (v_a, v_b);
  SELECT jsonb_agg(jsonb_build_object('id', e.id, 'seen', e.updated_at)) INTO v_rep FROM rep_team_events e WHERE e.id = v_r;
  v_links := jsonb_build_array(jsonb_build_object('kind', 'league', 'id', v_c, 'venueId', v_v));
  SELECT * INTO v_res FROM org_place_closure_press(v_org, NULL, v_key, v_places, v_day, v_day, 'postponed', 'Rain.', v_league, v_rep, v_links) p;
  INSERT INTO r SELECT 'T2 second season refused, first untouched', CASE WHEN v_res.refusal = 'changed' AND v_res.changed = ARRAY[v_b]
    AND (SELECT count(*) FROM league_games WHERE id IN (v_a, v_b) AND status = 'scheduled') = 2
    AND (SELECT org_venue_id FROM league_games WHERE id = v_c) IS NULL
    AND NOT EXISTS (SELECT 1 FROM league_game_changes WHERE game_id IN (v_a, v_b, v_c))
    AND NOT EXISTS (SELECT 1 FROM org_place_closures WHERE press_key = v_key)
    AND NOT EXISTS (SELECT 1 FROM rep_event_closure_marks WHERE event_id = v_r) THEN 'pass'
    ELSE format('%s %s', v_res.refusal, v_res.changed) END;

  -- T3 a game at ANOTHER place is refused (changed names it); a scored rep game is refused (K6).
  SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', g.updated_at)) INTO v_league FROM league_games g WHERE g.id IN (v_a, v_d);
  SELECT p.refusal, p.changed INTO v_res FROM org_place_closure_press(v_org, NULL, gen_random_uuid(), v_places, v_day, v_day, 'postponed', NULL, v_league, '[]', '[]') p;
  INSERT INTO r SELECT 'T3a another place refused', CASE WHEN v_res.refusal = 'changed' AND v_res.changed = ARRAY[v_d] THEN 'pass' ELSE format('%s %s', v_res.refusal, v_res.changed) END;
  UPDATE rep_team_events SET team_score = 3 WHERE id = v_r2;
  SELECT jsonb_agg(jsonb_build_object('id', e.id, 'seen', e.updated_at)) INTO v_rep FROM rep_team_events e WHERE e.id = v_r2;
  SELECT p.refusal, p.changed INTO v_res FROM org_place_closure_press(v_org, NULL, gen_random_uuid(), v_places, v_day, v_day, 'postponed', NULL, '[]', v_rep, '[]') p;
  INSERT INTO r SELECT 'T3b scored rep refused', CASE WHEN v_res.refusal = 'changed' AND v_res.changed = ARRAY[v_r2]
    AND NOT EXISTS (SELECT 1 FROM rep_event_closure_marks WHERE event_id = v_r2) THEN 'pass' ELSE format('%s %s', v_res.refusal, v_res.changed) END;
  UPDATE rep_team_events SET team_score = NULL WHERE id = v_r2;

  -- T4 the press across two seasons: A (on the place) and B (typed, upper case, ticked) postponed; C (typed, left ON)
  -- linked with "Link both"; R (on the place) and R2 (typed) marked. One Rainout per season, one mark each.
  SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', g.updated_at)) INTO v_league FROM league_games g WHERE g.id IN (v_a, v_b);
  SELECT jsonb_agg(jsonb_build_object('id', e.id, 'seen', e.updated_at)) INTO v_rep FROM rep_team_events e WHERE e.id IN (v_r, v_r2);
  v_links := jsonb_build_array(jsonb_build_object('kind', 'league', 'id', v_c, 'venueId', v_v),
                               jsonb_build_object('kind', 'rep', 'id', v_r2, 'venueId', v_v));
  SELECT * INTO v_res FROM org_place_closure_press(v_org, NULL, v_key, v_places, v_day, v_day, 'postponed', '  Rain.  ', v_league, v_rep, v_links) p;
  INSERT INTO r SELECT 'T4a press', CASE WHEN v_res.refusal IS NULL AND NOT v_res.replay AND cardinality(v_res.closures) = 1
    AND cardinality(v_res.rainouts) = 2 AND v_res.marks = 2
    AND (SELECT count(*) FROM league_games WHERE id IN (v_a, v_b) AND status = 'postponed') = 2
    AND (SELECT count(*) FROM league_game_changes WHERE game_id IN (v_a, v_b) AND sent_at IS NULL AND kind = 'postponed') = 2
    AND (SELECT count(*) FROM league_rainouts WHERE closure_id = v_res.closures[1] AND org_venue_id = v_v AND line = 'Rain.') = 2
    AND (SELECT count(DISTINCT season_id) FROM league_rainouts WHERE closure_id = v_res.closures[1]) = 2
    THEN 'pass' ELSE format('%s %s %s %s', v_res.refusal, v_res.closures, v_res.rainouts, v_res.marks) END;
  INSERT INTO r SELECT 'T4b "Link both" records no change (so no email can follow)', CASE
    WHEN (SELECT org_venue_id FROM league_games WHERE id = v_c) = v_v
     AND (SELECT status FROM league_games WHERE id = v_c) = 'scheduled'
     AND NOT EXISTS (SELECT 1 FROM league_game_changes WHERE game_id = v_c) THEN 'pass'
    ELSE format('venue %s, rows %s', (SELECT org_venue_id FROM league_games WHERE id = v_c),
                (SELECT count(*) FROM league_game_changes WHERE game_id = v_c)) END;
  INSERT INTO r SELECT 'T4c the linked typed game postponed records ONE change', CASE
    WHEN (SELECT count(*) FROM league_game_changes WHERE game_id = v_b) = 1 THEN 'pass'
    ELSE (SELECT string_agg(kind, ',') FROM league_game_changes WHERE game_id = v_b) END;
  INSERT INTO r SELECT 'T4d the rep marks keep the game as marked (after its link)', CASE
    WHEN (SELECT count(*) FROM rep_event_closure_marks m JOIN rep_team_events e ON e.id = m.event_id
           WHERE m.closure_id = v_res.closures[1] AND m.marked_starts_at = e.starts_at
             AND m.marked_org_venue_id IS NOT DISTINCT FROM e.org_venue_id AND m.marked_location IS NOT DISTINCT FROM e.location) = 2
     AND (SELECT org_venue_id FROM rep_team_events WHERE id = v_r2) = v_v THEN 'pass' ELSE 'a mark differs from its game' END;
  INSERT INTO r SELECT 'T4e the strip shows from the press to midnight after Until', CASE
    WHEN (SELECT shows_from = now() AND ends_at = ((v_day + 1)::timestamp AT TIME ZONE 'America/Toronto')
            FROM org_place_closures WHERE id = v_res.closures[1]) THEN 'pass' ELSE 'shows/ends wrong' END;

  -- T5 a retried press runs once: same key, same answer, nothing new written.
  SELECT count(*) INTO v_n FROM league_game_changes WHERE game_id IN (v_a, v_b, v_c);
  SELECT * INTO v_res2 FROM org_place_closure_press(v_org, NULL, v_key, v_places, v_day, v_day, 'postponed', 'Rain.', v_league, v_rep, v_links) p;
  INSERT INTO r SELECT 'T5 retry runs once', CASE WHEN v_res2.refusal IS NULL AND v_res2.replay AND v_res2.closures = v_res.closures
    AND v_res2.rainouts = v_res.rainouts AND v_res2.marks = 2
    AND (SELECT count(*) FROM org_place_closures WHERE press_key = v_key) = 1
    AND (SELECT count(*) FROM league_game_changes WHERE game_id IN (v_a, v_b, v_c)) = v_n THEN 'pass'
    ELSE format('%s %s %s', v_res2.refusal, v_res2.replay, v_res2.marks) END;
  -- ... and another club cannot replay this club's key.
  SELECT p.refusal INTO v_x FROM org_place_closure_press(gen_random_uuid(), NULL, v_key, v_places, v_day, v_day, 'postponed', NULL, '[]', '[]', '[]') p;
  INSERT INTO r SELECT 'T5b another club''s replay refused', CASE WHEN v_x = 'invalid' THEN 'pass' ELSE coalesce(v_x, 'null') END;

  -- T6 a second closure over the same rep game keeps the first's mark; reopening the second leaves the first standing.
  SELECT jsonb_agg(jsonb_build_object('id', e.id, 'seen', e.updated_at)) INTO v_rep FROM rep_team_events e WHERE e.id = v_r;
  SELECT * INTO v_res2 FROM org_place_closure_press(v_org, NULL, v_key2,
    jsonb_build_array(jsonb_build_object('venueId', v_v)), v_day, v_day + 1, 'postponed', NULL, '[]', v_rep, '[]') p;
  PERFORM org_place_closure_reopen(v_org, v_res2.closures[1], NULL);
  INSERT INTO r SELECT 'T6 second closure never clears the first mark', CASE WHEN v_res2.refusal IS NULL AND v_res2.marks = 1
    AND (SELECT count(*) FROM rep_event_closure_marks WHERE event_id = v_r) = 2
    AND (SELECT reopened_at FROM org_place_closures WHERE id = v_res.closures[1]) IS NULL
    AND (SELECT reopened_at FROM org_place_closures WHERE id = v_res2.closures[1]) IS NOT NULL THEN 'pass'
    ELSE format('%s %s', v_res2.refusal, v_res2.marks) END;

  -- T7 Reopen: stamped once (a second Reopen says already), moves no game (K11 A), another club's id is not found.
  SELECT * INTO v_res2 FROM org_place_closure_reopen(v_org, v_res.closures[1], NULL);
  SELECT p.already INTO v_x FROM org_place_closure_reopen(v_org, v_res.closures[1], NULL) p;
  INSERT INTO r SELECT 'T7 reopen', CASE WHEN v_res2.refusal IS NULL AND NOT v_res2.already AND v_x = 'true'
    AND (SELECT count(*) FROM league_games WHERE id IN (v_a, v_b) AND status = 'postponed') = 2
    AND (SELECT p.refusal FROM org_place_closure_reopen(gen_random_uuid(), v_res.closures[1], NULL) p) = 'not_found'
    THEN 'pass' ELSE format('%s %s %s', v_res2.refusal, v_res2.already, v_x) END;
  INSERT INTO r SELECT 'T7b no closure of this club shows after Reopen', CASE WHEN NOT EXISTS (
    SELECT 1 FROM org_place_closures WHERE org_id = v_org AND press_key IN (v_key, v_key2)
       AND reopened_at IS NULL AND shows_from <= now() AND ends_at > now()) THEN 'pass' ELSE 'still showing' END;

  -- T8 the recorder's rule: quiet ONLY while the closure press says so. Any other writer linking the place NAMED in the
  -- typed text (the club schedule keeps old typed text when it sets a place) still records 'place'; with the press's
  -- switch on it records nothing; a place NOT named there records 'place' even with the switch on.
  UPDATE league_games SET status = 'scheduled', org_venue_id = NULL, location = 'Field by ' || lower(v_vname) WHERE id = v_d;
  DELETE FROM league_game_changes WHERE game_id = v_d;
  UPDATE league_games SET org_venue_id = v_v WHERE id = v_d;                                  -- any writer
  SELECT count(*) INTO v_n FROM league_game_changes WHERE game_id = v_d AND kind = 'place';
  UPDATE league_games SET org_venue_id = NULL WHERE id = v_d;
  DELETE FROM league_game_changes WHERE game_id = v_d;
  PERFORM set_config('league.quiet_link', 'on', true);
  UPDATE league_games SET org_venue_id = v_v WHERE id = v_d;                                  -- the press's switch on
  SELECT count(*) INTO v_x FROM league_game_changes WHERE game_id = v_d;
  UPDATE league_games SET org_venue_id = NULL WHERE id = v_d;
  DELETE FROM league_game_changes WHERE game_id = v_d;
  UPDATE league_games SET org_venue_id = v_other WHERE id = v_d;                              -- not the place named
  PERFORM set_config('league.quiet_link', 'off', true);
  INSERT INTO r SELECT 'T8 recorder: quiet only for the press, only for the place named', CASE WHEN v_n = 1 AND v_x = '0'
    AND (SELECT string_agg(kind, ',') FROM league_game_changes WHERE game_id = v_d) = 'place' THEN 'pass'
    ELSE format('any writer %s, switch on %s, other %s', v_n, v_x, (SELECT string_agg(kind, ',') FROM league_game_changes WHERE game_id = v_d)) END;
  INSERT INTO r SELECT 'T8b the press leaves the switch off', CASE WHEN coalesce(current_setting('league.quiet_link', true), '') <> 'on' THEN 'pass' ELSE 'on' END;

  -- T9 a draft division's game is refused, nothing written.
  UPDATE league_games SET status = 'scheduled', org_venue_id = v_v WHERE id = v_d;
  UPDATE league_divisions SET schedule_published_at = NULL WHERE id = (SELECT division_id FROM league_games WHERE id = v_d);
  SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', g.updated_at)) INTO v_league FROM league_games g WHERE g.id = v_d;
  SELECT p.refusal INTO v_x FROM org_place_closure_press(v_org, NULL, gen_random_uuid(), v_places, v_day, v_day, 'postponed', NULL, v_league, '[]', '[]') p;
  INSERT INTO r SELECT 'T9 draft refused', CASE WHEN v_x = 'draft'
    AND (SELECT status FROM league_games WHERE id = v_d) = 'scheduled' THEN 'pass' ELSE coalesce(v_x, 'null') END;

  -- T10 "All our fields": one entry with no place takes a game at any place; a place named beside it is refused.
  UPDATE league_divisions SET schedule_published_at = now() WHERE id = (SELECT division_id FROM league_games WHERE id = v_d);
  UPDATE league_games SET org_venue_id = v_other WHERE id = v_d;
  SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', g.updated_at)) INTO v_league FROM league_games g WHERE g.id = v_d;
  SELECT * INTO v_res FROM org_place_closure_press(v_org, NULL, gen_random_uuid(), jsonb_build_array('{}'::jsonb), v_day, v_day, 'cancelled', NULL, v_league, '[]', '[]') p;
  SELECT p.refusal INTO v_x FROM org_place_closure_press(v_org, NULL, gen_random_uuid(),
    jsonb_build_array('{}'::jsonb, jsonb_build_object('venueId', v_v)), v_day, v_day, 'cancelled', NULL, '[]', '[]', '[]') p;
  INSERT INTO r SELECT 'T10 all our fields', CASE WHEN v_res.refusal IS NULL AND v_x = 'invalid'
    AND (SELECT status FROM league_games WHERE id = v_d) = 'cancelled'
    AND (SELECT scope = 'all' AND place_name IS NULL FROM org_place_closures WHERE id = v_res.closures[1]) THEN 'pass'
    ELSE format('%s %s', v_res.refusal, v_x) END;

  -- T11 one diamond (K2): a game on that diamond is taken; a game on another diamond is refused as not there.
  SELECT id INTO v_d FROM league_games WHERE season_id = v_s2 AND id NOT IN (v_b) AND status <> 'cancelled' ORDER BY id LIMIT 1;
  UPDATE league_games SET status = 'scheduled', home_score = NULL, away_score = NULL, scheduled_at = v_at10, org_venue_id = v_v,
         org_venue_facility_id = v_f WHERE id = v_d;
  SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', g.updated_at)) INTO v_league FROM league_games g WHERE g.id = v_d;
  SELECT * INTO v_res FROM org_place_closure_press(v_org, NULL, gen_random_uuid(), jsonb_build_array(jsonb_build_object('venueId', v_v, 'facilityId', v_f)),
    v_day, v_day, 'postponed', NULL, v_league, '[]', '[]') p;
  INSERT INTO r SELECT 'T11 one diamond', CASE WHEN v_res.refusal IS NULL AND (SELECT status FROM league_games WHERE id = v_d) = 'postponed'
    AND (SELECT scope = 'diamond' AND facility_name IS NOT NULL FROM org_place_closures WHERE id = v_res.closures[1]) THEN 'pass'
    ELSE format('%s', v_res.refusal) END;
  UPDATE league_games SET status = 'scheduled', org_venue_facility_id = NULL WHERE id = v_d;
  UPDATE league_games SET org_venue_facility_id = (SELECT f.id FROM org_venue_facilities f WHERE f.org_venue_id = v_v AND f.id <> v_f LIMIT 1)
   WHERE id = v_d;
  SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', g.updated_at)) INTO v_league FROM league_games g WHERE g.id = v_d;
  SELECT p.refusal, p.changed INTO v_res FROM org_place_closure_press(v_org, NULL, gen_random_uuid(), jsonb_build_array(jsonb_build_object('venueId', v_v, 'facilityId', v_f)),
    v_day, v_day, 'postponed', NULL, v_league, '[]', '[]') p;
  INSERT INTO r SELECT 'T11b another diamond refused', CASE WHEN (SELECT f.id FROM org_venue_facilities f WHERE f.org_venue_id = v_v AND f.id <> v_f LIMIT 1) IS NULL THEN 'pass (one diamond only)'
    WHEN v_res.refusal = 'changed' AND v_res.changed = ARRAY[v_d] THEN 'pass' ELSE format('%s %s', v_res.refusal, v_res.changed) END;

  -- T12 two places in one press: each game's Rainout record names its own closure.
  UPDATE league_games SET status = 'scheduled', org_venue_id = v_other, org_venue_facility_id = NULL WHERE id = v_d;
  UPDATE league_games SET status = 'scheduled', org_venue_id = v_v, org_venue_facility_id = NULL WHERE id = v_a;
  SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', g.updated_at)) INTO v_league FROM league_games g WHERE g.id IN (v_a, v_d);
  SELECT * INTO v_res FROM org_place_closure_press(v_org, NULL, gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('venueId', v_v), jsonb_build_object('venueId', v_other)), v_day, v_day, 'postponed', NULL, v_league, '[]', '[]') p;
  INSERT INTO r SELECT 'T12 two places', CASE WHEN v_res.refusal IS NULL AND cardinality(v_res.closures) = 2
    AND (SELECT closure_id FROM league_rainouts WHERE v_a = ANY (game_ids) AND closure_id = ANY (v_res.closures)) = v_res.closures[1]
    AND (SELECT closure_id FROM league_rainouts WHERE v_d = ANY (game_ids) AND closure_id = ANY (v_res.closures)) = v_res.closures[2] THEN 'pass'
    ELSE format('%s %s', v_res.refusal, v_res.closures) END;

  -- T13 a finished season is refused; another club's game is not_found; a game gone since the window read it is named.
  UPDATE league_games SET status = 'scheduled' WHERE id = v_d;
  SELECT jsonb_agg(jsonb_build_object('id', g.id, 'seen', g.updated_at)) INTO v_league FROM league_games g WHERE g.id = v_d;
  UPDATE league_seasons SET status = 'completed' WHERE id = v_s2;
  SELECT p.refusal INTO v_x FROM org_place_closure_press(v_org, NULL, gen_random_uuid(), jsonb_build_array(jsonb_build_object('venueId', v_other)), v_day, v_day, 'postponed', NULL, v_league, '[]', '[]') p;
  UPDATE league_seasons SET status = 'active' WHERE id = v_s2;
  INSERT INTO r SELECT 'T13a finished', CASE WHEN v_x = 'finished' THEN 'pass' ELSE coalesce(v_x, 'null') END;
  SELECT jsonb_build_array(jsonb_build_object('id', g.id, 'seen', g.updated_at)) INTO v_league FROM league_games g WHERE g.org_id <> v_org LIMIT 1;
  SELECT p.refusal INTO v_x FROM org_place_closure_press(v_org, NULL, gen_random_uuid(), jsonb_build_array(jsonb_build_object('venueId', v_other)), v_day, v_day, 'postponed', NULL, v_league, '[]', '[]') p;
  INSERT INTO r SELECT 'T13b another club''s game', CASE WHEN v_x = 'not_found' THEN 'pass' ELSE coalesce(v_x, 'null') END;
  v_league := jsonb_build_array(jsonb_build_object('id', '00000000-0000-4000-8000-000000000001', 'seen', now()));
  SELECT p.refusal, p.changed INTO v_res FROM org_place_closure_press(v_org, NULL, gen_random_uuid(), jsonb_build_array(jsonb_build_object('venueId', v_other)), v_day, v_day, 'postponed', NULL, v_league, '[]', '[]') p;
  INSERT INTO r SELECT 'T13c a game gone since is named as changed', CASE WHEN v_res.refusal = 'changed'
    AND v_res.changed = ARRAY['00000000-0000-4000-8000-000000000001'::uuid] THEN 'pass' ELSE format('%s %s', v_res.refusal, v_res.changed) END;

  -- T14 links: a cancelled typed game cannot be linked; a rep practice id is refused (and never locked).
  UPDATE league_games SET status = 'cancelled', org_venue_id = NULL, location = v_vname || ' east' WHERE id = v_d;
  SELECT p.refusal, p.changed INTO v_res FROM org_place_closure_press(v_org, NULL, gen_random_uuid(), v_places, v_day, v_day, 'postponed', NULL, '[]', '[]',
    jsonb_build_array(jsonb_build_object('kind', 'league', 'id', v_d, 'venueId', v_v))) p;
  INSERT INTO r SELECT 'T14a a cancelled game is not linked', CASE WHEN v_res.refusal = 'changed' AND v_res.changed = ARRAY[v_d]
    AND (SELECT org_venue_id FROM league_games WHERE id = v_d) IS NULL THEN 'pass' ELSE format('%s %s', v_res.refusal, v_res.changed) END;
  SELECT jsonb_build_array(jsonb_build_object('id', e.id, 'seen', e.updated_at)) INTO v_rep FROM rep_team_events e
   WHERE e.org_id = v_org AND e.event_type = 'practice' LIMIT 1;
  IF v_rep IS NULL THEN INSERT INTO r VALUES ('T14b a practice is not a rep game', 'pass (no practice to try)');
  ELSE
    SELECT p.refusal INTO v_x FROM org_place_closure_press(v_org, NULL, gen_random_uuid(), v_places, v_day, v_day, 'postponed', NULL, '[]', v_rep, '[]') p;
    INSERT INTO r SELECT 'T14b a practice is not a rep game', CASE WHEN v_x = 'changed' THEN 'pass' ELSE coalesce(v_x, 'null') END;
  END IF;

  -- T15 the one matching rule gives the window's answers (tests/unit/place-closures.test.ts holds the same cases).
  INSERT INTO r SELECT 'T15 matching rule cases', CASE WHEN
        place_closure_match('place', v_v, NULL, 'Lions Park', v_v, v_f, NULL) = 'linked'
    AND place_closure_match('place', v_v, NULL, 'Lions Park', NULL, NULL, 'Lions Park — Diamond 2') = 'maybe'
    AND place_closure_match('place', v_v, NULL, 'Lions Park', NULL, NULL, 'LIONS PARK D2') = 'maybe'
    AND place_closure_match('place', v_v, NULL, 'Lions Park', v_other, NULL, 'next to Lions Park') IS NULL
    AND place_closure_match('place', v_v, NULL, 'Lions Park', NULL, NULL, 'Lions Pk') IS NULL
    AND place_closure_match('diamond', v_v, v_f, 'Lions Park', v_v, v_f, NULL) = 'linked'
    AND place_closure_match('diamond', v_v, v_f, 'Lions Park', v_v, NULL, NULL) = 'maybe'
    AND place_closure_match('diamond', v_v, v_f, 'Lions Park', v_v, gen_random_uuid(), NULL) IS NULL
    AND place_closure_match('all', NULL, NULL, NULL, NULL, NULL, NULL) = 'linked'
    AND NOT place_name_in_typed('', 'Lions Park') AND NOT place_name_in_typed('Lions Park', '   ')
    AND place_name_in_typed('  Lions Park ', 'at lions park') THEN 'pass' ELSE 'a case differs' END;
END $$;
SELECT * FROM r ORDER BY t;
ROLLBACK;
