---
topic: Dev DB schema
updated: 2026-05-24
source: docs/schema-snapshots/schema_dumps.json
tables: 85
environments: dev, prod
---

# FieldLogicHQ — Complete Database Schema Reference

## Divergence Summary

Column schemas are **identical** between dev and prod across all 85 tables (same columns, types, defaults, ordinal positions).

**FK constraint naming divergence** — tournament-legacy tables use `fk_` prefix in prod vs `table_column_fkey` pattern in dev:

| Table | Column | Dev constraint name | Prod constraint name |
|---|---|---|---|
| age_groups | tournament_id | age_groups_tournament_id_fkey | fk_age_groups_tournament |
| announcements | tournament_id | announcements_tournament_id_fkey | fk_announcements_tournament |
| contacts | tournament_id | contacts_tournament_id_fkey | fk_contacts_tournament |
| diamonds | tournament_id | diamonds_tournament_id_fkey | fk_diamonds_tournament |
| games | diamond_id | games_diamond_id_fkey | fk_games_diamond |
| games | away_team_id | games_away_team_id_fkey | fk_games_away_team |
| games | age_group_id | games_age_group_id_fkey | fk_games_age_group |

**Duplicate FK constraints in prod on `games`:**
- `games_age_group_id_fkey` AND `fk_games_age_group` both exist on `games.age_group_id`
- `games_away_team_id_fkey` AND `fk_games_away_team` both exist on `games.away_team_id`

**Non-standard FK name in both environments:**
- `rep_fundraiser_entries.credit_id` → constraint name `fk_fundraiser_entry_credit` (uses `fk_` prefix in both dev and prod)

---

## Module Key

- **Tournament** — unprefixed tables: `tournaments`, `age_groups`, `teams`, `games`, `pools`, `pool_slots`, `diamonds`, `contacts`, `announcements`, `resources`, `rules`, `rule_items`, `tournament_archives`, `tournament_registration_fields`, `tournament_registration_field_answers`
- **Accounting** — `accounting_*`, `budget_categories`, `budget_items`, `org_budget_lines`, `org_budget_periods`
- **League** — `league_*`
- **Rep Teams** — `rep_*`
- **Standalone Team Workspace** — `team_*`
- **Platform / Org Core** — `organizations`, `organization_members`, `org_*`, `platform_*`, `plan_*`, `stripe_prices`, `early_access_leads`

---

## Tables (alphabetical)

---

### accounting_entries
**Module:** Accounting | **RLS:** ENABLED | **Tenancy:** via `ledger_id → accounting_ledgers.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | ledger_id | uuid | NO | — |
| 3 | entry_date | date | NO | — |
| 4 | description | text | NO | — |
| 5 | amount | numeric | NO | — |
| 6 | entry_type | text | NO | — |
| 7 | status | text | NO | 'posted' |
| 8 | category | text | YES | — |
| 9 | linked_entry_id | uuid | YES | — |
| 10 | source_module | text | YES | — |
| 11 | source_entity_id | uuid | YES | — |
| 12 | created_by | uuid | YES | — |
| 13 | created_at | timestamptz | NO | now() |
| 14 | updated_at | timestamptz | NO | now() |
| 15 | payment_method | text | YES | — |
| 16 | payee_id | uuid | YES | — |
| 17 | payee_payer | text | YES | — |
| 18 | notes | text | YES | — |

**Foreign keys:** `ledger_id → accounting_ledgers.id`, `linked_entry_id → accounting_entries.id` (self), `payee_id → org_payees.id`

**Indexes:** `accounting_entries_pkey` (id), `accounting_entries_ledger_id_idx` (ledger_id), `accounting_entries_entry_date_idx` (ledger_id, entry_date DESC)

**Checks:** `amount > 0`; `entry_type IN ('income','expense','transfer_in','transfer_out')`; `status IN ('pending','posted','void')`

---

### accounting_ledgers
**Module:** Accounting | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | org_id | uuid | NO | — |
| 3 | entity_type | text | NO | — |
| 4 | entity_id | uuid | YES | — |
| 5 | name | text | NO | — |
| 6 | currency | bpchar | NO | 'CAD' |
| 7 | is_archived | bool | NO | false |
| 8 | created_at | timestamptz | NO | now() |

**Foreign keys:** `org_id → organizations.id`

**Indexes:** `accounting_ledgers_pkey` (id), `accounting_ledgers_org_id_entity_type_entity_id_key` UNIQUE (org_id, entity_type, entity_id)

**Checks:** `entity_type IN ('org','tournament','team','league_season')`

---

### age_groups
**Module:** Tournament | **RLS:** ENABLED | **Tenancy:** via `tournament_id → tournaments.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | tournament_id | uuid | YES | — |
| 3 | name | text | NO | — |
| 4 | min_age | int4 | YES | — |
| 5 | max_age | int4 | YES | — |
| 6 | display_order | int4 | NO | 0 |
| 7 | contact_id | uuid | YES | — |
| 8 | is_closed | bool | NO | false |
| 9 | capacity | int4 | YES | — |
| 10 | pool_count | int4 | YES | — |
| 11 | pool_names | text | YES | — |
| 12 | requires_pool_selection | bool | NO | false |
| 13 | playoff_config | jsonb | YES | — |
| 14 | deposit_amount | numeric | YES | — |
| 15 | deposit_due_date | date | YES | — |
| 16 | total_fee_amount | numeric | YES | — |
| 17 | total_fee_due_date | date | YES | — |
| 18 | schedule_visibility | text | NO | 'unpublished' |

**Foreign keys:** `tournament_id → tournaments.id`, `contact_id → contacts.id`

**Checks:** `schedule_visibility IN ('unpublished','published_generic','published_teams')`

---

### announcements
**Module:** Tournament | **RLS:** ENABLED | **Tenancy:** via `tournament_id → tournaments.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | tournament_id | uuid | YES | — |
| 3 | title | text | NO | — |
| 4 | body | text | YES | — |
| 5 | published_at | timestamptz | NO | now() |
| 6 | pinned | bool | NO | false |
| 7 | age_group_ids | uuid[] | YES | — |

**Foreign keys:** `tournament_id → tournaments.id`

---

### billing_retained_records
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | intent_id | uuid | NO | — |
| 3 | org_id | uuid | NO | — |
| 4 | record_type | text | NO | — |
| 5 | record_id | uuid | YES | — |
| 6 | display_name | text | NO | — |
| 7 | retained_state | text | NO | 'retained_inactive' |
| 8 | retained_at | timestamptz | NO | now() |
| 9 | retention_until | timestamptz | NO | — |
| 10 | extension_count | int4 | NO | 0 |
| 11 | last_extended_at | timestamptz | YES | — |
| 12 | last_extended_by | text | YES | — |
| 13 | last_extension_reason | text | YES | — |
| 14 | metadata | jsonb | NO | '{}' |
| 15 | warning_sent_at | timestamptz | YES | — |
| 16 | pending_purge_at | timestamptz | YES | — |
| 17 | purge_notice_sent_at | timestamptz | YES | — |

**Foreign keys:** `intent_id → billing_retention_intents.id`, `org_id → organizations.id`

**Checks:** `retained_state IN ('retained_inactive','pending_purge','purged','restored')`; `record_type IN ('tournament','account')`

---

### billing_retention_intents
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | org_id | uuid | NO | — |
| 3 | intent_type | text | NO | — |
| 4 | status | text | NO | 'applied' |
| 5 | from_plan | text | YES | — |
| 6 | target_plan | text | YES | — |
| 7 | keep_tournament_ids | uuid[] | NO | '{}' |
| 8 | effective_at | timestamptz | NO | now() |
| 9 | retention_until | timestamptz | NO | — |
| 10 | reason | text | YES | — |
| 11 | created_by | uuid | YES | — |
| 12 | created_by_email | text | YES | — |
| 13 | created_at | timestamptz | NO | now() |
| 14 | updated_at | timestamptz | NO | now() |
| 15 | applied_at | timestamptz | YES | — |

**Foreign keys:** `org_id → organizations.id`

**Checks:** `intent_type IN ('downgrade','cancellation')`; `status IN ('pending','applied','canceled','restored','purged')`

---

### budget_categories
**Module:** Accounting | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | org_id | uuid | YES | — |
| 3 | name | text | NO | — |
| 4 | scope | text | NO | 'both' |
| 5 | sort_order | int4 | NO | 0 |
| 6 | is_default | bool | NO | false |
| 7 | created_at | timestamptz | NO | now() |

**Foreign keys:** `org_id → organizations.id`

**Checks:** `scope IN ('org','team','both')`

---

### budget_items
**Module:** Accounting | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | category_id | uuid | NO | — |
| 3 | org_id | uuid | YES | — |
| 4 | name | text | NO | — |
| 5 | suggested_amount | numeric | YES | — |
| 6 | sort_order | int4 | NO | 0 |
| 7 | is_default | bool | NO | false |
| 8 | is_misc | bool | NO | false |
| 9 | created_at | timestamptz | NO | now() |

**Foreign keys:** `category_id → budget_categories.id`, `org_id → organizations.id`

---

### contacts
**Module:** Tournament | **RLS:** ENABLED | **Tenancy:** via `tournament_id → tournaments.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | tournament_id | uuid | YES | — |
| 3 | name | text | NO | — |
| 4 | email | text | YES | — |
| 5 | phone | text | YES | — |
| 6 | role | text | YES | — |
| 7 | is_notification_contact | bool | NO | false |

