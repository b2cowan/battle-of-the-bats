-- Migration 090: Tournament Contact Model Refactor — Drop Legacy Columns + contacts Table
-- Prerequisites: migrations 088 and 089 applied; all app code referencing contacts table
-- or age_groups.contact_id removed and deployed.
-- See docs/active/TOURNAMENT_CONTACT_REFACTOR_PLAN.md for full context.

-- ============================================================
-- 1. Drop contact_id from age_groups
--    Replaced by contact_member_id (FK → organization_members).
--    ON DELETE SET NULL is already on the new column.
-- ============================================================

ALTER TABLE public.age_groups
  DROP COLUMN IF EXISTS contact_id;

-- ============================================================
-- 2. Drop the contacts table
--    The table is now retired. All notification email routing
--    uses organization_members via default_contact_member_id
--    (tournament) and contact_member_id (age_group).
-- ============================================================

DROP TABLE IF EXISTS public.contacts;

-- ============================================================
-- 3. (Optional / deferred) Drop contact_email from tournaments
--    This legacy text column is kept for now as a soft fallback
--    in case any edge-case email path still reads it. Drop in a
--    follow-up migration once all email rendering is confirmed.
--
--    To drop later:
--      ALTER TABLE public.tournaments DROP COLUMN contact_email;
-- ============================================================
