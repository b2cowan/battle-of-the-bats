# Dev vs Prod — structural drift

**Generated:** 2026-07-02 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 181 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 5 | 0 | — |
| Columns | 70 | 3 | 23 |
| Indexes | 29 | 3 | 0 |
| Constraints | 34 | 9 | — |
| RLS / CHECK | 4 | 1 | 0 (RLS state) |

## Tables
### Only in DEV (5)
- `rep_tryout_evaluator_sessions`
- `rep_tryout_rubrics`
- `rep_tryout_scores`
- `rep_tryout_sessions`
- `rep_tryouts`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (70)
- `organizations.privacy_policy_url`
- `rep_roster_players.lineup_profile`
- `rep_tryout_evaluator_sessions.created_at`
- `rep_tryout_evaluator_sessions.evaluator_name`
- `rep_tryout_evaluator_sessions.expires_at`
- `rep_tryout_evaluator_sessions.id`
- `rep_tryout_evaluator_sessions.org_id`
- `rep_tryout_evaluator_sessions.program_year_id`
- `rep_tryout_evaluator_sessions.revoked_at`
- `rep_tryout_evaluator_sessions.team_id`
- `rep_tryout_evaluator_sessions.token_hash`
- `rep_tryout_evaluator_sessions.tryout_id`
- `rep_tryout_registrations.bib_number`
- `rep_tryout_registrations.checked_in_at`
- `rep_tryout_registrations.consent_at`
- `rep_tryout_registrations.consent_data_collection`
- `rep_tryout_registrations.consent_eligibility`
- `rep_tryout_registrations.consent_email_comms`
- `rep_tryout_registrations.consent_ip`
- `rep_tryout_registrations.is_checked_in`
- `rep_tryout_registrations.offer_expires_at`
- `rep_tryout_registrations.offer_responded_at`
- `rep_tryout_registrations.offer_response`
- `rep_tryout_registrations.offer_sent_at`
- `rep_tryout_registrations.offer_token_hash`
- `rep_tryout_rubrics.categories`
- `rep_tryout_rubrics.created_at`
- `rep_tryout_rubrics.id`
- `rep_tryout_rubrics.name`
- `rep_tryout_rubrics.org_id`
- `rep_tryout_rubrics.program_year_id`
- `rep_tryout_rubrics.scale_max`
- `rep_tryout_rubrics.team_id`
- `rep_tryout_rubrics.tryout_id`
- `rep_tryout_rubrics.updated_at`
- `rep_tryout_scores.category_key`
- `rep_tryout_scores.created_at`
- `rep_tryout_scores.evaluator_session_id`
- `rep_tryout_scores.id`
- `rep_tryout_scores.note`
- `rep_tryout_scores.org_id`
- `rep_tryout_scores.program_year_id`
- `rep_tryout_scores.registration_id`
- `rep_tryout_scores.score`
- `rep_tryout_scores.team_id`
- `rep_tryout_scores.tryout_id`
- `rep_tryout_scores.updated_at`
- `rep_tryout_sessions.created_at`
- `rep_tryout_sessions.ends_at`
- `rep_tryout_sessions.field_number`
- `rep_tryout_sessions.id`
- `rep_tryout_sessions.label`
- `rep_tryout_sessions.location`
- `rep_tryout_sessions.location_address`
- `rep_tryout_sessions.org_id`
- `rep_tryout_sessions.program_year_id`
- `rep_tryout_sessions.starts_at`
- `rep_tryout_sessions.status`
- `rep_tryout_sessions.team_id`
- `rep_tryout_sessions.tryout_id`
- `rep_tryout_sessions.updated_at`
- `rep_tryouts.created_at`
- `rep_tryouts.id`
- `rep_tryouts.is_anonymous`
- `rep_tryouts.org_id`
- `rep_tryouts.program_year_id`
- `rep_tryouts.scores_locked_at`
- `rep_tryouts.scores_locked_by`
- `rep_tryouts.team_id`
- `rep_tryouts.updated_at`

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
### Only in DEV (29)
- `league_practices_recurrence_idx`
- `league_practices_schedule_idx`
- `league_practices_season_idx`
- `league_practices_team_idx`
- `rep_tryout_evaluator_sessions_org_idx`
- `rep_tryout_evaluator_sessions_pkey`
- `rep_tryout_evaluator_sessions_token_uq`
- `rep_tryout_evaluator_sessions_tryout_idx`
- `rep_tryout_registrations_bib_uq`
- `rep_tryout_registrations_offer_token_uq`
- `rep_tryout_rubrics_org_idx`
- `rep_tryout_rubrics_pkey`
- `rep_tryout_rubrics_team_idx`
- `rep_tryout_rubrics_tryout_uq`
- `rep_tryout_scores_evaluator_session_id_registration_id_cate_key`
- `rep_tryout_scores_org_idx`
- `rep_tryout_scores_pkey`
- `rep_tryout_scores_reg_idx`
- `rep_tryout_scores_tryout_idx`
- `rep_tryout_sessions_org_idx`
- `rep_tryout_sessions_pkey`
- `rep_tryout_sessions_starts_idx`
- `rep_tryout_sessions_team_idx`
- `rep_tryout_sessions_tryout_idx`
- `rep_tryout_sessions_year_idx`
- `rep_tryouts_org_idx`
- `rep_tryouts_pkey`
- `rep_tryouts_program_year_uq`
- `rep_tryouts_team_idx`

