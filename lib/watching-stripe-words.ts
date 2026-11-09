/**
 * WATCHING STRIPE: the words and the counting rules (Plans & pricing Stage 2 Part 3; drawings tab 10; owner go
 * 2026-11-07 on the scope: last morning result only, no "Check now"; the failed-try outcome says it cannot be read; two
 * feeds; no payouts card; no "This month" card). Pure: no imports of a client or a store, so the unit tests run it as is.
 * The reads that feed it are `lib/watching-stripe.ts`.
 *
 * The rule under every sentence here: "could not read" is never "nothing wrong" (Stage 0 fix 3).
 */

export type FeedKey = 'plan_billing' | 'family_payments';

export type FeedFailure = { id: string; type: string; receivedAt: string; error: string };

/** One webhook feed, as read. `ignored` is null for a feed that does not record why it set an update aside. */
export type FeedRead = {
  key: FeedKey;
  lastReceived: string | null;
  /** Updates whose last try failed and have not been processed since (any age: a failure does not expire). */
  failing: number;
  failures: FeedFailure[];
  /** Updates taken and never finished (the delivery died mid-run), older than five minutes. Null where not recorded. */
  stuck: number | null;
  /** Set aside in the last 7 days, by reason. Null where the feed does not record it. */
  ignored: { notOurs: number; noCustomer: number; wrongMode: number } | null;
};

export type DriftLine = { kind: string; orgId: string | null; name: string | null; words: string; subscriptionId: string };

export type DriftRead =
  | { state: 'none' }
  | {
      state: 'read';
      checkedAt: string;
      outcome: 'equal' | 'differs' | 'could_not_compare';
      subscriptionsRead: number;
      recordsCompared: number;
      lines: DriftLine[];
      /** How many differences the check recorded; `lines` stops at DRIFT_LINE_CAP. */
      differenceCount: number;
      error: string | null;
    };

export type SettingStatus = 'PASS' | 'WARN' | 'FAIL';
export type SettingRow = { key: string; status: SettingStatus; detail: string };

/** Everything the page shows. A part that could not be read is null; it never reads as empty. */
export type WatchingStripeRead = {
  billing: FeedRead | null;
  connect: FeedRead | null;
  drift: DriftRead | null;
  settings: SettingRow[] | null;
  /** The mode this site's key is in, so the page can say whose Stripe it is reading. */
  mode: 'live' | 'sandbox';
};

/** A morning check older than this is itself a thing to look at: the job runs once a day. */
export const STALE_CHECK_HOURS = 36;
/** Past this many lines the list says how many more. */
export const DRIFT_LINE_CAP = 25;
export const FAILURE_LINE_CAP = 5;
/** A failed update's stored message is shown to this many characters. */
export const FAILURE_TEXT_CAP = 200;

/**
 * A stored error as this page shows it. Stripe's own "Invalid API Key provided: sk_live_****abcd" carries the tail of the
 * secret key, and Product reads this page but not Stripe, so a key-shaped token is never printed.
 */
export function shownError(text: string, cap: number = FAILURE_TEXT_CAP): string {
  return text.replace(/\b[sr]k_(?:live|test)_\S*/gi, 'a Stripe key').slice(0, cap);
}

