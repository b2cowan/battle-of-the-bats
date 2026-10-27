---
name: reference_db_schema
description: Complete public schema table+column list — auto-generated 2026-10-27 from live fieldlogichq-dev Supabase project.
metadata:
  node_type: memory
  type: reference
---

# DB Schema Reference — 2026-10-27

**Auto-generated** from live `fieldlogichq-dev` project (ref `npgnrxaitgbtbtvvykto`) via Management API.
Run `node scripts/refresh-db-schema.mjs` to refresh after applying migrations.

---

## Module: Tournament

### announcements
id (uuid), tournament_id (uuid) → tournaments.id, title NOT NULL, body NOT NULL, published_at, pinned (boolean), division_ids, channel_site (boolean), channel_email (boolean), email_targeting (jsonb), email_recipient_count (integer), email_success_count (integer), email_failed_count (integer), email_failed_addresses, email_sent_at, sent_by_email, deleted_at, email_recipients (jsonb)
- Indexes: announcements_channel_email_idx, announcements_channel_site_idx, announcements_deleted_at_idx, announcements_tournament_id_idx

### diamonds
id (uuid), tournament_id (uuid) → tournaments.id, name NOT NULL, address, notes, source_org_venue_id (uuid) → org_venues.id
- Indexes: diamonds_source_org_venue_id_idx, diamonds_tournament_id_idx

### divisions
id (uuid), tournament_id (uuid) → tournaments.id, name NOT NULL, min_age (integer), max_age (integer), display_order (integer), is_closed (boolean), capacity (integer), pool_count (integer), pool_names, requires_pool_selection (boolean), playoff_config (jsonb), deposit_amount (numeric), deposit_due_date, total_fee_amount (numeric), total_fee_due_date, schedule_visibility, contact_member_id (uuid) → organization_members.id, settings (jsonb), playoffs_announced_at
- Indexes: divisions_contact_member_id_idx, divisions_tournament_id_idx

### games
id (uuid), tournament_id (uuid) → tournaments.id, division_id (uuid) → divisions.id, home_team_id (uuid) → teams.id, away_team_id (uuid) → teams.id, game_date, game_time (time without time zone), location, diamond_id (uuid) → diamonds.id, home_score (integer), away_score (integer), status, is_playoff (boolean), bracket_id (uuid), bracket_code, home_placeholder, away_placeholder, notes, home_slot_id (uuid) → pool_slots.id, away_slot_id (uuid) → pool_slots.id, score_submitted_by_user_id (uuid), score_submitted_by_email, score_submitted_at, score_submission_source, venue_facility_id (uuid) → venue_facilities.id, schedule_facility_lane_id (uuid) → schedule_facility_lanes.id, generator_locked (boolean), duration_minutes (integer), round_label, bracket_label
- Indexes: games_away_team_id_idx, games_diamond_id_idx, games_division_id_idx, games_home_team_id_idx, games_schedule_facility_lane_id_idx, games_score_submitted_at_idx, games_tournament_id_idx, games_venue_facility_id_idx, idx_games_away_slot_id, idx_games_generator_locked, idx_games_home_slot_id

### org_venue_facilities
id (uuid), org_venue_id (uuid) → org_venues.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, name NOT NULL, facility_type, display_order (integer), notes, created_at
- Indexes: org_venue_facilities_org_id_idx, org_venue_facilities_org_venue_id_idx

### org_venues
id (uuid), org_id (uuid) → organizations.id NOT NULL, name NOT NULL, address, notes, is_active (boolean), created_at, updated_at, bookings_email
- Indexes: org_venues_org_id_idx

### pool_slots
id (uuid), pool_id (uuid) → pools.id NOT NULL, tournament_id (uuid) → tournaments.id NOT NULL, division_id (uuid) → divisions.id NOT NULL, slot_number (integer) NOT NULL, display_name NOT NULL, team_id (uuid) → teams.id, created_at
- Indexes: idx_pool_slots_pool_id, idx_pool_slots_team_id, idx_pool_slots_tournament_id, pool_slots_division_id_idx, pool_slots_pool_id_slot_number_key

### pools
id (uuid), division_id (uuid) → divisions.id NOT NULL, name NOT NULL, display_order (integer), created_at, settings (jsonb)
- Indexes: pools_division_id_idx

### resources
id (uuid), tournament_id (uuid) → tournaments.id, label NOT NULL, url NOT NULL, display_order (integer), created_at
- Indexes: resources_tournament_id_idx

### rule_items
id (uuid), rule_id (uuid) → rules.id NOT NULL, content NOT NULL, display_order (integer), created_at
- Indexes: rule_items_rule_id_idx

### rules
id (uuid), tournament_id (uuid) → tournaments.id, title NOT NULL, display_order (integer), icon, division_ids, created_at
- Indexes: rules_tournament_id_idx

### teams
id (uuid), tournament_id (uuid) → tournaments.id, division_id (uuid) → divisions.id, name NOT NULL, coach, email, status, payment_status, registered_at, admin_notes, pool_id (uuid) → pools.id, deposit_paid (numeric), total_paid (numeric), waitlist_position (integer), slot_id (uuid) → pool_slots.id, check_in_status, checked_in_at, checked_in_by_user_id (uuid), checked_in_by_name, roster_submitted_at, roster_confirmed_at, payment_collected_at, check_in_notes, seed (integer), coach_email, fee_book_baseline (numeric), fee_changed_by (uuid), pay_link_sent_at, entry_lowered (numeric)
- Indexes: idx_teams_slot_id, teams_division_id_idx, teams_pool_id_idx, teams_tournament_id_idx

### tournament_archives
id (uuid), tournament_id (uuid) → tournaments.id, org_id (uuid) → organizations.id NOT NULL, tournament_name NOT NULL, season NOT NULL, division, final_snapshot (jsonb) NOT NULL, winner_team_id (uuid) → teams.id, winner_team_name, runner_up_name, total_teams (integer), total_games (integer), integrity_hash NOT NULL, sealed_at, sealed_by (uuid)
- Indexes: tournament_archives_org_season, tournament_archives_tournament_id_unique, tournament_archives_winner_team_id_idx

### tournament_registration_field_answers
id (uuid), registration_id (uuid) → teams.id NOT NULL, field_id (uuid) → tournament_registration_fields.id NOT NULL, value_text, value_json (jsonb), file_url, created_at
- Indexes: tournament_registration_field_answ_registration_id_field_id_key, tournament_registration_field_answers_field_idx, tournament_registration_field_answers_registration_idx

### tournament_registration_fields
id (uuid), tournament_id (uuid) → tournaments.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, label NOT NULL, field_type NOT NULL, options (jsonb), required (boolean), sort_order (integer), is_archived (boolean), created_at, updated_at
- Indexes: tournament_registration_fields_org_idx, tournament_registration_fields_tournament_idx

### tournaments
id (uuid), year (integer) NOT NULL, name NOT NULL, slug NOT NULL, status, is_active (boolean), start_date, end_date, contact_email, fee_schedule_mode, deposit_amount (numeric), deposit_due_date, total_fee_amount (numeric), total_fee_due_date, logo_url, hero_banner_url, theme_preset, theme_primary, theme_accent, theme_font, theme_card_style, require_score_finalization (boolean), color_mode, created_at, notify_teams_on_complete (boolean), results_notified_at, results_notification_sent_count (integer), org_id (uuid) → organizations.id NOT NULL, settings (jsonb), default_contact_member_id (uuid) → organization_members.id, notify_mode, public_hidden_pages (jsonb), contact_show_on_public (boolean), contact_show_to_coaches (boolean), sport, coach_names_show_on_public (boolean), icon_bg_color, app_name, app_icon_scale, list_in_directory (boolean), directory_province, playoffs_published_at, champions_crowned_at, chat_reminder_last_sent_at, chat_reminder_last_sent_by (uuid), chat_reminder_last_sent_count (integer)
- Indexes: idx_tournaments_created_at, idx_tournaments_results_notified_at, tournaments_default_contact_member_id_idx, tournaments_list_in_directory_idx, tournaments_org_id_idx, tournaments_org_slug_live_unique

### venue_facilities
id (uuid), venue_id (uuid) → diamonds.id NOT NULL, tournament_id (uuid) → tournaments.id NOT NULL, name NOT NULL, facility_type, display_order (integer), notes, source_org_facility_id (uuid) → org_venue_facilities.id, created_at, settings (jsonb)
- Indexes: venue_facilities_source_org_facility_id_idx, venue_facilities_tournament_id_idx, venue_facilities_venue_id_idx

## Module: League

### league_divisions
id (uuid), season_id (uuid) → league_seasons.id NOT NULL, name NOT NULL, capacity (integer), sort_order (integer), created_at, born_from_year, born_to_year, price (numeric), early_price (numeric), note, teams_published_at, teams_published_by (uuid)
- Indexes: league_divisions_season_id_idx

### league_email_log
id (uuid), org_id (uuid) → organizations.id NOT NULL, season_id (uuid) → league_seasons.id NOT NULL, sent_by (uuid) NOT NULL, sent_at, subject NOT NULL, scope NOT NULL, audience NOT NULL, count_sent (integer), count_skipped (integer)
- Indexes: league_email_log_org_id_idx, league_email_log_season_id_idx

### league_games
id (uuid), season_id (uuid) → league_seasons.id NOT NULL, division_id (uuid) → league_divisions.id NOT NULL, home_team_id (uuid) → league_teams.id NOT NULL, away_team_id (uuid) → league_teams.id NOT NULL, scheduled_at, location, home_score (integer), away_score (integer), status, notes, created_at, updated_at, org_id (uuid) → organizations.id NOT NULL, org_venue_id (uuid) → org_venues.id, org_venue_facility_id (uuid) → org_venue_facilities.id, ends_at
- Indexes: idx_league_games_org_venue, idx_league_games_org_venue_facility, league_games_away_team_id_idx, league_games_division_idx, league_games_home_team_id_idx, league_games_org_idx, league_games_schedule_idx, league_games_season_idx

### league_notification_log
id (uuid), season_id (uuid) → league_seasons.id NOT NULL, sent_by (uuid), audience_type NOT NULL, audience_label, subject NOT NULL, recipient_count (integer) NOT NULL, sent_at
- Indexes: league_notification_log_season_id_idx

### league_placement_emails
id (uuid), org_id (uuid) → organizations.id NOT NULL, season_id (uuid) → league_seasons.id NOT NULL, division_id (uuid) → league_divisions.id NOT NULL, kind NOT NULL, guardian_email NOT NULL, registration_ids NOT NULL, status, attempts, from_team_id (uuid) → league_teams.id, created_by (uuid), created_at, sent_at, updated_at, notice_id (uuid) → league_season_notices.id
- Indexes: league_placement_emails_division_idx, league_placement_emails_notice_idx, league_placement_emails_org_id_idx, league_placement_emails_season_idx

### league_player_ratings
registration_id (uuid) → league_registrations.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, season_id (uuid) → league_seasons.id NOT NULL, rating NOT NULL, rated_by (uuid), rated_at
- Indexes: league_player_ratings_org_id_idx, league_player_ratings_season_idx

### league_practice_time
season_id (uuid) → league_seasons.id NOT NULL, division_id (uuid) → league_divisions.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, practice_minutes (integer) NOT NULL, teams_at_once (integer), updated_by (uuid), updated_at
- Indexes: league_practice_time_division_idx, league_practice_time_org_idx

### league_practices
id (uuid), season_id (uuid) → league_seasons.id NOT NULL, division_id (uuid) → league_divisions.id, team_id (uuid) → league_teams.id NOT NULL, scheduled_at, ends_at, location, notes, status, recurrence_group_id (uuid), created_at, updated_at, org_id (uuid) → organizations.id NOT NULL, org_venue_id (uuid) → org_venues.id, org_venue_facility_id (uuid) → org_venue_facilities.id, club_schedule_slot_id (uuid)
- Indexes: idx_league_practices_org_venue, idx_league_practices_org_venue_facility, league_practices_club_slot_uq, league_practices_division_id_idx, league_practices_org_idx, league_practices_recurrence_idx, league_practices_schedule_idx, league_practices_season_idx, league_practices_team_idx

### league_registration_price_changes
id (uuid), org_id (uuid) → organizations.id NOT NULL, season_id (uuid) → league_seasons.id NOT NULL, registration_id (uuid) → league_registrations.id NOT NULL, kind NOT NULL, old_amount (numeric), new_amount (numeric) NOT NULL, reason, refund_entry_id (uuid) → accounting_entries.id, changed_by (uuid), changed_at
- Indexes: league_registration_price_changes_org_idx, league_registration_price_changes_refund_idx, league_registration_price_changes_reg_idx, league_registration_price_changes_season_idx

