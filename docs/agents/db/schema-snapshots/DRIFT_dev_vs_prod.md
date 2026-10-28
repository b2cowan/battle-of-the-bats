# Dev vs Prod — structural drift

**Generated:** 2026-10-28 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 3 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 0 | 0 | — |
| Columns | 1 | 0 | 0 |
| Indexes | 2 | 0 | 0 |
| Constraints | 0 | 0 | — |
| RLS / CHECK | 0 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (0)
_none_

### Only in PROD (0)
_none_

## Columns
### Only in DEV (1)
- `team_workspaces.free_time_given_at`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (2)
- `team_workspaces_one_free_time_portal_per_coach`
- `team_workspaces_one_free_time_portal_per_free_team`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (0)
_none_

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (0)
_none_

### CHECK only in PROD (0)
_none_

