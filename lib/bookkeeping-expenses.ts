export type TaxStatus = 'pending' | 'none' | 'reviewed';
export type PaymentSource = 'business_bank' | 'business_card' | 'personal' | 'other';
export type ExpenseRevision = {
  expense_id: string;
  revision: number;
  /** Original single date kept for legacy revisions and export history. New revisions set it to incurred_date. */
  expense_date: string;
  incurred_date?: string | null;
  paid_date?: string | null;
  supplier: string;
  category: string;
  business_purpose: string;
  original_currency: 'CAD' | 'USD';
  original_cents: number;
  cad_cents: number;
  tax_cad_cents: number;
  tax_amount_known?: boolean | null;
  tax_status: TaxStatus;
  business_use_percent: number;
  payment_source: PaymentSource;
  conversion_note: string | null;
  notes: string | null;
  change_reason: string | null;
  receipt_path: string | null;
  receipt_name: string | null;
  void_reason: string | null;
  created_at: string;
  created_by: string;
};

export function currentExpenses(rows: ExpenseRevision[]): ExpenseRevision[] {
  const current = new Map<string, ExpenseRevision>();
  for (const row of rows) {
    if ((current.get(row.expense_id)?.revision ?? 0) < row.revision) current.set(row.expense_id, row);
  }
  return [...current.values()].sort((a, b) =>
    (b.incurred_date ?? b.expense_date).localeCompare(a.incurred_date ?? a.expense_date) ||
    a.expense_id.localeCompare(b.expense_id));
}

export function hasConfirmedDates(row: ExpenseRevision): boolean {
  return isExpenseDate(row.incurred_date) && isExpenseDate(row.paid_date);
}

/** Before this field existed, pending/zero could mean unknown; other legacy values were explicit. */
export function hasKnownTaxAmount(row: ExpenseRevision): boolean {
  return row.tax_amount_known ?? (row.tax_status !== 'pending' || row.tax_cad_cents > 0);
}

/** The server keeps storage paths; the browser only needs to know whether a file exists. */
export function redactExpenseRevision(row: ExpenseRevision): ExpenseRevision {
  return { ...row, receipt_path: row.receipt_path ? '[private]' : null };
}

export function businessCents(row: ExpenseRevision): number {
  return Math.floor((row.cad_cents * row.business_use_percent + 50) / 100);
}

export function hasValidConversionEvidence(note: string | null): boolean {
  if (!note) return false;
  const dateMatch = note.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (!dateMatch || !isExpenseDate(dateMatch[1])) return false;
  const generic = new Set(['rate', 'rates', 'exchange', 'conversion', 'converted', 'source', 'date', 'usd', 'cad', 'fx', 'invoice']);
  const sourceWords = note.replace(dateMatch[1], '').match(/[A-Za-z0-9]{3,}/g) ?? [];
  return sourceWords.some(word => !generic.has(word.toLowerCase()));
}

export type ReviewFilter = 'all' | 'missing_receipt' | 'missing_conversion' | 'personal' | 'foreign';

export function matchesReviewFilter(row: ExpenseRevision, filter: ReviewFilter): boolean {
  if (row.void_reason) return filter === 'all';
  switch (filter) {
    case 'missing_receipt': return !row.receipt_path;
    case 'missing_conversion': return row.original_currency === 'USD' && !hasValidConversionEvidence(row.conversion_note);
    case 'personal': return row.payment_source === 'personal';
    case 'foreign': return row.original_currency === 'USD';
    default: return true;
  }
}

export function summarizeExpenses(rows: ExpenseRevision[]) {
  const active = currentExpenses(rows).filter(row => !row.void_reason);
  const byCategory = new Map<string, number>();
  const bySupplier = new Map<string, number>();
  let recordedSpendCents = 0;
  let pendingTaxCents = 0;
  const taxByStatus = new Map<TaxStatus, number>([['pending', 0], ['reviewed', 0], ['none', 0]]);
  const byPaymentSource = new Map<PaymentSource, number>();
  for (const row of active) {
    const amount = businessCents(row);
    recordedSpendCents += amount;
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + amount);
    bySupplier.set(row.supplier, (bySupplier.get(row.supplier) ?? 0) + amount);
    const taxAmount = Math.floor((row.tax_cad_cents * row.business_use_percent + 50) / 100);
    taxByStatus.set(row.tax_status, (taxByStatus.get(row.tax_status) ?? 0) + taxAmount);
    if (row.tax_status === 'pending' && hasKnownTaxAmount(row)) pendingTaxCents += taxAmount;
    byPaymentSource.set(row.payment_source, (byPaymentSource.get(row.payment_source) ?? 0) + amount);
  }
  return {
    count: active.length, recordedSpendCents, pendingTaxCents,
    byCategory: [...byCategory].sort(([a], [b]) => a.localeCompare(b)),
    bySupplier: [...bySupplier].sort(([a], [b]) => a.localeCompare(b)),
    unknownTaxCount: active.filter(row => !hasKnownTaxAmount(row)).length,
    taxByStatus: [...taxByStatus], byPaymentSource: [...byPaymentSource].sort(([a], [b]) => a.localeCompare(b)),
    missingReceiptCount: active.filter(row => !row.receipt_path).length,
    missingConversionCount: active.filter(row => row.original_currency === 'USD' && !hasValidConversionEvidence(row.conversion_note)).length,
    personallyPaidCents: byPaymentSource.get('personal') ?? 0,
  };
}

