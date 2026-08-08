-- 229: House league gets the same venue + surface model as tournaments
-- (GAME_LOCATION_SOURCE_OF_TRUTH_PLAN Phase 4 — owner ruling R3 2026-08-08,
--  field source = ORG venue library, owner decision 2026-08-08).
--
-- league_games / league_practices reference org_venues / org_venue_facilities DIRECTLY —
-- no per-season copies. A league is an org-level, season-long thing: its fields are the
-- org's fields, and referencing the library keeps clash detection honest across seasons
-- and divisions. (Tournaments copy the library into per-event tables; that stays as is.)
--
-- ON DELETE SET NULL, deliberately: deleting a venue must never fail or cascade into the
-- schedule (migration-202 taught us the NOT NULL/failing-delete lesson in production).
-- `location` stays as the server-derived display cache, same as the tournament side.
--
-- league_games.ends_at: games previously had only a start instant. One booking pool with
-- practices (which DO carry ends_at) needs comparable windows, so games get an optional
-- end; the conflict engine falls back to a 90-minute default when it is null.
-- Zero prod rows measured 2026-08-08 — this is a schema decision, not a data migration.

alter table league_games
  add column org_venue_id uuid references org_venues(id) on delete set null,
  add column org_venue_facility_id uuid references org_venue_facilities(id) on delete set null,
  add column ends_at timestamptz;

alter table league_practices
  add column org_venue_id uuid references org_venues(id) on delete set null,
  add column org_venue_facility_id uuid references org_venue_facilities(id) on delete set null;

-- FK indexes: ON DELETE SET NULL scans referencing rows on venue delete, and the
-- save-time clash check filters by org + time; these keep both cheap.
create index if not exists idx_league_games_org_venue on league_games(org_venue_id);
create index if not exists idx_league_games_org_venue_facility on league_games(org_venue_facility_id);
create index if not exists idx_league_practices_org_venue on league_practices(org_venue_id);
create index if not exists idx_league_practices_org_venue_facility on league_practices(org_venue_facility_id);
