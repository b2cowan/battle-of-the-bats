-- ---------------------------------------------------------------
-- Migration 245 — team-level staff membership (M1, "the team is the account")
--
-- Owner ruling 2026-08-16 (Design A on M1, mockup artifact aa758bcb §10):
-- belonging to a team's staff — role, per-assistant capability grants, and
-- whether access is live — moves OFF the per-season assignment row and onto
-- ONE membership record per (team, person). `rep_team_coaches` stays as the
-- per-season RECORD ("who coached 2024") plus a live-season projection kept
-- in sync by the app so the ~54 write routes that resolve an active-year row
-- keep working unchanged. Nothing may READ access or capabilities from a
-- season row once this table exists.
--
--   * remove = status→'revoked' (the row survives; re-adding reactivates it,
--     which is the ruling "removal revokes access without deleting the record")
--   * capabilities live here, so a head coach's customized grants finally
--     survive rollover (rollover used to re-mint rows with NULL capabilities)
--   * access never derives from season rows again, so a club admin creating
--     next year's blank season no longer strands the whole staff (the M2
--     lock-out that got that design rejected)
--
-- Service-role posture: RLS ON, zero policies (the platform standard — see
-- migration 212). Every reader/writer goes through supabaseAdmin; anon and
-- authenticated resolve to zero rows even where the default SELECT grant
-- exists (prod does — verified live 2026-07-31, memory/reference_supabase_rls_grants).
-- ---------------------------------------------------------------

CREATE TABLE rep_team_staff_memberships (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id       uuid NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_role    text NOT NULL CHECK (coach_role IN ('head_coach', 'assistant_coach')),
  -- Same jsonb shape + semantics as rep_team_coaches.capabilities (NULL = role defaults;
  -- sanitized by lib/coach-capabilities.ts sanitizeAssistantGrants on every write).
  capabilities  jsonb,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  revoked_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- One membership per person per team — reactivation updates the row, never duplicates it.
  CONSTRAINT rep_team_staff_memberships_team_user_key UNIQUE (team_id, user_id)
);

CREATE INDEX rep_team_staff_memberships_org_user_idx
  ON rep_team_staff_memberships (org_id, user_id);
CREATE INDEX rep_team_staff_memberships_team_idx
  ON rep_team_staff_memberships (team_id);

ALTER TABLE rep_team_staff_memberships ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------
-- Backfill: one active membership per person from each team's NEWEST season
-- that actually has coach rows.
--
-- ⚠ "Newest STAFFED season", not "newest season": an org team whose admin has
-- already created next year's blank draft would otherwise backfill nobody —
-- the exact lock-out this design exists to prevent. Newest-by-created_at
-- matches getActiveRepProgramYear's ordering (a mid-rollover team holding
-- draft + active picks the newer row there too).
--
-- Users whose only rows sit on OLDER seasons get no membership — deliberate:
-- they are ex-staff, and shipping this is what revokes them (Design A, no
-- live clients, no compatibility shim).
-- ---------------------------------------------------------------

INSERT INTO rep_team_staff_memberships
  (org_id, team_id, user_id, coach_role, capabilities, status, created_at)
SELECT c.org_id, c.team_id, c.user_id, c.coach_role, c.capabilities, 'active', c.created_at
FROM rep_team_coaches c
JOIN (
  SELECT DISTINCT ON (py.team_id) py.team_id, py.id AS program_year_id
  FROM rep_program_years py
  WHERE EXISTS (SELECT 1 FROM rep_team_coaches rc WHERE rc.program_year_id = py.id)
  ORDER BY py.team_id, py.created_at DESC
) newest_staffed ON newest_staffed.program_year_id = c.program_year_id
ON CONFLICT (team_id, user_id) DO NOTHING;
