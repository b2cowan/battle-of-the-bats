-- ============================================================
-- Migration 203 — Schema parity Stage 4: audited tightenings (15 of 48 divergences)
--
-- Every change here was gated on a READ-ONLY audit of LIVE PROD (2026-07-27). The audit came
-- back clean, so NO BACKFILL IS REQUIRED — the counts are recorded inline below so a future
-- reader can see the evidence rather than trusting the claim.
--
-- Prod at audit time: 1 org, 2 tournaments, 2 divisions, 21 teams, 53 games, 2 announcements,
-- 2 diamonds, 2 resources, 0 rules, 0 rule_items.
--
-- IDEMPOTENT + ENV-AGNOSTIC: the same file applies to both environments (migration-200 pattern).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. TIGHTEN PROD — 9 columns prod left nullable that dev has always required (9 items).
--    Dev is right: every one of these is a value the app always supplies, and a NULL would
--    mean "unknown" in a field with no unknown state. Audited NULL counts on prod, all ZERO:
--
--      divisions.requires_pool_selection   0 of 2      teams.payment_status   0 of 21
--      games.is_playoff                    0 of 53     teams.registered_at    0 of 21
--      resources.display_order             0 of 2      teams.status           0 of 21
--      rule_items.display_order            0 of 0      rules.display_order    0 of 0
--      rule_items.rule_id                  0 of 0
--
--    rule_items.rule_id matters most: nullable on prod means a rule item can exist with NO
--    PARENT RULE — invisible in the UI, undeletable through it, and orphaned forever.
--
--    SET NOT NULL takes a full validation scan per column; on these row counts that is trivial.
--    Re-runnable: SET NOT NULL on an already-NOT NULL column is a no-op.
-- ------------------------------------------------------------
ALTER TABLE divisions  ALTER COLUMN requires_pool_selection SET NOT NULL;
ALTER TABLE games      ALTER COLUMN is_playoff              SET NOT NULL;
ALTER TABLE resources  ALTER COLUMN display_order           SET NOT NULL;
ALTER TABLE rule_items ALTER COLUMN display_order           SET NOT NULL;
ALTER TABLE rule_items ALTER COLUMN rule_id                 SET NOT NULL;
ALTER TABLE rules      ALTER COLUMN display_order           SET NOT NULL;
ALTER TABLE teams      ALTER COLUMN payment_status          SET NOT NULL;
ALTER TABLE teams      ALTER COLUMN registered_at           SET NOT NULL;
ALTER TABLE teams      ALTER COLUMN status                  SET NOT NULL;

-- ------------------------------------------------------------
-- 2. The MISSING games -> divisions foreign key on prod (1 item).
--
--    Dev has games_age_group_id_fkey (games.division_id -> divisions.id, ON DELETE CASCADE);
--    prod has NO key on that column at all, so deleting a division on prod ORPHANS its games.
--    Audited on prod: 0 orphans, 0 NULL division_id (of 53 games) — adds clean, no repair.
--
--    WHY CASCADE, when migration 200 chose SET NULL for the team keys — this is deliberate,
--    not a copy-paste of dev:
--      · A game references TWO teams. Cascading from one team destroys the OPPONENT's record
--        of that fixture and its score. Hence SET NULL there.
--      · A division OWNS its games and teams outright, and teams.division_id already CASCADEs
--        in BOTH environments. SET NULL here would leave games belonging to no division AND
--        no team — junk rows that surface as broken schedule entries.
--    So the destruction is correct; what was missing is CONSENT.
--
--    ⚠ SHIPPED WITH AN APPLICATION GUARD, in the same unit of work:
--    POST /api/admin/divisions {action:'delete'} now returns 409 DIVISION_HAS_GAMES with the
--    game + scored counts unless `force: true` is passed — mirroring the TEAM_HAS_GAMES guard
--    added with migration 200. Without it, adding this key would import a live data-loss path
--    INTO production. (It also closes the pre-existing one on dev, where the CASCADE has been
--    silently destroying scored games behind an unguarded delete endpoint all along.)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'games_age_group_id_fkey' AND conrelid = 'public.games'::regclass
  ) THEN
    ALTER TABLE games
      ADD CONSTRAINT games_age_group_id_fkey
      FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3a. Missing defaults on PROD that make a legal insert FAIL (2 items).
--     Both columns are NOT NULL on prod with NO default, so any insert omitting them errors
--     while the same insert succeeds on dev. These are bug fixes, not cosmetics.
-- ------------------------------------------------------------
ALTER TABLE announcements ALTER COLUMN published_at  SET DEFAULT now();
ALTER TABLE divisions     ALTER COLUMN display_order SET DEFAULT 0;

-- ------------------------------------------------------------
-- 3b. Defaults where PROD's value is the better one -> adopted on DEV (2 items).
--     The code already assumes both, so this makes the schema state what the app believes
--     rather than leaving the assumption implicit.
--       divisions.pool_count — read as `pool_count || 1` throughout; default 1 makes that
--                              fallback the schema's job, not every caller's.
--       rules.icon           — 'Shield' is the UI's fallback glyph for an iconless rule.
-- ------------------------------------------------------------
ALTER TABLE divisions ALTER COLUMN pool_count SET DEFAULT 1;
ALTER TABLE rules     ALTER COLUMN icon       SET DEFAULT 'Shield';

-- ------------------------------------------------------------
-- 3c. Default dropped on PROD (1 item).
--     divisions.playoff_config carried a default single-elimination config on prod and none on
--     dev. A division that was never configured should READ as unconfigured — a silent default
--     makes "nobody set this up" indistinguishable from "somebody chose these exact settings".
--     Existing rows keep whatever they hold; this changes new rows only.
-- ------------------------------------------------------------
ALTER TABLE divisions ALTER COLUMN playoff_config DROP DEFAULT;

COMMIT;

-- Verification (run against BOTH envs — results must be identical):
--   SELECT table_name, column_name, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema='public'
--      AND (table_name, column_name) IN (VALUES
--            ('divisions','requires_pool_selection'),('games','is_playoff'),
--            ('resources','display_order'),('rule_items','display_order'),
--            ('rule_items','rule_id'),('rules','display_order'),
--            ('teams','payment_status'),('teams','registered_at'),('teams','status'),
--            ('announcements','published_at'),('divisions','display_order'),
--            ('divisions','pool_count'),('rules','icon'),('divisions','playoff_config'))
--    ORDER BY 1,2;
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname='games_age_group_id_fkey';