**Foreign keys:** `tournament_id → tournaments.id`

---

### diamonds
**Module:** Tournament | **RLS:** ENABLED | **Tenancy:** via `tournament_id → tournaments.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | tournament_id | uuid | YES | — |
| 3 | name | text | NO | — |
| 4 | address | text | YES | — |
| 5 | notes | text | YES | — |

**Foreign keys:** `tournament_id → tournaments.id`

---

### early_access_leads
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** global (platform-admin only)

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | created_at | timestamptz | NO | now() |
| 3 | updated_at | timestamptz | NO | now() |
| 4 | last_submitted_at | timestamptz | NO | now() |
| 5 | submission_count | int4 | NO | 1 |
| 6 | status | text | NO | 'new' |
| 7 | name | text | NO | — |
| 8 | email | text | NO | — |
| 9 | email_normalized | text | NO | — |
| 10 | organization_name | text | YES | — |
| 11 | role | text | YES | — |
| 12 | sports | text | YES | — |
| 13 | plan_interest | text[] | NO | '{}' |
| 14 | features_interested | text[] | NO | '{}' |
| 15 | notes | text | YES | — |
| 16 | source_path | text | YES | — |
| 17 | user_agent | text | YES | — |
| 18 | release_notifications_consent | bool | NO | true |
| 19 | metadata | jsonb | NO | '{}' |
| 20 | internal_status | text | NO | 'new' |
| 21 | internal_notes | text | YES | — |
| 22 | last_contacted_at | timestamptz | YES | — |
| 23 | last_contacted_by | text | YES | — |
| 24 | converted_org_id | uuid | YES | — |
| 25 | converted_at | timestamptz | YES | — |
| 26 | follow_up_due_at | date | YES | — |
| 27 | next_action | text | YES | — |

**Foreign keys:** `converted_org_id → organizations.id`

---

### games
**Module:** Tournament | **RLS:** ENABLED | **Tenancy:** via `tournament_id → tournaments.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | tournament_id | uuid | YES | — |
| 3 | age_group_id | uuid | YES | — |
| 4 | home_team_id | uuid | YES | — |
| 5 | away_team_id | uuid | YES | — |
| 6 | game_date | date | YES | — |
| 7 | game_time | time | YES | — |
| 8 | location | text | YES | — |
| 9 | diamond_id | uuid | YES | — |
| 10 | home_score | int4 | YES | — |
| 11 | away_score | int4 | YES | — |
| 12 | status | text | NO | 'scheduled' |
| 13 | is_playoff | bool | NO | false |
| 14 | bracket_id | uuid | YES | — |
| 15 | bracket_code | text | YES | — |
| 16 | home_placeholder | text | YES | — |
| 17 | away_placeholder | text | YES | — |
| 18 | notes | text | YES | — |
| 19 | home_slot_id | uuid | YES | — |
| 20 | away_slot_id | uuid | YES | — |
| 21 | score_submitted_by_user_id | uuid | YES | — |
| 22 | score_submitted_by_email | text | YES | — |
| 23 | score_submitted_at | timestamptz | YES | — |
| 24 | score_submission_source | text | YES | — |

**Foreign keys:** `tournament_id → tournaments.id`, `age_group_id → age_groups.id`, `home_team_id → teams.id`, `away_team_id → teams.id`, `diamond_id → diamonds.id`, `home_slot_id → pool_slots.id`, `away_slot_id → pool_slots.id`

**Checks:** `score_submission_source IN ('scorekeeper','admin_results','system') OR NULL`

**Note (prod divergence):** Duplicate FK constraints exist on `age_group_id` and `away_team_id` — both `games_*_fkey` and `fk_games_*` names.

---

### league_divisions
**Module:** League | **RLS:** ENABLED | **Tenancy:** via `season_id → league_seasons.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | season_id | uuid | NO | — |
| 3 | name | text | NO | — |
| 4 | capacity | int4 | YES | — |
| 5 | sort_order | int4 | NO | 0 |
| 6 | created_at | timestamptz | NO | now() |

**Foreign keys:** `season_id → league_seasons.id`

---

### league_email_log
**Module:** League | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | org_id | uuid | NO | — |
| 3 | season_id | uuid | NO | — |
| 4 | sent_by | uuid | NO | — |
| 5 | sent_at | timestamptz | NO | now() |
| 6 | subject | text | NO | — |
| 7 | scope | text | NO | — |
| 8 | audience | text | NO | — |
| 9 | count_sent | int4 | NO | 0 |
| 10 | count_skipped | int4 | NO | 0 |

**Foreign keys:** `org_id → organizations.id`, `season_id → league_seasons.id`

---

### league_games
**Module:** League | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | season_id | uuid | NO | — |
| 3 | division_id | uuid | NO | — |
| 4 | home_team_id | uuid | NO | — |
| 5 | away_team_id | uuid | NO | — |
| 6 | scheduled_at | timestamptz | YES | — |
| 7 | location | text | YES | — |
| 8 | home_score | int4 | YES | — |
| 9 | away_score | int4 | YES | — |
| 10 | status | text | NO | 'scheduled' |
| 11 | notes | text | YES | — |
| 12 | created_at | timestamptz | NO | now() |
| 13 | updated_at | timestamptz | NO | now() |
| 14 | org_id | uuid | NO | — |

**Foreign keys:** `season_id → league_seasons.id`, `division_id → league_divisions.id`, `home_team_id → league_teams.id`, `away_team_id → league_teams.id`, `org_id → organizations.id`

**Checks:** `status IN ('scheduled','completed','cancelled','postponed')`

---

### league_notification_log
**Module:** League | **RLS:** ENABLED | **Tenancy:** via `season_id → league_seasons.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | season_id | uuid | NO | — |
| 3 | sent_by | uuid | YES | — |
| 4 | audience_type | text | NO | — |
| 5 | audience_label | text | YES | — |
| 6 | subject | text | NO | — |
| 7 | recipient_count | int4 | NO | — |
| 8 | sent_at | timestamptz | NO | now() |

**Foreign keys:** `season_id → league_seasons.id`

---

### league_practices
**Module:** League | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | season_id | uuid | NO | — |
| 3 | division_id | uuid | YES | — |
| 4 | team_id | uuid | NO | — |
| 5 | scheduled_at | timestamptz | YES | — |
| 6 | ends_at | timestamptz | YES | — |
| 7 | location | text | YES | — |
| 8 | notes | text | YES | — |
| 9 | status | text | NO | 'scheduled' |
| 10 | recurrence_group_id | uuid | YES | — |
| 11 | created_at | timestamptz | NO | now() |
| 12 | updated_at | timestamptz | NO | now() |
| 13 | org_id | uuid | NO | — |

**Foreign keys:** `season_id → league_seasons.id`, `division_id → league_divisions.id`, `team_id → league_teams.id`, `org_id → organizations.id`

**Checks:** `status IN ('scheduled','cancelled')`

---

