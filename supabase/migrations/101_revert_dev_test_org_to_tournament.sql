-- Reverts dev-test-org to the Tournament (free) plan tier.
-- Apply to dev environment only — this org does not exist in prod.
UPDATE organizations
SET
  plan_id                = 'tournament',
  tournament_limit       = 1,
  subscription_status    = 'active',
  stripe_subscription_id = NULL,
  subscription_period    = NULL,
  current_period_end     = NULL
WHERE slug = 'dev-test-org';
