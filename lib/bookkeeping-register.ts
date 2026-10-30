import { parseExpenseFilters, reportPeriodRange, type NamedReportPeriod } from './bookkeeping-export';
import type { ExpenseFilters } from './bookkeeping-filters';

export const EXPENSE_PERIODS = ['month', 'last_month', 'year', 'last_quarter', 'last_year', 'all', 'custom'] as const;
export type ExpensePeriod = typeof EXPENSE_PERIODS[number];

export function expensePeriodRange(period: ExpensePeriod, today: string) {
  if (period === 'all' || period === 'custom') return { from: null, to: null, label: period === 'all' ? 'All dates' : 'Custom dates' };
  const range = reportPeriodRange(period as NamedReportPeriod, today);
  if (period !== 'month') return range;
  const last = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate();
  return { from: range.from, to: `${today.slice(0, 7)}-${String(last).padStart(2, '0')}`, label: range.label.replace(' to date', '') };
}

/** Relative named periods stay relative in an address; custom bounds are carried explicitly. */
export function expenseRegisterSelection(params: URLSearchParams, today: string): {
  period: ExpensePeriod; filters: ExpenseFilters | null;
} {
  const requested = params.get('period') ?? (params.has('from') || params.has('to') ? 'custom' : 'month');
  const period = EXPENSE_PERIODS.find(value => value === requested) ?? 'month';
  const query = new URLSearchParams(params);
  if (period !== 'custom') {
    const range = expensePeriodRange(period, today);
    query.delete('from'); query.delete('to');
    if (range.from) query.set('from', range.from);
    if (range.to) query.set('to', range.to);
  }
  if (!query.has('status')) query.set('status', 'active');
  return { period, filters: parseExpenseFilters(query) };
}
