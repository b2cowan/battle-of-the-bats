---
name: reference_db_schema
description: Complete public schema table+column list — auto-generated 2026-06-05 from live fieldlogichq-dev Supabase project.
metadata:
  node_type: memory
  type: reference
---

# DB Schema Reference — 2026-06-05

**Auto-generated** from live `fieldlogichq-dev` project (ref `npgnrxaitgbtbtvvykto`) via Management API.
Run `node scripts/refresh-db-schema.mjs` to refresh after applying migrations.

---

## Module: Tournament

### announcements
id (uuid), tournament_id (uuid) → tournaments.id, title NOT NULL, body, published_at, pinned (boolean), division_ids, channel_site (boolean), channel_email (boolean), email_targeting (jsonb), email_recipient_count (integer), email_success_count (integer), email_failed_count (integer), email_failed_addresses, email_sent_at, sent_by_email, deleted_at
- Indexes: announcements_channel_email_idx, announcements_channel_site_idx, announcements_deleted_at_idx

### diamonds
id (uuid), tournament_id (uuid) → tournaments.id, name NOT NULL, address, notes, source_org_venue_id (uuid) → org_venues.id

### divisions
id (uuid), tournament_id (uuid) → tournaments.id, name NOT NULL, min_age (integer), max_age (integer), display_order (integer), is_closed (boolean), capacity (integer), pool_count (integer), pool_names, requires_pool_selection (boolean), playoff_config (jsonb), deposit_amount (numeric), deposit_due_date, total_fee_amount (numeric), total_fee_due_date, schedule_visibility, contact_member_id (uuid) → organization_members.id, settings (jsonb)

### games
id (uuid), tournament_id (uuid) → tournaments.id, division_id (uuid) → divisions.id, home_team_id (uuid) → teams.id, away_team_id (uuid) → teams.id, game_date, game_time (time without time zone), location, diamond_id (uuid) → diamonds.id, home_score (integer), away_score (integer), status, is_playoff (boolean), bracket_id (uuid), bracket_code, home_placeholder, away_placeholder, notes, home_slot_id (uuid) → pool_slots.id, away_slot_id (uuid) → pool_slots.id, score_submitted_by_user_id (uuid), score_submitted_by_email, score_submitted_at, score_submission_source, venue_facility_id (uuid) → venue_facilities.id, schedule_facility_lane_id (uuid) → schedule_facility_lanes.id, generator_locked (boolean)
- Indexes: games_schedule_facility_lane_id_idx, games_score_submitted_at_idx, games_venue_facility_id_idx, idx_games_away_slot_id, idx_games_generator_locked, idx_games_home_slot_id

### org_venue_facilities
id (uuid), org_venue_id (uuid) → org_venues.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, name NOT NULL, facility_type, display_order (integer), notes, created_at
- Indexes: org_venue_facilities_org_id_idx, org_venue_facilities_org_venue_id_idx

### org_venues
id (uuid), org_id (uuid) → organizations.id NOT NULL, name NOT NULL, address, notes, is_active (boolean), created_at, updated_at
- Indexes: org_venues_org_id_idx

### pool_slots
id (uuid), pool_id (uuid) → pools.id NOT NULL, tournament_id (uuid) → tournaments.id NOT NULL, division_id (uuid) → divisions.id NOT NULL, slot_number (integer) NOT NULL, display_name NOT NULL, team_id (uuid) → teams.id, created_at
- Indexes: idx_pool_slots_pool_id, idx_pool_slots_team_id, idx_pool_slots_tournament_id, pool_slots_pool_id_slot_number_key

### pools
id (uuid), division_id (uuid) → divisions.id NOT NULL, name NOT NULL, display_order (integer), created_at, settings (jsonb)

### resources
id (uuid), tournament_id (uuid) → tournaments.id, label NOT NULL, url NOT NULL, display_order (integer)

### rule_items
id (uuid), rule_id (uuid) → rules.id NOT NULL, content NOT NULL, display_order (integer)

### rules
id (uuid), tournament_id (uuid) → tournaments.id, title NOT NULL, display_order (integer), icon, division_ids

### teams
id (uuid), tournament_id (uuid) → tournaments.id, division_id (uuid) → divisions.id, name NOT NULL, coach, email, status, payment_status, registered_at, admin_notes, pool_id (uuid) → pools.id, deposit_paid (numeric), total_paid (numeric), waitlist_position (integer), slot_id (uuid) → pool_slots.id, check_in_status, checked_in_at, checked_in_by_user_id (uuid), checked_in_by_name, roster_submitted_at, roster_confirmed_at, payment_collected_at, check_in_notes
- Indexes: idx_teams_slot_id

