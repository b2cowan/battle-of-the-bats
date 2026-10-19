# Dev vs Prod — structural drift

**Generated:** 2026-10-19 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 58 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 2 | 0 | — |
| Columns | 25 | 0 | 0 |
| Indexes | 10 | 0 | 2 |
| Constraints | 13 | 0 | — |
| RLS / CHECK | 6 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (2)
- `family_notes`
- `family_payment_handoffs`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (25)
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

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (10)
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
### Only in DEV (13)
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

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (6)
- `family_notes.family_notes_body_check`
- `family_payment_handoffs.family_payment_handoffs_amount_check`
- `family_payment_handoffs.family_payment_handoffs_method_check`
- `family_payment_handoffs.family_payment_handoffs_note_check`
- `family_payment_handoffs.family_payment_handoffs_resolved_chk`
- `family_payment_handoffs.family_payment_handoffs_state_check`

### CHECK only in PROD (0)
_none_

