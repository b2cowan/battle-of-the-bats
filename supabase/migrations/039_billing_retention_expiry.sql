-- Retention expiry processing metadata.
-- This supports owner warnings and a pending-purge holding state without
-- hard-deleting customer data automatically.

ALTER TABLE billing_retained_records
  ADD COLUMN IF NOT EXISTS warning_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_purge_at timestamptz,
  ADD COLUMN IF NOT EXISTS purge_notice_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_billing_retained_records_warning
  ON billing_retained_records(retention_until, warning_sent_at)
  WHERE retained_state = 'retained_inactive';

CREATE INDEX IF NOT EXISTS idx_billing_retained_records_pending_purge
  ON billing_retained_records(pending_purge_at)
  WHERE retained_state = 'pending_purge';