### tournament_archives
id (uuid), tournament_id (uuid) → tournaments.id, org_id (uuid) → organizations.id NOT NULL, tournament_name NOT NULL, season NOT NULL, division, final_snapshot (jsonb) NOT NULL, winner_team_id (uuid) → teams.id, winner_team_name, runner_up_name, total_teams (integer), total_games (integer), integrity_hash NOT NULL, sealed_at, sealed_by (uuid)
- Indexes: tournament_archives_org_season, tournament_archives_tournament_id_unique

### tournament_registration_field_answers
id (uuid), registration_id (uuid) → teams.id NOT NULL, field_id (uuid) → tournament_registration_fields.id NOT NULL, value_text, value_json (jsonb), file_url, created_at
- Indexes: tournament_registration_field_answ_registration_id_field_id_key, tournament_registration_field_answers_field_idx, tournament_registration_field_answers_registration_idx

### tournament_registration_fields
id (uuid), tournament_id (uuid) → tournaments.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, label NOT NULL, field_type NOT NULL, options (jsonb), required (boolean), sort_order (integer), is_archived (boolean), created_at, updated_at
- Indexes: tournament_registration_fields_org_idx, tournament_registration_fields_tournament_idx

### tournaments
id (uuid), year (integer) NOT NULL, name NOT NULL, slug, status, is_active (boolean), start_date, end_date, contact_email, fee_schedule_mode, deposit_amount (numeric), deposit_due_date, total_fee_amount (numeric), total_fee_due_date, logo_url, hero_banner_url, theme_preset, theme_primary, theme_accent, theme_font, theme_card_style, require_score_finalization (boolean), color_mode, created_at, notify_teams_on_complete (boolean), results_notified_at, results_notification_sent_count (integer), org_id (uuid) → organizations.id NOT NULL, settings (jsonb), default_contact_member_id (uuid) → organization_members.id, notify_mode
- Indexes: idx_tournaments_created_at, idx_tournaments_results_notified_at, tournaments_org_id_idx, tournaments_org_slug_live_unique

### venue_facilities
id (uuid), venue_id (uuid) → diamonds.id NOT NULL, tournament_id (uuid) → tournaments.id NOT NULL, name NOT NULL, facility_type, display_order (integer), notes, source_org_facility_id (uuid) → org_venue_facilities.id, created_at, settings (jsonb)
- Indexes: venue_facilities_tournament_id_idx, venue_facilities_venue_id_idx

## Module: League

### league_divisions
id (uuid), season_id (uuid) → league_seasons.id NOT NULL, name NOT NULL, capacity (integer), sort_order (integer), created_at

### league_email_log
id (uuid), org_id (uuid) → organizations.id NOT NULL, season_id (uuid) → league_seasons.id NOT NULL, sent_by (uuid) NOT NULL, sent_at, subject NOT NULL, scope NOT NULL, audience NOT NULL, count_sent (integer), count_skipped (integer)

### league_games
id (uuid), season_id (uuid) → league_seasons.id NOT NULL, division_id (uuid) → league_divisions.id NOT NULL, home_team_id (uuid) → league_teams.id NOT NULL, away_team_id (uuid) → league_teams.id NOT NULL, scheduled_at, location, home_score (integer), away_score (integer), status, notes, created_at, updated_at, org_id (uuid) → organizations.id NOT NULL
- Indexes: league_games_division_idx, league_games_org_idx, league_games_schedule_idx, league_games_season_idx

### league_notification_log
id (uuid), season_id (uuid) → league_seasons.id NOT NULL, sent_by (uuid), audience_type NOT NULL, audience_label, subject NOT NULL, recipient_count (integer) NOT NULL, sent_at

### league_practices
id (uuid), season_id (uuid) → league_seasons.id NOT NULL, division_id (uuid) → league_divisions.id, team_id (uuid) → league_teams.id NOT NULL, scheduled_at, ends_at, location, notes, status, recurrence_group_id (uuid), created_at, updated_at, org_id (uuid) → organizations.id NOT NULL
- Indexes: league_practices_org_idx, league_practices_recurrence_idx, league_practices_schedule_idx, league_practices_season_idx, league_practices_team_idx

### league_registrations
id (uuid), season_id (uuid) → league_seasons.id NOT NULL, division_id (uuid) → league_divisions.id, player_first_name NOT NULL, player_last_name NOT NULL, player_date_of_birth, player_jersey_pref, player_position_pref, player_notes, guardian_first_name NOT NULL, guardian_last_name NOT NULL, guardian_email NOT NULL, guardian_phone, status, waitlist_position (integer), team_id (uuid) → league_teams.id, registration_fee_paid (boolean), fee_entry_id (uuid), admin_notes, source, registered_at, updated_at
- Indexes: league_registrations_division_idx, league_registrations_guardian_idx, league_registrations_season_idx, league_registrations_status_idx

