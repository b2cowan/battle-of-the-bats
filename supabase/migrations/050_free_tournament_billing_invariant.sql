-- Free Tournament has no trial period or Stripe subscription.
-- Normalize any rows left inconsistent by older mock/admin plan-change flows.

UPDATE public.organizations
SET
  subscription_status = 'active',
  stripe_subscription_id = NULL,
  subscription_period = NULL,
  current_period_end = NULL
WHERE plan_id = 'tournament'
  AND subscription_status = 'trialing';