### league_registrations
id (uuid), season_id (uuid) → league_seasons.id NOT NULL, division_id (uuid) → league_divisions.id, player_first_name NOT NULL, player_last_name NOT NULL, player_date_of_birth, player_jersey_pref, player_position_pref, player_notes, guardian_first_name NOT NULL, guardian_last_name NOT NULL, guardian_email NOT NULL, guardian_phone, status, waitlist_position (integer), team_id (uuid) → league_teams.id, registration_fee_paid (boolean), fee_entry_id (uuid), admin_notes, source, registered_at, updated_at, org_id (uuid) → organizations.id NOT NULL, person_id (uuid) → org_people.id, waiver_accepted_at, signup_ref, signup_position, fee_amount (numeric), accepted_at, ended_at, spot_released (boolean), end_money, end_money_reason, withdraw_requested_at, withdraw_request_note, pay_link_sent_at, team_locked_at, draft_team_id (uuid) → league_teams.id, previous_team_id (uuid) → league_teams.id, team_changed_at
- Indexes: league_registrations_division_idx, league_registrations_guardian_idx, league_registrations_org_id_idx, league_registrations_person_id_idx, league_registrations_season_idx, league_registrations_signup_ref_idx, league_registrations_status_idx, league_registrations_team_id_idx

### league_season_fee_words
season_id (uuid) → league_seasons.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, category_id (uuid) → budget_categories.id NOT NULL, item_id (uuid) → budget_items.id NOT NULL, created_at
- Indexes: league_season_fee_words_category_idx, league_season_fee_words_item_uniq, league_season_fee_words_org_idx

### league_season_notices
id (uuid), org_id (uuid) → organizations.id NOT NULL, season_id (uuid) → league_seasons.id NOT NULL, division_id (uuid) → league_divisions.id, kind NOT NULL, family_count (integer), reached_count (integer), failed_count (integer), created_by (uuid), created_at
- Indexes: league_season_notices_division_idx, league_season_notices_org_idx, league_season_notices_season_idx

### league_seasons
id (uuid), org_id (uuid) → organizations.id NOT NULL, name NOT NULL, slug NOT NULL, sport, status, description, registration_fee (numeric), auto_generate_fees (boolean), auto_approve_under_capacity (boolean), auto_promote_waitlist (boolean), registration_open_at, registration_close_at, season_start_date, season_end_date, waiver_text, created_at, updated_at, draft_state (jsonb), early_bird_until, how_to_pay, ask_email_consent (boolean), registration_closed_at, owing_amber_days, finished_at
- Indexes: league_seasons_org_id_slug_key

### league_slot_uses
slot_id (uuid) → club_schedule_slots.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, season_id (uuid) → league_seasons.id NOT NULL, division_id (uuid) → league_divisions.id NOT NULL, kind NOT NULL, created_by (uuid), created_at, updated_at
- Indexes: league_slot_uses_division_idx, league_slot_uses_org_idx, league_slot_uses_season_idx

### league_team_coaches
id (uuid), org_id (uuid) → organizations.id NOT NULL, season_id (uuid) → league_seasons.id NOT NULL, team_id (uuid) → league_teams.id NOT NULL, name NOT NULL, email NOT NULL, user_id (uuid), token_hash, invited_at, expires_at, accepted_at, removed_at, invited_by (uuid), created_by (uuid), created_at, updated_at, invite_failed_at, first_name, last_name
- Indexes: league_team_coaches_one_per_team, league_team_coaches_org_id_idx, league_team_coaches_season_idx, league_team_coaches_token, league_team_coaches_user_idx

### league_teams
id (uuid), season_id (uuid) → league_seasons.id NOT NULL, division_id (uuid) → league_divisions.id NOT NULL, name NOT NULL, color, coach_name, sort_order (integer), created_at
- Indexes: league_teams_division_id_idx, league_teams_season_id_idx

## Module: Rep Teams

### rep_allocation_credit_parts
credit_id (uuid) → rep_allocation_credits.id NOT NULL, installment_id (uuid) → rep_allocation_installments.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, amount (numeric) NOT NULL
- Indexes: rep_allocation_credit_parts_installment_idx, rep_allocation_credit_parts_org_idx

### rep_allocation_credits
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, split_id (uuid) → rep_allocation_splits.id NOT NULL, allocation_id (uuid) → rep_cost_allocations.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, amount (numeric) NOT NULL, credited_on NOT NULL, reason NOT NULL, hand_back_id (uuid) → club_schedule_hand_backs.id, send_id (uuid) → club_schedule_sends.id, created_by (uuid), created_at
- Indexes: rep_allocation_credits_allocation_idx, rep_allocation_credits_created_by_idx, rep_allocation_credits_hand_back_idx, rep_allocation_credits_org_idx, rep_allocation_credits_program_year_idx, rep_allocation_credits_send_idx, rep_allocation_credits_split_idx, rep_allocation_credits_team_idx

### rep_allocation_installments
id (uuid), split_id (uuid) → rep_allocation_splits.id NOT NULL, installment_number (integer) NOT NULL, amount (numeric) NOT NULL, due_date NOT NULL, paid_at, paid_by (uuid), accounting_entry_id (uuid) → accounting_entries.id, created_at, reminder_sent_at, org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id, sent_on, sent_method, sent_reference, sent_by (uuid), sent_at, paid_on, paid_method, paid_reference, undone_at, undone_by (uuid), undone_reason, carried_by_program_year_id (uuid) → rep_program_years.id, credited_amount (numeric)
- Indexes: rep_allocation_installments_accounting_entry_id_idx, rep_allocation_installments_carried_by_idx, rep_allocation_installments_org_idx, rep_allocation_installments_split_id_installment_number_key, rep_allocation_installments_team_idx

### rep_allocation_reminder_waves
id (uuid), org_id (uuid) → organizations.id NOT NULL, sent_by (uuid), sent_at, team_id (uuid) → rep_teams.id, team_ids, recipient_count (integer) NOT NULL, installment_count (integer) NOT NULL, amount (numeric)
- Indexes: rep_allocation_reminder_waves_org_sent_idx

### rep_allocation_splits
id (uuid), allocation_id (uuid) → rep_cost_allocations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, amount (numeric) NOT NULL, split_method NOT NULL, split_value (numeric) NOT NULL, payment_schedule, notes, created_at, budget_category_id (uuid) → budget_categories.id, budget_item_id (uuid) → budget_items.id
- Indexes: rep_allocation_splits_allocation_id_team_id_key, rep_allocation_splits_budget_category_idx, rep_allocation_splits_budget_item_idx, rep_allocation_splits_org_id_idx, rep_allocation_splits_program_year_id_idx, rep_allocation_splits_team_idx

### rep_budget_lines
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, category_id (uuid) → budget_categories.id, item_id (uuid) → budget_items.id, description NOT NULL, total_amount (numeric) NOT NULL, notes, sort_order (integer), created_at, updated_at, line_kind, split_mode
- Indexes: rep_budget_lines_category_id_idx, rep_budget_lines_item_id_idx, rep_budget_lines_one_line_per_item, rep_budget_lines_org_id_idx, rep_budget_lines_program_year_id_idx, rep_budget_lines_team_year_idx

### rep_budget_periods
id (uuid), budget_line_id (uuid) → rep_budget_lines.id NOT NULL, period_label NOT NULL, period_date, amount (numeric) NOT NULL, sort_order (integer), created_at
- Indexes: rep_budget_periods_line_idx

### rep_cost_allocations
id (uuid), org_id (uuid) → organizations.id NOT NULL, source_entry_id (uuid) → accounting_entries.id, description NOT NULL, total_amount (numeric) NOT NULL, created_by (uuid), created_at, source_budget_line_id (uuid) → org_budget_lines.id, notes
- Indexes: rep_cost_allocations_budget_line_idx, rep_cost_allocations_org_id_idx, rep_cost_allocations_source_entry_id_idx

### rep_development_goal_reviews
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, goal_id (uuid) → rep_player_development_goals.id NOT NULL, reviewed_on NOT NULL, status NOT NULL, note, next_review_on, evidence_measurable_ids, evidence_observation_ids, created_by (uuid), created_at
- Indexes: rep_development_goal_reviews_goal_idx, rep_development_goal_reviews_org_idx, rep_development_goal_reviews_player_idx, rep_development_goal_reviews_team_idx

### rep_document_templates
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id, name NOT NULL, document_type NOT NULL, storage_path NOT NULL, file_name NOT NULL, file_size (bigint) NOT NULL, is_active (boolean), published_by (uuid), created_at
- Indexes: rep_document_templates_org_idx, rep_document_templates_team_id_idx

### rep_dues_credits
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, amount (numeric) NOT NULL, description NOT NULL, credit_date, credit_type, notes, created_by (uuid), created_at, fundraiser_entry_id (uuid) → rep_fundraiser_entries.id, payment_id (uuid) → rep_dues_payments.id, expense_id (uuid) → rep_team_expenses.id, applies_to (jsonb)
- Indexes: rep_dues_credits_expense_id_idx, rep_dues_credits_fundraiser_entry_id_idx, rep_dues_credits_payment_id_idx, rep_dues_credits_player_id_idx, rep_dues_credits_program_year_id_idx, uniq_rep_dues_credits_reimbursement_per_household

### rep_dues_payments
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id, amount (numeric) NOT NULL, received_date NOT NULL, method, note, accounting_entry_id (uuid) → accounting_entries.id, source, created_by (uuid), created_at
- Indexes: idx_rep_dues_payments_year_player, rep_dues_payments_accounting_entry_id_idx, rep_dues_payments_org_id_idx, rep_dues_payments_player_id_idx, rep_dues_payments_team_id_idx

### rep_dues_payout_credits
id (uuid), payout_id (uuid) → rep_dues_payouts.id NOT NULL, credit_id (uuid) → rep_dues_credits.id NOT NULL, amount (numeric) NOT NULL, org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, created_at
- Indexes: idx_dues_payout_credits_credit, idx_dues_payout_credits_org_team, idx_dues_payout_credits_payout, rep_dues_payout_credits_credit_id_key

### rep_dues_payouts
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, amount (numeric) NOT NULL, paid_date NOT NULL, method, note, accounting_entry_id (uuid) → accounting_entries.id, source, created_by (uuid), created_at
- Indexes: idx_rep_dues_payouts_year_player, rep_dues_payouts_accounting_entry_id_idx, rep_dues_payouts_org_id_idx, rep_dues_payouts_player_id_idx, rep_dues_payouts_team_id_idx

### rep_evaluation_not_assessed
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, session_id (uuid) → rep_team_evaluation_sessions.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, measurable_type_id (uuid) → rep_team_measurable_types.id NOT NULL, reason, created_by (uuid), created_at
- Indexes: rep_evaluation_not_assessed_org_idx, rep_evaluation_not_assessed_player_idx, rep_evaluation_not_assessed_team_idx, rep_evaluation_not_assessed_type_idx, rep_evaluation_not_assessed_uniq

### rep_fundraiser_credit_plan
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, fundraiser_id (uuid) → rep_fundraisers.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, share_value (numeric) NOT NULL, share_unit NOT NULL, created_at, updated_at, applies_to (jsonb), arranged_at
- Indexes: rep_fundraiser_credit_plan_fundraiser_id_player_id_key, rep_fundraiser_credit_plan_fundraiser_idx, rep_fundraiser_credit_plan_org_idx, rep_fundraiser_credit_plan_player_idx

### rep_fundraiser_entries
id (uuid), fundraiser_id (uuid) → rep_fundraisers.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, player_id (uuid) → rep_roster_players.id, amount_raised (numeric) NOT NULL, rebate_percent (numeric), rebate_amount (numeric), accounting_entry_id (uuid) → accounting_entries.id, credit_id (uuid) → rep_dues_credits.id, notes, created_at, updated_at, received_date, method
- Indexes: rep_fundraiser_entries_accounting_entry_id_idx, rep_fundraiser_entries_credit_id_idx, rep_fundraiser_entries_fundraiser_idx, rep_fundraiser_entries_org_id_idx, rep_fundraiser_entries_player_idx, rep_fundraiser_entries_team_id_idx

### rep_fundraisers
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, name NOT NULL, description, player_rebate_percent (numeric), start_date, end_date, is_active (boolean), created_at, updated_at, kind, sponsor_status, pledged_amount (numeric), expected_by, budget_item_id (uuid) → budget_items.id, budget_category_id (uuid) → budget_categories.id
- Indexes: idx_rep_fundraisers_budget_item, rep_fundraisers_org_id_idx, rep_fundraisers_program_year_id_idx, rep_fundraisers_team_year_idx

### rep_payable_installments
id (uuid), expense_id (uuid) → rep_team_expenses.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, installment_number (integer) NOT NULL, amount (numeric) NOT NULL, due_date NOT NULL, source, created_at, updated_at
- Indexes: rep_payable_installments_expense_idx, rep_payable_installments_number_key, rep_payable_installments_org_id_idx, rep_payable_installments_team_due_idx, rep_payable_installments_year_idx

### rep_payable_payments
id (uuid), expense_id (uuid) → rep_team_expenses.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, installment_id (uuid) → rep_payable_installments.id, amount (numeric) NOT NULL, paid_date NOT NULL, method, note, accounting_entry_id (uuid) → accounting_entries.id, source, created_by (uuid), created_at, paid_by_player_id (uuid) → rep_roster_players.id
- Indexes: idx_rep_payable_payments_paid_by, rep_payable_payments_entry_idx, rep_payable_payments_expense_idx, rep_payable_payments_installment_idx, rep_payable_payments_org_id_idx, rep_payable_payments_team_date_idx, rep_payable_payments_year_idx

