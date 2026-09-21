-- Migration 306: a scrimmage is a flag, not a kind of game.
-- (Owner question + ruling "the flag" 2026-09-20; D1–D6 accepted as recommended the same day.
--  Plan: docs/projects/active/COACH_SCRIMMAGE_IS_A_FLAG_PLAN.md)
--
-- `scrimmage` and `league_game` carried identical fields and differed only in what read them, and
-- the kind was locked once an event existed — so a coach could never move a game between the two,
-- and the Free→Premium upgrade's "the coach can reclassify" note was a promise nothing kept. From
-- this migration a scrimmage is a GAME with `is_scrimmage` set: listed on the schedule and in
-- attendance like any game, left out of the season record and the Scouting Book's numbers, and its
-- lineup opens on Development. `league_game` stays the stored key (its label is "Game" now); the
-- `scrimmage` KIND leaves the CHECK.
--
-- Four steps, in this order, all idempotent:
--   1. ADD  rep_team_events.is_scrimmage boolean NOT NULL DEFAULT false.
--   2. FOLD every `scrimmage` row → event_type 'league_game', is_scrimmage true.  (data-only)
--   3. RE-DERIVE names the PRODUCT wrote — and only those — into the new auto-shape (D2):
--        "League Game vs X" / "Scrimmage vs X" / a bare "League Game" or "Scrimmage" with an
--        opponent  →  "vs X" (home / neutral / no side) or "@ X" (away);
--        a bare "League Game" or "Scrimmage" with NO opponent  →  "Game".
--      A name a coach typed matches none of these and is never touched. The same predicate lives
--      in `isAutoShapedName` (lib/coach-schedule-vocab.ts) — keep them in step.   (data-only)
--   4. REPLACE rep_team_events_event_type_check without 'scrimmage'.
--
-- ⚠ ORDER ON RELEASE — WITH the promote, minutes before the push (the mig-290/300 lesson), because
-- the parity gate on the master build sees the CHECK text and steps 2–3 are invisible to every drift
-- check. Applying it hours ahead costs a bounded window where the OLD code (a) fails to create a
-- scrimmage — the CHECK refuses the kind it writes — and (b) reads the folded rows as league games
-- and counts them; applying it after would leave the NEW code reading `scrimmage` rows through the
-- row mapper's legacy branch (safe, by design) but the master build red on the CHECK divergence.
-- Verify with the query at the foot: 0 rows of the old kind, 0 auto-shaped names of the old shape.

ALTER TABLE public.rep_team_events
  ADD COLUMN IF NOT EXISTS is_scrimmage boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.rep_team_events.is_scrimmage IS
  '"This is a scrimmage" (mig 306): a Game (event_type league_game) kept on the schedule and in attendance but LEFT OUT of the season record and the Scouting Book''s numbers; its lineup opens on Development. Only meaningful on league_game — the routes store false for every other kind (a tournament game is scored by its organizer, owner ruling D3 2026-09-20). Editable at any time; the effect is immediate. Replaced the retired scrimmage KIND.';

-- 2. Fold the retired kind into Game + box.
UPDATE public.rep_team_events
   SET event_type = 'league_game', is_scrimmage = true
 WHERE event_type = 'scrimmage';

-- 3. Re-derive the names the product wrote (never a typed one).
UPDATE public.rep_team_events
   SET name = CASE WHEN home_away = 'away' THEN '@ ' ELSE 'vs ' END || btrim(opponent)
 WHERE event_type = 'league_game'
   AND opponent IS NOT NULL AND btrim(opponent) <> ''
   AND name IN (
     'League Game vs ' || btrim(opponent),
     'Scrimmage vs '   || btrim(opponent),
     'League Game',
     'Scrimmage'
   );

UPDATE public.rep_team_events
   SET name = 'Game'
 WHERE event_type = 'league_game'
   AND (opponent IS NULL OR btrim(opponent) = '')
   AND name IN ('League Game', 'Scrimmage');

-- 3b. The box is a GAME's only — the database says so too (/review 2026-09-21). The routes coerce
--     it silently (a tournament game is scored by its organizer, D3); this is the belt under them,
--     so a script or a future writer that forgets cannot put a scrimmage on a practice. Step 2 only
--     ever sets the box on league_game, so no existing row can violate it.
ALTER TABLE public.rep_team_events
  DROP CONSTRAINT IF EXISTS rep_team_events_scrimmage_is_a_game_check;
ALTER TABLE public.rep_team_events
  ADD CONSTRAINT rep_team_events_scrimmage_is_a_game_check
  CHECK (NOT is_scrimmage OR event_type = 'league_game');

-- 4. The CHECK no longer admits the retired kind.
ALTER TABLE public.rep_team_events
  DROP CONSTRAINT IF EXISTS rep_team_events_event_type_check;
ALTER TABLE public.rep_team_events
  ADD CONSTRAINT rep_team_events_event_type_check
  CHECK (event_type IN (
    'external_tournament', 'tournament_game', 'league_game', 'practice', 'team_event'
  ));

-- Verify (all three must be 0):
--   select count(*) from rep_team_events where event_type = 'scrimmage';
--   select count(*) from rep_team_events
--    where event_type = 'league_game' and opponent is not null
--      and name in ('League Game vs ' || btrim(opponent), 'Scrimmage vs ' || btrim(opponent));
--   select count(*) from rep_team_events where event_type = 'league_game' and name in ('League Game', 'Scrimmage');
-- And the fold's count for the record:
--   select count(*) filter (where is_scrimmage) as scrimmages, count(*) as games
--     from rep_team_events where event_type = 'league_game';
