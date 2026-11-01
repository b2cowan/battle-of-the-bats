-- ---------------------------------------------------------------
-- Migration 416 — Plans & pricing Stage 0, Part 2 (S5): the billing webhook keeps a record of every event
-- (build prompt docs/projects/active/PLANS_PRICING_STAGE0_BUILD_PROMPT.md; the Connect precedent is mig 358 §4).
--
-- WHY: /api/billing/webhook kept no record of what arrived. A replayed event ran twice, an event from the other Stripe
-- mode was not told apart, and two simultaneous deliveries of one event could both run. Every verified event now gets
-- one row, keyed by Stripe's event id, CLAIMED before it runs (stripe_billing_event_claim, atomic, so only one delivery
-- can run it) and marked processed, failed or ignored after.
--
-- ⚠ NO PAYLOAD IS STORED. It carries customer details and Stripe keeps it; a later replay re-fetches the event by id.
--
-- WHAT CHANGES:
--   (1) table stripe_billing_events (RLS on, no policies, service role only).
--   (2) function stripe_billing_event_claim(...) → 'new' | 'retry' | 'duplicate' | 'busy'. A claim older than five
--       minutes with no outcome (a delivery that died mid-run) can be claimed again.
--
-- Additive, no row change to any existing table, re-runnable. Safe on a database with live subscriptions: the webhook
-- code that writes here ships AFTER this migration (prod order: migration first). INVISIBLE to the drift check: the
-- function.
-- ---------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS public.stripe_billing_events (
  id text NOT NULL,
  type text NOT NULL,
  livemode boolean NOT NULL,
  customer_id text,
  subscription_id text,
  object_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 1,
  error text,
  ignored_reason text,
  CONSTRAINT stripe_billing_events_pkey PRIMARY KEY (id),
  CONSTRAINT stripe_billing_events_ignored_reason_check
    CHECK (ignored_reason IS NULL OR ignored_reason IN ('wrong_mode', 'no_customer', 'not_ours'))
);
-- Stage 0 Part 4 added 'not_ours' (a dispute or refund on a charge that paid no subscription invoice) before this file
-- reached production. Restated so a dev database that ran the first version gets it on a re-run.
ALTER TABLE public.stripe_billing_events DROP CONSTRAINT IF EXISTS stripe_billing_events_ignored_reason_check;
ALTER TABLE public.stripe_billing_events ADD CONSTRAINT stripe_billing_events_ignored_reason_check
  CHECK (ignored_reason IS NULL OR ignored_reason IN ('wrong_mode', 'no_customer', 'not_ours'));
CREATE INDEX IF NOT EXISTS stripe_billing_events_received_idx ON public.stripe_billing_events(received_at);
CREATE INDEX IF NOT EXISTS stripe_billing_events_unprocessed_idx ON public.stripe_billing_events(received_at)
  WHERE processed_at IS NULL AND ignored_reason IS NULL;
CREATE INDEX IF NOT EXISTS stripe_billing_events_customer_idx ON public.stripe_billing_events(customer_id)
  WHERE customer_id IS NOT NULL;
ALTER TABLE public.stripe_billing_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_billing_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_billing_events TO service_role;

COMMENT ON TABLE public.stripe_billing_events IS
  'One row per verified Stripe event delivered to /api/billing/webhook (Plans & pricing Stage 0, S5). No payload: Stripe '
  'keeps it. Claimed by stripe_billing_event_claim before the event runs; processed_at on success, error on failure '
  '(Stripe retries), ignored_reason when it was never run.';
COMMENT ON COLUMN public.stripe_billing_events.id IS 'Stripe''s event id (evt_…).';
COMMENT ON COLUMN public.stripe_billing_events.livemode IS 'The event''s own livemode. A row with ignored_reason wrong_mode came from the other Stripe mode.';
COMMENT ON COLUMN public.stripe_billing_events.customer_id IS 'The Stripe customer the event''s object names, when it names one (a dispute does not).';
COMMENT ON COLUMN public.stripe_billing_events.subscription_id IS 'The subscription the event is about, when it is about one.';
COMMENT ON COLUMN public.stripe_billing_events.object_id IS 'The id of the event''s object (sub_…, in_…, cs_…, pm_…).';
COMMENT ON COLUMN public.stripe_billing_events.claimed_at IS 'When the delivery now running it claimed it; cleared on an outcome. Older than five minutes with no outcome = may be claimed again.';
COMMENT ON COLUMN public.stripe_billing_events.processed_at IS 'When it ran to the end (including the events the webhook answers without acting: a fee invoice, no customer).';
COMMENT ON COLUMN public.stripe_billing_events.attempts IS 'Deliveries that claimed it: 1 on the first, +1 on each retry.';
COMMENT ON COLUMN public.stripe_billing_events.error IS 'The last failure''s message (the webhook answered 500 and Stripe retries). Cleared on the next claim.';
COMMENT ON COLUMN public.stripe_billing_events.ignored_reason IS 'wrong_mode (never run: the other Stripe mode), no_customer (nothing to act on) or not_ours (a dispute or refund on a charge that paid no subscription invoice). NULL when it ran.';

CREATE OR REPLACE FUNCTION public.stripe_billing_event_claim(
  p_id text, p_type text, p_livemode boolean, p_customer text, p_subscription text, p_object text
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  done boolean;
BEGIN
  INSERT INTO stripe_billing_events (id, type, livemode, customer_id, subscription_id, object_id, claimed_at)
  VALUES (p_id, p_type, p_livemode, p_customer, p_subscription, p_object, now())
  ON CONFLICT (id) DO NOTHING;
  IF FOUND THEN RETURN 'new'; END IF;

  -- A failed delivery (claim cleared) or one that died mid-run (claim older than five minutes) runs again.
  UPDATE stripe_billing_events
     SET attempts = attempts + 1, claimed_at = now(), error = NULL
   WHERE id = p_id AND processed_at IS NULL AND ignored_reason IS NULL
     AND (claimed_at IS NULL OR claimed_at < now() - interval '5 minutes');
  IF FOUND THEN RETURN 'retry'; END IF;

  SELECT (processed_at IS NOT NULL OR ignored_reason IS NOT NULL) INTO done FROM stripe_billing_events WHERE id = p_id;
  RETURN CASE WHEN done THEN 'duplicate' ELSE 'busy' END;
END
$$;
REVOKE ALL ON FUNCTION public.stripe_billing_event_claim(text, text, boolean, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stripe_billing_event_claim(text, text, boolean, text, text, text) TO service_role;

COMMIT;

-- Verify (dev, then prod):
--   SELECT count(*) FROM information_schema.tables WHERE table_name = 'stripe_billing_events';  -- 1
--   SELECT count(*) FROM pg_proc WHERE proname = 'stripe_billing_event_claim';                -- 1
-- Proved by scripts/stripe-billing-events-check.sql (claim twice → the second is refused).
