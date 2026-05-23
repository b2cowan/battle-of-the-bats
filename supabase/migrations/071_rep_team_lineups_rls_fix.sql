-- Migration 071: Fix rep_team_lineups — org_id index + write RLS policies
-- Addresses DB Architecture Review Findings #13 (missing index) and #14 (no write policies).
-- Both tables were applied to dev and prod via migration 070 with only SELECT policies.

-- ============================================================
-- Finding #13: Add org_id index on rep_team_lineups
-- Every RLS evaluation and org-scoped WHERE clause was a full table scan.
-- ============================================================

CREATE INDEX IF NOT EXISTS rep_team_lineups_org_idx
  ON public.rep_team_lineups(org_id);

-- ============================================================
-- Finding #14a: Write policies on rep_team_lineups
--
-- Two actor scopes:
--   1. Coaches — scoped to teams assigned in rep_team_coaches
--   2. Org admins — scoped to orgs where they hold the 'admin' role
--      (organization_members.role = 'admin')
--
-- INSERT: only WITH CHECK applies (no "existing row" to USING-filter)
-- UPDATE: both USING (which rows can be updated) + WITH CHECK (new row validity)
-- DELETE: only USING applies (no "new row" to check)
-- ============================================================

-- --- Coaches ---

CREATE POLICY "coaches can insert rep_team_lineups"
  ON public.rep_team_lineups FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id
      FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "coaches can update rep_team_lineups"
  ON public.rep_team_lineups FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id
      FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id
      FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "coaches can delete rep_team_lineups"
  ON public.rep_team_lineups FOR DELETE
  USING (
    team_id IN (
      SELECT team_id
      FROM public.rep_team_coaches
      WHERE user_id = auth.uid()
    )
  );

-- --- Org admins ---

CREATE POLICY "org admins can insert rep_team_lineups"
  ON public.rep_team_lineups FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE POLICY "org admins can update rep_team_lineups"
  ON public.rep_team_lineups FOR UPDATE
  USING (
    org_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE POLICY "org admins can delete rep_team_lineups"
  ON public.rep_team_lineups FOR DELETE
  USING (
    org_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- ============================================================
-- Finding #14b: Write policies on rep_team_lineup_entries
--
-- rep_team_lineup_entries has no direct org_id or team_id.
-- All tenancy context is reached through rep_team_lineups
-- via lineup_id, matching the EXISTS pattern used by the
-- SELECT policies in migration 070.
--
-- The table reference inside WITH CHECK on INSERT refers to
-- the NEW row being inserted, so lineup_id is the value
-- the client is attempting to write — the EXISTS subquery
-- verifies the actor is authorised for that lineup.
-- ============================================================

-- --- Coaches ---

CREATE POLICY "coaches can insert rep_team_lineup_entries"
  ON public.rep_team_lineup_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.rep_team_lineups lineup
      WHERE lineup.id = rep_team_lineup_entries.lineup_id
        AND lineup.team_id IN (
          SELECT team_id
          FROM public.rep_team_coaches
          WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "coaches can update rep_team_lineup_entries"
  ON public.rep_team_lineup_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.rep_team_lineups lineup
      WHERE lineup.id = rep_team_lineup_entries.lineup_id
        AND lineup.team_id IN (
          SELECT team_id
          FROM public.rep_team_coaches
          WHERE user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.rep_team_lineups lineup
      WHERE lineup.id = rep_team_lineup_entries.lineup_id
        AND lineup.team_id IN (
          SELECT team_id
          FROM public.rep_team_coaches
          WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "coaches can delete rep_team_lineup_entries"
  ON public.rep_team_lineup_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.rep_team_lineups lineup
      WHERE lineup.id = rep_team_lineup_entries.lineup_id
        AND lineup.team_id IN (
          SELECT team_id
          FROM public.rep_team_coaches
          WHERE user_id = auth.uid()
        )
    )
  );

-- --- Org admins ---

CREATE POLICY "org admins can insert rep_team_lineup_entries"
  ON public.rep_team_lineup_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.rep_team_lineups lineup
      WHERE lineup.id = rep_team_lineup_entries.lineup_id
        AND lineup.org_id IN (
          SELECT organization_id
          FROM public.organization_members
          WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    )
  );

CREATE POLICY "org admins can update rep_team_lineup_entries"
  ON public.rep_team_lineup_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.rep_team_lineups lineup
      WHERE lineup.id = rep_team_lineup_entries.lineup_id
        AND lineup.org_id IN (
          SELECT organization_id
          FROM public.organization_members
          WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.rep_team_lineups lineup
      WHERE lineup.id = rep_team_lineup_entries.lineup_id
        AND lineup.org_id IN (
          SELECT organization_id
          FROM public.organization_members
          WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    )
  );

CREATE POLICY "org admins can delete rep_team_lineup_entries"
  ON public.rep_team_lineup_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.rep_team_lineups lineup
      WHERE lineup.id = rep_team_lineup_entries.lineup_id
        AND lineup.org_id IN (
          SELECT organization_id
          FROM public.organization_members
          WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    )
  );
