-- 476_families_say_if_theyre_coming.sql
--
-- Signed-in family accounts Stage 4b, Part 1 (plan docs/projects/active/SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md, Stage 4, RULED 2026-11-13,
-- all 15 asks A, + O1/O2/O4 ruled in build Session 1; build prompt SIGNED_IN_FAMILY_STAGE4B_BUILD_PROMPT.md, Part 1). Needs 453.
--
-- WHY: a parent says In / Out / Maybe for their child on an upcoming event, once the team's coach turns it on (ask 1). The family's
-- answer is its OWN record: it never writes the coach's attendance book (rep_team_event_attendance stays the coach's alone; the
-- coach copies answers in with a tap, ask 3).
--
-- WHAT CHANGES
--   rep_teams.family_answers         NEW, NOT NULL, default 'off': off | games | games_and_practices (ask 1). The default keeps every
--                                    existing team dark.
--   event_availability_answers       NEW. One answer per child per event (latest wins, updated in place, ask 6), with the one-step
--                                    history ask 6 needs (previous_*). event_kind keeps rep / league id spaces apart; the two league
--                                    kinds are RESERVED for the house-league stage (ask 4) and unused in 4b. event_id has no FK (three
--                                    source tables): the server checks it, and a deleted rep event takes its answers (trigger below).
--   event_availability_reminders     NEW. The Remind log (ask 2): one row per send. "Once per event per 24 hours for the whole staff" is
--                                    a database fact: event_availability_remind_claim() takes the event's lock, refuses when a row from
--                                    the last 24 hours exists, and inserts otherwise, in one statement's transaction.
--   event_availability_purge()       NEW (ask 15, O4): notes are cleared 30 days after their event; answers are deleted 60 days after the
--                                    season's LAST event, whether or not the season is closed (no rep season stores a close date, O4).
--                                    Run nightly by mig 477's pg_cron job. Never touches the coach's attendance book.
--
-- ⚖ NO org_id on either table, deliberately: a row is reached only through its event and child, so a team that moves into a club
-- (move_team_into_club re-points the events) carries its answers with nothing to re-point, and a deleted club removes them through
-- its events (the delete trigger) and its children (the FK). tests/unit/team-move-coverage.test.ts holds every org_id table to a
-- decision; these have none to make.
--
-- Re-runnable.

begin;

set local lock_timeout = '15s';

-- ── 1. The team's switch (ask 1) ──────────────────────────────────────────────────────────────────────────────────────────────
alter table public.rep_teams add column if not exists family_answers text not null default 'off';
alter table public.rep_teams drop constraint if exists rep_teams_family_answers_check;
alter table public.rep_teams add constraint rep_teams_family_answers_check
  check (family_answers in ('off', 'games', 'games_and_practices'));

