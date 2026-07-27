-- ============================================================
-- Migration 200 — games→teams foreign keys: CASCADE ⇒ SET NULL (prod data-loss fix)
--
-- WHAT WAS WRONG
-- dev and prod both had a constraint named `games_home_team_id_fkey`, but:
--     dev  = ON DELETE SET NULL   → deleting a team KEEPS its games, blanking that side
--     prod = ON DELETE CASCADE    → deleting a team DELETES every game it played
-- and prod additionally carried `fk_games_home_team` / `fk_games_away_team` (both CASCADE)
-- as duplicates of the same relationships.
--
-- The admin team-delete endpoint had no guard, so on prod deleting one team silently
-- destroyed that team's entire schedule — including the OPPONENT's record of those fixtures
-- and their scores. At the time of writing prod holds 21 teams / 53 games, and all 53 have
-- both teams assigned and a score recorded.
--
-- WHY NOBODY SAW IT
-- A foreign key's NAME says nothing about what it DOES. The drift report, the pre-release
-- migration gate, and the new schema-parity gate all compared constraints by name only, so
-- two identically-named keys with opposite consequences read as "in sync". The snapshot now
-- captures delete_rule/update_rule and the parity gate compares them (same commit).
--
-- TARGET STATE (identical in both environments)
--     games.home_team_id → teams.id   games_home_team_id_fkey   ON DELETE SET NULL
--     games.away_team_id → teams.id   games_away_team_id_fkey   ON DELETE SET NULL
--   and no fk_games_home_team / fk_games_away_team duplicates.
--
-- SAFETY
-- Both columns are already nullable in BOTH environments, so SET NULL is applicable without
-- any column change. Re-runnable: every DROP is IF EXISTS and the ADDs are guarded, so this
-- is a no-op on an environment already in the target state (dev is, apart from the drop of
-- duplicates it never had). No rows are deleted or rewritten — only constraint metadata plus
-- one validation scan per key.
--
-- Paired with an app-level guard: DELETE /api/admin/teams now returns 409 TEAM_HAS_GAMES when
-- a team still appears in a game, unless `force: true` is passed. The FK stops the destruction;
-- the guard stops you stranding a fixture by accident.
-- ============================================================

BEGIN;

-- 1. Remove the CASCADE keys (the duplicates and the mis-actioned canonical ones).
ALTER TABLE games DROP CONSTRAINT IF EXISTS fk_games_home_team;
ALTER TABLE games DROP CONSTRAINT IF EXISTS fk_games_away_team;
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_home_team_id_fkey;
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_away_team_id_fkey;

-- 2. Recreate exactly one key per relationship, with the dev (safe) action.
--    Named explicitly so both environments converge on the same constraint name.
ALTER TABLE games
  ADD CONSTRAINT games_home_team_id_fkey
  FOREIGN KEY (home_team_id) REFERENCES teams(id) ON DELETE SET NULL;

ALTER TABLE games
  ADD CONSTRAINT games_away_team_id_fkey
  FOREIGN KEY (away_team_id) REFERENCES teams(id) ON DELETE SET NULL;

COMMIT;

-- Verification (expect exactly two rows, both SET NULL):
--   SELECT rc.constraint_name, rc.delete_rule
--   FROM information_schema.referential_constraints rc
--   JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = rc.constraint_name
--   WHERE kcu.table_name = 'games' AND kcu.column_name IN ('home_team_id','away_team_id');
