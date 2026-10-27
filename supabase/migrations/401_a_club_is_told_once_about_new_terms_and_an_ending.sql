-- Club Tier Stage 12d-2 Part 1 (owner rulings 2026-10-27, plan §0 "12d-2 build state", ruling 4): the daily job's two new
-- emails to the owner are sent ONCE each, so each needs a stamp on the club's payments account.
--
--   The payments terms changed (words §5.2): on the day the club is found on an older version, an owner item and one
--   email; one reminder 14 days later while still not agreed. `terms_notice_version` is the version the club was told
--   about, so a later version tells it again; agreeing never clears the stamps (they record what was sent).
--
--   An ending the owner didn't choose (words §4.2): one warning — seven days before a comp ends, or the day a
--   subscription payment first fails (that suspension has no known date). `ending_warned_for` is the ending it was about
--   (the comp's end, or the moment the payment went past due), so a moved end date or a new failure warns again.
--
-- Additive, nullable, no row changes; re-runnable. The table stays server-only (RLS on, no policies, no grants to anon /
-- authenticated).

ALTER TABLE public.org_payment_accounts ADD COLUMN IF NOT EXISTS terms_notice_version text;
ALTER TABLE public.org_payment_accounts ADD COLUMN IF NOT EXISTS terms_notice_at timestamptz;
ALTER TABLE public.org_payment_accounts ADD COLUMN IF NOT EXISTS terms_reminded_at timestamptz;
ALTER TABLE public.org_payment_accounts ADD COLUMN IF NOT EXISTS ending_warned_for timestamptz;
ALTER TABLE public.org_payment_accounts ADD COLUMN IF NOT EXISTS ending_warned_at timestamptz;

ALTER TABLE public.org_payment_accounts DROP CONSTRAINT IF EXISTS org_payment_accounts_terms_notice_chk;
ALTER TABLE public.org_payment_accounts ADD CONSTRAINT org_payment_accounts_terms_notice_chk CHECK (
  (terms_notice_version IS NULL) = (terms_notice_at IS NULL)
  AND (terms_reminded_at IS NULL OR terms_notice_at IS NOT NULL));

ALTER TABLE public.org_payment_accounts DROP CONSTRAINT IF EXISTS org_payment_accounts_ending_warned_chk;
ALTER TABLE public.org_payment_accounts ADD CONSTRAINT org_payment_accounts_ending_warned_chk CHECK (
  (ending_warned_for IS NULL) = (ending_warned_at IS NULL));

COMMENT ON COLUMN public.org_payment_accounts.terms_notice_version IS 'Club Tier 12d-2 (mig 401): the payments-terms version the owner was told about (item + email), once per version. Agreeing never clears it.';
COMMENT ON COLUMN public.org_payment_accounts.terms_notice_at IS 'Club Tier 12d-2 (mig 401): when the owner was told about terms_notice_version.';
COMMENT ON COLUMN public.org_payment_accounts.terms_reminded_at IS 'Club Tier 12d-2 (mig 401): the one reminder, 14 days after terms_notice_at, sent only while the club has not agreed to that version.';
COMMENT ON COLUMN public.org_payment_accounts.ending_warned_for IS 'Club Tier 12d-2 (mig 401): the ending the owner was warned about (a comp''s end, or the moment a subscription payment went past due). A different value warns again.';
COMMENT ON COLUMN public.org_payment_accounts.ending_warned_at IS 'Club Tier 12d-2 (mig 401): when that one warning (item + card notice + email) went.';
