-- schedule-part-send-fixture.sql — Add time as its own part, Session 3 (plan CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md §8 Phase 8;
-- drawing tab 5; owner rulings 4 and 5). No migration: an added part's first send is Finalize's own step (mig 489's
-- club_schedule_finalize_priced) run on the part, and taking a sent part's last practice off is the shipped save.
--
-- DEV ONLY. Run:  node scripts/db-query.mjs --dev -f tests/sql/schedule-part-send-fixture.sql
-- ONE DO block that ENDS BY RAISING: 'SCHEDULE PART SEND FIXTURE OK: n/n' on success, 'SCHEDULE PART SEND FIXTURE FAIL …' at
-- the first broken rule. Either way the raise rolls back every row it wrote.
--
--   1. a part's first send with a bill makes an allocation OF ITS OWN, named as the part is ("Fall practices · Time added
--      Nov 17" — the coach's second charge), its practice lands on the part's slot, and the part is final;
--   2. the schedule it was added to is byte-identical after: its row, its allocation, splits and installments (earlier
--      payments untouched) — added time is never a correction on its bill;
--   3. the part's send is its own landed log row, with its baseline (the next Send the changes measures from it);
--   4. a part may be sent WITHOUT a bill: final, no allocation (the shipped final-not-billed path bills it later);
--   5. a sent part's last practice taken off: its slot is kept, removed, the part waits as Changed since sent, and its row,
--      bill and send record stay (11-17 ruling).
do $fixture$
declare
  v_org uuid; v_venue uuid; v_team uuid; v_year uuid;
  v_parent uuid; v_part uuid; v_bare uuid; v_slot uuid; v_pslot uuid; v_bslot uuid;
  v_send uuid; v_psend uuid; v_bsend uuid; v_ver integer; v_res jsonb; v_r jsonb;
  v_alloc uuid; v_palloc uuid; v_name text; v_n integer;
  v_before text; v_after text;
  v_ok integer := 0;
