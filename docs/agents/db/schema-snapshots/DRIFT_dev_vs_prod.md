# Dev vs Prod — structural drift

**Generated:** 2026-09-21 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 5 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 0 | 0 | — |
| Columns | 3 | 0 | 0 |
| Indexes | 0 | 0 | 0 |
| Constraints | 0 | 0 | — |
| RLS / CHECK | 2 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (0)
_none_

### Only in PROD (0)
_none_

## Columns
### Only in DEV (3)
- `rep_dues_credits.applies_to`
- `rep_fundraiser_credit_plan.applies_to`
- `rep_fundraiser_credit_plan.arranged_at`

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

### CHECK only in DEV (2)
- `rep_dues_credits.rep_dues_credits_applies_to_is_array`
- `rep_fundraiser_credit_plan.rep_fundraiser_credit_plan_applies_to_is_array`

### CHECK only in PROD (0)
_none_

