CREATE TABLE IF NOT EXISTS org_overrides (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('subscription_status', 'comp_period')),
  value       text,
  expires_at  timestamptz,
  reason      text        NOT NULL,
  created_by  text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  revoked_by  text
);

CREATE INDEX IF NOT EXISTS idx_org_overrides_org ON org_overrides(org_id, created_at DESC);
