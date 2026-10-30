import { businessCents, csvCell, currentExpenses, hasConfirmedDates, hasKnownTaxAmount, isExpenseDate, matchesReviewFilter, type ExpenseRevision, type ReviewFilter } from './bookkeeping-expenses';
import { currentOwnerMovements, type OwnerMovementRevision } from './bookkeeping-owner-movements';

export type NamedReportPeriod = 'month' | 'year' | 'last_month' | 'last_quarter' | 'last_year';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** A named report period as an incurred-date range. `today` is the viewer's own calendar day (YYYY-MM-DD); quarters are calendar quarters. */
export function reportPeriodRange(period: NamedReportPeriod, today: string): { from: string; to: string; label: string } {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  if (period === 'month') return { from: `${today.slice(0, 7)}-01`, to: today, label: `${MONTHS[month - 1]} ${year} to date` };
  if (period === 'year') return { from: `${year}-01-01`, to: today, label: `${year} to date` };
  if (period === 'last_year') return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31`, label: `Last calendar year · ${year - 1}` };
  if (period === 'last_month') {
    const y = month === 1 ? year - 1 : year;
    const m = month === 1 ? 12 : month - 1;
    return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}`, label: `Last month · ${MONTHS[m - 1]} ${y}` };
  }
  const quarter = Math.floor((month - 1) / 3);
  const y = quarter === 0 ? year - 1 : year;
  const first = quarter === 0 ? 10 : (quarter - 1) * 3 + 1;
  return { from: `${y}-${pad(first)}-01`, to: `${y}-${pad(first + 2)}-${pad(lastDay(y, first + 2))}`,
    label: `Last quarter · ${MONTHS[first - 1]} to ${MONTHS[first + 1]} ${y}` };
}

export type ExpenseFilters = { from: string | null; to: string | null; category: string; supplier?: string; paymentSource?: string; dateStatus?: 'all' | 'confirmed'; query: string; review: ReviewFilter };

export function parseExpenseFilters(params: URLSearchParams): ExpenseFilters | null {
  const from = params.get('from');
  const to = params.get('to');
  const category = params.get('category') ?? '';
  const supplier = params.get('supplier') ?? '';
  const paymentSource = params.get('paymentSource') ?? '';
  const dateStatus = params.get('dateStatus') ?? 'all';
  const query = (params.get('q') ?? '').trim().toLowerCase();
  const review = params.get('review') ?? 'all';
  if ((from && !isExpenseDate(from)) || (to && !isExpenseDate(to)) ||
    (from && to && from > to) || category.length > 80 || supplier.length > 160 || query.length > 160 ||
    !['', 'business_bank', 'business_card', 'personal', 'other'].includes(paymentSource) ||
    !['all', 'confirmed'].includes(dateStatus) ||
    !['all', 'missing_receipt', 'missing_conversion', 'personal', 'foreign'].includes(review)) return null;
  return { from, to, category, supplier, paymentSource, dateStatus: dateStatus as ExpenseFilters['dateStatus'], query, review: review as ReviewFilter };
}

export function selectExpenseRevisions(revisions: ExpenseRevision[], filters: ExpenseFilters): ExpenseRevision[] {
  const ids = new Set(currentExpenses(revisions).filter(row =>
    (!row.incurred_date || ((!filters.from || row.incurred_date >= filters.from) &&
      (!filters.to || row.incurred_date <= filters.to))) &&
    (filters.dateStatus !== 'confirmed' || hasConfirmedDates(row)) &&
    (!filters.category || row.category === filters.category) &&
    (!filters.supplier || row.supplier === filters.supplier) &&
    (!filters.paymentSource || row.payment_source === filters.paymentSource) &&
    (!filters.query || `${row.supplier} ${row.business_purpose} ${row.category}`.toLowerCase().includes(filters.query)) &&
    matchesReviewFilter(row, filters.review)
  ).map(row => row.expense_id));
  return revisions.filter(row => ids.has(row.expense_id))
    .sort((a, b) => a.expense_id.localeCompare(b.expense_id) || a.revision - b.revision);
}

