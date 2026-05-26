-- ============================================================
-- Verification script: Migration 093 - Divisions rename
-- Run in Supabase SQL editor on dev and prod.
--
-- This validates the effective schema/data state, which is more reliable here
-- than only checking Supabase migration history because local helper scripts may
-- apply raw SQL without inserting a schema_migrations row.
--
-- Expected result: every non-INFO row should return status = 'PASS'.
-- ============================================================

SELECT * FROM (

  SELECT '093-01' AS check_id,
    'divisions table exists' AS description,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'divisions'
    ) THEN 'PASS' ELSE 'FAIL - public.divisions is missing' END AS status

  UNION ALL SELECT '093-02',
    'legacy age_groups table does not exist',
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'age_groups'
    ) THEN 'PASS' ELSE 'FAIL - public.age_groups still exists' END

  UNION ALL SELECT '093-03',
    'FK columns were renamed to division_id',
    CASE WHEN (
      SELECT COUNT(*)
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'pools'      AND column_name = 'division_id') OR
          (table_name = 'teams'      AND column_name = 'division_id') OR
          (table_name = 'pool_slots' AND column_name = 'division_id') OR
          (table_name = 'games'      AND column_name = 'division_id')
        )
    ) = 4 THEN 'PASS' ELSE 'FAIL - one or more division_id columns are missing' END

  UNION ALL SELECT '093-04',
    'legacy age_group_id FK columns do not exist',
    CASE WHEN NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('pools', 'teams', 'pool_slots', 'games')
        AND column_name = 'age_group_id'
    ) THEN 'PASS' ELSE 'FAIL - one or more age_group_id columns still exist' END

  UNION ALL SELECT '093-05',
    'array columns were renamed to division_ids',
    CASE WHEN (
      SELECT COUNT(*)
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'announcements' AND column_name = 'division_ids') OR
          (table_name = 'rules'         AND column_name = 'division_ids')
        )
    ) = 2 THEN 'PASS' ELSE 'FAIL - announcements/rules division_ids columns are missing' END

  UNION ALL SELECT '093-06',
    'legacy age_group_ids array columns do not exist',
    CASE WHEN NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('announcements', 'rules')
        AND column_name = 'age_group_ids'
    ) THEN 'PASS' ELSE 'FAIL - one or more age_group_ids columns still exist' END

  UNION ALL SELECT '093-07',
    'free-text columns were renamed to division',
    CASE WHEN (
      SELECT COUNT(*)
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'league_seasons' AND column_name = 'division') OR
          (table_name = 'rep_teams'      AND column_name = 'division')
        )
    ) = 2 THEN 'PASS' ELSE 'FAIL - league_seasons/rep_teams division columns are missing' END

  UNION ALL SELECT '093-08',
    'legacy free-text age_group columns do not exist',
    CASE WHEN NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('league_seasons', 'rep_teams')
        AND column_name = 'age_group'
    ) THEN 'PASS' ELSE 'FAIL - one or more free-text age_group columns still exist' END

  UNION ALL SELECT '093-09',
    'is_org_member_for_age_group reads from divisions',
    CASE WHEN EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'is_org_member_for_age_group'
        AND pg_get_functiondef(p.oid) ILIKE '%FROM divisions%'
        AND pg_get_functiondef(p.oid) NOT ILIKE '%FROM age_groups%'
    ) THEN 'PASS' ELSE 'FAIL - function body does not point at divisions' END

  UNION ALL SELECT '093-10',
    'can_access_tournament_for_pool reads from divisions',
    CASE WHEN EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'can_access_tournament_for_pool'
        AND pg_get_functiondef(p.oid) ILIKE '%FROM divisions%'
        AND pg_get_functiondef(p.oid) NOT ILIKE '%FROM age_groups%'
    ) THEN 'PASS' ELSE 'FAIL - function body does not point at divisions' END

  UNION ALL SELECT '093-11',
    'claim_next_slot uses pool_slots.division_id',
    CASE WHEN EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'claim_next_slot'
        AND pg_get_functiondef(p.oid) ILIKE '%ps.division_id%'
    ) THEN 'PASS' ELSE 'FAIL - function body does not use ps.division_id' END

  UNION ALL SELECT '093-12',
    'fee_schedule_mode values were migrated from age_group to division',
    CASE WHEN NOT EXISTS (
      SELECT 1
      FROM public.tournaments
      WHERE fee_schedule_mode = 'age_group'
    ) THEN 'PASS' ELSE 'FAIL - tournaments still have fee_schedule_mode = age_group' END

  UNION ALL SELECT 'INFO-01',
    'rows with fee_schedule_mode = division',
    (SELECT COUNT(*)::text FROM public.tournaments WHERE fee_schedule_mode = 'division')

) checks
ORDER BY check_id;
