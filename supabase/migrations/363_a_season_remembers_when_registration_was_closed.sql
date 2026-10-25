-- 363 · A house-league season remembers when its convenor closed registration (Club Tier Stage 9b-1, Part 4; owner rulings
-- 2026-10-24 S2·b "the dates run the form; the convenor can close early or reopen until a new date, and the page says
-- which", and 2026-10-25 Close / Reopen until…).
--
-- From 9b-1 the form's own dates open and close it. A season can therefore be closed two ways, and the page always says
-- which: the close date passed ("Closed Aug 1"), or the convenor pressed Close registration ("You closed registration on
-- Oct 3"). The second needs the day it happened; nothing stored it. Set to now() by the season route when the status moves
-- to registration_closed; cleared when registration reopens. A real moment (timestamptz), read as the club's day.
--
-- ADDITIVE ONLY. Existing closed seasons keep NULL (their page reads "You closed registration." without a day).
BEGIN;

ALTER TABLE public.league_seasons ADD COLUMN IF NOT EXISTS registration_closed_at timestamptz;

COMMIT;
