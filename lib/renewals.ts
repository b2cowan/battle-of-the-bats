/**
 * CUSTOMERS › RENEWALS — the words and the rules (Plans & pricing Stage 2 Part 4a; drawings PqUgoHqg57j1SGSo2YypjP, owner
 * ruled all ten asks as recommended 2026-11-07). Pure and client-safe: no database, no Stripe. The reads are
 * `lib/renewals-read.ts`; the page and its export both build their rows HERE, so the file holds what the screen shows.
 *
 *   • Coming up: every plan that renews or ends in the dates picked, from OUR records (no Stripe call). The price is the
 *     price on file (migration 418), before tax and discounts; "a month" / "a year" only when the record holds the cycle.
 *   • Unpaid bills: open and written-off bills from our own invoice record (migration 451), in the site's Stripe mode.
 *     The bank's reason and the next try stay on the club's Money tab (ruling 10).
 *
 * ⚖ A total never adds two currencies, a price to a tax, or test to live. A figure that could not be read is "—", never 0.
 * ⚖ Never "lost revenue", "failed revenue" or "churn": an unpaid bill is still a sale and still owes its tax
 *   (`docs/agents/accounting/UNPAID_SUBSCRIPTION_INVOICES.md`).
 * ⚖ No person's name, email, address, card or decline reason: a Coaches Portal shows the team's name (the portal's own
 *   record name); a bill bought by an individual with no club reads "Coach" (`/legal` STAFF_CROSS_CLUB_BILLING_LISTS.md).
 */
import { addCalendarDays, addCalendarMonths, formatStoredDate, lastDayOfMonth, orgDayKey, parseDateOnlyParts, SHORT_MONTHS } from './timezone';
import { pluralize } from './utils';
import { formatCents } from './console-money';
import { planLabel } from './platform-labels';
import { lastDayOfInstant } from './free-time';
import { isTeamWorkspaceOrg } from './team-workspace-kind';

// ── F2 · the one rule for "trial ending" ────────────────────────────────────────────────────────

/** How far ahead Today's "Trials ending" looks, in Ontario days. */
export const TRIAL_WINDOW_DAYS = 14;

/**
 * A Stripe trial whose end date falls from today to 14 days out, in Ontario days (F2, owner ruling 9). Today's count,
 * Clubs & portals' "Trials ending soon" filter and Renewals all read THIS. A trial whose date has passed is not ending:
 * it is `isStaleTrial`, shown on Renewals in amber and counted nowhere else.
 */
export function isTrialEnding(status: string | null | undefined, periodEnd: string | null | undefined, today: string, days = TRIAL_WINDOW_DAYS): boolean {
  if (status !== 'trialing' || !periodEnd) return false;
  const day = orgDayKey(periodEnd);
  return day >= today && day <= addCalendarDays(today, days);
}

/** Marked as on trial, but the trial's end date has passed ("Trial ended, still marked trial"). */
export function isStaleTrial(status: string | null | undefined, periodEnd: string | null | undefined, today: string): boolean {
  return status === 'trialing' && !!periodEnd && orgDayKey(periodEnd) < today;
}

// ── F1 · the comped clubs the monthly figure leaves out ──────────────────────────────────────────

/**
 * " · 2 comped clubs not counted" after Business numbers' (and Today's) "about $X a month at list price, before tax" (F1,
 * owner ruling 8): a comped club (a running comp period, Founding Season) pays nothing, so the figure leaves it out and says
 * how many. Nothing when none were left out.
 */
export function compedNotCountedWords(n: number | null | undefined): string {
  if (!n) return '';
  return ` · ${n} comped ${n === 1 ? 'club' : 'clubs'} not counted`;
}

// ── The words ───────────────────────────────────────────────────────────────────────────────────

