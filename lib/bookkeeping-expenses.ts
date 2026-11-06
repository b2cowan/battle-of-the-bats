import {
  expenseCredit, isPurchaseKind, isSupplierRegistration, isTaxAnswer, isTaxType, needsSupplierNumber, NUMBER_MISSING_REASON,
  resolveTaxState, taxLinesMatchTotal,
  type PurchaseKind, type SupplierRegistration, type TaxAnswer, type TaxLine,
} from './bookkeeping-gst';

export type TaxStatus = 'pending' | 'none' | 'reviewed';
export type PaymentSource = 'business_bank' | 'business_card' | 'personal' | 'other';
export const CONVERSION_SOURCES = {
  card_statement: 'Card statement', bank_statement: 'Bank statement',
  bank_of_canada: 'Bank of Canada rate', invoice_cad: 'Invoice shows CAD',
} as const;
export type ConversionSource = keyof typeof CONVERSION_SOURCES;
export const CONVERSION_SOURCE_HINT = 'Choose where the CAD figure came from.';
export function isConversionSource(value: unknown): value is ConversionSource {
  return typeof value === 'string' && Object.hasOwn(CONVERSION_SOURCES, value);
}

/** Both amounts have already been rounded to receipt cents. The server derives the stored rate. */
export function expenseConversionRate(originalCents: number, cadCents: number): number | null {
  if (!Number.isSafeInteger(originalCents) || !Number.isSafeInteger(cadCents) || originalCents <= 0 || cadCents <= 0) return null;
  return Number((cadCents / originalCents).toPrecision(15));
}
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
  conversion_source?: ConversionSource | null;
  conversion_rate?: number | null;
  notes: string | null;
  change_reason: string | null;
  receipt_path: string | null;
  receipt_name: string | null;
  /** Derived from the first revision using this immutable receipt object; never stored as a column. */
  receipt_attached_at?: string | null;
  void_reason: string | null;
  created_at: string;
  created_by: string;
  /** GST/HST Stage 4a (migration 006). NULL or absent = saved before 006; resolveTaxState maps those. */
  tax_answer?: TaxAnswer | null;
  supplier_tax_number?: string | null;
  supplier_registration?: SupplierRegistration | null;
  purchase_kind?: PurchaseKind | null;
  number_unobtainable?: boolean | null;
  /** This revision's stored rows of bookkeeping.expense_tax_lines, in line order. Absent before 006. */
  tax_lines?: TaxLine[];
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

export function redactExpenseRevisions(rows: ExpenseRevision[]): ExpenseRevision[] {
  const attached = new Map<string, string>();
  for (const row of rows) if (row.receipt_path && (!attached.has(row.receipt_path) || row.created_at < attached.get(row.receipt_path)!)) attached.set(row.receipt_path, row.created_at);
  return rows.map(row => ({ ...redactExpenseRevision(row), receipt_attached_at: row.receipt_path ? attached.get(row.receipt_path) ?? null : null }));
}

export function businessCents(row: ExpenseRevision): number {
  return Math.floor((row.cad_cents * row.business_use_percent + 50) / 100);
}

export function lastConversionSource(rows: ExpenseRevision[], paymentSource: string): ConversionSource | '' {
  const last = rows.filter(row => !row.void_reason && row.original_currency === 'USD' &&
    row.payment_source === paymentSource && isConversionSource(row.conversion_source))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.revision - a.revision)[0];
  return last?.conversion_source ?? '';
}

/** True when this revision's credit would count but waits on the supplier's number (GST/HST Stage 4a, ruling 5). */
export function needsSupplierTaxNumber(row: ExpenseRevision, registrationDate: string | null): boolean {
  const credit = row.void_reason ? null : expenseCredit(row, registrationDate);
  return Boolean(credit && needsSupplierNumber(credit));
}

/**
 * The five ruled follow-ups; a void keeps its evidence but never asks for follow-up. `registrationDate` is the current
 * GST/HST registration effective date (null before migration 006). It is required, not optional, so the register's count,
 * the Needs attention filter and an "attention" export are always worked out from the same date.
 */
export function attentionReasons(row: ExpenseRevision, registrationDate: string | null): string[] {
  if (row.void_reason) return [];
  return [
    !row.receipt_path ? 'Receipt missing' : '',
    !hasKnownTaxAmount(row) ? 'Tax amount unknown' : '',
    needsSupplierTaxNumber(row, registrationDate) ? NUMBER_MISSING_REASON : '',
    row.original_currency === 'USD' && !isConversionSource(row.conversion_source) ? 'USD source not picked' : '',
    !hasConfirmedDates(row) ? 'Dates to review' : '',
  ].filter(Boolean);
}

export type ReviewFilter = 'all' | 'attention' | 'missing_receipt' | 'missing_conversion' | 'personal' | 'foreign';

