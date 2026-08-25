-- 260: 'card' joins the dues methods — the one-method-list ruling lands (owner, 2026-08-22,
-- money centralization P1 gate; COACH_MONEY_CENTRALIZATION_BUILD_PROMPT.md §2.1).
--
-- The product asked "how was this paid?" in three vocabularies: free text on expenses/payables,
-- a four-token enum here (no 'card' — mig 232), and a five-option list on club payment requests.
-- The ruling: ONE five-option list product-wide (E-Transfer · Cash · Cheque · Card · Other),
-- with free text surviving only under the expenses combobox. Dues was the list that could not
-- say 'card'; this closes that gap.
--
-- ⚠ Payments and payouts SHARE DuesPaymentMethod (lib/types.ts), so both CHECKs move together —
-- widening one and not the other would let the type compile against a constraint that refuses it.
-- Existing rows are untouched: the list only widens.

ALTER TABLE rep_dues_payments DROP CONSTRAINT rep_dues_payments_method_check;
ALTER TABLE rep_dues_payments ADD CONSTRAINT rep_dues_payments_method_check
  CHECK (method = ANY (ARRAY['etransfer'::text, 'cash'::text, 'cheque'::text, 'card'::text, 'other'::text]));

ALTER TABLE rep_dues_payouts DROP CONSTRAINT rep_dues_payouts_method_check;
ALTER TABLE rep_dues_payouts ADD CONSTRAINT rep_dues_payouts_method_check
  CHECK (method = ANY (ARRAY['etransfer'::text, 'cash'::text, 'cheque'::text, 'card'::text, 'other'::text]));