export const RW = {
  title: 'Renewals',
  mode: { live: 'Live account', test: 'Test account' },
  views: { coming_up: 'Coming up', unpaid: 'Unpaid bills' },
  captions: {
    coming_up: 'Every plan that renews or ends in the dates you pick, from our records. Prices are the plan’s price on file, before tax and discounts.',
    unpaid: 'Bills a club has not paid, from our record of every bill since May 1, 2026. An unpaid bill is still a sale and still owes its tax.',
  },
  modeNote: 'Each page reads the site’s own Stripe mode only. There is no switch to the other mode; a total never mixes them.',
  couldNotRead: 'Could not read this just now. That is not the same as nothing being wrong. Reload to try again.',
  dash: '—',
  toolbar: { dates: 'Dates', what: 'What happens', plan: 'Plan', show: 'Show', allPlans: 'All plans' },
  kinds: {
    renews: 'Renews',
    trial_ends: 'Trial ends',
    free_time_ends: 'Free time ends',
    founding_ends: 'Founding Season ends',
    plan_ends: 'Plan ends',
    stale_trial: 'Trial ended, still marked trial',
  },
  coming: {
    col: { date: 'Date', what: 'What happens', club: 'Club or portal', plan: 'Plan', price: 'Price on file' },
    portalSub: 'Coaches Portal',
    noSubscription: 'no subscription',
    noRenewal: 'not renewing',
    cycleNotOnFile: 'cycle not on file',
    noPriceOnFile: 'no price on file',
    a: { monthly: 'a month', annual: 'a year' } as Record<string, string>,
    foot: 'Sorted by date. A past-due club is not listed here: it is on Unpaid bills. Sandbox clubs are left out, as on Business numbers.',
    empty: (range: string) => `Nothing renews or ends from ${range}.`,
    emptyDoor: 'Next 30 days ›',
    moneyDoor: 'Money tab ›',
    freeTimeDoor: 'Free time ›',
  },
  unpaid: {
    col: { issued: 'Issued', club: 'Club or portal', bill: 'Bill', beforeTax: 'Before tax', tax: 'Tax', total: 'Total', plan: 'Club’s plan' },
    show: { open: 'Unpaid', uncollectible: 'Written off', all: 'All' },
    showDetail: {
      open: 'Open bills, the default',
      uncollectible: 'Stripe marked them uncollectible: a bad debt',
      all: 'A paid or voided bill is never on this list',
    },
    coach: 'Coach',
    goneClub: 'A club no longer on file',
    unmatched: 'Not matched to a club',
    noBill: 'No bill in our record',
    pastDueSince: (day: string) => `Past due since ${day}`,
    pastDueUndated: 'Past due, date not recorded',
    planEnded: (day: string | null) => (day ? `Plan ended ${day}` : 'Plan ended'),
    active: 'Active',
    writtenOff: 'Written off',
    billDoor: 'See the bill ›',
    moneyDoor: 'Money tab ›',
    billWords: { subscription: 'Subscription', premium: 'Coach Premium', fee: 'Fees billed back', one_off: 'Invoice made in Stripe' } as Record<string, string>,
    foot: 'A bill left open after its plan ended stays on this list until it is paid, voided or written off. Coaches Portals show the team’s name; no person’s name or email is shown.',
    empty: 'No unpaid bills in our record. It holds every bill since May 1, 2026.',
    emptyWrittenOff: 'No bills written off in our record. It holds every bill since May 1, 2026.',
  },
  bandComing: {
    renewals: 'Renewals', renewalsNote: 'in these dates',
    trials: 'Trials ending', trialsNote: 'Stripe trials',
    freeTime: 'Free time ending', freeTimeNote: 'free time and Founding Season',
    price: 'Price on file, before tax',
    stale: 'Still marked trial', staleNote: 'its end date has passed',
  },
  bandUnpaid: {
    bills: 'Unpaid bills',
    owed: 'Owed, before tax',
    tax: 'Tax on them', taxNote: 'GST/HST, already reported',
    noBill: 'Past due, no bill here', noBillNote: 'see the Money tab',
    writtenOff: 'Written off this year',
  },
  /** What each chip means, opened by a click (never hover alone). */
  explain: {
    stale_trial: 'The trial’s end date has passed and the club still reads as on trial. Shown here once, in amber, whatever dates are picked (it has no date ahead), and no longer counted in Trials ending. The club’s Money tab says what Stripe holds.',
    renews: 'The subscription on file renews on this date, from the club record.',
    trial_ends: 'Stripe’s trial, read from the club record. The price is what the plan will charge when the trial ends.',
    free_time_ends: 'Free time a staff member gave (or a Founding Season comp). There is no subscription, so no price: when it ends the club falls back to its plan’s free floor or pays. The door goes to Free time.',
    founding_ends: 'Free time a staff member gave (or a Founding Season comp). There is no subscription, so no price: when it ends the club falls back to its plan’s free floor or pays. The door goes to Free time.',
    plan_ends: 'The club has asked for its plan to end on this date, so it does not renew. The club’s Money tab holds the waiting change.',
    cycle: 'Many Coaches Portal and older rows hold no billing cycle. The price shows; the word a month or a year shows only when the record holds it. Never guessed from the amount.',
    noPrice: 'The price on file fills in from Stripe’s next update for that subscription (no backfill was run). Until then the row says so and the band counts it apart. The list price is never shown in its place.',
    pastDue: 'The day the club went past due, from the event the billing update wrote. A club past due without that event (a staff grant) reads Past due, date not recorded.',
    noBill: 'The club reads past due but our record holds no open bill for it (a bill from before May 1, 2026, a bill whose record has not arrived, or a staff status). Never shown as nothing owed: the door reads Stripe for that one club.',
    planEnded: 'A bill left open after the plan was cancelled.',
    writtenOff: 'Stripe marked this bill uncollectible: a bad debt. It stays a sale; its tax relief belongs to the day it was written off.',
  },
} as const;

// ── Dates ───────────────────────────────────────────────────────────────────────────────────────

