-- ---------------------------------------------------------------
-- Migration 420 — House League Stage 9d-3 Part 6 (ruling 9d3·5): a house-league coach subscribes to their team's
-- schedule, the same Subscribe a rep coach has (mig 323). Build prompt
-- docs/projects/active/HOUSE_LEAGUE_STAGE9D3_BUILD_PROMPT.md, Part 6 (it named 416; 416–419 were taken first).
--
-- THE LINK IS SIGNED, NEVER STORED (lib/coach-calendar-link.ts): the coach row's id, this generation and an HMAC of the
-- two under CALENDAR_LINK_SECRET, signed in a DOMAIN OF ITS OWN ("league-coach-calendar:") so a rep membership's token
-- can never read as a house-league coach's, or the reverse. The server rebuilds it every time the window opens.
--
--   calendar_link_generation   bumped by Reset (the old link answers an EMPTY calendar from then on) and by the trigger
--                              below: when the coach is REMOVED (mig 323's rule, on removed_at here — a coach row has
--                              no status), and when the row's person CHANGES (a seat handed to another account must not
--                              keep feeding the first one's calendar; the feed reads the row, not the person).
--   calendar_last_read_on      the club-local day a calendar last read the link ("Read by your calendar today").
--                              Written at most once a day per feed (the owner's cost ruling, 6d). NULL = never read.
--
-- Service-role only, as the table already is (RLS on, no policies). Additive: every existing row reads 0 / NULL. The
-- trigger and its function are INVISIBLE to the drift check (MANUAL_PROD_STEPS.json says so). Separate from 415 so the
-- practice notice can ship without it (9d3·3). Re-runnable. Apply BEFORE promoting the code that reads the columns.
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.league_team_coaches
  ADD COLUMN IF NOT EXISTS calendar_link_generation integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calendar_last_read_on date;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'league_team_coaches_calendar_generation_nonneg') THEN
    ALTER TABLE public.league_team_coaches
      ADD CONSTRAINT league_team_coaches_calendar_generation_nonneg CHECK (calendar_link_generation >= 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.league_team_coach_calendar_on_revoke()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (old.removed_at IS NULL AND new.removed_at IS NOT NULL)
     OR (old.user_id IS NOT NULL AND new.user_id IS DISTINCT FROM old.user_id) THEN
    new.calendar_link_generation := old.calendar_link_generation + 1;
    new.calendar_last_read_on := NULL;
  END IF;
  RETURN new;
END $$;

REVOKE ALL ON FUNCTION public.league_team_coach_calendar_on_revoke() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS league_team_coaches_calendar_on_revoke ON public.league_team_coaches;
CREATE TRIGGER league_team_coaches_calendar_on_revoke
  BEFORE UPDATE OF removed_at, user_id ON public.league_team_coaches
  FOR EACH ROW EXECUTE FUNCTION public.league_team_coach_calendar_on_revoke();

COMMENT ON COLUMN public.league_team_coaches.calendar_link_generation IS
  'House League 9d-3 (9d3·5): the coach''s calendar link generation. Bumped by Reset and, by trigger, when the coach is '
  'removed or the row''s person changes; a link of an older generation answers an empty calendar.';
COMMENT ON COLUMN public.league_team_coaches.calendar_last_read_on IS
  'House League 9d-3 (9d3·5): the club-local day a calendar last read the coach''s link; written at most once a day. NULL = never.';

COMMIT;

-- Verify (dev, then prod):
--   SELECT count(*) FROM information_schema.columns WHERE table_name = 'league_team_coaches'
--     AND column_name IN ('calendar_link_generation', 'calendar_last_read_on');                                   -- 2
--   SELECT count(*) FROM pg_trigger WHERE tgname = 'league_team_coaches_calendar_on_revoke';                      -- 1
