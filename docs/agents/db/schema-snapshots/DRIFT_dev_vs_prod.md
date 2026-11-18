# Dev vs Prod — structural drift

**Generated:** 2026-11-18 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 274 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 7 | 2 | — |
| Columns | 91 | 37 | 2 |
| Indexes | 34 | 12 | 0 |
| Constraints | 29 | 7 | — |
| RLS / CHECK | 37 | 16 | 0 (RLS state) |

## Tables
### Only in DEV (7)
- `club_group_email_bodies`
- `club_group_email_recipients`
- `club_group_email_sends`
- `club_schedule_bill_rates`
- `online_payment_stripe_fee_lines`
- `org_time_date_off_venues`
- `payments_terms_agreements`

### Only in PROD (2)
- `platform_fee_invoices`
- `platform_stripe_fees`

## Columns
### Only in DEV (91)
- `club_group_email_bodies.body`
- `club_group_email_bodies.created_at`
- `club_group_email_bodies.org_id`
- `club_group_email_bodies.send_id`
- `club_group_email_bodies.subject`
- `club_group_email_recipients.basis`
- `club_group_email_recipients.board_role`
- `club_group_email_recipients.house_league`
- `club_group_email_recipients.id`
- `club_group_email_recipients.league_coach_id`
- `club_group_email_recipients.line`
- `club_group_email_recipients.name`
- `club_group_email_recipients.org_id`
- `club_group_email_recipients.rep`
- `club_group_email_recipients.send_id`
- `club_group_email_recipients.status`
- `club_group_email_recipients.updated_at`
- `club_group_email_recipients.user_id`
- `club_group_email_sends.club_copy`
- `club_group_email_sends.failed_count`
- `club_group_email_sends.group_key`
- `club_group_email_sends.group_kind`
- `club_group_email_sends.group_label`
- `club_group_email_sends.group_params`
- `club_group_email_sends.id`
- `club_group_email_sends.kind`
- `club_group_email_sends.left_out_count`
- `club_group_email_sends.names_cleared_at`
- `club_group_email_sends.org_id`
- `club_group_email_sends.reached_count`
- `club_group_email_sends.reaches_house_league`
- `club_group_email_sends.reaches_rep`
- `club_group_email_sends.recipient_count`
- `club_group_email_sends.reply_to`
- `club_group_email_sends.retried_at`
- `club_group_email_sends.sender_name`
- `club_group_email_sends.sender_role`
- `club_group_email_sends.sent_at`
- `club_group_email_sends.sent_by`
- `club_group_email_sends.status`
- `club_group_email_sends.words_cleared_at`
- `club_schedule_bill_rates.created_at`
- `club_schedule_bill_rates.first_billed_send_id`
- `club_schedule_bill_rates.id`
- `club_schedule_bill_rates.org_id`
- `club_schedule_bill_rates.permit_id`
- `club_schedule_bill_rates.permit_name`
- `club_schedule_bill_rates.scale`
- `club_schedule_bill_rates.schedule_id`
- `club_schedule_slots.family_id`
- `club_schedules.bill_dismissed_at`
- `club_schedules.bill_dismissed_by`
- `club_schedules.bill_price_mode`
- `club_schedules.part_label`
- `club_schedules.part_of_schedule_id`
- `family_email_sends.club_copy`
- `family_email_sends.names_cleared_at`
- `family_email_sends.reply_to`
- `family_email_sends.words_cleared_at`
- `online_payment_stripe_fee_lines.amount`
- `online_payment_stripe_fee_lines.booked_at`
- `online_payment_stripe_fee_lines.created_at`
- `online_payment_stripe_fee_lines.description`
- `online_payment_stripe_fee_lines.entry_id`
- `online_payment_stripe_fee_lines.id`
- `online_payment_stripe_fee_lines.kind`
- `online_payment_stripe_fee_lines.livemode`
- `online_payment_stripe_fee_lines.online_payment_id`
- `online_payment_stripe_fee_lines.org_id`
- `online_payment_stripe_fee_lines.stripe_account_id`
- `online_payment_stripe_fee_lines.stripe_created_at`
- `online_payment_stripe_fee_lines.stripe_txn_id`
- `online_payment_stripe_fee_lines.unmatched_reason`
- `online_payments.application_fee_amount`
- `online_payments.dispute_fee_entry_id`
- `online_payments.reversal_fee_entry_id`
- `online_payments.stripe_extra_entry_id`
- `online_payments.stripe_fee_amount`
- `org_payment_accounts.fees_collector`
- `org_time_date_off_venues.date_off_id`
- `org_time_date_off_venues.org_id`
- `org_time_date_off_venues.org_venue_id`
- `payments_terms_agreements.action`
- `payments_terms_agreements.agreed_at`
- `payments_terms_agreements.box_text`
- `payments_terms_agreements.id`
- `payments_terms_agreements.org_id`
- `payments_terms_agreements.org_name`
- `payments_terms_agreements.terms_version`
- `payments_terms_agreements.user_email`
- `payments_terms_agreements.user_id`

