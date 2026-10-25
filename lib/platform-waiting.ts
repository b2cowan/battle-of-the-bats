/**
 * What is waiting on us — Today's table and the menu's amber counts, from ONE list (Support console Stage 2, owner rulings
 * A5 + A11, 2026-10-25; drawings Ub7fXLh29SC34Zp4oqKUx1, "Today").
 *
 * ⚖ EVERY QUEUE IS REAL (A5). Eleven are the counts Overview's Action queue already computed (owner inactive, missing
 * owner, retention, past due — "N since your last visit" is its reason, not a row — trials ending, overrides ending, new
 * leads, campaigns past due and due soon, the approval queue); two are new but read data we keep: error groups first
 * seen since the last visit, and feedback marked new. Nothing invented: "Free time ending" waits for Stage 4, and
 * Overrides ending stands in until then.
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
};

type QueueDef = Omit<WaitingQueue, 'count' | 'why'> & { why: string | ((ctx: { sinceVisit: number }) => string) };

/** The queues in their drawn order within each group. */
const QUEUES: QueueDef[] = [
  { key: 'owner_inactive', group: 'customers', label: 'Owner inactive', why: 'The owner has not signed in for 30 days', clearLabel: 'owner inactive', href: '/platform-admin/orgs?filter=owner_inactive', entry: 'organizations' },
  { key: 'retention', group: 'customers', label: 'Retention', why: 'A cancelled club whose kept data runs out within 30 days', clearLabel: 'retention', href: '/platform-admin/retention', entry: 'retention' },
  { key: 'missing_owner', group: 'customers', label: 'Missing owner', why: 'A club with nobody as its owner', clearLabel: 'missing owner', href: '/platform-admin/orgs?filter=no_owner', entry: 'organizations' },
  {
    key: 'past_due', group: 'customers', label: 'Past due',
    why: ({ sinceVisit }) => `A subscription Stripe could not charge${sinceVisit > 0 ? ` · ${sinceVisit} since your last visit` : ''}`,
    clearLabel: 'past due', href: '/platform-admin/orgs?status=past_due', entry: 'organizations',
  },
  { key: 'trials_ending', group: 'customers', label: 'Trials ending', why: 'A trial that ends in the next 14 days', clearLabel: 'trials ending in 14 days', href: '/platform-admin/orgs?filter=trial_ending', entry: 'organizations' },
  { key: 'overrides_ending', group: 'customers', label: 'Overrides ending', why: 'An override that ends in the next 14 days', clearLabel: 'overrides ending in 14 days', href: '/platform-admin/orgs?filter=expiring_overrides', entry: 'organizations' },
  { key: 'new_errors', group: 'health', label: 'New errors', why: 'An error first seen since your last visit', clearLabel: 'new errors', href: '/platform-admin/observability', entry: 'observability' },
  { key: 'new_feedback', group: 'health', label: 'New feedback', why: 'A message from inside the product nobody has triaged', clearLabel: 'new feedback', href: '/platform-admin/feedback', entry: 'feedback' },
  { key: 'campaigns_past_due', group: 'growth', label: 'Campaigns past due', why: 'A planned campaign whose send date has passed', clearLabel: 'campaigns past due', href: '/platform-admin/email', entry: 'email' },
  { key: 'campaigns_due_soon', group: 'growth', label: 'Campaigns due soon', why: `Due in the next ${UPCOMING_WINDOW_DAYS} days`, clearLabel: 'campaigns due soon', href: '/platform-admin/email', entry: 'email' },
  { key: 'new_leads', group: 'growth', label: 'New leads', why: 'An early-access sign-up nobody has answered yet', clearLabel: 'new leads', href: '/platform-admin/early-access', entry: 'early_access' },
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
  let pastDue = 0;
  let dueSoon = 0;
  for (const row of tmplRes.data ?? []) {
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
};

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

  const [stats, campaigns, approvals, newErrors, newFeedback] = await Promise.all([
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
  ]);

  const counts: Record<string, number> = {
    owner_inactive: stats.alerts.orgsWithInactiveOwner,
    retention: stats.alerts.retentionAlertCount,
    missing_owner: stats.alerts.orgsWithoutOwner,
    past_due: stats.alerts.pastDue,
    trials_ending: stats.alerts.trialEndingSoon,
    overrides_ending: stats.alerts.overridesExpiringSoon,
    new_errors: newErrors,
    new_feedback: newFeedback,
    campaigns_past_due: campaigns.pastDue,
    campaigns_due_soon: campaigns.dueSoon,
    new_leads: stats.alerts.newEarlyAccessLeads,
    approval_queue: approvals,
  };
  const sinceVisit = stats.alerts.newPastDueSinceLastVisit;

  return {
    stats,
    queues: visible.map(q => ({
      ...q,
      why: typeof q.why === 'function' ? q.why({ sinceVisit }) : q.why,
      count: counts[q.key] ?? 0,
    })),
  };
}

/** Errors recorded in the last 24 hours — Today's health line (Today alone shows it, so the menu never counts it). */
export async function countErrorsLastDay(): Promise<number> {
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString(); // utc-intentional: an instant window
  return headCount(supabaseAdmin.from('error_events').select('id', { count: 'exact', head: true }).gte('occurred_at', dayAgo));
}

/** The menu's counts: each entry's waiting total (the sum of the queues it clears). Pure. */
export function countsByEntry(queues: WaitingQueue[]): Partial<Record<PlatformArea, number>> {
  const out: Partial<Record<PlatformArea, number>> = {};
  for (const q of queues) {
    if (q.count > 0) out[q.entry] = (out[q.entry] ?? 0) + q.count;
  }
  return out;
}
