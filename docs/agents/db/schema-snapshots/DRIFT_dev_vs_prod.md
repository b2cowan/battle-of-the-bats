# Dev vs Prod — structural drift

**Generated:** 2026-10-25 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 357 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 12 | 0 | — |
| Columns | 191 | 0 | 0 |
| Indexes | 48 | 0 | 2 |
| Constraints | 50 | 0 | — |
| RLS / CHECK | 54 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (12)
- `family_email_sends`
- `online_payment_refunds`
- `online_payments`
- `org_custom_domains`
- `org_payment_accounts`
- `org_site_notices`
- `rep_team_tryout_contacts`
- `stripe_connect_events`
- `tournament_fee_book_settings`
- `tournament_fee_receipt_allocations`
- `tournament_fee_receipts`
- `tournament_team_payments`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (191)
- `family_email_sends.audience_kind`
- `family_email_sends.audience_label`
- `family_email_sends.body`
- `family_email_sends.coach_count`
- `family_email_sends.failed_count`
- `family_email_sends.family_count`
- `family_email_sends.id`
- `family_email_sends.opted_out_count`
- `family_email_sends.org_id`
- `family_email_sends.reached_count`
- `family_email_sends.season_id`
- `family_email_sends.sent_at`
- `family_email_sends.sent_by`
- `family_email_sends.status`
- `family_email_sends.subject`
- `family_email_sends.team_ids`
- `league_divisions.born_from_year`
- `league_divisions.born_to_year`
- `online_payment_refunds.amount`
- `online_payment_refunds.created_at`
- `online_payment_refunds.created_by`
- `online_payment_refunds.failure_reason`
- `online_payment_refunds.fee_refunded`
- `online_payment_refunds.id`
- `online_payment_refunds.note`
- `online_payment_refunds.online_payment_id`
- `online_payment_refunds.org_id`
- `online_payment_refunds.origin`
- `online_payment_refunds.processing_cost_entry_id`
- `online_payment_refunds.reason`
- `online_payment_refunds.refund_entry_id`
- `online_payment_refunds.status`
- `online_payment_refunds.stripe_refund_id`
- `online_payment_refunds.succeeded_at`
- `online_payment_refunds.updated_at`
- `online_payments.base_amount`
- `online_payments.card_brand`
- `online_payments.card_last4`
- `online_payments.created_at`
- `online_payments.currency`
- `online_payments.description`
- `online_payments.fee_amount`
- `online_payments.fee_flat`
- `online_payments.fee_payer`
- `online_payments.fee_pct`
- `online_payments.flow`
- `online_payments.id`
- `online_payments.land_error`
- `online_payments.landed_at`
- `online_payments.livemode`
- `online_payments.org_id`
- `online_payments.paid_at`
- `online_payments.paid_on`
- `online_payments.payer_email`
- `online_payments.processing_cost_entry_id`
- `online_payments.rail`
- `online_payments.receipt_emailed_at`
- `online_payments.receipt_no`
- `online_payments.scope`
- `online_payments.status`
- `online_payments.stripe_account_id`
- `online_payments.stripe_charge_id`
- `online_payments.stripe_checkout_session_id`
- `online_payments.stripe_payment_intent_id`
- `online_payments.team_id`
- `online_payments.total_amount`
- `online_payments.tournament_id`
- `online_payments.updated_at`
- `org_custom_domains.connected_at`
- `org_custom_domains.created_at`
- `org_custom_domains.created_by_user_id`
- `org_custom_domains.domain`
- `org_custom_domains.full_name`
- `org_custom_domains.gave_up_email_sent_at`
- `org_custom_domains.host_branch`
- `org_custom_domains.host_status`
- `org_custom_domains.id`
- `org_custom_domains.last_check`
- `org_custom_domains.last_checked_at`
- `org_custom_domains.live_email_sent_at`
- `org_custom_domains.needs_attention_since`
- `org_custom_domains.not_working_email_sent_at`
- `org_custom_domains.not_working_since`
- `org_custom_domains.org_id`
- `org_custom_domains.padlock_email_sent_at`
- `org_custom_domains.padlock_expires_at`
- `org_custom_domains.padlock_reminder_sent_at`
- `org_custom_domains.prefix`
- `org_custom_domains.record1_name`
- `org_custom_domains.record1_value`
- `org_custom_domains.record2_host_target`
- `org_custom_domains.record2_name`
- `org_custom_domains.record2_value`
- `org_custom_domains.status`
- `org_custom_domains.updated_at`
- `org_custom_domains.waiting_since`
- `org_payment_accounts.charges_enabled`
- `org_payment_accounts.connected_at`
- `org_payment_accounts.connected_by`
- `org_payment_accounts.country`
- `org_payment_accounts.created_at`
- `org_payment_accounts.details_submitted`
- `org_payment_accounts.disabled_reason`
- `org_payment_accounts.disconnected_at`
- `org_payment_accounts.disconnected_by`
- `org_payment_accounts.fee_payer`
- `org_payment_accounts.livemode`
- `org_payment_accounts.org_id`
- `org_payment_accounts.payouts_enabled`
- `org_payment_accounts.refund_policy`
- `org_payment_accounts.requirements_deadline`
- `org_payment_accounts.requirements_due`
- `org_payment_accounts.stripe_account_id`
- `org_payment_accounts.stripe_synced_at`
- `org_payment_accounts.terms_agreed_at`
- `org_payment_accounts.terms_agreed_by`
- `org_payment_accounts.terms_agreed_by_email`
- `org_payment_accounts.terms_version`
- `org_payment_accounts.updated_at`
- `org_public_site_content.contacts`
- `org_public_site_content.documents`
- `org_public_site_content.home_section_order`
- `org_public_site_content.home_sections_hidden`
- `org_public_site_content.questions`
- `org_public_site_content.sponsors`
- `org_site_notices.detail`
- `org_site_notices.ended_at`
- `org_site_notices.ended_by_email`
- `org_site_notices.ends_at`
- `org_site_notices.id`
- `org_site_notices.notice`
- `org_site_notices.org_id`
- `org_site_notices.posted_at`
- `org_site_notices.posted_by_email`
- `org_site_notices.posted_by_user_id`
- `organizations.birthday_cutoffs`
- `organizations.coach_names_policy`
- `rep_program_years.born_from_year`
- `rep_program_years.born_to_year`
- `rep_program_years.born_years_carried`
- `rep_team_staff_memberships.show_name_public`
- `rep_team_tryout_contacts.email`
- `rep_team_tryout_contacts.org_id`
- `rep_team_tryout_contacts.reset_at`
- `rep_team_tryout_contacts.reset_by`
- `rep_team_tryout_contacts.set_at`
- `rep_team_tryout_contacts.set_by_membership_id`
- `rep_team_tryout_contacts.team_id`
- `rep_team_tryout_contacts.updated_at`
- `stripe_connect_events.account`
- `stripe_connect_events.attempts`
- `stripe_connect_events.error`
- `stripe_connect_events.id`
- `stripe_connect_events.livemode`
- `stripe_connect_events.org_id`
- `stripe_connect_events.processed_at`
- `stripe_connect_events.received_at`
- `stripe_connect_events.type`
- `teams.fee_book_baseline`
- `teams.fee_changed_by`
- `teams.pay_link_sent_at`
- `tournament_fee_book_settings.category_id`
- `tournament_fee_book_settings.created_at`
- `tournament_fee_book_settings.item_id`
- `tournament_fee_book_settings.org_id`
- `tournament_fee_book_settings.tournament_id`
- `tournament_fee_receipt_allocations.amount`
- `tournament_fee_receipt_allocations.receipt_id`
- `tournament_fee_receipt_allocations.team_id`
- `tournament_fee_receipts.created_at`
- `tournament_fee_receipts.entry_id`
- `tournament_fee_receipts.id`
- `tournament_fee_receipts.ordinal`
- `tournament_fee_receipts.tournament_id`
- `tournament_team_payments.amount`
- `tournament_team_payments.created_at`
- `tournament_team_payments.created_by`
- `tournament_team_payments.entry_id`
- `tournament_team_payments.id`
- `tournament_team_payments.label`
- `tournament_team_payments.method`
- `tournament_team_payments.online_payment_id`
- `tournament_team_payments.ordinal`
- `tournament_team_payments.org_id`
- `tournament_team_payments.paid_on`
- `tournament_team_payments.removed_at`
- `tournament_team_payments.removed_by`
- `tournament_team_payments.status`
- `tournament_team_payments.team_id`
- `tournament_team_payments.tournament_id`
- `tournament_team_payments.updated_at`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (48)
- `family_email_sends_org_sent_idx`
- `family_email_sends_pkey`
- `idx_rep_team_tryout_contacts_org`
- `idx_rep_team_tryout_contacts_setter`
- `online_payment_refunds_cost_entry_idx`
- `online_payment_refunds_created_by_idx`
- `online_payment_refunds_entry_idx`
- `online_payment_refunds_one_full_refund`
- `online_payment_refunds_org_idx`
- `online_payment_refunds_payment_idx`
- `online_payment_refunds_pkey`
- `online_payment_refunds_stripe_key`
- `online_payments_cost_entry_idx`
- `online_payments_intent_key`
- `online_payments_one_open_per_team`
- `online_payments_open_idx`
- `online_payments_org_idx`
- `online_payments_pkey`
- `online_payments_receipt_key`
- `online_payments_session_key`
- `online_payments_team_idx`
- `online_payments_tournament_idx`
- `org_custom_domains_domain_uidx`
- `org_custom_domains_full_name_uidx`
- `org_custom_domains_org_uidx`
- `org_custom_domains_pkey`
- `org_custom_domains_status_idx`
- `org_payment_accounts_pkey`
- `org_payment_accounts_stripe_account_key`
- `org_site_notices_org_idx`
- `org_site_notices_pkey`
- `rep_team_tryout_contacts_pkey`
- `stripe_connect_events_pkey`
- `stripe_connect_events_received_idx`
- `stripe_connect_events_unprocessed_idx`
- `tournament_fee_allocations_team_idx`
- `tournament_fee_book_settings_org_id_idx`
- `tournament_fee_book_settings_pkey`
- `tournament_fee_receipt_allocations_pkey`
- `tournament_fee_receipts_entry_id_key`
- `tournament_fee_receipts_event_idx`
- `tournament_fee_receipts_pkey`
- `tournament_team_payments_entry_idx`
- `tournament_team_payments_online_payment_key`
- `tournament_team_payments_org_idx`
- `tournament_team_payments_pkey`
- `tournament_team_payments_team_idx`
- `tournament_team_payments_tournament_idx`

