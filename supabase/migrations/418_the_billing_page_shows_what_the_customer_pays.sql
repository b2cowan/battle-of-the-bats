-- ---------------------------------------------------------------
-- Migration 418 — Plans & pricing Stage 0, Part 6 (fix 1): the billing page shows what the customer actually pays
-- (build prompt docs/projects/active/PLANS_PRICING_STAGE0_BUILD_PROMPT.md).
--
-- WHY: the customer's Plan & billing page built its price from the price LIST (lib/plan-config.ts), never from the
-- subscription. The two agree until a price changes; after a change, a customer kept on the old price would be shown
-- the new one.
--
-- WHAT CHANGES: two nullable columns on organizations, written by the billing webhook from Stripe's current
-- subscription (its first item's price) onto the record that follows that subscription:
--   subscription_amount_cents  the price's unit amount, in the smallest unit of its currency.
--   subscription_currency      its currency (lowercase, three letters, as Stripe writes it).
-- ⚠ The PRICE, not the invoice total: a discount, a quantity above one and (later) tax are not in it.
--
-- NO BACKFILL (Stage 0 ruling in the prompt): an existing subscription fills in on its next webhook; until then the page
-- shows the list price, exactly as today. Additive, nullable, no row changed. Safe on a database with live subscriptions;
-- the code that writes them ships after this migration (prod order: migration first).
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS subscription_amount_cents integer;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS subscription_currency text;

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_subscription_amount_cents_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_subscription_amount_cents_check
  CHECK (subscription_amount_cents IS NULL OR subscription_amount_cents >= 0);
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_subscription_currency_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_subscription_currency_check
  CHECK (subscription_currency IS NULL OR subscription_currency ~ '^[a-z]{3}$');

COMMENT ON COLUMN public.organizations.subscription_amount_cents IS
  'What the subscription on file charges per period: its first item''s price unit amount, in the smallest currency unit '
  '(Plans & pricing Stage 0, Part 6). Written by the billing webhook from Stripe''s current subscription. The price, not the '
  'invoice total (no discount, quantity or tax). NULL until the next webhook: the billing page then shows the list price.';
COMMENT ON COLUMN public.organizations.subscription_currency IS
  'The currency of subscription_amount_cents (lowercase ISO code, as Stripe writes it). The billing page reads the amount only when this is cad.';

COMMIT;

-- Verify (dev, then prod):
--   SELECT count(*) FROM information_schema.columns WHERE table_name = 'organizations'
--     AND column_name IN ('subscription_amount_cents', 'subscription_currency');   -- 2
