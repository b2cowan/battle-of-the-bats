/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A CLUB BILL, SPLIT AMONG ITS TEAMS (Club Tier Stage 3c, Ask 6 — New allocation, one form for both doors).
 *
 * The split and the payment schedule are chosen ONCE per bill — Evenly · By amount · By percentage · By sessions;
 * one payment, or installments on dates — and a team's row may carry its own installments. Every share and every
 * installment is worked out in CENTS and adds up exactly: the closing row's sum IS the amount (a remainder cent
 * goes to each of the first teams, or the first installments — "231.25 → 115.63 + 115.62").
 *
 * Pure: no database, no server imports (lib/club-budget-writes.ts `createClubAllocation` reads it, and so do the
 * unit tests). A refusal is the one coded shape every club money step answers with.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { isCalendarDate } from './timezone';
import { toCents, toDollars } from './coach-register';
import type { Moved, Refused } from './club-money-route';

// lib/club-money-route.ts's `refused`, typed by its one `Refused` (so the shape cannot drift): that module is server-only, this one is pure.
const refused = (status: number, body: object): Refused => ({ ok: false, status, body });

const MAX_AMOUNT = 9_999_999.99;

/** An amount off a request, to the cent — or null when it is not one above zero. */
export function readAmount(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT ? toDollars(toCents(n)) : null;
}

export type BillSplitMethod = 'even' | 'fixed' | 'percentage' | 'sessions';

/**
 * New allocation's body (Ask 6). The split and the payment schedule are chosen ONCE per bill; a team's row may
 * carry its own installments.
 *   · `amount` — the bill, in dollars to the cent; from a line, no more than is left on it.
 *   · `split.method` — even (Evenly: the cents shared out, a remainder cent to each of the first teams) · fixed
 *     (By amount: each team's `value` is its share, and the shares must add up to the amount — the refusal says
 *     the difference) · percentage (each `value` a percent; they add up to 100) · sessions (each `value` a count).
 *   · `schedule` — `{ kind: 'one', dueDate }` or `{ kind: 'installments', dueDates: [...] }` (each team's share
 *     spread evenly over the dates, a remainder cent to the first).
 *   · `teams[].installments` — this team's own payments `[{ dueDate, amount }]`, adding up to its share.
 *   · `sourceBudgetLineId` — the line it bills from; absent/null = an off-plan bill (it counts in the year its
 *     first payment falls due).
 */
export interface BillInput {
  description: unknown;
  amount: unknown;
  sourceBudgetLineId?: unknown;
  split: { method: unknown };
  schedule: { kind: unknown; dueDate?: unknown; dueDates?: unknown };
  teams: unknown;
  notes?: unknown;
}

/** One team's share of a bill and its payments, ready for the database step. */
export type CleanSplit = {
  teamId: string; programYearId: string; amount: number; splitValue: number; paymentSchedule: 'standard' | 'custom';
  notes: string | null; installments: { installmentNumber: number; amount: number; dueDate: string }[];
};

/** Shares of `totalC` cents by weights, to the cent, adding up exactly: the largest remainders take the leftover
 *  cents, ties to the earlier row (Evenly's "a remainder cent to each of the first teams"). */
export function shareCents(totalC: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map(w => (totalC * w) / sum);
  const out = raw.map(Math.floor);
  let left = totalC - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, rem: r - Math.floor(r) })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k].i]++;
  return out;
}

/**
 * Turn New allocation's body (Ask 6) into each team's share and payments — the closing row adds up to the amount,
 * to the cent. Pure: no database. Refusals carry the figure (the difference for By amount).
 */
