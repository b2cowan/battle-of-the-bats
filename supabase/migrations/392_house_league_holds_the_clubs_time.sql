-- ---------------------------------------------------------------
-- Migration 392 — Club Tier Stage 11b Part 1: house league holds the club's time.
-- Plan: docs/projects/active/HOUSE_LEAGUE_STAGE9_PLAN.md §0h (9d2·5, ·15, ·16; 11b·A–C) and
--       docs/projects/active/CLUB_PERMITS_AND_SCHEDULER_PLAN.md (the 11b block). Build prompt:
--       docs/projects/active/CLUB_TIER_STAGE11B_BUILD_PROMPT.md.
--
-- WHY: the club has ONE place that controls time (owner, 2026-10-27). An owner or admin gives a slot to House league AS
-- A WHOLE (9d2·15), never to a division; the league admin divides house league's time into a division's game time or
-- practice time and hands practices out to teams. Until now only a rep team could hold a slot (club_schedule_slot_teams:
-- team_id NOT NULL → rep_teams), and a house-league practice had no link to the slot it was cut from.
--
-- WHAT CHANGES:
--   1. club_schedule_slot_programs — the second holder: a slot held by a PROGRAM (only 'house_league'). One program per
--      slot (PK slot_id). A slot is held by rep teams OR by house league, NEVER both (11b·B): both holder tables refuse
--      `slot_both` under the slot's row lock. Not a nullable team_id (it would weaken the PK and FK every rep read relies
--      on), not a fake rep team (it would be billed, emailed and counted as one).
--   2. league_slot_uses — the league admin's division of house league's time: one use per slot, owned by a SEASON (house
--      league's time can span two seasons' dates), naming the division and `games` | `practices`. It hangs off the
--      program row (ON DELETE CASCADE): a use exists only while house league holds the slot.
--   3. league_practice_time — Practice time's two settings per season and division (each practice's length, teams at once).
--   4. league_practices.club_schedule_slot_id — the slot a practice was handed out from, the rep_team_events shape (a plain
--      column, NOT a foreign key: the club's Send the changes moves or cancels the practice, a slot's removal never
--      cascades it). One practice per slot per team. The clash read skips a practice's own slot; "From {schedule}" reads it.
--      league_games gets no column here: 9d-2a reads a division's game time from league_slot_uses, and the games' own link
--      arrives with 9d-2b's migrations at no extra cost.
--   5. club_schedule_save / club_schedule_edit_slots learn `program` on a slot (absent or null = no program, as an absent
--      `teamIds` means no teams). On a final schedule a soft-removed slot KEEPS its program row (and so its use) until
--      Send the changes, which carries the use to the slot the time moved to.
--   6. club_schedule_apply_changes gains `p_league` { updates, cancel, uses } — house league's half of Send the changes,
--      in the same step; the end of the step refuses `changed` if a live house-league practice sits on time house league
--      no longer holds.
--   7. league_slot_uses_set and league_practices_hand_out — the league admin's two writes (the only writers of a use and of
--      a practice's slot link; TypeScript never writes the link, P11-05).
--   8. club_hand_back_take_back — a handed-back slot the club has since given to house league can't come back (as one given
--      to another team).
-- House league is never billed (11b·A): nothing here touches the bill.
-- Re-runnable.
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. The second holder: a program ───────────────────────────────────────────────────────────────────

