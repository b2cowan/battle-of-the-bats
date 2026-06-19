-- 135: cancelled status for rep team events (Premium >= Free parity).
--
-- The free Basic Coaches Portal lets a coach mark an event 'cancelled'
-- (basic_coach_team_events.status = scheduled|cancelled), but Premium rep_team_events
-- had NO such state — the only way to handle a called-off practice/game was to DELETE it,
-- losing the record. This adds a matching status so a Premium coach can cancel (and restore)
-- an event, and so a cancelled free event carries over honestly when a team upgrades.
--
-- Additive, NOT NULL with a default so every existing row becomes 'scheduled'; the CHECK
-- mirrors the Basic table's vocabulary exactly. Safe + reversible (drop the column to restore).

ALTER TABLE public.rep_team_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'cancelled'));
