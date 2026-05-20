-- Stripe price IDs, previously stored as Amplify env vars.
-- Storing in DB allows platform admins to update them without a redeploy.
-- Environment 'sandbox' maps to Stripe test mode; 'live' maps to Stripe live mode.
-- The active environment is derived from the STRIPE_SECRET_KEY prefix at runtime.

CREATE TABLE stripe_prices (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       text        NOT NULL,
  billing_cycle text        NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  environment   text        NOT NULL CHECK (environment IN ('sandbox', 'live')),
  price_id      text,
  product_name  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, billing_cycle, environment)
);

COMMENT ON TABLE  stripe_prices               IS 'Stripe price IDs per plan/cycle/environment, managed via platform admin UI';
COMMENT ON COLUMN stripe_prices.plan_id       IS 'tournament_plus | league | club | rep_team';
COMMENT ON COLUMN stripe_prices.billing_cycle IS 'monthly or annual';
COMMENT ON COLUMN stripe_prices.environment   IS 'sandbox (test mode) or live';
COMMENT ON COLUMN stripe_prices.price_id      IS 'Stripe price_xxx value; null until configured';

-- Pre-populate all 16 slots so the admin UI shows labelled empty rows from the start.
INSERT INTO stripe_prices (plan_id, billing_cycle, environment, product_name) VALUES
  ('tournament_plus', 'monthly', 'sandbox', 'FieldLogicHQ — Tournament Plus'),
  ('tournament_plus', 'annual',  'sandbox', 'FieldLogicHQ — Tournament Plus'),
  ('league',          'monthly', 'sandbox', 'FieldLogicHQ — League'),
  ('league',          'annual',  'sandbox', 'FieldLogicHQ — League'),
  ('club',            'monthly', 'sandbox', 'FieldLogicHQ — Club'),
  ('club',            'annual',  'sandbox', 'FieldLogicHQ — Club'),
  ('rep_team',        'monthly', 'sandbox', 'Additional Rep Team (Club)'),
  ('rep_team',        'annual',  'sandbox', 'Additional Rep Team (Club)'),
  ('tournament_plus', 'monthly', 'live',    'FieldLogicHQ — Tournament Plus'),
  ('tournament_plus', 'annual',  'live',    'FieldLogicHQ — Tournament Plus'),
  ('league',          'monthly', 'live',    'FieldLogicHQ — League'),
  ('league',          'annual',  'live',    'FieldLogicHQ — League'),
  ('club',            'monthly', 'live',    'FieldLogicHQ — Club'),
  ('club',            'annual',  'live',    'FieldLogicHQ — Club'),
  ('rep_team',        'monthly', 'live',    'Additional Rep Team (Club)'),
  ('rep_team',        'annual',  'live',    'Additional Rep Team (Club)')
ON CONFLICT (plan_id, billing_cycle, environment) DO NOTHING;