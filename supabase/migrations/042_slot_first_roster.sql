-- Publishing visibility control per division
-- Default 'unpublished' means existing divisions stay admin-only until explicitly published
ALTER TABLE age_groups
  ADD COLUMN IF NOT EXISTS schedule_visibility TEXT NOT NULL DEFAULT 'unpublished'
    CHECK (schedule_visibility IN ('unpublished', 'published_generic', 'published_teams'));

-- Queue position for waitlisted tournament registrations
-- NULL = not on waitlist; positive integer = position in queue
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS waitlist_position INT DEFAULT NULL;

-- Direct reference from a registration to its assigned pool slot
-- NULL until a slot is claimed; ON DELETE SET NULL keeps the registration if the slot is deleted
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS slot_id UUID REFERENCES pool_slots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teams_slot_id ON teams(slot_id);
