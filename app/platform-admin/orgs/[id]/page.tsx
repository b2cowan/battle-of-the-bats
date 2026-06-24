import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getEffectiveTournamentLimit, PLAN_CONFIG } from '@/lib/plan-config';
import { hasPlatformPermission, requirePlatformAreaView } from '@/lib/platform-auth';
import { fmtAbsoluteDate } from '@/lib/format-date';
import type { OrgPlan } from '@/lib/types';
import OrgDetailClient from './OrgDetailClient';
import styles from './orgDetail.module.css';

type OverrideRow = {
  id: string;
  type: string;
  value: string | null;
  target: { addons?: string[] } | null;
  expires_at: string | null;
  reason: string;
  created_by: string;
  created_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
};

type AuditEventRow = {
  id: string;
  actor_email: string;
  action: string;
  field: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
};

type InternalNoteRow = {
  id: string;
  body: string;
  created_by_email: string;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
};

type OwnershipTransferRow = {
  id: string;
  team_workspace_id: string;
  rep_team_id: string;
  linked_org_id: string;
  approved_by_team_user_id: string | null;
  approved_by_org_user_id: string | null;
  updated_at: string;
};

async function getOrgDetail(id: string) {
  const { data: org, error } = await supabaseAdmin
    .from('organizations')
    .select(
      'id, name, slug, plan_id, tournament_limit, team_limit, subscription_status, subscription_period, current_period_end, stripe_customer_id, stripe_subscription_id, created_at, enabled_addons, free_floor'
    )
    .eq('id', id)
    .single();

  if (error || !org) return null;
  return org;
}

/** Lifetime scope-wall-hit count for one org (League Starter cap-wall upgrade signal). */
async function getScopeWallHitCount(orgId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('platform_events')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('event_type', 'scope_wall_hit');
  return count ?? 0;
}

async function getMembers(orgId: string) {
  const { data: rows } = await supabaseAdmin
    .from('organization_members')
    .select('user_id, role, status')
    .eq('organization_id', orgId);

  if (!rows || rows.length === 0) return [];

  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  const userMap = new Map<string, { email: string; displayName: string; lastSignInAt: string | null }>();
  for (const u of usersData?.users ?? []) {
    userMap.set(u.id, {
      email:        u.email ?? '(no email)',
      displayName:  (u.user_metadata?.display_name as string) ?? '',
      lastSignInAt: u.last_sign_in_at ?? null,
    });
  }

  return rows.map(m => {
    const info = userMap.get(m.user_id as string);
    return {
      userId:      m.user_id as string,
      role:        m.role as string,
      status:      (m.status ?? 'active') as string,
      email:       info?.email ?? '(unknown)',
      displayName: info?.displayName ?? '',
      lastSignIn:  info?.lastSignInAt ?? null,
    };
  });
}

async function getTournaments(orgId: string) {
  const { data } = await supabaseAdmin
    .from('tournaments')
    .select('id, name, status, start_date, end_date')
    .eq('org_id', orgId)
    .neq('status', 'archived')
    .order('start_date', { ascending: false });

  return (data ?? []).map(t => ({
    id:        t.id as string,
    name:      t.name as string,
    status:    t.status as string,
    startDate: t.start_date as string | null,
    endDate:   t.end_date as string | null,
  }));
}

async function getOverrides(orgId: string) {
  const { data } = await supabaseAdmin
    .from('org_overrides')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  return ((data ?? []) as OverrideRow[]).map(r => ({
    id:         r.id as string,
    type:       r.type as string,
    value:      r.value as string | null,
    target:     (r.target as { addons?: string[] } | null) ?? null,
    expiresAt:  r.expires_at as string | null,
    reason:     r.reason as string,
    createdBy:  r.created_by as string,
    createdAt:  r.created_at as string,
    revokedAt:  r.revoked_at as string | null,
    revokedBy:  r.revoked_by as string | null,
  }));
}

