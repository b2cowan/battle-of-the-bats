-- 319 — A rep team's booking can stand on one of the club's venues
-- (Club Tier Stage 6a, owner ratification 2026-10-08 — all thirteen asks as recommended; plan:
--  docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md §6 Stage 6; hub K4MPu4ni53Ct7yrDcmWJd9 v64)
--
-- Three venue books shared no key: house league points at the club's Venue library (org_venues), a
-- tournament keeps its own copy, and a rep team keeps typed words plus its own place book. So two of
-- a club's own teams on one diamond at once could never be seen, by anything (S6-01). The one clash
-- check Stage 6 builds needs every booking it compares to name the CLUB's venue and facility.
--
-- Counted before writing (read-only, 2026-10-08): dev — 0 of 10 library-plan orgs have a venue, 259
-- timed rep events, 0 on a club venue; prod — 1 library-plan org (the coach demo), 0 venues, 132
-- timed rep events, 0 on a club venue. Nothing to backfill: a link appears only when a coach picks
-- one of the club's venues, which no screen offered until this stage.
--
-- Two tables, the same two links on each, all additive and nullable:
--   1. rep_team_events.org_venue_id / org_venue_facility_id — the club venue and its facility.
--      ⚠ On the EVENT, not on rep_team_places (the build note on the plan's line "a place references
--      a venue"): a place cannot carry the diamond, which changes game by game, and the check needs
--      both. The event keeps its own location / location_address / field_number as its COPY, the way a
--      picked place's words are kept (mig 307), so the family calendar and the Maps link read
--      unchanged. place_id stays for a coach's own place; a club venue is never a place.
--   2. rep_tryout_sessions.org_venue_id / org_venue_facility_id — the owner's answer at 6a's start
--      (2026-10-08, "Join the check"): a tryout on Lions Park Diamond 2 at 6:00 p.m. takes the diamond
--      as surely as a practice, so a tryout day holds the same two links and joins the lookup.
--
-- ON DELETE SET NULL on all four, MATCHING house league's league_games / league_practices exactly:
-- deleting a library venue clears the link and leaves the event's own words (it still says where it
-- was). Stage 6b's Archive (`org_venues.is_active`) is what keeps a venue in use from being deleted
-- (S6-08); until then a delete behaves for a rep booking exactly as it already does for a league one.
-- (A facility is deleted with its venue — org_venue_facilities CASCADEs — so both links clear together.)
-- No CHECK that a facility needs its venue: SET NULL fires per foreign key in an order Postgres does
-- not promise, and an intermediate row would fail it. The routes refuse a facility without its venue,
-- and a facility from another venue or another club, the house-league resolver's rule.
--
-- Indexes: each new foreign key can be followed backwards (mig 249's rule, partial: almost every row
-- is NULL), plus the clash lookup's own read — one club's linked bookings in a time window.
-- The tournament copy's link (`venue_facilities.source_org_facility_id`) already has its index on both
-- databases (mig 249), so the build prompt's "missing index" needed nothing here.
--
-- Schema-visible (four columns): check:migrations sees it. ORDER: apply to prod BEFORE promoting the
-- code that reads these columns (the migration-040 lesson). Independent of 315–318.

-- ════════════════════════════════════════════════════════════════════
-- 1. rep_team_events
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.rep_team_events
  ADD COLUMN IF NOT EXISTS org_venue_id uuid
    REFERENCES public.org_venues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS org_venue_facility_id uuid
    REFERENCES public.org_venue_facilities(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.rep_team_events.org_venue_id IS
  'The club''s venue (Venue library) this event is booked at, picked from the coach''s Venue field (Club Tier Stage 6a, mig 319). NULL for a coach''s own place or typed words. location / location_address stay the event''s copy. The clash check compares only linked bookings.';
COMMENT ON COLUMN public.rep_team_events.org_venue_facility_id IS
  'The facility (diamond, court, field) at org_venue_id, or NULL when not set ("busy then" in the clash check). Always one of org_venue_id''s facilities (route-enforced). Mig 319.';

CREATE INDEX IF NOT EXISTS rep_team_events_org_venue_idx
  ON public.rep_team_events(org_venue_id) WHERE org_venue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rep_team_events_org_venue_facility_idx
  ON public.rep_team_events(org_venue_facility_id) WHERE org_venue_facility_id IS NOT NULL;
-- The clash lookup: one club's bookings on its venues, in a window.
CREATE INDEX IF NOT EXISTS rep_team_events_club_booking_idx
  ON public.rep_team_events(org_id, starts_at) WHERE org_venue_id IS NOT NULL;

-- Never both a coach's own place and one of the club's venues on one event (a club venue is not a place; the place
-- book's own same-named row stays the team's). Every writer clears one when it sets the other
-- (`lib/rep-event-where.ts`); this makes the pair impossible for the NEXT writer too. Safe with SET NULL: either
-- link clearing only ever moves a row toward the rule. 0 rows hold a club venue at migration time.
ALTER TABLE public.rep_team_events DROP CONSTRAINT IF EXISTS rep_team_events_place_or_club_venue;
ALTER TABLE public.rep_team_events
  ADD CONSTRAINT rep_team_events_place_or_club_venue CHECK (place_id IS NULL OR org_venue_id IS NULL);

-- ════════════════════════════════════════════════════════════════════
-- 2. rep_tryout_sessions
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.rep_tryout_sessions
  ADD COLUMN IF NOT EXISTS org_venue_id uuid
    REFERENCES public.org_venues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS org_venue_facility_id uuid
    REFERENCES public.org_venue_facilities(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.rep_tryout_sessions.org_venue_id IS
  'The club''s venue this tryout day is held at (Club Tier Stage 6a, mig 319; the owner''s "Join the check", 2026-10-08). NULL for typed words. location / location_address stay the session''s copy.';
COMMENT ON COLUMN public.rep_tryout_sessions.org_venue_facility_id IS
  'The facility at org_venue_id, or NULL when not set. Mig 319.';

CREATE INDEX IF NOT EXISTS rep_tryout_sessions_org_venue_idx
  ON public.rep_tryout_sessions(org_venue_id) WHERE org_venue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rep_tryout_sessions_org_venue_facility_idx
  ON public.rep_tryout_sessions(org_venue_facility_id) WHERE org_venue_facility_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rep_tryout_sessions_club_booking_idx
  ON public.rep_tryout_sessions(org_id, starts_at) WHERE org_venue_id IS NOT NULL;
