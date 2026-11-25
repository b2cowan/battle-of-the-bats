-- 537 — The saved payment method "E-Transfer" takes the one spelling, "E-transfer" (Board Ready Stage 6 Part 4b).
--
-- Owner ruling 2026-11-22 (sponsorships round 2, ask 6): "'e-transfer' in a sentence, 'E-transfer' at the start of a
-- label or sentence; the other two spellings go, including the stored ledger method name". The data change was approved
-- 2026-11-25 ("yes to the spelling change") after counts: production 3 team expenses; dev ledger entries, team expenses
-- and one payment request.
--
-- DATA ONLY. No table, column, constraint or function changes. It rewrites ONLY the two wrong spellings at the START of
-- a saved method, keeping everything the person typed after it ("E-Transfer 4471" -> "E-transfer 4471"). Other words,
-- other columns (reasons, notes, sent notices) and an all-lowercase "e-transfer" are left as typed.
--
-- A club ledger line dated in a CLOSED fiscal year is left as it is: the books lock (accounting_entries_fiscal_lock)
-- refuses any edit there, and this migration does not go round it.
--
-- ORDER: after the code that writes the new spelling is serving. The earlier code still writes "E-Transfer", so a run
-- before it would leave new rows behind. Re-runnable: a second run finds nothing to change.

BEGIN;

UPDATE public.accounting_entries e
   SET payment_method = 'E-transfer' || substr(e.payment_method, 11)
 WHERE e.payment_method ~ '^(E-Transfer|e-Transfer)'
   AND NOT EXISTS (
     SELECT 1 FROM public.accounting_ledgers l
      WHERE l.id = e.ledger_id AND l.entity_type IN ('org', 'tournament', 'league_season')
        AND e.entry_date <= public.club_books_closed_through(l.org_id));

UPDATE public.rep_team_expenses
   SET payment_method = 'E-transfer' || substr(payment_method, 11)
 WHERE payment_method ~ '^(E-Transfer|e-Transfer)';

UPDATE public.rep_team_payment_requests
   SET payment_method = 'E-transfer' || substr(payment_method, 11)
 WHERE payment_method ~ '^(E-Transfer|e-Transfer)';

-- A bill's payments copy the bill's method word (free text, mig 255; /review 2026-11-25).
UPDATE public.rep_payable_payments
   SET method = 'E-transfer' || substr(method, 11)
 WHERE method ~ '^(E-Transfer|e-Transfer)';

COMMIT;
