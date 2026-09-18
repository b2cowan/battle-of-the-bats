# Dev vs Prod — structural drift

**Generated:** 2026-09-18 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 47 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 2 | 0 | — |
| Columns | 19 | 1 | 0 |
| Indexes | 7 | 1 | 0 |
| Constraints | 9 | 1 | — |
| RLS / CHECK | 6 | 1 | 0 (RLS state) |

## Tables
### Only in DEV (2)
- `rep_team_circuit_tags`
- `rep_team_circuits`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (19)
- `rep_team_circuit_tags.circuit_id`
- `rep_team_circuit_tags.created_at`
- `rep_team_circuit_tags.tag_id`
- `rep_team_circuits.block`
- `rep_team_circuits.created_at`
- `rep_team_circuits.created_by`
- `rep_team_circuits.id`
- `rep_team_circuits.is_active`
- `rep_team_circuits.name`
- `rep_team_circuits.org_id`
- `rep_team_circuits.team_id`
- `rep_team_circuits.updated_at`
- `rep_team_evaluation_sessions.scope_attempts`
- `rep_team_events.practice_plan_sent_at`
- `rep_team_events.practice_plan_sent_audience`
- `rep_team_events.practice_plan_sent_by`
- `rep_team_events.practice_plan_sent_count`
- `rep_team_events.practice_plan_sent_email`
- `rep_team_tags.user_id`

### Only in PROD (1)
- `rep_team_measurable_types.replaced_by_id`

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (7)
- `rep_team_circuit_tags_pkey`
- `rep_team_circuit_tags_tag_idx`
- `rep_team_circuits_name_uniq`
- `rep_team_circuits_org_idx`
- `rep_team_circuits_pkey`
- `rep_team_circuits_team_idx`
- `rep_team_tags_team_user_uniq`

### Only in PROD (1)
- `rep_team_measurable_types_replaced_by_idx`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (9)
- `rep_team_circuit_tags.rep_team_circuit_tags_circuit_id_fkey`
- `rep_team_circuit_tags.rep_team_circuit_tags_pkey`
- `rep_team_circuit_tags.rep_team_circuit_tags_tag_id_fkey`
- `rep_team_circuits.rep_team_circuits_created_by_fkey`
- `rep_team_circuits.rep_team_circuits_org_id_fkey`
- `rep_team_circuits.rep_team_circuits_pkey`
- `rep_team_circuits.rep_team_circuits_team_id_fkey`
- `rep_team_events.rep_team_events_practice_plan_sent_by_fkey`
- `rep_team_tags.rep_team_tags_user_id_fkey`

### Only in PROD (1)
- `rep_team_measurable_types.rep_team_measurable_types_replaced_by_id_fkey`

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (6)
- `rep_team_circuits.rep_team_circuits_block_check`
- `rep_team_circuits.rep_team_circuits_name_check`
- `rep_team_evaluation_sessions.rep_team_evaluation_sessions_scope_attempts_needs_scope_check`
- `rep_team_evaluation_sessions.rep_team_evaluation_sessions_scope_attempts_object_check`
- `rep_team_events.rep_team_events_practice_plan_sent_audience_check`
- `rep_team_tags.rep_team_tags_user_is_staff_team_tag`

### CHECK only in PROD (1)
- `rep_team_measurable_types.rep_team_measurable_types_replaced_is_retired_check`

