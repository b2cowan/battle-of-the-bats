import { SCHEDULE_CHANGE_CREDIT_DESCRIPTION } from './dues-payments';

interface Credit {
  amount: number;
  creditType?: string;
  description?: string | null;
  paymentId?: string | null;
  createdAt?: string | null;
}

export const isDuesAdjustment = (credit: Pick<Credit, 'creditType'>): boolean =>
  credit.creditType === 'other' || credit.creditType === 'forgiven';

/** Presentation only. The served net bill remains authoritative; no balances or allocations change.
 * Keep original credit records for edit actions, even when only part of an overpayment belongs in
 * Other credits. Own money already appears in Paid and must not appear a second time here. */
export function buildDuesBreakdown<T extends Credit>(input: {
  credits: readonly T[];
  grossDues: number;
  netDues: number;
  ownMoney: number;
}) {
  const cents = (n: number) => Math.round(n * 100);
  const adjustments = input.credits.filter(isDuesAdjustment);
  const adjustmentC = adjustments.reduce((sum, c) => sum + cents(c.amount), 0);
  const reductionC = cents(input.grossDues) - cents(input.netDues);
  // A write-off can only ever have lowered the bill by the bill. On a row written before both
  // doors refused it (write-offs past the bill — F04, 2026-09-12), the ladder now floors Dues at
  // zero, so "issued − reduction" would print the over-bill excess as money "already returned"
  // when no payout ever happened (/review 2026-09-12). Cap the issued figure at the bill first.
  const withinBillC = Math.min(adjustmentC, cents(input.grossDues));
  const rank = (c: T) => c.description === SCHEDULE_CHANGE_CREDIT_DESCRIPTION ? 0 : c.paymentId ? 1 : 2;
  const ownAmounts = new Map<T, number>();
  let ownLeft = cents(input.ownMoney);
  for (const c of input.credits.filter(c => c.creditType === 'overpayment')
    .sort((a, b) => rank(a) - rank(b) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))) {
    const amount = Math.min(Math.max(0, ownLeft), cents(c.amount));
    ownAmounts.set(c, amount);
    ownLeft -= amount;
  }
  const other = input.credits.filter(c => !isDuesAdjustment(c) && c.creditType !== 'fundraiser')
    .map(credit => ({ credit, amount: (cents(credit.amount) - (ownAmounts.get(credit) ?? 0)) / 100 }))
    .filter(row => row.amount > 0);
  return {
    adjustments,
    adjustmentsTotal: adjustmentC / 100,
    reduction: reductionC / 100,
    // Standing write-offs lower Dues; their paid-back remainder stays in Other credits, where
    // Handed back offsets it. Expose that remainder rather than moving or counting it twice.
    adjustmentsReturned: Math.max(0, withinBillC - reductionC) / 100,
    fundraising: input.credits.filter(c => c.creditType === 'fundraiser'),
    other,
  };
}
