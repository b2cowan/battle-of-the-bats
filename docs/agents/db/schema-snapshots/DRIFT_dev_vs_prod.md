# Dev vs Prod — structural drift

**Generated:** 2026-06-23 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 93 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 2 | 0 | — |
| Columns | 18 | 3 | 23 |
| Indexes | 15 | 3 | 0 |
| Constraints | 18 | 9 | — |
| RLS / CHECK | 1 | 1 | 0 (RLS state) |

## Tables
### Only in DEV (2)
- `chat_message_reactions`
- `chat_poll_votes`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (18)
- `chat_message_reactions.created_at`
- `chat_message_reactions.emoji`
- `chat_message_reactions.id`
- `chat_message_reactions.message_id`
- `chat_message_reactions.removed_at`
- `chat_message_reactions.room_id`
- `chat_message_reactions.user_id`
- `chat_messages.pinned_at`
- `chat_messages.pinned_by_user_id`
- `chat_poll_votes.created_at`
- `chat_poll_votes.id`
- `chat_poll_votes.message_id`
- `chat_poll_votes.option_id`
- `chat_poll_votes.removed_at`
- `chat_poll_votes.room_id`
- `chat_poll_votes.user_id`
- `organizations.team_limit`
- `tournaments.coach_names_show_on_public`

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
- `chat_message_reactions_message_idx`
- `chat_message_reactions_pkey`
- `chat_message_reactions_room_idx`
- `chat_message_reactions_unique`
- `chat_messages_pinned_idx`
- `chat_poll_votes_message_idx`
- `chat_poll_votes_pkey`
- `chat_poll_votes_room_idx`
- `chat_poll_votes_unique`
- `chat_rooms_surface_ref_nosub_uniq`
- `chat_rooms_surface_ref_sub_uniq`
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
### Only in DEV (18)
- `announcements.announcements_tournament_id_fkey`
- `chat_message_reactions.chat_message_reactions_message_id_fkey`
- `chat_message_reactions.chat_message_reactions_pkey`
- `chat_message_reactions.chat_message_reactions_room_id_fkey`
- `chat_message_reactions.chat_message_reactions_unique`
- `chat_message_reactions.chat_message_reactions_user_id_fkey`
- `chat_messages.chat_messages_pinned_by_user_id_fkey`
- `chat_poll_votes.chat_poll_votes_message_id_fkey`
- `chat_poll_votes.chat_poll_votes_pkey`
- `chat_poll_votes.chat_poll_votes_room_id_fkey`
- `chat_poll_votes.chat_poll_votes_unique`
- `chat_poll_votes.chat_poll_votes_user_id_fkey`
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

### CHECK only in DEV (1)
- `chat_message_reactions.chat_message_reactions_emoji_check`

### CHECK only in PROD (1)
- `tournaments.tournaments_status_check`

