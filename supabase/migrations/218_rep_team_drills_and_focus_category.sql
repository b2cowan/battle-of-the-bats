-- Migration 218: the drill library (Practice Plans, Phase 2) + an optional category on focus areas.
--
-- ────────────────────────────────────────────────────────────────────────────────────────────
-- rep_team_drills — a coach's reusable drill, and a club's shared set, in ONE table.
-- ────────────────────────────────────────────────────────────────────────────────────────────
--
-- A drill is the SHAPE of one activity and its TEACHING, and nothing else: name, coach-typed
-- category, usual length, what you're doing, what you're watching for, coaching points, setup and
-- equipment. It carries NO PEOPLE — no coaches, no players, no groups (plan decision D20). That
-- split is what keeps one drill working in April with twelve players and July with nine, and it is
-- why the library never goes stale when the roster turns over.
--
-- ⚠ A DRILL IS ONE ACTIVITY — one station's worth (owner ruling 2026-08-01, confirming §10.4 item 6
-- "a station IS the drill"). There is deliberately no nested station list here. Picking one drill
-- while adding a block gives a block with that activity in it; picking a second into the SAME block
-- produces two stations, which is precisely when `blockRotates` starts returning true and the
-- carousel appears. Three drills, three stations, a rotation — assembled by picking, with no second
-- kind of block anywhere in the model.
--
-- ⚠ THERE IS NO `count` COLUMN (owner ruling 2026-08-01). "How many of it" would be 1 almost every
-- time; a coach who wants three of something adds the drill three times or says so in the station's
-- "just for tonight" note. The same ruling RETIRES the station-level `count` that slice 1a shipped
-- (a jsonb field, so no schema change here — see lib/rep-practice-plan.ts).
--
-- TEAM ROWS vs ORG-SHARED ROWS — `team_id` is NULLABLE, and that is the whole club-wide story:
--   · team_id SET  → this team's own private drill.
--   · team_id NULL → an ORG-AUTHORED shared drill (org_id set), surfaced in EVERY team's picker
--                    beside their own. Coaches may use it; only an org owner/admin may write it.
-- This is the exact shape mig 184 gave rep_team_tags + rep_team_award_types, adopted UP FRONT here
-- rather than retro-fitted, per the owner's "both now" ruling (BUSINESS_DECISIONS.md 2026-08-01).
-- Postgres treats NULLs as DISTINCT in a plain unique index, so the per-team index below does NOT
-- constrain shared rows — they get their own partial index, exactly as mig 184 had to add.
--
-- NEVER HARD-DELETED (the mig-182/189 library idiom): "retire" is is_active=false. Retiring keeps
-- every practice plan the drill already sits in working untouched, and a retired name can be reused
-- because both unique indexes are PARTIAL on is_active.
--
-- ⚠ A PLAN NEVER DEPENDS ON THIS TABLE TO RENDER. When a drill is added to a practice, its words are
-- COPIED into the plan's jsonb and the drill's id is stored alongside as provenance only. So:
-- editing a drill later never rewrites a practice already written, a retired drill keeps reading
-- correctly for ever, and there is no dangling-id class of bug of the kind §10.3 refused for staff
-- tags. The id exists to answer "used 8x", nothing more.
--
-- NOT SEEDED, EVER. The library ships EMPTY and every category is coach-typed. A supplied
-- "Hitting / Fielding / Pitching" list is one sport talking to a platform that serves many
-- (sport-neutrality rule; mirrors gotcha 4 on rep_team_measurable_types).
--
-- ────────────────────────────────────────────────────────────────────────────────────────────
-- rep_player_development_goals.category — the one genuinely new thing on the development side (D16)
-- ────────────────────────────────────────────────────────────────────────────────────────────
--
-- Optional, coach-typed, drawn from the same vocabulary the coach already used on their drills so
-- the two can actually match. It exists so the focus rail can lead with the areas relevant to the
-- kind of practice being written.
--
-- ⚠ NON-MATCHING AREAS DIM, THEY NEVER HIDE (owner ruling, confirming D16 and §4), and an
-- uncategorised area or a player with nothing set always shows at full strength. A player whose
-- only focus areas are off-type must never vanish from a coverage list — that is precisely the
-- child most likely to be overlooked. Nullable by design: nothing is back-filled and nothing is
-- guessed from keywords, because free text does not cluster and the grouping would be a confident
-- lie (§4).
--
-- ────────────────────────────────────────────────────────────────────────────────────────────
-- RLS posture — a deliberate answer, not a default (reference_supabase_rls_grants)
-- ────────────────────────────────────────────────────────────────────────────────────────────
--
-- Every read/write in the app goes through the service-role client, which bypasses RLS entirely.
-- These policies therefore exist to stop a DIRECT PostgREST call from a signed-in browser session,
-- which on prod has default SELECT grants. They encode the REAL write rule rather than a looser one
-- (the mig-141 chat-engine lesson):
--   · TEAM rows  → writes are HEAD-COACH-ONLY, matching canWriteDevelopment at the app layer.
--   · SHARED rows → writes are ORG-ADMIN-ONLY. The head-coach policies key on team_id, which is NULL
--                   on a shared row and therefore never matches — so a coach cannot create, rename
--                   or retire a club drill even by hand-rolling a request.
--   · READS → org members, plus coaches for their assigned teams, plus coaches for their org's
--             SHARED rows (a separate policy: the team_id predicate can never match NULL).
-- No DELETE policies at all — retire is an UPDATE.
--
-- Every CREATE POLICY is preceded by DROP POLICY IF EXISTS so this migration is safely re-runnable
-- (migs 141/148/149/189 convention).
--
-- DEV-ONLY at author time; ⚠ PROD-PENDING — apply to prod at release BEFORE promoting code that
-- reads this table (else prod 500s), per the "migration-040 incident" lesson. ⚠ Ships alongside
-- still-pending mig 213 (practice plans) — 213 must be applied first, since Phase 2 is meaningless
-- without the column it adds.

