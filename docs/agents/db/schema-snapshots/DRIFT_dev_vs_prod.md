# Dev vs Prod — structural drift

**Generated:** 2026-10-12 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 296 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 10 | 0 | — |
| Columns | 127 | 1 | 0 |
| Indexes | 58 | 1 | 0 |
| Constraints | 60 | 0 | — |
| RLS / CHECK | 38 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (10)
- `club_schedule_replies`
- `club_schedule_sends`
- `club_schedule_slot_teams`
- `club_schedule_slots`
- `club_schedules`
- `org_permit_facility_shares`
- `org_permits`
- `org_time_block_facilities`
- `org_time_blocks`
- `org_time_dates_off`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (127)
- `club_schedule_replies.answer`
- `club_schedule_replies.id`
- `club_schedule_replies.org_id`
- `club_schedule_replies.replied_at`
- `club_schedule_replies.replied_by`
- `club_schedule_replies.schedule_id`
- `club_schedule_replies.send_id`
- `club_schedule_replies.team_id`
- `club_schedule_replies.words`
- `club_schedule_sends.allocation_id`
- `club_schedule_sends.billed`
- `club_schedule_sends.bookings_email`
- `club_schedule_sends.changes`
- `club_schedule_sends.failed_count`
- `club_schedule_sends.id`
- `club_schedule_sends.kind`
- `club_schedule_sends.landed_at`
- `club_schedule_sends.org_id`
- `club_schedule_sends.owed_back`
- `club_schedule_sends.people_count`
- `club_schedule_sends.reply_by`
- `club_schedule_sends.schedule_id`
- `club_schedule_sends.sent_at`
- `club_schedule_sends.sent_by`
- `club_schedule_sends.team_ids`
- `club_schedule_sends.team_values`
- `club_schedule_slot_teams.org_id`
- `club_schedule_slot_teams.slot_id`
- `club_schedule_slot_teams.team_id`
- `club_schedule_slots.block_id`
- `club_schedule_slots.created_at`
- `club_schedule_slots.ends_at`
- `club_schedule_slots.facility_id`
- `club_schedule_slots.handed_back_at`
- `club_schedule_slots.handed_back_by`
- `club_schedule_slots.handed_back_team_id`
- `club_schedule_slots.id`
- `club_schedule_slots.locked`
- `club_schedule_slots.moved_by_hand`
- `club_schedule_slots.org_id`
- `club_schedule_slots.org_venue_id`
- `club_schedule_slots.removed_at`
- `club_schedule_slots.schedule_id`
- `club_schedule_slots.starts_at`
- `club_schedule_slots.updated_at`
- `club_schedules.allocation_id`
- `club_schedules.bill_amount`
- `club_schedules.bill_dates`
- `club_schedules.bill_first_due`
- `club_schedules.bill_line_id`
- `club_schedules.bill_permit_id`
- `club_schedules.bill_plan`
- `club_schedules.bill_scale`
- `club_schedules.changed_since_sent`
- `club_schedules.created_at`
- `club_schedules.created_by`
- `club_schedules.ends_on`
- `club_schedules.finalized_at`
- `club_schedules.finalized_by`
- `club_schedules.id`
- `club_schedules.name`
- `club_schedules.org_id`
- `club_schedules.reply_by`
- `club_schedules.sent_at`
- `club_schedules.sent_by`
- `club_schedules.settings`
- `club_schedules.started_from_permit_id`
- `club_schedules.started_from_schedule_id`
- `club_schedules.starts_on`
- `club_schedules.state`
- `club_schedules.updated_at`
- `club_schedules.updated_by`
- `club_schedules.version`
- `divisions.playoffs_announced_at`
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
- `org_time_blocks.schedule_id`
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
- `org_time_dates_off.schedule_id`
- `org_venues.bookings_email`
- `rep_team_events.club_schedule_slot_id`
- `rep_team_staff_memberships.calendar_last_read_on`
- `rep_team_staff_memberships.calendar_link_generation`

### Only in PROD (1)
- `rep_teams.family_calendar_token_hash`

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (58)
- `club_schedule_replies_by_idx`
- `club_schedule_replies_org_idx`
- `club_schedule_replies_pkey`
- `club_schedule_replies_schedule_idx`
- `club_schedule_replies_send_idx`
- `club_schedule_replies_team_idx`
- `club_schedule_sends_allocation_idx`
- `club_schedule_sends_org_idx`
- `club_schedule_sends_pkey`
- `club_schedule_sends_schedule_idx`
- `club_schedule_sends_sent_by_idx`
- `club_schedule_slot_teams_org_idx`
- `club_schedule_slot_teams_pkey`
- `club_schedule_slot_teams_team_idx`
- `club_schedule_slots_block_idx`
- `club_schedule_slots_facility_idx`
- `club_schedule_slots_handed_back_by_idx`
- `club_schedule_slots_handed_back_team_idx`
- `club_schedule_slots_org_idx`
- `club_schedule_slots_pkey`
- `club_schedule_slots_place_start`
- `club_schedule_slots_venue_idx`
- `club_schedules_allocation_idx`
- `club_schedules_bill_line_idx`
- `club_schedules_bill_permit_idx`
- `club_schedules_created_by_idx`
- `club_schedules_finalized_by_idx`
- `club_schedules_from_schedule_idx`
- `club_schedules_org_idx`
- `club_schedules_permit_idx`
- `club_schedules_pkey`
- `club_schedules_sent_by_idx`
- `club_schedules_updated_by_idx`
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
- `org_time_blocks_schedule_idx`
- `org_time_blocks_venue_fk_idx`
- `org_time_blocks_venue_idx`
- `org_time_dates_off_once`
- `org_time_dates_off_org_idx`
- `org_time_dates_off_pkey`
- `org_time_dates_off_schedule_once`
- `rep_team_events_club_slot_idx`
- `rep_team_events_club_slot_uq`

