-- Tier-2 game-day detail fields for the Premium coach schedule (rep_team_events).
-- Additive + nullable; values are app-provided free text/time, no CHECK constraints
-- (allowed shapes are UI-enforced, mirroring the rest of this table's loose fields).
--   arrival_time — "be there by" clock time as HH:mm, same day as starts_at
--   field_number — diamond/field label within the location, e.g. "Diamond 2"
--   uniform      — game-day uniform/jersey note, e.g. "Home whites" (games only, UI-gated)
ALTER TABLE rep_team_events
  ADD COLUMN IF NOT EXISTS arrival_time text,
  ADD COLUMN IF NOT EXISTS field_number text,
  ADD COLUMN IF NOT EXISTS uniform      text;