export type DatesKey = 'this_month' | 'next_month' | 'next_14' | 'next_30' | 'custom';
export const DATES_KEYS: readonly DatesKey[] = ['this_month', 'next_month', 'next_14', 'next_30', 'custom'];
export const DATES_LABELS: Record<DatesKey, string> = {
  this_month: 'This month (from today)',
  next_month: 'Next month',
  next_14: 'Next 14 days',
  next_30: 'Next 30 days',
  custom: 'Custom dates',
};

/** The short face of each pick on the Dates control (the label without its parenthetical). */
export const DATES_FACE: Record<DatesKey, string> = {
  this_month: 'This month', next_month: 'Next month', next_14: 'Next 14 days', next_30: 'Next 30 days', custom: 'Custom dates',
};

export type DateRange = { from: string; to: string };

/** The Ontario days a pick covers. Forward only: a past day is never shown (a custom start before today starts today). */
export function rangeFor(key: DatesKey, today: string, custom?: { from?: string | null; to?: string | null }): DateRange {
  switch (key) {
    case 'next_month': {
      const first = addCalendarMonths(`${today.slice(0, 7)}-01`, 1);
      return { from: first, to: lastDayOfMonth(first) };
    }
    case 'next_14': return { from: today, to: addCalendarDays(today, 14) };
    case 'next_30': return { from: today, to: addCalendarDays(today, 30) };
    case 'custom': {
      const ok = (d?: string | null) => !!d && !!parseDateOnlyParts(d);
      const from = ok(custom?.from) && custom!.from! > today ? custom!.from! : today;
      const to = ok(custom?.to) && custom!.to! >= from ? custom!.to! : lastDayOfMonth(from);
      return { from, to };
    }
    default: return { from: today, to: lastDayOfMonth(today) };
  }
}

const shortDay = (d: string) => {
  const p = parseDateOnlyParts(d);
  return p ? `${SHORT_MONTHS[p.m - 1]} ${p.d}` : d;
};

/** "Nov 7 to 30" (one month) or "Nov 7 to Dec 7": the Dates face. */
export function rangeFace({ from, to }: DateRange): string {
  return from.slice(0, 7) === to.slice(0, 7) ? `${shortDay(from)} to ${parseDateOnlyParts(to)?.d ?? to}` : `${shortDay(from)} to ${shortDay(to)}`;
}

/** "Nov 7 to Nov 30": the empty state's sentence. */
export function rangeWords({ from, to }: DateRange): string {
  return `${shortDay(from)} to ${shortDay(to)}`;
}

// ── Money ───────────────────────────────────────────────────────────────────────────────────────

/** Amounts by currency, never added across currencies. */
export type ByCurrency = Record<string, number>;

function addTo(sum: ByCurrency, currency: string, cents: number): void {
  sum[currency] = (sum[currency] ?? 0) + cents;
}

/** "$2,448.00" for one currency; "$2,448.00 CAD · $120.00 USD" for two; "$0.00" when there is nothing. */
export function byCurrencyWords(sum: ByCurrency): string {
  const keys = Object.keys(sum).sort((a, b) => (a === 'cad' ? -1 : b === 'cad' ? 1 : a.localeCompare(b)));
  if (keys.length === 0) return formatCents(0, 'cad');
  if (keys.length === 1) return formatCents(sum[keys[0]], keys[0]);
  return keys.map(k => `${formatCents(sum[k], k)} ${k.toUpperCase()}`).join(' · ');
}

/** "CAD" for one currency, "" for two (the value names them), "CAD" for none. */
export function currencyNote(sum: ByCurrency): string {
  const keys = Object.keys(sum);
  return keys.length === 1 ? keys[0].toUpperCase() : keys.length === 0 ? 'CAD' : '';
}

export type PriceCell =
  | { kind: 'price'; cents: number; currency: string; per: string | null }
  | { kind: 'no_price' }
  | { kind: 'no_subscription' }
  | { kind: 'no_renewal' };

/** The org fields Renewals reads (organizations; migration 418 for the price on file). */
export type RenewalOrg = {
  id: string;
  name: string;
  plan_id: string | null;
  account_kind: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  subscription_period: string | null;
  subscription_amount_cents: number | null;
  subscription_currency: string | null;
  stripe_subscription_id: string | null;
};

/** The price on file: before tax, no discount. "a month" / "a year" only from the record's cycle; never the list price. */
export function priceCell(org: Pick<RenewalOrg, 'subscription_amount_cents' | 'subscription_currency' | 'subscription_period'>): PriceCell {
  if (org.subscription_amount_cents == null || !org.subscription_currency) return { kind: 'no_price' };
  const per = org.subscription_period ? RW.coming.a[org.subscription_period] ?? null : null;
  return { kind: 'price', cents: org.subscription_amount_cents, currency: org.subscription_currency, per };
}