### Only in PROD (37)
- `platform_fee_invoices.amount_due`
- `platform_fee_invoices.created_at`
- `platform_fee_invoices.due_at`
- `platform_fee_invoices.emailed_at`
- `platform_fee_invoices.finalized_at`
- `platform_fee_invoices.hosted_invoice_url`
- `platform_fee_invoices.id`
- `platform_fee_invoices.invoice_number`
- `platform_fee_invoices.livemode`
- `platform_fee_invoices.org_id`
- `platform_fee_invoices.paid_at`
- `platform_fee_invoices.period_start`
- `platform_fee_invoices.reminded_at`
- `platform_fee_invoices.send_error`
- `platform_fee_invoices.status`
- `platform_fee_invoices.stripe_customer_id`
- `platform_fee_invoices.stripe_invoice_id`
- `platform_fee_invoices.tax_lines`
- `platform_fee_invoices.total`
- `platform_fee_invoices.updated_at`
- `platform_stripe_fees.amount`
- `platform_stripe_fees.amount_source`
- `platform_stripe_fees.bill_attempts`
- `platform_stripe_fees.bill_error`
- `platform_stripe_fees.billed_at`
- `platform_stripe_fees.billed_on`
- `platform_stripe_fees.created_at`
- `platform_stripe_fees.dispute_id`
- `platform_stripe_fees.exempt_reason`
- `platform_stripe_fees.fee_invoice_id`
- `platform_stripe_fees.id`
- `platform_stripe_fees.kind`
- `platform_stripe_fees.livemode`
- `platform_stripe_fees.online_payment_id`
- `platform_stripe_fees.org_id`
- `platform_stripe_fees.stripe_credit_note_id`
- `platform_stripe_fees.stripe_invoice_item_id`

### Type/nullability/default changed (2)
- `family_email_sends.body` — dev: `text|text|YES|` | prod: `text|text|NO|`
- `family_email_sends.subject` — dev: `text|text|YES|` | prod: `text|text|NO|`

## Indexes
### Only in DEV (34)
- `club_group_email_bodies_org_idx`
- `club_group_email_bodies_pkey`
- `club_group_email_recipients_org_idx`
- `club_group_email_recipients_pkey`
- `club_group_email_recipients_send_idx`
- `club_group_email_recipients_user_idx`
- `club_group_email_sends_group_idx`
- `club_group_email_sends_names_due_idx`
- `club_group_email_sends_org_sent_idx`
- `club_group_email_sends_pkey`
- `club_group_email_sends_words_due_idx`
- `club_schedule_bill_rates_org_idx`
- `club_schedule_bill_rates_permit_idx`
- `club_schedule_bill_rates_pkey`
- `club_schedule_bill_rates_schedule_permit_key`
- `club_schedule_bill_rates_send_idx`
- `club_schedule_slots_family_place_start`
- `club_schedules_part_label_once`
- `club_schedules_part_of_idx`
- `family_email_sends_names_due_idx`
- `family_email_sends_words_due_idx`
- `online_payment_stripe_fee_lines_entry_idx`
- `online_payment_stripe_fee_lines_org_idx`
- `online_payment_stripe_fee_lines_payment_idx`
- `online_payment_stripe_fee_lines_pkey`
- `online_payment_stripe_fee_lines_txn_key`
- `online_payments_dispute_fee_entry_idx`
- `online_payments_extra_entry_idx`
- `online_payments_reversal_fee_entry_idx`
- `org_time_date_off_venues_org_idx`
- `org_time_date_off_venues_pkey`
- `org_time_date_off_venues_venue_idx`
- `payments_terms_agreements_org_idx`
- `payments_terms_agreements_pkey`