### league_registrations
**Module:** League | **RLS:** ENABLED | **Tenancy:** via `season_id → league_seasons.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | season_id | uuid | NO | — |
| 3 | division_id | uuid | YES | — |
| 4 | player_first_name | text | NO | — |
| 5 | player_last_name | text | NO | — |
| 6 | player_date_of_birth | date | YES | — |
| 7 | player_jersey_pref | text | YES | — |
| 8 | player_position_pref | text | YES | — |
| 9 | player_notes | text | YES | — |
| 10 | guardian_first_name | text | NO | — |
| 11 | guardian_last_name | text | NO | — |
| 12 | guardian_email | text | NO | — |
| 13 | guardian_phone | text | YES | — |
| 14 | status | text | NO | 'pending_review' |
| 15 | waitlist_position | int4 | YES | — |
| 16 | team_id | uuid | YES | — |
| 17 | registration_fee_paid | bool | NO | false |
| 18 | fee_entry_id | uuid | YES | — |
| 19 | admin_notes | text | YES | — |
| 20 | source | text | NO | 'public_form' |
| 21 | registered_at | timestamptz | NO | now() |
| 22 | updated_at | timestamptz | NO | now() |

**Foreign keys:** `season_id → league_seasons.id`, `division_id → league_divisions.id`, `team_id → league_teams.id`

**Checks:** `status IN ('pending_review','active','waitlisted','declined','withdrawn')`; `source IN ('public_form','admin_manual')`

---

### league_seasons
**Module:** League | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | org_id | uuid | NO | — |
| 3 | name | text | NO | — |
| 4 | slug | text | NO | — |
| 5 | sport | text | NO | 'softball' |
| 6 | age_group | text | YES | — |
| 7 | status | text | NO | 'draft' |
| 8 | description | text | YES | — |
| 9 | registration_fee | numeric | YES | — |
| 10 | auto_generate_fees | bool | NO | false |
| 11 | auto_approve_under_capacity | bool | NO | false |
| 12 | auto_promote_waitlist | bool | NO | false |
| 13 | registration_open_at | timestamptz | YES | — |
| 14 | registration_close_at | timestamptz | YES | — |
| 15 | season_start_date | date | YES | — |
| 16 | season_end_date | date | YES | — |
| 17 | waiver_text | text | YES | — |
| 18 | created_at | timestamptz | NO | now() |
| 19 | updated_at | timestamptz | NO | now() |
| 20 | draft_state | jsonb | YES | — |

**Foreign keys:** `org_id → organizations.id`

**Checks:** `status IN ('draft','registration_open','registration_closed','active','completed','archived')`

---

### league_teams
**Module:** League | **RLS:** ENABLED | **Tenancy:** via `season_id → league_seasons.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | season_id | uuid | NO | — |
| 3 | division_id | uuid | NO | — |
| 4 | name | text | NO | — |
| 5 | color | text | YES | — |
| 6 | coach_name | text | YES | — |
| 7 | sort_order | int4 | NO | 0 |
| 8 | created_at | timestamptz | NO | now() |

**Foreign keys:** `season_id → league_seasons.id`, `division_id → league_divisions.id`

---

### org_audit_log
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | org_id | uuid | NO | — |
| 3 | actor_id | uuid | YES | — |
| 4 | target_id | uuid | YES | — |
| 5 | action | text | NO | — |
| 6 | payload | jsonb | YES | — |
| 7 | created_at | timestamptz | NO | now() |

**Foreign keys:** `org_id → organizations.id`

---

### org_budget_lines
**Module:** Accounting | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | org_id | uuid | NO | — |
| 3 | season_year | int4 | NO | — |
| 4 | category_id | uuid | YES | — |
| 5 | item_id | uuid | YES | — |
| 6 | description | text | NO | — |
| 7 | total_amount | numeric | NO | — |
| 8 | notes | text | YES | — |
| 9 | sort_order | int4 | NO | 0 |
| 10 | created_at | timestamptz | NO | now() |
| 11 | updated_at | timestamptz | NO | now() |

**Foreign keys:** `org_id → organizations.id`, `category_id → budget_categories.id`, `item_id → budget_items.id`

**Checks:** `total_amount > 0`

---

### org_budget_periods
**Module:** Accounting | **RLS:** ENABLED | **Tenancy:** via `budget_line_id → org_budget_lines.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | budget_line_id | uuid | NO | — |
| 3 | period_label | text | NO | — |
| 4 | period_date | date | YES | — |
| 5 | amount | numeric | NO | — |
| 6 | sort_order | int4 | NO | 0 |
| 7 | created_at | timestamptz | NO | now() |

**Foreign keys:** `budget_line_id → org_budget_lines.id`

**Checks:** `amount > 0`

---

### org_internal_notes
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | org_id | uuid | NO | — |
| 3 | body | text | NO | — |
| 4 | created_by_email | text | NO | — |
| 5 | updated_by_email | text | YES | — |
| 6 | created_at | timestamptz | NO | now() |
| 7 | updated_at | timestamptz | NO | now() |
| 8 | deleted_at | timestamptz | YES | — |
| 9 | deleted_by_email | text | YES | — |

**Foreign keys:** `org_id → organizations.id`

---

### org_member_rep_group_scopes
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** via `member_id → organization_members.organization_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | member_id | uuid | NO | — |
| 2 | group_id | uuid | NO | — |

**Foreign keys:** `member_id → organization_members.id`, `group_id → rep_team_groups.id`

**Note:** Composite PK (member_id, group_id). Scopes an org member's rep-team access to specific groups.

---

### org_member_tournament_assignments
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** via `org_member_id → organization_members.organization_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | org_member_id | uuid | NO | — |
| 3 | tournament_id | uuid | NO | — |
| 4 | created_at | timestamptz | NO | now() |

**Foreign keys:** `org_member_id → organization_members.id`, `tournament_id → tournaments.id`

---

### org_overrides
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | org_id | uuid | NO | — |
| 3 | type | text | NO | — |
| 4 | value | text | YES | — |
| 5 | expires_at | timestamptz | YES | — |
| 6 | reason | text | NO | — |
| 7 | created_by | text | NO | — |
| 8 | created_at | timestamptz | NO | now() |
| 9 | revoked_at | timestamptz | YES | — |
| 10 | revoked_by | text | YES | — |

**Foreign keys:** `org_id → organizations.id`

**Checks:** `type IN ('subscription_status','comp_period')`

---

### org_payees
**Module:** Accounting | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | org_id | uuid | NO | — |
| 3 | team_id | uuid | YES | — |
| 4 | name | text | NO | — |
| 5 | notes | text | YES | — |
| 6 | is_active | bool | NO | true |
| 7 | created_by | uuid | YES | — |
| 8 | created_at | timestamptz | NO | now() |

**Foreign keys:** `org_id → organizations.id`, `team_id → rep_teams.id`

**Checks:** `char_length(TRIM(name)) > 0 AND char_length(name) <= 200`

---

### org_public_site_content
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | org_id | uuid | NO | — |
| 3 | tagline | text | YES | — |
| 4 | description | text | YES | — |
| 5 | contact_email | text | YES | — |
| 6 | social_instagram | text | YES | — |
| 7 | social_facebook | text | YES | — |
| 8 | social_x | text | YES | — |
| 9 | social_website | text | YES | — |
| 10 | show_upcoming_tournaments | bool | NO | true |
| 11 | show_archives_link | bool | NO | true |
| 12 | created_at | timestamptz | NO | now() |
| 13 | updated_at | timestamptz | NO | now() |

**Foreign keys:** `org_id → organizations.id`

---

### organization_members
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** via `organization_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | organization_id | uuid | NO | — |
| 3 | user_id | uuid | NO | — |
| 4 | role | text | NO | 'admin' |
| 5 | invited_at | timestamptz | NO | now() |
| 6 | accepted_at | timestamptz | YES | — |
| 7 | capabilities | jsonb | YES | — |
| 8 | status | text | NO | 'active' |
| 9 | display_name | text | YES | — |

**Foreign keys:** `organization_id → organizations.id`

**Checks:** `status IN ('invited','active','suspended')`; `char_length(display_name) <= 60`

---

### organizations
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** root table (IS the tenant)

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | name | text | NO | — |
| 3 | slug | text | NO | — |
| 4 | logo_url | text | YES | — |
| 5 | plan_id | text | NO | 'starter' |
| 6 | stripe_customer_id | text | YES | — |
| 7 | stripe_subscription_id | text | YES | — |
| 8 | subscription_status | text | NO | 'active' |
| 9 | tournament_limit | int4 | NO | 1 |
| 10 | is_public | bool | NO | true |
| 11 | created_at | timestamptz | NO | now() |
| 12 | theme_preset | text | YES | 'platform' |
| 13 | theme_primary | text | YES | — |
| 14 | theme_accent | text | YES | — |
| 15 | hero_banner_url | text | YES | — |
| 16 | theme_font | text | YES | 'system' |
| 17 | theme_card_style | text | YES | 'default' |
| 18 | require_score_finalization | bool | NO | false |
| 19 | onboarding_completed_at | timestamptz | YES | — |
| 20 | enabled_addons | jsonb | NO | '[]' |
| 21 | internal_notes | text | YES | — |
| 22 | billing_suspended_at | timestamptz | YES | — |
| 23 | billing_suspension_reason | text | YES | — |
| 24 | subscription_period | text | YES | — |
| 25 | current_period_end | timestamptz | YES | — |
| 26 | rep_team_subscription_item_id | text | YES | — |
| 27 | pdf_settings | jsonb | YES | '{}' |
| 28 | account_kind | text | NO | 'organization' |
| 29 | team_workspace_status | text | YES | — |
| 30 | is_discoverable | bool | NO | true |