export function matchesReviewFilter(row: ExpenseRevision, filter: ReviewFilter, registrationDate: string | null): boolean {
  if (row.void_reason) return filter === 'all';
  switch (filter) {
    case 'attention': return attentionReasons(row, registrationDate).length > 0;
    case 'missing_receipt': return !row.receipt_path;
    case 'missing_conversion': return row.original_currency === 'USD' && !isConversionSource(row.conversion_source);
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
    missingConversionCount: active.filter(row => row.original_currency === 'USD' && !isConversionSource(row.conversion_source)).length,
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
  conversionNote: string | null; hasConversionNote: boolean; conversionSource?: string | null; notes: string | null; hasNotes: boolean;
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
  if (!cad && !input.isVoid && !isConversionSource(input.conversionSource)) return { field: 'conversionSource', error: CONVERSION_SOURCE_HINT };
  if (!cad && input.conversionSource && !isConversionSource(input.conversionSource)) return { field: 'conversionSource', error: CONVERSION_SOURCE_HINT };
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

export const MAX_TAX_LINES = 10;
export const MAX_SUPPLIER_TAX_NUMBER = 40;
const RELOAD = 'Reload the page and try again.';

/** The raw GST/HST Stage 4a fields of an expense post. Text fields are trimmed; null = absent or over its limit. */
export type ExpenseTaxInput = {
  taxAnswer: string | null; taxLines: string | null; taxCents: number;
  supplierTaxNumber: string | null; hasSupplierTaxNumber: boolean;
  supplierRegistration: string | null; purchaseKind: string | null; numberUnobtainable: string | null;
  /** Only a correction of an expense whose saved tax already has “Type not set” may keep that type. */
  allowUnsetType: boolean;
};
export type ExpenseTaxFields = Required<Pick<ExpenseRevision,
  'tax_answer' | 'tax_lines' | 'supplier_tax_number' | 'supplier_registration' | 'purchase_kind' | 'number_unobtainable' | 'tax_amount_known'>>;

/**
 * The tax section of a 4a post. Nothing here blocks a save beyond today's rules: the amount is required once
 * “Shown on the receipt” is picked, and the lines must add up to it (the sum rule). A credit is never read
 * from the client: the server works it out on read from these facts and the registration date.
 */
export function validateExpenseTaxFields(input: ExpenseTaxInput): FieldRefusal | { value: ExpenseTaxFields } {
  if (!isTaxAnswer(input.taxAnswer)) return { field: 'taxAnswer', error: 'Choose what this receipt shows for tax.' };
  let parsed: unknown = [];
  if (input.taxLines) {
    try { parsed = JSON.parse(input.taxLines); } catch { return { error: RELOAD }; }
  }
  if (!Array.isArray(parsed) || parsed.length > MAX_TAX_LINES) return { error: RELOAD };
  const lines: TaxLine[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { error: RELOAD };
    const { type, cents } = item as Record<string, unknown>;
    if (!isTaxType(type) || (type === 'unset' && !input.allowUnsetType)) return { error: RELOAD };
    if (typeof cents !== 'number' || !Number.isSafeInteger(cents) || cents <= 0) return { field: 'taxLines', error: 'Enter each tax amount above $0.00.' };
    lines.push({ type, cents });
  }
  if (input.taxAnswer === 'shown') {
    if (!lines.length) return { field: 'taxLines', error: 'Enter the tax amount.' };
    if (!taxLinesMatchTotal(lines, input.taxCents)) return { field: 'taxLines', error: `The tax lines don't add up to the tax amount. ${RELOAD}` };
  } else if (lines.length || input.taxCents !== 0) return { error: RELOAD };
  if (input.hasSupplierTaxNumber && input.supplierTaxNumber === null) {
    return { field: 'supplierTaxNumber', error: `Keep the number to ${MAX_SUPPLIER_TAX_NUMBER} characters.` };
  }
  if (input.supplierRegistration && !isSupplierRegistration(input.supplierRegistration)) return { error: RELOAD };
  if (input.purchaseKind && !isPurchaseKind(input.purchaseKind)) return { error: RELOAD };
  if (!['', 'true', 'false'].includes(input.numberUnobtainable ?? '')) return { error: RELOAD };
  const number = input.supplierTaxNumber || null;
  return { value: {
    tax_answer: input.taxAnswer, tax_lines: lines, tax_amount_known: input.taxAnswer !== 'unknown',
    supplier_tax_number: number,
    supplier_registration: (input.supplierRegistration || null) as SupplierRegistration | null,
    purchase_kind: (input.purchaseKind || null) as PurchaseKind | null,
    // A number on hand means there is nothing to give up on.
    number_unobtainable: input.numberUnobtainable === 'true' && !number,
  } };
}

/** True when the saved tax of this revision resolves to a line of type “Type not set” (a pre-4a amount, or one kept so). */
export function hasUnsetTaxType(row: ExpenseRevision): boolean {
  return resolveTaxState(row, row.tax_lines ?? []).lines.some(line => line.type === 'unset');
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
