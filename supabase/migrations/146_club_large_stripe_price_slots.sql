-- 146_club_large_stripe_price_slots.sql
-- Club Repackaging follow-up: seed the empty Stripe price slots for the new
-- club_large ("Club · Association") band. The platform-admin Plans & Pricing UI
-- EDITS existing stripe_prices rows — it does not create slots — so without these
-- rows the plan modal shows "No Stripe price slots found." Mirrors the 048 seed
-- pattern (4 slots: monthly/annual × sandbox/live). price_id stays NULL until the
-- operator pastes the Stripe price IDs. Additive + idempotent.

INSERT INTO stripe_prices (plan_id, billing_cycle, environment, product_name) VALUES
  ('club_large', 'monthly', 'sandbox', 'FieldLogicHQ — Club · Association'),
  ('club_large', 'annual',  'sandbox', 'FieldLogicHQ — Club · Association'),
  ('club_large', 'monthly', 'live',    'FieldLogicHQ — Club · Association'),
  ('club_large', 'annual',  'live',    'FieldLogicHQ — Club · Association')
ON CONFLICT (plan_id, billing_cycle, environment) DO NOTHING;
