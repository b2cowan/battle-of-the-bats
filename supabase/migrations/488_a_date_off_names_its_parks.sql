-- 488_a_date_off_names_its_parks.sql
--
-- A schedule on several permits, Session B (build prompt docs/projects/active/CLUB_SCHEDULE_SEVERAL_PERMITS_BUILD_PROMPT.md;
-- plan CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md §4c and §8 Phase 2; /dba Finding #50 "Mig 2 (B)", 2026-11-14). A schedule's date
-- off can name the parks it closes: Town A's long weekend leaves Town B's park alone (owner rulings P5 A, P6 A: venue by venue,
-- never field by field).
--
-- WHAT CHANGES
--   1. org_time_date_off_venues (NEW): the parks one date off names. NO ROWS = ALL VENUES, so a date off that names nothing
--      stays all as parks are added, and every date off that exists today keeps meaning All venues (no backfill).
--      A join table, not uuid[] (/dba #50: an array of ids has no integrity).
--        date_off_id  → org_time_dates_off ON DELETE CASCADE (the save's delete-and-reinsert clears the set with the row)
--        org_venue_id → org_venues NO ACTION (/dba #50, Medium): a cascade that took a date off's last park would silently
--                       widen it to every park. Checked at the statement's end, so an org delete still cascades (mig 322's
--                       venue floor). The Venue library refuses the delete in words ("a date off names it").
--        org_id       → organizations ON DELETE CASCADE (the gate's column)
--      PK (date_off_id, org_venue_id); indexes (org_venue_id) for the FK and the delete check, (org_id) for the gate.
--      A same-club trigger like org_time_dates_off_check. RLS on, no policies, service role only.
--   2. club_schedule_save (487's, exactly) writes each date off's parks: an entry's `venueIds` list is its parks (an empty
--      list = All venues); an entry with no list keeps the parks that day names today (a stale tab can't widen it). The
--      unique per (schedule, day) STAYS: entries for one day merge into ONE row, All venues winning over any list, else the
--      union of their parks, and the first note that says something. Nothing else in the function changes.
--
-- A permit's own dates off stay permit-wide: only the schedule's save writes this table. Idempotent.

begin;

-- ── 1. The parks a date off names ──────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.org_time_date_off_venues (
  date_off_id  uuid not null references public.org_time_dates_off(id) on delete cascade,
  -- NO ACTION (/dba #50): "no rows = All venues", so a cascade here would widen a named date off to every park.
  org_venue_id uuid not null references public.org_venues(id),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  primary key (date_off_id, org_venue_id)
);

create index if not exists org_time_date_off_venues_venue_idx on public.org_time_date_off_venues (org_venue_id);
create index if not exists org_time_date_off_venues_org_idx on public.org_time_date_off_venues (org_id);

comment on table public.org_time_date_off_venues is
  'The parks one of a schedule''s dates off closes (mig 488, a schedule on several permits). NO ROWS = ALL VENUES (stays all as parks are added; a named list does not grow). Written only by club_schedule_save. Venue FK is NO ACTION so a delete can never widen a date off; the Venue library refuses it in words.';

create or replace function public.org_time_date_off_venues_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from org_time_dates_off where id = new.date_off_id and org_id = new.org_id) then
    raise exception 'date_off_venue: the date off is not this club''s';
  end if;
  -- /dba #50 (Stage 3 review): only a SCHEDULE's date off can name parks. A permit's own dates off stay permit-wide, and the
  -- permit readers never look at this table, so a park row on one would be silently read as All venues.
  if not exists (select 1 from org_time_dates_off where id = new.date_off_id and schedule_id is not null) then
    raise exception 'date_off_venue: only a schedule''s date off names parks';
  end if;
  if not exists (select 1 from org_venues where id = new.org_venue_id and org_id = new.org_id) then
    raise exception 'date_off_venue: the venue is not this club''s';
  end if;
  return new;
end;
$$;

drop trigger if exists org_time_date_off_venues_check on public.org_time_date_off_venues;
create trigger org_time_date_off_venues_check
  before insert or update on public.org_time_date_off_venues
  for each row execute function public.org_time_date_off_venues_check();

alter table public.org_time_date_off_venues enable row level security;
revoke all on public.org_time_date_off_venues from anon, authenticated;
grant select, insert, update, delete on public.org_time_date_off_venues to service_role;
revoke all on function public.org_time_date_off_venues_check() from public, anon, authenticated;

-- ── 2. The save: 487's club_schedule_save exactly, plus each date off's parks ─────────────────────────────────────────────
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
