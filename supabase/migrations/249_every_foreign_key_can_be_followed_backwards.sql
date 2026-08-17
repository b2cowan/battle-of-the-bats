-- 249_every_foreign_key_can_be_followed_backwards.sql
--
-- A foreign key points one way on its own. Following it BACKWARDS — "which
-- expenses belong to this team", "which rows does this org own" — is a scan
-- unless the child column is indexed. 139 of ours were scans.
--
-- Found by the /dba quarterly health check, 2026-08-17 (Finding #33 in
-- docs/agents/db/DB_ARCHITECTURE_REVIEW.md). Every FK constraint in the schema
-- was compared against every index definition; a column counts as covered only
-- when it LEADS a usable index. Two corrections that matter, because the naive
-- version of this audit gets both wrong:
--
--   * A PARTIAL index only covers a plain lookup when its predicate is exactly
--     "<col> IS NOT NULL". games has two indexes led by tournament_id, but they
--     are WHERE score_submitted_at IS NOT NULL and WHERE generator_locked = true
--     — neither can serve "WHERE tournament_id = $1". games.tournament_id, on
--     the busiest table in the tournament module, was never indexed at all.
--
--   * rep_player_continuity_links is deliberately EXCLUDED. Its four side
--     columns are indexed through coalesce() expression indexes by design
--     (Finding #31); plain per-column indexes there would be redundant.
--
-- Columns pointing at auth.users (created_by, updated_by, decided_by, ...) are
-- also excluded — they are audit stamps, never join keys, and correctly bare.
--
-- 25+ of these are org_id. "Every org_id column must be indexed" has been the
-- standing rule in the architecture review since 2026-05; nothing enforced it,
-- so it quietly stopped being true. Indexes alone do not fix that — see the
-- note at the foot of this file.
--
-- WHY NOW, AND WHY THIS IS NOT A PERFORMANCE FIX: production holds 20,857 rows
-- across 162 tables. The largest business table is 1,077 rows; games is 83.
-- Postgres will sequential-scan all of it faster than it would use an index.
-- Nothing here makes the product measurably faster today. It is done now
-- BECAUSE the tables are empty: every CREATE INDEX below is instantaneous and
-- takes no meaningful lock. The same sweep against a live customer's data is a
-- maintenance window.
--
-- Safety: additive only. No column, constraint, policy or row is touched.
-- Every statement is IF NOT EXISTS, so re-running is a no-op. Plain CREATE
-- INDEX (not CONCURRENTLY) is correct at this size and keeps the migration
-- transactional; at real volume this file would need CONCURRENTLY and no
-- surrounding transaction.
--
-- Applies to: DEV. Production is a separate, explicit owner step.

BEGIN;

-- ------------------------------------------------------------------------
-- TIER 1 — TENANCY. Every org_id an RLS policy or tenant-scoped read can land on.
-- 28 indexes
-- ------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS assistant_invite_tokens_org_id_idx
  ON public.assistant_invite_tokens (org_id);

CREATE INDEX IF NOT EXISTS family_recap_views_org_id_idx
  ON public.family_recap_views (org_id);

CREATE INDEX IF NOT EXISTS game_change_notices_org_id_idx
  ON public.game_change_notices (org_id);

CREATE INDEX IF NOT EXISTS league_email_log_org_id_idx
  ON public.league_email_log (org_id);

CREATE INDEX IF NOT EXISTS notification_preferences_org_id_idx
  ON public.notification_preferences (org_id);

CREATE INDEX IF NOT EXISTS org_internal_notes_org_id_idx
  ON public.org_internal_notes (org_id);

CREATE INDEX IF NOT EXISTS rep_allocation_splits_org_id_idx
  ON public.rep_allocation_splits (org_id);

CREATE INDEX IF NOT EXISTS rep_budget_lines_org_id_idx
  ON public.rep_budget_lines (org_id);

CREATE INDEX IF NOT EXISTS rep_cost_allocations_org_id_idx
  ON public.rep_cost_allocations (org_id);

CREATE INDEX IF NOT EXISTS rep_dues_payments_org_id_idx
  ON public.rep_dues_payments (org_id);

CREATE INDEX IF NOT EXISTS rep_dues_payouts_org_id_idx
  ON public.rep_dues_payouts (org_id);

CREATE INDEX IF NOT EXISTS rep_fundraiser_entries_org_id_idx
  ON public.rep_fundraiser_entries (org_id);

CREATE INDEX IF NOT EXISTS rep_fundraisers_org_id_idx
  ON public.rep_fundraisers (org_id);

CREATE INDEX IF NOT EXISTS rep_player_documents_org_id_idx
  ON public.rep_player_documents (org_id);

CREATE INDEX IF NOT EXISTS rep_player_dues_schedules_org_id_idx
  ON public.rep_player_dues_schedules (org_id);

CREATE INDEX IF NOT EXISTS rep_player_tryout_baselines_org_id_idx
  ON public.rep_player_tryout_baselines (org_id);

CREATE INDEX IF NOT EXISTS rep_program_years_org_id_idx
  ON public.rep_program_years (org_id);

CREATE INDEX IF NOT EXISTS rep_roster_players_org_id_idx
  ON public.rep_roster_players (org_id);

CREATE INDEX IF NOT EXISTS rep_season_refund_adjustments_org_id_idx
  ON public.rep_season_refund_adjustments (org_id);

CREATE INDEX IF NOT EXISTS rep_team_announcements_org_id_idx
  ON public.rep_team_announcements (org_id);

CREATE INDEX IF NOT EXISTS rep_team_event_attendance_org_id_idx
  ON public.rep_team_event_attendance (org_id);

CREATE INDEX IF NOT EXISTS rep_team_events_org_id_idx
  ON public.rep_team_events (org_id);

CREATE INDEX IF NOT EXISTS rep_team_expenses_org_id_idx
  ON public.rep_team_expenses (org_id);

CREATE INDEX IF NOT EXISTS rep_team_game_moments_org_id_idx
  ON public.rep_team_game_moments (org_id);

CREATE INDEX IF NOT EXISTS rep_team_import_events_org_id_idx
  ON public.rep_team_import_events (org_id);

CREATE INDEX IF NOT EXISTS rep_team_money_in_org_id_idx
  ON public.rep_team_money_in (org_id);

CREATE INDEX IF NOT EXISTS rep_team_opponent_observations_org_id_idx
  ON public.rep_team_opponent_observations (org_id);

CREATE INDEX IF NOT EXISTS rep_tryout_registrations_org_id_idx
  ON public.rep_tryout_registrations (org_id);

-- ------------------------------------------------------------------------
-- TIER 2 — THE COACH PORTAL. team_id / program_year_id / player_id — what every rep read filters on.
-- 68 indexes
-- ------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS assistant_invite_tokens_program_year_id_idx
  ON public.assistant_invite_tokens (program_year_id);

CREATE INDEX IF NOT EXISTS family_links_player_id_idx
  ON public.family_links (player_id);

CREATE INDEX IF NOT EXISTS rep_allocation_installments_accounting_entry_id_idx
  ON public.rep_allocation_installments (accounting_entry_id);

CREATE INDEX IF NOT EXISTS rep_allocation_splits_program_year_id_idx
  ON public.rep_allocation_splits (program_year_id);

CREATE INDEX IF NOT EXISTS rep_budget_lines_category_id_idx
  ON public.rep_budget_lines (category_id);
CREATE INDEX IF NOT EXISTS rep_budget_lines_item_id_idx
  ON public.rep_budget_lines (item_id);
CREATE INDEX IF NOT EXISTS rep_budget_lines_program_year_id_idx
  ON public.rep_budget_lines (program_year_id);

CREATE INDEX IF NOT EXISTS rep_cost_allocations_source_entry_id_idx
  ON public.rep_cost_allocations (source_entry_id);

CREATE INDEX IF NOT EXISTS rep_document_templates_team_id_idx
  ON public.rep_document_templates (team_id);

CREATE INDEX IF NOT EXISTS rep_dues_credits_expense_id_idx
  ON public.rep_dues_credits (expense_id);
CREATE INDEX IF NOT EXISTS rep_dues_credits_fundraiser_entry_id_idx
  ON public.rep_dues_credits (fundraiser_entry_id);
CREATE INDEX IF NOT EXISTS rep_dues_credits_payment_id_idx
  ON public.rep_dues_credits (payment_id);
CREATE INDEX IF NOT EXISTS rep_dues_credits_player_id_idx
  ON public.rep_dues_credits (player_id);
CREATE INDEX IF NOT EXISTS rep_dues_credits_program_year_id_idx
  ON public.rep_dues_credits (program_year_id);

CREATE INDEX IF NOT EXISTS rep_dues_payments_accounting_entry_id_idx
  ON public.rep_dues_payments (accounting_entry_id);
CREATE INDEX IF NOT EXISTS rep_dues_payments_player_id_idx
  ON public.rep_dues_payments (player_id);
CREATE INDEX IF NOT EXISTS rep_dues_payments_team_id_idx
  ON public.rep_dues_payments (team_id);

CREATE INDEX IF NOT EXISTS rep_dues_payouts_accounting_entry_id_idx
  ON public.rep_dues_payouts (accounting_entry_id);
CREATE INDEX IF NOT EXISTS rep_dues_payouts_player_id_idx
  ON public.rep_dues_payouts (player_id);
CREATE INDEX IF NOT EXISTS rep_dues_payouts_team_id_idx
  ON public.rep_dues_payouts (team_id);

CREATE INDEX IF NOT EXISTS rep_fundraiser_entries_credit_id_idx
  ON public.rep_fundraiser_entries (credit_id);
CREATE INDEX IF NOT EXISTS rep_fundraiser_entries_accounting_entry_id_idx
  ON public.rep_fundraiser_entries (accounting_entry_id);
CREATE INDEX IF NOT EXISTS rep_fundraiser_entries_team_id_idx
  ON public.rep_fundraiser_entries (team_id);

CREATE INDEX IF NOT EXISTS rep_fundraisers_program_year_id_idx
  ON public.rep_fundraisers (program_year_id);

CREATE INDEX IF NOT EXISTS rep_player_documents_template_id_idx
  ON public.rep_player_documents (template_id);

CREATE INDEX IF NOT EXISTS rep_player_dues_installments_accounting_entry_id_idx
  ON public.rep_player_dues_installments (accounting_entry_id);
CREATE INDEX IF NOT EXISTS rep_player_dues_installments_player_id_idx
  ON public.rep_player_dues_installments (player_id);

CREATE INDEX IF NOT EXISTS rep_player_dues_schedules_budget_line_id_idx
  ON public.rep_player_dues_schedules (budget_line_id);
CREATE INDEX IF NOT EXISTS rep_player_dues_schedules_player_id_idx
  ON public.rep_player_dues_schedules (player_id);
CREATE INDEX IF NOT EXISTS rep_player_dues_schedules_team_id_idx
  ON public.rep_player_dues_schedules (team_id);

CREATE INDEX IF NOT EXISTS rep_player_tryout_baselines_tryout_registration_id_idx
  ON public.rep_player_tryout_baselines (tryout_registration_id);

CREATE INDEX IF NOT EXISTS rep_roster_players_team_id_idx
  ON public.rep_roster_players (team_id);
CREATE INDEX IF NOT EXISTS rep_roster_players_tryout_registration_id_idx
  ON public.rep_roster_players (tryout_registration_id);

CREATE INDEX IF NOT EXISTS rep_season_refund_adjustments_player_id_idx
  ON public.rep_season_refund_adjustments (player_id);
CREATE INDEX IF NOT EXISTS rep_season_refund_adjustments_team_id_idx
  ON public.rep_season_refund_adjustments (team_id);

CREATE INDEX IF NOT EXISTS rep_team_announcements_team_id_idx
  ON public.rep_team_announcements (team_id);

CREATE INDEX IF NOT EXISTS rep_team_coaches_team_id_idx
  ON public.rep_team_coaches (team_id);

CREATE INDEX IF NOT EXISTS rep_team_event_attendance_program_year_id_idx
  ON public.rep_team_event_attendance (program_year_id);

CREATE INDEX IF NOT EXISTS rep_team_events_recurrence_parent_id_idx
  ON public.rep_team_events (recurrence_parent_id);
CREATE INDEX IF NOT EXISTS rep_team_events_team_id_idx
  ON public.rep_team_events (team_id);

CREATE INDEX IF NOT EXISTS rep_team_expenses_accounting_entry_id_idx
  ON public.rep_team_expenses (accounting_entry_id);
CREATE INDEX IF NOT EXISTS rep_team_expenses_budget_category_id_idx
  ON public.rep_team_expenses (budget_category_id);
CREATE INDEX IF NOT EXISTS rep_team_expenses_event_id_idx
  ON public.rep_team_expenses (event_id);
CREATE INDEX IF NOT EXISTS rep_team_expenses_paid_by_player_id_idx
  ON public.rep_team_expenses (paid_by_player_id);
CREATE INDEX IF NOT EXISTS rep_team_expenses_payee_id_idx
  ON public.rep_team_expenses (payee_id);
CREATE INDEX IF NOT EXISTS rep_team_expenses_team_id_idx
  ON public.rep_team_expenses (team_id);

CREATE INDEX IF NOT EXISTS rep_team_game_moments_event_id_idx
  ON public.rep_team_game_moments (event_id);
CREATE INDEX IF NOT EXISTS rep_team_game_moments_player_id_idx
  ON public.rep_team_game_moments (player_id);
CREATE INDEX IF NOT EXISTS rep_team_game_moments_program_year_id_idx
  ON public.rep_team_game_moments (program_year_id);

CREATE INDEX IF NOT EXISTS rep_team_import_events_program_year_id_idx
  ON public.rep_team_import_events (program_year_id);

CREATE INDEX IF NOT EXISTS rep_team_lineup_templates_program_year_id_idx
  ON public.rep_team_lineup_templates (program_year_id);

CREATE INDEX IF NOT EXISTS rep_team_lineups_program_year_id_idx
  ON public.rep_team_lineups (program_year_id);

CREATE INDEX IF NOT EXISTS rep_team_money_in_accounting_entry_id_idx
  ON public.rep_team_money_in (accounting_entry_id);
CREATE INDEX IF NOT EXISTS rep_team_money_in_budget_category_id_idx
  ON public.rep_team_money_in (budget_category_id);
CREATE INDEX IF NOT EXISTS rep_team_money_in_team_id_idx
  ON public.rep_team_money_in (team_id);

CREATE INDEX IF NOT EXISTS rep_team_payment_requests_accounting_entry_id_idx
  ON public.rep_team_payment_requests (accounting_entry_id);
CREATE INDEX IF NOT EXISTS rep_team_payment_requests_budget_line_id_idx
  ON public.rep_team_payment_requests (budget_line_id);
CREATE INDEX IF NOT EXISTS rep_team_payment_requests_program_year_id_idx
  ON public.rep_team_payment_requests (program_year_id);

CREATE INDEX IF NOT EXISTS rep_teams_group_id_idx
  ON public.rep_teams (group_id);

CREATE INDEX IF NOT EXISTS rep_tryout_evaluator_sessions_team_id_program_year_id_idx
  ON public.rep_tryout_evaluator_sessions (team_id, program_year_id);

CREATE INDEX IF NOT EXISTS rep_tryout_registrations_team_id_idx
  ON public.rep_tryout_registrations (team_id);

CREATE INDEX IF NOT EXISTS rep_tryout_rubrics_program_year_id_idx
  ON public.rep_tryout_rubrics (program_year_id);

CREATE INDEX IF NOT EXISTS rep_tryout_scores_team_id_program_year_id_idx
  ON public.rep_tryout_scores (team_id, program_year_id);

CREATE INDEX IF NOT EXISTS team_entitlements_rep_team_id_idx
  ON public.team_entitlements (rep_team_id);

CREATE INDEX IF NOT EXISTS team_org_links_rep_team_id_idx
  ON public.team_org_links (rep_team_id);

CREATE INDEX IF NOT EXISTS team_workspace_claims_team_workspace_id_idx
  ON public.team_workspace_claims (team_workspace_id);

CREATE INDEX IF NOT EXISTS team_workspaces_active_program_year_id_idx
  ON public.team_workspaces (active_program_year_id);
CREATE INDEX IF NOT EXISTS team_workspaces_billing_owner_org_id_idx
  ON public.team_workspaces (billing_owner_org_id);

-- ------------------------------------------------------------------------
-- TIER 3 — TOURNAMENT + LEAGUE SUB-TABLES. tournament_id / season_id / division_id.
-- 35 indexes
-- ------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS announcements_tournament_id_idx
  ON public.announcements (tournament_id);

CREATE INDEX IF NOT EXISTS diamonds_source_org_venue_id_idx
  ON public.diamonds (source_org_venue_id);
CREATE INDEX IF NOT EXISTS diamonds_tournament_id_idx
  ON public.diamonds (tournament_id);

CREATE INDEX IF NOT EXISTS divisions_contact_member_id_idx
  ON public.divisions (contact_member_id);
CREATE INDEX IF NOT EXISTS divisions_tournament_id_idx
  ON public.divisions (tournament_id);

CREATE INDEX IF NOT EXISTS fan_push_subscriptions_team_id_idx
  ON public.fan_push_subscriptions (team_id);

CREATE INDEX IF NOT EXISTS game_change_notices_game_id_idx
  ON public.game_change_notices (game_id);
CREATE INDEX IF NOT EXISTS game_change_notices_team_id_idx
  ON public.game_change_notices (team_id);
CREATE INDEX IF NOT EXISTS game_change_notices_tournament_id_idx
  ON public.game_change_notices (tournament_id);

CREATE INDEX IF NOT EXISTS games_division_id_idx
  ON public.games (division_id);
CREATE INDEX IF NOT EXISTS games_away_team_id_idx
  ON public.games (away_team_id);
CREATE INDEX IF NOT EXISTS games_diamond_id_idx
  ON public.games (diamond_id);
CREATE INDEX IF NOT EXISTS games_home_team_id_idx
  ON public.games (home_team_id);
CREATE INDEX IF NOT EXISTS games_tournament_id_idx
  ON public.games (tournament_id);

CREATE INDEX IF NOT EXISTS league_divisions_season_id_idx
  ON public.league_divisions (season_id);

CREATE INDEX IF NOT EXISTS league_email_log_season_id_idx
  ON public.league_email_log (season_id);

CREATE INDEX IF NOT EXISTS league_games_away_team_id_idx
  ON public.league_games (away_team_id);
CREATE INDEX IF NOT EXISTS league_games_home_team_id_idx
  ON public.league_games (home_team_id);

CREATE INDEX IF NOT EXISTS league_notification_log_season_id_idx
  ON public.league_notification_log (season_id);

CREATE INDEX IF NOT EXISTS league_practices_division_id_idx
  ON public.league_practices (division_id);

CREATE INDEX IF NOT EXISTS league_registrations_team_id_idx
  ON public.league_registrations (team_id);

CREATE INDEX IF NOT EXISTS league_teams_division_id_idx
  ON public.league_teams (division_id);
CREATE INDEX IF NOT EXISTS league_teams_season_id_idx
  ON public.league_teams (season_id);

CREATE INDEX IF NOT EXISTS pool_slots_division_id_idx
  ON public.pool_slots (division_id);

CREATE INDEX IF NOT EXISTS pools_division_id_idx
  ON public.pools (division_id);

CREATE INDEX IF NOT EXISTS resources_tournament_id_idx
  ON public.resources (tournament_id);

CREATE INDEX IF NOT EXISTS rule_items_rule_id_idx
  ON public.rule_items (rule_id);

CREATE INDEX IF NOT EXISTS rules_tournament_id_idx
  ON public.rules (tournament_id);

CREATE INDEX IF NOT EXISTS teams_division_id_idx
  ON public.teams (division_id);
CREATE INDEX IF NOT EXISTS teams_pool_id_idx
  ON public.teams (pool_id);
CREATE INDEX IF NOT EXISTS teams_tournament_id_idx
  ON public.teams (tournament_id);

CREATE INDEX IF NOT EXISTS tournament_archives_winner_team_id_idx
  ON public.tournament_archives (winner_team_id);

CREATE INDEX IF NOT EXISTS tournament_roster_players_source_player_id_idx
  ON public.tournament_roster_players (source_player_id);

CREATE INDEX IF NOT EXISTS tournaments_default_contact_member_id_idx
  ON public.tournaments (default_contact_member_id);

CREATE INDEX IF NOT EXISTS venue_facilities_source_org_facility_id_idx
  ON public.venue_facilities (source_org_facility_id);

-- ------------------------------------------------------------------------
-- TIER 4 — EVERYTHING ELSE. Remaining real foreign keys: accounting links, platform links.
-- 8 indexes
-- ------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS accounting_entries_linked_entry_id_idx
  ON public.accounting_entries (linked_entry_id);
CREATE INDEX IF NOT EXISTS accounting_entries_payee_id_idx
  ON public.accounting_entries (payee_id);

CREATE INDEX IF NOT EXISTS billing_retained_records_intent_id_idx
  ON public.billing_retained_records (intent_id);

CREATE INDEX IF NOT EXISTS early_access_leads_converted_org_id_idx
  ON public.early_access_leads (converted_org_id);

CREATE INDEX IF NOT EXISTS org_budget_lines_category_id_idx
  ON public.org_budget_lines (category_id);
CREATE INDEX IF NOT EXISTS org_budget_lines_item_id_idx
  ON public.org_budget_lines (item_id);

CREATE INDEX IF NOT EXISTS org_member_rep_group_scopes_group_id_idx
  ON public.org_member_rep_group_scopes (group_id);

CREATE INDEX IF NOT EXISTS platform_catalog_change_requests_target_version_id_idx
  ON public.platform_catalog_change_requests (target_version_id);

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFY (read-only — run after applying)
--
-- 1. Every org_id column now LEADS an index. Expect ZERO rows.
--
--    SELECT c.table_name
--      FROM information_schema.columns c
--     WHERE c.table_schema = 'public' AND c.column_name = 'org_id'
--       -- Telemetry buffers, deliberately bare. Their org_id is a LABEL on a
--       -- metric, not a tenant relationship: no FK, never filtered on alone,
--       -- drained by flushed_at / bucket_start. These are the hottest write
--       -- paths in the app and an index here would tax every request to make
--       -- no read faster. Excluded on purpose, not overlooked.
--       AND c.table_name NOT IN ('request_metrics_raw', 'request_metrics_rollup')
--       AND NOT EXISTS (
--             SELECT 1 FROM pg_indexes i
--              WHERE i.schemaname = 'public' AND i.tablename = c.table_name
--                AND i.indexdef ~ 'USING btree \(org_id[,)]')
--     ORDER BY 1;
--
--    ⚠ The regex must anchor on 'USING btree (' — a bare '\(org_id[,)]' also
--    matches 'COALESCE(org_id, ...)' buried mid-composite, which is exactly how
--    request_metrics_rollup passed a first draft of this check while having no
--    usable org_id index at all. A weak guard reads the same as a strong one
--    until the day it matters.
--
-- 2. Index count moved by 139:
--
--    SELECT count(*) FROM pg_indexes WHERE schemaname = 'public';
--
-- ---------------------------------------------------------------------------
-- THE PART THAT OUTLIVES THIS FILE
--
-- This migration closes the gap. It does not, on its own, stop it reopening —
-- the rule failed the first time because it lived in a document and nothing
-- read it. So query 1 above now ALSO exists as an executable gate:
--
--     scripts/check-index-coverage.mjs   (npm run check:indexes)
--
-- wired into verify:changed. It reads the committed snapshots offline, so the
-- next table that ships an unindexed org_id fails a check instead of
-- accumulating quietly for three months. Deliberate exemptions live in
-- scripts/.index-coverage-exceptions.json and must carry a written reason.
--
-- The gate was proven to FAIL before it was trusted to pass: run against the
-- prod snapshot (which does not yet have these 139 indexes) it reports 27
-- uncovered tables and exits 1. A gate only verified in its passing state is
-- the same green tick whether or not it works.
-- ---------------------------------------------------------------------------
