/**
 * What is waiting on us — Today's table and the menu's amber counts, from ONE list (Support console Stage 2, owner rulings
 * A5 + A11, 2026-10-25; drawings Ub7fXLh29SC34Zp4oqKUx1, "Today").
 *
 * ⚖ EVERY QUEUE IS REAL (A5). Eleven are the counts Overview's Action queue already computed (owner inactive, missing
 * owner, retention, past due — "N since your last visit" is its reason, not a row — trials ending, overrides ending, new
 * leads, campaigns past due and due soon, the approval queue); two are new but read data we keep: error groups first
 * seen since the last visit, and feedback marked new. Nothing invented. Support console Stage 4 replaced "Overrides
 * ending" with **Free time ending** (owner ruling Q7): every timed grant, 14 days, counting CLUBS, from the same list
 * the Free time page's "Ending in 14 days" filter shows (`lib/free-time-list.ts`), so the two numbers cannot differ.
 *
 * ⚖ ROLES TRIM IT. A role sees only the queues whose list it can open — the menu's rule. A queue it can read but not
 * clear still shows, its list opening read-only.
 *
 * ⚖ A COUNT SITS BESIDE THE ENTRY THAT CLEARS IT (`entry`), so a folded menu group's pill (the sum of its rows, A11) adds
 * up to Today's group total.
 */
import { supabaseAdmin } from './supabase-admin';
import { canViewPlatformArea, type PlatformArea } from './platform-areas';
import type { PlatformRole } from './platform-auth';
import { getCommandCenterStats } from './platform-metrics';
import { classifyCampaignSend, UPCOMING_WINDOW_DAYS } from './marketing-schedule';
import { tournamentToday } from './timezone';
import { freeTimeEndingCount, getStaffFreeTime } from './free-time-list';
import { LIVE_MARKETING_EMAIL_KEYS } from './marketing-email-defaults';
import { readLeadBook, readOffers } from './lead-book';
import { followUpDue, needsYou } from './lead-numbers';
import { readOnlinePaymentsHealth } from './platform-online-payments';

export type WaitingGroupKey = 'customers' | 'health' | 'growth' | 'product';

/** Today's groups, in the drawn order. */
export const WAITING_GROUPS: readonly WaitingGroupKey[] = ['customers', 'health', 'growth', 'product'];

export const WAITING_GROUP_LABELS: Record<WaitingGroupKey, string> = {
  customers: 'Customers',
  health: 'Health',
  growth: 'Growth',
  product: 'Product',
};

export type WaitingQueue = {
  key: string;
  group: WaitingGroupKey;
  /** The queue's name, as Today's first column reads it. */
  label: string;
  /** Why its items wait. */
  why: string;
  /** Its words in the quiet "Clear: …" line when nothing waits. */
  clearLabel: string;
  count: number;
  href: string;
  /** The page whose list clears it — gates who sees it, and is the menu entry that carries its count. */
  entry: PlatformArea;
  /** Its records could not be read: Today says "Not read", never 0 (Stage 7). */
  notRead?: boolean;
};

type QueueDef = Omit<WaitingQueue, 'count' | 'why'> & { why: string | ((ctx: { sinceVisit: number }) => string) };

