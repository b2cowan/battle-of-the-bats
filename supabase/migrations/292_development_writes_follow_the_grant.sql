-- 292 — Development writes follow the Development GRANT, not the head-coach role
-- (COACH_DEVELOPMENT_LIFECYCLE_PLAN.md §9 / §16 — owner ruling 2026-09-11, ruling 9 of the build
-- prompt; built 2026-09-12 as Part A of the Phase 1 chat.)
--
-- THE RULING: every development write — defining and retiring tests, starting sessions, recording
-- results, goals, observations, reviews, and the returning-player decisions that carry goals across
-- seasons — was head-coach-only from birth (Player Development D1, 2026-07-17; migs 189/190/191
-- encoded it as `coach_role = 'head_coach'`). The owner replaced that with ONE delegable switch on
-- the staff sheet: "make an access option to write to development and have that cover all of the
-- writes … so that when this is released, if a head coach wants to delegate this they can. Read
-- can stay with all coaches."
--
-- WHAT THIS DOES: rewrites every write policy on the five development tables so the predicate is
-- "the head coach, OR an assistant whose stored grants carry `development: true`". The READ
-- policies are untouched — reading was never part of the ruling. The app layer says the same
-- thing (`canWriteDevelopment` in lib/coach-capabilities.ts); mig 141's lesson is that RLS must
-- encode the REAL write rule, neither looser nor stricter, and a policy left at head-only while
-- the routes admit a grant-holder is exactly that disagreement.
--
-- ⚠ WHERE THE GRANT LIVES: `rep_team_coaches.capabilities` (jsonb) — the live season's projection
-- of `rep_team_staff_memberships.capabilities`, mirrored by `syncLiveSeasonProjection`
-- (lib/coach-membership.ts) on every access change. NULL on a head-coach row and on a row written
-- before any grant was set, which is why the predicate reads the key with `->>` and compares the
-- text 'true' — a NULL bundle, a missing key or a non-boolean value all read as "not granted",
-- and the OR with `coach_role` carries the head coach. The policies keep reading `rep_team_coaches`
-- (not the membership table) because that is the season-scoped row the routes gate on, and it is
-- what the three source migrations read.
--
-- ⚠ FIVE tables, not four. The plan names the four development tables; `rep_player_continuity_links`
-- (mig 191) is the fifth because its routes gate on the same predicate the grant widens
-- (confirming a returning player and carrying goals forward are development writes in the app),
-- so leaving it head-only here would be the two-layer disagreement above.
--
-- ⚠ SCHEMA-INVISIBLE. `check:migrations` and the parity gate compare tables, columns, CHECKs and
-- indexes; a policy rewrite changes none of them, so both report "in sync" whether or not this ever
-- ran on prod. Its prod state is knowable only by asking `pg_policies` — recorded in
-- MANUAL_PROD_STEPS.json for that reason. RLS is not the coach portal's enforcement layer (every
-- route runs service-role and gates in the app), so the product does not 500 either way; the risk
-- of it lagging is a policy that lies, not a broken screen.
--
-- Every CREATE POLICY is preceded by DROP POLICY IF EXISTS (the migs 141/148/149 convention), so
-- the file re-applies cleanly. Policy NAMES change from "head coaches can …" to "development
-- writers can …" — a name that says head-only over a predicate that is not would be the same lie
-- one level up.

begin;

-- ── 1. rep_team_measurable_types (mig 189) — INSERT + UPDATE; no DELETE policy exists (retire = update)
DROP POLICY IF EXISTS "head coaches can insert rep_team_measurable_types" ON public.rep_team_measurable_types;
DROP POLICY IF EXISTS "development writers can insert rep_team_measurable_types" ON public.rep_team_measurable_types;
CREATE POLICY "development writers can insert rep_team_measurable_types"
  ON public.rep_team_measurable_types FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  );

DROP POLICY IF EXISTS "head coaches can update rep_team_measurable_types" ON public.rep_team_measurable_types;
DROP POLICY IF EXISTS "development writers can update rep_team_measurable_types" ON public.rep_team_measurable_types;
CREATE POLICY "development writers can update rep_team_measurable_types"
  ON public.rep_team_measurable_types FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  );

-- ── 2. rep_player_measurables (mig 189) — INSERT + UPDATE + DELETE
DROP POLICY IF EXISTS "head coaches can insert rep_player_measurables" ON public.rep_player_measurables;
DROP POLICY IF EXISTS "development writers can insert rep_player_measurables" ON public.rep_player_measurables;
CREATE POLICY "development writers can insert rep_player_measurables"
  ON public.rep_player_measurables FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  );

DROP POLICY IF EXISTS "head coaches can update rep_player_measurables" ON public.rep_player_measurables;
DROP POLICY IF EXISTS "development writers can update rep_player_measurables" ON public.rep_player_measurables;
CREATE POLICY "development writers can update rep_player_measurables"
  ON public.rep_player_measurables FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  );

