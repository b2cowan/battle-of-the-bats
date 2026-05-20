# Billing Plan Invariants

- Free Tournament has no trial period. When Platform Admin moves an org to the Tournament plan, billing state is normalized to `subscription_status = active` with no Stripe subscription id, subscription period, or current period end.
- Dev mock billing may still simulate paid-plan trial states, but Tournament + `trialing` is coerced to `active` so support screens do not show a free plan as trialing.
- Migration 050 normalizes existing rows where `plan_id = tournament` and `subscription_status = trialing`.
