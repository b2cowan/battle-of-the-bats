-- one-attendance-record-fixture.sql — One attendance record, Session 1 (migs 483–485; plan ONE_ATTENDANCE_RECORD_PLAN.md). Replaces
-- family-availability-fixture.sql (Stage 4b), whose record (event_availability_answers) mig 485 dropped; its two checks that still
-- stand (the team's switch, Remind's 24-hour claim) are carried here as sections 1 and 9.
--
-- DEV ONLY. Run:  node .probe/s2-child/q.mjs --file tests/sql/one-attendance-record-fixture.sql
-- ONE DO block that ENDS BY RAISING: 'ONE RECORD FIXTURE OK: n/n' on success, 'ONE RECORD FIXTURE FAIL …' at the first broken rule.
-- Either way the raise rolls back every row it wrote.
--
--   1. a new team's switch is 'off'; a value outside off|games|games_and_practices is refused;
--   2. the book takes Maybe and refuses a word outside unknown|attending|absent|late|maybe; a 201-character family note is refused;
--   3. one writer, latest wins: a family In, then a coach Out — the coach's Out is current, the family's In is "earlier" with who
--      and when; re-sending the same status moves nothing; the family's write never touches updated_by (the coach's audit);
--   4. families lock at the start: a family write on a started event and on a cancelled one is refused ('attendance_closed'); the
--      coach still writes after the start;
--   5. each note is its side's: a family cannot write the coach's note, a coach cannot write the family's;
--   6. ⚠ THE NIGHTLY CLEAN-UP NEVER DELETES AN ANSWER (call C4): the row count is the same after it runs; a family note 30+ days
--      after its event is blanked and a recent one kept; who-set-it and "earlier" are blanked 60+ days after the season's last event
--      and kept on a live season; the status, the coach's note and updated_by are never touched;
--   7. "All in" (only_if_unknown) fills only players nobody answered: a family's Out stays, a not-marked player and a player with
--      no row become In;
--   8. "Reset" (only_if_set_by = coach) clears only the coach's answers: a family's answer stays, and a player with no row gets none;
--   9. the Remind claim: the first claims, a second inside 24 hours is refused and names the first's time;
--  10. C1: a new day clears nothing (the answer and the Remind log stay);
--  11. a parent's connection ending blanks THEIR family notes on that child (the answer stays; another parent's note stays);
--  12. the family note's writer cleared (an account deletion's set-null) takes the note's words and time;
--  13. a child join keeps every answer (the record rides the roster entry).
do $fixture$
declare
  v_org uuid; v_team uuid; y_live uuid; y_old uuid;
  e_next uuid; e_started uuid; e_cancel uuid; e_past uuid; e_old uuid;
  r_a uuid; c_a uuid; r_b uuid; c_b uuid; r_c uuid;
  u uuid[]; l_a uuid;
  v_ok int := 0; v_n int; v_m int; v_s text; v_j jsonb; v_t timestamptz; v_b boolean; v_id uuid;
  rec record;
