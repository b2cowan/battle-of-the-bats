# Dev vs Prod — structural drift

**Generated:** 2026-11-06 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 203 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 1 | 6 | — |
| Columns | 27 | 59 | 0 |
| Indexes | 9 | 26 | 0 |
| Constraints | 6 | 28 | — |
| RLS / CHECK | 14 | 26 | 0 (RLS state) |

## Tables
### Only in DEV (1)
- `bank_check_waiting`

### Only in PROD (6)
- `bank_check_added_lines`
- `bank_check_changes`
- `bank_check_events`
- `bank_check_marks`
- `bank_line_exclusions`
- `bank_saved_lines`

## Columns
### Only in DEV (27)
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
- `bank_checks.deleted_at`
- `bank_checks.deleted_by`
- `bank_checks.kind`
- `bank_checks.on_its_way_cents`
- `family_links.child_id`
- `org_children.emergency_contact_name`
- `org_children.emergency_contact_phone`
- `org_children.medical_notes`
- `platform_fee_invoices.tax_lines`
- `platform_fee_invoices.total`
- `platform_refunds.stripe_credit_note_id`
- `platform_refunds.stripe_credit_note_number`
- `platform_refunds.stripe_invoice_id`
- `rep_document_templates.validity`
- `rep_roster_players.health_confirmed_at`
- `rep_roster_players.health_confirmed_by`

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
### Only in DEV (9)
- `bank_check_waiting_once`
- `bank_check_waiting_pkey`
- `bank_checks_account_idx`
- `bank_checks_deleted_by_idx`
- `bank_checks_one_live_per_date`
- `bank_checks_one_live_start`
- `family_links_child_id_idx`
- `family_links_live_child_uniq`
- `platform_refunds_credit_note_uniq`

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
### Only in DEV (6)
- `bank_check_waiting.bank_check_waiting_check_id_fkey`
- `bank_check_waiting.bank_check_waiting_once`
- `bank_check_waiting.bank_check_waiting_pkey`
- `bank_checks.bank_checks_deleted_by_fkey`
- `family_links.family_links_child_id_fkey`
- `rep_roster_players.rep_roster_players_health_confirmed_by_fkey`

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

### CHECK only in DEV (14)
- `bank_check_waiting.bank_check_waiting_amount_cents_check`
- `bank_check_waiting.bank_check_waiting_direction_check`
- `bank_check_waiting.bank_check_waiting_label_check`
- `bank_check_waiting.bank_check_waiting_line_key_check`
- `bank_checks.bank_checks_cash_shape`
- `bank_checks.bank_checks_deleted_shape`
- `bank_checks.bank_checks_kind`
- `platform_fee_invoices.platform_fee_invoices_tax_lines_chk`
- `platform_refunds.platform_refunds_credit_note_id_chk`
- `platform_refunds.platform_refunds_credit_note_number_chk`
- `platform_refunds.platform_refunds_done_invoice_has_note_chk`
- `platform_refunds.platform_refunds_invoice_id_chk`
- `platform_refunds.platform_refunds_note_needs_invoice_chk`
- `rep_document_templates.rep_document_templates_validity_check`

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

