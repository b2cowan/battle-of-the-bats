/**
 * What each dues installment still needs SENT — per player, across a whole season, in one call.
 *
 * ⚠⚠ WHY THIS IS A SHARED FUNCTION RATHER THAN A ROUTE'S LOCAL LOOP. Coverage is derived per PLAYER
 * across their whole schedule (mig 232) and credits land on the remainders from a direction the
 * team's own setting picks (owner model 2026-08-14) — so working out what one installment owes
 * means assembling that player's installments, payments, credits and payouts together and asking
 * `deriveDuesPosition` once. Two screens need the answer (the payment schedule's dues lane and the
 * register's scheduled overlay), and a second hand-written copy of the assembly is exactly how the
 * "quote the face value" defect got shipped the first time: a $300 installment a family is $200 into
 * has **$100** coming due, not $300.
 *
 * Pure — the caller fetches; this decides. No IO, no React, no Date.
 */

import { deriveDuesPosition, groupByPlayer, totalsByPlayer } from './dues-credits';
import type { ApplicableCredit, CreditApplicationMode } from './dues-credits';

/** One installment, as both callers already read it out of the database. */
export interface RemainingInstallment {
  id: string;
  playerId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string | null;
  paidAt: string | null;
}

export interface RemainingPayment {
  id: string;
  playerId: string;
  amount: number;
  receivedDate: string;
  createdAt: string;
}

/**
 * `installmentId → dollars still to send`.
 *
 * ⚠ A PAID INSTALLMENT IS ABSENT, NOT ZERO. Its money has arrived and belongs on the settled side of
 * whatever is asking; a caller that wants the collected figure reads the payments, not this.
 */
export function duesRemainingByInstallment(input: {
  installments: readonly RemainingInstallment[];
  payments: readonly RemainingPayment[];
  /** Every credit on the season, and every payout, both grouped by player inside. */
  credits: readonly (ApplicableCredit & { playerId: string })[];
  payouts: readonly { playerId: string; amount: number }[];
  mode: CreditApplicationMode;
}): Map<string, number> {
  /* ⚠ THE WALK MOVED TO `duesPositionByInstallment` (2026-09-09) and this is now its narrow door.
     Budget vs. Actual needs the same walk to say which bills were written off, and two copies of a
     per-player credit assembly is exactly the duplication this file's own header was written to
     stop. Callers wanting only "what is still to send" keep this signature and see nothing new. */
  return duesPositionByInstallment(input).remaining;
}

/**
 * WHICH BILL A WRITE-OFF CANCELLED, AND WHAT IS LEFT OVER (owner ruling 2026-09-09 — "a bill
 * lowered is not a collection").
 *
 * ⚠⚠ THIS IS WHAT LETS THE MONTH GRID TELL THE TRUTH. A forgiven March bill used to leave the grid
 * promising that money in March: the report planned revenue the coach themselves had cancelled, and
 * a coach reading their cash flow saw a month that was never going to happen. The season figure is
 * derived from these same events, so netting them fixes both at once — and the build gate holding
 * the dues row equal to the month grid stays green BECAUSE of the change rather than in spite of it.
 *
 * ⚠ THE MONTH IS NOT A NEW CONVENTION. A write-off carries its own date, not a bill's — but credits
 * already meet bills through the rule the team picked in settings, and `deriveDuesPosition` already
 * says which bill each credit landed on. A write-off therefore comes out of the month holding the
 * bill it actually cancelled, by the rule every other credit already obeys.
 *
 * ⚠⚠ THIS DECIDES THE MONTH, NEVER THE TOTAL — and getting that backwards was a real defect during
 * this build, caught by the UAT fixture rather than by reading. Credits are applied to what is
 * still OUTSTANDING, so a family who has already paid every bill in cash has no bill left for a
 * write-off to cancel: the walk finds nothing, and a total derived from it would say $0.00 while
 * the Player Dues band said $17.00. **Two figures for one concept, on the two screens this whole
 * project exists to reconcile.** The authoritative total is the band's (standing write-offs, in
 * `lib/coach-dues-actual.ts`); what this function contributes is WHERE those dollars fall.
 *
 * ⚠ SO THE CALLER MUST PLACE THE REMAINDER ITSELF. Whatever the band counts and this walk could
 * not put on a bill has no month, and belongs in the grid's `no date yet` column — see the caller
 * in the Budget vs. Actual route. Drop it instead and the season total stops matching both the band
 * above it and the months beneath it.
 *
 * ⚠ THE PART-PAID BILL IS THE CASE THIS GETS RIGHT. A family $200 into a $500 instalment who is
 * forgiven the rest cancels $300 of THAT month, so the plan for it reads $200 — exactly what
 * arrived, and the variance is correctly zero.
 */
