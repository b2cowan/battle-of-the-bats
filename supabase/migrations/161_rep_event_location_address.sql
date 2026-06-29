-- Optional street address for a coach event's location, split from the human-readable
-- location NAME (rep_team_events.location). The NAME shows on the schedule + the recent-location
-- chips; the ADDRESS powers the Google Maps link (mirrors the tournament diamonds name/address
-- split). Additive + nullable, no CHECK (shape is UI-enforced).
ALTER TABLE rep_team_events
  ADD COLUMN IF NOT EXISTS location_address text;
