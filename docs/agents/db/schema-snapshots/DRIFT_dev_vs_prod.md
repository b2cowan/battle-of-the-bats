# Dev vs Prod — structural drift

**Generated:** 2026-07-17 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 276 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 11 | 0 | — |
| Columns | 94 | 3 | 24 |
| Indexes | 53 | 3 | 0 |
| Constraints | 59 | 9 | — |
| RLS / CHECK | 19 | 1 | 0 (RLS state) |

## Tables
### Only in DEV (11)
- `fan_alert_prefs`
- `fan_follows`
- `rep_player_awards`
- `rep_player_continuity_links`
- `rep_player_development_goals`
- `rep_player_measurables`
- `rep_team_award_types`
- `rep_team_evaluation_sessions`
- `rep_team_expense_tags`
- `rep_team_measurable_types`
- `user_marketing_opt_outs`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (94)
- `fan_alert_prefs.created_at`
- `fan_alert_prefs.event_news`
- `fan_alert_prefs.game_alerts`
- `fan_alert_prefs.updated_at`
- `fan_alert_prefs.user_id`
- `fan_follows.created_at`
- `fan_follows.entity_id`
- `fan_follows.entity_type`
- `fan_follows.id`
- `fan_follows.source`
- `fan_follows.updated_at`
- `fan_follows.user_id`
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
- `rep_player_continuity_links.confidence`
- `rep_player_continuity_links.created_at`
- `rep_player_continuity_links.current_registration_id`
- `rep_player_continuity_links.current_roster_id`
- `rep_player_continuity_links.decided_at`
- `rep_player_continuity_links.decided_by`
- `rep_player_continuity_links.id`
- `rep_player_continuity_links.org_id`
- `rep_player_continuity_links.prior_registration_id`
- `rep_player_continuity_links.prior_roster_id`
- `rep_player_continuity_links.status`
- `rep_player_continuity_links.team_id`
- `rep_player_continuity_links.updated_at`
- `rep_player_development_goals.created_at`
- `rep_player_development_goals.created_by`
- `rep_player_development_goals.focus_area`
- `rep_player_development_goals.id`
- `rep_player_development_goals.note`
- `rep_player_development_goals.org_id`
- `rep_player_development_goals.player_id`
- `rep_player_development_goals.status`
- `rep_player_development_goals.team_id`
- `rep_player_development_goals.updated_at`
- `rep_player_measurables.created_at`
- `rep_player_measurables.created_by`
- `rep_player_measurables.id`
- `rep_player_measurables.measurable_type_id`
- `rep_player_measurables.note`
- `rep_player_measurables.org_id`
- `rep_player_measurables.player_id`
- `rep_player_measurables.recorded_on`
- `rep_player_measurables.session_id`
- `rep_player_measurables.team_id`
- `rep_player_measurables.unit`
- `rep_player_measurables.updated_at`
- `rep_player_measurables.value`
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
- `rep_team_evaluation_sessions.created_at`
- `rep_team_evaluation_sessions.created_by`
- `rep_team_evaluation_sessions.id`
- `rep_team_evaluation_sessions.note`
- `rep_team_evaluation_sessions.org_id`
- `rep_team_evaluation_sessions.program_year_id`
- `rep_team_evaluation_sessions.session_date`
- `rep_team_evaluation_sessions.team_id`
- `rep_team_evaluation_sessions.updated_at`
- `rep_team_expense_tags.created_at`
- `rep_team_expense_tags.expense_id`
- `rep_team_expense_tags.tag_id`
- `rep_team_measurable_types.created_at`
- `rep_team_measurable_types.created_by`
- `rep_team_measurable_types.id`
- `rep_team_measurable_types.is_active`
- `rep_team_measurable_types.name`
- `rep_team_measurable_types.org_id`
- `rep_team_measurable_types.sort_order`
- `rep_team_measurable_types.team_id`
- `rep_team_measurable_types.unit`
- `rep_team_measurable_types.updated_at`
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
### Only in DEV (53)
- `fan_alert_prefs_pkey`
- `fan_follows_entity_idx`
- `fan_follows_pkey`
- `fan_follows_user_entity_unique`
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
- `rep_player_continuity_links_confirmed_uniq`
- `rep_player_continuity_links_org_idx`
- `rep_player_continuity_links_pair_uniq`
- `rep_player_continuity_links_pkey`
- `rep_player_continuity_links_prior_idx`
- `rep_player_continuity_links_team_idx`
- `rep_player_development_goals_org_idx`
- `rep_player_development_goals_pkey`
- `rep_player_development_goals_player_idx`
- `rep_player_development_goals_team_idx`
- `rep_player_measurables_org_idx`
- `rep_player_measurables_pkey`
- `rep_player_measurables_player_idx`
- `rep_player_measurables_session_entry_uniq`
- `rep_player_measurables_session_idx`
- `rep_player_measurables_team_idx`
- `rep_player_measurables_type_idx`
- `rep_roster_players_id_team_uniq`
- `rep_team_award_types_name_uniq`
- `rep_team_award_types_org_idx`
- `rep_team_award_types_org_name_uniq`
- `rep_team_award_types_org_shared_idx`
- `rep_team_award_types_pkey`
- `rep_team_award_types_team_idx`
- `rep_team_evaluation_sessions_id_team_uniq`
- `rep_team_evaluation_sessions_org_idx`
- `rep_team_evaluation_sessions_pkey`
- `rep_team_evaluation_sessions_py_idx`
- `rep_team_evaluation_sessions_team_idx`
- `rep_team_expense_tags_pkey`
- `rep_team_expense_tags_tag_idx`
- `rep_team_measurable_types_name_uniq`
- `rep_team_measurable_types_org_idx`
- `rep_team_measurable_types_pkey`
- `rep_team_measurable_types_team_idx`
- `rep_team_tags_org_name_uniq`
- `rep_team_tags_org_shared_idx`
- `rep_tryout_registrations_id_team_uniq`
- `user_marketing_opt_outs_pkey`

