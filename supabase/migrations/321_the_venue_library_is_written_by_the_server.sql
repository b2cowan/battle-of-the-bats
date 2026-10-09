-- 321 — The club's Venue library is written by the server, never by a member's own session
-- (Club Tier Stage 6b, S6-10 — owner ratification 2026-10-08, Ask 9 as recommended; plan:
--  docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md §6 Stage 6; hub K4MPu4ni53Ct7yrDcmWJd9 v64)
--
-- THE GAP. Migration 094 gave the two library tables row-security policies that let ANY member of a club insert,
-- update and delete its venues and facilities ("admin API gate handles capability checks"), and granted the
-- signed-in role all four privileges. The page's server route was the only wall: a treasurer, a registrar or a
-- coaching-staff membership holding the publishable key could rename, re-point or delete the club's venues
-- directly, bypassing the save rule the route checks — and since Stage 6a, a venue is what a coach's booking, a
-- house-league game and the clash check all stand on. Migration 311 closed the publishable key's ANONYMOUS door
-- to these tables and kept the signed-in role's read/write as "what the browser genuinely uses".
--
-- WHAT THE BROWSER GENUINELY USES, re-read for this change (2026-10-09): nothing writes these tables outside the
-- server. Every write is `app/api/admin/org/venues/route.ts` with the service role; every read is that route,
-- the tournament's import action (`app/api/admin/venues/route.ts`), the clash lookup (`lib/venue-clash-lookup.ts`)
-- and `lib/db.ts` — all service role. So the signed-in role keeps READ (members read their club's library, as the
-- page and the pickers do through the server) and loses INSERT / UPDATE / DELETE, policy and grant both.
--
-- The save rule itself (owner, admin, league admin, or anyone granted the tournament permission) stays in the
-- route, where it is checked on every write; the database's job is only that nothing goes AROUND the route.
--
-- No column changes. Archive (Ask 9) uses the column the table has had since 094 (`org_venues.is_active`, NOT
-- NULL, default true), read by the pickers since Stage 6a; a facility has no archive of its own (decided from the
-- data — 0 club venues on production, the library's facilities are renamed rather than retired; a facility a
-- booking holds is never removed, one nothing books can be).
--
-- Not schema-visible to the column snapshot (policies and grants only), so it is recorded in MANUAL_PROD_STEPS.
-- ORDER: independent of the 6b code — the code writes with the service role, which row security never reaches.
-- Apply it to production before or with the 6b promote. Idempotent: DROP POLICY IF EXISTS and REVOKE of an absent
-- privilege are no-ops.

begin;

drop policy if exists "org_members_write_org_venues" on public.org_venues;
drop policy if exists "org_members_update_org_venues" on public.org_venues;
drop policy if exists "org_members_delete_org_venues" on public.org_venues;

drop policy if exists "org_members_write_org_venue_facilities" on public.org_venue_facilities;
drop policy if exists "org_members_update_org_venue_facilities" on public.org_venue_facilities;
drop policy if exists "org_members_delete_org_venue_facilities" on public.org_venue_facilities;

revoke insert, update, delete on public.org_venues, public.org_venue_facilities from authenticated;

-- Kept: "org_members_read_org_venues" / "org_members_read_org_venue_facilities" (SELECT where is_org_member) and
-- the signed-in role's SELECT grant.

commit;
