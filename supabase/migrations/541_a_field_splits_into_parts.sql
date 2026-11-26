-- 541 — A field splits into parts (Club schedules Stage 2, Session 2A).
--
-- Plan of record: docs/projects/active/SCHEDULE_FIELDS_SAME_TIME_TRADES_PLAN.md §5 (shape (B) and the /dba re-pass,
-- Finding #55 in docs/agents/db/DB_ARCHITECTURE_REVIEW.md). Owner rulings 2026-11-25: round 1 Asks 1 A, 4 B, 14 C;
-- round 2 Asks 1 A, 2 A, 7 A; and (this session) the split lock counts only bookings still to come.
--
-- WHAT IT ADDS
--   org_venue_facilities.sections   1 (not split), 2 (two sides) or 4 (four quarters).
--   <five tables>.section_mask      which ground a row names, ALWAYS in quarter units: 1 = quarter A, 2 = B, 4 = C,
--                                   8 = D; 3 = A+B (side A of a two-sided field = quarters A–B of a quartered one),
--                                   12 = C+D. 0 = the whole field (never 15). Legal per `sections`:
--                                   1 → {0}; 2 → {0, 3, 12}; 4 → {0, 1, 2, 4, 8, 3, 12}. B–C (6) is never legal.
--   section_range(mask)             the mask as a run of quarters, so the floor can be an exclusion constraint.
--   The floor                        club_schedule_slots_family_place_start (equal start) becomes
--                                   club_schedule_slots_family_place_overlap (overlapping time AND overlapping ground).
--
-- TWO CHOICES THE CODE MADE, NOT THE PLAN (said out loud in the session, recorded in §5):
--   (1) The constraint ignores removed rows (WHERE removed_at IS NULL). club_schedule_save (mig 494) keeps a moved
--       slot's old row on a FINAL schedule, removed, until Send the changes deletes it; counting it would refuse every
--       move that overlaps its old time until the club sends. Today's equal-start index never met that case (an equal
--       start revives the old row).
--   (2) The constraint is DEFERRABLE INITIALLY DEFERRED. The save inserts a moved slot's new row BEFORE it removes or
--       deletes the old one, and extends ends_at row by row, so a legal end state passes through overlapping middle
--       states. Every writer is one RPC = one transaction, so the check at commit still answers the caller.
--   The plan's "ends_at > starts_at CHECK first" already exists (club_schedule_slots_window); nothing is added.
--   The split lock counts bookings still to come only (owner 2026-11-25): a past practice on side A never locks
--   the field for good.
--
-- Grants and RLS unchanged: no new table; the new columns inherit each table's table-level grants.

begin;

-- ── 1. A field's split ──────────────────────────────────────────────────────────────────────────────

alter table public.org_venue_facilities add column if not exists sections smallint not null default 1;
alter table public.org_venue_facilities drop constraint if exists org_venue_facilities_sections_valid;
alter table public.org_venue_facilities add constraint org_venue_facilities_sections_valid check (sections in (1, 2, 4));

comment on column public.org_venue_facilities.sections is
  'How the field splits (Club schedules Stage 2): 1 = not split, 2 = two sides, 4 = four quarters. A booking names its ground with section_mask in quarter units. Locked while any booking still to come names a part (org_venue_facilities_split_lock).';

-- ── 2. Which ground a row names ─────────────────────────────────────────────────────────────────────

alter table public.club_schedule_slots       add column if not exists section_mask smallint not null default 0;
alter table public.org_time_block_facilities add column if not exists section_mask smallint not null default 0;
alter table public.rep_team_events           add column if not exists section_mask smallint not null default 0;
alter table public.league_practices          add column if not exists section_mask smallint not null default 0;
alter table public.league_games              add column if not exists section_mask smallint not null default 0;

alter table public.club_schedule_slots       drop constraint if exists club_schedule_slots_section_mask_valid;
alter table public.org_time_block_facilities drop constraint if exists org_time_block_facilities_section_mask_valid;
alter table public.rep_team_events           drop constraint if exists rep_team_events_section_mask_valid;
alter table public.league_practices          drop constraint if exists league_practices_section_mask_valid;
alter table public.league_games              drop constraint if exists league_games_section_mask_valid;

