-- 364 · A club's payouts account reads Stripe's Accounts v2 (Club Tier Stage 12a rework; owner ruling 2026-10-25,
-- CLUB_TIER_STAGE12_PAYMENTS_PLAN.md §0d).
--
-- Stripe refuses v1 account creation for new Connect platforms, and the owner ruled to build on Accounts v2 rather than
-- turn on the "Accounts v1 support" toggle. A v2 account has no `charges_enabled`, `payouts_enabled`,
-- `details_submitted` or `requirements.disabled_reason`, so the mirror of Stripe's facts is reshaped:
--   - `card_payments_status` / `card_payments_reason` — the merchant configuration's card_payments capability and the
--     code of its first status detail. A pay page opens only while the status is 'active'.
--   - `onboarding_finished_at` — when Stripe's sign-up was first seen finished (nothing it asks for at sign-up is still
--     waiting on the club). Set once and kept, like v1's `details_submitted`: it is what tells "Setting up" from
--     "Needs attention" and what lets "Open Stripe" mint a dashboard sign-in.
--   - `requirements_due` / `requirements_deadline` keep their names; they now hold the v2 entries awaiting the club that
--     are due now or past due, and `requirements.summary.minimum_deadline.time`.
-- `payouts_enabled` goes with no successor: no code ever read it (the dictionary said otherwise — that was drift).
--
-- A CLEAN RESHAPE, NOT A DATA MOVE. 358/359 are dev-only and prod-pending, and dev holds no account row (the first walk's
-- 500 came before the insert), so nothing is carried across. Applied migrations are never edited: this file is the change.
BEGIN;

ALTER TABLE public.org_payment_accounts
  DROP COLUMN IF EXISTS charges_enabled,
  DROP COLUMN IF EXISTS payouts_enabled,
  DROP COLUMN IF EXISTS details_submitted,
  DROP COLUMN IF EXISTS disabled_reason,
  ADD COLUMN IF NOT EXISTS card_payments_status text,
  ADD COLUMN IF NOT EXISTS card_payments_reason text,
  ADD COLUMN IF NOT EXISTS onboarding_finished_at timestamptz;

ALTER TABLE public.org_payment_accounts DROP CONSTRAINT IF EXISTS org_payment_accounts_card_payments_status_chk;
ALTER TABLE public.org_payment_accounts ADD CONSTRAINT org_payment_accounts_card_payments_status_chk
  CHECK (card_payments_status IS NULL OR card_payments_status IN ('active', 'pending', 'restricted', 'unsupported'));

COMMENT ON COLUMN public.org_payment_accounts.card_payments_status IS
  'Stripe v2: configuration.merchant.capabilities.card_payments.status, copied on each sync. NULL until the first sync. A pay page opens only while active.';
COMMENT ON COLUMN public.org_payment_accounts.card_payments_reason IS
  'Stripe v2: the card_payments capability''s first status_details code (e.g. requirements_past_due, requirements_pending_verification). NULL while active.';
COMMENT ON COLUMN public.org_payment_accounts.onboarding_finished_at IS
  'When Stripe''s sign-up was first seen finished. Set once, never cleared (v1 details_submitted''s successor).';

COMMIT;