/** The price cell's words (the chips are the page's: "cycle not on file", "no price on file"). */
export function priceWords(p: PriceCell): string {
  if (p.kind === 'price') return `${formatCents(p.cents, p.currency)}${p.per ? ` ${p.per}` : ''}`;
  if (p.kind === 'no_subscription') return RW.coming.noSubscription;
  if (p.kind === 'no_renewal') return RW.coming.noRenewal;
  return RW.coming.noPriceOnFile;
}

// ── Coming up ───────────────────────────────────────────────────────────────────────────────────

export type ComingKind = keyof typeof RW.kinds;

/** The "What happens" pick. The two tiles with no single kind (free time and Founding together; the stale trials) are picks too. */
export type WhatKey = 'all' | 'renews' | 'trial_ends' | 'free_time_ends' | 'founding_ends' | 'free_or_founding' | 'stale_trial';
export const WHAT_OPTIONS: ReadonlyArray<{ id: WhatKey; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'renews', label: RW.kinds.renews },
  { id: 'trial_ends', label: RW.kinds.trial_ends },
  { id: 'free_time_ends', label: RW.kinds.free_time_ends },
  { id: 'founding_ends', label: RW.kinds.founding_ends },
  { id: 'free_or_founding', label: 'Free time or Founding Season ends' },
  { id: 'stale_trial', label: 'Still marked trial' },
];
export const isWhatKey = (v: unknown): v is WhatKey => WHAT_OPTIONS.some(o => o.id === v);

export type ComingRow = {
  key: string;
  kind: ComingKind;
  /** The Ontario day it happens (the trial's passed end date for a stale trial). */
  date: string;
  orgId: string;
  name: string;
  isPortal: boolean;
  planId: string | null;
  plan: string;
  price: PriceCell;
  door: { label: string; href: string };
};

export type StaffFreeTimeInput = { orgId: string; name: string; kind: 'club' | 'portal'; freeOn: string; lastDay: string | null };

export type ComingInput = {
  /** Customer clubs and portals: sandbox demos and free-time Coaches Portals already left out. */
  orgs: RenewalOrg[];
  /** Every org's name, kind and plan by id (free time and Founding name their club from it). */
  orgsById: Map<string, Pick<RenewalOrg, 'name' | 'plan_id' | 'account_kind'>>;
  staffFreeTime: StaffFreeTimeInput[];
  /** A Founding Season comp's expiry instant, by org. */
  foundingByOrg: Map<string, string>;
  /** Orgs with a waiting cancellation or a waiting move to the free plan (the paid plan does not renew on its date). */
  endingOrgIds: Set<string>;
};

const moneyTab = (orgId: string) => `/platform-admin/orgs/${orgId}?tab=money`;

