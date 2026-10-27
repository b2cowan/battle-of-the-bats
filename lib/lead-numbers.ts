/**
 * THE ONE DEFINITION of a lead's figures (Support console Stage 7 Part 2; owner Q2, Q3, Q9 c, S7-D4, 2026-10-27). Leads'
 * band and Numbers, Today's growth rows and Business numbers all count through here, over EVERY lead — never over a page
 * of rows. Pure (no database) so `tests/unit/support-console-stage7-numbers.test.ts` can pin it; the reads that feed it
 * live in `lib/lead-book.ts`.
 *
 *   · Arrived    — the lead's first form (`created_at`) falls in the period. A second form is the same lead.
 *   · Signed up  — a person linked a club or Coaches Portal to it (`linked_at`; an offered match confirmed, or by hand).
 *                  A demo club never counts. A deleted club still counts ("Signed up, club since deleted").
 *   · Pays now   — of those, the ones whose club pays today (`paysNow` in `lib/plan-growth.ts`).
 *   · Time to sign up — days from the first form to the club's or portal's CREATION, not the link (S7-D4).
 *   · Stuck      — an open lead (not Signed up, not Lost, not Waiting for launch) with no step change, note or follow-up
 *                  set for 30 days. Shown on Leads; never a Today queue.
 *
 * ⚠ A failed read is "Not read", never 0 and never 0%; a rate with nothing behind it is a dash (null).
 */
import type { EarlyAccessStatus } from './early-access-admin';
import { orgDayKey } from './timezone';
import { EARLY_ACCESS_PLAN_LABELS, LEAD_SOURCES, LEAD_SOURCE_LABELS, SOURCE_NOT_SET, leadPageLabel } from './early-access-admin';
import { linkTagLabel } from './lead-form-answers';

export const STUCK_DAYS = 30;
const DAY = 86_400_000;

export type LeadFacts = {
  id: string;
  createdAt: string;
  step: EarlyAccessStatus;
  linkedAt: string | null;
  signedUpAt: string | null;
  orgId: string | null;
  linkMethod: 'offered' | 'by_hand' | null;
  plans: string[];
  sourcePath: string | null;
  source: string | null;
  refTag: string | null;
  followUpDueAt: string | null;
  stepChangedAt: string;
  /** The newest note's date (a removed note still counts: someone worked the lead). */
  lastNoteAt: string | null;
  /** The newest edit that set or moved the follow-up (from the edit log). */
  lastFollowUpSetAt: string | null;
  /** Linked to a demo club: never Signed up. */
  demo: boolean;
};

/** Subscription starts were first recorded in the events table on this day (commit 6de082f2f); paying by month starts here. */
export const PAYING_RECORDED_FROM = '2026-10-25';

/**
 * Which linked clubs pay today, or that the billing records could not be read. `started` (Numbers only) is the clubs with
 * a recorded subscription start since PAYING_RECORDED_FROM; without it Month by month shows no paying figure.
 */
export type PayRead = { kind: 'read'; paying: ReadonlySet<string>; started?: ReadonlySet<string> } | { kind: 'not_read' };
/** New accounts in the period (demo clubs left out), or that they could not be read. */
export type AccountsRead = { kind: 'read'; created: { id: string; createdAt: string }[] } | { kind: 'not_read' };

export type Period = { from: string | null; to: string | null };

export function isOpen(step: EarlyAccessStatus): boolean {
  return step !== 'converted' && step !== 'lost';
}

export function isSignedUp(l: Pick<LeadFacts, 'linkedAt' | 'demo'>): boolean {
  return !!l.linkedAt && !l.demo;
}

function latest(...dates: (string | null)[]): number {
  return Math.max(...dates.map(d => (d ? new Date(d).getTime() : 0)));
}

/** Days the lead has sat on its step (the chip's line). */
export function daysOnStep(l: Pick<LeadFacts, 'stepChangedAt'>, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(l.stepChangedAt).getTime()) / DAY));
}

export function isStuck(l: LeadFacts, now: Date): boolean {
  if (!isOpen(l.step) || l.step === 'waiting_for_launch') return false;
  return now.getTime() - latest(l.stepChangedAt, l.lastNoteAt, l.lastFollowUpSetAt) >= STUCK_DAYS * DAY;
}

/** `today` is the console's calendar day, YYYY-MM-DD. */
export function followUpDue(l: Pick<LeadFacts, 'step' | 'followUpDueAt'>, today: string): boolean {
  return isOpen(l.step) && !!l.followUpDueAt && l.followUpDueAt <= today;
}