### rep_player_awards
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, award_type_id (uuid) → rep_team_award_types.id NOT NULL, event_id (uuid) → rep_team_events.id, tournament_label, awarded_at NOT NULL, note, created_by (uuid), created_at, updated_at
- Indexes: rep_player_awards_event_idx, rep_player_awards_once_per_game_uniq, rep_player_awards_once_per_general_occasion_uniq, rep_player_awards_org_idx, rep_player_awards_player_idx, rep_player_awards_team_idx, rep_player_awards_type_idx

### rep_player_continuity_links
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, current_roster_id (uuid) → rep_roster_players.id, current_registration_id (uuid) → rep_tryout_registrations.id, prior_roster_id (uuid) → rep_roster_players.id, prior_registration_id (uuid) → rep_tryout_registrations.id, status, confidence NOT NULL, decided_by (uuid), decided_at, created_at, updated_at, carry_status, carry_decided_by (uuid), carry_decided_at
- Indexes: rep_player_continuity_links_confirmed_uniq, rep_player_continuity_links_org_idx, rep_player_continuity_links_pair_uniq, rep_player_continuity_links_prior_idx, rep_player_continuity_links_team_idx

### rep_player_development_goals
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, focus_area NOT NULL, note, status, created_by (uuid), created_at, updated_at, tag_id (uuid) → rep_team_tags.id, success, review_on, origin
- Indexes: rep_player_development_goals_id_team_uniq, rep_player_development_goals_org_idx, rep_player_development_goals_player_idx, rep_player_development_goals_tag_idx, rep_player_development_goals_team_idx

### rep_player_documents
id (uuid), player_id (uuid) → rep_roster_players.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, document_type NOT NULL, storage_path NOT NULL, file_name NOT NULL, file_size (bigint) NOT NULL, template_id (uuid) → rep_document_templates.id, uploaded_by (uuid), created_at
- Indexes: rep_player_documents_org_id_idx, rep_player_documents_player_idx, rep_player_documents_team_idx, rep_player_documents_template_id_idx

### rep_player_dues_installments
id (uuid), schedule_id (uuid) → rep_player_dues_schedules.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, installment_number (integer) NOT NULL, amount (numeric) NOT NULL, due_date NOT NULL, paid_at, reminder_sent_at, accounting_entry_id (uuid) → accounting_entries.id, created_at, source, reminder_30_sent_at, reminder_7_sent_at, org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id
- Indexes: rep_player_dues_installments_accounting_entry_id_idx, rep_player_dues_installments_due_idx, rep_player_dues_installments_org_idx, rep_player_dues_installments_player_id_idx, rep_player_dues_installments_schedule_id_installment_number_key, rep_player_dues_installments_team_idx

### rep_player_dues_schedules
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, total_amount (numeric) NOT NULL, notes, created_at, updated_at, budget_line_id (uuid) → rep_budget_lines.id
- Indexes: rep_player_dues_schedules_budget_line_id_idx, rep_player_dues_schedules_org_id_idx, rep_player_dues_schedules_player_id_idx, rep_player_dues_schedules_program_year_id_player_id_key, rep_player_dues_schedules_team_id_idx

### rep_player_measurables
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, measurable_type_id (uuid) → rep_team_measurable_types.id NOT NULL, value (numeric) NOT NULL, unit NOT NULL, recorded_on NOT NULL, note, created_by (uuid), created_at, updated_at, session_id (uuid) → rep_team_evaluation_sessions.id, attempt_no, corrected_from (numeric), corrected_at, corrected_by (uuid)
- Indexes: rep_player_measurables_org_idx, rep_player_measurables_player_idx, rep_player_measurables_session_attempt_uniq, rep_player_measurables_session_idx, rep_player_measurables_team_idx, rep_player_measurables_type_idx

### rep_player_notes
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, noted_on NOT NULL, body NOT NULL, goal_id (uuid) → rep_player_development_goals.id, event_id (uuid) → rep_team_events.id, created_by (uuid), created_at, updated_at
- Indexes: rep_player_notes_event_idx, rep_player_notes_goal_idx, rep_player_notes_org_idx, rep_player_notes_player_idx, rep_player_notes_team_idx

### rep_player_observations
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, measurable_type_id (uuid) → rep_team_measurable_types.id NOT NULL, metric_kind → rep_team_measurable_types.kind, observed_on NOT NULL, note, descriptor, goal_id (uuid) → rep_player_development_goals.id, session_id (uuid) → rep_team_evaluation_sessions.id, created_by (uuid), created_at, updated_at
- Indexes: rep_player_observations_goal_idx, rep_player_observations_org_idx, rep_player_observations_player_idx, rep_player_observations_session_idx, rep_player_observations_team_idx, rep_player_observations_type_idx

### rep_player_tryout_baselines
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, roster_player_id (uuid) → rep_roster_players.id NOT NULL, tryout_registration_id (uuid) → rep_tryout_registrations.id, snapshot (jsonb) NOT NULL, seeded_by (uuid), seeded_at
- Indexes: rep_player_tryout_baselines_org_id_idx, rep_player_tryout_baselines_player_year_uniq, rep_player_tryout_baselines_team_idx, rep_player_tryout_baselines_tryout_registration_id_idx, rep_player_tryout_baselines_year_idx

### rep_program_years
id (uuid), team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, name NOT NULL, year (integer) NOT NULL, status, tryout_open (boolean), tryout_description, budget_amount (numeric), created_at, updated_at, auto_reminders_enabled (boolean), lineup_settings (jsonb), credit_application, default_player_credit_percent (numeric), opening_balance (numeric), opening_balance_from_year_id (uuid) → rep_program_years.id, born_from_year, born_to_year, born_years_carried (boolean)
- Indexes: rep_program_years_org_id_idx, rep_program_years_team_id_year_key

### rep_roster_players
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, player_first_name NOT NULL, player_last_name, player_date_of_birth, player_number, guardian_first_name, guardian_last_name, guardian_email, guardian_phone, status, source, tryout_registration_id (uuid) → rep_tryout_registrations.id, notes, admin_notes, created_at, updated_at, primary_position, secondary_position, display_order (integer), source_basic_player_id (uuid), medical_notes, emergency_contact_name, emergency_contact_phone, bats, throws, jersey_size, lineup_profile (jsonb), person_id (uuid) → org_people.id
- Indexes: rep_roster_players_email_idx, rep_roster_players_id_team_uniq, rep_roster_players_org_id_idx, rep_roster_players_person_id_idx, rep_roster_players_src_basic_player_uq, rep_roster_players_team_id_idx, rep_roster_players_tryout_registration_id_idx, rep_roster_players_year_idx, rep_roster_players_year_status_idx

### rep_season_refund_adjustments
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, kind NOT NULL, amount (numeric), note, created_by (uuid), created_at, updated_at
- Indexes: idx_rep_season_refund_adjustments_year, rep_season_refund_adjustments_org_id_idx, rep_season_refund_adjustments_player_id_idx, rep_season_refund_adjustments_program_year_id_player_id_key, rep_season_refund_adjustments_team_id_idx

### rep_season_surplus
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, total_surplus (numeric), notes, created_by (uuid), created_at, updated_at, hold_back_amount (numeric)
- Indexes: rep_season_surplus_program_year_id_key

### rep_sponsor_invoices
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, fundraiser_id (uuid) → rep_fundraisers.id, season_year (integer) NOT NULL, seq (integer) NOT NULL, bill_to_name NOT NULL, bill_to_attention, bill_to_email, bill_to_address, description NOT NULL, amount (numeric) NOT NULL, issued_on NOT NULL, due_on, revised_on, created_by (uuid), created_at, updated_at
- Indexes: rep_sponsor_invoices_fundraiser_uniq, rep_sponsor_invoices_number_uniq, rep_sponsor_invoices_org_idx, rep_sponsor_invoices_year_idx

### rep_team_announcements
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, subject NOT NULL, body NOT NULL, recipient_count (integer), sent_count (integer), failed_count (integer), status, sent_at, created_by (uuid), created_at, updated_at
- Indexes: rep_team_announcements_org_id_idx, rep_team_announcements_team_id_idx, rep_team_announcements_year_idx

### rep_team_award_types
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id, name NOT NULL, emoji, sort_order (integer), is_active (boolean), created_by (uuid), created_at, updated_at
- Indexes: rep_team_award_types_name_uniq, rep_team_award_types_org_idx, rep_team_award_types_org_name_uniq, rep_team_award_types_org_shared_idx, rep_team_award_types_team_idx

### rep_team_call_up_appearances
id (uuid), event_id (uuid) → rep_team_events.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, created_by (uuid), created_at
- Indexes: rep_team_call_up_appearances_event_player_uniq, rep_team_call_up_appearances_org_id_idx, rep_team_call_up_appearances_player_idx, rep_team_call_up_appearances_year_idx

### rep_team_circuit_tags
circuit_id (uuid) → rep_team_circuits.id NOT NULL, tag_id (uuid) → rep_team_tags.id NOT NULL, created_at
- Indexes: rep_team_circuit_tags_tag_idx

### rep_team_circuits
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, name NOT NULL, block (jsonb), is_active (boolean), created_by (uuid), created_at, updated_at
- Indexes: rep_team_circuits_name_uniq, rep_team_circuits_org_idx, rep_team_circuits_team_idx

### rep_team_coaches
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, user_id (uuid) NOT NULL, coach_role, created_at, capabilities (jsonb)
- Indexes: rep_team_coaches_program_year_id_user_id_key, rep_team_coaches_team_id_idx, rep_team_coaches_user_idx

### rep_team_drill_tags
drill_id (uuid) → rep_team_drills.id NOT NULL, tag_id (uuid) → rep_team_tags.id NOT NULL, created_at
- Indexes: rep_team_drill_tags_tag_idx

### rep_team_drills
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id, name NOT NULL, usual_minutes (integer), description, goal, coaching_points (jsonb), setup, equipment (jsonb), is_active (boolean), sort_order (integer), created_by (uuid), created_at, updated_at, equipment_tag_ids (jsonb)
- Indexes: rep_team_drills_org_idx, rep_team_drills_org_shared_name_uniq, rep_team_drills_team_idx, rep_team_drills_team_name_uniq

### rep_team_evaluation_sessions
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, session_date NOT NULL, note, created_by (uuid), created_at, updated_at, event_id (uuid) → rep_team_events.id, scope_metric_ids, scope_player_ids, scope_attempts (jsonb)
- Indexes: rep_team_eval_sessions_event_idx, rep_team_evaluation_sessions_id_team_uniq, rep_team_evaluation_sessions_org_idx, rep_team_evaluation_sessions_py_idx, rep_team_evaluation_sessions_team_idx

### rep_team_event_attendance
id (uuid), event_id (uuid) → rep_team_events.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, status, note, updated_by (uuid), created_at, updated_at
- Indexes: rep_team_event_attendance_event_id_player_id_key, rep_team_event_attendance_event_idx, rep_team_event_attendance_org_id_idx, rep_team_event_attendance_player_idx, rep_team_event_attendance_program_year_id_idx, rep_team_event_attendance_team_idx

### rep_team_event_tags
event_id (uuid) → rep_team_events.id NOT NULL, tag_id (uuid) → rep_team_tags.id NOT NULL, created_at
- Indexes: rep_team_event_tags_tag_idx

### rep_team_events
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, event_type NOT NULL, name NOT NULL, description, starts_at NOT NULL, ends_at, location, opponent, home_away, team_score (integer), opponent_score (integer), result, parent_event_id (uuid) → rep_team_events.id, is_recurring (boolean), recurrence_rule (jsonb), recurrence_parent_id (uuid) → rep_team_events.id, created_at, updated_at, status, source_basic_event_id (uuid), arrival_time, field_number, uniform, location_address, resources (jsonb), source_tournament_game_id (uuid), practice_plan (jsonb), family_shared_at, family_shared_by (uuid), practice_recap, practice_plan_sent_at, practice_plan_sent_by (uuid), practice_plan_sent_audience, practice_plan_sent_count, practice_plan_sent_email (boolean), practice_plan_sent_to, is_scrimmage (boolean), place_id (uuid) → rep_team_places.id, org_venue_id (uuid) → org_venues.id, org_venue_facility_id (uuid) → org_venue_facilities.id, club_schedule_slot_id (uuid)
- Indexes: rep_team_events_club_booking_idx, rep_team_events_club_slot_idx, rep_team_events_club_slot_uq, rep_team_events_family_shared_idx, rep_team_events_org_id_idx, rep_team_events_org_venue_facility_idx, rep_team_events_org_venue_idx, rep_team_events_parent_idx, rep_team_events_place_idx, rep_team_events_recurrence_parent_id_idx, rep_team_events_src_basic_event_uq, rep_team_events_src_tournament_game_uq, rep_team_events_team_id_idx, rep_team_events_year_idx

### rep_team_expense_tags
expense_id (uuid) → rep_team_expenses.id NOT NULL, tag_id (uuid) → rep_team_tags.id NOT NULL, created_at
- Indexes: rep_team_expense_tags_tag_idx

