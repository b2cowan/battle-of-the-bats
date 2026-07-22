-- Migration 196: Rep team ↔ tournament registration link (WI-2C, Tournament Seam P2)
--
-- The paid-portal analogue of `basic_coach_team_registrations` (mig 091): an explicit
-- link from a tournament registration (`teams` row) to a rep team (`rep_teams`). Its
-- existence is what lets the public tournament page recognize a rep-portal coach whose
-- registration contact email does NOT match their account (the org registered under a
-- generic office email). Query-time email-match (Layer 1) needs no row; THIS table is
-- Layer 2 — populated by a passive admin "Link to rep team" control and a one-time
-- backfill tool. Never an email match; never auto-linked.
--
-- Scoping: `teams` has no org_id (it reaches org via tournament_id → tournaments.org_id),
-- so org_id is denormalized here for the 1-hop tenant rule + RLS/query scope. Both sides
-- are org-checked by the writing endpoint (rep_teams.org_id === ctx.org AND the tournament
-- is in ctx.org); the resolver additionally org-scopes on THIS table's own org_id.

create table if not exists public.rep_team_tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_team_id uuid not null references public.teams(id) on delete cascade,
  rep_team_id uuid not null references public.rep_teams(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  linked_by_user_id uuid references auth.users(id) on delete set null,
  link_source text not null default 'explicit',
  created_at timestamptz not null default now(),
  constraint rep_team_tournament_registrations_source_check
    check (link_source in ('explicit', 'backfill'))
);

-- A registration links to AT MOST ONE rep team (mirrors the basic bridge's UNIQUE).
create unique index if not exists rep_team_tournament_registrations_tournament_team_unique
  on public.rep_team_tournament_registrations(tournament_team_id);

-- Reverse lookup (a rep team's linked registrations).
create index if not exists rep_team_tournament_registrations_rep_team_idx
  on public.rep_team_tournament_registrations(rep_team_id);

-- Tenant scope (org_id index — multi-tenant rule).
create index if not exists rep_team_tournament_registrations_org_idx
  on public.rep_team_tournament_registrations(org_id);

comment on table public.rep_team_tournament_registrations is
  'Explicit links from rep teams (rep_teams) to tournament registrations (teams). The Layer-2 identity bridge that lets public tournament pages recognize a paid-portal coach whose registration email does not match their account. Populated by an admin link control + a one-time backfill; never an email match, never auto-linked. Paid-portal analogue of basic_coach_team_registrations.';

comment on column public.rep_team_tournament_registrations.tournament_team_id is
  'FK → teams.id (the tournament registration). UNIQUE — a registration links to at most one rep team.';

comment on column public.rep_team_tournament_registrations.rep_team_id is
  'FK → rep_teams.id (the paid-portal team the registration belongs to).';

comment on column public.rep_team_tournament_registrations.org_id is
  'Denormalized tenant scope (teams has no org_id). Must equal both tournaments.org_id of the registration and rep_teams.org_id; enforced by the writing endpoint.';

comment on column public.rep_team_tournament_registrations.linked_by_user_id is
  'Audit of who created the link (SET NULL on user delete so the link survives). explicit = an admin linked it; backfill = the one-time candidate-match tool.';

-- Service-role posture: RLS enabled with NO policies so anon/authenticated get zero rows
-- via PostgREST (prod anon has a default SELECT grant); all access is supabaseAdmin, which
-- bypasses RLS. Same posture as basic_coach_team_registrations / rep_tryouts.
alter table public.rep_team_tournament_registrations enable row level security;
