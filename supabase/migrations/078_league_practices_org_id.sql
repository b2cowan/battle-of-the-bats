-- Migration 078: Add org_id to league_practices.
-- Addresses DB Architecture Review follow-up from Finding #10 (migration 077).
-- Apply to BOTH dev and prod.
--
-- Before: org membership check requires a 2-hop join:
--   league_practices.season_id → league_seasons.org_id → organization_members
-- After: direct column lookup on league_practices.org_id.
--
-- Mirrors the exact pattern used for league_games in migration 075.

-- ============================================================
-- 1. Add column
-- ============================================================

ALTER TABLE public.league_practices
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ============================================================
-- 2. Backfill from parent season
-- ============================================================

UPDATE public.league_practices p
SET org_id = s.org_id
FROM public.league_seasons s
WHERE p.season_id = s.id
  AND p.org_id IS NULL;

-- ============================================================
-- 3. Constrain NOT NULL
-- ============================================================

ALTER TABLE public.league_practices
  ALTER COLUMN org_id SET NOT NULL;

-- ============================================================
-- 4. Index
-- ============================================================

CREATE INDEX IF NOT EXISTS league_practices_org_idx
  ON public.league_practices(org_id);

-- ============================================================
-- 5. Replace 2-hop org-member SELECT policy with direct lookup
-- ============================================================

DROP POLICY IF EXISTS "org members can read practices" ON public.league_practices;

CREATE POLICY "org members can read practices"
  ON public.league_practices FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