alter table public.club_schedule_slots add constraint club_schedule_slots_section_mask_valid
  check (section_mask in (0, 1, 2, 3, 4, 8, 12) and (section_mask = 0 or facility_id is not null));
alter table public.org_time_block_facilities add constraint org_time_block_facilities_section_mask_valid
  check (section_mask in (0, 1, 2, 3, 4, 8, 12));
alter table public.rep_team_events add constraint rep_team_events_section_mask_valid
  check (section_mask in (0, 1, 2, 3, 4, 8, 12) and (section_mask = 0 or org_venue_facility_id is not null));
alter table public.league_practices add constraint league_practices_section_mask_valid
  check (section_mask in (0, 1, 2, 3, 4, 8, 12) and (section_mask = 0 or org_venue_facility_id is not null));
alter table public.league_games add constraint league_games_section_mask_valid
  check (section_mask in (0, 1, 2, 3, 4, 8, 12) and (section_mask = 0 or org_venue_facility_id is not null));

comment on column public.club_schedule_slots.section_mask is
  'The ground the slot holds, in quarter units (1 A, 2 B, 4 C, 8 D; 3 = A–B, 12 = C–D); 0 = the whole field. Words come from (mask, the field''s sections) at read time (lib/field-parts.ts); nothing stored holds a word.';
comment on column public.org_time_block_facilities.section_mask is
  'On a SCHEDULE''s row of time: the part of the field it holds (quarter units, 0 = whole). Always 0 on a permit''s block (a permit holds whole fields). Part of the primary key.';
comment on column public.rep_team_events.section_mask is
  'The part of org_venue_facility_id the event is on (quarter units, 0 = whole), copied from its club slot beside the field.';
comment on column public.league_practices.section_mask is
  'The part of org_venue_facility_id the practice is on (quarter units, 0 = whole), copied from its club slot. House league never splits a field itself: a hand edit writes 0.';
comment on column public.league_games.section_mask is
  'The part of org_venue_facility_id the game is on (quarter units, 0 = whole), copied from its club slot through league_slot_uses. A hand edit writes 0.';

-- ── 3. The helpers the floor and the triggers read ──────────────────────────────────────────────────

create or replace function public.section_range(p_mask smallint)
returns int4range
language sql
immutable
parallel safe
as $$
  -- Every legal mask is a run of neighbouring quarters, so a range stands in for the bits. An unknown mask is the
  -- whole field (safe: it overlaps everything); the CHECK keeps one from being stored.
  select case p_mask
    when 1  then int4range(0, 1)
    when 2  then int4range(1, 2)
    when 4  then int4range(2, 3)
    when 8  then int4range(3, 4)
    when 3  then int4range(0, 2)
    when 12 then int4range(2, 4)
    else int4range(0, 4)
  end
$$;

create or replace function public.section_mask_legal(p_mask smallint, p_sections smallint)
returns boolean
language sql
immutable
parallel safe
as $$
  select case p_sections
    when 1 then p_mask = 0
    when 2 then p_mask in (0, 3, 12)
    when 4 then p_mask in (0, 1, 2, 4, 8, 3, 12)
    else p_mask = 0
  end
$$;

comment on function public.section_range(smallint) is
  'A section_mask as a run of quarters ([0,4) = the whole field). IMMUTABLE: club_schedule_slots_family_place_overlap reads it. Mirrored by lib/field-parts.ts.';
comment on function public.section_mask_legal(smallint, smallint) is
  'Is this mask one of the parts a field split this way offers? Mirrored by lib/field-parts.ts (legalMasks).';

-- ── 4. The floor: overlapping ground at overlapping times in one family ─────────────────────────────

