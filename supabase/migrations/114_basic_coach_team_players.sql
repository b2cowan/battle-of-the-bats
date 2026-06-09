-- Migration 114: basic coach team players (persistent master roster — free coach floor)
-- Phase 3 of the Free Tier + Coaches project. The reusable, IDENTITY-ONLY roster that lives on
-- the org-less basic_coach_team. A coach enters players once and reuses them across events.
-- Identity fields only (name / jersey # / optional guardian contact / optional DOB) — attendance,
-- lineups, positions, dues automation, budgets, and documents stay Premium and are intentionally
-- absent here. Upgrade-ready: when a team upgrades to a paid workspace, the master seeds the
-- workspace roster via basic_coach_teams.team_workspace_id (wired in a later phase). The per-event
-- submission/snapshot into tournament_roster_players (mig 110) is Phase 5, NOT this migration.

create table if not exists public.basic_coach_team_players (
  id uuid primary key default gen_random_uuid(),
  basic_coach_team_id uuid not null references public.basic_coach_teams(id) on delete cascade,
  name text not null,
  jersey_number text,
  date_of_birth date,
  guardian_name text,
  contact_email text,
  contact_phone text,
  notes text,
  display_order integer not null default 0,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists basic_coach_team_players_team_idx
  on public.basic_coach_team_players(basic_coach_team_id);

alter table public.basic_coach_team_players enable row level security;

comment on table public.basic_coach_team_players is
  'Persistent master roster for org-less basic_coach_teams (free coach floor, Phase 3). Identity only: name, jersey #, optional guardian/parent contact, optional DOB, free-text note + display_order. NOT attendance/lineups/positions/dues/documents (all Premium). Snapshotted per-event into tournament_roster_players (mig 110) in Phase 5. RLS enabled with no policies = service-role-only; ownership is enforced in app code via basic_coach_team_users (membership-keyed on user_id).';
comment on column public.basic_coach_team_players.date_of_birth is
  'OPTIONAL, purpose-driven. Never a default field in the editor — surfaced only behind an explicit opt-in with a guardian-consent acknowledgment (minor-PII control, FT strategy §5/§14). Some tournaments require player ages for division eligibility. A persisted consent audit trail is deferred to Phase 8.';
comment on column public.basic_coach_team_players.contact_email is
  'OPTIONAL guardian/parent contact. Powers Phase 4 basic team comms (announce to parents); parents are contacts, not accounts.';
comment on column public.basic_coach_team_players.display_order is
  'Coach-controlled list display order (NOT a lineup/batting order — that is Premium). Lower sorts first.';
