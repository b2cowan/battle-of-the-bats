-- schedule-part-save-fixture.sql — Add time makes a part, Session 2 (mig 494; plan CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md §8
-- Phase 8). club_schedule_save writes an added part's link and label on insert, in the same transaction as its practices.
--
-- DEV ONLY. Run:  node scripts/db-query.mjs --dev -f tests/sql/schedule-part-save-fixture.sql
-- ONE DO block that ENDS BY RAISING: 'SCHEDULE PART SAVE FIXTURE OK: n/n' on success, 'SCHEDULE PART SAVE FIXTURE FAIL …' at
-- the first broken rule. Either way the raise rolls back every row it wrote.
--
--   1. a save with partOfScheduleId + partLabel makes a part of the final schedule, named "{parent} · {label}", with its slots;
--   2. a save without them makes a schedule of its own, exactly as before (no link, no label, its own name);
--   3. a part of a DRAFT is refused, and nothing is left behind;
--   4. a part whose practice takes the parent's place at the same start is refused WHOLE — no empty part is left behind;
--   5. the update branch never moves a part's link (a later save of the part keeps it a part);
--   6. making the part leaves the schedule it was added to byte-identical: its row and its slots (and their teams).
do $fixture$
declare
  v_org uuid; v_venue uuid; v_team uuid;
  v_parent uuid; v_draft uuid; v_r jsonb; v_part uuid;
  v_name text; v_label text; v_link uuid; v_code text; v_n integer;
  v_before text; v_after text;
  v_ok integer := 0;
begin
  insert into organizations(name, slug, plan_id) values ('CHECK part save', 'check-part-save-' || substr(md5(random()::text), 1, 10), 'club')
    returning id into v_org;
  insert into org_venues(org_id, name) values (v_org, 'CHECK Prospect') returning id into v_venue;
  insert into rep_teams (org_id, name, slug) values (v_org, '14U AA', 'part-save-fx-' || substr(md5(random()::text), 1, 6)) returning id into v_team;
  insert into club_schedules(org_id, name, state, starts_on, ends_on) values (v_org, 'Fall practices', 'final', date '2027-09-01', date '2027-11-30')
    returning id into v_parent;
  insert into club_schedules(org_id, name, state, starts_on, ends_on) values (v_org, 'Spring draft', 'draft', date '2027-03-01', date '2027-05-30')
    returning id into v_draft;
  insert into club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
    values (v_org, v_parent, v_venue, timestamptz '2027-11-10 18:00-05', timestamptz '2027-11-10 19:30-05');

  v_before := (select md5(row_to_json(s)::text) from club_schedules s where id = v_parent)
    || (select md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id), '')) from club_schedule_slots x where schedule_id = v_parent);

  -- 1. a part, with its practice, in one save
  v_r := club_schedule_save(v_org, null, null, 1, jsonb_build_object(
    'name', 'Time added Nov 17', 'startsOn', '2027-12-10', 'endsOn', '2027-12-10', 'settings', '{}'::jsonb,
    'partOfScheduleId', v_parent, 'partLabel', 'Time added Nov 17',
    'slots', jsonb_build_array(jsonb_build_object('venueId', v_venue, 'startsAt', '2027-12-10T23:00:00Z', 'endsAt', '2027-12-11T00:30:00Z',
      'teamIds', jsonb_build_array(v_team)))));
  v_part := (v_r->>'id')::uuid;
  select name, part_label, part_of_schedule_id into v_name, v_label, v_link from club_schedules where id = v_part;
  select count(*) into v_n from club_schedule_slots where schedule_id = v_part and family_id = v_parent;
  if v_link is distinct from v_parent or v_label <> 'Time added Nov 17' or v_name <> 'Fall practices · Time added Nov 17' or v_n <> 1 then
    raise exception 'SCHEDULE PART SAVE FIXTURE FAIL 1: link %, label %, name %, slots %', v_link, v_label, v_name, v_n; end if;
  v_ok := v_ok + 1;

  -- 2. a schedule of its own, as before
  v_r := club_schedule_save(v_org, null, null, 1, jsonb_build_object('name', 'Winter practices', 'startsOn', '2028-01-04', 'endsOn', '2028-03-28', 'settings', '{}'::jsonb));
  select name, part_label, part_of_schedule_id into v_name, v_label, v_link from club_schedules where id = (v_r->>'id')::uuid;
  if v_link is not null or v_label is not null or v_name <> 'Winter practices' then
    raise exception 'SCHEDULE PART SAVE FIXTURE FAIL 2: a plain save made link %, label %, name %', v_link, v_label, v_name; end if;
  v_ok := v_ok + 1;

  -- 3. a part of a draft: refused, nothing left
  begin
    perform club_schedule_save(v_org, null, null, 1, jsonb_build_object(
      'name', 'x', 'startsOn', '2027-04-01', 'endsOn', '2027-04-30', 'settings', '{}'::jsonb, 'partOfScheduleId', v_draft, 'partLabel', 'Time added Nov 17'));
    v_code := 'wrote';
  exception when raise_exception then v_code := split_part(SQLERRM, ':', 1); end;
  select count(*) into v_n from club_schedules where part_of_schedule_id = v_draft;
  if v_code <> 'schedule_part' or v_n <> 0 then raise exception 'SCHEDULE PART SAVE FIXTURE FAIL 3: a part of a draft (%; % rows)', v_code, v_n; end if;
  v_ok := v_ok + 1;

  -- 4. a practice on the parent's place and start: the whole part is refused
  begin
    perform club_schedule_save(v_org, null, null, 1, jsonb_build_object(
      'name', 'x', 'startsOn', '2027-11-10', 'endsOn', '2027-11-10', 'settings', '{}'::jsonb,
      'partOfScheduleId', v_parent, 'partLabel', 'Time added Nov 17 (2)',
      'slots', jsonb_build_array(jsonb_build_object('venueId', v_venue, 'startsAt', '2027-11-10T23:00:00Z', 'endsAt', '2027-11-11T00:30:00Z'))));
    v_code := 'wrote';
  exception when unique_violation then v_code := 'refused'; end;
  select count(*) into v_n from club_schedules where part_of_schedule_id = v_parent;
  if v_code <> 'refused' or v_n <> 1 then raise exception 'SCHEDULE PART SAVE FIXTURE FAIL 4: % — % parts on the schedule', v_code, v_n; end if;
  v_ok := v_ok + 1;

  -- 5. a later save of the part keeps it a part (the update branch never reads the link)
  v_r := club_schedule_save(v_org, v_part, null, (select version from club_schedules where id = v_part),
    jsonb_build_object('endsOn', '2027-12-17', 'partOfScheduleId', null, 'partLabel', null));
  select part_of_schedule_id, part_label into v_link, v_label from club_schedules where id = v_part;
  if v_link is distinct from v_parent or v_label <> 'Time added Nov 17' then
    raise exception 'SCHEDULE PART SAVE FIXTURE FAIL 5: a later save moved the part (% / %)', v_link, v_label; end if;
  v_ok := v_ok + 1;

  -- 6. the schedule it was added to: not one byte changed
  v_after := (select md5(row_to_json(s)::text) from club_schedules s where id = v_parent)
    || (select md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id), '')) from club_schedule_slots x where schedule_id = v_parent);
  if v_after <> v_before then raise exception 'SCHEDULE PART SAVE FIXTURE FAIL 6: the schedule it was added to changed'; end if;
  v_ok := v_ok + 1;

  raise exception 'SCHEDULE PART SAVE FIXTURE OK: %/6', v_ok;
end $fixture$;