**Checks:** `account_kind IN ('organization','team_workspace')`; `subscription_period IN ('monthly','annual')`; `team_workspace_status IN ('active','linked','org_owned','archived') OR NULL`

**Note:** `plan_id` values in use: `'tournament'`, `'team'`, `'tournament_plus'`, `'league'`, `'club'`. Default `'starter'` is legacy.

---

### plan_config_overrides
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** global (platform-admin only)

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | plan_id | text | NO | — |
| 3 | tournament_limit | int4 | YES | — |
| 4 | seat_limit | int4 | YES | — |
| 5 | trial_days | int4 | YES | — |
| 6 | updated_at | timestamptz | NO | now() |
| 7 | updated_by_email | text | YES | — |
| 8 | last_change_note | text | YES | — |

---

### plan_gating
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** global (platform-admin only)

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | plan_key | text | NO | — |
| 2 | gating_status | text | NO | 'early_access' |
| 3 | updated_at | timestamptz | YES | now() |
| 4 | updated_by_email | text | YES | — |
| 5 | last_change_note | text | YES | — |

**Checks:** `plan_key IN ('tournament','team','tournament_plus','league','club')`; `gating_status IN ('live','early_access')`

---

### platform_addon_catalog
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** global (platform-admin only)

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | addon_key | text | NO | — |
| 3 | label | text | NO | — |
| 4 | description | text | YES | — |
| 5 | module_key | text | YES | — |
| 6 | status | text | NO | 'planned' |
| 7 | default_included_plans | text[] | NO | '{}' |
| 8 | pricing_model | text | NO | 'custom' |
| 9 | monthly_price | numeric | YES | — |
| 10 | annual_price | numeric | YES | — |
| 11 | effective_at | timestamptz | YES | — |
| 12 | notes | text | YES | — |
| 13 | created_at | timestamptz | NO | now() |
| 14 | updated_at | timestamptz | NO | now() |

**Checks:** `status IN ('planned','draft','live','retired')`; `pricing_model IN ('included','flat','per_team','per_seat','custom')`

---

### platform_admin_visits
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** global (platform-admin only)

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | actor_user_id | uuid | YES | — |
| 3 | actor_email | text | NO | — |
| 4 | path | text | NO | '/platform-admin' |
| 5 | visited_at | timestamptz | NO | now() |

---

### platform_audit_log
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** optional `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | actor_email | text | NO | — |
| 3 | org_id | uuid | YES | — |
| 4 | action | text | NO | — |
| 5 | field | text | YES | — |
| 6 | old_value | jsonb | YES | — |
| 7 | new_value | jsonb | YES | — |
| 8 | created_at | timestamptz | NO | now() |

**Foreign keys:** `org_id → organizations.id`

---

### platform_bulk_operations
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** global (platform-admin only)

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | action_type | text | NO | — |
| 3 | status | text | NO | 'completed' |
| 4 | target_count | int4 | NO | 0 |
| 5 | success_count | int4 | NO | 0 |
| 6 | failure_count | int4 | NO | 0 |
| 7 | reason | text | NO | — |
| 8 | parameters | jsonb | NO | '{}' |
| 9 | result_summary | jsonb | NO | '{}' |
| 10 | created_by_email | text | NO | — |
| 11 | created_at | timestamptz | NO | now() |
| 12 | completed_at | timestamptz | YES | — |

**Checks:** `status IN ('completed','partial_failed','failed')`; `action_type IN ('subscription_status_override','comp_period','plan_change','module_addon_enablement')`

---

### platform_catalog_campaigns
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** global (platform-admin only)

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | campaign_key | text | NO | — |
| 3 | title | text | NO | — |
| 4 | campaign_type | text | NO | — |
| 5 | status | text | NO | 'draft' |
| 6 | target_plan_ids | text[] | NO | '{}' |
| 7 | starts_at | timestamptz | YES | — |
| 8 | ends_at | timestamptz | YES | — |
| 9 | coupon_code | text | YES | — |
| 10 | discount_summary | text | YES | — |
| 11 | trial_days | int4 | YES | — |
| 12 | notes | text | YES | — |
| 13 | created_by_email | text | NO | — |
| 14 | updated_by_email | text | YES | — |
| 15 | created_at | timestamptz | NO | now() |
| 16 | updated_at | timestamptz | NO | now() |

**Checks:** `campaign_type IN ('coupon','promo','trial','launch','retention')`; `status IN ('draft','scheduled','active','paused','ended')`; `trial_days >= 0 OR NULL`

---

### platform_catalog_change_applications
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** global (platform-admin only)

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | change_request_id | uuid | NO | — |
| 3 | surface | text | NO | — |
| 4 | target_key | text | NO | — |
| 5 | actor_email | text | NO | — |
| 6 | applied_payload | jsonb | NO | '{}' |
| 7 | applied_at | timestamptz | NO | now() |

**Foreign keys:** `change_request_id → platform_catalog_change_requests.id`

**Checks:** `surface IN ('plan_gating','plan_config','stripe_price','feature_matrix')`

---

### platform_catalog_change_requests
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** global (platform-admin only)

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | request_type | text | NO | — |
| 3 | title | text | NO | — |
| 4 | description | text | YES | — |
| 5 | status | text | NO | 'draft' |
| 6 | priority | text | NO | 'medium' |
| 7 | target_plan_id | text | YES | — |
| 8 | target_addon_key | text | YES | — |
| 9 | target_version_id | uuid | YES | — |
| 10 | effective_at | timestamptz | YES | — |
| 11 | impact_summary | text | YES | — |
| 12 | proposal | jsonb | NO | '{}' |
| 13 | submitted_by_email | text | YES | — |
| 14 | submitted_at | timestamptz | YES | — |
| 15 | reviewed_by_email | text | YES | — |
| 16 | reviewed_at | timestamptz | YES | — |
| 17 | implementation_notes | text | YES | — |
| 18 | created_by_email | text | NO | — |
| 19 | updated_by_email | text | YES | — |
| 20 | created_at | timestamptz | NO | now() |
| 21 | updated_at | timestamptz | NO | now() |

**Foreign keys:** `target_version_id → platform_plan_versions.id`

**Checks:** `request_type IN ('plan_version','feature_matrix','addon','pricing','grandfathering','campaign','trial')`; `status IN ('draft','needs_review','approved','rejected','implemented','canceled')`; `priority IN ('low','medium','high','launch_blocker')`

---

### platform_events
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** optional `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | event_type | text | NO | — |
| 3 | source | text | NO | 'app' |
| 4 | source_event_id | text | YES | — |
| 5 | org_id | uuid | YES | — |
| 6 | actor_user_id | uuid | YES | — |
| 7 | actor_email | text | YES | — |
| 8 | previous_plan_id | text | YES | — |
| 9 | plan_id | text | YES | — |
| 10 | previous_subscription_status | text | YES | — |
| 11 | subscription_status | text | YES | — |
| 12 | metadata | jsonb | NO | '{}' |
| 13 | occurred_at | timestamptz | NO | now() |
| 14 | created_at | timestamptz | NO | now() |

**Foreign keys:** `org_id → organizations.id`

---

### platform_metric_snapshots
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** global (platform-admin only)

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | snapshot_date | date | NO | — |
| 3 | metrics | jsonb | NO | '{}' |
| 4 | source | text | NO | 'manual' |
| 5 | created_by_email | text | YES | — |
| 6 | created_at | timestamptz | NO | now() |

---

### platform_plan_module_entitlements
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** global (platform-admin only)

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | plan_id | text | NO | — |
| 2 | module_key | text | NO | — |
| 3 | included | bool | NO | false |
| 4 | updated_by_email | text | YES | — |
| 5 | updated_at | timestamptz | NO | now() |

**Note:** Composite PK (plan_id, module_key). Defines which modules are included in each plan.

**Checks:** `plan_id IN ('tournament','team','tournament_plus','league','club')`; `module_key IN ('module_tournaments','module_communications','module_members','module_public_site','module_house_league','module_accounting','module_rep_teams')`