### rep_team_expenses
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, expense_type NOT NULL, description NOT NULL, category, amount (numeric) NOT NULL, event_id (uuid) → rep_team_events.id, accounting_entry_id (uuid) → accounting_entries.id, created_by (uuid), created_at, updated_at, payment_method, payee_id (uuid) → org_payees.id, payee_payer, notes, paid_by_player_id (uuid) → rep_roster_players.id, budget_category_id (uuid) → budget_categories.id, budget_item_id (uuid) → budget_items.id
- Indexes: idx_rep_team_expenses_budget_item, rep_team_expenses_accounting_entry_id_idx, rep_team_expenses_budget_category_id_idx, rep_team_expenses_event_id_idx, rep_team_expenses_org_id_idx, rep_team_expenses_paid_by_player_id_idx, rep_team_expenses_payee_id_idx, rep_team_expenses_team_id_idx, rep_team_expenses_year_idx

### rep_team_fundraiser_tags
fundraiser_id (uuid) → rep_fundraisers.id NOT NULL, tag_id (uuid) → rep_team_tags.id NOT NULL, created_at
- Indexes: rep_team_fundraiser_tags_tag_idx

### rep_team_game_moments
id (uuid), team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, event_id (uuid) → rep_team_events.id NOT NULL, player_id (uuid) → rep_roster_players.id, body NOT NULL, happened_at, created_by (uuid), created_by_name, created_at
- Indexes: idx_rep_team_game_moments_event, idx_rep_team_game_moments_season_player, rep_team_game_moments_event_id_idx, rep_team_game_moments_org_id_idx, rep_team_game_moments_player_id_idx, rep_team_game_moments_program_year_id_idx

### rep_team_groups
id (uuid), org_id (uuid) → organizations.id NOT NULL, name NOT NULL, display_order (integer), created_at
- Indexes: idx_rep_team_groups_org_name

### rep_team_import_events
id (uuid), team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, dataset NOT NULL, shape NOT NULL, source NOT NULL, source_filename, rows_created (integer), rows_updated (integer), rows_skipped (integer), rows_failed (integer), created_by (uuid), created_by_name, created_at
- Indexes: idx_rep_team_import_events_season, rep_team_import_events_org_id_idx, rep_team_import_events_program_year_id_idx

### rep_team_lineup_entries
id (uuid), lineup_id (uuid) → rep_team_lineups.id NOT NULL, player_id (uuid) → rep_roster_players.id NOT NULL, batting_order (integer), starter (boolean), inning_positions (jsonb), notes, created_at, updated_at
- Indexes: rep_team_lineup_entries_batting_order_idx, rep_team_lineup_entries_lineup_id_player_id_key, rep_team_lineup_entries_lineup_idx, rep_team_lineup_entries_player_idx

### rep_team_lineup_templates
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, name NOT NULL, lineup_mode, inning_count (integer), entries (jsonb), created_by (uuid), created_at, updated_at
- Indexes: rep_team_lineup_templates_name_uniq, rep_team_lineup_templates_org_idx, rep_team_lineup_templates_program_year_id_idx, rep_team_lineup_templates_team_idx

### rep_team_lineups
id (uuid), event_id (uuid) → rep_team_events.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, lineup_mode, inning_count (integer), notes, updated_by (uuid), created_at, updated_at, rules_override (jsonb), status, ready_at, ready_by (uuid)
- Indexes: rep_team_lineups_event_id_key, rep_team_lineups_event_idx, rep_team_lineups_org_idx, rep_team_lineups_program_year_id_idx, rep_team_lineups_team_idx

### rep_team_measurable_types
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, name NOT NULL, unit, sort_order (integer), is_active (boolean), created_by (uuid), created_at, updated_at, kind, aim, range_from (numeric), range_to (numeric), method, attempts_per_session, headline, descriptors
- Indexes: rep_team_measurable_types_id_team_kind_uniq, rep_team_measurable_types_id_team_uniq, rep_team_measurable_types_name_uniq, rep_team_measurable_types_org_idx, rep_team_measurable_types_team_idx

### rep_team_money_in
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id, entry_kind NOT NULL, amount (numeric) NOT NULL, received_date NOT NULL, budget_category_id (uuid) → budget_categories.id, budget_item_id (uuid) → budget_items.id, description, notes, received_from, accounting_entry_id (uuid) → accounting_entries.id, created_by (uuid), created_at, updated_at
- Indexes: idx_rep_team_money_in_item, idx_rep_team_money_in_year, rep_team_money_in_accounting_entry_id_idx, rep_team_money_in_budget_category_id_idx, rep_team_money_in_org_id_idx, rep_team_money_in_team_id_idx

### rep_team_opponent_aliases
id (uuid), opponent_id (uuid) → rep_team_opponents.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, normalized_alias NOT NULL, created_at
- Indexes: idx_rep_team_opponent_aliases_opponent, idx_rep_team_opponent_aliases_org, rep_team_opponent_aliases_team_alias_uq

### rep_team_opponent_observations
id (uuid), opponent_id (uuid) → rep_team_opponents.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, event_id (uuid) → rep_team_events.id, body NOT NULL, tag, created_by (uuid), created_by_name, created_at
- Indexes: idx_rep_team_opponent_obs_event, idx_rep_team_opponent_obs_opponent, idx_rep_team_opponent_obs_team, rep_team_opponent_observations_org_id_idx

### rep_team_opponents
id (uuid), team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, display_name NOT NULL, normalized_name NOT NULL, summary, last_note_updated_at, updated_by (uuid), created_at, updated_at
- Indexes: idx_rep_team_opponents_org, idx_rep_team_opponents_team, rep_team_opponents_team_name_uq

### rep_team_payment_requests
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, request_type NOT NULL, amount (numeric) NOT NULL, description NOT NULL, payment_method, notes, status, denial_reason, budget_line_id (uuid) → org_budget_lines.id, accounting_entry_id (uuid) → accounting_entries.id, created_by (uuid) NOT NULL, reviewed_by (uuid), reviewed_at, created_at, updated_at, program_year_id (uuid) → rep_program_years.id NOT NULL, budget_category_id (uuid) → budget_categories.id, budget_item_id (uuid) → budget_items.id, money_in_meaning, paid_on, paid_method, paid_reference, reversed_at, reversed_by (uuid), reversed_reason, payout_hold_told_at, club_hand_back_id (uuid) → club_schedule_hand_backs.id, club_schedule_send_id (uuid) → club_schedule_sends.id
- Indexes: rep_team_payment_requests_accounting_entry_id_idx, rep_team_payment_requests_budget_category_idx, rep_team_payment_requests_budget_item_idx, rep_team_payment_requests_budget_line_id_idx, rep_team_payment_requests_hand_back_uq, rep_team_payment_requests_org_status_idx, rep_team_payment_requests_program_year_id_idx, rep_team_payment_requests_program_year_idx, rep_team_payment_requests_send_idx, rep_team_payment_requests_team_status_idx

### rep_team_places
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, name NOT NULL, address, field_number, note, created_by (uuid), created_at, updated_at
- Indexes: rep_team_places_name_uniq, rep_team_places_org_idx, rep_team_places_team_idx

### rep_team_plan_template_tags
template_id (uuid) → rep_team_plan_templates.id NOT NULL, tag_id (uuid) → rep_team_tags.id NOT NULL, created_at
- Indexes: rep_team_plan_template_tags_tag_idx

### rep_team_plan_templates
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, name NOT NULL, plan (jsonb), is_active (boolean), created_by (uuid), created_at, updated_at
- Indexes: rep_team_plan_templates_name_uniq, rep_team_plan_templates_org_idx, rep_team_plan_templates_team_idx

### rep_team_staff_memberships
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, user_id (uuid) NOT NULL, coach_role NOT NULL, capabilities (jsonb), status, created_at, revoked_at, revoked_by (uuid), staff_kind, calendar_link_generation (integer), calendar_last_read_on, show_name_public (boolean)
- Indexes: rep_team_staff_memberships_org_user_idx, rep_team_staff_memberships_team_idx, rep_team_staff_memberships_team_user_key

### rep_team_tags
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id, kind NOT NULL, name NOT NULL, created_by (uuid), created_at, updated_at, user_id (uuid)
- Indexes: rep_team_tags_name_uniq, rep_team_tags_org_idx, rep_team_tags_org_name_uniq, rep_team_tags_org_shared_idx, rep_team_tags_team_idx, rep_team_tags_team_user_uniq

### rep_team_tournament_registrations
id (uuid), tournament_team_id (uuid) → teams.id NOT NULL, rep_team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, linked_by_user_id (uuid), link_source, created_at
- Indexes: rep_team_tournament_registrations_org_idx, rep_team_tournament_registrations_rep_team_idx, rep_team_tournament_registrations_tournament_team_unique

### rep_team_tryout_contacts
team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, email, set_by_membership_id (uuid) → rep_team_staff_memberships.id, set_at, reset_at, reset_by (uuid), updated_at
- Indexes: idx_rep_team_tryout_contacts_org, idx_rep_team_tryout_contacts_setter

### rep_teams
id (uuid), org_id (uuid) → organizations.id NOT NULL, name NOT NULL, slug NOT NULL, sport, division, description, color, is_archived (boolean), created_at, updated_at, group_id (uuid) → rep_team_groups.id, schedule_visibility, share_club_book (boolean), pdf_settings (jsonb), arrival_before_game_min (integer), arrival_before_practice_min (integer), sponsor_payment_details (jsonb)
- Indexes: idx_rep_teams_org_share_club_book, rep_teams_group_id_idx, rep_teams_org_id_slug_key

### rep_tryout_evaluator_sessions
id (uuid), tryout_id (uuid) → rep_tryouts.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, evaluator_name, token_hash NOT NULL, expires_at NOT NULL, revoked_at, created_at
- Indexes: rep_tryout_evaluator_sessions_org_idx, rep_tryout_evaluator_sessions_team_id_program_year_id_idx, rep_tryout_evaluator_sessions_token_uq, rep_tryout_evaluator_sessions_tryout_idx

### rep_tryout_registrations
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, player_first_name NOT NULL, player_last_name NOT NULL, player_date_of_birth, player_notes, guardian_first_name NOT NULL, guardian_last_name NOT NULL, guardian_email NOT NULL, guardian_phone, status, admin_notes, submitted_at, updated_at, consent_data_collection (boolean), consent_email_comms (boolean), consent_eligibility (boolean), consent_at, consent_ip, bib_number, is_checked_in (boolean), checked_in_at, offer_token_hash, offer_sent_at, offer_expires_at, offer_response, offer_responded_at, first_offered_at, person_id (uuid) → org_people.id, last_season_team
- Indexes: rep_tryout_registrations_bib_uq, rep_tryout_registrations_email_idx, rep_tryout_registrations_id_team_uniq, rep_tryout_registrations_offer_token_uq, rep_tryout_registrations_org_id_idx, rep_tryout_registrations_person_id_idx, rep_tryout_registrations_status_idx, rep_tryout_registrations_team_id_idx, rep_tryout_registrations_year_idx

### rep_tryout_rubrics
id (uuid), tryout_id (uuid) → rep_tryouts.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, name, scale_max, categories (jsonb), created_at, updated_at
- Indexes: rep_tryout_rubrics_org_idx, rep_tryout_rubrics_program_year_id_idx, rep_tryout_rubrics_team_idx, rep_tryout_rubrics_tryout_uq

### rep_tryout_scores
id (uuid), evaluator_session_id (uuid) → rep_tryout_evaluator_sessions.id NOT NULL, registration_id (uuid) → rep_tryout_registrations.id NOT NULL, tryout_id (uuid) → rep_tryouts.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, category_key NOT NULL, score NOT NULL, note, created_at, updated_at
- Indexes: rep_tryout_scores_evaluator_session_id_registration_id_cate_key, rep_tryout_scores_org_idx, rep_tryout_scores_reg_idx, rep_tryout_scores_team_id_program_year_id_idx, rep_tryout_scores_tryout_idx

### rep_tryout_sessions
id (uuid), tryout_id (uuid) → rep_tryouts.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, starts_at NOT NULL, ends_at, location, location_address, field_number, label, status, created_at, updated_at, org_venue_id (uuid) → org_venues.id, org_venue_facility_id (uuid) → org_venue_facilities.id
- Indexes: rep_tryout_sessions_club_booking_idx, rep_tryout_sessions_org_idx, rep_tryout_sessions_org_venue_facility_idx, rep_tryout_sessions_org_venue_idx, rep_tryout_sessions_starts_idx, rep_tryout_sessions_team_idx, rep_tryout_sessions_tryout_idx, rep_tryout_sessions_year_idx

### rep_tryouts
id (uuid), program_year_id (uuid) → rep_program_years.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, is_anonymous (boolean), scores_locked_at, scores_locked_by (uuid), created_at, updated_at, names_shown_at
- Indexes: rep_tryouts_org_idx, rep_tryouts_program_year_uq, rep_tryouts_team_idx

## Module: Standalone Team Workspace

