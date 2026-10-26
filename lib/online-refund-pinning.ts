/**
 * WHERE A REFUND MADE IN STRIPE GOES (Club Tier Stage 12c Part 3; plan §0g ruling 5, §0j ask 4). Stripe has already moved
 * the money, so its amount is a fact: this decides only whose it was, and how much of it is the processing fee given back.
 *
 * House league — pinned on its own whenever it can be:
 *   - a payment for ONE child: any amount. It counts against the fee first; anything above it is the processing fee given
 *     back (only while that share is untouched and the family paid the fee);
 *   - a payment for two or more: the whole of what is left (with the fee, or without it). Any other amount is a part refund
 *     on several children: a person says whose it was;
 *   - more than is left: it matches nothing we recorded.
 * A team — the whole untouched payment (fee included) is 12a's full refund; up to what is left of the base is a part
 * refund (never the fee); anything else matches nothing.
 *
 * Pure: no I/O. All amounts in cents.
 */

export interface ChildShare {
  itemId: string;
  /** What is left of this child's share (the fee excluded). */
  leftCents: number;
  /** The processing fee that would go back with the whole share (0 once touched, or while the club pays the fee). */
  feeCents: number;
}

export type LeaguePin =
  | { kind: 'record'; plan: Array<{ itemId: string; base: number; fee: number }> }
  | { kind: 'whose' }
  | { kind: 'unmatched' };

export function pinLeagueRefund(shares: readonly ChildShare[], refundCents: number): LeaguePin {
  const open = shares.filter(s => s.leftCents > 0);
  if (refundCents <= 0 || !open.length) return { kind: 'unmatched' };
  if (open.length === 1) {
    const s = open[0];
    if (refundCents <= s.leftCents) return { kind: 'record', plan: [{ itemId: s.itemId, base: refundCents, fee: 0 }] };
    if (refundCents <= s.leftCents + s.feeCents) return { kind: 'record', plan: [{ itemId: s.itemId, base: s.leftCents, fee: refundCents - s.leftCents }] };
    return { kind: 'unmatched' };
  }
  const left = open.reduce((n, s) => n + s.leftCents, 0);
  const fee = open.reduce((n, s) => n + s.feeCents, 0);
  if (refundCents === left + fee) return { kind: 'record', plan: open.map(s => ({ itemId: s.itemId, base: s.leftCents, fee: s.feeCents })) };
  if (refundCents === left) return { kind: 'record', plan: open.map(s => ({ itemId: s.itemId, base: s.leftCents, fee: 0 })) };
  return refundCents < left ? { kind: 'whose' } : { kind: 'unmatched' };
}

export type TeamPin = { kind: 'whole' } | { kind: 'part'; base: number } | { kind: 'unmatched' };

/** A team's payment: `usedCents` is what has already gone back of its base; `wholeCents` is what the payer was charged. */
export function pinTeamRefund(p: { baseCents: number; wholeCents: number; usedCents: number; landed: boolean }, refundCents: number): TeamPin {
  if (p.usedCents === 0 && refundCents === p.wholeCents) return { kind: 'whole' };
  if (!p.landed || refundCents <= 0 || refundCents > p.baseCents - p.usedCents) return { kind: 'unmatched' };
  return { kind: 'part', base: refundCents };
}
