-- ---------------------------------------------------------------
-- Migration 384 — Club Tier Stage 12c Part 3: a refund made in the club's Stripe dashboard records itself whenever it can
-- be pinned; a person is asked only "whose was it?" or "what now?".
-- Plan: docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md §0g ruling 5, §0j ask 4; words
-- CLUB_TIER_STAGE12C_REFUND_VISIBLE_COPY.md §4–5, CLUB_TIER_STAGE12C_PARTREFUND_BANKDEBIT_COPY.md §1.6.
--
-- WHY: until now a house-league refund made in Stripe raised "couldn't be recorded" and booked nothing; a tournament team's
-- PART refund made in Stripe did the same. Stripe has already moved the money, so the amounts are Stripe's, not a form's:
-- they are recorded as given (a refund counts against the fee first; anything above it is the processing fee given back),
-- through the flows' own booking functions (house league mig 375/382, team mig 382).
--
-- WHAT CHANGES:
--   1. online_payment_refunds.stripe_created_at — the refund's own moment at Stripe (the email's "On", never the day we heard
--      of it); family_answer / family_answer_by / family_answer_at — "what now?" for a still-enrolled child (withdraw · link ·
--      keep), the answer that clears its notice.
--   2. online_refunds_unassigned (NEW) — a part refund made in Stripe on a payment for two or more children, waiting for
--      "whose was it?": it is in no book until a person answers (the Fee cell's "not matched yet" line reads it).
--   3. online_payment_refund_record_dashboard (NEW) — records a refund Stripe already made (pending, origin
--      stripe_dashboard, Stripe's id and moment), validated against what is left; idempotent per (Stripe refund, child).
--   4. Three Needs-attention kinds — card_refund_whose, card_refund_still_enrolled, card_refund_unmatched — so both partial
--      indexes and the one-open-copy index are rebuilt (the mig 338 / 370 precedent; the one-open key gains their subjects).
-- RLS: the new table is service-role only, like every Stage 12 table.
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. The refund's own moment, and the answer for a still-enrolled child ────────────────────────
ALTER TABLE public.online_payment_refunds ADD COLUMN IF NOT EXISTS stripe_created_at timestamptz;
ALTER TABLE public.online_payment_refunds ADD COLUMN IF NOT EXISTS family_answer text;
ALTER TABLE public.online_payment_refunds ADD COLUMN IF NOT EXISTS family_answer_by uuid;
ALTER TABLE public.online_payment_refunds ADD COLUMN IF NOT EXISTS family_answer_at timestamptz;
ALTER TABLE public.online_payment_refunds DROP CONSTRAINT IF EXISTS online_payment_refunds_family_answer_chk;
ALTER TABLE public.online_payment_refunds ADD CONSTRAINT online_payment_refunds_family_answer_chk CHECK (
  (family_answer IS NULL OR family_answer IN ('withdraw', 'link', 'keep'))
  AND ((family_answer IS NULL) = (family_answer_at IS NULL)));
ALTER TABLE public.online_payment_refunds DROP CONSTRAINT IF EXISTS online_payment_refunds_family_answer_by_fk;
ALTER TABLE public.online_payment_refunds ADD CONSTRAINT online_payment_refunds_family_answer_by_fk
  FOREIGN KEY (family_answer_by) REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS online_payment_refunds_family_answer_by_idx ON public.online_payment_refunds(family_answer_by)
  WHERE family_answer_by IS NOT NULL;

-- ── 2. A part refund made in Stripe that waits for "whose was it?" ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.online_refunds_unassigned (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  online_payment_id uuid NOT NULL,
  stripe_refund_id text NOT NULL,
  amount numeric(12,2) NOT NULL,
  stripe_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  assigned_at timestamptz,
  assigned_by uuid,
  CONSTRAINT online_refunds_unassigned_pkey PRIMARY KEY (id),
  CONSTRAINT online_refunds_unassigned_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT online_refunds_unassigned_payment_fk FOREIGN KEY (online_payment_id) REFERENCES public.online_payments(id),
  CONSTRAINT online_refunds_unassigned_assigned_by_fk FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT online_refunds_unassigned_amount_chk CHECK (amount > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS online_refunds_unassigned_stripe_key ON public.online_refunds_unassigned(stripe_refund_id);
CREATE INDEX IF NOT EXISTS online_refunds_unassigned_org_idx ON public.online_refunds_unassigned(org_id);
CREATE INDEX IF NOT EXISTS online_refunds_unassigned_payment_idx ON public.online_refunds_unassigned(online_payment_id);
CREATE INDEX IF NOT EXISTS online_refunds_unassigned_assigned_by_idx ON public.online_refunds_unassigned(assigned_by) WHERE assigned_by IS NOT NULL;
ALTER TABLE public.online_refunds_unassigned ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.online_refunds_unassigned FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.online_refunds_unassigned TO service_role;
COMMENT ON TABLE public.online_refunds_unassigned IS 'A part refund made in Stripe on a house-league payment for two or more children, waiting for a person to say whose it was (mig 384). In no book until assigned; then its refund rows (one per child, one Stripe id) are recorded and assigned_at is set.';

-- ── 3. Recording a refund Stripe already made ────────────────────────────────────────────────────
-- The amounts are Stripe's. House league: one child's share, `p_base` up to what is left of it (and what the season's book
-- still shows received, mig 376's cap), `p_fee` only on the whole of an untouched share while the family paid the fee.
-- A team: always a PART refund (`part_refund`, never the fee — a whole-payment refund lands through 12a's full path).
-- Idempotent: a second call for the same Stripe refund and child answers the first row's id. The caller books it.
CREATE OR REPLACE FUNCTION public.online_payment_refund_record_dashboard(
  p_online_payment uuid, p_item uuid, p_base numeric, p_fee numeric, p_stripe_refund text, p_stripe_created timestamptz,
  p_partial_reason text, p_actor uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op public.online_payments%ROWTYPE; v_it public.online_payment_items%ROWTYPE; v_reg uuid;
  v_base numeric(12,2) := round(p_base, 2); v_fee numeric(12,2) := round(coalesce(p_fee, 0), 2);
  v_back numeric(12,2); v_left numeric(12,2); v_book_left numeric(12,2); v_id uuid;
  v_why text := nullif(btrim(coalesce(p_partial_reason, '')), '');
BEGIN
  IF p_stripe_refund IS NULL THEN RAISE EXCEPTION 'A refund made in Stripe carries Stripe''s id.'; END IF;
  IF v_base IS NULL OR v_base <= 0 OR v_fee < 0 THEN RAISE EXCEPTION 'A refund is more than zero.'; END IF;
  -- Lock order (mig 375): the child's registration before the payment.
  IF p_item IS NOT NULL THEN
    SELECT i.registration_id INTO v_reg FROM online_payment_items i WHERE i.id = p_item;
    IF v_reg IS NOT NULL THEN PERFORM 1 FROM league_registrations g WHERE g.id = v_reg FOR UPDATE; END IF;
  END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  SELECT r.id INTO v_id FROM online_payment_refunds r
   WHERE r.stripe_refund_id = p_stripe_refund AND r.online_payment_item_id IS NOT DISTINCT FROM p_item;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  IF v_op.status NOT IN ('paid', 'partly_refunded') THEN RAISE EXCEPTION 'This payment can no longer be refunded.'; END IF;

  IF v_op.flow = 'tournament_team' THEN
    IF p_item IS NOT NULL THEN RAISE EXCEPTION 'A team''s payment has no children to name.'; END IF;
    IF v_fee > 0 THEN RAISE EXCEPTION 'A team''s refund with the fee is the whole payment.'; END IF;
    IF v_op.landed_at IS NULL THEN RAISE EXCEPTION 'This payment isn''t in the team''s record yet.'; END IF;
    SELECT coalesce(sum(r.amount - r.fee_refunded), 0) INTO v_back FROM online_payment_refunds r
     WHERE r.online_payment_id = v_op.id AND (r.status IN ('pending', 'succeeded') OR r.booked_at IS NOT NULL);
    v_left := v_op.base_amount - v_back;
    IF v_base > v_left THEN RAISE EXCEPTION 'A refund is more than zero and no more than what is left: %', v_left; END IF;
    PERFORM set_config('flhq.online_payment_write', 'on', true);
    INSERT INTO online_payment_refunds(online_payment_id, org_id, amount, fee_refunded, partial_reason, origin, created_by,
      part_refund, stripe_refund_id, stripe_created_at)
    VALUES (v_op.id, v_op.org_id, v_base, 0, v_why, 'stripe_dashboard', p_actor, true, p_stripe_refund, p_stripe_created)
    RETURNING id INTO v_id;
    PERFORM set_config('flhq.online_payment_write', 'off', true);
    RETURN v_id;
  END IF;

  IF p_item IS NULL THEN RAISE EXCEPTION 'A house-league refund names the child it refunds.'; END IF;
  SELECT * INTO v_it FROM online_payment_items i WHERE i.id = p_item AND i.online_payment_id = v_op.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That child is not on this payment.'; END IF;
  SELECT coalesce(sum(r.amount - r.fee_refunded), 0) INTO v_back FROM online_payment_refunds r
   WHERE r.online_payment_item_id = v_it.id AND (r.status IN ('pending', 'succeeded') OR r.booked_at IS NOT NULL);
  v_left := v_it.amount - v_back;
  IF v_it.entry_id IS NOT NULL AND v_it.registration_id IS NOT NULL THEN
    SELECT league_reg_received(v_it.registration_id) - coalesce(sum(r.amount - r.fee_refunded), 0) INTO v_book_left
      FROM online_payment_refunds r JOIN online_payment_items i ON i.id = r.online_payment_item_id
     WHERE i.registration_id = v_it.registration_id AND r.status = 'pending' AND r.booked_at IS NULL;
    v_left := least(v_left, v_book_left);
  END IF;
  IF v_base > v_left THEN RAISE EXCEPTION 'A refund is more than zero and no more than what is left: %', v_left; END IF;
  IF v_fee > 0 AND NOT (v_op.fee_payer = 'family' AND v_back = 0 AND v_base = v_it.amount AND v_fee <= v_it.fee_share) THEN
    RAISE EXCEPTION 'The processing fee goes back only with the whole of an untouched share.';
  END IF;
  INSERT INTO online_payment_refunds(online_payment_id, online_payment_item_id, org_id, amount, fee_refunded, partial_reason,
    origin, created_by, stripe_refund_id, stripe_created_at)
  VALUES (v_op.id, v_it.id, v_op.org_id, v_base + v_fee, v_fee, v_why, 'stripe_dashboard', p_actor, p_stripe_refund, p_stripe_created)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.online_payment_refund_record_dashboard(uuid, uuid, numeric, numeric, text, timestamptz, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_refund_record_dashboard(uuid, uuid, numeric, numeric, text, timestamptz, text, uuid) TO service_role;

-- ── 4. Three Needs attention kinds: the partial indexes list every kind (mig 338 / 370 precedent) ──
--   card_refund_whose          — a part refund made in Stripe on a payment for two or more children: choose the child
--   card_refund_still_enrolled — a child's fee went back in Stripe and the child is still registered: withdraw, link or keep
--   card_refund_unmatched      — a refund made in Stripe on a payment we haven't recorded yet (events out of order)
drop index if exists public.notifications_user_needs_attention_idx;
create index notifications_user_needs_attention_idx
  on public.notifications (user_id, event_type)
  where cleared_at is null
    and event_type in ('assistant_coach_approval_requested', 'card_refund_failed', 'card_refund_still_enrolled', 'card_refund_unmatched',
                         'card_refund_whose', 'club_hand_back_asked', 'club_hand_back_unasked',
                         'club_payment_handed_off', 'club_schedule_review', 'house_league_withdraw_request', 'online_payment_not_recorded',
                         'payment_failed', 'payouts_need_attention', 'team_coach_payment_reminder', 'team_money_sent',
                         'team_move_requested', 'team_no_show', 'team_request_filed', 'team_request_holding_payout');

drop index if exists public.notifications_org_needs_attention_idx;
create index notifications_org_needs_attention_idx
  on public.notifications (org_id, event_type)
  where cleared_at is null
    and event_type in ('assistant_coach_approval_requested', 'card_refund_failed', 'card_refund_still_enrolled', 'card_refund_unmatched',
                         'card_refund_whose', 'club_hand_back_asked', 'club_hand_back_unasked',
                         'club_payment_handed_off', 'club_schedule_review', 'house_league_withdraw_request', 'online_payment_not_recorded',
                         'payment_failed', 'payouts_need_attention', 'team_coach_payment_reminder', 'team_money_sent',
                         'team_move_requested', 'team_no_show', 'team_request_filed', 'team_request_holding_payout');

-- One open copy per person and subject (mig 366/374), the three new kinds keyed on their own subjects. No such notice exists
-- before this migration, so the rebuild meets no duplicate.
DROP INDEX IF EXISTS public.notifications_one_open_online_payments_notice;
CREATE UNIQUE INDEX notifications_one_open_online_payments_notice
  ON public.notifications (org_id, user_id, event_type,
    (COALESCE(metadata->>'stripeAccountId', metadata->>'onlinePaymentItemId', metadata->>'onlinePaymentId',
              metadata->>'unassignedRefundId', metadata->>'enrolledRefundId', metadata->>'unmatchedStripeRefundId')))
  WHERE cleared_at IS NULL
    AND event_type IN ('payouts_need_attention', 'online_payment_not_recorded', 'card_refund_failed',
                       'card_refund_whose', 'card_refund_still_enrolled', 'card_refund_unmatched');

COMMIT;
