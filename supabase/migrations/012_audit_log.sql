CREATE TABLE IF NOT EXISTS org_audit_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id   uuid,
  target_id  uuid,
  action     text        NOT NULL,
  payload    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org ON org_audit_log(org_id, created_at DESC);

-- RLS: service role (supabaseAdmin) bypasses all policies — writes are safe.
-- Authenticated users can only read their own org's log, and only if they are the owner.
ALTER TABLE org_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_select_own_org_audit_log" ON org_audit_log;
CREATE POLICY "owners_select_own_org_audit_log"
  ON org_audit_log
  FOR SELECT
  TO authenticated
  USING (is_org_owner(org_id));