DROP POLICY IF EXISTS "head coaches can delete rep_player_measurables" ON public.rep_player_measurables;
DROP POLICY IF EXISTS "development writers can delete rep_player_measurables" ON public.rep_player_measurables;
CREATE POLICY "development writers can delete rep_player_measurables"
  ON public.rep_player_measurables FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  );

-- ── 3. rep_player_development_goals (mig 189) — INSERT + UPDATE + DELETE
-- ⚠ The APP requires `notes` as well for a goal (`canWriteDevelopmentGoals`): a goal is read
-- through Internal notes, and writing one you cannot read back is a standing contradiction. The
-- policy encodes the grant alone — `notes` is a READ grant, and folding a read gate into a write
-- policy would be the looser-than-the-app / stricter-than-the-app mismatch in the other direction
-- the moment the app's compound changed. The compound is enforced where it is decided: the route.
DROP POLICY IF EXISTS "head coaches can insert rep_player_development_goals" ON public.rep_player_development_goals;
DROP POLICY IF EXISTS "development writers can insert rep_player_development_goals" ON public.rep_player_development_goals;
CREATE POLICY "development writers can insert rep_player_development_goals"
  ON public.rep_player_development_goals FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  );

DROP POLICY IF EXISTS "head coaches can update rep_player_development_goals" ON public.rep_player_development_goals;
DROP POLICY IF EXISTS "development writers can update rep_player_development_goals" ON public.rep_player_development_goals;
CREATE POLICY "development writers can update rep_player_development_goals"
  ON public.rep_player_development_goals FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  );

DROP POLICY IF EXISTS "head coaches can delete rep_player_development_goals" ON public.rep_player_development_goals;
DROP POLICY IF EXISTS "development writers can delete rep_player_development_goals" ON public.rep_player_development_goals;
CREATE POLICY "development writers can delete rep_player_development_goals"
  ON public.rep_player_development_goals FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  );

-- ── 4. rep_team_evaluation_sessions (mig 190) — INSERT + UPDATE + DELETE
DROP POLICY IF EXISTS "head coaches can insert rep_team_evaluation_sessions" ON public.rep_team_evaluation_sessions;
DROP POLICY IF EXISTS "development writers can insert rep_team_evaluation_sessions" ON public.rep_team_evaluation_sessions;
CREATE POLICY "development writers can insert rep_team_evaluation_sessions"
  ON public.rep_team_evaluation_sessions FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  );

DROP POLICY IF EXISTS "head coaches can update rep_team_evaluation_sessions" ON public.rep_team_evaluation_sessions;
DROP POLICY IF EXISTS "development writers can update rep_team_evaluation_sessions" ON public.rep_team_evaluation_sessions;
CREATE POLICY "development writers can update rep_team_evaluation_sessions"
  ON public.rep_team_evaluation_sessions FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  );

DROP POLICY IF EXISTS "head coaches can delete rep_team_evaluation_sessions" ON public.rep_team_evaluation_sessions;
DROP POLICY IF EXISTS "development writers can delete rep_team_evaluation_sessions" ON public.rep_team_evaluation_sessions;
CREATE POLICY "development writers can delete rep_team_evaluation_sessions"
  ON public.rep_team_evaluation_sessions FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  );

-- ── 5. rep_player_continuity_links (mig 191) — INSERT + UPDATE + DELETE
DROP POLICY IF EXISTS "head coaches can insert rep_player_continuity_links" ON public.rep_player_continuity_links;
DROP POLICY IF EXISTS "development writers can insert rep_player_continuity_links" ON public.rep_player_continuity_links;
CREATE POLICY "development writers can insert rep_player_continuity_links"
  ON public.rep_player_continuity_links FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  );

DROP POLICY IF EXISTS "head coaches can update rep_player_continuity_links" ON public.rep_player_continuity_links;
DROP POLICY IF EXISTS "development writers can update rep_player_continuity_links" ON public.rep_player_continuity_links;
CREATE POLICY "development writers can update rep_player_continuity_links"
  ON public.rep_player_continuity_links FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  );

DROP POLICY IF EXISTS "head coaches can delete rep_player_continuity_links" ON public.rep_player_continuity_links;
DROP POLICY IF EXISTS "development writers can delete rep_player_continuity_links" ON public.rep_player_continuity_links;
CREATE POLICY "development writers can delete rep_player_continuity_links"
  ON public.rep_player_continuity_links FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  );

commit;

-- Verify (dev and, later, prod — the gates cannot):
--   select tablename, policyname, cmd from pg_policies
--    where schemaname = 'public'
--      and tablename in ('rep_team_measurable_types','rep_player_measurables',
--                        'rep_player_development_goals','rep_team_evaluation_sessions',
--                        'rep_player_continuity_links')
--      and cmd <> 'SELECT'
--    order by tablename, cmd;
--   → 14 rows, every policyname beginning "development writers can", none "head coaches can".