### Only in PROD (1)
- `rep_teams_family_calendar_token_uniq`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (60)
- `club_schedule_replies.club_schedule_replies_org_id_fkey`
- `club_schedule_replies.club_schedule_replies_pkey`
- `club_schedule_replies.club_schedule_replies_replied_by_fkey`
- `club_schedule_replies.club_schedule_replies_schedule_id_fkey`
- `club_schedule_replies.club_schedule_replies_send_id_fkey`
- `club_schedule_replies.club_schedule_replies_team_id_fkey`
- `club_schedule_sends.club_schedule_sends_allocation_id_fkey`
- `club_schedule_sends.club_schedule_sends_org_id_fkey`
- `club_schedule_sends.club_schedule_sends_pkey`
- `club_schedule_sends.club_schedule_sends_schedule_id_fkey`
- `club_schedule_sends.club_schedule_sends_sent_by_fkey`
- `club_schedule_slot_teams.club_schedule_slot_teams_org_id_fkey`
- `club_schedule_slot_teams.club_schedule_slot_teams_pkey`
- `club_schedule_slot_teams.club_schedule_slot_teams_slot_id_fkey`
- `club_schedule_slot_teams.club_schedule_slot_teams_team_id_fkey`
- `club_schedule_slots.club_schedule_slots_block_id_fkey`
- `club_schedule_slots.club_schedule_slots_facility_id_fkey`
- `club_schedule_slots.club_schedule_slots_handed_back_by_fkey`
- `club_schedule_slots.club_schedule_slots_handed_back_team_id_fkey`
- `club_schedule_slots.club_schedule_slots_org_id_fkey`
- `club_schedule_slots.club_schedule_slots_org_venue_id_fkey`
- `club_schedule_slots.club_schedule_slots_pkey`
- `club_schedule_slots.club_schedule_slots_schedule_id_fkey`
- `club_schedules.club_schedules_allocation_id_fkey`
- `club_schedules.club_schedules_bill_line_id_fkey`
- `club_schedules.club_schedules_bill_permit_id_fkey`
- `club_schedules.club_schedules_created_by_fkey`
- `club_schedules.club_schedules_finalized_by_fkey`
- `club_schedules.club_schedules_org_id_fkey`
- `club_schedules.club_schedules_pkey`
- `club_schedules.club_schedules_sent_by_fkey`
- `club_schedules.club_schedules_started_from_permit_id_fkey`
- `club_schedules.club_schedules_started_from_schedule_id_fkey`
- `club_schedules.club_schedules_updated_by_fkey`
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
- `org_time_blocks.org_time_blocks_schedule_id_fkey`
- `org_time_dates_off.org_time_dates_off_once`
- `org_time_dates_off.org_time_dates_off_org_id_fkey`
- `org_time_dates_off.org_time_dates_off_permit_id_fkey`
- `org_time_dates_off.org_time_dates_off_pkey`
- `org_time_dates_off.org_time_dates_off_schedule_id_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (38)
- `club_schedule_replies.club_schedule_replies_answer_check`
- `club_schedule_replies.club_schedule_replies_words`
- `club_schedule_replies.club_schedule_replies_words_check`
- `club_schedule_sends.club_schedule_sends_failed_count_check`
- `club_schedule_sends.club_schedule_sends_kind_check`
- `club_schedule_sends.club_schedule_sends_people_count_check`
- `club_schedule_slots.club_schedule_slots_window`
- `club_schedules.club_schedules_bill_amount_check`
- `club_schedules.club_schedules_bill_plan_check`
- `club_schedules.club_schedules_bill_priced`
- `club_schedules.club_schedules_bill_scale_check`
- `club_schedules.club_schedules_bill_whole`
- `club_schedules.club_schedules_dates`
- `club_schedules.club_schedules_name_check`
- `club_schedules.club_schedules_settings_check`
- `club_schedules.club_schedules_state_check`
- `club_schedules.club_schedules_version_check`
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
- `org_time_blocks.org_time_blocks_one_owner`
- `org_time_blocks.org_time_blocks_weekdays`
- `org_time_dates_off.org_time_dates_off_note_check`
- `org_time_dates_off.org_time_dates_off_one_owner`
- `org_venues.org_venues_bookings_email_shape`
- `rep_team_staff_memberships.rep_team_staff_memberships_calendar_generation_nonneg`

### CHECK only in PROD (0)
_none_

