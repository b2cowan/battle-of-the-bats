/**
 * The words of house-league money (Club Tier Stage 9b-2), from docs/projects/active/HOUSE_LEAGUE_STAGE9B2_COPY.md. Keys
 * follow that file's (`regs.*`, `end.*`, `price.*`, `err.*`…) so a word can be traced back to its ruling. One home: a
 * screen, a route and an email read the same string. Methods are worded by `DUES_PAYMENT_METHOD_LABEL`, never typed here.
 */
import { DUES_PAYMENT_METHOD_LABEL, type DuesPaymentMethod } from './types';
import { possessive } from './utils';

/** A stored method as staff read it: the label, or "Not recorded". */
export function methodWord(m: string | null | undefined): string {
  if (!m) return 'Not recorded';
  if (m === 'online_card') return 'Online, card';
  return DUES_PAYMENT_METHOD_LABEL[m as DuesPaymentMethod] ?? m;
}

/** " (E-Transfer)" after a date in a sentence; nothing for Other or Not recorded (copy §0). */
export function methodInBrackets(m: string | null | undefined): string {
  if (!m || m === 'other') return '';
  return ` (${methodWord(m)})`;
}

/** The refusals of the one money writer and the ending (copy §16). */
export const MONEY_REFUSAL = {
  ended: (name: string) => `${possessive(name)} registration has already ended.`,
  notAccepted: (name: string) => `${name} hasn’t been accepted yet, so there is no fee to receive.`,
  alreadyReceived: (name: string) => `${possessive(name)} fee is already received.`,
  free: (name: string) => `${possessive(name)} season is free, so there is no fee to receive.`,
  changed: 'The money on this registration changed since the window opened. Close it and open it again.',
  amount: 'Enter $0 or more.',
  priceSame: 'That is already the price. Enter a different amount.',
  priceReason: 'Say why the price is changing.',
  keptReason: (amount: string) => `Say why the club is keeping the ${amount}.`,
  money: (amount: string) => `Choose what happens to the ${amount}.`,
  nothingToUndo: (name: string) => `${name} has no received fee to undo.`,
  refundedUndo: 'This payment has a refund beside it, so it can’t be undone. The refund already records the money going back.',
  futurePayment: 'A payment can’t be received after today.',
  futureRefund: 'A refund can’t be dated after today.',
  beforePayment: 'A refund can’t be dated before the payment it returns.',
  method: 'Choose how it was paid from the list.',
  date: 'Enter a date.',
  failed: 'That didn’t go through. Please try again.',
} as const;
