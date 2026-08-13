# Dev vs Prod — structural drift

**Generated:** 2026-08-13 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 28 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 1 | 0 | — |
| Columns | 16 | 0 | 0 |
| Indexes | 2 | 0 | 0 |
| Constraints | 5 | 0 | — |
| RLS / CHECK | 4 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (1)
- `rep_team_import_events`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (16)
- `rep_budget_lines.line_kind`
- `rep_team_import_events.created_at`
- `rep_team_import_events.created_by`
- `rep_team_import_events.created_by_name`
- `rep_team_import_events.dataset`
- `rep_team_import_events.id`
- `rep_team_import_events.org_id`
- `rep_team_import_events.program_year_id`
- `rep_team_import_events.rows_created`
- `rep_team_import_events.rows_failed`
- `rep_team_import_events.rows_skipped`
- `rep_team_import_events.rows_updated`
- `rep_team_import_events.shape`
- `rep_team_import_events.source`
- `rep_team_import_events.source_filename`
- `rep_team_import_events.team_id`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (2)
- `idx_rep_team_import_events_season`
- `rep_team_import_events_pkey`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (5)
- `rep_team_import_events.fk_rep_team_import_events_created_by`
- `rep_team_import_events.fk_rep_team_import_events_org`
- `rep_team_import_events.fk_rep_team_import_events_team`
- `rep_team_import_events.fk_rep_team_import_events_year`
- `rep_team_import_events.rep_team_import_events_pkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (4)
- `rep_budget_lines.rep_budget_lines_line_kind_check`
- `rep_team_import_events.rep_team_import_events_dataset_check`
- `rep_team_import_events.rep_team_import_events_shape_check`
- `rep_team_import_events.rep_team_import_events_source_check`

### CHECK only in PROD (0)
_none_

