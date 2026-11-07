# Dev vs Prod — structural drift

**Generated:** 2026-11-07 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 402 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 5 | 6 | — |
| Columns | 132 | 59 | 0 |
| Indexes | 30 | 26 | 0 |
| Constraints | 17 | 28 | — |
| RLS / CHECK | 72 | 26 | 0 (RLS state) |

## Tables
### Only in DEV (5)
- `bank_check_waiting`
- `platform_charge_tax_looks`
- `platform_charge_tax_records`
- `platform_credit_note_tax_records`
- `second_parent_stops`

### Only in PROD (6)
- `bank_check_added_lines`
- `bank_check_changes`
- `bank_check_events`
- `bank_check_marks`
- `bank_line_exclusions`
- `bank_saved_lines`

## Columns
### Only in DEV (132)
- `bank_check_waiting.added_at`
- `bank_check_waiting.added_by`
- `bank_check_waiting.amount_cents`
- `bank_check_waiting.at_start`
- `bank_check_waiting.check_id`
- `bank_check_waiting.direction`
- `bank_check_waiting.id`
- `bank_check_waiting.label`
- `bank_check_waiting.line_date`
- `bank_check_waiting.line_key`
- `bank_checks.book_ids`
- `bank_checks.books_cents`
- `bank_checks.cash_not_deposited_cents`
- `bank_checks.corrected_at`
- `bank_checks.corrected_by`
- `bank_checks.deleted_at`
- `bank_checks.deleted_by`
- `bank_checks.kind`
- `bank_checks.on_its_way_cents`
- `family_links.child_id`
- `org_children.emergency_contact_name`
- `org_children.emergency_contact_phone`
- `org_children.medical_notes`
- `platform_charge_tax_looks.after_id`
- `platform_charge_tax_looks.id`
- `platform_charge_tax_looks.livemode`
- `platform_charge_tax_looks.looked_at`
- `platform_charge_tax_looks.looked_by`
- `platform_charge_tax_looks.looked_keys`
- `platform_charge_tax_looks.org_id`
- `platform_charge_tax_looks.put_back_of`
- `platform_charge_tax_looks.seq`
- `platform_charge_tax_looks.stripe_invoice_id`
- `platform_charge_tax_looks.why`
- `platform_charge_tax_records.amount_before_tax_cents`
- `platform_charge_tax_records.buyer_kind`
- `platform_charge_tax_records.buyer_name`
- `platform_charge_tax_records.cad_amount_before_tax_cents`
- `platform_charge_tax_records.cad_tax_total_cents`
- `platform_charge_tax_records.cad_total_cents`
- `platform_charge_tax_records.card_country`
- `platform_charge_tax_records.created_at`
- `platform_charge_tax_records.currency`
- `platform_charge_tax_records.evidence_captured`
- `platform_charge_tax_records.evidence_city`
- `platform_charge_tax_records.evidence_confirmed_at`
- `platform_charge_tax_records.evidence_country`
- `platform_charge_tax_records.evidence_line1`
- `platform_charge_tax_records.evidence_line2`
- `platform_charge_tax_records.evidence_missing`
- `platform_charge_tax_records.evidence_postal_code`
- `platform_charge_tax_records.evidence_read_at`
- `platform_charge_tax_records.evidence_region`
- `platform_charge_tax_records.fx_rate`
- `platform_charge_tax_records.fx_rate_date`
- `platform_charge_tax_records.fx_source`
- `platform_charge_tax_records.gst_hst_position`
- `platform_charge_tax_records.gst_hst_position_why`
- `platform_charge_tax_records.id`
- `platform_charge_tax_records.invoice_number`
- `platform_charge_tax_records.issued_at`
- `platform_charge_tax_records.kind`
- `platform_charge_tax_records.livemode`
- `platform_charge_tax_records.org_id`
- `platform_charge_tax_records.paid_at`
- `platform_charge_tax_records.payout_country`
- `platform_charge_tax_records.refunded_cents`
- `platform_charge_tax_records.review_note`
- `platform_charge_tax_records.review_reason`
- `platform_charge_tax_records.status`
- `platform_charge_tax_records.stripe_cad_total_cents`
- `platform_charge_tax_records.stripe_customer_id`
- `platform_charge_tax_records.stripe_invoice_id`
- `platform_charge_tax_records.stripe_payment_intent_id`
- `platform_charge_tax_records.stripe_subscription_id`
- `platform_charge_tax_records.stripe_tax_status`
- `platform_charge_tax_records.tax_lines`
- `platform_charge_tax_records.tax_total_cents`
- `platform_charge_tax_records.taxed_country`
- `platform_charge_tax_records.taxed_postal_code`
- `platform_charge_tax_records.taxed_region`
- `platform_charge_tax_records.total_cents`
- `platform_charge_tax_records.uncollectible_at`
- `platform_charge_tax_records.updated_at`
- `platform_charge_tax_records.us_declaration_at`
- `platform_charge_tax_records.us_declaration_version`
- `platform_charge_tax_records.user_id`
- `platform_charge_tax_records.voided_at`
- `platform_credit_note_tax_records.amount_before_tax_cents`
- `platform_credit_note_tax_records.cad_amount_before_tax_cents`
- `platform_credit_note_tax_records.cad_tax_total_cents`
- `platform_credit_note_tax_records.cad_total_cents`
- `platform_credit_note_tax_records.created_at`
- `platform_credit_note_tax_records.currency`
- `platform_credit_note_tax_records.evidence_captured`
- `platform_credit_note_tax_records.fx_rate`
- `platform_credit_note_tax_records.fx_rate_date`
- `platform_credit_note_tax_records.fx_source`
- `platform_credit_note_tax_records.id`
- `platform_credit_note_tax_records.issued_at`
- `platform_credit_note_tax_records.kind`
- `platform_credit_note_tax_records.livemode`
- `platform_credit_note_tax_records.note_number`
- `platform_credit_note_tax_records.note_type`
- `platform_credit_note_tax_records.org_id`
- `platform_credit_note_tax_records.out_of_band_cents`
- `platform_credit_note_tax_records.refund_cents`
- `platform_credit_note_tax_records.status`
- `platform_credit_note_tax_records.stripe_credit_note_id`
- `platform_credit_note_tax_records.stripe_customer_id`
- `platform_credit_note_tax_records.stripe_invoice_id`
- `platform_credit_note_tax_records.stripe_reason`
- `platform_credit_note_tax_records.tax_lines`
- `platform_credit_note_tax_records.tax_total_cents`
- `platform_credit_note_tax_records.total_cents`
- `platform_credit_note_tax_records.updated_at`
- `platform_credit_note_tax_records.user_id`
- `platform_credit_note_tax_records.voided_at`
- `platform_fee_invoices.tax_lines`
- `platform_fee_invoices.total`
- `platform_refunds.stripe_credit_note_id`
- `platform_refunds.stripe_credit_note_number`
- `platform_refunds.stripe_invoice_id`
- `rep_document_templates.validity`
- `rep_roster_players.health_confirmed_at`
- `rep_roster_players.health_confirmed_by`
- `second_parent_stops.email`
- `second_parent_stops.id`
- `second_parent_stops.org_id`
- `second_parent_stops.registration_ids`
- `second_parent_stops.source`
- `second_parent_stops.stopped_at`

