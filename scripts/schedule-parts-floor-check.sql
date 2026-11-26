-- Club schedules Stage 2, Session 2A (mig 541): a field in parts — the floor, the legal parts, the split lock.
-- Rolled back; run on dev with
--   node scripts/db-query.mjs --dev -f scripts/schedule-parts-floor-check.sql
-- Each T row is 'pass' or says what it found. The fixture is any club schedule on dev and two fields at one of the
-- club's venues; every slot is in 2099 (or 2001 for the past-booking case) so nothing real is met, and every edit,
-- including the fields' splits, is rolled back with everything else.
BEGIN;
-- The floor is deferred to commit (mig 541); this check rolls back, so it asks for it at each statement instead.
SET CONSTRAINTS public.club_schedule_slots_family_place_overlap IMMEDIATE;
CREATE TEMP TABLE r(t text, result text) ON COMMIT DROP;
DO $$
DECLARE
  v_org uuid; v_sched uuid; v_v uuid; v_f uuid; v_f2 uuid; v_f3 uuid; v_id uuid; v_id2 uuid;
  v_block uuid; v_pblock uuid; v_pfac uuid; v_ev uuid; v_mask smallint;
  t0 timestamptz := '2099-01-05 23:00+00';
BEGIN
  SELECT s.id, s.org_id INTO v_sched, v_org FROM club_schedules s
   WHERE EXISTS (SELECT 1 FROM org_venues v JOIN org_venue_facilities f ON f.org_venue_id = v.id
                  WHERE v.org_id = s.org_id GROUP BY v.id HAVING count(*) >= 3)
   ORDER BY s.created_at LIMIT 1;
  IF v_sched IS NULL THEN INSERT INTO r VALUES ('setup', 'no schedule at a club with a venue of three fields'); RETURN; END IF;
  SELECT v.id INTO v_v FROM org_venues v WHERE v.org_id = v_org
     AND (SELECT count(*) FROM org_venue_facilities f WHERE f.org_venue_id = v.id) >= 3 ORDER BY v.id LIMIT 1;
  SELECT id INTO v_f  FROM org_venue_facilities WHERE org_venue_id = v_v ORDER BY id LIMIT 1;
  SELECT id INTO v_f2 FROM org_venue_facilities WHERE org_venue_id = v_v AND id <> v_f ORDER BY id LIMIT 1;
  SELECT id INTO v_f3 FROM org_venue_facilities WHERE org_venue_id = v_v AND id NOT IN (v_f, v_f2) ORDER BY id LIMIT 1;

  -- T0 a split is 1, 2 or 4.
  BEGIN
    UPDATE org_venue_facilities SET sections = 3 WHERE id = v_f;
    INSERT INTO r VALUES ('T00 three parts refused', 'NOT refused');
  EXCEPTION WHEN check_violation THEN INSERT INTO r VALUES ('T00 three parts refused', 'pass'); END;

  UPDATE org_venue_facilities SET sections = 4 WHERE id = v_f;   -- free: nothing names a part of it

  -- T1 a whole field and a part at one time: refused.
  INSERT INTO club_schedule_slots (org_id, schedule_id, org_venue_id, facility_id, starts_at, ends_at, section_mask)
  VALUES (v_org, v_sched, v_v, v_f, t0, t0 + interval '90 minutes', 0);
  BEGIN
    INSERT INTO club_schedule_slots (org_id, schedule_id, org_venue_id, facility_id, starts_at, ends_at, section_mask)
    VALUES (v_org, v_sched, v_v, v_f, t0 + interval '30 minutes', t0 + interval '2 hours', 3);
    INSERT INTO r VALUES ('T01 whole and a part refused', 'NOT refused');
  EXCEPTION WHEN exclusion_violation THEN INSERT INTO r VALUES ('T01 whole and a part refused', 'pass'); END;

  -- T2 quarter A beside quarters A–B: refused.
  INSERT INTO club_schedule_slots (org_id, schedule_id, org_venue_id, facility_id, starts_at, ends_at, section_mask)
  VALUES (v_org, v_sched, v_v, v_f, t0 + interval '1 day', t0 + interval '1 day 90 minutes', 1);
  BEGIN
    INSERT INTO club_schedule_slots (org_id, schedule_id, org_venue_id, facility_id, starts_at, ends_at, section_mask)
    VALUES (v_org, v_sched, v_v, v_f, t0 + interval '1 day', t0 + interval '1 day 90 minutes', 3);
    INSERT INTO r VALUES ('T02 A beside A-B refused', 'NOT refused');
  EXCEPTION WHEN exclusion_violation THEN INSERT INTO r VALUES ('T02 A beside A-B refused', 'pass'); END;

  -- T3 quarters A–B beside C–D, and quarter B beside A: both allowed.
  BEGIN
    INSERT INTO club_schedule_slots (org_id, schedule_id, org_venue_id, facility_id, starts_at, ends_at, section_mask)
    VALUES (v_org, v_sched, v_v, v_f, t0 + interval '2 days', t0 + interval '2 days 90 minutes', 3),
           (v_org, v_sched, v_v, v_f, t0 + interval '2 days', t0 + interval '2 days 90 minutes', 12),
           (v_org, v_sched, v_v, v_f, t0 + interval '1 day', t0 + interval '1 day 90 minutes', 2);
    INSERT INTO r VALUES ('T03 parts on different ground allowed', 'pass');
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('T03 parts on different ground allowed', SQLERRM); END;

  -- T4 B–C is never a part.
  BEGIN
    INSERT INTO club_schedule_slots (org_id, schedule_id, org_venue_id, facility_id, starts_at, ends_at, section_mask)
    VALUES (v_org, v_sched, v_v, v_f, t0 + interval '3 days', t0 + interval '3 days 90 minutes', 6);
    INSERT INTO r VALUES ('T04 B-C refused', 'NOT refused');
  EXCEPTION WHEN check_violation THEN INSERT INTO r VALUES ('T04 B-C refused', 'pass'); END;

  -- T5 a quarter on a field in two sides: refused in words.
  UPDATE org_venue_facilities SET sections = 2 WHERE id = v_f2;
  BEGIN
    INSERT INTO club_schedule_slots (org_id, schedule_id, org_venue_id, facility_id, starts_at, ends_at, section_mask)
    VALUES (v_org, v_sched, v_v, v_f2, t0, t0 + interval '90 minutes', 1);
    INSERT INTO r VALUES ('T05 a quarter on two sides refused', 'NOT refused');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO r VALUES ('T05 a quarter on two sides refused', CASE WHEN SQLERRM LIKE 'part_illegal:%' THEN 'pass' ELSE SQLERRM END);
  END;

  -- T6 a split change while a part still to come is booked: refused (round 2 Ask 7 A, any change).
  BEGIN
    UPDATE org_venue_facilities SET sections = 2 WHERE id = v_f;
    INSERT INTO r VALUES ('T06 split change while booked refused', 'NOT refused');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO r VALUES ('T06 split change while booked refused', CASE WHEN SQLERRM LIKE 'split_locked:%' THEN 'pass' ELSE SQLERRM END);
  END;

  -- T7 only whole-field bookings: the split is free.
  INSERT INTO club_schedule_slots (org_id, schedule_id, org_venue_id, facility_id, starts_at, ends_at, section_mask)
  VALUES (v_org, v_sched, v_v, v_f2, t0, t0 + interval '90 minutes', 0);
  BEGIN
    UPDATE org_venue_facilities SET sections = 4 WHERE id = v_f2;
    INSERT INTO r VALUES ('T07 split free with only whole bookings', 'pass');
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('T07 split free with only whole bookings', SQLERRM); END;

  -- T8 a PAST part does not lock the split (owner 2026-11-25: bookings still to come).
  UPDATE org_venue_facilities SET sections = 2 WHERE id = v_f3;
  INSERT INTO club_schedule_slots (org_id, schedule_id, org_venue_id, facility_id, starts_at, ends_at, section_mask)
  VALUES (v_org, v_sched, v_v, v_f3, '2001-06-05 23:00+00', '2001-06-06 00:30+00', 3);
  BEGIN
    UPDATE org_venue_facilities SET sections = 1 WHERE id = v_f3;
    INSERT INTO r VALUES ('T08 a past part does not lock', 'pass');
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('T08 a past part does not lock', SQLERRM); END;

  -- T9 a removed slot is not on the floor (a final schedule keeps it until Send the changes).
  INSERT INTO club_schedule_slots (org_id, schedule_id, org_venue_id, facility_id, starts_at, ends_at, section_mask, removed_at)
  VALUES (v_org, v_sched, v_v, v_f2, t0 + interval '5 days', t0 + interval '5 days 90 minutes', 0, now());
  BEGIN
    INSERT INTO club_schedule_slots (org_id, schedule_id, org_venue_id, facility_id, starts_at, ends_at, section_mask)
    VALUES (v_org, v_sched, v_v, v_f2, t0 + interval '5 days 30 minutes', t0 + interval '5 days 2 hours', 0);
    INSERT INTO r VALUES ('T09 a removed slot does not block', 'pass');
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('T09 a removed slot does not block', SQLERRM); END;

  -- T10 deferred: a save that lands the moved slot before it deletes the old one passes at the end; a real overlap
  -- still fails when checked.
  INSERT INTO club_schedule_slots (org_id, schedule_id, org_venue_id, facility_id, starts_at, ends_at, section_mask)
  VALUES (v_org, v_sched, v_v, v_f2, t0 + interval '6 days', t0 + interval '6 days 90 minutes', 0) RETURNING id INTO v_id;
  SET CONSTRAINTS public.club_schedule_slots_family_place_overlap DEFERRED;
  INSERT INTO club_schedule_slots (org_id, schedule_id, org_venue_id, facility_id, starts_at, ends_at, section_mask)
  VALUES (v_org, v_sched, v_v, v_f2, t0 + interval '6 days 30 minutes', t0 + interval '6 days 2 hours', 0) RETURNING id INTO v_id2;
  DELETE FROM club_schedule_slots WHERE id = v_id;
  BEGIN
    SET CONSTRAINTS public.club_schedule_slots_family_place_overlap IMMEDIATE;
    INSERT INTO r VALUES ('T10a a shift passes at the end', 'pass');
  EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('T10a a shift passes at the end', SQLERRM); END;
  SET CONSTRAINTS public.club_schedule_slots_family_place_overlap DEFERRED;
  BEGIN
    -- Inside the block, so the refusal rolls the overlapping row back with it.
    INSERT INTO club_schedule_slots (org_id, schedule_id, org_venue_id, facility_id, starts_at, ends_at, section_mask)
    VALUES (v_org, v_sched, v_v, v_f2, t0 + interval '6 days 60 minutes', t0 + interval '6 days 3 hours', 0);
    SET CONSTRAINTS public.club_schedule_slots_family_place_overlap IMMEDIATE;
    INSERT INTO r VALUES ('T10b an overlap left at the end fails', 'NOT refused');
  EXCEPTION WHEN exclusion_violation THEN INSERT INTO r VALUES ('T10b an overlap left at the end fails', 'pass'); END;
  SET CONSTRAINTS public.club_schedule_slots_family_place_overlap IMMEDIATE;

  -- T11 a permit's block never names a part.
  SELECT b.id, f.id INTO v_pblock, v_pfac FROM org_time_blocks b JOIN org_venue_facilities f ON f.org_venue_id = b.org_venue_id
   WHERE b.permit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM org_time_block_facilities x WHERE x.block_id = b.id AND x.facility_id = f.id)
   ORDER BY b.id, f.id LIMIT 1;
  IF v_pblock IS NULL THEN INSERT INTO r VALUES ('T11 a part on a permit refused', 'no permit block to try');
  ELSE
    UPDATE org_venue_facilities SET sections = 2 WHERE id = v_pfac AND sections = 1;
    BEGIN
      INSERT INTO org_time_block_facilities (block_id, facility_id, org_id, section_mask)
      SELECT v_pblock, v_pfac, b.org_id, 3 FROM org_time_blocks b WHERE b.id = v_pblock;
      INSERT INTO r VALUES ('T11 a part on a permit refused', 'NOT refused');
    EXCEPTION WHEN check_violation THEN
      INSERT INTO r VALUES ('T11 a part on a permit refused', CASE WHEN SQLERRM LIKE 'part_on_permit:%' THEN 'pass' ELSE SQLERRM END);
    END;
  END IF;

  -- T12 a schedule's row of time: A and C–D together are fine; A beside A–B is refused.
  SELECT b.id INTO v_block FROM org_time_blocks b WHERE b.schedule_id IS NOT NULL AND b.org_venue_id = v_v ORDER BY b.id LIMIT 1;
  IF v_block IS NULL THEN INSERT INTO r VALUES ('T12 one ground once per row', 'no schedule block at the venue');
  ELSE
    DELETE FROM org_time_block_facilities WHERE block_id = v_block AND facility_id = v_f;
    BEGIN
      INSERT INTO org_time_block_facilities (block_id, facility_id, org_id, section_mask) VALUES (v_block, v_f, v_org, 1), (v_block, v_f, v_org, 12);
      BEGIN
        INSERT INTO org_time_block_facilities (block_id, facility_id, org_id, section_mask) VALUES (v_block, v_f, v_org, 3);
        INSERT INTO r VALUES ('T12 one ground once per row', 'A beside A-B NOT refused');
      EXCEPTION WHEN check_violation THEN
        INSERT INTO r VALUES ('T12 one ground once per row', CASE WHEN SQLERRM LIKE 'part_overlap:%' THEN 'pass' ELSE SQLERRM END);
      END;
    EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('T12 one ground once per row', 'A and C-D: ' || SQLERRM); END;
  END IF;

  -- T13 a field cleared off a rep event takes its part with it (what ON DELETE SET NULL does).
  SELECT id INTO v_ev FROM rep_team_events WHERE org_id = v_org ORDER BY id LIMIT 1;
  IF v_ev IS NULL THEN INSERT INTO r VALUES ('T13 a cleared field clears its part', 'no rep event at the club');
  ELSE
    UPDATE rep_team_events SET org_venue_id = v_v, place_id = NULL, org_venue_facility_id = v_f, section_mask = 3 WHERE id = v_ev;
    UPDATE rep_team_events SET org_venue_facility_id = NULL WHERE id = v_ev;
    SELECT section_mask INTO v_mask FROM rep_team_events WHERE id = v_ev;
    INSERT INTO r VALUES ('T13 a cleared field clears its part', CASE WHEN v_mask = 0 THEN 'pass' ELSE 'mask stayed ' || v_mask END);
  END IF;

  -- T14 a part with no field is refused on a booking table.
  BEGIN
    UPDATE rep_team_events SET org_venue_facility_id = NULL, section_mask = 3 WHERE id = v_ev;
    INSERT INTO r VALUES ('T14 a part without its field refused', CASE WHEN v_ev IS NULL THEN 'no rep event' ELSE 'NOT refused' END);
  EXCEPTION WHEN check_violation THEN INSERT INTO r VALUES ('T14 a part without its field refused', 'pass'); END;

  -- T15 the lock's question, as the venue list's route asks it.
  INSERT INTO r VALUES ('T15 parts_booked reads the upcoming part', CASE WHEN org_venue_facility_parts_booked(v_f)
    AND NOT org_venue_facility_parts_booked(v_f3) THEN 'pass' ELSE 'differs' END);
END $$;
SELECT * FROM r ORDER BY t;
ROLLBACK;
