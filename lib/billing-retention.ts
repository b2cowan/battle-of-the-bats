import 'server-only';

import { PLAN_CONFIG } from './plan-config';
import { getOrgOwnerEmail, supabaseAdmin } from './supabase-admin';
import { billingRetentionWarningHtml, SITE_URL } from './email';
import { sendTransactionalEmail } from './platform-email-templates';
import { isTeamWorkspaceOrg } from './team-workspace-entitlements';
import type { Organization, OrgPlan } from './types';
import type { Capability } from './roles';

export const BILLING_RETENTION_DAYS = 90;

const PLAN_ORDER: OrgPlan[] = ['tournament', 'team', 'tournament_plus', 'league', 'club', 'club_large'];

export type BillingTournamentSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  year: number | null;
  startDate: string | null;
  endDate: string | null;
};

export type DowngradePreflight = {
  currentPlan: OrgPlan;
  targetPlan: OrgPlan;
  targetPlanLabel: string;
  targetTournamentLimit: number;
  activeTournamentCount: number;
  allowedKeepCount: number;
  requiresTournamentChoice: boolean;
  tournaments: BillingTournamentSummary[];
  overLimitTournamentCount: number;
  retentionDays: number;
};

export type CancellationPreflight = {
  currentPlan: OrgPlan;
  activeTournamentCount: number;
  tournaments: BillingTournamentSummary[];
  retentionDays: number;
  shutsDown: string[];
};

export type RestoreRetainedTournamentsResult = {
  restoredCount: number;
  remainingRetainedCount: number;
  restoredTournamentIds: string[];
};

type RetainedRecordProcessRow = {
  id: string;
  org_id: string;
  record_type: string;
  display_name: string;
  retained_state: string;
  retention_until: string;
  warning_sent_at: string | null;
  purge_notice_sent_at: string | null;
  organizations: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

type TournamentRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  year: number | null;
  start_date: string | null;
  end_date: string | null;
};

type RetainedTournamentRestoreRow = {
  id: string;
  record_id: string | null;
  retained_at: string;
  metadata: {
    previousStatus?: unknown;
    retentionReason?: unknown;
  } | null;
};

const PREMIUM_MODULE_SHUTDOWN_COPY: Partial<Record<Capability, string>> = {
  module_public_site: 'Public organization site',
  module_house_league: 'House League seasons, registration, schedules, and standings',
  module_rep_teams: 'Rep Teams tryouts, rosters, coach portal, and player documents',
  module_accounting: 'Accounting ledgers, invoices, budgets, and reconciliation',
};

const PREMIUM_MODULES = Object.keys(PREMIUM_MODULE_SHUTDOWN_COPY) as Capability[];

export function normalizePlan(value: unknown): OrgPlan | null {
  return typeof value === 'string' && PLAN_ORDER.includes(value as OrgPlan)
    ? value as OrgPlan
    : null;
}

export function isLowerPlan(fromPlan: OrgPlan, targetPlan: OrgPlan): boolean {
  return PLAN_ORDER.indexOf(targetPlan) < PLAN_ORDER.indexOf(fromPlan);
}

export function isOrganizationDowngradeTarget(targetPlan: OrgPlan): boolean {
  return targetPlan !== 'team';
}

export function retentionDeadline(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + BILLING_RETENTION_DAYS);
  return d.toISOString();
}

function mapTournament(row: TournamentRow): BillingTournamentSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    year: row.year,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

export async function getNonArchivedTournaments(orgId: string): Promise<BillingTournamentSummary[]> {
  const { data, error } = await supabaseAdmin
    .from('tournaments')
    .select('id, name, slug, status, year, start_date, end_date')
    .eq('org_id', orgId)
    .neq('status', 'archived')
    .order('year', { ascending: false })
    .order('name', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as TournamentRow[]).map(mapTournament);
}

export async function buildDowngradePreflight(
  org: Organization,
  targetPlan: OrgPlan,
): Promise<DowngradePreflight> {
  const targetCfg = PLAN_CONFIG[targetPlan];
  const tournaments = await getNonArchivedTournaments(org.id);
  const targetTournamentLimit = targetCfg.tournamentLimit;
  const activeTournamentCount = tournaments.length;
  const allowedKeepCount = targetTournamentLimit >= 9999
    ? activeTournamentCount
    : Math.min(targetTournamentLimit, activeTournamentCount);

  return {
    currentPlan: org.planId,
    targetPlan,
    targetPlanLabel: targetCfg.label,
    targetTournamentLimit,
    activeTournamentCount,
    allowedKeepCount,
    requiresTournamentChoice: targetTournamentLimit < activeTournamentCount,
    tournaments,
    overLimitTournamentCount: Math.max(0, activeTournamentCount - allowedKeepCount),
    retentionDays: BILLING_RETENTION_DAYS,
  };
}

