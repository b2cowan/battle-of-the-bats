-- ---------------------------------------------------------------
-- Migration 417 — Plans & pricing Stage 0, Part 5 (fix 2): a replaced Stripe price stays recognised
-- (build prompt docs/projects/active/PLANS_PRICING_STAGE0_BUILD_PROMPT.md).
--
-- WHY: a price slot's id is overwritten in place (product-catalog/change-requests), and nothing remembered the old one.
-- A customer still paying the old price renewed into a webhook that matched no plan and did nothing at all, and the
-- Money tab read it as "A price we do not know". The old id was kept only inside platform_audit_log.old_value.
--
-- WHAT CHANGES:
--   (1) table stripe_price_ids_retired: one row per price id a slot ever stopped using. APPEND-ONLY: RLS on, no
--       policies; the service role may only read (the trigger is the one writer: no insert, update or delete).
--   (2) trigger on stripe_prices: whenever a slot's price_id changes from a non-null value, or a wired slot is deleted,
--       the old id is recorded. Every writer is covered, not only today's one route.
--   (3) backfill from platform_audit_log (action update_stripe_price_id): the ids replaced before this migration.
--
-- A price id is unique to its Stripe mode, so `environment` is the mode it belongs to (from the slot). First retirement
-- wins (ON CONFLICT DO NOTHING): an id put back into a slot and replaced again keeps its first row; the lookup reads the
-- current slots first, so a put-back id is read as current.
--
-- Additive, no row change to any existing table, re-runnable. Safe on a database with live subscriptions. INVISIBLE to
-- the drift check: the trigger and its function.
-- ---------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS public.stripe_price_ids_retired (
  price_id text NOT NULL,
  plan_id text NOT NULL,
  billing_cycle text NOT NULL,
  environment text NOT NULL,
  retired_at timestamptz NOT NULL DEFAULT now(),
  retired_by_email text,
  CONSTRAINT stripe_price_ids_retired_pkey PRIMARY KEY (price_id)
);
ALTER TABLE public.stripe_price_ids_retired ENABLE ROW LEVEL SECURITY;
-- no-service-role-grant: stripe_price_ids_retired — append-only by design: the server only READS it (SELECT granted
-- below); its one writer is the SECURITY DEFINER trigger, so no role may insert, update or delete through the Data API.
REVOKE ALL ON public.stripe_price_ids_retired FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.stripe_price_ids_retired TO service_role;

COMMENT ON TABLE public.stripe_price_ids_retired IS
  'Every Stripe price id a price slot (stripe_prices) stopped using, with the plan and cycle it was for (Plans & pricing '
  'Stage 0, Part 5). Append-only. Written by the stripe_prices trigger; read after the current slots, so a customer still '
  'paying a replaced price is recognised.';
COMMENT ON COLUMN public.stripe_price_ids_retired.price_id IS 'The Stripe price id (price_…) the slot used before.';
COMMENT ON COLUMN public.stripe_price_ids_retired.plan_id IS 'The plan the slot was for when this id was replaced.';
COMMENT ON COLUMN public.stripe_price_ids_retired.billing_cycle IS 'monthly or annual, from the slot.';
COMMENT ON COLUMN public.stripe_price_ids_retired.environment IS 'sandbox or live, from the slot: the Stripe mode the id belongs to.';
COMMENT ON COLUMN public.stripe_price_ids_retired.retired_at IS 'When the slot stopped using it (the audit row''s time for a backfilled id).';
COMMENT ON COLUMN public.stripe_price_ids_retired.retired_by_email IS 'Who replaced it: the slot''s updated_by_email at the change, or the audit row''s actor for a backfilled id.';

CREATE OR REPLACE FUNCTION public.stripe_prices_record_retired_id()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.price_id IS NOT NULL AND (TG_OP = 'DELETE' OR NEW.price_id IS DISTINCT FROM OLD.price_id) THEN
    INSERT INTO stripe_price_ids_retired (price_id, plan_id, billing_cycle, environment, retired_by_email)
    VALUES (OLD.price_id, OLD.plan_id, OLD.billing_cycle, OLD.environment,
            CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.updated_by_email END)
    ON CONFLICT (price_id) DO NOTHING;
  END IF;
  RETURN NULL;
END
$$;
REVOKE ALL ON FUNCTION public.stripe_prices_record_retired_id() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS stripe_prices_record_retired_id ON public.stripe_prices;
CREATE TRIGGER stripe_prices_record_retired_id
  AFTER UPDATE OF price_id OR DELETE ON public.stripe_prices
  FOR EACH ROW EXECUTE FUNCTION public.stripe_prices_record_retired_id();

-- The ids replaced before today, oldest first (first retirement wins).
INSERT INTO public.stripe_price_ids_retired (price_id, plan_id, billing_cycle, environment, retired_at, retired_by_email)
SELECT a.old_value->>'price_id', a.old_value->>'plan_id', a.old_value->>'billing_cycle', a.old_value->>'environment',
       a.created_at, a.actor_email
  FROM public.platform_audit_log a
 WHERE a.action = 'update_stripe_price_id'
   AND a.old_value->>'price_id' IS NOT NULL
   AND a.old_value->>'plan_id' IS NOT NULL
   AND a.old_value->>'billing_cycle' IS NOT NULL
   AND a.old_value->>'environment' IS NOT NULL
   AND a.old_value->>'price_id' IS DISTINCT FROM a.new_value->>'price_id'
 ORDER BY a.created_at
ON CONFLICT (price_id) DO NOTHING;

COMMIT;

-- Verify (dev, then prod):
--   SELECT count(*) FROM pg_trigger WHERE tgname = 'stripe_prices_record_retired_id';   -- 1
--   SELECT count(*) FROM stripe_price_ids_retired;                                     -- the backfill (dev: 2 on 2026-11-01)
-- Proved by scripts/stripe-price-retired-check.sql (replace → recorded; an unrelated column update → nothing).
