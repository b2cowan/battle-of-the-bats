-- 509 — The free League is gone (owner ruling 2026-11-19, BUSINESS_DECISIONS.md top entry; plan
-- docs/projects/active/FREE_LEAGUE_AND_FOUNDING_REMOVAL_PLAN.md Stage 1).
--
-- `organizations.free_floor` (mig 125) held the free League Starter profile: 'league_starter' unioned house league onto a
-- Tournament plan, under 1 season / 1 division / 8 teams caps. The free League, its caps, its start door and every reader
-- of this column are removed in the same unit of work; house league is sold on League Plus, Club and Club · Association,
-- uncapped.
--
-- Counts before (2026-11-19, counts only): production 0 organizations with it set, dev 1 (the fixture
-- `test-minor-softball`, which stays as a plain Tournament organization). No view, policy, function or trigger reads it on
-- either database, and no `platform_events` row of the free League's event types exists on either.
--
-- PRODUCTION: AFTER the code that stops reading it is serving (a promote first — the old code selects the column by name
-- on several paths and would fail while the column is gone). A dropped column is INVISIBLE to check:migrations; it is
-- declared in MANUAL_PROD_STEPS.json. Idempotent.

alter table public.organizations drop constraint if exists organizations_free_floor_check;
alter table public.organizations drop column if exists free_floor;