### Only in PROD (59)
- `bank_accounts.opening_balance_cents`
- `bank_accounts.opening_date`
- `bank_accounts.set_up_at`
- `bank_accounts.set_up_by`
- `bank_check_added_lines.added_at`
- `bank_check_added_lines.added_by`
- `bank_check_added_lines.check_id`
- `bank_check_added_lines.id`
- `bank_check_added_lines.kind`
- `bank_check_added_lines.line_key`
- `bank_check_changes.changed_at`
- `bank_check_changes.changed_by`
- `bank_check_changes.check_id`
- `bank_check_changes.cleared_at`
- `bank_check_changes.cleared_by`
- `bank_check_changes.id`
- `bank_check_changes.line_key`
- `bank_check_changes.now_amount_cents`
- `bank_check_changes.now_date`
- `bank_check_changes.now_direction`
- `bank_check_changes.removed`
- `bank_check_changes.was_amount_cents`
- `bank_check_changes.was_date`
- `bank_check_changes.was_direction`
- `bank_check_events.at`
- `bank_check_events.by_user`
- `bank_check_events.check_id`
- `bank_check_events.id`
- `bank_check_events.kind`
- `bank_check_events.reason`
- `bank_check_marks.amount_cents`
- `bank_check_marks.bank_account_id`
- `bank_check_marks.check_id`
- `bank_check_marks.direction`
- `bank_check_marks.id`
- `bank_check_marks.line_date`
- `bank_check_marks.line_key`
- `bank_check_marks.marked_at`
- `bank_check_marks.marked_by`
- `bank_check_marks.payout_key`
- `bank_checks.checked_at`
- `bank_checks.checked_by`
- `bank_checks.outstanding_snapshot`
- `bank_checks.status`
- `bank_line_exclusions.bank_account_id`
- `bank_line_exclusions.excluded_at`
- `bank_line_exclusions.excluded_by`
- `bank_line_exclusions.id`
- `bank_line_exclusions.line_key`
- `bank_saved_lines.amount_cents`
- `bank_saved_lines.bank_account_id`
- `bank_saved_lines.description`
- `bank_saved_lines.direction`
- `bank_saved_lines.id`
- `bank_saved_lines.kind`
- `bank_saved_lines.line_date`
- `bank_saved_lines.line_key`
- `bank_saved_lines.saved_at`
- `bank_saved_lines.saved_by`

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (30)
- `bank_check_waiting_added_by_idx`
- `bank_check_waiting_once`
- `bank_check_waiting_pkey`
- `bank_checks_account_idx`
- `bank_checks_corrected_by_idx`
- `bank_checks_deleted_by_idx`
- `bank_checks_one_live_per_date`
- `bank_checks_one_live_start`
- `family_links_child_id_idx`
- `family_links_live_child_uniq`
- `platform_charge_tax_looks_chain_idx`
- `platform_charge_tax_looks_invoice_idx`
- `platform_charge_tax_looks_pkey`
- `platform_charge_tax_looks_put_back_once_idx`
- `platform_charge_tax_records_customer_idx`
- `platform_charge_tax_records_org_idx`
- `platform_charge_tax_records_period_idx`
- `platform_charge_tax_records_pkey`
- `platform_charge_tax_records_stripe_invoice_id_key`
- `platform_charge_tax_records_user_idx`
- `platform_credit_note_tax_records_invoice_idx`
- `platform_credit_note_tax_records_org_idx`
- `platform_credit_note_tax_records_period_idx`
- `platform_credit_note_tax_records_pkey`
- `platform_credit_note_tax_records_stripe_credit_note_id_key`
- `platform_credit_note_tax_records_user_idx`
- `platform_refunds_credit_note_uniq`
- `second_parent_stops_org_email_uniq`
- `second_parent_stops_pkey`
- `second_parent_stops_registration_ids_idx`

