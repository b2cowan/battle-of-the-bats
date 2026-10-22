/**
 * A TEAM'S PAYMENTS — the plain facts behind the Payment section (mig 345; TEAM_PAYMENTS_LIST_PLAN.md, ruled 2026-10-21).
 *
 * A payment is something you RECORD: an amount, the day it arrived, a label (Deposit / Balance / Entry fee / Payment), how it
 * arrived. The ledger line, on a plan with Accounting, is written by the same database function that writes the row.
 * `teams.total_paid` / `deposit_paid` are a cache of the sum, kept by the database; this file never computes them for storage.
 *
 * What a team still owes is its fee less the SUM of what was received. The label only names a row; it never decides what is
 * owed: $50 recorded on a $100 deposit leaves "Owes $250", not a settled deposit.
 *
 * No React and no server imports, so the unit suite holds it (tests/unit/team-payments.test.ts).
 */
import { formatStoredDate } from './timezone';
import { formatMoney, hasDepositStep, type FeeSchedule } from './tournament-teams';

export type PaymentMethod = 'etransfer' | 'cash' | 'cheque' | 'card' | 'other';
export const PAYMENT_METHODS: readonly PaymentMethod[] = ['etransfer', 'cash', 'cheque', 'card', 'other'];

/** A label names a row. "Earlier payment" is the backfilled, undated one; "Imported payment" comes from a spreadsheet. */
export type PaymentLabel = 'Deposit' | 'Balance' | 'Entry fee' | 'Payment' | 'Imported payment' | 'Earlier payment';

export interface TeamPayment {
  id: string;
  amount: number;
  /** YYYY-MM-DD, or null for an "Earlier payment" (money recorded before payments were dated). */
  paidOn: string | null;
  label: PaymentLabel;
  method: PaymentMethod | null;
  /** On a plan with Accounting: this payment is one line in the tournament's book. */
  inLedger: boolean;
}

/** A payment row's money: "$100", "$109.50" (cents show only when there are some). */
export function formatPaymentMoney(value: number): string {
  return formatMoney(value);
}

/** The day a payment row shows: "Oct 9", no year (ledger rows read the same way). */
export function paymentDay(paidOn: string | null, earlier: string): string {
  return paidOn ? formatStoredDate(paidOn, { withYear: false }) : earlier;
}

export interface DueRow {
  /** Which Record button this is: the deposit, the balance, or the whole fee when there is no deposit step. */
  key: 'deposit' | 'balance';
  label: 'Deposit' | 'Balance' | 'Entry fee';
  amount: number;
  dueDate: string | null;
}

/**
 * What is still due, from the fee and the SUM received: the deposit shortfall first (when the fee has a deposit step), then
 * the rest. Empty once the fee is paid, or when there is no fee. $50 against a $100 deposit leaves Deposit $50 and Balance $200.
 */
export function stillDue(fee: FeeSchedule, paid: number): DueRow[] {
  const total = fee.totalFeeAmount;
  if (!total) return [];
  const cents = (n: number) => Math.round(n * 100) / 100;
  if (!hasDepositStep(fee)) {
    const rest = cents(total - paid);
    return rest > 0 ? [{ key: 'balance', label: 'Entry fee', amount: rest, dueDate: fee.totalFeeDueDate }] : [];
  }
  const deposit = fee.depositAmount ?? 0;
  const rows: DueRow[] = [];
  const depositRest = cents(deposit - paid);
  if (depositRest > 0) rows.push({ key: 'deposit', label: 'Deposit', amount: depositRest, dueDate: fee.depositDueDate });
  const balanceRest = cents(total - Math.max(paid, deposit));
  if (balanceRest > 0) rows.push({ key: 'balance', label: 'Balance', amount: balanceRest, dueDate: fee.totalFeeDueDate });
  return rows;
}

/** The label a Record button gives its payment. The "different amount" door records a plain Payment. */
export function labelForDue(row: DueRow | null): PaymentLabel {
  return row ? row.label : 'Payment';
}

/** A payment the organizer is about to record or save: the checks the form and the server both make. */
export type PaymentDraftIssue = 'amount' | 'date' | 'future';
export function draftIssue(amount: number, paidOn: string, today: string): PaymentDraftIssue | null {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return 'amount';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return 'date';
  if (paidOn > today) return 'future';
  return null;
}

/** Dated rows first in the order they arrived, the undated "Earlier payment" at the top. */
export function receivedOrder(payments: readonly TeamPayment[]): TeamPayment[] {
  return payments.slice().sort((a, b) => {
    if (a.paidOn === b.paidOn) return 0;
    if (a.paidOn === null) return -1;
    if (b.paidOn === null) return 1;
    return a.paidOn < b.paidOn ? -1 : 1;
  });
}
