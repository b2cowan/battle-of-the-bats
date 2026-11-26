-- Club schedules Stage 2, Session 2C (mig 546): Finalize and Send the changes write each practice on its slot's part, and
-- a house-league practice or game the send moves takes its new slot's part.
-- Rolled back; run on dev (after mig 546 is applied) with
--   node scripts/db-query.mjs --dev -f scripts/schedule-parts-send-check.sql
-- Each P row is 'pass' or says what it found. The fixture is any club on dev with a venue of two fields, a member who
-- made a schedule there and a rep team with a season; the schedule it saves runs in 2099 so nothing real is met, and
-- every edit, including the field's split, is rolled back with everything else.
BEGIN;
SET CONSTRAINTS public.club_schedule_slots_family_place_overlap IMMEDIATE;
CREATE TEMP TABLE r(t text, result text) ON COMMIT DROP;
DO $$
DECLARE
  v_org uuid; v_actor uuid; v_v uuid; v_f uuid; v_f2 uuid; v_team uuid; v_py uuid; v_res jsonb; v_id uuid; v_ver integer;
  v_a uuid; v_b uuid; v_w uuid; v_ev uuid; v_send uuid; v_n integer; v_m smallint; v_m2 smallint;
  v_season uuid; v_div uuid; v_home uuid; v_away uuid; v_lp uuid; v_game uuid; v_old uuid; v_old_slot uuid;
  t0 text := '2099-01-04T23:00:00Z'; t1 text := '2099-01-05T00:30:00Z';
