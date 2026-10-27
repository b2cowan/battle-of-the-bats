/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * BILL THE TEAMS FROM THE SCHEDULE — the arithmetic (Club Tier Stage 11a, part A; Ask 23, build question B — hub
 * K4MPu4ni53Ct7yrDcmWJd9 → Stages 10 + 11, specimen 14 step 4). Pure and client-safe; the unit test is the dome's own
 * check (`tests/unit/club-schedule-bill.test.ts`): $27,000.00 → Senior $2,700.00, Junior $4,050.00, and every two months
 * from Oct 1 → $972.00 / $864.00 / $864.00 and $1,458.00 / $1,296.00 / $1,296.00.
 *
 *   · BY THE TIME EACH TEAM GOT: each slot's minutes × its field's price share (the permit's — 10a's `fieldPrices`: a
 *     full field 1, a half 0.5) is the team's PRICED time; a slot two teams share is split between them. The bill is
 *     the time at the permit's price — an hour of a full field (cost ÷ the full-field hours the permit holds) — or a
 *     PART of it the teams pay when the club covers some; either way every team's share is the bill shared by priced
 *     time, by largest remainder to the cent (`shareCents`), so the closing row is the bill exactly.
 *   · PAYMENTS THAT FOLLOW THE TIME: the plan cuts the season into periods (one · monthly · every two months · dates the
 *     club chooses); each payment is that team's priced time in its period, due on the period's first day. A slot before
 *     the first due date falls in the first payment; a period a team has no time in is no payment of that team's.
 *   · A CHANGE AFTER FINALIZE (build question B, ruled 2026-10-11): each team's share now, at the first bill's RATE (cents
 *     per full-field minute), against what it was as of the last send. A gain is a correction bill; a loss is what the
 *     team is owed back — told, never billed negatively; the first bill never changes.
 *
 * Money in CENTS throughout (integers): a share is never a float a cent away from the closing row.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { shareCents } from './club-bill-split';
import { toCents, toDollars } from './coach-register';
import { addCalendarMonths } from './timezone';
import { teamsOnly } from './club-schedule-holders';

const MIN = 60_000;

/** A slot as the bill reads it: its time, its field's price share, the teams that have it. */
export interface BillSlot {
  day: string;
  startMs: number;
  endMs: number;
  /** The field's price share in the permit (1 = Full, 0.5 = Half); 1 without a permit. */
  weight: number;
  teamIds: readonly string[];
}

export type PaymentPlan = 'one' | 'monthly' | 'two_months' | 'dates';

/** Each team's priced minutes — Σ a slot's minutes × its field's share, a shared slot split evenly among its teams. */
export function pricedMinutes(slots: readonly BillSlot[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of slots) {
    if (!s.teamIds.length) continue;
    const each = ((s.endMs - s.startMs) / MIN) * s.weight / s.teamIds.length;
    for (const t of s.teamIds) out.set(t, (out.get(t) ?? 0) + each);
  }
  return out;
}

export interface BillShares {
  /** What the teams are billed, in cents — the closing row. */
  totalCents: number;
  /** The time at the permit's price, in cents (null when no permit prices it). */
  timePriceCents: number | null;
  /** Each team's share, in cents, in the order the teams were given. */
  shares: Map<string, number>;
  /** The rate billed at: cents per full-field minute (stored at Finalize; corrections bill at it). */
  rate: number;
}

/**
 * THE SPLIT, BY THE TIME EACH TEAM GOT. `fullHour` is the permit's hour of a full field (dollars) or null; `amount` is
 * the part the teams pay (dollars) or null for the whole time's price. Null when there is nothing to bill (no time, or
 * no price and no amount).
 */
export function billShares(priced: ReadonlyMap<string, number>, opts: { fullHour: number | null; amount: number | null; teamOrder?: readonly string[] }): BillShares | null {
  // House league is never billed (11b·A): its time is on no bill, whatever order a caller passes.
  const order = teamsOnly(opts.teamOrder ?? [...priced.keys()]).filter(t => (priced.get(t) ?? 0) > 0);
  const minutes = order.reduce((n, t) => n + priced.get(t)!, 0);
  if (!order.length || minutes <= 0) return null;
  const timePriceCents = opts.fullHour != null ? Math.round((minutes / 60) * opts.fullHour * 100) : null;
  const totalCents = opts.amount != null ? toCents(opts.amount) : timePriceCents;
  if (totalCents == null || totalCents <= 0) return null;
  const cents = shareCents(totalCents, order.map(t => priced.get(t)!));
  return { totalCents, timePriceCents, shares: new Map(order.map((t, i) => [t, cents[i]])), rate: totalCents / minutes };
}

/**
 * WHAT ONE SLOT COST A TEAM (Stage 11d, Ask 1 — "the Sundays at what the club billed for each"): the team's priced
 * minutes for it (`pricedMinutes`' rule — minutes × the field's price share ÷ the teams on it, so a shared slot is the
 * team's half) at the rate the club billed the schedule (`club_schedules.bill_scale`, cents per full-field minute —
 * the first bill's and every correction's one rate), to the cent. The dome's Sunday: 90 minutes × 1 × 120 = 10800 c.
 * A team's own share ÷ its minutes differs from the rate only by the split's rounding cent.
 */