### league_seasons
id (uuid), org_id (uuid) → organizations.id NOT NULL, name NOT NULL, slug NOT NULL, sport, division, status, description, registration_fee (numeric), auto_generate_fees (boolean), auto_approve_under_capacity (boolean), auto_promote_waitlist (boolean), registration_open_at, registration_close_at, season_start_date, season_end_date, waiver_text, created_at, updated_at, draft_state (jsonb)
- Indexes: league_seasons_org_id_slug_key

### league_teams
id (uuid), season_id (uuid) → league_seasons.id NOT NULL, division_id (uuid) → league_divisions.id NOT NULL, name NOT NULL, color, coach_name, sort_order (integer), created_at

## Module: Rep Teams

### rep_allocation_installments
id (uuid), split_id (uuid) → rep_allocation_splits.id NOT NULL, installment_number (integer) NOT NULL, amount (numeric) NOT NULL, due_date NOT NULL, paid_at, paid_by (uuid), accounting_entry_id (uuid) → accounting_entries.id, created_at, reminder_sent_at, org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id
- Indexes: rep_allocation_installments_org_idx, rep_allocation_installments_split_id_installment_number_key, rep_allocation_installments_team_idx

### rep_allocation_splits
id (uuid), allocation_id (uuid) → rep_cost_allocations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, amount (numeric) NOT NULL, split_method NOT NULL, split_value (numeric) NOT NULL, payment_schedule, notes, created_at
- Indexes: rep_allocation_splits_allocation_id_team_id_key, rep_allocation_splits_team_idx

### rep_budget_lines
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, category_id (uuid) → budget_categories.id, item_id (uuid) → budget_items.id, description NOT NULL, total_amount (numeric) NOT NULL, notes, sort_order (integer), created_at, updated_at
- Indexes: rep_budget_lines_team_year_idx

### rep_budget_periods
id (uuid), budget_line_id (uuid) → rep_budget_lines.id NOT NULL, period_label NOT NULL, period_date, amount (numeric) NOT NULL, sort_order (integer), created_at
- Indexes: rep_budget_periods_line_idx

### rep_cost_allocations
id (uuid), org_id (uuid) → organizations.id NOT NULL, source_entry_id (uuid) → accounting_entries.id, description NOT NULL, total_amount (numeric) NOT NULL, created_by (uuid), created_at, source_budget_line_id (uuid) → org_budget_lines.id
- Indexes: rep_cost_allocations_budget_line_idx

### rep_document_templates
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id, name NOT NULL, document_type NOT NULL, storage_path NOT NULL, file_name NOT NULL, file_size (bigint) NOT NULL, is_active (boolean), published_by (uuid), created_at
- Indexes: rep_document_templates_org_idx

### rep_dues_credits
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, amount (numeric) NOT NULL, description NOT NULL, credit_date, credit_type, notes, created_by (uuid), created_at, fundraiser_entry_id (uuid) → rep_fundraiser_entries.id

### rep_fundraiser_entries
id (uuid), fundraiser_id (uuid) → rep_fundraisers.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, amount_raised (numeric) NOT NULL, rebate_percent (numeric), rebate_amount (numeric), accounting_entry_id (uuid) → accounting_entries.id, credit_id (uuid) → rep_dues_credits.id, notes, created_at, updated_at
- Indexes: rep_fundraiser_entries_fundraiser_id_player_id_key, rep_fundraiser_entries_fundraiser_idx, rep_fundraiser_entries_player_idx

### rep_fundraisers
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, name NOT NULL, description, player_rebate_percent (numeric), start_date, end_date, is_active (boolean), created_at, updated_at
- Indexes: rep_fundraisers_team_year_idx

### rep_player_documents
id (uuid), player_id (uuid) → rep_roster_players.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, document_type NOT NULL, storage_path NOT NULL, file_name NOT NULL, file_size (bigint) NOT NULL, template_id (uuid) → rep_document_templates.id, uploaded_by (uuid), created_at
- Indexes: rep_player_documents_player_idx, rep_player_documents_team_idx

### rep_player_dues_installments
id (uuid), schedule_id (uuid) → rep_player_dues_schedules.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, installment_number (integer) NOT NULL, amount (numeric) NOT NULL, due_date NOT NULL, paid_at, reminder_sent_at, accounting_entry_id (uuid) → accounting_entries.id, created_at, source, reminder_30_sent_at, reminder_7_sent_at, org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id
- Indexes: rep_player_dues_installments_due_idx, rep_player_dues_installments_org_idx, rep_player_dues_installments_schedule_id_installment_number_key, rep_player_dues_installments_team_idx

### rep_player_dues_schedules
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, total_amount (numeric) NOT NULL, notes, created_at, updated_at, budget_line_id (uuid) → rep_budget_lines.id
- Indexes: rep_player_dues_schedules_program_year_id_player_id_key

