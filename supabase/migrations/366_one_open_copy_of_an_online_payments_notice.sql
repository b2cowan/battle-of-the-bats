-- 366 · One open copy of an online-payments Needs-attention notice per person (Club Tier Stage 12a, walk fix 2026-10-25).
--
-- The three Stage 12 notices ("Stripe needs something", "An online payment isn't in the team's record", "A refund
-- didn't reach the card") are raised by a read-then-insert (`raiseOnce`). Two Stripe reads landing in the same second
-- — the onboarding return and the account webhook — both saw "none open" and both inserted, so the owner got the same
-- notice twice (seen on the 2026-10-25 walk: five rows for three people). A read in code cannot close that window;
-- the database can. This index refuses a second OPEN copy of the same notice, for the same person, about the same
-- subject (the Stripe account, or the online payment). A cleared one does not count, so the notice can be raised again
-- the next time Stripe asks. `notify()` reads the refusal as "already waiting" and sends that person nothing more.
--
-- Existing duplicates are cleared first (the earliest copy stays), or the index could not be built.
BEGIN;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY org_id, user_id, event_type, COALESCE(metadata->>'stripeAccountId', metadata->>'onlinePaymentId')
           ORDER BY created_at, id
         ) AS n
  FROM public.notifications
  WHERE cleared_at IS NULL
    AND event_type IN ('payouts_need_attention', 'online_payment_not_recorded', 'card_refund_failed')
    AND COALESCE(metadata->>'stripeAccountId', metadata->>'onlinePaymentId') IS NOT NULL
)
UPDATE public.notifications n
   SET read_at = COALESCE(n.read_at, now()), cleared_at = now()
  FROM ranked
 WHERE ranked.id = n.id AND ranked.n > 1;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_one_open_online_payments_notice
  ON public.notifications (org_id, user_id, event_type, (COALESCE(metadata->>'stripeAccountId', metadata->>'onlinePaymentId')))
  WHERE cleared_at IS NULL
    AND event_type IN ('payouts_need_attention', 'online_payment_not_recorded', 'card_refund_failed');

COMMIT;
