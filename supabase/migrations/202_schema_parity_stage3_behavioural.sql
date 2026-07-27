-- ============================================================
-- Migration 202 — Schema parity Stage 3: the behavioural half (8 of 48 divergences)
--
-- Every change here alters what the database DOES, so each was an explicit owner decision
-- (2026-07-27). Convergence direction is NOT uniformly "make prod match dev" — for two columns
-- prod is the correct one and dev is loosened; see §4/§5.
--
-- IDEMPOTENT + ENV-AGNOSTIC: the same file applies to both environments (migration-200 pattern).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. tournaments.status default: prod 'completed' -> 'draft' (dev's value).
--    A tournament created without an explicit status was born FINISHED on prod. Latent rather
--    than live — every code path writes status explicitly (lib/db.ts clone, create) — but the
--    default is indefensible and would bite the first insert that omitted it.
-- ------------------------------------------------------------
ALTER TABLE tournaments ALTER COLUMN status SET DEFAULT 'draft';

-- ------------------------------------------------------------
-- 2. tournaments.list_in_directory default: prod false -> true (dev's value).
--    NOT a new decision — this forward-ports migration 197 ("tournaments discoverable by
--    default", owner decision 2026-07-22), which was applied to dev and never reached prod.
--    Existing rows are UNTOUCHED (no backfill) exactly as 197 specified; prod's two live
--    tournaments are already listed. The public-status gate still ANDs at query time
--    (status IN ('active','completed')), so a default-listed DRAFT never surfaces.
-- ------------------------------------------------------------
ALTER TABLE tournaments ALTER COLUMN list_in_directory SET DEFAULT true;

-- ------------------------------------------------------------
-- 3. tournaments_status_check: exists on PROD only -> added to DEV.
--    Prod is right. Without it dev accepts status values prod rejects, so a feature can pass
--    dev and fail on release. Dev's live values (active, archived, completed) all satisfy it,
--    so it validates clean. Domain is the 4-value TournamentStatus union (lib/types.ts).
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tournaments_status_check' AND conrelid = 'public.tournaments'::regclass
  ) THEN
    ALTER TABLE tournaments
      ADD CONSTRAINT tournaments_status_check
      CHECK (status IN ('draft', 'active', 'completed', 'archived'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. LOOSEN PROD (3 columns) — prod was NOT NULL where "no value" is genuinely meaningful,
--    and each of these has a LIVE write path that sends NULL. These are production bugs:
--
--    games.location   — clearVenueFromGames writes location:null when a venue is deleted
--                       (app/api/admin/venues/route.ts:105) and clearFacilityFromGames at :131.
--                       DELETING A VENUE CURRENTLY FAILS ON PROD. Dev holds 60/378 such rows.
--    diamonds.address — venue create writes address ?? null (venues/route.ts:449); address is
--                       optional in the form. CREATING AN ADDRESS-LESS VENUE FAILS ON PROD.
--    teams.coach      — the registration bulk-import writes coach: string|null
--                       (registrations/import/shared.ts:116). AN IMPORT WITH A BLANK COACH
--                       COLUMN FAILS ON PROD. Dev holds 49/229 such rows.
--
--    Non-destructive (relaxing a constraint rewrites nothing) and removes three live failure
--    modes. NOTE: 17 of prod's 21 teams carry coach='' because the interactive admin path
--    coerces (admin/teams/route.ts:321) rather than failing — a DATA inconsistency this
--    migration deliberately does NOT rewrite. Flagged for a separate decision.
-- ------------------------------------------------------------
ALTER TABLE games    ALTER COLUMN location DROP NOT NULL;
ALTER TABLE diamonds ALTER COLUMN address  DROP NOT NULL;
ALTER TABLE teams    ALTER COLUMN coach    DROP NOT NULL;

-- ------------------------------------------------------------
-- 5. TIGHTEN DEV (2 columns) — here PROD is the correct one, so dev converges upward rather
--    than prod being loosened. Both have ZERO nulls on dev (audited 2026-07-27), so both
--    validate clean, and neither has a null-writing path:
--
--    announcements.body   — POST /api/admin/communications already 400s on a blank body
--                           (communications/route.ts:155); every insert writes data.body.trim().
--    tournaments.slug     — the URL key. Always written explicitly (lib/db.ts clone/create).
--                           mapTournament masks null on READ (null -> '') but not on write, so
--                           a null slug is a latent 404 generator.
-- ------------------------------------------------------------
ALTER TABLE announcements ALTER COLUMN body SET NOT NULL;
ALTER TABLE tournaments   ALTER COLUMN slug SET NOT NULL;

COMMIT;

-- Verification (run against BOTH envs — results must be identical):
--   SELECT column_name, is_nullable, column_default FROM information_schema.columns
--    WHERE table_schema='public'
--      AND (table_name, column_name) IN (VALUES
--            ('tournaments','status'),('tournaments','list_in_directory'),('tournaments','slug'),
--            ('games','location'),('diamonds','address'),('teams','coach'),
--            ('announcements','body'))
--    ORDER BY 1;
--   SELECT conname FROM pg_constraint WHERE conname='tournaments_status_check';
