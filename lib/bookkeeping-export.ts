import { businessCents, csvCell, currentExpenses, isExpenseDate, matchesReviewFilter, type ExpenseRevision, type ReviewFilter } from './bookkeeping-expenses';

export type ExpenseFilters = { from: string | null; to: string | null; category: string; query: string; review: ReviewFilter };

export function parseExpenseFilters(params: URLSearchParams): ExpenseFilters | null {
  const from = params.get('from');
  const to = params.get('to');
  const category = params.get('category') ?? '';
  const query = (params.get('q') ?? '').trim().toLowerCase();
  const review = params.get('review') ?? 'all';
  if ((from && !isExpenseDate(from)) || (to && !isExpenseDate(to)) ||
    (from && to && from > to) || category.length > 80 || query.length > 160 ||
    !['all', 'missing_receipt', 'missing_conversion', 'personal', 'foreign'].includes(review)) return null;
  return { from, to, category, query, review: review as ReviewFilter };
}

export function selectExpenseRevisions(revisions: ExpenseRevision[], filters: ExpenseFilters): ExpenseRevision[] {
  const ids = new Set(currentExpenses(revisions).filter(row =>
    (!filters.from || row.expense_date >= filters.from) &&
    (!filters.to || row.expense_date <= filters.to) &&
    (!filters.category || row.category === filters.category) &&
    (!filters.query || `${row.supplier} ${row.business_purpose} ${row.category}`.toLowerCase().includes(filters.query)) &&
    matchesReviewFilter(row, filters.review)
  ).map(row => row.expense_id));
  return revisions.filter(row => ids.has(row.expense_id))
    .sort((a, b) => a.expense_id.localeCompare(b.expense_id) || a.revision - b.revision);
}

const COLUMNS = [
  'expense_id', 'revision', 'date', 'supplier', 'category', 'business_purpose',
  'original_currency', 'original_amount', 'cad_amount', 'cad_business_amount',
  'recorded_tax_cad', 'tax_status', 'business_use_percent', 'payment_source',
  'conversion_note', 'notes', 'status', 'change_reason', 'void_reason', 'receipt_name', 'receipt_download',
  'revision_created_at', 'revision_created_by',
];
const dollars = (cents: number) => (cents / 100).toFixed(2);

export function expenseCsv(selected: ExpenseRevision[]): string {
  const current = new Map(currentExpenses(selected).map(row => [row.expense_id, row]));
  const lines = [COLUMNS.map(csvCell).join(',')];
  for (const row of selected) {
    const latest = current.get(row.expense_id)!;
    const receiptUrl = row.receipt_path
      ? `/api/platform-admin/bookkeeping/receipt/${row.expense_id}/${row.revision}` : '';
    lines.push([
      row.expense_id, row.revision, row.expense_date, row.supplier, row.category,
      row.business_purpose, row.original_currency, dollars(row.original_cents),
      dollars(row.cad_cents), dollars(businessCents(row)), dollars(row.tax_cad_cents),
      row.tax_status, row.business_use_percent, row.payment_source,
      row.conversion_note, row.notes, row === latest ? (row.void_reason ? 'void' : 'current') : 'superseded',
      row.change_reason, row.void_reason, row.receipt_name, receiptUrl, row.created_at, row.created_by,
    ].map(csvCell).join(','));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