/** The queues in their drawn order within each group. */
const QUEUES: QueueDef[] = [
  { key: 'owner_inactive', group: 'customers', label: 'Owner inactive', why: 'The owner has not signed in for 30 days', clearLabel: 'owner inactive', href: '/platform-admin/orgs?filter=owner_inactive', entry: 'organizations' },
  { key: 'retention', group: 'customers', label: 'Retention', why: 'A cancelled club whose kept data runs out within 30 days', clearLabel: 'retention', href: '/platform-admin/retention', entry: 'retention' },
  { key: 'free_time_ending', group: 'customers', label: 'Free time ending', why: 'A club whose free time ends in the next 14 days: a plan, sections or a billing status', clearLabel: 'free time ending in 14 days', href: '/platform-admin/free-time?view=staff&ending=14', entry: 'free_time' },
  { key: 'missing_owner', group: 'customers', label: 'Missing owner', why: 'A club with nobody as its owner', clearLabel: 'missing owner', href: '/platform-admin/orgs?filter=no_owner', entry: 'organizations' },
  {
    key: 'past_due', group: 'customers', label: 'Past due',
    why: ({ sinceVisit }) => `A subscription Stripe could not charge${sinceVisit > 0 ? ` · ${sinceVisit} since your last visit` : ''}`,
    clearLabel: 'past due', href: '/platform-admin/orgs?status=past_due', entry: 'organizations',
  },
  { key: 'trials_ending', group: 'customers', label: 'Trials ending', why: 'A trial that ends in the next 14 days', clearLabel: 'trials ending in 14 days', href: '/platform-admin/orgs?filter=trial_ending', entry: 'organizations' },
  { key: 'new_errors', group: 'health', label: 'New errors', why: 'An error first seen since your last visit', clearLabel: 'new errors', href: '/platform-admin/observability', entry: 'observability' },
  { key: 'new_feedback', group: 'health', label: 'New feedback', why: 'A message from inside the product nobody has triaged', clearLabel: 'new feedback', href: '/platform-admin/feedback', entry: 'feedback' },
  // Club Tier 12d-2 (words §6.1 `pa.rail`: the count is the length of the Health list).
  { key: 'online_payments', group: 'health', label: 'Online payments', why: 'A club’s online payments need a look: a dispute, a closed account, a message we couldn’t process, an unpaid fee', clearLabel: 'online payments', href: '/platform-admin/online-payments', entry: 'online_payments' },
  // Growth (Stage 7, owner Q9 d): the three lead rows count through the one definition (lib/lead-numbers.ts); stuck is
  // shown on Leads and is never a row here.
  { key: 'new_leads', group: 'growth', label: 'New leads', why: 'A lead nobody has answered yet', clearLabel: 'new leads', href: '/platform-admin/early-access', entry: 'early_access' },
  { key: 'follow_ups_due', group: 'growth', label: 'Follow-ups due', why: 'A lead whose follow-up date has come', clearLabel: 'follow-ups due', href: '/platform-admin/early-access', entry: 'early_access' },
  { key: 'signup_to_confirm', group: 'growth', label: 'Sign-up to confirm', why: 'A club signed up with a lead’s email; is it theirs?', clearLabel: 'sign-ups to confirm', href: '/platform-admin/early-access', entry: 'early_access' },
  { key: 'campaigns_past_due', group: 'growth', label: 'Campaigns past due', why: 'A planned campaign whose send date has passed', clearLabel: 'campaigns past due', href: '/platform-admin/email', entry: 'email' },
  { key: 'campaigns_due_soon', group: 'growth', label: 'Campaigns due soon', why: `Due in the next ${UPCOMING_WINDOW_DAYS} days`, clearLabel: 'campaigns due soon', href: '/platform-admin/email', entry: 'email' },
  { key: 'approval_queue', group: 'product', label: 'Approval queue', why: 'A catalogue change waiting for review or to go live', clearLabel: 'the approval queue', href: '/platform-admin/change-requests', entry: 'change_requests' },
];

/** The queues a role sees (whose list it can open), in order. Pure. */
function queuesFor(role: PlatformRole): QueueDef[] {
  return QUEUES.filter(q => canViewPlatformArea(role, q.entry));
}

