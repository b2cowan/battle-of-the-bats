# Dev vs Prod — structural drift

**Generated:** 2026-09-11 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 7 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 0 | 0 | — |
| Columns | 2 | 0 | 0 |
| Indexes | 2 | 0 | 0 |
| Constraints | 0 | 0 | — |
| RLS / CHECK | 3 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (0)
_none_

### Only in PROD (0)
_none_

## Columns
### Only in DEV (2)
- `assistant_invite_tokens.staff_kind`
- `rep_team_staff_memberships.staff_kind`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (2)
- `rep_player_awards_once_per_game_uniq`
- `rep_player_awards_once_per_general_occasion_uniq`

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

### CHECK only in DEV (3)
- `assistant_invite_tokens.assistant_invite_tokens_staff_kind_check`
- `rep_team_staff_memberships.rep_team_staff_memberships_head_coach_has_no_kind`
- `rep_team_staff_memberships.rep_team_staff_memberships_staff_kind_check`

### CHECK only in PROD (0)
_none_