---

### platform_plan_versions
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** global (platform-admin only)

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | version_key | text | NO | — |
| 3 | title | text | NO | — |
| 4 | description | text | YES | — |
| 5 | status | text | NO | 'draft' |
| 6 | effective_at | timestamptz | YES | — |
| 7 | published_at | timestamptz | YES | — |
| 8 | created_by_email | text | YES | — |
| 9 | snapshot | jsonb | NO | '{}' |
| 10 | notes | text | YES | — |
| 11 | created_at | timestamptz | NO | now() |
| 12 | updated_at | timestamptz | NO | now() |

**Checks:** `status IN ('draft','published','scheduled','archived')`

---

### platform_users
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** global (platform-admin only)

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | email | text | NO | — |
| 3 | display_name | text | YES | — |
| 4 | role | text | NO | 'support' |
| 5 | is_active | bool | NO | true |
| 6 | invited_by | text | YES | — |
| 7 | created_at | timestamptz | NO | now() |
| 8 | updated_at | timestamptz | NO | now() |

**Checks:** `role IN ('super_admin','support','billing','product','growth','read_only')`

---

### pool_slots
**Module:** Tournament | **RLS:** ENABLED | **Tenancy:** via `tournament_id → tournaments.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | pool_id | uuid | NO | — |
| 3 | tournament_id | uuid | NO | — |
| 4 | age_group_id | uuid | NO | — |
| 5 | slot_number | int4 | NO | — |
| 6 | display_name | text | NO | — |
| 7 | team_id | uuid | YES | — |
| 8 | created_at | timestamptz | YES | now() |

**Foreign keys:** `pool_id → pools.id`, `tournament_id → tournaments.id`, `age_group_id → age_groups.id`, `team_id → teams.id`

---

### pools
**Module:** Tournament | **RLS:** ENABLED | **Tenancy:** via `age_group_id → age_groups.tournament_id → tournaments.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | age_group_id | uuid | NO | — |
| 3 | name | text | NO | — |
| 4 | display_order | int4 | NO | 0 |
| 5 | created_at | timestamptz | NO | now() |

**Foreign keys:** `age_group_id → age_groups.id`

---

### rep_allocation_installments
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | split_id | uuid | NO | — |
| 3 | installment_number | int4 | NO | — |
| 4 | amount | numeric | NO | — |
| 5 | due_date | date | NO | — |
| 6 | paid_at | timestamptz | YES | — |
| 7 | paid_by | uuid | YES | — |
| 8 | accounting_entry_id | uuid | YES | — |
| 9 | created_at | timestamptz | NO | now() |
| 10 | reminder_sent_at | timestamptz | YES | — |
| 11 | org_id | uuid | NO | — |
| 12 | team_id | uuid | YES | — |

**Foreign keys:** `split_id → rep_allocation_splits.id`, `accounting_entry_id → accounting_entries.id`, `org_id → organizations.id`, `team_id → rep_teams.id`

**Checks:** `amount > 0`

---

### rep_allocation_splits
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | allocation_id | uuid | NO | — |
| 3 | team_id | uuid | NO | — |
| 4 | program_year_id | uuid | NO | — |
| 5 | org_id | uuid | NO | — |
| 6 | amount | numeric | NO | — |
| 7 | split_method | text | NO | — |
| 8 | split_value | numeric | NO | — |
| 9 | payment_schedule | text | NO | 'standard' |
| 10 | notes | text | YES | — |
| 11 | created_at | timestamptz | NO | now() |

**Foreign keys:** `allocation_id → rep_cost_allocations.id`, `team_id → rep_teams.id`, `program_year_id → rep_program_years.id`, `org_id → organizations.id`

**Checks:** `split_method IN ('percentage','sessions','fixed')`; `payment_schedule IN ('standard','custom')`; `amount > 0`

---

### rep_budget_lines
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | org_id | uuid | NO | — |
| 3 | team_id | uuid | NO | — |
| 4 | program_year_id | uuid | NO | — |
| 5 | category_id | uuid | YES | — |
| 6 | item_id | uuid | YES | — |
| 7 | description | text | NO | — |
| 8 | total_amount | numeric | NO | — |
| 9 | notes | text | YES | — |
| 10 | sort_order | int4 | NO | 0 |
| 11 | created_at | timestamptz | NO | now() |
| 12 | updated_at | timestamptz | NO | now() |

**Foreign keys:** `org_id → organizations.id`, `team_id → rep_teams.id`, `program_year_id → rep_program_years.id`, `category_id → budget_categories.id`, `item_id → budget_items.id`

**Checks:** `total_amount > 0`

---

### rep_budget_periods
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** via `budget_line_id → rep_budget_lines.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | budget_line_id | uuid | NO | — |
| 3 | period_label | text | NO | — |
| 4 | period_date | date | YES | — |
| 5 | amount | numeric | NO | — |
| 6 | sort_order | int4 | NO | 0 |
| 7 | created_at | timestamptz | NO | now() |

**Foreign keys:** `budget_line_id → rep_budget_lines.id`

**Checks:** `amount > 0`

---

### rep_cost_allocations
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | org_id | uuid | NO | — |
| 3 | source_entry_id | uuid | YES | — |
| 4 | description | text | NO | — |
| 5 | total_amount | numeric | NO | — |
| 6 | created_by | uuid | YES | — |
| 7 | created_at | timestamptz | NO | now() |
| 8 | source_budget_line_id | uuid | YES | — |

**Foreign keys:** `org_id → organizations.id`, `source_entry_id → accounting_entries.id`, `source_budget_line_id → org_budget_lines.id`

**Checks:** `total_amount > 0`

---

### rep_document_templates
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | org_id | uuid | NO | — |
| 3 | team_id | uuid | YES | — |
| 4 | name | text | NO | — |
| 5 | document_type | text | NO | — |
| 6 | storage_path | text | NO | — |
| 7 | file_name | text | NO | — |
| 8 | file_size | int8 | NO | — |
| 9 | is_active | bool | NO | true |
| 10 | published_by | uuid | YES | — |
| 11 | created_at | timestamptz | NO | now() |

**Foreign keys:** `org_id → organizations.id`, `team_id → rep_teams.id`

**Checks:** `document_type IN ('waiver','medical_consent','code_of_conduct','other')`

---

### rep_dues_credits
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** via `program_year_id → rep_program_years.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | program_year_id | uuid | NO | — |
| 3 | player_id | uuid | NO | — |
| 4 | amount | numeric | NO | — |
| 5 | description | text | NO | — |
| 6 | credit_date | date | NO | CURRENT_DATE |
| 7 | credit_type | text | NO | 'contribution' |
| 8 | notes | text | YES | — |
| 9 | created_by | uuid | YES | — |
| 10 | created_at | timestamptz | YES | now() |
| 11 | fundraiser_entry_id | uuid | YES | — |

**Foreign keys:** `program_year_id → rep_program_years.id`, `player_id → rep_roster_players.id`, `fundraiser_entry_id → rep_fundraiser_entries.id`

**Checks:** `amount > 0`; `credit_type IN ('contribution','fundraiser','overpayment','other')`

---

### rep_fundraiser_entries
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | fundraiser_id | uuid | NO | — |
| 3 | org_id | uuid | NO | — |
| 4 | team_id | uuid | NO | — |
| 5 | player_id | uuid | NO | — |
| 6 | amount_raised | numeric | NO | — |
| 7 | rebate_percent | numeric | NO | 0 |
| 8 | rebate_amount | numeric | NO | 0 |
| 9 | accounting_entry_id | uuid | YES | — |
| 10 | credit_id | uuid | YES | — |
| 11 | notes | text | YES | — |
| 12 | created_at | timestamptz | NO | now() |
| 13 | updated_at | timestamptz | NO | now() |

**Foreign keys:** `fundraiser_id → rep_fundraisers.id`, `org_id → organizations.id`, `team_id → rep_teams.id`, `player_id → rep_roster_players.id`, `accounting_entry_id → accounting_entries.id`, `credit_id → rep_dues_credits.id` (constraint: `fk_fundraiser_entry_credit`)

**Checks:** `amount_raised >= 0`

---

### rep_fundraisers
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | org_id | uuid | NO | — |
| 3 | team_id | uuid | NO | — |
| 4 | program_year_id | uuid | NO | — |
| 5 | name | text | NO | — |
| 6 | description | text | YES | — |
| 7 | player_rebate_percent | numeric | NO | 0 |
| 8 | start_date | date | YES | — |
| 9 | end_date | date | YES | — |
| 10 | is_active | bool | NO | true |
| 11 | created_at | timestamptz | NO | now() |
| 12 | updated_at | timestamptz | NO | now() |

