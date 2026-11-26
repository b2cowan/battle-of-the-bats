-- Club schedules Stage 2, Session 2B (mig 544): the save stores each slot's part and each row's parts.
-- Rolled back; run on dev (after mig 544 is applied) with
--   node scripts/db-query.mjs --dev -f scripts/schedule-parts-save-check.sql
-- Each S row is 'pass' or says what it found. The fixture is any club on dev with a venue of two fields and a member
-- who made a schedule there; the schedule it saves runs in 2099 so nothing real is met, and every edit, including the
-- field's split, is rolled back with everything else.
BEGIN;
-- The floor is deferred to commit (mig 541); this check rolls back, so it asks for it at each statement instead.
SET CONSTRAINTS public.club_schedule_slots_family_place_overlap IMMEDIATE;
CREATE TEMP TABLE r(t text, result text) ON COMMIT DROP;
DO $$
DECLARE
  v_org uuid; v_actor uuid; v_v uuid; v_f uuid; v_f2 uuid; v_res jsonb; v_id uuid; v_ver integer;
  v_ids uuid[]; v_ids2 uuid[]; v_n integer; v_masks smallint[]; v_keep uuid;
  v_data jsonb;
  t0 text := '2099-01-04T23:00:00Z'; t1 text := '2099-01-05T00:30:00Z';
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

  -- A schedule: one row naming v_f in two sides and v_f2 whole; three slots at one start (side A, side B, v_f2).
  v_data := jsonb_build_object(
    'name', 'Parts save check', 'startsOn', '2099-01-01', 'endsOn', '2099-03-01', 'settings', '{}'::jsonb,
    'blocks', jsonb_build_array(jsonb_build_object('venueId', v_v, 'facilityIds', jsonb_build_array(v_f, v_f2),
      'parts', jsonb_build_object(v_f::text, jsonb_build_array(3, 12)),
      'weekdays', jsonb_build_array(7), 'startTime', '18:00', 'endTime', '19:30')),
    'datesOff', '[]'::jsonb,
    'slots', jsonb_build_array(
      jsonb_build_object('venueId', v_v, 'facilityId', v_f, 'sectionMask', 3, 'startsAt', t0, 'endsAt', t1, 'blockIndex', 0, 'teamIds', '[]'::jsonb),
      jsonb_build_object('venueId', v_v, 'facilityId', v_f, 'sectionMask', 12, 'startsAt', t0, 'endsAt', t1, 'blockIndex', 0, 'teamIds', '[]'::jsonb),
      jsonb_build_object('venueId', v_v, 'facilityId', v_f2, 'startsAt', t0, 'endsAt', t1, 'blockIndex', 0, 'teamIds', '[]'::jsonb)));

  -- S1 a new schedule: two sides at one start are two slots, each with its part; the whole field's slot is 0.
  v_res := club_schedule_save(v_org, NULL, v_actor, 0, v_data);
  v_id := (v_res->>'id')::uuid; v_ver := (v_res->>'version')::integer;
  SELECT array_agg(section_mask ORDER BY section_mask) INTO v_masks FROM club_schedule_slots WHERE schedule_id = v_id AND facility_id = v_f;
  SELECT count(*) INTO v_n FROM club_schedule_slots WHERE schedule_id = v_id AND facility_id = v_f2 AND section_mask = 0;
  INSERT INTO r VALUES ('S01 two sides at one start are two slots', CASE WHEN v_masks = '{3,12}' AND v_n = 1 THEN 'pass' ELSE format('masks %s, whole %s', v_masks, v_n) END);

  -- S2 the row's facility rows: one per part on the split field, one whole on the other.
  SELECT array_agg(bf.section_mask ORDER BY bf.section_mask) INTO v_masks FROM org_time_block_facilities bf
    JOIN org_time_blocks b ON b.id = bf.block_id WHERE b.schedule_id = v_id AND bf.facility_id = v_f;
  SELECT count(*) INTO v_n FROM org_time_block_facilities bf JOIN org_time_blocks b ON b.id = bf.block_id
   WHERE b.schedule_id = v_id AND bf.facility_id = v_f2 AND bf.section_mask = 0;
  INSERT INTO r VALUES ('S02 the row names each side, and the other field whole', CASE WHEN v_masks = '{3,12}' AND v_n = 1 THEN 'pass' ELSE format('masks %s, whole %s', v_masks, v_n) END);

  -- S3 the same save again: every slot is found by its place, part and start — the same ids, no new rows.
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM club_schedule_slots WHERE schedule_id = v_id;
  v_res := club_schedule_save(v_org, v_id, v_actor, v_ver, v_data);
  v_ver := (v_res->>'version')::integer;
  SELECT array_agg(id ORDER BY id) INTO v_ids2 FROM club_schedule_slots WHERE schedule_id = v_id;
  INSERT INTO r VALUES ('S03 a re-save finds each part''s own slot', CASE WHEN v_res->>'ok' = 'true' AND v_ids = v_ids2 THEN 'pass' ELSE format('%s → %s (%s)', v_ids, v_ids2, v_res) END);

  -- S4 a save from an older client (no 'parts', no 'sectionMask'): whole, as before. A fresh schedule on v_f2 only.
  v_res := club_schedule_save(v_org, NULL, v_actor, 0, jsonb_build_object(
    'name', 'Parts save check, old client', 'startsOn', '2099-01-01', 'endsOn', '2099-03-01', 'settings', '{}'::jsonb,
    'blocks', jsonb_build_array(jsonb_build_object('venueId', v_v, 'facilityIds', jsonb_build_array(v_f2),
      'weekdays', jsonb_build_array(1), 'startTime', '18:00', 'endTime', '19:30')),
    'datesOff', '[]'::jsonb,
    'slots', jsonb_build_array(jsonb_build_object('venueId', v_v, 'facilityId', v_f2, 'startsAt', '2099-01-05T23:00:00Z', 'endsAt', '2099-01-06T00:30:00Z', 'blockIndex', 0, 'teamIds', '[]'::jsonb))));
  SELECT count(*) INTO v_n FROM club_schedule_slots WHERE schedule_id = (v_res->>'id')::uuid AND section_mask = 0;
  INSERT INTO r VALUES ('S04 an older save stores the whole field', CASE WHEN v_n = 1 THEN 'pass' ELSE format('%s whole slots', v_n) END);

  -- S5 a row naming side A beside the whole field: refused (part_overlap).
  BEGIN
    PERFORM club_schedule_save(v_org, v_id, v_actor, v_ver, jsonb_build_object('blocks', jsonb_build_array(jsonb_build_object(
      'venueId', v_v, 'facilityIds', jsonb_build_array(v_f), 'parts', jsonb_build_object(v_f::text, jsonb_build_array(0, 3)),
      'weekdays', jsonb_build_array(7), 'startTime', '18:00', 'endTime', '19:30'))));
    INSERT INTO r VALUES ('S05 a part beside its whole field refused', 'NOT refused');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO r VALUES ('S05 a part beside its whole field refused', CASE WHEN SQLERRM LIKE 'part_overlap%' THEN 'pass' ELSE SQLERRM END);
  END;

  -- S6 a row naming a quarter of a field in two sides: refused (part_illegal).
  BEGIN
    PERFORM club_schedule_save(v_org, v_id, v_actor, v_ver, jsonb_build_object('blocks', jsonb_build_array(jsonb_build_object(
      'venueId', v_v, 'facilityIds', jsonb_build_array(v_f), 'parts', jsonb_build_object(v_f::text, jsonb_build_array(1)),
      'weekdays', jsonb_build_array(7), 'startTime', '18:00', 'endTime', '19:30'))));
    INSERT INTO r VALUES ('S06 a part the split doesn''t offer refused', 'NOT refused');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO r VALUES ('S06 a part the split doesn''t offer refused', CASE WHEN SQLERRM LIKE 'part_illegal%' THEN 'pass' ELSE SQLERRM END);
  END;

  -- S7 a save putting the whole field beside side A at one start: refused by the floor (23P01).
  BEGIN
    PERFORM club_schedule_save(v_org, v_id, v_actor, v_ver, jsonb_build_object('slots', jsonb_build_array(
      jsonb_build_object('venueId', v_v, 'facilityId', v_f, 'sectionMask', 3, 'startsAt', t0, 'endsAt', t1, 'blockIndex', 0, 'teamIds', '[]'::jsonb),
      jsonb_build_object('venueId', v_v, 'facilityId', v_f, 'startsAt', t0, 'endsAt', t1, 'blockIndex', 0, 'teamIds', '[]'::jsonb))));
    INSERT INTO r VALUES ('S07 the whole field beside its side refused', 'NOT refused');
  EXCEPTION WHEN exclusion_violation THEN INSERT INTO r VALUES ('S07 the whole field beside its side refused', 'pass'); END;

  -- S8 a save that drops side B: on a draft its slot goes; side A's stays with its id.
  SELECT id INTO v_keep FROM club_schedule_slots WHERE schedule_id = v_id AND facility_id = v_f AND section_mask = 3;
  v_res := club_schedule_save(v_org, v_id, v_actor, v_ver, jsonb_build_object('slots', jsonb_build_array(
    jsonb_build_object('venueId', v_v, 'facilityId', v_f, 'sectionMask', 3, 'startsAt', t0, 'endsAt', t1, 'blockIndex', 0, 'teamIds', '[]'::jsonb))));
  SELECT count(*) INTO v_n FROM club_schedule_slots WHERE schedule_id = v_id;
  INSERT INTO r VALUES ('S08 dropping one side keeps the other''s slot', CASE WHEN v_res->>'ok' = 'true' AND v_n = 1
    AND EXISTS (SELECT 1 FROM club_schedule_slots WHERE id = v_keep) THEN 'pass' ELSE format('%s slots left (%s)', v_n, v_res) END);
END $$;
SELECT t, result FROM r ORDER BY t;
ROLLBACK;