### Only in PROD (3)
- `league_practices_recurrence_group_id_idx`
- `league_practices_season_id_idx`
- `league_practices_team_id_idx`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (59)
- `announcements.announcements_tournament_id_fkey`
- `diamonds.diamonds_tournament_id_fkey`
- `divisions.age_groups_tournament_id_fkey`
- `fan_alert_prefs.fan_alert_prefs_pkey`
- `fan_alert_prefs.fan_alert_prefs_user_id_fkey`
- `fan_follows.fan_follows_pkey`
- `fan_follows.fan_follows_user_id_fkey`
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
- `rep_player_continuity_links.rep_player_continuity_links_current_registration_team_fkey`
- `rep_player_continuity_links.rep_player_continuity_links_current_roster_team_fkey`
- `rep_player_continuity_links.rep_player_continuity_links_decided_by_fkey`
- `rep_player_continuity_links.rep_player_continuity_links_org_id_fkey`
- `rep_player_continuity_links.rep_player_continuity_links_pkey`
- `rep_player_continuity_links.rep_player_continuity_links_prior_registration_team_fkey`
- `rep_player_continuity_links.rep_player_continuity_links_prior_roster_team_fkey`
- `rep_player_continuity_links.rep_player_continuity_links_team_id_fkey`
- `rep_player_development_goals.rep_player_development_goals_created_by_fkey`
- `rep_player_development_goals.rep_player_development_goals_org_id_fkey`
- `rep_player_development_goals.rep_player_development_goals_pkey`
- `rep_player_development_goals.rep_player_development_goals_player_id_fkey`
- `rep_player_development_goals.rep_player_development_goals_team_id_fkey`
- `rep_player_measurables.rep_player_measurables_created_by_fkey`
- `rep_player_measurables.rep_player_measurables_measurable_type_id_fkey`
- `rep_player_measurables.rep_player_measurables_org_id_fkey`
- `rep_player_measurables.rep_player_measurables_pkey`
- `rep_player_measurables.rep_player_measurables_player_id_fkey`
- `rep_player_measurables.rep_player_measurables_session_team_fkey`
- `rep_player_measurables.rep_player_measurables_team_id_fkey`
- `rep_roster_players.rep_roster_players_id_team_uniq`
- `rep_team_award_types.rep_team_award_types_created_by_fkey`
- `rep_team_award_types.rep_team_award_types_org_id_fkey`
- `rep_team_award_types.rep_team_award_types_pkey`
- `rep_team_award_types.rep_team_award_types_team_id_fkey`
- `rep_team_evaluation_sessions.rep_team_evaluation_sessions_created_by_fkey`
- `rep_team_evaluation_sessions.rep_team_evaluation_sessions_id_team_uniq`
- `rep_team_evaluation_sessions.rep_team_evaluation_sessions_org_id_fkey`
- `rep_team_evaluation_sessions.rep_team_evaluation_sessions_pkey`
- `rep_team_evaluation_sessions.rep_team_evaluation_sessions_program_year_id_fkey`
- `rep_team_evaluation_sessions.rep_team_evaluation_sessions_team_id_fkey`
- `rep_team_expense_tags.rep_team_expense_tags_expense_id_fkey`
- `rep_team_expense_tags.rep_team_expense_tags_pkey`
- `rep_team_expense_tags.rep_team_expense_tags_tag_id_fkey`
- `rep_team_measurable_types.rep_team_measurable_types_created_by_fkey`
- `rep_team_measurable_types.rep_team_measurable_types_org_id_fkey`
- `rep_team_measurable_types.rep_team_measurable_types_pkey`
- `rep_team_measurable_types.rep_team_measurable_types_team_id_fkey`
- `rep_tryout_registrations.rep_tryout_registrations_id_team_uniq`
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

### CHECK only in DEV (19)
- `fan_follows.fan_follows_entity_type_check`
- `fan_follows.fan_follows_source_check`
- `rep_player_awards.rep_player_awards_note_check`
- `rep_player_awards.rep_player_awards_tournament_label_check`
- `rep_player_continuity_links.rep_player_continuity_links_confidence_check`
- `rep_player_continuity_links.rep_player_continuity_links_one_current`
- `rep_player_continuity_links.rep_player_continuity_links_one_prior`
- `rep_player_continuity_links.rep_player_continuity_links_status_check`
- `rep_player_development_goals.rep_player_development_goals_focus_area_check`
- `rep_player_development_goals.rep_player_development_goals_note_check`
- `rep_player_development_goals.rep_player_development_goals_status_check`
- `rep_player_measurables.rep_player_measurables_note_check`
- `rep_player_measurables.rep_player_measurables_unit_check`
- `rep_player_measurables.rep_player_measurables_value_check`
- `rep_team_award_types.rep_team_award_types_emoji_check`
- `rep_team_award_types.rep_team_award_types_name_check`
- `rep_team_evaluation_sessions.rep_team_evaluation_sessions_note_check`
- `rep_team_measurable_types.rep_team_measurable_types_name_check`
- `rep_team_measurable_types.rep_team_measurable_types_unit_check`

### CHECK only in PROD (1)
- `tournaments.tournaments_status_check`

