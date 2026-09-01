/**
 * The payout floor — the ONE rule every door that shrinks a family's credits must ask first.
 *
 * A credit is money the team owes a family (lib/dues-credits.ts). Once part of it has been HANDED
 * BACK IN CASH (rep_dues_payouts), the credits that remain must still cover what went out —
 * otherwise the family holds cash the books no longer say they were owed, and at season's end the
 * missing credit silently inflates everyone else's share of the pool (mig 234, /review
 * 2026-08-14).
 *
 * Six doors shrink credits today, and all six must speak this file's sentence:
 *   1. Editing a coach-authored credit down  (players/[playerId]/dues-credits/[creditId] PATCH)
 *   2. Deleting a coach-authored credit      (same route, DELETE)
 *   3. Editing a SPONSOR — amount down, family changed/removed, or flipped back to a pledge
 *      (fundraisers/[fundraiserId] PATCH → applySponsorMoney). ⚠ This door shipped 2026-08-15
 *      WITHOUT the floor and carried it silently for two weeks; the general credit route refuses
 *      sponsor credits with "edit it there" specifically so the sponsor route can be the one safe
 *      editor — which it is only while it calls this guard.
 *   4. REMOVING a drive's per-player entry   (fundraisers/[fundraiserId]/entries/[entryId] DELETE)
 *      ⚠ Added with the guarded deletes (2026-08-30). It is the ONLY door that unwinds a drive
 *      entry — the general credit route refuses a credit carrying `fundraiser_entry_id` and sends
 *      the coach here — so if it ever stops asking, nothing else is left to ask on its behalf.
 *   5. RAISING a player's dues total          (the per-player schedule POST — /dues)
 *   6. The roster-wide dues re-run            (budget-plan/generate-installments POST)
 *      ⚠ 5 and 6 added QA §123 Phase A2. Neither route touches a credit row itself — the
 *      reconcile they trigger does, deleting the overpayment credit a payout may be standing on.
 *      `projectScheduleTotalChange` below is their projection, asked PRE-FLIGHT (before the
 *      upsert): a guard that refuses after an irreversible write strands the record forever.
 *      The bulk door asks PER FAMILY and refuses only the families it cannot safely write.
 *
 * ⚠ PURE ON PURPOSE. No next/server import — the violation is returned as data and each route
 * wraps it in its own 409, so this file stays unit-testable and importable from anywhere. The
 * epsilon, the refusal code and the sentence live here ONCE; two doors already diverged into
 * hand copies before this file existed.
 */
import { amountsTotal, payoutCeiling } from './dues-credits';
import { strandedExcess } from './dues-payments';

/** The 409 code every payout-floor refusal carries — clients may branch on it. */
export const CREDIT_HAS_PAYOUT = 'CREDIT_HAS_PAYOUT';

/** The one sentence, stated once. `action` reads like "lowering this credit". */
export function payoutFloorMessage(paidOut: number, action: string): string {
  /* Owner wording, 2026-09-01 (option A of four): "more than they were EVER OWED" states the
     aggregate rule exactly — the floor never matches a payout to one record, it protects the
     family's whole balance. Replaced "would leave the books owing them less than they have
     received", which read backwards to the owner on the live screen. ONE sentence, every door. */
  return `The team has already paid $${paidOut.toFixed(2)} back to this family — ${action} would make that more than they were ever owed. Remove the payout first.`;
}

/**
 * Would this projected credit set break the floor?
 *
 * `projected` is the family's credit set as it WOULD be after the change — filtered for a
 * delete, amount-substituted for an edit. Carries `creditType` because the ceiling EXCLUDES
 * forgiveness — a forgiven balance was never the family's money to be handed back; narrowing to
 * `{ amount }` would let a forgiveness count toward what the team may pay out.
 *
 * @returns `{ paidOut }` when the change must be refused, or null when it is safe.
 */
export function payoutFloorViolation(
  projected: readonly { amount: number; creditType: string }[],
  payouts: readonly { amount: number }[],
): { paidOut: number } | null {
  const paidOut = amountsTotal(payouts);
  if (paidOut <= payoutCeiling(projected, []) + 0.005) return null;
  return { paidOut };
}

