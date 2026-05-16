-- Billing downgrade/cancellation retention records.
-- These records explain why operational data was made inactive and when it
-- becomes eligible for permanent purge.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS billing_suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_suspension_reason text;

CREATE TABLE IF NOT EXISTS billing_retention_intents (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  intent_type         text NOT NULL CHECK (intent_type IN ('downgrade', 'cancellation')),
  status              text NOT NULL DEFAULT 'applied'
    CHECK (status IN ('pending', 'applied', 'canceled', 'restored', 'purged')),
  from_plan           text,
  target_plan         text,
  keep_tournament_ids uuid[] NOT NULL DEFAULT '{}',
  effective_at        timestamptz NOT NULL DEFAULT now(),
  retention_until     timestamptz NOT NULL,
  reason              text,
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email    text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  applied_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_billing_retention_intents_org
  ON billing_retention_intents(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_retention_intents_retention
  ON billing_retention_intents(retention_until, status);

CREATE TABLE IF NOT EXISTS billing_retained_records (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id          uuid NOT NULL REFERENCES billing_retention_intents(id) ON DELETE CASCADE,
  org_id             uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  record_type         text NOT NULL CHECK (record_type IN ('tournament', 'account')),
  record_id           uuid,
  display_name        text NOT NULL,
  retained_state      text NOT NULL DEFAULT 'retained_inactive'
    CHECK (retained_state IN ('retained_inactive', 'pending_purge', 'purged', 'restored')),
  retained_at         timestamptz NOT NULL DEFAULT now(),
  retention_until     timestamptz NOT NULL,
  extension_count     int NOT NULL DEFAULT 0,
  last_extended_at    timestamptz,
  last_extended_by    text,
  last_extension_reason text,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_billing_retained_records_org
  ON billing_retained_records(org_id, retained_state, retention_until);

CREATE INDEX IF NOT EXISTS idx_billing_retained_records_retention
  ON billing_retained_records(retention_until, retained_state);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_retained_records_active_unique
  ON billing_retained_records(record_type, record_id)
  WHERE retained_state IN ('retained_inactive', 'pending_purge') AND record_id IS NOT NULL;

ALTER TABLE billing_retention_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_retained_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_owners_select_billing_retention_intents" ON billing_retention_intents;
CREATE POLICY "org_owners_select_billing_retention_intents"
  ON billing_retention_intents FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
        AND role = 'owner'
        AND COALESCE(status, 'active') <> 'suspended'
    )
  );

DROP POLICY IF EXISTS "org_owners_select_billing_retained_records" ON billing_retained_records;
CREATE POLICY "org_owners_select_billing_retained_records"
  ON billing_retained_records FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
        AND role = 'owner'
        AND COALESCE(status, 'active') <> 'suspended'
    )
  );