### basic_coach_team_registrations
id (uuid), basic_coach_team_id (uuid) → basic_coach_teams.id NOT NULL, tournament_team_id (uuid) → teams.id NOT NULL, linked_by_user_id (uuid), link_source, created_at
- Indexes: basic_coach_team_registrations_basic_team_idx, basic_coach_team_registrations_tournament_team_unique

### basic_coach_team_users
id (uuid), basic_coach_team_id (uuid) → basic_coach_teams.id NOT NULL, user_id (uuid) NOT NULL, role, status, created_at, updated_at
- Indexes: basic_coach_team_users_team_user_unique, basic_coach_team_users_user_status_idx

### team_entitlements
id (uuid), team_workspace_id (uuid) → team_workspaces.id, org_id (uuid) → organizations.id NOT NULL, rep_team_id (uuid) → rep_teams.id NOT NULL, source NOT NULL, status, starts_at, ends_at, stripe_subscription_item_id, created_at, updated_at
- Indexes: team_entitlements_active_source_unique, team_entitlements_org_team_idx, team_entitlements_rep_team_id_idx, team_entitlements_workspace_idx

### team_org_links
id (uuid), team_workspace_id (uuid) → team_workspaces.id NOT NULL, rep_team_id (uuid) → rep_teams.id NOT NULL, linked_org_id (uuid) → organizations.id NOT NULL, status, link_type, sharing_level, requested_by_user_id (uuid), approved_by_team_user_id (uuid), approved_by_org_user_id (uuid), billing_mode_after_approval, created_at, updated_at
- Indexes: team_org_links_active_unique, team_org_links_linked_org_idx, team_org_links_one_open_request, team_org_links_rep_team_id_idx, team_org_links_workspace_idx

### team_workspace_claims
id (uuid), tournament_id (uuid) → tournaments.id NOT NULL, tournament_team_id (uuid), contact_email NOT NULL, claim_token_hash NOT NULL, status, team_workspace_id (uuid) → team_workspaces.id, claimed_by_user_id (uuid), expires_at, created_at, claimed_at
- Indexes: team_workspace_claims_contact_email_idx, team_workspace_claims_team_workspace_id_idx, team_workspace_claims_token_hash_unique, team_workspace_claims_tournament_idx

### team_workspaces
id (uuid), workspace_org_id (uuid) → organizations.id NOT NULL, rep_team_id (uuid) → rep_teams.id NOT NULL, active_program_year_id (uuid) → rep_program_years.id, primary_owner_user_id (uuid), source, source_tournament_id (uuid) → tournaments.id, source_tournament_team_id (uuid), workspace_state, billing_mode, billing_owner_org_id (uuid) → organizations.id, billing_owner_user_id (uuid), stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end, created_at, updated_at, basic_coach_team_id (uuid) → basic_coach_teams.id, migration_summary (jsonb)
- Indexes: team_workspaces_active_program_year_id_idx, team_workspaces_basic_coach_team_idx, team_workspaces_billing_owner_org_id_idx, team_workspaces_rep_team_unique, team_workspaces_source_tournament_idx, team_workspaces_state_idx, team_workspaces_stripe_subscription_id_uniq, team_workspaces_workspace_org_unique

## Module: Accounting

### accounting_entries
id (uuid), ledger_id (uuid) → accounting_ledgers.id NOT NULL, entry_date NOT NULL, description NOT NULL, amount (numeric) NOT NULL, entry_type NOT NULL, status, category, linked_entry_id (uuid) → accounting_entries.id, source_module, source_entity_id (uuid), created_by (uuid), created_at, updated_at, payment_method, payee_id (uuid) → org_payees.id, payee_payer, notes, void_reason, voided_by (uuid), voided_at, budget_category_id (uuid) → budget_categories.id, budget_item_id (uuid) → budget_items.id, written_on
- Indexes: accounting_entries_budget_category_id_idx, accounting_entries_budget_item_id_idx, accounting_entries_entry_date_idx, accounting_entries_league_registration_idx, accounting_entries_ledger_id_idx, accounting_entries_linked_entry_id_idx, accounting_entries_payee_id_idx

### accounting_ledgers
id (uuid), org_id (uuid) → organizations.id NOT NULL, entity_type NOT NULL, entity_id (uuid), name NOT NULL, currency, is_archived (boolean), created_at
- Indexes: accounting_ledgers_one_org_general, accounting_ledgers_org_id_entity_type_entity_id_key

### billing_retained_records
id (uuid), intent_id (uuid) → billing_retention_intents.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, record_type NOT NULL, record_id (uuid), display_name NOT NULL, retained_state, retained_at, retention_until NOT NULL, extension_count (integer), last_extended_at, last_extended_by, last_extension_reason, metadata (jsonb), warning_sent_at, pending_purge_at, purge_notice_sent_at
- Indexes: billing_retained_records_intent_id_idx, idx_billing_retained_records_active_unique, idx_billing_retained_records_org, idx_billing_retained_records_pending_purge, idx_billing_retained_records_retention, idx_billing_retained_records_warning

### billing_retention_intents
id (uuid), org_id (uuid) → organizations.id NOT NULL, intent_type NOT NULL, status, from_plan, target_plan, keep_tournament_ids, effective_at, retention_until NOT NULL, reason, created_by (uuid), created_by_email, created_at, updated_at, applied_at
- Indexes: idx_billing_retention_intents_org, idx_billing_retention_intents_retention

### budget_categories
id (uuid), org_id (uuid) → organizations.id, name NOT NULL, scope, sort_order (integer), is_default (boolean), created_at, sports, team_id (uuid) → rep_teams.id, income_source
- Indexes: budget_categories_org_idx, budget_categories_team_idx

### budget_items
id (uuid), category_id (uuid) → budget_categories.id NOT NULL, org_id (uuid) → organizations.id, name NOT NULL, suggested_amount (numeric), sort_order (integer), is_default (boolean), is_misc (boolean), created_at, team_id (uuid) → rep_teams.id, sports, direction NOT NULL, actual_source
- Indexes: budget_items_category_idx, budget_items_org_idx, budget_items_team_idx, budget_items_unique_default_name, budget_items_unique_scope_side_name

### org_budget_lines
id (uuid), org_id (uuid) → organizations.id NOT NULL, season_year (integer) NOT NULL, category_id (uuid) → budget_categories.id, item_id (uuid) → budget_items.id, description NOT NULL, total_amount (numeric) NOT NULL, notes, sort_order (integer), created_at, updated_at, fiscal_year_id (uuid) → org_fiscal_years.id NOT NULL
- Indexes: org_budget_lines_category_id_idx, org_budget_lines_fiscal_year_idx, org_budget_lines_item_id_idx, org_budget_lines_one_word_per_fiscal_year, org_budget_lines_org_year_idx

### org_budget_periods
id (uuid), budget_line_id (uuid) → org_budget_lines.id NOT NULL, period_label NOT NULL, period_date, amount (numeric) NOT NULL, sort_order (integer), created_at
- Indexes: org_budget_periods_line_idx

### org_payees
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id, name NOT NULL, notes, is_active (boolean), created_by (uuid), created_at, shared_with_teams (boolean), shared_at
- Indexes: idx_org_payees_org_id, idx_org_payees_org_name, idx_org_payees_team_id, idx_org_payees_team_name

## Module: Stripe / Billing

### stripe_connect_events
id NOT NULL, type NOT NULL, account, livemode (boolean), org_id (uuid), received_at, processed_at, attempts (integer), error
- Indexes: stripe_connect_events_org_id_idx, stripe_connect_events_received_idx, stripe_connect_events_unprocessed_idx

### stripe_prices
id (uuid), plan_id NOT NULL, billing_cycle NOT NULL, environment NOT NULL, price_id, product_name, created_at, updated_at, last_change_note, updated_by_email
- Indexes: stripe_prices_plan_id_billing_cycle_environment_key

## Module: Organization / Platform Core

### org_audit_log
id (uuid), org_id (uuid) → organizations.id NOT NULL, actor_id (uuid), target_id (uuid), action NOT NULL, payload (jsonb), created_at
- Indexes: idx_audit_log_org

### org_internal_notes
id (uuid), org_id (uuid) → organizations.id NOT NULL, body NOT NULL, created_by_email NOT NULL, updated_by_email, created_at, updated_at, deleted_at, deleted_by_email
- Indexes: idx_org_internal_notes_org_deleted_time, idx_org_internal_notes_org_time, org_internal_notes_org_id_idx

### org_member_rep_group_scopes
member_id (uuid) → organization_members.id NOT NULL, group_id (uuid) → rep_team_groups.id NOT NULL
- Indexes: idx_org_member_rep_group_scopes_member, org_member_rep_group_scopes_group_id_idx

### org_member_tournament_assignments
id (uuid), org_member_id (uuid) → organization_members.id NOT NULL, tournament_id (uuid) → tournaments.id NOT NULL, created_at
- Indexes: idx_omta_org_member, idx_omta_tournament, org_member_tournament_assignmen_org_member_id_tournament_id_key

### org_overrides
id (uuid), org_id (uuid) → organizations.id NOT NULL, type NOT NULL, value, expires_at, reason NOT NULL, created_by NOT NULL, created_at, revoked_at, revoked_by, target (jsonb), starts_at, suppress_billing (boolean)
- Indexes: idx_org_overrides_org, idx_org_overrides_org_active, org_overrides_one_plan_grant_at_a_time

### org_public_site_content
id (uuid), org_id (uuid) → organizations.id NOT NULL, tagline, description, contact_email, social_instagram, social_facebook, social_x, social_website, show_upcoming_tournaments (boolean), show_archives_link (boolean), created_at, updated_at, home_section_order, home_sections_hidden, contacts (jsonb), documents (jsonb), questions (jsonb), sponsors (jsonb)
- Indexes: org_public_site_content_org_id_key

### organization_members
id (uuid), organization_id (uuid) → organizations.id NOT NULL, user_id (uuid) NOT NULL, role, invited_at, accepted_at, capabilities (jsonb), status, display_name, title, invited_email
- Indexes: organization_members_invited_email_idx, organization_members_organization_id_user_id_key

### organizations
id (uuid), name NOT NULL, slug NOT NULL, logo_url, plan_id, stripe_customer_id, stripe_subscription_id, subscription_status, tournament_limit (integer), is_public (boolean), created_at, theme_preset, theme_primary, theme_accent, hero_banner_url, theme_font, theme_card_style, require_score_finalization (boolean), onboarding_completed_at, enabled_addons (jsonb), internal_notes, billing_suspended_at, billing_suspension_reason, subscription_period, current_period_end, rep_team_subscription_item_id, pdf_settings (jsonb), account_kind, team_workspace_status, is_discoverable (boolean), email_marketing_opt_out (boolean), email_opt_out_at, free_floor, team_limit (integer), privacy_policy_url, coach_settings (jsonb), club_book_sharing_enabled (boolean), fiscal_first_month, birthday_cutoffs (jsonb), coach_names_policy
- Indexes: idx_organizations_email_opt_out, organizations_slug_key

## Module: Platform Admin

### notification_preferences
user_id (uuid) NOT NULL, org_id (uuid) → organizations.id NOT NULL, event_type NOT NULL, channel_bell (boolean), channel_push (boolean), channel_email (boolean), updated_at
- Indexes: notification_preferences_org_id_idx

### notifications
id (uuid), org_id (uuid) → organizations.id NOT NULL, user_id (uuid) NOT NULL, event_type NOT NULL, title NOT NULL, body, link, read_at, created_at, metadata (jsonb), cleared_at
- Indexes: notifications_one_open_online_payments_notice, notifications_org_idx, notifications_org_needs_attention_idx, notifications_user_needs_attention_idx, notifications_user_unread_idx

### plan_config_overrides
id (uuid), plan_id NOT NULL, tournament_limit (integer), seat_limit (integer), trial_days (integer), updated_at, updated_by_email, last_change_note
- Indexes: plan_config_overrides_plan_id_key

### plan_gating
plan_key NOT NULL, gating_status, updated_at, updated_by_email, last_change_note

### platform_account_email_events
id (bigint) NOT NULL, email_id (uuid) → platform_account_emails.id NOT NULL, event_id NOT NULL, state NOT NULL, occurred_at NOT NULL, bounce_reason, created_at
- Indexes: platform_account_email_events_email_idx, platform_account_email_events_event_id_key

### platform_account_emails
id (uuid), kind NOT NULL, recipient_email NOT NULL, org_id (uuid) → organizations.id, asked_by_user_id (uuid), feedback_id (uuid) → feedback_submissions.id, resend_id, state, state_at, bounce_reason, created_at
- Indexes: platform_account_emails_created_idx, platform_account_emails_feedback_idx, platform_account_emails_recipient_idx, platform_account_emails_state_idx

### platform_addon_catalog
id (uuid), addon_key NOT NULL, label NOT NULL, description, module_key, status, default_included_plans, pricing_model, monthly_price (numeric), annual_price (numeric), effective_at, notes, created_at, updated_at
- Indexes: idx_platform_addon_catalog_status_label, platform_addon_catalog_addon_key_key