### Only in PROD (0)
_none_

### Definition changed (2)
- `notifications_org_needs_attention_idx`
  - dev: `CREATE INDEX notifications_org_needs_attention_idx ON public.notifications USING btree (org_id, event_type) WHERE ((cleared_at IS NULL) AND (event_type = ANY (ARRAY['assistant_coach_approval_requested'::text, 'card_refund_failed'::text, 'club_hand_back_asked'::text, 'club_hand_back_unasked'::text, 'club_payment_handed_off'::text, 'club_schedule_review'::text, 'online_payment_not_recorded'::text, 'payment_failed'::text, 'payouts_need_attention'::text, 'team_coach_payment_reminder'::text, 'team_money_sent'::text, 'team_move_requested'::text, 'team_no_show'::text, 'team_request_filed'::text, 'team_request_holding_payout'::text])))`
  - prod: `CREATE INDEX notifications_org_needs_attention_idx ON public.notifications USING btree (org_id, event_type) WHERE ((cleared_at IS NULL) AND (event_type = ANY (ARRAY['assistant_coach_approval_requested'::text, 'club_hand_back_asked'::text, 'club_hand_back_unasked'::text, 'club_payment_handed_off'::text, 'club_schedule_review'::text, 'payment_failed'::text, 'team_coach_payment_reminder'::text, 'team_money_sent'::text, 'team_move_requested'::text, 'team_no_show'::text, 'team_request_filed'::text, 'team_request_holding_payout'::text])))`
