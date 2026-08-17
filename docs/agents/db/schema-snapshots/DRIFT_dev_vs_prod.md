# Dev vs Prod — structural drift

**Generated:** 2026-08-17 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 244 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 3 | 0 | — |
| Columns | 45 | 0 | 1 |
| Indexes | 158 | 1 | 0 |
| Constraints | 27 | 0 | — |
| RLS / CHECK | 9 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (3)
- `rep_team_fundraiser_tags`
- `rep_team_money_in`
- `rep_team_staff_memberships`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (45)
- `budget_categories.sports`
- `budget_items.direction`
- `budget_items.sports`
- `budget_items.team_id`
- `rep_allocation_splits.budget_category_id`
- `rep_allocation_splits.budget_item_id`
- `rep_fundraisers.kind`
- `rep_fundraisers.sponsor_status`
- `rep_program_years.default_player_credit_percent`
- `rep_team_expenses.balance_entry_id`
- `rep_team_expenses.budget_category_id`
- `rep_team_expenses.budget_item_id`
- `rep_team_expenses.deposit_entry_id`
- `rep_team_fundraiser_tags.created_at`
- `rep_team_fundraiser_tags.fundraiser_id`
- `rep_team_fundraiser_tags.tag_id`
- `rep_team_money_in.accounting_entry_id`
- `rep_team_money_in.amount`
- `rep_team_money_in.budget_category_id`
- `rep_team_money_in.budget_item_id`
- `rep_team_money_in.created_at`
- `rep_team_money_in.created_by`
- `rep_team_money_in.description`
- `rep_team_money_in.entry_kind`
- `rep_team_money_in.id`
- `rep_team_money_in.notes`
- `rep_team_money_in.org_id`
- `rep_team_money_in.program_year_id`
- `rep_team_money_in.received_date`
- `rep_team_money_in.received_from`
- `rep_team_money_in.team_id`
- `rep_team_money_in.updated_at`
- `rep_team_payment_requests.budget_category_id`
- `rep_team_payment_requests.budget_item_id`
- `rep_team_payment_requests.program_year_id`
- `rep_team_staff_memberships.capabilities`
- `rep_team_staff_memberships.coach_role`
- `rep_team_staff_memberships.created_at`
- `rep_team_staff_memberships.id`
- `rep_team_staff_memberships.org_id`
- `rep_team_staff_memberships.revoked_at`
- `rep_team_staff_memberships.revoked_by`
- `rep_team_staff_memberships.status`
- `rep_team_staff_memberships.team_id`
- `rep_team_staff_memberships.user_id`

### Only in PROD (0)
_none_

### Type/nullability/default changed (1)
- `rep_fundraiser_entries.player_id` — dev: `uuid|uuid|YES|` | prod: `uuid|uuid|NO|`