### rep_program_years
id (uuid), team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, name NOT NULL, year (integer) NOT NULL, status, tryout_open (boolean), tryout_description, budget_amount (numeric), created_at, updated_at, auto_reminders_enabled (boolean)
- Indexes: rep_program_years_team_id_year_key

### rep_roster_players
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, player_first_name NOT NULL, player_last_name NOT NULL, player_date_of_birth, player_number, guardian_first_name NOT NULL, guardian_last_name NOT NULL, guardian_email NOT NULL, guardian_phone, status, source, tryout_registration_id (uuid) → rep_tryout_registrations.id, notes, admin_notes, created_at, updated_at, primary_position, secondary_position
- Indexes: rep_roster_players_email_idx, rep_roster_players_year_idx

### rep_season_surplus
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, total_surplus (numeric), notes, created_by (uuid), created_at, updated_at
- Indexes: rep_season_surplus_program_year_id_key

### rep_team_coaches
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, user_id (uuid) NOT NULL, coach_role, created_at
- Indexes: rep_team_coaches_program_year_id_user_id_key, rep_team_coaches_user_idx

### rep_team_event_attendance
id (uuid), event_id (uuid) → rep_team_events.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, status, note, updated_by (uuid), created_at, updated_at
- Indexes: rep_team_event_attendance_event_id_player_id_key, rep_team_event_attendance_event_idx, rep_team_event_attendance_player_idx, rep_team_event_attendance_team_idx

### rep_team_events
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, event_type NOT NULL, name NOT NULL, description, starts_at NOT NULL, ends_at, location, opponent, home_away, home_score (integer), away_score (integer), result, parent_event_id (uuid) → rep_team_events.id, is_recurring (boolean), recurrence_rule (jsonb), recurrence_parent_id (uuid) → rep_team_events.id, created_at, updated_at
- Indexes: rep_team_events_parent_idx, rep_team_events_year_idx

### rep_team_expenses
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, expense_type NOT NULL, description NOT NULL, category, amount (numeric) NOT NULL, expense_paid_at, deposit_amount (numeric), deposit_due_date, deposit_paid_at, balance_amount (numeric), balance_due_date, balance_paid_at, event_id (uuid) → rep_team_events.id, accounting_entry_id (uuid) → accounting_entries.id, created_by (uuid), created_at, updated_at, payment_method, payee_id (uuid) → org_payees.id, payee_payer
- Indexes: rep_team_expenses_year_idx

### rep_team_groups
id (uuid), org_id (uuid) → organizations.id NOT NULL, name NOT NULL, display_order (integer), created_at
- Indexes: idx_rep_team_groups_org_name

### rep_team_lineup_entries
id (uuid), lineup_id (uuid) → rep_team_lineups.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, batting_order (integer), starter (boolean), inning_positions (jsonb), notes, created_at, updated_at
- Indexes: rep_team_lineup_entries_batting_order_idx, rep_team_lineup_entries_lineup_id_player_id_key, rep_team_lineup_entries_lineup_idx, rep_team_lineup_entries_player_idx

### rep_team_lineups
id (uuid), event_id (uuid) → rep_team_events.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, lineup_mode, inning_count (integer), notes, updated_by (uuid), created_at, updated_at
- Indexes: rep_team_lineups_event_id_key, rep_team_lineups_event_idx, rep_team_lineups_org_idx, rep_team_lineups_team_idx

### rep_team_payment_requests
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, request_type NOT NULL, amount (numeric) NOT NULL, description NOT NULL, payment_method, notes, status, denial_reason, budget_line_id (uuid) → org_budget_lines.id, accounting_entry_id (uuid) → accounting_entries.id, created_by (uuid) NOT NULL, reviewed_by (uuid), reviewed_at, created_at, updated_at
- Indexes: rep_team_payment_requests_org_status_idx, rep_team_payment_requests_team_status_idx

### rep_teams
id (uuid), org_id (uuid) → organizations.id NOT NULL, name NOT NULL, slug NOT NULL, sport, division, description, color, is_archived (boolean), created_at, updated_at, group_id (uuid) → rep_team_groups.id
- Indexes: rep_teams_org_id_slug_key

### rep_tryout_registrations
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, player_first_name NOT NULL, player_last_name NOT NULL, player_date_of_birth, player_notes, guardian_first_name NOT NULL, guardian_last_name NOT NULL, guardian_email NOT NULL, guardian_phone, status, admin_notes, submitted_at, updated_at
- Indexes: rep_tryout_registrations_email_idx, rep_tryout_registrations_status_idx, rep_tryout_registrations_year_idx

## Module: Standalone Team Workspace

