-- Migration 165: dedicated TRYOUT SURFACE foundation (Coaches Portal Tryouts & Evaluation, Phase 2A).
-- Backs the tryout workspace that owns the tryout cycle's config + its scheduled date/time blocks,
-- kept OUT of rep_team_events (game-day) so tryouts never pollute game history / W-L / "next event".
-- See DB_ARCHITECTURE_REVIEW Finding #30 (2026-06-30).
--
-- rep_tryouts — the tryout/evaluation workspace, 1:1 with a program year (intentional subsystem
--   root; the clean FK anchor for sessions now and rubrics/evaluator-sessions/scores in Phase 2B):
--     program_year_id  → rep_program_years.id, NOT NULL, UNIQUE (one tryout cycle per season)
--     team_id, org_id  → denormalized (rep_* leaf pattern; reaches org_id in ONE hop for RLS/queries)
--     is_anonymous     → boolean NOT NULL DEFAULT true — BLIND evaluation default-ON
--     scores_locked_at / scores_locked_by → reserved for the Phase 2B one-way score lock / reveal
--
-- rep_tryout_sessions — the scheduled date/time/location blocks (one row per block = multi-day
--   support); the schedule view PROJECTS these onto the calendar at read time (no fake event row):
--     tryout_id        → rep_tryouts.id, NOT NULL
--     program_year_id, team_id, org_id → denormalized NOT NULL (one-hop org scoping)
--     starts_at NOT NULL, ends_at, location, location_address, field_number, label
--     status           → text NOT NULL DEFAULT 'scheduled' CHECK ('scheduled'|'cancelled')
--                        (allowed values app-enforced + CHECK, mirrors rep_team_events.status)
--
-- rep_tryout_registrations (ALTER) — candidate day-of fields (V1 = one bib/check-in per candidate
--   per tryout; per-session check-in join table deferred):
--     bib_number       → text (allows alpha bibs; app sorts numerically), nullable
--     is_checked_in    → boolean NOT NULL DEFAULT false
--     checked_in_at    → timestamptz, nullable
--
-- RLS: rep_tryouts + rep_tryout_sessions ENABLE ROW LEVEL SECURITY with NO policies — all access is
--   service-role (which bypasses RLS); anon/authenticated then read ZERO rows via REST. Without this,
--   prod anon's default SELECT grant would leak tryout data (reference_supabase_rls_grants). Matches
--   the existing rep_tryout_registrations posture (verified RLS=ENABLED, dev+prod).
--
-- Additive / non-destructive, IF NOT EXISTS, no data change, no backfill.
-- Apply to dev + prod together before promoting any tryout-surface code.

-- ── rep_tryouts ──────────────────────────────────────────────────────────────
create table if not exists public.rep_tryouts (
  id                uuid primary key default gen_random_uuid(),
  program_year_id   uuid not null references public.rep_program_years(id) on delete cascade,
  team_id           uuid not null references public.rep_teams(id) on delete cascade,
  org_id            uuid not null references public.organizations(id) on delete cascade,
  is_anonymous      boolean not null default true,
  scores_locked_at  timestamptz,
  scores_locked_by  uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists rep_tryouts_program_year_uq on public.rep_tryouts (program_year_id);
create index if not exists rep_tryouts_org_idx  on public.rep_tryouts (org_id);
create index if not exists rep_tryouts_team_idx on public.rep_tryouts (team_id);

alter table public.rep_tryouts enable row level security;

-- ── rep_tryout_sessions ──────────────────────────────────────────────────────
create table if not exists public.rep_tryout_sessions (
  id                uuid primary key default gen_random_uuid(),
  tryout_id         uuid not null references public.rep_tryouts(id) on delete cascade,
  program_year_id   uuid not null references public.rep_program_years(id) on delete cascade,
  team_id           uuid not null references public.rep_teams(id) on delete cascade,
  org_id            uuid not null references public.organizations(id) on delete cascade,
  starts_at         timestamptz not null,
  ends_at           timestamptz,
  location          text,
  location_address  text,
  field_number      text,
  label             text,
  status            text not null default 'scheduled' check (status in ('scheduled','cancelled')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists rep_tryout_sessions_tryout_idx on public.rep_tryout_sessions (tryout_id);
create index if not exists rep_tryout_sessions_org_idx    on public.rep_tryout_sessions (org_id);
create index if not exists rep_tryout_sessions_team_idx   on public.rep_tryout_sessions (team_id);
create index if not exists rep_tryout_sessions_year_idx   on public.rep_tryout_sessions (program_year_id);
create index if not exists rep_tryout_sessions_starts_idx on public.rep_tryout_sessions (starts_at);

alter table public.rep_tryout_sessions enable row level security;

-- ── rep_tryout_registrations: candidate day-of fields ────────────────────────
alter table public.rep_tryout_registrations
  add column if not exists bib_number text;

alter table public.rep_tryout_registrations
  add column if not exists is_checked_in boolean not null default false;

alter table public.rep_tryout_registrations
  add column if not exists checked_in_at timestamptz;
