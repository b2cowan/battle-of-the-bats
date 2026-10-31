import type { ExpenseRevision } from './bookkeeping-expenses';
import type { OwnerMovementInput, OwnerMovementRevision } from './bookkeeping-owner-movements';

/** All persisted purchase values travel with a void; private object keys never leave the server. */
export function expenseVoidValues(row: ExpenseRevision): Record<string, string> {
  return { expenseId: row.expense_id, expectedRevision: String(row.revision), expenseDate: row.expense_date,
    incurredDate: row.incurred_date ?? '', paidDate: row.paid_date ?? '', supplier: row.supplier, category: row.category,
    businessPurpose: row.business_purpose, originalCurrency: row.original_currency, originalAmount: (row.original_cents / 100).toFixed(2),
    cadAmount: (row.cad_cents / 100).toFixed(2), taxCadAmount: (row.tax_cad_cents / 100).toFixed(2), taxAmountKnown: String(row.tax_amount_known ?? ''),
    taxStatus: row.tax_status, businessUsePercent: String(row.business_use_percent), paymentSource: row.payment_source,
    conversionNote: row.conversion_note ?? '', conversionSource: row.conversion_source ?? '', conversionRate: String(row.conversion_rate ?? ''),
    notes: row.notes ?? '', hasReceipt: String(Boolean(row.receipt_path)), receiptName: row.receipt_name ?? '' };
}
export function expenseVoidForm(row: ExpenseRevision, reason: string): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(expenseVoidValues(row))) form.set(key, value);
  form.set('changeReason', reason); form.set('voidReason', reason);
  return form;
}
export function expenseVoidMatches(row: ExpenseRevision, form: FormData): boolean {
  return !form.has('receipt') && Object.entries(expenseVoidValues(row)).every(([key, value]) =>
    form.getAll(key).length === 1 && form.get(key) === value);
}
export function ownerVoidValues(row: OwnerMovementRevision) {
  return { movementId: row.movement_id, expectedRevision: row.revision, movementDate: row.movement_date,
    movementKind: row.movement_kind, amount: (row.amount_cents / 100).toFixed(2), linkedExpenseId: row.linked_expense_id,
    sourceReference: row.source_reference, note: row.note };
}
export function ownerVoidMatches(row: OwnerMovementRevision, input: OwnerMovementInput, raw: Record<string, unknown> = input): boolean {
  return row.movement_date === input.movementDate && row.movement_kind === input.movementKind && row.amount_cents === input.amountCents &&
    row.linked_expense_id === input.linkedExpenseId && row.source_reference === raw.sourceReference && row.note === raw.note;
}