/** Every Coming up row in the dates, soonest first, with the stale trials (which have no date ahead) shown whatever dates are picked. */
export function comingUpRows(input: ComingInput, range: DateRange, today: string): ComingRow[] {
  const rows: ComingRow[] = [];
  const inRange = (d: string) => d >= range.from && d <= range.to;
  const isPortal = (o: Pick<RenewalOrg, 'account_kind' | 'plan_id'> | undefined) =>
    !!o && isTeamWorkspaceOrg({ accountKind: o.account_kind, planId: o.plan_id });

  for (const org of input.orgs) {
    const status = org.subscription_status ?? 'active';
    const base = {
      orgId: org.id, name: org.name, isPortal: isPortal(org), planId: org.plan_id,
      plan: org.plan_id ? planLabel(org.plan_id) : RW.dash,
      door: { label: RW.coming.moneyDoor, href: moneyTab(org.id) },
    };
    if (isStaleTrial(status, org.current_period_end, today)) {
      rows.push({ ...base, key: `stale:${org.id}`, kind: 'stale_trial', date: orgDayKey(org.current_period_end), price: priceCell(org) });
      continue;
    }
    if (!org.current_period_end) continue;
    const day = orgDayKey(org.current_period_end);
    if (!inRange(day)) continue;
    if (status === 'trialing') {
      rows.push({ ...base, key: `trial:${org.id}`, kind: 'trial_ends', date: day, price: priceCell(org) });
    } else if (status === 'active' && org.stripe_subscription_id) {
      // A Founding comp is active with no subscription: it ends through its comp (below), never "renews".
      const ending = input.endingOrgIds.has(org.id);
      rows.push({ ...base, key: `renew:${org.id}`, kind: ending ? 'plan_ends' : 'renews', date: day, price: ending ? { kind: 'no_renewal' } : priceCell(org) });
    }
    // past_due: on Unpaid bills, not here. canceled: nothing renews.
  }

  for (const ft of input.staffFreeTime) {
    if (!ft.lastDay || !inRange(ft.lastDay)) continue;
    const o = input.orgsById.get(ft.orgId);
    rows.push({
      key: `free:${ft.orgId}`, kind: 'free_time_ends', date: ft.lastDay, orgId: ft.orgId, name: ft.name, isPortal: ft.kind === 'portal',
      planId: o?.plan_id ?? null, plan: ft.freeOn, price: { kind: 'no_subscription' },
      door: { label: RW.coming.freeTimeDoor, href: '/platform-admin/free-time?view=staff' },
    });
  }

  for (const [orgId, expiresAt] of input.foundingByOrg) {
    const o = input.orgsById.get(orgId);
    if (!o) continue;
    const day = lastDayOfInstant(expiresAt);
    if (!inRange(day)) continue;
    rows.push({
      key: `founding:${orgId}`, kind: 'founding_ends', date: day, orgId, name: o.name, isPortal: isPortal(o),
      planId: o.plan_id, plan: o.plan_id ? planLabel(o.plan_id) : RW.dash, price: { kind: 'no_subscription' },
      door: { label: RW.coming.freeTimeDoor, href: '/platform-admin/free-time?view=founding' },
    });
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

export function matchesWhat(row: Pick<ComingRow, 'kind'>, what: WhatKey): boolean {
  if (what === 'all') return true;
  if (what === 'free_or_founding') return row.kind === 'free_time_ends' || row.kind === 'founding_ends';
  if (what === 'renews') return row.kind === 'renews' || row.kind === 'plan_ends';
  return row.kind === what;
}

export type ComingBand = {
  renewals: number;
  trials: number;
  freeTime: number;
  /** Price on file of the renewals and trials, before tax, by currency (never added across them). */
  price: ByCurrency;
  priced: number;
  /** Of the priced, how many are trials (the rest are renewals). */
  pricedTrials: number;
  noPrice: number;
  stale: number;
};

/** The band over every row in the dates (the band does not narrow with the pick: each tile IS a pick). */
export function comingBand(rows: ComingRow[]): ComingBand {
  const band: ComingBand = { renewals: 0, trials: 0, freeTime: 0, price: {}, priced: 0, pricedTrials: 0, noPrice: 0, stale: 0 };
  for (const r of rows) {
    if (r.kind === 'renews' || r.kind === 'plan_ends') band.renewals += 1;
    else if (r.kind === 'trial_ends') band.trials += 1;
    else if (r.kind === 'free_time_ends' || r.kind === 'founding_ends') band.freeTime += 1;
    else if (r.kind === 'stale_trial') band.stale += 1;
    if (r.kind === 'renews' || r.kind === 'trial_ends') {
      if (r.price.kind === 'price') {
        addTo(band.price, r.price.currency, r.price.cents);
        band.priced += 1;
        if (r.kind === 'trial_ends') band.pricedTrials += 1;
      }
      else band.noPrice += 1;
    }
  }
  return band;
}

/** The price tile's value: "—" when every renewal or trial in the dates has no price on file (a sum of nothing is not "$0.00"). */
export function priceTileValue(band: ComingBand): string {
  return band.priced === 0 && band.noPrice > 0 ? RW.dash : byCurrencyWords(band.price);
}

/** "CAD · 3 renewals · 1 has no price on file"; trials are counted apart ("2 renewals · 1 trial"). */
export function priceTileNote(band: ComingBand): string {
  const renewals = band.priced - band.pricedTrials;
  const parts = [currencyNote(band.price)].filter(Boolean);
  if (renewals > 0 || band.pricedTrials === 0) parts.push(pluralize(renewals, 'renewal'));
  if (band.pricedTrials > 0) parts.push(pluralize(band.pricedTrials, 'trial'));
  if (band.noPrice > 0) parts.push(`${band.noPrice} ${band.noPrice === 1 ? 'has' : 'have'} no price on file`);
  return parts.join(' · ');
}

// ── Unpaid bills ────────────────────────────────────────────────────────────────────────────────

export type ShowKey = 'open' | 'uncollectible' | 'all';
export const SHOW_KEYS: readonly ShowKey[] = ['open', 'uncollectible', 'all'];
export const isShowKey = (v: unknown): v is ShowKey => SHOW_KEYS.includes(v as ShowKey);

/** The columns of `platform_charge_tax_records` the list reads (migration 451). */
export const UNPAID_RECORD_COLUMNS = [
  'stripe_invoice_id', 'org_id', 'buyer_kind', 'kind', 'invoice_number', 'issued_at', 'currency', 'amount_before_tax_cents',
  'tax_total_cents', 'total_cents', 'cad_amount_before_tax_cents', 'cad_tax_total_cents', 'cad_total_cents', 'status',
  'uncollectible_at',
] as const;

export type UnpaidRecord = {
  stripe_invoice_id: string;
  org_id: string | null;
  /** Who bought it, as the record was written: a club, a person (a coach), or not matched. */
  buyer_kind: 'club' | 'person' | 'unknown';
  kind: string;
  invoice_number: string | null;
  issued_at: string;
  currency: string;
  amount_before_tax_cents: number;
  tax_total_cents: number;
  total_cents: number;
  cad_amount_before_tax_cents: number | null;
  cad_tax_total_cents: number | null;
  cad_total_cents: number | null;
  status: 'open' | 'uncollectible';
  uncollectible_at: string | null;
};

export type PlanChip = { text: string; tone: 'warn' | 'info'; explain: string };

export type UnpaidRow = {
  key: string;
  /** null = a past-due club with no bill in our record. */
  bill: null | {
    invoiceId: string;
    issued: string;
    words: string;
    number: string | null;
    currency: string;
    beforeTax: number;
    tax: number;
    total: number;
    cad: { beforeTax: number | null; tax: number | null; total: number | null };
    writtenOff: boolean;
    writtenOffDay: string | null;
  };
  orgId: string | null;
  name: string;
  isPortal: boolean;
  planId: string | null;
  plan: string;
  /** null = no club on file to say anything about (a coach's own bill, a club since deleted). */
  chip: PlanChip | null;
  door: { label: string; href: string } | null;
};

export type UnpaidInput = {
  records: UnpaidRecord[];
  /** Every org by id (a bill can belong to a cancelled club, which the customer list keeps). */
  orgsById: Map<string, Pick<RenewalOrg, 'name' | 'plan_id' | 'account_kind' | 'subscription_status'>>;
  /** Customer orgs reading past due today. */
  pastDueOrgIds: string[];
  /** The newest `subscription_past_due` event's instant, by org. */
  pastDueSince: Map<string, string>;
  /** The newest `subscription_canceled` event's instant, by org (a bill left open after its plan ended). */
  endedOn: Map<string, string>;
  /** Org ids left out of the customer counts (sandbox demos): their bills are not listed. */
  excludedOrgIds: Set<string>;
};

function planChip(orgId: string | null, input: UnpaidInput): PlanChip {
  const status = orgId ? input.orgsById.get(orgId)?.subscription_status ?? null : null;
  if (status === 'past_due') {
    const since = orgId ? input.pastDueSince.get(orgId) : undefined;
    return since
      ? { text: RW.unpaid.pastDueSince(formatStoredDate(since, { withYear: false })), tone: 'warn', explain: RW.explain.pastDue }
      : { text: RW.unpaid.pastDueUndated, tone: 'warn', explain: RW.explain.pastDue };
  }
  if (status === 'canceled') {
    const ended = orgId ? input.endedOn.get(orgId) : undefined;
    return { text: RW.unpaid.planEnded(ended ? formatStoredDate(ended, { withYear: false }) : null), tone: 'info', explain: RW.explain.planEnded };
  }
  return { text: RW.unpaid.active, tone: 'info', explain: 'The club’s plan is running; this bill is still open in Stripe.' };
}

/** The past-due clubs with no open bill in our record: the rows that read "No bill in our record", and the band's count of them. */
function noBillOrgIds(input: UnpaidInput): string[] {
  const openOrgs = new Set<string>();
  for (const r of input.records) if (r.status === 'open' && r.org_id) openOrgs.add(r.org_id);
  return input.pastDueOrgIds.filter(id => !openOrgs.has(id) && !input.excludedOrgIds.has(id) && input.orgsById.has(id));
}

/** The list for a Show pick: bills by issue day, then the past-due clubs with no open bill here (on Unpaid and All). */
export function unpaidRows(input: UnpaidInput, show: ShowKey): UnpaidRow[] {
  const rows: UnpaidRow[] = [];
  for (const r of input.records) {
    if (r.org_id && input.excludedOrgIds.has(r.org_id)) continue;
    if (show !== 'all' && r.status !== show) continue;
    const o = r.org_id ? input.orgsById.get(r.org_id) : undefined;
    // A bill an individual bought reads "Coach" (/legal); a bill whose club is gone, or was never matched, says so and has no door.
    const name = o?.name ?? (r.org_id ? RW.unpaid.goneClub : r.buyer_kind === 'person' ? RW.unpaid.coach : RW.unpaid.unmatched);
    rows.push({
      key: r.stripe_invoice_id,
      bill: {
        invoiceId: r.stripe_invoice_id,
        issued: orgDayKey(r.issued_at),
        words: RW.unpaid.billWords[r.kind] ?? RW.unpaid.billWords.subscription,
        number: r.invoice_number,
        currency: r.currency,
        beforeTax: r.amount_before_tax_cents,
        tax: r.tax_total_cents,
        total: r.total_cents,
        cad: { beforeTax: r.cad_amount_before_tax_cents, tax: r.cad_tax_total_cents, total: r.cad_total_cents },
        writtenOff: r.status === 'uncollectible',
        writtenOffDay: r.uncollectible_at ? orgDayKey(r.uncollectible_at) : null,
      },
      orgId: r.org_id,
      name,
      isPortal: !!o && isTeamWorkspaceOrg({ accountKind: o.account_kind, planId: o.plan_id }),
      planId: o?.plan_id ?? null,
      plan: o?.plan_id ? planLabel(o.plan_id) : RW.dash,
      chip: r.status === 'uncollectible'
        ? { text: RW.unpaid.writtenOff, tone: 'info', explain: RW.explain.writtenOff }
        : o ? planChip(r.org_id, input) : null,
      // The Money tab lists the club's bills, this one among them, with the Part 2 notice read live from Stripe. It has no
      // address that opens one invoice (only `charge=`), so the door opens the tab.
      door: o && r.org_id ? { label: RW.unpaid.billDoor, href: moneyTab(r.org_id) } : null,
    });
  }
  rows.sort((a, b) => (a.bill!.issued).localeCompare(b.bill!.issued) || a.name.localeCompare(b.name));
  if (show !== 'uncollectible') {
    for (const orgId of noBillOrgIds(input)) {
      const o = input.orgsById.get(orgId)!;
      rows.push({
        key: `nobill:${orgId}`, bill: null, orgId, name: o.name,
        isPortal: isTeamWorkspaceOrg({ accountKind: o.account_kind, planId: o.plan_id }),
        planId: o.plan_id, plan: o.plan_id ? planLabel(o.plan_id) : RW.dash,
        chip: planChip(orgId, input),
        door: { label: RW.unpaid.moneyDoor, href: moneyTab(orgId) },
      });
    }
  }
  return rows;
}

export type UnpaidBand = {
  bills: number;
  clubs: number;
  owed: ByCurrency;
  tax: ByCurrency;
  noBill: number;
  writtenOffYear: ByCurrency;
  writtenOffYearCount: number;
};

/** The band: open bills only for the first three tiles; the year's write-offs by the day they were written off. No tile adds a price to a tax. */
export function unpaidBand(input: UnpaidInput, today: string): UnpaidBand {
  const band: UnpaidBand = { bills: 0, clubs: 0, owed: {}, tax: {}, noBill: 0, writtenOffYear: {}, writtenOffYearCount: 0 };
  const clubs = new Set<string>();
  const year = today.slice(0, 4);
  for (const r of input.records) {
    if (r.org_id && input.excludedOrgIds.has(r.org_id)) continue;
    if (r.status === 'open') {
      band.bills += 1;
      clubs.add(r.org_id ?? `person:${r.stripe_invoice_id}`);
      addTo(band.owed, r.currency, r.amount_before_tax_cents);
      addTo(band.tax, r.currency, r.tax_total_cents);
    } else if (r.uncollectible_at && orgDayKey(r.uncollectible_at).slice(0, 4) === year) {
      band.writtenOffYearCount += 1;
      addTo(band.writtenOffYear, r.currency, r.amount_before_tax_cents);
    }
  }
  band.clubs = clubs.size;
  band.noBill = noBillOrgIds(input).length;
  return band;
}

/** The Plan narrows: the plans present in the rows, by label. */
export function planOptions(rows: ReadonlyArray<{ planId: string | null }>): Array<{ id: string; label: string }> {
  const ids = [...new Set(rows.map(r => r.planId).filter((p): p is string => !!p))];
  return [{ id: 'all', label: RW.toolbar.allPlans }, ...ids.map(id => ({ id, label: planLabel(id) })).sort((a, b) => a.label.localeCompare(b.label))];
}

// ── The page's state, read from its address (the page, Today's doors and the export share it) ────

export type RenewalsView = 'coming_up' | 'unpaid';

export type RenewalsParams = {
  view: RenewalsView;
  dates: DatesKey;
  from: string | null;
  to: string | null;
  what: WhatKey;
  plan: string;
  show: ShowKey;
  /** The "Past due, no bill here" tile: only the past-due clubs our record holds no open bill for. */
  noBill: boolean;
};

export function paramsFrom(get: (k: string) => string | null | undefined): RenewalsParams {
  const dates = get('dates');
  const what = get('what');
  const show = get('show');
  return {
    view: get('view') === 'unpaid' ? 'unpaid' : 'coming_up',
    dates: DATES_KEYS.includes(dates as DatesKey) ? (dates as DatesKey) : 'this_month',
    from: get('from') ?? null,
    to: get('to') ?? null,
    what: isWhatKey(what) ? what : 'all',
    plan: get('plan') || 'all',
    show: isShowKey(show) ? show : 'open',
    noBill: get('only') === 'no_bill',
  };
}

/** The address for a state (defaults left out, so Today's doors and a shared link read the same). */
export function paramsQuery(p: RenewalsParams): string {
  const q = new URLSearchParams();
  if (p.view === 'unpaid') {
    q.set('view', 'unpaid');
    if (p.show !== 'open') q.set('show', p.show);
    if (p.noBill) q.set('only', 'no_bill');
  } else {
    if (p.dates !== 'this_month') q.set('dates', p.dates);
    if (p.dates === 'custom') { if (p.from) q.set('from', p.from); if (p.to) q.set('to', p.to); }
    if (p.what !== 'all') q.set('what', p.what);
  }
  if (p.plan !== 'all') q.set('plan', p.plan);
  return q.toString();
}

/** The Coming up rows a state shows (the band reads every row in the dates). */
export function shownComing(rows: ComingRow[], p: Pick<RenewalsParams, 'what' | 'plan'>): ComingRow[] {
  return rows.filter(r => matchesWhat(r, p.what) && (p.plan === 'all' || r.planId === p.plan));
}

export function shownUnpaid(rows: UnpaidRow[], p: Pick<RenewalsParams, 'plan' | 'noBill'>): UnpaidRow[] {
  return rows.filter(r => (p.plan === 'all' || r.planId === p.plan) && (!p.noBill || !r.bill));
}

// ── The two views, built once for the page and its export ───────────────────────────────────────

export type ComingView = {
  view: 'coming_up';
  /** false = the records could not be read: the band reads "—" and the list says so, never "nothing due". */
  read: boolean;
  range: DateRange;
  rows: ComingRow[];
  band: ComingBand | null;
  plans: Array<{ id: string; label: string }>;
};

export type UnpaidView = {
  view: 'unpaid';
  read: boolean;
  rows: UnpaidRow[];
  band: UnpaidBand | null;
  plans: Array<{ id: string; label: string }>;
};

export function buildComingView(input: ComingInput | null, p: RenewalsParams, today: string): ComingView {
  const range = rangeFor(p.dates, today, { from: p.from, to: p.to });
  if (!input) return { view: 'coming_up', read: false, range, rows: [], band: null, plans: planOptions([]) };
  const all = comingUpRows(input, range, today);
  const plans = planOptions(all);
  return { view: 'coming_up', read: true, range, rows: shownComing(all, { ...p, plan: knownPlan(plans, p.plan) }), band: comingBand(all), plans };
}

export function buildUnpaidView(input: UnpaidInput | null, p: RenewalsParams, today: string): UnpaidView {
  if (!input) return { view: 'unpaid', read: false, rows: [], band: null, plans: planOptions([]) };
  const all = unpaidRows(input, p.show);
  const plans = planOptions(all);
  return { view: 'unpaid', read: true, rows: shownUnpaid(all, { ...p, plan: knownPlan(plans, p.plan) }), band: unpaidBand(input, today), plans };
}

/** A Plan pick the rows no longer offer (a shared link, or other dates) reads as "All plans", which is what the control shows. */
const knownPlan = (plans: Array<{ id: string }>, pick: string) => (plans.some(o => o.id === pick) ? pick : 'all');

// ── The export's rows (the rows on screen, the same columns; CAD beside the bill's own currency) ─

export const COMING_EXPORT_HEADERS = ['Date', 'What happens', 'Club or portal', 'Kind of account', 'Plan', 'Price on file, before tax', 'Currency', 'Billing cycle'];

export function comingExportRows(rows: ComingRow[]): Array<Array<string | number>> {
  return rows.map(r => [
    r.date,
    RW.kinds[r.kind],
    r.name,
    r.isPortal ? RW.coming.portalSub : 'Club',
    r.plan,
    r.price.kind === 'price' ? r.price.cents / 100 : priceWords(r.price),
    r.price.kind === 'price' ? r.price.currency.toUpperCase() : '',
    r.price.kind === 'price' ? (r.price.per ?? RW.coming.cycleNotOnFile) : '',
  ]);
}

export const UNPAID_EXPORT_HEADERS = ['Issued', 'Club or portal', 'Kind of account', 'Bill', 'Invoice number', 'Before tax', 'Tax', 'Total',
  'Currency', 'Before tax (CAD)', 'Tax (CAD)', 'Total (CAD)', 'Written off on', 'Club’s plan', 'Status'];

const cadCell = (v: number | null) => (v == null ? 'not yet valued in CAD' : v / 100);

export function unpaidExportRows(rows: UnpaidRow[]): Array<Array<string | number>> {
  return rows.map(r => {
    const b = r.bill;
    return [
      b ? b.issued : '',
      r.name,
      r.isPortal ? RW.coming.portalSub : r.orgId ? 'Club' : r.name === RW.unpaid.coach ? RW.unpaid.coach : '',
      b ? b.words : RW.unpaid.noBill,
      b?.number ?? '',
      b ? b.beforeTax / 100 : '',
      b ? b.tax / 100 : '',
      b ? b.total / 100 : '',
      b ? b.currency.toUpperCase() : '',
      b ? (b.currency === 'cad' ? b.beforeTax / 100 : cadCell(b.cad.beforeTax)) : '',
      b ? (b.currency === 'cad' ? b.tax / 100 : cadCell(b.cad.tax)) : '',
      b ? (b.currency === 'cad' ? b.total / 100 : cadCell(b.cad.total)) : '',
      b?.writtenOffDay ?? '',
      r.plan,
      r.chip?.text ?? '',
    ];
  });
}