begin
  insert into organizations(name, slug, plan_id) values ('CHECK part send', 'check-part-send-' || substr(md5(random()::text), 1, 10), 'club')
    returning id into v_org;
  insert into org_venues(org_id, name) values (v_org, 'CHECK Prospect') returning id into v_venue;
  insert into rep_teams (org_id, name, slug) values (v_org, '14U AA', 'part-send-fx-' || substr(md5(random()::text), 1, 6)) returning id into v_team;
  insert into rep_program_years (team_id, org_id, name, year, status) values (v_team, v_org, '2027 Season', 2027, 'active') returning id into v_year;

  -- The schedule, finalized with its own bill ($100, one payment).
  insert into club_schedules(org_id, name, starts_on, ends_on) values (v_org, 'Fall practices', date '2027-09-01', date '2027-11-30')
    returning id, version into v_parent, v_ver;
  insert into club_schedule_slots(org_id, schedule_id, org_venue_id, starts_at, ends_at)
    values (v_org, v_parent, v_venue, timestamptz '2027-11-10 18:00-05', timestamptz '2027-11-10 19:30-05') returning id into v_slot;
  insert into club_schedule_slot_teams(slot_id, team_id, org_id) values (v_slot, v_team, v_org);
  insert into club_schedule_sends (org_id, schedule_id, kind) values (v_org, v_parent, 'final') returning id into v_send;
  v_res := club_schedule_finalize_priced(v_org, v_parent, null, v_ver,
    jsonb_build_array(jsonb_build_object('teamId', v_team, 'programYearId', v_year, 'slotId', v_slot, 'venueId', v_venue,
      'startsAt', '2027-11-10T23:00:00Z', 'endsAt', '2027-11-11T00:30:00Z')),
    jsonb_build_object('description', 'Fall practices', 'lineId', null, 'splits', jsonb_build_array(jsonb_build_object(
      'teamId', v_team, 'programYearId', v_year, 'amount', 100, 'splitValue', 1.5,
      'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 100, 'dueDate', '2027-10-01'))))),
    1, v_send, jsonb_build_object('teamValues', jsonb_build_object(v_team, 10000)), '[]'::jsonb);
  if not coalesce((v_res->>'ok')::boolean, false) then raise exception 'SCHEDULE PART SEND FIXTURE FAIL setup: the schedule did not finalize (%)', v_res; end if;
  v_alloc := (v_res->>'allocationId')::uuid;
  if v_alloc is null then raise exception 'SCHEDULE PART SEND FIXTURE FAIL setup: the finalize made no bill, so the untouched check would compare nothing'; end if;

  v_before := (select md5(row_to_json(s)::text) from club_schedules s where id = v_parent)
    || (select md5(row_to_json(a)::text) from rep_cost_allocations a where id = v_alloc)
    || (select md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id), '')) from rep_allocation_splits x where allocation_id = v_alloc)
    || (select md5(coalesce(string_agg(row_to_json(i)::text, '|' order by i.id), '')) from rep_allocation_installments i
         where split_id in (select id from rep_allocation_splits where allocation_id = v_alloc))
    || (select md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id), '')) from club_schedule_slots x where schedule_id = v_parent);

  -- The part (Add time, Session 2's save), its one practice.
  v_r := club_schedule_save(v_org, null, null, 1, jsonb_build_object(
    'name', 'Time added Nov 17', 'startsOn', '2027-12-10', 'endsOn', '2027-12-10', 'settings', '{}'::jsonb,
    'partOfScheduleId', v_parent, 'partLabel', 'Time added Nov 17',
    'slots', jsonb_build_array(jsonb_build_object('venueId', v_venue, 'startsAt', '2027-12-10T23:00:00Z', 'endsAt', '2027-12-11T00:30:00Z',
      'teamIds', jsonb_build_array(v_team)))));
  if not coalesce((v_r->>'ok')::boolean, false) then raise exception 'SCHEDULE PART SEND FIXTURE FAIL setup: the part was not saved (%)', v_r; end if;
  v_part := (v_r->>'id')::uuid;
  select id into v_pslot from club_schedule_slots where schedule_id = v_part;
  select version, name into v_ver, v_name from club_schedules where id = v_part;

  -- 1. its first send, with a bill of its own ($135)
  insert into club_schedule_sends (org_id, schedule_id, kind) values (v_org, v_part, 'final') returning id into v_psend;
  v_res := club_schedule_finalize_priced(v_org, v_part, null, v_ver,
    jsonb_build_array(jsonb_build_object('teamId', v_team, 'programYearId', v_year, 'slotId', v_pslot, 'venueId', v_venue,
      'startsAt', '2027-12-10T23:00:00Z', 'endsAt', '2027-12-11T00:30:00Z')),
    jsonb_build_object('description', v_name, 'lineId', null, 'splits', jsonb_build_array(jsonb_build_object(
      'teamId', v_team, 'programYearId', v_year, 'amount', 135, 'splitValue', 1.5,
      'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 135, 'dueDate', '2027-12-01'))))),
    1.5, v_psend, jsonb_build_object('teamValues', jsonb_build_object(v_team, 13500)), '[]'::jsonb);
  if not coalesce((v_res->>'ok')::boolean, false) then raise exception 'SCHEDULE PART SEND FIXTURE FAIL 1: the part''s send was refused (%)', v_res; end if;
  v_palloc := (v_res->>'allocationId')::uuid;
  if v_palloc is null or v_palloc = v_alloc then raise exception 'SCHEDULE PART SEND FIXTURE FAIL 1: the part has no bill of its own'; end if;
  if (select description from rep_cost_allocations where id = v_palloc) <> 'Fall practices · Time added Nov 17' then
    raise exception 'SCHEDULE PART SEND FIXTURE FAIL 1: its bill is named "%"', (select description from rep_cost_allocations where id = v_palloc); end if;
  if not exists (select 1 from club_schedules where id = v_part and state = 'final' and allocation_id = v_palloc and part_of_schedule_id = v_parent) then
    raise exception 'SCHEDULE PART SEND FIXTURE FAIL 1: the part is not final on its own bill'; end if;
  if not exists (select 1 from rep_team_events where club_schedule_slot_id = v_pslot and team_id = v_team and status = 'scheduled') then
    raise exception 'SCHEDULE PART SEND FIXTURE FAIL 1: the part''s practice did not land'; end if;
  v_ok := v_ok + 1;

  -- 2. the schedule it was added to: byte-identical (its row, its bill and payments, its slots)
  v_after := (select md5(row_to_json(s)::text) from club_schedules s where id = v_parent)
    || (select md5(row_to_json(a)::text) from rep_cost_allocations a where id = v_alloc)
    || (select md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id), '')) from rep_allocation_splits x where allocation_id = v_alloc)
    || (select md5(coalesce(string_agg(row_to_json(i)::text, '|' order by i.id), '')) from rep_allocation_installments i
         where split_id in (select id from rep_allocation_splits where allocation_id = v_alloc))
    || (select md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id), '')) from club_schedule_slots x where schedule_id = v_parent);
  if v_after <> v_before then raise exception 'SCHEDULE PART SEND FIXTURE FAIL 2: the schedule it was added to changed'; end if;
  v_ok := v_ok + 1;

  -- 3. its own landed log row, with its baseline
  if not exists (select 1 from club_schedule_sends where id = v_psend and schedule_id = v_part and landed_at is not null
                 and team_values = jsonb_build_object(v_team, 13500)) then
    raise exception 'SCHEDULE PART SEND FIXTURE FAIL 3: the part''s send did not land with its baseline'; end if;
  v_ok := v_ok + 1;

  -- 4. a part sent without a bill
  v_r := club_schedule_save(v_org, null, null, 1, jsonb_build_object(
    'name', 'Time added Nov 17 (2)', 'startsOn', '2027-12-17', 'endsOn', '2027-12-17', 'settings', '{}'::jsonb,
    'partOfScheduleId', v_parent, 'partLabel', 'Time added Nov 17 (2)',
    'slots', jsonb_build_array(jsonb_build_object('venueId', v_venue, 'startsAt', '2027-12-17T23:00:00Z', 'endsAt', '2027-12-18T00:30:00Z',
      'teamIds', jsonb_build_array(v_team)))));
  v_bare := (v_r->>'id')::uuid;
  select id into v_bslot from club_schedule_slots where schedule_id = v_bare;
  select version into v_ver from club_schedules where id = v_bare;
  insert into club_schedule_sends (org_id, schedule_id, kind) values (v_org, v_bare, 'final') returning id into v_bsend;
  v_res := club_schedule_finalize_priced(v_org, v_bare, null, v_ver,
    jsonb_build_array(jsonb_build_object('teamId', v_team, 'programYearId', v_year, 'slotId', v_bslot, 'venueId', v_venue,
      'startsAt', '2027-12-17T23:00:00Z', 'endsAt', '2027-12-18T00:30:00Z')),
    null, null, v_bsend, jsonb_build_object('teamValues', '{}'::jsonb), '[]'::jsonb);
  if not coalesce((v_res->>'ok')::boolean, false) or (v_res->>'allocationId') is not null then
    raise exception 'SCHEDULE PART SEND FIXTURE FAIL 4: an unbilled part''s send (%)', v_res; end if;
  if not exists (select 1 from club_schedules where id = v_bare and state = 'final' and allocation_id is null) then
    raise exception 'SCHEDULE PART SEND FIXTURE FAIL 4: the unbilled part is not final with no bill'; end if;
  v_ok := v_ok + 1;

  -- 5. a sent part's last practice taken off (the route's save: no rows, no slots)
  select version into v_ver from club_schedules where id = v_part;
  v_r := club_schedule_save(v_org, v_part, null, v_ver, jsonb_build_object('blocks', '[]'::jsonb, 'slots', '[]'::jsonb));
  if not coalesce((v_r->>'ok')::boolean, false) then raise exception 'SCHEDULE PART SEND FIXTURE FAIL 5: the take-off save was refused (%)', v_r; end if;
  if not exists (select 1 from club_schedule_slots where id = v_pslot and removed_at is not null) then
    raise exception 'SCHEDULE PART SEND FIXTURE FAIL 5: the slot was not kept, removed'; end if;
  if not exists (select 1 from club_schedules where id = v_part and state = 'final' and changed_since_sent and allocation_id = v_palloc) then
    raise exception 'SCHEDULE PART SEND FIXTURE FAIL 5: the part does not wait as Changed since sent on its bill'; end if;
  select count(*) into v_n from club_schedule_sends where schedule_id = v_part and landed_at is not null;
  if v_n <> 1 then raise exception 'SCHEDULE PART SEND FIXTURE FAIL 5: its send record is gone'; end if;
  v_ok := v_ok + 1;

  raise exception 'SCHEDULE PART SEND FIXTURE OK: %/5', v_ok;
end;
$fixture$;
