-- Migration 102: Tournament settings scope controls
-- Adds game_timing_scope, tie_breakers, tie_breaker_scope, fee_scope to
-- tournaments.settings JSONB.  All values are stored inside the existing
-- settings column — no new columns are needed.
--
-- Backfill rules (per DIVISIONS_UX_REWORK_PLAN.md §Phase 2):
--   • game_timing_scope = 'tournament'  for any row that already has
--     settings->>'game_duration_minutes' set (they had an explicit value).
--   • fee_scope derived from existing fee_schedule_mode column:
--       'tournament' → 'tournament'
--       'division'   → 'per_division'
--       NULL / other → left unset (null in JSONB = not yet decided)
--   • tie_breaker_scope is left NULL for ALL tournaments.
--     Existing tournaments must make an explicit decision before going live;
--     active/completed tournaments are grandfathered by the dashboard logic.

-- ── 1. game_timing_scope backfill ─────────────────────────────────────────────
UPDATE tournaments
SET settings = jsonb_set(
  COALESCE(settings, '{}'),
  '{game_timing_scope}',
  '"tournament"',
  true  -- create key if absent
)
WHERE
  settings IS NOT NULL
  AND (settings->>'game_duration_minutes') IS NOT NULL;

-- ── 2. fee_scope backfill ─────────────────────────────────────────────────────
UPDATE tournaments
SET settings = jsonb_set(
  COALESCE(settings, '{}'),
  '{fee_scope}',
  CASE fee_schedule_mode
    WHEN 'tournament' THEN '"tournament"'
    WHEN 'division'   THEN '"per_division"'
  END::jsonb,
  true
)
WHERE fee_schedule_mode IN ('tournament', 'division');

-- ── 3. tie_breaker_scope ──────────────────────────────────────────────────────
-- Intentionally NOT set for any existing row.  The dashboard checklist treats
-- null as "not yet decided" and skips the check for active/completed
-- tournaments (grandfathering rule).  New draft tournaments will need to
-- configure this before they can be activated.