export function slotFigure(p: { startMs: number; endMs: number; weight: number; teams: number; scale: number | null }): { pricedMinutes: number; cents: number } {
  const pricedMinutes = ((p.endMs - p.startMs) / MIN) * p.weight / Math.max(1, p.teams);
  return { pricedMinutes, cents: p.scale ? Math.round(pricedMinutes * p.scale) : 0 };
}

/** One payment period: due on `due`, covering the slots from `from` up to (not including) `until`. */
export interface PaymentPeriod {
  due: string;
  from: string;
  until: string | null;
}

/**
 * THE PLAN'S PERIODS. `one`: a single payment on `firstDue`. `monthly` / `two_months`: from `firstDue`, a period every
 * one or two months while it starts on or before the schedule's last day. `dates`: the club's own dates, each period up
 * to the next. A slot before the first date always falls in the first period.
 */
export function paymentPeriods(plan: PaymentPlan, opts: { firstDue: string | null; dates: readonly string[] | null; lastDay: string }): PaymentPeriod[] {
  if (plan === 'dates') {
    const dates = [...new Set(opts.dates ?? [])].sort();
    return dates.map((due, i) => ({ due, from: i === 0 ? '0000-01-01' : due, until: dates[i + 1] ?? null }));
  }
  if (!opts.firstDue) return [];
  if (plan === 'one') return [{ due: opts.firstDue, from: '0000-01-01', until: null }];
  const step = plan === 'monthly' ? 1 : 2;
  const starts: string[] = [];
  for (let k = 0, d = opts.firstDue; d <= opts.lastDay || k === 0; k++, d = addCalendarMonths(opts.firstDue, k * step)) {
    starts.push(d);
    if (starts.length > 60) break;
  }
  return starts.map((due, i) => ({ due, from: i === 0 ? '0000-01-01' : due, until: starts[i + 1] ?? null }));
}

const inPeriod = (p: PaymentPeriod, day: string) => day >= p.from && (p.until === null || day < p.until);

export interface Installment { installmentNumber: number; amount: number; dueDate: string }

/**
 * ONE TEAM'S PAYMENTS: its share spread over the periods by its priced time in each (largest remainder to the cent),
 * a period with none of its time dropped, numbered from 1. A share too small for its payments (fewer cents than
 * payments) is one payment, on the first.
 */
export function teamInstallments(teamId: string, shareCentsTotal: number, slots: readonly BillSlot[], periods: readonly PaymentPeriod[]): Installment[] {
  if (!periods.length || shareCentsTotal <= 0) return [];
  const weights = periods.map(p => slots.reduce((n, s) => (s.teamIds.includes(teamId) && inPeriod(p, s.day)
    ? n + ((s.endMs - s.startMs) / MIN) * s.weight / s.teamIds.length : n), 0));
  const live = periods.map((p, i) => ({ p, w: weights[i] })).filter(x => x.w > 0);
  if (!live.length) return [{ installmentNumber: 1, amount: toDollars(shareCentsTotal), dueDate: periods[0].due }];
  if (shareCentsTotal < live.length) return [{ installmentNumber: 1, amount: toDollars(shareCentsTotal), dueDate: live[0].p.due }];
  const cents = shareCents(shareCentsTotal, live.map(x => x.w));
  return live.map((x, i) => ({ installmentNumber: i + 1, amount: toDollars(cents[i]), dueDate: x.p.due }));
}

/** The closing row (specimen 14): does what the teams pay match what the permit costs? */
export type ClosingRow =
  | { kind: 'matches'; permitCents: number }
  | { kind: 'club_covers'; permitCents: number; differenceCents: number }
  | { kind: 'more_than_permit'; permitCents: number; differenceCents: number }
  | { kind: 'no_permit_cost' };

export function closingRow(totalCents: number, permitCost: number | null): ClosingRow {
  if (permitCost == null) return { kind: 'no_permit_cost' };
  const permitCents = toCents(permitCost);
  const diff = permitCents - totalCents;
  if (Math.abs(diff) <= 1) return { kind: 'matches', permitCents };
  return diff > 0 ? { kind: 'club_covers', permitCents, differenceCents: diff } : { kind: 'more_than_permit', permitCents, differenceCents: -diff };
}

/** What club_allocation_create takes for one team: its share, `time` split, its priced hours, its own payments. */
export interface TimeSplit {
  teamId: string;
  programYearId: string;
  amount: number;
  splitValue: number;
  paymentSchedule: 'standard' | 'custom';
  notes: string | null;
  installments: Installment[];
}

/**
 * THE BILL, READY FOR THE ONE STEP (Finalize): each team's share and its payments. `seasons` names each team's running
 * season (a team without one can't be billed — the caller refuses first, in words).
 */
