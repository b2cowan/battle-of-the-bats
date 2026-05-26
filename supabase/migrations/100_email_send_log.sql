-- Migration 100 — Email send log: email_sends + email_batches
-- Tracks every outbound marketing email for the founding season sequence.
-- Provides audit trail, suppression records, and batch-level counters
-- for the platform admin email dashboard.

-- ── email_batches ─────────────────────────────────────────────────────────────
-- One row per bulk send operation (manually triggered from platform admin or
-- at signup for transactional singles).
CREATE TABLE IF NOT EXISTS email_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_key text NOT NULL,
  subject text NOT NULL,
  triggered_by text NOT NULL,          -- 'signup' | 'platform_admin:<email>'
  recipient_count int NOT NULL DEFAULT 0,
  suppressed_count int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | running | complete | failed
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_batches_email_key ON email_batches (email_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_batches_status ON email_batches (status);

-- ── email_sends ───────────────────────────────────────────────────────────────
-- One row per send attempt — both bulk-batch rows and transactional singles.
CREATE TABLE IF NOT EXISTS email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_key text NOT NULL,
  subject text NOT NULL,
  recipient_org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  status text NOT NULL DEFAULT 'queued',  -- queued | sent | failed | suppressed
  suppression_reason text,                -- 'opt_out' | 'no_email' | 'send_error'
  resend_message_id text,                 -- Resend API message ID
  batch_id uuid REFERENCES email_batches(id) ON DELETE SET NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_sends_email_key ON email_sends (email_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_sends_batch_id ON email_sends (batch_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_org_id ON email_sends (recipient_org_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_status ON email_sends (status);

-- ── Service-role grants ───────────────────────────────────────────────────────
-- The API routes use the service role (supabaseAdmin) — no RLS needed here since
-- these tables are platform-admin only, never exposed to org users.
-- RLS is not enabled on these tables intentionally.
