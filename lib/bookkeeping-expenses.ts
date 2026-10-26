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

export function parseCents(value: unknown): number | null {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(value)) return null;
  const [dollars, cents = ''] = value.split('.');
  const result = Number(dollars) * 100 + Number(cents.padEnd(2, '0'));
  return Number.isSafeInteger(result) ? result : null;
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
