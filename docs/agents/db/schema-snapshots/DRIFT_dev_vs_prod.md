# Dev vs Prod — structural drift

**Generated:** 2026-08-10 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 13 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 0 | 0 | — |
| Columns | 5 | 0 | 0 |
| Indexes | 4 | 0 | 0 |
| Constraints | 4 | 0 | — |
| RLS / CHECK | 0 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (0)
_none_

### Only in PROD (0)
_none_

## Columns
### Only in DEV (5)
- `league_games.ends_at`
- `league_games.org_venue_facility_id`
- `league_games.org_venue_id`
- `league_practices.org_venue_facility_id`
- `league_practices.org_venue_id`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (4)
- `idx_league_games_org_venue`
- `idx_league_games_org_venue_facility`
- `idx_league_practices_org_venue`
- `idx_league_practices_org_venue_facility`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (4)
- `league_games.league_games_org_venue_facility_id_fkey`
- `league_games.league_games_org_venue_id_fkey`
- `league_practices.league_practices_org_venue_facility_id_fkey`
- `league_practices.league_practices_org_venue_id_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (0)
_none_

### CHECK only in PROD (0)
_none_