## Indexes
### Only in DEV (158)
- `accounting_entries_linked_entry_id_idx`
- `accounting_entries_payee_id_idx`
- `announcements_tournament_id_idx`
- `assistant_invite_tokens_org_id_idx`
- `assistant_invite_tokens_program_year_id_idx`
- `billing_retained_records_intent_id_idx`
- `budget_items_team_idx`
- `budget_items_unique_scope_side_name`
- `diamonds_source_org_venue_id_idx`
- `diamonds_tournament_id_idx`
- `divisions_contact_member_id_idx`
- `divisions_tournament_id_idx`
- `early_access_leads_converted_org_id_idx`
- `family_links_player_id_idx`
- `family_recap_views_org_id_idx`
- `fan_push_subscriptions_team_id_idx`
- `game_change_notices_game_id_idx`
- `game_change_notices_org_id_idx`
- `game_change_notices_team_id_idx`
- `game_change_notices_tournament_id_idx`
- `games_away_team_id_idx`
- `games_diamond_id_idx`
- `games_division_id_idx`
- `games_home_team_id_idx`
- `games_tournament_id_idx`
- `idx_rep_team_expenses_balance_entry`
- `idx_rep_team_expenses_budget_item`
- `idx_rep_team_expenses_deposit_entry`
- `idx_rep_team_money_in_item`
- `idx_rep_team_money_in_year`
- `league_divisions_season_id_idx`
- `league_email_log_org_id_idx`
- `league_email_log_season_id_idx`
- `league_games_away_team_id_idx`
- `league_games_home_team_id_idx`
- `league_notification_log_season_id_idx`
- `league_practices_division_id_idx`
- `league_registrations_team_id_idx`
- `league_teams_division_id_idx`
- `league_teams_season_id_idx`
- `notification_preferences_org_id_idx`
- `org_budget_lines_category_id_idx`
- `org_budget_lines_item_id_idx`
- `org_internal_notes_org_id_idx`
- `org_member_rep_group_scopes_group_id_idx`
- `platform_catalog_change_requests_target_version_id_idx`
- `pool_slots_division_id_idx`
- `pools_division_id_idx`
- `rep_allocation_installments_accounting_entry_id_idx`
- `rep_allocation_splits_budget_category_idx`
- `rep_allocation_splits_budget_item_idx`
- `rep_allocation_splits_org_id_idx`
- `rep_allocation_splits_program_year_id_idx`
- `rep_budget_lines_category_id_idx`
- `rep_budget_lines_item_id_idx`
- `rep_budget_lines_org_id_idx`
- `rep_budget_lines_program_year_id_idx`
- `rep_cost_allocations_org_id_idx`
- `rep_cost_allocations_source_entry_id_idx`
- `rep_document_templates_team_id_idx`
- `rep_dues_credits_expense_id_idx`
- `rep_dues_credits_fundraiser_entry_id_idx`
- `rep_dues_credits_payment_id_idx`
- `rep_dues_credits_player_id_idx`
- `rep_dues_credits_program_year_id_idx`
- `rep_dues_payments_accounting_entry_id_idx`
- `rep_dues_payments_org_id_idx`
- `rep_dues_payments_player_id_idx`
- `rep_dues_payments_team_id_idx`
- `rep_dues_payouts_accounting_entry_id_idx`
- `rep_dues_payouts_org_id_idx`
- `rep_dues_payouts_player_id_idx`
- `rep_dues_payouts_team_id_idx`
- `rep_fundraiser_entries_accounting_entry_id_idx`
- `rep_fundraiser_entries_credit_id_idx`
- `rep_fundraiser_entries_org_id_idx`
- `rep_fundraiser_entries_team_id_idx`
- `rep_fundraisers_org_id_idx`
- `rep_fundraisers_program_year_id_idx`
- `rep_player_documents_org_id_idx`
- `rep_player_documents_template_id_idx`
- `rep_player_dues_installments_accounting_entry_id_idx`
- `rep_player_dues_installments_player_id_idx`
- `rep_player_dues_schedules_budget_line_id_idx`
- `rep_player_dues_schedules_org_id_idx`
- `rep_player_dues_schedules_player_id_idx`
- `rep_player_dues_schedules_team_id_idx`
- `rep_player_tryout_baselines_org_id_idx`
- `rep_player_tryout_baselines_tryout_registration_id_idx`
- `rep_program_years_org_id_idx`
- `rep_roster_players_org_id_idx`
- `rep_roster_players_team_id_idx`
- `rep_roster_players_tryout_registration_id_idx`
- `rep_season_refund_adjustments_org_id_idx`
- `rep_season_refund_adjustments_player_id_idx`
- `rep_season_refund_adjustments_team_id_idx`
- `rep_team_announcements_org_id_idx`
- `rep_team_announcements_team_id_idx`
- `rep_team_coaches_team_id_idx`
- `rep_team_event_attendance_org_id_idx`
- `rep_team_event_attendance_program_year_id_idx`
- `rep_team_events_org_id_idx`
- `rep_team_events_recurrence_parent_id_idx`
- `rep_team_events_team_id_idx`
- `rep_team_expenses_accounting_entry_id_idx`
- `rep_team_expenses_budget_category_id_idx`
- `rep_team_expenses_event_id_idx`
- `rep_team_expenses_org_id_idx`
- `rep_team_expenses_paid_by_player_id_idx`
- `rep_team_expenses_payee_id_idx`
- `rep_team_expenses_team_id_idx`
- `rep_team_fundraiser_tags_pkey`
- `rep_team_fundraiser_tags_tag_idx`
- `rep_team_game_moments_event_id_idx`
- `rep_team_game_moments_org_id_idx`
- `rep_team_game_moments_player_id_idx`
- `rep_team_game_moments_program_year_id_idx`
- `rep_team_import_events_org_id_idx`
- `rep_team_import_events_program_year_id_idx`
- `rep_team_lineup_templates_program_year_id_idx`
- `rep_team_lineups_program_year_id_idx`
- `rep_team_money_in_accounting_entry_id_idx`
- `rep_team_money_in_budget_category_id_idx`
- `rep_team_money_in_org_id_idx`
- `rep_team_money_in_pkey`
- `rep_team_money_in_team_id_idx`
- `rep_team_opponent_observations_org_id_idx`
- `rep_team_payment_requests_accounting_entry_id_idx`
- `rep_team_payment_requests_budget_category_idx`
- `rep_team_payment_requests_budget_item_idx`
- `rep_team_payment_requests_budget_line_id_idx`
- `rep_team_payment_requests_program_year_id_idx`
- `rep_team_payment_requests_program_year_idx`
- `rep_team_staff_memberships_org_user_idx`
- `rep_team_staff_memberships_pkey`
- `rep_team_staff_memberships_team_idx`
- `rep_team_staff_memberships_team_user_key`
- `rep_teams_group_id_idx`
- `rep_tryout_evaluator_sessions_team_id_program_year_id_idx`
- `rep_tryout_registrations_org_id_idx`
- `rep_tryout_registrations_team_id_idx`
- `rep_tryout_rubrics_program_year_id_idx`
- `rep_tryout_scores_team_id_program_year_id_idx`
- `resources_tournament_id_idx`
- `rule_items_rule_id_idx`
- `rules_tournament_id_idx`
- `team_entitlements_rep_team_id_idx`
- `team_org_links_rep_team_id_idx`
- `team_workspace_claims_team_workspace_id_idx`
- `team_workspaces_active_program_year_id_idx`
- `team_workspaces_billing_owner_org_id_idx`
- `teams_division_id_idx`
- `teams_pool_id_idx`
- `teams_tournament_id_idx`
- `tournament_archives_winner_team_id_idx`
- `tournament_roster_players_source_player_id_idx`
- `tournaments_default_contact_member_id_idx`
- `venue_facilities_source_org_facility_id_idx`

