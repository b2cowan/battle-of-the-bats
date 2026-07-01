-- Migration 166: tryout EVALUATION RUBRIC (scorecard) + the bib-uniqueness safeguard.
-- Phase 2B foundation. See DB_ARCHITECTURE_REVIEW Finding #30 (rubric anchors on rep_tryouts).
--
-- rep_tryout_rubrics — the scorecard for a tryout (1 per tryout). categories JSONB holds the whole
--   rubric so the shape can evolve without migrations; scale_max is 5 or 10. Cloning a prior
--   tryout's rubric is an app-level copy (no separate template table for V1).
--     tryout_id       → rep_tryouts.id, NOT NULL, UNIQUE (one rubric per tryout)
--     program_year_id, team_id, org_id → denormalized NOT NULL (rep_* leaf; one-hop org scoping)
--     name            → text (e.g. "U15 AAA tryout scorecard")
--     scale_max       → smallint NOT NULL DEFAULT 5 (CHECK 5 or 10)
--     categories      → jsonb NOT NULL DEFAULT '[]' : [{ key, label, weight, instructions? }]
--   RLS ENABLED, no policies (service-role only) — matches the rep_tryouts/sessions posture.
--
-- bib-uniqueness (closes the 2A review's flagged duplicate-bib race): a PARTIAL unique index on
--   (program_year_id, bib_number) WHERE bib_number IS NOT NULL. First NULL out any existing
--   duplicate bibs (keep the earliest-submitted, blank the rest — they get reassigned on next
--   check-in load) so the index can never fail to build. NULLs are allowed to repeat (unbibbed
--   candidates), so the partial index is correct.
--
-- Additive / non-destructive (the dedup only blanks duplicate bib_numbers, never deletes rows).
-- Apply to dev + prod together before promoting rubric/scoring code.

-- ── rep_tryout_rubrics ───────────────────────────────────────────────────────
create table if not exists public.rep_tryout_rubrics (
  id                uuid primary key default gen_random_uuid(),
  tryout_id         uuid not null references public.rep_tryouts(id) on delete cascade,
  program_year_id   uuid not null references public.rep_program_years(id) on delete cascade,
  team_id           uuid not null references public.rep_teams(id) on delete cascade,
  org_id            uuid not null references public.organizations(id) on delete cascade,
  name              text,
  scale_max         smallint not null default 5 check (scale_max in (5, 10)),
  categories        jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists rep_tryout_rubrics_tryout_uq on public.rep_tryout_rubrics (tryout_id);
create index if not exists rep_tryout_rubrics_org_idx  on public.rep_tryout_rubrics (org_id);
create index if not exists rep_tryout_rubrics_team_idx on public.rep_tryout_rubrics (team_id);

alter table public.rep_tryout_rubrics enable row level security;

-- ── bib uniqueness (dedup first, then the partial unique index) ───────────────
with ranked as (
  select id,
         row_number() over (partition by program_year_id, bib_number order by submitted_at, id) as rn
  from public.rep_tryout_registrations
  where bib_number is not null
)
update public.rep_tryout_registrations r
   set bib_number = null
  from ranked
 where ranked.id = r.id
   and ranked.rn > 1;

create unique index if not exists rep_tryout_registrations_bib_uq
  on public.rep_tryout_registrations (program_year_id, bib_number)
  where bib_number is not null;
