-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- THE FAMILY RECORD, RUN FOR REAL AND ROLLED BACK (Club Tier Stage 5a — check:families-record).
-- Run by scripts/check-families-record.mjs against DEV only. The whole block ALWAYS ends in an exception —
-- 'FAMILIES_RECORD_PASSED' when every assertion held, else 'FAIL T…' naming EVERY assertion that failed — so nothing
-- it writes survives. The INSTALL placeholder is replaced by the runner with the functions under test (the migrations' own text,
-- never a copy): migs 333 + 334 + 338 for the real run (--before-338 lays 334's merge back over 338's: T11 must FAIL); migs 252 + 254 with --old, which must FAIL T1 and T2 (E01, E02 —
-- the proof the tests bite on today's code). The MUTATIONS placeholder is empty, or one EXECUTE swapping in a mutated function.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
DO $test$
DECLARE
  v_org uuid; v_org2 uuid; v_team uuid; v_py uuid; v_user uuid;
  v_a uuid; v_b uuid; v_c uuid; v_keep uuid; v_merge uuid;
  r1 uuid; r2 uuid; r3 uuid; r4 uuid; r5 uuid; r6 uuid;
  n integer; n2 integer; j jsonb; fails text := '';
BEGIN
  {{INSTALL}}
  {{MUTATIONS}}

  SELECT id INTO v_user FROM auth.users ORDER BY created_at LIMIT 1;
  INSERT INTO organizations (name, slug) VALUES ('FAMILIES record club', 'families-record-' || substr(md5(random()::text), 1, 10)) RETURNING id INTO v_org;
  INSERT INTO rep_teams (org_id, name, slug) VALUES (v_org, 'FAMILIES 13U', 'families-13u-' || substr(md5(random()::text), 1, 8)) RETURNING id INTO v_team;
  INSERT INTO rep_program_years (org_id, team_id, name, year, status) VALUES (v_org, v_team, '2026 Season', 2026, 'active') RETURNING id INTO v_py;

  -- ── T1 · E01: a merge holds — a merge then an attach leaves no ghost and nothing to propose again ──
  INSERT INTO rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name, guardian_email, guardian_phone)
  VALUES (v_py, v_team, v_org, 'Peyton', 'Cole', 'Dana', 'Cole', 'dana.cole@example.com', '555-0101') RETURNING id INTO r1;
  INSERT INTO rep_tryout_registrations (program_year_id, team_id, org_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name, guardian_email, guardian_phone)
  VALUES (v_py, v_team, v_org, 'Peyton', 'Cole', 'D.', 'Cole', 'd.cole@example.com', '555-0101') RETURNING id INTO r2;
  PERFORM families_attach_people(v_org);
  SELECT person_id INTO v_keep FROM rep_roster_players WHERE id = r1;
  SELECT person_id INTO v_merge FROM rep_tryout_registrations WHERE id = r2;
  IF v_keep IS NULL OR v_merge IS NULL OR v_keep = v_merge THEN
    RAISE EXCEPTION 'SETUP T1: two people expected before the merge (% / %)', v_keep, v_merge; END IF;
  PERFORM families_merge_people(v_org, v_keep, v_merge, v_user);
  PERFORM families_attach_people(v_org);
  PERFORM families_attach_people(v_org);
  SELECT count(*) INTO n FROM org_people WHERE org_id = v_org;
  IF n <> 1 THEN fails := fails || format(' | FAIL T1 (E01): a merge came back — %s people after the merge and an attach, want 1 (a ghost for the merged address)', n); END IF;
  SELECT count(*) INTO n FROM org_people p WHERE p.org_id = v_org
     AND NOT EXISTS (SELECT 1 FROM org_person_emails e WHERE e.person_id = p.id);
  IF n <> 0 THEN fails := fails || format(' | FAIL T1 (E01): %s person(s) with no address in the book', n); END IF;
  SELECT count(*) INTO n FROM rep_tryout_registrations WHERE id = r2 AND person_id = v_keep;
  IF n <> 1 THEN fails := fails || ' | FAIL T1 (E01): the merged child row left the keeper'; END IF;

  -- ── T2 · E02: an edited guardian email moves the child to the new address, recorded once; a re-run changes nothing ──
  INSERT INTO rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name, guardian_email)
  VALUES (v_py, v_team, v_org, 'Tatum', 'Whitehall', 'Val', 'Whitehall', 'val.whitehall@example.com') RETURNING id INTO r3;
  PERFORM families_attach_people(v_org);
  SELECT person_id INTO v_a FROM rep_roster_players WHERE id = r3;
  UPDATE rep_roster_players SET guardian_email = 'v.whitehall@newmail.example', updated_at = now() WHERE id = r3;
  PERFORM families_attach_people(v_org);
  SELECT pe.person_id INTO v_b FROM org_person_emails pe WHERE pe.org_id = v_org AND pe.email_normalized = 'v.whitehall@newmail.example';
  SELECT person_id INTO v_c FROM rep_roster_players WHERE id = r3;
  IF v_b IS NULL OR v_c IS DISTINCT FROM v_b OR v_b = v_a THEN
    fails := fails || format(' | FAIL T2 (E02): the edited email did not move Tatum — row on %s, new address owned by %s, old person %s', v_c, v_b, v_a); END IF;
  SELECT count(*) INTO n FROM org_person_reattachments
   WHERE org_id = v_org AND from_person_id = v_a AND to_person_id = v_b AND source_table = 'rep_roster_players' AND source_id = r3;
  IF n <> 1 THEN fails := fails || format(' | FAIL T2 (E02): %s re-attachment record(s) for the move, want 1', n); END IF;
  SELECT count(*) INTO n FROM org_people WHERE org_id = v_org;
  PERFORM families_attach_people(v_org);
  SELECT count(*) INTO n2 FROM org_people WHERE org_id = v_org;
  IF n2 <> n THEN fails := fails || ' | FAIL T2 (E02): a re-run minted a person'; END IF;
  SELECT count(*) INTO n FROM org_person_reattachments WHERE org_id = v_org;
  IF n <> 1 THEN fails := fails || format(' | FAIL T2 (E02): a re-run wrote again — %s records, want 1', n); END IF;
  SELECT count(*) INTO n FROM rep_roster_players WHERE id = r3 AND person_id = v_b;
  IF n <> 1 THEN fails := fails || ' | FAIL T2 (E02): a re-run moved Tatum again'; END IF;

  -- ── T3 · E02: a person who keeps another row is not proposed (nothing left empty); the move still happens ──
  INSERT INTO rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name, guardian_email)
  VALUES (v_py, v_team, v_org, 'Sasha', 'Ionescu', 'Ilie', 'Ionescu', 'ilie@example.com') RETURNING id INTO r4;
  INSERT INTO rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name, guardian_email)
  VALUES (v_py, v_team, v_org, 'Mira', 'Ionescu', 'Ilie', 'Ionescu', 'ilie@example.com') RETURNING id INTO r5;
  PERFORM families_attach_people(v_org);
  SELECT person_id INTO v_a FROM rep_roster_players WHERE id = r4;
  UPDATE rep_roster_players SET guardian_email = 'ana.ionescu@example.com', guardian_first_name = 'Ana', updated_at = now() WHERE id = r5;
  PERFORM families_attach_people(v_org);
  SELECT count(*) INTO n FROM rep_roster_players WHERE id = r5 AND person_id IS DISTINCT FROM v_a
     AND person_id = (SELECT person_id FROM org_person_emails WHERE org_id = v_org AND email_normalized = 'ana.ionescu@example.com');
  IF n <> 1 THEN fails := fails || ' | FAIL T3 (E02): Mira did not move to the address now typed for her'; END IF;
  SELECT count(*) INTO n FROM org_person_reattachments WHERE org_id = v_org AND from_person_id = v_a;
  IF n <> 0 THEN fails := fails || ' | FAIL T3: a person who still holds Sasha was proposed as emptied'; END IF;

  -- ── T4 · E02: an edit to an address another person already owns moves the child there and mints no one ──
  SELECT count(*) INTO n FROM org_people WHERE org_id = v_org;
  UPDATE rep_roster_players SET guardian_email = 'Dana.Cole@Example.com ', updated_at = now() WHERE id = r4;
  PERFORM families_attach_people(v_org);
  SELECT count(*) INTO n2 FROM org_people WHERE org_id = v_org;
  IF n2 <> n THEN fails := fails || ' | FAIL T4: an address already owned minted a person'; END IF;
  SELECT count(*) INTO n FROM rep_roster_players WHERE id = r4 AND person_id = v_keep;
  IF n <> 1 THEN fails := fails || ' | FAIL T4: Sasha did not move to the person who owns the typed address (normalized)'; END IF;

  -- ── T5 · 252's rules hold: a claimed family link files its invite as the former address of one person ──
  INSERT INTO rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name, guardian_email)
  VALUES (v_py, v_team, v_org, 'Rowan', 'Petit', 'Noor', 'Petit', 'noor.p@old.example') RETURNING id INTO r6;
  INSERT INTO family_links (org_id, rep_team_id, role, player_id, invited_email, claimed_email, status)
  VALUES (v_org, v_team, 'guardian', r6, 'noor.p@old.example', 'noor@new.example', 'verified');
  PERFORM families_attach_people(v_org);
  SELECT count(DISTINCT person_id) INTO n FROM org_person_emails WHERE org_id = v_org AND email_normalized IN ('noor.p@old.example', 'noor@new.example');
  SELECT count(*) INTO n2 FROM org_person_emails WHERE org_id = v_org AND email_normalized = 'noor@new.example' AND is_current;
  IF n <> 1 OR n2 <> 1 THEN fails := fails || format(' | FAIL T5: the claim alias split the person (%s people, current=%s)', n, n2); END IF;
  SELECT count(*) INTO n FROM org_person_reattachments r JOIN org_people p ON p.id = r.from_person_id
   WHERE r.org_id = v_org AND p.email_normalized LIKE 'noor%';
  IF n <> 0 THEN fails := fails || ' | FAIL T5: the claim alias read as an edited email'; END IF;

  -- ── T6 · the cap: three in a rolling day, the fourth refused with when the next can go; another club's person refused ──
  SELECT person_id INTO v_a FROM rep_roster_players WHERE id = r1;
  FOR i IN 1..3 LOOP
    j := family_message_claim(v_org, v_a, v_user);
    IF NOT (j->>'ok')::boolean THEN fails := fails || format(' | FAIL T6: send %s of 3 refused: %s', i, j); END IF;
  END LOOP;
  j := family_message_claim(v_org, v_a, v_user);
  IF (j->>'ok')::boolean OR j->>'code' <> 'cap' OR (j->>'count')::int <> 3 OR j->>'nextAt' IS NULL THEN
    fails := fails || format(' | FAIL T6: a fourth send in a day was not refused by the cap: %s', j); END IF;
  UPDATE family_messages SET sent_at = now() - interval '25 hours'
   WHERE id = (SELECT id FROM family_messages WHERE person_id = v_a ORDER BY sent_at LIMIT 1);
  j := family_message_claim(v_org, v_a, v_user);
  IF NOT (j->>'ok')::boolean THEN fails := fails || format(' | FAIL T6: a send older than 24 hours still counted: %s', j); END IF;
  INSERT INTO organizations (name, slug) VALUES ('FAMILIES other club', 'families-other-' || substr(md5(random()::text), 1, 10)) RETURNING id INTO v_org2;
  j := family_message_claim(v_org2, v_a, v_user);
  IF (j->>'ok')::boolean OR j->>'code' <> 'not_found' THEN fails := fails || format(' | FAIL T6: another club claimed this family: %s', j); END IF;

  -- ── T7 · a merge carries the family's message dates (the record and the cap stay whole) ──
  SELECT person_id INTO v_b FROM rep_roster_players WHERE id = r3;   -- the new Whitehall person
  SELECT from_person_id INTO v_c FROM org_person_reattachments WHERE org_id = v_org AND source_id = r3;
  IF v_c IS NULL THEN
    fails := fails || ' | FAIL T7: no re-attachment to merge (T2 failed first)';
  ELSE
  j := family_message_claim(v_org, v_c, v_user);
  PERFORM families_merge_people(v_org, v_b, v_c, v_user);
  SELECT count(*) INTO n FROM family_messages WHERE org_id = v_org AND person_id = v_b;
  IF n <> 1 THEN fails := fails || format(' | FAIL T7: the merged person''s message dates were lost (%s on the keeper)', n); END IF;
  SELECT count(*) INTO n FROM org_person_reattachments WHERE org_id = v_org AND source_id = r3;
  IF n <> 0 THEN fails := fails || ' | FAIL T7: a merged pair is still proposed'; END IF;
  PERFORM families_attach_people(v_org);
  SELECT count(*) INTO n FROM org_people WHERE org_id = v_org AND email_normalized = 'val.whitehall@example.com';
  IF n <> 0 THEN fails := fails || ' | FAIL T7 (E01): the merged Whitehall address came back as a person'; END IF;
  END IF;

  -- ── T8 · a claim the coach has NOT approved never moves the child (pending_approval keeps its person) ──
  INSERT INTO rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name, guardian_email)
  VALUES (v_py, v_team, v_org, 'Jules', 'Marsh', 'Ren', 'Marsh', 'ren.marsh@example.com') RETURNING id INTO r1;
  INSERT INTO family_links (org_id, rep_team_id, role, player_id, invited_email, status)
  VALUES (v_org, v_team, 'guardian', r1, 'ren.marsh@example.com', 'invited') RETURNING id INTO r2;
  PERFORM families_attach_people(v_org);
  SELECT person_id INTO v_a FROM family_links WHERE id = r2;
  -- someone else signs in and claims the link: evidence, never authorization
  INSERT INTO rep_tryout_registrations (program_year_id, team_id, org_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name, guardian_email)
  VALUES (v_py, v_team, v_org, 'Kit', 'Other', 'Gus', 'Other', 'gus@example.com');
  UPDATE family_links SET claimed_email = 'gus@example.com', status = 'pending_approval' WHERE id = r2;
  PERFORM families_attach_people(v_org);
  SELECT count(*) INTO n FROM family_links WHERE id = r2 AND person_id = v_a;
  IF n <> 1 THEN fails := fails || ' | FAIL T8: an unapproved claim moved the link to the claimant'; END IF;

  -- ── T9 · a merge of one side with a THIRD person keeps the proposal, carried to the keeper ──
  INSERT INTO rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name, guardian_email)
  VALUES (v_py, v_team, v_org, 'Lou', 'Penn', 'Sam', 'Penn', 'sam.penn@example.com') RETURNING id INTO r3;
  INSERT INTO rep_tryout_registrations (program_year_id, team_id, org_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name, guardian_email)
  VALUES (v_py, v_team, v_org, 'Lou', 'Penn', 'S.', 'Penn', 's.penn@work.example') RETURNING id INTO r4;
  PERFORM families_attach_people(v_org);
  UPDATE rep_roster_players SET guardian_email = 'sam@penn.example', updated_at = now() WHERE id = r3;
  PERFORM families_attach_people(v_org);
  SELECT from_person_id, to_person_id INTO v_a, v_b FROM org_person_reattachments WHERE org_id = v_org AND source_id = r3;
  SELECT person_id INTO v_c FROM rep_tryout_registrations WHERE id = r4;
  IF v_a IS NULL THEN
    fails := fails || ' | FAIL T9: no proposal for the edited Penn email (T2 failed first)';
  ELSE
    PERFORM families_merge_people(v_org, v_c, v_b, v_user);   -- the new address's person merged into a third
    SELECT count(*) INTO n FROM org_person_reattachments WHERE org_id = v_org AND source_id = r3 AND from_person_id = v_a AND to_person_id = v_c;
    IF n <> 1 THEN fails := fails || ' | FAIL T9: merging one side with a third person lost the proposal'; END IF;
  END IF;

  -- ── T10 · a DECLINED mismatched claim never makes the invited guardian's address the claimant's (before any attach) ──
  INSERT INTO rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name, guardian_email)
  VALUES (v_py, v_team, v_org, 'Wren', 'Hale', 'Ada', 'Hale', 'ada.hale@example.com') RETURNING id INTO r5;
  INSERT INTO family_links (org_id, rep_team_id, role, player_id, invited_email, claimed_email, status)
  VALUES (v_org, v_team, 'guardian', r5, 'ada.hale@example.com', 'stranger@example.com', 'declined');
  PERFORM families_attach_people(v_org);
  SELECT count(*) INTO n FROM rep_roster_players r JOIN org_people p ON p.id = r.person_id
   WHERE r.id = r5 AND p.email_normalized = 'ada.hale@example.com';
  IF n <> 1 THEN fails := fails || ' | FAIL T10: a declined claim took the family (the child is not on the invited guardian)'; END IF;
  SELECT count(*) INTO n FROM org_person_emails WHERE org_id = v_org AND email_normalized = 'stranger@example.com';
  IF n <> 0 THEN fails := fails || ' | FAIL T10: a declined claimant was filed in the address book'; END IF;

  -- ── T11 · (mig 338, Club Tier Stage 5c) a merge carries BOTH people's notes and the payments the club handed to a coach,
  --          each still signed — none forgotten the way remembered pairs are (S5C-05) ──
  INSERT INTO rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name, guardian_email)
  VALUES (v_py, v_team, v_org, 'Indy', 'Moss', 'Kai', 'Moss', 'kai.moss@example.com') RETURNING id INTO r1;
  INSERT INTO rep_tryout_registrations (program_year_id, team_id, org_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name, guardian_email)
  VALUES (v_py, v_team, v_org, 'Indy', 'Moss', 'K.', 'Moss', 'k.moss@work.example') RETURNING id INTO r2;
  PERFORM families_attach_people(v_org);
  SELECT person_id INTO v_keep FROM rep_roster_players WHERE id = r1;
  SELECT person_id INTO v_merge FROM rep_tryout_registrations WHERE id = r2;
  IF v_keep IS NULL OR v_merge IS NULL OR v_keep = v_merge THEN
    fails := fails || format(' | FAIL T11: SETUP — two people expected before the merge (%s / %s)', v_keep, v_merge);
  ELSE
    INSERT INTO family_notes (org_id, person_id, body, created_by) VALUES (v_org, v_keep, 'Kept person''s note', v_user);
    INSERT INTO family_notes (org_id, person_id, body, created_by) VALUES (v_org, v_merge, 'Merged person''s note', v_user);
    INSERT INTO family_payment_handoffs (org_id, person_id, roster_player_id, player_name, team_id, program_year_id, amount, received_date, method, sent_by)
    VALUES (v_org, v_merge, r1, 'Indy Moss', v_team, v_py, 100, current_date, 'cheque', v_user);
    PERFORM families_merge_people(v_org, v_keep, v_merge, v_user);
    SELECT count(*) INTO n FROM family_notes WHERE org_id = v_org AND person_id = v_keep AND created_by = v_user;
    IF n <> 2 THEN fails := fails || format(' | FAIL T11: a merge lost a note — %s on the person kept, want 2 (each still signed)', n); END IF;
    SELECT count(*) INTO n FROM family_payment_handoffs WHERE org_id = v_org AND person_id = v_keep;
    IF n <> 1 THEN fails := fails || format(' | FAIL T11: a merge lost a payment handed to a coach — %s on the person kept, want 1', n); END IF;
  END IF;

  IF fails <> '' THEN RAISE EXCEPTION '%', substr(fails, 4); END IF;
  RAISE EXCEPTION 'FAMILIES_RECORD_PASSED';
END
$test$;