export function timeSplits(p: {
  slots: readonly BillSlot[];
  shares: BillShares;
  periods: readonly PaymentPeriod[];
  seasons: ReadonlyMap<string, string>;
  priced: ReadonlyMap<string, number>;
}): TimeSplit[] {
  return [...p.shares.shares].map(([teamId, cents]) => {
    const installments = teamInstallments(teamId, cents, p.slots, p.periods);
    return {
      teamId, programYearId: p.seasons.get(teamId) ?? '',
      amount: toDollars(cents),
      // The team's priced hours, to the hundredth (mig 326: `split_value` = the hours the split weighed).
      splitValue: Math.round(((p.priced.get(teamId) ?? 0) / 60) * 100) / 100,
      paymentSchedule: installments.length > 1 ? 'custom' : 'standard',
      notes: null,
      installments,
    };
  });
}

/**
 * EACH TEAM'S SHARE AS IT STANDS NOW, at the first bill's rate — the corrections' figure. The bill now is the priced
 * time × the rate, shared by priced time in `teamOrder` (the first bill's order, so the rounding is the same rule).
 */
export function sharesAtRate(priced: ReadonlyMap<string, number>, rate: number, teamOrder?: readonly string[]): Map<string, number> {
  const order = teamsOnly(teamOrder ?? [...priced.keys()]).filter(t => (priced.get(t) ?? 0) > 0);
  const minutes = order.reduce((n, t) => n + priced.get(t)!, 0);
  if (!order.length) return new Map();
  const cents = shareCents(Math.round(minutes * rate), order.map(t => priced.get(t)!));
  return new Map(order.map((t, i) => [t, cents[i]]));
}

/**
 * EACH TEAM'S VALUE AFTER THE CHANGES — the next baseline. Only a team the changes `touched` (its practices moved, came or
 * went, or it handed time back) is measured again at the rate; every other team keeps its value to the cent. Re-sharing
 * the whole bill moves a rounding cent between teams whose time never changed, and that cent would be billed or owed
 * back (/review 2026-10-11). A team new to the bill takes its value at the rate.
 */
export function valuesAfterChanges(before: Readonly<Record<string, number>>, atRate: ReadonlyMap<string, number>, touched: ReadonlySet<string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of new Set([...Object.keys(before), ...atRate.keys()])) {
    const v = touched.has(t) || before[t] === undefined ? atRate.get(t) ?? 0 : before[t];
    if (v > 0) out.set(t, v);
  }
  return out;
}

/**
 * BUILD QUESTION B (ruled 2026-10-11): each team's difference since the last send. A team that GAINED time is billed the
 * difference (a correction bill); a team that LOST time is OWED the difference back (told; it asks the club on Money ›
 * Club). Cents, positive both ways; a team with no difference is in neither.
 */
export function billCorrections(before: Readonly<Record<string, number>>, now: ReadonlyMap<string, number>): { gains: Map<string, number>; losses: Map<string, number> } {
  const gains = new Map<string, number>(), losses = new Map<string, number>();
  const teams = new Set([...Object.keys(before), ...now.keys()]);
  for (const t of teams) {
    const d = (now.get(t) ?? 0) - (before[t] ?? 0);
    if (d > 0) gains.set(t, d);
    else if (d < 0) losses.set(t, -d);
  }
  return { gains, losses };
}

/**
 * A CORRECTION'S PAYMENTS: the gain spread over the plan's periods by the gained slots' time, each due on its period's
 * day or today, whichever is later (a period already due is due now); two payments due the same day are one. With no
 * gained slot to place it (a move to a pricier field), one payment, due on the next period's day or today.
 */
export function correctionInstallments(deltaCents: number, teamId: string, gained: readonly BillSlot[], periods: readonly PaymentPeriod[], today: string): Installment[] {
  if (deltaCents <= 0) return [];
  const later = (d: string) => (d > today ? d : today);
  const fallback = later(periods.find(p => p.due >= today)?.due ?? today);
  const placeable = gained.some(s => s.teamIds.includes(teamId));
  const spread = placeable ? teamInstallments(teamId, deltaCents, gained, periods.length ? periods : [{ due: fallback, from: '0000-01-01', until: null }]) : [];
  const byDue = new Map<string, number>();
  for (const i of spread.length ? spread : [{ installmentNumber: 1, amount: toDollars(deltaCents), dueDate: fallback }]) {
    const due = later(i.dueDate);
    byDue.set(due, (byDue.get(due) ?? 0) + toCents(i.amount));
  }
  const sum = [...byDue.values()].reduce((a, b) => a + b, 0);
  if (sum !== deltaCents) return [{ installmentNumber: 1, amount: toDollars(deltaCents), dueDate: fallback }];
  return [...byDue].sort(([a], [b]) => a.localeCompare(b)).map(([dueDate, c], i) => ({ installmentNumber: i + 1, amount: toDollars(c), dueDate }));
}
