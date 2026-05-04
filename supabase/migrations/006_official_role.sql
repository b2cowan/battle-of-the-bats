-- =============================================================================
-- Migration 006: Official Role + Score Finalization Setting
-- Run in Supabase SQL Editor
-- =============================================================================

-- Add require_score_finalization to organizations.
-- Controls whether official score submissions require admin finalization
-- before triggering playoff advancement. Default false = submissions are
-- immediately final (status → 'completed'). When true, submissions are set
-- to 'submitted' until an admin finalizes them (status → 'completed').
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS require_score_finalization boolean NOT NULL DEFAULT false;

-- Note: The 'games.status' column is plain text with no CHECK constraint,
-- so no ALTER TABLE is required to support the new 'submitted' value.
-- Valid status values after this migration:
--   'scheduled'  — no scores yet
--   'submitted'  — scores entered by official, visible publicly, not yet admin-finalized
--   'completed'  — finalized; playoff advancement triggered; score locked to admins
--   'cancelled'  — game cancelled
