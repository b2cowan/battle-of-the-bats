-- 084_tournament_communications.sql
-- Extends the announcements table into a unified "communications" model.
-- A single record can now represent a site post, an email send, or both.
-- channel_site  = true  → appears on the public tournament News page
-- channel_email = true  → was sent as a direct email to recipients
-- Existing announcements default to channel_site=true, channel_email=false (no change in behaviour).

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS channel_site     BOOLEAN      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS channel_email    BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_targeting  JSONB,
  ADD COLUMN IF NOT EXISTS email_recipient_count   INTEGER,
  ADD COLUMN IF NOT EXISTS email_success_count     INTEGER,
  ADD COLUMN IF NOT EXISTS email_failed_count      INTEGER,
  ADD COLUMN IF NOT EXISTS email_failed_addresses  TEXT[],
  ADD COLUMN IF NOT EXISTS email_sent_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_by_email           TEXT;

-- Partial index for public-page reads (only site posts)
CREATE INDEX IF NOT EXISTS announcements_channel_site_idx
  ON announcements (tournament_id, channel_site)
  WHERE channel_site = true;

-- Partial index for email history queries
CREATE INDEX IF NOT EXISTS announcements_channel_email_idx
  ON announcements (tournament_id, channel_email)
  WHERE channel_email = true;
