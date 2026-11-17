-- 491_time_added_is_a_part_of_its_schedule.sql
--
-- Add time is a second schedule, shown as one — Session 1 (build prompt
-- docs/projects/active/CLUB_SCHEDULE_ADD_TIME_PARTS_BUILD_PROMPT.md; plan CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md §8 Phase 8;
-- /dba Finding #52; owner ruled storage (B) 2026-11-17, "yes b").
-- The owner's model: "it's just 2 schedules built the same way, but viewed as 1". Once a schedule is final, Add time makes a
-- PART of it — its own permits, hours, From/To, dates off, teams, shares and bill — and the part IS a club_schedules row,
-- linked to the schedule it was added to. Every per-schedule mechanism (settings, dates off, generate, the bill and its rates,
-- Finalize, the late bill, corrections, the send log) already exists per row; this migration only gives the family its links
-- and its rules.
--
-- WHAT CHANGES
--   1. club_schedules.part_of_schedule_id (NEW, null = a schedule of its own): the schedule this part was added to.
--      FK club_schedules(id) NO ACTION — deleting a schedule must never silently delete a part that may carry a bill; an org
--      delete removes both rows in one statement, which NO ACTION allows (488's precedent). Partial index.
--   2. club_schedules.part_label (NEW): the part's name on the page, "Time added Nov 16" (owner ruling 1 — the date it was added;
--      a second the same day "… (2)"; no name field). Named CHECK pairs it with the link; partial UNIQUE per parent.
--      A part is never sent for review (CHECK club_schedules_part_never_in_review): draft → final, nothing between.
--   3. Trigger club_schedules_part_check (BEFORE INSERT OR UPDATE): the parent is this club's, is not itself a part (one level),
--      and is FINAL when the part is made; the link never changes after the insert. A part's NAME is always
--      "{parent's name} · {label}" (shortened from the parent's end to fit 120), so every reader that names a schedule — the
--      coach's "From …", the calendar, the bill's charge, the emails and bells — names the part with no change (owner ruling
--      2026-11-17: "From Fall practices · Time added Nov 16"). Trigger club_schedules_part_names (AFTER UPDATE OF name) carries a
--      parent's rename to its parts.
--   4. club_schedule_slots.family_id (NEW, not null, NO FK — see §4): the family's first schedule (the part's parent, or the schedule itself),
--      set by the existing BEFORE trigger club_schedule_slots_check. The place-and-start unique index is RE-KEYED from
--      schedule_id to family_id, so a part can never hold the same place at the same start as its parent or a sibling. It is
--      strictly stronger than the old index. Backfill = schedule_id (no part exists before this migration).
--   5. club_schedule_assert_no_team_twice(p_schedule) (RE-MADE, signature unchanged): both sides range over the FAMILY, and it
--      locks the family's first row first, so a part's save and its parent's save are taken one at a time. Every caller (the
--      save, the hand edit) inherits it. Lock order child → first row; the first row's own save already holds it: no deadlock.
--   The parent's "Changed since sent" for an unsent part is NOT stored (derived in the app: a part not yet final), so deleting
--   an unsent part can never leave the flag behind.
--
-- Idempotent.

begin;

set local lock_timeout = '15s';

-- ── 1–2. The link and the label ──────────────────────────────────────────────────────────────────────────────────────

alter table public.club_schedules add column if not exists part_of_schedule_id uuid;
alter table public.club_schedules add column if not exists part_label text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'club_schedules_part_of_schedule_id_fkey') then
    alter table public.club_schedules
      add constraint club_schedules_part_of_schedule_id_fkey
      foreign key (part_of_schedule_id) references public.club_schedules(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'club_schedules_part_label_pairs') then
    alter table public.club_schedules
      add constraint club_schedules_part_label_pairs
      check ((part_of_schedule_id is null) = (part_label is null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'club_schedules_part_label_length') then
    alter table public.club_schedules
      add constraint club_schedules_part_label_length
      check (part_label is null or length(btrim(part_label)) between 1 and 60);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'club_schedules_part_never_in_review') then
    alter table public.club_schedules
      add constraint club_schedules_part_never_in_review
      check (part_of_schedule_id is null or state <> 'in_review');
  end if;
end $$;

create index if not exists club_schedules_part_of_idx
  on public.club_schedules (part_of_schedule_id) where part_of_schedule_id is not null;
create unique index if not exists club_schedules_part_label_once
  on public.club_schedules (part_of_schedule_id, part_label) where part_of_schedule_id is not null;

comment on column public.club_schedules.part_of_schedule_id is
  'Set = this row is an added PART of that schedule (Add time on a final schedule; plan Phase 8): its own permits, dates, dates off, teams, shares and bill, shown on the parent''s page. One level only; the parent was final when the part was made; never changes after the insert. Lists of schedules show only rows where this is null.';
comment on column public.club_schedules.part_label is
  'A part''s name on the page, "Time added Nov 16" (the date it was added; "… (2)" for a second the same day). Set iff part_of_schedule_id is. The row''s name is kept as "{parent name} · {label}" by trigger.';

-- ── 3. The family's rules, and a part's name ─────────────────────────────────────────────────────────────────────────

create or replace function public.club_schedules_part_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent club_schedules%rowtype;
  v_suffix text;