drop index if exists public.club_schedule_slots_family_place_start;
alter table public.club_schedule_slots drop constraint if exists club_schedule_slots_family_place_overlap;
alter table public.club_schedule_slots add constraint club_schedule_slots_family_place_overlap
  exclude using gist (
    family_id with =,
    org_venue_id with =,
    (coalesce(facility_id, '00000000-0000-0000-0000-000000000000'::uuid)) with =,
    (public.section_range(section_mask)) with &&,
    (tstzrange(starts_at, ends_at, '[)')) with &&
  )
  where (removed_at is null)
  deferrable initially deferred;

comment on constraint club_schedule_slots_family_place_overlap on public.club_schedule_slots is
  'Club schedules Stage 2 (mig 541): two live slots of one schedule family never hold overlapping ground (a whole field and its part, quarter A and quarters A–B) at overlapping times. Removed rows are ignored (a final schedule keeps them until Send the changes). Deferred to commit because the save inserts a moved slot before it removes the old one. Raises 23P01; lib/club-schedule-server.ts floorRefusal says it as "changed".';

-- ── 5. A part must be one of its field's parts ──────────────────────────────────────────────────────
-- One function for the five tables; TG_ARGV[0] names the table's facility column.

create or replace function public.section_mask_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fac uuid;
  v_sections smallint;
begin
  v_fac := nullif(to_jsonb(new) ->> tg_argv[0], '')::uuid;
  if v_fac is null then
    -- The field went (ON DELETE SET NULL on rep events and house-league rows, or a hand edit clearing it): its part
    -- goes with it. An INSERT naming a part with no field is left to the CHECK, which refuses it.
    if tg_op = 'UPDATE' and new.section_mask <> 0 and (to_jsonb(old) ->> tg_argv[0]) is not null then
      new.section_mask := 0;
    end if;
    return new;
  end if;
  if new.section_mask = 0 then
    return new;
  end if;
  -- FOR SHARE (/dba 2026-11-25): a split change racing this booking waits for it, then its lock check sees it.
  select sections into v_sections from org_venue_facilities where id = v_fac for share;
  if v_sections is null or not public.section_mask_legal(new.section_mask, v_sections) then
    raise exception 'part_illegal: that part is not one of the field''s parts' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists club_schedule_slots_section_mask_check on public.club_schedule_slots;
create trigger club_schedule_slots_section_mask_check
  before insert or update of section_mask, facility_id on public.club_schedule_slots
  for each row execute function public.section_mask_check('facility_id');

drop trigger if exists org_time_block_facilities_section_mask_check on public.org_time_block_facilities;
create trigger org_time_block_facilities_section_mask_check
  before insert or update of section_mask, facility_id on public.org_time_block_facilities
  for each row execute function public.section_mask_check('facility_id');

drop trigger if exists rep_team_events_section_mask_check on public.rep_team_events;
create trigger rep_team_events_section_mask_check
  before insert or update of section_mask, org_venue_facility_id on public.rep_team_events
  for each row execute function public.section_mask_check('org_venue_facility_id');

drop trigger if exists league_practices_section_mask_check on public.league_practices;
create trigger league_practices_section_mask_check
  before insert or update of section_mask, org_venue_facility_id on public.league_practices
  for each row execute function public.section_mask_check('org_venue_facility_id');

drop trigger if exists league_games_section_mask_check on public.league_games;
create trigger league_games_section_mask_check
  before insert or update of section_mask, org_venue_facility_id on public.league_games
  for each row execute function public.section_mask_check('org_venue_facility_id');

-- ── 6. A schedule's row of time: parts never on a permit, never overlapping in one block ────────────

alter table public.org_time_block_facilities drop constraint if exists org_time_block_facilities_pkey;
alter table public.org_time_block_facilities add constraint org_time_block_facilities_pkey
  primary key (block_id, facility_id, section_mask);

