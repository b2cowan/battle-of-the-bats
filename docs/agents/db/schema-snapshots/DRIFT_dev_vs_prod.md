# Dev vs Prod — structural drift

**Generated:** 2026-10-20 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 94 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 3 | 0 | — |
| Columns | 45 | 0 | 0 |
| Indexes | 15 | 0 | 2 |
| Constraints | 19 | 0 | — |
| RLS / CHECK | 10 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (3)
- `family_notes`
- `family_payment_handoffs`
- `rep_sponsor_invoices`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (45)
- `family_notes.body`
- `family_notes.created_at`
- `family_notes.created_by`
- `family_notes.edited_at`
- `family_notes.id`
- `family_notes.org_id`
- `family_notes.person_id`
- `family_payment_handoffs.amount`
- `family_payment_handoffs.id`
- `family_payment_handoffs.method`
- `family_payment_handoffs.note`
- `family_payment_handoffs.org_id`
- `family_payment_handoffs.payment_id`
- `family_payment_handoffs.person_id`
- `family_payment_handoffs.player_name`
- `family_payment_handoffs.program_year_id`
- `family_payment_handoffs.received_date`
- `family_payment_handoffs.resolved_at`
- `family_payment_handoffs.resolved_by`
- `family_payment_handoffs.roster_player_id`
- `family_payment_handoffs.sent_at`
- `family_payment_handoffs.sent_by`
- `family_payment_handoffs.sent_to`
- `family_payment_handoffs.state`
- `family_payment_handoffs.team_id`
- `rep_sponsor_invoices.amount`
- `rep_sponsor_invoices.bill_to_address`
- `rep_sponsor_invoices.bill_to_attention`
- `rep_sponsor_invoices.bill_to_email`
- `rep_sponsor_invoices.bill_to_name`
- `rep_sponsor_invoices.created_at`
- `rep_sponsor_invoices.created_by`
- `rep_sponsor_invoices.description`
- `rep_sponsor_invoices.due_on`
- `rep_sponsor_invoices.fundraiser_id`
- `rep_sponsor_invoices.id`
- `rep_sponsor_invoices.issued_on`
- `rep_sponsor_invoices.org_id`
- `rep_sponsor_invoices.program_year_id`
- `rep_sponsor_invoices.revised_on`
- `rep_sponsor_invoices.season_year`
- `rep_sponsor_invoices.seq`
- `rep_sponsor_invoices.team_id`
- `rep_sponsor_invoices.updated_at`
- `rep_teams.sponsor_payment_details`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (15)
- `family_notes_org_idx`
- `family_notes_person_idx`
- `family_notes_pkey`
- `family_payment_handoffs_org_idx`
- `family_payment_handoffs_payment_uniq`
- `family_payment_handoffs_person_idx`
- `family_payment_handoffs_pkey`
- `family_payment_handoffs_player_sent_idx`
- `family_payment_handoffs_team_idx`
- `family_payment_handoffs_year_idx`
- `rep_sponsor_invoices_fundraiser_uniq`
- `rep_sponsor_invoices_number_uniq`
- `rep_sponsor_invoices_org_idx`
- `rep_sponsor_invoices_pkey`
- `rep_sponsor_invoices_year_idx`

### Only in PROD (0)
_none_

### Definition changed (2)
- `notifications_org_needs_attention_idx`
  - dev: `CREATE INDEX notifications_org_needs_attention_idx ON public.notifications USING btree (org_id, event_type) WHERE ((cleared_at IS NULL) AND (event_type = ANY (ARRAY['assistant_coach_approval_requested'::text, 'club_hand_back_asked'::text, 'club_hand_back_unasked'::text, 'club_payment_handed_off'::text, 'club_schedule_review'::text, 'payment_failed'::text, 'team_coach_payment_reminder'::text, 'team_money_sent'::text, 'team_move_requested'::text, 'team_no_show'::text, 'team_request_filed'::text, 'team_request_holding_payout'::text])))`
  - prod: `CREATE INDEX notifications_org_needs_attention_idx ON public.notifications USING btree (org_id, event_type) WHERE ((cleared_at IS NULL) AND (event_type = ANY (ARRAY['assistant_coach_approval_requested'::text, 'club_hand_back_asked'::text, 'club_hand_back_unasked'::text, 'club_schedule_review'::text, 'payment_failed'::text, 'team_coach_payment_reminder'::text, 'team_money_sent'::text, 'team_move_requested'::text, 'team_no_show'::text, 'team_request_filed'::text, 'team_request_holding_payout'::text])))`
