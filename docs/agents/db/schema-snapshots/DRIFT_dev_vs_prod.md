# Dev vs Prod — structural drift

**Generated:** 2026-08-26 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 4 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 0 | 0 | — |
| Columns | 3 | 0 | 0 |
| Indexes | 0 | 0 | 0 |
| Constraints | 1 | 0 | — |
| RLS / CHECK | 0 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (0)
_none_

### Only in PROD (0)
_none_

## Columns
### Only in DEV (3)
- `rep_program_years.opening_balance`
- `rep_program_years.opening_balance_from_year_id`
- `rep_tryouts.names_shown_at`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (0)
_none_

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (1)
- `rep_program_years.rep_program_years_opening_balance_from_year_id_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (0)
_none_

### CHECK only in PROD (0)
_none_

