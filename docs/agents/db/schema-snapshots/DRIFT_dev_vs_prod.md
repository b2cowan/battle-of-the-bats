# Dev vs Prod — structural drift

**Generated:** 2026-08-04 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 57 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 3 | 0 | — |
| Columns | 26 | 0 | 0 |
| Indexes | 12 | 0 | 0 |
| Constraints | 16 | 0 | — |
| RLS / CHECK | 0 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (3)
- `rep_team_opponent_aliases`
- `rep_team_opponent_observations`
- `rep_team_opponents`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (26)
- `rep_team_opponent_aliases.created_at`
- `rep_team_opponent_aliases.id`
- `rep_team_opponent_aliases.normalized_alias`
- `rep_team_opponent_aliases.opponent_id`
- `rep_team_opponent_aliases.org_id`
- `rep_team_opponent_aliases.team_id`
- `rep_team_opponent_observations.body`
- `rep_team_opponent_observations.created_at`
- `rep_team_opponent_observations.created_by`
- `rep_team_opponent_observations.created_by_name`
- `rep_team_opponent_observations.event_id`
- `rep_team_opponent_observations.id`
- `rep_team_opponent_observations.opponent_id`
- `rep_team_opponent_observations.org_id`
- `rep_team_opponent_observations.tag`
- `rep_team_opponent_observations.team_id`
- `rep_team_opponents.created_at`
- `rep_team_opponents.display_name`
- `rep_team_opponents.id`
- `rep_team_opponents.last_note_updated_at`
- `rep_team_opponents.normalized_name`
- `rep_team_opponents.org_id`
- `rep_team_opponents.summary`
- `rep_team_opponents.team_id`
- `rep_team_opponents.updated_at`
- `rep_team_opponents.updated_by`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (12)
- `idx_rep_team_opponent_aliases_opponent`
- `idx_rep_team_opponent_aliases_org`
- `idx_rep_team_opponent_obs_event`
- `idx_rep_team_opponent_obs_opponent`
- `idx_rep_team_opponent_obs_team`
- `idx_rep_team_opponents_org`
- `idx_rep_team_opponents_team`
- `rep_team_opponent_aliases_pkey`
- `rep_team_opponent_aliases_team_alias_uq`
- `rep_team_opponent_observations_pkey`
- `rep_team_opponents_pkey`
- `rep_team_opponents_team_name_uq`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (16)
- `rep_team_opponent_aliases.fk_rep_team_opponent_aliases_opponent`
- `rep_team_opponent_aliases.fk_rep_team_opponent_aliases_org`
- `rep_team_opponent_aliases.fk_rep_team_opponent_aliases_team`
- `rep_team_opponent_aliases.rep_team_opponent_aliases_pkey`
- `rep_team_opponent_aliases.rep_team_opponent_aliases_team_alias_uq`
- `rep_team_opponent_observations.fk_rep_team_opponent_obs_created_by`
- `rep_team_opponent_observations.fk_rep_team_opponent_obs_event`
- `rep_team_opponent_observations.fk_rep_team_opponent_obs_opponent`
- `rep_team_opponent_observations.fk_rep_team_opponent_obs_org`
- `rep_team_opponent_observations.fk_rep_team_opponent_obs_team`
- `rep_team_opponent_observations.rep_team_opponent_observations_pkey`
- `rep_team_opponents.fk_rep_team_opponents_org`
- `rep_team_opponents.fk_rep_team_opponents_team`
- `rep_team_opponents.fk_rep_team_opponents_updated_by`
- `rep_team_opponents.rep_team_opponents_pkey`
- `rep_team_opponents.rep_team_opponents_team_name_uq`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (0)
_none_

### CHECK only in PROD (0)
_none_

