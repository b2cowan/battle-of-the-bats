-- DEV only. House League Stage 9d-2b Part 5 (mig 411): a division's games follow the club's time (9d2·13, 9d2·16).
-- The club's Send the changes takes `p_league.games` in the exact shape lib/club-schedule-league-plan.ts produces:
-- a published division's game moves with its time and waits as the CLUB's held change (moved_from kept), one on time taken
-- back goes to Needs a new date, a draft's moves silently or comes off the draft, a played or cancelled game stays; the
-- step leaves no "club" source set behind it; Undo refuses the club's change; a game left on time house league no longer
-- has, a removed published game and a move outside its slot are each refused `changed`.
-- Run: node scripts/db-query.mjs --dev -f scripts/house-league-9d2b-part5-check.sql
-- The final exception rolls back every fixture row; the run passes only when it ends in HL_9D2B_PART5_PASSED.
DO $p5$
DECLARE
  v_org uuid; v_venue uuid; v_venue2 uuid; v_sched uuid; v_send uuid; v_ver integer; v_at timestamptz;
  v_season uuid; v_u12 uuid; v_u9 uuid; v_r uuid; v_b uuid; v_g uuid; v_y uuid;
  v_s1 uuid; v_s1b uuid; v_s2 uuid; v_s3 uuid; v_s4 uuid; v_s4b uuid; v_s5 uuid;
  v_g1 uuid; v_g2 uuid; v_g3 uuid; v_g4 uuid; v_g5 uuid; v_g6 uuid; v_g7 uuid;
  v_res jsonb; v_code text; v_ch league_game_changes%ROWTYPE;