- `notifications_user_needs_attention_idx`
  - dev: `CREATE INDEX notifications_user_needs_attention_idx ON public.notifications USING btree (user_id, event_type) WHERE ((cleared_at IS NULL) AND (event_type = ANY (ARRAY['assistant_coach_approval_requested'::text, 'card_refund_failed'::text, 'club_hand_back_asked'::text, 'club_hand_back_unasked'::text, 'club_payment_handed_off'::text, 'club_schedule_review'::text, 'online_payment_not_recorded'::text, 'payment_failed'::text, 'payouts_need_attention'::text, 'team_coach_payment_reminder'::text, 'team_money_sent'::text, 'team_move_requested'::text, 'team_no_show'::text, 'team_request_filed'::text, 'team_request_holding_payout'::text])))`
  - prod: `CREATE INDEX notifications_user_needs_attention_idx ON public.notifications USING btree (user_id, event_type) WHERE ((cleared_at IS NULL) AND (event_type = ANY (ARRAY['assistant_coach_approval_requested'::text, 'club_hand_back_asked'::text, 'club_hand_back_unasked'::text, 'club_payment_handed_off'::text, 'club_schedule_review'::text, 'payment_failed'::text, 'team_coach_payment_reminder'::text, 'team_money_sent'::text, 'team_move_requested'::text, 'team_no_show'::text, 'team_request_filed'::text, 'team_request_holding_payout'::text])))`

