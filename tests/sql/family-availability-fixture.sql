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
--   7. the coach's attendance book is never touched by the purge;
--   8. (mig 480) a new day clears the event's answers and Remind log; a same-day time change and a cancel keep them;
--   9. (mig 480) a parent's connection ending clears their notes on that child (answers kept; the other parent's note kept; a merge
--      clears nothing);
--  10. (mig 480) the answering account cleared (an account deletion) takes the note;
--  11. (mig 482) a child join carries the absorbed record's answers to the kept child; on a clash the newer answer wins.
do $fixture$
declare
  v_org uuid; v_team uuid; y_live uuid; y_old uuid;
  e_past uuid; e_recent uuid; e_next uuid; e_old uuid; e_gone uuid;
  r_a uuid; c_a uuid; r_b uuid; c_b uuid; e_merge uuid;
  a_past uuid; a_recent uuid; a_old uuid; a_next uuid; l_a uuid; u_two uuid[];
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

  -- ── Session 3 (mig 480) ───────────────────────────────────────────────────────────────────────────────────────────────────
  -- 8. a new DAY clears the event's answers and Remind log; a new time on the same day keeps them; a cancel keeps them
  delete from event_availability_reminders where event_id = e_next;
  insert into event_availability_reminders (event_kind, event_id) values ('rep_event', e_next);
  update rep_team_events set starts_at = starts_at + interval '1 minute' where id = e_next;
  update rep_team_events set status = 'cancelled' where id = e_next;
  update rep_team_events set status = 'scheduled' where id = e_next;
  if not exists (select 1 from event_availability_answers where event_id = e_next)
     or not exists (select 1 from event_availability_reminders where event_id = e_next) then
    raise exception 'S4B FIXTURE FAIL 8: a same-day time change or a cancel cleared the answers'; end if;
  update rep_team_events set starts_at = starts_at + interval '1 day' where id = e_next;
  if exists (select 1 from event_availability_answers where event_id = e_next)
     or exists (select 1 from event_availability_reminders where event_id = e_next) then
    raise exception 'S4B FIXTURE FAIL 8: a new day kept the answers or the Remind log'; end if;
  v_ok := v_ok + 1;

  -- 9. a parent's connection ends: their notes on THAT child go, the answers stay; another parent's note stays; a merge keeps it
  select array_agg(id) into u_two from (select id from auth.users order by created_at limit 2) u;
  if coalesce(array_length(u_two, 1), 0) < 2 then raise exception 'S4B FIXTURE FAIL 9: dev needs two accounts to build with'; end if;
  insert into family_links (org_id, rep_team_id, role, child_id, player_id, invited_email, status, verified_via, user_id)
    values (v_org, v_team, 'guardian', c_a, r_a, 's4b-fx-a@example.invalid', 'verified', 'coach_approved', u_two[1]) returning id into l_a;
  insert into family_links (org_id, rep_team_id, role, child_id, player_id, invited_email, status, verified_via, user_id)
    values (v_org, v_team, 'guardian', c_a, r_a, 's4b-fx-b@example.invalid', 'verified', 'coach_approved', u_two[2]);
  update event_availability_answers set note = 'mine', answered_by_user_id = u_two[1] where id = a_recent;
  insert into event_availability_answers (event_kind, event_id, child_id, answer, note, answered_by_user_id)
    values ('rep_event', e_next, c_a, 'in', 'theirs', u_two[2]) returning id into a_next;
  update family_links set status = 'revoked', ended_by = 'merged', revoked_at = now() where id = l_a;
  if (select note from event_availability_answers where id = a_recent) is distinct from 'mine' then
    raise exception 'S4B FIXTURE FAIL 9: a merge cleared the note'; end if;
  update family_links set status = 'verified', ended_by = null, revoked_at = null where id = l_a;
  update family_links set status = 'revoked', ended_by = 'parent', revoked_at = now() where id = l_a;
  if (select note from event_availability_answers where id = a_recent) is not null then
    raise exception 'S4B FIXTURE FAIL 9: a leaving parent''s note was kept'; end if;
  if (select answer from event_availability_answers where id = a_recent) is distinct from 'maybe' then
    raise exception 'S4B FIXTURE FAIL 9: a leaving parent''s answer went with the note'; end if;
  if (select note from event_availability_answers where id = a_next) is distinct from 'theirs' then
    raise exception 'S4B FIXTURE FAIL 9: the other parent''s note was cleared'; end if;
  v_ok := v_ok + 1;

  -- 10. the answering account cleared (what an account deletion's ON DELETE SET NULL does): the note goes with it
  update event_availability_answers set answered_by_user_id = null where id = a_next;
  if (select note from event_availability_answers where id = a_next) is not null then
    raise exception 'S4B FIXTURE FAIL 10: a deleted account''s note was kept'; end if;
  v_ok := v_ok + 1;

  -- ── Session 4 (mig 482) ───────────────────────────────────────────────────────────────────────────────────────────────────
  -- 11. a child join keeps the families' answers: the absorbed record's answer moves; on a clash the newer answer wins
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth)
    values (y_old, v_team, v_org, 'Myah', 'Fixturedup', date '2015-09-09') returning id into r_b;
  select child_id into c_b from rep_roster_players where id = r_b;
  if c_b is null or c_b = c_a then raise exception 'S4B FIXTURE FAIL 11: the second roster entry made no separate child'; end if;
  insert into rep_team_events (program_year_id, team_id, org_id, event_type, name, starts_at)
    values (y_live, v_team, v_org, 'league_game', 'Merge game', now() + interval '5 days') returning id into e_merge;
  -- c_a: Maybe on e_recent (a_recent) and In on e_next (a_next). c_b: Out on e_next (NEWER: wins), In on e_recent (OLDER: loses),
  -- Maybe on e_merge (no clash: moves).
  update event_availability_answers set answered_at = now() - interval '1 hour' where id = a_next;
  insert into event_availability_answers (event_kind, event_id, child_id, answer, answered_at) values
    ('rep_event', e_next, c_b, 'out', now()),
    ('rep_event', e_recent, c_b, 'in', now() - interval '30 days'),
    ('rep_event', e_merge, c_b, 'maybe', now());
  perform public.org_children_join(c_a, c_b);
  if exists (select 1 from event_availability_answers where child_id = c_b) then
    raise exception 'S4B FIXTURE FAIL 11: an answer stayed on the absorbed child'; end if;
  if (select answer from event_availability_answers where event_id = e_next and child_id = c_a) is distinct from 'out' then
    raise exception 'S4B FIXTURE FAIL 11: the newer answer did not win the clash'; end if;
  if (select answer from event_availability_answers where event_id = e_recent and child_id = c_a) is distinct from 'maybe' then
    raise exception 'S4B FIXTURE FAIL 11: an older answer beat the kept child''s newer one'; end if;
  if (select answer from event_availability_answers where event_id = e_merge and child_id = c_a) is distinct from 'maybe' then
    raise exception 'S4B FIXTURE FAIL 11: the absorbed child''s answer was lost'; end if;
  v_ok := v_ok + 1;

  raise exception 'S4B FIXTURE OK: %/11', v_ok;
end $fixture$;