- `notifications_user_needs_attention_idx`
  - dev: `CREATE INDEX notifications_user_needs_attention_idx ON public.notifications USING btree (user_id, event_type) WHERE ((cleared_at IS NULL) AND (event_type = ANY (ARRAY['assistant_coach_approval_requested'::text, 'club_hand_back_asked'::text, 'club_hand_back_unasked'::text, 'club_payment_handed_off'::text, 'club_schedule_review'::text, 'payment_failed'::text, 'team_coach_payment_reminder'::text, 'team_money_sent'::text, 'team_move_requested'::text, 'team_no_show'::text, 'team_request_filed'::text, 'team_request_holding_payout'::text])))`
  - prod: `CREATE INDEX notifications_user_needs_attention_idx ON public.notifications USING btree (user_id, event_type) WHERE ((cleared_at IS NULL) AND (event_type = ANY (ARRAY['assistant_coach_approval_requested'::text, 'club_hand_back_asked'::text, 'club_hand_back_unasked'::text, 'club_schedule_review'::text, 'payment_failed'::text, 'team_coach_payment_reminder'::text, 'team_money_sent'::text, 'team_move_requested'::text, 'team_no_show'::text, 'team_request_filed'::text, 'team_request_holding_payout'::text])))`

## Constraints (PK / UNIQUE / FK)
### Only in DEV (19)
- `family_notes.family_notes_created_by_fkey`
- `family_notes.family_notes_org_id_fkey`
- `family_notes.family_notes_person_id_fkey`
- `family_notes.family_notes_pkey`
- `family_payment_handoffs.family_payment_handoffs_org_id_fkey`
- `family_payment_handoffs.family_payment_handoffs_payment_id_fkey`
- `family_payment_handoffs.family_payment_handoffs_person_id_fkey`
- `family_payment_handoffs.family_payment_handoffs_pkey`
- `family_payment_handoffs.family_payment_handoffs_program_year_id_fkey`
- `family_payment_handoffs.family_payment_handoffs_resolved_by_fkey`
- `family_payment_handoffs.family_payment_handoffs_roster_player_id_fkey`
- `family_payment_handoffs.family_payment_handoffs_sent_by_fkey`
- `family_payment_handoffs.family_payment_handoffs_team_id_fkey`
- `rep_sponsor_invoices.rep_sponsor_invoices_created_by_fkey`
- `rep_sponsor_invoices.rep_sponsor_invoices_fundraiser_id_fkey`
- `rep_sponsor_invoices.rep_sponsor_invoices_org_id_fkey`
- `rep_sponsor_invoices.rep_sponsor_invoices_pkey`
- `rep_sponsor_invoices.rep_sponsor_invoices_program_year_id_fkey`
- `rep_sponsor_invoices.rep_sponsor_invoices_team_id_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (10)
- `family_notes.family_notes_body_check`
- `family_payment_handoffs.family_payment_handoffs_amount_check`
- `family_payment_handoffs.family_payment_handoffs_method_check`
- `family_payment_handoffs.family_payment_handoffs_note_check`
- `family_payment_handoffs.family_payment_handoffs_resolved_chk`
- `family_payment_handoffs.family_payment_handoffs_state_check`
- `rep_sponsor_invoices.rep_sponsor_invoices_amount_check`
- `rep_sponsor_invoices.rep_sponsor_invoices_bill_to_name_check`
- `rep_sponsor_invoices.rep_sponsor_invoices_description_check`
- `rep_sponsor_invoices.rep_sponsor_invoices_seq_check`

### CHECK only in PROD (0)
_none_

