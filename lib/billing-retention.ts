import 'server-only';

import { PLAN_CONFIG } from './plan-config';
import { getOrgOwnerEmail, supabaseAdmin } from './supabase-admin';
import { billingRetentionWarningHtml, SITE_URL } from './email';
import { sendTransactionalEmail } from './platform-email-templates';
import { isTeamWorkspaceOrg } from './team-workspace-entitlements';
import { tournamentToday } from './timezone';
import { orderByKeepPriority } from './billing-downgrade-order';
import type { Organization, OrgPlan } from './types';
import type { Capability } from './roles';

export const BILLING_RETENTION_DAYS = 90;
export const BILLING_RETENTION_WARNING_DAYS = 14;

/** A cancelled standalone Coaches Portal is kept for a full season cycle, not the org 90 days
 *  (owner ruling 2026-09-24, BUSINESS_DECISIONS.md). Coaches cancel when the season ends and come
 *  back for next year's tryouts 6–8 months later — a 90-day window flags the team for purge in the
 *  off-season, before they ever return. The warning leads by 30 days because an off-season coach
 *  reads email less often. */
export const COACHES_PORTAL_RETENTION_DAYS = 365;
export const COACHES_PORTAL_RETENTION_WARNING_DAYS = 30;

/** The retentionReason every Coaches Portal cancellation record carries, whichever door ended it.
 *  Reactivation restores ONLY records tagged with it — an untagged record outlives the reactivation
 *  and later sends an active customer a "retention expired" email. */
export const COACHES_PORTAL_RETENTION_REASON = 'coaches_portal_cancellation';

export function retentionDaysFor(org: Pick<Organization, 'accountKind' | 'planId'>): number {
  return isTeamWorkspaceOrg(org) ? COACHES_PORTAL_RETENTION_DAYS : BILLING_RETENTION_DAYS;
}

const PLAN_ORDER: OrgPlan[] = ['tournament', 'team', 'tournament_plus', 'league', 'club', 'club_large'];

// Lives in a server-only-free module so the pure downgrade-order policy can share it.
export type { BillingTournamentSummary } from './billing-retention-types';
import type { BillingTournamentSummary } from './billing-retention-types';

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
  metadata?: { retentionReason?: string } | null;
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
  module_families: 'The Families area — household records, the family worklist, and duplicate review',
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

export function retentionDeadline(from = new Date(), days = BILLING_RETENTION_DAYS): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
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

/**
 * Archive the tournaments a plan change puts OVER the new cap, and record them so they come back.
 *
 * ── Why this exists (audit 2026-08-06) ───────────────────────────────────────────────────────
 * The self-serve downgrade has always done this (app/api/billing/downgrade/confirm). The
 * platform-admin plan change did NOT: it wrote the new `plan_id` + `tournament_limit`, COUNTED the
 * over-cap tournaments, put that count in the audit log — and left every one of them running. The
 * cap is only ever enforced at CREATION time (setup-tournament, clone), so an org moved from Club
 * down to a one-slot plan kept all twelve of its live tournaments indefinitely. Recorded, never
 * applied. Same defect class as the cancellation gap; same fix — do what the customer path does.
 *
 * WHICH ones are archived — see `rankForKeeping` below. The self-serve path lets the CUSTOMER pick
 * which to keep; nobody is sitting in front of the platform console to choose on their behalf, so
 * this ranks deterministically instead. ⚠ It must never archive a tournament that is currently
 * running: doing so 404s that event's entire public site instantly, mid-event, for every family
 * and spectator. Live events are therefore kept first, unconditionally.
 *
 * Nothing is destroyed: rows land in `billing_retained_records` exactly as the customer path
 * writes them, so `restoreRetainedDowngradeTournaments` reinstates them on re-upgrade.
 * Returns the archived summaries (empty when the change is not a downgrade or nothing is over cap).
 */