create table if not exists public.club_schedule_slot_programs (
  slot_id    uuid primary key references public.club_schedule_slots(id) on delete cascade,
  program    text not null check (program in ('house_league')),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists club_schedule_slot_programs_org_idx on public.club_schedule_slot_programs (org_id);

comment on table public.club_schedule_slot_programs is
  'A slot held by a PROGRAM rather than by rep teams (Club Tier Stage 11b, mig 392; ruling 9d2·15): the club gives time to House league as a whole, never to a division. One program per slot. A slot is held by rep teams (club_schedule_slot_teams) OR by a program, never both (11b·B, `slot_both`). The league admin divides it in league_slot_uses. Never billed (11b·A).';

-- A program row: the slot is this club's, and no team holds it. Takes the slot's row lock, so a concurrent team write
-- (whose check takes the same lock) waits and then sees this row.
create or replace function public.club_schedule_slot_programs_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select org_id into v_org from club_schedule_slots where id = new.slot_id for update;
  if v_org is distinct from new.org_id then
    raise exception 'slot_owner: the slot is not this club''s';
  end if;
  if exists (select 1 from club_schedule_slot_teams where slot_id = new.slot_id) then
    raise exception 'slot_both: a slot is held by teams or by house league, never both';
  end if;
  return new;
end;
$$;

drop trigger if exists club_schedule_slot_programs_check on public.club_schedule_slot_programs;
create trigger club_schedule_slot_programs_check
  before insert or update on public.club_schedule_slot_programs
  for each row execute function public.club_schedule_slot_programs_check();

-- A team row: no program holds the slot (the mirror of the check above, under the same lock).
create or replace function public.club_schedule_slot_teams_no_program()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from club_schedule_slots where id = new.slot_id for update;
  if exists (select 1 from club_schedule_slot_programs where slot_id = new.slot_id) then
    raise exception 'slot_both: a slot is held by teams or by house league, never both';
  end if;
  return new;
end;
$$;

drop trigger if exists club_schedule_slot_teams_no_program on public.club_schedule_slot_teams;
create trigger club_schedule_slot_teams_no_program
  before insert or update on public.club_schedule_slot_teams
  for each row execute function public.club_schedule_slot_teams_no_program();

-- ── 2. The league admin's division of house league's time ─────────────────────────────────────────────

create table if not exists public.league_slot_uses (
  slot_id     uuid primary key references public.club_schedule_slot_programs(slot_id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  season_id   uuid not null references public.league_seasons(id) on delete cascade,
  division_id uuid not null references public.league_divisions(id) on delete cascade,
  kind        text not null check (kind in ('games', 'practices')),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists league_slot_uses_season_idx on public.league_slot_uses (season_id, division_id);
create index if not exists league_slot_uses_org_idx on public.league_slot_uses (org_id);

comment on table public.league_slot_uses is
  'How a league admin divided house league''s time (Club Tier Stage 11b, mig 392; 9d2·5, 9d2·15): one use per house-league slot — a division''s game time (`games`, which 9d-2a''s Generate games fills) or its practice time (`practices`, which Practice time hands out to its teams). Owned by a SEASON, not the program. A slot with no row is "Not given yet". Cascades from club_schedule_slot_programs: when the club takes the slot back, its use goes with it. Written only by league_slot_uses_set and club_schedule_apply_changes.';

create or replace function public.league_slot_uses_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from club_schedule_slot_programs p
                  where p.slot_id = new.slot_id and p.org_id = new.org_id and p.program = 'house_league') then
    raise exception 'use_slot: house league does not hold that slot';
  end if;
  if not exists (select 1 from league_seasons s where s.id = new.season_id and s.org_id = new.org_id) then
    raise exception 'use_season: that season is not this club''s';
  end if;
  if not exists (select 1 from league_divisions d where d.id = new.division_id and d.season_id = new.season_id) then
    raise exception 'use_division: that division is not the season''s';
  end if;
  return new;
end;
$$;

drop trigger if exists league_slot_uses_check on public.league_slot_uses;
create trigger league_slot_uses_check
  before insert or update on public.league_slot_uses
  for each row execute function public.league_slot_uses_check();

-- ── 3. Practice time's settings ───────────────────────────────────────────────────────────────────────

create table if not exists public.league_practice_time (
  season_id        uuid not null references public.league_seasons(id) on delete cascade,
  division_id      uuid not null references public.league_divisions(id) on delete cascade,
  org_id           uuid not null references public.organizations(id) on delete cascade,
  practice_minutes integer not null check (practice_minutes between 15 and 240),
  teams_at_once    integer not null default 1 check (teams_at_once between 1 and 4),
  updated_by       uuid references auth.users(id) on delete set null,
  updated_at       timestamptz not null default now(),
  primary key (season_id, division_id)
);

create index if not exists league_practice_time_org_idx on public.league_practice_time (org_id);

comment on table public.league_practice_time is
  'Practice time''s two settings for a division in a season (Club Tier Stage 11b, mig 392; frame h1): each practice''s length and how many teams practise on one facility at once. Written by league_practices_hand_out with the practices it hands out.';

-- ── 4. A house-league practice's link to the slot it was handed out from ──────────────────────────────

alter table public.league_practices
  add column if not exists club_schedule_slot_id uuid;

-- One practice per slot per team; a hand-booked practice (always NULL here) is never constrained by it.
create unique index if not exists league_practices_club_slot_uq
  on public.league_practices (club_schedule_slot_id, team_id)
  where club_schedule_slot_id is not null;

comment on column public.league_practices.club_schedule_slot_id is
  'Provenance (Club Tier Stage 11b, mig 392): the club_schedule_slots row this practice was handed out from (Practice time) — "From {schedule}", changed only in the club''s schedule (9d2·5). NOT a foreign key, as rep_team_events.club_schedule_slot_id: the club''s Send the changes moves or cancels the practice (club_schedule_apply_changes p_league), and a slot''s removal never cascades it. Written only by league_practices_hand_out and club_schedule_apply_changes. NULL on every practice booked by hand.';

-- ── 5. One save, one step: slots learn `program` ──────────────────────────────────────────────────────
-- 326's step, exactly, plus: each slot's `program` ('house_league' or absent/null). A slot naming both teams and a
-- program is refused `slot_both`. The holder that goes is removed before the one that comes, so the floor's exclusivity
-- holds row by row. A final schedule's soft-removed slot keeps its program row (its use survives to Send the changes).

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
          sort_order = v_i,
          updated_at = now()
        where id = v_block_id;
      else
        insert into org_time_blocks (org_id, schedule_id, org_venue_id, weekdays, start_time, end_time, from_date, until_date, sort_order)
        values (p_org, v_id, (v_block->>'venueId')::uuid,
                array(select x::smallint from jsonb_array_elements_text(v_block->'weekdays') x order by 1),
                (v_block->>'startTime')::time, (v_block->>'endTime')::time,
                nullif(v_block->>'fromDate', '')::date, nullif(v_block->>'untilDate', '')::date, v_i)
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

-- 326's hand edit, exactly, plus: an edit may carry `program` ('house_league' or null) beside or instead of `teamIds`.
create or replace function public.club_schedule_edit_slots(p_org uuid, p_schedule uuid, p_actor uuid, p_version integer, p_edits jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s        club_schedules%rowtype;
  v_edit     jsonb;
  v_slot     club_schedule_slots%rowtype;
  v_teams    uuid[];
  v_old      uuid[];
  v_changed  boolean := false;
  v_cap      integer;
  v_prog     text;
  v_old_prog text;
begin
  select * into v_s from club_schedules where id = p_schedule and org_id = p_org for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if v_s.version <> p_version then return jsonb_build_object('ok', false, 'code', 'changed', 'version', v_s.version); end if;
  v_cap := greatest(1, coalesce((v_s.settings->>'teamsAtOnce')::integer, 1));

  for v_edit in select * from jsonb_array_elements(coalesce(p_edits, '[]'::jsonb)) loop
    select * into v_slot from club_schedule_slots
     where id = (v_edit->>'slotId')::uuid and schedule_id = p_schedule and removed_at is null;
    if not found then return jsonb_build_object('ok', false, 'code', 'slot_not_found', 'slotId', v_edit->>'slotId'); end if;
    v_old_prog := null;
    select program into v_old_prog from club_schedule_slot_programs where slot_id = v_slot.id;
    v_prog := case when v_edit ? 'program' then nullif(v_edit->>'program', '') else v_old_prog end;
    if v_edit ? 'teamIds' then
      v_teams := array(select distinct x::uuid from jsonb_array_elements_text(coalesce(v_edit->'teamIds', '[]'::jsonb)) x order by 1);
      if v_prog is not null and cardinality(v_teams) > 0 then
        raise exception 'slot_both: a slot is held by teams or by house league, never both';
      end if;
      if cardinality(v_teams) > v_cap then
        raise exception 'slot_full: a slot holds % team(s) at once', v_cap;
      end if;
    end if;
    if v_old_prog is not null and v_prog is distinct from v_old_prog then
      delete from club_schedule_slot_programs where slot_id = v_slot.id;
      v_changed := true;
    end if;
    if v_edit ? 'teamIds' then
      select coalesce(array_agg(team_id order by team_id), '{}') into v_old from club_schedule_slot_teams where slot_id = v_slot.id;
      if v_old is distinct from v_teams then
        delete from club_schedule_slot_teams where slot_id = v_slot.id;
        insert into club_schedule_slot_teams (slot_id, team_id, org_id) select v_slot.id, t, p_org from unnest(v_teams) t;
        v_changed := true;
      end if;
    end if;
    if v_prog is not null and v_prog is distinct from v_old_prog then
      -- The teams' check refuses here (slot_both) when the edit gave house league a slot that still has teams.
      insert into club_schedule_slot_programs (slot_id, program, org_id) values (v_slot.id, v_prog, p_org);
      v_changed := true;
    end if;
    update club_schedule_slots set
      locked = coalesce((v_edit->>'locked')::boolean, locked),
      moved_by_hand = coalesce((v_edit->>'movedByHand')::boolean, moved_by_hand),
      updated_at = now()
    where id = v_slot.id;
  end loop;

  perform club_schedule_assert_no_team_twice(p_schedule);
  update club_schedules set
    version = version + 1,
    changed_since_sent = changed_since_sent or (state = 'final' and v_changed),
    updated_by = p_actor, updated_at = now()
  where id = p_schedule
  returning * into v_s;
  return jsonb_build_object('ok', true, 'version', v_s.version);
end;
$$;

-- ── 6. Send the changes: house league's half, in the same step ────────────────────────────────────────
-- 328's step, exactly, plus `p_league` (null = nothing for house league):
--   uses:    [{ from, to }]  — a use follows its time: the slot it was on (removed, or no longer house league's) to the
--            live house-league slot the time moved to, when that slot has no use yet.
--   cancel:  [practiceId]    — house-league practices on time house league no longer has: cancelled (the coach's email and
--            the house-league schedule read "Cancelled"; h4).
--   updates: [{ practiceId, slotId, scheduledAt, endsAt, venueId, facilityId, location }] — a practice moved IN PLACE to
--            the house-league slot its time moved to; its link moves with it.
-- Then: no live house-league practice of this schedule may sit on a removed slot or one house league no longer holds
-- (`changed`), and a cancelled one's link to a removed slot is cleared before the slot goes.

drop function if exists public.club_schedule_apply_changes(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb, uuid, jsonb, jsonb);
create or replace function public.club_schedule_apply_changes(
  p_org uuid, p_schedule uuid, p_actor uuid, p_version integer,
  p_inserts jsonb, p_updates jsonb, p_retire uuid[], p_bill jsonb, p_send uuid, p_log jsonb, p_losses jsonb,
  p_league jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s        club_schedules%rowtype;
  v_team     uuid;
  v_res      jsonb;
  v_alloc    uuid;
  v_u        jsonb;
  v_id       uuid;
  v_fate     text;
  v_ins      integer := 0;
  v_upd      integer := 0;
  v_cancel   integer := 0;
  v_delete   integer := 0;
  v_loss     jsonb;
  v_pool     uuid[];
  v_credit   bigint;
  v_rest     bigint;
  v_settled  jsonb := '{}'::jsonb;
  v_hl_moved    integer := 0;
  v_hl_cancel   integer := 0;
  v_hl_uses     integer := 0;
begin
  select * into v_s from club_schedules where id = p_schedule and org_id = p_org for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if v_s.state <> 'final' then return jsonb_build_object('ok', false, 'code', 'not_final'); end if;
  if v_s.version <> p_version then return jsonb_build_object('ok', false, 'code', 'changed', 'version', v_s.version); end if;
  v_team := club_practices_season_refusal(p_org, p_inserts);
  if v_team is not null then return jsonb_build_object('ok', false, 'code', 'season_closed', 'teamId', v_team); end if;

  -- The losses settle against the bills the teams already had — before this step's correction joins the pool.
  v_pool := club_schedule_bill_pool(p_schedule);

  if p_bill is not null then
    v_res := club_allocation_create(p_org, p_actor, p_bill->>'description', nullif(p_bill->>'lineId', '')::uuid, 'time',
                                    p_bill->'splits', p_bill->>'notes');
    if not coalesce((v_res->>'ok')::boolean, false) then return v_res; end if;
    v_alloc := (v_res->>'allocationId')::uuid;
    perform club_bill_file_shares(v_alloc);
  end if;

  if jsonb_array_length(coalesce(p_losses, '[]'::jsonb)) > 0 then
    perform set_config('app.club_money_step', 'on', true);
    for v_loss in select * from jsonb_array_elements(p_losses) loop
      if coalesce((v_loss->>'cents')::bigint, 0) <= 0 then continue; end if;
      if not exists (select 1 from rep_teams where id = (v_loss->>'teamId')::uuid and org_id = p_org) then
        raise exception 'changed: a team of the changes is not this club''s';
      end if;
      -- Dated the club's day the app sends (`p_log.today` — lib/timezone tournamentToday), as Accept's p_on.
      v_credit := club_credit_apply(p_org, (v_loss->>'teamId')::uuid, v_pool, (v_loss->>'cents')::bigint, p_actor,
                                    coalesce((p_log->>'today')::date, current_date), v_loss->>'reason', null, p_send);
      v_rest := (v_loss->>'cents')::bigint - v_credit;
      -- Paid since the preview (or no season to carry it): the send is read again, never a request on no season.
      if v_rest > 0 and not exists (select 1 from rep_program_years where id = nullif(v_loss->'request'->>'programYearId', '')::uuid
                                                                       and team_id = (v_loss->>'teamId')::uuid and org_id = p_org) then
        raise exception 'changed: what the club owes a team that lost time has no season of that team''s to land on';
      end if;
      if v_rest > 0 then
        insert into rep_team_payment_requests (org_id, team_id, program_year_id, request_type, amount, description, status,
                                               money_in_meaning, budget_item_id, budget_category_id, budget_line_id,
                                               created_by, reviewed_by, reviewed_at, club_schedule_send_id)
        values (p_org, (v_loss->>'teamId')::uuid, (v_loss->'request'->>'programYearId')::uuid, 'charge_to_org',
                v_rest / 100.0, left(btrim(v_loss->'request'->>'description'), 500), 'accepted', 'reimbursement',
                nullif(v_loss->'request'->>'budgetItemId', '')::uuid, nullif(v_loss->'request'->>'budgetCategoryId', '')::uuid,
                nullif(v_loss->'request'->>'budgetLineId', '')::uuid, p_actor, p_actor, now(), p_send);
      end if;
      v_settled := v_settled || jsonb_build_object(v_loss->>'teamId', jsonb_build_object('credited', v_credit, 'toPay', v_rest));
    end loop;
  end if;

  -- Retire first, so a slot that moves from one team to another frees its season's index before the new practice lands.
  foreach v_id in array coalesce(p_retire, '{}'::uuid[]) loop
    if not exists (select 1 from rep_team_events e
                    where e.id = v_id and e.org_id = p_org
                      and e.club_schedule_slot_id in (select id from club_schedule_slots where schedule_id = p_schedule)) then
      continue;
    end if;
    v_fate := club_practice_retire(v_id);
    if v_fate = 'cancelled' then v_cancel := v_cancel + 1; elsif v_fate = 'deleted' then v_delete := v_delete + 1; end if;
  end loop;

  for v_u in select * from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb)) loop
    if not exists (select 1 from club_schedule_slots sl
                    where sl.id = (v_u->>'slotId')::uuid and sl.schedule_id = p_schedule and sl.removed_at is null) then
      raise exception 'changed: a slot of the changes is no longer the schedule''s';
    end if;
    update rep_team_events e set
      club_schedule_slot_id = (v_u->>'slotId')::uuid,
      starts_at = (v_u->>'startsAt')::timestamptz, ends_at = (v_u->>'endsAt')::timestamptz,
      org_venue_id = (v_u->>'venueId')::uuid, org_venue_facility_id = nullif(v_u->>'facilityId', '')::uuid,
      location = nullif(v_u->>'location', ''), location_address = nullif(v_u->>'locationAddress', ''),
      field_number = nullif(v_u->>'fieldNumber', ''), updated_at = now()
    where e.id = (v_u->>'eventId')::uuid and e.org_id = p_org
      and e.club_schedule_slot_id in (select id from club_schedule_slots where schedule_id = p_schedule);
    if found then v_upd := v_upd + 1; end if;
  end loop;

  if exists (select 1 from jsonb_array_elements(coalesce(p_inserts, '[]'::jsonb)) r
              where not exists (select 1 from club_schedule_slots sl
                                 where sl.id = (r->>'slotId')::uuid and sl.schedule_id = p_schedule and sl.removed_at is null)) then
    raise exception 'changed: a slot of the changes is no longer the schedule''s';
  end if;
  v_ins := club_practices_write(p_org, p_inserts);

  -- ── House league's half (11b) ──
  -- Cancel first, so a moved practice never meets one the time no longer has on the same (slot, team).
  for v_u in select * from jsonb_array_elements(coalesce(p_league->'cancel', '[]'::jsonb)) loop
    update league_practices lp set status = 'cancelled', updated_at = now()
     where lp.id = (v_u #>> '{}')::uuid and lp.org_id = p_org and lp.status <> 'cancelled'
       and lp.club_schedule_slot_id in (select id from club_schedule_slots where schedule_id = p_schedule);
    if found then v_hl_cancel := v_hl_cancel + 1; end if;
  end loop;

  for v_u in select * from jsonb_array_elements(coalesce(p_league->'uses', '[]'::jsonb)) loop
    if not exists (select 1 from club_schedule_slots sl join club_schedule_slot_programs p on p.slot_id = sl.id
                    where sl.id = (v_u->>'to')::uuid and sl.schedule_id = p_schedule and sl.removed_at is null
                      and p.program = 'house_league') then
      raise exception 'changed: house league no longer holds the time a use moves to';
    end if;
    if exists (select 1 from league_slot_uses where slot_id = (v_u->>'to')::uuid) then continue; end if;
    update league_slot_uses u set slot_id = (v_u->>'to')::uuid, updated_at = now()
     where u.slot_id = (v_u->>'from')::uuid and u.org_id = p_org
       and u.slot_id in (select id from club_schedule_slots where schedule_id = p_schedule);
    if found then v_hl_uses := v_hl_uses + 1; end if;
  end loop;

  for v_u in select * from jsonb_array_elements(coalesce(p_league->'updates', '[]'::jsonb)) loop
    if not exists (select 1 from club_schedule_slots sl join club_schedule_slot_programs p on p.slot_id = sl.id
                    where sl.id = (v_u->>'slotId')::uuid and sl.schedule_id = p_schedule and sl.removed_at is null
                      and p.program = 'house_league') then
      raise exception 'changed: house league no longer holds the time a practice moves to';
    end if;
    update league_practices lp set
      club_schedule_slot_id = (v_u->>'slotId')::uuid,
      scheduled_at = (v_u->>'scheduledAt')::timestamptz, ends_at = (v_u->>'endsAt')::timestamptz,
      org_venue_id = (v_u->>'venueId')::uuid, org_venue_facility_id = nullif(v_u->>'facilityId', '')::uuid,
      location = nullif(v_u->>'location', ''), status = 'scheduled', updated_at = now()
    where lp.id = (v_u->>'practiceId')::uuid and lp.org_id = p_org
      and lp.club_schedule_slot_id in (select id from club_schedule_slots where schedule_id = p_schedule);
    if found then v_hl_moved := v_hl_moved + 1; end if;
  end loop;

  if exists (select 1 from league_practices lp join club_schedule_slots sl on sl.id = lp.club_schedule_slot_id
              where sl.schedule_id = p_schedule and lp.status <> 'cancelled'
                and (sl.removed_at is not null
                     or not exists (select 1 from club_schedule_slot_programs p where p.slot_id = sl.id))) then
    raise exception 'changed: a house-league practice is still on time house league no longer has';
  end if;
  update league_practices set club_schedule_slot_id = null, updated_at = now()
   where club_schedule_slot_id in (select id from club_schedule_slots where schedule_id = p_schedule and removed_at is not null);

  if exists (select 1 from rep_team_events e join club_schedule_slots sl on sl.id = e.club_schedule_slot_id
              where sl.schedule_id = p_schedule and sl.removed_at is not null and e.status <> 'cancelled') then
    raise exception 'changed: a practice is still on a removed slot';
  end if;
  update rep_team_events set club_schedule_slot_id = null, updated_at = now()
   where club_schedule_slot_id in (select id from club_schedule_slots where schedule_id = p_schedule and removed_at is not null);
  delete from club_schedule_slots where schedule_id = p_schedule and removed_at is not null;

  update club_schedules set
    version = version + 1, changed_since_sent = false, sent_at = now(), sent_by = p_actor,
    updated_by = p_actor, updated_at = now()
  where id = p_schedule;
  update club_schedule_sends set
    landed_at = now(), team_values = coalesce(p_log->'teamValues', '{}'::jsonb),
    billed = coalesce(p_log->'billed', '{}'::jsonb), settled = v_settled, allocation_id = v_alloc
   where id = p_send and schedule_id = p_schedule and org_id = p_org;
  if not found then raise exception 'changed: the send''s claim is gone'; end if;
  perform set_config('app.club_money_step', '', true);
  return jsonb_build_object('ok', true, 'allocationId', v_alloc, 'inserted', v_ins, 'updated', v_upd,
                            'cancelled', v_cancel, 'deleted', v_delete, 'settled', v_settled,
                            'league', jsonb_build_object('moved', v_hl_moved, 'cancelled', v_hl_cancel, 'uses', v_hl_uses));
end;
$$;

-- ── 7. The league admin's two writes ──────────────────────────────────────────────────────────────────

-- Refusals shared by both: the season is this club's and still running, the division is the season's.
create or replace function public.league_time_refusal(p_org uuid, p_season uuid, p_division uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (select 1 from league_seasons s where s.id = p_season and s.org_id = p_org) then 'not_found'
    when exists (select 1 from league_seasons s where s.id = p_season and s.status in ('completed', 'archived')) then 'season_closed'
    when p_division is not null
         and not exists (select 1 from league_divisions d where d.id = p_division and d.season_id = p_season) then 'not_found'
    else null
  end;
$$;

-- Give house-league slots to a division (`p_kind` games | practices), or back to Not given yet (`p_kind` null). Each slot
-- must be a live slot of a FINAL schedule of this club that house league holds, and not another season's. When a slot
-- stops being this division's practice time, its practices that haven't started go (handed-out practices are the league
-- admin's own: nothing of a coach's hangs off a house-league practice); started ones keep their link as history.
-- Refusals before any write: not_found · season_closed · changed (+ slotId).
create or replace function public.league_slot_uses_set(
  p_org uuid, p_season uuid, p_actor uuid, p_slots uuid[], p_division uuid, p_kind text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code    text;
  v_slot    uuid;
  v_n       integer := 0;
  v_removed integer := 0;
begin
  if p_kind is not null and p_kind not in ('games', 'practices') then
    raise exception 'use_kind: a use is games or practices';
  end if;
  if p_kind is not null and p_division is null then
    raise exception 'use_division: a use names its division';
  end if;
  v_code := league_time_refusal(p_org, p_season, p_division);
  if v_code is not null then return jsonb_build_object('ok', false, 'code', v_code); end if;

  foreach v_slot in array coalesce(p_slots, '{}'::uuid[]) loop
    perform 1 from club_schedule_slots sl
      join club_schedules s on s.id = sl.schedule_id
      join club_schedule_slot_programs p on p.slot_id = sl.id
     where sl.id = v_slot and sl.org_id = p_org and sl.removed_at is null and s.state = 'final' and p.program = 'house_league'
     for update of sl;
    if not found
       or exists (select 1 from league_slot_uses u where u.slot_id = v_slot and u.season_id <> p_season) then
      return jsonb_build_object('ok', false, 'code', 'changed', 'slotId', v_slot);
    end if;
  end loop;

  foreach v_slot in array coalesce(p_slots, '{}'::uuid[]) loop
    -- Practices that haven't started go when the slot stops being their division's practice time.
    delete from league_practices lp
     where lp.club_schedule_slot_id = v_slot and lp.org_id = p_org and lp.scheduled_at > now()
       and not coalesce(p_kind = 'practices' and lp.division_id is not distinct from p_division, false);
    get diagnostics v_n = row_count;
    v_removed := v_removed + v_n;
    if p_kind is null then
      delete from league_slot_uses where slot_id = v_slot;
    else
      insert into league_slot_uses (slot_id, org_id, season_id, division_id, kind, created_by)
      values (v_slot, p_org, p_season, p_division, p_kind, p_actor)
      on conflict (slot_id) do update set division_id = excluded.division_id, kind = excluded.kind, updated_at = now();
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'slots', coalesce(cardinality(p_slots), 0), 'practicesRemoved', v_removed);
end;
$$;

-- Practice time: hand a division's practice time out to its teams (frame h1). `p_slots`: the slots this hand-out covers
-- (each must be this division's practice time in this season). `p_rows`: [{ slotId, teamId, scheduledAt, endsAt, venueId,
-- facilityId, location }] — the engine's fair share, each inside its slot. Practices already on those slots that the rows
-- no longer name, and that haven't started, go; the rows are written (a cancelled one for the same slot and team comes
-- back). Floors: a practice inside its slot; at most `teamsAtOnce` practices at once on a slot (`slot_full`); a team never
-- in two house-league practices at once (`team_twice`). Refusals before any write: not_found · season_closed · changed.
create or replace function public.league_practices_hand_out(
  p_org uuid, p_season uuid, p_division uuid, p_actor uuid, p_slots uuid[], p_rows jsonb, p_settings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code    text;
  v_slot    uuid;
  v_row     jsonb;
  v_cap     integer;
  v_written integer := 0;
  v_removed integer := 0;
  v_team    text;
begin
  v_code := league_time_refusal(p_org, p_season, p_division);
  if v_code is not null then return jsonb_build_object('ok', false, 'code', v_code); end if;
  if p_division is null then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  v_cap := greatest(1, least(4, coalesce((p_settings->>'teamsAtOnce')::integer, 1)));

  foreach v_slot in array coalesce(p_slots, '{}'::uuid[]) loop
    perform 1 from club_schedule_slots sl
      join league_slot_uses u on u.slot_id = sl.id
     where sl.id = v_slot and sl.org_id = p_org and sl.removed_at is null
       and u.season_id = p_season and u.division_id = p_division and u.kind = 'practices'
     for update of sl;
    if not found then return jsonb_build_object('ok', false, 'code', 'changed', 'slotId', v_slot); end if;
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    if not ((v_row->>'slotId')::uuid = any (coalesce(p_slots, '{}'::uuid[]))) then
      return jsonb_build_object('ok', false, 'code', 'changed', 'slotId', v_row->>'slotId');
    end if;
    if not exists (select 1 from league_teams t where t.id = (v_row->>'teamId')::uuid
                                                  and t.season_id = p_season and t.division_id = p_division) then
      return jsonb_build_object('ok', false, 'code', 'changed', 'teamId', v_row->>'teamId');
    end if;
    if not exists (select 1 from club_schedule_slots sl
                    where sl.id = (v_row->>'slotId')::uuid
                      and (v_row->>'scheduledAt')::timestamptz >= sl.starts_at
                      and (v_row->>'endsAt')::timestamptz <= sl.ends_at
                      and (v_row->>'endsAt')::timestamptz > (v_row->>'scheduledAt')::timestamptz) then
      return jsonb_build_object('ok', false, 'code', 'changed', 'slotId', v_row->>'slotId');
    end if;
  end loop;

  delete from league_practices lp
   where lp.club_schedule_slot_id = any (coalesce(p_slots, '{}'::uuid[])) and lp.org_id = p_org and lp.scheduled_at > now()
     and not exists (select 1 from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
                      where (r->>'slotId')::uuid = lp.club_schedule_slot_id and (r->>'teamId')::uuid = lp.team_id);
  get diagnostics v_removed = row_count;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    insert into league_practices (season_id, division_id, team_id, org_id, scheduled_at, ends_at, location, status,
                                  org_venue_id, org_venue_facility_id, club_schedule_slot_id)
    values (p_season, p_division, (v_row->>'teamId')::uuid, p_org,
            (v_row->>'scheduledAt')::timestamptz, (v_row->>'endsAt')::timestamptz, nullif(v_row->>'location', ''),
            'scheduled', (v_row->>'venueId')::uuid, nullif(v_row->>'facilityId', '')::uuid, (v_row->>'slotId')::uuid)
    on conflict (club_schedule_slot_id, team_id) where club_schedule_slot_id is not null
    do update set status = 'scheduled', scheduled_at = excluded.scheduled_at, ends_at = excluded.ends_at,
                  location = excluded.location, org_venue_id = excluded.org_venue_id,
                  org_venue_facility_id = excluded.org_venue_facility_id, division_id = excluded.division_id,
                  updated_at = now();
    v_written := v_written + 1;
  end loop;

  -- Teams at once: no instant on a slot holds more live practices than the setting.
  if exists (select 1 from league_practices a
              where a.club_schedule_slot_id = any (coalesce(p_slots, '{}'::uuid[])) and a.status <> 'cancelled'
                and (select count(*) from league_practices b
                      where b.club_schedule_slot_id = a.club_schedule_slot_id and b.status <> 'cancelled'
                        and b.scheduled_at <= a.scheduled_at and b.ends_at > a.scheduled_at) > v_cap) then
    raise exception 'slot_full: a slot holds % practice(s) at once', v_cap;
  end if;
  -- A team never in two house-league practices at once.
  select t.name into v_team
    from league_practices a
    join league_practices b on b.team_id = a.team_id and b.id <> a.id and b.status <> 'cancelled'
    join league_teams t on t.id = a.team_id
   where a.club_schedule_slot_id = any (coalesce(p_slots, '{}'::uuid[])) and a.status <> 'cancelled'
     and a.scheduled_at < b.ends_at and b.scheduled_at < a.ends_at
   limit 1;
  if found then
    raise exception 'team_twice: % has two practices at once', v_team;
  end if;

  if p_settings ? 'practiceMinutes' then
    insert into league_practice_time (season_id, division_id, org_id, practice_minutes, teams_at_once, updated_by)
    values (p_season, p_division, p_org, (p_settings->>'practiceMinutes')::integer, v_cap, p_actor)
    on conflict (season_id, division_id) do update set practice_minutes = excluded.practice_minutes,
      teams_at_once = excluded.teams_at_once, updated_by = excluded.updated_by, updated_at = now();
  end if;
  return jsonb_build_object('ok', true, 'written', v_written, 'removed', v_removed);
end;
$$;

-- ── 8. A handed-back slot house league now holds can't come back ──────────────────────────────────────
-- 330's step, exactly, plus `or a program holds it` beside "given to another team".

create or replace function public.club_hand_back_take_back(p_org uuid, p_team uuid, p_actor uuid, p_hand_back uuid, p_slots uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hb      club_schedule_hand_backs%rowtype;
  v_state   text;
  v_slot    uuid;
  v_done    uuid[] := '{}';
begin
  select * into v_hb from club_schedule_hand_backs where id = p_hand_back and org_id = p_org and team_id = p_team;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  select state into v_state from club_schedules where id = v_hb.schedule_id for update;
  if v_state is distinct from 'final' then return jsonb_build_object('ok', false, 'code', 'not_final'); end if;
  select * into v_hb from club_schedule_hand_backs where id = p_hand_back for update;
  -- Only a hand-back without money: an accepted ask's Sundays were paid for, so taking them back is the club's call.
  if v_hb.state <> 'landed' then return jsonb_build_object('ok', false, 'code', 'nothing'); end if;

  foreach v_slot in array coalesce(p_slots, '{}'::uuid[]) loop
    if not exists (select 1 from club_schedule_hand_back_slots hs
                    where hs.hand_back_id = p_hand_back and hs.slot_id = v_slot and hs.handed_back) then
      continue;
    end if;
    -- It hasn't started, and the club hasn't removed it or given it to another team or to house league (sent or not).
    if not exists (select 1 from club_schedule_slots sl
                    where sl.id = v_slot and sl.schedule_id = v_hb.schedule_id and sl.removed_at is null and sl.starts_at > now())
       or exists (select 1 from club_schedule_slot_teams st where st.slot_id = v_slot)
       or exists (select 1 from club_schedule_slot_programs sp where sp.slot_id = v_slot) then
      continue;
    end if;
    -- No ask waits on it — a late ask over this hand-back, or any other.
    if exists (select 1 from club_schedule_hand_back_slots w where w.slot_id = v_slot and w.waiting) then
      continue;
    end if;
    -- No money was settled for it: a late ask over this hand-back that the club accepted.
    if exists (select 1 from club_schedule_hand_backs l
                 join club_schedule_hand_back_slots ls on ls.hand_back_id = l.id
                where l.late_for = p_hand_back and l.state = 'accepted' and ls.slot_id = v_slot) then
      continue;
    end if;
    -- The practice is still there to come back (a hand-back made before mig 330 may have deleted it).
    if not exists (select 1 from rep_team_events e
                    where e.org_id = p_org and e.team_id = p_team and e.club_schedule_slot_id = v_slot and e.status = 'cancelled') then
      continue;
    end if;
    -- The team holds nothing of the schedule at that time already (the schedule's one rule: never twice at once).
    if exists (select 1 from club_schedule_slot_teams st
                 join club_schedule_slots o on o.id = st.slot_id
                 join club_schedule_slots sl on sl.id = v_slot
                where st.team_id = p_team and o.schedule_id = v_hb.schedule_id and o.id <> v_slot and o.removed_at is null
                  and o.starts_at < sl.ends_at and sl.starts_at < o.ends_at) then
      continue;
    end if;

    insert into club_schedule_slot_teams (slot_id, team_id, org_id) values (v_slot, p_team, p_org);
    update club_schedule_slots set handed_back_at = null, handed_back_by = null, handed_back_team_id = null, updated_at = now()
     where id = v_slot;
    -- Back on, as it was: only the status moves (its notes, attendance and plan never left it).
    update rep_team_events set status = 'scheduled', updated_at = now()
     where org_id = p_org and team_id = p_team and club_schedule_slot_id = v_slot and status = 'cancelled';
    update club_schedule_hand_back_slots set handed_back = false where hand_back_id = p_hand_back and slot_id = v_slot;
    v_done := v_done || v_slot;
  end loop;

  if cardinality(v_done) = 0 then return jsonb_build_object('ok', false, 'code', 'nothing'); end if;
  -- The page's edits act on the version they read; the slots changed. Never Changed since sent (Ask 9, both ways).
  update club_schedules set version = version + 1, updated_at = now() where id = v_hb.schedule_id;
  return jsonb_build_object('ok', true, 'slots', to_jsonb(v_done), 'scheduleId', v_hb.schedule_id);
end;
$$;

-- ── 9. Server-only (326's shape) ──────────────────────────────────────────────────────────────────────

alter table public.club_schedule_slot_programs enable row level security;
alter table public.league_slot_uses enable row level security;
alter table public.league_practice_time enable row level security;

revoke all on public.club_schedule_slot_programs, public.league_slot_uses, public.league_practice_time from anon, authenticated;
grant select, insert, update, delete on public.club_schedule_slot_programs, public.league_slot_uses,
                                        public.league_practice_time to service_role;

revoke all on function
  public.club_schedule_slot_programs_check(),
  public.club_schedule_slot_teams_no_program(),
  public.league_slot_uses_check(),
  public.league_time_refusal(uuid, uuid, uuid),
  public.league_slot_uses_set(uuid, uuid, uuid, uuid[], uuid, text),
  public.league_practices_hand_out(uuid, uuid, uuid, uuid, uuid[], jsonb, jsonb),
  public.club_schedule_save(uuid, uuid, uuid, integer, jsonb),
  public.club_schedule_edit_slots(uuid, uuid, uuid, integer, jsonb),
  public.club_schedule_apply_changes(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb, uuid, jsonb, jsonb, jsonb),
  public.club_hand_back_take_back(uuid, uuid, uuid, uuid, uuid[])
  from public, anon, authenticated;
grant execute on function
  public.league_slot_uses_set(uuid, uuid, uuid, uuid[], uuid, text),
  public.league_practices_hand_out(uuid, uuid, uuid, uuid, uuid[], jsonb, jsonb),
  public.club_schedule_save(uuid, uuid, uuid, integer, jsonb),
  public.club_schedule_edit_slots(uuid, uuid, uuid, integer, jsonb),
  public.club_schedule_apply_changes(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb, uuid, jsonb, jsonb, jsonb),
  public.club_hand_back_take_back(uuid, uuid, uuid, uuid, uuid[])
  to service_role;

COMMIT;
