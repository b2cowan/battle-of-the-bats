-- ---------------------------------------------------------------
-- Migration 370 — Club Tier Stage 9b-2 Part 6: a family asks to withdraw a child (the status page's "Ask to withdraw").
-- Plan: docs/projects/active/HOUSE_LEAGUE_STAGE9_PLAN.md §3 (F11–F15), 9b-2 scope; words HOUSE_LEAGUE_STAGE9B2_COPY.md §14.
--
-- WHY: a family could only ask by email. Now the status page carries the ask; staff see it in Needs attention, and it
-- clears itself when the registration ends. Asking changes nothing on its own: the child keeps their place until staff act.
--
-- WHAT CHANGES:
--   1. league_registrations.withdraw_requested_at / withdraw_request_note — the family's ask (one per registration; a
--      second ask is refused while the first is open). Cleared when the registration is revived (the accepted-at trigger).
--   2. A new Needs attention kind, 'house_league_withdraw_request': notifications.event_type has no CHECK, but the two
--      partial indexes list every kind (mig 338 / 358 precedent) — rebuilt here with it added.
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.league_registrations
  ADD COLUMN IF NOT EXISTS withdraw_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS withdraw_request_note text;

ALTER TABLE public.league_registrations DROP CONSTRAINT IF EXISTS league_registrations_withdraw_note_check;
ALTER TABLE public.league_registrations ADD CONSTRAINT league_registrations_withdraw_note_check CHECK (
  withdraw_request_note IS NULL OR char_length(withdraw_request_note) <= 300
);

-- A revived registration is live again: an old ask to withdraw no longer stands (mig 369's trigger, extended).
CREATE OR REPLACE FUNCTION public.league_registrations_accepted_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    NEW.accepted_at := now();
  ELSIF NEW.status IN ('pending_review','waitlisted') THEN
    NEW.accepted_at := NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('declined','withdrawn') AND NEW.status NOT IN ('declined','withdrawn') THEN
    NEW.ended_at := NULL; NEW.spot_released := false; NEW.end_money := NULL; NEW.end_money_reason := NULL;
    NEW.withdraw_requested_at := NULL; NEW.withdraw_request_note := NULL;
  END IF;
  RETURN NEW;
END $$;

drop index if exists public.notifications_user_needs_attention_idx;
create index notifications_user_needs_attention_idx
  on public.notifications (user_id, event_type)
  where cleared_at is null
    and event_type in ('assistant_coach_approval_requested', 'card_refund_failed', 'club_hand_back_asked', 'club_hand_back_unasked',
                         'club_payment_handed_off', 'club_schedule_review', 'house_league_withdraw_request', 'online_payment_not_recorded',
                         'payment_failed', 'payouts_need_attention', 'team_coach_payment_reminder', 'team_money_sent',
                         'team_move_requested', 'team_no_show', 'team_request_filed', 'team_request_holding_payout');

drop index if exists public.notifications_org_needs_attention_idx;
create index notifications_org_needs_attention_idx
  on public.notifications (org_id, event_type)
  where cleared_at is null
    and event_type in ('assistant_coach_approval_requested', 'card_refund_failed', 'club_hand_back_asked', 'club_hand_back_unasked',
                         'club_payment_handed_off', 'club_schedule_review', 'house_league_withdraw_request', 'online_payment_not_recorded',
                         'payment_failed', 'payouts_need_attention', 'team_coach_payment_reminder', 'team_money_sent',
                         'team_move_requested', 'team_no_show', 'team_request_filed', 'team_request_holding_payout');

COMMIT;
