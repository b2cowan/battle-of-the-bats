# Dev vs Prod — structural drift

**Generated:** 2026-07-10 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 79 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 2 | 0 | — |
| Columns | 12 | 3 | 23 |
| Indexes | 10 | 3 | 0 |
| Constraints | 14 | 9 | — |
| RLS / CHECK | 2 | 1 | 0 (RLS state) |

## Tables
### Only in DEV (2)
- `rep_team_event_tags`
- `rep_team_tags`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (12)
- `platform_email_templates.planned_send_date`
- `rep_team_event_tags.created_at`
- `rep_team_event_tags.event_id`
- `rep_team_event_tags.tag_id`
- `rep_team_tags.created_at`
- `rep_team_tags.created_by`
- `rep_team_tags.id`
- `rep_team_tags.kind`
- `rep_team_tags.name`
- `rep_team_tags.org_id`
- `rep_team_tags.team_id`
- `rep_team_tags.updated_at`

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
### Only in DEV (10)
- `league_practices_recurrence_idx`
- `league_practices_schedule_idx`
- `league_practices_season_idx`
- `league_practices_team_idx`
- `rep_team_event_tags_pkey`
- `rep_team_event_tags_tag_idx`
- `rep_team_tags_name_uniq`
- `rep_team_tags_org_idx`
- `rep_team_tags_pkey`
- `rep_team_tags_team_idx`

### Only in PROD (3)
- `league_practices_recurrence_group_id_idx`
- `league_practices_season_id_idx`
- `league_practices_team_id_idx`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (14)
- `announcements.announcements_tournament_id_fkey`
- `diamonds.diamonds_tournament_id_fkey`
- `divisions.age_groups_tournament_id_fkey`
- `games.games_age_group_id_fkey`
- `games.games_away_team_id_fkey`
- `games.games_tournament_id_fkey`
- `rep_team_event_tags.rep_team_event_tags_event_id_fkey`
- `rep_team_event_tags.rep_team_event_tags_pkey`
- `rep_team_event_tags.rep_team_event_tags_tag_id_fkey`
- `rep_team_tags.rep_team_tags_created_by_fkey`
- `rep_team_tags.rep_team_tags_org_id_fkey`
- `rep_team_tags.rep_team_tags_pkey`
- `rep_team_tags.rep_team_tags_team_id_fkey`
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

### CHECK only in DEV (2)
- `rep_team_tags.rep_team_tags_kind_check`
- `rep_team_tags.rep_team_tags_name_check`

### CHECK only in PROD (1)
- `tournaments.tournaments_status_check`

