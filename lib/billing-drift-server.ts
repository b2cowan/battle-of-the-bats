import { getStripe } from './stripe';
import { supabaseAdmin } from './supabase-admin';
import { getPlanFromPriceId } from './stripe-prices';
import { fetchAll } from './supabase-paging';
import { stripeDashboardBase, stripeEnvironment } from './stripe-mode';
import { ADMIN_EMAIL, SITE_URL, escapeHtml, sendEmail } from './email';
import {
  EMAIL_LINE_CAP, differenceWords, runBillingDriftCheck, shapeSubscription,
  type DriftCheck, type DriftRecord, type DriftSubscription,
} from './billing-drift';

/**
 * The daily comparison's real reads and writes (Plans & pricing Stage 0, Part 11). The rules are in `lib/billing-drift.ts`;
 * this only reads Stripe and our tables, sends the owner's email and records the day's row. Read-only towards every
 * club, portal and Stripe object.
 */

/** A read of the whole account: 100 a page, at most 50 pages. Past that the day is "could not compare", never a guess. */
const PAGE = 100;
const MAX_PAGES = 50;
const LIST_OPTS = { timeout: 20000, maxNetworkRetries: 2 } as const;

async function listSubscriptions(): Promise<DriftSubscription[]> {
  const out: DriftSubscription[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const list = await getStripe().subscriptions.list({ limit: PAGE, starting_after: startingAfter }, LIST_OPTS);
    out.push(...list.data.map(shapeSubscription));
    if (!list.has_more || list.data.length === 0) return out;
    startingAfter = list.data[list.data.length - 1].id;
  }
  throw new Error(`Stripe holds more than ${PAGE * MAX_PAGES} subscriptions: the check reads no further and compared nothing`);
}

async function retrieveSubscription(id: string): Promise<DriftSubscription | null> {
  try {
    return shapeSubscription(await getStripe().subscriptions.retrieve(id, {}, LIST_OPTS));
  } catch (err) {
    const e = err as { statusCode?: number; code?: string };
    if (e.statusCode === 404 || e.code === 'resource_missing') return null;
    throw err;
  }
}

/** Every row of a select (a club count past 1,000 must not silently drop the rest); a failed read names what it was reading. */
async function allRows<T>(read: Parameters<typeof fetchAll>[0], what: string): Promise<T[]> {
  try {
    return await fetchAll<T>(read);
  } catch (error) {
    throw new Error(`Couldn't read ${what}: ${error instanceof Error ? error.message : (error as { message?: string })?.message ?? String(error)}`);
  }
}

type OrgRow = {
  id: string; name: string; stripe_subscription_id: string;
  subscription_status: string | null; plan_id: string | null; subscription_period: string | null; current_period_end: string | null;
};

async function loadRecords(): Promise<DriftRecord[]> {
  const rows = await allRows<OrgRow>((from, to) => supabaseAdmin.from('organizations')
    .select('id, name, stripe_subscription_id, subscription_status, plan_id, subscription_period, current_period_end')
    .not('stripe_subscription_id', 'is', null).order('id').range(from, to), 'the clubs and portals');
  return rows.filter(r => r.stripe_subscription_id && !r.stripe_subscription_id.startsWith('mock_')).map(r => ({
    orgId: r.id,
    name: r.name,
    subscriptionId: r.stripe_subscription_id,
    status: r.subscription_status,
    planId: r.plan_id,
    cycle: r.subscription_period,
    periodEnd: r.current_period_end,
  }));
}

/** A club-paid portal keeps the club's subscription on its workspace row; a next-season choice waits on its own row. */
async function loadFollowedElsewhere(): Promise<Set<string>> {
  const [workspaces, nextSeason] = await Promise.all([
    allRows<{ stripe_subscription_id: string }>((from, to) => supabaseAdmin.from('team_workspaces')
      .select('stripe_subscription_id').not('stripe_subscription_id', 'is', null).order('id').range(from, to), 'the Coaches Portals'),
    allRows<{ next_season_subscription_id: string }>((from, to) => supabaseAdmin.from('organization_billing_facts')
      .select('next_season_subscription_id').not('next_season_subscription_id', 'is', null).order('org_id').range(from, to),
    'the next-season choices'),
  ]);
  return new Set([
    ...workspaces.map(w => w.stripe_subscription_id),
    ...nextSeason.map(n => n.next_season_subscription_id),
  ]);
}

async function saveCheck(check: DriftCheck): Promise<void> {
  const { error } = await supabaseAdmin.from('stripe_billing_drift_checks').insert({
    environment: check.environment,
    outcome: check.outcome,
    subscriptions_read: check.subscriptionsRead,
    records_compared: check.recordsCompared,
    differences: check.differences,
    error: check.error,
    owner_emailed: check.ownerEmailed,
  });
  if (error) throw new Error(`Couldn't record the check: ${error.message}`);
}

async function sendAlert(subject: string, html: string, idempotencyKey: string): Promise<boolean> {
  let status: string | undefined;
  try {
    status = (await sendEmail(ADMIN_EMAIL, subject, html, { kind: 'billing_drift_alert', idempotencyKey })).status;
  } catch (error) {
    console.error('[billing drift] the owner email could not be sent:', error);
    return false;
  }
  if (status !== 'sent') console.error('[billing drift] the owner email was not sent:', subject, status);
  return status === 'sent';
}

function driftEmailHtml(check: DriftCheck): string {
  const dashboard = stripeDashboardBase();
  const head = '<p>Nothing was changed: this check only reads, in Stripe and in our records.</p>';
  if (check.outcome === 'could_not_compare') {
    return head
      + `<p>Today’s check could not finish, so nothing was compared. What went wrong:</p><p>${escapeHtml(check.error ?? 'unknown')}</p>`
      + '<p>It runs again tomorrow. If this email comes two days running, Stripe or our database needs looking at.</p>';
  }
  const lines = check.differences.slice(0, EMAIL_LINE_CAP).map(d => {
    const who = d.orgId
      ? `<a href="${SITE_URL}/platform-admin/orgs/${encodeURIComponent(d.orgId)}">${escapeHtml(d.name ?? 'A club')}</a>`
      : 'No record of ours';
    const sub = `<a href="${dashboard}/subscriptions/${encodeURIComponent(d.subscriptionId)}">${escapeHtml(d.subscriptionId)}</a>`;
    return `<li>${who}: ${escapeHtml(differenceWords(d))} (${sub})</li>`;
  });
  const more = check.differences.length - lines.length;
  return head
    + `<p>Today’s check compared ${check.recordsCompared} of our records with ${check.subscriptionsRead} subscriptions in Stripe.</p>`
    + `<ul>${lines.join('')}</ul>`
    + (more > 0 ? `<p>And ${more} more, kept with the check’s record.</p>` : '')
    + '<p>A change made in the same minute as the check can show here and clear itself: if tomorrow’s check no longer lists it, nothing was wrong.</p>';
}

export function runTodaysBillingDriftCheck(now: Date): Promise<DriftCheck> {
  return runBillingDriftCheck({
    environment: stripeEnvironment(),
    listSubscriptions,
    retrieveSubscription,
    loadRecords,
    loadFollowedElsewhere,
    planOfPrice: getPlanFromPriceId,
    sendAlert,
    saveCheck,
    emailHtml: driftEmailHtml,
    now,
  });
}
