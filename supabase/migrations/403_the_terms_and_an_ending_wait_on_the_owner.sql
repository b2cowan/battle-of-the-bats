-- Club Tier Stage 12d-2 Part 4 (owner rulings 2026-10-27, plan §0 "12d-2 build state"): two Needs attention kinds to a
-- club's owners, raised by the daily job and cleared by themselves (lib/needs-attention.ts):
--   payments_terms_changed — FieldLogicHQ's payments terms changed: read and agree (online payments stay on; ask 6)
--   payments_ending        — online payments stop through an ending the owner didn't choose (a comp running out, a
--                            failed subscription payment; words §4.2)
-- The two Needs-attention indexes name every kind that waits on someone (as mig 390 made them, plus these two), and the
-- one-open-copy index keys each on its subject: the terms on their version, an ending on the ending it is about — so a
-- daily job that runs twice before its stamp raises one item, never two.
-- Indexes only; no row changes; re-runnable.

BEGIN;

drop index if exists public.notifications_user_needs_attention_idx;
create index notifications_user_needs_attention_idx
  on public.notifications (user_id, event_type)
  where cleared_at is null
    and event_type in ('assistant_coach_approval_requested', 'card_dispute_lost', 'card_disputed', 'card_refund_failed',
                         'card_refund_still_enrolled', 'card_refund_unmatched',
                         'card_refund_whose', 'club_hand_back_asked', 'club_hand_back_unasked',
                         'club_payment_handed_off', 'club_schedule_review', 'debit_returned', 'debit_reversed',
                         'house_league_withdraw_request', 'online_payment_not_recorded', 'online_payment_over',
                         'payment_failed', 'payments_ending', 'payments_terms_changed', 'payouts_need_attention',
                         'team_coach_payment_reminder', 'team_money_sent',
                         'team_move_requested', 'team_no_show', 'team_request_filed', 'team_request_holding_payout');

drop index if exists public.notifications_org_needs_attention_idx;
create index notifications_org_needs_attention_idx
  on public.notifications (org_id, event_type)
  where cleared_at is null
    and event_type in ('assistant_coach_approval_requested', 'card_dispute_lost', 'card_disputed', 'card_refund_failed',
                         'card_refund_still_enrolled', 'card_refund_unmatched',
                         'card_refund_whose', 'club_hand_back_asked', 'club_hand_back_unasked',
                         'club_payment_handed_off', 'club_schedule_review', 'debit_returned', 'debit_reversed',
                         'house_league_withdraw_request', 'online_payment_not_recorded', 'online_payment_over',
                         'payment_failed', 'payments_ending', 'payments_terms_changed', 'payouts_need_attention',
                         'team_coach_payment_reminder', 'team_money_sent',
                         'team_move_requested', 'team_no_show', 'team_request_filed', 'team_request_holding_payout');

-- One open copy per person and subject (mig 390's, plus the terms' version and the ending's instant).
DROP INDEX IF EXISTS public.notifications_one_open_online_payments_notice;
CREATE UNIQUE INDEX notifications_one_open_online_payments_notice
  ON public.notifications (org_id, user_id, event_type,
    (COALESCE(metadata->>'onlineDisputeId', metadata->>'stripeAccountId', metadata->>'onlinePaymentItemId',
              metadata->>'onlinePaymentId', metadata->>'unassignedRefundId', metadata->>'enrolledRefundId',
              metadata->>'unmatchedStripeRefundId', metadata->>'termsVersion', metadata->>'endingFor')))
  WHERE cleared_at IS NULL
    AND event_type IN ('payouts_need_attention', 'online_payment_not_recorded', 'card_refund_failed',
                       'card_refund_whose', 'card_refund_still_enrolled', 'card_refund_unmatched',
                       'debit_returned', 'debit_reversed', 'card_disputed', 'card_dispute_lost', 'online_payment_over',
                       'payments_terms_changed', 'payments_ending');

COMMIT;
