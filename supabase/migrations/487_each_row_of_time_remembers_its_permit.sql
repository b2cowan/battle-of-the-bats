-- 487_each_row_of_time_remembers_its_permit.sql
--
-- A schedule on several permits, Session A (build prompt docs/projects/active/CLUB_SCHEDULE_SEVERAL_PERMITS_BUILD_PROMPT.md;
-- plan CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md §3 and §8 Phase 1; /dba Finding #50, 2026-11-14). One schedule per season,
-- however many permits it sits on: each block of time a schedule holds remembers the permit it came from, and the
-- schedule's permits are the distinct permits behind its rows (the top line, the permit's "used by", the delete guard,
-- Outside the permit). A slot is priced by its row's permit.
--
-- WHAT CHANGES
--   1. org_time_blocks.from_permit_id (NEW, nullable): FK org_permits ON DELETE SET NULL. Set only on a SCHEDULE's block
--      (CHECK org_time_blocks_from_permit_on_schedule); a permit's own blocks never carry it. NULL = time typed by hand
--      (or copied from last year), which prices from the schedule's fallback price permit.
--      SET NULL, not NO ACTION (/dba #50): the two existing links are SET NULL and the fixture deletes permits directly;
--      the rule "a permit any row came from can't be deleted" is the app's guard (schedulesHandingOut reads the rows).
--   2. org_time_blocks_check() (326's, exactly) learns the new column: its permit must be this club's.
--   3. A partial index on from_permit_id IS NOT NULL (the permit's "used by" and the delete guard read by it).
--   4. BACKFILL: a schedule's block takes the schedule's started_from_permit_id when that permit holds time at the block's
--      venue and the UNION of its blocks' facilities there covers the block's (empty = every facility at the venue);
--      else it stays NULL. Dev 2026-11-14: 15 schedule blocks, the 5 on permit-started schedules all match (0 left NULL).
--   5. club_schedule_save (392's, exactly) reads each block's `permitId`: an insert writes it; an update writes it only
--      when the key is present, so an older client's save keeps the row's permit.
--
-- KEPT FOR ONE RELEASE: club_schedules.started_from_permit_id is still written (the first permit) and read as a fallback
-- for a block with no permit; bill_permit_id is the fallback price permit. Retiring started_from_permit_id is its own
-- migration after Sessions C and E are on prod (/dba #50). Idempotent.

begin;

-- ── 1. The column and its rule ─────────────────────────────────────────────────────────────────────────────────────────
alter table public.org_time_blocks
  add column if not exists from_permit_id uuid references public.org_permits(id) on delete set null;

alter table public.org_time_blocks drop constraint if exists org_time_blocks_from_permit_on_schedule;
alter table public.org_time_blocks
  add constraint org_time_blocks_from_permit_on_schedule check (from_permit_id is null or schedule_id is not null);

comment on column public.org_time_blocks.from_permit_id is
  'A schedule''s block of time: the permit it came from (mig 487, a schedule on several permits). NULL = typed by hand or copied; never set on a permit''s own block. The schedule''s permits are the distinct permits behind its rows; a slot is priced by its row''s permit.';

-- ── 2. The club's own permit (326's check, plus the new column) ───────────────────────────────────────────────────────
create or replace function public.org_time_blocks_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from org_venues where id = new.org_venue_id and org_id = new.org_id) then
    raise exception 'block_venue: the venue is not one of this club''s';
  end if;
  if new.permit_id is not null and not exists (select 1 from org_permits where id = new.permit_id and org_id = new.org_id) then
    raise exception 'block_owner: the permit is not this club''s';
  end if;
  if new.schedule_id is not null and not exists (select 1 from club_schedules where id = new.schedule_id and org_id = new.org_id) then
    raise exception 'block_owner: the schedule is not this club''s';
  end if;
  if new.from_permit_id is not null and not exists (select 1 from org_permits where id = new.from_permit_id and org_id = new.org_id) then
    raise exception 'block_permit: the permit is not this club''s';
  end if;
  -- A block that moves to another venue leaves its old venue's facilities behind.
  if tg_op = 'UPDATE' and new.org_venue_id <> old.org_venue_id then
    delete from org_time_block_facilities where block_id = new.id;
  end if;
  return new;
end;
$$;

-- ── 3. The index ───────────────────────────────────────────────────────────────────────────────────────────────────────
create index if not exists org_time_blocks_from_permit_idx
  on public.org_time_blocks (from_permit_id) where from_permit_id is not null;

-- ── 4. The backfill ────────────────────────────────────────────────────────────────────────────────────────────────────
update public.org_time_blocks b
   set from_permit_id = s.started_from_permit_id
  from public.club_schedules s
 where b.schedule_id = s.id
   and s.started_from_permit_id is not null
   and b.from_permit_id is null
   and exists (select 1 from public.org_time_blocks pb
                where pb.permit_id = s.started_from_permit_id and pb.org_venue_id = b.org_venue_id)
   -- No facility the schedule's block holds is missing from what the permit holds at that venue.
   and not exists (
     select 1
       from (select f.facility_id as fid from public.org_time_block_facilities f where f.block_id = b.id
             union all
             select vf.id from public.org_venue_facilities vf
              where vf.org_venue_id = b.org_venue_id
                and not exists (select 1 from public.org_time_block_facilities f2 where f2.block_id = b.id)) held
      where not exists (
        select 1 from public.org_time_blocks pb
         where pb.permit_id = s.started_from_permit_id and pb.org_venue_id = b.org_venue_id
           and (not exists (select 1 from public.org_time_block_facilities pf where pf.block_id = pb.id)
                or exists (select 1 from public.org_time_block_facilities pf where pf.block_id = pb.id and pf.facility_id = held.fid))));

do $count$
declare v_left integer; v_schedules integer;
begin
  select count(*), count(distinct b.schedule_id) into v_left, v_schedules
    from public.org_time_blocks b join public.club_schedules s on s.id = b.schedule_id
   where s.started_from_permit_id is not null and b.from_permit_id is null;
  raise notice 'from_permit_id backfill: % block(s) on % permit-started schedule(s) left with no permit', v_left, v_schedules;
end;
$count$;

-- ── 5. The save: 392's club_schedule_save exactly, plus each block's `permitId` ──────────────────────────────────────────
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
begin
  if p_schedule is null then
    insert into club_schedules (org_id, name, starts_on, ends_on, settings, started_from_permit_id, started_from_schedule_id,
                                created_by, updated_by)
    values (p_org, btrim(p_data->>'name'), (p_data->>'startsOn')::date, (p_data->>'endsOn')::date,
            coalesce(p_data->'settings', '{}'::jsonb), nullif(p_data->>'startedFromPermitId', '')::uuid,
            nullif(p_data->>'startedFromScheduleId', '')::uuid, p_actor, p_actor)
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
      insert into org_time_block_facilities (block_id, facility_id, org_id)
        select distinct v_block_id, f::uuid, p_org from jsonb_array_elements_text(coalesce(v_block->'facilityIds', '[]'::jsonb)) f;
      v_i := v_i + 1;
    end loop;
    delete from org_time_blocks where schedule_id = v_id and not (id = any (v_blocks));
  else
    select coalesce(array_agg(id order by sort_order, id), '{}') into v_blocks from org_time_blocks where schedule_id = v_id;
  end if;

  if p_data ? 'datesOff' then
    delete from org_time_dates_off where schedule_id = v_id;
    insert into org_time_dates_off (org_id, schedule_id, day, note)
      select distinct on ((d->>'day')::date) p_org, v_id, (d->>'day')::date, nullif(btrim(d->>'note'), '')
        from jsonb_array_elements(coalesce(p_data->'datesOff', '[]'::jsonb)) d;
  end if;

  if p_data ? 'slots' then
    -- "Teams at once" is the floor here too, as on a hand edit: a kept slot a smaller setting no longer fits is refused.
    v_cap := greatest(1, coalesce((coalesce(p_data->'settings', v_s.settings)->>'teamsAtOnce')::integer, 1));
    for v_slot in select * from jsonb_array_elements(coalesce(p_data->'slots', '[]'::jsonb)) loop
      select id into v_slot_id from club_schedule_slots
       where schedule_id = v_id and org_venue_id = (v_slot->>'venueId')::uuid
         and coalesce(facility_id, '00000000-0000-0000-0000-000000000000'::uuid)
             = coalesce(nullif(v_slot->>'facilityId', '')::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
         and starts_at = (v_slot->>'startsAt')::timestamptz;
      if v_slot_id is null then
        insert into club_schedule_slots (org_id, schedule_id, block_id, org_venue_id, facility_id, starts_at, ends_at, locked, moved_by_hand)
        values (p_org, v_id,
                case when (v_slot ? 'blockIndex') and (v_slot->>'blockIndex') is not null
                     then v_blocks[(v_slot->>'blockIndex')::integer + 1] end,
                (v_slot->>'venueId')::uuid, nullif(v_slot->>'facilityId', '')::uuid,
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
