# Dev vs Prod — structural drift

**Generated:** 2026-07-13 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 119 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 4 | 0 | — |
| Columns | 27 | 3 | 24 |
| Indexes | 21 | 3 | 0 |
| Constraints | 23 | 9 | — |
| RLS / CHECK | 4 | 1 | 0 (RLS state) |

## Tables
### Only in DEV (4)
- `rep_player_awards`
- `rep_team_award_types`
- `rep_team_expense_tags`
- `user_marketing_opt_outs`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (27)
- `rep_player_awards.award_type_id`
- `rep_player_awards.awarded_at`
- `rep_player_awards.created_at`
- `rep_player_awards.created_by`
- `rep_player_awards.event_id`
- `rep_player_awards.id`
- `rep_player_awards.note`
- `rep_player_awards.org_id`
- `rep_player_awards.player_id`
- `rep_player_awards.team_id`
- `rep_player_awards.tournament_label`
- `rep_player_awards.updated_at`
- `rep_team_award_types.created_at`
- `rep_team_award_types.created_by`
- `rep_team_award_types.emoji`
- `rep_team_award_types.id`
- `rep_team_award_types.is_active`
- `rep_team_award_types.name`
- `rep_team_award_types.org_id`
- `rep_team_award_types.sort_order`
- `rep_team_award_types.team_id`
- `rep_team_award_types.updated_at`
- `rep_team_expense_tags.created_at`
- `rep_team_expense_tags.expense_id`
- `rep_team_expense_tags.tag_id`
- `user_marketing_opt_outs.opted_out_at`
- `user_marketing_opt_outs.user_id`

### Only in PROD (3)
- `resources.created_at`
- `rule_items.created_at`
- `rules.created_at`

### Type/nullability/default changed (24)
- `announcements.body` — dev: `text|text|YES|` | prod: `text|text|NO|`
- `announcements.published_at` — dev: `timestamp with time zone|timestamptz|NO|now()` | prod: `timestamp with time zone|timestamptz|NO|`
- `diamonds.address` — dev: `text|text|YES|` | prod: `text|text|NO|`
- `divisions.display_order` — dev: `integer|int4|NO|0` | prod: `integer|int4|NO|`
- `divisions.playoff_config` — dev: `jsonb|jsonb|YES|` | prod: `jsonb|jsonb|YES|'{"type": "single", "crossover": "standard", "hasThirdPlace": false}'::jsonb`
- `divisions.pool_count` — dev: `integer|int4|YES|` | prod: `integer|int4|YES|1`
- `divisions.requires_pool_selection` — dev: `boolean|bool|NO|false` | prod: `boolean|bool|YES|false`
- `games.is_playoff` — dev: `boolean|bool|NO|false` | prod: `boolean|bool|YES|false`
- `games.location` — dev: `text|text|YES|` | prod: `text|text|NO|`
- `rep_team_tags.team_id` — dev: `uuid|uuid|YES|` | prod: `uuid|uuid|NO|`
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
### Only in DEV (21)
- `league_practices_recurrence_idx`
- `league_practices_schedule_idx`
- `league_practices_season_idx`
- `league_practices_team_idx`
- `rep_player_awards_event_idx`
- `rep_player_awards_org_idx`
- `rep_player_awards_pkey`
- `rep_player_awards_player_idx`
- `rep_player_awards_team_idx`
- `rep_player_awards_type_idx`
- `rep_team_award_types_name_uniq`
- `rep_team_award_types_org_idx`
- `rep_team_award_types_org_name_uniq`
- `rep_team_award_types_org_shared_idx`
- `rep_team_award_types_pkey`
- `rep_team_award_types_team_idx`
- `rep_team_expense_tags_pkey`
- `rep_team_expense_tags_tag_idx`
- `rep_team_tags_org_name_uniq`
- `rep_team_tags_org_shared_idx`
- `user_marketing_opt_outs_pkey`

### Only in PROD (3)
- `league_practices_recurrence_group_id_idx`
- `league_practices_season_id_idx`
- `league_practices_team_id_idx`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (23)
- `announcements.announcements_tournament_id_fkey`
- `diamonds.diamonds_tournament_id_fkey`
- `divisions.age_groups_tournament_id_fkey`
- `games.games_age_group_id_fkey`
- `games.games_away_team_id_fkey`
- `games.games_tournament_id_fkey`
- `rep_player_awards.rep_player_awards_award_type_id_fkey`
- `rep_player_awards.rep_player_awards_created_by_fkey`
- `rep_player_awards.rep_player_awards_event_id_fkey`
- `rep_player_awards.rep_player_awards_org_id_fkey`
- `rep_player_awards.rep_player_awards_pkey`
- `rep_player_awards.rep_player_awards_player_id_fkey`
- `rep_player_awards.rep_player_awards_team_id_fkey`
- `rep_team_award_types.rep_team_award_types_created_by_fkey`
- `rep_team_award_types.rep_team_award_types_org_id_fkey`
- `rep_team_award_types.rep_team_award_types_pkey`
- `rep_team_award_types.rep_team_award_types_team_id_fkey`
- `rep_team_expense_tags.rep_team_expense_tags_expense_id_fkey`
- `rep_team_expense_tags.rep_team_expense_tags_pkey`
- `rep_team_expense_tags.rep_team_expense_tags_tag_id_fkey`
- `teams.teams_tournament_id_fkey`
- `user_marketing_opt_outs.user_marketing_opt_outs_pkey`
- `user_marketing_opt_outs.user_marketing_opt_outs_user_id_fkey`

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

### CHECK only in DEV (4)
- `rep_player_awards.rep_player_awards_note_check`
- `rep_player_awards.rep_player_awards_tournament_label_check`
- `rep_team_award_types.rep_team_award_types_emoji_check`
- `rep_team_award_types.rep_team_award_types_name_check`

### CHECK only in PROD (1)
- `tournaments.tournaments_status_check`

