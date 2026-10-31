import { currentExpenses, isExpenseDate, type ExpenseRevision } from './bookkeeping-expenses';
import { daysBetweenDateStrings } from './timezone';

export function duplicateExpenses(rows: ExpenseRevision[], supplier: string, cadCents: number | null, incurredDate: string, excludeId?: string): ExpenseRevision[] {
  if (!supplier.trim() || cadCents === null || !isExpenseDate(incurredDate)) return [];
  return currentExpenses(rows).filter(row => !row.void_reason && row.expense_id !== excludeId && row.cad_cents === cadCents &&
    row.supplier.trim().toLowerCase() === supplier.trim().toLowerCase() && isExpenseDate(row.incurred_date) &&
    Math.abs(daysBetweenDateStrings(row.incurred_date, incurredDate)) <= 7);
}