### Only in PROD (26)
- `bank_accounts_set_up_by_idx`
- `bank_check_added_lines_by_idx`
- `bank_check_added_lines_once`
- `bank_check_added_lines_pkey`
- `bank_check_changes_changed_by_idx`
- `bank_check_changes_check_idx`
- `bank_check_changes_cleared_by_idx`
- `bank_check_changes_open_idx`
- `bank_check_changes_pkey`
- `bank_check_events_by_idx`
- `bank_check_events_check_idx`
- `bank_check_events_pkey`
- `bank_check_marks_by_idx`
- `bank_check_marks_check_idx`
- `bank_check_marks_one_tick`
- `bank_check_marks_pkey`
- `bank_checks_checked_by_idx`
- `bank_checks_id_account`
- `bank_checks_one_per_end_date`
- `bank_line_exclusions_by_idx`
- `bank_line_exclusions_once`
- `bank_line_exclusions_pkey`
- `bank_saved_lines_by_idx`
- `bank_saved_lines_once`
- `bank_saved_lines_pkey`
- `family_links_live_uniq`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (17)
- `bank_check_waiting.bank_check_waiting_added_by_fkey`
- `bank_check_waiting.bank_check_waiting_check_id_fkey`
- `bank_check_waiting.bank_check_waiting_once`
- `bank_check_waiting.bank_check_waiting_pkey`
- `bank_checks.bank_checks_corrected_by_fkey`
- `bank_checks.bank_checks_deleted_by_fkey`
- `family_links.family_links_child_id_fkey`
- `platform_charge_tax_looks.platform_charge_tax_looks_after_id_fkey`
- `platform_charge_tax_looks.platform_charge_tax_looks_pkey`
- `platform_charge_tax_looks.platform_charge_tax_looks_put_back_of_fkey`
- `platform_charge_tax_records.platform_charge_tax_records_pkey`
- `platform_charge_tax_records.platform_charge_tax_records_stripe_invoice_id_key`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_pkey`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_stripe_credit_note_id_key`
- `rep_roster_players.rep_roster_players_health_confirmed_by_fkey`
- `second_parent_stops.second_parent_stops_org_id_fkey`
- `second_parent_stops.second_parent_stops_pkey`

