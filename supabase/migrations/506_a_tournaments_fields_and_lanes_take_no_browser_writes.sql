-- 506 — A tournament's playing fields and lanes take no browser writes (Board Ready leftover call 3, owner ruling
-- 2026-11-19; the trust close-out's finding g, reported by P2d / mig 505).
--
-- venue_facilities (mig 095) and schedule_facility_lanes (mig 104) were written straight from the browser in their first
-- builds: each carried INSERT / UPDATE / DELETE policies gated by can_access_tournament() and a write grant to
-- `authenticated`. Every write has since moved to the server, through the service role (app/api/admin/venues,
-- app/api/admin/schedule-facility-lanes, lib/tournament-venue.ts, lib/tournament-venue-copy.ts); re-proved 2026-11-19, no
-- browser or user-session client writes either table. So the grant is pure exposure: any ACTIVE member of a tournament's
-- club, of any role (a scorekeeper, an assistant coach), could add, rename or delete that tournament's fields and lanes
-- from their own browser.
--
-- This drops the three write policies on each table and revokes the writes from `authenticated` and `anon` (TRUNCATE with
-- them: it is a write, and it ignores row security). SELECT is untouched: the public schedule reads both tables
-- (anon_read_* stay). The service role is unchanged. No code depends on it: production either side of the promote.
-- Privilege- and policy-only: INVISIBLE to check:migrations (entry in MANUAL_PROD_STEPS.json). Idempotent.

DROP POLICY IF EXISTS org_members_write_venue_facilities ON public.venue_facilities;
DROP POLICY IF EXISTS org_members_update_venue_facilities ON public.venue_facilities;
DROP POLICY IF EXISTS org_members_delete_venue_facilities ON public.venue_facilities;

DROP POLICY IF EXISTS org_members_insert_schedule_facility_lanes ON public.schedule_facility_lanes;
DROP POLICY IF EXISTS org_members_update_schedule_facility_lanes ON public.schedule_facility_lanes;
DROP POLICY IF EXISTS org_members_delete_schedule_facility_lanes ON public.schedule_facility_lanes;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.venue_facilities FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.schedule_facility_lanes FROM authenticated, anon;