### basic_coach_team_registrations
id (uuid), basic_coach_team_id (uuid) → basic_coach_teams.id NOT NULL, tournament_team_id (uuid) → teams.id NOT NULL, linked_by_user_id (uuid), link_source, created_at
- Indexes: basic_coach_team_registrations_basic_team_idx, basic_coach_team_registrations_tournament_team_unique

### basic_coach_team_users
id (uuid), basic_coach_team_id (uuid) → basic_coach_teams.id NOT NULL, user_id (uuid) NOT NULL, role, status, created_at, updated_at
- Indexes: basic_coach_team_users_team_user_unique, basic_coach_team_users_user_status_idx

### team_entitlements
id (uuid), team_workspace_id (uuid) → team_workspaces.id, org_id (uuid) → organizations.id NOT NULL, rep_team_id (uuid) → rep_teams.id NOT NULL, source NOT NULL, status, starts_at, ends_at, stripe_subscription_item_id, created_at, updated_at
- Indexes: team_entitlements_active_source_unique, team_entitlements_org_team_idx, team_entitlements_workspace_idx

### team_org_links
id (uuid), team_workspace_id (uuid) → team_workspaces.id NOT NULL, rep_team_id (uuid) → rep_teams.id NOT NULL, linked_org_id (uuid) → organizations.id NOT NULL, status, link_type, sharing_level, requested_by_user_id (uuid), approved_by_team_user_id (uuid), approved_by_org_user_id (uuid), billing_mode_after_approval, created_at, updated_at
- Indexes: team_org_links_active_unique, team_org_links_linked_org_idx, team_org_links_workspace_idx

### team_workspace_claims
id (uuid), tournament_id (uuid) → tournaments.id NOT NULL, tournament_team_id (uuid), contact_email NOT NULL, claim_token_hash NOT NULL, status, team_workspace_id (uuid) → team_workspaces.id, claimed_by_user_id (uuid), expires_at, created_at, claimed_at
- Indexes: team_workspace_claims_contact_email_idx, team_workspace_claims_token_hash_unique, team_workspace_claims_tournament_idx

### team_workspaces
id (uuid), workspace_org_id (uuid) → organizations.id NOT NULL, rep_team_id (uuid) → rep_teams.id NOT NULL, active_program_year_id (uuid) → rep_program_years.id, primary_owner_user_id (uuid), source, source_tournament_id (uuid) → tournaments.id, source_tournament_team_id (uuid), workspace_state, billing_mode, billing_owner_org_id (uuid) → organizations.id, billing_owner_user_id (uuid), stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end, created_at, updated_at, basic_coach_team_id (uuid) → basic_coach_teams.id
- Indexes: team_workspaces_basic_coach_team_idx, team_workspaces_rep_team_unique, team_workspaces_source_tournament_idx, team_workspaces_state_idx, team_workspaces_workspace_org_unique

## Module: Accounting

### accounting_entries
id (uuid), ledger_id (uuid) → accounting_ledgers.id NOT NULL, entry_date NOT NULL, description NOT NULL, amount (numeric) NOT NULL, entry_type NOT NULL, status, category, linked_entry_id (uuid) → accounting_entries.id, source_module, source_entity_id (uuid), created_by (uuid), created_at, updated_at, payment_method, payee_id (uuid) → org_payees.id, payee_payer, notes
- Indexes: accounting_entries_entry_date_idx, accounting_entries_ledger_id_idx

### accounting_ledgers
id (uuid), org_id (uuid) → organizations.id NOT NULL, entity_type NOT NULL, entity_id (uuid), name NOT NULL, currency, is_archived (boolean), created_at
- Indexes: accounting_ledgers_org_id_entity_type_entity_id_key

### billing_retained_records
id (uuid), intent_id (uuid) → billing_retention_intents.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, record_type NOT NULL, record_id (uuid), display_name NOT NULL, retained_state, retained_at, retention_until NOT NULL, extension_count (integer), last_extended_at, last_extended_by, last_extension_reason, metadata (jsonb), warning_sent_at, pending_purge_at, purge_notice_sent_at
- Indexes: idx_billing_retained_records_active_unique, idx_billing_retained_records_org, idx_billing_retained_records_pending_purge, idx_billing_retained_records_retention, idx_billing_retained_records_warning

### billing_retention_intents
id (uuid), org_id (uuid) → organizations.id NOT NULL, intent_type NOT NULL, status, from_plan, target_plan, keep_tournament_ids, effective_at, retention_until NOT NULL, reason, created_by (uuid), created_by_email, created_at, updated_at, applied_at
- Indexes: idx_billing_retention_intents_org, idx_billing_retention_intents_retention

### budget_categories
id (uuid), org_id (uuid) → organizations.id, name NOT NULL, scope, sort_order (integer), is_default (boolean), created_at
- Indexes: budget_categories_org_idx

