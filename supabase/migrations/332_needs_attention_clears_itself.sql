-- 332 — Needs attention clears itself (owner ruling 2026-10-16, Owner QA §322 "Found before W2"; plan
-- docs/projects/active/NEEDS_ATTENTION_CLEARS_ITSELF_PLAN.md).
--
-- WHAT CHANGES:
--   (1) Two partial indexes on notifications, both over the rows still in Needs attention — `cleared_at is null` AND one of
--       the eleven Needs-attention kinds (/review 2026-10-16: news rows are never cleared, so `cleared_at is null` alone
--       indexed nearly the whole table). ⚠ The kind list must equal NEEDS_ATTENTION_KINDS (lib/notification-labels.ts) —
--       tests/unit/needs-attention-clears-itself.test.ts holds it; a new kind needs a new migration re-creating both.
--       Built without CONCURRENTLY, inside the transaction: a brief write lock on notifications while it builds.
--       · (user_id, event_type) — the reader's pass: before every bell read and count, a reader's own uncleared
--         Needs-attention rows are checked against their records and cleared where settled
--         (`clearSettledForReader`, lib/needs-attention.ts). The table had no index that starts with user_id over
--         read rows (only `notifications_user_unread_idx`, unread only).
--       · (org_id, event_type) — on the spot: after a settle step (Accept, Decline, Approve, Confirm received …) every
--         recipient's copy of that kind in the org is checked and cleared (`clearSettled`).
--   (2) Data: the four RETIRED kinds (score_disputed, coach_access_requested, roster_change_requested,
--       tryout_offer_response — nothing has sent them for months; ruling 2026-10-16) leave Needs attention in code
--       (NOTIFICATION_CATEGORY → 'know'); any still pinned are cleared here and read where unread, so none counts in a
--       bell either.
--
-- INVISIBLE to the drift check (indexes and a data-only update): declared in MANUAL_PROD_STEPS.json. Safe to run any
-- time and twice (`if not exists`; the update only touches rows not yet cleared). Order: any time — the code works
-- without the indexes (slower) and without the update (the retired kinds simply read as news).

begin;

create index if not exists notifications_user_needs_attention_idx
  on public.notifications (user_id, event_type)
  where cleared_at is null
    and event_type in ('assistant_coach_approval_requested', 'club_hand_back_asked', 'club_hand_back_unasked', 'club_schedule_review',
                         'payment_failed', 'team_coach_payment_reminder', 'team_money_sent', 'team_move_requested', 'team_no_show',
                         'team_request_filed', 'team_request_holding_payout');

create index if not exists notifications_org_needs_attention_idx
  on public.notifications (org_id, event_type)
  where cleared_at is null
    and event_type in ('assistant_coach_approval_requested', 'club_hand_back_asked', 'club_hand_back_unasked', 'club_schedule_review',
                         'payment_failed', 'team_coach_payment_reminder', 'team_money_sent', 'team_move_requested', 'team_no_show',
                         'team_request_filed', 'team_request_holding_payout');

update public.notifications
   set cleared_at = now(),
       read_at    = coalesce(read_at, now())
 where cleared_at is null
   and event_type in ('score_disputed', 'coach_access_requested', 'roster_change_requested', 'tryout_offer_response');

commit;
