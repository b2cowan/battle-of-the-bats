-- family-availability-fixture.sql — Signed-in family accounts Stage 4b, Part 1 (mig 476): the family answer record, the Remind log's
-- 24-hour claim, and the purge.
--
-- DEV ONLY. Run:  node .probe/s2-child/q.mjs --file tests/sql/family-availability-fixture.sql
-- ONE DO block that ENDS BY RAISING: 'S4B FIXTURE OK: n/n' on success, 'S4B FIXTURE FAIL …' at the first broken rule. Either way the
-- raise rolls back every row it wrote.
--
--   1. a new team's switch is 'off'; a value outside off|games|games_and_practices is refused;
--   2. one answer per child per event (latest wins in place); a second row for the same child and event is refused;
--   3. answer outside in|out|maybe, a 201-character note, an empty note and an unknown event kind are refused;
--   4. the Remind claim: the first claims, a second inside 24 hours is refused and names the first's time; one 25 hours old does not block;
--   5. the purge clears a note 30+ days after its event, keeps a recent one, keeps the answer while its season's last event is recent,
--      and deletes the answers of a season whose last event is 60+ days ago;
--   6. a deleted rep event takes its answers and its Remind rows;
--   7. the coach's attendance book is never touched by the purge.
do $fixture$
declare
  v_org uuid; v_team uuid; y_live uuid; y_old uuid;
  e_past uuid; e_recent uuid; e_next uuid; e_old uuid; e_gone uuid;
  r_a uuid; c_a uuid;
  a_past uuid; a_recent uuid; a_old uuid;
  v_ok int := 0; v_n int; v_s text; v_b boolean; v_t timestamptz; v_id uuid;
