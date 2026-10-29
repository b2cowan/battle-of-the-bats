/**
 * ⚠⚠ WHAT A BILL ASKS OF THE COACH RIGHT NOW — the one answer behind a "Bills you owe" row and the
 * Amount the record form fills in when that row is picked (owner ruling 2026-10-29, on a six-month
 * dues plan whose row read the whole balance).
 *
 * The row and the pre-fill are ONE function on purpose: a row that says "$737.64" must open a form
 * that says $737.64, and two derivations of "the next payment" is how they drift apart.
 *
 * - Anything LATE wins: the amount is every late piece added together, and the line says why
 *   (the club bill window's wording — "Oct 15 · 14 days late" / "2 late · since Oct 1").
 * - Otherwise the soonest unsettled piece: what is left of it, and its date.
 * - Nothing unsettled → null; the caller falls back to the bill's own balance, with no date.
 *
 * Money is added in CENTS, the rule `payable-standing.ts` states for the same reason.
 */
import type { AppliedInstallment } from './payable-standing';
import { daysLateWords } from './club-money-words';
import { daysBetweenDateStrings, formatStoredDate } from './timezone';

export interface NextPayment {
  /** What is asked now, in dollars. */
  amount: number;
  /** The line under the amount: "due Dec 1", "Oct 15 · 14 days late", "2 late · since Oct 1". */
  line: string;
  /** Behind on it. The ONLY state that earns the owing colour (ruling 2026-10-16: colour on the verdict, never the total). */
  late: boolean;
  /** The piece is part-paid and nothing is late — the amount is what is LEFT on it, and says so. */
  left: boolean;
}

const cents = (n: number) => Math.round(n * 100);
const byDue = (a: AppliedInstallment, b: AppliedInstallment) =>
  a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;

export function nextPayment(installments: readonly AppliedInstallment[], today: string): NextPayment | null {
  const day = (d: string) => formatStoredDate(d, { withYear: false });
  const unsettled = installments.filter(i => i.state !== 'settled' && cents(i.remaining) > 0).sort(byDue);
  if (unsettled.length === 0) return null;

  const late = unsettled.filter(i => i.dueDate < today);
  if (late.length > 0) {
    const oldest = late[0].dueDate;
    return {
      amount: late.reduce((sum, i) => sum + cents(i.remaining), 0) / 100,
      line: late.length === 1
        ? `${day(oldest)} · ${daysLateWords(daysBetweenDateStrings(oldest, today))}`
        : `${late.length} late · since ${day(oldest)}`,
      late: true,
      left: false,
    };
  }

  const next = unsettled[0];
  return { amount: next.remaining, line: `due ${day(next.dueDate)}`, late: false, left: next.state === 'partly_paid' };
}
