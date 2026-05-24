-- Migration 080: Prod constraint and index cleanup.
-- Addresses DB Architecture Review Findings #11 and #12.
--
-- TARGET: Prod only. Dev is already clean (no duplicate constraints or indexes).
-- Safe to run against dev anyway — all DROP ... IF EXISTS, no-ops if absent.
--
-- ============================================================
-- Finding #11: Duplicate FK constraints on tournament tables (prod)
-- ============================================================
-- Prod accumulated duplicate FK constraints on tournament sub-tables.
-- Each table has both an explicitly-named fk_* constraint and a Postgres
-- auto-named *_tournament_id_fkey constraint pointing to the same column.
-- Postgres enforces both on every INSERT/UPDATE — pure overhead.
--
-- Strategy: drop the auto-named *_fkey duplicates; keep the explicit fk_* names.
-- All drops use IF EXISTS so this is safe to re-run or apply to dev.

BEGIN;

-- games
ALTER TABLE public.games
  DROP CONSTRAINT IF EXISTS games_tournament_id_fkey;

-- age_groups
ALTER TABLE public.age_groups
  DROP CONSTRAINT IF EXISTS age_groups_tournament_id_fkey;

-- contacts
ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_tournament_id_fkey;

-- diamonds
ALTER TABLE public.diamonds
  DROP CONSTRAINT IF EXISTS diamonds_tournament_id_fkey;

-- announcements
ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_tournament_id_fkey;

-- teams
ALTER TABLE public.teams
  DROP CONSTRAINT IF EXISTS teams_tournament_id_fkey;

-- ============================================================
-- Finding #12: Duplicate indexes on org_audit_log (prod)
-- ============================================================
-- Prod has two identical indexes on org_audit_log(org_id, created_at DESC):
--   idx_audit_log_org  — keep (more descriptive name, matches convention)
--   idx_audit_org      — drop (shorter, likely the earlier auto-created duplicate)
--
-- Dropping a duplicate index does not affect query plans — the planner
-- will use the surviving idx_audit_log_org index for all the same queries.

DROP INDEX IF EXISTS public.idx_audit_org;

COMMIT;
