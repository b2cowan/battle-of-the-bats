# Dev vs Prod — structural drift

**Generated:** 2026-10-02 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 57 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 1 | 0 | — |
| Columns | 32 | 0 | 0 |
| Indexes | 2 | 0 | 0 |
| Constraints | 8 | 0 | — |
| RLS / CHECK | 13 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (1)
- `rep_allocation_reminder_waves`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (32)
- `accounting_entries.void_reason`
- `accounting_entries.voided_at`
- `accounting_entries.voided_by`
- `org_payees.shared_at`
- `org_payees.shared_with_teams`
- `rep_allocation_installments.paid_method`
- `rep_allocation_installments.paid_on`
- `rep_allocation_installments.paid_reference`
- `rep_allocation_installments.sent_at`
- `rep_allocation_installments.sent_by`
- `rep_allocation_installments.sent_method`
- `rep_allocation_installments.sent_on`
- `rep_allocation_installments.sent_reference`
- `rep_allocation_installments.undone_at`
- `rep_allocation_installments.undone_by`
- `rep_allocation_installments.undone_reason`
- `rep_allocation_reminder_waves.amount`
- `rep_allocation_reminder_waves.id`
- `rep_allocation_reminder_waves.installment_count`
- `rep_allocation_reminder_waves.org_id`
- `rep_allocation_reminder_waves.recipient_count`
- `rep_allocation_reminder_waves.sent_at`
- `rep_allocation_reminder_waves.sent_by`
- `rep_allocation_reminder_waves.team_id`
- `rep_allocation_reminder_waves.team_ids`
- `rep_team_payment_requests.paid_method`
- `rep_team_payment_requests.paid_on`
- `rep_team_payment_requests.paid_reference`
- `rep_team_payment_requests.payout_hold_told_at`
- `rep_team_payment_requests.reversed_at`
- `rep_team_payment_requests.reversed_by`
- `rep_team_payment_requests.reversed_reason`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (2)
- `rep_allocation_reminder_waves_org_sent_idx`
- `rep_allocation_reminder_waves_pkey`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (8)
- `accounting_entries.accounting_entries_voided_by_fkey`
- `rep_allocation_installments.rep_allocation_installments_sent_by_fkey`
- `rep_allocation_installments.rep_allocation_installments_undone_by_fkey`
- `rep_allocation_reminder_waves.rep_allocation_reminder_waves_org_id_fkey`
- `rep_allocation_reminder_waves.rep_allocation_reminder_waves_pkey`
- `rep_allocation_reminder_waves.rep_allocation_reminder_waves_sent_by_fkey`
- `rep_allocation_reminder_waves.rep_allocation_reminder_waves_team_id_fkey`
- `rep_team_payment_requests.rep_team_payment_requests_reversed_by_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (13)
- `accounting_entries.accounting_entries_void_reason_length_check`
- `org_payees.org_payees_sharing_check`
- `rep_allocation_installments.rep_allocation_installments_paid_method_check`
- `rep_allocation_installments.rep_allocation_installments_sent_is_whole_check`
- `rep_allocation_installments.rep_allocation_installments_sent_method_check`
- `rep_allocation_installments.rep_allocation_installments_undo_has_reason_check`
- `rep_allocation_installments.rep_allocation_installments_words_length_check`
- `rep_allocation_reminder_waves.rep_allocation_reminder_waves_amount_check`
- `rep_allocation_reminder_waves.rep_allocation_reminder_waves_installment_count_check`
- `rep_allocation_reminder_waves.rep_allocation_reminder_waves_recipient_count_check`
- `rep_team_payment_requests.rep_team_payment_requests_paid_method_check`
- `rep_team_payment_requests.rep_team_payment_requests_reversal_is_whole_check`
- `rep_team_payment_requests.rep_team_payment_requests_words_length_check`

### CHECK only in PROD (0)
_none_