begin
  select o.id into v_org from organizations o where exists (select 1 from rep_teams t where t.org_id = o.id) limit 1;
  if v_org is null then raise exception 'ONE RECORD FIXTURE FAIL: no organization to build in'; end if;
  select array_agg(id) into u from (select id from auth.users order by created_at limit 3) x;
  if coalesce(array_length(u, 1), 0) < 3 then raise exception 'ONE RECORD FIXTURE FAIL: dev needs three accounts to build with'; end if;
  -- u[1] = a coach, u[2] = parent A, u[3] = parent B.

  -- 1. the switch
  insert into rep_teams (org_id, name, slug) values (v_org, 'One Record Fixture', 'one-rec-fx-' || substr(md5(random()::text), 1, 6))
    returning id into v_team;
  select family_answers into v_s from rep_teams where id = v_team;
  if v_s is distinct from 'off' then raise exception 'ONE RECORD FIXTURE FAIL 1: a new team''s switch is %', v_s; end if;
  begin
    update rep_teams set family_answers = 'everything' where id = v_team;
    raise exception 'ONE RECORD FIXTURE FAIL 1: an unknown switch value was taken';
  exception when check_violation then null; end;
  update rep_teams set family_answers = 'games_and_practices' where id = v_team;
  v_ok := v_ok + 1;

  insert into rep_program_years (team_id, org_id, name, year, status) values (v_team, v_org, '2027 Season', 2027, 'active') returning id into y_live;
  insert into rep_program_years (team_id, org_id, name, year, status) values (v_team, v_org, '2025 Season', 2025, 'completed') returning id into y_old;
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth)
    values (y_live, v_team, v_org, 'Maya', 'Fixture', date '2016-04-01') returning id into r_a;
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth)
    values (y_live, v_team, v_org, 'Theo', 'Fixture', date '2016-05-01') returning id into r_b;
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth)
    values (y_live, v_team, v_org, 'Ivy', 'Fixture', date '2016-06-01') returning id into r_c;
  select child_id into c_a from rep_roster_players where id = r_a;
  select child_id into c_b from rep_roster_players where id = r_b;

  insert into rep_team_events (program_year_id, team_id, org_id, event_type, name, starts_at)
    values (y_live, v_team, v_org, 'league_game', 'Next game', now() + interval '3 days') returning id into e_next;
  insert into rep_team_events (program_year_id, team_id, org_id, event_type, name, starts_at)
    values (y_live, v_team, v_org, 'league_game', 'Started game', now() - interval '10 minutes') returning id into e_started;
  insert into rep_team_events (program_year_id, team_id, org_id, event_type, name, starts_at, status)
    values (y_live, v_team, v_org, 'practice', 'Cancelled practice', now() + interval '2 days', 'cancelled') returning id into e_cancel;
  insert into rep_team_events (program_year_id, team_id, org_id, event_type, name, starts_at)
    values (y_live, v_team, v_org, 'league_game', 'Past game', now() - interval '40 days') returning id into e_past;
  insert into rep_team_events (program_year_id, team_id, org_id, event_type, name, starts_at)
    values (y_old, v_team, v_org, 'league_game', 'Old season game', now() - interval '90 days') returning id into e_old;

  -- 2. the vocabulary
  perform rep_attendance_write(e_next, r_c, 'coach', u[1], 'maybe');
  if (select status from rep_team_event_attendance where event_id = e_next and player_id = r_c) is distinct from 'maybe' then
    raise exception 'ONE RECORD FIXTURE FAIL 2: Maybe was not taken'; end if;
  begin
    perform rep_attendance_write(e_next, r_c, 'coach', u[1], 'probably');
    raise exception 'ONE RECORD FIXTURE FAIL 2: an unknown status was taken';
  exception when invalid_parameter_value then null; end;
  begin
    update rep_team_event_attendance set status = 'probably' where event_id = e_next and player_id = r_c;
    raise exception 'ONE RECORD FIXTURE FAIL 2: the CHECK took an unknown status';
  exception when check_violation then null; end;
  begin
    perform rep_attendance_write(e_next, r_c, 'family', u[2], null, null, false, repeat('x', 201), true);
    raise exception 'ONE RECORD FIXTURE FAIL 2: a 201-character family note was taken';
  exception when check_violation then null; end;
  perform rep_attendance_write(e_next, r_c, 'coach', u[1], 'unknown'); -- back to Not marked for section 7
  v_ok := v_ok + 1;

  -- 3. latest wins, with who and when
  v_j := rep_attendance_write(e_next, r_a, 'family', u[2], 'attending', null, false, 'leaving early', true);
  if (v_j->>'changed')::boolean is not true or v_j->>'prior' is distinct from 'unknown' then
    raise exception 'ONE RECORD FIXTURE FAIL 3: a first family answer did not report its change: %', v_j; end if;
  select * into rec from rep_team_event_attendance where event_id = e_next and player_id = r_a;
  if rec.set_by_kind <> 'family' or rec.set_by_user_id <> u[2] or rec.updated_by is not null or rec.family_note <> 'leaving early'
     or rec.family_note_by_user_id <> u[2] then
    raise exception 'ONE RECORD FIXTURE FAIL 3: the family''s answer was stored wrong (or wrote updated_by)'; end if;
  v_t := rec.set_at;
  v_j := rep_attendance_write(e_next, r_a, 'coach', u[1], 'absent', 'knee', true);
  select * into rec from rep_team_event_attendance where event_id = e_next and player_id = r_a;
  if rec.status <> 'absent' or rec.set_by_kind <> 'coach' or rec.set_by_user_id <> u[1] or rec.updated_by <> u[1]
     or rec.previous_status <> 'attending' or rec.previous_by_kind <> 'family' or rec.previous_by_user_id <> u[2]
     or rec.previous_at <> v_t or rec.note <> 'knee' or rec.family_note <> 'leaving early' then
    raise exception 'ONE RECORD FIXTURE FAIL 3: the coach''s change did not keep the family''s answer as "earlier"'; end if;
  v_t := rec.set_at;
  v_j := rep_attendance_write(e_next, r_a, 'family', u[2], 'absent');
  select * into rec from rep_team_event_attendance where event_id = e_next and player_id = r_a;
  if (v_j->>'changed')::boolean or rec.set_by_kind <> 'coach' or rec.set_at <> v_t or rec.previous_status <> 'attending' then
    raise exception 'ONE RECORD FIXTURE FAIL 3: re-sending the same status moved the answer'; end if;
  v_ok := v_ok + 1;

  -- 4. families lock at the start
  begin
    perform rep_attendance_write(e_started, r_a, 'family', u[2], 'attending');
    raise exception 'ONE RECORD FIXTURE FAIL 4: a family wrote after the start';
  exception when raise_exception then
    get stacked diagnostics v_s = message_text;
    if v_s <> 'attendance_closed' then raise exception 'ONE RECORD FIXTURE FAIL 4: %', v_s; end if;
  end;
  begin
    perform rep_attendance_write(e_cancel, r_a, 'family', u[2], 'attending');
    raise exception 'ONE RECORD FIXTURE FAIL 4: a family wrote on a cancelled event';
  exception when raise_exception then
    get stacked diagnostics v_s = message_text;
    if v_s <> 'attendance_closed' then raise exception 'ONE RECORD FIXTURE FAIL 4: %', v_s; end if;
  end;
  perform rep_attendance_write(e_started, r_a, 'coach', u[1], 'late');
  if (select status from rep_team_event_attendance where event_id = e_started and player_id = r_a) is distinct from 'late' then
    raise exception 'ONE RECORD FIXTURE FAIL 4: the coach could not write after the start'; end if;
  v_ok := v_ok + 1;

  -- 5. each note is its side's
  begin
    perform rep_attendance_write(e_next, r_a, 'family', u[2], null, 'my words', true);
    raise exception 'ONE RECORD FIXTURE FAIL 5: a family wrote the coach''s note';
  exception when insufficient_privilege then null; end;
  begin
    perform rep_attendance_write(e_next, r_a, 'coach', u[1], null, null, false, 'their words', true);
    raise exception 'ONE RECORD FIXTURE FAIL 5: a coach wrote the family''s note';
  exception when insufficient_privilege then null; end;
  v_ok := v_ok + 1;

  -- 6. ⚠ the nightly clean-up never deletes an answer
  -- A past event (40 days: its family note is due) and an old season (last event 90 days ago: its authorship is due). The fixture
  -- writes them directly: the family writer would refuse a started event, which is the point of section 4.
  insert into rep_team_event_attendance (event_id, player_id, program_year_id, team_id, org_id, status, note, updated_by,
      set_by_kind, set_by_user_id, set_at, previous_status, previous_by_kind, previous_by_user_id, previous_at,
      family_note, family_note_by_user_id, family_note_at)
    values (e_past, r_a, y_live, v_team, v_org, 'attending', 'coach words', u[1],
      'family', u[2], now() - interval '41 days', 'absent', 'coach', u[1], now() - interval '42 days',
      'old words', u[2], now() - interval '41 days');
  insert into rep_team_event_attendance (event_id, player_id, program_year_id, team_id, org_id, status, note, updated_by,
      set_by_kind, set_by_user_id, set_at, previous_status, previous_by_kind, previous_by_user_id, previous_at)
    values (e_old, r_a, y_old, v_team, v_org, 'absent', 'old coach words', u[1],
      'coach', u[1], now() - interval '91 days', 'attending', 'family', u[2], now() - interval '92 days');
  select count(*) into v_n from rep_team_event_attendance where team_id = v_team;
  select count(*) into v_m from rep_team_event_attendance;
  perform event_availability_purge();
  if (select count(*) from rep_team_event_attendance where team_id = v_team) <> v_n
     or (select count(*) from rep_team_event_attendance) <> v_m then
    raise exception 'ONE RECORD FIXTURE FAIL 6: THE CLEAN-UP DELETED AN ATTENDANCE ROW'; end if;
  select * into rec from rep_team_event_attendance where event_id = e_past and player_id = r_a;
  if rec.family_note is not null or rec.family_note_by_user_id is not null or rec.family_note_at is not null then
    raise exception 'ONE RECORD FIXTURE FAIL 6: a family note 30+ days after its event was kept'; end if;
  if rec.status <> 'attending' or rec.note <> 'coach words' or rec.updated_by <> u[1] or rec.set_by_user_id <> u[2]
     or rec.previous_status <> 'absent' then
    raise exception 'ONE RECORD FIXTURE FAIL 6: the clean-up touched an answer, the coach''s note or a live season''s authorship'; end if;
  if (select family_note from rep_team_event_attendance where event_id = e_next and player_id = r_a) is distinct from 'leaving early' then
    raise exception 'ONE RECORD FIXTURE FAIL 6: an upcoming event''s family note was blanked'; end if;
  select * into rec from rep_team_event_attendance where event_id = e_old and player_id = r_a;
  if rec.set_by_user_id is not null or rec.previous_status is not null or rec.previous_by_kind is not null
     or rec.previous_by_user_id is not null or rec.previous_at is not null then
    raise exception 'ONE RECORD FIXTURE FAIL 6: an old season''s who-set-it or "earlier" was kept'; end if;
  if rec.status <> 'absent' or rec.note <> 'old coach words' or rec.updated_by <> u[1] or rec.set_by_kind <> 'coach' then
    raise exception 'ONE RECORD FIXTURE FAIL 6: the clean-up touched an old season''s answer, coach note or audit'; end if;
  if event_availability_purge() <> 0 then raise exception 'ONE RECORD FIXTURE FAIL 6: a second run found more to blank'; end if;
  v_ok := v_ok + 1;

  -- 7. "All in" fills only players nobody answered (r_a: coach Out; r_b: family Out; r_c: Not marked; a fourth: no row).
  perform rep_attendance_write(e_next, r_b, 'family', u[3], 'absent');
  v_j := rep_attendance_write_many(e_next, u[1], jsonb_build_array(
    jsonb_build_object('player_id', r_a, 'status', 'attending'),
    jsonb_build_object('player_id', r_b, 'status', 'attending'),
    jsonb_build_object('player_id', r_c, 'status', 'attending')), true);
  if (select status from rep_team_event_attendance where event_id = e_next and player_id = r_a) <> 'absent'
     or (select status from rep_team_event_attendance where event_id = e_next and player_id = r_b) <> 'absent' then
    raise exception 'ONE RECORD FIXTURE FAIL 7: All in overwrote an answer'; end if;
  if (select status from rep_team_event_attendance where event_id = e_next and player_id = r_c) <> 'attending' then
    raise exception 'ONE RECORD FIXTURE FAIL 7: All in skipped a Not marked player'; end if;
  perform rep_attendance_write_many(e_cancel, u[1], jsonb_build_array(jsonb_build_object('player_id', r_c, 'status', 'attending')), true);
  if (select status from rep_team_event_attendance where event_id = e_cancel and player_id = r_c) is distinct from 'attending' then
    raise exception 'ONE RECORD FIXTURE FAIL 7: All in skipped a player with no row'; end if;
  v_ok := v_ok + 1;

  -- 8. "Reset" clears only the coach's answers
  perform rep_attendance_write_many(e_next, u[1], jsonb_build_array(
    jsonb_build_object('player_id', r_a, 'status', 'unknown'),
    jsonb_build_object('player_id', r_b, 'status', 'unknown'),
    jsonb_build_object('player_id', r_c, 'status', 'unknown')), false, 'coach');
  if (select status from rep_team_event_attendance where event_id = e_next and player_id = r_a) <> 'unknown'
     or (select status from rep_team_event_attendance where event_id = e_next and player_id = r_c) <> 'unknown' then
    raise exception 'ONE RECORD FIXTURE FAIL 8: Reset kept a coach''s answer'; end if;
  if (select status from rep_team_event_attendance where event_id = e_next and player_id = r_b) <> 'absent' then
    raise exception 'ONE RECORD FIXTURE FAIL 8: Reset cleared a family''s answer'; end if;
  perform rep_attendance_write_many(e_started, u[1], jsonb_build_array(jsonb_build_object('player_id', r_b, 'status', 'unknown')), false, 'coach');
  if exists (select 1 from rep_team_event_attendance where event_id = e_started and player_id = r_b) then
    raise exception 'ONE RECORD FIXTURE FAIL 8: Reset made a row for a player nobody answered'; end if;
  v_ok := v_ok + 1;

  -- 9. the Remind claim
  select claimed, reminded_at into v_b, v_t from event_availability_remind_claim('rep_event', e_next, u[1]);
  if not v_b then raise exception 'ONE RECORD FIXTURE FAIL 9: the first Remind was refused'; end if;
  select claimed into v_b from event_availability_remind_claim('rep_event', e_next, u[1]);
  if v_b then raise exception 'ONE RECORD FIXTURE FAIL 9: a second Remind inside 24 hours was taken'; end if;
  v_ok := v_ok + 1;

  -- 10. C1: a new day clears nothing
  update rep_team_events set starts_at = starts_at + interval '1 day' where id = e_next;
  if (select status from rep_team_event_attendance where event_id = e_next and player_id = r_b) <> 'absent'
     or not exists (select 1 from event_availability_reminders where event_kind = 'rep_event' and event_id = e_next) then
    raise exception 'ONE RECORD FIXTURE FAIL 10: a new day cleared an answer or the Remind log'; end if;
  v_ok := v_ok + 1;

  -- 11. a parent's connection ends: their family notes on that child go (the answer stays; another parent's note stays)
  insert into family_links (org_id, rep_team_id, role, child_id, player_id, invited_email, status, verified_via, user_id)
    values (v_org, v_team, 'guardian', c_a, r_a, 'one-rec-fx-a@example.invalid', 'verified', 'coach_approved', u[2]) returning id into l_a;
  perform rep_attendance_write(e_next, r_b, 'family', u[3], null, null, false, 'theirs', true);
  update family_links set status = 'revoked', revoked_at = now() where id = l_a;
  select * into rec from rep_team_event_attendance where event_id = e_next and player_id = r_a;
  if rec.family_note is not null or rec.family_note_by_user_id is not null then
    raise exception 'ONE RECORD FIXTURE FAIL 11: a leaving parent''s note was kept'; end if;
  if rec.status <> 'unknown' and rec.status <> 'absent' then raise exception 'ONE RECORD FIXTURE FAIL 11: the answer moved'; end if;
  if (select family_note from rep_team_event_attendance where event_id = e_next and player_id = r_b) is distinct from 'theirs' then
    raise exception 'ONE RECORD FIXTURE FAIL 11: another parent''s note was blanked'; end if;
  v_ok := v_ok + 1;

  -- 12. the note's writer cleared (the FK's set-null on an account deletion) takes the words
  update rep_team_event_attendance set family_note_by_user_id = null where event_id = e_next and player_id = r_b;
  select * into rec from rep_team_event_attendance where event_id = e_next and player_id = r_b;
  if rec.family_note is not null or rec.family_note_at is not null or rec.status <> 'absent' then
    raise exception 'ONE RECORD FIXTURE FAIL 12: a gone writer''s note was kept (or the answer moved)'; end if;
  v_ok := v_ok + 1;

  -- 13. a child join keeps every answer: a second record of Maya, rostered LAST season with an answer there, is absorbed into this
  -- season's Maya; its roster entry, and so its answer, stay (the record rides the entry, not the child).
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth)
    values (y_old, v_team, v_org, 'Maya', 'Fixture-Twin', date '2016-04-01') returning id into v_id;
  select child_id into c_b from rep_roster_players where id = v_id;
  perform rep_attendance_write(e_old, v_id, 'coach', u[1], 'late');
  perform org_children_join(c_a, c_b);
  if (select child_id from rep_roster_players where id = v_id) is distinct from c_a
     or (select status from rep_team_event_attendance where event_id = e_old and player_id = v_id) is distinct from 'late' then
    raise exception 'ONE RECORD FIXTURE FAIL 13: a child join lost an answer'; end if;
  v_ok := v_ok + 1;

  raise exception 'ONE RECORD FIXTURE OK: %/13', v_ok;
end $fixture$;