export async function buildCancellationPreflight(org: Organization): Promise<CancellationPreflight> {
  const tournaments = await getNonArchivedTournaments(org.id);
  if (isTeamWorkspaceOrg(org)) {
    return {
      currentPlan: org.planId,
      activeTournamentCount: tournaments.length,
      tournaments,
      retentionDays: BILLING_RETENTION_DAYS,
      shutsDown: [
        'Premium roster, schedule, attendance, lineup, documents, dues, and budget tools',
        'Coach-managed payment reminders and premium team documents',
        'The Premium local tournament slot',
      ],
    };
  }

  const planEntitlements = PLAN_CONFIG[org.planId]?.moduleEntitlements ?? [];
  const enabledModules = new Set<Capability>([
    ...planEntitlements,
    ...org.enabledAddons.filter((cap): cap is Capability => PREMIUM_MODULES.includes(cap as Capability)),
  ]);
  const premiumShutdownItems = PREMIUM_MODULES
    .filter(cap => enabledModules.has(cap))
    .map(cap => PREMIUM_MODULE_SHUTDOWN_COPY[cap])
    .filter((item): item is string => Boolean(item));

  return {
    currentPlan: org.planId,
    activeTournamentCount: tournaments.length,
    tournaments,
    retentionDays: BILLING_RETENTION_DAYS,
    shutsDown: [
      'Public tournament pages and registration links',
      'Tournament setup, scheduling, communications, and score updates',
      'Member and staff access to tournament workflows',
      ...premiumShutdownItems,
    ],
  };
}

function restoredTournamentStatus(value: unknown): 'draft' | 'active' | 'completed' {
  return value === 'draft' || value === 'active' || value === 'completed'
    ? value
    : 'completed';
}

export async function restoreRetainedDowngradeTournaments(
  orgId: string,
  tournamentLimit: number,
): Promise<RestoreRetainedTournamentsResult> {
  const { count: currentCount, error: countError } = await supabaseAdmin
    .from('tournaments')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .neq('status', 'archived');

  if (countError) throw countError;

  const availableSlots = tournamentLimit >= 9999
    ? Number.POSITIVE_INFINITY
    : Math.max(0, tournamentLimit - (currentCount ?? 0));

  if (availableSlots <= 0) {
    const { count: remainingCount, error: remainingError } = await supabaseAdmin
      .from('billing_retained_records')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('record_type', 'tournament')
      .eq('retained_state', 'retained_inactive')
      .eq('metadata->>retentionReason', 'plan_downgrade');

    if (remainingError) throw remainingError;
    return {
      restoredCount: 0,
      remainingRetainedCount: remainingCount ?? 0,
      restoredTournamentIds: [],
    };
  }

  const { data, error } = await supabaseAdmin
    .from('billing_retained_records')
    .select('id, record_id, retained_at, metadata')
    .eq('org_id', orgId)
    .eq('record_type', 'tournament')
    .eq('retained_state', 'retained_inactive')
    .eq('metadata->>retentionReason', 'plan_downgrade')
    .order('retained_at', { ascending: false });

  if (error) throw error;

  const retainedRows = ((data ?? []) as RetainedTournamentRestoreRow[])
    .filter(row => row.record_id);
  const rowsToRestore = Number.isFinite(availableSlots)
    ? retainedRows.slice(0, availableSlots)
    : retainedRows;

  const restoredTournamentIds: string[] = [];

  for (const row of rowsToRestore) {
    if (!row.record_id) continue;
    const status = restoredTournamentStatus(row.metadata?.previousStatus);
    const { error: tournamentError } = await supabaseAdmin
      .from('tournaments')
      .update({ status, is_active: status === 'active' })
      .eq('org_id', orgId)
      .eq('id', row.record_id);

    if (tournamentError) continue;

    const { error: recordError } = await supabaseAdmin
      .from('billing_retained_records')
      .update({ retained_state: 'restored' })
      .eq('id', row.id);

    if (recordError) {
      await supabaseAdmin
        .from('tournaments')
        .update({ status: 'archived', is_active: false })
        .eq('org_id', orgId)
        .eq('id', row.record_id);
      continue;
    }
    restoredTournamentIds.push(row.record_id);
  }

  return {
    restoredCount: restoredTournamentIds.length,
    remainingRetainedCount: Math.max(0, retainedRows.length - restoredTournamentIds.length),
    restoredTournamentIds,
  };
}

export async function writeOrgBillingAudit(
  orgId: string,
  actorUserId: string,
  action: string,
  details: Record<string, unknown>,
) {
  await supabaseAdmin.from('org_audit_log').insert({
    org_id: orgId,
    actor_id: actorUserId,
    action,
    payload: details,
  });
}

