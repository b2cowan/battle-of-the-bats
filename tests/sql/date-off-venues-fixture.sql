-- date-off-venues-fixture.sql — A schedule on several permits, Session B (mig 488; plan CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md
-- §8 Phase 2; /dba Finding #50 "Mig 2 (B)"). A schedule's date off can name the parks it closes; no parks named = All venues.
--
-- DEV ONLY. Run:  node scripts/db-query.mjs --dev -f tests/sql/date-off-venues-fixture.sql
-- ONE DO block that ENDS BY RAISING: 'DATE OFF VENUES FIXTURE OK: n/n' on success, 'DATE OFF VENUES FIXTURE FAIL …' at the
-- first broken rule. Either way the raise rolls back every row it wrote.
--
--   1. a save writes each date off's parks: a list names them, an empty list is All venues (no rows);
--   2. two entries for one day merge into ONE row: the union of their parks, and the first note that says something;
--      All venues wins over any list;
--   3. a re-save whose entry leaves `venueIds` out (or sends null) keeps the parks that day names (a stale tab can't widen
--      it); an explicit empty list makes it All venues;
--   4. a park a date off names can't be deleted (venue FK NO ACTION); deleting the schedule takes the parks with it;
--   5. another club's park is refused (date_off_venue), and so is a park on a PERMIT's date off (only a schedule's names parks).
do $fixture$
declare
  v_org uuid; v_other uuid; v_k uuid; v_p uuid; v_x uuid; v_sched uuid; v_ver integer; v_res jsonb; v_code text; v_n integer; v_permit uuid; v_off_id uuid;
  v_ok integer := 0;
begin
  insert into organizations(name, slug, plan_id) values ('CHECK dates off', 'check-doff-' || substr(md5(random()::text), 1, 10), 'club')
    returning id into v_org;
  insert into organizations(name, slug, plan_id) values ('CHECK dates off other', 'check-doff-o-' || substr(md5(random()::text), 1, 10), 'club')
    returning id into v_other;
  insert into org_venues(org_id, name) values (v_org, 'CHECK Kinsmen') returning id into v_k;
  insert into org_venues(org_id, name) values (v_org, 'CHECK Prospect') returning id into v_p;
  insert into org_venues(org_id, name) values (v_other, 'CHECK not ours') returning id into v_x;

  -- 1. a named park, and All venues
  v_res := club_schedule_save(v_org, null, null, 0, jsonb_build_object(
    'name', 'CHECK spring', 'startsOn', '2027-03-02', 'endsOn', '2027-06-25', 'settings', '{}'::jsonb,
    'datesOff', jsonb_build_array(
      jsonb_build_object('day', '2027-03-27', 'note', 'Easter weekend', 'venueIds', jsonb_build_array(v_k)),
      jsonb_build_object('day', '2027-04-22', 'note', 'Club AGM', 'venueIds', '[]'::jsonb))));
  if not (v_res->>'ok')::boolean then raise exception 'DATE OFF VENUES FIXTURE FAIL 1: the save refused (%)', v_res; end if;
  v_sched := (v_res->>'id')::uuid; v_ver := (v_res->>'version')::integer;
  if (select array_agg(v.org_venue_id) from org_time_date_off_venues v join org_time_dates_off d on d.id = v.date_off_id
       where d.schedule_id = v_sched and d.day = date '2027-03-27') is distinct from array[v_k]
     or exists (select 1 from org_time_date_off_venues v join org_time_dates_off d on d.id = v.date_off_id
                 where d.schedule_id = v_sched and d.day = date '2027-04-22') then
    raise exception 'DATE OFF VENUES FIXTURE FAIL 1: a date off did not keep its parks (or All venues took rows)'; end if;
  v_ok := v_ok + 1;

  -- 2. one day twice: the union and the first note; All venues wins
  v_res := club_schedule_save(v_org, v_sched, null, v_ver, jsonb_build_object('datesOff', jsonb_build_array(
    jsonb_build_object('day', '2027-05-24', 'note', null, 'venueIds', jsonb_build_array(v_k)),
    jsonb_build_object('day', '2027-05-24', 'note', 'Victoria Day', 'venueIds', jsonb_build_array(v_p)),
    jsonb_build_object('day', '2027-05-24', 'note', 'Holiday Monday', 'venueIds', jsonb_build_array(v_p)),
    jsonb_build_object('day', '2027-06-01', 'note', 'Field repairs', 'venueIds', jsonb_build_array(v_p)),
    jsonb_build_object('day', '2027-06-01', 'note', null, 'venueIds', '[]'::jsonb))));
  if not (v_res->>'ok')::boolean then raise exception 'DATE OFF VENUES FIXTURE FAIL 2: the save refused (%)', v_res; end if;
  v_ver := (v_res->>'version')::integer;
  select count(*) into v_n from org_time_dates_off where schedule_id = v_sched;
  if v_n <> 2
     or (select note from org_time_dates_off where schedule_id = v_sched and day = date '2027-05-24') is distinct from 'Victoria Day'
     or (select count(*) from org_time_date_off_venues v join org_time_dates_off d on d.id = v.date_off_id
          where d.schedule_id = v_sched and d.day = date '2027-05-24') <> 2
     or exists (select 1 from org_time_date_off_venues v join org_time_dates_off d on d.id = v.date_off_id
                 where d.schedule_id = v_sched and d.day = date '2027-06-01') then
    raise exception 'DATE OFF VENUES FIXTURE FAIL 2: one day twice did not merge to one row, the union, the first note, All winning'; end if;
  v_ok := v_ok + 1;

  -- 3. a stale entry keeps the parks; null keeps them; an explicit empty list widens on purpose
  -- Setup: 06-01 names a park (check 2 left it All), so a null on it has something to keep.
  v_res := club_schedule_save(v_org, v_sched, null, v_ver, jsonb_build_object('datesOff', jsonb_build_array(
    jsonb_build_object('day', '2027-05-24', 'note', 'Victoria Day'),
    jsonb_build_object('day', '2027-06-01', 'note', 'Field repairs', 'venueIds', jsonb_build_array(v_p)))));
  if not (v_res->>'ok')::boolean then raise exception 'DATE OFF VENUES FIXTURE FAIL 3: the setup save refused (%)', v_res; end if;
  v_ver := (v_res->>'version')::integer;
  if (select count(*) from org_time_date_off_venues v join org_time_dates_off d on d.id = v.date_off_id
       where d.schedule_id = v_sched and d.day = date '2027-06-01') <> 1 then
    raise exception 'DATE OFF VENUES FIXTURE FAIL 3: the setup did not name a park on 06-01'; end if;
  v_res := club_schedule_save(v_org, v_sched, null, v_ver, jsonb_build_object('datesOff', jsonb_build_array(
    jsonb_build_object('day', '2027-05-24', 'note', 'Victoria Day'),
    jsonb_build_object('day', '2027-06-01', 'note', 'Field repairs', 'venueIds', null),
    jsonb_build_object('day', '2027-06-02', 'note', 'New day, no list'))));
  if not (v_res->>'ok')::boolean then raise exception 'DATE OFF VENUES FIXTURE FAIL 3: the save refused (%)', v_res; end if;
  v_ver := (v_res->>'version')::integer;
  if (select count(*) from org_time_date_off_venues v join org_time_dates_off d on d.id = v.date_off_id
       where d.schedule_id = v_sched and d.day = date '2027-05-24') <> 2
     or (select count(*) from org_time_date_off_venues v join org_time_dates_off d on d.id = v.date_off_id
          where d.schedule_id = v_sched and d.day = date '2027-06-01') <> 1
     or exists (select 1 from org_time_date_off_venues v join org_time_dates_off d on d.id = v.date_off_id
                 where d.schedule_id = v_sched and d.day = date '2027-06-02') then
    raise exception 'DATE OFF VENUES FIXTURE FAIL 3: a save without venueIds (or with a null) moved a day''s parks'; end if;
  v_res := club_schedule_save(v_org, v_sched, null, v_ver, jsonb_build_object('datesOff', jsonb_build_array(
    jsonb_build_object('day', '2027-05-24', 'note', 'Victoria Day', 'venueIds', '[]'::jsonb))));
  if not (v_res->>'ok')::boolean then raise exception 'DATE OFF VENUES FIXTURE FAIL 3: the empty-list save refused (%)', v_res; end if;
  v_ver := (v_res->>'version')::integer;
  if exists (select 1 from org_time_date_off_venues v join org_time_dates_off d on d.id = v.date_off_id where d.schedule_id = v_sched) then
    raise exception 'DATE OFF VENUES FIXTURE FAIL 3: an explicit empty list did not make the day All venues'; end if;
  v_ok := v_ok + 1;

  -- 4. a named park can't be deleted; the schedule's delete takes the set
  v_res := club_schedule_save(v_org, v_sched, null, v_ver, jsonb_build_object('datesOff', jsonb_build_array(
    jsonb_build_object('day', '2027-05-24', 'note', 'Victoria Day', 'venueIds', jsonb_build_array(v_p)))));
  if not (v_res->>'ok')::boolean then raise exception 'DATE OFF VENUES FIXTURE FAIL 4: the setup save refused (%)', v_res; end if;
  begin
    delete from org_venues where id = v_p;
    v_code := 'deleted';
  exception when foreign_key_violation then v_code := 'refused'; end;
  if v_code <> 'refused' then raise exception 'DATE OFF VENUES FIXTURE FAIL 4: a park a date off names was deleted'; end if;
  delete from club_schedules where id = v_sched;
  if exists (select 1 from org_time_date_off_venues where org_id = v_org) then
    raise exception 'DATE OFF VENUES FIXTURE FAIL 4: the schedule''s delete left its dates off''s parks'; end if;
  v_ok := v_ok + 1;

  -- 5. another club's park
  v_res := club_schedule_save(v_org, null, null, 0, jsonb_build_object(
    'name', 'CHECK spring 2', 'startsOn', '2027-03-02', 'endsOn', '2027-06-25', 'settings', '{}'::jsonb,
    'datesOff', jsonb_build_array(jsonb_build_object('day', '2027-03-27', 'note', null))));
  v_sched := (v_res->>'id')::uuid; v_ver := (v_res->>'version')::integer;
  begin
    v_res := club_schedule_save(v_org, v_sched, null, v_ver, jsonb_build_object('datesOff', jsonb_build_array(
      jsonb_build_object('day', '2027-03-27', 'note', null, 'venueIds', jsonb_build_array(v_x)))));
    v_code := 'wrote';
  exception when raise_exception then v_code := split_part(SQLERRM, ':', 1); end;
  if v_code <> 'date_off_venue' then raise exception 'DATE OFF VENUES FIXTURE FAIL 5: another club''s park was taken (%)', v_code; end if;
  -- ...and a PERMIT's own date off can't name parks (permit readers would read it as All venues)
  insert into org_permits(org_id, name, starts_on, ends_on) values (v_org, 'CHECK permit', date '2027-03-01', date '2027-06-30')
    returning id into v_permit;
  insert into org_time_dates_off(org_id, permit_id, day, note) values (v_org, v_permit, date '2027-04-02', null)
    returning id into v_off_id;
  begin
    insert into org_time_date_off_venues(date_off_id, org_venue_id, org_id) values (v_off_id, v_k, v_org);
    v_code := 'wrote';
  exception when raise_exception then v_code := split_part(SQLERRM, ':', 1); end;
  if v_code <> 'date_off_venue' then raise exception 'DATE OFF VENUES FIXTURE FAIL 5: a permit''s date off was given parks (%)', v_code; end if;
  v_ok := v_ok + 1;

  raise exception 'DATE OFF VENUES FIXTURE OK: %/5', v_ok;
end $fixture$;
