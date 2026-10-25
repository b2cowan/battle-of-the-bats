-- 360 · A house league season no longer carries a free-text "division" label (owner ruling 2026-10-25).
--
-- league_seasons.division (text; the old age_group label renamed by mig 093) was a single badge a coach typed ("U11", "Adult").
-- A season's real divisions live in league_divisions (names, birth years, spots, teams), and nothing in the product reads the
-- label for a decision: it only showed as a tag on the public season page and a "Division: ..." line on the registration page,
-- where the real divisions already sit. Two places to say the same thing could disagree, so the label is removed.
--
-- SAFE ORDER: the code that stops reading and writing the column ships first; this drop goes last. Old code that still writes
-- `division` on a season insert would fail once the column is gone.
-- No view, trigger, function, index, constraint or policy references the column.
BEGIN;

ALTER TABLE public.league_seasons DROP COLUMN IF EXISTS division;

COMMIT;
