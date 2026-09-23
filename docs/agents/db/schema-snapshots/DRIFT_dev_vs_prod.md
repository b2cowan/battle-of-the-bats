# Dev vs Prod — structural drift

**Generated:** 2026-09-23 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 29 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 1 | 0 | — |
| Columns | 11 | 0 | 0 |
| Indexes | 6 | 0 | 0 |
| Constraints | 7 | 0 | — |
| RLS / CHECK | 3 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (1)
- `rep_team_call_up_appearances`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (11)
- `rep_dues_credits.applies_to`
- `rep_fundraiser_credit_plan.applies_to`
- `rep_fundraiser_credit_plan.arranged_at`
- `rep_team_call_up_appearances.created_at`
- `rep_team_call_up_appearances.created_by`
- `rep_team_call_up_appearances.event_id`
- `rep_team_call_up_appearances.id`
- `rep_team_call_up_appearances.org_id`
- `rep_team_call_up_appearances.player_id`
- `rep_team_call_up_appearances.program_year_id`
- `rep_team_call_up_appearances.team_id`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (6)
- `rep_roster_players_year_status_idx`
- `rep_team_call_up_appearances_event_player_uniq`
- `rep_team_call_up_appearances_org_id_idx`
- `rep_team_call_up_appearances_pkey`
- `rep_team_call_up_appearances_player_idx`
- `rep_team_call_up_appearances_year_idx`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (7)
- `rep_team_call_up_appearances.rep_team_call_up_appearances_created_by_fkey`
- `rep_team_call_up_appearances.rep_team_call_up_appearances_event_id_fkey`
- `rep_team_call_up_appearances.rep_team_call_up_appearances_org_id_fkey`
- `rep_team_call_up_appearances.rep_team_call_up_appearances_pkey`
- `rep_team_call_up_appearances.rep_team_call_up_appearances_player_id_fkey`
- `rep_team_call_up_appearances.rep_team_call_up_appearances_program_year_id_fkey`
- `rep_team_call_up_appearances.rep_team_call_up_appearances_team_id_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (3)
- `rep_dues_credits.rep_dues_credits_applies_to_is_array`
- `rep_fundraiser_credit_plan.rep_fundraiser_credit_plan_applies_to_is_array`
- `rep_roster_players.rep_roster_players_callup_no_email_check`

### CHECK only in PROD (0)
_none_

