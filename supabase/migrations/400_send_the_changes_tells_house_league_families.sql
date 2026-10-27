-- ---------------------------------------------------------------
-- Migration 400 — Club Tier Stage 11b Part 5: the club's Send the changes tells house league's families.
-- Plan: docs/projects/active/HOUSE_LEAGUE_STAGE9_PLAN.md §9 (the 11b status log); build prompt
-- docs/projects/active/CLUB_TIER_STAGE11B_PART5_BUILD_PROMPT.md; ruling 9d2·2 (a practice CHANGE emails that team's
-- families as well as its coaches: one email per household per send, one part per child).
--
-- WHY: Send the changes now moves and cancels house-league practices (club_schedule_apply_changes' `p_league`, migs
-- 392–393) and emails the teams' families a service notice. Each send is one Automatic row on the season's Email families
-- history (9d-1, `league_season_notices`), whose kind allowed only Publish teams ("9d-2's schedule notices add their
-- kinds here").
--
-- WHAT CHANGES:
--   1. league_season_notices.kind gains 'practices_changed': one row per season a Send the changes touched.
--   2. league_season_notices.club_schedule_send_id: the club's send that wrote it (null for every other kind) — the
--      notice's way back to the send log, and how a re-read of one send finds its families' row.
-- Additive. Re-runnable.
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.league_season_notices DROP CONSTRAINT IF EXISTS league_season_notices_kind_check;
ALTER TABLE public.league_season_notices
  ADD CONSTRAINT league_season_notices_kind_check CHECK (kind IN ('teams_published', 'practices_changed'));

ALTER TABLE public.league_season_notices
  ADD COLUMN IF NOT EXISTS club_schedule_send_id uuid REFERENCES public.club_schedule_sends(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS league_season_notices_send_idx
  ON public.league_season_notices (club_schedule_send_id) WHERE club_schedule_send_id IS NOT NULL;

COMMENT ON COLUMN public.league_season_notices.kind IS
  'teams_published = Publish teams (9c); practices_changed = the club''s Send the changes moved or cancelled this season''s '
  'practices and emailed the teams'' families (Club Tier 11b Part 5, ruling 9d2·2).';
COMMENT ON COLUMN public.league_season_notices.club_schedule_send_id IS
  'For practices_changed: the club''s Send the changes (club_schedule_sends) that wrote it. Null for every other kind.';

COMMIT;
