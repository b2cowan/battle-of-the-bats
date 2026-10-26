-- A house-league coach's name, first and last (Club Tier Stage 9c follow-up, owner 2026-10-26).
--
-- The team window used to take ONE typed name, so the invite's sign-up page could not fill its First name / Last name
-- fields. The convenor now types the two, and the sign-up page opens with them filled in (the coach can still edit).
--
-- `name` stays: it is the combined "First Last" every reader already uses (the board, the family emails, the status
-- page, the exports), kept in step by the one route that writes a coach. The two new columns hold the split exactly, so
-- nothing has to guess where "Mary Jane Smith" divides. A row from before this migration has both NULL; the sign-up page
-- then splits its `name` at the first space for the pre-fill only. No backfill. Additive.
-- Requires 377.

ALTER TABLE public.league_team_coaches
  ADD COLUMN IF NOT EXISTS first_name text CHECK (first_name IS NULL OR length(btrim(first_name)) BETWEEN 1 AND 120),
  ADD COLUMN IF NOT EXISTS last_name  text CHECK (last_name IS NULL OR length(btrim(last_name)) BETWEEN 1 AND 120);