### Only in PROD (28)
- `bank_accounts.bank_accounts_set_up_by_fkey`
- `bank_check_added_lines.bank_check_added_lines_added_by_fkey`
- `bank_check_added_lines.bank_check_added_lines_check_id_fkey`
- `bank_check_added_lines.bank_check_added_lines_once`
- `bank_check_added_lines.bank_check_added_lines_pkey`
- `bank_check_changes.bank_check_changes_changed_by_fkey`
- `bank_check_changes.bank_check_changes_check_id_fkey`
- `bank_check_changes.bank_check_changes_cleared_by_fkey`
- `bank_check_changes.bank_check_changes_pkey`
- `bank_check_events.bank_check_events_by_user_fkey`
- `bank_check_events.bank_check_events_check_id_fkey`
- `bank_check_events.bank_check_events_pkey`
- `bank_check_marks.bank_check_marks_bank_account_id_fkey`
- `bank_check_marks.bank_check_marks_check_same_account`
- `bank_check_marks.bank_check_marks_marked_by_fkey`
- `bank_check_marks.bank_check_marks_one_tick`
- `bank_check_marks.bank_check_marks_pkey`
- `bank_checks.bank_checks_checked_by_fkey`
- `bank_checks.bank_checks_id_account`
- `bank_checks.bank_checks_one_per_end_date`
- `bank_line_exclusions.bank_line_exclusions_bank_account_id_fkey`
- `bank_line_exclusions.bank_line_exclusions_excluded_by_fkey`
- `bank_line_exclusions.bank_line_exclusions_once`
- `bank_line_exclusions.bank_line_exclusions_pkey`
- `bank_saved_lines.bank_saved_lines_bank_account_id_fkey`
- `bank_saved_lines.bank_saved_lines_once`
- `bank_saved_lines.bank_saved_lines_pkey`
- `bank_saved_lines.bank_saved_lines_saved_by_fkey`

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (72)
- `bank_check_waiting.bank_check_waiting_added_shape`
- `bank_check_waiting.bank_check_waiting_amount_cents_check`
- `bank_check_waiting.bank_check_waiting_direction_check`
- `bank_check_waiting.bank_check_waiting_label_check`
- `bank_check_waiting.bank_check_waiting_line_key_check`
- `bank_checks.bank_checks_cash_shape`
- `bank_checks.bank_checks_corrected_shape`
- `bank_checks.bank_checks_deleted_shape`
- `bank_checks.bank_checks_kind`
- `platform_charge_tax_looks.platform_charge_tax_looks_keys_shape`
- `platform_charge_tax_looks.platform_charge_tax_looks_looked_by_check`
- `platform_charge_tax_looks.platform_charge_tax_looks_not_itself`
- `platform_charge_tax_looks.platform_charge_tax_looks_put_back_is_newest`
- `platform_charge_tax_looks.platform_charge_tax_looks_shape`
- `platform_charge_tax_looks.platform_charge_tax_looks_stripe_invoice_id_check`
- `platform_charge_tax_looks.platform_charge_tax_looks_why_check`
- `platform_charge_tax_records.platform_charge_tax_records_buyer_kind_check`
- `platform_charge_tax_records.platform_charge_tax_records_buyer_name_check`
- `platform_charge_tax_records.platform_charge_tax_records_buyer_shape`
- `platform_charge_tax_records.platform_charge_tax_records_cad_is_itself`
- `platform_charge_tax_records.platform_charge_tax_records_card_country_check`
- `platform_charge_tax_records.platform_charge_tax_records_currency_check`
- `platform_charge_tax_records.platform_charge_tax_records_evidence_captured_check`
- `platform_charge_tax_records.platform_charge_tax_records_evidence_country_check`
- `platform_charge_tax_records.platform_charge_tax_records_evidence_region_check`
- `platform_charge_tax_records.platform_charge_tax_records_evidence_shape`
- `platform_charge_tax_records.platform_charge_tax_records_fx_rate_check`
- `platform_charge_tax_records.platform_charge_tax_records_fx_shape`
- `platform_charge_tax_records.platform_charge_tax_records_fx_source_check`
- `platform_charge_tax_records.platform_charge_tax_records_gst_hst_position_check`
- `platform_charge_tax_records.platform_charge_tax_records_gst_hst_position_why_check`
- `platform_charge_tax_records.platform_charge_tax_records_invoice_number_check`
- `platform_charge_tax_records.platform_charge_tax_records_kind_check`
- `platform_charge_tax_records.platform_charge_tax_records_payout_country_check`
- `platform_charge_tax_records.platform_charge_tax_records_refunded_cents_check`
- `platform_charge_tax_records.platform_charge_tax_records_status_check`
- `platform_charge_tax_records.platform_charge_tax_records_stripe_customer_id_check`
- `platform_charge_tax_records.platform_charge_tax_records_stripe_invoice_id_check`
- `platform_charge_tax_records.platform_charge_tax_records_stripe_payment_intent_id_check`
- `platform_charge_tax_records.platform_charge_tax_records_stripe_subscription_id_check`
- `platform_charge_tax_records.platform_charge_tax_records_stripe_tax_status_check`
- `platform_charge_tax_records.platform_charge_tax_records_tax_lines_check`
- `platform_charge_tax_records.platform_charge_tax_records_taxed_country_check`
- `platform_charge_tax_records.platform_charge_tax_records_taxed_postal_code_check`
- `platform_charge_tax_records.platform_charge_tax_records_taxed_region_check`
- `platform_charge_tax_records.platform_charge_tax_records_why_shape`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_cad_is_itself`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_currency_check`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_evidence_captured_check`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_fx_rate_check`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_fx_shape`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_fx_source_check`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_kind_check`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_note_number_check`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_note_type_check`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_out_of_band_cents_check`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_refund_cents_check`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_status_check`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_stripe_credit_note_id_check`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_stripe_customer_id_check`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_stripe_invoice_id_check`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_stripe_reason_check`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_tax_lines_check`
- `platform_credit_note_tax_records.platform_credit_note_tax_records_void_shape`
- `platform_fee_invoices.platform_fee_invoices_tax_lines_chk`
- `platform_refunds.platform_refunds_credit_note_id_chk`
- `platform_refunds.platform_refunds_credit_note_number_chk`
- `platform_refunds.platform_refunds_done_invoice_has_note_chk`
- `platform_refunds.platform_refunds_invoice_id_chk`
- `platform_refunds.platform_refunds_note_needs_invoice_chk`
- `rep_document_templates.rep_document_templates_validity_check`
- `second_parent_stops.second_parent_stops_email_check`

### CHECK only in PROD (26)
- `bank_accounts.bank_accounts_opening_pair`
- `bank_check_added_lines.bank_check_added_lines_kind_check`
- `bank_check_added_lines.bank_check_added_lines_line_key_check`
- `bank_check_changes.bank_check_changes_line_key_check`
- `bank_check_changes.bank_check_changes_now_amount_cents_check`
- `bank_check_changes.bank_check_changes_now_direction_check`
- `bank_check_changes.bank_check_changes_now_shape`
- `bank_check_changes.bank_check_changes_was_amount_cents_check`
- `bank_check_changes.bank_check_changes_was_direction_check`
- `bank_check_events.bank_check_events_kind_check`
- `bank_check_events.bank_check_events_reason_check`
- `bank_check_events.bank_check_events_undo_has_reason`
- `bank_check_marks.bank_check_marks_amount_cents_check`
- `bank_check_marks.bank_check_marks_direction_check`
- `bank_check_marks.bank_check_marks_line_key_check`
- `bank_check_marks.bank_check_marks_payout_key_check`
- `bank_checks.bank_checks_checked_has_when`
- `bank_checks.bank_checks_outstanding_snapshot_check`
- `bank_checks.bank_checks_status_check`
- `bank_line_exclusions.bank_line_exclusions_line_key_check`
- `bank_saved_lines.bank_saved_lines_amount_cents_check`
- `bank_saved_lines.bank_saved_lines_description_check`
- `bank_saved_lines.bank_saved_lines_direction_check`
- `bank_saved_lines.bank_saved_lines_kind_check`
- `bank_saved_lines.bank_saved_lines_line_key_check`
- `bank_saved_lines.bank_saved_lines_typed_shape`

