-- Migration: per-org theme columns
-- Run in Supabase SQL Editor

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS theme_preset  text DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS theme_primary text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS theme_accent  text DEFAULT NULL;

-- Preserve the Milton Bats purple/black palette by explicitly setting the platform preset
UPDATE organizations
SET theme_preset = 'platform'
WHERE slug = 'milton-softball';