-- ============================================================
-- 1. rep_team_drills
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rep_team_drills (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- NULL = an org-authored shared drill. See the header.
  team_id         uuid        REFERENCES public.rep_teams(id) ON DELETE CASCADE,
  name            text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  category        text        CHECK (category IS NULL OR char_length(btrim(category)) BETWEEN 1 AND 40),
  -- ONE number. Duration RANGES were removed at owner QA (§10.5) and must not return through the
  -- library's back door.
  usual_minutes   int         CHECK (usual_minutes IS NULL OR (usual_minutes > 0 AND usual_minutes <= 600)),
  description     text        CHECK (description IS NULL OR char_length(description) <= 600),
  goal            text        CHECK (goal IS NULL OR char_length(goal) <= 600),
  coaching_points jsonb       NOT NULL DEFAULT '[]'::jsonb
                              CHECK (jsonb_typeof(coaching_points) = 'array' AND jsonb_array_length(coaching_points) <= 8),
  setup           text        CHECK (setup IS NULL OR char_length(setup) <= 600),
  equipment       jsonb       NOT NULL DEFAULT '[]'::jsonb
                              CHECK (jsonb_typeof(equipment) = 'array' AND jsonb_array_length(equipment) <= 12),
  is_active       boolean     NOT NULL DEFAULT true,
  sort_order      int         NOT NULL DEFAULT 0,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One ACTIVE name per team, case-insensitive (partial → a retired name can be reused).
CREATE UNIQUE INDEX IF NOT EXISTS rep_team_drills_team_name_uniq
  ON public.rep_team_drills(team_id, lower(btrim(name)))
  WHERE is_active AND team_id IS NOT NULL;

-- One ACTIVE shared name per org. Required separately: the index above cannot constrain shared rows
-- because Postgres treats NULL team_id values as DISTINCT (the mig-184 lesson, applied up front).
CREATE UNIQUE INDEX IF NOT EXISTS rep_team_drills_org_shared_name_uniq
  ON public.rep_team_drills(org_id, lower(btrim(name)))
  WHERE is_active AND team_id IS NULL;

CREATE INDEX IF NOT EXISTS rep_team_drills_team_idx
  ON public.rep_team_drills(team_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS rep_team_drills_org_idx
  ON public.rep_team_drills(org_id, is_active);

ALTER TABLE public.rep_team_drills ENABLE ROW LEVEL SECURITY;

-- ── Reads ──
DROP POLICY IF EXISTS "org members can read rep_team_drills" ON public.rep_team_drills;
CREATE POLICY "org members can read rep_team_drills"
  ON public.rep_team_drills FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "coaches can read assigned team drills" ON public.rep_team_drills;
CREATE POLICY "coaches can read assigned team drills"
  ON public.rep_team_drills FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

-- Separate by necessity: `team_id IN (…)` above is NULL-unknown on a shared row, so without this a
-- coach who is not also an org member could never see the club's shared set.
DROP POLICY IF EXISTS "coaches can read org shared drills" ON public.rep_team_drills;
CREATE POLICY "coaches can read org shared drills"
  ON public.rep_team_drills FOR SELECT
  USING (
    team_id IS NULL
    AND org_id IN (
      SELECT t.org_id FROM public.rep_team_coaches c
      JOIN public.rep_teams t ON t.id = c.team_id
      WHERE c.user_id = auth.uid()
    )
  );

-- ── Writes: TEAM rows are head-coach-only ──
-- team_id is NULL on a shared row, so neither policy can ever match one. That is the mechanism by
-- which a coach is prevented from writing the club's shared set.
DROP POLICY IF EXISTS "head coaches can insert rep_team_drills" ON public.rep_team_drills;
CREATE POLICY "head coaches can insert rep_team_drills"
  ON public.rep_team_drills FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid() AND coach_role = 'head_coach'
    )
  );

DROP POLICY IF EXISTS "head coaches can update rep_team_drills" ON public.rep_team_drills;
CREATE POLICY "head coaches can update rep_team_drills"
  ON public.rep_team_drills FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid() AND coach_role = 'head_coach'
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid() AND coach_role = 'head_coach'
    )
  );

-- ── Writes: org admins (the shared set, and their own org's team rows — mig 182 parity) ──
DROP POLICY IF EXISTS "org admins can insert rep_team_drills" ON public.rep_team_drills;
CREATE POLICY "org admins can insert rep_team_drills"
  ON public.rep_team_drills FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "org admins can update rep_team_drills" ON public.rep_team_drills;
CREATE POLICY "org admins can update rep_team_drills"
  ON public.rep_team_drills FOR UPDATE
  USING (
    org_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- No DELETE policies — a drill is never hard-deleted app-side (retire = UPDATE is_active).

-- ============================================================
-- 2. An optional category on a focus area (D16)
-- ============================================================

ALTER TABLE public.rep_player_development_goals
  ADD COLUMN IF NOT EXISTS category text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rep_player_development_goals_category_len'
  ) THEN
    ALTER TABLE public.rep_player_development_goals
      ADD CONSTRAINT rep_player_development_goals_category_len
      CHECK (category IS NULL OR char_length(btrim(category)) BETWEEN 1 AND 40);
  END IF;
END $$;

-- Nothing is back-filled. A NULL category means "the coach hasn't said", which the focus rail
-- renders at FULL strength — never dimmed, never hidden.
