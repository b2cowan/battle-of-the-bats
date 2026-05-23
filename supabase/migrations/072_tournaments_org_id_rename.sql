-- Migration 072: Rename tournaments.organization_id → tournaments.org_id
-- Addresses DB Architecture Review Finding #1 (High).
--
-- Step 1 of 2: add + backfill + constrain + fix RLS + fix index.
-- Step 2 (migration 073): DROP COLUMN organization_id — applied after prod verification.
--
-- All /api/admin/* routes use supabaseAdmin (service role) and bypass RLS;
-- this migration only affects browser-client (anon key) RLS paths.
--
-- Safe to re-run:
--   - ADD COLUMN uses IF NOT EXISTS
--   - DROP POLICY / DROP INDEX use IF EXISTS
--   - CREATE OR REPLACE for functions

-- ============================================================
-- 1. Add org_id column and backfill from organization_id
-- ============================================================

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.tournaments
  SET org_id = organization_id
  WHERE org_id IS NULL AND organization_id IS NOT NULL;

ALTER TABLE public.tournaments
  ALTER COLUMN org_id SET NOT NULL;

-- ============================================================
-- 2. Index on org_id
--    (organization_id already has indexes; org_id needs its own)
-- ============================================================

CREATE INDEX IF NOT EXISTS tournaments_org_id_idx
  ON public.tournaments(org_id);

-- ============================================================
-- 3. Replace the unique slug index from migration 024
--    Old: (organization_id, slug) WHERE status <> 'archived'
--    New: (org_id, slug) WHERE status <> 'archived'
-- ============================================================

DROP INDEX IF EXISTS tournaments_organization_slug_live_unique;

CREATE UNIQUE INDEX IF NOT EXISTS tournaments_org_slug_live_unique
  ON public.tournaments(org_id, slug)
  WHERE status <> 'archived';

-- ============================================================
-- 4. Recreate can_access_tournament — the core RLS helper
--    The only function that joins through tournaments.organization_id.
--    All other helpers (is_org_member_for_tournament, etc.) call
--    this one transitively, so only this one needs updating.
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_access_tournament(t_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.tournaments t ON t.org_id = om.organization_id
    WHERE om.user_id = auth.uid()
      AND t.id = t_id
      AND (
        -- No assignments = unrestricted (absence-means-unrestricted semantics)
        NOT EXISTS (
          SELECT 1 FROM public.org_member_tournament_assignments
          WHERE org_member_id = om.id
        )
        OR
        -- Has an explicit assignment for this tournament
        EXISTS (
          SELECT 1 FROM public.org_member_tournament_assignments
          WHERE org_member_id = om.id
            AND tournament_id = t_id
        )
      )
  );
$$;

-- ============================================================
-- 5. Drop and recreate the INSERT policy on tournaments
--    The UPDATE and DELETE policies use can_access_tournament(id)
--    which was fixed above and needs no policy-level change.
-- ============================================================

DROP POLICY IF EXISTS "tournaments_member_insert" ON public.tournaments;

CREATE POLICY "tournaments_member_insert"
  ON public.tournaments FOR INSERT
  WITH CHECK (org_id IN (SELECT public.get_my_org_ids()));
