-- Migration 074: Add org_id (and team_id) to rep_player_dues_installments
--               and rep_allocation_installments.
-- Addresses DB Architecture Review Findings #5 (3-hop) and #6 (2-hop).
--
-- Both tables currently reach org_id via joins through their parent table.
-- Adding org_id directly eliminates the join in RLS USING clauses and enables
-- efficient org-scoped queries. team_id is added as a denormalized convenience
-- column (nullable — safer for existing data; always backfilled from parent).
--
-- Existing SELECT policies are dropped and recreated using direct column lookups.
-- No app-code changes required — all writes go through supabaseAdmin (service role).

-- ============================================================
-- PART A: rep_player_dues_installments
-- 3-hop before:  installments.schedule_id → rep_player_dues_schedules → org_id
-- 1-hop after:   installments.org_id
-- ============================================================

-- 1a. Add columns
ALTER TABLE public.rep_player_dues_installments
  ADD COLUMN IF NOT EXISTS org_id  uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.rep_teams(id)     ON DELETE SET NULL;

-- 1b. Backfill from parent schedule
UPDATE public.rep_player_dues_installments i
SET
  org_id  = s.org_id,
  team_id = s.team_id
FROM public.rep_player_dues_schedules s
WHERE i.schedule_id = s.id
  AND (i.org_id IS NULL OR i.team_id IS NULL);

-- 1c. Constrain org_id NOT NULL (every installment must belong to an org)
ALTER TABLE public.rep_player_dues_installments
  ALTER COLUMN org_id SET NOT NULL;

-- 1d. Indexes
CREATE INDEX IF NOT EXISTS rep_player_dues_installments_org_idx
  ON public.rep_player_dues_installments(org_id);

CREATE INDEX IF NOT EXISTS rep_player_dues_installments_team_idx
  ON public.rep_player_dues_installments(team_id);

-- 1e. Drop old 3-hop SELECT policies and replace with direct column lookups
DROP POLICY IF EXISTS "org members can read dues_installments"           ON public.rep_player_dues_installments;
DROP POLICY IF EXISTS "coaches can read their team's dues_installments"  ON public.rep_player_dues_installments;

-- Org members (admins, staff) read all installments for their org
CREATE POLICY "org members can read dues_installments"
  ON public.rep_player_dues_installments FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- Coaches (franchise model — may not be org members) read their team's installments
CREATE POLICY "coaches can read their team's dues_installments"
  ON public.rep_player_dues_installments FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

-- ============================================================
-- PART B: rep_allocation_installments
-- 2-hop before:  installments.split_id → rep_allocation_splits → org_id
-- 1-hop after:   installments.org_id
-- ============================================================

-- 2a. Add columns
ALTER TABLE public.rep_allocation_installments
  ADD COLUMN IF NOT EXISTS org_id  uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.rep_teams(id)     ON DELETE SET NULL;

-- 2b. Backfill from parent split
UPDATE public.rep_allocation_installments i
SET
  org_id  = s.org_id,
  team_id = s.team_id
FROM public.rep_allocation_splits s
WHERE i.split_id = s.id
  AND (i.org_id IS NULL OR i.team_id IS NULL);

-- 2c. Constrain org_id NOT NULL
ALTER TABLE public.rep_allocation_installments
  ALTER COLUMN org_id SET NOT NULL;

-- 2d. Indexes
CREATE INDEX IF NOT EXISTS rep_allocation_installments_org_idx
  ON public.rep_allocation_installments(org_id);

CREATE INDEX IF NOT EXISTS rep_allocation_installments_team_idx
  ON public.rep_allocation_installments(team_id);

-- 2e. Drop old 2-hop SELECT policies and replace with direct column lookups
DROP POLICY IF EXISTS "org members can read allocation_installments"           ON public.rep_allocation_installments;
DROP POLICY IF EXISTS "coaches can read their team's allocation_installments"  ON public.rep_allocation_installments;

-- Org members read all allocation installments for their org
CREATE POLICY "org members can read allocation_installments"
  ON public.rep_allocation_installments FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- Coaches read their team's allocation installments
CREATE POLICY "coaches can read their team's allocation_installments"
  ON public.rep_allocation_installments FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));
