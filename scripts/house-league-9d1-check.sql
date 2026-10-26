-- DEV only. Club Tier Stage 9d-1 Part 1 (mig 385): each house-league season has its own three emails in any 24 hours,
-- the club keeps its own three, and the double-press guard is per bucket; an email that reached nobody gives its slot
-- back; Publish teams writes one notice and stamps exactly its family emails.
-- Run: node scripts/db-query.mjs --dev -f scripts/house-league-9d1-check.sql
-- The final exception rolls back every fixture row; the run passes only when it ends in HOUSE_LEAGUE_9D1_PASSED.
DO $hl9d1$
DECLARE
  v_org uuid; v_a uuid; v_b uuid; v_c uuid; v_div uuid; v_team uuid; v_res jsonb; v_id uuid; v_pub record; v_fp text;
  v_notice league_season_notices%ROWTYPE; v_n integer;
BEGIN
  INSERT INTO organizations(name, slug, plan_id)
  VALUES ('CHECK 9d1', 'check-9d1-' || substr(md5(random()::text), 1, 10), 'club') RETURNING id INTO v_org;
  INSERT INTO league_seasons(org_id, name, slug, registration_fee) VALUES (v_org, 'Season A', 'season-a', 0) RETURNING id INTO v_a;
  INSERT INTO league_seasons(org_id, name, slug, registration_fee) VALUES (v_org, 'Season B', 'season-b', 0) RETURNING id INTO v_b;
  INSERT INTO league_seasons(org_id, name, slug, registration_fee) VALUES (v_org, 'Season C', 'season-c', 0) RETURNING id INTO v_c;

  -- T1 · the club takes 3 in 24 hours (each press an hour apart, past the 60-second guard); a 4th is refused with the
  -- time the oldest turns 24 hours old.
  FOR i IN 1..3 LOOP
    v_res := family_email_claim(v_org, NULL, 'Club ' || i, 'Body', 'every', 'Every family', '{}', NULL, 5, 0);
    IF NOT (v_res->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL T1: club claim % refused (%)', i, v_res; END IF;
    UPDATE family_email_sends SET sent_at = now() - ((4 - i) || ' hours')::interval WHERE id = (v_res->>'sendId')::uuid;
  END LOOP;
  v_res := family_email_claim(v_org, NULL, 'Club 4', 'Body', 'every', 'Every family', '{}', NULL, 5, 0);
  IF v_res->>'code' IS DISTINCT FROM 'cap' THEN RAISE EXCEPTION 'FAIL T1: a 4th club email was not refused (%)', v_res; END IF;
  IF (v_res->>'nextAt')::timestamptz <> now() + interval '21 hours' THEN
    RAISE EXCEPTION 'FAIL T1: the next club email time is wrong (%)', v_res; END IF;

  -- T2 · season A takes its own 3 while the club is spent (a season picked from either door counts here); a 4th is
  -- refused with its own time.
  FOR i IN 1..3 LOOP
    v_res := family_email_claim(v_org, NULL, 'A ' || i, 'Body', CASE WHEN i = 2 THEN 'season_teams' ELSE 'season' END,
                                'Season A', '{}', v_a, 5, 0);
    IF NOT (v_res->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL T2: season A claim % refused (%)', i, v_res; END IF;
    UPDATE family_email_sends SET sent_at = now() - ((10 - i) || ' hours')::interval WHERE id = (v_res->>'sendId')::uuid;
  END LOOP;
  v_res := family_email_claim(v_org, NULL, 'A 4', 'Body', 'season', 'Season A', '{}', v_a, 5, 0);
  IF v_res->>'code' IS DISTINCT FROM 'cap' THEN RAISE EXCEPTION 'FAIL T2: a 4th season A email was not refused (%)', v_res; END IF;
  IF (v_res->>'nextAt')::timestamptz <> now() + interval '15 hours' THEN
    RAISE EXCEPTION 'FAIL T2: the next season A time is wrong (%)', v_res; END IF;

  -- T3 · season B is untouched by the club's and A's six.
  v_res := family_email_claim(v_org, NULL, 'B 1', 'Body', 'season', 'Season B', '{}', v_b, 5, 0);
  IF NOT (v_res->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL T3: season B refused (%)', v_res; END IF;

  -- T4 · a press in B (just now) trips B's 60 seconds and nobody else's: C goes, the club says cap (not just_sent).
  v_res := family_email_claim(v_org, NULL, 'B 2', 'Body', 'season', 'Season B', '{}', v_b, 5, 0);
  IF v_res->>'code' IS DISTINCT FROM 'just_sent' THEN RAISE EXCEPTION 'FAIL T4: B''s second press went (%)', v_res; END IF;
  v_res := family_email_claim(v_org, NULL, 'C 1', 'Body', 'season', 'Season C', '{}', v_c, 5, 0);
  IF NOT (v_res->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL T4: B''s press refused season C (%)', v_res; END IF;
  UPDATE family_email_sends SET sent_at = now() - interval '5 minutes' WHERE season_id IN (v_b, v_c);
  v_res := family_email_claim(v_org, NULL, 'Club 5', 'Body', 'every', 'Every family', '{}', NULL, 5, 0);
  IF v_res->>'code' IS DISTINCT FROM 'cap' THEN RAISE EXCEPTION 'FAIL T4: the club saw another bucket''s press (%)', v_res; END IF;

  -- T5 · an email that reached nobody gives its slot back: the app deletes its claim, and A can send again.
  DELETE FROM family_email_sends WHERE id = (SELECT id FROM family_email_sends WHERE season_id = v_a ORDER BY sent_at DESC LIMIT 1);
  v_res := family_email_claim(v_org, NULL, 'A again', 'Body', 'season', 'Season A', '{}', v_a, 5, 0);
  IF NOT (v_res->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL T5: the slot was not given back (%)', v_res; END IF;

  -- T6 · a season kind must name its season.
  BEGIN
    INSERT INTO family_email_sends(org_id, subject, body, audience_kind, audience_label) VALUES (v_org, 's', 'b', 'season_statuses', 'x');
    RAISE EXCEPTION 'FAIL T6: a season kind without a season was kept';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- T7 · a family's recipient row is kept per email and goes with it.
  v_id := (v_res->>'sendId')::uuid;
  INSERT INTO family_email_recipients(send_id, org_id, person_ids, family_name, status)
  VALUES (v_id, v_org, ARRAY[gen_random_uuid()], 'Kim', 'pending');
  DELETE FROM family_email_sends WHERE id = v_id;
  IF EXISTS (SELECT 1 FROM family_email_recipients WHERE send_id = v_id) THEN RAISE EXCEPTION 'FAIL T7: recipients outlived the email'; END IF;

  -- T8 · Publish writes one notice for the act, with its families, and stamps exactly that act's emails (two children
  -- of one address are one family); a placement after it stays off the notice.
  INSERT INTO league_divisions(season_id, name, capacity) VALUES (v_a, 'U9', 20) RETURNING id INTO v_div;
  INSERT INTO league_teams(season_id, division_id, name) VALUES (v_a, v_div, 'Cardinals') RETURNING id INTO v_team;
  INSERT INTO league_registrations(org_id, season_id, division_id, team_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status)
  VALUES (v_org, v_a, v_div, v_team, 'Ava', 'Kim', 'H', 'Kim', 'kim@example.invalid', 'active'),
         (v_org, v_a, v_div, v_team, 'Henry', 'Kim', 'H', 'Kim', 'Kim@example.invalid ', 'active'),
         (v_org, v_a, v_div, v_team, 'Liam', 'Chen', 'M', 'Chen', 'chen@example.invalid', 'active');
  v_fp := league_division_fingerprint(v_div);
  SELECT * INTO v_pub FROM league_division_publish(v_org, v_a, v_div, NULL, v_fp, ARRAY[]::uuid[], ARRAY[]::text[]);
  IF v_pub.refusal IS NOT NULL OR v_pub.families <> 2 THEN RAISE EXCEPTION 'FAIL T8: publish (%)', row_to_json(v_pub); END IF;
  SELECT count(*) INTO v_n FROM league_season_notices WHERE season_id = v_a;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL T8: % notices for one Publish', v_n; END IF;
  SELECT * INTO v_notice FROM league_season_notices WHERE season_id = v_a;
  IF v_notice.kind <> 'teams_published' OR v_notice.family_count <> 2 OR v_notice.division_id <> v_div THEN
    RAISE EXCEPTION 'FAIL T8: the notice is wrong (%)', row_to_json(v_notice); END IF;
  IF (SELECT count(*) FROM league_placement_emails WHERE notice_id = v_notice.id) <> 2 THEN
    RAISE EXCEPTION 'FAIL T8: the notice does not hold its two family emails'; END IF;
  INSERT INTO league_placement_emails(org_id, season_id, division_id, kind, guardian_email, registration_ids)
  VALUES (v_org, v_a, v_div, 'placed', 'late@example.invalid', ARRAY[gen_random_uuid()]);
  IF (SELECT count(*) FROM league_placement_emails WHERE notice_id = v_notice.id) <> 2 THEN
    RAISE EXCEPTION 'FAIL T8: a late placement joined the notice'; END IF;

  -- T9 · a one-family message can name its season (it lives in family_messages, which no allowance reads).
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'family_messages' AND column_name = 'season_id') THEN
    RAISE EXCEPTION 'FAIL T9: family_messages has no season'; END IF;

  RAISE EXCEPTION 'HOUSE_LEAGUE_9D1_PASSED';
END $hl9d1$;
