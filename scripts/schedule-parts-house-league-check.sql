-- Club schedules Stage 2, Session 2E part 1 (mig 552): house league carries a part from club time.
-- Rolled back; run on dev (after mig 552 is applied) with
--   node scripts/db-query.mjs --dev -f scripts/schedule-parts-house-league-check.sql
-- Each H row is 'pass' or says what it found. The fixture is any club on dev with a venue of two fields and a member who
-- made a schedule there; the schedule it saves runs in 2099 so nothing real is met, and every edit, including the
-- field's split, is rolled back with everything else.
BEGIN;
SET CONSTRAINTS public.club_schedule_slots_family_place_overlap IMMEDIATE;
CREATE TEMP TABLE r(t text, result text) ON COMMIT DROP;
DO $$
DECLARE
  v_org uuid; v_actor uuid; v_v uuid; v_f uuid; v_f2 uuid; v_res jsonb; v_id uuid;
  v_ga uuid; v_gb uuid; v_pa uuid; v_pb uuid; v_pw uuid;
  v_season uuid; v_div uuid; v_t1 uuid; v_t2 uuid; v_t3 uuid; v_t4 uuid; v_game uuid; v_ids uuid[];
  v_m smallint; v_m2 smallint; v_n integer; v_txt text; v_snap jsonb; v_kind text; v_before jsonb; v_after jsonb;
  g0 text := '2099-01-04T14:00:00Z'; g1 text := '2099-01-04T15:30:00Z';
  p0 text := '2099-01-04T17:00:00Z'; p1 text := '2099-01-04T18:30:00Z';
