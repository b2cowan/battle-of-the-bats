-- DEV only. Club Tier Stage 11b Part 1 (mig 392): house league holds the club's time.
-- A slot is held by rep teams or by house league, never both; a full slot refuses either; a save and a hand edit move a
-- slot between the two holders; another club's season can't take a use; Practice time writes one practice per slot per
-- team and a second hand-out writes none twice; Send the changes carries a use and its practices to where the time moved
-- and refuses a live practice left on time house league no longer has. Part 3 (migs 394, 397): one Save applies whole or
-- not at all; a change names what it saw and what it gives; a no-op changes nothing.
-- Run: node scripts/db-query.mjs --dev -f scripts/club-stage11b-check.sql
-- The final exception rolls back every fixture row; the run passes only when it ends in CLUB_STAGE11B_PASSED.
DO $c11b$
DECLARE
  v_org uuid; v_other uuid; v_venue uuid; v_team uuid; v_sched uuid; v_draft uuid; v_ver integer;
  v_a uuid; v_b uuid; v_c uuid; v_d uuid; v_moved uuid; v_e uuid; v_f uuid; v_g uuid; v_season_b uuid; v_div_b uuid;
  v_season uuid; v_other_season uuid; v_div uuid; v_div2 uuid; v_t1 uuid; v_t2 uuid; v_send uuid;
  v_res jsonb; v_n integer; v_code text; v_p uuid; v_at timestamptz;
