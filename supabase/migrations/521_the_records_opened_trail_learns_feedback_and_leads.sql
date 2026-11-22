-- 521 · Board Ready D1: the records-opened trail learns a feedback record and an early-access lead.
--
-- The privacy policy and the Data Terms promise that the records our staff open in our own tools are recorded. The trail
-- (mig 365, widened by mig 389) held a club, a person and a sent email. Owner ruling 2026-11-22 (BOARD_READY_PLAN.md §0c, D1):
-- a feedback record and an early-access lead are opened and logged too, so the promise can say "every club, person, email,
-- feedback or lead record they open" and be true. This only widens the allowed values of platform_record_opens.record_kind.
--
-- Nothing else changes: no column, no index, no policy. Existing rows are untouched. Safe to re-run (the constraint is dropped
-- and re-added). The trail's 90-day prune and its repeat-within-ten-minutes rule are in code, not here.

BEGIN;

ALTER TABLE public.platform_record_opens DROP CONSTRAINT IF EXISTS platform_record_opens_record_kind_check;
ALTER TABLE public.platform_record_opens ADD CONSTRAINT platform_record_opens_record_kind_check
  CHECK (record_kind IN ('club', 'person', 'email', 'feedback', 'lead'));

COMMENT ON COLUMN public.platform_record_opens.record_kind IS
  'club = an organizations row (clubs, tournament hosts, coaches portals); person = an auth.users account; email = a platform_account_emails row opened from Sent emails (Stage 5, T17); feedback = a feedback_submissions row; lead = an early_access_leads row (Board Ready D1, mig 521).';

COMMIT;
