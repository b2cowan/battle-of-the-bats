# Dev vs Prod — structural drift

**Generated:** 2026-10-16 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 4 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 0 | 0 | — |
| Columns | 1 | 0 | 0 |
| Indexes | 1 | 0 | 0 |
| Constraints | 1 | 0 | — |
| RLS / CHECK | 1 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (0)
_none_

### Only in PROD (0)
_none_

## Columns
### Only in DEV (1)
- `club_schedule_hand_backs.late_for`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (1)
- `club_schedule_hand_backs_late_for_idx`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (1)
- `club_schedule_hand_backs.club_schedule_hand_backs_late_for_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (1)
- `club_schedule_hand_backs.club_schedule_hand_backs_late_is_an_ask`

### CHECK only in PROD (0)
_none_

