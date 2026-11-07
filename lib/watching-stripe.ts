import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getStripe } from './stripe';
import { stripeEnvironment } from './stripe-mode';
import { differenceWords, type Difference } from './billing-drift';
import { auditPortal } from '../scripts/lib/stripe-portal-audit.mjs';
import {
  DRIFT_LINE_CAP, FAILURE_LINE_CAP,
  type DriftRead, type FeedRead, type SettingRow, type WatchingStripeRead,
} from './watching-stripe-words';

/**
 * WATCHING STRIPE, READ ONLY (Plans & pricing Stage 2 Part 3; owner go 2026-11-07). Four reads, none of which writes a thing
 * or asks Stripe to change anything:
 *   · the plan-billing feed (`stripe_billing_events`) and the family-payments feed (`stripe_connect_events`);
 *   · the last morning comparison (`stripe_billing_drift_checks`), shown as stored, never re-run here;
 *   · our billing page's settings, read from Stripe by the SAME audit the scripts run (`scripts/lib/stripe-portal-audit.mjs`
 *     lists configurations and never creates one), so the app and the audit cannot drift apart.
 * Each read stands alone: one that fails is null, and the page says "could not read" for it. It never reads as "nothing".
 * The feeds' failed text is shown as stored (our handler's own message, cut to 500 characters at write); no payload is stored.
 */

/** How far back "set aside" and "wrong mode" are counted. */
const SET_ASIDE_WINDOW_MS = 7 * 86_400_000;
/** The claim a delivery holds while it runs; older than this and nothing is still running it (the route's own limit). */
const CLAIM_STALE_MS = 5 * 60_000;
/** Stripe's settings read gives up after this; the rest of the page does not wait on it. */
const PORTAL_READ_MS = 8_000;

function ok<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`Couldn't read ${what}: ${result.error.message}`);
  return result.data as T;
}
function count(result: { count: number | null; error: { message: string } | null }, what: string): number {
  if (result.error) throw new Error(`Couldn't read ${what}: ${result.error.message}`);
  if (result.count === null) throw new Error(`Couldn't read ${what}: Supabase returned no count`);
  return result.count;
}

type FeedTable = 'stripe_billing_events' | 'stripe_connect_events';
type FeedCore = Pick<FeedRead, 'lastReceived' | 'failing' | 'failures'>;

/** What both feeds share: when something last arrived, and the updates whose last try failed (a count of all, the newest few listed). */
async function readFeedCore(table: FeedTable, noun: string): Promise<FeedCore> {
  const t = () => supabaseAdmin.from(table);
  const [last, failed] = await Promise.all([
    t().select('received_at').order('received_at', { ascending: false }).limit(1),
    t().select('id, type, received_at, error', { count: 'exact' }).not('error', 'is', null).is('processed_at', null)
      .order('received_at', { ascending: false }).limit(FAILURE_LINE_CAP),
  ]);
  return {
    lastReceived: ok(last, `the ${noun} updates`)?.[0]?.received_at ?? null,
    failing: count(failed, `the failing ${noun} updates`),
    failures: (ok(failed, `the failing ${noun} updates`) ?? []).map((r: { id: string; type: string; received_at: string; error: string }) =>
      ({ id: r.id, type: r.type, receivedAt: r.received_at, error: r.error })),
  };
}

async function readBillingFeed(now: Date): Promise<FeedRead> {
  const since = new Date(now.getTime() - SET_ASIDE_WINDOW_MS).toISOString();
  const stale = new Date(now.getTime() - CLAIM_STALE_MS).toISOString();
  const t = () => supabaseAdmin.from('stripe_billing_events');
  const setAside = (reason: string) => t().select('id', { count: 'exact', head: true }).eq('ignored_reason', reason).gte('received_at', since);
  const [core, stuck, notOurs, noCustomer, wrongMode] = await Promise.all([
    readFeedCore('stripe_billing_events', 'plan billing'),
    t().select('id', { count: 'exact', head: true }).is('processed_at', null).is('error', null).is('ignored_reason', null).lt('claimed_at', stale),
    setAside('not_ours'),
    setAside('no_customer'),
    setAside('wrong_mode'),
  ]);
  return {
    key: 'plan_billing',
    ...core,
    stuck: count(stuck, 'the unfinished plan billing updates'),
    ignored: {
      notOurs: count(notOurs, 'the set-aside updates'),
      noCustomer: count(noCustomer, 'the set-aside updates'),
      wrongMode: count(wrongMode, 'the wrong-mode updates'),
    },
  };
}

/** The Connect feed keeps no "set aside" reason and refuses a wrong-mode update before it is logged, so those cells are null. */
async function readConnectFeed(): Promise<FeedRead> {
  return { key: 'family_payments', ...(await readFeedCore('stripe_connect_events', 'family payment')), stuck: null, ignored: null };
}

async function readDrift(): Promise<DriftRead> {
  const { data, error } = await supabaseAdmin.from('stripe_billing_drift_checks')
    .select('checked_at, outcome, subscriptions_read, records_compared, differences, error')
    .eq('environment', stripeEnvironment()).order('checked_at', { ascending: false }).limit(1);
  if (error) throw new Error(`Couldn't read the morning check: ${error.message}`);
  const row = data?.[0];
  if (!row) return { state: 'none' };
  const differences = (Array.isArray(row.differences) ? row.differences : []) as Difference[];
  return {
    state: 'read',
    checkedAt: row.checked_at,
    outcome: row.outcome,
    subscriptionsRead: row.subscriptions_read,
    recordsCompared: row.records_compared,
    lines: differences.slice(0, DRIFT_LINE_CAP).map(d => ({
      kind: d.kind, orgId: d.orgId, name: d.name, words: differenceWords(d), subscriptionId: d.subscriptionId,
    })),
    differenceCount: differences.length,
    error: row.error ?? null,
  };
}

async function readSettings(): Promise<SettingRow[]> {
  const audit = auditPortal(getStripe());
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Stripe did not answer in time')), PORTAL_READ_MS); });
  try {
    const checks: SettingRow[] = await Promise.race([audit, limit]);
    return checks.map(c => ({ key: c.key, status: c.status, detail: c.detail }));
  } finally {
    if (timer) clearTimeout(timer);
    audit.catch(() => undefined); // a read that loses the race must not become an unhandled rejection
  }
}

const settled = async <T>(read: () => Promise<T>): Promise<T | null> => read().catch(() => null);

/** The whole page's reads, in parallel; each part is null when it could not be read. */
export async function readWatchingStripe(now: Date = new Date()): Promise<WatchingStripeRead> {
  const [billing, connect, drift, settings] = await Promise.all([
    settled(() => readBillingFeed(now)),
    settled(readConnectFeed),
    settled(readDrift),
    settled(readSettings),
  ]);
  return { billing, connect, drift, settings, mode: stripeEnvironment() };
}
