-- schedule-parts-fixture.sql — Add time is its own part, Session 1 (mig 491; plan CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md §8 Phase 8;
-- /dba Finding #52). An added part is its own club_schedules row, linked to the final schedule it was added to.
--
-- DEV ONLY. Run:  node scripts/db-query.mjs --dev -f tests/sql/schedule-parts-fixture.sql
-- ONE DO block that ENDS BY RAISING: 'SCHEDULE PARTS FIXTURE OK: n/n' on success, 'SCHEDULE PARTS FIXTURE FAIL …' at the first
-- broken rule. Either way the raise rolls back every row it wrote.
--
--   1. a part needs a FINAL schedule (a draft parent is refused);
--   2. a part's name is "{parent} · {label}", and a parent's rename reaches it;
--   3. one level only (a part of a part is refused), and the link never changes;
--   4. a label is used once per schedule; a part is never in review;
--   5. a slot's family is its parent; the same place at the same start in parent and part is refused;
--   6. the same team at the same time in parent and part is refused (club_schedule_assert_no_team_twice);
--   7. the parent can't be deleted while it has a part; deleting an unsent part takes its slots.
do $fixture$
declare
  v_org uuid; v_venue uuid; v_team uuid;
  v_parent uuid; v_part uuid; v_ps uuid; v_cs uuid; v_draft uuid;
  v_name text; v_code text; v_n integer;
  v_ok integer := 0;
begin
  insert into organizations(name, slug, plan_id) values ('CHECK parts', 'check-parts-' || substr(md5(random()::text), 1, 10), 'club')
    returning id into v_org;
  insert into org_venues(org_id, name) values (v_org, 'CHECK Kinsmen') returning id into v_venue;
  insert into rep_teams (org_id, name, slug) values (v_org, '14U AA', 'parts-fx-' || substr(md5(random()::text), 1, 6)) returning id into v_team;
  insert into club_schedules(org_id, name, state, starts_on, ends_on) values (v_org, 'Fall practices', 'final', date '2027-09-01', date '2027-11-30')
    returning id into v_parent;
  insert into club_schedules(org_id, name, state, starts_on, ends_on) values (v_org, 'Spring draft', 'draft', date '2027-03-01', date '2027-05-30')
    returning id into v_draft;

  -- 1. a draft parent is refused
  begin
    insert into club_schedules(org_id, name, starts_on, ends_on, part_of_schedule_id, part_label)
      values (v_org, 'x', date '2027-03-01', date '2027-03-31', v_draft, 'Time added Nov 16');
    v_code := 'wrote';
  exception when raise_exception then v_code := split_part(SQLERRM, ':', 1); end;
  if v_code <> 'schedule_part' then raise exception 'SCHEDULE PARTS FIXTURE FAIL 1: a part was added to a draft (%)', v_code; end if;
  v_ok := v_ok + 1;

  -- 2. the name follows the parent
  insert into club_schedules(org_id, name, starts_on, ends_on, part_of_schedule_id, part_label)
    values (v_org, 'anything', date '2027-11-01', date '2027-12-20', v_parent, 'Time added Nov 16') returning id, name into v_part, v_name;
  if v_name <> 'Fall practices · Time added Nov 16' then raise exception 'SCHEDULE PARTS FIXTURE FAIL 2: the part is named %', v_name; end if;
  update club_schedules set name = 'Fall 2027 practices' where id = v_parent;
  select name into v_name from club_schedules where id = v_part;
  if v_name <> 'Fall 2027 practices · Time added Nov 16' then raise exception 'SCHEDULE PARTS FIXTURE FAIL 2: the rename did not reach the part (%)', v_name; end if;
  v_ok := v_ok + 1;

  -- 3. one level; the link never moves
  begin
    insert into club_schedules(org_id, name, state, starts_on, ends_on, part_of_schedule_id, part_label)
      values (v_org, 'x', 'final', date '2027-11-01', date '2027-11-30', v_part, 'Time added Nov 17');
    v_code := 'wrote';
  exception when raise_exception then v_code := split_part(SQLERRM, ':', 1); end;
  if v_code <> 'schedule_part' then raise exception 'SCHEDULE PARTS FIXTURE FAIL 3: a part of a part was made (%)', v_code; end if;
  begin
    update club_schedules set part_of_schedule_id = null, part_label = null where id = v_part;
    v_code := 'wrote';
  exception when raise_exception then v_code := split_part(SQLERRM, ':', 1); end;
  if v_code <> 'schedule_part' then raise exception 'SCHEDULE PARTS FIXTURE FAIL 3: a part left its schedule (%)', v_code; end if;
  v_ok := v_ok + 1;

  -- 4. a label once per schedule; never in review
  begin
    insert into club_schedules(org_id, name, starts_on, ends_on, part_of_schedule_id, part_label)
      values (v_org, 'x', date '2027-11-01', date '2027-11-30', v_parent, 'Time added Nov 16');
    v_code := 'wrote';
  exception when unique_violation then v_code := 'refused'; end;
  if v_code <> 'refused' then raise exception 'SCHEDULE PARTS FIXTURE FAIL 4: the same label was used twice'; end if;
  begin
    update club_schedules set state = 'in_review' where id = v_part;
    v_code := 'wrote';
  exception when check_violation then v_code := 'refused'; end;
  if v_code <> 'refused' then raise exception 'SCHEDULE PARTS FIXTURE FAIL 4: a part went to review'; end if;
  v_ok := v_ok + 1;

  -- 5. the family takes a place once
  insert into club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
    values (v_org, v_parent, v_venue, timestamptz '2027-11-10 18:00-05', timestamptz '2027-11-10 19:30-05') returning id into v_ps;
  insert into club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
    values (v_org, v_part, v_venue, timestamptz '2027-11-10 19:30-05', timestamptz '2027-11-10 21:00-05') returning id into v_cs;
  if (select family_id from club_schedule_slots where id = v_cs) <> v_parent then
    raise exception 'SCHEDULE PARTS FIXTURE FAIL 5: the part''s slot does not know its family'; end if;
  begin
    insert into club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
      values (v_org, v_part, v_venue, timestamptz '2027-11-10 18:00-05', timestamptz '2027-11-10 19:30-05');
    v_code := 'wrote';
  exception when unique_violation then v_code := 'refused'; end;
  if v_code <> 'refused' then raise exception 'SCHEDULE PARTS FIXTURE FAIL 5: the part took its parent''s place at the same start'; end if;
  v_ok := v_ok + 1;

  -- 6. no team twice across the family
  insert into club_schedule_slot_teams(slot_id, team_id, org_id) values (v_ps, v_team, v_org);
  insert into club_schedule_slot_teams(slot_id, team_id, org_id) values (v_cs, v_team, v_org);
  perform club_schedule_assert_no_team_twice(v_part);   -- back to back, not overlapping: fine
  update club_schedule_slots set starts_at = timestamptz '2027-11-10 19:00-05' where id = v_cs;
  begin
    perform club_schedule_assert_no_team_twice(v_part);
    v_code := 'passed';
  exception when raise_exception then v_code := split_part(SQLERRM, ':', 1); end;
  if v_code <> 'team_twice' then raise exception 'SCHEDULE PARTS FIXTURE FAIL 6: the part''s save let 14U AA hold two slots at once (%)', v_code; end if;
  begin
    perform club_schedule_assert_no_team_twice(v_parent);
    v_code := 'passed';
  exception when raise_exception then v_code := split_part(SQLERRM, ':', 1); end;
  if v_code <> 'team_twice' then raise exception 'SCHEDULE PARTS FIXTURE FAIL 6: the parent''s save did not see the part (%)', v_code; end if;
  v_ok := v_ok + 1;

  -- 7. a parent with a part is not deleted; an unsent part goes with its slots
  begin
    delete from club_schedules where id = v_parent;
    v_code := 'deleted';
  exception when foreign_key_violation then v_code := 'refused'; end;
  if v_code <> 'refused' then raise exception 'SCHEDULE PARTS FIXTURE FAIL 7: the parent was deleted under its part'; end if;
  delete from club_schedules where id = v_part;
  select count(*) into v_n from club_schedule_slots where schedule_id = v_part;
  if v_n <> 0 or not exists (select 1 from club_schedule_slots where id = v_ps) then
    raise exception 'SCHEDULE PARTS FIXTURE FAIL 7: deleting the part left its slots, or took the parent''s'; end if;
  v_ok := v_ok + 1;

  raise exception 'SCHEDULE PARTS FIXTURE OK: %/7', v_ok;
end $fixture$;
