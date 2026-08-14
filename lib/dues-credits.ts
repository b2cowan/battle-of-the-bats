/**
 * Dues credit arithmetic — the PURE credit half of the money model, sibling of
 * lib/dues-payments.ts and held to the same standard: nothing here touches a database, and all
 * arithmetic is integer cents.
 *
 * A credit is MONEY THE TEAM OWES A FAMILY (owner model, 2026-08-14). Every credit dollar is
 * settled in exactly one of three ways, and is always in exactly one of those states:
 *
 *   credits issued = applied to bills + paid out + owed back
 *
 * - APPLIED — it lowered a real installment's "to send" figure; the family sends less cash.
 * - PAID OUT — the coach settled it in cash (rep_dues_payouts); the ledger has the money-out line.
 * - OWED BACK — it never found a bill to lower and was never paid out; the team is holding this
 *   family's money, and season's end hands it back.
 *
 * `credit_type = 'forgiven'` is the ONE exclusion from that identity: a forgiveness lowers bills
 * like any credit but is debt relief, not the family's money — it is never owed back and can
 * never be paid out. Forgiveness therefore applies to bills FIRST (before the family's own
 * credits), in EVERY mode including keep_separate: consuming a family's earned rebate on a bill
 * that a forgiveness would have cancelled would silently cost them cash they were owed.
 *
 * ⚠ CASH ALWAYS CLAIMS A BILL BEFORE A CREDIT DOES. Payments allocate first
 * (lib/dues-payments.ts, oldest-first); credits work only over the remainders, from the OTHER end
 * of the schedule (last bill first, by default) so the two never contest a dollar. This is what
 * makes the model self-correcting: a family that pays everything in cash anyway frees its credit
 * back to owed-back with no one editing anything. Pinned by test — do not reorder.
 *
 * ⚠ CREDIT APPLICATION IS DERIVED, NEVER STORED. No installment id ever lands on a credit row —
 * a stored allocation goes stale the moment dues change, a payment lands, or a credit resizes.
 * Same discipline (and same reason) as payment coverage next door.
 *
 * Before this module, summing rep_dues_credits by player was re-implemented independently in
 * four server call sites plus once more in the dues panel — five copies, zero tests. Every
 * credit figure quoted anywhere now starts from here (enforced by
 * tests/unit/dues-definition-guard.test.ts, the same guard that stopped stamp-sum copy five).
 */
import { allocateDuesPayments, type InstallmentCoverage, type AllocatableInstallment, type AllocatablePayment } from './dues-payments';

const toCents = (n: number) => Math.round(n * 100);
const toDollars = (c: number) => c / 100;

/** How a team's credits meet its bills — rep_program_years.credit_application (owner Call 2).
 *  `last_first` (default): credits eat the schedule from the far end, protecting the season's
 *  cash rhythm. `next_first`: relief lands on the next bill due. `keep_separate`: credits never
 *  touch bills (except forgiveness — see header) and every dollar waits for season's end. */
export type CreditApplicationMode = 'last_first' | 'next_first' | 'keep_separate';

export const CREDIT_APPLICATION_MODES: readonly CreditApplicationMode[] =
  ['last_first', 'next_first', 'keep_separate'];

/** The DB column is free text to the compiler — normalize unknowns to the default. */
export function normalizeCreditApplicationMode(value: unknown): CreditApplicationMode {
  return CREDIT_APPLICATION_MODES.includes(value as CreditApplicationMode)
    ? (value as CreditApplicationMode)
    : 'last_first';
}

/** Cents-safe total of a credit list — 0.1 + 0.2 !== 0.3 in a treasurer's favour or anyone's. */
export function creditsTotal(credits: readonly { amount: number }[]): number {
  return toDollars(credits.reduce((s, c) => s + toCents(c.amount), 0));
}

/** Per-player credit-dollar totals — the grouping every season-wide credit reader starts from.
 *  The exact mirror of paymentsTotalByPlayer (lib/dues-payments.ts), for the same reason: five
 *  hand-copied reduce loops preceded it. */
export function creditsTotalByPlayer(
  credits: readonly { playerId: string; amount: number }[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const c of credits) {
    totals.set(c.playerId, (totals.get(c.playerId) ?? 0) + toCents(c.amount));
  }
  for (const [k, v] of totals) totals.set(k, toDollars(v));
  return totals;
}

/** Per-player credit LISTS — the sibling of creditsTotalByPlayer for readers that need the rows,
 *  not just the total. Six hand-written grouping loops appeared in one day before this existed
 *  (the /simplify pass caught them) — the same regrowth pattern the sums had. */