-- ── 2. The answers ────────────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.event_availability_answers (
  id                   uuid primary key default gen_random_uuid(),
  -- rep_event = rep_team_events.id (4b). league_game / league_practice are reserved for the house-league stage (ask 4).
  event_kind           text not null,
  event_id             uuid not null,
  -- The CHILD, as the connection is (Stage 4 ruling 3).
  child_id             uuid not null references public.org_children(id) on delete cascade,
  answer               text not null,
  -- One short line, plain text, trimmed by the server (≤ 200). Cleared 30 days after the event, and when its writer's connection ends.
  note                 text,
  answered_by_user_id  uuid references auth.users(id) on delete set null,
  answered_at          timestamptz not null default now(),
  -- The answer before the latest change, and who gave it when (ask 6's "earlier: In (Dev, Mon)"). Written only when the answer changed.
  previous_answer      text,
  previous_by_user_id  uuid references auth.users(id) on delete set null,
  previous_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint event_availability_answers_kind_check check (event_kind in ('rep_event', 'league_game', 'league_practice')),
  constraint event_availability_answers_answer_check check (answer in ('in', 'out', 'maybe')),
  constraint event_availability_answers_previous_check check (previous_answer is null or previous_answer in ('in', 'out', 'maybe')),
  constraint event_availability_answers_note_check check (note is null or (char_length(note) between 1 and 200))
);

-- Latest wins, one row per child per event. Its leading columns also serve "all answers for these events" (the schedule count).
create unique index if not exists event_availability_answers_event_child_uniq
  on public.event_availability_answers (event_kind, event_id, child_id);
-- "All answers by this user" (a leaving parent's notes are cleared, ask 15).
create index if not exists event_availability_answers_by_user_idx
  on public.event_availability_answers (answered_by_user_id) where answered_by_user_id is not null;
create index if not exists event_availability_answers_prev_user_idx
  on public.event_availability_answers (previous_by_user_id) where previous_by_user_id is not null;
create index if not exists event_availability_answers_child_idx on public.event_availability_answers (child_id);

alter table public.event_availability_answers enable row level security;
-- No policies: service-role only (family_invitations' posture). A record about a child; nothing in the browser reads it directly.
grant select, insert, update, delete on public.event_availability_answers to service_role;

-- A deleted rep event takes its answers with it (event_id has no FK). Row triggers also fire on a cascaded delete (a team's).
create or replace function public.rep_team_events_drop_availability() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.event_availability_answers where event_kind = 'rep_event' and event_id = old.id;
  delete from public.event_availability_reminders where event_kind = 'rep_event' and event_id = old.id;
  return old;
end $$;
revoke all on function public.rep_team_events_drop_availability() from public, anon, authenticated;

-- ── 3. The Remind log (ask 2) ─────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.event_availability_reminders (
  id                   uuid primary key default gen_random_uuid(),
  event_kind           text not null,
  event_id             uuid not null,
  reminded_at          timestamptz not null default now(),
  reminded_by_user_id  uuid references auth.users(id) on delete set null,
  -- What the send reached (COUNTS, never who): families reminded, parents reached, parents who got the app note only.
  families             integer not null default 0,
  parents              integer not null default 0,
  app_only             integer not null default 0,
  constraint event_availability_reminders_kind_check check (event_kind in ('rep_event', 'league_game', 'league_practice')),
  constraint event_availability_reminders_counts_check check (families >= 0 and parents >= 0 and app_only >= 0)
);
create index if not exists event_availability_reminders_event_idx
  on public.event_availability_reminders (event_kind, event_id, reminded_at desc);
create index if not exists event_availability_reminders_by_idx
  on public.event_availability_reminders (reminded_by_user_id) where reminded_by_user_id is not null;

alter table public.event_availability_reminders enable row level security;
grant select, insert, update, delete on public.event_availability_reminders to service_role;

drop trigger if exists rep_team_events_drop_availability on public.rep_team_events;
create trigger rep_team_events_drop_availability
  after delete on public.rep_team_events
  for each row execute function public.rep_team_events_drop_availability();

-- The one door to a send: claims the event's slot for 24 hours, or says when it was last claimed. Two coaches pressing at once:
-- the event's transaction-scoped advisory lock makes the second wait, then see the first's row and be refused.
create or replace function public.event_availability_remind_claim(
  p_kind text, p_event uuid, p_by uuid
) returns table (claimed boolean, reminder_id uuid, reminded_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_last timestamptz; v_id uuid; v_at timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('event_availability_remind:' || p_kind || ':' || p_event::text, 0));
  select r.reminded_at into v_last from public.event_availability_reminders r
   where r.event_kind = p_kind and r.event_id = p_event
   order by r.reminded_at desc limit 1;
  if v_last is not null and v_last > now() - interval '24 hours' then
    return query select false, null::uuid, v_last;
    return;
  end if;
  insert into public.event_availability_reminders (event_kind, event_id, reminded_by_user_id)
    values (p_kind, p_event, p_by)
    returning id, event_availability_reminders.reminded_at into v_id, v_at;
  return query select true, v_id, v_at;
end $$;
revoke all on function public.event_availability_remind_claim(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.event_availability_remind_claim(text, uuid, uuid) to service_role;

-- ── 4. The purge (ask 15, O4) ─────────────────────────────────────────────────────────────────────────────────────────────────
-- (a) a note's words go 30 days after its event (its end, else its start); (b) an answer goes 60 days after its season's LAST event
-- (the latest of any event's start and end in that season, so adding a game later moves the clock, and a mistyped end before the start
-- cannot pull the date earlier); (c) a rep answer whose event no
-- longer exists goes (the delete trigger covers it; this sweeps a straggler). The league kinds are unused in 4b and untouched.
-- Returns how many answers it deleted (the job's own record; nothing names a child). Idempotent.
create or replace function public.event_availability_purge() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_deleted integer;
begin
  update public.event_availability_answers a
     set note = null, updated_at = now()
    from public.rep_team_events e
   where a.event_kind = 'rep_event' and a.event_id = e.id and a.note is not null
     and greatest(e.starts_at, coalesce(e.ends_at, e.starts_at)) < now() - interval '30 days';

  with season_end as (
    select e.program_year_id, max(greatest(e.starts_at, coalesce(e.ends_at, e.starts_at))) as last_at
      from public.rep_team_events e
     group by e.program_year_id
  ), due as (
    select a.id
      from public.event_availability_answers a
      join public.rep_team_events e on e.id = a.event_id
      join season_end s on s.program_year_id = e.program_year_id
     where a.event_kind = 'rep_event' and s.last_at < now() - interval '60 days'
    union
    select a.id
      from public.event_availability_answers a
     where a.event_kind = 'rep_event'
       and not exists (select 1 from public.rep_team_events e where e.id = a.event_id)
  ), gone as (
    delete from public.event_availability_answers a using due where a.id = due.id returning 1
  )
  select count(*) into v_deleted from gone;

  -- The Remind log (counts and the coach who pressed; no child) goes with its season, by the same rule: first the rows whose event
  -- is gone, then the rows of a season whose last event is over 60 days ago (two plain statements, no per-row subplan).
  delete from public.event_availability_reminders r
   where r.event_kind = 'rep_event'
     and not exists (select 1 from public.rep_team_events e where e.id = r.event_id);

  delete from public.event_availability_reminders r
   using public.rep_team_events e,
         (select program_year_id, max(greatest(starts_at, coalesce(ends_at, starts_at))) as last_at
            from public.rep_team_events group by program_year_id) s
   where r.event_kind = 'rep_event' and e.id = r.event_id
     and s.program_year_id = e.program_year_id and s.last_at < now() - interval '60 days';

  return v_deleted;
end $$;
revoke all on function public.event_availability_purge() from public, anon, authenticated;
grant execute on function public.event_availability_purge() to service_role;

commit;

notify pgrst, 'reload schema';
