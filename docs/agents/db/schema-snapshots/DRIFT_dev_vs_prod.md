# Dev vs Prod — structural drift

**Generated:** 2026-09-21 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 35 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 1 | 0 | — |
| Columns | 15 | 0 | 0 |
| Indexes | 5 | 0 | 0 |
| Constraints | 5 | 0 | — |
| RLS / CHECK | 7 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (1)
- `rep_team_places`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (15)
- `rep_team_events.is_scrimmage`
- `rep_team_events.place_id`
- `rep_team_events.practice_plan_sent_to`
- `rep_team_places.address`
- `rep_team_places.created_at`
- `rep_team_places.created_by`
- `rep_team_places.field_number`
- `rep_team_places.id`
- `rep_team_places.name`
- `rep_team_places.note`
- `rep_team_places.org_id`
- `rep_team_places.team_id`
- `rep_team_places.updated_at`
- `rep_teams.arrival_before_game_min`
- `rep_teams.arrival_before_practice_min`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (5)
- `rep_team_events_place_idx`
- `rep_team_places_name_uniq`
- `rep_team_places_org_idx`
- `rep_team_places_pkey`
- `rep_team_places_team_idx`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (5)
- `rep_team_events.rep_team_events_place_id_fkey`
- `rep_team_places.rep_team_places_created_by_fkey`
- `rep_team_places.rep_team_places_org_id_fkey`
- `rep_team_places.rep_team_places_pkey`
- `rep_team_places.rep_team_places_team_id_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (7)
- `rep_team_events.rep_team_events_scrimmage_is_a_game_check`
- `rep_team_places.rep_team_places_address_check`
- `rep_team_places.rep_team_places_field_number_check`
- `rep_team_places.rep_team_places_name_check`
- `rep_team_places.rep_team_places_note_check`
- `rep_teams.rep_teams_arrival_before_game_min_check`
- `rep_teams.rep_teams_arrival_before_practice_min_check`

### CHECK only in PROD (0)
_none_

