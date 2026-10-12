-- 326 — The club hands out its time: schedules, their slots, the bill they carry, and the practices they write
-- (Club Tier Stage 11a, part A — the server. Owner ratification 2026-10-11, Asks 5–7, 9, 12–20, 22–27 and Stage 11
--  Asks 1–6 as recommended; build questions A and B ruled 2026-10-11. Plan:
--  docs/projects/active/CLUB_PERMITS_AND_SCHEDULER_PLAN.md §5.3–§5.9, §6; hub K4MPu4ni53Ct7yrDcmWJd9 → Stages 10 + 11)
--
-- ONE MODEL OF THE CLUB'S TIME (Stage 11 Ask 2). A schedule's time is BLOCKS — 10a's `org_time_blocks`, now with a
-- second owner: a block belongs to exactly one permit OR one schedule (`org_time_blocks_one_owner`), and so does a date
-- off. "Start from a permit" copies the permit's blocks into the schedule's own; a schedule never points at a permit's
-- block, so a permit's later edit never moves a schedule under it. There is no second block model
-- (tests/unit/club-permits-guard.test.ts, "one model of the club's time").
--
--   club_schedules              the record the club keeps (name, state, dates, settings, the bill it carries, sent / by).
--   club_schedule_slots         the time cut into slots — one row per dated slot on one facility (instants, never a
--                               weekly pattern: the pattern is the block's). Soft-removed on a FINAL schedule
--                               (`removed_at`) until Send the changes has reconciled the practices it wrote.
--   club_schedule_slot_teams    which teams have a slot — rows, so "teams at once" is rows the rules can read.
--   club_schedule_replies       a head coach's answer to a review round (Ask 24): Looks good · Ask for a change.
--   club_schedule_sends         the send log (Ask 9): every review, final and changes send, who was told, the money.
--   rep_team_events.club_schedule_slot_id
--                               a practice's link to the slot that made it. NOT a foreign key, for the mirror's reason
--                               (mig 207): a slot's removal must never take a practice the coach worked on with it — the
--                               writers below decide (cancel when worked on, delete when untouched).
--
-- ⚖ ROWS ARE WRITTEN AT FINALIZE AND CHANGED AT SEND THE CHANGES — NEVER ON READ (P11-05). The tournament mirror
-- re-diffs on every events read; copied, a club slot would reach a team (and the club calendar, the clash pool, any
-- feed) only when someone opened that team's schedule. `club_schedule_finalize` writes every practice and the bill in
-- ONE transaction — both happen or neither does — and `club_schedule_apply_changes` applies the held edits the same way.
--
-- ⚖ THE BILL RIDES WITH THE SCHEDULE AND BECOMES ONE ALLOCATION AT FINALIZE (Ask 23): no allocation row exists before
-- Finalize (the money loop has no proposed state, and a bill's terms never change — 3d Ask 7b). The split is `time`
-- ("By the time each team got"; `split_value` = the team's priced hours). Build question A (ruled 2026-10-11): a team's
-- share is filed under the club line's word only when that word is a PLATFORM word the team's running-season budget
-- already has; otherwise unfiled, as today (mig 250: filed by the coach). Build question B (ruled 2026-10-11): a team
-- that gains time after Finalize gets a correction bill at Send the changes; a team that loses time is told what it is
-- owed and gets it back through its own request — no negative allocation exists.
--
-- ⚖ SERVER-ONLY (mig 318's shape: RLS on, no policies, nothing to anon/authenticated). Every read goes through a route
-- that checks the role (an owner or an admin builds; a head coach reads only their own team's slots, bill and replies).
--
-- Order: after 318 (club_allocation_create, rep_team_live_season), 322 (the blocks) and 325. Additive except two NOT NULLs
-- relaxed (a block's and a date off's permit, now one of two owners) and one CHECK widened (split_method + `time`).

begin;

-- ── 1. The schedule ───────────────────────────────────────────────────────────────────────────────────

create table if not exists public.club_schedules (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references public.organizations(id) on delete cascade,
  name                      text not null check (length(btrim(name)) between 1 and 120),
  -- draft (nobody told) · in_review (sent for review: no practice, no bill yet) · final (the practices and the bill exist)
  state                     text not null default 'draft' check (state in ('draft', 'in_review', 'final')),
  starts_on                 date not null,
  ends_on                   date not null,
  -- Slot length, changeover, teams at once, the split and its figures, prime time and how it is shared, every rule —
  -- versioned (`v`), so a regenerate reads what it was made with (lib/club-schedule-settings.ts reads and words it).
  settings                  jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  -- Every write bumps it; a send, a finalize and an edit act on the version they read (a 409 `changed` otherwise).
  version                   integer not null default 1 check (version >= 1),
  started_from_permit_id    uuid references public.org_permits(id) on delete set null,
  started_from_schedule_id  uuid references public.club_schedules(id) on delete set null,
  -- The review round's reply-by date (Ask 24) — the last review send's.
  reply_by                  date,
  -- The last send of any kind, and the finalize.
  sent_at                   timestamptz,
  sent_by                   uuid references auth.users(id) on delete set null,
  finalized_at              timestamptz,
  finalized_by              uuid references auth.users(id) on delete set null,
  -- A FINAL schedule edited since its last send (Ask 14): the teams keep what they were sent until Send the changes.
  changed_since_sent        boolean not null default false,
  -- ── The bill it carries (Ask 23) — present iff `bill_plan` is set ──
  bill_line_id              uuid references public.org_budget_lines(id) on delete set null,
  -- Whose field prices the time is priced at (10a's `fieldPrices`); null = every field Full and the amount typed.
  bill_permit_id            uuid references public.org_permits(id) on delete set null,
  -- Null = the time at the permit's prices; a figure = the part of it the teams pay (the club covers the rest),
  -- every team scaled alike.
  bill_amount               numeric(12,2) check (bill_amount is null or bill_amount > 0),
  bill_plan                 text check (bill_plan in ('one', 'monthly', 'two_months', 'dates')),
  bill_first_due            date,
  bill_dates                date[],
  -- Set at Finalize: the RATE the teams were billed at — cents per full-field minute (the bill ÷ the priced minutes it
  -- covered). Send the changes bills a correction at the same rate, so a part the club covered stays covered.
  bill_scale                numeric(14,10) check (bill_scale is null or bill_scale > 0),
  -- The first bill, made at Finalize. Corrections are on the send log (`club_schedule_sends.allocation_id`).
  allocation_id             uuid references public.rep_cost_allocations(id) on delete set null,
  created_by                uuid references auth.users(id) on delete set null,
  updated_by                uuid references auth.users(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint club_schedules_dates check (ends_on >= starts_on and ends_on <= starts_on + 400),
  constraint club_schedules_bill_whole check (
    (bill_plan is null and bill_line_id is null and bill_permit_id is null and bill_amount is null
       and bill_first_due is null and bill_dates is null)
    or (bill_plan in ('one', 'monthly', 'two_months') and bill_first_due is not null and bill_dates is null)
    or (bill_plan = 'dates' and bill_dates is not null and cardinality(bill_dates) between 1 and 24 and bill_first_due is null)
  ),
  constraint club_schedules_bill_priced check (bill_plan is null or bill_permit_id is not null or bill_amount is not null)
);

create index if not exists club_schedules_org_idx on public.club_schedules (org_id, starts_on);
create index if not exists club_schedules_permit_idx on public.club_schedules (started_from_permit_id) where started_from_permit_id is not null;
create index if not exists club_schedules_from_schedule_idx on public.club_schedules (started_from_schedule_id) where started_from_schedule_id is not null;
create index if not exists club_schedules_bill_permit_idx on public.club_schedules (bill_permit_id) where bill_permit_id is not null;
create index if not exists club_schedules_bill_line_idx on public.club_schedules (bill_line_id) where bill_line_id is not null;
create index if not exists club_schedules_allocation_idx on public.club_schedules (allocation_id) where allocation_id is not null;
create index if not exists club_schedules_sent_by_idx on public.club_schedules (sent_by) where sent_by is not null;
create index if not exists club_schedules_finalized_by_idx on public.club_schedules (finalized_by) where finalized_by is not null;
create index if not exists club_schedules_created_by_idx on public.club_schedules (created_by) where created_by is not null;
create index if not exists club_schedules_updated_by_idx on public.club_schedules (updated_by) where updated_by is not null;

comment on table public.club_schedules is
  'A schedule the club keeps (Club Tier Stage 11a; plan CLUB_PERMITS_AND_SCHEDULER_PLAN.md): its time is org_time_blocks it owns, cut into club_schedule_slots and handed to teams. draft → in_review (sent for review, Ask 24) → final (the practices and the bill exist, written by club_schedule_finalize). Server-only.';
comment on column public.club_schedules.settings is
  'The scheduler''s settings, versioned (v): slot length, changeover, teams at once, the split and each team''s figure, prime time and how it is shared, every rule. Read and validated by lib/club-schedule-settings.ts; a regenerate reads what the schedule was made with.';
comment on column public.club_schedules.bill_amount is
  'Null = the teams pay for the time they got at the permit''s field prices (lib/club-schedule-bill.ts). A figure = the part of it the teams pay, every team scaled alike (largest remainder to the cent). Required when no permit prices the time.';
comment on column public.club_schedules.bill_scale is
  'Set at Finalize (lib/club-schedule-bill.ts): the rate the teams were billed at, in cents per full-field minute (the bill ÷ Σ each slot''s minutes × its field''s price share). Send the changes bills a team that gained time at this same rate (build question B), so a part of the cost the club covered stays covered.';
comment on column public.club_schedules.changed_since_sent is
  'A FINAL schedule edited (or a slot handed back) since its last send (Ask 14): the teams keep what they were sent; Send the changes (club_schedule_apply_changes) applies the difference and clears it.';

-- ── 2. The schedule is the second owner of the club's time (one model, Stage 11 Ask 2) ───────────────

alter table public.org_time_blocks
  add column if not exists schedule_id uuid references public.club_schedules(id) on delete cascade;
alter table public.org_time_blocks alter column permit_id drop not null;
alter table public.org_time_blocks drop constraint if exists org_time_blocks_one_owner;
alter table public.org_time_blocks add constraint org_time_blocks_one_owner check (num_nonnulls(permit_id, schedule_id) = 1);
create index if not exists org_time_blocks_schedule_idx on public.org_time_blocks (schedule_id) where schedule_id is not null;

comment on column public.org_time_blocks.schedule_id is
  'The block''s second owner (Club Tier Stage 11a): a schedule''s own time — copied from a permit by "Start from", or entered by hand. Exactly one of permit_id and schedule_id is set (org_time_blocks_one_owner). A permit''s reads (lib/permit-lookup.ts) select by permit_id and never see a schedule''s blocks.';

alter table public.org_time_dates_off
  add column if not exists schedule_id uuid references public.club_schedules(id) on delete cascade;
alter table public.org_time_dates_off alter column permit_id drop not null;
alter table public.org_time_dates_off drop constraint if exists org_time_dates_off_one_owner;
alter table public.org_time_dates_off add constraint org_time_dates_off_one_owner check (num_nonnulls(permit_id, schedule_id) = 1);
create unique index if not exists org_time_dates_off_schedule_once on public.org_time_dates_off (schedule_id, day) where schedule_id is not null;

comment on column public.org_time_dates_off.schedule_id is
  'A schedule''s own date off (Club Tier Stage 11a, Ask 20: the club-wide dates off live in The time; a team''s own day off is a rule in the settings). Exactly one of permit_id and schedule_id is set.';

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
  -- A block that moves to another venue leaves its old venue's facilities behind.
  if tg_op = 'UPDATE' and new.org_venue_id <> old.org_venue_id then
    delete from org_time_block_facilities where block_id = new.id;
  end if;
  return new;
end;
$$;

create or replace function public.org_time_dates_off_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.permit_id is not null and not exists (select 1 from org_permits where id = new.permit_id and org_id = new.org_id) then
    raise exception 'date_off_owner: the permit is not this club''s';
  end if;
  if new.schedule_id is not null and not exists (select 1 from club_schedules where id = new.schedule_id and org_id = new.org_id) then
    raise exception 'date_off_owner: the schedule is not this club''s';
  end if;
  return new;
end;
$$;

-- ── 3. The slots, and which teams have each ───────────────────────────────────────────────────────────

create table if not exists public.club_schedule_slots (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.organizations(id) on delete cascade,
  schedule_id          uuid not null references public.club_schedules(id) on delete cascade,
  -- The schedule's block it was cut from (null once the settings rewrote the blocks and the slot was kept).
  block_id             uuid references public.org_time_blocks(id) on delete set null,
  -- NO ACTION, as 10a's blocks: the Venue library refuses a venue or facility a schedule holds, in words.
  org_venue_id         uuid not null references public.org_venues(id),
  -- Null = the venue itself (a venue with no facilities is one place).
  facility_id          uuid references public.org_venue_facilities(id),
  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  -- A padlock: a regenerate keeps it. A slot moved by hand locks itself (Ask 19); unlock frees both.
  locked               boolean not null default false,
  moved_by_hand        boolean not null default false,
  -- The last hand-back (Ask 17): "Open · handed back by {team}" while it has no team; kept as history after.
  handed_back_at       timestamptz,
  handed_back_by       uuid references auth.users(id) on delete set null,
  handed_back_team_id  uuid references public.rep_teams(id) on delete set null,
  -- A FINAL schedule's slot whose time the settings removed: kept until Send the changes reconciles its practices.
  removed_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint club_schedule_slots_window check (ends_at > starts_at and ends_at <= starts_at + interval '24 hours')
);

create unique index if not exists club_schedule_slots_place_start
  on public.club_schedule_slots (schedule_id, org_venue_id, coalesce(facility_id, '00000000-0000-0000-0000-000000000000'::uuid), starts_at);
create index if not exists club_schedule_slots_org_idx on public.club_schedule_slots (org_id, starts_at);
create index if not exists club_schedule_slots_block_idx on public.club_schedule_slots (block_id) where block_id is not null;
create index if not exists club_schedule_slots_venue_idx on public.club_schedule_slots (org_venue_id);
create index if not exists club_schedule_slots_facility_idx on public.club_schedule_slots (facility_id) where facility_id is not null;
create index if not exists club_schedule_slots_handed_back_by_idx on public.club_schedule_slots (handed_back_by) where handed_back_by is not null;
create index if not exists club_schedule_slots_handed_back_team_idx on public.club_schedule_slots (handed_back_team_id) where handed_back_team_id is not null;

comment on table public.club_schedule_slots is
  'A schedule''s time cut into slots (Club Tier Stage 11a): one row per dated slot on one facility — instants, never a weekly pattern (the pattern is its block''s). An open slot has no club_schedule_slot_teams row. ⚠ Not a second model of the club''s time: the time is the schedule''s org_time_blocks; a slot is what one block date became.';

create table if not exists public.club_schedule_slot_teams (
  slot_id   uuid not null references public.club_schedule_slots(id) on delete cascade,
  team_id   uuid not null references public.rep_teams(id) on delete cascade,
  org_id    uuid not null references public.organizations(id) on delete cascade,
  primary key (slot_id, team_id)
);

create index if not exists club_schedule_slot_teams_team_idx on public.club_schedule_slot_teams (team_id);
create index if not exists club_schedule_slot_teams_org_idx on public.club_schedule_slot_teams (org_id);

comment on table public.club_schedule_slot_teams is
  'Which teams have a slot (Club Tier Stage 11a) — rows, so "teams at once" (two teams sharing one facility in one slot) is something the rules can read. The schedule''s own rule is the floor: one team never holds two overlapping slots of one schedule (club_schedule_save / club_schedule_edit_slots raise team_twice).';

-- ── 4. The review round's replies (Ask 24) and the send log (Ask 9) ──────────────────────────────────

create table if not exists public.club_schedule_sends (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  schedule_id      uuid not null references public.club_schedules(id) on delete cascade,
  kind             text not null check (kind in ('review', 'final', 'changes')),
  sent_at          timestamptz not null default now(),
  sent_by          uuid references auth.users(id) on delete set null,
  -- Who was told: the teams emailed, how many people, how many emails failed, the venue's bookings contact (or null).
  team_ids         uuid[] not null default '{}',
  people_count     integer not null default 0 check (people_count >= 0),
  failed_count     integer not null default 0 check (failed_count >= 0),
  bookings_email   text,
  reply_by         date,
  -- What the send applied ("changes": per team, what moved, what it gained and lost) — the log's own record.
  changes          jsonb not null default '[]'::jsonb,
  -- Each team's billed value, in cents, as of this send — the baseline the next Send the changes measures from.
  team_values      jsonb not null default '{}'::jsonb,
  -- Build question B: a correction billed to a team that gained time ({teamId: cents}); what a team that lost time is
  -- owed back ({teamId: cents}) — told, never billed negatively; and the correction's allocation.
  billed           jsonb not null default '{}'::jsonb,
  owed_back        jsonb not null default '{}'::jsonb,
  allocation_id    uuid references public.rep_cost_allocations(id) on delete set null,
  -- When the send's database step landed (set INSIDE that step: Finalize, Send the changes, the review's state). A row
  -- without it is a claim whose step was refused or never ran — never "Last sent", never the next send's baseline.
  landed_at        timestamptz
);
alter table public.club_schedule_sends add column if not exists landed_at timestamptz;

create index if not exists club_schedule_sends_schedule_idx on public.club_schedule_sends (schedule_id, sent_at desc);
create index if not exists club_schedule_sends_org_idx on public.club_schedule_sends (org_id);
create index if not exists club_schedule_sends_sent_by_idx on public.club_schedule_sends (sent_by) where sent_by is not null;
create index if not exists club_schedule_sends_allocation_idx on public.club_schedule_sends (allocation_id) where allocation_id is not null;

comment on table public.club_schedule_sends is
  'The schedule''s send log (Club Tier Stage 11a, Ask 9 — one log shape for every club send): review · final · changes, when, by whom, the teams and people told, the bookings contact, and the money each send settled (team_values: each team''s billed value in cents, the next send''s baseline; billed / owed_back: build question B). A row is CLAIMED before any email goes (club_schedule_send_claim) and completed with what actually went.';

create table if not exists public.club_schedule_replies (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  schedule_id  uuid not null references public.club_schedules(id) on delete cascade,
  -- The review send it answers (a schedule sent for review twice reads its latest round's replies).
  send_id      uuid not null references public.club_schedule_sends(id) on delete cascade,
  team_id      uuid not null references public.rep_teams(id) on delete cascade,
  answer       text not null check (answer in ('looks_good', 'ask_for_change')),
  words        text check (words is null or length(words) <= 1000),
  replied_by   uuid references auth.users(id) on delete set null,
  replied_at   timestamptz not null default now(),
  constraint club_schedule_replies_words check (answer = 'looks_good' or length(btrim(coalesce(words, ''))) > 0)
);

create index if not exists club_schedule_replies_schedule_idx on public.club_schedule_replies (schedule_id, team_id, replied_at desc);
create index if not exists club_schedule_replies_send_idx on public.club_schedule_replies (send_id);
create index if not exists club_schedule_replies_team_idx on public.club_schedule_replies (team_id);
create index if not exists club_schedule_replies_org_idx on public.club_schedule_replies (org_id);
create index if not exists club_schedule_replies_by_idx on public.club_schedule_replies (replied_by) where replied_by is not null;

comment on table public.club_schedule_replies is
  'A head coach''s answer to a review round (Club Tier Stage 11a, Ask 24): Looks good, or Ask for a change (with words). The latest answer per team per round stands; Finalize is never held up by a team that has not answered.';

-- ── 5. A practice's link to the slot that made it ─────────────────────────────────────────────────────

alter table public.rep_team_events
  add column if not exists club_schedule_slot_id uuid;

-- One practice per slot per season (as 207's index): a concurrent double write can only ever produce one row, and a
-- coach's own events (always NULL here) are never constrained by it.
create unique index if not exists rep_team_events_club_slot_uq
  on public.rep_team_events (program_year_id, club_schedule_slot_id)
  where club_schedule_slot_id is not null;
create index if not exists rep_team_events_club_slot_idx
  on public.rep_team_events (club_schedule_slot_id)
  where club_schedule_slot_id is not null;

comment on column public.rep_team_events.club_schedule_slot_id is
  'Provenance (Club Tier Stage 11a, mig 326): the club_schedule_slots row this practice is the club''s booking of — "From {schedule} · the club''s schedule", read-only to the coach where it is the club''s (the events PATCH/DELETE refuse its time, place, name and status; the coach keeps arrival, notes, uniform, links, tags, attendance, the lineup and the plan). NOT a foreign key, for 207''s reason: a slot''s removal must never cascade a practice the coach worked on — club_schedule_apply_changes and club_schedule_hand_back cancel a worked-on one and delete an untouched one. NULL on every coach-made event.';

-- ── 6. "By the time each team got" is a split of its own (Ask 23) ─────────────────────────────────────

alter table public.rep_allocation_splits drop constraint if exists rep_allocation_splits_split_method_check;
alter table public.rep_allocation_splits
  add constraint rep_allocation_splits_split_method_check
  check (split_method in ('even', 'percentage', 'sessions', 'fixed', 'time'));

-- club_allocation_create, exactly as mig 318 left it, accepting the one new split: `time` (By the time each team got —
-- each share is that team's time at the permit's field prices, worked out by lib/club-schedule-bill.ts; `splitValue` is
-- the team's priced hours). Called by club_schedule_finalize and club_schedule_apply_changes inside their own step.
CREATE OR REPLACE FUNCTION public.club_allocation_create(
  p_org          uuid,
  p_actor        uuid,
  p_description  text,
  p_source_line  uuid,
  p_split_method text,
  p_splits       jsonb,
  p_notes        text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_line      org_budget_lines%ROWTYPE;
  v_direction text;
  v_allocated numeric;
  v_shares    numeric;
  v_alloc     uuid := gen_random_uuid();
  v_split     jsonb;
  v_inst      jsonb;
  v_split_id  uuid;
  v_team      uuid;
  v_year      uuid;
  v_status    text;
  v_through   date;
  v_first_due date;
BEGIN
  IF p_splits IS NULL OR jsonb_typeof(p_splits) <> 'array' OR jsonb_array_length(p_splits) = 0 THEN
    RAISE EXCEPTION 'club_allocation_create: at least one split';
  END IF;
  IF p_split_method NOT IN ('even', 'percentage', 'sessions', 'fixed', 'time') THEN
    RAISE EXCEPTION 'club_allocation_create: no split method %', p_split_method;
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_splits) s WHERE coalesce((s->>'amount')::numeric, 0) <= 0) THEN
    RAISE EXCEPTION 'club_allocation_create: every share above zero';
  END IF;
  SELECT sum((s->>'amount')::numeric) INTO v_shares FROM jsonb_array_elements(p_splits) s;

  -- Only an open season is billed (S3C-09): checked for every team before anything is written.
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits) LOOP
    v_team := (v_split->>'teamId')::uuid;
    v_year := (v_split->>'programYearId')::uuid;
    SELECT y.status INTO v_status FROM rep_program_years y JOIN rep_teams t ON t.id = y.team_id
     WHERE y.id = v_year AND t.id = v_team AND t.org_id = p_org;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'club_allocation_create: team % and season % are not this club''s', v_team, v_year;
    END IF;
    -- The team's RUNNING season (rep_team_live_season — the newest draft or active one, the season its payments
    -- are carried by); an older season still marked open is not it.
    IF v_status NOT IN ('draft', 'active') OR v_year IS DISTINCT FROM rep_team_live_season(v_team) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'season_closed', 'teamId', v_team);
    END IF;
  END LOOP;

  IF p_source_line IS NOT NULL THEN
    SELECT * INTO v_line FROM org_budget_lines
     WHERE id = p_source_line AND org_id = p_org
     FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'line_not_found'); END IF;
    IF club_fiscal_year_locked(v_line.fiscal_year_id) THEN RETURN jsonb_build_object('ok', false, 'code', 'year_closed'); END IF;

    SELECT direction INTO v_direction FROM budget_items WHERE id = v_line.item_id;
    IF v_direction = 'in' THEN RETURN jsonb_build_object('ok', false, 'code', 'not_a_cost_line'); END IF;

    v_allocated := club_line_allocated(p_source_line);
    IF v_shares > v_line.total_amount - v_allocated + 0.005 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'over_line',
        'planned', v_line.total_amount, 'allocated', v_allocated,
        'left', greatest(v_line.total_amount - v_allocated, 0));
    END IF;
  ELSE
    -- An off-plan bill counts in the year its first installment falls due.
    SELECT min((i->>'dueDate')::date) INTO v_first_due
      FROM jsonb_array_elements(p_splits) s, jsonb_array_elements(s->'installments') i;
    v_through := club_books_closed_through(p_org);
    IF v_through IS NOT NULL AND v_first_due <= v_through THEN
      RETURN jsonb_build_object('ok', false, 'code', 'year_closed');
    END IF;
  END IF;

  INSERT INTO rep_cost_allocations
    (id, org_id, description, total_amount, source_entry_id, source_budget_line_id, created_by, notes)
  VALUES
    (v_alloc, p_org, p_description, v_shares, NULL, p_source_line, p_actor, nullif(btrim(coalesce(p_notes, '')), ''));

  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits) LOOP
    v_team := (v_split->>'teamId')::uuid;
    v_year := (v_split->>'programYearId')::uuid;
    INSERT INTO rep_allocation_splits
      (allocation_id, team_id, program_year_id, org_id, amount, split_method, split_value, payment_schedule, notes)
    VALUES
      (v_alloc, v_team, v_year, p_org, (v_split->>'amount')::numeric, p_split_method,
       coalesce((v_split->>'splitValue')::numeric, 0), coalesce(v_split->>'paymentSchedule', 'standard'),
       nullif(btrim(coalesce(v_split->>'notes', '')), ''))
    RETURNING id INTO v_split_id;

    FOR v_inst IN SELECT * FROM jsonb_array_elements(v_split->'installments') LOOP
      INSERT INTO rep_allocation_installments (split_id, installment_number, amount, due_date, org_id, team_id)
      VALUES (v_split_id, (v_inst->>'installmentNumber')::integer, (v_inst->>'amount')::numeric,
              (v_inst->>'dueDate')::date, p_org, v_team);
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'allocationId', v_alloc, 'total', v_shares);
END;
$$;

-- ── 7. The floor under every save ─────────────────────────────────────────────────────────────────────

create or replace function public.club_schedule_slots_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from club_schedules where id = new.schedule_id and org_id = new.org_id) then
    raise exception 'slot_owner: the schedule is not this club''s';
  end if;
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

