-- ============================================================
-- Migration 201 — Schema parity Stage 2: the safe / additive half (25 of 48 divergences)
--
-- WHY THERE IS DRIFT AT ALL
-- The nine original tables (announcements, diamonds, divisions, games, resources, rule_items,
-- rules, teams, tournaments) were hand-created in the Supabase dashboard SEPARATELY PER
-- ENVIRONMENT between 2026-04-22 and 2026-05-02. Migration 001 only ever ALTERed an existing
-- schema — not one of those nine tables is created by any migration. Everything a migration
-- created since has stayed in step. league_practices is the lone exception: created by
-- migration, but its indexes were named differently per env.
--
-- SCOPE: this file carries ONLY changes with no data risk and no behaviour change.
-- Behavioural convergence is migrations 202 (owner-decided) and 203 (audited).
--
-- IDEMPOTENT + ENV-AGNOSTIC by design (the migration-200 pattern): every statement is guarded,
-- so the SAME file applies to dev and prod and the migration ledger stays identical. Statements
-- targeting prod's shape are no-ops on dev and vice versa.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Constraint NAME convergence (10 items) — prod carries hand-created names.
--
-- ⚠ ALL FIVE were verified `ON DELETE CASCADE` on BOTH sides (pg_get_constraintdef, 2026-07-27)
-- BEFORE being renamed. A rename that unifies the NAME while the BEHAVIOUR differs manufactures
-- FALSE parity — which is exactly how the migration-200 production data-loss bug hid for months.
-- Do not add a pair to this list without checking delete_rule/update_rule on both sides first.
-- ------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('announcements', 'fk_announcements_tournament', 'announcements_tournament_id_fkey'),
      ('diamonds',      'fk_diamonds_tournament',      'diamonds_tournament_id_fkey'),
      ('divisions',     'fk_age_groups_tournament',    'age_groups_tournament_id_fkey'),
      ('games',         'fk_games_tournament',         'games_tournament_id_fkey'),
      ('teams',         'fk_teams_tournament',         'teams_tournament_id_fkey')
    ) AS t(tbl, old_name, new_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = r.old_name AND conrelid = ('public.' || r.tbl)::regclass
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = r.new_name AND conrelid = ('public.' || r.tbl)::regclass
    ) THEN
      EXECUTE format('ALTER TABLE public.%I RENAME CONSTRAINT %I TO %I', r.tbl, r.old_name, r.new_name);
      RAISE NOTICE 'renamed %.% -> %', r.tbl, r.old_name, r.new_name;
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 2. Drop EXACT-DUPLICATE foreign keys on prod (2 items).
--
-- Both are byte-identical second copies of a key that already exists under the dev name:
--   fk_teams_age_group  == teams_age_group_id_fkey   (division_id -> divisions.id, CASCADE)
--   fk_games_diamond    == games_diamond_id_fkey     (diamond_id  -> diamonds.id,  SET NULL)
-- The canonical twin STAYS, so the relationship is never left unenforced. Guarded so a missing
-- twin aborts rather than silently dropping the only key protecting the column.
-- ------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('teams', 'fk_teams_age_group', 'teams_age_group_id_fkey'),
      ('games', 'fk_games_diamond',   'games_diamond_id_fkey')
    ) AS t(tbl, dup_name, keep_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = r.dup_name AND conrelid = ('public.' || r.tbl)::regclass
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = r.keep_name AND conrelid = ('public.' || r.tbl)::regclass
      ) THEN
        RAISE EXCEPTION
          'Refusing to drop %.% — its canonical twin % is missing, so this is NOT a duplicate.',
          r.tbl, r.dup_name, r.keep_name;
      END IF;
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl, r.dup_name);
      RAISE NOTICE 'dropped duplicate %.%', r.tbl, r.dup_name;
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 3. ID-generator defaults (3 items) — prod used uuid_generate_v4() (uuid-ossp extension),
--    dev uses the built-in gen_random_uuid(). Identical output; converging drops prod's
--    dependency on an extension for these three tables. No-op where already set.
-- ------------------------------------------------------------
ALTER TABLE resources  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE rule_items ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE rules      ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ------------------------------------------------------------
-- 4. league_practices indexes (7 items).
--    a) prod's *_season_id_idx / *_team_id_idx -> dev's *_season_idx / *_team_idx (rename only).
--    b) recurrence index: dev's is PARTIAL, prod's is plain. Same column, different plan
--       eligibility — rebuilt as partial so both are genuinely the same index.
--    c) league_practices_schedule_idx (season_id, scheduled_at) exists ONLY on dev — a real,
--       performance-only gap. Created on prod.
-- ------------------------------------------------------------
ALTER INDEX IF EXISTS league_practices_season_id_idx RENAME TO league_practices_season_idx;
ALTER INDEX IF EXISTS league_practices_team_id_idx   RENAME TO league_practices_team_idx;

DROP INDEX IF EXISTS league_practices_recurrence_group_id_idx;
CREATE INDEX IF NOT EXISTS league_practices_recurrence_idx
  ON league_practices (recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS league_practices_schedule_idx
  ON league_practices (season_id, scheduled_at);

-- ------------------------------------------------------------
-- 5. created_at on the three rules/resources tables (3 items) — present on prod ONLY.
--    ADDED TO DEV, never dropped from prod: dropping would destroy real timestamps.
--    Definition copied exactly from prod (timestamptz NULL DEFAULT now()) so the columns
--    match rather than merely both existing.
-- ------------------------------------------------------------
ALTER TABLE resources  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE rule_items ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE rules      ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

COMMIT;

-- Verification (run against BOTH envs — results must be identical):
--   SELECT conname FROM pg_constraint
--    WHERE conrelid IN ('announcements'::regclass,'diamonds'::regclass,'divisions'::regclass,
--                       'games'::regclass,'teams'::regclass)
--      AND contype = 'f' ORDER BY 1;
--   SELECT indexname, indexdef FROM pg_indexes WHERE tablename='league_practices' ORDER BY 1;
--   SELECT table_name, column_name, is_nullable, column_default FROM information_schema.columns
--    WHERE table_name IN ('resources','rule_items','rules') AND column_name IN ('id','created_at')
--    ORDER BY 1,2;