/**
 * How much of ONE credit is already spoken for by payouts — the dollars that would be stranded
 * if it vanished. 0 when the family's OTHER credits alone still cover everything paid out.
 * Feeds the screens that warn before the guard refuses (the sponsor sheet's pledge-flip hint).
 */
export function creditExposure(
  credit: { id: string; amount: number },
  familyCredits: readonly { id: string; amount: number; creditType: string }[],
  payouts: readonly { amount: number }[],
): number {
  const others = familyCredits.filter(c => c.id !== credit.id);
  const paidOut = amountsTotal(payouts);
  const coveredWithout = payoutCeiling(others, []);
  const overhang = Math.round(Math.max(0, paidOut - coveredWithout) * 100) / 100;
  return Math.min(overhang, Math.round(credit.amount * 100) / 100);
}

/**
 * The sponsor edit's projection: given what the edit WOULD make true, how does the existing
 * sponsor credit fare, and what is the coach's act called?
 *
 * @returns null when the change can only keep or grow the credit on the same family — no floor
 * question exists. Otherwise the projected credit set for the CURRENT credit's family plus the
 * action word the refusal sentence uses. (A credit moving to a DIFFERENT family is a removal
 * from this one's set — the receiving family's ceiling can only rise, so only the losing side
 * is asked.)
 */
/**
 * The schedule change's projection (QA §123 Phase A2): what a player's credit set WOULD be after
 * their dues total moves, computable pre-flight from three facts the routes already hold.
 *
 * After the write, the reconcile (planOverpaymentReconcile) makes the player's total
 * `overpayment` credit equal `strandedExcess(paymentsTotal, newScheduleTotal, 0)` — so the
 * projected set is the family's NON-overpayment credits plus one overpayment credit of exactly
 * that value. Hand the result to `payoutFloorViolation` with the family's payouts; the action
 * word for the refusal sentence is "raising this player's dues total" (a LOWER total only grows
 * the credit, so only a rise can reach the floor).
 */
export function projectScheduleTotalChange(args: {
  /** The family's full credit set as it stands. */
  familyCredits: readonly { amount: number; creditType: string }[];
  paymentsTotal: number;
  newScheduleTotal: number;
}): { amount: number; creditType: string }[] {
  const { familyCredits, paymentsTotal, newScheduleTotal } = args;
  const projected = familyCredits.filter(c => c.creditType !== 'overpayment')
    .map(c => ({ amount: c.amount, creditType: c.creditType }));
  const excess = strandedExcess(paymentsTotal, newScheduleTotal, 0);
  if (excess > 0.005) projected.push({ amount: excess, creditType: 'overpayment' });
  return projected;
}

export function projectSponsorCreditChange(args: {
  /** The credit as it stands, on the family that holds it. */
  existing: { id: string; playerId: string; amount: number };
  /** That family's full credit set (the existing credit included). */
  familyCredits: readonly { id: string; amount: number; creditType: string }[];
  /** What the edit resolves to: is it received, who is credited, at how many dollars. */
  next: { received: boolean; playerId: string | null; credit: number };
  wasReceived: boolean;
}): { projected: { id: string; amount: number; creditType: string }[]; action: string } | null {
  const { existing, familyCredits, next, wasReceived } = args;
  const wantsCredit = next.received && !!next.playerId && next.credit > 0.005;
  const staysOnFamily = wantsCredit && next.playerId === existing.playerId;

  if (staysOnFamily && next.credit >= existing.amount - 0.005) return null; // keeps or grows — safe

  const projected = staysOnFamily
    ? familyCredits.map(c => (c.id === existing.id ? { ...c, amount: next.credit } : c))
    : familyCredits.filter(c => c.id !== existing.id);

  const action = wasReceived && !next.received
    ? 'moving this sponsorship back to a pledge'
    : !wantsCredit
      ? 'removing this credit'
      : !staysOnFamily
        ? 'moving this credit to another family'
        : 'lowering this credit';

  return { projected, action };
}
