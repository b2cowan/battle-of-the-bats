# Dev vs Prod — structural drift

**Generated:** 2026-11-26 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 215 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 6 | 0 | — |
| Columns | 109 | 0 | 0 |
| Indexes | 28 | 1 | 1 |
| Constraints | 33 | 0 | — |
| RLS / CHECK | 35 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (6)
- `club_sponsor_deal_refunds`
- `org_place_closures`
- `organization_previews`
- `preview_claim_records`
- `preview_claim_tries`
- `rep_event_closure_marks`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (109)
- `club_schedule_slots.section_mask`
- `club_sponsor_deal_payments.card_brand`
- `club_sponsor_deal_payments.card_last4`
- `club_sponsor_deal_payments.dispute_lost_at`
- `club_sponsor_deal_payments.fee_amount`
- `club_sponsor_deal_payments.fee_charged`
- `club_sponsor_deal_payments.fee_cost_entry_id`
- `club_sponsor_deal_payments.fee_income_entry_id`
- `club_sponsor_deal_payments.fee_paid_by`
- `club_sponsor_deal_payments.fee_tax`
- `club_sponsor_deal_payments.online_payment_id`
- `club_sponsor_deal_payments.returned_at`
- `club_sponsor_deal_refunds.amount`
- `club_sponsor_deal_refunds.cancel_emailed_at`
- `club_sponsor_deal_refunds.created_at`
- `club_sponsor_deal_refunds.created_by`
- `club_sponsor_deal_refunds.created_by_name`
- `club_sponsor_deal_refunds.credit_seq`
- `club_sponsor_deal_refunds.deal_id`
- `club_sponsor_deal_refunds.emailed_at`
- `club_sponsor_deal_refunds.ends_deal`
- `club_sponsor_deal_refunds.failed_at`
- `club_sponsor_deal_refunds.failure_reason`
- `club_sponsor_deal_refunds.id`
- `club_sponsor_deal_refunds.income_entry_id`
- `club_sponsor_deal_refunds.online_payment_id`
- `club_sponsor_deal_refunds.org_id`
- `club_sponsor_deal_refunds.payment_id`
- `club_sponsor_deal_refunds.reason`
- `club_sponsor_deal_refunds.refunded_on`
- `club_sponsor_deal_refunds.status`
- `club_sponsor_deal_refunds.stripe_refund_id`
- `club_sponsor_deal_refunds.succeeded_at`
- `club_sponsor_deal_refunds.tax_entry_id`
- `club_sponsor_deal_refunds.tax_part`
- `club_sponsor_deal_refunds.whole`
- `club_sponsor_deals.card_fee`
- `club_sponsor_deals.card_fee_tax`
- `league_games.section_mask`
- `league_practices.section_mask`
- `league_rainouts.closure_id`
- `league_rainouts.org_venue_id`
- `online_payments.sponsor_deal_id`
- `online_payments.sponsor_fee_tax`
- `online_payments.sponsor_invoice`
- `org_place_closures.closed_by`
- `org_place_closures.created_at`
- `org_place_closures.ends_at`
- `org_place_closures.facility_name`
- `org_place_closures.first_day`
- `org_place_closures.id`
- `org_place_closures.last_day`
- `org_place_closures.line`
- `org_place_closures.org_id`
- `org_place_closures.org_venue_facility_id`
- `org_place_closures.org_venue_id`
- `org_place_closures.place_name`
- `org_place_closures.press_key`
- `org_place_closures.press_seq`
- `org_place_closures.reopened_at`
- `org_place_closures.reopened_by`
- `org_place_closures.scope`
- `org_place_closures.shows_from`
- `org_place_closures.verb`
- `org_time_block_facilities.section_mask`
- `org_venue_facilities.sections`
- `organization_previews.claim_code`
- `organization_previews.claimed_at`
- `organization_previews.claimed_by`
- `organization_previews.created_at`
- `organization_previews.logo_source_url`
- `organization_previews.made_by`
- `organization_previews.meeting_at`
- `organization_previews.org_id`
- `organization_previews.org_name`
- `organization_previews.org_slug`
- `organization_previews.province_code`
- `organization_previews.removed_at`
- `organization_previews.sport`
- `organization_previews.updated_at`
- `organizations.is_preview`
- `preview_claim_records.at`
- `preview_claim_records.box_text`
- `preview_claim_records.claim_code`
- `preview_claim_records.id`
- `preview_claim_records.kind`
- `preview_claim_records.org_id`
- `preview_claim_records.org_name`
- `preview_claim_records.start_plan`
- `preview_claim_records.user_email`
- `preview_claim_records.user_id`
- `preview_claim_tries.id`
- `preview_claim_tries.org_id`
- `preview_claim_tries.tried_at`
- `preview_claim_tries.visitor_key`
- `rep_event_closure_marks.closure_id`
- `rep_event_closure_marks.coach_emailed_at`
- `rep_event_closure_marks.created_at`
- `rep_event_closure_marks.event_id`
- `rep_event_closure_marks.id`
- `rep_event_closure_marks.marked_facility_id`
- `rep_event_closure_marks.marked_location`
- `rep_event_closure_marks.marked_org_venue_id`
- `rep_event_closure_marks.marked_place_id`
- `rep_event_closure_marks.marked_starts_at`
- `rep_event_closure_marks.org_id`
- `rep_event_closure_marks.reopen_told_at`
- `rep_event_closure_marks.team_id`
- `rep_team_events.section_mask`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (28)
- `club_schedule_slots_family_place_overlap`
- `club_sponsor_deal_payments_online_uniq`
- `club_sponsor_deal_refunds_credit_uniq`
- `club_sponsor_deal_refunds_deal_idx`
- `club_sponsor_deal_refunds_payment_idx`
- `club_sponsor_deal_refunds_pkey`
- `club_sponsor_deal_refunds_stripe_uniq`
- `league_rainouts_closure_day_uq`
- `league_rainouts_closure_games_idx`
- `league_rainouts_venue_idx`
- `online_payments_one_open_per_deal`
- `org_place_closures_org_id_idx`
- `org_place_closures_pkey`
- `org_place_closures_press_once`
- `org_place_closures_showing_idx`
- `org_place_closures_venue_idx`
- `organization_previews_org_slug_idx`
- `organization_previews_pkey`
- `preview_claim_records_org_idx`
- `preview_claim_records_pkey`
- `preview_claim_tries_org_idx`
- `preview_claim_tries_pkey`
- `preview_claim_tries_visitor_idx`
- `rep_event_closure_marks_event_idx`
- `rep_event_closure_marks_once`
- `rep_event_closure_marks_org_id_idx`
- `rep_event_closure_marks_pkey`
- `rep_event_closure_marks_team_idx`