/** Accepts "1200.00", "1,200.00" and "$1,200.00". A comma that is not a thousands separator ("12,50") is refused as ambiguous. */
export function parseCents(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  let text = value.trim();
  if (text.startsWith('$')) text = text.slice(1);
  if (/^[1-9]\d{0,2}(,\d{3})+(\.\d{1,2})?$/.test(text)) text = text.replaceAll(',', '');
  if (!/^(0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(text)) return null;
  const [dollars, cents = ''] = text.split('.');
  const result = Number(dollars) * 100 + Number(cents.padEnd(2, '0'));
  return Number.isSafeInteger(result) ? result : null;
}

/** An expense or owner-transfer id: a version 1–8 UUID, which is what crypto.randomUUID() makes. */
export function isRecordId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** The request proxy keeps only the first 10 MiB of a body, and the form's other fields and multipart framing ride
 * in that same body, so a receipt must leave room for them or it arrives cut off. */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024 - 64 * 1024;
export const RECEIPT_MESSAGE = 'Receipt must be a PDF, JPEG or PNG under 10 MB.';
export const RECEIPT_NAME_MESSAGE = 'Rename the receipt file to 180 characters or fewer.';
export const RECEIPT_EMPTY_MESSAGE = 'This receipt file is empty. Choose the file again.';
export const CONVERSION_NOTE_HINT = "Say where the rate came from and its date, like 'Card statement 2026-10-16'.";
export const FUTURE_DATE_NOTE = 'This date is in the future. Check it before saving.';

/** The refusal for an amount field: null is unreadable, 0 is too small. */
export function amountMessage(cents: number | null): string | null {
  if (cents === null) return 'Use numbers like 1200.00.';
  if (cents === 0) return 'Enter an amount above $0.00.';
  return null;
}

/** A refusal that names the form field it belongs to, so the page can show it at Save and move focus there. */
export type FieldRefusal = { error: string; field?: string };

export type ExpenseFieldInput = {
  incurredDate: string | null; paidDate: string | null; voidingLegacy: boolean;
  supplier: string | null; category: string | null; businessPurpose: string | null;
  originalCurrency: string | null; originalCents: number | null; cadCents: number | null; taxCents: number | null;
  taxAmountKnown: string | null; taxStatus: string | null; businessUse: number; paymentSource: string | null;
  conversionNote: string | null; hasConversionNote: boolean; notes: string | null; hasNotes: boolean;
  isCorrection: boolean; changeReason: string | null; isVoid: boolean; voidReason: string | null;
};

const TAX_STATUSES: TaxStatus[] = ['pending', 'none', 'reviewed'];
const PAYMENT_SOURCES: PaymentSource[] = ['business_bank', 'business_card', 'personal', 'other'];

/** The expense form's checks, in the form's top-to-bottom order; the first one that fails is the one reported. */
export function validateExpenseFields(input: ExpenseFieldInput): FieldRefusal | null {
  const cad = input.originalCurrency === 'CAD';
  if (!input.voidingLegacy && !isExpenseDate(input.incurredDate)) return { field: 'incurredDate', error: 'Enter the expense date.' };
  if (!input.voidingLegacy && !isExpenseDate(input.paidDate)) return { field: 'paidDate', error: 'Enter the payment date.' };
  if (!input.supplier) return { field: 'supplier', error: 'Enter the supplier.' };
  if (!input.category) return { field: 'category', error: 'Choose a category.' };
  if (!input.businessPurpose) return { field: 'businessPurpose', error: 'Say what the purchase was for.' };
  if (!cad && input.originalCurrency !== 'USD') return { field: 'originalCurrency', error: 'Choose CAD or USD.' };
  const original = amountMessage(input.originalCents);
  if (original) return { field: 'originalAmount', error: original };
  const converted = amountMessage(input.cadCents);
  if (converted) return { field: cad ? 'originalAmount' : 'cadAmount', error: converted };
  if (cad && input.originalCents !== input.cadCents) return { field: 'originalAmount', error: 'A CAD purchase has one amount.' };
  if (input.hasConversionNote && input.conversionNote === null) return { field: 'conversionNote', error: 'Keep the conversion note to 500 characters.' };
  if (!cad && !hasValidConversionEvidence(input.conversionNote)) return { field: 'conversionNote', error: CONVERSION_NOTE_HINT };
  if (!PAYMENT_SOURCES.includes(input.paymentSource as PaymentSource)) return { field: 'paymentSource', error: 'Choose how you paid.' };
  if (!['true', 'false'].includes(input.taxAmountKnown ?? '')) return { error: 'Reload the page and try again.' };
  if (input.taxCents === null) return { field: 'taxCadAmount', error: 'Use numbers like 1200.00.' };
  if (input.taxCents > input.cadCents!) return { field: 'taxCadAmount', error: "Purchase tax can't be more than the amount." };
  if (input.taxAmountKnown === 'false' && (input.taxCents !== 0 || input.taxStatus !== 'pending')) return { error: 'Reload the page and try again.' };
  if (!TAX_STATUSES.includes(input.taxStatus as TaxStatus)) return { field: 'taxStatus', error: 'Choose a tax review status.' };
  if (input.taxStatus === 'none' && input.taxCents !== 0) return { field: 'taxCadAmount', error: 'No tax recorded means a tax amount of $0.00.' };
  if (!Number.isInteger(input.businessUse) || input.businessUse < 1 || input.businessUse > 100) return { field: 'businessUsePercent', error: 'Enter a business use from 1 to 100.' };
  if (input.hasNotes && input.notes === null) return { field: 'notes', error: 'Keep the notes to 2,000 characters.' };
  if (input.isVoid && !input.voidReason) return { field: 'voidReason', error: 'Say why this expense should leave the report.' };
  if (input.isCorrection && !input.changeReason) return { field: input.isVoid ? 'voidReason' : 'changeReason', error: 'Say what changed and why.' };
  return null;
}

export function isExpenseDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function csvCell(value: unknown): string {
  const raw = String(value ?? '');
  // Spreadsheet apps execute cells beginning with these characters.
  const safe = /^[\s]*[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
