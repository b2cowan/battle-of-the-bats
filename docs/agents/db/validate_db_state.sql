-- ============================================================
-- FieldLogicHQ — DB State Validation Script
-- Run in Supabase SQL Editor (dev OR prod).
-- FAILs sort to the top. All PASSes = clean state.
-- Last updated: 2026-05-24 (added checks 17–18: pools nullability)
-- Note: checks 17–18 will FAIL on prod until migration 081 is applied.
-- ============================================================

WITH checks AS (

  -- ──────────────────────────────────────────────────────────
  -- games column types (migration 076 — dev; already correct in prod)
  -- ──────────────────────────────────────────────────────────

  SELECT 1 AS sort, 'games.game_time type' AS check_name,
    'time without time zone' AS expected,
    data_type AS actual,
    CASE WHEN data_type = 'time without time zone' THEN 'PASS' ELSE 'FAIL' END AS result
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'game_time'

  UNION ALL

  SELECT 2, 'games.bracket_id type',
    'uuid', data_type,
    CASE WHEN data_type = 'uuid' THEN 'PASS' ELSE 'FAIL' END
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'bracket_id'

  -- ──────────────────────────────────────────────────────────
  -- league_practices (migrations 077 + 078)
  -- ──────────────────────────────────────────────────────────

  UNION ALL

  SELECT 3, 'league_practices table exists',
    'EXISTS',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'league_practices'
    ) THEN 'EXISTS' ELSE 'MISSING' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'league_practices'
    ) THEN 'PASS' ELSE 'FAIL' END

  UNION ALL

  SELECT 4, 'league_practices.org_id column',
    'EXISTS',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'league_practices' AND column_name = 'org_id'
    ) THEN 'EXISTS' ELSE 'MISSING' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'league_practices' AND column_name = 'org_id'
    ) THEN 'PASS' ELSE 'FAIL' END

  UNION ALL

  SELECT 5, 'league_practices_org_idx exists',
    'EXISTS',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'league_practices_org_idx'
    ) THEN 'EXISTS' ELSE 'MISSING' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'league_practices_org_idx'
    ) THEN 'PASS' ELSE 'FAIL' END

  -- ──────────────────────────────────────────────────────────
  -- league_seasons.draft_state (migration 079 — dev; already in prod)
  -- ──────────────────────────────────────────────────────────

  UNION ALL

  SELECT 6, 'league_seasons.draft_state column',
    'EXISTS',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'league_seasons' AND column_name = 'draft_state'
    ) THEN 'EXISTS' ELSE 'MISSING' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'league_seasons' AND column_name = 'draft_state'
    ) THEN 'PASS' ELSE 'FAIL' END

  -- ──────────────────────────────────────────────────────────
  -- Tournament FK constraints — exactly 1 per sub-table, no duplicates
  -- (migration 080 removed prod duplicates; dev always had 1 per table)
  -- Checks count not names — both auto-named and explicit names are valid.
  -- ──────────────────────────────────────────────────────────

  UNION ALL

  SELECT 7, 'exactly 1 FK to tournaments per sub-table (no duplicates)',
    '6 constraints (1 per table)',
    COUNT(*) || ' found',
    CASE WHEN COUNT(*) = 6 THEN 'PASS' ELSE 'FAIL' END
  FROM pg_constraint
  WHERE contype = 'f'
    AND conrelid IN (
      'public.games'::regclass, 'public.age_groups'::regclass,
      'public.contacts'::regclass, 'public.diamonds'::regclass,
      'public.announcements'::regclass, 'public.teams'::regclass
    )
    AND confrelid = 'public.tournaments'::regclass

  UNION ALL

  SELECT 8, 'no table has more than 1 FK to tournaments (duplicate check)',
    '0 tables with duplicates',
    COUNT(*) || ' tables with duplicates',
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END
  FROM (
    SELECT conrelid, COUNT(*) AS fk_count
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid IN (
        'public.games'::regclass, 'public.age_groups'::regclass,
        'public.contacts'::regclass, 'public.diamonds'::regclass,
        'public.announcements'::regclass, 'public.teams'::regclass
      )
      AND confrelid = 'public.tournaments'::regclass
    GROUP BY conrelid
    HAVING COUNT(*) > 1
  ) AS dupes

  -- ──────────────────────────────────────────────────────────
  -- Duplicate index removed (migration 080 — prod cleanup)
  -- ──────────────────────────────────────────────────────────

  UNION ALL

  SELECT 9, 'idx_audit_org duplicate dropped',
    'NOT EXISTS',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_audit_org'
    ) THEN 'EXISTS (BAD)' ELSE 'NOT EXISTS' END,
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_audit_org'
    ) THEN 'PASS' ELSE 'FAIL' END

  UNION ALL

  SELECT 10, 'idx_audit_log_org retained',
    'EXISTS',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_audit_log_org'
    ) THEN 'EXISTS' ELSE 'MISSING' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_audit_log_org'
    ) THEN 'PASS' ELSE 'FAIL' END

  -- ──────────────────────────────────────────────────────────
  -- Earlier migrations — key schema state checks
  -- ──────────────────────────────────────────────────────────

  UNION ALL

  -- Migration 072/073: tournaments.org_id rename
  SELECT 11, 'tournaments.org_id exists',
    'EXISTS',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'org_id'
    ) THEN 'EXISTS' ELSE 'MISSING' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'org_id'
    ) THEN 'PASS' ELSE 'FAIL' END

  UNION ALL

  SELECT 12, 'tournaments.organization_id removed',
    'NOT EXISTS',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'organization_id'
    ) THEN 'EXISTS (BAD)' ELSE 'NOT EXISTS' END,
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'organization_id'
    ) THEN 'PASS' ELSE 'FAIL' END

  UNION ALL

  -- Migration 074: installment tables org_id
  SELECT 13, 'rep_allocation_installments.org_id exists',
    'EXISTS',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'rep_allocation_installments' AND column_name = 'org_id'
    ) THEN 'EXISTS' ELSE 'MISSING' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'rep_allocation_installments' AND column_name = 'org_id'
    ) THEN 'PASS' ELSE 'FAIL' END

  UNION ALL

  SELECT 14, 'rep_player_dues_installments.org_id exists',
    'EXISTS',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'rep_player_dues_installments' AND column_name = 'org_id'
    ) THEN 'EXISTS' ELSE 'MISSING' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'rep_player_dues_installments' AND column_name = 'org_id'
    ) THEN 'PASS' ELSE 'FAIL' END

  UNION ALL

  -- Migration 075: league_games org_id
  SELECT 15, 'league_games.org_id exists',
    'EXISTS',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'league_games' AND column_name = 'org_id'
    ) THEN 'EXISTS' ELSE 'MISSING' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'league_games' AND column_name = 'org_id'
    ) THEN 'PASS' ELSE 'FAIL' END

  UNION ALL

  -- Migration 071: lineup RLS + index
  SELECT 16, 'rep_team_lineups_org_idx exists',
    'EXISTS',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'rep_team_lineups_org_idx'
    ) THEN 'EXISTS' ELSE 'MISSING' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'rep_team_lineups_org_idx'
    ) THEN 'PASS' ELSE 'FAIL' END

  -- ──────────────────────────────────────────────────────────
  -- pools column sync (migration 081 — Part A to dev, Part B to prod)
  -- Finding #20 (corrected): created_at missing from dev; display_order nullable in prod
  -- Check 17: created_at must exist in both envs after Part A applied to dev
  -- Check 18: display_order must be NOT NULL in both envs after Part B applied to prod
  -- ──────────────────────────────────────────────────────────

  UNION ALL

  SELECT 17, 'pools.created_at column exists',
    'EXISTS',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pools' AND column_name = 'created_at'
    ) THEN 'EXISTS' ELSE 'MISSING' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pools' AND column_name = 'created_at'
    ) THEN 'PASS' ELSE 'FAIL' END

  UNION ALL

  SELECT 18, 'pools.display_order is NOT NULL',
    'NO',
    is_nullable,
    CASE WHEN is_nullable = 'NO' THEN 'PASS' ELSE 'FAIL' END
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'pools' AND column_name = 'display_order'

  -- ──────────────────────────────────────────────────────────
  -- games FK duplicate check (Finding #21 — migration 082 on prod)
  -- Detects actual duplicates: >1 FK constraint pointing at the same column.
  -- Passes on both dev (1 auto-named per column) and prod-post-082 (1 explicit per column).
  -- Fails only when a column has 2+ FK constraints simultaneously.
  -- ──────────────────────────────────────────────────────────

  UNION ALL

  SELECT 19, 'games: no duplicate FK constraints per column',
    '0 columns with duplicates',
    COUNT(*) || ' column(s) with >1 FK',
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END
  FROM (
    SELECT conkey
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'public.games'::regclass
    GROUP BY conkey
    HAVING COUNT(*) > 1
  ) AS dupes

),

summary AS (
  SELECT
    sort, check_name, expected, actual, result,
    CASE WHEN result = 'PASS' THEN 1 ELSE 0 END AS is_pass,
    CASE WHEN result = 'FAIL' THEN 1 ELSE 0 END AS is_fail
  FROM checks
)

SELECT result, check_name, expected, actual
FROM (

  -- Detail rows
  SELECT result, check_name, expected, actual,
    CASE WHEN result = 'FAIL' THEN 0 ELSE 1 END AS sort_key
  FROM summary

  UNION ALL

  -- Summary row
  SELECT
    CASE WHEN SUM(is_fail) = 0 THEN '✓ ALL PASS' ELSE '✗ ' || SUM(is_fail) || ' FAILED' END,
    '── SUMMARY ──',
    SUM(is_pass) || ' passed',
    SUM(is_fail) || ' failed',
    2
  FROM summary

) AS combined
ORDER BY sort_key, check_name;