drop trigger if exists club_schedule_slots_check on public.club_schedule_slots;
create trigger club_schedule_slots_check
  before insert or update on public.club_schedule_slots
  for each row execute function public.club_schedule_slots_check();

create or replace function public.club_schedule_team_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from rep_teams where id = new.team_id and org_id = new.org_id) then
    raise exception 'slot_team: that team is not this club''s';
  end if;
  return new;
end;
$$;

drop trigger if exists club_schedule_slot_teams_check on public.club_schedule_slot_teams;
create trigger club_schedule_slot_teams_check
  before insert or update on public.club_schedule_slot_teams
  for each row execute function public.club_schedule_team_check();

drop trigger if exists club_schedule_replies_check on public.club_schedule_replies;
create trigger club_schedule_replies_check
  before insert or update on public.club_schedule_replies
  for each row execute function public.club_schedule_team_check();

-- The schedule's own rule (the one refusal; everything else warns): one team never holds two overlapping slots of one
-- schedule. Raised, so the whole save rolls back; the route words it.
create or replace function public.club_schedule_assert_no_team_twice(p_schedule uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team text;
  v_at   timestamptz;
begin
  select t.name, a.starts_at into v_team, v_at
    from club_schedule_slot_teams at1
    join club_schedule_slots a on a.id = at1.slot_id
    join club_schedule_slot_teams at2 on at2.team_id = at1.team_id and at2.slot_id <> at1.slot_id
    join club_schedule_slots b on b.id = at2.slot_id
    join rep_teams t on t.id = at1.team_id
   where a.schedule_id = p_schedule and b.schedule_id = p_schedule
     and a.removed_at is null and b.removed_at is null
     and a.starts_at < b.ends_at and b.starts_at < a.ends_at
   limit 1;
  if found then
    raise exception 'team_twice: % holds two slots at once (%)', v_team, v_at;
  end if;
end;
$$;

-- What the coach did on a practice: their own fields on the row, or any record hanging off it. A failed read is
-- impossible here (one statement), so the rule is exact: worked on → cancel, untouched → delete (decideOrphanFate's
-- rule, without field_number — on a club practice that column carries the club's facility name, never the coach's).
create or replace function public.club_practice_worked_on(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from rep_team_events e
     where e.id = p_event
       and (e.arrival_time is not null or e.uniform is not null
            or nullif(btrim(coalesce(e.description, '')), '') is not null
            or (e.resources is not null and jsonb_typeof(e.resources) = 'array' and jsonb_array_length(e.resources) > 0)
            or e.practice_plan is not null or e.practice_recap is not null or e.practice_plan_sent_at is not null)
  )
  or exists (select 1 from rep_team_event_attendance where event_id = p_event)
  or exists (select 1 from rep_team_lineups where event_id = p_event)
  or exists (select 1 from rep_team_event_tags where event_id = p_event)
  or exists (select 1 from rep_player_awards where event_id = p_event)
  or exists (select 1 from rep_team_expenses where event_id = p_event)
  or exists (select 1 from rep_player_notes where event_id = p_event)
  or exists (select 1 from rep_team_evaluation_sessions where event_id = p_event)
  or exists (select 1 from rep_team_call_up_appearances where event_id = p_event)
  or exists (select 1 from rep_team_game_moments where event_id = p_event)
  or exists (select 1 from rep_team_opponent_observations where event_id = p_event);
$$;

-- A practice the club no longer gives a team: cancelled when the coach worked on it (it keeps their records and drops
-- out of every count), deleted when untouched. Returns 'cancelled' | 'deleted' | 'kept' (already cancelled).
create or replace function public.club_practice_retire(p_event uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from rep_team_events where id = p_event and club_schedule_slot_id is not null for update;
  if not found then return 'gone'; end if;
  if club_practice_worked_on(p_event) then
    if v_status = 'cancelled' then return 'kept'; end if;
    update rep_team_events set status = 'cancelled', updated_at = now() where id = p_event;
    return 'cancelled';
  end if;
  delete from rep_team_events where id = p_event;
  return 'deleted';
end;
$$;

-- Insert the club's practices (one per slot per team), or bring a cancelled one back for the same slot and season.
create or replace function public.club_practices_write(p_org uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_n   integer := 0;
begin
  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    insert into rep_team_events (program_year_id, team_id, org_id, event_type, name, starts_at, ends_at, location,
                                 location_address, field_number, org_venue_id, org_venue_facility_id, status,
                                 club_schedule_slot_id)
    values ((v_row->>'programYearId')::uuid, (v_row->>'teamId')::uuid, p_org, 'practice',
            coalesce(nullif(btrim(v_row->>'name'), ''), 'Practice'),
            (v_row->>'startsAt')::timestamptz, (v_row->>'endsAt')::timestamptz,
            nullif(v_row->>'location', ''), nullif(v_row->>'locationAddress', ''), nullif(v_row->>'fieldNumber', ''),
            (v_row->>'venueId')::uuid, nullif(v_row->>'facilityId', '')::uuid, 'scheduled',
            (v_row->>'slotId')::uuid)
    on conflict (program_year_id, club_schedule_slot_id) where club_schedule_slot_id is not null
    do update set status = 'scheduled', starts_at = excluded.starts_at, ends_at = excluded.ends_at,
                  location = excluded.location, location_address = excluded.location_address,
                  field_number = excluded.field_number, org_venue_id = excluded.org_venue_id,
                  org_venue_facility_id = excluded.org_venue_facility_id, updated_at = now();
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Each team of the rows must be billed and booked on its RUNNING season (Ask 15; S3C-09). The first team that isn't.
create or replace function public.club_practices_season_refusal(p_org uuid, p_rows jsonb)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select (r->>'teamId')::uuid
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
   where not exists (select 1 from rep_teams t where t.id = (r->>'teamId')::uuid and t.org_id = p_org)
      or (r->>'programYearId')::uuid is distinct from rep_team_live_season((r->>'teamId')::uuid)
   limit 1;
$$;

-- Build question A (ruled 2026-10-11): a share is filed under the club line's word only when the word is a PLATFORM
-- word (no org, no team) and the team's running-season budget already has a line under it.
create or replace function public.club_bill_file_shares(p_allocation uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  update rep_allocation_splits s
     set budget_item_id = bi.id, budget_category_id = bi.category_id
    from rep_cost_allocations a
    join org_budget_lines l on l.id = a.source_budget_line_id
    join budget_items bi on bi.id = l.item_id
   where s.allocation_id = p_allocation and a.id = p_allocation
     and bi.org_id is null and bi.team_id is null
     and exists (select 1 from rep_budget_lines r
                  where r.team_id = s.team_id and r.program_year_id = s.program_year_id and r.item_id = bi.id);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ── 8. One save, one step ─────────────────────────────────────────────────────────────────────────────
-- `p_schedule` null creates a draft. Otherwise the version must be the one the caller read (409 `changed`). Each part is
-- replaced only when `p_data` carries it: `name`, `startsOn`/`endsOn`, `settings`, `startedFrom*`, `blocks`, `datesOff`,
-- `slots`. Slots are matched by place and start, so a kept slot keeps its id (and a final schedule's practices keep
-- theirs); a final schedule's slot whose time is gone is soft-removed until Send the changes.

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
      if cardinality(v_teams) > v_cap then
        raise exception 'slot_full: a slot holds % team(s) at once', v_cap;
      end if;
      if v_old_teams is distinct from v_teams then
        delete from club_schedule_slot_teams where slot_id = v_slot_id;
        insert into club_schedule_slot_teams (slot_id, team_id, org_id) select v_slot_id, t, p_org from unnest(v_teams) t;
        v_changed := true;
      end if;
    end loop;
    if v_s.state = 'final' then
      -- Its practices are reconciled by Send the changes: the slot is kept, removed, until then.
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

-- A hand edit on the grid (Ask 13): each edit names a slot and what it now holds — its teams, its padlock. The client
-- works out which weeks a drop reaches; the server re-validates the result (the one refusal: a team twice at once).
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
begin
  select * into v_s from club_schedules where id = p_schedule and org_id = p_org for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if v_s.version <> p_version then return jsonb_build_object('ok', false, 'code', 'changed', 'version', v_s.version); end if;
  v_cap := greatest(1, coalesce((v_s.settings->>'teamsAtOnce')::integer, 1));

  for v_edit in select * from jsonb_array_elements(coalesce(p_edits, '[]'::jsonb)) loop
    select * into v_slot from club_schedule_slots
     where id = (v_edit->>'slotId')::uuid and schedule_id = p_schedule and removed_at is null;
    if not found then return jsonb_build_object('ok', false, 'code', 'slot_not_found', 'slotId', v_edit->>'slotId'); end if;
    if v_edit ? 'teamIds' then
      v_teams := array(select distinct x::uuid from jsonb_array_elements_text(coalesce(v_edit->'teamIds', '[]'::jsonb)) x order by 1);
      if cardinality(v_teams) > v_cap then
        raise exception 'slot_full: a slot holds % team(s) at once', v_cap;
      end if;
      select coalesce(array_agg(team_id order by team_id), '{}') into v_old from club_schedule_slot_teams where slot_id = v_slot.id;
      if v_old is distinct from v_teams then
        delete from club_schedule_slot_teams where slot_id = v_slot.id;
        insert into club_schedule_slot_teams (slot_id, team_id, org_id) select v_slot.id, t, p_org from unnest(v_teams) t;
        v_changed := true;
      end if;
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

-- ── 9. Finalize: every practice and the bill, in one step (Ask 23, P11-05) ─────────────────────────────
-- `p_rows`: one practice per slot per team (the server worked them out from the version it previewed). `p_bill`: null,
-- or { description, lineId, notes, splits } — club_allocation_create's own splits, split `time`. Refusals come back
-- before anything is written: not_found · already_final · changed · season_closed (+ teamId) · the allocation's own
-- (year_closed · over_line · line_not_found · not_a_cost_line · season_closed). `p_send`: the claimed log row, and
-- `p_log` its money ({ teamValues }) — written HERE, in the same step, so the next Send the changes always measures
-- from what this step billed (/review 2026-10-11: written after the emails, a failed completion left `{}` and the next
-- send billed every team its whole share again).

drop function if exists public.club_schedule_finalize(uuid, uuid, uuid, integer, jsonb, jsonb, numeric);
create or replace function public.club_schedule_finalize(
  p_org uuid, p_schedule uuid, p_actor uuid, p_version integer, p_rows jsonb, p_bill jsonb, p_scale numeric,
  p_send uuid, p_log jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s      club_schedules%rowtype;
  v_team   uuid;
  v_res    jsonb;
  v_alloc  uuid;
  v_filed  integer := 0;
  v_rows   integer;
begin
  select * into v_s from club_schedules where id = p_schedule and org_id = p_org for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if v_s.state = 'final' then return jsonb_build_object('ok', false, 'code', 'already_final'); end if;
  if v_s.version <> p_version then return jsonb_build_object('ok', false, 'code', 'changed', 'version', v_s.version); end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
              where not exists (select 1 from club_schedule_slots sl
                                 where sl.id = (r->>'slotId')::uuid and sl.schedule_id = p_schedule and sl.removed_at is null)) then
    return jsonb_build_object('ok', false, 'code', 'changed', 'version', v_s.version);
  end if;
  v_team := club_practices_season_refusal(p_org, p_rows);
  if v_team is not null then return jsonb_build_object('ok', false, 'code', 'season_closed', 'teamId', v_team); end if;

  if p_bill is not null then
    v_res := club_allocation_create(p_org, p_actor, p_bill->>'description', nullif(p_bill->>'lineId', '')::uuid, 'time',
                                    p_bill->'splits', p_bill->>'notes');
    if not coalesce((v_res->>'ok')::boolean, false) then return v_res; end if;
    v_alloc := (v_res->>'allocationId')::uuid;
    v_filed := club_bill_file_shares(v_alloc);
  end if;

  v_rows := club_practices_write(p_org, p_rows);

  update club_schedules set
    state = 'final', version = version + 1, changed_since_sent = false,
    finalized_at = now(), finalized_by = p_actor, sent_at = now(), sent_by = p_actor,
    allocation_id = coalesce(v_alloc, allocation_id),
    bill_scale = case when p_bill is not null then p_scale else bill_scale end,
    updated_by = p_actor, updated_at = now()
  where id = p_schedule;
  update club_schedule_sends set landed_at = now(), team_values = coalesce(p_log->'teamValues', '{}'::jsonb)
   where id = p_send and schedule_id = p_schedule and org_id = p_org;
  if not found then raise exception 'changed: the send''s claim is gone'; end if;
  return jsonb_build_object('ok', true, 'allocationId', v_alloc, 'practices', v_rows, 'filed', v_filed);
end;
$$;

-- ── 10. Send the changes: the held edits, applied in one step (Ask 14) ────────────────────────────────
-- `p_inserts`: practices to write (a slot a team gained) — as finalize's rows. `p_updates`: { eventId, slotId, startsAt,
-- endsAt, venueId, facilityId, location, locationAddress, fieldNumber } (a practice moved IN PLACE to the slot the team
-- has now — its link moves with it). `p_retire`: practices the teams no longer have — cancelled when worked on, deleted
-- when untouched. `p_bill`: the correction bill (build question B: gains only), or null. Then the soft-removed slots go,
-- a cancelled practice's link to one with them. `p_send` / `p_log` ({ teamValues, billed, owedBack }): the claimed log
-- row's money, written in this step (as finalize's).

drop function if exists public.club_schedule_apply_changes(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb);
create or replace function public.club_schedule_apply_changes(
  p_org uuid, p_schedule uuid, p_actor uuid, p_version integer,
  p_inserts jsonb, p_updates jsonb, p_retire uuid[], p_bill jsonb, p_send uuid, p_log jsonb
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
begin
  select * into v_s from club_schedules where id = p_schedule and org_id = p_org for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if v_s.state <> 'final' then return jsonb_build_object('ok', false, 'code', 'not_final'); end if;
  if v_s.version <> p_version then return jsonb_build_object('ok', false, 'code', 'changed', 'version', v_s.version); end if;
  v_team := club_practices_season_refusal(p_org, p_inserts);
  if v_team is not null then return jsonb_build_object('ok', false, 'code', 'season_closed', 'teamId', v_team); end if;

  if p_bill is not null then
    v_res := club_allocation_create(p_org, p_actor, p_bill->>'description', nullif(p_bill->>'lineId', '')::uuid, 'time',
                                    p_bill->'splits', p_bill->>'notes');
    if not coalesce((v_res->>'ok')::boolean, false) then return v_res; end if;
    v_alloc := (v_res->>'allocationId')::uuid;
    perform club_bill_file_shares(v_alloc);
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
    -- The slot it moves to: one of this schedule's, still standing. (Left on its old slot, a moved practice pointed at a
    -- slot this step deletes — the next send read it as a loss and its new slot as a gain: /review 2026-10-11.)
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

  -- The soft-removed slots go. A practice still live on one was missed by the changes (a race): refuse, never orphan it.
  -- A cancelled one (the coach's records kept) stops being the club's: its slot is gone, so it can never come back, and
  -- left linked it could never be removed either.
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
    billed = coalesce(p_log->'billed', '{}'::jsonb), owed_back = coalesce(p_log->'owedBack', '{}'::jsonb), allocation_id = v_alloc
   where id = p_send and schedule_id = p_schedule and org_id = p_org;
  if not found then raise exception 'changed: the send''s claim is gone'; end if;
  return jsonb_build_object('ok', true, 'allocationId', v_alloc, 'inserted', v_ins, 'updated', v_upd,
                            'cancelled', v_cancel, 'deleted', v_delete);
end;
$$;

-- ── 11. Hand back (Ask 17): the coach's own act, landing at once ──────────────────────────────────────
-- `p_events`: the team's club practices the coach hands back (this one · this & future · all — the route works them
-- out). Each frees its slot for the team (the slot reads "Open · handed back by …" while nobody has it), and the
-- practice goes the mirror's way (cancelled when worked on, deleted when untouched). The schedule reads Changed since
-- sent: reassigning the slot is a change to send, and the money is settled at Send the changes (build question B).

create or replace function public.club_schedule_hand_back(p_org uuid, p_team uuid, p_actor uuid, p_events uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id         uuid;
  v_slot       club_schedule_slots%rowtype;
  v_fate       text;
  v_schedules  uuid[] := '{}';
  v_slots      uuid[] := '{}';
  v_cancel     integer := 0;
  v_delete     integer := 0;
begin
  foreach v_id in array coalesce(p_events, '{}'::uuid[]) loop
    select sl.* into v_slot
      from rep_team_events e
      join club_schedule_slots sl on sl.id = e.club_schedule_slot_id
     where e.id = v_id and e.team_id = p_team and e.org_id = p_org and sl.org_id = p_org;
    if not found then continue; end if;
    perform 1 from club_schedules where id = v_slot.schedule_id for update;
    -- Read again under the schedule's lock: a send or an edit that held it may have moved the practice, removed its slot
    -- or retired it while this waited (/review 2026-10-11).
    select sl.* into v_slot
      from rep_team_events e
      join club_schedule_slots sl on sl.id = e.club_schedule_slot_id
     where e.id = v_id and e.team_id = p_team and e.org_id = p_org and e.status <> 'cancelled'
       and sl.org_id = p_org and sl.removed_at is null;
    if not found then continue; end if;
    delete from club_schedule_slot_teams where slot_id = v_slot.id and team_id = p_team;
    update club_schedule_slots set handed_back_at = now(), handed_back_by = p_actor, handed_back_team_id = p_team,
                                   updated_at = now()
     where id = v_slot.id;
    v_fate := club_practice_retire(v_id);
    if v_fate = 'cancelled' then v_cancel := v_cancel + 1; elsif v_fate = 'deleted' then v_delete := v_delete + 1; end if;
    v_slots := v_slots || v_slot.id;
    if not (v_slot.schedule_id = any (v_schedules)) then v_schedules := v_schedules || v_slot.schedule_id; end if;
  end loop;
  update club_schedules set changed_since_sent = true, version = version + 1, updated_at = now()
   where id = any (v_schedules) and state = 'final';
  return jsonb_build_object('ok', true, 'slots', to_jsonb(v_slots), 'schedules', to_jsonb(v_schedules),
                            'cancelled', v_cancel, 'deleted', v_delete);
end;
$$;

-- ── 12. Claim a send before a single email goes (3a's claim, per schedule) ────────────────────────────
-- Two presses a breath apart both read "nothing sent" and both email every coach: the claim holds a per-schedule lock
-- for its own transaction, so the second waits, sees the first and refuses (`just_sent`). The app completes the row with
-- what actually went, or removes it when the step behind it was refused.

create or replace function public.club_schedule_send_claim(p_org uuid, p_schedule uuid, p_actor uuid, p_kind text, p_reply_by date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('club_schedule_send:' || p_schedule::text, 0));
  if not exists (select 1 from club_schedules where id = p_schedule and org_id = p_org) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if exists (select 1 from club_schedule_sends where schedule_id = p_schedule and sent_at > now() - interval '60 seconds') then
    return jsonb_build_object('ok', false, 'code', 'just_sent');
  end if;
  insert into club_schedule_sends (org_id, schedule_id, kind, sent_by, reply_by)
  values (p_org, p_schedule, p_kind, p_actor, p_reply_by)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'sendId', v_id);
end;
$$;

-- The review send's step (Ask 24): the schedule reads In review on the version the sender previewed, and the claimed log
-- row is marked landed in the same step — the round a coach's reply answers is never a claim whose step didn't land.
create or replace function public.club_schedule_send_review(p_org uuid, p_schedule uuid, p_actor uuid, p_version integer, p_reply_by date, p_send uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s club_schedules%rowtype;
begin
  select * into v_s from club_schedules where id = p_schedule and org_id = p_org for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if v_s.state = 'final' then return jsonb_build_object('ok', false, 'code', 'already_final'); end if;
  if v_s.version <> p_version then return jsonb_build_object('ok', false, 'code', 'changed', 'version', v_s.version); end if;
  update club_schedules set state = 'in_review', reply_by = p_reply_by, sent_at = now(), sent_by = p_actor,
                            version = version + 1, updated_by = p_actor, updated_at = now()
   where id = p_schedule
   returning * into v_s;
  update club_schedule_sends set landed_at = now() where id = p_send and schedule_id = p_schedule and org_id = p_org;
  if not found then raise exception 'changed: the send''s claim is gone'; end if;
  return jsonb_build_object('ok', true, 'version', v_s.version);
end;
$$;

-- ── 13. The season roll carries a team's upcoming club practices (Ask 15, P11-06) ─────────────────────
-- "The SCHEDULE starts fresh" (lib/rep-season-rollover.ts) is about the old season's OWN events; a club practice is the
-- club's booking, so the upcoming ones move to the new season with the coach's replies on them (attendance follows its
-- player to the new roster through the roll's player map; a player who didn't carry has no place in the new season).

create or replace function public.club_practices_carry(p_org uuid, p_team uuid, p_from uuid, p_to uuid, p_after timestamptz, p_players jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_events uuid[];
begin
  if not exists (select 1 from rep_program_years where id = p_to and team_id = p_team and org_id = p_org) then
    raise exception 'carry_season: the new season is not the team''s';
  end if;
  select coalesce(array_agg(id), '{}') into v_events from rep_team_events
   where team_id = p_team and org_id = p_org and program_year_id = p_from
     and club_schedule_slot_id is not null and starts_at >= p_after;
  if cardinality(v_events) = 0 then return 0; end if;
  update rep_team_events set program_year_id = p_to, updated_at = now() where id = any (v_events);
  delete from rep_team_event_attendance
   where event_id = any (v_events) and not (coalesce(p_players, '{}'::jsonb) ? player_id::text);
  update rep_team_event_attendance
     set program_year_id = p_to, player_id = (p_players->>player_id::text)::uuid, updated_at = now()
   where event_id = any (v_events);
  update rep_team_lineups set program_year_id = p_to, updated_at = now() where event_id = any (v_events);
  return cardinality(v_events);
end;
$$;

-- ── 14. Server-only (mig 311 / 318's shape) ───────────────────────────────────────────────────────────

alter table public.club_schedules enable row level security;
alter table public.club_schedule_slots enable row level security;
alter table public.club_schedule_slot_teams enable row level security;
alter table public.club_schedule_sends enable row level security;
alter table public.club_schedule_replies enable row level security;

revoke all on public.club_schedules, public.club_schedule_slots, public.club_schedule_slot_teams,
              public.club_schedule_sends, public.club_schedule_replies from anon, authenticated;
grant select, insert, update, delete on public.club_schedules, public.club_schedule_slots, public.club_schedule_slot_teams,
                                        public.club_schedule_sends, public.club_schedule_replies to service_role;

revoke all on function
  public.club_schedule_slots_check(),
  public.club_schedule_team_check(),
  public.club_schedule_assert_no_team_twice(uuid),
  public.club_practice_worked_on(uuid),
  public.club_practice_retire(uuid),
  public.club_practices_write(uuid, jsonb),
  public.club_practices_season_refusal(uuid, jsonb),
  public.club_bill_file_shares(uuid),
  public.club_schedule_save(uuid, uuid, uuid, integer, jsonb),
  public.club_schedule_edit_slots(uuid, uuid, uuid, integer, jsonb),
  public.club_schedule_finalize(uuid, uuid, uuid, integer, jsonb, jsonb, numeric, uuid, jsonb),
  public.club_schedule_apply_changes(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb, uuid, jsonb),
  public.club_schedule_hand_back(uuid, uuid, uuid, uuid[]),
  public.club_schedule_send_claim(uuid, uuid, uuid, text, date),
  public.club_schedule_send_review(uuid, uuid, uuid, integer, date, uuid),
  public.club_practices_carry(uuid, uuid, uuid, uuid, timestamptz, jsonb),
  public.club_allocation_create(uuid, uuid, text, uuid, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function
  public.club_schedule_save(uuid, uuid, uuid, integer, jsonb),
  public.club_schedule_edit_slots(uuid, uuid, uuid, integer, jsonb),
  public.club_schedule_finalize(uuid, uuid, uuid, integer, jsonb, jsonb, numeric, uuid, jsonb),
  public.club_schedule_apply_changes(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb, uuid, jsonb),
  public.club_schedule_hand_back(uuid, uuid, uuid, uuid[]),
  public.club_schedule_send_claim(uuid, uuid, uuid, text, date),
  public.club_schedule_send_review(uuid, uuid, uuid, integer, date, uuid),
  public.club_practices_carry(uuid, uuid, uuid, uuid, timestamptz, jsonb),
  public.club_allocation_create(uuid, uuid, text, uuid, text, jsonb, text)
  to service_role;

commit;
