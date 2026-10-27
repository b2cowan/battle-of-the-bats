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
import { hasPlatformPower, requirePlatformAreaView } from '@/lib/platform-auth';
import { readLeadSummary } from '@/lib/lead-book';
import {
  getCommandCenterStats,
  getLatestPlatformMetricSnapshot,
  PLAN_ORDER,
  planLabel,
  STATUS_ORDER,
  statusLabel,
} from '@/lib/platform-metrics';
import MetricSnapshotButton from '../MetricSnapshotButton';
import OverviewTabs from '../OverviewTabs';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import kit from '../console.module.css';
import styles from '../overview.module.css';

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

/**
 * Business numbers — Overview's four tabs, moved whole (Support console Stage 2; drawings "Today": "the tabs of plan mix,
 * growth and usage move one door away", "Nothing is deleted"). Plan mix, status by plan, billing events, growth, usage
 * and the metric notes keep every figure they had. In the Growth menu for every role (Stage 7, S7-D6); Today's totals
 * line stays a door to it.
 */
export const metadata = { title: 'Business numbers — Support console' };

export default async function BusinessNumbersPage() {
  const auth = await requirePlatformAreaView('overview');
  const role = auth.role;
  // Snapshot is a product write — only show the button to roles the API will accept.
  const canSnapshot = hasPlatformPower(role, 'metric_snapshot');
  // Leads count through the one definition (Stage 7 Part 2), never their own way; the growth power alone gets the
  // unanswered count and the door to the pipeline (drawing F: other roles get three counts and no door).
  const worksLeads = hasPlatformPower(role, 'growth');
  const [stats, latestSnapshot, leadSummary] = await Promise.all([
    getCommandCenterStats(),
    getLatestPlatformMetricSnapshot(),
    readLeadSummary(),
  ]);
  const orgTotal = stats.totals.organizations;
  const lead = leadSummary.kind === 'read' ? leadSummary.value : null;

  return (
    <div className={kit.page}>
      <AdminPageHeader title="Business numbers" />
      <p className={`${kit.caption} ${kit.captionTight}`}>
        {stats.totals.organizations} clubs and portals · {stats.totals.users} people · {stats.totals.tournaments} tournaments
        {' '}· {stats.totals.teams} teams · about ${stats.totals.estimatedMrr.toLocaleString('en-CA')} a month at list price
        {' '}(${stats.totals.estimatedArr.toLocaleString('en-CA')} a year)
      </p>

      <OverviewTabs
        defaultTab={role === 'growth' ? 'growth' : 'subscription'}
        subscription={
          <div className={styles.dashboardGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={kit.eye}>Subscription health</div>
                  <h2 className={styles.sectionTitle}>Plan mix</h2>
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
                    <span className={kit.eye}>{statusLabel(status)}</span>
                    <strong>{stats.subscription.byStatus[status] ?? 0}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={kit.eye}>Billing detail</div>
                  <h2 className={styles.sectionTitle}>Status by plan</h2>
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
                  <div className={kit.eye}>Lifecycle history</div>
                  <h2 className={styles.sectionTitle}>Billing events</h2>
                </div>
                <CreditCard size={16} />
              </div>
              <div className={styles.lifecycleGrid}>
                <div className={styles.lifecycleHeader}>Event</div>
                <div className={styles.lifecycleHeader}>7d</div>
                <div className={styles.lifecycleHeader}>30d</div>
                <div className={styles.lifecycleHeader}>90d</div>
                <div className={styles.lifecycleLabel}>New subscriptions</div>
                <div>{stats.lifecycle.newSubscriptions.days7}</div>
                <div>{stats.lifecycle.newSubscriptions.days30}</div>
                <div>{stats.lifecycle.newSubscriptions.days90}</div>
                <div className={styles.lifecycleLabel}>Upgrades</div>
                <div>{stats.lifecycle.upgrades.days7}</div>
                <div>{stats.lifecycle.upgrades.days30}</div>
                <div>{stats.lifecycle.upgrades.days90}</div>
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
                  <div className={kit.eye}>Growth</div>
                  <h2 className={styles.sectionTitle}>New accounts</h2>
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
                  <div className={kit.eye}>Growth pipeline</div>
                  <h2 className={styles.sectionTitle}>Leads and conversion</h2>
                </div>
                <Mail size={16} />
              </div>
              {lead ? (
                <div className={styles.statRow}>
                  <div><strong>{lead.leads}</strong><span>Leads, all time</span></div>
                  <div><strong>{lead.signedUp}</strong><span>Signed up{lead.rate !== null ? ` · ${lead.rate}%` : ''}</span></div>
                  <div><strong>{lead.payNow ?? 'Not read'}</strong><span>Pay now</span></div>
                </div>
              ) : (
                <p className={kit.muted}>Not read. The leads could not be read just now.</p>
              )}
              {worksLeads && lead && (
                <div className={styles.compactList}>
                  <div><span>New, unanswered</span><strong>{lead.unanswered}</strong></div>
                </div>
              )}
              {worksLeads && (
                <div className={styles.panelLinkRow}>
                  <Link href="/platform-admin/early-access">Open the pipeline</Link>
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={kit.eye}>Free tier</div>
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
                  <div className={kit.eye}>Product usage</div>
                  <h2 className={styles.sectionTitle}>Activity</h2>
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
            </section>
          </div>
        }
        notes={
          <div className={styles.dashboardGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={kit.eye}>Metric notes</div>
                  <h2 className={styles.sectionTitle}>How counts are calculated</h2>
                </div>
                <AlertCircle size={16} />
              </div>
              <p className={styles.panelCopy}>
                Billing event counts come from saved events. New subscriptions and upgrades are recorded only from the day
                they started being saved, so their 30 and 90 day counts fill in over time. A comeback after a cancellation
                counts as a recovery, never a new subscription, and a free comp that starts paying counts as new.
                Historical trend charts are still future work because they need daily metric snapshots.
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