### Only in PROD (1)
- `budget_items_unique_org_name`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (27)
- `budget_items.budget_items_team_id_fkey`
- `rep_allocation_splits.rep_allocation_splits_budget_category_id_fkey`
- `rep_allocation_splits.rep_allocation_splits_budget_item_id_fkey`
- `rep_team_expenses.rep_team_expenses_balance_entry_id_fkey`
- `rep_team_expenses.rep_team_expenses_budget_category_id_fkey`
- `rep_team_expenses.rep_team_expenses_budget_item_id_fkey`
- `rep_team_expenses.rep_team_expenses_deposit_entry_id_fkey`
- `rep_team_fundraiser_tags.rep_team_fundraiser_tags_fundraiser_id_fkey`
- `rep_team_fundraiser_tags.rep_team_fundraiser_tags_pkey`
- `rep_team_fundraiser_tags.rep_team_fundraiser_tags_tag_id_fkey`
- `rep_team_money_in.rep_team_money_in_accounting_entry_id_fkey`
- `rep_team_money_in.rep_team_money_in_budget_category_id_fkey`
- `rep_team_money_in.rep_team_money_in_budget_item_id_fkey`
- `rep_team_money_in.rep_team_money_in_created_by_fkey`
- `rep_team_money_in.rep_team_money_in_org_id_fkey`
- `rep_team_money_in.rep_team_money_in_pkey`
- `rep_team_money_in.rep_team_money_in_program_year_id_fkey`
- `rep_team_money_in.rep_team_money_in_team_id_fkey`
- `rep_team_payment_requests.rep_team_payment_requests_budget_category_id_fkey`
- `rep_team_payment_requests.rep_team_payment_requests_budget_item_id_fkey`
- `rep_team_payment_requests.rep_team_payment_requests_program_year_id_fkey`
- `rep_team_staff_memberships.rep_team_staff_memberships_org_id_fkey`
- `rep_team_staff_memberships.rep_team_staff_memberships_pkey`
- `rep_team_staff_memberships.rep_team_staff_memberships_revoked_by_fkey`
- `rep_team_staff_memberships.rep_team_staff_memberships_team_id_fkey`
- `rep_team_staff_memberships.rep_team_staff_memberships_team_user_key`
- `rep_team_staff_memberships.rep_team_staff_memberships_user_id_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (9)
- `budget_items.budget_items_direction_check`
- `rep_fundraisers.rep_fundraisers_kind_check`
- `rep_fundraisers.rep_fundraisers_sponsor_status_check`
- `rep_program_years.rep_program_years_default_credit_check`
- `rep_team_money_in.rep_team_money_in_amount_check`
- `rep_team_money_in.rep_team_money_in_entry_kind_check`
- `rep_team_money_in.rep_team_money_in_received_from_check`
- `rep_team_staff_memberships.rep_team_staff_memberships_coach_role_check`
- `rep_team_staff_memberships.rep_team_staff_memberships_status_check`

### CHECK only in PROD (0)
_none_

