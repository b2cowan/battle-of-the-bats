import { supabaseAdmin } from '@/lib/supabase-admin';
import { PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';

type OrgMetricRow = {
  id: string;
  name: string;
  plan_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  created_at: string;
  enabled_addons: string[] | null;
  free_floor: string | null;
};

type MemberRow = {
  organization_id: string;
  user_id: string;
  role: string;
  status: string | null;
};

type EarlyAccessLeadRow = {
  internal_status: string | null;
  created_at: string;
  converted_org_id: string | null;
  source_path: string | null;
};

type OverrideRow = {
  id: string;
  org_id: string;
  expires_at: string | null;
  revoked_at: string | null;
};

type PlatformEventRow = {
  event_type: string;
  occurred_at: string;
};

type CountResult = { count: number | null; error?: unknown };

export const PLAN_ORDER: OrgPlan[] = ['tournament', 'team', 'tournament_plus', 'league', 'club'];
export const STATUS_ORDER = ['active', 'trialing', 'past_due', 'canceled'];
export const MODULES = [
  { key: 'module_public_site', label: 'Public Site' },
  { key: 'module_house_league', label: 'House League' },
  { key: 'module_accounting', label: 'Accounting' },
  { key: 'module_rep_teams', label: 'Rep Teams' },
];

export type CommandCenterStats = Awaited<ReturnType<typeof getCommandCenterStats>>;

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

export function planLabel(planId: string) {
  return PLAN_CONFIG[planId as OrgPlan]?.label ?? planId.replace(/_/g, ' ');
}

export function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

function enabledModulesFor(org: OrgMetricRow) {
  const planModules = PLAN_CONFIG[org.plan_id as OrgPlan]?.moduleEntitlements ?? [];
  return new Set([...(org.enabled_addons ?? []), ...planModules]);
}

export async function getCommandCenterStats(options: { since?: string | null } = {}) {
  const now = new Date().toISOString();
  const sevenDaysAgo = daysAgo(7);
  const thirtyDaysAgo = daysAgo(30);
  const ninetyDaysAgo = daysAgo(90);
  const eventWindowStart = options.since && options.since < ninetyDaysAgo ? options.since : ninetyDaysAgo;
  const trialWindowEnd = daysAhead(14);
  const retentionWindowEnd = daysAhead(30);
  const inactiveOwnerCutoff = thirtyDaysAgo;

  const [
    orgsRes,
    membersRes,
    authUsersRes,
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
    earlyLeadsRes,
    retentionAlertCount,
    overridesRes,
    eventsRes,
  ] = await Promise.all([
    supabaseAdmin
      .from('organizations')
      .select('id, name, plan_id, subscription_status, current_period_end, created_at, enabled_addons, free_floor')
      .order('created_at', { ascending: false })
      .limit(5000),
    supabaseAdmin
      .from('organization_members')
      .select('organization_id, user_id, role, status')
      .eq('role', 'owner')
      .limit(5000),
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    safeCount('tournaments total', supabaseAdmin.from('tournaments').select('*', { count: 'exact', head: true })),
    safeCount('tournaments non-archived', supabaseAdmin.from('tournaments').select('*', { count: 'exact', head: true }).neq('status', 'archived')),
    safeCount('tournaments active', supabaseAdmin.from('tournaments').select('*', { count: 'exact', head: true }).eq('status', 'active')),
    safeCount('tournaments created 30 days', supabaseAdmin.from('tournaments').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo)),
    safeCount('teams total', supabaseAdmin.from('teams').select('*', { count: 'exact', head: true })),
    safeCount('league seasons total', supabaseAdmin.from('league_seasons').select('*', { count: 'exact', head: true })),
    safeCount('league seasons active', supabaseAdmin.from('league_seasons').select('*', { count: 'exact', head: true }).in('status', ['registration_open', 'registration_closed', 'active'])),
    safeCount('league active registrations', supabaseAdmin.from('league_registrations').select('*', { count: 'exact', head: true }).eq('status', 'active')),
    safeCount('rep teams total', supabaseAdmin.from('rep_teams').select('*', { count: 'exact', head: true }).eq('is_archived', false)),
    safeCount('rep program years active', supabaseAdmin.from('rep_program_years').select('*', { count: 'exact', head: true }).eq('status', 'active')),
    safeCount('accounting entries total', supabaseAdmin.from('accounting_entries').select('*', { count: 'exact', head: true })),
    supabaseAdmin
      .from('early_access_leads')
      .select('internal_status, created_at, converted_org_id, source_path')
      .order('created_at', { ascending: false })
      .limit(5000),
    safeCount(
      'retention alert records',
      supabaseAdmin
        .from('billing_retained_records')
        .select('*', { count: 'exact', head: true })
        .in('retained_state', ['retained_inactive', 'pending_purge'])
        .lte('retention_until', retentionWindowEnd)
    ),
    supabaseAdmin
      .from('org_overrides')
      .select('id, org_id, expires_at, revoked_at')
      .is('revoked_at', null)
      .not('expires_at', 'is', null)
      .limit(5000),
    supabaseAdmin
      .from('platform_events')
      .select('event_type, occurred_at')
      .in('event_type', [
        'subscription_canceled', 'plan_downgraded', 'subscription_past_due', 'subscription_recovered',
        // Free League Starter (§13) — activation + cap-wall funnel surfaced in the growth tab.
        'free_floor_created', 'existing_user_floor_added', 'league_season_created',
        'league_schedule_generated', 'league_public_page_shared', 'scope_wall_hit', 'upgrade_intent_clicked',
      ])
      .gte('occurred_at', eventWindowStart)
      .limit(5000),
  ]);

  const orgs = ((orgsRes.data ?? []) as OrgMetricRow[]);
  const members = ((membersRes.data ?? []) as MemberRow[]);
  const earlyLeads = ((earlyLeadsRes.data ?? []) as EarlyAccessLeadRow[]);
  const overrides = ((overridesRes.data ?? []) as OverrideRow[]);
  if (eventsRes.error) console.warn('[platform-admin] platform events metric failed', eventsRes.error);
  const events = eventsRes.error ? [] : ((eventsRes.data ?? []) as PlatformEventRow[]);
  const ownerOrgIds = new Set(
    members
      .filter(member => (member.status ?? 'active') !== 'suspended')
      .map(member => member.organization_id)
  );
  const expiredOverrides = overrides.filter(row => row.expires_at && row.expires_at < now).length;
  const authUserById = new Map(
    (authUsersRes.data?.users ?? []).map(user => [user.id, user])
  );

  const byPlan = Object.fromEntries(PLAN_ORDER.map(plan => [plan, 0])) as Record<string, number>;
  const newOrgsByPlan = Object.fromEntries(PLAN_ORDER.map(plan => [plan, 0])) as Record<string, number>;
  const byStatus = Object.fromEntries(STATUS_ORDER.map(status => [status, 0])) as Record<string, number>;
  const statusByPlan = Object.fromEntries(
    PLAN_ORDER.map(plan => [plan, Object.fromEntries(STATUS_ORDER.map(status => [status, 0])) as Record<string, number>])
  ) as Record<string, Record<string, number>>;
  const moduleCounts = Object.fromEntries(MODULES.map(module => [module.key, 0])) as Record<string, number>;

  let estimatedMrr = 0;
  let trialEndingSoon = 0;
  let orgsWithoutOwner = 0;
  let orgsWithInactiveOwner = 0;
  let newOrgs7 = 0;
  let newOrgs30 = 0;
  let newOrgs90 = 0;
  let freeFloorLeagueOrgs = 0;

  for (const org of orgs) {
    const plan = (org.plan_id ?? 'tournament') as OrgPlan;
    const status = org.subscription_status ?? 'active';
    if (org.free_floor === 'league_starter') freeFloorLeagueOrgs += 1;

    byPlan[plan] = (byPlan[plan] ?? 0) + 1;
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (statusByPlan[plan]) statusByPlan[plan][status] = (statusByPlan[plan][status] ?? 0) + 1;

    if (status === 'active') {
      estimatedMrr += PLAN_CONFIG[plan]?.monthlyPrice ?? 0;
    }

    if (status === 'trialing' && org.current_period_end && org.current_period_end <= trialWindowEnd) {
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
        .map(member => authUserById.get(member.user_id)?.last_sign_in_at ?? null)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1);
      if (!mostRecentOwnerSignIn || mostRecentOwnerSignIn < inactiveOwnerCutoff) {
        orgsWithInactiveOwner += 1;
      }
    }

    const enabledModules = enabledModulesFor(org);
    for (const moduleDef of MODULES) {
      if (enabledModules.has(moduleDef.key)) moduleCounts[moduleDef.key] += 1;
    }
  }

  const earlyAccessByStatus = earlyLeads.reduce<Record<string, number>>((acc, lead) => {
    const status = lead.internal_status ?? 'new';
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  const newLeads7 = earlyLeads.filter(lead => lead.created_at >= sevenDaysAgo).length;
  const convertedLeads = earlyLeads.filter(lead => lead.converted_org_id).length;
  const conversionRate = earlyLeads.length > 0 ? Math.round((convertedLeads / earlyLeads.length) * 100) : 0;
  const sourcePathRows = Object.entries(
    earlyLeads.reduce<Record<string, number>>((acc, lead) => {
      const source = lead.source_path || 'Unknown';
      acc[source] = (acc[source] ?? 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([source, count]) => ({ source, count }));

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
      users: authUsersRes.data?.users?.length ?? 0,
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
      earlyAccessTotal: earlyLeads.length,
      newLeads7,
      convertedLeads,
      conversionRate,
      earlyAccessByStatus,
      sourcePathRows,
    },
    // Free League Starter (§13) — current free-floor org count + the activation/cap funnel over the
    // event window. Beta is flag-gated, so these stay 0 until the flag is enabled for real users.
    leagueStarter: {
      orgs: freeFloorLeagueOrgs,
      created: {
        days7: countEvents('free_floor_created', sevenDaysAgo),
        days30: countEvents('free_floor_created', thirtyDaysAgo),
        days90: countEvents('free_floor_created', ninetyDaysAgo),
      },
      existingUserAdded30: countEvents('existing_user_floor_added', thirtyDaysAgo),
      seasonsCreated30: countEvents('league_season_created', thirtyDaysAgo),
      schedulesGenerated30: countEvents('league_schedule_generated', thirtyDaysAgo),
      publicShared30: countEvents('league_public_page_shared', thirtyDaysAgo),
      scopeWallHits30: countEvents('scope_wall_hit', thirtyDaysAgo),
      upgradeIntents30: countEvents('upgrade_intent_clicked', thirtyDaysAgo),
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
      moduleCounts,
    },
    lifecycle: {
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
      newEarlyAccessLeads: earlyAccessByStatus.new ?? 0,
      retentionAlertCount,
      expiredOverrides,
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
  const metrics = await getCommandCenterStats();
  const snapshotDate = new Date().toISOString().slice(0, 10);
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