### platform_admin_visits
id (uuid), actor_user_id (uuid), actor_email NOT NULL, path, visited_at
- Indexes: idx_platform_admin_visits_actor_time, idx_platform_admin_visits_path_time

### platform_audit_log
id (uuid), actor_email NOT NULL, org_id (uuid) → organizations.id, action NOT NULL, field, old_value (jsonb), new_value (jsonb), created_at, reason
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
- Indexes: idx_platform_catalog_change_requests_effective, idx_platform_catalog_change_requests_status_time, platform_catalog_change_requests_target_version_id_idx

### platform_email_templates
key NOT NULL, label NOT NULL, description NOT NULL, subject NOT NULL, heading NOT NULL, body NOT NULL, cta_label, cta_url_pattern, variables (jsonb), category, is_customised (boolean), updated_at, updated_by, planned_send_date

### platform_events
id (uuid), event_type NOT NULL, source, source_event_id, org_id (uuid) → organizations.id, actor_user_id (uuid), actor_email, previous_plan_id, plan_id, previous_subscription_status, subscription_status, metadata (jsonb), occurred_at, created_at
- Indexes: idx_platform_events_org_time, idx_platform_events_source_event, idx_platform_events_type_time

### platform_fee_invoices
id (uuid), org_id (uuid) → organizations.id NOT NULL, livemode (boolean), period_start NOT NULL, stripe_customer_id NOT NULL, stripe_invoice_id, invoice_number, status, amount_due (numeric), hosted_invoice_url, due_at, finalized_at, emailed_at, reminded_at, paid_at, send_error, created_at, updated_at
- Indexes: platform_fee_invoices_period_key, platform_fee_invoices_stripe_key, platform_fee_invoices_unpaid_idx

### platform_feedback_replies
id (uuid) NOT NULL, feedback_id (uuid) → feedback_submissions.id NOT NULL, staff_user_id (uuid) NOT NULL, staff_email NOT NULL, signed_name, to_email NOT NULL, body NOT NULL, status, attempt, account_email_id (uuid) → platform_account_emails.id, created_at, sending_at, finished_at, claimed_at
- Indexes: platform_feedback_replies_feedback_idx, platform_feedback_replies_staff_idx

### platform_metric_snapshots
id (uuid), snapshot_date NOT NULL, metrics (jsonb), source, created_by_email, created_at
- Indexes: idx_platform_metric_snapshots_date, platform_metric_snapshots_snapshot_date_key

### platform_plan_module_entitlements
plan_id NOT NULL, module_key NOT NULL, included (boolean), updated_by_email, updated_at

### platform_plan_versions
id (uuid), version_key NOT NULL, title NOT NULL, description, status, effective_at, published_at, created_by_email, snapshot (jsonb), notes, created_at, updated_at
- Indexes: idx_platform_plan_versions_status_time, platform_plan_versions_version_key_key

### platform_record_opens
id (bigint) NOT NULL, actor_user_id (uuid) NOT NULL, actor_email NOT NULL, record_kind NOT NULL, record_id (uuid) NOT NULL, via_find (boolean), opened_at
- Indexes: platform_record_opens_opened_at_idx

### platform_refunds
id (uuid), org_id (uuid) → organizations.id, stripe_customer_id NOT NULL, stripe_charge_id NOT NULL, stripe_refund_id, amount_cents (integer) NOT NULL, currency NOT NULL, remaining_seen_cents (integer) NOT NULL, stripe_reason NOT NULL, status, stripe_error_code, stripe_request_id, reason NOT NULL, actor_email NOT NULL, actor_role NOT NULL, livemode (boolean) NOT NULL, created_at, completed_at
- Indexes: platform_refunds_actor_idx, platform_refunds_charge_idx, platform_refunds_one_open_per_charge, platform_refunds_org_idx, platform_refunds_stripe_refund_id_key

### platform_sent_email_searches
id (bigint) NOT NULL, actor_user_id (uuid) NOT NULL, searched_at
- Indexes: platform_sent_email_searches_actor_idx

### platform_status_reading
id, reading (jsonb), read_at, claimed_at

### platform_stripe_fees
id (uuid), org_id (uuid) → organizations.id NOT NULL, online_payment_id (uuid) → online_payments.id NOT NULL, kind NOT NULL, amount (numeric) NOT NULL, livemode (boolean), exempt_reason, stripe_invoice_item_id, billed_at, bill_error, created_at, dispute_id (uuid) → online_payment_disputes.id, amount_source, billed_on, fee_invoice_id (uuid) → platform_fee_invoices.id, bill_attempts (integer)
- Indexes: platform_stripe_fees_dispute_idx, platform_stripe_fees_invoice_idx, platform_stripe_fees_key, platform_stripe_fees_org_idx, platform_stripe_fees_unbilled_idx

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
- Indexes: early_access_leads_converted_org_id_idx, early_access_leads_email_normalized_key, idx_early_access_leads_converted_at, idx_early_access_leads_created_at, idx_early_access_leads_features_interested, idx_early_access_leads_follow_up_due_at, idx_early_access_leads_internal_status, idx_early_access_leads_plan_interest, idx_early_access_leads_status

### email_batches
id (uuid), email_key NOT NULL, subject NOT NULL, triggered_by NOT NULL, recipient_count (integer), suppressed_count (integer), sent_count (integer), failed_count (integer), status, started_at, completed_at, created_at
- Indexes: idx_email_batches_email_key, idx_email_batches_status

### email_sends
id (uuid), email_key NOT NULL, subject NOT NULL, recipient_org_id (uuid) → organizations.id, recipient_email NOT NULL, recipient_name, status, suppression_reason, resend_message_id, batch_id (uuid) → email_batches.id, sent_at, created_at
- Indexes: idx_email_sends_batch_id, idx_email_sends_email_key, idx_email_sends_org_id, idx_email_sends_status

## Module: Other

### assistant_invite_tokens
id (uuid), org_id (uuid) → organizations.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, program_year_id (uuid) → rep_program_years.id, invited_by_user_id (uuid) NOT NULL, invited_email NOT NULL, token_hash NOT NULL, status, initial_capabilities (jsonb), invited_by_name, team_name, expires_at, accepted_at, created_at, staff_kind, coach_role, sent_by
- Indexes: assistant_invite_tokens_email_idx, assistant_invite_tokens_org_id_idx, assistant_invite_tokens_program_year_id_idx, assistant_invite_tokens_team_idx, assistant_invite_tokens_token_hash_uq

### basic_coach_team_announcements
id (uuid), basic_coach_team_id (uuid) → basic_coach_teams.id NOT NULL, subject NOT NULL, body NOT NULL, recipient_count (integer), sent_count (integer), failed_count (integer), status, sent_at, created_by_user_id (uuid), created_at, updated_at
- Indexes: basic_coach_team_announcements_team_idx

### basic_coach_team_events
id (uuid), basic_coach_team_id (uuid) → basic_coach_teams.id NOT NULL, event_type, title NOT NULL, opponent, location, starts_at NOT NULL, ends_at, notes, status, created_by_user_id (uuid), created_at, updated_at
- Indexes: basic_coach_team_events_team_idx

### basic_coach_team_fees
id (uuid), basic_coach_team_id (uuid) → basic_coach_teams.id NOT NULL, player_id (uuid) → basic_coach_team_players.id, label NOT NULL, amount (numeric), status, marked_paid_at, notes, display_order (integer), created_by_user_id (uuid), created_at, updated_at
- Indexes: basic_coach_team_fees_player_idx, basic_coach_team_fees_team_idx

### basic_coach_team_players
id (uuid), basic_coach_team_id (uuid) → basic_coach_teams.id NOT NULL, name NOT NULL, jersey_number, date_of_birth, guardian_name, contact_email, contact_phone, notes, display_order (integer), created_by_user_id (uuid), created_at, updated_at, first_name, last_name, guardian_first_name, guardian_last_name
- Indexes: basic_coach_team_players_team_idx

### basic_coach_teams
id (uuid), name NOT NULL, normalized_name NOT NULL, primary_coach_name, primary_coach_email NOT NULL, sport, age_group, source, team_workspace_id (uuid) → team_workspaces.id, created_at, updated_at, activated_features (jsonb)
- Indexes: basic_coach_teams_primary_email_idx, basic_coach_teams_workspace_idx

### chat_message_reactions
id (uuid), room_id (uuid) → chat_rooms.id NOT NULL, message_id (uuid) → chat_messages.id NOT NULL, user_id (uuid) NOT NULL, emoji NOT NULL, created_at, removed_at
- Indexes: chat_message_reactions_message_idx, chat_message_reactions_room_idx, chat_message_reactions_unique

### chat_message_reports
id (uuid), room_id (uuid) → chat_rooms.id NOT NULL, message_id (uuid) → chat_messages.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, reporter_user_id (uuid) NOT NULL, reason, status, resolved_by_user_id (uuid), resolved_at, created_at
- Indexes: chat_message_reports_message_idx, chat_message_reports_open_uniq, chat_message_reports_org_status_idx, chat_message_reports_room_status_idx

### chat_messages
id (uuid), room_id (uuid) → chat_rooms.id NOT NULL, sender_user_id (uuid), body NOT NULL, deleted_at, deleted_by_user_id (uuid), metadata (jsonb), sent_at, pinned_at, pinned_by_user_id (uuid)
- Indexes: chat_messages_pinned_idx, chat_messages_room_sent_idx, chat_messages_sender_idx

### chat_poll_votes
id (uuid), room_id (uuid) → chat_rooms.id NOT NULL, message_id (uuid) → chat_messages.id NOT NULL, option_id (uuid) NOT NULL, user_id (uuid) NOT NULL, removed_at, created_at
- Indexes: chat_poll_votes_message_idx, chat_poll_votes_room_idx, chat_poll_votes_unique

### chat_room_members
id (uuid), room_id (uuid) → chat_rooms.id NOT NULL, user_id (uuid) NOT NULL, member_role, status, muted_until, joined_at, last_read_at, notifications_muted_at, history_visible_from
- Indexes: chat_room_members_room_idx, chat_room_members_room_user_key, chat_room_members_user_idx

### chat_rooms
id (uuid), org_id (uuid) → organizations.id NOT NULL, surface NOT NULL, ref_id (uuid) NOT NULL, ref_sub_id (uuid), name NOT NULL, created_by_user_id (uuid), is_archived (boolean), settings (jsonb), created_at
- Indexes: chat_rooms_org_idx, chat_rooms_surface_ref_idx, chat_rooms_surface_ref_nosub_uniq, chat_rooms_surface_ref_sub_uniq

### club_schedule_hand_back_slots
id (uuid), hand_back_id (uuid) → club_schedule_hand_backs.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, slot_id (uuid) → club_schedule_slots.id, event_id (uuid), starts_at NOT NULL, ends_at NOT NULL, priced_minutes (numeric) NOT NULL, cents (bigint) NOT NULL, waiting (boolean), handed_back (boolean)
- Indexes: club_schedule_hand_back_slots_hand_back_idx, club_schedule_hand_back_slots_one_waiting, club_schedule_hand_back_slots_org_idx, club_schedule_hand_back_slots_slot_idx

### club_schedule_hand_backs
id (uuid), org_id (uuid) → organizations.id NOT NULL, schedule_id (uuid) → club_schedules.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, scope NOT NULL, state NOT NULL, asked_cents (bigint), accepted_cents (bigint), credited_cents (bigint), to_pay_cents (bigint), asked_by (uuid), asked_at, closed_by (uuid), closed_at, decline_reason, late_for (uuid) → club_schedule_hand_backs.id
- Indexes: club_schedule_hand_backs_asked_by_idx, club_schedule_hand_backs_closed_by_idx, club_schedule_hand_backs_late_for_idx, club_schedule_hand_backs_org_idx, club_schedule_hand_backs_schedule_idx, club_schedule_hand_backs_team_idx, club_schedule_hand_backs_waiting_idx

### club_schedule_replies
id (uuid), org_id (uuid) → organizations.id NOT NULL, schedule_id (uuid) → club_schedules.id NOT NULL, send_id (uuid) → club_schedule_sends.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, answer NOT NULL, words, replied_by (uuid), replied_at
- Indexes: club_schedule_replies_by_idx, club_schedule_replies_org_idx, club_schedule_replies_schedule_idx, club_schedule_replies_send_idx, club_schedule_replies_team_idx

### club_schedule_sends
id (uuid), org_id (uuid) → organizations.id NOT NULL, schedule_id (uuid) → club_schedules.id NOT NULL, kind NOT NULL, sent_at, sent_by (uuid), team_ids, people_count (integer), failed_count (integer), bookings_email, reply_by, changes (jsonb), team_values (jsonb), billed (jsonb), owed_back (jsonb), allocation_id (uuid) → rep_cost_allocations.id, landed_at, settled (jsonb)
- Indexes: club_schedule_sends_allocation_idx, club_schedule_sends_org_idx, club_schedule_sends_schedule_idx, club_schedule_sends_sent_by_idx

### club_schedule_slot_programs
slot_id (uuid) → club_schedule_slots.id NOT NULL, program NOT NULL, org_id (uuid) → organizations.id NOT NULL, created_at
- Indexes: club_schedule_slot_programs_org_idx

