import { businessCents, hasConfirmedDates, type ExpenseRevision } from './bookkeeping-expenses';

export type OwnerMovementKind = 'owner_contribution' | 'owner_draw' | 'expense_reimbursement';
export type OwnerMovementRevision = {
  movement_id: string;
  revision: number;
  movement_date: string;
  movement_kind: OwnerMovementKind;
  amount_cents: number;
  linked_expense_id: string | null;
  source_reference: string | null;
  note: string | null;
  change_reason: string | null;
  void_reason: string | null;
  created_at: string;
  created_by: string;
};

export function currentOwnerMovements(rows: OwnerMovementRevision[]): OwnerMovementRevision[] {
  const latest = new Map<string, OwnerMovementRevision>();
  for (const row of rows) {
    if ((latest.get(row.movement_id)?.revision ?? 0) < row.revision) latest.set(row.movement_id, row);
  }
  return [...latest.values()].sort((a, b) => b.movement_date.localeCompare(a.movement_date) || a.movement_id.localeCompare(b.movement_id));
}

export type OwnerLedgerRow = {
  key: string;
  date: string | null;
  type: 'expense' | OwnerMovementKind;
  title: string;
  amount_cents: number;
  cash_direction: 'in' | 'out' | 'personal' | 'unknown';
  expense_id: string | null;
  movement_id: string | null;
  needs_review: boolean;
};

/** A readable activity list, not a posted general ledger or reconciled bank balance. */
export function ownerLedgerRows(expenses: ExpenseRevision[], movements: OwnerMovementRevision[]): OwnerLedgerRow[] {
  const expenseRows: OwnerLedgerRow[] = expenses.filter(row => !row.void_reason).map(row => ({
    key: `expense:${row.expense_id}`,
    date: row.paid_date ?? null,
    type: 'expense',
    title: row.supplier,
    amount_cents: businessCents(row),
    cash_direction: row.payment_source === 'personal' ? 'personal' : hasConfirmedDates(row) ? 'out' : 'unknown',
    expense_id: row.expense_id,
    movement_id: null,
    needs_review: !hasConfirmedDates(row),
  }));
  const movementRows: OwnerLedgerRow[] = currentOwnerMovements(movements).filter(row => !row.void_reason).map(row => ({
    key: `owner:${row.movement_id}`,
    date: row.movement_date,
    type: row.movement_kind,
    title: row.movement_kind === 'owner_contribution' ? 'Owner contribution'
      : row.movement_kind === 'owner_draw' ? 'Owner draw' : 'Expense reimbursement',
    amount_cents: row.amount_cents,
    cash_direction: row.movement_kind === 'owner_contribution' ? 'in' : 'out',
    expense_id: row.linked_expense_id,
    movement_id: row.movement_id,
    needs_review: !row.source_reference,
  }));
  return [...expenseRows, ...movementRows].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.key.localeCompare(b.key));
}
