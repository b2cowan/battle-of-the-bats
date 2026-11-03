# Dev vs Prod — structural drift

**Generated:** 2026-11-03 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 209 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 8 | 0 | — |
| Columns | 105 | 0 | 0 |
| Indexes | 32 | 0 | 0 |
| Constraints | 36 | 0 | — |
| RLS / CHECK | 27 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (8)
- `league_game_scores`
- `league_practice_emails`
- `league_practice_tells`
- `league_rainouts`
- `league_team_practices_told`
- `stripe_billing_drift_checks`
- `stripe_billing_events`
- `stripe_price_ids_retired`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (105)
- `billing_retention_intents.change_log`
- `billing_retention_intents.ended_email_sent_at`
- `billing_retention_intents.ends_on_email_sent_at`
- `billing_retention_intents.held_move_plan`
- `billing_retention_intents.kept_email_sent_at`
- `billing_retention_intents.notify_owner`
- `billing_retention_intents.reminder_email_sent_at`
- `billing_retention_intents.stripe_subscription_id`
- `league_divisions.show_standings`
- `league_game_scores.checked_at`
- `league_game_scores.checked_by`
- `league_game_scores.checked_by_name`
- `league_game_scores.corrected_at`
- `league_game_scores.corrected_by`
- `league_game_scores.corrected_by_name`
- `league_game_scores.entered_at`
- `league_game_scores.entered_by`
- `league_game_scores.entered_by_name`
- `league_game_scores.entered_for_team`
- `league_game_scores.entered_side`
- `league_game_scores.game_id`
- `league_game_scores.org_id`
- `league_game_scores.report_note`
- `league_game_scores.reported_at`
- `league_game_scores.reported_by`
- `league_game_scores.reported_by_name`
- `league_game_scores.reported_for_team`
- `league_game_scores.season_id`
- `league_game_scores.updated_at`
- `league_practice_emails.created_at`
- `league_practice_emails.division_id`
- `league_practice_emails.guardian_email`
- `league_practice_emails.id`
- `league_practice_emails.notice_id`
- `league_practice_emails.org_id`
- `league_practice_emails.registration_ids`
- `league_practice_emails.season_id`
- `league_practice_emails.status`
- `league_practice_emails.team_ids`
- `league_practice_emails.updated_at`
- `league_practice_tells.created_at`
- `league_practice_tells.division_id`
- `league_practice_tells.id`
- `league_practice_tells.kind`
- `league_practice_tells.notice_id`
- `league_practice_tells.org_id`
- `league_practice_tells.season_id`
- `league_practice_tells.snapshot`
- `league_practice_tells.team_id`
- `league_practice_tells.told_before`
- `league_rainouts.change_ids`
- `league_rainouts.created_at`
- `league_rainouts.created_by`
- `league_rainouts.day`
- `league_rainouts.division_ids`
- `league_rainouts.game_ids`
- `league_rainouts.id`
- `league_rainouts.line`
- `league_rainouts.org_id`
- `league_rainouts.put_back_at`
- `league_rainouts.put_back_by`
- `league_rainouts.season_id`
- `league_rainouts.verb`
- `league_registrations.link_replaced_at`
- `league_registrations.link_version`
- `league_team_coaches.calendar_last_read_on`
- `league_team_coaches.calendar_link_generation`
- `league_team_practices_told.coaches_copied_at`
- `league_team_practices_told.notice_id`
- `league_team_practices_told.org_id`
- `league_team_practices_told.season_id`
- `league_team_practices_told.snapshot`
- `league_team_practices_told.team_id`
- `league_team_practices_told.told_at`
- `league_team_practices_told.updated_at`
- `organizations.subscription_amount_cents`
- `organizations.subscription_currency`
- `organizations.tournament_look_policy`
- `stripe_billing_drift_checks.checked_at`
- `stripe_billing_drift_checks.differences`
- `stripe_billing_drift_checks.environment`
- `stripe_billing_drift_checks.error`
- `stripe_billing_drift_checks.id`
- `stripe_billing_drift_checks.outcome`
- `stripe_billing_drift_checks.owner_emailed`
- `stripe_billing_drift_checks.records_compared`
- `stripe_billing_drift_checks.subscriptions_read`
- `stripe_billing_events.attempts`
- `stripe_billing_events.claimed_at`
- `stripe_billing_events.customer_id`
- `stripe_billing_events.error`
- `stripe_billing_events.id`
- `stripe_billing_events.ignored_reason`
- `stripe_billing_events.livemode`
- `stripe_billing_events.object_id`
- `stripe_billing_events.processed_at`
- `stripe_billing_events.received_at`
- `stripe_billing_events.subscription_id`
- `stripe_billing_events.type`
- `stripe_price_ids_retired.billing_cycle`
- `stripe_price_ids_retired.environment`
- `stripe_price_ids_retired.plan_id`
- `stripe_price_ids_retired.price_id`
- `stripe_price_ids_retired.retired_at`
- `stripe_price_ids_retired.retired_by_email`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (32)
- `billing_retention_intents_one_pending_cancellation`
- `league_game_scores_org_idx`
- `league_game_scores_pkey`
- `league_game_scores_season_idx`
- `league_practice_emails_division_idx`
- `league_practice_emails_notice_id_guardian_email_key`
- `league_practice_emails_notice_idx`
- `league_practice_emails_open_idx`
- `league_practice_emails_org_idx`
- `league_practice_emails_pkey`
- `league_practice_emails_season_idx`
- `league_practice_tells_division_idx`
- `league_practice_tells_notice_id_team_id_key`
- `league_practice_tells_org_idx`
- `league_practice_tells_pkey`
- `league_practice_tells_season_idx`
- `league_practice_tells_team_idx`
- `league_rainouts_changes_idx`
- `league_rainouts_org_idx`
- `league_rainouts_pkey`
- `league_rainouts_season_idx`
- `league_team_practices_told_notice_idx`
- `league_team_practices_told_org_idx`
- `league_team_practices_told_pkey`
- `league_team_practices_told_season_idx`
- `stripe_billing_drift_checks_checked_idx`
- `stripe_billing_drift_checks_pkey`
- `stripe_billing_events_customer_idx`
- `stripe_billing_events_pkey`
- `stripe_billing_events_received_idx`
- `stripe_billing_events_unprocessed_idx`
- `stripe_price_ids_retired_pkey`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (36)
- `league_game_scores.league_game_scores_checked_by_fkey`
- `league_game_scores.league_game_scores_corrected_by_fkey`
- `league_game_scores.league_game_scores_entered_by_fkey`
- `league_game_scores.league_game_scores_entered_for_team_fkey`
- `league_game_scores.league_game_scores_game_id_fkey`
- `league_game_scores.league_game_scores_org_id_fkey`
- `league_game_scores.league_game_scores_pkey`
- `league_game_scores.league_game_scores_reported_by_fkey`
- `league_game_scores.league_game_scores_reported_for_team_fkey`
- `league_game_scores.league_game_scores_season_id_fkey`
- `league_practice_emails.league_practice_emails_division_id_fkey`
- `league_practice_emails.league_practice_emails_notice_id_fkey`
- `league_practice_emails.league_practice_emails_notice_id_guardian_email_key`
- `league_practice_emails.league_practice_emails_org_id_fkey`
- `league_practice_emails.league_practice_emails_pkey`
- `league_practice_emails.league_practice_emails_season_id_fkey`
- `league_practice_tells.league_practice_tells_division_id_fkey`
- `league_practice_tells.league_practice_tells_notice_id_fkey`
- `league_practice_tells.league_practice_tells_notice_id_team_id_key`
- `league_practice_tells.league_practice_tells_org_id_fkey`
- `league_practice_tells.league_practice_tells_pkey`
- `league_practice_tells.league_practice_tells_season_id_fkey`
- `league_practice_tells.league_practice_tells_team_id_fkey`
- `league_rainouts.league_rainouts_created_by_fkey`
- `league_rainouts.league_rainouts_org_id_fkey`
- `league_rainouts.league_rainouts_pkey`
- `league_rainouts.league_rainouts_put_back_by_fkey`
- `league_rainouts.league_rainouts_season_id_fkey`
- `league_team_practices_told.league_team_practices_told_notice_id_fkey`
- `league_team_practices_told.league_team_practices_told_org_id_fkey`
- `league_team_practices_told.league_team_practices_told_pkey`
- `league_team_practices_told.league_team_practices_told_season_id_fkey`
- `league_team_practices_told.league_team_practices_told_team_id_fkey`
- `stripe_billing_drift_checks.stripe_billing_drift_checks_pkey`
- `stripe_billing_events.stripe_billing_events_pkey`
- `stripe_price_ids_retired.stripe_price_ids_retired_pkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (27)
- `billing_retention_intents.billing_retention_intents_change_log_check`
- `league_game_scores.league_game_scores_entered_side_check`
- `league_game_scores.league_game_scores_report_note_check`
- `league_game_scores.league_game_scores_report_whole`
- `league_game_scores.league_game_scores_side_team`
- `league_practice_emails.league_practice_emails_guardian_email_check`
- `league_practice_emails.league_practice_emails_registration_ids_check`
- `league_practice_emails.league_practice_emails_status_check`
- `league_practice_emails.league_practice_emails_team_ids_check`
- `league_practice_tells.league_practice_tells_check`
- `league_practice_tells.league_practice_tells_kind_check`
- `league_practice_tells.league_practice_tells_snapshot_check`
- `league_practice_tells.league_practice_tells_told_before_check`
- `league_rainouts.league_rainouts_check`
- `league_rainouts.league_rainouts_line_check`
- `league_rainouts.league_rainouts_verb_check`
- `league_registrations.league_registrations_link_version_check`
- `league_team_coaches.league_team_coaches_calendar_generation_nonneg`
- `league_team_practices_told.league_team_practices_told_snapshot_check`
- `organizations.organizations_subscription_amount_cents_check`
- `organizations.organizations_subscription_currency_check`
- `organizations.organizations_tournament_look_policy_check`
- `stripe_billing_drift_checks.stripe_billing_drift_checks_counts_check`
- `stripe_billing_drift_checks.stripe_billing_drift_checks_differences_check`
- `stripe_billing_drift_checks.stripe_billing_drift_checks_environment_check`
- `stripe_billing_drift_checks.stripe_billing_drift_checks_outcome_check`
- `stripe_billing_events.stripe_billing_events_ignored_reason_check`

### CHECK only in PROD (0)
_none_

