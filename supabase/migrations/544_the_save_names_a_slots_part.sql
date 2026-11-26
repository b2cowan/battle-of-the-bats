-- 544_the_save_names_a_slots_part.sql
--
-- Club schedules Stage 2, Session 2B: a field in parts, through the builder (plan
-- docs/projects/active/SCHEDULE_FIELDS_SAME_TIME_TRADES_PLAN.md §5, /dba Finding #55; build prompt
-- SCHEDULE_PARTS_STAGE2_BUILD_PROMPT.md, Session 2B item 8; mig 541 made the columns, the floor and the triggers).
-- New schedule now cuts a split field's ticked parts as slots of their own, so the one save that writes a schedule's rows
-- of time and its slots must store which part each names. Until it does, side A and side B at one start match ONE stored
-- slot (the lookup was place + start), and every part saves as the whole field.
--
-- WHAT CHANGES
--   club_schedule_save(p_org, p_schedule, p_actor, p_version, p_data): 494's body EXACTLY, plus three things:
--     1. a row of time's facility rows: one per (field, part) — p_data.blocks[].parts is {facilityId: [masks]}; a field it
--        doesn't list there is stored whole (0), as before;
--     2. a stored slot is found by (schedule, venue, facility, section_mask, starts_at) — the part joins the match;
--     3. a new slot is inserted with its section_mask (p_data.slots[].sectionMask; absent = 0).
--   A save from a client before this build sends neither key: every row and slot is whole, exactly as 494 stored it.
--   541's triggers already refuse a part its field doesn't offer (part_illegal), a part beside its whole field or its own
--   half in one row (part_overlap), and any part on a permit's block (part_on_permit); its deferred exclusion constraint
--   (club_schedule_slots_family_place_overlap) refuses two live slots on overlapping ground at overlapping times.
--   Signature unchanged: grants as 494. Function-only, so check:migrations can't see it (MANUAL_PROD_STEPS.json).
--
-- Idempotent (create or replace).

begin;
set local lock_timeout = '15s';

