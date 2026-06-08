-- 113_teams_seed.sql
-- Applied: dev + prod 2026-06-06.
-- Optional per-team seed number (within a division). Lets an organizer rank
-- teams 1..N so the Playoff Bracket Builder can auto-seed by number instead of
-- manual drag / randomize. NULL = unseeded (sorted last by name in the builder).
-- Round-robin tournaments still seed from standings; this is the seed source for
-- bracket-only events (and an optional pre-seed otherwise).

ALTER TABLE teams ADD COLUMN IF NOT EXISTS seed integer;

COMMENT ON COLUMN teams.seed IS
  'Optional organizer-assigned seed number within the division (1 = top seed). NULL = unseeded. Used by the Playoff Bracket Builder "By seed number" option.';
