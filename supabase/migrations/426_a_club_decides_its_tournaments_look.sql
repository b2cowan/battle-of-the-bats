-- ---------------------------------------------------------------
-- Migration 426 — Public tournament pages, Stage 1a Part 1: who owns a tournament's look. Build prompt
-- docs/projects/active/PUBLIC_TOURNAMENT_STAGE1A_BUILD_PROMPT.md, Part 1 (Asks 9–11, ruled 2026-10-27; the drawing,
-- ruled 2026-11-02).
--
--   organizations.tournament_look_policy   the club's one rule for its tournaments' look, applied when pages are shown:
--                    'club_default' (the default, today's behaviour) = the club's look unless a tournament chooses its
--                    own; 'always_club' = every tournament wears the club's colours and type (each keeps its own logo).
--                    It NEVER writes a tournament's saved look: switching back restores each one. Read only through
--                    lib/tournament-look.ts. Meaningful only on a plan with the public site; written by org-settings.
--
--   tournaments.theme_font   now means the tournament's TYPE LOOK (system | dm-serif | inter; null = follow). It was
--                    never read on a public page, so any value in it is an invisible pick from the retired font list —
--                    emptied here so no tournament wakes up in a type nobody saw it choose. Counted before writing
--                    this file: dev 2 (both 'inter'); prod — see the build prompt's Part 1 record.
--
-- The column is additive and re-runnable. The UPDATE is data-only (MANUAL_PROD_STEPS.json carries its entry). Apply
-- BEFORE promoting the code that reads the column.
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS tournament_look_policy text NOT NULL DEFAULT 'club_default';

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_tournament_look_policy_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_tournament_look_policy_check
  CHECK (tournament_look_policy IN ('club_default', 'always_club'));

COMMENT ON COLUMN public.organizations.tournament_look_policy IS
  'Public tournament pages 1a: the club''s rule for its tournaments'' look. club_default = the club''s look unless a '
  'tournament chooses its own; always_club = every tournament wears the club''s colours and type (own logo kept). Read '
  'at render time, never writes a tournament''s saved look.';

UPDATE public.tournaments SET theme_font = NULL WHERE theme_font IS NOT NULL;

COMMENT ON COLUMN public.tournaments.theme_font IS
  'Public tournament pages 1a: the tournament''s type look (system = Classic, dm-serif = Serif, inter = Clean); null = '
  'follow the club''s (Classic with no club layer).';

COMMIT;

-- Verify (dev, then prod):
--   SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns
--    WHERE table_name = 'organizations' AND column_name = 'tournament_look_policy';  -- 1 row: text, 'club_default', NO
--   SELECT count(*) FROM tournaments WHERE theme_font IS NOT NULL;                    -- 0 right after