export const WS = {
  title: 'Stripe',
  intro: 'Tells you when Stripe and the product stop agreeing, so you open Stripe’s dashboard only to fix a setting. It reads and reports; it never repairs anything by itself.',
  mode: { live: 'Reading Stripe’s live account', sandbox: 'Reading Stripe’s test account' },
  readFailed: 'Could not read this just now. That is not the same as nothing being wrong. Reload to try again.',
  chip: (n: number) => (n === 0 ? 'All clear' : `${n} need${n === 1 ? 's' : ''} a look`),
  tiles: {
    lastUpdate: 'Last update from Stripe',
    stillFailing: 'Updates still failing',
    disagree: 'Records that disagree',
    settings: 'Settings to check',
    never: 'None yet',
    unknown: 'Unknown',
    dash: '—',
    glanceLabel: 'Stripe at a glance',
  },
  feeds: {
    title: 'Updates from Stripe',
    lede: 'Each feed is a way Stripe tells the product something happened. “Still failing” counts updates that were never processed, however old.',
    col: { feed: 'Feed', last: 'Last received', failing: 'Still failing', ignored: 'Set aside, 7 days', wrongMode: 'Wrong mode, 7 days' },
    name: { plan_billing: 'Plan billing', family_payments: 'Family payments' } as Record<FeedKey, string>,
    never: 'Nothing received yet',
    notRecorded: 'Not recorded',
    none: 'None',
    stuck: (n: number) => `${n} taken but never finished`,
    ignoredWords: (i: { notOurs: number; noCustomer: number }) => {
      const parts: string[] = [];
      if (i.notOurs) parts.push(`${i.notOurs} not ours`);
      if (i.noCustomer) parts.push(`${i.noCustomer} with no customer`);
      return parts.length ? parts.join(', ') : 'None';
    },
    failuresTitle: (feed: string) => `What failed in ${feed}`,
    more: (n: number) => `and ${n} more`,
  },
  drift: {
    title: 'Our records against Stripe',
    lede: 'A check that runs by itself every morning: our record of each plan against what Stripe holds. This page shows the last result and cannot run it again.',
    none: 'The morning check has not run yet.',
    checkedAt: (when: string) => `Checked ${when}`,
    stale: (when: string) => `Last checked ${when}; it should run every morning, so something has stopped it.`,
    equal: (n: number) => `Every record agrees with Stripe (${n} compared).`,
    couldNot: (error: string | null) => `The check could not compare with Stripe${error ? `: ${shownError(error, 500)}` : '.'}`,
    col: { club: 'Club', what: 'What differs' },
    unknownClub: 'Not one of our clubs',
    aClub: 'A club',
    openStripe: 'Open in Stripe ›',
    more: (n: number) => `and ${n} more are in the check’s record`,
    counted: (diff: number, compared: number) => `${diff} ${diff === 1 ? 'difference' : 'differences'} across ${compared} records compared`,
  },
  settings: {
    title: 'Stripe settings',
    lede: 'What our billing page offers customers in Stripe, against what Stripe reports. The settings stay yours: this page only reads them.',
    col: { setting: 'Setting', status: 'Status', detail: 'What Stripe reports' },
    pass: 'OK',
    warn: 'Look',
    fail: 'Fix',
    unreadable: 'Could not read',
    label: {
      configuration: 'Our billing page exists in Stripe',
      old_versions: 'No older versions still switched on',
      payment_method_update: 'Customers can update their card',
      invoice_history: 'Customers can see their invoices',
      customer_update: 'Customers can update name, email and tax ID',
      subscription_update: 'Customers cannot switch plans there',
      subscription_cancel: 'Cancelling ends the plan at its renewal date, no refund',
      subscription_pause: 'Pausing is off',
    } as Record<string, string>,
    // The audit's own sentence is shown on a WARN or FAIL; a pass is said in one fixed sentence.
    failedTry: {
      label: 'What happens after the last failed payment try',
      state: 'Cannot be read from here',
      body: 'Stripe does not let the product read this one. The product expects the plan to be cancelled after the last failed try. If Stripe is set to mark it unpaid instead, a club that never pays would stay on its plan.',
      link: 'Check it in Stripe ›',
    },
  },
};

/** Settings that are not a plain pass (a warning or a failure); null when the settings could not be read. */
export function settingsToCheck(settings: SettingRow[] | null): number | null {
  return settings ? settings.filter(s => s.status !== 'PASS').length : null;
}

