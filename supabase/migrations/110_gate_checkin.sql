-- Migration 110: gate / team check-in + tournament roster players
-- Adds game-day check-in state to tournament teams and a proper roster table
-- (replaces the vestigial teams.players jsonb flagged by DB review 2026-05-23).

-- ── Team check-in state (per-tournament team row) ──────────────────────────
alter table public.teams
  add column if not exists check_in_status text not null default 'not_arrived',
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by_user_id uuid,
  add column if not exists checked_in_by_name text,
  add column if not exists roster_submitted_at timestamptz,
  add column if not exists roster_confirmed_at timestamptz,
  add column if not exists payment_collected_at timestamptz,
  add column if not exists check_in_notes text;

-- Guard the arrival status (idempotent: drop then re-add).
alter table public.teams
  drop constraint if exists teams_check_in_status_check;
alter table public.teams
  add constraint teams_check_in_status_check
  check (check_in_status in ('not_arrived', 'checked_in', 'no_show'));

-- ── Tournament roster players (coach-submitted or gate-captured) ────────────
create table if not exists public.tournament_roster_players (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  jersey_number text,
  date_of_birth date,
  position text,
  notes text,
  source text not null default 'coach',
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_roster_players_source_check
    check (source in ('coach', 'gate', 'admin'))
);

create index if not exists idx_tournament_roster_players_team
  on public.tournament_roster_players(team_id);
create index if not exists idx_tournament_roster_players_tournament
  on public.tournament_roster_players(tournament_id);
create index if not exists idx_tournament_roster_players_org
  on public.tournament_roster_players(org_id);

alter table public.tournament_roster_players enable row level security;

comment on table public.tournament_roster_players is
  'Tournament team rosters (player name, jersey #, DOB). Coach-submitted ahead of game day or captured at the gate. Replaces the vestigial teams.players jsonb.';
comment on column public.teams.check_in_status is
  'Game-day arrival status: not_arrived | checked_in | no_show.';
comment on column public.teams.payment_collected_at is
  'Set when an outstanding fee was collected at the gate (payment_status flips to paid).';
