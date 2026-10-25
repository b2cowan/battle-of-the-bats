/**
 * What a tournament team may pay online right now (Club Tier Stage 12a, A7). Pure, so the pay page, the pay route and
 * the receipt answer the same — and the route RE-READS it at the moment of paying, never trusting what the page showed.
 *
 *  - Nothing paid yet and the fee has a deposit: two choices, the deposit (pre-selected) or the whole fee ("full").
 *  - Nothing paid yet and no deposit: one choice, the whole fee ("full").
 *  - Something paid: one choice, what is left ("balance") — after the deposit, or after any part-payment.
 *  - Paid in full, or no fee set: nothing to pay.
 *
 * Each choice carries its fee (computed once, by `onlineFee`), so the saving of paying in full — one flat part fewer,
 * shown only while the payer pays the fee (A7) — is a subtraction, not a second formula.
 */
import { onlineFee, toCents, type OnlineFee, type OnlineFeePayer } from './online-payment-fee';
import type { FeeDetails } from './registration-amount-due';

export type PayScope = 'deposit' | 'balance' | 'full';

export interface PayChoice {
  scope: PayScope;
  fee: OnlineFee;
  /** When this part is due, from the fee schedule. */
  dueDate: string | null;
}

export interface PayOptions {
  choices: PayChoice[];
  /** The choice selected when the page opens: the deposit when offered (A7). */
  preselected: PayScope;
  /** How much less the payer pays in fees by paying in full rather than deposit + balance; null when not shown. */
  savingCents: number | null;
}

export function payOptions(
  paid: { totalPaid: number | null; depositPaid: number | null },
  fee: FeeDetails,
  feePayer: OnlineFeePayer,
): PayOptions | null {
  const totalCents = fee.totalFeeAmount ? toCents(fee.totalFeeAmount) : 0;
  const paidCents = toCents(paid.totalPaid ?? 0);
  if (totalCents <= 0 || paidCents >= totalCents) return null;
  const left = totalCents - paidCents;

  if (paidCents > 0) {
    return { choices: [{ scope: 'balance', fee: onlineFee(left, feePayer), dueDate: fee.totalFeeDueDate }], preselected: 'balance', savingCents: null };
  }

  const depositCents = fee.depositAmount ? toCents(fee.depositAmount) : 0;
  const full: PayChoice = { scope: 'full', fee: onlineFee(totalCents, feePayer), dueDate: fee.totalFeeDueDate };
  if (depositCents <= 0 || depositCents >= totalCents) {
    return { choices: [full], preselected: 'full', savingCents: null };
  }
  const deposit: PayChoice = { scope: 'deposit', fee: onlineFee(depositCents, feePayer), dueDate: fee.depositDueDate };
  const later = onlineFee(totalCents - depositCents, feePayer);
  const saving = deposit.fee.feeCents + later.feeCents - full.fee.feeCents;
  return {
    choices: [deposit, full],
    preselected: 'deposit',
    savingCents: feePayer === 'family' && saving > 0 ? saving : null,
  };
}
