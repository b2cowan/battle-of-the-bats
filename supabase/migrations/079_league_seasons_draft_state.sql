-- Migration 079: Add draft_state to league_seasons.
-- DEV ONLY — this column already exists in prod; do NOT apply to prod.
--
-- Origin: Phase 5G (Team Placement + Draft Tools) in HOUSE_LEAGUE_MODULE_PLAN.md.
-- The plan specified draft state stored as a jsonb column on league_seasons
-- ("a simple league_draft_state JSONB column on league_seasons — transient
-- working state, not a permanent record").
--
-- The column was added directly to prod without a migration file.
-- App code fully depends on it:
--   - lib/types.ts         LeagueSeason.draftState: LeagueDraftState | null
--   - lib/db.ts            mapped from row.draft_state in mapLeagueSeason()
--   - draft/route.ts       loadDraft() + saveDraft() — reads and writes this column
--   - placement/route.ts   clears draft_state to null on bulk-assign finalization
--
-- Without this column, any dev test of the House League draft/placement
-- feature fails with "column draft_state does not exist".
--
-- No index needed — accessed only by point lookup on season_id (already indexed).
-- No NOT NULL — NULL means no active draft session, which is the normal state.
-- No RLS changes — league_seasons already has RLS policies; this column inherits them.

ALTER TABLE public.league_seasons
  ADD COLUMN IF NOT EXISTS draft_state jsonb;
