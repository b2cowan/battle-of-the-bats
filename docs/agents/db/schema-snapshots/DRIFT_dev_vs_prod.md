# Dev vs Prod — structural drift

**Generated:** 2026-10-11 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 121 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 5 | 0 | — |
| Columns | 50 | 1 | 0 |
| Indexes | 21 | 1 | 0 |
| Constraints | 24 | 0 | — |
| RLS / CHECK | 19 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (5)
- `org_permit_facility_shares`
- `org_permits`
- `org_time_block_facilities`
- `org_time_blocks`
- `org_time_dates_off`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (50)
- `org_permit_facility_shares.facility_id`
- `org_permit_facility_shares.org_id`
- `org_permit_facility_shares.permit_id`
- `org_permit_facility_shares.share`
- `org_permits.budget_line_id`
- `org_permits.cost`
- `org_permits.created_at`
- `org_permits.created_by`
- `org_permits.document_added_at`
- `org_permits.document_name`
- `org_permits.document_path`
- `org_permits.document_size`
- `org_permits.document_type`
- `org_permits.ends_on`
- `org_permits.held_for`
- `org_permits.held_for_team_id`
- `org_permits.id`
- `org_permits.issuer_name`
- `org_permits.issuer_payee_id`
- `org_permits.name`
- `org_permits.notes`
- `org_permits.org_id`
- `org_permits.reference`
- `org_permits.renewed_from_id`
- `org_permits.starts_on`
- `org_permits.updated_at`
- `org_permits.updated_by`
- `org_time_block_facilities.block_id`
- `org_time_block_facilities.facility_id`
- `org_time_block_facilities.org_id`
- `org_time_blocks.created_at`
- `org_time_blocks.end_time`
- `org_time_blocks.from_date`
- `org_time_blocks.id`
- `org_time_blocks.org_id`
- `org_time_blocks.org_venue_id`
- `org_time_blocks.permit_id`
- `org_time_blocks.sort_order`
- `org_time_blocks.start_time`
- `org_time_blocks.until_date`
- `org_time_blocks.updated_at`
- `org_time_blocks.weekdays`
- `org_time_dates_off.day`
- `org_time_dates_off.id`
- `org_time_dates_off.note`
- `org_time_dates_off.org_id`
- `org_time_dates_off.permit_id`
- `org_venues.bookings_email`
- `rep_team_staff_memberships.calendar_last_read_on`
- `rep_team_staff_memberships.calendar_link_generation`

### Only in PROD (1)
- `rep_teams.family_calendar_token_hash`

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (21)
- `org_permit_facility_shares_facility_idx`
- `org_permit_facility_shares_org_idx`
- `org_permit_facility_shares_pkey`
- `org_permits_budget_line_idx`
- `org_permits_created_by_idx`
- `org_permits_issuer_idx`
- `org_permits_org_dates_idx`
- `org_permits_pkey`
- `org_permits_renewed_from_idx`
- `org_permits_team_idx`
- `org_permits_updated_by_idx`
- `org_time_block_facilities_facility_idx`
- `org_time_block_facilities_org_idx`
- `org_time_block_facilities_pkey`
- `org_time_blocks_permit_idx`
- `org_time_blocks_pkey`
- `org_time_blocks_venue_fk_idx`
- `org_time_blocks_venue_idx`
- `org_time_dates_off_once`
- `org_time_dates_off_org_idx`
- `org_time_dates_off_pkey`

### Only in PROD (1)
- `rep_teams_family_calendar_token_uniq`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (24)
- `org_permit_facility_shares.org_permit_facility_shares_facility_id_fkey`
- `org_permit_facility_shares.org_permit_facility_shares_org_id_fkey`
- `org_permit_facility_shares.org_permit_facility_shares_permit_id_fkey`
- `org_permit_facility_shares.org_permit_facility_shares_pkey`
- `org_permits.org_permits_budget_line_id_fkey`
- `org_permits.org_permits_created_by_fkey`
- `org_permits.org_permits_held_for_team_id_fkey`
- `org_permits.org_permits_issuer_payee_id_fkey`
- `org_permits.org_permits_org_id_fkey`
- `org_permits.org_permits_pkey`
- `org_permits.org_permits_renewed_from_id_fkey`
- `org_permits.org_permits_updated_by_fkey`
- `org_time_block_facilities.org_time_block_facilities_block_id_fkey`
- `org_time_block_facilities.org_time_block_facilities_facility_id_fkey`
- `org_time_block_facilities.org_time_block_facilities_org_id_fkey`
- `org_time_block_facilities.org_time_block_facilities_pkey`
- `org_time_blocks.org_time_blocks_org_id_fkey`
- `org_time_blocks.org_time_blocks_org_venue_id_fkey`
- `org_time_blocks.org_time_blocks_permit_id_fkey`
- `org_time_blocks.org_time_blocks_pkey`
- `org_time_dates_off.org_time_dates_off_once`
- `org_time_dates_off.org_time_dates_off_org_id_fkey`
- `org_time_dates_off.org_time_dates_off_permit_id_fkey`
- `org_time_dates_off.org_time_dates_off_pkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (19)
- `org_permit_facility_shares.org_permit_facility_shares_share_check`
- `org_permits.org_permits_cost_check`
- `org_permits.org_permits_dates`
- `org_permits.org_permits_document_name_check`
- `org_permits.org_permits_document_size_check`
- `org_permits.org_permits_document_type_check`
- `org_permits.org_permits_document_whole`
- `org_permits.org_permits_held_for_check`
- `org_permits.org_permits_issuer_name_check`
- `org_permits.org_permits_name_check`
- `org_permits.org_permits_notes_check`
- `org_permits.org_permits_reference_check`
- `org_permits.org_permits_team_only_for_a_team`
- `org_time_blocks.org_time_blocks_dates`
- `org_time_blocks.org_time_blocks_hours`
- `org_time_blocks.org_time_blocks_weekdays`
- `org_time_dates_off.org_time_dates_off_note_check`
- `org_venues.org_venues_bookings_email_shape`
- `rep_team_staff_memberships.rep_team_staff_memberships_calendar_generation_nonneg`

### CHECK only in PROD (0)
_none_