async function campaignAlerts(): Promise<{ pastDue: number; dueSoon: number }> {
  const todayISO = tournamentToday();
  const [tmplRes, batchRes] = await Promise.all([
    supabaseAdmin.from('platform_email_templates').select('key, planned_send_date').eq('category', 'marketing'),
    supabaseAdmin.from('email_batches').select('email_key').eq('status', 'complete'),
  ]);
  const sentKeys = new Set((batchRes.data ?? []).map(b => b.email_key as string));
  // Live campaigns only, the board's own list: a retired email is never "past due" (Stage 7, owner Q10).
  const live = new Set(LIVE_MARKETING_EMAIL_KEYS);
  let pastDue = 0;
  let dueSoon = 0;
  for (const row of (tmplRes.data ?? []).filter(r => live.has(r.key as string))) {
    const status = classifyCampaignSend({
      plannedDate: (row.planned_send_date as string | null) ?? null,
      sent: sentKeys.has(row.key as string),
      todayISO,
    });
    if (status === 'past_due') pastDue++;
    else if (status === 'due_soon') dueSoon++;
  }
  return { pastDue, dueSoon };
}

async function headCount(q: PromiseLike<{ count: number | null }>): Promise<number> {
  try {
    return (await q).count ?? 0;
  } catch {
    return 0;
  }
}

type WaitingSnapshot = {
  queues: WaitingQueue[];
  stats: Awaited<ReturnType<typeof getCommandCenterStats>>;
  /** The menu's Leads pill counts "Needs you", not the sum of Today's three lead rows (a lead can sit in two). */
  entryCounts: Partial<Record<PlatformArea, number>>;
};

type LeadCounts = { newLeads: number; followUpsDue: number; toConfirm: number; needYou: number } | null;

/** Today's three lead rows and the menu's "Needs you", over every lead. null = the leads could not be read. */
async function leadCounts(): Promise<LeadCounts> {
  const book = await readLeadBook();
  if (book.kind === 'not_read') return null;
  const offers = await readOffers(book.value);
  if (offers.kind === 'not_read') return null;
  const now = new Date();
  const today = tournamentToday();
  const leads = book.value;
  return {
    newLeads: leads.filter(l => l.step === 'new').length,
    followUpsDue: leads.filter(l => followUpDue(l, today)).length,
    toConfirm: leads.filter(l => offers.value.has(l.id)).length,
    needYou: leads.filter(l => needsYou(l, now, today, offers.value.has(l.id))).length,
  };
}

/**
 * One snapshot per role and visit for 30 seconds, per server copy: Today and the menu's counts ask for the same thing in
 * the same moment (the page renders, then its menu reads its counts), and a staff member moving between pages would
 * otherwise recount everything each time. A queue is at most 30 seconds stale.
 */
const SNAPSHOT_FRESH_MS = 30_000;
const snapshots = new Map<string, { at: number; value: Promise<WaitingSnapshot> }>();

/**
 * Every queue this role sees, counted. `since` is the person's previous visit (new errors, past due since). A queue the
 * role does not see is never counted.
 */
export function getWaitingSnapshot(role: PlatformRole, since: string | null): Promise<WaitingSnapshot> {
  const key = `${role}|${since ?? ''}`;
  const now = Date.now();
  const hit = snapshots.get(key);
  if (hit && now - hit.at < SNAPSHOT_FRESH_MS) return hit.value;
  for (const [k, v] of snapshots) if (now - v.at >= SNAPSHOT_FRESH_MS) snapshots.delete(k);
  const value = countWaiting(role, since);
  snapshots.set(key, { at: now, value });
  value.catch(() => snapshots.delete(key));
  return value;
}