begin
  select o.id into v_org from organizations o where exists (select 1 from rep_teams t where t.org_id = o.id) limit 1;
  if v_org is null then raise exception 'S4B FIXTURE FAIL: no organization to build in'; end if;

  -- 1. the switch
  insert into rep_teams (org_id, name, slug) values (v_org, 'S4B Fixture', 's4b-fx-' || substr(md5(random()::text), 1, 6)) returning id into v_team;
  select family_answers into v_s from rep_teams where id = v_team;
  if v_s is distinct from 'off' then raise exception 'S4B FIXTURE FAIL 1: a new team''s switch is %', v_s; end if;
  begin
    update rep_teams set family_answers = 'everything' where id = v_team;
    raise exception 'S4B FIXTURE FAIL 1: an unknown switch value was taken';
  exception when check_violation then null; end;
  update rep_teams set family_answers = 'games_and_practices' where id = v_team;
  v_ok := v_ok + 1;

  insert into rep_program_years (team_id, org_id, name, year, status) values (v_team, v_org, '2027 Season', 2027, 'active') returning id into y_live;
  insert into rep_program_years (team_id, org_id, name, year, status) values (v_team, v_org, '2025 Season', 2025, 'completed') returning id into y_old;
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth)
    values (y_live, v_team, v_org, 'Maya', 'Fixture', date '2016-04-01') returning id into r_a;
  select child_id into c_a from rep_roster_players where id = r_a;
  if c_a is null then raise exception 'S4B FIXTURE FAIL: the roster entry made no child'; end if;

  insert into rep_team_events (program_year_id, team_id, org_id, event_type, name, starts_at)
    values (y_live, v_team, v_org, 'league_game', 'Past game', now() - interval '40 days') returning id into e_past;
  insert into rep_team_events (program_year_id, team_id, org_id, event_type, name, starts_at)
    values (y_live, v_team, v_org, 'practice', 'Recent practice', now() - interval '5 days') returning id into e_recent;
  insert into rep_team_events (program_year_id, team_id, org_id, event_type, name, starts_at)
    values (y_live, v_team, v_org, 'league_game', 'Next game', now() + interval '3 days') returning id into e_next;
  insert into rep_team_events (program_year_id, team_id, org_id, event_type, name, starts_at)
    values (y_old, v_team, v_org, 'league_game', 'Old season game', now() - interval '90 days') returning id into e_old;
  insert into rep_team_events (program_year_id, team_id, org_id, event_type, name, starts_at)
    values (y_live, v_team, v_org, 'league_game', 'Deleted game', now() + interval '10 days') returning id into e_gone;

  -- 2. one answer per child per event
  insert into event_availability_answers (event_kind, event_id, child_id, answer, note)
    values ('rep_event', e_next, c_a, 'in', 'see you there') returning id into v_id;
  begin
    insert into event_availability_answers (event_kind, event_id, child_id, answer) values ('rep_event', e_next, c_a, 'out');
    raise exception 'S4B FIXTURE FAIL 2: a second answer for one child and event was taken';
  exception when unique_violation then null; end;
  update event_availability_answers
     set previous_answer = answer, previous_at = answered_at, answer = 'out', note = null, answered_at = now()
   where id = v_id;
  select count(*) into v_n from event_availability_answers where event_id = e_next and child_id = c_a and answer = 'out' and previous_answer = 'in';
  if v_n <> 1 then raise exception 'S4B FIXTURE FAIL 2: latest-wins in place did not hold (% rows)', v_n; end if;
  v_ok := v_ok + 1;

  -- 3. the checks
  begin
    insert into event_availability_answers (event_kind, event_id, child_id, answer) values ('rep_event', e_recent, c_a, 'late');
    raise exception 'S4B FIXTURE FAIL 3: answer "late" was taken';
  exception when check_violation then null; end;
  begin
    insert into event_availability_answers (event_kind, event_id, child_id, answer, note)
      values ('rep_event', e_recent, c_a, 'in', repeat('x', 201));
    raise exception 'S4B FIXTURE FAIL 3: a 201-character note was taken';
  exception when check_violation then null; end;
  begin
    insert into event_availability_answers (event_kind, event_id, child_id, answer, note) values ('rep_event', e_recent, c_a, 'in', '');
    raise exception 'S4B FIXTURE FAIL 3: an empty note was taken';
  exception when check_violation then null; end;
  begin
    insert into event_availability_answers (event_kind, event_id, child_id, answer) values ('tournament', e_recent, c_a, 'in');
    raise exception 'S4B FIXTURE FAIL 3: an unknown event kind was taken';
  exception when check_violation then null; end;
  v_ok := v_ok + 1;

  -- 4. the Remind claim
  select claimed into v_b from event_availability_remind_claim('rep_event', e_next, null);
  if v_b is distinct from true then raise exception 'S4B FIXTURE FAIL 4: the first Remind was not claimed'; end if;
  select claimed, reminded_at into v_b, v_t from event_availability_remind_claim('rep_event', e_next, null);
  if v_b is distinct from false or v_t is null then raise exception 'S4B FIXTURE FAIL 4: a second Remind inside 24 hours was claimed'; end if;
  update event_availability_reminders set reminded_at = now() - interval '25 hours' where event_id = e_next;
  select claimed into v_b from event_availability_remind_claim('rep_event', e_next, null);
  if v_b is distinct from true then raise exception 'S4B FIXTURE FAIL 4: a 25-hour-old Remind still blocked'; end if;
  select count(*) into v_n from event_availability_reminders where event_id = e_next;
  if v_n <> 2 then raise exception 'S4B FIXTURE FAIL 4: expected 2 Remind rows, found %', v_n; end if;
  v_ok := v_ok + 1;

  -- 5. the purge
  insert into event_availability_answers (event_kind, event_id, child_id, answer, note)
    values ('rep_event', e_past, c_a, 'out', 'away') returning id into a_past;
  insert into event_availability_answers (event_kind, event_id, child_id, answer, note)
    values ('rep_event', e_recent, c_a, 'maybe', 'maybe late') returning id into a_recent;
  insert into event_availability_answers (event_kind, event_id, child_id, answer, note)
    values ('rep_event', e_old, c_a, 'in', 'old note') returning id into a_old;
  insert into event_availability_reminders (event_kind, event_id, reminded_at) values ('rep_event', e_old, now() - interval '91 days');
  -- 7. (set-up) the coach's book on the old season's game
  insert into rep_team_event_attendance (event_id, player_id, program_year_id, team_id, org_id, status)
    values (e_old, r_a, y_old, v_team, v_org, 'attending')
    on conflict do nothing;

  perform event_availability_purge();
  if (select note from event_availability_answers where id = a_past) is not null then
    raise exception 'S4B FIXTURE FAIL 5: a 40-day-old note was kept'; end if;
  if (select answer from event_availability_answers where id = a_past) is distinct from 'out' then
    raise exception 'S4B FIXTURE FAIL 5: the answer went with its note (its season is live)'; end if;
  if (select note from event_availability_answers where id = a_recent) is distinct from 'maybe late' then
    raise exception 'S4B FIXTURE FAIL 5: a 5-day-old note was cleared'; end if;
  if exists (select 1 from event_availability_answers where id = a_old) then
    raise exception 'S4B FIXTURE FAIL 5: an answer of a season whose last event was 90 days ago was kept'; end if;
  if exists (select 1 from event_availability_reminders where event_id = e_old) then
    raise exception 'S4B FIXTURE FAIL 5: the old season''s Remind row was kept'; end if;
  v_ok := v_ok + 1;

  -- 6. a deleted event takes its answers and Remind rows
  insert into event_availability_answers (event_kind, event_id, child_id, answer) values ('rep_event', e_gone, c_a, 'in');
  insert into event_availability_reminders (event_kind, event_id) values ('rep_event', e_gone);
  delete from rep_team_events where id = e_gone;
  if exists (select 1 from event_availability_answers where event_id = e_gone)
     or exists (select 1 from event_availability_reminders where event_id = e_gone) then
    raise exception 'S4B FIXTURE FAIL 6: a deleted event left its answers or Remind rows'; end if;
  v_ok := v_ok + 1;

  -- 7. the coach's book is untouched
  select count(*) into v_n from rep_team_event_attendance where event_id = e_old and player_id = r_a;
  if v_n <> 1 then raise exception 'S4B FIXTURE FAIL 7: the purge touched the coach''s attendance book'; end if;
  v_ok := v_ok + 1;

  raise exception 'S4B FIXTURE OK: %/7', v_ok;
end $fixture$;