### Only in PROD (12)
- `club_schedule_slots_place_start`
- `platform_fee_invoices_period_key`
- `platform_fee_invoices_pkey`
- `platform_fee_invoices_stripe_key`
- `platform_fee_invoices_unpaid_idx`
- `platform_stripe_fees_credit_note_key`
- `platform_stripe_fees_dispute_idx`
- `platform_stripe_fees_invoice_idx`
- `platform_stripe_fees_key`
- `platform_stripe_fees_org_idx`
- `platform_stripe_fees_pkey`
- `platform_stripe_fees_unbilled_idx`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (29)
- `club_group_email_bodies.club_group_email_bodies_org_id_fkey`
- `club_group_email_bodies.club_group_email_bodies_pkey`
- `club_group_email_bodies.club_group_email_bodies_send_id_fkey`
- `club_group_email_recipients.club_group_email_recipients_org_id_fkey`
- `club_group_email_recipients.club_group_email_recipients_pkey`
- `club_group_email_recipients.club_group_email_recipients_send_id_fkey`
- `club_group_email_sends.club_group_email_sends_org_id_fkey`
- `club_group_email_sends.club_group_email_sends_pkey`
- `club_schedule_bill_rates.club_schedule_bill_rates_first_billed_send_id_fkey`
- `club_schedule_bill_rates.club_schedule_bill_rates_org_id_fkey`
- `club_schedule_bill_rates.club_schedule_bill_rates_permit_id_fkey`
- `club_schedule_bill_rates.club_schedule_bill_rates_pkey`
- `club_schedule_bill_rates.club_schedule_bill_rates_schedule_id_fkey`
- `club_schedule_bill_rates.club_schedule_bill_rates_schedule_permit_key`
- `club_schedules.club_schedules_bill_dismissed_by_fkey`
- `club_schedules.club_schedules_part_of_schedule_id_fkey`
- `online_payment_stripe_fee_lines.online_payment_stripe_fee_lines_entry_id_fkey`
- `online_payment_stripe_fee_lines.online_payment_stripe_fee_lines_online_payment_id_fkey`
- `online_payment_stripe_fee_lines.online_payment_stripe_fee_lines_org_id_fkey`
- `online_payment_stripe_fee_lines.online_payment_stripe_fee_lines_pkey`
- `online_payment_stripe_fee_lines.online_payment_stripe_fee_lines_txn_key`
- `online_payments.online_payments_dispute_fee_entry_fk`
- `online_payments.online_payments_extra_entry_fk`
- `online_payments.online_payments_reversal_fee_entry_fk`
- `org_time_date_off_venues.org_time_date_off_venues_date_off_id_fkey`
- `org_time_date_off_venues.org_time_date_off_venues_org_id_fkey`
- `org_time_date_off_venues.org_time_date_off_venues_org_venue_id_fkey`
- `org_time_date_off_venues.org_time_date_off_venues_pkey`
- `payments_terms_agreements.payments_terms_agreements_pkey`

