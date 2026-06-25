-- 156_team_workspace_subscription_unique.sql
-- Race-proof Coaches Portal provisioning: one Stripe subscription => at most one team_workspace.
--
-- Problem: a single team checkout fires two webhook events almost simultaneously
-- (checkout.session.completed + customer.subscription.created). Both call the provisioner, both
-- pass its non-atomic "does a workspace already exist for this subscription?" SELECT before either
-- commits, and both create a FULL workspace+org for ONE payment. Symptoms: a duplicate ("...-2")
-- portal, a duplicate welcome email, and a broken post-checkout redirect (the completion page finds
-- two workspaces for one subscription and can't choose, so it never advances).
--
-- Fix: make the database the atomic arbiter. The second insert now fails on this unique index; the
-- provisioner rolls back the loser's org and the caller resolves to "already provisioned" (no second
-- portal, no second email). Partial (WHERE NOT NULL) so the many legacy/dev workspaces that carry a
-- NULL stripe_subscription_id are unaffected (multiple NULLs remain allowed).
--
-- NOTE: existing duplicates must be removed before this applies (a unique index errors otherwise).

CREATE UNIQUE INDEX IF NOT EXISTS team_workspaces_stripe_subscription_id_uniq
  ON team_workspaces (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
