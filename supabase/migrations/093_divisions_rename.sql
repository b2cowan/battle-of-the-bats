-- =============================================================================
-- Migration 093: Rename age_groups → divisions (terminology cleanup)
-- Created: 2026-05-25
-- Plan: docs/active/DIVISIONS_RENAME_PLAN.md
--
-- "Age Group" is renamed to "Division" across the entire platform.
-- Divisions in FieldLogicHQ tournaments are not strictly age-based —
-- organizers use them for gender, skill, and format categories too.
-- "Division" is the standard term in Canadian tournament management.
--
-- Safe to run: RENAME is atomic DDL in Postgres. No data is moved.
-- Roll back with supabase/migrations/093_rollback.sql (if needed).
-- =============================================================================

-- =============================================================================
-- STEP 1: Drop duplicate FK constraint on games.age_group_id
-- Schema note: both games_age_group_id_fkey AND fk_games_age_group exist.
-- Drop the extra one before renaming.
-- =============================================================================
ALTER TABLE games DROP CONSTRAINT IF EXISTS fk_games_age_group;

-- =============================================================================
-- STEP 2: Rename the age_groups table to divisions
-- Postgres automatically updates attached RLS policy expressions (stored by
-- attnum, not by name), but function bodies stored as text must be updated
-- explicitly in STEP 6 below.
-- =============================================================================
ALTER TABLE age_groups RENAME TO divisions;

-- =============================================================================
-- STEP 3: Rename age_group_id FK columns → division_id
-- =============================================================================
ALTER TABLE pools      RENAME COLUMN age_group_id TO division_id;
ALTER TABLE teams      RENAME COLUMN age_group_id TO division_id;
ALTER TABLE pool_slots RENAME COLUMN age_group_id TO division_id;
ALTER TABLE games      RENAME COLUMN age_group_id TO division_id;

-- =============================================================================
-- STEP 4: Rename age_group_ids array columns → division_ids
-- =============================================================================
ALTER TABLE announcements RENAME COLUMN age_group_ids TO division_ids;
ALTER TABLE rules         RENAME COLUMN age_group_ids TO division_ids;

-- =============================================================================
-- STEP 5: Rename free-text age_group columns → division
-- These are plain text labels, not FKs.
-- =============================================================================
ALTER TABLE league_seasons RENAME COLUMN age_group TO division;
ALTER TABLE rep_teams      RENAME COLUMN age_group TO division;

-- =============================================================================
-- STEP 6: Recreate functions whose bodies reference the old table/column names.
-- SQL and PL/pgSQL function bodies are stored as text and do NOT auto-update
-- when the referenced table or column is renamed.
-- =============================================================================

-- is_org_member_for_age_group: keep the function name (used in pool RLS policies)
-- but update the body to query the renamed table.
CREATE OR REPLACE FUNCTION is_org_member_for_age_group(agid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT can_access_tournament(
    (SELECT tournament_id FROM divisions WHERE id = agid)
  );
$$;

-- can_access_tournament_for_pool: update body to query divisions table.
CREATE OR REPLACE FUNCTION can_access_tournament_for_pool(pool_age_group_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT can_access_tournament(
    (SELECT tournament_id FROM divisions WHERE id = pool_age_group_id)
  );
$$;

-- claim_next_slot: update body to reference renamed column division_id.
CREATE OR REPLACE FUNCTION claim_next_slot(p_age_group_id UUID, p_team_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot_id UUID;
BEGIN
  UPDATE pool_slots
  SET    team_id = p_team_id
  WHERE  id = (
    SELECT ps.id
    FROM   pool_slots ps
    JOIN   pools p ON p.id = ps.pool_id
    WHERE  ps.division_id = p_age_group_id
      AND  ps.team_id IS NULL
    ORDER  BY p.display_order ASC, ps.slot_number ASC
    LIMIT  1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id INTO v_slot_id;

  RETURN v_slot_id;
END;
$$;

-- =============================================================================
-- STEP 7: Migrate persisted fee_schedule_mode string values
-- tournaments.fee_schedule_mode stores 'age_group' as a text value.
-- Update existing rows so app code can compare against 'division'.
-- =============================================================================
UPDATE tournaments
SET fee_schedule_mode = 'division'
WHERE fee_schedule_mode = 'age_group';
