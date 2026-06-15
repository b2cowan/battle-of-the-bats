-- Migration 129: collapse divisions.schedule_visibility from three states to two
--
-- WHY: coaches reported that publishing a schedule with placeholder team names
-- ("Pool A Team 1", "Team 2", …) before real teams are registered is not a real
-- use case — it only adds a confusing third state and a name-mode choice on every
-- publish. Schedule publishing is being simplified to a single action: close the
-- division's registration, then publish with REAL team names.
--
-- BEFORE: schedule_visibility ∈ {'unpublished', 'published_generic', 'published_teams'}
--   - 'unpublished'      → admin-only, "schedule coming soon" publicly
--   - 'published_generic'→ public times/locations but matchups shown as placeholders;
--                          registration stayed OPEN. *** being removed ***
--   - 'published_teams'  → public with real team names; registration force-closed
--
-- AFTER: schedule_visibility ∈ {'unpublished', 'published'}
--   - 'unpublished' → unchanged
--   - 'published'   → public with real team names (the renamed 'published_teams')
--
-- DATA REWRITE (owner decision 2026-06-15):
--   - Any 'published_generic' row REVERTS to 'unpublished' (never auto-expose names
--     that were deliberately hidden mid-registration — force an intentional re-publish).
--   - Any 'published_teams' row is RENAMED to 'published' (Q1 = full cleanup; there are
--     effectively no live published schedules, so the rename blast radius is small).
--
-- CONSTRAINT NAME: the column lives on `divisions`, but the table was renamed from
-- `age_groups`, so the inline CHECK from migration 042 kept its generated name
-- `age_groups_schedule_visibility_check` (confirmed from the live dev+prod snapshots,
-- NOT from the 042 migration). We drop that and re-add under the same legacy name to
-- avoid a gratuitous rename.
--
-- ORDER MATTERS: drop the old CHECK first so the data rewrites below don't fight the
-- old allow-list, rewrite the data, then re-add the tightened CHECK.
--
-- DEPLOY GATE: dev-only on apply. Must reach prod (npm run check:migrations) before the
-- two-state code (lib/types.ts narrowed union + the published_teams→published rename
-- across the runtime) ships to prod. Default stays 'unpublished' (no change).

-- 1) Drop the existing three-value CHECK so the rewrites are not blocked.
ALTER TABLE public.divisions
  DROP CONSTRAINT IF EXISTS age_groups_schedule_visibility_check;

-- 2) Revert any placeholder-published rows to unpublished (no accidental name exposure).
UPDATE public.divisions
  SET schedule_visibility = 'unpublished'
  WHERE schedule_visibility = 'published_generic';

-- 3) Rename the real-names-published value.
UPDATE public.divisions
  SET schedule_visibility = 'published'
  WHERE schedule_visibility = 'published_teams';

-- 4) Re-add the tightened two-value CHECK under the same (legacy) name.
-- DROP-before-ADD again here (not just step 1) so the whole migration is idempotent:
-- ADD CONSTRAINT has no IF NOT EXISTS, so a literal re-run (e.g. a retried prod apply
-- after the DDL committed) would otherwise hard-error "constraint already exists".
ALTER TABLE public.divisions
  DROP CONSTRAINT IF EXISTS age_groups_schedule_visibility_check;
ALTER TABLE public.divisions
  ADD CONSTRAINT age_groups_schedule_visibility_check
    CHECK (schedule_visibility IN ('unpublished', 'published'));

COMMENT ON COLUMN public.divisions.schedule_visibility IS
  'Per-division public schedule state (mig 129, two-state). ''unpublished'' = admin-only / "schedule coming soon" publicly. ''published'' = public schedule live with REAL team names (publishing also closes the division''s registration). The legacy ''published_generic'' (placeholder names while registration stayed open) was removed — those rows were reverted to ''unpublished''; ''published_teams'' was renamed to ''published''. Default ''unpublished''.';