-- ── The save: 494's club_schedule_save exactly, plus each slot's and each row's part ──────────────────────────────────
create or replace function public.club_schedule_save(p_org uuid, p_schedule uuid, p_actor uuid, p_version integer, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id        uuid := p_schedule;
  v_s         club_schedules%rowtype;
  v_block     jsonb;
  v_block_id  uuid;
  v_blocks    uuid[] := '{}';
  v_keep      uuid[] := '{}';
  v_slot      jsonb;
  v_slot_id   uuid;
  v_slots     uuid[] := '{}';
  v_i         integer := 0;
  v_changed   boolean := false;
  v_teams     uuid[];
  v_old_teams uuid[];
  v_cap       integer;
  v_prog      text;
  v_old_prog  text;
  v_off_venues jsonb;
  v_off       record;
  v_off_id    uuid;
  v_mask      smallint;
begin
  if p_schedule is null then
    -- 494: an added part (Add time on a final schedule) carries its link and label; 491's trigger checks the parent and
    -- writes the part's name. Absent: a schedule of its own, as before.
    insert into club_schedules (org_id, name, starts_on, ends_on, settings, started_from_permit_id, started_from_schedule_id,
                                part_of_schedule_id, part_label, created_by, updated_by)
    values (p_org, btrim(p_data->>'name'), (p_data->>'startsOn')::date, (p_data->>'endsOn')::date,
            coalesce(p_data->'settings', '{}'::jsonb), nullif(p_data->>'startedFromPermitId', '')::uuid,
            nullif(p_data->>'startedFromScheduleId', '')::uuid,
            nullif(p_data->>'partOfScheduleId', '')::uuid, nullif(btrim(coalesce(p_data->>'partLabel', '')), ''),
            p_actor, p_actor)
    returning * into v_s;
    v_id := v_s.id;
  else
    select * into v_s from club_schedules where id = p_schedule and org_id = p_org for update;
    if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
    if v_s.version <> p_version then return jsonb_build_object('ok', false, 'code', 'changed', 'version', v_s.version); end if;
    update club_schedules set
      name = case when p_data ? 'name' then btrim(p_data->>'name') else name end,
      starts_on = case when p_data ? 'startsOn' then (p_data->>'startsOn')::date else starts_on end,
      ends_on = case when p_data ? 'endsOn' then (p_data->>'endsOn')::date else ends_on end,
      settings = case when p_data ? 'settings' then p_data->'settings' else settings end,
      started_from_permit_id = case when p_data ? 'startedFromPermitId' then nullif(p_data->>'startedFromPermitId', '')::uuid else started_from_permit_id end,
      started_from_schedule_id = case when p_data ? 'startedFromScheduleId' then nullif(p_data->>'startedFromScheduleId', '')::uuid else started_from_schedule_id end
    where id = v_id;
  end if;

  if p_data ? 'blocks' then
    for v_block in select * from jsonb_array_elements(coalesce(p_data->'blocks', '[]'::jsonb)) loop
      v_block_id := nullif(v_block->>'id', '')::uuid;
      if v_block_id is not null and exists (select 1 from org_time_blocks where id = v_block_id and schedule_id = v_id) then
        update org_time_blocks set
          org_venue_id = (v_block->>'venueId')::uuid,
          weekdays = array(select x::smallint from jsonb_array_elements_text(v_block->'weekdays') x order by 1),
          start_time = (v_block->>'startTime')::time,
          end_time = (v_block->>'endTime')::time,
          from_date = nullif(v_block->>'fromDate', '')::date,
          until_date = nullif(v_block->>'untilDate', '')::date,
          -- 487: the row's permit, when the save says it (an older client's save keeps it).
          from_permit_id = case when v_block ? 'permitId' then nullif(v_block->>'permitId', '')::uuid else from_permit_id end,
          sort_order = v_i,
          updated_at = now()
        where id = v_block_id;
      else
        insert into org_time_blocks (org_id, schedule_id, org_venue_id, weekdays, start_time, end_time, from_date, until_date, sort_order,
                                     from_permit_id)
        values (p_org, v_id, (v_block->>'venueId')::uuid,
                array(select x::smallint from jsonb_array_elements_text(v_block->'weekdays') x order by 1),
                (v_block->>'startTime')::time, (v_block->>'endTime')::time,
                nullif(v_block->>'fromDate', '')::date, nullif(v_block->>'untilDate', '')::date, v_i,
                nullif(v_block->>'permitId', '')::uuid)
        returning id into v_block_id;
      end if;
      v_blocks := v_blocks || v_block_id;
      delete from org_time_block_facilities where block_id = v_block_id;
      -- 544: a field the row names in PARTS ('parts': {facilityId: [masks]}) gets one row per part; a field it doesn't list
      -- there is named whole (0), as before. 541's triggers refuse a part its field doesn't offer, a part beside the whole
      -- field or its own half, and any part on a permit's block.
      insert into org_time_block_facilities (block_id, facility_id, section_mask, org_id)
        select distinct v_block_id, f::uuid, coalesce(m::smallint, 0), p_org
          from jsonb_array_elements_text(coalesce(v_block->'facilityIds', '[]'::jsonb)) f
          cross join lateral jsonb_array_elements_text(
            -- Nested, so the length is only ever asked of a list (/dba 2026-11-26).
            case when jsonb_typeof(v_block->'parts'->f) = 'array'
                 then case when jsonb_array_length(v_block->'parts'->f) > 0 then v_block->'parts'->f else '[0]'::jsonb end
                 else '[0]'::jsonb end) m;
      v_i := v_i + 1;
    end loop;
    delete from org_time_blocks where schedule_id = v_id and not (id = any (v_blocks));
  else
    select coalesce(array_agg(id order by sort_order, id), '{}') into v_blocks from org_time_blocks where schedule_id = v_id;
  end if;

  if p_data ? 'datesOff' then
    -- 488: the parks each day names today, so a date off whose save leaves `venueIds` out (or sends anything but a list)
    -- keeps them: a stale tab can never widen a named date off to All venues. An empty list is All venues.
    select coalesce(jsonb_object_agg(o.day::text, v.ids), '{}'::jsonb) into v_off_venues
      from org_time_dates_off o
      join lateral (select jsonb_agg(x.org_venue_id) as ids from org_time_date_off_venues x where x.date_off_id = o.id) v
        on v.ids is not null
     where o.schedule_id = v_id;
    delete from org_time_dates_off where schedule_id = v_id;
    -- One row per day (the unique stays): two entries for one day merge, All venues winning over any list, else the
    -- union of their parks, and the first note that says something.
    for v_off in
      with e as (
        select (d->>'day')::date as day, nullif(btrim(d->>'note'), '') as note, t.ord,
               case when jsonb_typeof(d->'venueIds') = 'array' then d->'venueIds'
                    else coalesce(v_off_venues->((d->>'day')::date::text), '[]'::jsonb) end as vs
          from jsonb_array_elements(coalesce(p_data->'datesOff', '[]'::jsonb)) with ordinality t(d, ord)
      )
      select e.day,
             (array_agg(e.note order by e.ord) filter (where e.note is not null))[1] as note,
             bool_or(jsonb_array_length(e.vs) = 0) as all_venues,
             array(select distinct x::uuid from e e2 cross join lateral jsonb_array_elements_text(e2.vs) x
                    where e2.day = e.day) as venues
        from e group by e.day order by min(e.ord)
    loop
      insert into org_time_dates_off (org_id, schedule_id, day, note)
      values (p_org, v_id, v_off.day, v_off.note)
      returning id into v_off_id;
      if not v_off.all_venues then
        insert into org_time_date_off_venues (date_off_id, org_venue_id, org_id)
          select v_off_id, x, p_org from unnest(v_off.venues) x;
      end if;
    end loop;
  end if;

  if p_data ? 'slots' then
    -- "Teams at once" is the floor here too, as on a hand edit: a kept slot a smaller setting no longer fits is refused.
    v_cap := greatest(1, coalesce((coalesce(p_data->'settings', v_s.settings)->>'teamsAtOnce')::integer, 1));
    for v_slot in select * from jsonb_array_elements(coalesce(p_data->'slots', '[]'::jsonb)) loop
      -- 544: a stored slot is found by its place, its PART and its start: side A and side B at one start are two slots.
      -- A save that leaves 'sectionMask' out (a tab from before 544) names the whole field, as every slot was.
      v_mask := coalesce(nullif(v_slot->>'sectionMask', '')::smallint, 0);
      select id into v_slot_id from club_schedule_slots
       where schedule_id = v_id and org_venue_id = (v_slot->>'venueId')::uuid
         and coalesce(facility_id, '00000000-0000-0000-0000-000000000000'::uuid)
             = coalesce(nullif(v_slot->>'facilityId', '')::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
         and section_mask = v_mask
         and starts_at = (v_slot->>'startsAt')::timestamptz;
      if v_slot_id is null then
        insert into club_schedule_slots (org_id, schedule_id, block_id, org_venue_id, facility_id, section_mask, starts_at, ends_at, locked, moved_by_hand)
        values (p_org, v_id,
                case when (v_slot ? 'blockIndex') and (v_slot->>'blockIndex') is not null
                     then v_blocks[(v_slot->>'blockIndex')::integer + 1] end,
                (v_slot->>'venueId')::uuid, nullif(v_slot->>'facilityId', '')::uuid, v_mask,
                (v_slot->>'startsAt')::timestamptz, (v_slot->>'endsAt')::timestamptz,
                coalesce((v_slot->>'locked')::boolean, false), coalesce((v_slot->>'movedByHand')::boolean, false))
        returning id into v_slot_id;
        v_changed := true;
      else
        update club_schedule_slots set
          block_id = case when (v_slot ? 'blockIndex') and (v_slot->>'blockIndex') is not null
                          then v_blocks[(v_slot->>'blockIndex')::integer + 1] else block_id end,
          ends_at = (v_slot->>'endsAt')::timestamptz,
          locked = coalesce((v_slot->>'locked')::boolean, locked),
          moved_by_hand = coalesce((v_slot->>'movedByHand')::boolean, moved_by_hand),
          removed_at = null,
          updated_at = now()
        where id = v_slot_id;
      end if;
      v_slots := v_slots || v_slot_id;
      select coalesce(array_agg(team_id order by team_id), '{}') into v_old_teams from club_schedule_slot_teams where slot_id = v_slot_id;
      v_teams := array(select distinct x::uuid from jsonb_array_elements_text(coalesce(v_slot->'teamIds', '[]'::jsonb)) x order by 1);
      v_prog := nullif(v_slot->>'program', '');
      select program into v_old_prog from club_schedule_slot_programs where slot_id = v_slot_id;
      if v_prog is not null and cardinality(v_teams) > 0 then
        raise exception 'slot_both: a slot is held by teams or by house league, never both';
      end if;
      if cardinality(v_teams) > v_cap then
        raise exception 'slot_full: a slot holds % team(s) at once', v_cap;
      end if;
      -- The holder that goes first (house league's row, then its use, before a team lands; the teams before house league).
      if v_old_prog is not null and v_prog is distinct from v_old_prog then
        delete from club_schedule_slot_programs where slot_id = v_slot_id;
        v_changed := true;
      end if;
      if v_old_teams is distinct from v_teams then
        delete from club_schedule_slot_teams where slot_id = v_slot_id;
        insert into club_schedule_slot_teams (slot_id, team_id, org_id) select v_slot_id, t, p_org from unnest(v_teams) t;
        v_changed := true;
      end if;
      if v_prog is not null and v_prog is distinct from v_old_prog then
        insert into club_schedule_slot_programs (slot_id, program, org_id) values (v_slot_id, v_prog, p_org);
        v_changed := true;
      end if;
    end loop;
    if v_s.state = 'final' then
      -- Its practices are reconciled by Send the changes: the slot is kept, removed, until then. Its program row stays
      -- with it, so house league's use of it can follow the time to where it moved.
      update club_schedule_slots set removed_at = now(), updated_at = now()
       where schedule_id = v_id and removed_at is null and not (id = any (v_slots));
      if found then v_changed := true; end if;
      delete from club_schedule_slot_teams where slot_id in (select id from club_schedule_slots where schedule_id = v_id and removed_at is not null);
    else
      delete from club_schedule_slots where schedule_id = v_id and not (id = any (v_slots));
      if found then v_changed := true; end if;
    end if;
    perform club_schedule_assert_no_team_twice(v_id);
  end if;

  update club_schedules set
    version = case when p_schedule is null then version else version + 1 end,
    changed_since_sent = changed_since_sent or (state = 'final' and v_changed),
    updated_by = p_actor, updated_at = now()
  where id = v_id
  returning * into v_s;
  return jsonb_build_object('ok', true, 'id', v_id, 'version', v_s.version);
end;
$$;

revoke all on function public.club_schedule_save(uuid, uuid, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.club_schedule_save(uuid, uuid, uuid, integer, jsonb) to service_role;

notify pgrst, 'reload schema';

commit;
