-- Migration 115: basic coach team schedule events (lightweight team calendar — free coach floor)
-- Phase 4 of the Free Tier + Coaches project. The org-less schedule that lives on a basic_coach_team:
-- a coach adds practices and games; parents (roster contacts) are reached via comms (Phase 4c). It
-- flattens the simple half of rep_team_events (mig 021) and is org-less. Scheduling/identity fields
-- ONLY — NO scores, attendance, lineups, recurrence engine, or tournament-game nesting (all Premium /
-- the rep_team_events power-calendar). starts_at is the list/sort key (no manual ordering).

create table if not exists public.basic_coach_team_events (
  id uuid primary key default gen_random_uuid(),
  basic_coach_team_id uuid not null references public.basic_coach_teams(id) on delete cascade,
  event_type text not null default 'practice',
  title text not null,
  opponent text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  notes text,
  status text not null default 'scheduled',
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint basic_coach_team_events_type_check
    check (event_type in ('practice', 'game', 'event')),
  constraint basic_coach_team_events_status_check
    check (status in ('scheduled', 'cancelled'))
);

create index if not exists basic_coach_team_events_team_idx
  on public.basic_coach_team_events(basic_coach_team_id, starts_at);

alter table public.basic_coach_team_events enable row level security;

-- An event can't end before it starts. Added as an idempotent drop-then-add ALTER (not inline) so
-- re-applying this migration to the already-created dev table installs the constraint too.
alter table public.basic_coach_team_events
  drop constraint if exists basic_coach_team_events_time_check;
alter table public.basic_coach_team_events
  add constraint basic_coach_team_events_time_check
  check (ends_at is null or ends_at >= starts_at);

comment on table public.basic_coach_team_events is
  'Lightweight schedule for org-less basic_coach_teams (free coach floor, Phase 4). A coach adds practices/games; roster-contact parents are reached via comms (basic_coach_team_announcements, Phase 4c). Scheduling/identity fields only: type (practice|game|event), title, free-text opponent, location, start/end, free-text note, scheduled|cancelled status. NOT scores/attendance/lineups/recurrence/tournament-game nesting (all Premium — see rep_team_events). RLS enabled with no policies = service-role-only; ownership enforced in app code via basic_coach_team_users (membership-keyed on user_id). Keyed on basic_coach_team_id; org-less by design.';
comment on column public.basic_coach_team_events.event_type is
  'practice | game | event. ''game'' surfaces the opponent field in the editor; opponent is free text (a basic team only knows itself, not a second internal team row — unlike league_games home/away FKs).';
comment on column public.basic_coach_team_events.opponent is
  'OPTIONAL free-text opponent name for game-type events. No FK — structured matchups are Premium.';
comment on column public.basic_coach_team_events.starts_at is
  'Required event start. Primary list/sort key (ORDER BY starts_at). No recurrence engine in Basic — each session is its own row (cf. rep_team_events.recurrence_rule jsonb, Premium).';
comment on column public.basic_coach_team_events.status is
  'scheduled | cancelled. Defaults scheduled. (4a removes events via DELETE; the cancelled state is reserved for a future "notify parents it is off" flow.)';