export function duesPositionByInstallment(input: {
  installments: readonly RemainingInstallment[];
  payments: readonly RemainingPayment[];
  credits: readonly (ApplicableCredit & { playerId: string })[];
  payouts: readonly { playerId: string; amount: number }[];
  mode: CreditApplicationMode;
}): {
  /** `installmentId → dollars still to send`. A paid installment is absent, not zero. */
  remaining: Map<string, number>;
  /** `installmentId → dollars of that bill cancelled by a write-off`. Absent means none. */
  writtenOff: Map<string, number>;
  /**
   * The sum of the map above — what this walk could put on a bill.
   *
   * ⚠ NOT THE SEASON'S WRITE-OFF TOTAL, and never to be used as one. The caller subtracts this
   * from the band's figure to find what has no month; see the header.
   */
  writtenOffPlaced: number;
} {
  const { installments, payments, credits, payouts, mode } = input;
  const paidOutByPlayer = totalsByPlayer(payouts);
  const creditsByPlayer = groupByPlayer(credits);

  const instsByPlayer = new Map<string, RemainingInstallment[]>();
  for (const i of installments) {
    if (!i.playerId) continue;
    const list = instsByPlayer.get(i.playerId);
    if (list) list.push(i); else instsByPlayer.set(i.playerId, [i]);
  }
  const paysByPlayer = new Map<string, RemainingPayment[]>();
  for (const p of payments) {
    const list = paysByPlayer.get(p.playerId);
    if (list) list.push(p); else paysByPlayer.set(p.playerId, [p]);
  }

  const remaining = new Map<string, number>();
  const writtenOff = new Map<string, number>();
  let placedC = 0;
  for (const [playerId, insts] of instsByPlayer) {
    const mine = creditsByPlayer.get(playerId) ?? [];
    const { toSendById, position } = deriveDuesPosition({
      installments: insts.map(i => ({
        id: i.id, installmentNumber: i.installmentNumber, amount: i.amount, paidAt: i.paidAt,
      })),
      payments: (paysByPlayer.get(playerId) ?? []).map(p => ({
        id: p.id, amount: p.amount, receivedDate: p.receivedDate, createdAt: p.createdAt,
      })),
      credits: mine,
      paidOut: paidOutByPlayer.get(playerId) ?? 0,
      mode,
    });
    for (const [id, toSend] of toSendById) remaining.set(id, toSend);

    /* What this player's write-offs actually cancelled, bill by bill. `sources` names the credit
       behind every slice, which is the only place the KIND survives the application walk. */
    for (const cov of position.perInstallment) {
      let offC = 0;
      for (const s of cov.sources) {
        if (isWriteOffKind(s.creditType)) offC += Math.round(s.amount * 100);
      }
      if (offC > 0) {
        placedC += offC;
        writtenOff.set(cov.installmentId, Math.round((writtenOff.get(cov.installmentId) ?? 0) * 100 + offC) / 100);
      }
    }
  }
  return { remaining, writtenOff, writtenOffPlaced: placedC / 100 };
}

/**
 * A credit that lowers a bill with no money behind it.
 *
 * ⚠ THE TWO KINDS, ONE RULE (owner R1). `forgiven` is minted from the settlement sheet and `other`
 * is what a coach types as an **Adjustment** — different doors, identical meaning here. The same
 * pair `lib/coach-dues-actual.ts` holds out of revenue; kept as a predicate rather than a second
 * list so a third kind can only ever be added in one place.
 */
function isWriteOffKind(creditType: string): boolean {
  return creditType === 'forgiven' || creditType === 'other';
}