## Constraints (PK / UNIQUE / FK)
### Only in DEV (50)
- `family_email_sends.family_email_sends_org_id_fkey`
- `family_email_sends.family_email_sends_pkey`
- `family_email_sends.family_email_sends_sent_by_fkey`
- `online_payment_refunds.online_payment_refunds_cost_entry_fk`
- `online_payment_refunds.online_payment_refunds_created_by_fk`
- `online_payment_refunds.online_payment_refunds_entry_fk`
- `online_payment_refunds.online_payment_refunds_org_fk`
- `online_payment_refunds.online_payment_refunds_payment_fk`
- `online_payment_refunds.online_payment_refunds_pkey`
- `online_payments.online_payments_cost_entry_fk`
- `online_payments.online_payments_org_fk`
- `online_payments.online_payments_pkey`
- `online_payments.online_payments_team_fk`
- `online_payments.online_payments_tournament_fk`
- `org_custom_domains.org_custom_domains_org_fk`
- `org_custom_domains.org_custom_domains_pkey`
- `org_payment_accounts.org_payment_accounts_connected_by_fk`
- `org_payment_accounts.org_payment_accounts_disconnected_by_fk`
- `org_payment_accounts.org_payment_accounts_org_fk`
- `org_payment_accounts.org_payment_accounts_pkey`
- `org_payment_accounts.org_payment_accounts_terms_by_fk`
- `org_site_notices.org_site_notices_org_fk`
- `org_site_notices.org_site_notices_pkey`
- `rep_team_tryout_contacts.rep_team_tryout_contacts_org_fk`
- `rep_team_tryout_contacts.rep_team_tryout_contacts_pkey`
- `rep_team_tryout_contacts.rep_team_tryout_contacts_reset_by_fk`
- `rep_team_tryout_contacts.rep_team_tryout_contacts_setter_fk`
- `rep_team_tryout_contacts.rep_team_tryout_contacts_team_fk`
- `stripe_connect_events.stripe_connect_events_pkey`
- `teams.teams_fee_changed_by_fkey`
- `tournament_fee_book_settings.tournament_fee_book_settings_category_id_fkey`
- `tournament_fee_book_settings.tournament_fee_book_settings_item_id_fkey`
- `tournament_fee_book_settings.tournament_fee_book_settings_org_id_fkey`
- `tournament_fee_book_settings.tournament_fee_book_settings_pkey`
- `tournament_fee_book_settings.tournament_fee_book_settings_tournament_id_fkey`
- `tournament_fee_receipt_allocations.tournament_fee_receipt_allocations_pkey`
- `tournament_fee_receipt_allocations.tournament_fee_receipt_allocations_receipt_id_fkey`
- `tournament_fee_receipt_allocations.tournament_fee_receipt_allocations_team_id_fkey`
- `tournament_fee_receipts.tournament_fee_receipts_entry_id_fkey`
- `tournament_fee_receipts.tournament_fee_receipts_entry_id_key`
- `tournament_fee_receipts.tournament_fee_receipts_pkey`
- `tournament_fee_receipts.tournament_fee_receipts_tournament_id_fkey`
- `tournament_team_payments.tournament_team_payments_created_by_fk`
- `tournament_team_payments.tournament_team_payments_entry_fk`
- `tournament_team_payments.tournament_team_payments_online_payment_fk`
- `tournament_team_payments.tournament_team_payments_org_fk`
- `tournament_team_payments.tournament_team_payments_pkey`
- `tournament_team_payments.tournament_team_payments_removed_by_fk`
- `tournament_team_payments.tournament_team_payments_team_fk`
- `tournament_team_payments.tournament_team_payments_tournament_fk`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (54)
- `family_email_sends.family_email_sends_audience_kind_check`
- `family_email_sends.family_email_sends_audience_label_check`
- `family_email_sends.family_email_sends_body_check`
- `family_email_sends.family_email_sends_coach_count_check`
- `family_email_sends.family_email_sends_failed_count_check`
- `family_email_sends.family_email_sends_family_count_check`
- `family_email_sends.family_email_sends_opted_out_count_check`
- `family_email_sends.family_email_sends_reached_count_check`
- `family_email_sends.family_email_sends_status_check`
- `family_email_sends.family_email_sends_subject_check`
- `league_divisions.league_divisions_born_years_check`
- `online_payment_refunds.online_payment_refunds_amount_chk`
- `online_payment_refunds.online_payment_refunds_note_chk`
- `online_payment_refunds.online_payment_refunds_origin_chk`
- `online_payment_refunds.online_payment_refunds_reason_chk`
- `online_payment_refunds.online_payment_refunds_status_chk`
- `online_payment_refunds.online_payment_refunds_succeeded_chk`
- `online_payments.online_payments_arithmetic_chk`
- `online_payments.online_payments_base_chk`
- `online_payments.online_payments_currency_chk`
- `online_payments.online_payments_fee_chk`
- `online_payments.online_payments_fee_payer_chk`
- `online_payments.online_payments_flow_chk`
- `online_payments.online_payments_paid_chk`
- `online_payments.online_payments_rail_chk`
- `online_payments.online_payments_scope_chk`
- `online_payments.online_payments_status_chk`
- `online_payments.online_payments_total_chk`
- `org_custom_domains.org_custom_domains_lowercase`
- `org_custom_domains.org_custom_domains_name_parts`
- `org_custom_domains.org_custom_domains_status_check`
- `org_payment_accounts.org_payment_accounts_fee_payer_chk`
- `org_payment_accounts.org_payment_accounts_refund_policy_chk`
- `org_payment_accounts.org_payment_accounts_terms_chk`
- `org_public_site_content.org_public_site_content_contacts_cap`
- `org_public_site_content.org_public_site_content_documents_cap`
- `org_public_site_content.org_public_site_content_home_section_order_known`
- `org_public_site_content.org_public_site_content_home_sections_hidden_known`
- `org_public_site_content.org_public_site_content_questions_cap`
- `org_public_site_content.org_public_site_content_sponsors_cap`
- `org_site_notices.org_site_notices_detail_check`
- `org_site_notices.org_site_notices_ends_after_post`
- `org_site_notices.org_site_notices_notice_check`
- `organizations.organizations_birthday_cutoffs_shape`
- `organizations.organizations_coach_names_policy_check`
- `rep_program_years.rep_program_years_born_years_check`
- `rep_program_years.rep_program_years_tryout_description_length`
- `rep_team_tryout_contacts.rep_team_tryout_contacts_email_check`
- `tournament_fee_receipt_allocations.tournament_fee_receipt_allocations_amount_check`
- `tournament_team_payments.tournament_team_payments_amount_chk`
- `tournament_team_payments.tournament_team_payments_date_chk`
- `tournament_team_payments.tournament_team_payments_label_chk`
- `tournament_team_payments.tournament_team_payments_method_chk`
- `tournament_team_payments.tournament_team_payments_status_chk`

### CHECK only in PROD (0)
_none_

