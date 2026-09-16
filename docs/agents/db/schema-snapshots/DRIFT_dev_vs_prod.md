# Dev vs Prod — structural drift

**Generated:** 2026-09-16 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 7 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 0 | 0 | — |
| Columns | 1 | 1 | 0 |
| Indexes | 0 | 1 | 0 |
| Constraints | 0 | 1 | — |
| RLS / CHECK | 2 | 1 | 0 (RLS state) |

## Tables
### Only in DEV (0)
_none_

### Only in PROD (0)
_none_

## Columns
### Only in DEV (1)
- `rep_team_evaluation_sessions.scope_attempts`

### Only in PROD (1)
- `rep_team_measurable_types.replaced_by_id`

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (0)
_none_

### Only in PROD (1)
- `rep_team_measurable_types_replaced_by_idx`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (0)
_none_

### Only in PROD (1)
- `rep_team_measurable_types.rep_team_measurable_types_replaced_by_id_fkey`

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (2)
- `rep_team_evaluation_sessions.rep_team_evaluation_sessions_scope_attempts_needs_scope_check`
- `rep_team_evaluation_sessions.rep_team_evaluation_sessions_scope_attempts_object_check`

### CHECK only in PROD (1)
- `rep_team_measurable_types.rep_team_measurable_types_replaced_is_retired_check`

