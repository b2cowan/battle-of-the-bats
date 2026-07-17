-- Migration 189: Player Development (Coaches Portal roadmap Phase 3, slice 3A) —
-- per-team measurable-type library + measurable entries + development focus goals.
--
-- The Development card on the player profile: free-text focus areas (IDP) with a status
-- pill, and coach-logged measurables (60-yd sprint, home-to-first, …) against a per-team
-- curated type library. Coach-facing ONLY — no public/parent surface (parent-users decision
-- deferred; same posture as roster data). Supportive-not-ranking + player-vs-self framing
-- is enforced app-side (roster-order lists, no cross-player sorts).
--
-- rep_team_measurable_types: the per-team curated library — mirrors rep_team_award_types
-- (mig 182) structurally: no app-side delete (retire = is_active flip so every logged entry
-- keeps resolving its type name), PARTIAL unique name index so a retired name can be reused.
-- `unit` lives on the type (seconds, mph, …) and is SNAPSHOTTED onto each entry at log time
-- so a later unit edit can't silently rewrite history.
--
-- rep_player_measurables: one dated reading (player + type + value + unit snapshot + note).
-- value is bounded (tryouts-review lesson: never an unconstrained numeric). Type FK is
-- ON DELETE RESTRICT — the entry IS the historical record (awards precedent).
-- (3B adds a nullable session_id column when Evaluation Sessions land — not in this slice.)
--
-- rep_player_development_goals: a coach's focus areas for one player — free text + status
-- (working|achieved|parked), no score/rank/percent by design. Dedicated table (NOT jsonb on
-- rep_roster_players) because slice 3D's cross-season carry-forward queries goals across the
-- player-row chain, and roster rows are minted fresh every season.
--
-- RLS posture (DIVERGES from mig 182 by design — Player Development decision D1):
-- ALL writes are HEAD-COACH-ONLY, enforced at BOTH layers. App routes gate on
-- canWriteDevelopment (isHeadCoach); these policies mirror that with coach_role =
-- 'head_coach' so a direct PostgREST call from an assistant's session can't bypass D1
-- (the mig-141 chat-engine lesson: RLS must encode the real write rule, not a looser one).
-- No org-admin write policies — no admin write surface exists, and if one is ever built it
-- goes through service-role routes (which bypass RLS) anyway. Org-member/coach READ policies
-- follow the standard rep_* family posture.
--
-- Every CREATE POLICY is preceded by DROP POLICY IF EXISTS so the migration is safely
-- re-runnable (migs 141/148/149 convention — a partial failure or re-apply never aborts
-- on "policy already exists").
--
-- DEV-ONLY at author time; ⚠ PROD-PENDING — apply to prod at release before promoting code
-- that reads these tables (else prod 500s), per the "migration-040 incident" lesson.

CREATE TABLE IF NOT EXISTS public.rep_team_measurable_types (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id     uuid        NOT NULL REFERENCES public.rep_teams(id) ON DELETE CASCADE,
  name        text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  unit        text        NOT NULL CHECK (char_length(btrim(unit)) BETWEEN 1 AND 20),
  sort_order  int         NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One active name per team, case-insensitive (partial → a retired name can be reused).
CREATE UNIQUE INDEX IF NOT EXISTS rep_team_measurable_types_name_uniq
  ON public.rep_team_measurable_types(team_id, lower(btrim(name)))
  WHERE is_active;

CREATE INDEX IF NOT EXISTS rep_team_measurable_types_team_idx
  ON public.rep_team_measurable_types(team_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS rep_team_measurable_types_org_idx
  ON public.rep_team_measurable_types(org_id);

ALTER TABLE public.rep_team_measurable_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can read rep_team_measurable_types" ON public.rep_team_measurable_types;
CREATE POLICY "org members can read rep_team_measurable_types"
  ON public.rep_team_measurable_types FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "coaches can read assigned team measurable types" ON public.rep_team_measurable_types;
CREATE POLICY "coaches can read assigned team measurable types"
  ON public.rep_team_measurable_types FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "coaches can insert rep_team_measurable_types" ON public.rep_team_measurable_types;
DROP POLICY IF EXISTS "head coaches can insert rep_team_measurable_types" ON public.rep_team_measurable_types;
CREATE POLICY "head coaches can insert rep_team_measurable_types"
  ON public.rep_team_measurable_types FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid() AND coach_role = 'head_coach'
    )
  );

DROP POLICY IF EXISTS "coaches can update rep_team_measurable_types" ON public.rep_team_measurable_types;
DROP POLICY IF EXISTS "head coaches can update rep_team_measurable_types" ON public.rep_team_measurable_types;
CREATE POLICY "head coaches can update rep_team_measurable_types"
  ON public.rep_team_measurable_types FOR UPDATE
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

DROP POLICY IF EXISTS "org admins can insert rep_team_measurable_types" ON public.rep_team_measurable_types;
DROP POLICY IF EXISTS "org admins can update rep_team_measurable_types" ON public.rep_team_measurable_types;

-- No DELETE policies — types are never hard-deleted app-side (retire = UPDATE is_active).

