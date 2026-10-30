# Dev vs Prod — structural drift

**Generated:** 2026-10-30 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 69 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 2 | 0 | — |
| Columns | 32 | 0 | 0 |
| Indexes | 13 | 0 | 0 |
| Constraints | 13 | 0 | — |
| RLS / CHECK | 8 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (2)
- `league_game_changes`
- `league_schedule_emails`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (32)
- `league_divisions.games_per_team`
- `league_divisions.schedule_published_at`
- `league_divisions.schedule_published_by`
- `league_game_changes.after`
- `league_game_changes.before`
- `league_game_changes.created_at`
- `league_game_changes.division_id`
- `league_game_changes.game_id`
- `league_game_changes.id`
- `league_game_changes.kind`
- `league_game_changes.notice_id`
- `league_game_changes.org_id`
- `league_game_changes.season_id`
- `league_game_changes.sent_at`
- `league_game_changes.source`
- `league_games.moved_from`
- `league_games.slot_use_id`
- `league_schedule_emails.created_at`
- `league_schedule_emails.division_id`
- `league_schedule_emails.guardian_email`
- `league_schedule_emails.id`
- `league_schedule_emails.notice_id`
- `league_schedule_emails.org_id`
- `league_schedule_emails.registration_ids`
- `league_schedule_emails.season_id`
- `league_schedule_emails.status`
- `league_schedule_emails.updated_at`
- `league_seasons.home_away_tolerance`
- `league_seasons.twice_in_a_day_allowed`
- `team_workspaces.free_time_given_at`
- `team_workspaces.free_time_reminded_14_for`
- `team_workspaces.free_time_reminded_3_for`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (13)
- `league_game_changes_game_idx`
- `league_game_changes_held_idx`
- `league_game_changes_notice_idx`
- `league_game_changes_org_idx`
- `league_game_changes_pkey`
- `league_game_changes_season_idx`
- `league_games_slot_use_idx`
- `league_schedule_emails_notice_idx`
- `league_schedule_emails_org_idx`
- `league_schedule_emails_pkey`
- `league_schedule_emails_season_idx`
- `team_workspaces_one_free_time_portal_per_coach`
- `team_workspaces_one_free_time_portal_per_free_team`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (13)
- `league_divisions.league_divisions_schedule_published_by_fkey`
- `league_game_changes.league_game_changes_division_id_fkey`
- `league_game_changes.league_game_changes_game_id_fkey`
- `league_game_changes.league_game_changes_notice_id_fkey`
- `league_game_changes.league_game_changes_org_id_fkey`
- `league_game_changes.league_game_changes_pkey`
- `league_game_changes.league_game_changes_season_id_fkey`
- `league_games.league_games_slot_use_id_fkey`
- `league_schedule_emails.league_schedule_emails_division_id_fkey`
- `league_schedule_emails.league_schedule_emails_notice_id_fkey`
- `league_schedule_emails.league_schedule_emails_org_id_fkey`
- `league_schedule_emails.league_schedule_emails_pkey`
- `league_schedule_emails.league_schedule_emails_season_id_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (8)
- `league_divisions.league_divisions_games_per_team_check`
- `league_game_changes.league_game_changes_check`
- `league_game_changes.league_game_changes_kind_check`
- `league_game_changes.league_game_changes_source_check`
- `league_schedule_emails.league_schedule_emails_guardian_email_check`
- `league_schedule_emails.league_schedule_emails_registration_ids_check`
- `league_schedule_emails.league_schedule_emails_status_check`
- `league_seasons.league_seasons_home_away_tolerance_check`

### CHECK only in PROD (0)
_none_