### budget_items
id (uuid), category_id (uuid) → budget_categories.id NOT NULL, org_id (uuid) → organizations.id, name NOT NULL, suggested_amount (numeric), sort_order (integer), is_default (boolean), is_misc (boolean), created_at
- Indexes: budget_items_category_idx, budget_items_org_idx, budget_items_unique_default_name, budget_items_unique_org_name

### org_budget_lines
id (uuid), org_id (uuid) → organizations.id NOT NULL, season_year (integer) NOT NULL, category_id (uuid) → budget_categories.id, item_id (uuid) → budget_items.id, description NOT NULL, total_amount (numeric) NOT NULL, notes, sort_order (integer), created_at, updated_at
- Indexes: org_budget_lines_org_year_idx

### org_budget_periods
id (uuid), budget_line_id (uuid) → org_budget_lines.id NOT NULL, period_label NOT NULL, period_date, amount (numeric) NOT NULL, sort_order (integer), created_at
- Indexes: org_budget_periods_line_idx

### org_payees
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id, name NOT NULL, notes, is_active (boolean), created_by (uuid), created_at
- Indexes: idx_org_payees_org_id, idx_org_payees_org_name, idx_org_payees_team_id, idx_org_payees_team_name

## Module: Stripe / Billing

### stripe_prices
id (uuid), plan_id NOT NULL, billing_cycle NOT NULL, environment NOT NULL, price_id, product_name, created_at, updated_at, last_change_note, updated_by_email
- Indexes: stripe_prices_plan_id_billing_cycle_environment_key

## Module: Organization / Platform Core

### org_audit_log
id (uuid), org_id (uuid) → organizations.id NOT NULL, actor_id (uuid), target_id (uuid), action NOT NULL, payload (jsonb), created_at
- Indexes: idx_audit_log_org

### org_internal_notes
id (uuid), org_id (uuid) → organizations.id NOT NULL, body NOT NULL, created_by_email NOT NULL, updated_by_email, created_at, updated_at, deleted_at, deleted_by_email
- Indexes: idx_org_internal_notes_org_deleted_time, idx_org_internal_notes_org_time

### org_member_rep_group_scopes
member_id (uuid) → organization_members.id NOT NULL, group_id (uuid) → rep_team_groups.id NOT NULL
- Indexes: idx_org_member_rep_group_scopes_member

### org_member_tournament_assignments
id (uuid), org_member_id (uuid) → organization_members.id NOT NULL, tournament_id (uuid) → tournaments.id NOT NULL, created_at
- Indexes: idx_omta_org_member, idx_omta_tournament, org_member_tournament_assignmen_org_member_id_tournament_id_key

### org_overrides
id (uuid), org_id (uuid) → organizations.id NOT NULL, type NOT NULL, value, expires_at, reason NOT NULL, created_by NOT NULL, created_at, revoked_at, revoked_by, target (jsonb), starts_at, suppress_billing (boolean)
- Indexes: idx_org_overrides_org, idx_org_overrides_org_active

### org_public_site_content
id (uuid), org_id (uuid) → organizations.id NOT NULL, tagline, description, contact_email, social_instagram, social_facebook, social_x, social_website, show_upcoming_tournaments (boolean), show_archives_link (boolean), created_at, updated_at
- Indexes: org_public_site_content_org_id_key

### organization_members
id (uuid), organization_id (uuid) → organizations.id NOT NULL, user_id (uuid) NOT NULL, role, invited_at, accepted_at, capabilities (jsonb), status, display_name, title
- Indexes: organization_members_organization_id_user_id_key

### organizations
id (uuid), name NOT NULL, slug NOT NULL, logo_url, plan_id, stripe_customer_id, stripe_subscription_id, subscription_status, tournament_limit (integer), is_public (boolean), created_at, theme_preset, theme_primary, theme_accent, hero_banner_url, theme_font, theme_card_style, require_score_finalization (boolean), onboarding_completed_at, enabled_addons (jsonb), internal_notes, billing_suspended_at, billing_suspension_reason, subscription_period, current_period_end, rep_team_subscription_item_id, pdf_settings (jsonb), account_kind, team_workspace_status, is_discoverable (boolean), email_marketing_opt_out (boolean), email_opt_out_at
- Indexes: idx_organizations_email_opt_out, organizations_slug_key

## Module: Platform Admin

### notification_preferences
user_id (uuid) NOT NULL, org_id (uuid) → organizations.id NOT NULL, event_type NOT NULL, channel_bell (boolean), channel_push (boolean), channel_email (boolean), updated_at

### notifications
id (uuid), org_id (uuid) → organizations.id NOT NULL, user_id (uuid) NOT NULL, event_type NOT NULL, title NOT NULL, body, link, read_at, created_at, metadata (jsonb)
- Indexes: notifications_org_idx, notifications_user_unread_idx

