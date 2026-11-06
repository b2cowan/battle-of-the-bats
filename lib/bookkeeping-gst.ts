/**
 * GST/HST on what we buy (GST/HST Stage 4a): the input tax credit rules, the legacy mapping, the
 * $100 documentation tier, the supplier prefill and every sentence the form, record and register say.
 * Pure: no store, no clock. The credit is worked out on read and never stored, because it changes
 * when the registration date changes (a 4b filed snapshot is the only stored figure, later).
 *
 * Rules: CRA "ITC eligibility percentage" (2026-02-03), Memo 8-5 (June 2026), CRA simplified registry;
 * docs/agents/accounting/GST_HST_RETURN_LINES.md §3–§4 and ITC_RULES_FOR_EXPENSE_FORM.md (2026-11-06).
 * Cases and wording: GST_HST_STAGE4_DRAWINGS.html tab 2, "What the credit sentence says, case by case".
 */
import { formatStoredDate } from './timezone';

export const TAX_TYPES = {
  gst5: { label: 'GST 5%', rate: 5, gstHst: 'GST' },
  hst13: { label: 'HST 13%', rate: 13, gstHst: 'HST' },
  hst14: { label: 'HST 14%', rate: 14, gstHst: 'HST' },
  hst15: { label: 'HST 15%', rate: 15, gstHst: 'HST' },
  pst: { label: 'PST', rate: null, gstHst: null },
  qst: { label: 'QST', rate: null, gstHst: null },
  other: { label: 'Other tax', rate: null, gstHst: null },
  /** Only an expense saved before 4a: one amount with no type. Never offered as a choice. */
  unset: { label: 'Type not set', rate: null, gstHst: null },
} as const satisfies Record<string, { label: string; rate: number | null; gstHst: 'GST' | 'HST' | null }>;
export type TaxType = keyof typeof TAX_TYPES;
export type TaxLine = { type: TaxType; cents: number };
/** The form's type list: everything a person can pick. "Choose a type" stands in for `unset`. */
export const CHOOSABLE_TAX_TYPES = (Object.keys(TAX_TYPES) as TaxType[]).filter(type => type !== 'unset');
export const UNSET_TYPE_PROMPT = 'Choose a type';

export const TAX_ANSWERS = { unknown: 'Not sure yet', none: 'No tax charged', shown: 'Shown on the receipt' } as const;
export type TaxAnswer = keyof typeof TAX_ANSWERS;

export const SUPPLIER_REGISTRATIONS = {
  normal: 'Registered the usual way',
  simplified: 'Simplified (foreign online seller)',
  not_registered: 'Not registered',
  not_checked: 'Not checked',
} as const;
export type SupplierRegistration = keyof typeof SUPPLIER_REGISTRATIONS;

export const PURCHASE_KINDS = { operating: 'Everyday cost', capital: 'Equipment you keep', meal: 'Meal or entertainment' } as const;
export type PurchaseKind = keyof typeof PURCHASE_KINDS;

/** CRA's middle documentation tier: from a $100 invoice total (tax included), the supplier's number is needed. */
export const NUMBER_NEEDED_FROM_CENTS = 10_000;
export const NUMBER_HINT_SAME_AS_LAST = (supplier: string) => `Same as your last ${supplier} expense.`;
export const NUMBER_HINT_BLANK = 'You can save without it. It shows in Needs attention.';
export const NUMBER_NOT_NEEDED = 'Not needed under $100';
export const REGISTRATION_HINT = 'Foreign online services are often on CRA’s simplified list.';
export const CANT_GET_NUMBER = 'I can’t get the number: don’t claim this credit';
export const NUMBER_MISSING_REASON = 'GST/HST number missing';
export const HELD_RECORD_NOTE = 'Held until the number is added';

export const isTaxType = (value: unknown): value is TaxType => typeof value === 'string' && Object.hasOwn(TAX_TYPES, value);
export const isTaxAnswer = (value: unknown): value is TaxAnswer => typeof value === 'string' && Object.hasOwn(TAX_ANSWERS, value);
export const isSupplierRegistration = (value: unknown): value is SupplierRegistration =>
  typeof value === 'string' && Object.hasOwn(SUPPLIER_REGISTRATIONS, value);
export const isPurchaseKind = (value: unknown): value is PurchaseKind => typeof value === 'string' && Object.hasOwn(PURCHASE_KINDS, value);

