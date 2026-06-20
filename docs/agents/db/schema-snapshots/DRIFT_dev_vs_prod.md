# Dev vs Prod — structural drift

**Generated:** 2026-06-20 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 81 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 1 | 0 | — |
| Columns | 14 | 3 | 26 |
| Indexes | 6 | 3 | 0 |
| Constraints | 11 | 9 | — |
| RLS / CHECK | 7 | 1 | 0 (RLS state) |

## Tables
### Only in DEV (1)
- `rep_team_announcements`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (14)
- `rep_team_announcements.body`
- `rep_team_announcements.created_at`
- `rep_team_announcements.created_by`
- `rep_team_announcements.failed_count`
- `rep_team_announcements.id`
- `rep_team_announcements.org_id`
- `rep_team_announcements.program_year_id`
- `rep_team_announcements.recipient_count`
- `rep_team_announcements.sent_at`
- `rep_team_announcements.sent_count`
- `rep_team_announcements.status`
- `rep_team_announcements.subject`
- `rep_team_announcements.team_id`
- `rep_team_announcements.updated_at`

### Only in PROD (3)
- `resources.created_at`
- `rule_items.created_at`
- `rules.created_at`

### Type/nullability/default changed (26)
- `announcements.body` — dev: `text|text|YES|` | prod: `text|text|NO|`
- `announcements.published_at` — dev: `timestamp with time zone|timestamptz|NO|now()` | prod: `timestamp with time zone|timestamptz|NO|`
- `diamonds.address` — dev: `text|text|YES|` | prod: `text|text|NO|`
- `divisions.display_order` — dev: `integer|int4|NO|0` | prod: `integer|int4|NO|`
- `divisions.playoff_config` — dev: `jsonb|jsonb|YES|` | prod: `jsonb|jsonb|YES|'{"type": "single", "crossover": "standard", "hasThirdPlace": false}'::jsonb`
- `divisions.pool_count` — dev: `integer|int4|YES|` | prod: `integer|int4|YES|1`
- `divisions.requires_pool_selection` — dev: `boolean|bool|NO|false` | prod: `boolean|bool|YES|false`
- `games.is_playoff` — dev: `boolean|bool|NO|false` | prod: `boolean|bool|YES|false`
- `games.location` — dev: `text|text|YES|` | prod: `text|text|NO|`
- `rep_roster_players.guardian_email` — dev: `text|text|YES|` | prod: `text|text|NO|`
- `rep_roster_players.guardian_first_name` — dev: `text|text|YES|` | prod: `text|text|NO|`
- `rep_roster_players.guardian_last_name` — dev: `text|text|YES|` | prod: `text|text|NO|`
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
### Only in DEV (6)
- `league_practices_recurrence_idx`
- `league_practices_schedule_idx`
- `league_practices_season_idx`
- `league_practices_team_idx`
- `rep_team_announcements_pkey`
- `rep_team_announcements_year_idx`

### Only in PROD (3)
- `league_practices_recurrence_group_id_idx`
- `league_practices_season_id_idx`
- `league_practices_team_id_idx`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (11)
- `announcements.announcements_tournament_id_fkey`
- `diamonds.diamonds_tournament_id_fkey`
- `divisions.age_groups_tournament_id_fkey`
- `games.games_age_group_id_fkey`
- `games.games_away_team_id_fkey`
- `games.games_tournament_id_fkey`
- `rep_team_announcements.rep_team_announcements_org_id_fkey`
- `rep_team_announcements.rep_team_announcements_pkey`
- `rep_team_announcements.rep_team_announcements_program_year_id_fkey`
- `rep_team_announcements.rep_team_announcements_team_id_fkey`
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

### CHECK only in DEV (7)
- `rep_team_announcements.rep_team_announcements_body_check`
- `rep_team_announcements.rep_team_announcements_counts_check`
- `rep_team_announcements.rep_team_announcements_failed_count_check`
- `rep_team_announcements.rep_team_announcements_recipient_count_check`
- `rep_team_announcements.rep_team_announcements_sent_count_check`
- `rep_team_announcements.rep_team_announcements_status_check`
- `rep_team_announcements.rep_team_announcements_subject_check`

### CHECK only in PROD (1)
- `tournaments.tournaments_status_check`

