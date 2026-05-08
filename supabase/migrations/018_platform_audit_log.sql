CREATE TABLE IF NOT EXISTS platform_audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email text        NOT NULL,
  org_id      uuid        REFERENCES organizations(id) ON DELETE SET NULL,
  action      text        NOT NULL,
  field       text,
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_org   ON platform_audit_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_actor ON platform_audit_log(actor_email, created_at DESC);
