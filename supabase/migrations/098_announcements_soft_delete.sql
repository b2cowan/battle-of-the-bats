-- 098_announcements_soft_delete.sql
-- Adds soft-delete support to the announcements/communications table.
-- Setting deleted_at removes the post from the public News page while keeping
-- the full record in admin communications history for audit and restore.

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Sparse index — only indexes rows that have been soft-deleted (the minority).
CREATE INDEX IF NOT EXISTS announcements_deleted_at_idx
  ON announcements (tournament_id, deleted_at)
  WHERE deleted_at IS NOT NULL;