BEGIN
  SELECT s.org_id, s.created_by INTO v_org, v_actor FROM club_schedules s
   WHERE s.created_by IS NOT NULL
     AND EXISTS (SELECT 1 FROM org_venues v JOIN org_venue_facilities f ON f.org_venue_id = v.id
                  WHERE v.org_id = s.org_id GROUP BY v.id HAVING count(*) >= 2)
     AND EXISTS (SELECT 1 FROM rep_program_years py WHERE py.org_id = s.org_id)
   ORDER BY s.created_at LIMIT 1;
  IF v_org IS NULL THEN INSERT INTO r VALUES ('setup', 'no club with a schedule, a venue of two fields and a team season'); RETURN; END IF;
  SELECT v.id INTO v_v FROM org_venues v WHERE v.org_id = v_org
     AND (SELECT count(*) FROM org_venue_facilities f WHERE f.org_venue_id = v.id) >= 2 ORDER BY v.id LIMIT 1;
  SELECT id INTO v_f  FROM org_venue_facilities WHERE org_venue_id = v_v ORDER BY id LIMIT 1;
  SELECT id INTO v_f2 FROM org_venue_facilities WHERE org_venue_id = v_v AND id <> v_f ORDER BY id LIMIT 1;
  SELECT py.team_id, py.id INTO v_team, v_py FROM rep_program_years py WHERE py.org_id = v_org ORDER BY py.id LIMIT 1;
  UPDATE org_venue_facilities SET sections = 2 WHERE id = v_f;   -- Field "1" in two sides (rolled back)

  -- A schedule with three slots at one start: side A, side B, and the other field whole.
  v_res := club_schedule_save(v_org, NULL, v_actor, 0, jsonb_build_object(
    'name', 'Parts send check', 'startsOn', '2099-01-01', 'endsOn', '2099-03-01', 'settings', '{}'::jsonb,
    'blocks', jsonb_build_array(jsonb_build_object('venueId', v_v, 'facilityIds', jsonb_build_array(v_f, v_f2),
      'parts', jsonb_build_object(v_f::text, jsonb_build_array(3, 12)),
      'weekdays', jsonb_build_array(7), 'startTime', '18:00', 'endTime', '19:30')),
    'datesOff', '[]'::jsonb,
    'slots', jsonb_build_array(
      jsonb_build_object('venueId', v_v, 'facilityId', v_f, 'sectionMask', 3, 'startsAt', t0, 'endsAt', t1, 'blockIndex', 0, 'teamIds', '[]'::jsonb),
      jsonb_build_object('venueId', v_v, 'facilityId', v_f, 'sectionMask', 12, 'startsAt', t0, 'endsAt', t1, 'blockIndex', 0, 'teamIds', '[]'::jsonb),
      jsonb_build_object('venueId', v_v, 'facilityId', v_f2, 'startsAt', t0, 'endsAt', t1, 'blockIndex', 0, 'teamIds', '[]'::jsonb))));
  v_id := (v_res->>'id')::uuid; v_ver := (v_res->>'version')::integer;
  SELECT id INTO v_a FROM club_schedule_slots WHERE schedule_id = v_id AND facility_id = v_f AND section_mask = 3;
  SELECT id INTO v_b FROM club_schedule_slots WHERE schedule_id = v_id AND facility_id = v_f AND section_mask = 12;
  SELECT id INTO v_w FROM club_schedule_slots WHERE schedule_id = v_id AND facility_id = v_f2;
  IF v_a IS NULL OR v_b IS NULL OR v_w IS NULL THEN INSERT INTO r VALUES ('setup', format('slots not saved: %s', v_res)); RETURN; END IF;

  -- P1 Finalize's write (club_practices_write): a practice on side A is on side A. The payload names no part.
  PERFORM club_practices_write(v_org, jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'slotId', v_a, 'startsAt', t0, 'endsAt', t1,
    'venueId', v_v, 'facilityId', v_f, 'location', 'Check park', 'fieldNumber', 'Field 1', 'name', 'Practice')));
  SELECT id, section_mask INTO v_ev, v_m FROM rep_team_events WHERE club_schedule_slot_id = v_a AND program_year_id = v_py;
  INSERT INTO r VALUES ('P01 a practice written on side A is on side A', CASE WHEN v_m = 3 THEN 'pass' ELSE format('mask %s', v_m) END);

  -- P2 the reinstate (ON CONFLICT): written again, it keeps its slot's part.
  UPDATE rep_team_events SET status = 'cancelled' WHERE id = v_ev;
  PERFORM club_practices_write(v_org, jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'slotId', v_a, 'startsAt', t0, 'endsAt', t1,
    'venueId', v_v, 'facilityId', v_f, 'location', 'Check park', 'fieldNumber', 'Field 1', 'name', 'Practice')));
  SELECT section_mask INTO v_m FROM rep_team_events WHERE id = v_ev;
  SELECT count(*) INTO v_n FROM rep_team_events WHERE club_schedule_slot_id = v_a AND program_year_id = v_py;
  INSERT INTO r VALUES ('P02 a reinstated practice keeps its part', CASE WHEN v_m = 3 AND v_n = 1 THEN 'pass' ELSE format('mask %s, rows %s', v_m, v_n) END);

  -- P3 a practice on the whole field is 0.
  PERFORM club_practices_write(v_org, jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'slotId', v_w, 'startsAt', t0, 'endsAt', t1,
    'venueId', v_v, 'facilityId', v_f2, 'location', 'Check park', 'fieldNumber', 'Field 2', 'name', 'Practice')));
  SELECT section_mask INTO v_m FROM rep_team_events WHERE club_schedule_slot_id = v_w AND program_year_id = v_py;
  INSERT INTO r VALUES ('P03 a practice on a whole field is 0', CASE WHEN v_m = 0 THEN 'pass' ELSE format('mask %s', v_m) END);

  -- P4 Send the changes' move (club_schedule_apply_changes): side A → side B takes side B's part.
  DELETE FROM rep_team_events WHERE club_schedule_slot_id = v_w AND program_year_id = v_py;
  UPDATE club_schedules SET state = 'final' WHERE id = v_id RETURNING version INTO v_ver;
  INSERT INTO club_schedule_sends (org_id, schedule_id, kind) VALUES (v_org, v_id, 'changes') RETURNING id INTO v_send;
  v_res := club_schedule_apply_changes(v_org, v_id, v_actor, v_ver, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('eventId', v_ev, 'slotId', v_b, 'startsAt', t0, 'endsAt', t1,
      'venueId', v_v, 'facilityId', v_f, 'location', 'Check park', 'fieldNumber', 'Field 1')),
    '{}'::uuid[], NULL, v_send, '{}'::jsonb, '[]'::jsonb, NULL);
  SELECT section_mask INTO v_m FROM rep_team_events WHERE id = v_ev;
  INSERT INTO r VALUES ('P04 a practice moved to side B is on side B', CASE WHEN v_res->>'ok' = 'true' AND v_m = 12 THEN 'pass' ELSE format('mask %s (%s)', v_m, v_res) END);

  -- P5 moved again, onto the other field whole: 0.
  SELECT version INTO v_ver FROM club_schedules WHERE id = v_id;
  INSERT INTO club_schedule_sends (org_id, schedule_id, kind) VALUES (v_org, v_id, 'changes') RETURNING id INTO v_send;
  v_res := club_schedule_apply_changes(v_org, v_id, v_actor, v_ver, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('eventId', v_ev, 'slotId', v_w, 'startsAt', t0, 'endsAt', t1,
      'venueId', v_v, 'facilityId', v_f2, 'location', 'Check park', 'fieldNumber', 'Field 2')),
    '{}'::uuid[], NULL, v_send, '{}'::jsonb, '[]'::jsonb, NULL);
  SELECT section_mask INTO v_m FROM rep_team_events WHERE id = v_ev;
  INSERT INTO r VALUES ('P05 a practice moved onto a whole field is 0', CASE WHEN v_res->>'ok' = 'true' AND v_m = 0 THEN 'pass' ELSE format('mask %s (%s)', v_m, v_res) END);

  -- P6 a row whose field is not its slot's never takes the slot's part (and is not refused for it).
  DELETE FROM rep_team_events WHERE id = v_ev;
  PERFORM club_practices_write(v_org, jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'slotId', v_a, 'startsAt', t0, 'endsAt', t1,
    'venueId', v_v, 'facilityId', v_f2, 'location', 'Check park', 'fieldNumber', 'Field 2', 'name', 'Practice')));
  SELECT id, section_mask INTO v_ev, v_m FROM rep_team_events WHERE club_schedule_slot_id = v_a AND program_year_id = v_py;
  INSERT INTO r VALUES ('P06 a row off its slot''s field is 0', CASE WHEN v_m = 0 THEN 'pass' ELSE format('mask %s', v_m) END);

  -- P7 the catch-up (mig 546 §3): a practice on side A written as the whole field before the build takes side A.
  UPDATE rep_team_events SET org_venue_facility_id = v_f, section_mask = 0 WHERE id = v_ev;
  UPDATE public.rep_team_events e SET section_mask = sl.section_mask FROM public.club_schedule_slots sl
    LEFT JOIN public.org_venue_facilities f ON f.id = sl.facility_id
   WHERE sl.id = e.club_schedule_slot_id AND e.org_venue_facility_id IS NOT DISTINCT FROM sl.facility_id AND e.section_mask <> sl.section_mask
     AND public.section_mask_legal(sl.section_mask, coalesce(f.sections, 1::smallint));
  SELECT section_mask INTO v_m FROM rep_team_events WHERE id = v_ev;
  INSERT INTO r VALUES ('P07 the catch-up gives an older practice its slot''s part', CASE WHEN v_m = 3 THEN 'pass' ELSE format('mask %s', v_m) END);

  -- P8 the trigger still holds: a part the field no longer offers is refused (the split is taken off underneath).
  BEGIN
    UPDATE rep_team_events SET section_mask = 1 WHERE id = v_ev;
    INSERT INTO r VALUES ('P08 a quarter on a two-sided field refused', 'NOT refused');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO r VALUES ('P08 a quarter on a two-sided field refused', CASE WHEN SQLERRM LIKE 'part_illegal%' THEN 'pass' ELSE SQLERRM END);
  END;
  SELECT section_mask INTO v_m2 FROM rep_team_events WHERE id = v_ev;
  IF v_m2 <> 3 THEN INSERT INTO r VALUES ('P08b', format('mask changed to %s', v_m2)); END IF;

  -- House league's half: a practice the send moves onto side B, and a game that follows its time onto side A.
  INSERT INTO league_seasons (org_id, name, slug) VALUES (v_org, 'Parts send check', 'parts-send-' || substr(md5(random()::text), 1, 10)) RETURNING id INTO v_season;
  INSERT INTO league_divisions (season_id, name, capacity) VALUES (v_season, 'U12', 20) RETURNING id INTO v_div;
  INSERT INTO league_teams (season_id, division_id, name) VALUES (v_season, v_div, 'Reds') RETURNING id INTO v_home;
  INSERT INTO league_teams (season_id, division_id, name) VALUES (v_season, v_div, 'Blues') RETURNING id INTO v_away;
  INSERT INTO club_schedule_slot_programs (slot_id, program, org_id)
  VALUES (v_a, 'house_league', v_org), (v_b, 'house_league', v_org), (v_w, 'house_league', v_org);
  PERFORM league_slot_uses_set(v_org, v_season, NULL, ARRAY[v_w], v_div, 'games');
  PERFORM league_slot_uses_set(v_org, v_season, NULL, ARRAY[v_b], v_div, 'practices');
  INSERT INTO league_practices (org_id, season_id, division_id, team_id, scheduled_at, ends_at, org_venue_id, org_venue_facility_id, location, club_schedule_slot_id)
  VALUES (v_org, v_season, v_div, v_home, t0::timestamptz, t1::timestamptz, v_v, v_f2, 'Check park', v_w) RETURNING id INTO v_lp;
  INSERT INTO league_games (org_id, season_id, division_id, home_team_id, away_team_id, scheduled_at, ends_at, org_venue_id, org_venue_facility_id, location, slot_use_id)
  VALUES (v_org, v_season, v_div, v_home, v_away, t0::timestamptz, t1::timestamptz, v_v, v_f2, 'Check park', v_w) RETURNING id INTO v_game;
  SELECT version INTO v_ver FROM club_schedules WHERE id = v_id;
  INSERT INTO club_schedule_sends (org_id, schedule_id, kind) VALUES (v_org, v_id, 'changes') RETURNING id INTO v_send;
  v_res := club_schedule_apply_changes(v_org, v_id, v_actor, v_ver, '[]'::jsonb, '[]'::jsonb, '{}'::uuid[], NULL, v_send, '{}'::jsonb, '[]'::jsonb,
    jsonb_build_object(
      'uses', jsonb_build_array(jsonb_build_object('from', v_w, 'to', v_a)),
      'cancel', '[]'::jsonb,
      'updates', jsonb_build_array(jsonb_build_object('practiceId', v_lp, 'slotId', v_b, 'scheduledAt', t0, 'endsAt', t1, 'location', 'Check park')),
      'games', jsonb_build_object('postpone', '[]'::jsonb, 'remove', '[]'::jsonb, 'move', jsonb_build_array(
        jsonb_build_object('gameId', v_game, 'slotId', v_a, 'scheduledAt', t0, 'endsAt', t1, 'location', 'Check park')))));
  SELECT section_mask INTO v_m FROM league_practices WHERE id = v_lp;
  INSERT INTO r VALUES ('P09 a house-league practice moved to side B is on side B', CASE WHEN v_res->>'ok' = 'true' AND v_m = 12 THEN 'pass' ELSE format('mask %s (%s)', v_m, v_res) END);
  SELECT section_mask INTO v_m FROM league_games WHERE id = v_game;
  INSERT INTO r VALUES ('P10 a house-league game moved to side A is on side A', CASE WHEN v_res->>'ok' = 'true' AND v_m = 3 THEN 'pass' ELSE format('mask %s (%s)', v_m, v_res) END);

  -- P11 the game's time changes side only (same time, same field): the plan writes no move, only the use's.
  DELETE FROM league_practices WHERE id = v_lp;
  DELETE FROM league_slot_uses WHERE slot_id = v_b;
  SELECT version INTO v_ver FROM club_schedules WHERE id = v_id;
  INSERT INTO club_schedule_sends (org_id, schedule_id, kind) VALUES (v_org, v_id, 'changes') RETURNING id INTO v_send;
  v_res := club_schedule_apply_changes(v_org, v_id, v_actor, v_ver, '[]'::jsonb, '[]'::jsonb, '{}'::uuid[], NULL, v_send, '{}'::jsonb, '[]'::jsonb,
    jsonb_build_object('uses', jsonb_build_array(jsonb_build_object('from', v_a, 'to', v_b)), 'cancel', '[]'::jsonb, 'updates', '[]'::jsonb,
      'games', jsonb_build_object('move', '[]'::jsonb, 'postpone', '[]'::jsonb, 'remove', '[]'::jsonb)));
  SELECT section_mask INTO v_m FROM league_games WHERE id = v_game AND slot_use_id = v_b;
  INSERT INTO r VALUES ('P11 a game carried to the other side takes it', CASE WHEN v_res->>'ok' = 'true' AND v_m = 12 THEN 'pass' ELSE format('mask %s (%s)', v_m, v_res) END);

  -- P12 an ended schedule's side, the field since un-split: its practice is written on the whole field, not refused.
  UPDATE org_venue_facilities SET sections = 2 WHERE id = v_f2;
  v_res := club_schedule_save(v_org, NULL, v_actor, 0, jsonb_build_object(
    'name', 'Parts send check, ended', 'startsOn', '2020-01-01', 'endsOn', '2020-03-01', 'settings', '{}'::jsonb,
    'blocks', jsonb_build_array(jsonb_build_object('venueId', v_v, 'facilityIds', jsonb_build_array(v_f2),
      'parts', jsonb_build_object(v_f2::text, jsonb_build_array(3)), 'weekdays', jsonb_build_array(1), 'startTime', '18:00', 'endTime', '19:30')),
    'datesOff', '[]'::jsonb,
    'slots', jsonb_build_array(jsonb_build_object('venueId', v_v, 'facilityId', v_f2, 'sectionMask', 3,
      'startsAt', '2020-01-06T23:00:00Z', 'endsAt', '2020-01-07T00:30:00Z', 'blockIndex', 0, 'teamIds', '[]'::jsonb))));
  v_old := (v_res->>'id')::uuid;
  SELECT id INTO v_old_slot FROM club_schedule_slots WHERE schedule_id = v_old AND section_mask = 3;
  IF v_old_slot IS NULL THEN INSERT INTO r VALUES ('P12', format('ended slot not saved: %s', v_res)); RETURN; END IF;
  UPDATE org_venue_facilities SET sections = 1 WHERE id = v_f2;
  BEGIN
    PERFORM club_practices_write(v_org, jsonb_build_array(jsonb_build_object(
      'teamId', v_team, 'programYearId', v_py, 'slotId', v_old_slot, 'startsAt', '2020-01-06T23:00:00Z', 'endsAt', '2020-01-07T00:30:00Z',
      'venueId', v_v, 'facilityId', v_f2, 'location', 'Check park', 'fieldNumber', 'Field 2', 'name', 'Practice')));
    SELECT section_mask INTO v_m FROM rep_team_events WHERE club_schedule_slot_id = v_old_slot;
    INSERT INTO r VALUES ('P12 a side the field no longer offers is written whole', CASE WHEN v_m = 0 THEN 'pass' ELSE format('mask %s', v_m) END);
  EXCEPTION WHEN check_violation THEN
    INSERT INTO r VALUES ('P12 a side the field no longer offers is written whole', SQLERRM);
  END;
END $$;
SELECT t, result FROM r ORDER BY t;
ROLLBACK;
