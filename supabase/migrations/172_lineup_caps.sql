-- Lineup Intelligence P3 (docs/projects/active/COACHES_PORTAL_LINEUP_INTELLIGENCE_PLAN.md):
-- team/season innings caps for the game-day lineup auto-fill, plus a per-game override.
--
-- Two additive, nullable jsonb columns. Shapes are app-enforced (lib/lineup-caps.ts — NO DB CHECK,
-- so the vocabulary can evolve without an ALTER TABLE, matching this module's other UI-shaped fields).
--
--   rep_program_years.lineup_settings  — the team's SEASON DEFAULTS (per program year):
--     { maxInningsPerPosition: int|null,   -- rotation cap: max innings any player at one field spot
--       pitcherMaxInningsDefault: int|null,-- team default arm-care ceiling for pitching
--       minInningsPerPlayer: int|null }    -- min-play floor (guarantees everyone gets on the field)
--     null / missing key = that rule is OFF.
--
--   rep_team_lineups.rules_override    — a PER-GAME override of any subset of the above (e.g. a
--     tournament with different rules); { maxInningsPerPosition, pitcherMaxInnings, minInningsPerPlayer }.
--     A missing/null key => fall back to the season default. Persisted so it sticks to that game.
--
-- Effective cap at generation = override ?? season default. The per-player pitcher arm-care cap
-- (lineup_profile.pitcher.maxInnings, mig 171) still applies on top of the team ceiling — stricter wins.
-- Both reversible (DROP COLUMN) with no data dependency.
ALTER TABLE rep_program_years
  ADD COLUMN IF NOT EXISTS lineup_settings jsonb;

ALTER TABLE rep_team_lineups
  ADD COLUMN IF NOT EXISTS rules_override jsonb;