### plan_config_overrides
id (uuid), plan_id NOT NULL, tournament_limit (integer), seat_limit (integer), trial_days (integer), updated_at, updated_by_email, last_change_note
- Indexes: plan_config_overrides_plan_id_key

### plan_gating
plan_key NOT NULL, gating_status, updated_at, updated_by_email, last_change_note

### platform_addon_catalog
id (uuid), addon_key NOT NULL, label NOT NULL, description, module_key, status, default_included_plans, pricing_model, monthly_price (numeric), annual_price (numeric), effective_at, notes, created_at, updated_at
- Indexes: idx_platform_addon_catalog_status_label, platform_addon_catalog_addon_key_key

### platform_admin_visits
id (uuid), actor_user_id (uuid), actor_email NOT NULL, path, visited_at
- Indexes: idx_platform_admin_visits_actor_time, idx_platform_admin_visits_path_time

### platform_audit_log
id (uuid), actor_email NOT NULL, org_id (uuid) → organizations.id, action NOT NULL, field, old_value (jsonb), new_value (jsonb), created_at
- Indexes: idx_platform_audit_actor, idx_platform_audit_org

### platform_bulk_operations
id (uuid), action_type NOT NULL, status, target_count (integer), success_count (integer), failure_count (integer), reason NOT NULL, parameters (jsonb), result_summary (jsonb), created_by_email NOT NULL, created_at, completed_at
- Indexes: idx_platform_bulk_operations_actor_time, idx_platform_bulk_operations_time

### platform_catalog_campaigns
id (uuid), campaign_key NOT NULL, title NOT NULL, campaign_type NOT NULL, status, target_plan_ids, starts_at, ends_at, coupon_code, discount_summary, trial_days (integer), notes, created_by_email NOT NULL, updated_by_email, created_at, updated_at
- Indexes: idx_platform_catalog_campaigns_dates, idx_platform_catalog_campaigns_status_time, platform_catalog_campaigns_campaign_key_key

### platform_catalog_change_applications
id (uuid), change_request_id (uuid) → platform_catalog_change_requests.id NOT NULL, surface NOT NULL, target_key NOT NULL, actor_email NOT NULL, applied_payload (jsonb), applied_at
- Indexes: idx_platform_catalog_change_applications_request_time, idx_platform_catalog_change_applications_surface_time

### platform_catalog_change_requests
id (uuid), request_type NOT NULL, title NOT NULL, description, status, priority, target_plan_id, target_addon_key, target_version_id (uuid) → platform_plan_versions.id, effective_at, impact_summary, proposal (jsonb), submitted_by_email, submitted_at, reviewed_by_email, reviewed_at, implementation_notes, created_by_email NOT NULL, updated_by_email, created_at, updated_at
- Indexes: idx_platform_catalog_change_requests_effective, idx_platform_catalog_change_requests_status_time

### platform_email_templates
key NOT NULL, label NOT NULL, description NOT NULL, subject NOT NULL, heading NOT NULL, body NOT NULL, cta_label, cta_url_pattern, variables (jsonb), category, is_customised (boolean), updated_at, updated_by

### platform_events
id (uuid), event_type NOT NULL, source, source_event_id, org_id (uuid) → organizations.id, actor_user_id (uuid), actor_email, previous_plan_id, plan_id, previous_subscription_status, subscription_status, metadata (jsonb), occurred_at, created_at
- Indexes: idx_platform_events_org_time, idx_platform_events_source_event, idx_platform_events_type_time

### platform_metric_snapshots
id (uuid), snapshot_date NOT NULL, metrics (jsonb), source, created_by_email, created_at
- Indexes: idx_platform_metric_snapshots_date, platform_metric_snapshots_snapshot_date_key

### platform_plan_module_entitlements
plan_id NOT NULL, module_key NOT NULL, included (boolean), updated_by_email, updated_at

### platform_plan_versions
id (uuid), version_key NOT NULL, title NOT NULL, description, status, effective_at, published_at, created_by_email, snapshot (jsonb), notes, created_at, updated_at
- Indexes: idx_platform_plan_versions_status_time, platform_plan_versions_version_key_key

### platform_user_notes
id (uuid), user_id (uuid) NOT NULL, body NOT NULL, created_by_email NOT NULL, created_at
- Indexes: platform_user_notes_user_idx

### platform_users
id (uuid), email NOT NULL, display_name, role, is_active (boolean), invited_by, created_at, updated_at
- Indexes: platform_users_email_key

### push_subscriptions
id (uuid), user_id (uuid) NOT NULL, endpoint NOT NULL, keys_p256dh NOT NULL, keys_auth NOT NULL, device_label, created_at, last_used_at
- Indexes: push_subscriptions_endpoint_key, push_subscriptions_user_idx

