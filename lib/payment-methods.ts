// How money moved — the small controlled vocabulary behind the "Payment method" field.
//
// Owner review 2026-08-15 (Q5). Payment method was raw free text everywhere it appeared: coach
// expenses, payables, payment requests and the club ledger. Nothing deduped it and nothing offered
// a past value, so one club accumulated "E-transfer", "etransfer" and "e transfer" as three
// unrelated strings — and the field already flows into the payment-requests export and the club
// ledger, so downstream reporting was reading a dirty column long before anyone asked it to.
//
// It was also the ONLY free-text field left in its own form: beside it, Category is a structured
// picker off the budget taxonomy, Payee is a search-past-or-add combobox, and Tags is a
// search-past-or-create combobox. This module makes the fourth field behave like its neighbours.
//
// ⚠ THE SEED LIST IS THE WHOLE POINT — do not "simplify" it away to a learn-only list. A list that
// only learns canonicalises on WHATEVER THE FIRST PERSON TYPED: the first coach to enter
// "etransfer" makes it the entry every later coach picks from, and the club standardises cleanly on
// the wrong spelling. Shipping the common cases already correct is what makes day one work.
//
// Free text is still accepted, deliberately. A club paying by money order or an internal transfer
// name we've never heard of must not be blocked by our vocabulary — the combobox commits an
// unlisted value on an explicit action, and it joins the club's list from then on.

/**
 * The methods every Canadian club is assumed to use, in the casing we standardise on.
 *
 * ⚠ THE CASING HERE IS NOT A FRESH CHOICE — it matches the list the Payment requests form has
 * always shown ('Cash', 'E-Transfer', 'Cheque', … 'Other'). Inventing a tidier "E-transfer" here
 * would have made this the FOURTH payment-method vocabulary in the product and added the exact
 * spelling split this module exists to prevent. The other three, found 2026-08-15:
 *   1. Payment requests — a local list in its panel, shown as a closed <select>.
 *   2. Dues payments    — DUES_PAYMENT_METHODS in lib/types.ts, lowercase STORED codes
 *                         ('etransfer'), validated server-side.
 *   3. Expenses, payables and the club ledger — free text, which is what brought us here.
 * Unifying all three is a vocabulary decision across surfaces (and, for dues, a stored-value
 * migration), not something this pass should do quietly. Raised with the owner instead.
 *
 * 'Credit card' and 'Debit' are split where Payment requests says only 'Card' — a club reconciling
 * a bank statement cares which, and nothing reads the old value as an enum.
 */
export const SEEDED_PAYMENT_METHODS = [
  'E-Transfer',
  'Cash',
  'Cheque',
  'Credit card',
  'Debit',
  'Bank transfer',
  'Other',
] as const;

export interface PaymentMethodOption {
  /** Display name. A used value matching a seed is shown in the SEED's casing, not the typed one. */
  name: string;
  /** How many records in this club already use it. 0 = offered but never used. */
  count: number;
  /** Is this one of ours, rather than something the club invented? */
  seeded: boolean;
}

/**
 * The club's method list: what it already uses, most-used first, then the seeds it hasn't touched.
 *
 * Grouping is case-insensitive, so "E-transfer" and "e-transfer" collapse into one option carrying
 * the combined count. Where that group matches a seed, the seed's casing wins the display — which
 * is how a club that has only ever typed "e-transfer" is quietly shown "E-transfer" to pick from
 * next time, without anything being rewritten behind them.
 *
 * ⚠ It does NOT merge different SPELLINGS ("e transfer" vs "e-transfer" stay separate). Cleaning up
 * history is a different job — see the note on this function's caller — and guessing that two
 * strings mean the same method is exactly the kind of silent rewrite a money field must not do.
 */
export function mergePaymentMethods(used: { name: string; count: number }[]): PaymentMethodOption[] {
  const seedByKey = new Map<string, string>(
    SEEDED_PAYMENT_METHODS.map(s => [s.toLowerCase(), s as string]),
  );

  const merged = new Map<string, PaymentMethodOption>();
  for (const entry of used) {
    const name = entry.name?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = merged.get(key);
    if (existing) {
      existing.count += entry.count;
      continue;
    }
    const seed = seedByKey.get(key);
    merged.set(key, { name: seed ?? name, count: entry.count, seeded: Boolean(seed) });
  }

  const usedOptions = [...merged.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
  const unusedSeeds: PaymentMethodOption[] = SEEDED_PAYMENT_METHODS
    .filter(s => !merged.has(s.toLowerCase()))
    .map(s => ({ name: s, count: 0, seeded: true }));

  return [...usedOptions, ...unusedSeeds];
}