async function countWaiting(role: PlatformRole, since: string | null): Promise<WaitingSnapshot> {
  const visible = queuesFor(role);
  const wants = (key: string) => visible.some(q => q.key === key);
  const nowMs = Date.now();
  const dayAgo = new Date(nowMs - 86_400_000).toISOString(); // utc-intentional: an instant window
  const sinceIso = since ?? dayAgo;

  const wantsLeads = wants('new_leads') || wants('follow_ups_due') || wants('signup_to_confirm');
  const [stats, campaigns, approvals, newErrors, newFeedback, freeTimeEnding, leads] = await Promise.all([
    getCommandCenterStats({ since }),
    wants('campaigns_past_due') || wants('campaigns_due_soon') ? campaignAlerts() : Promise.resolve({ pastDue: 0, dueSoon: 0 }),
    wants('approval_queue')
      ? headCount(supabaseAdmin.from('platform_catalog_change_requests').select('id', { count: 'exact', head: true }).in('status', ['needs_review', 'approved']))
      : Promise.resolve(0),
    wants('new_errors')
      ? headCount(supabaseAdmin.from('error_groups').select('id', { count: 'exact', head: true }).gte('first_seen_at', sinceIso))
      : Promise.resolve(0),
    wants('new_feedback')
      ? headCount(supabaseAdmin.from('feedback_submissions').select('id', { count: 'exact', head: true }).eq('status', 'new'))
      : Promise.resolve(0),
    wants('free_time_ending') ? getStaffFreeTime().then(freeTimeEndingCount).catch(() => 0) : Promise.resolve(0),
    wantsLeads ? leadCounts().catch(() => null) : Promise.resolve(null),
  ]);
  // A list that could not be read is "Not read", never 0 (Stage 7).
  const onlinePayments = wants('online_payments') ? await readOnlinePaymentsHealth().then(r => r.length).catch(() => null) : 0;

  const counts: Record<string, number> = {
    owner_inactive: stats.alerts.orgsWithInactiveOwner,
    retention: stats.alerts.retentionAlertCount,
    missing_owner: stats.alerts.orgsWithoutOwner,
    past_due: stats.alerts.pastDue,
    trials_ending: stats.alerts.trialEndingSoon,
    free_time_ending: freeTimeEnding,
    new_errors: newErrors,
    new_feedback: newFeedback,
    campaigns_past_due: campaigns.pastDue,
    campaigns_due_soon: campaigns.dueSoon,
    new_leads: leads?.newLeads ?? 0,
    follow_ups_due: leads?.followUpsDue ?? 0,
    signup_to_confirm: leads?.toConfirm ?? 0,
    approval_queue: approvals,
    online_payments: onlinePayments ?? 0,
  };
  const sinceVisit = stats.alerts.newPastDueSinceLastVisit;

  return {
    stats,
    queues: visible.map(q => ({
      ...q,
      why: typeof q.why === 'function' ? q.why({ sinceVisit }) : q.why,
      count: counts[q.key] ?? 0,
      ...(LEAD_QUEUES.has(q.key) && wantsLeads && !leads ? { notRead: true } : {}),
      ...(q.key === 'online_payments' && onlinePayments === null ? { notRead: true } : {}),
    })),
    entryCounts: wantsLeads && leads ? { early_access: leads.needYou } : {},
  };
}

/** Errors recorded in the last 24 hours — Today's health line (Today alone shows it, so the menu never counts it). */
export async function countErrorsLastDay(): Promise<number> {
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString(); // utc-intentional: an instant window
  return headCount(supabaseAdmin.from('error_events').select('id', { count: 'exact', head: true }).gte('occurred_at', dayAgo));
}

const LEAD_QUEUES = new Set(['new_leads', 'follow_ups_due', 'signup_to_confirm']);

/**
 * The menu's counts: each entry's waiting total (the sum of the queues it clears), unless the snapshot names the entry's
 * own count (Leads: "Needs you"). Pure.
 */
export function countsByEntry(queues: WaitingQueue[], entryCounts: Partial<Record<PlatformArea, number>> = {}): Partial<Record<PlatformArea, number>> {
  const out: Partial<Record<PlatformArea, number>> = {};
  for (const q of queues) {
    if (q.count > 0 && entryCounts[q.entry] === undefined) out[q.entry] = (out[q.entry] ?? 0) + q.count;
  }
  for (const [entry, n] of Object.entries(entryCounts) as [PlatformArea, number][]) if (n > 0) out[entry] = n;
  return out;
}
