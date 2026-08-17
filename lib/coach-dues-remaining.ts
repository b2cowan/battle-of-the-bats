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
  for (const [playerId, insts] of instsByPlayer) {
    const { toSendById } = deriveDuesPosition({
      installments: insts.map(i => ({
        id: i.id, installmentNumber: i.installmentNumber, amount: i.amount, paidAt: i.paidAt,
      })),
      payments: (paysByPlayer.get(playerId) ?? []).map(p => ({
        id: p.id, amount: p.amount, receivedDate: p.receivedDate, createdAt: p.createdAt,
      })),
      credits: creditsByPlayer.get(playerId) ?? [],
      paidOut: paidOutByPlayer.get(playerId) ?? 0,
      mode,
    });
    for (const [id, toSend] of toSendById) remaining.set(id, toSend);
  }
  return remaining;
}
