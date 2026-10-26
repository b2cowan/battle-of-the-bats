-- ---------------------------------------------------------------
-- Migration 373 — Support console Stage 4 (free time): the tournament fee book reads the club's plan RIGHT NOW.
--
-- WHY: free time gives a club a whole plan (an org_overrides 'plan_tier' row, the plan in target.plan) or sections
-- ('module_addon', target.addons) for a set time, and the app reads it through one door (lib/entitlement-grants.ts).
-- The database decided whether a tournament's entry-fee money posts to the club's Accounting book from the STORED
-- columns (tournament_fee_book_on, mig 345: plan_id IN ('club','club_large') OR enabled_addons ? 'module_accounting'),
-- so a club on free Club time, or on free Accounting, ran tournaments whose fees never reached the book it was being
-- shown. Owner, 2026-10-25: fees post during free time.
-- NOW: two helpers state the door's rule once in SQL, and tournament_fee_book_on asks them.
--   org_effective_plan(org)              the club's own plan, or the plan its newest running plan grant gives it when
--                                        that plan is above its own (Tournament Plus, Club, Club · Association only)
--   org_has_effective_addon(org, addon)  the section is the club's own, or a running section grant gives it
-- "Running" is the app's rule: not revoked, started, and before its end (the end is exclusive). This is the ONE SQL
-- copy of the door's plan rule; lib/free-time.ts foldGrants is the other, and the two must change together.
-- ⚠ The app's switch (ENTITLEMENT_GRANTS_ENABLED) is an environment variable the database cannot see. It is on in dev
-- and production; with it off the console refuses new grants, so only grants given while it was on can reach here.
-- Decided when a payment is recorded, as before: free time ending later posts nothing back and takes nothing away.
-- Functions only.
-- ---------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.plan_rank_of(p_plan text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  -- lib/plan-features.ts PLAN_RANK
  SELECT CASE p_plan
    WHEN 'tournament_plus' THEN 1
    WHEN 'league' THEN 2
    WHEN 'club' THEN 3
    WHEN 'club_large' THEN 4
    ELSE 0
  END
$$;

CREATE OR REPLACE FUNCTION public.org_effective_plan(p_org uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN g.plan IS NOT NULL AND public.plan_rank_of(g.plan) > public.plan_rank_of(o.plan_id) THEN g.plan
    ELSE o.plan_id
  END
  FROM organizations o
  LEFT JOIN LATERAL (
    SELECT ov.target->>'plan' AS plan
    FROM org_overrides ov
    WHERE ov.org_id = o.id
      AND ov.type = 'plan_tier'
      AND ov.revoked_at IS NULL
      AND ov.starts_at <= now()
      AND (ov.expires_at IS NULL OR ov.expires_at > now())
      AND ov.target->>'plan' IN ('tournament_plus', 'club', 'club_large')
    ORDER BY ov.created_at DESC
    LIMIT 1
  ) g ON true
  WHERE o.id = p_org
$$;

CREATE OR REPLACE FUNCTION public.org_has_effective_addon(p_org uuid, p_addon text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT coalesce(o.enabled_addons, '[]'::jsonb) ? p_addon FROM organizations o WHERE o.id = p_org), false)
    OR EXISTS (
      SELECT 1 FROM org_overrides ov
      WHERE ov.org_id = p_org
        AND ov.type = 'module_addon'
        AND ov.revoked_at IS NULL
        AND ov.starts_at <= now()
        AND (ov.expires_at IS NULL OR ov.expires_at > now())
        AND coalesce(ov.target->'addons', '[]'::jsonb) ? p_addon
    )
$$;

-- Does this tournament's fee money post to a book? A club plan or the Accounting section, as the club holds it RIGHT
-- NOW (free time included), and an event that is not "free". Same signature and callers as mig 345.
CREATE OR REPLACE FUNCTION public.tournament_fee_book_on(p_tournament uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (public.org_effective_plan(t.org_id) IN ('club', 'club_large')
      OR public.org_has_effective_addon(t.org_id, 'module_accounting'))
    AND coalesce(t.settings->>'fee_scope', '') <> 'free', false)
  FROM tournaments t
  WHERE t.id = p_tournament
$$;

-- ── Who may call what: the server only ──────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.plan_rank_of(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.org_effective_plan(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.org_has_effective_addon(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_fee_book_on(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plan_rank_of(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.org_effective_plan(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.org_has_effective_addon(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.tournament_fee_book_on(uuid) TO service_role;

COMMIT;
