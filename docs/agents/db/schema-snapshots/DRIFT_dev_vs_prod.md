# Dev vs Prod — structural drift

**Generated:** 2026-10-21 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 67 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 4 | 0 | — |
| Columns | 30 | 0 | 0 |
| Indexes | 9 | 0 | 0 |
| Constraints | 15 | 0 | — |
| RLS / CHECK | 9 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (4)
- `org_site_notices`
- `tournament_fee_book_settings`
- `tournament_fee_receipt_allocations`
- `tournament_fee_receipts`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (30)
- `org_public_site_content.contacts`
- `org_public_site_content.documents`
- `org_public_site_content.home_section_order`
- `org_public_site_content.home_sections_hidden`
- `org_public_site_content.questions`
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
### Only in DEV (9)
- `org_site_notices_org_idx`
- `org_site_notices_pkey`
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
### Only in DEV (15)
- `org_site_notices.org_site_notices_org_fk`
- `org_site_notices.org_site_notices_pkey`
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

### CHECK only in DEV (9)
- `org_public_site_content.org_public_site_content_contacts_cap`
- `org_public_site_content.org_public_site_content_documents_cap`
- `org_public_site_content.org_public_site_content_home_section_order_known`
- `org_public_site_content.org_public_site_content_home_sections_hidden_known`
- `org_public_site_content.org_public_site_content_questions_cap`
- `org_site_notices.org_site_notices_detail_check`
- `org_site_notices.org_site_notices_ends_after_post`
- `org_site_notices.org_site_notices_notice_check`
- `tournament_fee_receipt_allocations.tournament_fee_receipt_allocations_amount_check`

### CHECK only in PROD (0)
_none_

