ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS internal_notes text;
