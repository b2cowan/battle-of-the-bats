# Dev vs Prod — structural drift

**Generated:** 2026-10-21 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 39 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 3 | 0 | — |
| Columns | 15 | 0 | 0 |
| Indexes | 7 | 0 | 0 |
| Constraints | 13 | 0 | — |
| RLS / CHECK | 1 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (3)
- `tournament_fee_book_settings`
- `tournament_fee_receipt_allocations`
- `tournament_fee_receipts`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (15)
- `teams.fee_book_baseline`
- `teams.fee_changed_by`
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

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (7)
- `tournament_fee_allocations_team_idx`
- `tournament_fee_book_settings_org_id_idx`
- `tournament_fee_book_settings_pkey`
- `tournament_fee_receipt_allocations_pkey`
- `tournament_fee_receipts_entry_id_key`
- `tournament_fee_receipts_event_idx`
- `tournament_fee_receipts_pkey`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (13)
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

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (1)
- `tournament_fee_receipt_allocations.tournament_fee_receipt_allocations_amount_check`

### CHECK only in PROD (0)
_none_

