# Dev vs Prod — structural drift

**Generated:** 2026-09-13 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 32 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 0 | 0 | — |
| Columns | 9 | 4 | 1 |
| Indexes | 1 | 1 | 0 |
| Constraints | 1 | 1 | — |
| RLS / CHECK | 12 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (0)
_none_

### Only in PROD (0)
_none_

## Columns
### Only in DEV (9)
- `rep_team_measurable_types.aim`
- `rep_team_measurable_types.attempts_per_session`
- `rep_team_measurable_types.descriptors`
- `rep_team_measurable_types.headline`
- `rep_team_measurable_types.kind`
- `rep_team_measurable_types.method`
- `rep_team_measurable_types.range_from`
- `rep_team_measurable_types.range_to`
- `rep_team_measurable_types.replaced_by_id`

### Only in PROD (4)
- `family_links.requested_player_name`
- `rep_teams.family_link_created_at`
- `rep_teams.family_link_created_by`
- `rep_teams.family_link_token_hash`

### Type/nullability/default changed (1)
- `rep_team_measurable_types.unit` — dev: `text|text|YES|` | prod: `text|text|NO|`

## Indexes
### Only in DEV (1)
- `rep_team_measurable_types_replaced_by_idx`

### Only in PROD (1)
- `rep_teams_family_link_token_uniq`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (1)
- `rep_team_measurable_types.rep_team_measurable_types_replaced_by_id_fkey`

### Only in PROD (1)
- `rep_teams.rep_teams_family_link_created_by_fkey`

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (12)
- `rep_team_measurable_types.rep_team_measurable_types_aim_check`
- `rep_team_measurable_types.rep_team_measurable_types_attempts_check`
- `rep_team_measurable_types.rep_team_measurable_types_descriptors_check`
- `rep_team_measurable_types.rep_team_measurable_types_headline_by_aim_check`
- `rep_team_measurable_types.rep_team_measurable_types_headline_check`
- `rep_team_measurable_types.rep_team_measurable_types_kind_check`
- `rep_team_measurable_types.rep_team_measurable_types_method_check`
- `rep_team_measurable_types.rep_team_measurable_types_range_check`
- `rep_team_measurable_types.rep_team_measurable_types_record_has_no_best_check`
- `rep_team_measurable_types.rep_team_measurable_types_replaced_is_retired_check`
- `rep_team_measurable_types.rep_team_measurable_types_skill_shape_check`
- `rep_team_measurable_types.rep_team_measurable_types_unit_by_kind_check`

### CHECK only in PROD (0)
_none_

