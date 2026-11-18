# Dev vs Prod — structural drift

**Generated:** 2026-11-18 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 143 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 5 | 0 | — |
| Columns | 62 | 0 | 2 |
| Indexes | 24 | 1 | 0 |
| Constraints | 20 | 0 | — |
| RLS / CHECK | 29 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (5)
- `club_group_email_bodies`
- `club_group_email_recipients`
- `club_group_email_sends`
- `club_schedule_bill_rates`
- `org_time_date_off_venues`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (62)
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
- `org_time_date_off_venues.date_off_id`
- `org_time_date_off_venues.org_id`
- `org_time_date_off_venues.org_venue_id`

### Only in PROD (0)
_none_

### Type/nullability/default changed (2)
- `family_email_sends.body` — dev: `text|text|YES|` | prod: `text|text|NO|`
- `family_email_sends.subject` — dev: `text|text|YES|` | prod: `text|text|NO|`

## Indexes
### Only in DEV (24)
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
- `org_time_date_off_venues_org_idx`
- `org_time_date_off_venues_pkey`
- `org_time_date_off_venues_venue_idx`

### Only in PROD (1)
- `club_schedule_slots_place_start`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (20)
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
- `org_time_date_off_venues.org_time_date_off_venues_date_off_id_fkey`
- `org_time_date_off_venues.org_time_date_off_venues_org_id_fkey`
- `org_time_date_off_venues.org_time_date_off_venues_org_venue_id_fkey`
- `org_time_date_off_venues.org_time_date_off_venues_pkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (29)
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

### CHECK only in PROD (0)
_none_

