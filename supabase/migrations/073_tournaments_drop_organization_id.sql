-- Migration 073: Drop tournaments.organization_id (legacy column)
-- Addresses DB Architecture Review Finding #1 — Step 2 of 2.
--
-- Prerequisites:
--   1. Migration 072 applied to dev AND prod
--   2. App code verified in prod (no runtime errors, all tournament queries use org_id)
--   3. No remaining app references to tournaments.organization_id
--
-- This migration is safe to apply once 072 has been running in prod without issues.
-- The old column is left intact in 072 to allow rollback without data loss.

-- ============================================================
-- 1. Drop the legacy unique index (072 replaced it with org_slug_live_unique)
-- ============================================================

DROP INDEX IF EXISTS public.tournaments_organization_id_idx;

-- ============================================================
-- 2. Drop the legacy FK column
-- ============================================================

ALTER TABLE public.tournaments
  DROP COLUMN IF EXISTS organization_id;
