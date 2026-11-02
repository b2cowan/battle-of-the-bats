# Dev vs Prod — structural drift

**Generated:** 2026-11-02 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 143 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 6 | 0 | — |
| Columns | 71 | 0 | 0 |
| Indexes | 25 | 0 | 0 |
| Constraints | 21 | 0 | — |
| RLS / CHECK | 19 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (6)
- `league_practice_emails`
- `league_practice_tells`
- `league_team_practices_told`
- `stripe_billing_drift_checks`
- `stripe_billing_events`
- `stripe_price_ids_retired`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (71)
- `billing_retention_intents.change_log`
- `billing_retention_intents.ended_email_sent_at`
- `billing_retention_intents.ends_on_email_sent_at`
- `billing_retention_intents.held_move_plan`
- `billing_retention_intents.kept_email_sent_at`
- `billing_retention_intents.notify_owner`
- `billing_retention_intents.reminder_email_sent_at`
- `billing_retention_intents.stripe_subscription_id`
- `league_divisions.show_standings`
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
### Only in DEV (25)
- `billing_retention_intents_one_pending_cancellation`
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
### Only in DEV (21)
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

### CHECK only in DEV (19)
- `billing_retention_intents.billing_retention_intents_change_log_check`
- `league_practice_emails.league_practice_emails_guardian_email_check`
- `league_practice_emails.league_practice_emails_registration_ids_check`
- `league_practice_emails.league_practice_emails_status_check`
- `league_practice_emails.league_practice_emails_team_ids_check`
- `league_practice_tells.league_practice_tells_check`
- `league_practice_tells.league_practice_tells_kind_check`
- `league_practice_tells.league_practice_tells_snapshot_check`
- `league_practice_tells.league_practice_tells_told_before_check`
- `league_registrations.league_registrations_link_version_check`
- `league_team_coaches.league_team_coaches_calendar_generation_nonneg`
- `league_team_practices_told.league_team_practices_told_snapshot_check`
- `organizations.organizations_subscription_amount_cents_check`
- `organizations.organizations_subscription_currency_check`
- `stripe_billing_drift_checks.stripe_billing_drift_checks_counts_check`
- `stripe_billing_drift_checks.stripe_billing_drift_checks_differences_check`
- `stripe_billing_drift_checks.stripe_billing_drift_checks_environment_check`
- `stripe_billing_drift_checks.stripe_billing_drift_checks_outcome_check`
- `stripe_billing_events.stripe_billing_events_ignored_reason_check`

### CHECK only in PROD (0)
_none_

