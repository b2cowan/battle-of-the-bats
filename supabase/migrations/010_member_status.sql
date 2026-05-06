ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('invited', 'active', 'suspended'));

-- Backfill: rows with no accepted_at are pending invites → 'invited'
UPDATE organization_members SET status = 'invited' WHERE accepted_at IS NULL;