### tournament_notification_preferences
user_id (uuid) NOT NULL, tournament_id (uuid) → tournaments.id NOT NULL, event_type NOT NULL, opted_out (boolean), updated_at
- Indexes: tournament_notif_prefs_tournament_idx

## Module: CRM / Leads

### early_access_leads
id (uuid), created_at, updated_at, last_submitted_at, submission_count (integer), status, name NOT NULL, email NOT NULL, email_normalized NOT NULL, organization_name, role, sports, plan_interest, features_interested, notes, source_path, user_agent, release_notifications_consent (boolean), metadata (jsonb), internal_status, internal_notes, last_contacted_at, last_contacted_by, converted_org_id (uuid) → organizations.id, converted_at, follow_up_due_at, next_action
- Indexes: early_access_leads_email_normalized_key, idx_early_access_leads_converted_at, idx_early_access_leads_created_at, idx_early_access_leads_features_interested, idx_early_access_leads_follow_up_due_at, idx_early_access_leads_internal_status, idx_early_access_leads_plan_interest, idx_early_access_leads_status

### email_batches
id (uuid), email_key NOT NULL, subject NOT NULL, triggered_by NOT NULL, recipient_count (integer), suppressed_count (integer), sent_count (integer), failed_count (integer), status, started_at, completed_at, created_at
- Indexes: idx_email_batches_email_key, idx_email_batches_status

### email_sends
id (uuid), email_key NOT NULL, subject NOT NULL, recipient_org_id (uuid) → organizations.id, recipient_email NOT NULL, recipient_name, status, suppression_reason, resend_message_id, batch_id (uuid) → email_batches.id, sent_at, created_at
- Indexes: idx_email_sends_batch_id, idx_email_sends_email_key, idx_email_sends_org_id, idx_email_sends_status

## Module: Other

### basic_coach_teams
id (uuid), name NOT NULL, normalized_name NOT NULL, primary_coach_name, primary_coach_email NOT NULL, sport, age_group, source, team_workspace_id (uuid) → team_workspaces.id, created_at, updated_at
- Indexes: basic_coach_teams_primary_email_idx, basic_coach_teams_workspace_idx

### fan_push_subscriptions
id (uuid), endpoint NOT NULL, keys_p256dh NOT NULL, keys_auth NOT NULL, tournament_id (uuid) → tournaments.id NOT NULL, team_id (uuid) → teams.id NOT NULL, device_label, created_at, last_used_at
- Indexes: fan_push_subscriptions_endpoint_idx, fan_push_subscriptions_endpoint_tournament_id_key, fan_push_subscriptions_tournament_team_idx

### import_batch_rows
id (uuid), batch_id (uuid) → import_batches.id NOT NULL, row_number (integer) NOT NULL, operation NOT NULL, target_id (uuid), raw_json (jsonb), normalized_json (jsonb), before_json (jsonb), after_json (jsonb), warnings_json (jsonb), errors_json (jsonb), status, created_at
- Indexes: idx_import_batch_rows_batch_row

### import_batches
id (uuid), org_id (uuid) → organizations.id NOT NULL, actor_user_id (uuid), actor_email, import_type NOT NULL, scope_json (jsonb), source_filename, status, summary_json (jsonb), created_at, committed_at, expires_at
- Indexes: idx_import_batches_actor_time, idx_import_batches_org_time

### schedule_facility_lanes
id (uuid), tournament_id (uuid) → tournaments.id NOT NULL, division_id (uuid) → divisions.id NOT NULL, label NOT NULL, sort_order (integer), resolved_venue_id (uuid) → diamonds.id, resolved_venue_facility_id (uuid) → venue_facilities.id, created_at, updated_at
- Indexes: schedule_facility_lanes_division_id_idx, schedule_facility_lanes_resolved_venue_facility_id_idx, schedule_facility_lanes_resolved_venue_id_idx, schedule_facility_lanes_tournament_id_idx, schedule_facility_lanes_unique_label

### tournament_roster_players
id (uuid), org_id (uuid) → organizations.id NOT NULL, tournament_id (uuid) → tournaments.id NOT NULL, team_id (uuid) → teams.id NOT NULL, name NOT NULL, jersey_number, date_of_birth, position, notes, source, created_by_user_id (uuid), created_at, updated_at
- Indexes: idx_tournament_roster_players_org, idx_tournament_roster_players_team, idx_tournament_roster_players_tournament

---

## Tables by count

Total: **103 tables** across 10 modules.

- Tournament: 17 tables
- League: 8 tables
- Rep Teams: 25 tables
- Standalone Team Workspace: 6 tables
- Accounting: 9 tables
- Stripe / Billing: 1 tables
- Organization / Platform Core: 8 tables
- Platform Admin: 20 tables
- CRM / Leads: 3 tables
- Other: 6 tables