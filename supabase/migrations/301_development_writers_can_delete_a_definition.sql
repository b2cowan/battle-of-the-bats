-- 301 — Development writers can DELETE a metric definition
-- (development lifecycle re-evaluation, stage 3 · E10 — owner ruling 2026-09-15; /review finding on
-- mig 300's build: the product now deletes a definition nothing points at, and the table's policy
-- set said nobody may).
--
-- POLICY-ONLY. Mig 292 gave rep_team_measurable_types INSERT + UPDATE policies on the development-
-- writer predicate and no DELETE policy, because the app never deleted a definition (mig 189: "only
-- ever soft-retired"). Since mig 300 the route deletes one that has no result, observation or
-- not-assessed mark pointing at it. RLS is not the coach portal's enforcement layer (every route
-- runs service-role and gates on `canWriteDevelopment`), so nothing 500s without this — what lags
-- is a policy set that LIES about who may write (the mig-292/295 rule). Same predicate as every
-- other development write policy; the three RESTRICT FKs keep a delete of a definition WITH records
-- impossible from any path.
--
-- ⚠ Invisible to both drift gates (a policy is not a table, column, CHECK, constraint or index) —
-- registered in MANUAL_PROD_STEPS.json. ORDER: none (independent of 300; apply with it).

DROP POLICY IF EXISTS "development writers can delete rep_team_measurable_types" ON public.rep_team_measurable_types;
CREATE POLICY "development writers can delete rep_team_measurable_types"
  ON public.rep_team_measurable_types FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
        AND (coach_role = 'head_coach' OR (capabilities->>'development') = 'true')
    )
  );

-- Verify (dev and, later, prod):
--   select policyname, cmd from pg_policies where tablename = 'rep_team_measurable_types' order by cmd;
--   → 5 rows: DELETE ×1 ("development writers can delete …"), INSERT ×1, SELECT ×2, UPDATE ×1.
