import { supabaseAdmin } from '@/lib/supabase-admin';
import { openPreviewOrgIds } from '@/lib/preview-org-server';
import { PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';
import { tournamentToday } from './timezone';
import { countPeople, peopleByIds } from './platform-people-lookup';
import { freeTimePortalOrgIds } from './portal-free-time-server';
import { isTrialEnding } from './renewals';

type OrgMetricRow = {
  id: string;
  name: string;
  plan_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  created_at: string;
  stripe_subscription_id: string | null;
};

type MemberRow = {
  organization_id: string;
  user_id: string;
  role: string;
  status: string | null;
};

type OverrideRow = {
  id: string;
  org_id: string;
  type: string;
  expires_at: string | null;
  revoked_at: string | null;
};

type PlatformEventRow = {
  event_type: string;
  occurred_at: string;
  org_id?: string | null;
};

type CountResult = { count: number | null; error?: unknown };

export const PLAN_ORDER: OrgPlan[] = ['tournament', 'team', 'tournament_plus', 'league', 'club', 'club_large'];
export const STATUS_ORDER = ['active', 'trialing', 'past_due', 'canceled'];

/* ⚰ `CommandCenterStats = Awaited<ReturnType<typeof getCommandCenterStats>>` stood here and was
   deleted 2026-09-01 (cleanup tranche 6) with zero references. It is the cheapest kind of dead
   type: derived entirely from a live function, so it always compiled, always looked current, and
   named nothing anybody needed to name. Callers infer the return type at the call site. */

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function daysAhead(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function safeCount(name: string, query: PromiseLike<CountResult>) {
  const { count, error } = await Promise.resolve(query).catch((error: unknown) => {
    console.warn(`[platform-admin] ${name} metric failed`, error);
    return { count: 0, error };
  });
  if (error) console.warn(`[platform-admin] ${name} metric failed`, error);
  return count ?? 0;
}

// One plan→label rule for the whole console, client-safe in lib/platform-labels.ts; re-exported for the screens that read it here.
export { planLabel } from './platform-labels';

export function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

/**
 * The preview clubs (Track P, T1) and everything they own, so the platform's own numbers describe
 * CUSTOMERS. A prospect's preview club is not a customer, its seeded event is not an event
 * somebody chose to run, and its invented teams are not registrations — counted, they quietly
 * inflate every headline on this page and every snapshot taken from it.
 *
 * Two ids, resolved once and reused across the queries below: the org (which scopes most tables
 * directly) and its tournaments (which is how `teams` is scoped — teams hang off a tournament, not
 * an org). Fails quiet on a page (the snapshot fails closed): the metrics are momentarily off by one
 * preview, which is the right failure for a reporting page.
 */
async function resolvePreviewExclusions(strictPreviews = false): Promise<{ orgIds: string[]; tournamentIds: string[] }> {
  // The preview clubs (Track P, T1), read fresh. The SNAPSHOT fails closed (`strictPreviews`): a snapshot written with a
  // prospect's preview in it would keep counting a club that is not a customer. A page (Today, the menu counts, Business
  // numbers) says so in the log and goes on: the club list itself still drops previews by its own column below, and a
  // failed read of the marker is the database failing, when the page has bigger news.
  const orgIds = await openPreviewOrgIds().catch((error: unknown) => {
    if (strictPreviews) throw error;
    console.warn('[platform-admin] preview exclusion failed', error);
    return [] as string[];
  });
  if (orgIds.length === 0) return { orgIds, tournamentIds: [] };
  const { data, error } = await supabaseAdmin
    .from('tournaments')
    .select('id')
    .in('org_id', orgIds);
  if (error) {
    console.warn('[platform-admin] preview tournament exclusion failed', error);
    return { orgIds, tournamentIds: [] };
  }
  return { orgIds, tournamentIds: (data ?? []).map(row => row.id as string) };
}

/**
 * The orgs every customer count leaves out, as one set: the preview clubs (Track P, T1; read fail-closed
 * when not handed in), and the Coaches Portals staff gave free time
 * (Support console Stage 4b, T35: stored cancelled for their whole life, so they would read as churn). Business numbers
 * and Renewals (Plans & pricing Stage 2 Part 4) read this one rule. A free-time read failure leaves the portals counted,
 * as before.
 */
export async function notCustomerOrgIds(previewOrgIds?: readonly string[]): Promise<Set<string>> {
  const [previews, freeTimePortals] = await Promise.all([
    previewOrgIds ?? openPreviewOrgIds(),
    freeTimePortalOrgIds().catch(() => new Set<string>()),
  ]);
  return new Set([...previews, ...freeTimePortals]);
}

/** PostgREST's `in` list literal. Returns null when there is nothing to exclude. */
function notInList(ids: string[]): string | null {
  return ids.length > 0 ? `(${ids.join(',')})` : null;
}

export async function getCommandCenterStats(options: { since?: string | null; strictPreviews?: boolean } = {}) {
  const { orgIds: previewOrgIds, tournamentIds: previewTournamentIds } = await resolvePreviewExclusions(options.strictPreviews);
  const notPreviewOrg = notInList(previewOrgIds);
  const notPreviewTournament = notInList(previewTournamentIds);
  /** Apply an org exclusion to a count query, or leave it exactly as it was. */
  const exOrg = <T extends { not: (col: string, op: string, val: string) => T }>(q: T, column = 'org_id'): T =>
    notPreviewOrg ? q.not(column, 'in', notPreviewOrg) : q;

  const now = new Date().toISOString();
  const sevenDaysAgo = daysAgo(7);
  const thirtyDaysAgo = daysAgo(30);
  const ninetyDaysAgo = daysAgo(90);
  const eventWindowStart = options.since && options.since < ninetyDaysAgo ? options.since : ninetyDaysAgo;
  const trialWindowEnd = daysAhead(14);
  const today = tournamentToday();
  const retentionWindowEnd = daysAhead(30);
  const inactiveOwnerCutoff = thirtyDaysAgo;

  // The owners, read once: the counts use them, and their sign-in facts chain straight off them (overlapping the counts).
  const ownersRead = Promise.resolve(supabaseAdmin
    .from('organization_members')
    .select('organization_id, user_id, role, status')
    .eq('role', 'owner')
    .limit(5000));
  const ownerSignIns = ownersRead
    .then(res => peopleByIds(((res.data ?? []) as MemberRow[]).map(m => m.user_id)))
    .catch(() => new Map<string, { lastSignInAt: string | null }>());

  const [
    orgsRes,
    membersRes,
    peopleTotal,
    tournamentsTotal,
    tournamentsNonArchived,
    tournamentsActive,
    tournamentsCreated30,
    teamsTotal,
    leagueSeasonsTotal,
    leagueSeasonsActive,
    leagueRegistrationsActive,
    repTeamsTotal,
    repProgramYearsActive,
    accountingEntriesTotal,
    retentionAlertCount,
    overridesRes,
    eventsRes,
  ] = await Promise.all([
    supabaseAdmin
      .from('organizations')
      // No `slug`: the preview filter below keys on row id, so fetching the slug would be a column
      // pulled on every platform-admin dashboard load and read by nobody.
      .select('id, name, plan_id, subscription_status, current_period_end, created_at, stripe_subscription_id')
      // A preview club (Track P, T1) is never a customer, whether or not the id read above answered.
      .eq('is_preview', false)
      .order('created_at', { ascending: false })
      .limit(5000),
    ownersRead,
    // Every customer account, counted in the database (Support console Stage 2, migration 365) — this was the length of
    // one 1,000-account page, so it stopped at 1,000 without saying so.
    // A failed count reads 0 like every other count here (safeCount), and says so in the log.
    countPeople().catch((error: unknown) => { console.warn('[platform-admin] people total metric failed', error); return 0; }),
    safeCount('tournaments total', exOrg(supabaseAdmin.from('tournaments').select('*', { count: 'exact', head: true }))),
    safeCount('tournaments non-archived', exOrg(supabaseAdmin.from('tournaments').select('*', { count: 'exact', head: true }).neq('status', 'archived'))),
    safeCount('tournaments active', exOrg(supabaseAdmin.from('tournaments').select('*', { count: 'exact', head: true }).eq('status', 'active'))),
    safeCount('tournaments created 30 days', exOrg(supabaseAdmin.from('tournaments').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo))),
    safeCount('teams total', (() => {
      // `teams` hangs off a tournament, not an org — so the preview exclusion is by its event.
      const q = supabaseAdmin.from('teams').select('*', { count: 'exact', head: true });
      return notPreviewTournament ? q.not('tournament_id', 'in', notPreviewTournament) : q;
    })()),
    safeCount('league seasons total', exOrg(supabaseAdmin.from('league_seasons').select('*', { count: 'exact', head: true }))),
    safeCount('league seasons active', exOrg(supabaseAdmin.from('league_seasons').select('*', { count: 'exact', head: true }).in('status', ['registration_open', 'registration_closed', 'active']))),
    safeCount('league active registrations', exOrg(supabaseAdmin.from('league_registrations').select('*', { count: 'exact', head: true }).eq('status', 'active'))),
    safeCount('rep teams total', exOrg(supabaseAdmin.from('rep_teams').select('*', { count: 'exact', head: true }).eq('is_archived', false))),
    safeCount('rep program years active', exOrg(supabaseAdmin.from('rep_program_years').select('*', { count: 'exact', head: true }).eq('status', 'active'))),
    // Entries hang off a ledger, and the ledger names the club (the same preview exclusion, one join away).
    safeCount('accounting entries total', notPreviewOrg
      ? exOrg(supabaseAdmin.from('accounting_entries').select('id, accounting_ledgers!inner(org_id)', { count: 'exact', head: true }), 'accounting_ledgers.org_id')
      : supabaseAdmin.from('accounting_entries').select('*', { count: 'exact', head: true })),
    safeCount(
      'retention alert records',
      exOrg(supabaseAdmin
        .from('billing_retained_records')
        .select('*', { count: 'exact', head: true })
        .in('retained_state', ['retained_inactive', 'pending_purge'])
        .lte('retention_until', retentionWindowEnd))
    ),
    supabaseAdmin
      .from('org_overrides')
      .select('id, org_id, type, expires_at, revoked_at')
      .is('revoked_at', null)
      .not('expires_at', 'is', null)
      .limit(5000),
    supabaseAdmin
      .from('platform_events')
      .select('event_type, occurred_at, metadata, org_id')
      .in('event_type', [
        'subscription_canceled', 'plan_downgraded', 'subscription_past_due', 'subscription_recovered',
        'subscription_started', 'plan_upgraded',
      ])
      .gte('occurred_at', eventWindowStart)
      // Newest first: if the high-volume funnel events ever pass the cap, the oldest of the 90 days drop,
      // not the 7- and 30-day counts the billing rows lean on.
      .order('occurred_at', { ascending: false })
      .limit(5000),
  ]);

  // Preview clubs are dropped from members and overrides here rather than in the queries, by the ids read above.
  const previewOrgIdSet = new Set(previewOrgIds);
  const notCustomers = await notCustomerOrgIds(previewOrgIds);
  const orgs = ((orgsRes.data ?? []) as OrgMetricRow[]).filter(org => !notCustomers.has(org.id));
  const members = ((membersRes.data ?? []) as MemberRow[])
    .filter(member => !previewOrgIdSet.has(member.organization_id));
  const overrides = ((overridesRes.data ?? []) as OverrideRow[])
    .filter(row => !previewOrgIdSet.has(row.org_id));
  if (eventsRes.error) console.warn('[platform-admin] platform events metric failed', eventsRes.error);
  // A club closed AGAIN when free time that reopened it ran out (owner ruling 2026-11-18) churned once, at its first end.
  const events = eventsRes.error ? [] : ((eventsRes.data ?? []) as Array<PlatformEventRow & { metadata?: { freeTimeEnded?: boolean } | null }>)
    .filter(e => !(e.event_type === 'subscription_canceled' && e.metadata?.freeTimeEnded === true))
    // A preview club's events are not a customer's (the same set the counts above leave out).
    .filter(e => !e.org_id || !previewOrgIdSet.has(e.org_id));
  const ownerOrgIds = new Set(
    members
      .filter(member => (member.status ?? 'active') !== 'suspended')
      .map(member => member.organization_id)
  );
  // Overrides expiring within the next 14 days (and not yet lapsed): the actionable set.
  // Expired ones auto-drop and stop granting access on their own, so we surface UPCOMING lapses to
  // action (extend / let lapse) rather than nag about ones already moot.
  const overridesExpiringSoon = overrides.filter(
    row => row.expires_at && row.expires_at >= now && row.expires_at <= trialWindowEnd,
  ).length;
  // The owners' last sign-in, read by account id with no cap (it was the first 1,000 accounts, so an owner past the
  // first page always read as inactive). Started with the counts above, so it overlaps them.
  const authUserById = await ownerSignIns;

  const byPlan = Object.fromEntries(PLAN_ORDER.map(plan => [plan, 0])) as Record<string, number>;
  const newOrgsByPlan = Object.fromEntries(PLAN_ORDER.map(plan => [plan, 0])) as Record<string, number>;
  const byStatus = Object.fromEntries(STATUS_ORDER.map(status => [status, 0])) as Record<string, number>;
  const statusByPlan = Object.fromEntries(
    PLAN_ORDER.map(plan => [plan, Object.fromEntries(STATUS_ORDER.map(status => [status, 0])) as Record<string, number>])
  ) as Record<string, Record<string, number>>;

  let estimatedMrr = 0;
  let trialEndingSoon = 0;
  let orgsWithoutOwner = 0;
  let orgsWithInactiveOwner = 0;
  let newOrgs7 = 0;
  let newOrgs30 = 0;
  let newOrgs90 = 0;

  for (const org of orgs) {
    const plan = (org.plan_id ?? 'tournament') as OrgPlan;
    const status = org.subscription_status ?? 'active';

    byPlan[plan] = (byPlan[plan] ?? 0) + 1;
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (statusByPlan[plan]) statusByPlan[plan][status] = (statusByPlan[plan][status] ?? 0) + 1;

    if (status === 'active') estimatedMrr += PLAN_CONFIG[plan]?.monthlyPrice ?? 0;

    // F2: from today to 14 days out, in Ontario days (a trial whose date has passed is Renewals' amber row, not this).
    if (isTrialEnding(status, org.current_period_end, today)) {
      trialEndingSoon += 1;
    }

    if (!ownerOrgIds.has(org.id)) orgsWithoutOwner += 1;
    if (org.created_at >= sevenDaysAgo) newOrgs7 += 1;
    if (org.created_at >= thirtyDaysAgo) {
      newOrgs30 += 1;
      newOrgsByPlan[plan] = (newOrgsByPlan[plan] ?? 0) + 1;
    }
    if (org.created_at >= ninetyDaysAgo) newOrgs90 += 1;

    const ownerMembers = members.filter(member => member.organization_id === org.id);
    if (ownerMembers.length > 0) {
      const mostRecentOwnerSignIn = ownerMembers
        .map(member => authUserById.get(member.user_id)?.lastSignInAt ?? null)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1);
      if (!mostRecentOwnerSignIn || mostRecentOwnerSignIn < inactiveOwnerCutoff) {
        orgsWithInactiveOwner += 1;
      }
    }
  }

  // Leads are counted in lib/lead-numbers.ts over every lead (Support console Stage 7 Part 2), not here.

  function countEvents(eventType: string, since: string) {
    return events.filter(event => event.event_type === eventType && event.occurred_at >= since).length;
  }

  function recoveryRate(since: string) {
    const pastDue = countEvents('subscription_past_due', since);
    const recovered = countEvents('subscription_recovered', since);
    return pastDue > 0 ? Math.round((recovered / pastDue) * 100) : 0;
  }

  return {
    generatedAt: now,
    totals: {
      organizations: orgs.length,
      users: peopleTotal,
      tournaments: tournamentsTotal,
      teams: teamsTotal,
      estimatedMrr,
      estimatedArr: estimatedMrr * 12,
    },
    subscription: {
      byPlan,
      byStatus,
      statusByPlan,
      trialEndingSoon,
    },
    growth: {
      newOrgs7,
      newOrgs30,
      newOrgs90,
      newOrgsByPlan,
    },
    usage: {
      tournamentsNonArchived,
      tournamentsActive,
      tournamentsCreated30,
      teamsTotal,
      leagueSeasonsTotal,
      leagueSeasonsActive,
      leagueRegistrationsActive,
      repTeamsTotal,
      repProgramYearsActive,
      accountingEntriesTotal,
    },
    lifecycle: {
      newSubscriptions: {
        days7: countEvents('subscription_started', sevenDaysAgo),
        days30: countEvents('subscription_started', thirtyDaysAgo),
        days90: countEvents('subscription_started', ninetyDaysAgo),
      },
      upgrades: {
        days7: countEvents('plan_upgraded', sevenDaysAgo),
        days30: countEvents('plan_upgraded', thirtyDaysAgo),
        days90: countEvents('plan_upgraded', ninetyDaysAgo),
      },
      cancellations: {
        days7: countEvents('subscription_canceled', sevenDaysAgo),
        days30: countEvents('subscription_canceled', thirtyDaysAgo),
        days90: countEvents('subscription_canceled', ninetyDaysAgo),
      },
      downgrades: {
        days7: countEvents('plan_downgraded', sevenDaysAgo),
        days30: countEvents('plan_downgraded', thirtyDaysAgo),
        days90: countEvents('plan_downgraded', ninetyDaysAgo),
      },
      recoveries: {
        days7: countEvents('subscription_recovered', sevenDaysAgo),
        days30: countEvents('subscription_recovered', thirtyDaysAgo),
        days90: countEvents('subscription_recovered', ninetyDaysAgo),
      },
      recoveryRate30: recoveryRate(thirtyDaysAgo),
    },
    alerts: {
      pastDue: byStatus.past_due ?? 0,
      newPastDueSinceLastVisit: options.since ? countEvents('subscription_past_due', options.since) : 0,
      trialEndingSoon,
      retentionAlertCount,
      overridesExpiringSoon,
      orgsWithoutOwner,
      orgsWithInactiveOwner,
    },
  };
}

export async function getLatestPlatformMetricSnapshot() {
  const { data, error } = await supabaseAdmin
    .from('platform_metric_snapshots')
    .select('snapshot_date, created_at, created_by_email, source')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[platform-admin] latest metric snapshot read failed', error);
    return null;
  }

  return data as {
    snapshot_date: string;
    created_at: string;
    created_by_email: string | null;
    source: string;
  } | null;
}

export async function writeTodayPlatformMetricSnapshot(actorEmail: string, source = 'manual') {
  // Strict: a snapshot is kept, so it is not written at all if the preview clubs cannot be left out (Track P, T1).
  const metrics = await getCommandCenterStats({ strictPreviews: true });
  const snapshotDate = tournamentToday();
  const { data, error } = await supabaseAdmin
    .from('platform_metric_snapshots')
    .upsert({
      snapshot_date: snapshotDate,
      metrics,
      source,
      created_by_email: actorEmail,
      created_at: new Date().toISOString(),
    }, { onConflict: 'snapshot_date' })
    .select('id, snapshot_date, created_at')
    .single();

  if (error) throw error;
  return data as { id: string; snapshot_date: string; created_at: string };
}
