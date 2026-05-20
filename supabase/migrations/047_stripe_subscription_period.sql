-- Stripe subscription billing detail columns
-- Captures billing period and renewal date from Stripe webhook events.
-- rep_team_subscription_item_id tracks the Club per-team add-on subscription item.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS subscription_period           text CHECK (subscription_period IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS current_period_end            timestamptz,
  ADD COLUMN IF NOT EXISTS rep_team_subscription_item_id text;

COMMENT ON COLUMN public.organizations.subscription_period IS 'monthly or annual — sourced from Stripe subscription item price ID on subscription.created/updated';
COMMENT ON COLUMN public.organizations.current_period_end IS 'Stripe current_period_end — used for renewal display and grace period logic';
COMMENT ON COLUMN public.organizations.rep_team_subscription_item_id IS 'Stripe subscription item ID for the Club per-team add-on; set when billable team count exceeds the free threshold';
