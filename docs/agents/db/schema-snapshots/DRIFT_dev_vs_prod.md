# Dev vs Prod — structural drift

**Generated:** 2026-07-22 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 108 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 4 | 0 | — |
| Columns | 25 | 3 | 23 |
| Indexes | 15 | 3 | 0 |
| Constraints | 22 | 9 | — |
| RLS / CHECK | 3 | 1 | 0 (RLS state) |

## Tables
### Only in DEV (4)
- `chat_message_reports`
- `rep_team_tournament_registrations`
- `user_notification_settings`
- `user_preferences`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (25)
- `chat_message_reports.created_at`
- `chat_message_reports.id`
- `chat_message_reports.message_id`
- `chat_message_reports.org_id`
- `chat_message_reports.reason`
- `chat_message_reports.reporter_user_id`
- `chat_message_reports.resolved_at`
- `chat_message_reports.resolved_by_user_id`
- `chat_message_reports.room_id`
- `chat_message_reports.status`
- `chat_room_members.notifications_muted_at`
- `rep_team_tournament_registrations.created_at`
- `rep_team_tournament_registrations.id`
- `rep_team_tournament_registrations.link_source`
- `rep_team_tournament_registrations.linked_by_user_id`
- `rep_team_tournament_registrations.org_id`
- `rep_team_tournament_registrations.rep_team_id`
- `rep_team_tournament_registrations.tournament_team_id`
- `user_notification_settings.notifications_paused_at`
- `user_notification_settings.updated_at`
- `user_notification_settings.user_id`
- `user_preferences.created_at`
- `user_preferences.theme`
- `user_preferences.updated_at`
- `user_preferences.user_id`

### Only in PROD (3)
- `resources.created_at`
- `rule_items.created_at`
- `rules.created_at`

### Type/nullability/default changed (23)
- `announcements.body` — dev: `text|text|YES|` | prod: `text|text|NO|`
- `announcements.published_at` — dev: `timestamp with time zone|timestamptz|NO|now()` | prod: `timestamp with time zone|timestamptz|NO|`
- `diamonds.address` — dev: `text|text|YES|` | prod: `text|text|NO|`
- `divisions.display_order` — dev: `integer|int4|NO|0` | prod: `integer|int4|NO|`
- `divisions.playoff_config` — dev: `jsonb|jsonb|YES|` | prod: `jsonb|jsonb|YES|'{"type": "single", "crossover": "standard", "hasThirdPlace": false}'::jsonb`
- `divisions.pool_count` — dev: `integer|int4|YES|` | prod: `integer|int4|YES|1`
- `divisions.requires_pool_selection` — dev: `boolean|bool|NO|false` | prod: `boolean|bool|YES|false`
- `games.is_playoff` — dev: `boolean|bool|NO|false` | prod: `boolean|bool|YES|false`
- `games.location` — dev: `text|text|YES|` | prod: `text|text|NO|`
- `resources.display_order` — dev: `integer|int4|NO|0` | prod: `integer|int4|YES|0`
- `resources.id` — dev: `uuid|uuid|NO|gen_random_uuid()` | prod: `uuid|uuid|NO|uuid_generate_v4()`
- `rule_items.display_order` — dev: `integer|int4|NO|0` | prod: `integer|int4|YES|0`
- `rule_items.id` — dev: `uuid|uuid|NO|gen_random_uuid()` | prod: `uuid|uuid|NO|uuid_generate_v4()`
- `rule_items.rule_id` — dev: `uuid|uuid|NO|` | prod: `uuid|uuid|YES|`
- `rules.display_order` — dev: `integer|int4|NO|0` | prod: `integer|int4|YES|0`
- `rules.icon` — dev: `text|text|YES|` | prod: `text|text|YES|'Shield'::text`
- `rules.id` — dev: `uuid|uuid|NO|gen_random_uuid()` | prod: `uuid|uuid|NO|uuid_generate_v4()`
- `teams.coach` — dev: `text|text|YES|` | prod: `text|text|NO|`
- `teams.payment_status` — dev: `text|text|NO|'paid'::text` | prod: `text|text|YES|'paid'::text`
- `teams.registered_at` — dev: `timestamp with time zone|timestamptz|NO|now()` | prod: `timestamp with time zone|timestamptz|YES|now()`
- `teams.status` — dev: `text|text|NO|'accepted'::text` | prod: `text|text|YES|'accepted'::text`
- `tournaments.slug` — dev: `text|text|YES|` | prod: `text|text|NO|`
- `tournaments.status` — dev: `text|text|NO|'draft'::text` | prod: `text|text|NO|'completed'::text`

## Indexes
### Only in DEV (15)
- `chat_message_reports_message_idx`
- `chat_message_reports_open_uniq`
- `chat_message_reports_org_status_idx`
- `chat_message_reports_pkey`
- `chat_message_reports_room_status_idx`
- `league_practices_recurrence_idx`
- `league_practices_schedule_idx`
- `league_practices_season_idx`
- `league_practices_team_idx`
- `rep_team_tournament_registrations_org_idx`
- `rep_team_tournament_registrations_pkey`
- `rep_team_tournament_registrations_rep_team_idx`
- `rep_team_tournament_registrations_tournament_team_unique`
- `user_notification_settings_pkey`
- `user_preferences_pkey`

### Only in PROD (3)
- `league_practices_recurrence_group_id_idx`
- `league_practices_season_id_idx`
- `league_practices_team_id_idx`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (22)
- `announcements.announcements_tournament_id_fkey`
- `chat_message_reports.chat_message_reports_message_id_fkey`
- `chat_message_reports.chat_message_reports_org_id_fkey`
- `chat_message_reports.chat_message_reports_pkey`
- `chat_message_reports.chat_message_reports_reporter_user_id_fkey`
- `chat_message_reports.chat_message_reports_resolved_by_user_id_fkey`
- `chat_message_reports.chat_message_reports_room_id_fkey`
- `diamonds.diamonds_tournament_id_fkey`
- `divisions.age_groups_tournament_id_fkey`
- `games.games_age_group_id_fkey`
- `games.games_away_team_id_fkey`
- `games.games_tournament_id_fkey`
- `rep_team_tournament_registrations.rep_team_tournament_registrations_linked_by_user_id_fkey`
- `rep_team_tournament_registrations.rep_team_tournament_registrations_org_id_fkey`
- `rep_team_tournament_registrations.rep_team_tournament_registrations_pkey`
- `rep_team_tournament_registrations.rep_team_tournament_registrations_rep_team_id_fkey`
- `rep_team_tournament_registrations.rep_team_tournament_registrations_tournament_team_id_fkey`
- `teams.teams_tournament_id_fkey`
- `user_notification_settings.user_notification_settings_pkey`
- `user_notification_settings.user_notification_settings_user_id_fkey`
- `user_preferences.user_preferences_pkey`
- `user_preferences.user_preferences_user_id_fkey`

### Only in PROD (9)
- `announcements.fk_announcements_tournament`
- `diamonds.fk_diamonds_tournament`
- `divisions.fk_age_groups_tournament`
- `games.fk_games_away_team`
- `games.fk_games_diamond`
- `games.fk_games_home_team`
- `games.fk_games_tournament`
- `teams.fk_teams_age_group`
- `teams.fk_teams_tournament`

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (3)
- `chat_message_reports.chat_message_reports_status_check`
- `rep_team_tournament_registrations.rep_team_tournament_registrations_source_check`
- `user_preferences.user_preferences_theme_check`

### CHECK only in PROD (1)
- `tournaments.tournaments_status_check`

