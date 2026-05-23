-- Migration 075: Add org_id to league_games.
-- Addresses DB Architecture Review Finding #4.
--
-- Before: org membership check requires a 2-hop join:
--   league_games.season_id → league_seasons.org_id → organization_members
-- After: direct column lookup on league_games.org_id.
--
-- The public "active seasons" policy is left unchanged — it checks season status
-- (not org membership) and league_seasons will always be a small table.

-- ============================================================
-- 1. Add column
-- ============================================================

ALTER TABLE public.league_games
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ============================================================
-- 2. Backfill from parent season
-- ============================================================

UPDATE public.league_games g
SET org_id = s.org_id
FROM public.league_seasons s
WHERE g.season_id = s.id
  AND g.org_id IS NULL;

-- ============================================================
-- 3. Constrain NOT NULL
-- ============================================================

ALTER TABLE public.league_games
  ALTER COLUMN org_id SET NOT NULL;

-- ============================================================
-- 4. Index
-- ============================================================

CREATE INDEX IF NOT EXISTS league_games_org_idx
  ON public.league_games(org_id);

-- ============================================================
-- 5. Replace 2-hop org-member SELECT policy with direct lookup
-- ============================================================

DROP POLICY IF EXISTS "org members can read games" ON public.league_games;

CREATE POLICY "org members can read games"
  ON public.league_games FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
