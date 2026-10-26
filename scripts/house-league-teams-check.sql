-- DEV only. Club Tier Stage 9c Part 1 (mig 377; T11 mig 379): teams and people, proved on the database.
-- Run: node scripts/db-query.mjs --dev -f scripts/house-league-teams-check.sql
-- The final exception rolls back every fixture row; the run passes only when it ends in HOUSE_LEAGUE_TEAMS_PASSED.
DO $hlteams$
DECLARE
  v_org uuid; v_season uuid; v_div uuid; v_div2 uuid; v_t1 uuid; v_t2 uuid; v_t3 uuid;
  v_a uuid; v_b uuid; v_c uuid; v_d uuid; v_coach uuid; v_coach2 uuid;
  v_fp text; v_refusal text; v_email uuid; v_res record; v_n integer;
BEGIN
  INSERT INTO organizations(name, slug, plan_id)
  VALUES ('TEAMS CHECK 9c', 'teams-check-9c-' || substr(md5(random()::text), 1, 10), 'league') RETURNING id INTO v_org;
  INSERT INTO league_seasons(org_id, name, slug, registration_fee, status)
  VALUES (v_org, 'Teams check', 'teams-check', 100, 'registration_open') RETURNING id INTO v_season;
  INSERT INTO league_divisions(season_id, name) VALUES (v_season, 'A') RETURNING id INTO v_div;
  INSERT INTO league_divisions(season_id, name) VALUES (v_season, 'B') RETURNING id INTO v_div2;
  INSERT INTO league_teams(season_id, division_id, name) VALUES (v_season, v_div, 'Cardinals') RETURNING id INTO v_t1;
  INSERT INTO league_teams(season_id, division_id, name) VALUES (v_season, v_div, 'Jays') RETURNING id INTO v_t2;
  INSERT INTO league_teams(season_id, division_id, name) VALUES (v_season, v_div2, 'Tigers') RETURNING id INTO v_t3;

  -- One family with two children (Nora, Jaya), one with one (Liam); one child to review (Maya).
  INSERT INTO league_registrations(org_id, season_id, division_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status)
  VALUES (v_org, v_season, v_div, 'Nora', 'Test', 'Priya', 'Test', 'Test@Example.invalid ', 'active') RETURNING id INTO v_a;
  INSERT INTO league_registrations(org_id, season_id, division_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status)
  VALUES (v_org, v_season, v_div, 'Jaya', 'Test', 'Priya', 'Test', 'test@example.invalid', 'active') RETURNING id INTO v_b;
  INSERT INTO league_registrations(org_id, season_id, division_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status)
  VALUES (v_org, v_season, v_div, 'Liam', 'Chen', 'Wei', 'Chen', 'chen@example.invalid', 'active') RETURNING id INTO v_c;
  INSERT INTO league_registrations(org_id, season_id, division_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status, team_id)
  VALUES (v_org, v_season, v_div, 'Maya', 'Singh', 'R', 'Singh', 'singh@example.invalid', 'pending_review', v_t1)
  RETURNING id INTO v_d;

  -- T1 · an inserted child who isn't accepted lands on no team.
  IF (SELECT team_id FROM league_registrations WHERE id = v_d) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL T1: a child to review was put on a team'; END IF;

  -- T2 · a team from another division is refused; so is a child who isn't accepted.
  BEGIN
    UPDATE league_registrations SET team_id = v_t3 WHERE id = v_a;
    RAISE EXCEPTION 'FAIL T2: a team from another division was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE league_registrations SET team_id = v_t1 WHERE id = v_d;
    RAISE EXCEPTION 'FAIL T2b: a child to review was placed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  END;

  -- T3 · a rating takes its org and season from the registration and is 1-5.
  INSERT INTO league_player_ratings(registration_id, org_id, season_id, rating)
  VALUES (v_a, gen_random_uuid(), gen_random_uuid(), 4);
  IF (SELECT season_id FROM league_player_ratings WHERE registration_id = v_a) IS DISTINCT FROM v_season THEN
    RAISE EXCEPTION 'FAIL T3: a rating kept the caller''s season'; END IF;
  BEGIN
    INSERT INTO league_player_ratings(registration_id, org_id, season_id, rating) VALUES (v_b, v_org, v_season, 6);
    RAISE EXCEPTION 'FAIL T3b: a rating of 6 was kept';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- T4 · the draft lands whole: a stale fingerprint is refused, a short deal is refused, a full one lands and is remembered.
  v_refusal := league_division_draft_apply(v_org, v_season, v_div, 'stale', ARRAY[v_a, v_b, v_c], ARRAY[v_t1, v_t2, v_t1]);
  IF v_refusal IS DISTINCT FROM 'changed' THEN RAISE EXCEPTION 'FAIL T4: a stale draft landed (%)', v_refusal; END IF;
  v_fp := league_division_fingerprint(v_div);
  v_refusal := league_division_draft_apply(v_org, v_season, v_div, v_fp, ARRAY[v_a, v_b], ARRAY[v_t1, v_t2]);
  IF v_refusal IS DISTINCT FROM 'changed' THEN RAISE EXCEPTION 'FAIL T4b: a deal that left a player out landed'; END IF;
  v_refusal := league_division_draft_apply(v_org, v_season, v_div, v_fp, ARRAY[v_a, v_b, v_c], ARRAY[v_t1, v_t2, v_t1]);
  IF v_refusal IS NOT NULL THEN RAISE EXCEPTION 'FAIL T4c: the draft was refused (%)', v_refusal; END IF;
  IF (SELECT draft_team_id FROM league_registrations WHERE id = v_c) IS DISTINCT FROM v_t1 THEN
    RAISE EXCEPTION 'FAIL T4c: the draft did not remember its team'; END IF;

  -- T5 · a lock survives the draft and a move by hand before publishing drops it, silently (no email row).
  UPDATE league_registrations SET team_locked_at = now() WHERE id = v_a;
  v_fp := league_division_fingerprint(v_div);
  v_refusal := league_division_draft_apply(v_org, v_season, v_div, v_fp, ARRAY[v_b, v_c], ARRAY[v_t1, v_t2]);
  IF v_refusal IS NOT NULL OR (SELECT team_id FROM league_registrations WHERE id = v_a) IS DISTINCT FROM v_t1 THEN
    RAISE EXCEPTION 'FAIL T5: a locked player moved in the draft'; END IF;
  SELECT * INTO v_res FROM league_team_place(v_org, v_season, v_a, v_t2, false, NULL);
  IF v_res.refusal IS NOT NULL OR v_res.email IS NOT NULL
     OR (SELECT team_locked_at FROM league_registrations WHERE id = v_a) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL T5b: a move before publishing kept its lock or wrote an email'; END IF;

  -- T6 · Publish: one email row per family (the Test family's two children on one row), the coach invited, locks gone.
  INSERT INTO league_team_coaches(org_id, season_id, team_id, name, email)
  VALUES (gen_random_uuid(), gen_random_uuid(), v_t1, ' Pat Volunteer ', ' Pat@Example.invalid') RETURNING id INTO v_coach;
  IF (SELECT email FROM league_team_coaches WHERE id = v_coach) <> 'pat@example.invalid'
     OR (SELECT season_id FROM league_team_coaches WHERE id = v_coach) <> v_season THEN
    RAISE EXCEPTION 'FAIL T6: a coach row kept the caller''s season or an unnormalized email'; END IF;
  INSERT INTO league_team_coaches(team_id, org_id, season_id, name, email)
  VALUES (v_t3, v_org, v_season, 'Sam Lee', 'sam@example.invalid') RETURNING id INTO v_coach2;
  UPDATE league_registrations SET team_locked_at = now() WHERE id = v_b;
  SELECT * INTO v_res FROM league_division_publish(v_org, v_season, v_div, NULL, 'stale', ARRAY[v_coach], ARRAY['h1']);
  IF v_res.refusal IS DISTINCT FROM 'changed' THEN RAISE EXCEPTION 'FAIL T6b: a stale publish landed'; END IF;
  v_fp := league_division_fingerprint(v_div);
  SELECT * INTO v_res FROM league_division_publish(v_org, v_season, v_div, NULL, v_fp,
    ARRAY[v_coach, v_coach2], ARRAY['h1', 'h2']);
  IF v_res.refusal IS NOT NULL OR v_res.families <> 2 THEN
    RAISE EXCEPTION 'FAIL T6c: publish refused or wrote % family rows', v_res.families; END IF;
  IF v_res.invited <> ARRAY[v_coach] THEN RAISE EXCEPTION 'FAIL T6d: a coach of another division was invited'; END IF;
  IF (SELECT cardinality(registration_ids) FROM league_placement_emails
       WHERE division_id = v_div AND guardian_email = 'test@example.invalid') <> 2 THEN
    RAISE EXCEPTION 'FAIL T6e: the Test family''s two children are not on one email'; END IF;
  IF EXISTS (SELECT 1 FROM league_placement_emails WHERE registration_ids @> ARRAY[v_d]) THEN
    RAISE EXCEPTION 'FAIL T6f: a child to review was emailed'; END IF;
  IF (SELECT team_locked_at FROM league_registrations WHERE id = v_b) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL T6g: a lock outlived publish'; END IF;
  SELECT * INTO v_res FROM league_division_publish(v_org, v_season, v_div, NULL, v_fp, ARRAY[]::uuid[], ARRAY[]::text[]);
  IF v_res.refusal IS DISTINCT FROM 'already' THEN RAISE EXCEPTION 'FAIL T6h: a second publish was not refused'; END IF;

  -- T7 · after publishing, a move is held, then writes one email row that remembers the old team.
  SELECT * INTO v_res FROM league_team_place(v_org, v_season, v_c, v_t1, false, NULL);
  IF v_res.refusal IS DISTINCT FROM 'published' THEN RAISE EXCEPTION 'FAIL T7: an unconfirmed move after publishing landed'; END IF;
  SELECT * INTO v_res FROM league_team_place(v_org, v_season, v_c, v_t1, true, NULL);
  IF v_res.refusal IS NOT NULL OR v_res.email IS NULL THEN RAISE EXCEPTION 'FAIL T7b: a confirmed move wrote no email'; END IF;
  IF (SELECT kind || ':' || coalesce(from_team_id::text, '') FROM league_placement_emails WHERE id = v_res.email)
     <> 'moved:' || v_t2::text THEN RAISE EXCEPTION 'FAIL T7c: the move email lost its old team'; END IF;
  IF (SELECT previous_team_id FROM league_registrations WHERE id = v_c) IS DISTINCT FROM v_t2 THEN
    RAISE EXCEPTION 'FAIL T7d: the moved line has no previous team'; END IF;
  -- Off a team after publishing emails nobody.
  SELECT * INTO v_res FROM league_team_place(v_org, v_season, v_c, NULL, true, NULL);
  IF v_res.email IS NOT NULL THEN RAISE EXCEPTION 'FAIL T7e: taking a player off a team emailed the family'; END IF;
  -- A late placement is a "placed" email.
  SELECT * INTO v_res FROM league_team_place(v_org, v_season, v_c, v_t2, true, NULL);
  IF (SELECT kind FROM league_placement_emails WHERE id = v_res.email) <> 'placed' THEN
    RAISE EXCEPTION 'FAIL T7f: a placement from Not on a team was not a placement email'; END IF;

  -- T8 · a published division can't be drafted or cleared.
  v_fp := league_division_fingerprint(v_div);
  IF league_division_clear(v_org, v_season, v_div, v_fp) IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'FAIL T8: a published division was cleared'; END IF;
  IF league_division_draft_apply(v_org, v_season, v_div, v_fp, ARRAY[]::uuid[], ARRAY[]::uuid[]) IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'FAIL T8b: a published division was drafted'; END IF;

  -- T9 · ending a child takes them off the team and keeps where they were (T08).
  UPDATE league_registrations SET status = 'withdrawn', ended_at = now() WHERE id = v_a;
  IF (SELECT team_id IS NULL AND previous_team_id = v_t2 AND team_changed_at IS NOT NULL
        FROM league_registrations WHERE id = v_a) IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL T9: an ended child kept their team'; END IF;
  -- T11 (mig 379) · the ended child's rating went with them (Nora was rated 4 in T3).
  IF EXISTS (SELECT 1 FROM league_player_ratings WHERE registration_id = v_a) THEN
    RAISE EXCEPTION 'FAIL T11: an ended child kept their rating'; END IF;
  INSERT INTO league_player_ratings(registration_id, org_id, season_id, rating) VALUES (v_c, v_org, v_season, 2);
  -- And a child moved to another division leaves their team too.
  UPDATE league_registrations SET division_id = v_div2 WHERE id = v_b;
  IF (SELECT team_id FROM league_registrations WHERE id = v_b) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL T9b: a child kept a team of their old division'; END IF;

  -- T10 · finishing the season stamps it and erases its ratings; a finished season takes none; reopening clears the stamp.
  UPDATE league_seasons SET status = 'active' WHERE id = v_season;
  UPDATE league_seasons SET status = 'completed' WHERE id = v_season;
  IF (SELECT finished_at FROM league_seasons WHERE id = v_season) IS NULL THEN
    RAISE EXCEPTION 'FAIL T10: a finished season has no finished-at'; END IF;
  SELECT count(*) INTO v_n FROM league_player_ratings WHERE season_id = v_season;
  IF v_n <> 0 THEN RAISE EXCEPTION 'FAIL T10b: % ratings outlived the season', v_n; END IF;
  BEGIN
    INSERT INTO league_player_ratings(registration_id, org_id, season_id, rating) VALUES (v_c, v_org, v_season, 3);
    RAISE EXCEPTION 'FAIL T10c: a finished season took a rating';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  END;
  UPDATE league_seasons SET status = 'active' WHERE id = v_season;
  IF (SELECT finished_at FROM league_seasons WHERE id = v_season) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL T10d: a reopened season kept its finished-at'; END IF;

  RAISE EXCEPTION 'HOUSE_LEAGUE_TEAMS_PASSED';
END $hlteams$;