export function billSplits(
  body: Pick<BillInput, 'amount' | 'split' | 'schedule' | 'teams'>,
): Moved<{ method: BillSplitMethod; amount: number; splits: Omit<CleanSplit, 'teamId' | 'programYearId'>[]; teams: { teamId: string; programYearId: string }[] }> {
  const amount = readAmount(body.amount);
  if (amount === null) return refused(400, { error: 'The amount must be above zero.', code: 'bad_total' });
  const method = body.split?.method as BillSplitMethod;
  if (!['even', 'fixed', 'percentage', 'sessions'].includes(method)) return refused(400, { error: 'Choose how the bill is split.', code: 'bad_split' });
  if (!Array.isArray(body.teams) || body.teams.length === 0) return refused(400, { error: 'Bill at least one team.', code: 'splits_required' });
  const teams = body.teams as Record<string, unknown>[];
  if (new Set(teams.map(t => t?.teamId)).size !== teams.length) return refused(400, { error: 'Each team is billed once on a bill.', code: 'bad_split' });

  // The bill's schedule (once per bill).
  const kind = body.schedule?.kind;
  const dueDates: string[] = kind === 'one' ? [body.schedule.dueDate as string]
    : kind === 'installments' && Array.isArray(body.schedule.dueDates) ? body.schedule.dueDates as string[] : [];
  if (dueDates.length === 0 || dueDates.some(d => typeof d !== 'string' || !isCalendarDate(d))) {
    return refused(400, { error: 'Each payment needs a due date.', code: 'bad_installment' });
  }

  // Each team's share, in cents.
  const totalC = toCents(amount);
  let sharesC: number[];
  const values = teams.map(t => Number(t?.value));
  if (method === 'even') sharesC = shareCents(totalC, teams.map(() => 1));
  else if (method === 'fixed') {
    sharesC = values.map(v => (Number.isFinite(v) && v > 0 ? toCents(v) : NaN));
    if (sharesC.some(c => !Number.isFinite(c))) return refused(400, { error: 'Each team’s share must be above zero.', code: 'bad_split' });
    const diffC = totalC - sharesC.reduce((a, b) => a + b, 0);
    if (diffC !== 0) {
      const difference = toDollars(Math.abs(diffC));
      return refused(400, {
        error: diffC > 0 ? `The teams’ shares are $${difference.toFixed(2)} short of the amount.` : `The teams’ shares are $${difference.toFixed(2)} more than the amount.`,
        code: 'shares_dont_add_up', difference: toDollars(diffC),
      });
    }
  } else {
    if (values.some(v => !Number.isFinite(v) || v <= 0)) {
      return refused(400, { error: method === 'percentage' ? 'Each team needs a percentage above zero.' : 'Each team needs a session count above zero.', code: 'bad_split' });
    }
    // In hundredths of a percent, so a float artefact never decides it (33.33 × 3 is 99.99, within a hundredth).
    const hundredths = Math.round(values.reduce((a, b) => a + b, 0) * 100);
    if (method === 'percentage' && Math.abs(hundredths - 10000) > 1) {
      return refused(400, { error: `The percentages add up to ${hundredths / 100}%, not 100%.`, code: 'percentages_dont_add_up' });
    }
    sharesC = shareCents(totalC, values);
  }
  if (sharesC.some(c => c <= 0)) return refused(400, { error: 'Each team’s share must be above zero.', code: 'bad_split' });
  // Every payment at least a cent: a share smaller than its number of dates would leave $0.00 payments.
  if (sharesC.some(c => c < dueDates.length)) {
    return refused(400, { error: 'A team’s share is too small to spread over that many payments.', code: 'bad_installment' });
  }

  const splits: Omit<CleanSplit, 'teamId' | 'programYearId'>[] = [];
  for (const [n, t] of teams.entries()) {
    const shareC = sharesC[n];
    let installments: CleanSplit['installments'];
    if (Array.isArray(t?.installments) && t.installments.length > 0) {
      installments = [];
      for (const [k, i] of (t.installments as Record<string, unknown>[]).entries()) {
        const due = readAmount(i?.amount);
        if (typeof i?.dueDate !== 'string' || !isCalendarDate(i.dueDate) || due === null) {
          return refused(400, { error: 'Each installment needs a due date and an amount.', code: 'bad_installment' });
        }
        installments.push({ installmentNumber: k + 1, amount: due, dueDate: i.dueDate });
      }
      const instC = installments.reduce((a, i) => a + toCents(i.amount), 0);
      if (instC !== shareC) {
        return refused(400, {
          error: `A team’s payments add up to $${toDollars(instC).toFixed(2)}, and its share is $${toDollars(shareC).toFixed(2)}.`,
          code: 'installments_dont_add_up', teamId: t.teamId ?? null,
        });
      }
    } else {
      installments = shareCents(shareC, dueDates.map(() => 1)).map((c, k) => ({ installmentNumber: k + 1, amount: toDollars(c), dueDate: dueDates[k] }));
    }
    splits.push({
      amount: toDollars(shareC),
      splitValue: method === 'even' ? 0 : method === 'fixed' ? toDollars(shareC) : values[n],
      paymentSchedule: installments.length > 1 ? 'custom' : 'standard',
      notes: typeof t?.notes === 'string' ? t.notes.trim().slice(0, 500) || null : null,
      installments,
    });
  }
  return {
    ok: true, method, amount, splits,
    teams: teams.map(t => ({ teamId: String(t?.teamId ?? ''), programYearId: String(t?.programYearId ?? '') })),
  };
}