**Foreign keys:** `org_id → organizations.id`, `team_id → rep_teams.id`, `program_year_id → rep_program_years.id`

**Checks:** `player_rebate_percent >= 0 AND player_rebate_percent <= 100`

---

### rep_player_documents
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | player_id | uuid | NO | — |
| 3 | team_id | uuid | NO | — |
| 4 | org_id | uuid | NO | — |
| 5 | document_type | text | NO | — |
| 6 | storage_path | text | NO | — |
| 7 | file_name | text | NO | — |
| 8 | file_size | int8 | NO | — |
| 9 | template_id | uuid | YES | — |
| 10 | uploaded_by | uuid | YES | — |
| 11 | created_at | timestamptz | NO | now() |

**Foreign keys:** `player_id → rep_roster_players.id`, `team_id → rep_teams.id`, `org_id → organizations.id`, `template_id → rep_document_templates.id`

**Checks:** `document_type IN ('waiver','medical_consent','code_of_conduct','other')`

---

### rep_player_dues_installments
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | schedule_id | uuid | NO | — |
| 3 | player_id | uuid | NO | — |
| 4 | installment_number | int4 | NO | — |
| 5 | amount | numeric | NO | — |
| 6 | due_date | date | NO | — |
| 7 | paid_at | timestamptz | YES | — |
| 8 | reminder_sent_at | timestamptz | YES | — |
| 9 | accounting_entry_id | uuid | YES | — |
| 10 | created_at | timestamptz | NO | now() |
| 11 | source | text | NO | 'manual' |
| 12 | reminder_30_sent_at | timestamptz | YES | — |
| 13 | reminder_7_sent_at | timestamptz | YES | — |
| 14 | org_id | uuid | NO | — |
| 15 | team_id | uuid | YES | — |

**Foreign keys:** `schedule_id → rep_player_dues_schedules.id`, `player_id → rep_roster_players.id`, `accounting_entry_id → accounting_entries.id`, `org_id → organizations.id`, `team_id → rep_teams.id`

**Checks:** `source IN ('manual','budget_generated')`; `amount > 0`

---

### rep_player_dues_schedules
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | program_year_id | uuid | NO | — |
| 3 | player_id | uuid | NO | — |
| 4 | team_id | uuid | NO | — |
| 5 | org_id | uuid | NO | — |
| 6 | total_amount | numeric | NO | — |
| 7 | notes | text | YES | — |
| 8 | created_at | timestamptz | NO | now() |
| 9 | updated_at | timestamptz | NO | now() |
| 10 | budget_line_id | uuid | YES | — |

**Foreign keys:** `program_year_id → rep_program_years.id`, `player_id → rep_roster_players.id`, `team_id → rep_teams.id`, `org_id → organizations.id`, `budget_line_id → rep_budget_lines.id`

**Checks:** `total_amount > 0`

---

### rep_program_years
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | team_id | uuid | NO | — |
| 3 | org_id | uuid | NO | — |
| 4 | name | text | NO | — |
| 5 | year | int4 | NO | — |
| 6 | status | text | NO | 'draft' |
| 7 | tryout_open | bool | NO | false |
| 8 | tryout_description | text | YES | — |
| 9 | budget_amount | numeric | YES | — |
| 10 | created_at | timestamptz | NO | now() |
| 11 | updated_at | timestamptz | NO | now() |
| 12 | auto_reminders_enabled | bool | NO | true |

**Foreign keys:** `team_id → rep_teams.id`, `org_id → organizations.id`

**Checks:** `status IN ('draft','active','completed','archived')`

---

### rep_roster_players
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | program_year_id | uuid | NO | — |
| 3 | team_id | uuid | NO | — |
| 4 | org_id | uuid | NO | — |
| 5 | player_first_name | text | NO | — |
| 6 | player_last_name | text | NO | — |
| 7 | player_date_of_birth | date | YES | — |
| 8 | player_number | text | YES | — |
| 9 | guardian_first_name | text | NO | — |
| 10 | guardian_last_name | text | NO | — |
| 11 | guardian_email | text | NO | — |
| 12 | guardian_phone | text | YES | — |
| 13 | status | text | NO | 'active' |
| 14 | source | text | NO | 'admin_manual' |
| 15 | tryout_registration_id | uuid | YES | — |
| 16 | notes | text | YES | — |
| 17 | admin_notes | text | YES | — |
| 18 | created_at | timestamptz | NO | now() |
| 19 | updated_at | timestamptz | NO | now() |
| 20 | primary_position | text | YES | — |
| 21 | secondary_position | text | YES | — |

**Foreign keys:** `program_year_id → rep_program_years.id`, `team_id → rep_teams.id`, `org_id → organizations.id`, `tryout_registration_id → rep_tryout_registrations.id`

**Checks:** `status IN ('active','inactive')`; `source IN ('tryout','admin_manual')`

---

### rep_season_surplus
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** via `program_year_id → rep_program_years.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | program_year_id | uuid | NO | — |
| 3 | total_surplus | numeric | NO | 0 |
| 4 | notes | text | YES | — |
| 5 | created_by | uuid | YES | — |
| 6 | created_at | timestamptz | YES | now() |
| 7 | updated_at | timestamptz | YES | now() |

**Foreign keys:** `program_year_id → rep_program_years.id`

**Checks:** `total_surplus >= 0`

---

### rep_team_coaches
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | program_year_id | uuid | NO | — |
| 3 | team_id | uuid | NO | — |
| 4 | org_id | uuid | NO | — |
| 5 | user_id | uuid | NO | — |
| 6 | coach_role | text | NO | 'head_coach' |
| 7 | created_at | timestamptz | NO | now() |

**Foreign keys:** `program_year_id → rep_program_years.id`, `team_id → rep_teams.id`, `org_id → organizations.id`

**Checks:** `coach_role IN ('head_coach','assistant_coach')`

---

### rep_team_event_attendance
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | event_id | uuid | NO | — |
| 3 | player_id | uuid | NO | — |
| 4 | program_year_id | uuid | NO | — |
| 5 | team_id | uuid | NO | — |
| 6 | org_id | uuid | NO | — |
| 7 | status | text | NO | 'unknown' |
| 8 | note | text | YES | — |
| 9 | updated_by | uuid | YES | — |
| 10 | created_at | timestamptz | NO | now() |
| 11 | updated_at | timestamptz | NO | now() |

**Foreign keys:** `event_id → rep_team_events.id`, `player_id → rep_roster_players.id`, `program_year_id → rep_program_years.id`, `team_id → rep_teams.id`, `org_id → organizations.id`

**Checks:** `status IN ('unknown','attending','absent','late')`

---

### rep_team_events
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | program_year_id | uuid | NO | — |
| 3 | team_id | uuid | NO | — |
| 4 | org_id | uuid | NO | — |
| 5 | event_type | text | NO | — |
| 6 | name | text | NO | — |
| 7 | description | text | YES | — |
| 8 | starts_at | timestamptz | NO | — |
| 9 | ends_at | timestamptz | YES | — |
| 10 | location | text | YES | — |
| 11 | opponent | text | YES | — |
| 12 | home_away | text | YES | — |
| 13 | home_score | int4 | YES | — |
| 14 | away_score | int4 | YES | — |
| 15 | result | text | YES | — |
| 16 | parent_event_id | uuid | YES | — |
| 17 | is_recurring | bool | NO | false |
| 18 | recurrence_rule | jsonb | YES | — |
| 19 | recurrence_parent_id | uuid | YES | — |
| 20 | created_at | timestamptz | NO | now() |
| 21 | updated_at | timestamptz | NO | now() |

**Foreign keys:** `program_year_id → rep_program_years.id`, `team_id → rep_teams.id`, `org_id → organizations.id`, `parent_event_id → rep_team_events.id` (self), `recurrence_parent_id → rep_team_events.id` (self)

**Checks:** `event_type IN ('external_tournament','tournament_game','scrimmage','league_game','practice','team_event')`; `result IN ('win','loss','tie') OR NULL`; `home_away IN ('home','away','neutral') OR NULL`

---

### rep_team_expenses
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | program_year_id | uuid | NO | — |
| 3 | team_id | uuid | NO | — |
| 4 | org_id | uuid | NO | — |
| 5 | expense_type | text | NO | — |
| 6 | description | text | NO | — |
| 7 | category | text | YES | — |
| 8 | amount | numeric | NO | — |
| 9 | expense_paid_at | timestamptz | YES | — |
| 10 | deposit_amount | numeric | YES | — |
| 11 | deposit_due_date | date | YES | — |
| 12 | deposit_paid_at | timestamptz | YES | — |
| 13 | balance_amount | numeric | YES | — |
| 14 | balance_due_date | date | YES | — |
| 15 | balance_paid_at | timestamptz | YES | — |
| 16 | event_id | uuid | YES | — |
| 17 | accounting_entry_id | uuid | YES | — |
| 18 | created_by | uuid | YES | — |
| 19 | created_at | timestamptz | NO | now() |
| 20 | updated_at | timestamptz | NO | now() |
| 21 | payment_method | text | YES | — |
| 22 | payee_id | uuid | YES | — |
| 23 | payee_payer | text | YES | — |

**Foreign keys:** `program_year_id → rep_program_years.id`, `team_id → rep_teams.id`, `org_id → organizations.id`, `event_id → rep_team_events.id`, `accounting_entry_id → accounting_entries.id`, `payee_id → org_payees.id`

**Checks:** `expense_type IN ('expense','tournament_payable')`; `amount > 0`

---

### rep_team_groups
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | org_id | uuid | NO | — |
| 3 | name | text | NO | — |
| 4 | display_order | int4 | NO | 0 |
| 5 | created_at | timestamptz | NO | now() |

**Foreign keys:** `org_id → organizations.id`

**Checks:** `char_length(TRIM(name)) > 0 AND char_length(name) <= 50`

---

### rep_team_lineup_entries
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** via `lineup_id → rep_team_lineups.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | lineup_id | uuid | NO | — |
| 3 | player_id | uuid | NO | — |
| 4 | batting_order | int4 | YES | — |
| 5 | starter | bool | NO | true |
| 6 | inning_positions | jsonb | NO | '{}' |
| 7 | notes | text | YES | — |
| 8 | created_at | timestamptz | NO | now() |
| 9 | updated_at | timestamptz | NO | now() |

