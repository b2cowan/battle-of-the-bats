# Dev vs Prod — structural drift

**Generated:** 2026-09-02 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 3 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 0 | 0 | — |
| Columns | 1 | 0 | 0 |
| Indexes | 0 | 0 | 0 |
| Constraints | 0 | 0 | — |
| RLS / CHECK | 1 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (0)
_none_

### Only in PROD (0)
_none_

## Columns
### Only in DEV (1)
- `rep_budget_lines.split_mode`

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
### Only in DEV (0)
_none_

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (1)
- `rep_budget_lines.rep_budget_lines_split_mode_check`

### CHECK only in PROD (0)
_none_

