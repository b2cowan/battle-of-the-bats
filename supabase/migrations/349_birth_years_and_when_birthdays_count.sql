-- ---------------------------------------------------------------
-- Migration 349 — Club Tier Stage 4c-2, Part A: birth years, when birthdays count from, and the tryout blurb's limit
-- (drawings ruled 2026-10-22, all 13 asks A plus round 2's club cut-off per sport; build prompt
-- docs/projects/active/CLUB_TIER_STAGE4C2_BUILD_PROMPT.md)
--
-- WHY: a family reading the club's site cannot tell which team their child belongs on — no team, season or house-league
-- division records a birth year (finding C2-01). And the tryout blurb has no limit, so a pasted letter pushes "Sign up"
-- below the fold on a phone (C2-04).
--
-- WHAT CHANGES:
--   (1) rep_program_years.born_from_year / born_to_year — on the SEASON, not the team (Ask 4): a 13U team's years change
--       every September, and in the autumn a team can have two seasons open, which a team-level field could not tell
--       apart. Nullable; an empty side means "no limit on that side". The CHECKs are the WEAK form of the app's rule:
--       each is a plausible year, and from <= to. The strict rule (a year after this calendar year is held; with a
--       non-January cut-off the TO-date is the day before the cut-off, so from = to is backwards) depends on today and
--       on the club's cut-off, so it lives in lib/born-years.ts and nowhere else. ⚠ A stored pair can therefore be
--       valid here and unshowable there (a one-year team after the club moves its sport off January 1 — owner ruling
--       2026-10-22: it shows no born line and stays in every Born in list until the club types new years).
--   (2) rep_program_years.born_years_carried — true when Start next season wrote the pair one year later; drives the
--       note under the boxes. Cleared when the club saves the years. The "or the season's first game has started" half
--       of the note's rule is read at render time, not stored.
--   (3) league_divisions.born_from_year / born_to_year — the same pair on a house-league division. Divisions are typed
--       fresh every season, so there is no carried marker.
--   (4) organizations.birthday_cutoffs — jsonb keyed by NORMALIZED sport id (lib/sports.ts normalizeSportId):
--       {"softball":{"m":9,"d":1}}. An absent sport counts from January 1, so '{}' is every club today. Chosen over a
--       small table: it is read with the org on every public page that already loads the org, it has no lifecycle of its
--       own (no rows to orphan when a sport stops being run — an unused key is simply never read), and the shape is
--       held by birthday_cutoffs_valid() below. Teams and divisions store YEARS and read their sport's cut-off when shown,
--       so a change re-reads every team of that sport at once (round 2 ruling).
--   (5) rep_program_years.tryout_description CHECK char_length <= 500 (Ask 8). Read first, 2026-10-22: the longest value
--       on dev AND prod is 162 characters; none is over 500.
--
-- birthday_cutoffs_valid() is a function, which the drift check cannot see: declared in MANUAL_PROD_STEPS.json with
-- a pg_proc check. Safe to run twice. Prod: at or before the promote that carries Stage 4c-2 Part A's code.
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.rep_program_years
  ADD COLUMN IF NOT EXISTS born_from_year     smallint,
  ADD COLUMN IF NOT EXISTS born_to_year       smallint,
  ADD COLUMN IF NOT EXISTS born_years_carried boolean NOT NULL DEFAULT false;

ALTER TABLE public.league_divisions
  ADD COLUMN IF NOT EXISTS born_from_year smallint,
  ADD COLUMN IF NOT EXISTS born_to_year   smallint;

ALTER TABLE public.rep_program_years DROP CONSTRAINT IF EXISTS rep_program_years_born_years_check;
ALTER TABLE public.rep_program_years ADD CONSTRAINT rep_program_years_born_years_check CHECK (
  (born_from_year IS NULL OR born_from_year BETWEEN 1900 AND 2100)
  AND (born_to_year IS NULL OR born_to_year BETWEEN 1900 AND 2100)
  AND (born_from_year IS NULL OR born_to_year IS NULL OR born_from_year <= born_to_year)
);

ALTER TABLE public.league_divisions DROP CONSTRAINT IF EXISTS league_divisions_born_years_check;
ALTER TABLE public.league_divisions ADD CONSTRAINT league_divisions_born_years_check CHECK (
  (born_from_year IS NULL OR born_from_year BETWEEN 1900 AND 2100)
  AND (born_to_year IS NULL OR born_to_year BETWEEN 1900 AND 2100)
  AND (born_from_year IS NULL OR born_to_year IS NULL OR born_from_year <= born_to_year)
);

ALTER TABLE public.rep_program_years DROP CONSTRAINT IF EXISTS rep_program_years_tryout_description_length;
ALTER TABLE public.rep_program_years ADD CONSTRAINT rep_program_years_tryout_description_length
  CHECK (tryout_description IS NULL OR char_length(tryout_description) <= 500);

-- The shape of organizations.birthday_cutoffs: an object whose keys are sport ids and whose values are exactly
-- {"m": 1–12, "d": a day that month has}. February has 28 days here — Feb 29 is refused (it would skip three years
-- in four). CASE, not OR, so a malformed value never reaches a cast.
CREATE OR REPLACE FUNCTION public.birthday_cutoffs_valid(c jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_typeof(c) = 'object' AND NOT EXISTS (
    SELECT 1
    FROM jsonb_each(c) AS e(key, value)
    WHERE CASE
      WHEN e.key !~ '^[a-z][a-z0-9_-]{0,31}$' THEN true
      WHEN jsonb_typeof(e.value) <> 'object' THEN true
      WHEN (SELECT count(*) FROM jsonb_object_keys(e.value)) <> 2 THEN true
      WHEN jsonb_typeof(e.value -> 'm') IS DISTINCT FROM 'number'
        OR jsonb_typeof(e.value -> 'd') IS DISTINCT FROM 'number' THEN true
      WHEN (e.value ->> 'm') !~ '^[0-9]{1,2}$' OR (e.value ->> 'd') !~ '^[0-9]{1,2}$' THEN true
      WHEN (e.value ->> 'm')::int NOT BETWEEN 1 AND 12 THEN true
      ELSE (e.value ->> 'd')::int NOT BETWEEN 1 AND
        (ARRAY[31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])[(e.value ->> 'm')::int]
    END
  );
$$;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS birthday_cutoffs jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_birthday_cutoffs_shape;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_birthday_cutoffs_shape
  CHECK (public.birthday_cutoffs_valid(birthday_cutoffs));

COMMIT;