### Only in PROD (3)
- `league_practices_recurrence_group_id_idx`
- `league_practices_season_id_idx`
- `league_practices_team_id_idx`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (34)
- `announcements.announcements_tournament_id_fkey`
- `diamonds.diamonds_tournament_id_fkey`
- `divisions.age_groups_tournament_id_fkey`
- `games.games_age_group_id_fkey`
- `games.games_away_team_id_fkey`
- `games.games_tournament_id_fkey`
- `rep_tryout_evaluator_sessions.rep_tryout_evaluator_sessions_org_id_fkey`
- `rep_tryout_evaluator_sessions.rep_tryout_evaluator_sessions_pkey`
- `rep_tryout_evaluator_sessions.rep_tryout_evaluator_sessions_program_year_id_fkey`
- `rep_tryout_evaluator_sessions.rep_tryout_evaluator_sessions_team_id_fkey`
- `rep_tryout_evaluator_sessions.rep_tryout_evaluator_sessions_tryout_id_fkey`
- `rep_tryout_rubrics.rep_tryout_rubrics_org_id_fkey`
- `rep_tryout_rubrics.rep_tryout_rubrics_pkey`
- `rep_tryout_rubrics.rep_tryout_rubrics_program_year_id_fkey`
- `rep_tryout_rubrics.rep_tryout_rubrics_team_id_fkey`
- `rep_tryout_rubrics.rep_tryout_rubrics_tryout_id_fkey`
- `rep_tryout_scores.rep_tryout_scores_evaluator_session_id_fkey`
- `rep_tryout_scores.rep_tryout_scores_evaluator_session_id_registration_id_cate_key`
- `rep_tryout_scores.rep_tryout_scores_org_id_fkey`
- `rep_tryout_scores.rep_tryout_scores_pkey`
- `rep_tryout_scores.rep_tryout_scores_program_year_id_fkey`
- `rep_tryout_scores.rep_tryout_scores_registration_id_fkey`
- `rep_tryout_scores.rep_tryout_scores_team_id_fkey`
- `rep_tryout_scores.rep_tryout_scores_tryout_id_fkey`
- `rep_tryout_sessions.rep_tryout_sessions_org_id_fkey`
- `rep_tryout_sessions.rep_tryout_sessions_pkey`
- `rep_tryout_sessions.rep_tryout_sessions_program_year_id_fkey`
- `rep_tryout_sessions.rep_tryout_sessions_team_id_fkey`
- `rep_tryout_sessions.rep_tryout_sessions_tryout_id_fkey`
- `rep_tryouts.rep_tryouts_org_id_fkey`
- `rep_tryouts.rep_tryouts_pkey`
- `rep_tryouts.rep_tryouts_program_year_id_fkey`
- `rep_tryouts.rep_tryouts_team_id_fkey`
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

### CHECK only in DEV (4)
- `rep_tryout_registrations.rep_tryout_registrations_offer_response_check`
- `rep_tryout_rubrics.rep_tryout_rubrics_scale_max_check`
- `rep_tryout_scores.rep_tryout_scores_score_check`
- `rep_tryout_sessions.rep_tryout_sessions_status_check`

### CHECK only in PROD (1)
- `tournaments.tournaments_status_check`

