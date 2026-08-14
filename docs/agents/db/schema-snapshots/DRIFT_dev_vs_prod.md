# Dev vs Prod — structural drift

**Generated:** 2026-08-14 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 58 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 2 | 0 | — |
| Columns | 31 | 0 | 0 |
| Indexes | 4 | 0 | 0 |
| Constraints | 13 | 0 | — |
| RLS / CHECK | 8 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (2)
- `rep_dues_payments`
- `rep_team_import_events`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (31)
- `rep_budget_lines.line_kind`
- `rep_dues_credits.payment_id`
- `rep_dues_payments.accounting_entry_id`
- `rep_dues_payments.amount`
- `rep_dues_payments.created_at`
- `rep_dues_payments.created_by`
- `rep_dues_payments.id`
- `rep_dues_payments.method`
- `rep_dues_payments.note`
- `rep_dues_payments.org_id`
- `rep_dues_payments.player_id`
- `rep_dues_payments.program_year_id`
- `rep_dues_payments.received_date`
- `rep_dues_payments.source`
- `rep_dues_payments.team_id`
- `rep_program_years.credit_application`
- `rep_team_import_events.created_at`
- `rep_team_import_events.created_by`
- `rep_team_import_events.created_by_name`
- `rep_team_import_events.dataset`
- `rep_team_import_events.id`
- `rep_team_import_events.org_id`
- `rep_team_import_events.program_year_id`
- `rep_team_import_events.rows_created`
- `rep_team_import_events.rows_failed`
- `rep_team_import_events.rows_skipped`
- `rep_team_import_events.rows_updated`
- `rep_team_import_events.shape`
- `rep_team_import_events.source`
- `rep_team_import_events.source_filename`
- `rep_team_import_events.team_id`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (4)
- `idx_rep_dues_payments_year_player`
- `idx_rep_team_import_events_season`
- `rep_dues_payments_pkey`
- `rep_team_import_events_pkey`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (13)
- `rep_dues_credits.rep_dues_credits_payment_id_fkey`
- `rep_dues_payments.rep_dues_payments_accounting_entry_id_fkey`
- `rep_dues_payments.rep_dues_payments_created_by_fkey`
- `rep_dues_payments.rep_dues_payments_org_id_fkey`
- `rep_dues_payments.rep_dues_payments_pkey`
- `rep_dues_payments.rep_dues_payments_player_id_fkey`
- `rep_dues_payments.rep_dues_payments_program_year_id_fkey`
- `rep_dues_payments.rep_dues_payments_team_id_fkey`
- `rep_team_import_events.fk_rep_team_import_events_created_by`
- `rep_team_import_events.fk_rep_team_import_events_org`
- `rep_team_import_events.fk_rep_team_import_events_team`
- `rep_team_import_events.fk_rep_team_import_events_year`
- `rep_team_import_events.rep_team_import_events_pkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (8)
- `rep_budget_lines.rep_budget_lines_line_kind_check`
- `rep_dues_payments.rep_dues_payments_amount_check`
- `rep_dues_payments.rep_dues_payments_method_check`
- `rep_dues_payments.rep_dues_payments_source_check`
- `rep_program_years.rep_program_years_credit_application_check`
- `rep_team_import_events.rep_team_import_events_dataset_check`
- `rep_team_import_events.rep_team_import_events_shape_check`
- `rep_team_import_events.rep_team_import_events_source_check`

### CHECK only in PROD (0)
_none_