### Only in PROD (7)
- `platform_fee_invoices.platform_fee_invoices_org_id_fkey`
- `platform_fee_invoices.platform_fee_invoices_pkey`
- `platform_stripe_fees.platform_stripe_fees_dispute_id_fkey`
- `platform_stripe_fees.platform_stripe_fees_invoice_fk`
- `platform_stripe_fees.platform_stripe_fees_online_payment_id_fkey`
- `platform_stripe_fees.platform_stripe_fees_org_id_fkey`
- `platform_stripe_fees.platform_stripe_fees_pkey`

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (37)
- `club_group_email_bodies.club_group_email_bodies_body_check`
- `club_group_email_bodies.club_group_email_bodies_subject_check`
- `club_group_email_recipients.club_group_email_recipients_basis_check`
- `club_group_email_recipients.club_group_email_recipients_board_role`
- `club_group_email_recipients.club_group_email_recipients_board_role_check`
- `club_group_email_recipients.club_group_email_recipients_line_check`
- `club_group_email_recipients.club_group_email_recipients_name_check`
- `club_group_email_recipients.club_group_email_recipients_source`
- `club_group_email_recipients.club_group_email_recipients_status_check`
- `club_group_email_sends.club_group_email_sends_club_copy_check`
- `club_group_email_sends.club_group_email_sends_failed_count_check`
- `club_group_email_sends.club_group_email_sends_group_key_check`
- `club_group_email_sends.club_group_email_sends_group_kind_check`
- `club_group_email_sends.club_group_email_sends_group_label_check`
- `club_group_email_sends.club_group_email_sends_kind_check`
- `club_group_email_sends.club_group_email_sends_left_out_count_check`
- `club_group_email_sends.club_group_email_sends_reached_count_check`
- `club_group_email_sends.club_group_email_sends_recipient_count_check`
- `club_group_email_sends.club_group_email_sends_reply_to_check`
- `club_group_email_sends.club_group_email_sends_sender_name_check`
- `club_group_email_sends.club_group_email_sends_sender_role_check`
- `club_group_email_sends.club_group_email_sends_status_check`
- `club_schedule_bill_rates.club_schedule_bill_rates_scale_check`
- `club_schedules.club_schedules_bill_price_mode_check`
- `club_schedules.club_schedules_part_label_length`
- `club_schedules.club_schedules_part_label_pairs`
- `club_schedules.club_schedules_part_never_in_review`
- `family_email_sends.family_email_sends_club_copy_check`
- `family_email_sends.family_email_sends_reply_to_check`
- `online_payment_stripe_fee_lines.online_payment_stripe_fee_lines_kind_chk`
- `online_payment_stripe_fee_lines.online_payment_stripe_fee_lines_unmatched_chk`
- `online_payments.online_payments_application_fee_chk`
- `online_payments.online_payments_stripe_fee_chk`
- `org_payment_accounts.org_payment_accounts_fees_collector_chk`
- `payments_terms_agreements.payments_terms_agreements_action_check`
- `payments_terms_agreements.payments_terms_agreements_text_shape`
- `payments_terms_agreements.payments_terms_agreements_version_shape`

### CHECK only in PROD (16)
- `platform_fee_invoices.platform_fee_invoices_final_chk`
- `platform_fee_invoices.platform_fee_invoices_paid_chk`
- `platform_fee_invoices.platform_fee_invoices_period_start_check`
- `platform_fee_invoices.platform_fee_invoices_send_error_check`
- `platform_fee_invoices.platform_fee_invoices_status_check`
- `platform_fee_invoices.platform_fee_invoices_tax_lines_chk`
- `platform_stripe_fees.platform_stripe_fees_amount_chk`
- `platform_stripe_fees.platform_stripe_fees_bill_error_chk`
- `platform_stripe_fees.platform_stripe_fees_billed_chk`
- `platform_stripe_fees.platform_stripe_fees_billed_on_chk`
- `platform_stripe_fees.platform_stripe_fees_credit_note_chk`
- `platform_stripe_fees.platform_stripe_fees_dispute_chk`
- `platform_stripe_fees.platform_stripe_fees_exempt_chk`
- `platform_stripe_fees.platform_stripe_fees_exempt_reason_chk`
- `platform_stripe_fees.platform_stripe_fees_kind_chk`
- `platform_stripe_fees.platform_stripe_fees_source_chk`