export async function archiveOverCapTournamentsForPlanChange(opts: {
  orgId: string;
  fromPlan: OrgPlan;
  targetPlan: OrgPlan;
  actorEmail: string | null;
  reason: string | null;
}): Promise<BillingTournamentSummary[]> {
  const { orgId, fromPlan, targetPlan, actorEmail, reason } = opts;
  const targetLimit = PLAN_CONFIG[targetPlan]?.tournamentLimit ?? 1;
  if (targetLimit >= 9999) return [];

  const tournaments = await getNonArchivedTournaments(orgId);
  if (tournaments.length <= targetLimit) return [];

  // Rank by what the org is actually USING, never the display order — see billing-downgrade-order.
  // `tournamentToday()`, never raw UTC: production runs UTC, so a naive "today" reads a day late
  // from ~8pm Toronto — which here would mean a tournament that started this evening scoring as
  // "upcoming" instead of "running now" and being archived out from under a live event.
  const ranked = orderByKeepPriority(tournaments, tournamentToday());

  const overCap = ranked.slice(targetLimit);
  const keepIds = ranked.slice(0, targetLimit).map(t => t.id);
  const retentionUntil = retentionDeadline();

  const { data: intent, error: intentError } = await supabaseAdmin
    .from('billing_retention_intents')
    .insert({
      org_id: orgId,
      intent_type: 'downgrade',
      status: 'applied',
      from_plan: fromPlan,
      target_plan: targetPlan,
      keep_tournament_ids: keepIds,
      retention_until: retentionUntil,
      reason,
      created_by: null,
      created_by_email: actorEmail,
      applied_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (intentError) throw intentError;

  const overCapIds = overCap.map(t => t.id);

  // ⚠ ORDER IS DELIBERATE: write the RESTORE TICKET before taking anything away.
  // These are three statements with no surrounding transaction. If the archive ran first and this
  // insert then failed, the tournaments would be archived with no retention record — invisible to
  // `restoreRetainedDowngradeTournaments` (which reads only these rows) AND invisible to a retry
  // (`getNonArchivedTournaments` already excludes archived ones), so the customer would lose them
  // permanently even after paying again. Reversed, the bad case is a retention row for a
  // tournament that was never archived — restore simply no-ops it back to the status it still has.
  // Harmless. The durable fix is one RPC wrapping all three; that needs a migration, so it is
  // flagged rather than done here.
  const { error: recordError } = await supabaseAdmin
    .from('billing_retained_records')
    .insert(overCap.map(t => ({
      intent_id: intent.id,
      org_id: orgId,
      record_type: 'tournament',
      record_id: t.id,
      display_name: t.name,
      retained_state: 'retained_inactive',
      retention_until: retentionUntil,
      metadata: {
        previousStatus: t.status,
        slug: t.slug,
        year: t.year,
        startDate: t.startDate,
        endDate: t.endDate,
        retentionReason: 'plan_downgrade',
        fromPlan,
        targetPlan,
        initiatedBy: 'platform_admin',
        adminEmail: actorEmail,
      },
    })));
  if (recordError) throw recordError;

  // Only now take the tournaments away — the restore ticket above is already durable.
  const { error: archiveError } = await supabaseAdmin
    .from('tournaments')
    .update({ status: 'archived', is_active: false })
    .eq('org_id', orgId)
    .in('id', overCapIds);
  if (archiveError) throw archiveError;

  return overCap;
}

export async function buildCancellationPreflight(org: Organization): Promise<CancellationPreflight> {
  const tournaments = await getNonArchivedTournaments(org.id);
  if (isTeamWorkspaceOrg(org)) {
    return {
      currentPlan: org.planId,
      activeTournamentCount: tournaments.length,
      tournaments,
      retentionDays: COACHES_PORTAL_RETENTION_DAYS,
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

/** "September 24, 2027" — the one spelling of a retention deadline in customer copy. */
export function retentionDateLabel(iso: string) {
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
        retentionUntil: retentionDateLabel(r.retention_until),
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
  // Fetch at the LONGEST lead, then keep each record only once it is inside its own lead —
  // a Coaches Portal is warned 30 days out, everything else 14.
  const warningCutoff = new Date(now);
  warningCutoff.setDate(warningCutoff.getDate() + Math.max(BILLING_RETENTION_WARNING_DAYS, COACHES_PORTAL_RETENTION_WARNING_DAYS));

  const { data: expiringRaw, error: expiringError } = await supabaseAdmin
    .from('billing_retained_records')
    .select('id, org_id, record_type, display_name, retained_state, retention_until, warning_sent_at, purge_notice_sent_at, metadata, organizations(name, slug)')
    .eq('retained_state', 'retained_inactive')
    .is('warning_sent_at', null)
    .gt('retention_until', now.toISOString())
    .lte('retention_until', warningCutoff.toISOString());
  if (expiringError) throw expiringError;

  const expiring = (((expiringRaw ?? []) as unknown) as RetainedRecordProcessRow[]).filter(row => {
    const leadDays = row.metadata?.retentionReason === COACHES_PORTAL_RETENTION_REASON
      ? COACHES_PORTAL_RETENTION_WARNING_DAYS
      : BILLING_RETENTION_WARNING_DAYS;
    const rowCutoff = new Date(now);
    rowCutoff.setDate(rowCutoff.getDate() + leadDays);
    return new Date(row.retention_until) <= rowCutoff;
  });
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

/**
 * Stripe ended a standalone Coaches Portal's subscription (a card that failed for good, a cancel
 * made in Stripe's dashboard, test-mode expiry) — give it the SAME retention the in-app cancel
 * gives: a Coaches Portal deadline, archived tournaments, restore-tagged records, a suspended org.
 * Before this, that door recorded nothing, so the team had no deadline and no warning.
 *
 * Returns `applied: false` when this workspace is ALREADY retained — the in-app and platform-admin
 * cancels call Stripe themselves, so their own `subscription.deleted` arrives here seconds later,
 * and Stripe retries (or an operator re-sends) an event long after. That door wrote the records and
 * sent its own email, so the caller must not send a second one. "Already retained" = an unrestored
 * account record carrying the Coaches Portal reason, at any age: reactivation flips exactly those
 * to `restored`, so an active one means the workspace has not come back since it was retained.
 * No age window — a window is what a late re-send slips past, quoting the coach a second, later date.
 *
 * ⚠ Check-then-act, not a lock: two deliveries of the same event landing within the same instant can
 * both pass. The org-cancellation branch in the webhook has the same shape; closing it for both
 * needs a database constraint (account rows are exempt from the active-retention unique index).
 */
export async function applyCoachesPortalStripeRetention(params: {
  workspaceOrgId: string;
  teamWorkspaceId: string;
}): Promise<{ applied: boolean; retentionUntil: string | null }> {
  const { workspaceOrgId, teamWorkspaceId } = params;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('billing_retained_records')
    .select('id, retention_until')
    .eq('org_id', workspaceOrgId)
    .eq('record_type', 'account')
    .in('retained_state', ['retained_inactive', 'pending_purge'])
    .eq('metadata->>retentionReason', COACHES_PORTAL_RETENTION_REASON)
    .order('retained_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; retention_until: string }>();
  if (existingError) throw existingError;
  if (existing) return { applied: false, retentionUntil: existing.retention_until };

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, plan_id')
    .eq('id', workspaceOrgId)
    .maybeSingle<{ id: string; name: string; plan_id: string | null }>();
  if (orgError) throw orgError;
  if (!org) return { applied: false, retentionUntil: null };

  const reason = 'Stripe subscription deleted';
  const retentionUntil = retentionDeadline(new Date(), COACHES_PORTAL_RETENTION_DAYS);

  const { data: intent, error: intentError } = await supabaseAdmin
    .from('billing_retention_intents')
    .insert({
      org_id: org.id,
      intent_type: 'cancellation',
      status: 'applied',
      from_plan: org.plan_id,
      target_plan: null,
      keep_tournament_ids: [],
      retention_until: retentionUntil,
      reason,
      created_by: null,
      created_by_email: 'stripe-webhook',
      applied_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (intentError) throw intentError;

  // Same order as the in-app cancel: the restore tickets exist before anything is archived away.
  const tournaments = await getNonArchivedTournaments(org.id);
  if (tournaments.length > 0) {
    const retainedIds = tournaments.map(t => t.id);
    await supabaseAdmin
      .from('billing_retained_records')
      .update({ retained_state: 'purged' })
      .eq('org_id', org.id)
      .in('record_id', retainedIds)
      .in('retained_state', ['retained_inactive', 'pending_purge']);

    const { error: tournamentRecordError } = await supabaseAdmin
      .from('billing_retained_records')
      .insert(tournaments.map(t => ({
        intent_id: intent.id,
        org_id: org.id,
        record_type: 'tournament',
        record_id: t.id,
        display_name: t.name,
        retained_state: 'retained_inactive',
        retention_until: retentionUntil,
        metadata: {
          previousStatus: t.status,
          slug: t.slug,
          year: t.year,
          startDate: t.startDate,
          endDate: t.endDate,
          retentionReason: COACHES_PORTAL_RETENTION_REASON,
          fromPlan: org.plan_id,
          initiatedBy: 'stripe',
        },
      })));
    if (tournamentRecordError) throw tournamentRecordError;

    const { error: archiveError } = await supabaseAdmin
      .from('tournaments')
      .update({ status: 'archived', is_active: false })
      .eq('org_id', org.id)
      .in('id', retainedIds);
    if (archiveError) throw archiveError;
  }

  const { error: accountRecordError } = await supabaseAdmin
    .from('billing_retained_records')
    .insert({
      intent_id: intent.id,
      org_id: org.id,
      record_type: 'account',
      record_id: null,
      display_name: `${org.name} Premium workspace`,
      retained_state: 'retained_inactive',
      retention_until: retentionUntil,
      metadata: {
        retentionReason: COACHES_PORTAL_RETENTION_REASON,
        fromPlan: org.plan_id,
        teamWorkspaceId,
        initiatedBy: 'stripe',
        basicTournamentRecordsRemainAvailable: true,
      },
    });
  if (accountRecordError) throw accountRecordError;

  const { error: suspendError } = await supabaseAdmin
    .from('organizations')
    .update({
      subscription_status: 'canceled',
      billing_suspended_at: new Date().toISOString(),
      billing_suspension_reason: reason,
    })
    .eq('id', org.id);
  if (suspendError) throw suspendError;

  return { applied: true, retentionUntil };
}