/** The count the page's chip and the nav can show: one per thing that needs a look, never more than one per part. */
export function needsALook(read: WatchingStripeRead, now: Date = new Date()): number {
  const feedNeeds = (f: FeedRead | null) => !f || f.failing > 0 || (f.stuck ?? 0) > 0 || (f.ignored?.wrongMode ?? 0) > 0;
  let n = [read.billing, read.connect].filter(feedNeeds).length;
  const d = read.drift;
  if (!d || d.state === 'none' || d.outcome !== 'equal' || checkIsStale(d.checkedAt, now)) n += 1;
  n += settingsToCheck(read.settings) ?? 1;
  return n;
}

/**
 * The four figures at the top of the page. A figure that could not be known is null (the page draws a dash), never zero:
 * "could not read" is not "nothing wrong". `lastUpdate` null with `feedsUnknown` true reads "Unknown", otherwise "None yet".
 */
export function figureBand(read: WatchingStripeRead) {
  const drift = read.drift?.state === 'read' ? read.drift : null;
  const feedsUnknown = !read.billing || !read.connect;
  const failingTotal = (read.billing?.failing ?? 0) + (read.connect?.failing ?? 0);
  return {
    lastUpdate: [read.billing?.lastReceived, read.connect?.lastReceived].filter((x): x is string => !!x).sort().at(-1) ?? null,
    feedsUnknown,
    failing: feedsUnknown && failingTotal === 0 ? null : failingTotal,
    disagree: drift?.outcome === 'differs' ? drift.differenceCount : drift?.outcome === 'equal' ? 0 : null,
    settingsToCheck: settingsToCheck(read.settings),
  };
}

export function checkIsStale(checkedAt: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(checkedAt).getTime() > STALE_CHECK_HOURS * 3_600_000;
}

/** A setting row's chip: the audit's PASS / WARN / FAIL, said in plain words. */
export function settingChip(status: SettingStatus): { text: string; tone: 'ok' | 'warn' | 'bad' } {
  if (status === 'PASS') return { text: WS.settings.pass, tone: 'ok' };
  if (status === 'WARN') return { text: WS.settings.warn, tone: 'warn' };
  return { text: WS.settings.fail, tone: 'bad' };
}

/** The sentence shown beside a setting: fixed for a pass, the audit's own words for a warning or a failure. */
export function settingPassWords(key: string): string {
  switch (key) {
    case 'configuration': return 'It exists and is switched on.';
    case 'old_versions': return 'Only the current version is on.';
    case 'payment_method_update': return 'On.';
    case 'invoice_history': return 'On.';
    case 'customer_update': return 'On for those three.';
    case 'subscription_update': return 'Off. Plan moves belong to the product.';
    case 'subscription_cancel': return 'On, at the period end, with no proration.';
    case 'subscription_pause': return 'Off.';
    default: return 'As expected.';
  }
}

/** An update a Super admin replayed today, and who (Plans & pricing Stage 2 Part 5, Session 2; drawings tab 4). */
export type ReplayedLine = { eventId: string; type: string; at: string; who: string };

/**
 * The replays the change log names, newest first, one line per update (its newest replay). The caller has already left out the
 * rows whose run failed (`withoutFailedChanges`); a row that names no update id is skipped. Pure: the page then keeps only the
 * updates the event log shows as finished.
 */
export function replayedCandidates(
  rows: ReadonlyArray<{ actor_email: string | null; new_value: unknown; created_at: string }>,
): ReplayedLine[] {
  const seen = new Set<string>();
  const lines: ReplayedLine[] = [];
  for (const r of rows) {
    const v = (r.new_value ?? {}) as { eventId?: unknown; type?: unknown };
    if (typeof v.eventId !== 'string' || seen.has(v.eventId)) continue;
    seen.add(v.eventId);
    lines.push({ eventId: v.eventId, type: typeof v.type === 'string' ? v.type : '', at: r.created_at, who: r.actor_email ?? 'Staff' });
  }
  return lines;
}