function orgFromJoinedRow(row: RetainedRecordProcessRow) {
  return Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
}

function dateOnly(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function daysUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

async function sendRetentionEmail(
  orgId: string,
  orgName: string,
  orgSlug: string,
  records: RetainedRecordProcessRow[],
  isPendingPurge: boolean,
) {
  const ownerEmail = await getOrgOwnerEmail(orgId);
  if (!ownerEmail) return false;

  const first = records[0];
  await sendTransactionalEmail({
    key: 'billing_retention_warning',
    to: ownerEmail,
    vars: {
      orgName,
      retentionUrl: `${SITE_URL}/${orgSlug}/admin/org/billing`,
      daysUntilExpiry: daysUntil(first.retention_until),
    },
    defaultSubject: isPendingPurge
      ? `Retention window expired for ${orgName}`
      : `Retention window ending soon for ${orgName}`,
    defaultHtml: billingRetentionWarningHtml({
      orgName,
      records: records.map(r => ({
        displayName: r.display_name,
        recordType: r.record_type,
        retentionUntil: dateOnly(r.retention_until),
      })),
      retentionUrl: `${SITE_URL}/${orgSlug}/admin/org/billing`,
      daysUntilExpiry: daysUntil(first.retention_until),
      isPendingPurge,
    }),
  });
  return true;
}

function groupByOrg(rows: RetainedRecordProcessRow[]) {
  const grouped = new Map<string, RetainedRecordProcessRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.org_id) ?? [];
    list.push(row);
    grouped.set(row.org_id, list);
  }
  return grouped;
}

export async function processBillingRetentionExpiry(actorEmail: string) {
  const now = new Date();
  const warningCutoff = new Date(now);
  warningCutoff.setDate(warningCutoff.getDate() + 14);

  const { data: expiringRaw, error: expiringError } = await supabaseAdmin
    .from('billing_retained_records')
    .select('id, org_id, record_type, display_name, retained_state, retention_until, warning_sent_at, purge_notice_sent_at, organizations(name, slug)')
    .eq('retained_state', 'retained_inactive')
    .is('warning_sent_at', null)
    .gt('retention_until', now.toISOString())
    .lte('retention_until', warningCutoff.toISOString());
  if (expiringError) throw expiringError;

  const expiring = ((expiringRaw ?? []) as unknown) as RetainedRecordProcessRow[];
  let warningEmailsSent = 0;
  let warningRecordsTagged = 0;

  for (const [orgId, rows] of groupByOrg(expiring)) {
    const org = orgFromJoinedRow(rows[0]);
    if (!org) continue;
    if (await sendRetentionEmail(orgId, org.name, org.slug, rows, false)) {
      warningEmailsSent++;
      const ids = rows.map(r => r.id);
      const { error } = await supabaseAdmin
        .from('billing_retained_records')
        .update({ warning_sent_at: now.toISOString() })
        .in('id', ids);
      if (error) throw error;
      warningRecordsTagged += ids.length;
    }
  }

  const { data: expiredRaw, error: expiredError } = await supabaseAdmin
    .from('billing_retained_records')
    .select('id, org_id, record_type, display_name, retained_state, retention_until, warning_sent_at, purge_notice_sent_at, organizations(name, slug)')
    .eq('retained_state', 'retained_inactive')
    .lte('retention_until', now.toISOString());
  if (expiredError) throw expiredError;

  const expired = ((expiredRaw ?? []) as unknown) as RetainedRecordProcessRow[];
  let pendingPurgeRecords = 0;
  let pendingPurgeEmailsSent = 0;

  for (const [orgId, rows] of groupByOrg(expired)) {
    const org = orgFromJoinedRow(rows[0]);
    if (!org) continue;
    const ids = rows.map(r => r.id);
    const sent = await sendRetentionEmail(orgId, org.name, org.slug, rows, true);
    if (sent) pendingPurgeEmailsSent++;

    const { error } = await supabaseAdmin
      .from('billing_retained_records')
      .update({
        retained_state: 'pending_purge',
        pending_purge_at: now.toISOString(),
        purge_notice_sent_at: sent ? now.toISOString() : null,
      })
      .in('id', ids);
    if (error) throw error;
    pendingPurgeRecords += ids.length;
  }

  await supabaseAdmin.from('platform_audit_log').insert({
    actor_email: actorEmail,
    org_id: null,
    action: 'process_billing_retention_expiry',
    field: 'billing_retained_records',
    old_value: null,
    new_value: {
      warningEmailsSent,
      warningRecordsTagged,
      pendingPurgeEmailsSent,
      pendingPurgeRecords,
    },
  });

  return {
    warningEmailsSent,
    warningRecordsTagged,
    pendingPurgeEmailsSent,
    pendingPurgeRecords,
  };
}
