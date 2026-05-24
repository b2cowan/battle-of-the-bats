-- ============================================================
-- Migration 076 — Fix games column type drift (DEV ONLY)
-- ============================================================
-- The `games` table predates the migration system. Two columns
-- have incorrect types in dev that do not match production:
--
--   game_time : text (dev)  →  time without time zone (prod)
--   bracket_id: text (dev)  →  uuid (prod)
--
-- This migration corrects dev to match prod. DO NOT apply to prod.
--
-- Impacts:
--   - game_time: ORDER BY is lexicographic on text; temporal on time.
--     '9:00' sorts after '10:00' as text (bug), before as time (correct).
--   - bracket_id: uuid enforces format validation; text silently accepts
--     any string. All app write paths use crypto.randomUUID() or null.
--
-- Safety checks:
--   - All game_time values in dev are HH:MM or H:MM — cast succeeds.
--   - All bracket_id values are NULL or valid UUIDs — cast succeeds.
--     If either check below returns > 0, stop and investigate before
--     running the ALTER statements.
-- ============================================================

-- Safety check 1: confirm no non-time game_time values exist
-- Expected result: 0 rows.
-- SELECT COUNT(*) FROM games
-- WHERE game_time IS NOT NULL
--   AND game_time !~ '^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?$';

-- Safety check 2: confirm no non-UUID bracket_id values exist
-- Expected result: 0 rows.
-- SELECT COUNT(*) FROM games
-- WHERE bracket_id IS NOT NULL
--   AND bracket_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

BEGIN;

-- Fix 1: game_time text → time without time zone
ALTER TABLE games
  ALTER COLUMN game_time TYPE time without time zone
  USING game_time::time without time zone;

-- Fix 2: bracket_id text → uuid
ALTER TABLE games
  ALTER COLUMN bracket_id TYPE uuid
  USING bracket_id::uuid;

COMMIT;