export function groupByPlayer<T extends { playerId: string }>(
  credits: readonly T[],
): Map<string, T[]> {
  const byPlayer = new Map<string, T[]>();
  for (const c of credits) {
    const list = byPlayer.get(c.playerId);
    if (list) list.push(c); else byPlayer.set(c.playerId, [c]);
  }
  return byPlayer;
}

export interface ApplicableCredit {
  id: string;
  amount: number;
  /** 'fundraiser' | 'contribution' | 'overpayment' | 'other' | 'reimbursement' | 'forgiven' */
  creditType: string;
  /** YYYY-MM-DD (org-timezone date). */
  creditDate: string;
  /** Tiebreak for two credits dated the same day. */
  createdAt?: string | null;
  description?: string | null;
}

/** One credit's contribution to one installment — the "covered by fundraising — Bottle Drive"
 *  line is built from these. */
export interface CreditApplicationSlice {
  creditId: string;
  creditType: string;
  description: string | null;
  amount: number;
}

export interface InstallmentCreditCoverage {
  installmentId: string;
  installmentNumber: number;
  /** Cash still missing after payments (lib/dues-payments.ts `remaining`) — the input figure. */
  cashRemaining: number;
  /** Credit dollars applied to this installment. */
  creditApplied: number;
  /** What the family is actually asked to SEND: cashRemaining − creditApplied. THE figure
   *  reminders chase and every "to send" chip prints — never quote cashRemaining to a family
   *  once credits can land on bills. */
  toSend: number;
  /** No cash owing and nothing left to send — covered by payments, credits, or both. */
  settled: boolean;
  /** Which credits landed here, in the order they were consumed. */
  sources: CreditApplicationSlice[];
}

export interface PlayerCreditPosition {
  perInstallment: InstallmentCreditCoverage[];
  /** Σ non-forgiven credits — the money the team owes (or owed) this family. */
  creditsIssued: number;
  /** Σ forgiven credits (debt relief — outside the identity). */
  forgivenIssued: number;
  /** Non-forgiven dollars that lowered bills. */
  applied: number;
  /** Forgiven dollars that lowered bills (a forgiveness larger than the debt simply evaporates —
   *  there is nothing left to relieve and it was never the family's money). */
  forgivenApplied: number;
  /** Dollars settled in cash (rep_dues_payouts) — echoed input. */
  paidOut: number;
  /** creditsIssued − applied − paidOut: the family's money the team is holding. */
  owedBack: number;
  /** Σ toSend — dues − cash received − credits applied: the one number a family can act on. */
  leftToSend: number;
}

/** Credits in the order their dollars are spent: forgiveness first (see header), then by the day
 *  each was earned, then recorded, then id — the mirror of sortPaymentsForAllocation. */