const COLUMNS = [
  'expense_id', 'revision', 'date', 'incurred_date', 'paid_date', 'date_status', 'selected_period', 'supplier', 'category', 'business_purpose',
  'original_currency', 'original_amount', 'cad_amount', 'cad_business_amount',
  'recorded_tax_cad', 'tax_amount_status', 'tax_status', 'business_use_percent', 'payment_source',
  'conversion_note', 'conversion_source', 'conversion_rate', 'notes', 'status', 'change_reason', 'void_reason', 'receipt_name', 'receipt_download',
  'revision_created_at', 'revision_created_by',
];
const dollars = (cents: number) => (cents / 100).toFixed(2);

export function expenseCsv(selected: ExpenseRevision[], filters: ExpenseFilters = { from: null, to: null, category: '', query: '', review: 'all' }): string {
  const current = new Map(currentExpenses(selected).map(row => [row.expense_id, row]));
  const lines = [COLUMNS.map(csvCell).join(',')];
  const selectedPeriod = filters.from || filters.to ? `${filters.from || 'any start'} to ${filters.to || 'any end'}` : 'All confirmed dates; legacy dates to review included';
  for (const row of selected) {
    const latest = current.get(row.expense_id)!;
    const receiptUrl = row.receipt_path
      ? `/api/platform-admin/bookkeeping/receipt/${row.expense_id}/${row.revision}` : '';
    lines.push([
      row.expense_id, row.revision, row.expense_date, row.incurred_date ?? '', row.paid_date ?? '',
      row.incurred_date && row.paid_date ? 'confirmed' : 'legacy_unconfirmed', selectedPeriod, row.supplier, row.category,
      row.business_purpose, row.original_currency, dollars(row.original_cents),
      dollars(row.cad_cents), dollars(businessCents(row)), hasKnownTaxAmount(row) ? dollars(row.tax_cad_cents) : '',
      hasKnownTaxAmount(row) ? 'known' : 'unknown', row.tax_status, row.business_use_percent, row.payment_source,
      row.conversion_note, row.conversion_source ?? '', row.conversion_rate ?? '', row.notes, row === latest ? (row.void_reason ? 'void' : 'current') : 'superseded',
      row.change_reason, row.void_reason, row.receipt_name, receiptUrl, row.created_at, row.created_by,
    ].map(csvCell).join(','));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

/** Owner transfers are dated by transfer date; narrowed expense exports include linked reimbursements only. */
export function selectOwnerMovementRevisions(revisions: OwnerMovementRevision[], filters: ExpenseFilters, selectedExpenses: ExpenseRevision[]): OwnerMovementRevision[] {
  const selectedExpenseIds = new Set(selectedExpenses.map(row => row.expense_id));
  const narrowedExpenses = Boolean(filters.category || filters.supplier || filters.paymentSource || filters.query || filters.review !== 'all');
  const ids = new Set(currentOwnerMovements(revisions).filter(row =>
    (!filters.from || row.movement_date >= filters.from) && (!filters.to || row.movement_date <= filters.to) &&
    (!narrowedExpenses || (row.movement_kind === 'expense_reimbursement' && row.linked_expense_id && selectedExpenseIds.has(row.linked_expense_id)))
  ).map(row => row.movement_id));
  return revisions.filter(row => ids.has(row.movement_id))
    .sort((a, b) => a.movement_id.localeCompare(b.movement_id) || a.revision - b.revision);
}

export function ownerMovementCsv(selected: OwnerMovementRevision[]): string {
  const current = new Map(currentOwnerMovements(selected).map(row => [row.movement_id, row]));
  const columns = ['movement_id', 'revision', 'transfer_date', 'kind', 'amount_cad', 'linked_expense_id',
    'source_reference', 'note', 'status', 'change_reason', 'void_reason', 'revision_created_at', 'revision_created_by'];
  const lines = [columns.map(csvCell).join(',')];
  for (const row of selected) {
    const latest = current.get(row.movement_id)!;
    lines.push([row.movement_id, row.revision, row.movement_date, row.movement_kind, dollars(row.amount_cents),
      row.linked_expense_id, row.source_reference, row.note,
      row === latest ? (row.void_reason ? 'void' : 'current') : 'superseded',
      row.change_reason, row.void_reason, row.created_at, row.created_by].map(csvCell).join(','));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
