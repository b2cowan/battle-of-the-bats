import { businessCents, hasConfirmedDates, hasKnownTaxAmount, matchesReviewFilter, parseCents, type ExpenseRevision, type ReviewFilter } from './bookkeeping-expenses';

export type ExpenseStatus = 'active' | 'voided' | 'all';
export type ExpenseFilters = {
  from: string | null; to: string | null; category: string; supplier?: string;
  paymentSource?: string; dateStatus?: 'all' | 'confirmed'; query: string; review: ReviewFilter;
  /** Absent preserves the existing export contract; the Expenses screen explicitly selects active. */
  status?: ExpenseStatus;
};

/** Text keeps its existing substring search. Money searches compare exact receipt cents. */
export function matchesExpenseSearch(row: ExpenseRevision, query: string): boolean {
  const text = query.trim().toLowerCase();
  if (!text || `${row.supplier} ${row.business_purpose} ${row.category}`.toLowerCase().includes(text)) return true;
  const cents = parseCents(text);
  return cents !== null && [businessCents(row), row.cad_cents, row.original_cents,
    ...(hasKnownTaxAmount(row) ? [row.tax_cad_cents] : [])].includes(cents);
}

/** One predicate for visible current entries and every revision retained in their CSV/package. */
export function matchesExpenseFilters(row: ExpenseRevision, filters: ExpenseFilters): boolean {
  return (!row.incurred_date || ((!filters.from || row.incurred_date >= filters.from) && (!filters.to || row.incurred_date <= filters.to))) &&
    (filters.dateStatus !== 'confirmed' || hasConfirmedDates(row)) &&
    (!filters.category || row.category === filters.category) &&
    (!filters.supplier || row.supplier === filters.supplier) &&
    (!filters.paymentSource || row.payment_source === filters.paymentSource) &&
    (filters.status !== 'active' || !row.void_reason) &&
    (filters.status !== 'voided' || Boolean(row.void_reason)) &&
    matchesExpenseSearch(row, filters.query) && matchesReviewFilter(row, filters.review);
}

export function expenseFilterParams(filters: ExpenseFilters): URLSearchParams {
  const params = new URLSearchParams();
  const values = { from: filters.from, to: filters.to, category: filters.category, supplier: filters.supplier,
    paymentSource: filters.paymentSource, q: filters.query, review: filters.review, status: filters.status, dateStatus: filters.dateStatus };
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  return params;
}
