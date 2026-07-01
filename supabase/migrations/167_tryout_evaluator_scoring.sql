-- Migration 167: multi-evaluator tryout scoring (Phase 2B.2).
-- Two tables anchored on rep_tryouts (DB_ARCHITECTURE_REVIEW Finding #30). Both RLS-enabled, no
-- policies (service-role only) — the head-coach dashboard reads via the coach API and POLLS for
-- "live" updates (the portal uses no client Realtime), so NO realtime publication / REPLICA
-- IDENTITY is needed here; keeping the tables off Realtime also avoids exposing minors' scores to a
-- client RLS-SELECT policy.
--
-- rep_tryout_evaluator_sessions — a no-account co-coach scoring link:
--     tryout_id      → rep_tryouts.id NOT NULL; program_year_id/team_id/org_id denormalized NOT NULL
--     evaluator_name → text (who's scoring, for attribution + the bias view)
--     token_hash     → text NOT NULL UNIQUE — SHA-256 of the link token (raw token never stored)
--     expires_at     → timestamptz NOT NULL (≤48h from creation, app-enforced)
--     revoked_at     → timestamptz null — head coach can revoke; checked server-side on every write
--
-- rep_tryout_scores — one score per (evaluator session × candidate × rubric category):
--     evaluator_session_id → rep_tryout_evaluator_sessions.id NOT NULL
--     registration_id      → rep_tryout_registrations.id NOT NULL (the candidate)
--     tryout_id, program_year_id, team_id, org_id → denormalized NOT NULL (one-hop scoping)
--     category_key   → text NOT NULL (matches a rep_tryout_rubrics.categories[].key)
--     score          → smallint NOT NULL, note → text null
--     UNIQUE (evaluator_session_id, registration_id, category_key) — upsert, never duplicate rows
--
-- Additive / non-destructive, IF NOT EXISTS. Apply to dev + prod together before promoting scoring.

-- ── rep_tryout_evaluator_sessions ────────────────────────────────────────────
create table if not exists public.rep_tryout_evaluator_sessions (
  id                uuid primary key default gen_random_uuid(),
  tryout_id         uuid not null references public.rep_tryouts(id) on delete cascade,
  program_year_id   uuid not null references public.rep_program_years(id) on delete cascade,
  team_id           uuid not null references public.rep_teams(id) on delete cascade,
  org_id            uuid not null references public.organizations(id) on delete cascade,
  evaluator_name    text,
  token_hash        text not null,
  expires_at        timestamptz not null,
  revoked_at        timestamptz,
  created_at        timestamptz not null default now()
);

create unique index if not exists rep_tryout_evaluator_sessions_token_uq on public.rep_tryout_evaluator_sessions (token_hash);
create index if not exists rep_tryout_evaluator_sessions_tryout_idx on public.rep_tryout_evaluator_sessions (tryout_id);
create index if not exists rep_tryout_evaluator_sessions_org_idx    on public.rep_tryout_evaluator_sessions (org_id);

alter table public.rep_tryout_evaluator_sessions enable row level security;

-- ── rep_tryout_scores ────────────────────────────────────────────────────────
create table if not exists public.rep_tryout_scores (
  id                    uuid primary key default gen_random_uuid(),
  evaluator_session_id  uuid not null references public.rep_tryout_evaluator_sessions(id) on delete cascade,
  registration_id       uuid not null references public.rep_tryout_registrations(id) on delete cascade,
  tryout_id             uuid not null references public.rep_tryouts(id) on delete cascade,
  program_year_id       uuid not null references public.rep_program_years(id) on delete cascade,
  team_id               uuid not null references public.rep_teams(id) on delete cascade,
  org_id                uuid not null references public.organizations(id) on delete cascade,
  category_key          text not null,
  score                 smallint not null constraint rep_tryout_scores_score_check check (score between 1 and 10),
  note                  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (evaluator_session_id, registration_id, category_key)
);

create index if not exists rep_tryout_scores_tryout_idx on public.rep_tryout_scores (tryout_id);
create index if not exists rep_tryout_scores_reg_idx    on public.rep_tryout_scores (registration_id);
create index if not exists rep_tryout_scores_org_idx    on public.rep_tryout_scores (org_id);

alter table public.rep_tryout_scores enable row level security;

-- Idempotent add of the score-range CHECK for environments where the table already exists (dev was
-- created before this constraint). Fresh installs already have it from the inline constraint above.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rep_tryout_scores_score_check') then
    alter table public.rep_tryout_scores
      add constraint rep_tryout_scores_score_check check (score between 1 and 10);
  end if;
end $$;
