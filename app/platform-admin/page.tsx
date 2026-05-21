import Link from 'next/link';
import type { ComponentType } from 'react';
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
import { getPlatformAuthContext } from '@/lib/platform-auth';
import { getPreviousPlatformAdminVisit } from '@/lib/platform-admin-visits';
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
import styles from './overview.module.css';

function MetricCard({
  label,
  value,
  sub,
  Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  Icon: ComponentType<{ size?: number }>;
}) {
  return (
    <div className={styles.metricCard}>
      <div className={styles.iconWrap}><Icon size={18} /></div>
      <div>
        <div className={styles.metricValue}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
        <div className={styles.metricLabel}>{label}</div>
        {sub && <div className={styles.metricSub}>{sub}</div>}
      </div>
    </div>
  );
}
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
}: {
  label: string;
  value: number;
  href?: string;
  tone?: 'neutral' | 'warn';
}) {
  const content = (
    <>
      <span className={styles.alertValue}>{value}</span>
      <span className={styles.alertLabel}>{label}</span>
    </>
  );

  if (href) {
    return (
      <Link className={`${styles.alertItem} ${tone === 'warn' ? styles.alertWarn : ''}`} href={href}>
        {content}
      </Link>
    );
  }

  return (
    <div className={`${styles.alertItem} ${tone === 'warn' ? styles.alertWarn : ''}`}>
      {content}
    </div>
  );
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function PlatformOverviewPage() {
  const platformUser = await getPlatformAuthContext();
  const previousVisit = platformUser?.email ? await getPreviousPlatformAdminVisit(platformUser.email) : null;
  const [stats, latestSnapshot] = await Promise.all([
    getCommandCenterStats({ since: previousVisit?.visited_at ?? null }),
    getLatestPlatformMetricSnapshot(),
  ]);
  const orgTotal = stats.totals.organizations;
  const lastVisitLabel = previousVisit ? `Last visit ${fmtDateTime(previousVisit.visited_at)}` : 'First tracked visit';
  const earlyAccessStatusRows = ['new', 'qualified', 'contacted', 'pilot_candidate', 'converted']
    .map(status => ({ status, count: stats.growth.earlyAccessByStatus[status] ?? 0 }))
    .filter(row => row.count > 0 || row.status === 'new');

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

      <section className={styles.alertStrip} aria-label="Needs attention">
        <div>
          <div className={styles.sectionKicker}>Needs Attention</div>
          <h2 className={styles.sectionTitle}>Action Queue</h2>
        </div>
        <div className={styles.alertGrid}>
          <AlertItem label="Past due orgs" value={stats.alerts.pastDue} href="/platform-admin/orgs?status=past_due" tone={stats.alerts.pastDue > 0 ? 'warn' : 'neutral'} />
          <AlertItem label="Past due since visit" value={stats.alerts.newPastDueSinceLastVisit} href="/platform-admin/orgs?status=past_due" tone={stats.alerts.newPastDueSinceLastVisit > 0 ? 'warn' : 'neutral'} />
          <AlertItem label="Trials ending soon" value={stats.alerts.trialEndingSoon} tone={stats.alerts.trialEndingSoon > 0 ? 'warn' : 'neutral'} />
          <AlertItem label="New leads" value={stats.alerts.newEarlyAccessLeads} href="/platform-admin/early-access" tone={stats.alerts.newEarlyAccessLeads > 0 ? 'warn' : 'neutral'} />
          <AlertItem label="Retention records" value={stats.alerts.retentionAlertCount} href="/platform-admin/retention" tone={stats.alerts.retentionAlertCount > 0 ? 'warn' : 'neutral'} />
          <AlertItem label="Expired overrides" value={stats.alerts.expiredOverrides} tone={stats.alerts.expiredOverrides > 0 ? 'warn' : 'neutral'} />
          <AlertItem label="Missing owners" value={stats.alerts.orgsWithoutOwner} tone={stats.alerts.orgsWithoutOwner > 0 ? 'warn' : 'neutral'} />
          <AlertItem label="Owner inactive" value={stats.alerts.orgsWithInactiveOwner} tone={stats.alerts.orgsWithInactiveOwner > 0 ? 'warn' : 'neutral'} />
        </div>
      </section>

      <OverviewTabs
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
                <MetricSnapshotButton />
              </div>
            </section>
          </div>
        }
      />
    </div>
  );
}
