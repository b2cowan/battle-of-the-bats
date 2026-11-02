-- ---------------------------------------------------------------
-- Migration 423 — House League Stage 9e-1 Part 1 (ruling 9e·5): a division's "Show standings" switch. Build prompt
-- docs/projects/active/HOUSE_LEAGUE_STAGE9E1_BUILD_PROMPT.md, Part 1.
--
--   show_standings   true (the default) = the division keeps a table: families see it on the public standings page once
--                    the division's schedule is published, and its coaches see their standing line. False = a division
--                    that doesn't rank teams (younger age groups often don't): no public table, no tab, no coach line.
--                    The club's own admin table shows either way. Written only by the division PATCH.
--
-- Additive: every existing division reads true, which is what the page showed before. Re-runnable. A plain column, so
-- check:migrations sees it (no MANUAL_PROD_STEPS.json entry). Apply BEFORE promoting the code that reads it.
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.league_divisions
  ADD COLUMN IF NOT EXISTS show_standings boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.league_divisions.show_standings IS
  'House League 9e-1 (9e·5): the division keeps standings. False = no public table and no coach standing line; the '
  'admin table shows either way. Default true.';

COMMIT;

-- Verify (dev, then prod):
--   SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns
--    WHERE table_name = 'league_divisions' AND column_name = 'show_standings';       -- 1 row: boolean, true, NO
--   SELECT count(*) FROM league_divisions WHERE NOT show_standings;                   -- 0 right after
