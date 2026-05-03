ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS hero_banner_url text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS theme_font       text     DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS theme_card_style text     DEFAULT 'default';
