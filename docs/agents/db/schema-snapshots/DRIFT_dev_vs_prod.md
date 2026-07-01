# Dev vs Prod — structural drift

**Generated:** 2026-06-30 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 104 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 2 | 0 | — |
| Columns | 32 | 3 | 23 |
| Indexes | 14 | 3 | 0 |
| Constraints | 16 | 9 | — |
| RLS / CHECK | 1 | 1 | 0 (RLS state) |

## Tables
### Only in DEV (2)
- `rep_tryout_sessions`
- `rep_tryouts`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (32)
- `organizations.privacy_policy_url`
- `rep_tryout_registrations.bib_number`
- `rep_tryout_registrations.checked_in_at`
- `rep_tryout_registrations.consent_at`
- `rep_tryout_registrations.consent_data_collection`
- `rep_tryout_registrations.consent_eligibility`
- `rep_tryout_registrations.consent_email_comms`
- `rep_tryout_registrations.consent_ip`
- `rep_tryout_registrations.is_checked_in`
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
### Only in DEV (14)
- `league_practices_recurrence_idx`
- `league_practices_schedule_idx`
- `league_practices_season_idx`
- `league_practices_team_idx`
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
### Only in DEV (16)
- `announcements.announcements_tournament_id_fkey`
- `diamonds.diamonds_tournament_id_fkey`
- `divisions.age_groups_tournament_id_fkey`
- `games.games_age_group_id_fkey`
- `games.games_away_team_id_fkey`
- `games.games_tournament_id_fkey`
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

### CHECK only in DEV (1)
- `rep_tryout_sessions.rep_tryout_sessions_status_check`

### CHECK only in PROD (1)
- `tournaments.tournaments_status_check`

