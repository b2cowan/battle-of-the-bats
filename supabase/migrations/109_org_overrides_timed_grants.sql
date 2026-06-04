-- Timed entitlement grants (H8) — extend org_overrides to drive time-boxed comps/trials
-- that the entitlement layer honors and that AUTO-REVERT at expiry.
--
-- DBA review 2026-06-04 (docs/agents/db/DB_ARCHITECTURE_REVIEW.md #22): extend the existing
-- org_overrides override pattern rather than create a parallel table. Additive + backward
-- compatible — existing rows are unaffected, no backfill of meaningful data.

ALTER TABLE public.org_overrides
  ADD COLUMN IF NOT EXISTS target jsonb,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS suppress_billing boolean NOT NULL DEFAULT false;

-- Widen the type CHECK to add module_addon + plan_tier. The original constraint
-- (migration 019, inline CHECK) is auto-named org_overrides_type_check.
ALTER TABLE public.org_overrides
  DROP CONSTRAINT IF EXISTS org_overrides_type_check;
ALTER TABLE public.org_overrides
  ADD CONSTRAINT org_overrides_type_check
  CHECK (type IN ('subscription_status', 'comp_period', 'module_addon', 'plan_tier'));

-- Keep the active-grant lookup tight as the table grows (the entitlement hot path
-- fetches active, non-revoked overrides per org).
CREATE INDEX IF NOT EXISTS idx_org_overrides_org_active
  ON public.org_overrides(org_id)
  WHERE revoked_at IS NULL;
