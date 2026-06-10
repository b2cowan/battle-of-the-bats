-- Lift stale tournament_limit caps on unlimited-tier orgs.
--
-- Tournament Plus / League / Club are configured as unlimited (sentinel 9999)
-- in lib/plan-config.ts. Orgs that upgraded to Tournament Plus while it was
-- still capped at 3 tournaments (migration 037) still carry a finite stored
-- organizations.tournament_limit. getEffectiveTournamentLimit() honors a stored
-- finite value verbatim for unlimited-tier plans (that path is the intended
-- platform-admin custom-cap override), so those orgs are still enforced at the
-- stale cap (e.g. "Your plan allows 3 tournament slots") even though the plan
-- is now unlimited.
--
-- This raises the stored cap to the unlimited sentinel for unlimited-tier orgs.
-- It only ever RAISES a cap (WHERE tournament_limit < 9999), never lowers one,
-- so it cannot restrict any org. Idempotent: re-running affects 0 rows.
--
-- UAT-protected fixtures are deliberately excluded: the dev UAT orgs
-- (uat-plus-org, uat-club-org) carry an intentional finite cap of 10 so the
-- "X / N slots" counter stays exercisable on a paid plan. They are tagged
-- '[UAT_PROTECTED]' in internal_notes. Production has no such rows, so this
-- exclusion is a no-op on prod and keeps one identical migration correct on
-- both environments.

UPDATE organizations
SET tournament_limit = 9999
WHERE plan_id IN ('tournament_plus', 'league', 'club')
  AND tournament_limit < 9999
  AND COALESCE(internal_notes, '') NOT LIKE '%[UAT_PROTECTED]%';
