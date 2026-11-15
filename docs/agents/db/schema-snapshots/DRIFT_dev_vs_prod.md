# Dev vs Prod — structural drift

**Generated:** 2026-11-15 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 11 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 1 | 0 | — |
| Columns | 3 | 0 | 0 |
| Indexes | 3 | 0 | 0 |
| Constraints | 4 | 0 | — |
| RLS / CHECK | 0 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (1)
- `org_time_date_off_venues`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (3)
- `org_time_date_off_venues.date_off_id`
- `org_time_date_off_venues.org_id`
- `org_time_date_off_venues.org_venue_id`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (3)
- `org_time_date_off_venues_org_idx`
- `org_time_date_off_venues_pkey`
- `org_time_date_off_venues_venue_idx`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (4)
- `org_time_date_off_venues.org_time_date_off_venues_date_off_id_fkey`
- `org_time_date_off_venues.org_time_date_off_venues_org_id_fkey`
- `org_time_date_off_venues.org_time_date_off_venues_org_venue_id_fkey`
- `org_time_date_off_venues.org_time_date_off_venues_pkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (0)
_none_

### CHECK only in PROD (0)
_none_

