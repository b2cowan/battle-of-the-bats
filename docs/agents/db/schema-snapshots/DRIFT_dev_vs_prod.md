# Dev vs Prod — structural drift

**Generated:** 2026-06-09 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 133 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 4 | 0 | — |
| Columns | 50 | 3 | 23 |
| Indexes | 13 | 3 | 0 |
| Constraints | 16 | 9 | — |
| RLS / CHECK | 11 | 1 | 0 (RLS state) |

## Tables
### Only in DEV (4)
- `basic_coach_team_announcements`
- `basic_coach_team_events`
- `basic_coach_team_fees`
- `basic_coach_team_players`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (50)
- `basic_coach_team_announcements.basic_coach_team_id`
- `basic_coach_team_announcements.body`
- `basic_coach_team_announcements.created_at`
- `basic_coach_team_announcements.created_by_user_id`
- `basic_coach_team_announcements.failed_count`
- `basic_coach_team_announcements.id`
- `basic_coach_team_announcements.recipient_count`
- `basic_coach_team_announcements.sent_at`
- `basic_coach_team_announcements.sent_count`
- `basic_coach_team_announcements.status`
- `basic_coach_team_announcements.subject`
- `basic_coach_team_announcements.updated_at`
- `basic_coach_team_events.basic_coach_team_id`
- `basic_coach_team_events.created_at`
- `basic_coach_team_events.created_by_user_id`
- `basic_coach_team_events.ends_at`
- `basic_coach_team_events.event_type`
- `basic_coach_team_events.id`
- `basic_coach_team_events.location`
- `basic_coach_team_events.notes`
- `basic_coach_team_events.opponent`
- `basic_coach_team_events.starts_at`
- `basic_coach_team_events.status`
- `basic_coach_team_events.title`
- `basic_coach_team_events.updated_at`
- `basic_coach_team_fees.amount`
- `basic_coach_team_fees.basic_coach_team_id`
- `basic_coach_team_fees.created_at`
- `basic_coach_team_fees.created_by_user_id`
- `basic_coach_team_fees.display_order`
- `basic_coach_team_fees.id`
- `basic_coach_team_fees.label`
- `basic_coach_team_fees.marked_paid_at`
- `basic_coach_team_fees.notes`
- `basic_coach_team_fees.player_id`
- `basic_coach_team_fees.status`
- `basic_coach_team_fees.updated_at`
- `basic_coach_team_players.basic_coach_team_id`
- `basic_coach_team_players.contact_email`
- `basic_coach_team_players.contact_phone`
- `basic_coach_team_players.created_at`
- `basic_coach_team_players.created_by_user_id`
- `basic_coach_team_players.date_of_birth`
- `basic_coach_team_players.display_order`
- `basic_coach_team_players.guardian_name`
- `basic_coach_team_players.id`
- `basic_coach_team_players.jersey_number`
- `basic_coach_team_players.name`
- `basic_coach_team_players.notes`
- `basic_coach_team_players.updated_at`

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
### Only in DEV (13)
- `basic_coach_team_announcements_pkey`
- `basic_coach_team_announcements_team_idx`
- `basic_coach_team_events_pkey`
- `basic_coach_team_events_team_idx`
- `basic_coach_team_fees_pkey`
- `basic_coach_team_fees_player_idx`
- `basic_coach_team_fees_team_idx`
- `basic_coach_team_players_pkey`
- `basic_coach_team_players_team_idx`
- `league_practices_recurrence_idx`
- `league_practices_schedule_idx`
- `league_practices_season_idx`
- `league_practices_team_idx`

### Only in PROD (3)
- `league_practices_recurrence_group_id_idx`
- `league_practices_season_id_idx`
- `league_practices_team_id_idx`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (16)
- `announcements.announcements_tournament_id_fkey`
- `basic_coach_team_announcements.basic_coach_team_announcements_basic_coach_team_id_fkey`
- `basic_coach_team_announcements.basic_coach_team_announcements_pkey`
- `basic_coach_team_events.basic_coach_team_events_basic_coach_team_id_fkey`
- `basic_coach_team_events.basic_coach_team_events_pkey`
- `basic_coach_team_fees.basic_coach_team_fees_basic_coach_team_id_fkey`
- `basic_coach_team_fees.basic_coach_team_fees_pkey`
- `basic_coach_team_fees.basic_coach_team_fees_player_id_fkey`
- `basic_coach_team_players.basic_coach_team_players_basic_coach_team_id_fkey`
- `basic_coach_team_players.basic_coach_team_players_pkey`
- `diamonds.diamonds_tournament_id_fkey`
- `divisions.age_groups_tournament_id_fkey`
- `games.games_age_group_id_fkey`
- `games.games_away_team_id_fkey`
- `games.games_tournament_id_fkey`
- `teams.teams_tournament_id_fkey`

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

### CHECK only in DEV (11)
- `basic_coach_team_announcements.basic_coach_team_announcements_body_check`
- `basic_coach_team_announcements.basic_coach_team_announcements_counts_check`
- `basic_coach_team_announcements.basic_coach_team_announcements_status_check`
- `basic_coach_team_announcements.basic_coach_team_announcements_status_counts_check`
- `basic_coach_team_announcements.basic_coach_team_announcements_subject_check`
- `basic_coach_team_events.basic_coach_team_events_status_check`
- `basic_coach_team_events.basic_coach_team_events_time_check`
- `basic_coach_team_events.basic_coach_team_events_type_check`
- `basic_coach_team_fees.basic_coach_team_fees_amount_check`
- `basic_coach_team_fees.basic_coach_team_fees_paid_at_check`
- `basic_coach_team_fees.basic_coach_team_fees_status_check`

### CHECK only in PROD (1)
- `tournaments.tournaments_status_check`