### club_schedule_slot_teams
slot_id (uuid) → club_schedule_slots.id NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, org_id (uuid) → organizations.id NOT NULL
- Indexes: club_schedule_slot_teams_org_idx, club_schedule_slot_teams_team_idx

### club_schedule_slots
id (uuid), org_id (uuid) → organizations.id NOT NULL, schedule_id (uuid) → club_schedules.id NOT NULL, block_id (uuid) → org_time_blocks.id, org_venue_id (uuid) → org_venues.id NOT NULL, facility_id (uuid) → org_venue_facilities.id, starts_at NOT NULL, ends_at NOT NULL, locked (boolean), moved_by_hand (boolean), handed_back_at, handed_back_by (uuid), handed_back_team_id (uuid) → rep_teams.id, removed_at, created_at, updated_at
- Indexes: club_schedule_slots_block_idx, club_schedule_slots_facility_idx, club_schedule_slots_handed_back_by_idx, club_schedule_slots_handed_back_team_idx, club_schedule_slots_org_idx, club_schedule_slots_place_start, club_schedule_slots_venue_idx

### club_schedules
id (uuid), org_id (uuid) → organizations.id NOT NULL, name NOT NULL, state, starts_on NOT NULL, ends_on NOT NULL, settings (jsonb), version (integer), started_from_permit_id (uuid) → org_permits.id, started_from_schedule_id (uuid) → club_schedules.id, reply_by, sent_at, sent_by (uuid), finalized_at, finalized_by (uuid), changed_since_sent (boolean), bill_line_id (uuid) → org_budget_lines.id, bill_permit_id (uuid) → org_permits.id, bill_amount (numeric), bill_plan, bill_first_due, bill_dates, bill_scale (numeric), allocation_id (uuid) → rep_cost_allocations.id, created_by (uuid), updated_by (uuid), created_at, updated_at
- Indexes: club_schedules_allocation_idx, club_schedules_bill_line_idx, club_schedules_bill_permit_idx, club_schedules_created_by_idx, club_schedules_finalized_by_idx, club_schedules_from_schedule_idx, club_schedules_org_idx, club_schedules_permit_idx, club_schedules_sent_by_idx, club_schedules_updated_by_idx

### error_events
id (uuid), group_id (uuid) → error_groups.id NOT NULL, occurred_at, env, source, route, http_method, status_code (integer), error_name, error_message, stack_trace, org_id (uuid) → organizations.id, org_slug, user_id (uuid), user_email, user_role, request_id, ip_address, user_agent, request_context (jsonb), created_at
- Indexes: idx_error_events_group_org, idx_error_events_group_time, idx_error_events_occurred, idx_error_events_org_time

### error_groups
id (uuid), fingerprint NOT NULL, title, error_name, route, http_method, severity, status, env, first_seen_at, last_seen_at, occurrence_count (bigint), distinct_org_count (integer), resolved_at, resolved_by, snooze_until, sample_stack, sample_context (jsonb), created_at
- Indexes: error_groups_fingerprint_key, idx_error_groups_env_last_seen, idx_error_groups_status_severity

### family_coach_asks
id (uuid), org_id (uuid) → organizations.id NOT NULL, sent_by (uuid), sent_at, team_ids, player_count (integer), recipient_count (integer)
- Indexes: family_coach_asks_org_sent_idx

### family_consents
id (uuid), org_id (uuid) → organizations.id NOT NULL, guardian_email NOT NULL, user_id (uuid), basis NOT NULL, basis_started_at, withdrawn_at, scope, source_table, source_id (uuid), consent_ip, consent_text, jurisdiction, created_at, updated_at
- Indexes: family_consents_live_uniq, family_consents_org_email_idx, family_consents_user_idx

### family_email_optouts
id (uuid), org_id (uuid) → organizations.id NOT NULL, email NOT NULL, opted_out_at, source, created_at
- Indexes: family_email_optouts_org_email_uniq

### family_email_recipients
id (uuid), send_id (uuid) → family_email_sends.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, person_ids NOT NULL, family_name, status, updated_at
- Indexes: family_email_recipients_org_idx, family_email_recipients_send_idx

### family_email_sends
id (uuid), org_id (uuid) → organizations.id NOT NULL, sent_by (uuid), sent_at, subject NOT NULL, body NOT NULL, audience_kind NOT NULL, audience_label NOT NULL, team_ids, season_id (uuid), family_count (integer), opted_out_count (integer), reached_count (integer), failed_count (integer), coach_count (integer), status, retried_at
- Indexes: family_email_sends_org_sent_idx, family_email_sends_season_sent_idx

### family_links
id (uuid), org_id (uuid) → organizations.id NOT NULL, rep_team_id (uuid) → rep_teams.id NOT NULL, role NOT NULL, player_id (uuid) → rep_roster_players.id, user_id (uuid), invited_email NOT NULL, relationship, status, verified_via, claim_token_hash, claim_expires_at, invited_by_user_id (uuid), calendar_token_hash, consent_recorded_at, consent_ip, approved_by_user_id (uuid), approved_at, declined_at, revoked_at, created_at, updated_at, claimed_email, person_id (uuid) → org_people.id
- Indexes: family_links_calendar_token_hash_key, family_links_claim_token_hash_key, family_links_email_idx, family_links_live_uniq, family_links_org_idx, family_links_person_id_idx, family_links_player_id_idx, family_links_team_status_idx, family_links_user_idx

### family_messages
id (uuid), org_id (uuid) → organizations.id NOT NULL, person_id (uuid) → org_people.id NOT NULL, sent_by (uuid), sent_at, season_id (uuid)
- Indexes: family_messages_org_idx, family_messages_person_sent_idx, family_messages_season_idx

### family_notes
id (uuid), org_id (uuid) → organizations.id NOT NULL, person_id (uuid) → org_people.id NOT NULL, body NOT NULL, created_by (uuid), created_at, edited_at
- Indexes: family_notes_org_idx, family_notes_person_idx

### family_payment_handoffs
id (uuid), org_id (uuid) → organizations.id NOT NULL, person_id (uuid) → org_people.id NOT NULL, roster_player_id (uuid) → rep_roster_players.id, player_name NOT NULL, team_id (uuid) → rep_teams.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, amount (numeric) NOT NULL, received_date NOT NULL, method, note, sent_by (uuid), sent_at, sent_to, state, resolved_by (uuid), resolved_at, payment_id (uuid) → rep_dues_payments.id
- Indexes: family_payment_handoffs_org_idx, family_payment_handoffs_payment_uniq, family_payment_handoffs_person_idx, family_payment_handoffs_player_sent_idx, family_payment_handoffs_team_idx, family_payment_handoffs_year_idx

### family_recap_views
id (uuid), org_id (uuid) → organizations.id NOT NULL, rep_team_id (uuid) → rep_teams.id NOT NULL, program_year_id (uuid) → rep_program_years.id NOT NULL, link_id (uuid) → family_links.id NOT NULL, first_viewed_at
- Indexes: family_recap_views_link_season_uniq, family_recap_views_org_id_idx, family_recap_views_season_idx, family_recap_views_team_idx

### fan_alert_prefs
user_id (uuid) NOT NULL, game_alerts (boolean), event_news (boolean), created_at, updated_at

### fan_follows
id (uuid), user_id (uuid) NOT NULL, entity_type NOT NULL, entity_id (uuid) NOT NULL, source, created_at, updated_at
- Indexes: fan_follows_entity_idx, fan_follows_user_entity_unique

### fan_push_subscriptions
id (uuid), endpoint NOT NULL, keys_p256dh NOT NULL, keys_auth NOT NULL, tournament_id (uuid) → tournaments.id NOT NULL, team_id (uuid) → teams.id, device_label, created_at, last_used_at, notify_messages (boolean), notify_scores (boolean)
- Indexes: fan_push_subscriptions_endpoint_idx, fan_push_subscriptions_endpoint_tournament_id_key, fan_push_subscriptions_team_id_idx, fan_push_subscriptions_tournament_team_idx

### feedback_submissions
id (uuid), org_id (uuid) → organizations.id, user_id (uuid), user_email, submitter_name, type, category, title, body NOT NULL, status, severity, context (jsonb), triaged_by, triaged_at, created_at, updated_at, escalated_at, escalated_by
- Indexes: idx_feedback_submissions_org_time, idx_feedback_submissions_status_time, idx_feedback_submissions_type

### game_change_notices
id (uuid), org_id (uuid) → organizations.id NOT NULL, tournament_id (uuid) → tournaments.id NOT NULL, team_id (uuid) → teams.id NOT NULL, game_id (uuid) → games.id NOT NULL, kind NOT NULL, was_date, was_time (time without time zone), was_location, created_at, sent_at, superseded_at, hold_until
- Indexes: game_change_notices_game_id_idx, game_change_notices_game_idx, game_change_notices_org_id_idx, game_change_notices_pending_idx, game_change_notices_recent_sent_idx, game_change_notices_team_id_idx, game_change_notices_tournament_id_idx

### import_batch_rows
id (uuid), batch_id (uuid) → import_batches.id NOT NULL, row_number (integer) NOT NULL, operation NOT NULL, target_id (uuid), raw_json (jsonb), normalized_json (jsonb), before_json (jsonb), after_json (jsonb), warnings_json (jsonb), errors_json (jsonb), status, created_at
- Indexes: idx_import_batch_rows_batch_row

### import_batches
id (uuid), org_id (uuid) → organizations.id NOT NULL, actor_user_id (uuid), actor_email, import_type NOT NULL, scope_json (jsonb), source_filename, status, summary_json (jsonb), created_at, committed_at, expires_at
- Indexes: idx_import_batches_actor_time, idx_import_batches_org_time

### no_login_rate_limits
rail NOT NULL, subject NOT NULL, window_started_at, attempts (integer)
- Indexes: no_login_rate_limits_window_idx

### observability_cron_heartbeat
job_name NOT NULL, last_run_at, rows_folded (bigint), rows_purged (bigint), status, error_detail

### online_payment_clear_decisions
id (uuid), org_id (uuid) → organizations.id NOT NULL, online_payment_id (uuid) → online_payments.id NOT NULL, online_payment_item_id (uuid) → online_payment_items.id, choice NOT NULL, fee_back (boolean), reason, decided_by (uuid), decided_at, outcome, outcome_at, refund_id (uuid) → online_payment_refunds.id
- Indexes: online_payment_clear_decisions_key, online_payment_clear_decisions_open_idx

### online_payment_disputes
id (uuid), org_id (uuid) → organizations.id NOT NULL, online_payment_id (uuid) → online_payments.id NOT NULL, stripe_dispute_id NOT NULL, status NOT NULL, reason, amount (numeric) NOT NULL, held (numeric), due_by, answered (boolean), answered_at, stripe_fee (numeric), fee_paid_from, livemode (boolean), opened_at NOT NULL, closed_at, read_at, lost_booked_at, taken_back (jsonb), won_back_at, won_back (jsonb), opened_emailed_at, reminder_emailed_at, created_at, updated_at
- Indexes: online_payment_disputes_open_idx, online_payment_disputes_org_idx, online_payment_disputes_payment_idx, online_payment_disputes_stripe_key

### online_payment_items
id (uuid), online_payment_id (uuid) → online_payments.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, registration_id (uuid) → league_registrations.id, description NOT NULL, amount (numeric) NOT NULL, fee_share (numeric), entry_id (uuid) → accounting_entries.id, land_error, created_at, updated_at
- Indexes: online_payment_items_entry_key, online_payment_items_one_per_child, online_payment_items_org_idx, online_payment_items_payment_idx, online_payment_items_registration_idx

### online_payment_refunds
id (uuid), online_payment_id (uuid) → online_payments.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, amount (numeric) NOT NULL, fee_refunded (numeric), reason, note, origin, status, failure_reason, stripe_refund_id, refund_entry_id (uuid) → accounting_entries.id, processing_cost_entry_id (uuid) → accounting_entries.id, created_by (uuid), created_at, updated_at, succeeded_at, online_payment_item_id (uuid) → online_payment_items.id, partial_reason, booked_at, part_refund (boolean), failed_at, family_emailed_at, family_email_failed_at, resolved_by (uuid), stripe_created_at, family_answer, family_answer_by (uuid), family_answer_at
- Indexes: online_payment_refunds_cost_entry_idx, online_payment_refunds_created_by_idx, online_payment_refunds_entry_idx, online_payment_refunds_family_answer_by_idx, online_payment_refunds_item_idx, online_payment_refunds_org_idx, online_payment_refunds_payment_idx, online_payment_refunds_resolved_by_idx, online_payment_refunds_stripe_child_key

