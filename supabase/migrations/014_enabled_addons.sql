ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS enabled_addons jsonb NOT NULL DEFAULT '[]';
