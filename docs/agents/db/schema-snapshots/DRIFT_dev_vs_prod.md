# Dev vs Prod — structural drift

**Generated:** 2026-08-01 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 4 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 0 | 0 | — |
| Columns | 2 | 0 | 0 |
| Indexes | 1 | 0 | 0 |
| Constraints | 1 | 0 | — |
| RLS / CHECK | 0 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (0)
_none_

### Only in PROD (0)
_none_

## Columns
### Only in DEV (2)
- `rep_team_evaluation_sessions.event_id`
- `rep_team_events.practice_plan`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (1)
- `rep_team_eval_sessions_event_idx`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (1)
- `rep_team_evaluation_sessions.rep_team_evaluation_sessions_event_id_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (0)
_none_

### CHECK only in PROD (0)
_none_