### online_payments
id (uuid), org_id (uuid) → organizations.id NOT NULL, stripe_account_id NOT NULL, flow NOT NULL, tournament_id (uuid) → tournaments.id, team_id (uuid) → teams.id, scope NOT NULL, description NOT NULL, payer_email, base_amount (numeric) NOT NULL, fee_amount (numeric) NOT NULL, total_amount (numeric) NOT NULL, fee_payer NOT NULL, fee_pct (numeric) NOT NULL, fee_flat (numeric) NOT NULL, currency, rail, status, livemode (boolean), stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, card_brand, card_last4, receipt_no (bigint), paid_on, paid_at, landed_at, land_error, processing_cost_entry_id (uuid) → accounting_entries.id, receipt_emailed_at, created_at, updated_at, season_id (uuid) → league_seasons.id, signup_key, bank_last4, clearing_at, returned_at, return_reason, return_detail, reversed_at, stripe_dispute_id, card_country, over_amount (numeric), over_whole (boolean), over_kept_reason, over_kept_by (uuid), over_kept_at
- Indexes: online_payments_clearing_idx, online_payments_cost_entry_idx, online_payments_dispute_key, online_payments_intent_key, online_payments_one_open_per_signup, online_payments_one_open_per_team, online_payments_open_idx, online_payments_org_idx, online_payments_over_idx, online_payments_over_kept_by_idx, online_payments_receipt_key, online_payments_season_idx, online_payments_session_key, online_payments_team_idx, online_payments_tournament_idx

### online_refunds_unassigned
id (uuid), org_id (uuid) → organizations.id NOT NULL, online_payment_id (uuid) → online_payments.id NOT NULL, stripe_refund_id NOT NULL, amount (numeric) NOT NULL, stripe_created_at, created_at, assigned_at, assigned_by (uuid)
- Indexes: online_refunds_unassigned_assigned_by_idx, online_refunds_unassigned_org_idx, online_refunds_unassigned_payment_idx, online_refunds_unassigned_stripe_key

### org_custom_domains
id (uuid), org_id (uuid) → organizations.id NOT NULL, full_name NOT NULL, domain NOT NULL, prefix NOT NULL, status, host_status, host_branch, record1_name NOT NULL, record1_value NOT NULL, record2_name NOT NULL, record2_value NOT NULL, record2_host_target, last_checked_at, last_check (jsonb), waiting_since, connected_at, needs_attention_since, not_working_since, padlock_expires_at, live_email_sent_at, padlock_email_sent_at, padlock_reminder_sent_at, gave_up_email_sent_at, not_working_email_sent_at, created_by_user_id (uuid), created_at, updated_at
- Indexes: org_custom_domains_domain_uidx, org_custom_domains_full_name_uidx, org_custom_domains_org_uidx, org_custom_domains_status_idx

### org_fiscal_year_reopenings
id (uuid), fiscal_year_id (uuid) → org_fiscal_years.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, reopened_at, reopened_by (uuid), reason NOT NULL, was_closed_at NOT NULL, was_closed_by (uuid), was_closing_balance (numeric) NOT NULL, was_closing_snapshot (jsonb)
- Indexes: org_fiscal_year_reopenings_by_idx, org_fiscal_year_reopenings_org_idx, org_fiscal_year_reopenings_was_by_idx, org_fiscal_year_reopenings_year_idx

### org_fiscal_years
id (uuid), org_id (uuid) → organizations.id NOT NULL, name NOT NULL, first_day NOT NULL, last_day NOT NULL, closed_at, closed_by (uuid), closing_balance (numeric), closing_snapshot (jsonb), created_at, updated_at
- Indexes: org_fiscal_years_closed_by_idx, org_fiscal_years_one_name, org_fiscal_years_one_start

### org_payment_accounts
org_id (uuid) → organizations.id NOT NULL, stripe_account_id NOT NULL, livemode (boolean), country, requirements_due, requirements_deadline, stripe_synced_at, fee_payer, refund_policy, terms_version, terms_agreed_by (uuid), terms_agreed_by_email, terms_agreed_at, connected_by (uuid), connected_at, disconnected_by (uuid), disconnected_at, created_at, updated_at, card_payments_status, card_payments_reason, onboarding_finished_at, bank_debit_status
- Indexes: org_payment_accounts_stripe_account_key

### org_people
id (uuid), org_id (uuid) → organizations.id NOT NULL, email_normalized NOT NULL, first_name, last_name, phone, created_at, updated_at
- Indexes: org_people_org_email_uniq

### org_permit_facility_shares
permit_id (uuid) → org_permits.id NOT NULL, facility_id (uuid) → org_venue_facilities.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, share (numeric) NOT NULL
- Indexes: org_permit_facility_shares_facility_idx, org_permit_facility_shares_org_idx

### org_permits
id (uuid), org_id (uuid) → organizations.id NOT NULL, name NOT NULL, issuer_payee_id (uuid) → org_payees.id, issuer_name, reference, held_for, held_for_team_id (uuid) → rep_teams.id, starts_on NOT NULL, ends_on NOT NULL, cost (numeric), budget_line_id (uuid) → org_budget_lines.id, document_path, document_name, document_size (integer), document_type, document_added_at, notes, renewed_from_id (uuid) → org_permits.id, created_by (uuid), updated_by (uuid), created_at, updated_at
- Indexes: org_permits_budget_line_idx, org_permits_created_by_idx, org_permits_issuer_idx, org_permits_org_dates_idx, org_permits_renewed_from_idx, org_permits_team_idx, org_permits_updated_by_idx

### org_person_emails
id (uuid), org_id (uuid) → organizations.id NOT NULL, person_id (uuid) → org_people.id NOT NULL, email_normalized NOT NULL, is_current (boolean), first_seen_at, last_seen_at, created_at, updated_at
- Indexes: org_person_emails_one_current_uniq, org_person_emails_org_email_uniq, org_person_emails_person_id_idx

### org_person_match_rejections
id (uuid), org_id (uuid) → organizations.id NOT NULL, person_a_id (uuid) → org_people.id NOT NULL, person_b_id (uuid) → org_people.id NOT NULL, rejected_by (uuid), rejected_at, created_at
- Indexes: org_person_match_rejections_pair_uniq, org_person_match_rejections_person_a_idx, org_person_match_rejections_person_b_idx

### org_person_merges
id (uuid), org_id (uuid) → organizations.id NOT NULL, kept_person_id (uuid) → org_people.id NOT NULL, merged_person_id (uuid) NOT NULL, merged_snapshot (jsonb) NOT NULL, merged_by (uuid), merged_at, created_at
- Indexes: org_person_merges_kept_idx, org_person_merges_org_id_idx

### org_person_reattachments
id (uuid), org_id (uuid) → organizations.id NOT NULL, from_person_id (uuid) → org_people.id NOT NULL, to_person_id (uuid) → org_people.id NOT NULL, source_table NOT NULL, source_id (uuid) NOT NULL, at
- Indexes: org_person_reattachments_from_idx, org_person_reattachments_move_uniq, org_person_reattachments_org_idx, org_person_reattachments_to_idx

### org_site_notices
id (uuid), org_id (uuid) → organizations.id NOT NULL, notice NOT NULL, detail, posted_at, posted_by_user_id (uuid), posted_by_email NOT NULL, ends_at NOT NULL, ended_at, ended_by_email
- Indexes: org_site_notices_org_idx

### org_time_block_facilities
block_id (uuid) → org_time_blocks.id NOT NULL, facility_id (uuid) → org_venue_facilities.id NOT NULL, org_id (uuid) → organizations.id NOT NULL
- Indexes: org_time_block_facilities_facility_idx, org_time_block_facilities_org_idx

### org_time_blocks
id (uuid), org_id (uuid) → organizations.id NOT NULL, permit_id (uuid) → org_permits.id, org_venue_id (uuid) → org_venues.id NOT NULL, weekdays NOT NULL, start_time (time without time zone) NOT NULL, end_time (time without time zone) NOT NULL, from_date, until_date, sort_order, created_at, updated_at, schedule_id (uuid) → club_schedules.id
- Indexes: org_time_blocks_permit_idx, org_time_blocks_schedule_idx, org_time_blocks_venue_fk_idx, org_time_blocks_venue_idx

### org_time_dates_off
id (uuid), org_id (uuid) → organizations.id NOT NULL, permit_id (uuid) → org_permits.id, day NOT NULL, note, schedule_id (uuid) → club_schedules.id
- Indexes: org_time_dates_off_once, org_time_dates_off_org_idx, org_time_dates_off_schedule_once

### organization_billing_facts
org_id (uuid) → organizations.id NOT NULL, card_on_file_at, card_on_file_brand, card_on_file_last4, next_season_plan_id, next_season_billing_cycle, next_season_chosen_at, next_season_subscription_id, created_at, updated_at
- Indexes: idx_org_billing_facts_no_card, idx_org_billing_facts_no_next_season_choice

### pitch_decks
id (uuid), persona, name NOT NULL, purpose, slide_ids (jsonb) NOT NULL, share_slug, created_at, updated_at, updated_by
- Indexes: pitch_decks_persona_key, pitch_decks_share_slug_key

### pitch_page_pulls
persona NOT NULL, slide_ids (jsonb) NOT NULL, updated_at, updated_by

### request_metrics_raw
id (uuid), flushed_at, env, route, org_id (uuid), call_count (bigint), error_count (bigint)
- Indexes: idx_request_metrics_raw_flushed

### request_metrics_rollup
id (uuid), bucket_start NOT NULL, env, route, org_id (uuid), call_count (bigint), error_count (bigint), created_at
- Indexes: idx_request_metrics_rollup_bucket, idx_request_metrics_rollup_env_time

### schedule_facility_lanes
id (uuid), tournament_id (uuid) → tournaments.id NOT NULL, division_id (uuid) → divisions.id NOT NULL, label NOT NULL, sort_order (integer), resolved_venue_id (uuid) → diamonds.id, resolved_venue_facility_id (uuid) → venue_facilities.id, created_at, updated_at
- Indexes: schedule_facility_lanes_division_id_idx, schedule_facility_lanes_resolved_venue_facility_id_idx, schedule_facility_lanes_resolved_venue_id_idx, schedule_facility_lanes_tournament_id_idx, schedule_facility_lanes_unique_label

### tournament_fee_book_settings
tournament_id (uuid) → tournaments.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, category_id (uuid) → budget_categories.id NOT NULL, item_id (uuid) → budget_items.id NOT NULL, created_at
- Indexes: tournament_fee_book_settings_org_id_idx

### tournament_fee_receipt_allocations
receipt_id (uuid) → tournament_fee_receipts.id NOT NULL, team_id (uuid) → teams.id NOT NULL, amount (numeric) NOT NULL
- Indexes: tournament_fee_allocations_team_idx

### tournament_fee_receipts
id (uuid), tournament_id (uuid) → tournaments.id NOT NULL, entry_id (uuid) → accounting_entries.id NOT NULL, created_at, ordinal (bigint) NOT NULL
- Indexes: tournament_fee_receipts_entry_id_key, tournament_fee_receipts_event_idx

### tournament_roster_players
id (uuid), org_id (uuid) → organizations.id NOT NULL, tournament_id (uuid) → tournaments.id NOT NULL, team_id (uuid) → teams.id NOT NULL, name NOT NULL, jersey_number, date_of_birth, position, notes, source, created_by_user_id (uuid), created_at, updated_at, source_player_id (uuid) → basic_coach_team_players.id
- Indexes: idx_tournament_roster_players_org, idx_tournament_roster_players_team, idx_tournament_roster_players_tournament, tournament_roster_players_source_player_id_idx

### tournament_team_entry_adjustments
id (uuid), team_id (uuid) → teams.id NOT NULL, tournament_id (uuid) → tournaments.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, amount (numeric) NOT NULL, reason, origin, refund_id (uuid) → online_payment_refunds.id NOT NULL, created_by (uuid), created_at
- Indexes: tournament_team_entry_adjustments_created_by_idx, tournament_team_entry_adjustments_org_idx, tournament_team_entry_adjustments_refund_key, tournament_team_entry_adjustments_team_idx, tournament_team_entry_adjustments_tournament_idx

### tournament_team_payments
id (uuid), team_id (uuid) → teams.id NOT NULL, tournament_id (uuid) → tournaments.id NOT NULL, org_id (uuid) → organizations.id NOT NULL, amount (numeric) NOT NULL, paid_on, label, method, entry_id (uuid) → accounting_entries.id, status, removed_at, removed_by (uuid), created_by (uuid), created_at, updated_at, ordinal (bigint) NOT NULL, online_payment_id (uuid) → online_payments.id, refunded_amount (numeric)
- Indexes: tournament_team_payments_entry_idx, tournament_team_payments_online_payment_key, tournament_team_payments_org_idx, tournament_team_payments_team_idx, tournament_team_payments_tournament_idx

### user_marketing_opt_outs
user_id (uuid) NOT NULL, opted_out_at

### user_notification_settings
user_id (uuid) NOT NULL, notifications_paused_at, updated_at

### user_preferences
user_id (uuid) NOT NULL, theme, created_at, updated_at, coach_tour_dismissed_at, coach_setup_hints_off (boolean)

---

## Tables by count

Total: **243 tables** across 10 modules.

- Tournament: 17 tables
- League: 16 tables
- Rep Teams: 76 tables
- Standalone Team Workspace: 6 tables
- Accounting: 9 tables
- Stripe / Billing: 2 tables
- Organization / Platform Core: 8 tables
- Platform Admin: 29 tables
- CRM / Leads: 3 tables
- Other: 77 tables