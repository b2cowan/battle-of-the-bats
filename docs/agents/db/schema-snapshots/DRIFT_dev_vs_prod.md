# Dev vs Prod — structural drift

**Generated:** 2026-10-22 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 143 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 6 | 0 | — |
| Columns | 68 | 0 | 0 |
| Indexes | 16 | 0 | 0 |
| Constraints | 25 | 0 | — |
| RLS / CHECK | 28 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (6)
- `family_email_sends`
- `org_site_notices`
- `tournament_fee_book_settings`
- `tournament_fee_receipt_allocations`
- `tournament_fee_receipts`
- `tournament_team_payments`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (68)
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
- `organizations.birthday_cutoffs`
- `rep_program_years.born_from_year`
- `rep_program_years.born_to_year`
- `rep_program_years.born_years_carried`
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
- `tournament_team_payments.amount`
- `tournament_team_payments.created_at`
- `tournament_team_payments.created_by`
- `tournament_team_payments.entry_id`
- `tournament_team_payments.id`
- `tournament_team_payments.label`
- `tournament_team_payments.method`
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
### Only in DEV (16)
- `family_email_sends_org_sent_idx`
- `family_email_sends_pkey`
- `org_site_notices_org_idx`
- `org_site_notices_pkey`
- `tournament_fee_allocations_team_idx`
- `tournament_fee_book_settings_org_id_idx`
- `tournament_fee_book_settings_pkey`
- `tournament_fee_receipt_allocations_pkey`
- `tournament_fee_receipts_entry_id_key`
- `tournament_fee_receipts_event_idx`
- `tournament_fee_receipts_pkey`
- `tournament_team_payments_entry_idx`
- `tournament_team_payments_org_idx`
- `tournament_team_payments_pkey`
- `tournament_team_payments_team_idx`
- `tournament_team_payments_tournament_idx`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (25)
- `family_email_sends.family_email_sends_org_id_fkey`
- `family_email_sends.family_email_sends_pkey`
- `family_email_sends.family_email_sends_sent_by_fkey`
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
- `tournament_team_payments.tournament_team_payments_created_by_fk`
- `tournament_team_payments.tournament_team_payments_entry_fk`
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

### CHECK only in DEV (28)
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
- `org_public_site_content.org_public_site_content_contacts_cap`
- `org_public_site_content.org_public_site_content_documents_cap`
- `org_public_site_content.org_public_site_content_home_section_order_known`
- `org_public_site_content.org_public_site_content_home_sections_hidden_known`
- `org_public_site_content.org_public_site_content_questions_cap`
- `org_site_notices.org_site_notices_detail_check`
- `org_site_notices.org_site_notices_ends_after_post`
- `org_site_notices.org_site_notices_notice_check`
- `organizations.organizations_birthday_cutoffs_shape`
- `rep_program_years.rep_program_years_born_years_check`
- `rep_program_years.rep_program_years_tryout_description_length`
- `tournament_fee_receipt_allocations.tournament_fee_receipt_allocations_amount_check`
- `tournament_team_payments.tournament_team_payments_amount_chk`
- `tournament_team_payments.tournament_team_payments_date_chk`
- `tournament_team_payments.tournament_team_payments_label_chk`
- `tournament_team_payments.tournament_team_payments_method_chk`
- `tournament_team_payments.tournament_team_payments_status_chk`

### CHECK only in PROD (0)
_none_

