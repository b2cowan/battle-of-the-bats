-- ---------------------------------------------------------------
-- Migration 386 — Club Tier Stage 12c Part 5: a club's Stripe account says whether it takes bank debit, and a sibling not
-- on a clearing debit may still pay.
-- Plan: docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md §0i, §0j, §0k.
--
-- WHY: the pay block offers "Pay by bank debit" beside the card only while the club's connected account can take a
-- Canadian pre-authorized debit (Stripe's `acss_debit_payments` capability). Like `card_payments_status` (mig 364) it is
-- Stripe's fact, re-read on every account event and never typed. A club whose account does not take it reads today's pay
-- block word for word.
--
-- WHAT CHANGES: org_payment_accounts.bank_debit_status (active | pending | restricted | unsupported; NULL = not read, or not
-- requested yet). Written only by the account sync.
--
-- ALSO (corrects mig 382): online_payments_one_open_per_signup covers OPEN pages only. Mig 382 held a whole sign-up while
-- any of its debits cleared, which refused the words' "a child on the sign-up who is not on the debit keeps the buttons"
-- (copy §2.2 famPay.lineClearing). Paying twice for one child stays impossible: online_payment_league_open refuses a
-- child already in an open or clearing payment (mig 382), and the pay route leaves a clearing child out of the total.
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.org_payment_accounts ADD COLUMN IF NOT EXISTS bank_debit_status text;
ALTER TABLE public.org_payment_accounts DROP CONSTRAINT IF EXISTS org_payment_accounts_bank_debit_status_chk;
ALTER TABLE public.org_payment_accounts ADD CONSTRAINT org_payment_accounts_bank_debit_status_chk
  CHECK (bank_debit_status IS NULL OR bank_debit_status IN ('active', 'pending', 'restricted', 'unsupported'));

DROP INDEX IF EXISTS public.online_payments_one_open_per_signup;
CREATE UNIQUE INDEX online_payments_one_open_per_signup ON public.online_payments(season_id, signup_key)
  WHERE status = 'open' AND flow = 'league_signup' AND season_id IS NOT NULL;

COMMIT;