BEGIN
  SELECT s.org_id, s.created_by INTO v_org, v_actor FROM club_schedules s
   WHERE s.created_by IS NOT NULL
     AND EXISTS (SELECT 1 FROM org_venues v JOIN org_venue_facilities f ON f.org_venue_id = v.id
                  WHERE v.org_id = s.org_id GROUP BY v.id HAVING count(*) >= 2)
   ORDER BY s.created_at LIMIT 1;
  IF v_org IS NULL THEN INSERT INTO r VALUES ('setup', 'no club with a schedule and a venue of two fields'); RETURN; END IF;
  SELECT v.id INTO v_v FROM org_venues v WHERE v.org_id = v_org
     AND (SELECT count(*) FROM org_venue_facilities f WHERE f.org_venue_id = v.id) >= 2 ORDER BY v.id LIMIT 1;
  SELECT id INTO v_f  FROM org_venue_facilities WHERE org_venue_id = v_v ORDER BY id LIMIT 1;
  SELECT id INTO v_f2 FROM org_venue_facilities WHERE org_venue_id = v_v AND id <> v_f ORDER BY id LIMIT 1;
  UPDATE org_venue_facilities SET sections = 2 WHERE id = v_f;   -- Field "1" in two sides (rolled back)

  -- Game time: side A and side B at one start. Practice time: side A, side B and the other field whole, later.
  v_res := club_schedule_save(v_org, NULL, v_actor, 0, jsonb_build_object(
    'name', 'Parts house league check', 'startsOn', '2099-01-01', 'endsOn', '2099-03-01', 'settings', '{}'::jsonb,
    'blocks', jsonb_build_array(jsonb_build_object('venueId', v_v, 'facilityIds', jsonb_build_array(v_f, v_f2),
      'parts', jsonb_build_object(v_f::text, jsonb_build_array(3, 12)),
      'weekdays', jsonb_build_array(7), 'startTime', '09:00', 'endTime', '13:30')),
    'datesOff', '[]'::jsonb,
    'slots', jsonb_build_array(
      jsonb_build_object('venueId', v_v, 'facilityId', v_f, 'sectionMask', 3,  'startsAt', g0, 'endsAt', g1, 'blockIndex', 0, 'teamIds', '[]'::jsonb),
      jsonb_build_object('venueId', v_v, 'facilityId', v_f, 'sectionMask', 12, 'startsAt', g0, 'endsAt', g1, 'blockIndex', 0, 'teamIds', '[]'::jsonb),
      jsonb_build_object('venueId', v_v, 'facilityId', v_f, 'sectionMask', 3,  'startsAt', p0, 'endsAt', p1, 'blockIndex', 0, 'teamIds', '[]'::jsonb),
      jsonb_build_object('venueId', v_v, 'facilityId', v_f, 'sectionMask', 12, 'startsAt', p0, 'endsAt', p1, 'blockIndex', 0, 'teamIds', '[]'::jsonb),
      jsonb_build_object('venueId', v_v, 'facilityId', v_f2, 'startsAt', p0, 'endsAt', p1, 'blockIndex', 0, 'teamIds', '[]'::jsonb))));
  v_id := (v_res->>'id')::uuid;
  SELECT id INTO v_ga FROM club_schedule_slots WHERE schedule_id = v_id AND section_mask = 3  AND starts_at = g0::timestamptz;
  SELECT id INTO v_gb FROM club_schedule_slots WHERE schedule_id = v_id AND section_mask = 12 AND starts_at = g0::timestamptz;
  SELECT id INTO v_pa FROM club_schedule_slots WHERE schedule_id = v_id AND section_mask = 3  AND starts_at = p0::timestamptz;
  SELECT id INTO v_pb FROM club_schedule_slots WHERE schedule_id = v_id AND section_mask = 12 AND starts_at = p0::timestamptz;
  SELECT id INTO v_pw FROM club_schedule_slots WHERE schedule_id = v_id AND facility_id = v_f2;
  IF v_ga IS NULL OR v_gb IS NULL OR v_pa IS NULL OR v_pb IS NULL OR v_pw IS NULL THEN
    INSERT INTO r VALUES ('setup', format('slots not saved: %s', v_res)); RETURN;
  END IF;
  UPDATE club_schedules SET state = 'final' WHERE id = v_id;
  INSERT INTO club_schedule_slot_programs (slot_id, program, org_id)
  VALUES (v_ga, 'house_league', v_org), (v_gb, 'house_league', v_org), (v_pa, 'house_league', v_org),
         (v_pb, 'house_league', v_org), (v_pw, 'house_league', v_org);

  INSERT INTO league_seasons (org_id, name, slug) VALUES (v_org, 'Parts house league check', 'parts-hl-' || substr(md5(random()::text), 1, 10)) RETURNING id INTO v_season;
  INSERT INTO league_divisions (season_id, name, capacity) VALUES (v_season, 'U9', 20) RETURNING id INTO v_div;
  INSERT INTO league_teams (season_id, division_id, name) VALUES (v_season, v_div, 'Cardinals') RETURNING id INTO v_t1;
  INSERT INTO league_teams (season_id, division_id, name) VALUES (v_season, v_div, 'Rays') RETURNING id INTO v_t2;
  INSERT INTO league_teams (season_id, division_id, name) VALUES (v_season, v_div, 'Orioles') RETURNING id INTO v_t3;
  INSERT INTO league_teams (season_id, division_id, name) VALUES (v_season, v_div, 'Twins') RETURNING id INTO v_t4;
  PERFORM league_slot_uses_set(v_org, v_season, NULL, ARRAY[v_ga, v_gb], v_div, 'games');
  PERFORM league_slot_uses_set(v_org, v_season, NULL, ARRAY[v_pa, v_pb, v_pw], v_div, 'practices');

  -- H01 Generate games: a game on side A's slot is on side A, side B's on side B — the payload names no part.
  SELECT ids INTO v_ids FROM league_games_generate_save(v_org, v_season, v_div, jsonb_build_array(
    jsonb_build_object('homeTeamId', v_t1, 'awayTeamId', v_t2, 'scheduledAt', g0, 'endsAt', g1, 'venueId', v_v, 'facilityId', v_f,
      'location', 'Check park — Field 1, side A', 'slotUseId', v_ga),
    jsonb_build_object('homeTeamId', v_t3, 'awayTeamId', v_t4, 'scheduledAt', g0, 'endsAt', g1, 'venueId', v_v, 'facilityId', v_f,
      'location', 'Check park — Field 1, side B', 'slotUseId', v_gb)));
  SELECT section_mask INTO v_m  FROM league_games WHERE slot_use_id = v_ga;
  SELECT section_mask INTO v_m2 FROM league_games WHERE slot_use_id = v_gb;
  INSERT INTO r VALUES ('H01 generated games take their slot''s side', CASE WHEN v_m = 3 AND v_m2 = 12 AND array_length(v_ids, 1) = 2 THEN 'pass' ELSE format('A %s, B %s, ids %s', v_m, v_m2, v_ids) END);
  SELECT id INTO v_game FROM league_games WHERE slot_use_id = v_ga;

  -- H02 Practice time: two teams at once on side A is refused, naming one at a time.
  BEGIN
    PERFORM league_practices_hand_out(v_org, v_season, v_div, v_actor, ARRAY[v_pa, v_pb, v_pw], jsonb_build_array(
      jsonb_build_object('slotId', v_pa, 'teamId', v_t1, 'scheduledAt', p0, 'endsAt', p1, 'location', 'x'),
      jsonb_build_object('slotId', v_pa, 'teamId', v_t2, 'scheduledAt', p0, 'endsAt', p1, 'location', 'x')),
      jsonb_build_object('teamsAtOnce', 3, 'practiceMinutes', 90));
    INSERT INTO r VALUES ('H02 a side holds one team, whatever Teams at once says', 'NOT refused');
  EXCEPTION WHEN raise_exception THEN
    INSERT INTO r VALUES ('H02 a side holds one team, whatever Teams at once says',
      CASE WHEN SQLERRM LIKE 'slot_full: a slot holds 1 practice(s) at once' THEN 'pass' ELSE SQLERRM END);
  END;

  -- H03 one team on each side and two on the whole field (Teams at once 2 on whole facilities): each on its slot's part.
  v_res := league_practices_hand_out(v_org, v_season, v_div, v_actor, ARRAY[v_pa, v_pb, v_pw], jsonb_build_array(
    jsonb_build_object('slotId', v_pa, 'teamId', v_t1, 'scheduledAt', p0, 'endsAt', p1, 'location', 'x'),
    jsonb_build_object('slotId', v_pb, 'teamId', v_t2, 'scheduledAt', p0, 'endsAt', p1, 'location', 'x'),
    jsonb_build_object('slotId', v_pw, 'teamId', v_t3, 'scheduledAt', p0, 'endsAt', p1, 'location', 'x'),
    jsonb_build_object('slotId', v_pw, 'teamId', v_t4, 'scheduledAt', p0, 'endsAt', p1, 'location', 'x')),
    jsonb_build_object('teamsAtOnce', 2, 'practiceMinutes', 90));
  SELECT string_agg(section_mask::text, ',' ORDER BY section_mask) INTO v_txt FROM league_practices WHERE club_schedule_slot_id IN (v_pa, v_pb, v_pw);
  INSERT INTO r VALUES ('H03 practices take their slot''s side; the whole field holds two', CASE WHEN (v_res->>'ok')::boolean AND v_txt = '0,0,3,12' THEN 'pass' ELSE format('%s / %s', v_res, v_txt) END);

  -- H04 the reinstate (ON CONFLICT) keeps its part.
  UPDATE league_practices SET status = 'cancelled' WHERE club_schedule_slot_id = v_pa;
  PERFORM league_practices_hand_out(v_org, v_season, v_div, v_actor, ARRAY[v_pa], jsonb_build_array(
    jsonb_build_object('slotId', v_pa, 'teamId', v_t1, 'scheduledAt', p0, 'endsAt', p1, 'location', 'x')),
    jsonb_build_object('teamsAtOnce', 2, 'practiceMinutes', 90));
  SELECT section_mask, count(*) OVER () INTO v_m, v_n FROM league_practices WHERE club_schedule_slot_id = v_pa;
  INSERT INTO r VALUES ('H04 a reinstated practice keeps its side', CASE WHEN v_m = 3 AND v_n = 1 THEN 'pass' ELSE format('mask %s, rows %s', v_m, v_n) END);

  -- H05 the snapshot names the part.
  SELECT league_game_snapshot(g) INTO v_snap FROM league_games g WHERE g.id = v_game;
  INSERT INTO r VALUES ('H05 the snapshot carries sectionMask', CASE WHEN (v_snap->>'sectionMask')::int = 3 THEN 'pass' ELSE v_snap::text END);

  -- H06 published: side A → side B is recorded as a change of place, before A and after B.
  UPDATE league_divisions SET schedule_published_at = now() WHERE id = v_div;
  UPDATE league_games SET section_mask = 12 WHERE id = v_game;
  SELECT kind, before, after INTO v_kind, v_before, v_after FROM league_game_changes WHERE game_id = v_game ORDER BY created_at DESC LIMIT 1;
  INSERT INTO r VALUES ('H06 a side change is a change of place', CASE WHEN v_kind = 'place' AND (v_before->>'sectionMask')::int = 3 AND (v_after->>'sectionMask')::int = 12 THEN 'pass' ELSE format('%s %s %s', v_kind, v_before, v_after) END);

  -- H07 Undo puts it back on side A.
  v_txt := league_game_undo(v_org, v_season, v_game);
  SELECT section_mask INTO v_m FROM league_games WHERE id = v_game;
  INSERT INTO r VALUES ('H07 Undo puts the side back', CASE WHEN v_txt IS NULL AND v_m = 3 THEN 'pass' ELSE format('undo %s, mask %s', v_txt, v_m) END);

  -- H08 the scored write names the part when the patch does (a hand move to another field is the whole field).
  v_txt := league_game_club_write(v_org, v_game, (SELECT updated_at FROM league_games WHERE id = v_game),
    jsonb_build_object('org_venue_facility_id', v_f2, 'section_mask', 0, 'home_score', 1, 'away_score', 2), v_actor, 'Check');
  SELECT section_mask INTO v_m FROM league_games WHERE id = v_game AND org_venue_facility_id = v_f2;
  INSERT INTO r VALUES ('H08 the scored write puts a moved game on the whole field', CASE WHEN v_txt IS NULL AND v_m = 0 THEN 'pass' ELSE format('%s, mask %s', v_txt, v_m) END);

  -- H09 the same write that leaves the part out keeps it (a score alone).
  UPDATE league_games SET org_venue_facility_id = v_f, section_mask = 3, home_score = NULL, away_score = NULL, status = 'scheduled' WHERE id = v_game;
  v_txt := league_game_club_write(v_org, v_game, (SELECT updated_at FROM league_games WHERE id = v_game),
    jsonb_build_object('home_score', 3, 'away_score', 4), v_actor, 'Check');
  SELECT section_mask INTO v_m FROM league_games WHERE id = v_game;
  INSERT INTO r VALUES ('H09 a score alone keeps the side', CASE WHEN v_txt IS NULL AND v_m = 3 THEN 'pass' ELSE format('%s, mask %s', v_txt, v_m) END);

  -- H10 the field split again since (the lock lets it once every part booking is over or cancelled): a score still saves
  -- and the stored part stays. The lock is off for this one edit only, because everything here is in 2099.
  ALTER TABLE org_venue_facilities DISABLE TRIGGER org_venue_facilities_split_lock;
  UPDATE org_venue_facilities SET sections = 1 WHERE id = v_f;
  ALTER TABLE org_venue_facilities ENABLE TRIGGER org_venue_facilities_split_lock;
  BEGIN
    v_txt := league_game_club_write(v_org, v_game, (SELECT updated_at FROM league_games WHERE id = v_game),
      jsonb_build_object('home_score', 5, 'away_score', 6), v_actor, 'Check');
    SELECT section_mask INTO v_m FROM league_games WHERE id = v_game AND home_score = 5;
    INSERT INTO r VALUES ('H10 a score saves on a part the field no longer offers', CASE WHEN v_txt IS NULL AND v_m = 3 THEN 'pass' ELSE format('%s, mask %s', v_txt, v_m) END);
  EXCEPTION WHEN check_violation THEN
    INSERT INTO r VALUES ('H10 a score saves on a part the field no longer offers', SQLERRM);
  END;

  -- H11 a NEW part the field doesn't offer is still refused.
  BEGIN
    UPDATE league_games SET section_mask = 12 WHERE id = v_game;
    INSERT INTO r VALUES ('H11 a new part the field doesn''t offer is still refused', 'NOT refused');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO r VALUES ('H11 a new part the field doesn''t offer is still refused', CASE WHEN SQLERRM LIKE 'part_illegal%' THEN 'pass' ELSE SQLERRM END);
  END;
END $$;
SELECT t, result FROM r ORDER BY t;
ROLLBACK;
