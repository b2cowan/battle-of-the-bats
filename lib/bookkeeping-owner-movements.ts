import { amountMessage, businessCents, hasConfirmedDates, isExpenseDate, isRecordId, parseCents, type ExpenseRevision, type FieldRefusal } from './bookkeeping-expenses';

export type OwnerMovementKind = 'owner_contribution' | 'owner_draw' | 'expense_reimbursement';
export const OWNER_MOVEMENT_KINDS: OwnerMovementKind[] = ['owner_contribution', 'owner_draw', 'expense_reimbursement'];

export type OwnerMovementInput = {
  movementId: string; movementDate: string; movementKind: OwnerMovementKind; amountCents: number;
  linkedExpenseId: string | null; sourceReference: string | null; note: string | null;
  changeReason: string | null; voidReason: string | null; expectedRevision: number | null;
};

const clean = (value: unknown, max: number) => typeof value === 'string' && value.trim().length <= max ? value.trim() : null;

/** The transfer form's checks in the form's order. A refusal names the field it belongs to. */
export function validateOwnerMovementInput(input: Record<string, unknown>): { value: OwnerMovementInput } | FieldRefusal {
  const movementId = clean(input.movementId, 36)?.toLowerCase() ?? null;
  const movementKind = clean(input.movementKind, 30);
  const movementDate = clean(input.movementDate, 10);
  const amountCents = parseCents(input.amount);
  const linkedExpenseId = clean(input.linkedExpenseId, 36)?.toLowerCase() || null;
  const sourceReference = clean(input.sourceReference, 160) || null;
  const note = clean(input.note, 1000) || null;
  const changeReason = clean(input.changeReason, 500) || null;
  const voidReason = clean(input.voidReason, 500) || null;
  // Absent means a new transfer; anything present must be a whole revision number (not null, true or a string).
  const expectedRevision = input.expectedRevision === undefined ? null
    : typeof input.expectedRevision === 'number' ? input.expectedRevision : NaN;
  const reimbursement = movementKind === 'expense_reimbursement';
  if (!isRecordId(movementId)) return { error: 'This transfer could not be identified. Reload the page and try again.' };
  if (expectedRevision !== null && (!Number.isInteger(expectedRevision) || expectedRevision < 1)) return { error: 'Reload the page before changing this transfer.' };
  if (!OWNER_MOVEMENT_KINDS.includes(movementKind as OwnerMovementKind)) return { field: 'movementKind', error: 'Choose what happened.' };
  if (reimbursement && (!linkedExpenseId || !isRecordId(linkedExpenseId))) return { field: 'linkedExpenseId', error: 'Choose the personal expense you repaid.' };
  if (!reimbursement && linkedExpenseId !== null) return { field: 'movementKind', error: 'Only paying yourself back links to an expense.' };
  if (!isExpenseDate(movementDate)) return { field: 'movementDate', error: 'Choose the transfer date.' };
  const amount = amountMessage(amountCents);
  if (amount) return { field: 'amount', error: amount };
  if (input.sourceReference != null && clean(input.sourceReference, 160) === null) return { field: 'sourceReference', error: 'Keep the bank reference to 160 characters.' };
  if (input.note != null && clean(input.note, 1000) === null) return { field: 'note', error: 'Keep the note to 1,000 characters.' };
  if (input.voidReason !== undefined && !voidReason) return { field: 'voidReason', error: 'Say why this transfer is being voided.' };
  return { value: {
    movementId, movementDate, movementKind: movementKind as OwnerMovementKind, amountCents: amountCents!,
    linkedExpenseId, sourceReference, note, changeReason, voidReason, expectedRevision,
  } };
}
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