const formatCad = (cents: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
/** Half up, positive integers only: the one rounding step, applied to the final credit. */
const roundHalfUp = (numerator: number, denominator: number) => Math.floor((2 * numerator + denominator) / (2 * denominator));

/** Ruling 8: Equipment & supplies starts as Equipment you keep; everything else (Travel & meals too: a taxi is not a meal) as Everyday cost. */
export function defaultPurchaseKind(category: string): PurchaseKind {
  return category.trim() === 'Equipment & supplies' ? 'capital' : 'operating';
}

/** “Work out from the total”: the tax inside a tax-included total, total × rate ÷ (100 + rate), to the cent. */
export function taxFromTotal(totalCents: number, ratePercent: number): number {
  return roundHalfUp(totalCents * ratePercent, 100 + ratePercent);
}

export function sumTaxLines(lines: readonly TaxLine[]): number {
  return lines.reduce((total, line) => total + line.cents, 0);
}

/** The sum rule: a revision's lines add up to its tax_cad_cents, so every reader of the single amount stays right. */
export function taxLinesMatchTotal(lines: readonly TaxLine[], taxCadCents: number): boolean {
  return lines.every(line => isTaxType(line.type) && Number.isSafeInteger(line.cents) && line.cents > 0) &&
    sumTaxLines(lines) === taxCadCents;
}

type TaxFacts = {
  tax_cad_cents: number;
  tax_amount_known?: boolean | null;
  tax_status: 'pending' | 'none' | 'reviewed';
  tax_answer?: TaxAnswer | null;
};

/**
 * The tax answer and lines of a revision. A revision saved from 4a on carries its own answer and lines.
 * One saved before 4a (tax_answer NULL) is mapped so nothing old changes meaning: unknown → Not sure yet;
 * known with no tax (status none, or $0) → No tax charged; known with an amount → Shown on the receipt
 * with ONE line of type “Type not set”. The legacy “known” rule is dictionary :7869 (hasKnownTaxAmount).
 */
export function resolveTaxState(row: TaxFacts, storedLines: readonly TaxLine[] = []): { answer: TaxAnswer; lines: TaxLine[]; legacy: boolean } {
  if (row.tax_answer) return { answer: row.tax_answer, lines: row.tax_answer === 'shown' ? [...storedLines] : [], legacy: false };
  const known = row.tax_amount_known ?? (row.tax_status !== 'pending' || row.tax_cad_cents > 0);
  if (!known) return { answer: 'unknown', lines: [], legacy: true };
  if (row.tax_status === 'none' || row.tax_cad_cents === 0) return { answer: 'none', lines: [], legacy: true };
  return { answer: 'shown', lines: [{ type: 'unset', cents: row.tax_cad_cents }], legacy: true };
}

export type CreditInput = {
  lines: readonly TaxLine[];
  kind: PurchaseKind;
  businessUsePercent: number;
  /** The receipt total in CAD, tax included: the documentation tier reads it. */
  receiptTotalCents: number;
  /** Incurred date (YYYY-MM-DD); a legacy revision passes its recorded expense date. */
  incurredDate: string;
  registration: SupplierRegistration;
  hasNumber: boolean;
  numberUnobtainable: boolean;
  /** The current GST/HST registration effective date (YYYY-MM-DD). */
  registrationDate: string;
  supplier: string;
};

export type CreditState =
  | 'no_tax'               // no tax lines at all
  | 'not_gst_hst'          // only PST / QST / Other: part of the cost, never on this return
  | 'type_not_set'         // a pre-4a amount whose type was never chosen
  | 'not_claimable'        // simplified registration, or a supplier marked Not registered
  | 'before_registration'  // bought before the registration date
  | 'no_credit'            // the business-use rule gives nothing
  | 'held'                 // worked out, but waiting for the supplier's number (receipt of $100 or more)
  | 'not_claimed'          // the owner chose not to claim it (“I can’t get the number”)
  | 'counted';

export type Credit = {
  /** The worked-out credit. Only `counted` reaches the return; `held` shows the figure it is waiting to count. */
  creditCents: number;
  state: CreditState;
  countsOnReturn: boolean;
  /** “Not checked” is counted, and listed before filing (4b). */
  registrationUnchecked: boolean;
  tone: 'neutral' | 'amber';
  /** What follows “Credit on your GST/HST return:”, or the record cell's figure. */
  figure: string | null;
  /** The reason, in one sentence (sometimes two). Never shown without the figure. */
  sentence: string | null;
};

function taxWord(lines: readonly TaxLine[]): 'GST' | 'HST' | 'GST/HST' {
  const words = new Set(lines.map(line => TAX_TYPES[line.type].gstHst).filter(Boolean));
  return words.size === 1 ? [...words][0]! : 'GST/HST';
}

function notOnReturnSentence(lines: readonly TaxLine[]): string | null {
  const names = [...new Set(lines.filter(line => !TAX_TYPES[line.type].gstHst && line.type !== 'unset').map(line => line.type))];
  if (!names.length) return null;
  if (names.length === 1 && names[0] !== 'other') return `${TAX_TYPES[names[0]].label} isn’t claimed on this return; it stays part of the cost.`;
  return names.length === 1 ? 'This tax isn’t claimed on this return; it stays part of the cost.'
    : 'These taxes aren’t claimed on this return; they stay part of the cost.';
}

/** The business-use rule for one kind: [numerator, denominator] of the tax that is the credit, and why. */
function businessUseRule(kind: PurchaseKind, use: number, word: string): { share: [number, number]; sentence: string } {
  if (kind === 'capital') {
    return use > 50
      ? { share: [1, 1], sentence: `All of the ${word}, because equipment used more than 50% for the business gets the full credit.` }
      : { share: [0, 1], sentence: 'Equipment used 50% or less for the business gets no credit.' };
  }
  if (use <= 10) return { share: [0, 1], sentence: 'Business use of 10% or less gets no credit.' };
  if (kind === 'meal') {
    return use >= 90
      ? { share: [1, 2], sentence: `Half of the ${word}. Meals and entertainment get half.` }
      : { share: [use, 200], sentence: `Half of ${use}% of the ${word}, because business use is ${use}%. Meals and entertainment get half.` };
  }
  return use >= 90
    ? { share: [1, 1], sentence: `All of the ${word}, because business use is 90% or more.` }
    : { share: [use, 100], sentence: `${use}% of the ${word}, because business use is ${use}%.` };
}

const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(' ') || null;

export function workOutCredit(input: CreditInput): Credit {
  const base = { creditCents: 0, countsOnReturn: false, registrationUnchecked: false };
  const say = (state: CreditState, tone: Credit['tone'], figure: string | null, sentence: string | null): Credit =>
    ({ ...base, state, tone, figure, sentence });
  const lines = input.lines.filter(line => line.cents > 0);
  if (!lines.length) return say('no_tax', 'neutral', null, null);
  if (lines.some(line => line.type === 'unset')) return say('type_not_set', 'amber', 'Choose the tax type', null);
  const claimable = lines.filter(line => TAX_TYPES[line.type].gstHst);
  const elsewhere = notOnReturnSentence(lines);
  if (!claimable.length) return say('not_gst_hst', 'neutral', 'No credit', elsewhere);

  const word = taxWord(claimable);
  const taxCents = sumTaxLines(claimable);
  if (input.registration === 'simplified') {
    return say('not_claimable', 'amber', 'No credit',
      `${input.supplier} charged ${word} under CRA’s simplified registration, which can’t be claimed on your return. ` +
      `Give ${input.supplier} your GST/HST number (usually in its billing settings) so it stops charging it, and ask for a refund of the ${formatCad(taxCents)}. ` +
      'If you get one, correct this expense: remove the tax line and lower the amount by the refund.');
  }
  if (input.registration === 'not_registered') {
    return say('not_claimable', 'amber', 'No credit',
      `${input.supplier} is marked as not registered for GST/HST, so the ${word} it charged can’t be claimed. Check its number on CRA’s registry, or ask it for a refund.`);
  }
  if (input.incurredDate < input.registrationDate) {
    const began = `Bought before your GST/HST registration began on ${formatStoredDate(input.registrationDate, { longMonth: true })}.`;
    return say('before_registration', 'neutral', 'No credit', input.kind === 'capital'
      ? `${began} Equipment you still used for the business on that date may qualify for a credit based on its value then. It isn’t counted here; ask your accountant.`
      : `${began} If it paid for time after that date, such as a yearly plan, that part may be claimed. Ask your accountant.`);
  }

  const rule = businessUseRule(input.kind, input.businessUsePercent, word);
  const creditCents = roundHalfUp(taxCents * rule.share[0], rule.share[1]);
  if (creditCents === 0) return say('no_credit', 'neutral', 'No credit', join(rule.sentence, elsewhere));
  const figure = formatCad(creditCents);
  if (!input.hasNumber && input.receiptTotalCents >= NUMBER_NEEDED_FROM_CENTS) {
    if (input.numberUnobtainable) return say('not_claimed', 'neutral', 'Not claimed', 'You chose not to claim this credit.');
    return { ...say('held', 'amber', figure,
      'Waiting for the supplier’s number. Receipts of $100 or more need it, so this stays off the worksheet until it’s added.'), creditCents };
  }
  const unchecked = input.registration === 'not_checked';
  return {
    creditCents, state: 'counted', countsOnReturn: true, registrationUnchecked: unchecked, tone: 'neutral', figure,
    sentence: unchecked ? 'Counted for now. Check the supplier’s registration before you file.' : join(rule.sentence, elsewhere),
  };
}

/** The saved facts of one expense revision that its credit reads (structurally an ExpenseRevision). */
export type CreditRow = TaxFacts & {
  tax_lines?: readonly TaxLine[];
  category: string; business_use_percent: number; cad_cents: number;
  incurred_date?: string | null; expense_date: string; supplier: string;
  supplier_registration?: SupplierRegistration | null; supplier_tax_number?: string | null;
  number_unobtainable?: boolean | null; purchase_kind?: PurchaseKind | null;
};

/**
 * The credit of a saved revision, worked out on read. Older revisions go through resolveTaxState; a registration
 * never stated reads as Not checked, and a kind never stated starts from the category (ruling 8). Null when no
 * registration date is on record (storage before migration 006), because no credit can be worked out without it.
 */
export function expenseCredit(row: CreditRow, registrationDate: string | null): Credit | null {
  if (!registrationDate) return null;
  return workOutCredit({
    lines: resolveTaxState(row, row.tax_lines ?? []).lines,
    kind: row.purchase_kind ?? defaultPurchaseKind(row.category),
    businessUsePercent: row.business_use_percent,
    receiptTotalCents: row.cad_cents,
    incurredDate: row.incurred_date ?? row.expense_date,
    registration: row.supplier_registration ?? 'not_checked',
    hasNumber: Boolean(row.supplier_tax_number?.trim()),
    numberUnobtainable: Boolean(row.number_unobtainable),
    registrationDate,
    supplier: row.supplier,
  });
}

/** The register's fifth reason: a credit that would count but waits on the supplier's number. */
export function needsSupplierNumber(credit: Credit): boolean {
  return credit.state === 'held';
}

/** The current registration effective date: the highest revision. */
export function currentRegistrationDate(revisions: readonly { revision: number; effective_date: string }[]): string | null {
  return revisions.reduce<{ revision: number; effective_date: string } | null>(
    (latest, row) => (!latest || row.revision > latest.revision ? row : latest), null)?.effective_date ?? null;
}

/** Ruling 6: exactly the same supplier name, ignoring case and the spaces at either end. */
export function sameSupplier(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('en-CA') === b.trim().toLocaleLowerCase('en-CA');
}

type PrefillRow = {
  supplier: string; void_reason: string | null; incurred_date?: string | null; expense_date: string; created_at: string;
  supplier_registration?: SupplierRegistration | null; supplier_tax_number?: string | null;
};

/**
 * The number and registration from the latest active expense with the same supplier name. Pass current
 * revisions (one per expense). Only an expense saved since 4a can say anything, so older ones are skipped.
 */
export function supplierPrefill(rows: readonly PrefillRow[], supplier: string): { registration: SupplierRegistration; number: string | null } | null {
  if (!supplier.trim()) return null;
  const last = rows
    .filter(row => !row.void_reason && row.supplier_registration && sameSupplier(row.supplier, supplier))
    .sort((a, b) => (b.incurred_date ?? b.expense_date).localeCompare(a.incurred_date ?? a.expense_date) || b.created_at.localeCompare(a.created_at))[0];
  return last ? { registration: last.supplier_registration!, number: last.supplier_tax_number?.trim() || null } : null;
}
