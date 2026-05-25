-- ============================================================
-- Verification script: Contact Model Refactor (migrations 088–090)
-- Run in Supabase SQL editor on both dev and prod.
-- Every row should return status = 'PASS'.
-- ============================================================

SELECT * FROM (

  -- ── 088: New columns exist ─────────────────────────────────

  SELECT '088-01' AS check_id,
    'organization_members has title column' AS description,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'organization_members'
        AND column_name  = 'title'
    ) THEN 'PASS' ELSE 'FAIL' END AS status

  UNION ALL SELECT '088-02',
    'organization_members.title has length constraint',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.constraint_column_usage
      WHERE table_schema     = 'public'
        AND table_name        = 'organization_members'
        AND constraint_name   = 'org_members_title_length'
    ) THEN 'PASS' ELSE 'FAIL' END

  UNION ALL SELECT '088-03',
    'tournaments has default_contact_member_id column',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'tournaments'
        AND column_name  = 'default_contact_member_id'
    ) THEN 'PASS' ELSE 'FAIL' END

  UNION ALL SELECT '088-04',
    'tournaments has notify_mode column',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'tournaments'
        AND column_name  = 'notify_mode'
    ) THEN 'PASS' ELSE 'FAIL' END

  UNION ALL SELECT '088-05',
    'tournaments.notify_mode has check constraint',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema    = 'public'
        AND table_name       = 'tournaments'
        AND constraint_name  = 'tournaments_notify_mode_check'
        AND constraint_type  = 'CHECK'
    ) THEN 'PASS' ELSE 'FAIL' END

  UNION ALL SELECT '088-06',
    'age_groups has contact_member_id column',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'age_groups'
        AND column_name  = 'contact_member_id'
    ) THEN 'PASS' ELSE 'FAIL' END

  -- ── 089: Backfill ──────────────────────────────────────────

  UNION ALL SELECT '089-01',
    'All active/draft tournaments have default_contact_member_id set',
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE status IN ('active', 'draft')
        AND default_contact_member_id IS NULL
    ) THEN 'PASS'
    ELSE 'FAIL — ' || (
      SELECT COUNT(*)::text
      FROM public.tournaments
      WHERE status IN ('active', 'draft')
        AND default_contact_member_id IS NULL
    ) || ' tournament(s) missing contact'
    END

  UNION ALL SELECT '089-02',
    'All tournaments have notify_mode set to all or assigned',
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE notify_mode NOT IN ('all', 'assigned')
         OR notify_mode IS NULL
    ) THEN 'PASS' ELSE 'FAIL' END

  UNION ALL SELECT '089-03',
    'default_contact_member_id FKs all resolve to valid org members',
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM public.tournaments t
      LEFT JOIN public.organization_members om ON om.id = t.default_contact_member_id
      WHERE t.default_contact_member_id IS NOT NULL
        AND om.id IS NULL
    ) THEN 'PASS' ELSE 'FAIL — dangling FK(s) found' END

  UNION ALL SELECT '089-04',
    'contact_member_id FKs all resolve to valid org members',
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM public.age_groups ag
      LEFT JOIN public.organization_members om ON om.id = ag.contact_member_id
      WHERE ag.contact_member_id IS NOT NULL
        AND om.id IS NULL
    ) THEN 'PASS' ELSE 'FAIL — dangling FK(s) found' END

  -- ── 090: Legacy columns / table dropped ───────────────────

  UNION ALL SELECT '090-01',
    'age_groups.contact_id column does NOT exist (dropped)',
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'age_groups'
        AND column_name  = 'contact_id'
    ) THEN 'PASS' ELSE 'FAIL — column still exists' END

  UNION ALL SELECT '090-02',
    'contacts table does NOT exist (dropped)',
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name   = 'contacts'
    ) THEN 'PASS' ELSE 'FAIL — table still exists' END

  -- ── Informational (not pass/fail) ─────────────────────────

  UNION ALL SELECT 'INFO-01',
    'Age groups with division-specific contact override',
    (SELECT COUNT(*)::text FROM public.age_groups WHERE contact_member_id IS NOT NULL)
    || ' division(s) have a contact override'

  UNION ALL SELECT 'INFO-02',
    'Tournaments by notify_mode',
    (SELECT string_agg(notify_mode || ': ' || cnt::text, ', ' ORDER BY notify_mode)
     FROM (SELECT notify_mode, COUNT(*) AS cnt FROM public.tournaments GROUP BY notify_mode) x)

  UNION ALL SELECT 'INFO-03',
    'Org members with a title set',
    (SELECT COUNT(*)::text FROM public.organization_members WHERE title IS NOT NULL AND title <> '')
    || ' member(s) have a title'

) checks
ORDER BY check_id;
