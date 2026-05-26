-- =============================================================================
-- Migration 096: Venue Hierarchy Data Backfill
-- Created: 2026-05-25
-- Plan: docs/active/VENUE_HIERARCHY_PLAN.md
--
-- Backfills the venue_facilities table from the flat diamonds table, and
-- wires up games.venue_facility_id from the existing games.diamond_id.
--
-- After this migration:
--   • Every diamonds row has exactly one venue_facilities child row
--     (same name, facility_type = 'other', display_order = 0)
--   • Every game with a diamond_id has a matching venue_facility_id
--
-- Idempotent: INSERT uses WHERE NOT EXISTS / UPDATE uses WHERE IS NULL,
-- so re-running is safe.
--
-- facility_type defaults to 'other' for all legacy flat venues — admins
-- can update these individually via the new UI.
-- =============================================================================

-- =============================================================================
-- STEP 1: Create one venue_facility per existing diamond
-- =============================================================================

INSERT INTO venue_facilities (venue_id, tournament_id, name, facility_type, display_order, notes)
SELECT
  d.id            AS venue_id,
  d.tournament_id AS tournament_id,
  d.name          AS name,
  'other'         AS facility_type,
  0               AS display_order,
  NULL            AS notes
FROM diamonds d
WHERE NOT EXISTS (
  SELECT 1 FROM venue_facilities vf WHERE vf.venue_id = d.id
);

-- =============================================================================
-- STEP 2: Wire up games.venue_facility_id from games.diamond_id
--
-- Each diamond now has exactly one venue_facility, so the join is 1:1.
-- =============================================================================

UPDATE games g
SET    venue_facility_id = vf.id
FROM   venue_facilities vf
WHERE  g.diamond_id        = vf.venue_id
  AND  g.venue_facility_id IS NULL;

-- =============================================================================
-- STEP 3: Verification counts (informational — will appear in SQL editor output)
-- =============================================================================

DO $$
DECLARE
  diamonds_count          bigint;
  facilities_count        bigint;
  games_with_diamond      bigint;
  games_with_facility     bigint;
  games_missing_facility  bigint;
BEGIN
  SELECT COUNT(*) INTO diamonds_count        FROM diamonds;
  SELECT COUNT(*) INTO facilities_count      FROM venue_facilities;
  SELECT COUNT(*) INTO games_with_diamond    FROM games WHERE diamond_id IS NOT NULL;
  SELECT COUNT(*) INTO games_with_facility   FROM games WHERE venue_facility_id IS NOT NULL;
  SELECT COUNT(*) INTO games_missing_facility
    FROM games
    WHERE diamond_id IS NOT NULL AND venue_facility_id IS NULL;

  RAISE NOTICE '=== Migration 096 verification ===';
  RAISE NOTICE 'diamonds rows:             %', diamonds_count;
  RAISE NOTICE 'venue_facilities rows:     %', facilities_count;
  RAISE NOTICE 'games with diamond_id:     %', games_with_diamond;
  RAISE NOTICE 'games with facility_id:    %', games_with_facility;
  RAISE NOTICE 'games MISSING facility_id: %', games_missing_facility;

  IF games_missing_facility > 0 THEN
    RAISE WARNING 'Some games have diamond_id but no venue_facility_id — check for orphaned diamonds.';
  END IF;
END $$;