create or replace function public.org_time_block_facilities_part_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.section_mask <> 0 and exists (
    select 1 from org_time_blocks b where b.id = new.block_id and b.permit_id is not null
  ) then
    raise exception 'part_on_permit: a permit holds whole fields' using errcode = '23514';
  end if;
  -- One block names a field once: whole, or parts that do not overlap (A and C–D, never A beside A–B or the whole).
  if exists (
    select 1 from org_time_block_facilities x
     where x.block_id = new.block_id and x.facility_id = new.facility_id and x.section_mask <> new.section_mask
       and (x.section_mask = 0 or new.section_mask = 0 or (x.section_mask & new.section_mask) <> 0)
       and not (tg_op = 'UPDATE' and x.facility_id = old.facility_id and x.section_mask = old.section_mask
                and x.block_id = old.block_id)
  ) then
    raise exception 'part_overlap: a row of time names that ground twice' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists org_time_block_facilities_part_check on public.org_time_block_facilities;
create trigger org_time_block_facilities_part_check
  before insert or update on public.org_time_block_facilities
  for each row execute function public.org_time_block_facilities_part_check();

-- ── 7. The split lock (round 2 Ask 7 A; owner 2026-11-25: bookings still to come) ───────────────────

create or replace function public.org_venue_facility_parts_booked(p_facility uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from club_schedule_slots s
                  where s.facility_id = p_facility and s.section_mask <> 0
                    and s.removed_at is null and s.ends_at > now())
      or exists (select 1 from org_time_block_facilities bf
                   join org_time_blocks b on b.id = bf.block_id
                   join club_schedules c on c.id = b.schedule_id
                  where bf.facility_id = p_facility and bf.section_mask <> 0 and c.ends_on >= current_date)
      or exists (select 1 from rep_team_events e
                  where e.org_venue_facility_id = p_facility and e.section_mask <> 0
                    and e.status <> 'cancelled' and coalesce(e.ends_at, e.starts_at) > now())
      or exists (select 1 from league_practices p
                  where p.org_venue_facility_id = p_facility and p.section_mask <> 0
                    and p.status <> 'cancelled' and coalesce(p.ends_at, p.scheduled_at, 'infinity'::timestamptz) > now())
      or exists (select 1 from league_games g
                  where g.org_venue_facility_id = p_facility and g.section_mask <> 0
                    and g.status <> 'cancelled' and coalesce(g.ends_at, g.scheduled_at, 'infinity'::timestamptz) > now())
$$;

comment on function public.org_venue_facility_parts_booked(uuid) is
  'Does any booking still to come name a part of this field? (a live slot not yet ended, a schedule not yet over, an uncancelled rep event or house-league row not yet ended). The split lock reads it; the venue library route reads it first to say so in words.';

create or replace function public.org_venue_facilities_split_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sections is distinct from old.sections and public.org_venue_facility_parts_booked(old.id) then
    raise exception 'split_locked: a part of this field is booked' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists org_venue_facilities_split_lock on public.org_venue_facilities;
create trigger org_venue_facilities_split_lock
  before update of sections on public.org_venue_facilities
  for each row execute function public.org_venue_facilities_split_lock();

-- ── 8. Who may call ─────────────────────────────────────────────────────────────────────────────────

revoke all on function public.section_mask_check() from public, anon, authenticated;
revoke all on function public.org_time_block_facilities_part_check() from public, anon, authenticated;
revoke all on function public.org_venue_facilities_split_lock() from public, anon, authenticated;
revoke all on function public.org_venue_facility_parts_booked(uuid) from public, anon, authenticated;
grant execute on function public.org_venue_facility_parts_booked(uuid) to service_role;
-- section_range / section_mask_legal are pure (no table read) and stay callable: the constraint needs them for
-- every role that writes club_schedule_slots.

commit;

-- Verify (dev, then prod):
--   select count(*) from information_schema.columns where column_name = 'section_mask' and table_name in
--     ('club_schedule_slots','org_time_block_facilities','rep_team_events','league_practices','league_games'); -- 5
--   select count(*) from information_schema.columns where table_name = 'org_venue_facilities' and column_name = 'sections'; -- 1
--   select count(*) from pg_constraint where conname = 'club_schedule_slots_family_place_overlap' and contype = 'x'; -- 1
--   select count(*) from pg_indexes where indexname = 'club_schedule_slots_family_place_start';                      -- 0
-- Proof (rolled back): node scripts/db-query.mjs --dev -f scripts/schedule-parts-floor-check.sql