### Only in PROD (1)
- `club_schedule_slots_family_place_start`

### Definition changed (1)
- `org_time_block_facilities_pkey`
  - dev: `CREATE UNIQUE INDEX org_time_block_facilities_pkey ON public.org_time_block_facilities USING btree (block_id, facility_id, section_mask)`
  - prod: `CREATE UNIQUE INDEX org_time_block_facilities_pkey ON public.org_time_block_facilities USING btree (block_id, facility_id)`

## Constraints (PK / UNIQUE / FK)
### Only in DEV (33)
- `club_sponsor_deal_payments.club_sponsor_deal_payments_fee_cost_entry_id_fkey`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_fee_income_entry_id_fkey`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_online_payment_id_fkey`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_created_by_fkey`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_deal_id_fkey`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_income_entry_id_fkey`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_online_payment_id_fkey`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_org_id_fkey`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_payment_id_fkey`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_pkey`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_tax_entry_id_fkey`
- `league_rainouts.league_rainouts_closure_id_fkey`
- `league_rainouts.league_rainouts_org_venue_id_fkey`
- `online_payments.online_payments_sponsor_deal_id_fkey`
- `org_place_closures.org_place_closures_closed_by_fkey`
- `org_place_closures.org_place_closures_org_id_fkey`
- `org_place_closures.org_place_closures_org_venue_facility_id_fkey`
- `org_place_closures.org_place_closures_org_venue_id_fkey`
- `org_place_closures.org_place_closures_pkey`
- `org_place_closures.org_place_closures_press_once`
- `org_place_closures.org_place_closures_reopened_by_fkey`
- `organization_previews.organization_previews_claimed_by_fkey`
- `organization_previews.organization_previews_made_by_fkey`
- `organization_previews.organization_previews_pkey`
- `preview_claim_records.preview_claim_records_pkey`
- `preview_claim_records.preview_claim_records_user_id_fkey`
- `preview_claim_tries.preview_claim_tries_pkey`
- `rep_event_closure_marks.rep_event_closure_marks_closure_id_fkey`
- `rep_event_closure_marks.rep_event_closure_marks_event_id_fkey`
- `rep_event_closure_marks.rep_event_closure_marks_once`
- `rep_event_closure_marks.rep_event_closure_marks_org_id_fkey`
- `rep_event_closure_marks.rep_event_closure_marks_pkey`
- `rep_event_closure_marks.rep_event_closure_marks_team_id_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (35)
- `club_schedule_slots.club_schedule_slots_section_mask_valid`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_card`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_amount_check`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_check`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_created_by_name_check`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_credit_seq_check`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_failure_reason_check`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_reason_check`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_status_check`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_succeeded`
- `club_sponsor_deals.club_sponsor_deals_card_fee`
- `league_games.league_games_section_mask_valid`
- `league_practices.league_practices_section_mask_valid`
- `org_place_closures.org_place_closures_all_has_no_name`
- `org_place_closures.org_place_closures_days`
- `org_place_closures.org_place_closures_diamond_named`
- `org_place_closures.org_place_closures_line_check`
- `org_place_closures.org_place_closures_press_seq_check`
- `org_place_closures.org_place_closures_scope_check`
- `org_place_closures.org_place_closures_shows`
- `org_place_closures.org_place_closures_verb_check`
- `org_time_block_facilities.org_time_block_facilities_section_mask_valid`
- `org_venue_facilities.org_venue_facilities_sections_valid`
- `organization_previews.organization_previews_claim_code_shape`
- `organization_previews.organization_previews_claimer_needs_claim`
- `organization_previews.organization_previews_code_only_while_open`
- `organization_previews.organization_previews_logo_source_is_web`
- `organization_previews.organization_previews_province_code_shape`
- `organization_previews.organization_previews_removed_or_claimed`
- `organizations.organizations_preview_has_no_stripe`
- `preview_claim_records.preview_claim_records_claim_shape`
- `preview_claim_records.preview_claim_records_kind_check`
- `preview_claim_records.preview_claim_records_undo_shape`
- `preview_claim_tries.preview_claim_tries_visitor_key_check`
- `rep_team_events.rep_team_events_section_mask_valid`

### CHECK only in PROD (0)
_none_

