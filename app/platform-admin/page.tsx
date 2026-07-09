import Link from 'next/link';
import {
  AlertCircle,
  ArchiveRestore,
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  Gauge,
  Layers,
  Mail,
  ShieldAlert,
  Sparkles,
  Trophy,
  Users,
  UsersRound,
} from 'lucide-react';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { getPlatformAdminContext, hasPlatformPermission } from '@/lib/platform-auth';
import { canViewPlatformArea, canWritePlatformArea, type PlatformArea } from '@/lib/platform-areas';
import HelpCallout from '@/components/help/HelpCallout';
import { getPreviousPlatformAdminVisit } from '@/lib/platform-admin-visits';
import { fmtAbsoluteDateTime } from '@/lib/format-date';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { classifyCampaignSend } from '@/lib/marketing-schedule';
import {
  getCommandCenterStats,
  getLatestPlatformMetricSnapshot,
  MODULES,
  PLAN_ORDER,
  planLabel,
  STATUS_ORDER,
  statusLabel,
} from '@/lib/platform-metrics';
import MetricSnapshotButton from './MetricSnapshotButton';
import OverviewTabs from './OverviewTabs';
import MetricCard from '@/components/platform-admin/MetricCard';
import styles from './overview.module.css';

function BarRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? Math.max(3, Math.round((value / total) * 100)) : 0;
  return (
    <div className={styles.barRow}>
      <div className={styles.barMeta}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className={styles.barTrack}>
        <span className={styles.barFill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function AlertItem({
  label,
  value,
  href,
  tone = 'neutral',
  title,
}: {
  label: string;
  value: number;
  href?: string;
  tone?: 'neutral' | 'warn';
  title?: string;
}) {
  const content = (
    <>
      <span className={styles.alertValue}>{value}</span>
      <span className={styles.alertLabel}>{label}</span>
    </>
  );

  // href is omitted when the signed-in role can't reach the target area — render a
  // non-clickable tile (with a "requires X access" tooltip) instead of a dead link.
  if (href) {
    return (
      <Link className={`${styles.alertItem} ${tone === 'warn' ? styles.alertWarn : ''}`} href={href} title={title}>
        {content}
      </Link>
    );
  }

  return (
    <div className={`${styles.alertItem} ${tone === 'warn' ? styles.alertWarn : ''}`} title={title}>
      {content}
    </div>
  );
}

// Role-aware first-login orientation. Each role is pointed only to surfaces it can
// actually reach (e.g. growth is not sent to observability, which is hidden for it).
const ORIENTATION_BY_ROLE: Record<string, { body: string; cta: { label: string; href: string } }> = {
  super_admin: {
    body: 'You have access to every area of the console. Read the Platform Admin Operations SOP before making account, billing, or pricing changes.',
    cta: { label: 'Open the Operations SOP', href: '/platform-admin/help/platform-admin' },
  },
  support: {
    body: 'Your job surfaces are Customer Users, Feedback, Observability (view), and Audit. Start with the Support SOP for password resets, feedback triage, and account investigation.',
    cta: { label: 'Open the Support SOP', href: '/platform-admin/help/platform-admin#reset-password' },
  },
  billing: {
    body: 'Your primary surfaces are Organizations (Billing & Access), Retention, Feedback, and Bulk Operations. Start with the Billing SOP for overrides, retention, and cancellations.',
    cta: { label: 'Open the Billing SOP', href: '/platform-admin/help/platform-admin#billing-overrides' },
  },
  product: {
    body: 'You have write access to Feedback, the Approval Queue, Email Templates, Email Campaigns, Plans & Pricing, and Observability. Start with the Product Operator path.',
    cta: { label: 'Open the Product Operator path', href: '/platform-admin/help/platform-admin#change-requests' },
  },
  growth: {
    body: 'Your surfaces are Early Access and Email Campaigns. Start with the Growth Operator path for the lead pipeline and batch marketing sends.',
    cta: { label: 'Open the Growth Operator path', href: '/platform-admin/help/platform-admin#early-access-pipeline' },
  },
  read_only: {
    body: 'This console is read-only for your role. You can view the Action Queue and org details, but no changes can be made from any surface.',
    cta: { label: 'Browse the Operations SOP', href: '/platform-admin/help/platform-admin' },
  },
};

const fmtDateTime = (iso: string) => fmtAbsoluteDateTime(iso);

/**
 * Marketing-campaign send alerts for the Action Queue: how many campaigns are past due
 * (planned date arrived/passed, not yet sent) and how many are due within the window.
 * Uses the SAME classification as the Email Dashboard so the two never disagree.
 */
async function getMarketingCampaignAlerts(): Promise<{ pastDue: number; dueSoon: number }> {
  const todayISO = new Date().toISOString().slice(0, 10);
  const [tmplRes, batchRes] = await Promise.all([
    supabaseAdmin
      .from('platform_email_templates')
      .select('key, planned_send_date')
      .eq('category', 'marketing'),
    supabaseAdmin
      .from('email_batches')
      .select('email_key')
      .eq('status', 'complete'),
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

export default async function PlatformOverviewPage() {
  const auth = await getPlatformAdminContext();
  const platformUser = auth?.user ?? null;
  const role = auth?.role ?? 'read_only';
  // The Action Queue is grouped by domain; each tile carries its own area so the render
  // can (a) strip the link for areas this role can't reach and (b) hide whole groups the
  // role can't act on. See `alertGroups` below.
  // Trial-ending and expired-override alerts are billing-team work; retention writers
  // (super_admin + billing) are the roles that can actually action them.
  const canActionBillingAlerts = canWritePlatformArea(role, 'retention');
  // Snapshot is a product write — only show the button to roles the API will accept.
  const canSnapshot = hasPlatformPermission(role, 'manage_product');
  const previousVisit = platformUser?.email ? await getPreviousPlatformAdminVisit(platformUser.email) : null;
  // First-login orientation: shows once, then a localStorage flag keeps it dismissed.
  const orientation = previousVisit === null ? ORIENTATION_BY_ROLE[role] : null;
  const [stats, latestSnapshot, pricingRequestResult, campaignAlerts] = await Promise.all([
    getCommandCenterStats({ since: previousVisit?.visited_at ?? null }),
    getLatestPlatformMetricSnapshot(),
    supabaseAdmin
      .from('platform_catalog_change_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['needs_review', 'approved']),
    getMarketingCampaignAlerts(),
  ]);
  const orgTotal = stats.totals.organizations;
  // Any catalog change request still awaiting action (review or implementation), across ALL request
  // types — plan availability ("Live") toggles, plan config, and Stripe prices — so a pending launch
  // approval is visible on first login. Matches the Approval Queue's "Action Needed" definition.
  const pendingApprovalRequests = pricingRequestResult.count ?? 0;
  const lastVisitLabel = previousVisit ? `Last visit ${fmtDateTime(previousVisit.visited_at)}` : 'First tracked visit';
  const earlyAccessStatusRows = ['new', 'qualified', 'contacted', 'pilot_candidate', 'converted']
    .map(status => ({ status, count: stats.growth.earlyAccessByStatus[status] ?? 0 }))
    .filter(row => row.count > 0 || row.status === 'new');

  // ── Action Queue, grouped by operational domain ────────────────────────────
  // Each tile carries a plain-language tooltip + the `area` that gates its link and its
  // group's visibility. `warn` marks tiles where a non-zero count means "act now".
  type AlertTile = { label: string; value: number; area: PlatformArea; href: string; warn: boolean; title: string };
  const alertGroups: { label: string; tiles: AlertTile[] }[] = [
    {
      label: 'Billing',
      tiles: [
        { label: 'Past due orgs', value: stats.alerts.pastDue, area: 'organizations', href: '/platform-admin/orgs?status=past_due', warn: true, title: 'Organizations with an overdue subscription payment. Opens the past-due org list.' },
        { label: 'Past due since visit', value: stats.alerts.newPastDueSinceLastVisit, area: 'organizations', href: '/platform-admin/orgs?status=past_due', warn: true, title: 'Orgs that became past-due since your last login — new since you were last here.' },
        { label: 'Trials ending soon', value: stats.alerts.trialEndingSoon, area: 'organizations', href: '/platform-admin/orgs?filter=trial_ending', warn: true, title: 'Paid-plan trials expiring soon; the card on file will be charged when they end.' },
        { label: 'Overrides expiring soon', value: stats.alerts.overridesExpiringSoon, area: 'organizations', href: '/platform-admin/orgs?filter=expiring_overrides', warn: true, title: 'Comp / discount period overrides about to expire — the org reverts to standard billing.' },
        { label: 'Retention records', value: stats.alerts.retentionAlertCount, area: 'retention', href: '/platform-admin/retention', warn: true, title: 'Cancelled orgs still inside the data-retention window — restorable if they resubscribe.' },
      ],
    },
    {
      label: 'Accounts',
      tiles: [
        { label: 'Missing owners', value: stats.alerts.orgsWithoutOwner, area: 'organizations', href: '/platform-admin/orgs?filter=no_owner', warn: true, title: 'Organizations with no owner account assigned — nobody can manage billing or settings.' },
        { label: 'Owner inactive', value: stats.alerts.orgsWithInactiveOwner, area: 'organizations', href: '/platform-admin/orgs?filter=owner_inactive', warn: true, title: 'Orgs whose owner hasn’t signed in recently — may need outreach.' },
      ],
    },
    {
      label: 'Growth & Marketing',
      tiles: [
        { label: 'New leads', value: stats.alerts.newEarlyAccessLeads, area: 'early_access', href: '/platform-admin/early-access', warn: true, title: 'New early-access signups awaiting triage in the lead pipeline.' },
        { label: 'Campaigns past due', value: campaignAlerts.pastDue, area: 'email', href: '/platform-admin/email', warn: true, title: 'Marketing campaigns whose planned send date has arrived or passed and haven’t been sent.' },
        { label: 'Campaigns due soon', value: campaignAlerts.dueSoon, area: 'email', href: '/platform-admin/email', warn: false, title: 'Marketing campaigns due to send within the next 30 days — plan ahead.' },
      ],
    },
    {
      label: 'Approvals',
      tiles: [
        { label: 'Approval queue', value: pendingApprovalRequests, area: 'change_requests', href: '/platform-admin/change-requests', warn: true, title: 'Plan-availability, plan-config, and Stripe-price change requests awaiting review or implementation.' },
      ],
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.headerLabel}>Command Center</div>
          <h1 className={styles.title}>Overview</h1>
        </div>
        <div className={styles.headerMeta}>
          <span>Live operational snapshot</span>
          <span>{lastVisitLabel}</span>
        </div>
      </header>

      <section className={styles.metricGrid} aria-label="Platform totals">
        <MetricCard label="Organizations" value={stats.totals.organizations} Icon={Building2} />
        <MetricCard label="Users" value={stats.totals.users} sub="Auth users loaded" Icon={Users} />
        <MetricCard label="Tournaments" value={stats.totals.tournaments} Icon={Trophy} />
        <MetricCard label="Teams" value={stats.totals.teams} Icon={UsersRound} />
        <MetricCard label="Estimated MRR" value={`$${stats.totals.estimatedMrr.toLocaleString()}`} sub={`$${stats.totals.estimatedArr.toLocaleString()} ARR`} Icon={CreditCard} />
      </section>

      {orientation && (
        <HelpCallout
          variant="info"
          title="Welcome to the platform admin console"
          body={orientation.body}
          cta={orientation.cta}
          dismissible
          localStorageKey="pa_orientation_dismissed"
        />
      )}

      <section className={styles.alertStrip} aria-label="Needs attention">
        <div>
          <div className={styles.sectionKicker}>Needs Attention</div>
          <h2 className={styles.sectionTitle}>Action Queue</h2>
        </div>
        {alertGroups
          // Hide any group the signed-in role can't act on (no viewable tiles in it).
          .filter(group => group.tiles.some(t => canViewPlatformArea(role, t.area)))
          .map(group => {
            const total = group.tiles.reduce((sum, t) => sum + t.value, 0);
            const urgent = group.tiles.some(t => t.warn && t.value > 0);
            return (
              <div key={group.label} className={styles.alertGroup}>
                <div className={styles.alertGroupHead}>
                  <span className={styles.alertGroupLabel}>{group.label}</span>
                  {total > 0 && (
                    <span className={`${styles.alertGroupCount} ${urgent ? styles.alertGroupCountUrgent : ''}`}>
                      {total} {total === 1 ? 'item needs' : 'items need'} attention
                    </span>
                  )}
                </div>
                <div className={styles.alertGrid}>
                  {group.tiles.map(t => {
                    const clickable = canViewPlatformArea(role, t.area);
                    return (
                      <AlertItem
                        key={t.label}
                        label={t.label}
                        value={t.value}
                        href={clickable ? t.href : undefined}
                        title={clickable ? t.title : `${t.title} (requires additional access for your role)`}
                        tone={t.warn && t.value > 0 ? 'warn' : 'neutral'}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        {!canActionBillingAlerts && (stats.alerts.trialEndingSoon > 0 || stats.alerts.overridesExpiringSoon > 0) && (
          <p className={styles.alertRoleNote}>
            Trials ending soon and overrides expiring soon require billing access — contact the billing team to action them.
          </p>
        )}
      </section>

      <OverviewTabs
        defaultTab={role === 'growth' ? 'growth' : 'subscription'}
        subscription={
          <div className={styles.dashboardGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.sectionKicker}>Subscription Health</div>
                  <h2 className={styles.sectionTitle}>Plan Mix</h2>
                </div>
                <BarChart3 size={16} />
              </div>
              <div className={styles.barList}>
                {PLAN_ORDER.map(plan => (
                  <BarRow
                    key={plan}
                    label={PLAN_CONFIG[plan].label}
                    value={stats.subscription.byPlan[plan] ?? 0}
                    total={orgTotal}
                  />
                ))}
              </div>
              <div className={styles.statusGrid}>
                {STATUS_ORDER.map(status => (
                  <div key={status} className={styles.statusTile}>
                    <span>{statusLabel(status)}</span>
                    <strong>{stats.subscription.byStatus[status] ?? 0}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.sectionKicker}>Billing Detail</div>
                  <h2 className={styles.sectionTitle}>Status By Plan</h2>
                </div>
                <Gauge size={16} />
              </div>
              <div className={styles.matrix}>
                <div className={styles.matrixHeader}>Plan</div>
                {STATUS_ORDER.map(status => <div key={status} className={styles.matrixHeader}>{statusLabel(status)}</div>)}
                {PLAN_ORDER.map(plan => (
                  <div key={plan} className={styles.matrixRow}>
                    <div className={styles.matrixPlan}>{planLabel(plan)}</div>
                    {STATUS_ORDER.map(status => (
                      <div key={`${plan}-${status}`} className={styles.matrixCell}>
                        {stats.subscription.statusByPlan[plan]?.[status] ?? 0}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.panelWide}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.sectionKicker}>Lifecycle History</div>
                  <h2 className={styles.sectionTitle}>Billing Events</h2>
                </div>
                <CreditCard size={16} />
              </div>
              <div className={styles.lifecycleGrid}>
                <div className={styles.lifecycleHeader}>Event</div>
                <div className={styles.lifecycleHeader}>7d</div>
                <div className={styles.lifecycleHeader}>30d</div>
                <div className={styles.lifecycleHeader}>90d</div>
                <div className={styles.lifecycleLabel}>Cancellations</div>
                <div>{stats.lifecycle.cancellations.days7}</div>
                <div>{stats.lifecycle.cancellations.days30}</div>
                <div>{stats.lifecycle.cancellations.days90}</div>
                <div className={styles.lifecycleLabel}>Downgrades</div>
                <div>{stats.lifecycle.downgrades.days7}</div>
                <div>{stats.lifecycle.downgrades.days30}</div>
                <div>{stats.lifecycle.downgrades.days90}</div>
                <div className={styles.lifecycleLabel}>Recoveries</div>
                <div>{stats.lifecycle.recoveries.days7}</div>
                <div>{stats.lifecycle.recoveries.days30}</div>
                <div>{stats.lifecycle.recoveries.days90}</div>
              </div>
              <div className={styles.recoveryRate}>
                <strong>{stats.lifecycle.recoveryRate30}%</strong>
                <span>30-day past-due recovery rate</span>
              </div>
            </section>
          </div>
        }
        growth={
          <div className={styles.dashboardGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.sectionKicker}>Growth</div>
                  <h2 className={styles.sectionTitle}>New Accounts</h2>
                </div>
                <Sparkles size={16} />
              </div>
              <div className={styles.statRow}>
                <div><strong>{stats.growth.newOrgs7}</strong><span>7 days</span></div>
                <div><strong>{stats.growth.newOrgs30}</strong><span>30 days</span></div>
                <div><strong>{stats.growth.newOrgs90}</strong><span>90 days</span></div>
              </div>
              <div className={styles.compactList}>
                {PLAN_ORDER.map(plan => (
                  <div key={plan}>
                    <span>{planLabel(plan)}</span>
                    <strong>{stats.growth.newOrgsByPlan[plan] ?? 0}</strong>
                  </div>
                ))}
              </div>
              <div className={styles.panelLinkRow}>
                <Link href="/platform-admin/orgs">Review organizations</Link>
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.sectionKicker}>Growth Pipeline</div>
                  <h2 className={styles.sectionTitle}>Early Access</h2>
                </div>
                <Mail size={16} />
              </div>
              <div className={styles.statRow}>
                <div><strong>{stats.growth.earlyAccessTotal}</strong><span>Total leads</span></div>
                <div><strong>{stats.growth.newLeads7}</strong><span>New 7 days</span></div>
                <div><strong>{stats.growth.conversionRate}%</strong><span>Converted</span></div>
              </div>
              <div className={styles.compactList}>
                {earlyAccessStatusRows.map(row => (
                  <div key={row.status}>
                    <span>{statusLabel(row.status)}</span>
                    <strong>{row.count}</strong>
                  </div>
                ))}
              </div>
              <div className={styles.sourceList}>
                <div className={styles.sourceListTitle}>Top Source Paths</div>
                {stats.growth.sourcePathRows.length > 0 ? (
                  stats.growth.sourcePathRows.map(row => (
                    <div key={row.source}>
                      <span>{row.source}</span>
                      <strong>{row.count}</strong>
                    </div>
                  ))
                ) : (
                  <div><span>No sources yet</span><strong>0</strong></div>
                )}
              </div>
              <div className={styles.panelLinkRow}>
                <Link href="/platform-admin/early-access">Open pipeline</Link>
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.sectionKicker}>Free Tier</div>
                  <h2 className={styles.sectionTitle}>League Starter</h2>
                </div>
                <CalendarDays size={16} />
              </div>
              <div className={styles.statRow}>
                <div><strong>{stats.leagueStarter.orgs}</strong><span>Free-floor orgs</span></div>
                <div><strong>{stats.leagueStarter.created.days7}</strong><span>Created 7d</span></div>
                <div><strong>{stats.leagueStarter.created.days30}</strong><span>Created 30d</span></div>
              </div>
              <div className={styles.compactList}>
                <div><span>Seasons created (30d)</span><strong>{stats.leagueStarter.seasonsCreated30}</strong></div>
                <div><span>Schedules generated (30d)</span><strong>{stats.leagueStarter.schedulesGenerated30}</strong></div>
                <div><span>Public pages shared (30d)</span><strong>{stats.leagueStarter.publicShared30}</strong></div>
                <div><span>Existing-user adds (30d)</span><strong>{stats.leagueStarter.existingUserAdded30}</strong></div>
                <div><span>Scope-wall hits (30d)</span><strong>{stats.leagueStarter.scopeWallHits30}</strong></div>
                <div><span>Upgrade intents (30d)</span><strong>{stats.leagueStarter.upgradeIntents30}</strong></div>
              </div>
              <div className={styles.panelLinkRow}>
                <Link href="/platform-admin/orgs">Review League Starter orgs</Link>
              </div>
            </section>
          </div>
        }
        usage={
          <div className={styles.dashboardGrid}>
            <section className={styles.panelWide}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.sectionKicker}>Product Usage</div>
                  <h2 className={styles.sectionTitle}>Modules And Activity</h2>
                </div>
                <Layers size={16} />
              </div>
              <div className={styles.usageGrid}>
                <div className={styles.usageTile}><Trophy size={15} /><strong>{stats.usage.tournamentsNonArchived}</strong><span>Non-archived tournaments</span></div>
                <div className={styles.usageTile}><CalendarDays size={15} /><strong>{stats.usage.tournamentsActive}</strong><span>Active tournaments</span></div>
                <div className={styles.usageTile}><Sparkles size={15} /><strong>{stats.usage.tournamentsCreated30}</strong><span>Tournaments created 30 days</span></div>
                <div className={styles.usageTile}><UsersRound size={15} /><strong>{stats.usage.teamsTotal}</strong><span>Tournament teams</span></div>
                <div className={styles.usageTile}><Users size={15} /><strong>{stats.usage.leagueRegistrationsActive}</strong><span>Active league registrations</span></div>
                <div className={styles.usageTile}><Building2 size={15} /><strong>{stats.usage.leagueSeasonsActive}</strong><span>Active league seasons</span></div>
                <div className={styles.usageTile}><ShieldAlert size={15} /><strong>{stats.usage.repProgramYearsActive}</strong><span>Active rep years</span></div>
                <div className={styles.usageTile}><CreditCard size={15} /><strong>{stats.usage.accountingEntriesTotal}</strong><span>Accounting entries</span></div>
                <div className={styles.usageTile}><ArchiveRestore size={15} /><strong>{stats.usage.repTeamsTotal}</strong><span>Rep teams</span></div>
              </div>
              <div className={styles.moduleGrid}>
                {MODULES.map(moduleDef => (
                  <BarRow
                    key={moduleDef.key}
                    label={moduleDef.label}
                    value={stats.usage.moduleCounts[moduleDef.key] ?? 0}
                    total={orgTotal}
                  />
                ))}
              </div>
            </section>
          </div>
        }
        notes={
          <div className={styles.dashboardGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.sectionKicker}>Metric Notes</div>
                  <h2 className={styles.sectionTitle}>How Counts Are Calculated</h2>
                </div>
                <AlertCircle size={16} />
              </div>
              <p className={styles.panelCopy}>
                Cancellation, downgrade, and recovery counts come from saved billing events. Historical trend charts are
                still future work because they need daily metric snapshots.
              </p>
              <p className={styles.panelCopy}>
                Latest daily snapshot: {latestSnapshot ? `${latestSnapshot.snapshot_date} (${latestSnapshot.source})` : 'none recorded yet'}.
              </p>
              <div className={styles.snapshotActions}>
                <MetricSnapshotButton canSnapshot={canSnapshot} />
              </div>
            </section>
          </div>
        }
      />
    </div>
  );
}