/** "Needs you": a new lead nobody has answered, a follow-up come due, a lead stuck 30 days, or a sign-up to confirm. */
export function needsYou(l: LeadFacts, now: Date, today: string, hasOffer: boolean): boolean {
  if (!isOpen(l.step)) return false;
  return l.step === 'new' || followUpDue(l, today) || isStuck(l, now) || hasOffer;
}

function rawDaysToSignUp(l: Pick<LeadFacts, 'createdAt' | 'signedUpAt'>): number | null {
  if (!l.signedUpAt) return null;
  return Math.round((new Date(l.signedUpAt).getTime() - new Date(l.createdAt).getTime()) / DAY);
}

/** A club that was made, by more than half a day, before the lead's first form: an existing customer filling the form. */
export function clubPredatesLead(l: Pick<LeadFacts, 'createdAt' | 'signedUpAt'>): boolean {
  const days = rawDaysToSignUp(l);
  return days !== null && days < 0;
}

/**
 * Days from the first form to the club's creation. null when there is no club date or the club was already there (it
 * did not sign up because of this lead, so it is left out of Time to sign up rather than counted as 0).
 */
export function daysToSignUp(l: Pick<LeadFacts, 'createdAt' | 'signedUpAt'>): number | null {
  const days = rawDaysToSignUp(l);
  return days === null || days < 0 ? null : Math.max(0, days); // max: Math.round of a small negative is -0
}

function inPeriod(at: string, p: Period): boolean {
  // The console's day (Eastern), the same day the period's bounds are in — never the UTC day, which is tomorrow after 8 p.m.
  const day = orgDayKey(at);
  return (!p.from || day >= p.from) && (!p.to || day <= p.to);
}