begin
  if tg_op = 'UPDATE' and new.part_of_schedule_id is distinct from old.part_of_schedule_id then
    raise exception 'schedule_part: a part stays with the schedule it was added to';
  end if;
  if new.part_of_schedule_id is null then
    return new;
  end if;
  select * into v_parent from club_schedules where id = new.part_of_schedule_id;
  if not found or v_parent.org_id <> new.org_id then
    raise exception 'schedule_part: the schedule is not this club''s';
  end if;
  if v_parent.part_of_schedule_id is not null then
    raise exception 'schedule_part: time is added to a schedule, not to a part of one';
  end if;
  if tg_op = 'INSERT' and v_parent.state <> 'final' then
    raise exception 'schedule_part: time is added to a final schedule only';
  end if;
  v_suffix := ' · ' || btrim(new.part_label);
  new.name := left(btrim(v_parent.name), 120 - length(v_suffix)) || v_suffix;
  return new;
end;
$$;

drop trigger if exists club_schedules_part_check on public.club_schedules;
create trigger club_schedules_part_check
  before insert or update on public.club_schedules
  for each row execute function public.club_schedules_part_check();

create or replace function public.club_schedules_part_names()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The part's BEFORE trigger writes the name; touching the row is enough.
  update club_schedules set name = name where part_of_schedule_id = new.id;
  return null;
end;
$$;

drop trigger if exists club_schedules_part_names on public.club_schedules;
create trigger club_schedules_part_names
  after update of name on public.club_schedules
  for each row when (new.part_of_schedule_id is null and new.name is distinct from old.name)
  execute function public.club_schedules_part_names();

-- ── 4. A slot knows its family; the place is taken once per family ───────────────────────────────────────────────────

alter table public.club_schedule_slots add column if not exists family_id uuid;

create or replace function public.club_schedule_slots_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid;
begin
  select coalesce(s.part_of_schedule_id, s.id) into v_family
    from club_schedules s where s.id = new.schedule_id and s.org_id = new.org_id;
  if not found then
    raise exception 'slot_owner: the schedule is not this club''s';
  end if;
  new.family_id := v_family;
  if not exists (select 1 from org_venues where id = new.org_venue_id and org_id = new.org_id) then
    raise exception 'slot_place: the venue is not one of this club''s';
  end if;
  if new.facility_id is not null and not exists (
    select 1 from org_venue_facilities where id = new.facility_id and org_venue_id = new.org_venue_id and org_id = new.org_id
  ) then
    raise exception 'slot_place: that facility is not at the slot''s venue';
  end if;
  return new;
end;
$$;

-- Backfill: no part exists yet, so every slot's family is its own schedule. (The trigger would compute the same.)
update public.club_schedule_slots set family_id = schedule_id where family_id is null;

alter table public.club_schedule_slots alter column family_id set not null;

-- ⚠ NO foreign key on purpose: a SECOND FK from club_schedule_slots to club_schedules makes every PostgREST embed of
-- club_schedules from a slot ambiguous ("more than one relationship"), and twelve readers embed it (the slot's schedule's
-- name and state). The value is always valid without one: the trigger sets it from the slot's own schedule, a part's link
-- never changes, a schedule with a part can't be deleted (NO ACTION above), and the slots go with their schedule_id.
-- (An earlier dev apply of this file added club_schedule_slots_family_id_fkey; the drop below removes it there.)
alter table public.club_schedule_slots drop constraint if exists club_schedule_slots_family_id_fkey;

create unique index if not exists club_schedule_slots_family_place_start
  on public.club_schedule_slots (family_id, org_venue_id, coalesce(facility_id, '00000000-0000-0000-0000-000000000000'::uuid), starts_at);
drop index if exists public.club_schedule_slots_place_start;

comment on column public.club_schedule_slots.family_id is
  'The family''s first schedule: the slot''s schedule, or the schedule its part was added to. Set by club_schedule_slots_check; keys the place-and-start uniqueness (club_schedule_slots_family_place_start), so a part never holds its parent''s place at the same start.';

-- ── 5. No team twice, across the family ──────────────────────────────────────────────────────────────────────────────

create or replace function public.club_schedule_assert_no_team_twice(p_schedule uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid;
  v_team   text;
  v_at     timestamptz;
begin
  select coalesce(part_of_schedule_id, id) into v_family from club_schedules where id = p_schedule;
  if v_family is null then
    return;
  end if;
  -- One save in the family at a time: the first row is the family's lock.
  perform 1 from club_schedules where id = v_family for update;

  select t.name, a.starts_at into v_team, v_at
    from club_schedule_slot_teams at1
    join club_schedule_slots a on a.id = at1.slot_id
    join club_schedule_slot_teams at2 on at2.team_id = at1.team_id and at2.slot_id <> at1.slot_id
    join club_schedule_slots b on b.id = at2.slot_id
    join rep_teams t on t.id = at1.team_id
   where a.family_id = v_family and b.family_id = v_family
     and a.removed_at is null and b.removed_at is null
     and a.starts_at < b.ends_at and b.starts_at < a.ends_at
   limit 1;
  if found then
    raise exception 'team_twice: % holds two slots at once (%)', v_team, v_at;
  end if;
end;
$$;

-- Server-only, as every club_schedule* function (326 §14).
revoke all on function public.club_schedules_part_check() from public, anon, authenticated;
revoke all on function public.club_schedules_part_names() from public, anon, authenticated;
revoke all on function public.club_schedule_slots_check() from public, anon, authenticated;
revoke all on function public.club_schedule_assert_no_team_twice(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