**Foreign keys:** `lineup_id → rep_team_lineups.id`, `player_id → rep_roster_players.id`

**Checks:** `batting_order > 0 OR NULL`

---

### rep_team_lineups
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | event_id | uuid | NO | — |
| 3 | program_year_id | uuid | NO | — |
| 4 | team_id | uuid | NO | — |
| 5 | org_id | uuid | NO | — |
| 6 | lineup_mode | text | NO | 'everyone_bats' |
| 7 | inning_count | int4 | NO | 7 |
| 8 | notes | text | YES | — |
| 9 | updated_by | uuid | YES | — |
| 10 | created_at | timestamptz | NO | now() |
| 11 | updated_at | timestamptz | NO | now() |

**Foreign keys:** `event_id → rep_team_events.id`, `program_year_id → rep_program_years.id`, `team_id → rep_teams.id`, `org_id → organizations.id`

**Checks:** `lineup_mode IN ('nine_player','everyone_bats')`; `inning_count >= 1 AND inning_count <= 12`

---

### rep_team_payment_requests
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | org_id | uuid | NO | — |
| 3 | team_id | uuid | NO | — |
| 4 | request_type | text | NO | — |
| 5 | amount | numeric | NO | — |
| 6 | description | text | NO | — |
| 7 | payment_method | text | YES | — |
| 8 | notes | text | YES | — |
| 9 | status | text | NO | 'pending' |
| 10 | denial_reason | text | YES | — |
| 11 | budget_line_id | uuid | YES | — |
| 12 | accounting_entry_id | uuid | YES | — |
| 13 | created_by | uuid | NO | — |
| 14 | reviewed_by | uuid | YES | — |
| 15 | reviewed_at | timestamptz | YES | — |
| 16 | created_at | timestamptz | NO | now() |
| 17 | updated_at | timestamptz | NO | now() |

**Foreign keys:** `org_id → organizations.id`, `team_id → rep_teams.id`, `budget_line_id → org_budget_lines.id`, `accounting_entry_id → accounting_entries.id`

**Checks:** `request_type IN ('payment_to_org','charge_to_org')`; `status IN ('pending','approved','denied')`; `amount > 0`

---

### rep_teams
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | org_id | uuid | NO | — |
| 3 | name | text | NO | — |
| 4 | slug | text | NO | — |
| 5 | sport | text | NO | 'softball' |
| 6 | age_group | text | YES | — |
| 7 | description | text | YES | — |
| 8 | color | text | YES | — |
| 9 | is_archived | bool | NO | false |
| 10 | created_at | timestamptz | NO | now() |
| 11 | updated_at | timestamptz | NO | now() |
| 12 | group_id | uuid | YES | — |

**Foreign keys:** `org_id → organizations.id`, `group_id → rep_team_groups.id`

---

### rep_tryout_registrations
**Module:** Rep Teams | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | program_year_id | uuid | NO | — |
| 3 | team_id | uuid | NO | — |
| 4 | org_id | uuid | NO | — |
| 5 | player_first_name | text | NO | — |
| 6 | player_last_name | text | NO | — |
| 7 | player_date_of_birth | date | YES | — |
| 8 | player_notes | text | YES | — |
| 9 | guardian_first_name | text | NO | — |
| 10 | guardian_last_name | text | NO | — |
| 11 | guardian_email | text | NO | — |
| 12 | guardian_phone | text | YES | — |
| 13 | status | text | NO | 'pending_review' |
| 14 | admin_notes | text | YES | — |
| 15 | submitted_at | timestamptz | NO | now() |
| 16 | updated_at | timestamptz | NO | now() |

**Foreign keys:** `program_year_id → rep_program_years.id`, `team_id → rep_teams.id`, `org_id → organizations.id`

**Checks:** `status IN ('pending_review','offered','accepted','declined','withdrawn')`

---

### resources
**Module:** Tournament | **RLS:** ENABLED | **Tenancy:** via `tournament_id → tournaments.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | tournament_id | uuid | YES | — |
| 3 | label | text | NO | — |
| 4 | url | text | NO | — |
| 5 | display_order | int4 | NO | 0 |

**Foreign keys:** `tournament_id → tournaments.id`

---

### rule_items
**Module:** Tournament | **RLS:** ENABLED | **Tenancy:** via `rule_id → rules.tournament_id → tournaments.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | rule_id | uuid | NO | — |
| 3 | content | text | NO | — |
| 4 | display_order | int4 | NO | 0 |

**Foreign keys:** `rule_id → rules.id`

---

### rules
**Module:** Tournament | **RLS:** ENABLED | **Tenancy:** via `tournament_id → tournaments.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | tournament_id | uuid | YES | — |
| 3 | title | text | NO | — |
| 4 | display_order | int4 | NO | 0 |
| 5 | icon | text | YES | — |
| 6 | age_group_ids | uuid[] | YES | — |

**Foreign keys:** `tournament_id → tournaments.id`

---

### stripe_prices
**Module:** Platform/Org Core | **RLS:** ENABLED | **Tenancy:** global (platform-admin only)

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | plan_id | text | NO | — |
| 3 | billing_cycle | text | NO | — |
| 4 | environment | text | NO | — |
| 5 | price_id | text | YES | — |
| 6 | product_name | text | YES | — |
| 7 | created_at | timestamptz | NO | now() |
| 8 | updated_at | timestamptz | NO | now() |
| 9 | last_change_note | text | YES | — |
| 10 | updated_by_email | text | YES | — |

**Checks:** `billing_cycle IN ('monthly','annual')`; `environment IN ('sandbox','live')`

---

### team_entitlements
**Module:** Standalone Team Workspace | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | team_workspace_id | uuid | YES | — |
| 3 | org_id | uuid | NO | — |
| 4 | rep_team_id | uuid | NO | — |
| 5 | source | text | NO | — |
| 6 | status | text | NO | 'active' |
| 7 | starts_at | timestamptz | NO | now() |
| 8 | ends_at | timestamptz | YES | — |
| 9 | stripe_subscription_item_id | text | YES | — |
| 10 | created_at | timestamptz | NO | now() |
| 11 | updated_at | timestamptz | NO | now() |

**Foreign keys:** `team_workspace_id → team_workspaces.id`, `org_id → organizations.id`, `rep_team_id → rep_teams.id`

**Checks:** `source IN ('team_plan','org_team_addon','club_included','club_extra_team','platform_override')`; `status IN ('active','trialing','past_due','cancelled','canceled','expired')`

---

### team_org_links
**Module:** Standalone Team Workspace | **RLS:** ENABLED | **Tenancy:** via `linked_org_id` or `team_workspace_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | team_workspace_id | uuid | NO | — |
| 3 | rep_team_id | uuid | NO | — |
| 4 | linked_org_id | uuid | NO | — |
| 5 | status | text | NO | 'requested' |
| 6 | link_type | text | NO | 'visibility' |
| 7 | sharing_level | text | NO | 'basic' |
| 8 | requested_by_user_id | uuid | YES | — |
| 9 | approved_by_team_user_id | uuid | YES | — |
| 10 | approved_by_org_user_id | uuid | YES | — |
| 11 | billing_mode_after_approval | text | YES | — |
| 12 | created_at | timestamptz | NO | now() |
| 13 | updated_at | timestamptz | NO | now() |

