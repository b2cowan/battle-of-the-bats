-- 157_rep_roster_player_profile_fields.sql
-- Premium Coaches Portal — player profile Wave B.
-- Adds optional player-profile fields a coach uses day-to-day: safety/medical info,
-- an emergency contact, handedness, and jersey size. All nullable + additive, so safe
-- to apply ahead of the UI. Allowed values for bats/throws/jersey_size are enforced in
-- the app layer (lib/rep-roster-options.ts) rather than CHECK constraints, to keep the
-- size/handedness vocab flexible without future ALTERs.

ALTER TABLE rep_roster_players
  ADD COLUMN IF NOT EXISTS medical_notes           text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name  text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS bats                    text,  -- 'L' | 'R' | 'S' (switch)
  ADD COLUMN IF NOT EXISTS throws                  text,  -- 'L' | 'R'
  ADD COLUMN IF NOT EXISTS jersey_size             text;  -- YS|YM|YL|AS|AM|AL|AXL