-- ============================================================
-- rep_player_measurables — one dated reading
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rep_player_measurables (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id             uuid          NOT NULL REFERENCES public.rep_teams(id) ON DELETE CASCADE,
  player_id           uuid          NOT NULL REFERENCES public.rep_roster_players(id) ON DELETE CASCADE,
  measurable_type_id  uuid          NOT NULL REFERENCES public.rep_team_measurable_types(id) ON DELETE RESTRICT,
  value               numeric(8,3)  NOT NULL CHECK (value >= 0 AND value <= 99999),
  unit                text          NOT NULL CHECK (char_length(btrim(unit)) BETWEEN 1 AND 20),
  recorded_on         date          NOT NULL,
  note                text          CHECK (note IS NULL OR char_length(note) <= 200),
  created_by          uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rep_player_measurables_player_idx
  ON public.rep_player_measurables(player_id, measurable_type_id, recorded_on DESC);
CREATE INDEX IF NOT EXISTS rep_player_measurables_team_idx
  ON public.rep_player_measurables(team_id, recorded_on DESC);
CREATE INDEX IF NOT EXISTS rep_player_measurables_type_idx
  ON public.rep_player_measurables(measurable_type_id);
CREATE INDEX IF NOT EXISTS rep_player_measurables_org_idx
  ON public.rep_player_measurables(org_id);

ALTER TABLE public.rep_player_measurables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can read rep_player_measurables" ON public.rep_player_measurables;
CREATE POLICY "org members can read rep_player_measurables"
  ON public.rep_player_measurables FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "coaches can read assigned team measurables" ON public.rep_player_measurables;
CREATE POLICY "coaches can read assigned team measurables"
  ON public.rep_player_measurables FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "coaches can insert rep_player_measurables" ON public.rep_player_measurables;
DROP POLICY IF EXISTS "head coaches can insert rep_player_measurables" ON public.rep_player_measurables;
CREATE POLICY "head coaches can insert rep_player_measurables"
  ON public.rep_player_measurables FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid() AND coach_role = 'head_coach'
    )
  );

DROP POLICY IF EXISTS "coaches can update rep_player_measurables" ON public.rep_player_measurables;
DROP POLICY IF EXISTS "head coaches can update rep_player_measurables" ON public.rep_player_measurables;
CREATE POLICY "head coaches can update rep_player_measurables"
  ON public.rep_player_measurables FOR UPDATE
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

DROP POLICY IF EXISTS "coaches can delete rep_player_measurables" ON public.rep_player_measurables;
DROP POLICY IF EXISTS "head coaches can delete rep_player_measurables" ON public.rep_player_measurables;
CREATE POLICY "head coaches can delete rep_player_measurables"
  ON public.rep_player_measurables FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid() AND coach_role = 'head_coach'
    )
  );

DROP POLICY IF EXISTS "org admins can insert rep_player_measurables" ON public.rep_player_measurables;
DROP POLICY IF EXISTS "org admins can update rep_player_measurables" ON public.rep_player_measurables;
DROP POLICY IF EXISTS "org admins can delete rep_player_measurables" ON public.rep_player_measurables;

-- ============================================================
-- rep_player_development_goals — focus areas (IDP)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rep_player_development_goals (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id     uuid        NOT NULL REFERENCES public.rep_teams(id) ON DELETE CASCADE,
  player_id   uuid        NOT NULL REFERENCES public.rep_roster_players(id) ON DELETE CASCADE,
  focus_area  text        NOT NULL CHECK (char_length(btrim(focus_area)) BETWEEN 1 AND 80),
  note        text        CHECK (note IS NULL OR char_length(note) <= 280),
  status      text        NOT NULL DEFAULT 'working' CHECK (status IN ('working', 'achieved', 'parked')),
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rep_player_development_goals_player_idx
  ON public.rep_player_development_goals(player_id, status, created_at);
CREATE INDEX IF NOT EXISTS rep_player_development_goals_team_idx
  ON public.rep_player_development_goals(team_id);
CREATE INDEX IF NOT EXISTS rep_player_development_goals_org_idx
  ON public.rep_player_development_goals(org_id);

ALTER TABLE public.rep_player_development_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can read rep_player_development_goals" ON public.rep_player_development_goals;
CREATE POLICY "org members can read rep_player_development_goals"
  ON public.rep_player_development_goals FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "coaches can read assigned team development goals" ON public.rep_player_development_goals;
CREATE POLICY "coaches can read assigned team development goals"
  ON public.rep_player_development_goals FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "coaches can insert rep_player_development_goals" ON public.rep_player_development_goals;
DROP POLICY IF EXISTS "head coaches can insert rep_player_development_goals" ON public.rep_player_development_goals;
CREATE POLICY "head coaches can insert rep_player_development_goals"
  ON public.rep_player_development_goals FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid() AND coach_role = 'head_coach'
    )
  );

DROP POLICY IF EXISTS "coaches can update rep_player_development_goals" ON public.rep_player_development_goals;
DROP POLICY IF EXISTS "head coaches can update rep_player_development_goals" ON public.rep_player_development_goals;
CREATE POLICY "head coaches can update rep_player_development_goals"
  ON public.rep_player_development_goals FOR UPDATE
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

DROP POLICY IF EXISTS "coaches can delete rep_player_development_goals" ON public.rep_player_development_goals;
DROP POLICY IF EXISTS "head coaches can delete rep_player_development_goals" ON public.rep_player_development_goals;
CREATE POLICY "head coaches can delete rep_player_development_goals"
  ON public.rep_player_development_goals FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid() AND coach_role = 'head_coach'
    )
  );

DROP POLICY IF EXISTS "org admins can insert rep_player_development_goals" ON public.rep_player_development_goals;
DROP POLICY IF EXISTS "org admins can update rep_player_development_goals" ON public.rep_player_development_goals;
DROP POLICY IF EXISTS "org admins can delete rep_player_development_goals" ON public.rep_player_development_goals;
