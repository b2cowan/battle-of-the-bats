ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS display_name text CHECK (char_length(display_name) <= 60);