BEGIN
  INSERT INTO organizations(name, slug, plan_id)
  VALUES ('CHECK 11b', 'check-11b-' || substr(md5(random()::text), 1, 10), 'club') RETURNING id INTO v_org;
  INSERT INTO organizations(name, slug, plan_id)
  VALUES ('CHECK 11b other', 'check-11b-o-' || substr(md5(random()::text), 1, 10), 'club') RETURNING id INTO v_other;
  INSERT INTO org_venues(org_id, name) VALUES (v_org, 'CHECK park') RETURNING id INTO v_venue;
  INSERT INTO rep_teams(org_id, name, slug) VALUES (v_org, 'CHECK 13U', 'check-13u-' || substr(md5(random()::text), 1, 8))
    RETURNING id INTO v_team;
  INSERT INTO league_seasons(org_id, name, slug) VALUES (v_org, 'CHECK summer', 'check-summer') RETURNING id INTO v_season;
  INSERT INTO league_seasons(org_id, name, slug) VALUES (v_other, 'CHECK other', 'check-other') RETURNING id INTO v_other_season;
  INSERT INTO league_divisions(season_id, name, capacity) VALUES (v_season, 'U12', 20) RETURNING id INTO v_div;
  INSERT INTO league_divisions(season_id, name, capacity) VALUES (v_season, 'U9', 20) RETURNING id INTO v_div2;
  INSERT INTO league_teams(season_id, division_id, name) VALUES (v_season, v_div, 'Reds') RETURNING id INTO v_t1;
  INSERT INTO league_teams(season_id, division_id, name) VALUES (v_season, v_div, 'Blues') RETURNING id INTO v_t2;

  v_at := date_trunc('day', now()) + interval '8 days 18 hours';
  INSERT INTO club_schedules(org_id, name, starts_on, ends_on, state)
  VALUES (v_org, 'CHECK club time', current_date, current_date + 60, 'final') RETURNING id INTO v_sched;
  INSERT INTO club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
  VALUES (v_org, v_sched, v_venue, v_at, v_at + interval '3 hours') RETURNING id INTO v_a;
  INSERT INTO club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
  VALUES (v_org, v_sched, v_venue, v_at + interval '7 days', v_at + interval '7 days 3 hours') RETURNING id INTO v_b;
  INSERT INTO club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
  VALUES (v_org, v_sched, v_venue, v_at + interval '14 days', v_at + interval '14 days 90 minutes') RETURNING id INTO v_c;

  -- T1 · a slot house league holds can't take a team, and a slot a team holds can't take house league.
  INSERT INTO club_schedule_slot_programs(slot_id, program, org_id) VALUES (v_a, 'house_league', v_org);
  BEGIN
    INSERT INTO club_schedule_slot_teams(slot_id, team_id, org_id) VALUES (v_a, v_team, v_org); v_code := 'wrote';
  EXCEPTION WHEN raise_exception THEN v_code := split_part(SQLERRM, ':', 1); END;
  IF v_code IS DISTINCT FROM 'slot_both' THEN RAISE EXCEPTION 'FAIL T1: a team joined house league''s slot (%)', v_code; END IF;
  INSERT INTO club_schedule_slot_teams(slot_id, team_id, org_id) VALUES (v_c, v_team, v_org);
  BEGIN
    INSERT INTO club_schedule_slot_programs(slot_id, program, org_id) VALUES (v_c, 'house_league', v_org); v_code := 'wrote';
  EXCEPTION WHEN raise_exception THEN v_code := split_part(SQLERRM, ':', 1); END;
  IF v_code IS DISTINCT FROM 'slot_both' THEN RAISE EXCEPTION 'FAIL T1: house league joined a team''s slot (%)', v_code; END IF;
  BEGIN
    INSERT INTO club_schedule_slot_programs(slot_id, program, org_id) VALUES (v_b, 'house_league', v_other); v_code := 'wrote';
  EXCEPTION WHEN raise_exception THEN v_code := split_part(SQLERRM, ':', 1); END;
  IF v_code IS DISTINCT FROM 'slot_owner' THEN RAISE EXCEPTION 'FAIL T1: another club held this club''s slot (%)', v_code; END IF;

  -- T2 · a save naming both teams and house league on one slot is refused; a hand edit moves a slot between holders.
  SELECT version INTO v_ver FROM club_schedules WHERE id = v_sched;
  BEGIN
    v_res := club_schedule_save(v_org, v_sched, NULL, v_ver, jsonb_build_object('slots', jsonb_build_array(
      jsonb_build_object('venueId', v_venue, 'startsAt', v_at, 'endsAt', v_at + interval '3 hours',
                         'teamIds', jsonb_build_array(v_team), 'program', 'house_league'))));
    v_code := 'wrote';
  EXCEPTION WHEN raise_exception THEN v_code := split_part(SQLERRM, ':', 1); END;
  IF v_code IS DISTINCT FROM 'slot_both' THEN RAISE EXCEPTION 'FAIL T2: a save gave one slot to both (%)', v_code; END IF;
  v_res := club_schedule_edit_slots(v_org, v_sched, NULL, v_ver, jsonb_build_array(
    jsonb_build_object('slotId', v_c, 'teamIds', '[]'::jsonb, 'program', 'house_league')));
  IF NOT (v_res->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL T2: a team''s slot was not given to house league (%)', v_res; END IF;
  IF EXISTS (SELECT 1 FROM club_schedule_slot_teams WHERE slot_id = v_c)
     OR NOT EXISTS (SELECT 1 FROM club_schedule_slot_programs WHERE slot_id = v_c) THEN
    RAISE EXCEPTION 'FAIL T2: the hand edit left the wrong holder'; END IF;
  SELECT version INTO v_ver FROM club_schedules WHERE id = v_sched;
  v_res := club_schedule_edit_slots(v_org, v_sched, NULL, v_ver, jsonb_build_array(
    jsonb_build_object('slotId', v_c, 'teamIds', jsonb_build_array(v_team), 'program', NULL)));
  IF NOT (v_res->>'ok')::boolean OR EXISTS (SELECT 1 FROM club_schedule_slot_programs WHERE slot_id = v_c) THEN
    RAISE EXCEPTION 'FAIL T2: house league''s slot was not given back to the team (%)', v_res; END IF;
  IF NOT (SELECT changed_since_sent FROM club_schedules WHERE id = v_sched) THEN
    RAISE EXCEPTION 'FAIL T2: a final schedule''s holder change did not wait for Send the changes'; END IF;

  -- T3 · uses: another club's season can't take one; a slot house league doesn't hold can't; a draft's slot can't.
  INSERT INTO club_schedule_slot_programs(slot_id, program, org_id) VALUES (v_b, 'house_league', v_org);
  BEGIN
    INSERT INTO league_slot_uses(slot_id, org_id, season_id, division_id, kind)
    VALUES (v_a, v_org, v_other_season, v_div, 'games'); v_code := 'wrote';
  EXCEPTION WHEN raise_exception THEN v_code := split_part(SQLERRM, ':', 1); END;
  IF v_code IS DISTINCT FROM 'use_season' THEN RAISE EXCEPTION 'FAIL T3: another club''s season took a use (%)', v_code; END IF;
  v_res := league_slot_uses_set(v_org, v_other_season, NULL, ARRAY[v_a], v_div, 'games');
  IF v_res->>'code' IS DISTINCT FROM 'not_found' THEN RAISE EXCEPTION 'FAIL T3: the set took another club''s season (%)', v_res; END IF;
  v_res := league_slot_uses_set(v_org, v_season, NULL, ARRAY[v_c], v_div, 'games');
  IF v_res->>'code' IS DISTINCT FROM 'changed' THEN RAISE EXCEPTION 'FAIL T3: a team''s slot became house league''s (%)', v_res; END IF;
  INSERT INTO club_schedules(org_id, name, starts_on, ends_on) VALUES (v_org, 'CHECK draft', current_date, current_date + 60)
    RETURNING id INTO v_draft;
  INSERT INTO club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
  VALUES (v_org, v_draft, v_venue, v_at + interval '1 hour', v_at + interval '2 hours') RETURNING id INTO v_d;
  INSERT INTO club_schedule_slot_programs(slot_id, program, org_id) VALUES (v_d, 'house_league', v_org);
  v_res := league_slot_uses_set(v_org, v_season, NULL, ARRAY[v_d], v_div, 'practices');
  IF v_res->>'code' IS DISTINCT FROM 'changed' THEN RAISE EXCEPTION 'FAIL T3: a draft''s time was divided (%)', v_res; END IF;
  v_res := league_slot_uses_set(v_org, v_season, NULL, ARRAY[v_a, v_b], v_div, 'practices');
  IF NOT (v_res->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL T3: house league''s time was not divided (%)', v_res; END IF;

  -- T4 · Practice time writes one practice per slot per team; a second hand-out writes none twice.
  v_res := league_practices_hand_out(v_org, v_season, v_div, NULL, ARRAY[v_a, v_b], jsonb_build_array(
    jsonb_build_object('slotId', v_a, 'teamId', v_t1, 'scheduledAt', v_at, 'endsAt', v_at + interval '1 hour', 'venueId', v_venue),
    jsonb_build_object('slotId', v_a, 'teamId', v_t2, 'scheduledAt', v_at + interval '1 hour', 'endsAt', v_at + interval '2 hours', 'venueId', v_venue),
    jsonb_build_object('slotId', v_b, 'teamId', v_t2, 'scheduledAt', v_at + interval '7 days', 'endsAt', v_at + interval '7 days 1 hour', 'venueId', v_venue),
    jsonb_build_object('slotId', v_b, 'teamId', v_t1, 'scheduledAt', v_at + interval '7 days 1 hour', 'endsAt', v_at + interval '7 days 2 hours', 'venueId', v_venue)),
    '{"practiceMinutes": 60, "teamsAtOnce": 1}'::jsonb);
  IF NOT (v_res->>'ok')::boolean OR (v_res->>'written')::integer <> 4 THEN RAISE EXCEPTION 'FAIL T4: the hand-out (%)', v_res; END IF;
  v_res := league_practices_hand_out(v_org, v_season, v_div, NULL, ARRAY[v_a, v_b], jsonb_build_array(
    jsonb_build_object('slotId', v_a, 'teamId', v_t1, 'scheduledAt', v_at, 'endsAt', v_at + interval '1 hour', 'venueId', v_venue),
    jsonb_build_object('slotId', v_a, 'teamId', v_t2, 'scheduledAt', v_at + interval '1 hour', 'endsAt', v_at + interval '2 hours', 'venueId', v_venue),
    jsonb_build_object('slotId', v_b, 'teamId', v_t2, 'scheduledAt', v_at + interval '7 days', 'endsAt', v_at + interval '7 days 1 hour', 'venueId', v_venue),
    jsonb_build_object('slotId', v_b, 'teamId', v_t1, 'scheduledAt', v_at + interval '7 days 1 hour', 'endsAt', v_at + interval '7 days 2 hours', 'venueId', v_venue)),
    '{"practiceMinutes": 60, "teamsAtOnce": 1}'::jsonb);
  SELECT count(*) INTO v_n FROM league_practices WHERE club_schedule_slot_id IN (v_a, v_b);
  IF NOT (v_res->>'ok')::boolean OR v_n <> 4 THEN RAISE EXCEPTION 'FAIL T4: a second hand-out wrote % practice(s)', v_n; END IF;
  IF (SELECT practice_minutes FROM league_practice_time WHERE season_id = v_season AND division_id = v_div) <> 60 THEN
    RAISE EXCEPTION 'FAIL T4: Practice time''s settings were not kept'; END IF;

  -- T5 · the hand-out's floors: a practice outside its slot, two at once on a 1-at-once slot, a team twice at once, a
  -- team of another division, a slot that isn't this division's practice time.
  v_res := league_practices_hand_out(v_org, v_season, v_div, NULL, ARRAY[v_a], jsonb_build_array(
    jsonb_build_object('slotId', v_a, 'teamId', v_t1, 'scheduledAt', v_at + interval '150 minutes', 'endsAt', v_at + interval '210 minutes', 'venueId', v_venue)),
    '{"teamsAtOnce": 1}'::jsonb);
  IF v_res->>'code' IS DISTINCT FROM 'changed' THEN RAISE EXCEPTION 'FAIL T5: a practice ran past its slot (%)', v_res; END IF;
  BEGIN
    v_res := league_practices_hand_out(v_org, v_season, v_div, NULL, ARRAY[v_a], jsonb_build_array(
      jsonb_build_object('slotId', v_a, 'teamId', v_t1, 'scheduledAt', v_at, 'endsAt', v_at + interval '1 hour', 'venueId', v_venue),
      jsonb_build_object('slotId', v_a, 'teamId', v_t2, 'scheduledAt', v_at, 'endsAt', v_at + interval '1 hour', 'venueId', v_venue)),
      '{"teamsAtOnce": 1}'::jsonb);
    v_code := 'wrote';
  EXCEPTION WHEN raise_exception THEN v_code := split_part(SQLERRM, ':', 1); END;
  IF v_code IS DISTINCT FROM 'slot_full' THEN RAISE EXCEPTION 'FAIL T5: two practices at once on a 1-at-once slot (%)', v_code; END IF;
  -- (another club-time practice of the team's — mig 393: a practice booked by hand never refuses, see T11)
  INSERT INTO league_practices(season_id, division_id, team_id, org_id, scheduled_at, ends_at, status, club_schedule_slot_id)
  VALUES (v_season, v_div, v_t2, v_org, v_at + interval '7 days 30 minutes', v_at + interval '7 days 90 minutes', 'scheduled', v_c)
  RETURNING id INTO v_p;
  BEGIN
    v_res := league_practices_hand_out(v_org, v_season, v_div, NULL, ARRAY[v_b], jsonb_build_array(
      jsonb_build_object('slotId', v_b, 'teamId', v_t2, 'scheduledAt', v_at + interval '7 days', 'endsAt', v_at + interval '7 days 1 hour', 'venueId', v_venue)),
      '{"teamsAtOnce": 1}'::jsonb);
    v_code := 'wrote';
  EXCEPTION WHEN raise_exception THEN v_code := split_part(SQLERRM, ':', 1); END;
  IF v_code IS DISTINCT FROM 'team_twice' THEN RAISE EXCEPTION 'FAIL T5: a team had two practices at once (%)', v_code; END IF;
  DELETE FROM league_practices WHERE id = v_p;
  v_res := league_practices_hand_out(v_org, v_season, v_div2, NULL, ARRAY[v_a], '[]'::jsonb, '{}'::jsonb);
  IF v_res->>'code' IS DISTINCT FROM 'changed' THEN RAISE EXCEPTION 'FAIL T5: U9 handed out U12''s practice time (%)', v_res; END IF;

  -- T6 · giving a slot back to Not given yet takes its practices that haven't started.
  INSERT INTO club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
  VALUES (v_org, v_sched, v_venue, v_at + interval '21 days', v_at + interval '21 days 1 hour') RETURNING id INTO v_d;
  INSERT INTO club_schedule_slot_programs(slot_id, program, org_id) VALUES (v_d, 'house_league', v_org);
  v_res := league_slot_uses_set(v_org, v_season, NULL, ARRAY[v_d], v_div, 'practices');
  v_res := league_practices_hand_out(v_org, v_season, v_div, NULL, ARRAY[v_d], jsonb_build_array(
    jsonb_build_object('slotId', v_d, 'teamId', v_t1, 'scheduledAt', v_at + interval '21 days', 'endsAt', v_at + interval '21 days 1 hour', 'venueId', v_venue)),
    '{"teamsAtOnce": 1}'::jsonb);
  v_res := league_slot_uses_set(v_org, v_season, NULL, ARRAY[v_d], NULL, NULL);
  IF NOT (v_res->>'ok')::boolean OR (v_res->>'practicesRemoved')::integer <> 1
     OR EXISTS (SELECT 1 FROM league_practices WHERE club_schedule_slot_id = v_d)
     OR EXISTS (SELECT 1 FROM league_slot_uses WHERE slot_id = v_d) THEN
    RAISE EXCEPTION 'FAIL T6: giving the slot back (%)', v_res; END IF;

  -- T7 · the club moves slot A an hour later: the save soft-removes A (keeping house league's row) and makes the new
  -- slot; Send the changes carries A's use and both practices there, and A goes.
  SELECT version INTO v_ver FROM club_schedules WHERE id = v_sched;
  v_res := club_schedule_save(v_org, v_sched, NULL, v_ver, jsonb_build_object('slots', jsonb_build_array(
    jsonb_build_object('venueId', v_venue, 'startsAt', v_at + interval '1 hour', 'endsAt', v_at + interval '4 hours', 'program', 'house_league'),
    jsonb_build_object('venueId', v_venue, 'startsAt', v_at + interval '7 days', 'endsAt', v_at + interval '7 days 3 hours', 'program', 'house_league'),
    jsonb_build_object('venueId', v_venue, 'startsAt', v_at + interval '14 days', 'endsAt', v_at + interval '14 days 90 minutes', 'teamIds', jsonb_build_array(v_team)),
    jsonb_build_object('venueId', v_venue, 'startsAt', v_at + interval '21 days', 'endsAt', v_at + interval '21 days 1 hour', 'program', 'house_league'))));
  IF NOT (v_res->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL T7: the move''s save (%)', v_res; END IF;
  SELECT id INTO v_moved FROM club_schedule_slots WHERE schedule_id = v_sched AND starts_at = v_at + interval '1 hour';
  IF NOT EXISTS (SELECT 1 FROM club_schedule_slots WHERE id = v_a AND removed_at IS NOT NULL)
     OR NOT EXISTS (SELECT 1 FROM league_slot_uses WHERE slot_id = v_a)
     OR NOT EXISTS (SELECT 1 FROM club_schedule_slot_programs WHERE slot_id = v_moved) THEN
    RAISE EXCEPTION 'FAIL T7: the save did not keep the use waiting on the removed slot'; END IF;
  INSERT INTO club_schedule_sends(org_id, schedule_id, kind) VALUES (v_org, v_sched, 'changes') RETURNING id INTO v_send;
  SELECT version INTO v_ver FROM club_schedules WHERE id = v_sched;
  -- First, without the practices: the step refuses, since they would sit on a removed slot.
  BEGIN
    v_res := club_schedule_apply_changes(v_org, v_sched, NULL, v_ver, '[]'::jsonb, '[]'::jsonb, '{}'::uuid[], NULL, v_send,
                                         '{}'::jsonb, '[]'::jsonb, jsonb_build_object('uses', jsonb_build_array(
                                           jsonb_build_object('from', v_a, 'to', v_moved))));
    v_code := 'wrote';
  EXCEPTION WHEN raise_exception THEN v_code := split_part(SQLERRM, ':', 1); END;
  IF v_code IS DISTINCT FROM 'changed' THEN RAISE EXCEPTION 'FAIL T7: practices were left on a removed slot (%)', v_code; END IF;
  v_res := club_schedule_apply_changes(v_org, v_sched, NULL, v_ver, '[]'::jsonb, '[]'::jsonb, '{}'::uuid[], NULL, v_send,
    '{}'::jsonb, '[]'::jsonb, jsonb_build_object(
      'uses', jsonb_build_array(jsonb_build_object('from', v_a, 'to', v_moved)),
      'updates', (SELECT jsonb_agg(jsonb_build_object('practiceId', lp.id, 'slotId', v_moved,
                                   'scheduledAt', lp.scheduled_at + interval '1 hour', 'endsAt', lp.ends_at + interval '1 hour',
                                   'venueId', v_venue))
                    FROM league_practices lp WHERE lp.club_schedule_slot_id = v_a)));
  IF NOT (v_res->>'ok')::boolean OR (v_res->'league'->>'moved')::integer <> 2 OR (v_res->'league'->>'uses')::integer <> 1 THEN
    RAISE EXCEPTION 'FAIL T7: Send the changes (%)', v_res; END IF;
  IF EXISTS (SELECT 1 FROM club_schedule_slots WHERE id = v_a)
     OR (SELECT count(*) FROM league_practices WHERE club_schedule_slot_id = v_moved AND status = 'scheduled') <> 2
     OR NOT EXISTS (SELECT 1 FROM league_slot_uses WHERE slot_id = v_moved AND division_id = v_div AND kind = 'practices') THEN
    RAISE EXCEPTION 'FAIL T7: the use and practices did not follow the time'; END IF;

  -- T8 · the club takes slot B back for a rep team (in place): its use WAITS for Send the changes (mig 393), which refuses
  -- until the practices on it are cancelled; with them cancelled it lands, and the use goes.
  SELECT version INTO v_ver FROM club_schedules WHERE id = v_sched;
  v_res := club_schedule_edit_slots(v_org, v_sched, NULL, v_ver, jsonb_build_array(
    jsonb_build_object('slotId', v_b, 'teamIds', jsonb_build_array(v_team), 'program', NULL)));
  IF NOT (v_res->>'ok')::boolean OR NOT EXISTS (SELECT 1 FROM league_slot_uses WHERE slot_id = v_b) THEN
    RAISE EXCEPTION 'FAIL T8: taking the slot back lost its use before the send (%)', v_res; END IF;
  INSERT INTO club_schedule_sends(org_id, schedule_id, kind) VALUES (v_org, v_sched, 'changes') RETURNING id INTO v_send;
  SELECT version INTO v_ver FROM club_schedules WHERE id = v_sched;
  BEGIN
    v_res := club_schedule_apply_changes(v_org, v_sched, NULL, v_ver, '[]'::jsonb, '[]'::jsonb, '{}'::uuid[], NULL, v_send,
                                         '{}'::jsonb, '[]'::jsonb, NULL);
    v_code := 'wrote';
  EXCEPTION WHEN raise_exception THEN v_code := split_part(SQLERRM, ':', 1); END;
  IF v_code IS DISTINCT FROM 'changed' THEN RAISE EXCEPTION 'FAIL T8: practices stayed on a rep team''s slot (%)', v_code; END IF;
  v_res := club_schedule_apply_changes(v_org, v_sched, NULL, v_ver, '[]'::jsonb, '[]'::jsonb, '{}'::uuid[], NULL, v_send,
    '{}'::jsonb, '[]'::jsonb, jsonb_build_object('cancel',
      (SELECT jsonb_agg(lp.id) FROM league_practices lp WHERE lp.club_schedule_slot_id = v_b)));
  IF NOT (v_res->>'ok')::boolean OR (v_res->'league'->>'cancelled')::integer <> 2
     OR EXISTS (SELECT 1 FROM league_practices WHERE club_schedule_slot_id = v_b AND status <> 'cancelled')
     OR EXISTS (SELECT 1 FROM league_slot_uses WHERE slot_id = v_b) THEN
    RAISE EXCEPTION 'FAIL T8: the cancelled practices, or the use left behind (%)', v_res; END IF;

  -- T10 · a practice already HELD on time the club took back never blocks Send the changes (mig 393).
  INSERT INTO club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
  VALUES (v_org, v_sched, v_venue, now() - interval '3 days', now() - interval '3 days' + interval '1 hour') RETURNING id INTO v_c;
  INSERT INTO club_schedule_slot_programs(slot_id, program, org_id) VALUES (v_c, 'house_league', v_org);
  INSERT INTO league_practices(season_id, division_id, team_id, org_id, scheduled_at, ends_at, status, club_schedule_slot_id)
  VALUES (v_season, v_div, v_t1, v_org, now() - interval '3 days', now() - interval '3 days' + interval '1 hour', 'scheduled', v_c);
  DELETE FROM club_schedule_slot_programs WHERE slot_id = v_c;
  INSERT INTO club_schedule_sends(org_id, schedule_id, kind) VALUES (v_org, v_sched, 'changes') RETURNING id INTO v_send;
  SELECT version INTO v_ver FROM club_schedules WHERE id = v_sched;
  v_res := club_schedule_apply_changes(v_org, v_sched, NULL, v_ver, '[]'::jsonb, '[]'::jsonb, '{}'::uuid[], NULL, v_send,
                                       '{}'::jsonb, '[]'::jsonb, NULL);
  IF NOT (v_res->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL T10: a held practice blocked the send (%)', v_res; END IF;

  -- T11 · Practice time: a practice booked by hand never refuses a hand-out; the place is the SLOT's, not the request's;
  -- out-of-range settings are refused in words.
  INSERT INTO league_practices(season_id, division_id, team_id, org_id, scheduled_at, ends_at, status)
  VALUES (v_season, v_div, v_t1, v_org, v_at + interval '1 hour 30 minutes', v_at + interval '2 hours 30 minutes', 'scheduled');
  v_res := league_practices_hand_out(v_org, v_season, v_div, NULL, ARRAY[v_moved], jsonb_build_array(
    jsonb_build_object('slotId', v_moved, 'teamId', v_t1, 'scheduledAt', v_at + interval '1 hour', 'endsAt', v_at + interval '2 hours',
                       'venueId', gen_random_uuid(), 'facilityId', gen_random_uuid())),
    '{"practiceMinutes": 60, "teamsAtOnce": 1}'::jsonb);
  IF NOT (v_res->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL T11: a hand-booked practice refused the hand-out (%)', v_res; END IF;
  IF (SELECT org_venue_id FROM league_practices WHERE club_schedule_slot_id = v_moved AND team_id = v_t1) IS DISTINCT FROM v_venue THEN
    RAISE EXCEPTION 'FAIL T11: the practice took the request''s place, not the slot''s'; END IF;
  v_res := league_practices_hand_out(v_org, v_season, v_div, NULL, ARRAY[v_moved], '[]'::jsonb, '{"practiceMinutes": 999}'::jsonb);
  IF v_res->>'code' IS DISTINCT FROM 'bad_settings' THEN RAISE EXCEPTION 'FAIL T11: 999-minute practices (%)', v_res; END IF;

  -- T12 · one Save, whole (mig 394): a Save that gives one slot and gives another back applies both, removing the
  -- practices still to come on the time given back; a stale `from` anywhere applies nothing; another season's slot and a
  -- slot named twice refuse.
  INSERT INTO club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
  VALUES (v_org, v_sched, v_venue, v_at + interval '28 days', v_at + interval '28 days 1 hour') RETURNING id INTO v_e;
  INSERT INTO club_schedule_slot_programs(slot_id, program, org_id) VALUES (v_e, 'house_league', v_org);
  v_res := league_slot_uses_apply(v_org, v_season, NULL, jsonb_build_array(
    jsonb_build_object('slotId', v_e, 'from', NULL, 'to', jsonb_build_object('divisionId', v_div2, 'kind', 'games')),
    jsonb_build_object('slotId', v_moved, 'from', jsonb_build_object('divisionId', v_div, 'kind', 'practices'), 'to', NULL)));
  IF NOT (v_res->>'ok')::boolean OR (v_res->>'slots')::integer <> 2 OR (v_res->>'practicesRemoved')::integer < 1 THEN
    RAISE EXCEPTION 'FAIL T12: the mixed Save (%)', v_res; END IF;
  IF NOT EXISTS (SELECT 1 FROM league_slot_uses WHERE slot_id = v_e AND division_id = v_div2 AND kind = 'games')
     OR EXISTS (SELECT 1 FROM league_slot_uses WHERE slot_id = v_moved)
     OR EXISTS (SELECT 1 FROM league_practices WHERE club_schedule_slot_id = v_moved AND scheduled_at > now()) THEN
    RAISE EXCEPTION 'FAIL T12: the mixed Save left half of itself'; END IF;
  v_res := league_slot_uses_apply(v_org, v_season, NULL, jsonb_build_array(
    jsonb_build_object('slotId', v_moved, 'from', NULL, 'to', jsonb_build_object('divisionId', v_div, 'kind', 'games')),
    jsonb_build_object('slotId', v_e, 'from', NULL, 'to', jsonb_build_object('divisionId', v_div, 'kind', 'games'))));
  IF v_res->>'code' IS DISTINCT FROM 'changed' OR (v_res->>'slotId')::uuid IS DISTINCT FROM v_e THEN
    RAISE EXCEPTION 'FAIL T12: a stale from was not refused (%)', v_res; END IF;
  IF EXISTS (SELECT 1 FROM league_slot_uses WHERE slot_id = v_moved) THEN
    RAISE EXCEPTION 'FAIL T12: a refused Save wrote part of itself'; END IF;
  INSERT INTO league_seasons(org_id, name, slug) VALUES (v_org, 'CHECK fall', 'check-fall') RETURNING id INTO v_season_b;
  INSERT INTO league_divisions(season_id, name, capacity) VALUES (v_season_b, 'U10', 20) RETURNING id INTO v_div_b;
  INSERT INTO club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
  VALUES (v_org, v_sched, v_venue, v_at + interval '35 days', v_at + interval '35 days 1 hour') RETURNING id INTO v_f;
  INSERT INTO club_schedule_slot_programs(slot_id, program, org_id) VALUES (v_f, 'house_league', v_org);
  v_res := league_slot_uses_set(v_org, v_season_b, NULL, ARRAY[v_f], v_div_b, 'games');
  v_res := league_slot_uses_apply(v_org, v_season, NULL, jsonb_build_array(
    jsonb_build_object('slotId', v_f, 'from', jsonb_build_object('divisionId', v_div_b, 'kind', 'games'), 'to', NULL)));
  IF v_res->>'code' IS DISTINCT FROM 'changed' OR NOT EXISTS (SELECT 1 FROM league_slot_uses WHERE slot_id = v_f) THEN
    RAISE EXCEPTION 'FAIL T12: another season''s slot was taken (%)', v_res; END IF;
  v_res := league_slot_uses_apply(v_org, v_season, NULL, jsonb_build_array(
    jsonb_build_object('slotId', v_e, 'from', jsonb_build_object('divisionId', v_div2, 'kind', 'games'), 'to', NULL),
    jsonb_build_object('slotId', v_e, 'from', jsonb_build_object('divisionId', v_div2, 'kind', 'games'), 'to', NULL)));
  IF v_res->>'code' IS DISTINCT FROM 'bad_request' THEN RAISE EXCEPTION 'FAIL T12: a slot named twice (%)', v_res; END IF;
  v_res := league_slot_uses_apply(v_org, v_season, NULL, jsonb_build_array(
    jsonb_build_object('slotId', v_e, 'from', jsonb_build_object('divisionId', v_div2, 'kind', 'games'),
                       'to', jsonb_build_object('divisionId', v_div_b, 'kind', 'games'))));
  IF v_res->>'code' IS DISTINCT FROM 'not_found' THEN RAISE EXCEPTION 'FAIL T12: another season''s division took time (%)', v_res; END IF;

  -- T13 · the /review of 394 (mig 397): a change missing `from` or `to` is refused; a change to what the slot already
  -- holds changes nothing, practices included.
  v_res := league_slot_uses_apply(v_org, v_season, NULL, jsonb_build_array(jsonb_build_object('slotId', v_e, 'from', NULL)));
  IF v_res->>'code' IS DISTINCT FROM 'bad_request' THEN RAISE EXCEPTION 'FAIL T13: a change with no to (%)', v_res; END IF;
  v_res := league_slot_uses_apply(v_org, v_season, NULL, jsonb_build_array(jsonb_build_object('slotId', v_e, 'to', NULL)));
  IF v_res->>'code' IS DISTINCT FROM 'bad_request' THEN RAISE EXCEPTION 'FAIL T13: a change with no from (%)', v_res; END IF;
  INSERT INTO club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
  VALUES (v_org, v_sched, v_venue, v_at + interval '42 days', v_at + interval '42 days 1 hour') RETURNING id INTO v_g;
  INSERT INTO club_schedule_slot_programs(slot_id, program, org_id) VALUES (v_g, 'house_league', v_org);
  INSERT INTO league_practices(season_id, division_id, team_id, org_id, scheduled_at, ends_at, status, club_schedule_slot_id)
  VALUES (v_season, v_div, v_t1, v_org, v_at + interval '42 days', v_at + interval '42 days 1 hour', 'scheduled', v_g);
  v_res := league_slot_uses_apply(v_org, v_season, NULL, jsonb_build_array(jsonb_build_object('slotId', v_g, 'from', NULL, 'to', NULL)));
  IF NOT (v_res->>'ok')::boolean OR (v_res->>'practicesRemoved')::integer <> 0
     OR NOT EXISTS (SELECT 1 FROM league_practices WHERE club_schedule_slot_id = v_g) THEN
    RAISE EXCEPTION 'FAIL T13: a no-op change removed practices (%)', v_res; END IF;

  -- T9 · a finished season divides nothing and hands out nothing.
  UPDATE league_seasons SET status = 'completed' WHERE id = v_season;
  v_res := league_slot_uses_set(v_org, v_season, NULL, ARRAY[v_moved], NULL, NULL);
  IF v_res->>'code' IS DISTINCT FROM 'season_closed' THEN RAISE EXCEPTION 'FAIL T9: a finished season changed its time (%)', v_res; END IF;
  v_res := league_slot_uses_apply(v_org, v_season, NULL, jsonb_build_array(
    jsonb_build_object('slotId', v_e, 'from', jsonb_build_object('divisionId', v_div2, 'kind', 'games'), 'to', NULL)));
  IF v_res->>'code' IS DISTINCT FROM 'season_closed' THEN RAISE EXCEPTION 'FAIL T9: a finished season saved a piece (%)', v_res; END IF;

  RAISE EXCEPTION 'CLUB_STAGE11B_PASSED';
END $c11b$;