BEGIN
  INSERT INTO organizations(name, slug, plan_id)
  VALUES ('CHECK 9d2b5', 'check-9d2b5-' || substr(md5(random()::text), 1, 10), 'club') RETURNING id INTO v_org;
  INSERT INTO org_venues(org_id, name) VALUES (v_org, 'CHECK park') RETURNING id INTO v_venue;
  INSERT INTO org_venues(org_id, name) VALUES (v_org, 'CHECK dome') RETURNING id INTO v_venue2;
  INSERT INTO league_seasons(org_id, name, slug) VALUES (v_org, 'CHECK summer', 'check-summer') RETURNING id INTO v_season;
  INSERT INTO league_divisions(season_id, name, capacity) VALUES (v_season, 'U12', 20) RETURNING id INTO v_u12;
  INSERT INTO league_divisions(season_id, name, capacity) VALUES (v_season, 'U9', 20) RETURNING id INTO v_u9;
  INSERT INTO league_teams(season_id, division_id, name) VALUES (v_season, v_u12, 'Reds') RETURNING id INTO v_r;
  INSERT INTO league_teams(season_id, division_id, name) VALUES (v_season, v_u12, 'Blues') RETURNING id INTO v_b;
  INSERT INTO league_teams(season_id, division_id, name) VALUES (v_season, v_u9, 'Greens') RETURNING id INTO v_g;
  INSERT INTO league_teams(season_id, division_id, name) VALUES (v_season, v_u9, 'Golds') RETURNING id INTO v_y;

  v_at := date_trunc('day', now()) + interval '8 days 18 hours';
  INSERT INTO club_schedules(org_id, name, starts_on, ends_on, state)
  VALUES (v_org, 'CHECK club time', current_date, current_date + 60, 'final') RETURNING id INTO v_sched;
  -- s1 · U12 games, moved 90 minutes later to the dome (s1b). s2 · U12 games, taken back.
  -- s3 · U9 games, taken back. s4 · U9 games, moved a day later (s4b). s5 · U12 games, taken back (the refusals).
  INSERT INTO club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
  VALUES (v_org, v_sched, v_venue, v_at, v_at + interval '3 hours') RETURNING id INTO v_s1;
  INSERT INTO club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
  VALUES (v_org, v_sched, v_venue, v_at + interval '7 days', v_at + interval '7 days 3 hours') RETURNING id INTO v_s2;
  INSERT INTO club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
  VALUES (v_org, v_sched, v_venue, v_at + interval '14 days', v_at + interval '14 days 3 hours') RETURNING id INTO v_s3;
  INSERT INTO club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
  VALUES (v_org, v_sched, v_venue, v_at + interval '21 days', v_at + interval '21 days 3 hours') RETURNING id INTO v_s4;
  INSERT INTO club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
  VALUES (v_org, v_sched, v_venue, v_at + interval '28 days', v_at + interval '28 days 3 hours') RETURNING id INTO v_s5;
  INSERT INTO club_schedule_slot_programs(slot_id, program, org_id)
  VALUES (v_s1, 'house_league', v_org), (v_s2, 'house_league', v_org), (v_s3, 'house_league', v_org),
         (v_s4, 'house_league', v_org), (v_s5, 'house_league', v_org);
  PERFORM league_slot_uses_set(v_org, v_season, NULL, ARRAY[v_s1, v_s2, v_s5], v_u12, 'games');
  PERFORM league_slot_uses_set(v_org, v_season, NULL, ARRAY[v_s3, v_s4], v_u9, 'games');

  -- The games, written while both divisions are drafts (no change rows), then U12 published.
  INSERT INTO league_games(season_id, division_id, home_team_id, away_team_id, org_id, scheduled_at, ends_at, org_venue_id, location, slot_use_id)
  VALUES (v_season, v_u12, v_r, v_b, v_org, v_at, v_at + interval '90 minutes', v_venue, 'CHECK park', v_s1) RETURNING id INTO v_g1;
  INSERT INTO league_games(season_id, division_id, home_team_id, away_team_id, org_id, scheduled_at, ends_at, org_venue_id, location, slot_use_id, status, home_score, away_score)
  VALUES (v_season, v_u12, v_b, v_r, v_org, v_at + interval '90 minutes', v_at + interval '3 hours', v_venue, 'CHECK park', v_s1, 'completed', 3, 2) RETURNING id INTO v_g2;
  INSERT INTO league_games(season_id, division_id, home_team_id, away_team_id, org_id, scheduled_at, ends_at, org_venue_id, location, slot_use_id)
  VALUES (v_season, v_u12, v_r, v_b, v_org, v_at + interval '7 days', v_at + interval '7 days 90 minutes', v_venue, 'CHECK park', v_s2) RETURNING id INTO v_g3;
  INSERT INTO league_games(season_id, division_id, home_team_id, away_team_id, org_id, scheduled_at, ends_at, org_venue_id, location, slot_use_id, status)
  VALUES (v_season, v_u12, v_b, v_r, v_org, v_at + interval '7 days 90 minutes', v_at + interval '7 days 3 hours', v_venue, 'CHECK park', v_s2, 'cancelled') RETURNING id INTO v_g4;
  INSERT INTO league_games(season_id, division_id, home_team_id, away_team_id, org_id, scheduled_at, ends_at, org_venue_id, location, slot_use_id)
  VALUES (v_season, v_u9, v_g, v_y, v_org, v_at + interval '14 days', v_at + interval '14 days 90 minutes', v_venue, 'CHECK park', v_s3) RETURNING id INTO v_g5;
  INSERT INTO league_games(season_id, division_id, home_team_id, away_team_id, org_id, scheduled_at, ends_at, org_venue_id, location, slot_use_id)
  VALUES (v_season, v_u9, v_y, v_g, v_org, v_at + interval '21 days', v_at + interval '21 days 90 minutes', v_venue, 'CHECK park', v_s4) RETURNING id INTO v_g6;
  INSERT INTO league_games(season_id, division_id, home_team_id, away_team_id, org_id, scheduled_at, ends_at, org_venue_id, location, slot_use_id)
  VALUES (v_season, v_u12, v_r, v_b, v_org, v_at + interval '28 days', v_at + interval '28 days 90 minutes', v_venue, 'CHECK park', v_s5) RETURNING id INTO v_g7;
  UPDATE league_divisions SET teams_published_at = now(), schedule_published_at = now() WHERE id = v_u12;

  -- The club's edits, as a save leaves them: s1 and s4 moved (soft-removed, a new house-league slot each with no use yet),
  -- s2 and s3 taken back (live, no program).
  UPDATE club_schedule_slots SET removed_at = now() WHERE id IN (v_s1, v_s4);
  INSERT INTO club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
  VALUES (v_org, v_sched, v_venue2, v_at + interval '90 minutes', v_at + interval '270 minutes') RETURNING id INTO v_s1b;
  INSERT INTO club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
  VALUES (v_org, v_sched, v_venue, v_at + interval '22 days', v_at + interval '22 days 3 hours') RETURNING id INTO v_s4b;
  INSERT INTO club_schedule_slot_programs(slot_id, program, org_id) VALUES (v_s1b, 'house_league', v_org), (v_s4b, 'house_league', v_org);
  DELETE FROM club_schedule_slot_programs WHERE slot_id IN (v_s2, v_s3);

  -- R1 · a published game left on time house league no longer has (the plan forgot it) is refused, and nothing lands.
  DELETE FROM club_schedule_slot_programs WHERE slot_id = v_s5;
  INSERT INTO club_schedule_sends(org_id, schedule_id, kind) VALUES (v_org, v_sched, 'changes') RETURNING id INTO v_send;
  SELECT version INTO v_ver FROM club_schedules WHERE id = v_sched;
  BEGIN
    PERFORM club_schedule_apply_changes(v_org, v_sched, NULL, v_ver, '[]'::jsonb, '[]'::jsonb, '{}'::uuid[], NULL, v_send,
      '{}'::jsonb, '[]'::jsonb, jsonb_build_object('uses', '[]'::jsonb, 'cancel', '[]'::jsonb, 'updates', '[]'::jsonb,
        'games', jsonb_build_object('move', '[]'::jsonb, 'postpone', '[]'::jsonb, 'remove', '[]'::jsonb)));
    v_code := 'landed';
  EXCEPTION WHEN raise_exception THEN v_code := SQLERRM; END;
  IF v_code NOT LIKE 'changed: a house-league game is still on time%' THEN RAISE EXCEPTION 'FAIL R1: %', v_code; END IF;

  -- R2 · removing a PUBLISHED division's game (the plan read it as a draft) is refused.
  BEGIN
    PERFORM club_schedule_apply_changes(v_org, v_sched, NULL, v_ver, '[]'::jsonb, '[]'::jsonb, '{}'::uuid[], NULL, v_send,
      '{}'::jsonb, '[]'::jsonb, jsonb_build_object('uses', '[]'::jsonb, 'cancel', '[]'::jsonb, 'updates', '[]'::jsonb,
        'games', jsonb_build_object('move', '[]'::jsonb, 'postpone', '[]'::jsonb, 'remove', jsonb_build_array(v_g7))));
    v_code := 'landed';
  EXCEPTION WHEN raise_exception THEN v_code := SQLERRM; END;
  IF v_code NOT LIKE 'changed: a house-league division''s schedule was published since%' THEN RAISE EXCEPTION 'FAIL R2: %', v_code; END IF;

  -- R3 · a move that would end after its new slot is refused.
  BEGIN
    PERFORM club_schedule_apply_changes(v_org, v_sched, NULL, v_ver, '[]'::jsonb, '[]'::jsonb, '{}'::uuid[], NULL, v_send,
      '{}'::jsonb, '[]'::jsonb, jsonb_build_object('uses', jsonb_build_array(jsonb_build_object('from', v_s1, 'to', v_s1b)),
        'cancel', '[]'::jsonb, 'updates', '[]'::jsonb,
        'games', jsonb_build_object('move', jsonb_build_array(jsonb_build_object('gameId', v_g1, 'slotId', v_s1b,
          'scheduledAt', v_at + interval '4 hours', 'endsAt', v_at + interval '330 minutes', 'location', 'CHECK dome')),
          'postpone', '[]'::jsonb, 'remove', '[]'::jsonb)));
    v_code := 'landed';
  EXCEPTION WHEN raise_exception THEN v_code := SQLERRM; END;
  IF v_code NOT LIKE 'changed: a house-league game no longer fits%' THEN RAISE EXCEPTION 'FAIL R3: %', v_code; END IF;
  IF (SELECT scheduled_at FROM league_games WHERE id = v_g1) <> v_at OR EXISTS (SELECT 1 FROM league_game_changes WHERE game_id = v_g1) THEN
    RAISE EXCEPTION 'FAIL R3: a refused send left a game moved'; END IF;

  -- T1 · the plan whole: two uses carried, two games moved, one postponed, one removed (s5's game postponed too).
  v_res := club_schedule_apply_changes(v_org, v_sched, NULL, v_ver, '[]'::jsonb, '[]'::jsonb, '{}'::uuid[], NULL, v_send,
    '{}'::jsonb, '[]'::jsonb, jsonb_build_object(
      'uses', jsonb_build_array(jsonb_build_object('from', v_s1, 'to', v_s1b), jsonb_build_object('from', v_s4, 'to', v_s4b)),
      'cancel', '[]'::jsonb, 'updates', '[]'::jsonb,
      'games', jsonb_build_object(
        'move', jsonb_build_array(
          jsonb_build_object('gameId', v_g1, 'slotId', v_s1b, 'scheduledAt', v_at + interval '90 minutes',
                             'endsAt', v_at + interval '3 hours', 'location', 'CHECK dome'),
          jsonb_build_object('gameId', v_g6, 'slotId', v_s4b, 'scheduledAt', v_at + interval '22 days',
                             'endsAt', v_at + interval '22 days 90 minutes', 'location', 'CHECK park')),
        'postpone', jsonb_build_array(v_g3, v_g7),
        'remove', jsonb_build_array(v_g5))));
  IF NOT (v_res->>'ok')::boolean OR (v_res->'league'->>'uses')::integer <> 2 OR (v_res->'league'->>'gamesMoved')::integer <> 2
     OR (v_res->'league'->>'gamesPostponed')::integer <> 2 OR (v_res->'league'->>'gamesRemoved')::integer <> 1 THEN
    RAISE EXCEPTION 'FAIL T1: the plan''s games (%)', v_res; END IF;

  -- T2 · the published game moved with its time, at the new slot's place, and waits as the CLUB's change.
  IF (SELECT scheduled_at FROM league_games WHERE id = v_g1) <> v_at + interval '90 minutes'
     OR (SELECT org_venue_id FROM league_games WHERE id = v_g1) <> v_venue2
     OR (SELECT location FROM league_games WHERE id = v_g1) <> 'CHECK dome'
     OR (SELECT slot_use_id FROM league_games WHERE id = v_g1) <> v_s1b
     OR (SELECT moved_from FROM league_games WHERE id = v_g1) <> v_at THEN
    RAISE EXCEPTION 'FAIL T2: the moved game'; END IF;
  SELECT * INTO v_ch FROM league_game_changes WHERE game_id = v_g1;
  IF v_ch.kind <> 'moved' OR v_ch.source <> 'club' OR v_ch.sent_at IS NOT NULL OR (v_ch.before->>'scheduledAt')::timestamptz <> v_at THEN
    RAISE EXCEPTION 'FAIL T2: the moved game''s held change (%)', row_to_json(v_ch); END IF;

  -- T3 · the played game kept its date and result; its link followed its use.
  IF (SELECT scheduled_at FROM league_games WHERE id = v_g2) <> v_at + interval '90 minutes'
     OR (SELECT slot_use_id FROM league_games WHERE id = v_g2) <> v_s1b
     OR EXISTS (SELECT 1 FROM league_game_changes WHERE game_id = v_g2) THEN
    RAISE EXCEPTION 'FAIL T3: the played game'; END IF;

  -- T4 · the game on time taken back: Needs a new date (its date kept), the club's held change; the cancelled one stays.
  IF (SELECT status FROM league_games WHERE id = v_g3) <> 'postponed'
     OR (SELECT scheduled_at FROM league_games WHERE id = v_g3) <> v_at + interval '7 days'
     OR (SELECT slot_use_id FROM league_games WHERE id = v_g3) IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM league_game_changes WHERE game_id = v_g3 AND kind = 'postponed' AND source = 'club' AND sent_at IS NULL) THEN
    RAISE EXCEPTION 'FAIL T4: the postponed game'; END IF;
  IF (SELECT status FROM league_games WHERE id = v_g4) <> 'cancelled' OR (SELECT slot_use_id FROM league_games WHERE id = v_g4) IS NOT NULL
     OR EXISTS (SELECT 1 FROM league_game_changes WHERE game_id = v_g4) THEN
    RAISE EXCEPTION 'FAIL T4: the cancelled game'; END IF;

  -- T5 · the draft: one came off it, one moved a day later with no change row (nobody was told of it).
  IF EXISTS (SELECT 1 FROM league_games WHERE id = v_g5) THEN RAISE EXCEPTION 'FAIL T5: the draft game on time taken back stayed'; END IF;
  IF (SELECT scheduled_at FROM league_games WHERE id = v_g6) <> v_at + interval '22 days'
     OR (SELECT slot_use_id FROM league_games WHERE id = v_g6) <> v_s4b
     OR EXISTS (SELECT 1 FROM league_game_changes WHERE game_id = v_g6) THEN
    RAISE EXCEPTION 'FAIL T5: the draft game moved'; END IF;

  -- T6 · nothing of the club's source is left on the transaction: a league admin's own edit after it is the league's.
  IF coalesce(current_setting('league.change_source', true), '') <> '' THEN RAISE EXCEPTION 'FAIL T6: the club source stayed set'; END IF;
  UPDATE league_games SET location = 'CHECK dome · Diamond 2' WHERE id = v_g7;
  IF NOT EXISTS (SELECT 1 FROM league_game_changes WHERE game_id = v_g7 AND kind = 'place' AND source = 'league') THEN
    RAISE EXCEPTION 'FAIL T6: a league admin''s edit was recorded as the club''s'; END IF;

  -- T7 · Undo refuses the club's change and leaves the game where the club's time put it.
  IF league_game_undo(v_org, v_season, v_g1) IS DISTINCT FROM 'club' THEN RAISE EXCEPTION 'FAIL T7: Undo of the club''s move'; END IF;
  IF (SELECT scheduled_at FROM league_games WHERE id = v_g1) <> v_at + interval '90 minutes' THEN RAISE EXCEPTION 'FAIL T7: the game moved back'; END IF;

  RAISE EXCEPTION 'HL_9D2B_PART5_PASSED';
END $p5$;