/** The middle value (the lower middle of an even count, so it is always a real lead's figure). */
function middle(sorted: number[]): number {
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

export type Spread = { middle: number; quickest: number; slowest: number } | null;

function spread(days: number[]): Spread {
  if (days.length === 0) return null;
  const s = [...days].sort((a, b) => a - b);
  return { middle: middle(s), quickest: s[0], slowest: s[s.length - 1] };
}

export type GroupRow = { key: string; label: string; leads: number; signedUp: number; rate: number | null; payNow: number | null; days: number | null };

function rate(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

function payingOf(signed: LeadFacts[], pay: PayRead): number | null {
  if (pay.kind === 'not_read') return null;
  return signed.filter(l => l.orgId && pay.paying.has(l.orgId)).length;
}

function groupRow(key: string, label: string, leads: LeadFacts[], pay: PayRead): GroupRow {
  const signed = leads.filter(isSignedUp);
  const days = spread(signed.map(daysToSignUp).filter((d): d is number => d !== null));
  return { key, label, leads: leads.length, signedUp: signed.length, rate: rate(signed.length, leads.length), payNow: payingOf(signed, pay), days: days?.middle ?? null };
}

function groupBy(leads: LeadFacts[], keysOf: (l: LeadFacts) => string[]): Map<string, LeadFacts[]> {
  const out = new Map<string, LeadFacts[]>();
  for (const l of leads) for (const k of keysOf(l)) out.set(k, [...(out.get(k) ?? []), l]);
  return out;
}

export type LeadNumbers = {
  arrived: number;
  signedUp: number;
  signedUpRate: number | null;
  offered: number;
  /** null = the billing records could not be read ("Not read"). */
  payNow: number | null;
  timeToSignUp: Spread;
  /** null = the accounts could not be read. */
  newAccounts: { total: number; withoutLead: number } | null;
  byPage: GroupRow[];
  byPlan: GroupRow[];
  bySource: GroupRow[];
  byTag: GroupRow[];
  /**
   * Oldest month first: YYYY-MM, how many arrived, how many of those have signed up so far, and how many of those
   * started a subscription (null for a month before subscription starts were recorded, or when they could not be read).
   */
  byMonth: { month: string; arrived: number; signedUp: number; started: number | null }[];
};

export function leadNumbers(all: LeadFacts[], period: Period, pay: PayRead, accounts: AccountsRead, linkedOrgIds: ReadonlySet<string>): LeadNumbers {
  const leads = all.filter(l => inPeriod(l.createdAt, period));
  const signed = leads.filter(isSignedUp);
  const time = spread(signed.map(daysToSignUp).filter((d): d is number => d !== null));

  const pages = groupBy(leads, l => [leadPageLabel(l.sourcePath)]);
  const byPage = [...pages].map(([label, ls]) => groupRow(label, label, ls, pay))
    .sort((a, b) => (a.label === 'Other pages' ? 1 : b.label === 'Other pages' ? -1 : b.leads - a.leads || a.label.localeCompare(b.label)));

  const plans = groupBy(leads, l => (l.plans.length ? l.plans : ['none']));
  const byPlan = [...plans].map(([k, ls]) => groupRow(k, k === 'none' ? 'None picked' : EARLY_ACCESS_PLAN_LABELS[k] ?? k, ls, pay))
    .sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : b.leads - a.leads));

  // Every source is a row, "Not set" first and never hidden, so the gap staff must fill stays in view.
  const sources = groupBy(leads, l => [l.source ?? 'not_set']);
  const bySource = ['not_set', ...LEAD_SOURCES].map(k =>
    groupRow(k, k === 'not_set' ? SOURCE_NOT_SET : LEAD_SOURCE_LABELS[k as keyof typeof LEAD_SOURCE_LABELS], sources.get(k) ?? [], pay));

  // By link tag (drawing J): drawn only once some lead in the period carries a tag. Then "No tag" is the first row (when any
  // lead has none), like "Not set", so the tagged rows are never mistaken for all of them.
  const tags = groupBy(leads, l => [l.refTag ?? 'no_tag']);
  const tagged = [...tags].filter(([k]) => k !== 'no_tag')
    .map(([k, ls]) => groupRow(k, linkTagLabel(k) ?? k, ls, pay)).sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label));
  const untagged = tags.get('no_tag') ?? [];
  const byTag = tagged.length ? [...(untagged.length ? [groupRow('no_tag', 'No tag', untagged, pay)] : []), ...tagged] : [];

  const months = groupBy(leads, l => [orgDayKey(l.createdAt).slice(0, 7)]);
  const byMonth = [...months].sort(([a], [b]) => a.localeCompare(b))
    .map(([month, ls]) => {
      const started = pay.kind === 'read' && pay.started && month >= PAYING_RECORDED_FROM.slice(0, 7)
        ? ls.filter(l => isSignedUp(l) && l.orgId && pay.started!.has(l.orgId)).length
        : null;
      return { month, arrived: ls.length, signedUp: ls.filter(isSignedUp).length, started };
    });

  let newAccounts: LeadNumbers['newAccounts'] = null;
  if (accounts.kind === 'read') {
    const created = accounts.created.filter(a => inPeriod(a.createdAt, period));
    newAccounts = { total: created.length, withoutLead: created.filter(a => !linkedOrgIds.has(a.id)).length };
  }

  return {
    arrived: leads.length,
    signedUp: signed.length,
    signedUpRate: rate(signed.length, leads.length),
    offered: signed.filter(l => l.linkMethod === 'offered').length,
    payNow: payingOf(signed, pay),
    timeToSignUp: time,
    newAccounts,
    byPage,
    byPlan,
    bySource,
    byTag,
    byMonth,
  };
}

/**
 * An account whose owner confirmed the address themselves, as far as the records can tell (the offered match; owner
 * build-gate answer 2026-10-27, "best signal, safe side"): we SENT a confirmation, it was confirmed, and the person has
 * signed in since. Nothing records who confirmed an address (census 2c), so anything less is not offered; staff can
 * still link by hand.
 */
export function selfConfirmed(a: { confirmation_sent_at: string | null; email_confirmed_at: string | null; last_sign_in_at: string | null }): boolean {
  if (!a.confirmation_sent_at || !a.email_confirmed_at || !a.last_sign_in_at) return false;
  return a.email_confirmed_at >= a.confirmation_sent_at && a.last_sign_in_at >= a.email_confirmed_at;
}

/** One normalising of an address, on both sides of the match. */
export function normalAddress(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export type StepCount ={ step: EarlyAccessStatus; count: number; stuck: number };

/** The pipeline band: every lead in each step, over all of them. */
export function stepCounts(all: LeadFacts[], now: Date): StepCount[] {
  const order: EarlyAccessStatus[] = ['new', 'contacted', 'qualified', 'pilot_candidate', 'waiting_for_launch', 'converted', 'lost'];
  return order.map(step => {
    const ls = all.filter(l => l.step === step);
    return { step, count: ls.length, stuck: ls.filter(l => isStuck(l, now)).length };
  });
}
