-- several-permits-fixture.sql — A schedule on several permits, Session A (mig 487; plan CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md
-- §8 Phase 1; /dba Finding #50). Each block of time a schedule holds remembers the permit it came from.
--
-- DEV ONLY. Run:  node scripts/db-query.mjs --dev -f tests/sql/several-permits-fixture.sql
-- ONE DO block that ENDS BY RAISING: 'SEVERAL PERMITS FIXTURE OK: n/n' on success, 'SEVERAL PERMITS FIXTURE FAIL …' at the first
-- broken rule. Either way the raise rolls back every row it wrote.
--
--   1. a new schedule's save writes each block's permit (two permits, and a typed row with none);
--   2. a save that carries `permitId` changes it; a save whose block leaves the key out keeps it (an older client);
--   3. a permit's OWN block can't carry from_permit_id (org_time_blocks_from_permit_on_schedule);
--   4. another club's permit is refused on a schedule's block (block_permit);
--   5. deleting a permit leaves the schedule's rows, their permit cleared (ON DELETE SET NULL — the app's guard is the rule).
do $fixture$
declare
  v_org uuid; v_other uuid; v_venue uuid; v_venue2 uuid; v_fac uuid;
  p_a uuid; p_b uuid; p_x uuid; v_sched uuid; v_ver integer; v_res jsonb; v_code text; v_n integer;
  v_ok integer := 0;
begin
  insert into organizations(name, slug, plan_id) values ('CHECK permits', 'check-permits-' || substr(md5(random()::text), 1, 10), 'club')
    returning id into v_org;
  insert into organizations(name, slug, plan_id) values ('CHECK permits other', 'check-permits-o-' || substr(md5(random()::text), 1, 10), 'club')
    returning id into v_other;
  insert into org_venues(org_id, name) values (v_org, 'CHECK Kinsmen') returning id into v_venue;
  insert into org_venues(org_id, name) values (v_org, 'CHECK Prospect') returning id into v_venue2;
  insert into org_venue_facilities(org_venue_id, org_id, name) values (v_venue, v_org, 'Diamond A') returning id into v_fac;
  insert into org_permits(org_id, name, starts_on, ends_on) values (v_org, 'Town A spring', date '2027-03-02', date '2027-05-29') returning id into p_a;
  insert into org_permits(org_id, name, starts_on, ends_on) values (v_org, 'Town B spring', date '2027-04-05', date '2027-06-25') returning id into p_b;
  insert into org_permits(org_id, name, starts_on, ends_on) values (v_other, 'Not ours', date '2027-03-01', date '2027-06-30') returning id into p_x;

  -- 1. two permits and a typed row, in one save
  v_res := club_schedule_save(v_org, null, null, 0, jsonb_build_object(
    'name', 'CHECK spring', 'startsOn', '2027-03-02', 'endsOn', '2027-06-25', 'settings', '{}'::jsonb,
    'startedFromPermitId', p_a,
    'blocks', jsonb_build_array(
      jsonb_build_object('venueId', v_venue, 'facilityIds', jsonb_build_array(v_fac), 'weekdays', jsonb_build_array(2, 4),
                         'startTime', '18:00', 'endTime', '20:00', 'fromDate', '2027-03-02', 'untilDate', '2027-05-29', 'permitId', p_a),
      jsonb_build_object('venueId', v_venue2, 'facilityIds', '[]'::jsonb, 'weekdays', jsonb_build_array(1, 3),
                         'startTime', '18:00', 'endTime', '20:00', 'fromDate', '2027-04-05', 'untilDate', '2027-06-25', 'permitId', p_b),
      jsonb_build_object('venueId', v_venue2, 'facilityIds', '[]'::jsonb, 'weekdays', jsonb_build_array(6),
                         'startTime', '09:00', 'endTime', '11:00', 'permitId', null))));
  if not (v_res->>'ok')::boolean then raise exception 'SEVERAL PERMITS FIXTURE FAIL 1: the save refused (%)', v_res; end if;
  v_sched := (v_res->>'id')::uuid; v_ver := (v_res->>'version')::integer;
  if (select array_agg(from_permit_id order by sort_order) from org_time_blocks where schedule_id = v_sched)
     is distinct from array[p_a, p_b, null]::uuid[] then
    raise exception 'SEVERAL PERMITS FIXTURE FAIL 1: each row did not keep its permit'; end if;
  v_ok := v_ok + 1;

  -- 2. a save that says it changes it; one that leaves the key out keeps it
  v_res := club_schedule_save(v_org, v_sched, null, v_ver, jsonb_build_object('blocks', (
    select jsonb_agg(jsonb_build_object('id', id, 'venueId', org_venue_id, 'weekdays', to_jsonb(weekdays), 'startTime', start_time::text,
                                        'endTime', end_time::text, 'fromDate', from_date, 'untilDate', until_date)
                     || case when sort_order = 2 then jsonb_build_object('permitId', p_b) else '{}'::jsonb end
                     order by sort_order)
      from org_time_blocks where schedule_id = v_sched)));
  if not (v_res->>'ok')::boolean then raise exception 'SEVERAL PERMITS FIXTURE FAIL 2: the re-save refused (%)', v_res; end if;
  v_ver := (v_res->>'version')::integer;
  if (select array_agg(from_permit_id order by sort_order) from org_time_blocks where schedule_id = v_sched)
     is distinct from array[p_a, p_b, p_b]::uuid[] then
    raise exception 'SEVERAL PERMITS FIXTURE FAIL 2: a save without permitId moved a row''s permit, or one with it did not'; end if;
  v_ok := v_ok + 1;

  -- 3. a permit's own block never carries it
  begin
    insert into org_time_blocks(org_id, permit_id, org_venue_id, weekdays, start_time, end_time, sort_order, from_permit_id)
      values (v_org, p_a, v_venue, array[2]::smallint[], '18:00', '20:00', 0, p_b);
    v_code := 'wrote';
  exception when check_violation then v_code := 'refused'; end;
  if v_code <> 'refused' then raise exception 'SEVERAL PERMITS FIXTURE FAIL 3: a permit''s own block took from_permit_id'; end if;
  v_ok := v_ok + 1;

  -- 4. another club's permit
  begin
    update org_time_blocks set from_permit_id = p_x where schedule_id = v_sched and sort_order = 0;
    v_code := 'wrote';
  exception when raise_exception then v_code := split_part(SQLERRM, ':', 1); end;
  if v_code <> 'block_permit' then raise exception 'SEVERAL PERMITS FIXTURE FAIL 4: another club''s permit was taken (%)', v_code; end if;
  v_ok := v_ok + 1;

  -- 5. a deleted permit clears the rows' link, never the rows
  delete from org_permits where id = p_b;
  select count(*) into v_n from org_time_blocks where schedule_id = v_sched;
  if v_n <> 3 or exists (select 1 from org_time_blocks where schedule_id = v_sched and from_permit_id = p_b) then
    raise exception 'SEVERAL PERMITS FIXTURE FAIL 5: a deleted permit took rows with it, or left its link'; end if;
  v_ok := v_ok + 1;

  raise exception 'SEVERAL PERMITS FIXTURE OK: %/5', v_ok;
end $fixture$;
