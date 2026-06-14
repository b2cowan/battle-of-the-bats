-- 125_free_floor_league_starter.sql
-- Free-floor entitlement profile column on organizations (Free Tier Phase 6 — League Starter).
--
-- League Starter is a free-floor PROFILE, NOT a new OrgPlan key: an org stays on its paid
-- plan_id (a free League Starter sits on plan_id='tournament') and free_floor='league_starter'
-- unions module_house_league + server-side house-league caps (1 season / 1 division / 8 teams)
-- on top, via lib/free-floor.ts + lib/module-entitlements.ts. The paid plan ladder, PLAN_CONFIG,
-- rank, checkout, and pricing tables are untouched.
--
-- Forward-compatible with the §12 'tournament_free' floor (currently implicit in plan_id='tournament');
-- the CHECK can be widened when that floor is made explicit. Do NOT backfill existing rows — null
-- means "no free floor" (the default and the state of every org today).

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS free_floor text
  CHECK (free_floor IS NULL OR free_floor IN ('league_starter'));

COMMENT ON COLUMN organizations.free_floor IS
  'Free-floor entitlement profile (NULL = none). league_starter = capped free house-league floor (mig 125, Free Tier Phase 6). Unions module_house_league + caps via lib/free-floor.ts; never grants module_public_site. plan_id stays the paid ladder.';
