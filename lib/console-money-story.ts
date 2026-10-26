/**
 * The Story's money (Support console Stage 3, owner Q4 A; drawing D): the charges and the refunds made in Stripe's
 * dashboard come from the Money tab's ONE live read of Stripe, merged on screen into the Story the server built (which
 * already holds what we keep: purchases, plan moves, missed and recovered payments, refunds made in this console). Every
 * money entry is a fact: none is ever offered Put it back (R5). Plain, so the screen and the tests share it.
 */
import { consoleWhen } from './console-dates';
import {
  findPatterns, formatCents, periodWords, planCycleWords, failureWords, type MoneyRead,
} from './console-money';
import type { StoryEntry } from './platform-story-view';
import { cap } from './platform-labels';

const HOUR = 3_600_000;
const near = (a: string, b: string, ms: number) => Math.abs(Date.parse(a) - Date.parse(b)) <= ms;

/** How a console refund's title ends until Stripe is read; the screen then names the charge by its moment. */
export const CONSOLE_REFUND_TAIL = ' of a charge';
export const STRIPE_WHO = 'Stripe';
export const DASHBOARD_WHO = 'In Stripe’s dashboard';

/** The base Story with Stripe's charges and dashboard refunds merged in, newest first. */
export function mergeMoneyIntoStory(base: readonly StoryEntry[], read: MoneyRead, ourSubscriptionId: string | null, portalSubscriptionIds: readonly string[] = []): StoryEntry[] {
  const entries = base.map(e => ({ ...e }));
  const byKey = new Map(entries.map(e => [e.key, e] as const));
  const { flags } = findPatterns(read, ourSubscriptionId, portalSubscriptionIds);
  const chargeById = new Map(read.charges.map(c => [c.id, c] as const));
  const used = new Set<string>();
  /** The nearest base entry, by title, that a charge belongs to (a purchase, a plan move, a missed or recovered payment). */
  const claim = (test: (e: StoryEntry) => boolean, at: string, within: number): StoryEntry | null => {
    const hit = entries.filter(e => !used.has(e.key) && test(e) && near(e.at, at, within))
      .sort((a, b) => Math.abs(Date.parse(a.at) - Date.parse(at)) - Math.abs(Date.parse(b.at) - Date.parse(at)))[0];
    if (hit) used.add(hit.key);
    return hit ?? null;
  };

  // A console refund the server knows: name its charge by the moment it was made (two charges can share a day).
  for (const e of entries) {
    if (!e.chargeId) continue;
    const c = chargeById.get(e.chargeId);
    if (c && e.title.endsWith(CONSOLE_REFUND_TAIL)) e.title = `${e.title.slice(0, -CONSOLE_REFUND_TAIL.length)} of the ${consoleWhen(c.createdAt)} charge`;
  }

  for (const c of read.charges) {
    const amount = formatCents(c.amountCents, c.currency);
    const inv = c.invoice;
    const flag = flags.get(c.id);
    if (c.status === 'failed') {
      const missed = claim(e => e.moneyEvent === 'missed', c.createdAt, 72 * HOUR);
      if (missed) missed.sub = cap(failureWords(c.failureCode));
      continue;
    }
    if (flag?.kind === 'retry_paid') {
      const recovered = claim(e => e.moneyEvent === 'recovered', c.createdAt, 72 * HOUR);
      if (recovered) { recovered.sub = `Stripe tried again: ${amount} paid`; continue; }
    }
    if (inv?.billingReason === 'subscription_create') {
      const bought = claim(e => e.moneyEvent === 'bought', c.createdAt, 24 * HOUR);
      if (bought) { bought.sub = `Charged ${amount}`; continue; }
    }
    if (inv?.billingReason === 'subscription_update') {
      const moved = claim(e => e.moneyEvent === 'moved', c.createdAt, HOUR);
      if (moved) { moved.sub = `Charged ${amount} for the part month`; continue; }
    }
    const key = `charge:${c.id}`;
    if (byKey.has(key)) continue;
    const manual = !inv || !inv.subscriptionId;
    const period = inv ? periodWords(inv.periodStart, inv.periodEnd, { withYear: false }) : null;
    const title = !inv ? `Charged ${amount}: a charge made in Stripe`
      : !inv.subscriptionId ? `Charged ${amount}: an invoice made in Stripe${inv.description ? ` “${inv.description}”` : ''}`
      : inv.billingReason === 'subscription_update' ? `Charged ${amount}: the part month after a plan move`
      : `Charged ${amount}: ${planCycleWords(inv.planId, inv.cycle)}${period ? `, ${period}` : ''}`;
    entries.push({ key, at: c.createdAt, kind: 'billing', title,
      who: manual ? DASHBOARD_WHO : STRIPE_WHO, why: null, ...(c.status === 'pending' ? { sub: 'Pending in Stripe' } : {}) });
  }

  // A refund made in Stripe's dashboard (no console number in its metadata) that the console does not already show.
  for (const c of read.charges) {
    for (const r of c.refunds) {
      if (r.ourRefundId || byKey.has(`refund:${r.id}`)) continue;
      if (r.status !== 'succeeded' && r.status !== 'pending') continue;
      entries.push({
        key: `refund:${r.id}`, at: r.createdAt, kind: 'billing',
        title: `Refunded ${formatCents(r.amountCents, c.currency)} of the ${consoleWhen(c.createdAt)} charge`,
        sub: 'To the card it came from', who: DASHBOARD_WHO, why: 'Made outside the console',
      });
    }
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at));
}