async function getRecentAuditEvents(orgId: string) {
  const { data } = await supabaseAdmin
    .from('platform_audit_log')
    .select('id, actor_email, action, field, old_value, new_value, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(8);

  return ((data ?? []) as AuditEventRow[]).map(row => ({
    id: row.id,
    actorEmail: row.actor_email,
    action: row.action,
    field: row.field,
    oldValue: row.old_value,
    newValue: row.new_value,
    createdAt: row.created_at,
  }));
}

async function getInternalNotes(orgId: string) {
  const { data, error } = await supabaseAdmin
    .from('org_internal_notes')
    .select('id, body, created_by_email, updated_by_email, created_at, updated_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.warn('[platform-admin] internal notes read failed', error);
    return [];
  }

  return ((data ?? []) as InternalNoteRow[]).map(row => ({
    id: row.id,
    body: row.body,
    createdByEmail: row.created_by_email,
    updatedByEmail: row.updated_by_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

async function getPendingOwnershipTransfers(orgId: string) {
  const { data: links, error } = await supabaseAdmin
    .from('team_org_links')
    .select('id, team_workspace_id, rep_team_id, linked_org_id, approved_by_team_user_id, approved_by_org_user_id, updated_at')
    .eq('linked_org_id', orgId)
    .eq('status', 'ownership_pending')
    .eq('link_type', 'ownership')
    .order('updated_at', { ascending: false });

  if (error) {
    console.warn('[platform-admin] ownership transfer read failed', error);
    return [];
  }

  const rows = (links ?? []) as OwnershipTransferRow[];
  if (rows.length === 0) return [];

  const workspaceIds = [...new Set(rows.map(row => row.team_workspace_id))];
  const teamIds = [...new Set(rows.map(row => row.rep_team_id))];

  const [workspacesRes, teamsRes] = await Promise.all([
    supabaseAdmin
      .from('team_workspaces')
      .select('id, workspace_org_id, workspace_state, billing_mode')
      .in('id', workspaceIds),
    supabaseAdmin
      .from('rep_teams')
      .select('id, name, slug')
      .in('id', teamIds),
  ]);

  const workspaceRows = (workspacesRes.data ?? []) as Array<{
    id: string;
    workspace_org_id: string;
    workspace_state: string | null;
    billing_mode: string | null;
  }>;
  const workspaceOrgIds = [...new Set(workspaceRows.map(row => row.workspace_org_id))];
  const orgsRes = workspaceOrgIds.length
    ? await supabaseAdmin
        .from('organizations')
        .select('id, name, slug')
        .in('id', workspaceOrgIds)
    : { data: [] };

  const workspaceMap = new Map(workspaceRows.map(row => [row.id, row]));
  const orgMap = new Map(((orgsRes.data ?? []) as Array<{ id: string; name: string; slug: string }>).map(row => [row.id, row]));
  const teamMap = new Map(((teamsRes.data ?? []) as Array<{ id: string; name: string; slug: string | null }>).map(row => [row.id, row]));

  return rows.map(row => {
    const workspace = workspaceMap.get(row.team_workspace_id);
    const workspaceOrg = workspace ? orgMap.get(workspace.workspace_org_id) : null;
    const team = teamMap.get(row.rep_team_id);
    return {
      linkId: row.id,
      teamWorkspaceId: row.team_workspace_id,
      repTeamId: row.rep_team_id,
      teamName: team?.name ?? 'Team workspace',
      teamSlug: team?.slug ?? null,
      workspaceOrgName: workspaceOrg?.name ?? 'Team workspace',
      workspaceOrgSlug: workspaceOrg?.slug ?? null,
      billingMode: workspace?.billing_mode ?? null,
      updatedAt: row.updated_at,
      readyForCompletion: Boolean(row.approved_by_team_user_id && row.approved_by_org_user_id),
    };
  });
}

const fmtDate = (iso: string) => fmtAbsoluteDate(iso);
const fmtNullableDate = (iso: string | null) => fmtAbsoluteDate(iso, 'Not set');

function stripeIsTestMode() {
  // Match stripeCustomerUrl: derive mode from the secret-key prefix, not the ID
  // (subscription IDs are `sub_...` in both modes).
  return !(process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_live_');
}

function stripeCustomerUrl(customerId: string | null) {
  if (!customerId) return null;
  const modePath = stripeIsTestMode() ? '/test' : '';
  return `https://dashboard.stripe.com${modePath}/customers/${customerId}`;
}

function stripeSubscriptionUrl(subscriptionId: string | null) {
  if (!subscriptionId) return null;
  const modePath = stripeIsTestMode() ? '/test' : '';
  return `https://dashboard.stripe.com${modePath}/subscriptions/${subscriptionId}`;
}

function isExpiredOverride(expiresAt: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

const MODULE_LABELS: Record<string, string> = {
  module_tournaments:    'Tournaments',
  module_communications: 'Communications',
  module_members:        'Members',
  module_public_site:    'Public Site',
  module_house_league:   'House League',
  module_accounting:     'Accounting',
  module_rep_teams:      'Rep Teams',
};

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Defensive area guard — `organizations` is currently visible to every platform role
  // (the layout already enforces the platform-admin session), so this is a no-op today. It
  // also yields the auth context used for the permission props below.
  const [auth, org, members, tournaments, overrides, auditEvents, internalNotes, pendingOwnershipTransfers] = await Promise.all([
    requirePlatformAreaView('organizations'),
    getOrgDetail(id),
    getMembers(id),
    getTournaments(id),
    getOverrides(id),
    getRecentAuditEvents(id),
    getInternalNotes(id),
    getPendingOwnershipTransfers(id),
  ]);

  if (!org) notFound();

  const isFreeFloor = (org.free_floor as string | null) === 'league_starter';
  // Only pay for the scope-wall count query when the org is actually a free floor.
  const scopeWallHitCount = isFreeFloor ? await getScopeWallHitCount(id) : 0;
  const enabledAddons = (org.enabled_addons as string[]) ?? [];
  const planCfg = PLAN_CONFIG[org.plan_id as keyof typeof PLAN_CONFIG];
  const planOptions = Object.entries(PLAN_CONFIG).map(([planId, config]) => ({
    id: planId,
    label: config.label,
    defaultTournamentLimit: config.tournamentLimit,
  }));
  const planModules = planCfg?.moduleEntitlements ?? [];
  const ownerMembers = members.filter(member => member.role === 'owner');
  const ownerSummary = ownerMembers.map(member => member.email).join(', ') || 'No owner found';
  const activeModules = [...new Set([...planModules, ...enabledAddons])];
  const stripeUrl = stripeCustomerUrl((org.stripe_customer_id as string | null) ?? null);
  const stripeSubUrl = stripeSubscriptionUrl((org.stripe_subscription_id as string | null) ?? null);
  const stripeTestMode = stripeIsTestMode();
  const subscriptionStatus = (org.subscription_status as string | null) ?? 'active';
  const effectiveTournamentLimit = planCfg
    ? getEffectiveTournamentLimit(org.plan_id as OrgPlan, org.tournament_limit as number | null)
    : null;
  const activeOverrides = overrides.filter(o => !o.revokedAt);
  const expiredActiveOverrides = activeOverrides.filter(o => isExpiredOverride(o.expiresAt));
  const hasFreePlanBillingMismatch = org.plan_id === 'tournament' && (
    subscriptionStatus === 'trialing' ||
    Boolean(org.stripe_subscription_id) ||
    Boolean(org.subscription_period) ||
    Boolean(org.current_period_end)
  );
  const hasOverLimitTournaments = effectiveTournamentLimit !== null &&
    effectiveTournamentLimit < 9999 &&
    tournaments.length > effectiveTournamentLimit;
  const attentionItems = [
    ...(ownerMembers.length === 0 ? ['No owner is assigned to this organization.'] : []),
    ...(subscriptionStatus === 'past_due' ? ['Subscription is past due. Review billing and owner contact before support-sensitive changes.'] : []),
    ...(subscriptionStatus === 'canceled' ? ['Subscription is canceled. Confirm access expectations before making support changes.'] : []),
    ...(hasFreePlanBillingMismatch ? ['Free Tournament billing state is inconsistent. The plan should be active with no Stripe subscription.'] : []),
    ...(expiredActiveOverrides.length > 0 ? [`${expiredActiveOverrides.length} active override${expiredActiveOverrides.length === 1 ? '' : 's'} expired and should be revoked or extended.`] : []),
    ...(hasOverLimitTournaments ? [`This org has ${tournaments.length} non-archived tournaments against a limit of ${effectiveTournamentLimit}.`] : []),
  ];

  return (
    <div className={styles.page}>
      <div className={styles.backRow}>
        <Link href="/platform-admin/orgs" className={styles.backLink}>Back to Organizations</Link>
      </div>

      <header className={styles.accountHero}>
        <div className={styles.accountHeroMain}>
          <div className={styles.headerLabel}>Organization Account</div>
          <h1 className={styles.title}>{org.name}</h1>
          <div className={styles.heroMeta}>
            <span className={styles.mono}>/{org.slug}</span>
            <span>Created {fmtDate(org.created_at as string)}</span>
          </div>
        </div>
        <div className={styles.heroActions}>
          <div className={styles.heroBadges}>
            <span className={styles.headerPlan}>{planCfg?.label ?? org.plan_id}</span>
            <span className={`${styles.headerStatus} ${subscriptionStatus === 'active' ? styles.headerStatusActive : subscriptionStatus === 'trialing' ? styles.headerStatusTrialing : styles.headerStatusMuted}`}>
              {subscriptionStatus}
            </span>
            {isFreeFloor && (
              <span className={styles.leagueStarterBadge} title="Free League Starter floor (plan_id stays 'tournament')">
                League Starter
              </span>
            )}
          </div>
          <Link
            href={`/${org.slug}/admin`}
            target="_blank"
            rel="noreferrer"
            className={styles.adminLink}
          >
            Open Admin
          </Link>
        </div>
      </header>

      {attentionItems.length > 0 && (
        <section className={styles.attentionPanel} aria-label="Needs attention">
          <h2 className={styles.sectionTitle}>Needs Attention</h2>
          <ul className={styles.attentionList}>
            {attentionItems.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.snapshotGrid} aria-label="Account snapshot">
        <div className={styles.snapshotItem}>
          <span className={styles.fieldLabel}>Owner</span>
          <span className={styles.fieldValue}>{ownerSummary}</span>
        </div>
        <div className={styles.snapshotItem}>
          <span className={styles.fieldLabel}>Members</span>
          <span className={styles.fieldValue}>{members.length}</span>
        </div>
        <div className={styles.snapshotItem}>
          <span className={styles.fieldLabel}>Tournaments</span>
          <span className={styles.fieldValue}>
            {tournaments.length}{effectiveTournamentLimit !== null && effectiveTournamentLimit < 9999 ? ` / ${effectiveTournamentLimit}` : ''}
          </span>
        </div>
        <div className={styles.snapshotItem}>
          <span className={styles.fieldLabel}>Billing Period</span>
          <span className={styles.fieldValue}>{(org.subscription_period as string | null) ?? 'Not set'}</span>
        </div>
        <div className={styles.snapshotItem}>
          <span className={styles.fieldLabel}>Current Period End</span>
          <span className={styles.fieldValue}>{fmtNullableDate((org.current_period_end as string | null) ?? null)}</span>
        </div>
        <div className={styles.snapshotItem}>
          <span className={styles.fieldLabel}>Active Overrides</span>
          <span className={styles.fieldValue}>{activeOverrides.length}</span>
        </div>
      </section>

      <section className={styles.quickActions} aria-label="Primary account actions">
        <div className={styles.quickActionIntro}>
          <h2 className={styles.sectionTitle}>Primary Actions</h2>
          <p className={styles.emptyNote}>Start with owner contact, billing context, then review the grouped workflow below.</p>
        </div>
        <div className={styles.actionRow}>
          {ownerMembers.map(member => (
            <a
              key={member.userId}
              href={`mailto:${member.email}`}
              className={styles.adminLink}
            >
              Email {member.displayName || member.email}
            </a>
          ))}
          {stripeUrl && (
            <a href={stripeUrl} target="_blank" rel="noreferrer" className={styles.adminLink}>
              Open Stripe
            </a>
          )}
          <Link href={`/platform-admin/audit?q=${encodeURIComponent(org.name as string)}`} className={styles.adminLink}>
            Audit Log
          </Link>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Account Context</h2>
          <span className={styles.sectionHint}>Quick reference only. Use the workflow tabs below for edits and investigation.</span>
        </div>
        <div className={styles.contextGrid}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Name</span>
            <span className={styles.fieldValue}>{org.name}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Slug</span>
            <span className={`${styles.fieldValue} ${styles.mono}`}>{org.slug}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Plan</span>
            <span className={styles.fieldValue}>{planCfg?.label ?? org.plan_id}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Stripe Subscription</span>
            {stripeSubUrl ? (
              <span className={styles.mono}>
                <a href={stripeSubUrl} target="_blank" rel="noreferrer" className={styles.inlineLink}>
                  {org.stripe_subscription_id as string}
                </a>
                {stripeTestMode && <span className={styles.sandboxTag}> (Sandbox)</span>}
              </span>
            ) : (
              <span className={styles.mono}>Not set</span>
            )}
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Stripe Customer</span>
            <span className={styles.mono}>{(org.stripe_customer_id as string | null) ?? 'Not set'}</span>
          </div>
          {planCfg && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Staff Seat Limit</span>
              <span className={styles.fieldValue}>
                {planCfg.seatLimit >= 9999 ? 'Unlimited' : planCfg.seatLimit}
              </span>
            </div>
          )}
          {planCfg && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Officials Free Seats</span>
              <span className={styles.fieldValue}>{planCfg.officialsFreeSeats ? 'Yes' : 'No'}</span>
            </div>
          )}
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <span className={styles.fieldLabel}>Active Modules</span>
            <div className={styles.moduleTagRow}>
              {activeModules.map(m => (
                <span key={m} className={styles.moduleTagIncluded}>
                  {MODULE_LABELS[m] ?? m}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Suspense boundary required: OrgDetailClient reads ?tab via useSearchParams. */}
      <Suspense fallback={null}>
      <OrgDetailClient
        orgId={id}
        orgName={org.name as string}
        orgSlug={org.slug as string}
        currentPlanId={org.plan_id as string}
        currentTournamentLimit={effectiveTournamentLimit ?? ((org.tournament_limit as number | null) ?? 1)}
        currentTeamLimit={(org.team_limit as number | null) ?? null}
        planOptions={planOptions}
        canManageSupport={auth ? hasPlatformPermission(auth.role, 'manage_support') : false}
        canManageBilling={auth ? hasPlatformPermission(auth.role, 'manage_billing') : false}
        canManageProduct={auth ? hasPlatformPermission(auth.role, 'manage_product') : false}
        planModules={planModules}
        enabledAddons={enabledAddons}
        internalNotes={internalNotes}
        overrides={overrides}
        members={members}
        tournaments={tournaments}
        auditEvents={auditEvents}
        auditHref={`/platform-admin/audit?q=${encodeURIComponent(org.name as string)}`}
        pendingOwnershipTransfers={pendingOwnershipTransfers}
        stripeSubscriptionId={(org.stripe_subscription_id as string | null) ?? null}
        subscriptionStatus={subscriptionStatus}
        isSuperAdmin={auth?.role === 'super_admin'}
        isFreeFloor={isFreeFloor}
        scopeWallHitCount={scopeWallHitCount}
      />
      </Suspense>
    </div>
  );
}
