-- Migration 099 — Email marketing opt-out on organizations
-- Adds CASL-compliant opt-out columns so every marketing email can be suppressed
-- for organizations that unsubscribe. Transactional emails (welcome, billing alerts)
-- do NOT check this flag.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS email_marketing_opt_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_opt_out_at timestamptz;

-- Index for fast suppression check in the send loop
CREATE INDEX IF NOT EXISTS idx_organizations_email_opt_out
  ON organizations (email_marketing_opt_out)
  WHERE email_marketing_opt_out = true;