export function sortCreditsForApplication<T extends ApplicableCredit>(credits: readonly T[]): T[] {
  const byAge = (a: T, b: T) =>
    a.creditDate.localeCompare(b.creditDate)
    || (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
    || a.id.localeCompare(b.id);
  const forgiven = credits.filter(c => c.creditType === 'forgiven').sort(byAge);
  const rest     = credits.filter(c => c.creditType !== 'forgiven').sort(byAge);
  return [...forgiven, ...rest];
}

export interface DuesPosition {
  /** Payment-side coverage (cash first — lib/dues-payments.ts). */
  coverage: InstallmentCoverage[];
  /** The three-state credit position over those remainders. */
  position: PlayerCreditPosition;
  /** installmentId → what the family is asked to SEND (net) — the map every reader builds. */
  toSendById: Map<string, number>;
}

/**
 * ONE player's whole dues position: cash allocates, credits land, the toSend map falls out.
 * This is THE assembly seam — eight call sites were hand-composing allocate → apply → map
 * before it existed (the /simplify pass caught the regrowth), and it is where Pass 2 wires
 * payouts: when rep_dues_payouts lands, `payouts` joins this signature and every reader is
 * already holding the corrected answer.
 */
export function deriveDuesPosition(opts: {
  installments: readonly AllocatableInstallment[];
  payments: readonly AllocatablePayment[];
  credits: readonly ApplicableCredit[];
  mode: CreditApplicationMode;
  /** Total already paid out in cash (rep_dues_payouts — Pass 2). Defaults to 0. */
  paidOut?: number;
}): DuesPosition {
  const { coverage } = allocateDuesPayments(opts.installments, opts.payments);
  const position = applyCreditsToBills({
    coverage,
    credits: opts.credits,
    paidOut: opts.paidOut,
    mode: opts.mode,
  });
  return {
    coverage,
    position,
    toSendById: new Map(position.perInstallment.map(c => [c.installmentId, c.toSend])),
  };
}

/**
 * Land a player's credits on their bills — over the CASH remainders payment allocation left
 * behind, from the direction the team's setting picks. Everything is derived; call it again
 * after any payment, credit, payout, or schedule change and the answer is simply true again.
 */
export function applyCreditsToBills(opts: {
  /** Payment-side coverage from allocateDuesPayments — cash has already claimed its bills. */
  coverage: readonly InstallmentCoverage[];
  credits: readonly ApplicableCredit[];
  /** Total already paid out in cash (rep_dues_payouts). Payout dollars are settled — they no
   *  longer lower bills, which is exactly why paying out a rebate puts the bills back up. */
  paidOut?: number;
  mode: CreditApplicationMode;
}): PlayerCreditPosition {
  const { coverage, credits, mode } = opts;
  // NaN would sail through Math.max and poison the reported totals — treat it as 0.
  const paidOutC = Number.isFinite(opts.paidOut) ? toCents(Math.max(0, opts.paidOut!)) : 0;

  const forgivenIssuedC = credits
    .filter(c => c.creditType === 'forgiven')
    .reduce((s, c) => s + toCents(c.amount), 0);
  const issuedC = credits
    .filter(c => c.creditType !== 'forgiven')
    .reduce((s, c) => s + toCents(c.amount), 0);

  // The spendable queue: forgiveness in full, then whatever non-forgiven money has NOT already
  // been settled in cash. Payouts consume the family's own credits oldest-first, so the queue
  // skips that many dollars from the front of the non-forgiven run.
  const ordered = sortCreditsForApplication(credits);
  let payoutLeftC = Math.min(paidOutC, issuedC);
  const queue = ordered.map(c => {
    let leftC = toCents(c.amount);
    if (c.creditType !== 'forgiven' && payoutLeftC > 0) {
      const consumed = Math.min(leftC, payoutLeftC);
      leftC -= consumed;
      payoutLeftC -= consumed;
    }
    return { credit: c, leftC };
  }).filter(q => q.leftC > 0);

  // keep_separate: only forgiveness may touch bills (header).
  const spendable = mode === 'keep_separate'
    ? queue.filter(q => q.credit.creditType === 'forgiven')
    : queue;

  // The direction the team chose. next_first walks the schedule the way cash does; last_first
  // starts at the far end so near-term installments keep their dates and amounts.
  const walk = [...coverage].sort((a, b) =>
    mode === 'last_first'
      ? b.installmentNumber - a.installmentNumber
      : a.installmentNumber - b.installmentNumber);

  let qi = 0;
  let appliedC = 0;
  let forgivenAppliedC = 0;
  const byInstallment = new Map<string, InstallmentCreditCoverage>();

  for (const inst of walk) {
    let need = toCents(inst.remaining);
    let creditAppliedC = 0;
    const sources: CreditApplicationSlice[] = [];
    while (need > 0 && qi < spendable.length) {
      const q = spendable[qi];
      if (q.leftC <= 0) { qi++; continue; }
      const take = Math.min(need, q.leftC);
      q.leftC -= take;
      need -= take;
      creditAppliedC += take;
      if (q.credit.creditType === 'forgiven') forgivenAppliedC += take;
      else appliedC += take;
      sources.push({
        creditId: q.credit.id,
        creditType: q.credit.creditType,
        description: q.credit.description ?? null,
        amount: toDollars(take),
      });
      if (q.leftC === 0) qi++;
    }
    byInstallment.set(inst.installmentId, {
      installmentId: inst.installmentId,
      installmentNumber: inst.installmentNumber,
      cashRemaining: inst.remaining,
      creditApplied: toDollars(creditAppliedC),
      toSend: toDollars(Math.max(0, toCents(inst.remaining) - creditAppliedC)),
      settled: toCents(inst.remaining) - creditAppliedC <= 0,
      sources,
    });
  }

  // Report back in the caller's original installment order, whatever direction we walked.
  const perInstallment = coverage.map(c => byInstallment.get(c.installmentId)!);
  const leftToSendC = perInstallment.reduce((s, i) => s + toCents(i.toSend), 0);

  return {
    perInstallment,
    creditsIssued: toDollars(issuedC),
    forgivenIssued: toDollars(forgivenIssuedC),
    applied: toDollars(appliedC),
    forgivenApplied: toDollars(forgivenAppliedC),
    paidOut: toDollars(Math.min(paidOutC, issuedC)),
    owedBack: toDollars(Math.max(0, issuedC - appliedC - Math.min(paidOutC, issuedC))),
    leftToSend: toDollars(leftToSendC),
  };
}
