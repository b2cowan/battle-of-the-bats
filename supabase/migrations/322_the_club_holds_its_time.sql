-- 322 — The time the club holds: permits, their blocks, and where a permit's document is kept
-- (Club Tier Stage 10a — owner ratification 2026-10-11, Asks 1, 2, 3, 7, 21 as recommended; plan:
--  docs/projects/active/CLUB_PERMITS_AND_SCHEDULER_PLAN.md §5.1–§5.2, §6; hub K4MPu4ni53Ct7yrDcmWJd9 → Stages 10 + 11)
--
-- ONE MODEL OF THE CLUB'S TIME (Stage 11 Ask 2, ruled 2026-10-08). A BLOCK is one weekly stretch at one place: a club
-- venue, one or several of its facilities (or every facility there), the days of the week, a start and an end on the
-- club's clock, and a date range. A PERMIT is a set of blocks the club holds, with its own dates off and a price for
-- each field. Stage 11a's schedule is the block's SECOND owner: it adds `org_time_blocks.schedule_id` and a one-owner
-- CHECK in its own migration, and never a second slot model (the one-model guard, tests/unit/club-permits-guard).
--
--   org_permits                 the club's record of time it holds (a town's diamond permit, a dome's contract). It may
--                               cover several venues, so it is the club's, never one venue's child (Ask 1).
--   org_time_blocks             its weekly blocks. Owner: the permit (11a adds the schedule).
--   org_time_block_facilities   the facilities a block covers. NO ROWS = EVERY facility at the venue, read at the time
--                               (a venue with no facilities is the one place the block holds).
--   org_permit_facility_shares  what each field costs in this permit (Ask 21): a share of a full field's price, 1 = Full,
--                               0.5 = Half, or a typed share. NO ROW = Full. The prices are the PERMIT'S, never the
--                               venue's (next winter's contract may price the same fields differently).
--   org_time_dates_off          a permit's dates with no time held, an optional note ("the dome is closed").
--   org_venues.bookings_email   the venue's booking office (Ask 7) — 10a stores it; 11a's send uses it.
--   the `org-permit-documents`  bucket: the issuer's PDF, private, made HERE (mig 087's pattern), never in the dashboard —
--                               `rep-team-documents` was made by hand (022's header says so), and a bucket that exists on
--                               one database and not the other is drift.
--
-- ⚖ THE FISCAL YEAR IS A RULE, NOT A COLUMN (Ask 2; a departure from the build prompt's column list, recorded in the plan
-- §6 Ask 2). A permit is filed under the fiscal year it STARTS in — `fiscalYearOf(starts_on)` wherever it is read — and
-- never pinned to an `org_fiscal_years` row: a change of first month and the first close delete and re-span those rows
-- (mig 318), so a stored link would either block them or lose the permit. What the year governs is checked here, at
-- every save: a named budget line must be a line of the year the permit starts in; and a closed year locks the permit's
-- MONEY (cost and budget line), never its time (`year_closed`, the money tables' word).
--
-- ⚖ SERVER-ONLY (mig 318's shape: RLS on, no policies, nothing to anon/authenticated). A permit carries money, and every
-- read passes through a route that checks the reader (`app/api/admin/org/permits` — its time to every Venue-library
-- reader, its money to those who hold the club's Accounting; owner 2026-10-11, plan §6 Ask 1). The venue's new column
-- follows mig 321 (members read the table, the server writes it).
--
-- Order: the 10a code reads these tables; apply before (or with) the 10a promote. Additive: no existing row changes.

begin;

-- ── 1. A venue's booking office (Ask 7) ────────────────────────────────────────────────────────────────

alter table public.org_venues
  add column if not exists bookings_email text;

alter table public.org_venues drop constraint if exists org_venues_bookings_email_shape;
alter table public.org_venues add constraint org_venues_bookings_email_shape check (
  bookings_email is null
  or (length(bookings_email) <= 254 and bookings_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

comment on column public.org_venues.bookings_email is
  'The venue''s booking office (Club Tier Stage 10a, Ask 7): one email, optional, validated. Read and edited on the venue''s window in the Venue library (the pencil). Stage 11a''s schedule send offers it as a recipient (the whole schedule by facility). Never shown to a coach.';

-- ── 2. The permit ─────────────────────────────────────────────────────────────────────────────────────

create table if not exists public.org_permits (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  name               text not null check (length(btrim(name)) between 1 and 120),
  -- The issuer: one of the club's payees (the Ledger's list, so "Town of Milton" is one name in both), or a name typed
  -- once (`issuer_name` alone — the Ledger's one-time payer shape). The name is kept beside the link as the payee's name
  -- when it was picked; a read prints the payee's CURRENT name while the link stands.
  issuer_payee_id    uuid references public.org_payees(id) on delete set null,
  issuer_name        text check (issuer_name is null or length(issuer_name) <= 200),
  reference          text check (reference is null or length(reference) <= 80),
  -- For whom the club holds it (the drawing's choices). `team` names one rep team.
  held_for           text not null default 'club' check (held_for in ('club', 'rep', 'league', 'team')),
  held_for_team_id   uuid references public.rep_teams(id) on delete set null,
  starts_on          date not null,
  ends_on            date not null,
  cost               numeric(12,2) check (cost is null or cost >= 0),
  budget_line_id     uuid references public.org_budget_lines(id) on delete set null,
  -- The issuer's document in the private bucket (path never sent to a browser; read by a one-hour signed link).
  document_path      text,
  document_name      text check (document_name is null or length(document_name) <= 200),
  document_size      integer check (document_size is null or document_size between 0 and 10485760),
  document_type      text check (document_type is null or document_type in ('application/pdf', 'image/jpeg', 'image/png')),
  document_added_at  timestamptz,
  notes              text check (notes is null or length(notes) <= 2000),
  renewed_from_id    uuid references public.org_permits(id) on delete set null,
  created_by         uuid references auth.users(id) on delete set null,
  updated_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint org_permits_dates check (ends_on >= starts_on and ends_on <= starts_on + 1096),
  constraint org_permits_team_only_for_a_team check (held_for = 'team' or held_for_team_id is null),
  constraint org_permits_document_whole check (
    (document_path is null) = (document_name is null)
    and (document_path is null) = (document_size is null)
    and (document_path is null) = (document_added_at is null)
  )
);

create index if not exists org_permits_org_dates_idx on public.org_permits (org_id, starts_on, ends_on);
create index if not exists org_permits_budget_line_idx on public.org_permits (budget_line_id) where budget_line_id is not null;
create index if not exists org_permits_issuer_idx on public.org_permits (issuer_payee_id) where issuer_payee_id is not null;
create index if not exists org_permits_team_idx on public.org_permits (held_for_team_id) where held_for_team_id is not null;
create index if not exists org_permits_renewed_from_idx on public.org_permits (renewed_from_id) where renewed_from_id is not null;
create index if not exists org_permits_created_by_idx on public.org_permits (created_by) where created_by is not null;
create index if not exists org_permits_updated_by_idx on public.org_permits (updated_by) where updated_by is not null;

comment on table public.org_permits is
  'The time a club holds (Club Tier Stage 10a; plan CLUB_PERMITS_AND_SCHEDULER_PLAN.md): a town''s diamond permit, a dome''s winter contract. The club''s record, never a venue''s child — one permit may cover several venues (its blocks, org_time_blocks). Listed in the Venue library''s Permits view, by the fiscal year it STARTS in (a rule over starts_on, never a stored link — mig 322''s header). Server-only: its time reads to every Venue-library reader, its money (cost, the budget line) only to those who hold the club''s Accounting (the route''s rule).';
comment on column public.org_permits.held_for is
  '"For" (the drawing''s choices): club · rep (rep teams) · league (house league) · team (one rep team, held_for_team_id). Informational in 10a — the quiet line and the use read every booking at the venue, whoever made it.';
comment on column public.org_permits.cost is
  'What the club pays the issuer for the whole permit, dollars, or null (not entered). An hour of a full field = cost ÷ Σ(held hours × the field''s share) (lib/permit-time.ts). Locked with the fiscal year the permit starts in (org_permits_check: year_closed).';
comment on column public.org_permits.budget_line_id is
  'The club budget line that pays for it (Ask 8a) — a line of the fiscal year the permit STARTS in (checked at every save: permit_line_year). The line''s window lists it under "Pays for". Set null when the line is removed. Locked with the year, as cost.';
comment on column public.org_permits.document_path is
  'The issuer''s document in the private org-permit-documents bucket: `${org_id}/permits/${permit_id}/${uuid}-${name}`. Never sent to a browser; read by a one-hour signed URL from the route. Replaced by a new upload (the old file is removed).';
comment on column public.org_permits.renewed_from_id is
  'The permit this one was renewed from ("Renew for next year": the same blocks, facilities, prices and issuer a year on — no reference, document, cost or dates off).';

-- ── 3. Its blocks — the one model of the club's time ───────────────────────────────────────────────────

create table if not exists public.org_time_blocks (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  -- The owner. Stage 11a adds `schedule_id` and a one-owner CHECK; until then every block is a permit's.
  permit_id     uuid not null references public.org_permits(id) on delete cascade,
  -- A venue a block holds can be archived, never deleted (the Venue library refuses with words; this is the floor).
  -- NO ACTION, not RESTRICT: checked at the end of the statement, so the club's own removal still cascades (/review 10a).
  org_venue_id  uuid not null references public.org_venues(id),
  -- Monday first, as the club calendar counts them: 1 = Monday … 7 = Sunday (ISO).
  weekdays      smallint[] not null,
  -- A wall clock on the club's clock (lib/timezone.ts ORG_TIME_ZONE): the instants are worked out per date, daylight
  -- saving included. A block never crosses midnight.
  start_time    time not null,
  end_time      time not null,
  -- Inside the owner's dates; NULL = the owner's own dates (so a permit's change of dates carries its blocks with it).
  from_date     date,
  until_date    date,
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint org_time_blocks_weekdays check (
    cardinality(weekdays) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]
  ),
  constraint org_time_blocks_hours check (end_time > start_time),
  constraint org_time_blocks_dates check (from_date is null or until_date is null or until_date >= from_date)
);

create index if not exists org_time_blocks_permit_idx on public.org_time_blocks (permit_id);
create index if not exists org_time_blocks_venue_idx on public.org_time_blocks (org_id, org_venue_id);
create index if not exists org_time_blocks_venue_fk_idx on public.org_time_blocks (org_venue_id);

comment on table public.org_time_blocks is
  'ONE MODEL OF THE CLUB''S TIME (Club Tier Stage 11 Ask 2; built in 10a): a weekly stretch at one club venue — its facilities (org_time_block_facilities; none listed = every facility there), weekdays (1 = Monday … 7 = Sunday), a start and an end on the club''s clock, a date range (null = the owner''s). Owned by a permit; Stage 11a adds the schedule as the second owner with a one-owner CHECK. No second table ever holds the club''s time (tests/unit/club-permits-guard.test.ts).';

create table if not exists public.org_time_block_facilities (
  block_id     uuid not null references public.org_time_blocks(id) on delete cascade,
  facility_id  uuid not null references public.org_venue_facilities(id),  -- NO ACTION, as the block's venue
  org_id       uuid not null references public.organizations(id) on delete cascade,
  primary key (block_id, facility_id)
);

create index if not exists org_time_block_facilities_facility_idx on public.org_time_block_facilities (facility_id);
create index if not exists org_time_block_facilities_org_idx on public.org_time_block_facilities (org_id);

comment on table public.org_time_block_facilities is
  'The facilities one block covers ("Fields 1–6", Ask 21). NO ROWS = every facility at the block''s venue, read at the time. A facility a block names can be renamed, never removed (the Venue library refuses with words; RESTRICT is the floor).';

-- ── 4. What each field costs in this permit (Ask 21) ───────────────────────────────────────────────────

create table if not exists public.org_permit_facility_shares (
  permit_id    uuid not null references public.org_permits(id) on delete cascade,
  facility_id  uuid not null references public.org_venue_facilities(id) on delete cascade,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  -- A share of a full field's price: 0.5 = Half, a typed share otherwise. 1 (Full) is never stored — no row = Full.
  share        numeric(6,4) not null check (share > 0 and share < 1),
  primary key (permit_id, facility_id)
);

create index if not exists org_permit_facility_shares_facility_idx on public.org_permit_facility_shares (facility_id);
create index if not exists org_permit_facility_shares_org_idx on public.org_permit_facility_shares (org_id);

comment on table public.org_permit_facility_shares is
  'A field''s price in one permit (Club Tier Stage 10a, Ask 21): its share of a full field''s price (0.5 = Half). No row = Full. The permit works out an hour of each: cost ÷ Σ(held hours × share) is a full field''s hour, × share a field''s. The dome''s check (a unit test): Fields 1–4 full + 5–6 half, 25 Sundays × 3 h, $27,000.00 → $72.00 a full field, $36.00 a half.';

-- ── 5. A permit's dates off ────────────────────────────────────────────────────────────────────────────

create table if not exists public.org_time_dates_off (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  -- The owner (11a adds the schedule, as on org_time_blocks).
  permit_id  uuid not null references public.org_permits(id) on delete cascade,
  day        date not null,
  note       text check (note is null or length(note) <= 120),
  constraint org_time_dates_off_once unique (permit_id, day)
);

create index if not exists org_time_dates_off_org_idx on public.org_time_dates_off (org_id);

comment on table public.org_time_dates_off is
  'A permit''s dates with no time held (a holiday, "the dome is closed"), with an optional note. A booking on a date off is outside the permit, and the quiet line names the date. Renew does not carry them (a holiday moves).';

-- ── 6. The floor under every save ──────────────────────────────────────────────────────────────────────

create or replace function public.org_permits_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := case when tg_op = 'DELETE' then old.org_id else new.org_id end;
  v_line_moved boolean := tg_op = 'INSERT';
  v_through date;
  v_old_locked boolean := false;
  v_new_locked boolean;
begin
  -- A close (mig 318) takes this lock exclusively: a permit's money never changes under a closing year.
  perform pg_advisory_xact_lock_shared(hashtextextended('club_books:' || v_org::text, 0));

  -- A permit carrying money in the closed stretch stays: deleting it would take that money out of a closed year
  -- (/review 10a). The club's own removal still cascades (mig 318's org_budget_lines rule).
  if tg_op = 'DELETE' then
    v_through := club_books_closed_through(old.org_id);
    if v_through is not null and old.starts_on <= v_through
       and (old.cost is not null or old.budget_line_id is not null)
       and exists (select 1 from organizations where id = old.org_id) then
      raise exception 'year_closed: the permit "%" carries money in a closed fiscal year', old.name;
    end if;
    return old;
  end if;

  if new.issuer_payee_id is not null
     and not exists (select 1 from org_payees where id = new.issuer_payee_id and org_id = new.org_id) then
    raise exception 'permit_issuer: the issuer is not one of this club''s payees';
  end if;
  if new.held_for_team_id is not null
     and not exists (select 1 from rep_teams where id = new.held_for_team_id and org_id = new.org_id) then
    raise exception 'permit_team: that team is not this club''s';
  end if;
  -- The budget line is a line of the fiscal year the permit STARTS in (Ask 2) — asked when the line or the start moves,
  -- never of a save that touches neither (a document, a name: the saver may not hold Accounting to fix it) (/review 10a).
  if tg_op = 'UPDATE' then
    v_line_moved := new.budget_line_id is distinct from old.budget_line_id or new.starts_on is distinct from old.starts_on;
  end if;
  if v_line_moved and new.budget_line_id is not null and not exists (
    select 1 from org_budget_lines b join org_fiscal_years y on y.id = b.fiscal_year_id
     where b.id = new.budget_line_id and b.org_id = new.org_id
       and new.starts_on between y.first_day and y.last_day
  ) then
    raise exception 'permit_line_year: the budget line is not a line of the fiscal year the permit starts in';
  end if;

  -- ⚖ A CLOSED YEAR LOCKS A PERMIT'S MONEY, NEVER ITS TIME.
  v_through := club_books_closed_through(new.org_id);
  if v_through is null then return new; end if;
  v_new_locked := new.starts_on <= v_through;
  if tg_op = 'INSERT' then
    if v_new_locked and (new.cost is not null or new.budget_line_id is not null) then
      raise exception 'year_closed: the permit "%" starts in a closed fiscal year', new.name;
    end if;
    return new;
  end if;
  v_old_locked := old.starts_on <= v_through;
  if (v_old_locked or v_new_locked)
     and (new.cost is distinct from old.cost or new.budget_line_id is distinct from old.budget_line_id) then
    raise exception 'year_closed: the permit "%" starts in a closed fiscal year', old.name;
  end if;
  -- Moving the start across the closed line would move its money between a closed year and an open one.
  if v_old_locked <> v_new_locked and (old.cost is not null or old.budget_line_id is not null) then
    raise exception 'year_closed: the permit "%" carries money in a closed fiscal year', old.name;
  end if;
  return new;
end;
$$;

drop trigger if exists org_permits_check on public.org_permits;
create trigger org_permits_check
  before insert or update or delete on public.org_permits
  for each row execute function public.org_permits_check();

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
  if not exists (select 1 from org_permits where id = new.permit_id and org_id = new.org_id) then
    raise exception 'block_owner: the permit is not this club''s';
  end if;
  -- A block that moves to another venue leaves its old venue's facilities behind.
  if tg_op = 'UPDATE' and new.org_venue_id <> old.org_venue_id then
    delete from org_time_block_facilities where block_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists org_time_blocks_check on public.org_time_blocks;
create trigger org_time_blocks_check
  before insert or update on public.org_time_blocks
  for each row execute function public.org_time_blocks_check();

create or replace function public.org_time_block_facilities_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from org_time_blocks b join org_venue_facilities f on f.org_venue_id = b.org_venue_id
     where b.id = new.block_id and f.id = new.facility_id and b.org_id = new.org_id and f.org_id = new.org_id
  ) then
    raise exception 'block_facility: that facility is not at the block''s venue';
  end if;
  return new;
end;
$$;

drop trigger if exists org_time_block_facilities_check on public.org_time_block_facilities;
create trigger org_time_block_facilities_check
  before insert or update on public.org_time_block_facilities
  for each row execute function public.org_time_block_facilities_check();

create or replace function public.org_permit_facility_shares_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from org_venue_facilities where id = new.facility_id and org_id = new.org_id)
     or not exists (select 1 from org_permits where id = new.permit_id and org_id = new.org_id) then
    raise exception 'permit_share: the facility or the permit is not this club''s';
  end if;
  return new;
end;
$$;

drop trigger if exists org_permit_facility_shares_check on public.org_permit_facility_shares;
create trigger org_permit_facility_shares_check
  before insert or update on public.org_permit_facility_shares
  for each row execute function public.org_permit_facility_shares_check();

create or replace function public.org_time_dates_off_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from org_permits where id = new.permit_id and org_id = new.org_id) then
    raise exception 'date_off_owner: the permit is not this club''s';
  end if;
  return new;
end;
$$;

drop trigger if exists org_time_dates_off_check on public.org_time_dates_off;
create trigger org_time_dates_off_check
  before insert or update on public.org_time_dates_off
  for each row execute function public.org_time_dates_off_check();

-- ── 7. One save, one step (Add permit asks; the window's pencil autosaves the WHOLE record) ──────────────
-- `p_permit` null adds; otherwise the record is replaced whole: the permit's fields, its blocks (kept by id, so a
-- block keeps its id across saves), each block's facilities, the field prices and the dates off — in one transaction,
-- so a refused save (a facility not at the venue, a line of another year, a closed year) changes nothing. The route
-- validates and words every refusal first; the triggers above are the floor. Returns the permit's id.
-- The document is written by its own upload route (`document_*` are never in `p_data`).

create or replace function public.org_permit_save(p_org uuid, p_permit uuid, p_actor uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id        uuid := p_permit;
  v_block     jsonb;
  v_block_id  uuid;
  v_keep      uuid[] := '{}';
  v_i         integer := 0;
begin
  if p_permit is null then
    insert into org_permits (org_id, name, issuer_payee_id, issuer_name, reference, held_for, held_for_team_id,
                             starts_on, ends_on, cost, budget_line_id, notes, renewed_from_id, created_by, updated_by)
    values (p_org, btrim(p_data->>'name'), nullif(p_data->>'issuerPayeeId', '')::uuid, nullif(btrim(p_data->>'issuerName'), ''),
            nullif(btrim(p_data->>'reference'), ''), coalesce(nullif(p_data->>'heldFor', ''), 'club'),
            nullif(p_data->>'heldForTeamId', '')::uuid, (p_data->>'startsOn')::date, (p_data->>'endsOn')::date,
            nullif(p_data->>'cost', '')::numeric, nullif(p_data->>'budgetLineId', '')::uuid,
            nullif(btrim(p_data->>'notes'), ''), nullif(p_data->>'renewedFromId', '')::uuid, p_actor, p_actor)
    returning id into v_id;
  else
    update org_permits set
      name = btrim(p_data->>'name'),
      issuer_payee_id = nullif(p_data->>'issuerPayeeId', '')::uuid,
      issuer_name = nullif(btrim(p_data->>'issuerName'), ''),
      reference = nullif(btrim(p_data->>'reference'), ''),
      held_for = coalesce(nullif(p_data->>'heldFor', ''), 'club'),
      held_for_team_id = nullif(p_data->>'heldForTeamId', '')::uuid,
      starts_on = (p_data->>'startsOn')::date,
      ends_on = (p_data->>'endsOn')::date,
      cost = nullif(p_data->>'cost', '')::numeric,
      budget_line_id = nullif(p_data->>'budgetLineId', '')::uuid,
      notes = nullif(btrim(p_data->>'notes'), ''),
      updated_by = p_actor,
      updated_at = now()
    where id = p_permit and org_id = p_org;
    if not found then raise exception 'permit_not_found'; end if;
  end if;

  for v_block in select * from jsonb_array_elements(coalesce(p_data->'blocks', '[]'::jsonb)) loop
    v_block_id := nullif(v_block->>'id', '')::uuid;
    if v_block_id is not null and exists (select 1 from org_time_blocks where id = v_block_id and permit_id = v_id) then
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
      insert into org_time_blocks (org_id, permit_id, org_venue_id, weekdays, start_time, end_time, from_date, until_date, sort_order)
      values (p_org, v_id, (v_block->>'venueId')::uuid,
              array(select x::smallint from jsonb_array_elements_text(v_block->'weekdays') x order by 1),
              (v_block->>'startTime')::time, (v_block->>'endTime')::time,
              nullif(v_block->>'fromDate', '')::date, nullif(v_block->>'untilDate', '')::date, v_i)
      returning id into v_block_id;
    end if;
    v_keep := v_keep || v_block_id;
    delete from org_time_block_facilities where block_id = v_block_id;
    insert into org_time_block_facilities (block_id, facility_id, org_id)
      select distinct v_block_id, f::uuid, p_org from jsonb_array_elements_text(coalesce(v_block->'facilityIds', '[]'::jsonb)) f;
    v_i := v_i + 1;
  end loop;
  delete from org_time_blocks where permit_id = v_id and not (id = any (v_keep));

  delete from org_permit_facility_shares where permit_id = v_id;
  insert into org_permit_facility_shares (permit_id, facility_id, org_id, share)
    select distinct on ((s->>'facilityId')::uuid) v_id, (s->>'facilityId')::uuid, p_org, (s->>'share')::numeric
      from jsonb_array_elements(coalesce(p_data->'shares', '[]'::jsonb)) s
     where (s->>'share')::numeric < 1;

  delete from org_time_dates_off where permit_id = v_id;
  insert into org_time_dates_off (org_id, permit_id, day, note)
    select distinct on ((d->>'day')::date) p_org, v_id, (d->>'day')::date, nullif(btrim(d->>'note'), '')
      from jsonb_array_elements(coalesce(p_data->'datesOff', '[]'::jsonb)) d;

  return v_id;
end;
$$;

-- ── 8. The issuer's document: a private bucket, made here ───────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('org-permit-documents', 'org-permit-documents', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
-- No storage policies: the server reads and writes it with the service role (as `rep-team-documents` is used), and a
-- member's own session reaches nothing in it.

-- ── 9. Server-only (mig 311 / 318's shape) ─────────────────────────────────────────────────────────────

alter table public.org_permits enable row level security;
alter table public.org_time_blocks enable row level security;
alter table public.org_time_block_facilities enable row level security;
alter table public.org_permit_facility_shares enable row level security;
alter table public.org_time_dates_off enable row level security;

-- The venue's booking office (Ask 7) never reaches a member's own session: mig 094's read policy lets any member read
-- org_venues, so the signed-in role reads every column but this one. The product reads venues with the service role.
-- ⚠ A NEW org_venues column a member's session should read joins this list (/review 10a).
revoke select on public.org_venues from anon, authenticated;
grant select (id, org_id, name, address, notes, is_active, created_at, updated_at) on public.org_venues to authenticated;

revoke all on public.org_permits, public.org_time_blocks, public.org_time_block_facilities,
              public.org_permit_facility_shares, public.org_time_dates_off from anon, authenticated;
grant select, insert, update, delete on public.org_permits, public.org_time_blocks, public.org_time_block_facilities,
                                        public.org_permit_facility_shares, public.org_time_dates_off to service_role;

revoke all on function
  public.org_permits_check(),
  public.org_time_blocks_check(),
  public.org_time_block_facilities_check(),
  public.org_permit_facility_shares_check(),
  public.org_time_dates_off_check(),
  public.org_permit_save(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.org_permit_save(uuid, uuid, uuid, jsonb) to service_role;

commit;
