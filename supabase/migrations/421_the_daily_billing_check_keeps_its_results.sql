-- ---------------------------------------------------------------
-- Migration 421 — Plans & pricing Stage 0, Part 11 (S6): the daily comparison with Stripe keeps its results
-- (build prompt docs/projects/active/PLANS_PRICING_STAGE0_BUILD_PROMPT.md; owner's go 2026-11-01).
--
-- WHY: once a day POST /api/platform-admin/billing-drift-daily reads every Stripe subscription and every billing record of
-- ours that follows one, and says where they disagree (lib/billing-drift.ts). It REPORTS AND NEVER REPAIRS. Each run
-- leaves one row here; Stage 2's "Watching Stripe" tab will read them. The schedule itself is migration 422.
--
-- WHAT CHANGES: table stripe_billing_drift_checks (RLS on, no policies, service role only). Nothing else.
--
-- ⚠ NO CUSTOMER DETAILS beyond what our own records already name: a difference carries the club's id and name, the
-- subscription id, and the two values that disagree (a status, a plan, a cycle, a date, a price id, a customer id).
--
-- Additive, no row change to any existing table, re-runnable. Safe on a database with live subscriptions. Prod order:
-- this migration BEFORE the code (the job's save would fail and the day's run would be marked failed).
-- ---------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS public.stripe_billing_drift_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  environment text NOT NULL,
  outcome text NOT NULL,
  subscriptions_read integer NOT NULL DEFAULT 0,
  records_compared integer NOT NULL DEFAULT 0,
  differences jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  owner_emailed boolean NOT NULL DEFAULT false,
  CONSTRAINT stripe_billing_drift_checks_pkey PRIMARY KEY (id),
  CONSTRAINT stripe_billing_drift_checks_environment_check CHECK (environment IN ('live', 'sandbox')),
  CONSTRAINT stripe_billing_drift_checks_outcome_check CHECK (outcome IN ('equal', 'differs', 'could_not_compare')),
  CONSTRAINT stripe_billing_drift_checks_differences_check CHECK (jsonb_typeof(differences) = 'array'),
  CONSTRAINT stripe_billing_drift_checks_counts_check CHECK (subscriptions_read >= 0 AND records_compared >= 0)
);
CREATE INDEX IF NOT EXISTS stripe_billing_drift_checks_checked_idx ON public.stripe_billing_drift_checks(checked_at DESC);
ALTER TABLE public.stripe_billing_drift_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_billing_drift_checks FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_billing_drift_checks TO service_role;

COMMENT ON TABLE public.stripe_billing_drift_checks IS
  'One row per run of the daily comparison with Stripe (Plans & pricing Stage 0, Part 11, S6; lib/billing-drift.ts). '
  'Read-only towards Stripe and our records: it reports, never repairs. Stage 2''s Watching Stripe tab reads it.';
COMMENT ON COLUMN public.stripe_billing_drift_checks.checked_at IS 'When the run finished.';
COMMENT ON COLUMN public.stripe_billing_drift_checks.environment IS 'The Stripe mode it read: live or sandbox (stripeEnvironment()).';
COMMENT ON COLUMN public.stripe_billing_drift_checks.outcome IS 'equal (nothing differs), differs (see differences), could_not_compare (a read failed: see error; never counted as a difference).';
COMMENT ON COLUMN public.stripe_billing_drift_checks.subscriptions_read IS 'Subscriptions Stripe listed (every one not cancelled).';
COMMENT ON COLUMN public.stripe_billing_drift_checks.records_compared IS 'Our records that follow a subscription (organizations with a stripe_subscription_id, test ids left out).';
COMMENT ON COLUMN public.stripe_billing_drift_checks.differences IS 'Array of {kind, subscriptionId, orgId, name, ours, stripe}; kind is gone, status, plan, cycle, renewal, price or not_followed. Empty unless outcome = differs.';
COMMENT ON COLUMN public.stripe_billing_drift_checks.error IS 'Why the run could not compare. NULL otherwise.';
COMMENT ON COLUMN public.stripe_billing_drift_checks.owner_emailed IS 'The mail service accepted the owner''s email for this run (false on equal or a failed send). A same-day re-run under the same once-only key delivers no second email.';

COMMIT;

-- Verify (dev, then prod):
--   SELECT count(*) FROM information_schema.tables WHERE table_name = 'stripe_billing_drift_checks';  -- 1