**Foreign keys:** `team_workspace_id → team_workspaces.id`, `rep_team_id → rep_teams.id`, `linked_org_id → organizations.id`

**Checks:** `link_type IN ('visibility','billing','ownership')`; `status IN ('requested','invited','linked','ownership_pending','org_owned','declined','revoked')`; `sharing_level IN ('basic','roster_summary','financial_summary','full_org_owned')`

---

### team_workspace_claims
**Module:** Standalone Team Workspace | **RLS:** ENABLED | **Tenancy:** via `tournament_id → tournaments.org_id` (pre-claim) or `team_workspace_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | tournament_id | uuid | NO | — |
| 3 | tournament_team_id | uuid | YES | — |
| 4 | contact_email | text | NO | — |
| 5 | claim_token_hash | text | NO | — |
| 6 | status | text | NO | 'available' |
| 7 | team_workspace_id | uuid | YES | — |
| 8 | claimed_by_user_id | uuid | YES | — |
| 9 | expires_at | timestamptz | YES | — |
| 10 | created_at | timestamptz | NO | now() |
| 11 | claimed_at | timestamptz | YES | — |

**Foreign keys:** `tournament_id → tournaments.id`, `team_workspace_id → team_workspaces.id`

**Checks:** `status IN ('available','claimed','expired','revoked')`

---

### team_workspaces
**Module:** Standalone Team Workspace | **RLS:** ENABLED | **Tenancy:** via `workspace_org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | workspace_org_id | uuid | NO | — |
| 3 | rep_team_id | uuid | NO | — |
| 4 | active_program_year_id | uuid | YES | — |
| 5 | primary_owner_user_id | uuid | YES | — |
| 6 | source | text | NO | 'direct_signup' |
| 7 | source_tournament_id | uuid | YES | — |
| 8 | source_tournament_team_id | uuid | YES | — |
| 9 | workspace_state | text | NO | 'independent' |
| 10 | billing_mode | text | NO | 'team_direct' |
| 11 | billing_owner_org_id | uuid | YES | — |
| 12 | billing_owner_user_id | uuid | YES | — |
| 13 | stripe_customer_id | text | YES | — |
| 14 | stripe_subscription_id | text | YES | — |
| 15 | subscription_status | text | NO | 'active' |
| 16 | current_period_end | timestamptz | YES | — |
| 17 | created_at | timestamptz | NO | now() |
| 18 | updated_at | timestamptz | NO | now() |

**Foreign keys:** `workspace_org_id → organizations.id`, `rep_team_id → rep_teams.id`, `active_program_year_id → rep_program_years.id`, `billing_owner_org_id → organizations.id`, `source_tournament_id → tournaments.id`

**Checks:** `workspace_state IN ('independent','linked','org_owned','archived')`; `billing_mode IN ('team_direct','org_team_addon','club_included','club_extra_team','platform_override')`; `source IN ('direct_signup','tournament_claim','org_invite','platform_admin')`; `subscription_status IN ('active','trialing','past_due','canceled','incomplete','unpaid')`

---

### teams
**Module:** Tournament | **RLS:** ENABLED | **Tenancy:** via `tournament_id → tournaments.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | tournament_id | uuid | YES | — |
| 3 | age_group_id | uuid | YES | — |
| 4 | name | text | NO | — |
| 5 | coach | text | YES | — |
| 6 | email | text | YES | — |
| 7 | players | jsonb | NO | '[]' |
| 8 | status | text | NO | 'accepted' |
| 9 | payment_status | text | NO | 'paid' |
| 10 | registered_at | timestamptz | NO | now() |
| 11 | admin_notes | text | YES | — |
| 12 | pool_id | uuid | YES | — |
| 13 | deposit_paid | numeric | NO | 0 |
| 14 | total_paid | numeric | NO | 0 |
| 15 | waitlist_position | int4 | YES | — |
| 16 | slot_id | uuid | YES | — |

**Foreign keys:** `tournament_id → tournaments.id`, `age_group_id → age_groups.id`, `pool_id → pools.id`, `slot_id → pool_slots.id`

---

### tournament_archives
**Module:** Tournament | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | tournament_id | uuid | YES | — |
| 3 | org_id | uuid | NO | — |
| 4 | tournament_name | text | NO | — |
| 5 | season | text | NO | — |
| 6 | division | text | YES | — |
| 7 | final_snapshot | jsonb | NO | — |
| 8 | winner_team_id | uuid | YES | — |
| 9 | winner_team_name | text | YES | — |
| 10 | runner_up_name | text | YES | — |
| 11 | total_teams | int4 | YES | — |
| 12 | total_games | int4 | YES | — |
| 13 | integrity_hash | text | NO | — |
| 14 | sealed_at | timestamptz | NO | now() |
| 15 | sealed_by | uuid | YES | — |

**Foreign keys:** `org_id → organizations.id`, `tournament_id → tournaments.id`, `winner_team_id → teams.id`

---

### tournament_registration_field_answers
**Module:** Tournament | **RLS:** ENABLED | **Tenancy:** via `registration_id → teams.tournament_id → tournaments.org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | registration_id | uuid | NO | — |
| 3 | field_id | uuid | NO | — |
| 4 | value_text | text | YES | — |
| 5 | value_json | jsonb | YES | — |
| 6 | file_url | text | YES | — |
| 7 | created_at | timestamptz | NO | now() |

**Foreign keys:** `registration_id → teams.id`, `field_id → tournament_registration_fields.id`

---

### tournament_registration_fields
**Module:** Tournament | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | tournament_id | uuid | NO | — |
| 3 | org_id | uuid | NO | — |
| 4 | label | text | NO | — |
| 5 | field_type | text | NO | — |
| 6 | options | jsonb | NO | '[]' |
| 7 | required | bool | NO | false |
| 8 | sort_order | int4 | NO | 0 |
| 9 | is_archived | bool | NO | false |
| 10 | created_at | timestamptz | NO | now() |
| 11 | updated_at | timestamptz | NO | now() |

**Foreign keys:** `tournament_id → tournaments.id`, `org_id → organizations.id`

**Checks:** `field_type IN ('short_text','long_text','dropdown','checkbox','file')`

---

### tournaments
**Module:** Tournament | **RLS:** ENABLED | **Tenancy:** direct `org_id`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | year | int4 | NO | — |
| 3 | name | text | NO | — |
| 4 | slug | text | YES | — |
| 5 | status | text | NO | 'draft' |
| 6 | is_active | bool | NO | false |
| 7 | start_date | date | YES | — |
| 8 | end_date | date | YES | — |
| 9 | contact_email | text | YES | — |
| 11 | fee_schedule_mode | text | NO | 'tournament' |
| 12 | deposit_amount | numeric | YES | — |
| 13 | deposit_due_date | date | YES | — |
| 14 | total_fee_amount | numeric | YES | — |
| 15 | total_fee_due_date | date | YES | — |
| 16 | logo_url | text | YES | — |
| 17 | hero_banner_url | text | YES | — |
| 18 | theme_preset | text | YES | — |
| 19 | theme_primary | text | YES | — |
| 20 | theme_accent | text | YES | — |
| 21 | theme_font | text | YES | — |
| 22 | theme_card_style | text | YES | — |
| 23 | require_score_finalization | bool | YES | — |
| 24 | color_mode | text | YES | — |
| 25 | created_at | timestamptz | NO | now() |
| 26 | notify_teams_on_complete | bool | NO | false |
| 27 | results_notified_at | timestamptz | YES | — |
| 28 | results_notification_sent_count | int4 | NO | 0 |
| 29 | org_id | uuid | NO | — |

**Foreign keys:** `org_id → organizations.id`

**Note:** No `pos=10` column — ordinal position 10 was dropped/skipped in migration history.
