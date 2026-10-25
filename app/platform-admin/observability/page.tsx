import Link from 'next/link';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import {
  getDashboardData, getCronFreshness, getErrorGroups,
  normalizeWindow, OBS_WINDOWS, ISSUES_PAGE_SIZE,
  type ObsWindowKey,
} from '@/lib/observability/dashboard';
import { fmtAbsoluteDateTime } from '@/lib/format-date';
import CallsVsErrorsChart from './CallsVsErrorsChart';
import IssuesExportClient from './IssuesExportClient';
import IssuesFilterBar from './IssuesFilterBar';
import WindowSelect from './WindowSelect';
import { cap, severityChip, issueStatusChip } from '../chips';
import kit from '../console.module.css';
import styles from './observability.module.css';

export const dynamic = 'force-dynamic';

const SEVERITY_OPTIONS = ['critical', 'error', 'warning', 'info'];
const STATUS_OPTIONS = ['open', 'resolved', 'ignored', 'snoozed'];

interface SearchParamsShape {
  window?: string;
  severity?: string;
  status?: string;
  route?: string;
  org?: string;
  q?: string;
  offset?: string;
}

interface ResolvedParams {
  window: ObsWindowKey;
  severity: string;
  status: string;
  route: string;
  org: string;
  q: string;
  offset: number;
}

function buildHref(p: ResolvedParams, extra: Partial<ResolvedParams> = {}): string {
  const next = { ...p, ...extra };
  const sp = new URLSearchParams();
  if (next.window !== '24h') sp.set('window', next.window);
  if (next.severity) sp.set('severity', next.severity);
  if (next.status) sp.set('status', next.status);
  if (next.route) sp.set('route', next.route);
  if (next.org) sp.set('org', next.org);
  if (next.q) sp.set('q', next.q);
  if (next.offset > 0) sp.set('offset', String(next.offset));
  const qs = sp.toString();
  return `/platform-admin/observability${qs ? `?${qs}` : ''}`;
}

// Was missing the year (PF-5 drift fix); now normalized via the shared helper.
const fmtDateTime = (iso: string) => fmtAbsoluteDateTime(iso);

function fmtMttr(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function BreakdownBars({ rows, max, fmtLabel, code }: { rows: { label: string; count: number }[]; max: number; fmtLabel?: (s: string) => string; code?: boolean }) {
  if (rows.length === 0) return <p className={styles.emptyPanel}>No data in this window.</p>;
  return (
    <div className={styles.barList}>
      {rows.map(r => (
        <div key={r.label} className={styles.barRow}>
          <div className={styles.barMeta}>
            <span className={code ? kit.code : undefined}>{fmtLabel ? fmtLabel(r.label) : r.label}</span>
            <strong>{r.count.toLocaleString()}</strong>
          </div>
          <div className={styles.barTrack}>
            <span className={styles.barFill} style={{ width: `${max > 0 ? Math.max(4, Math.round((r.count / max) * 100)) : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function ObservabilityDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsShape>;
}) {
  await requirePlatformAreaView('observability');

  const sp = await searchParams;
  const params: ResolvedParams = {
    window: normalizeWindow(sp.window),
    severity: SEVERITY_OPTIONS.includes(sp.severity ?? '') ? sp.severity! : '',
    // Default to the actionable view (Open) on a bare visit; `status=all` is the explicit
    // widen-to-everything token (non-empty so it survives buildHref); invalid → Open.
    status: sp.status === undefined ? 'open' : (sp.status === 'all' || STATUS_OPTIONS.includes(sp.status) ? sp.status : 'open'),
    route: (sp.route ?? '').slice(0, 120),
    org: (sp.org ?? '').slice(0, 120),
    q: (sp.q ?? '').slice(0, 120),
    offset: Math.max(0, parseInt(sp.offset ?? '0', 10) || 0),
  };

  const [data, freshness, issues] = await Promise.all([
    getDashboardData(params.window),
    getCronFreshness(),
    getErrorGroups({ ...params, status: params.status === 'all' ? '' : params.status }),
  ]);

  // Freshness chip — most-recent cron run, or "not run yet" before migration 122 is applied to
  // this environment. The jobs bump last_run_at ONLY on success. Three independent staleness
  // signals (any one → amber): the fold (>15 min vs its 5-min cadence) via the most-recent row;
  // the nightly sweep (>26h — caught explicitly because a fresh fold otherwise keeps the chip
  // green); and anyJobError (a job that ran-and-failed). A job that NEVER runs leaves an empty
  // table → the gray "not run yet" state below (also the deployed-but-pre-122 window).
  const mostRecent = freshness.rows
    .filter(r => r.minutesAgo !== null)
    .sort((a, b) => (a.minutesAgo ?? Infinity) - (b.minutesAgo ?? Infinity))[0];
  const sweepRow = freshness.rows.find(r => r.jobName === 'retention_sweep');
  const sweepStale = !!sweepRow && (sweepRow.minutesAgo ?? 0) > 26 * 60;
  const anyJobError = freshness.rows.some(r => r.status === 'error');
  const freshnessEnabled = freshness.enabled && !!mostRecent;
  const freshnessStale = (freshnessEnabled && (mostRecent.minutesAgo ?? 0) > 15) || sweepStale || anyJobError;

  const routeMax = Math.max(...data.byRoute.map(r => r.count), 1);
  const sourceMax = Math.max(...data.bySource.map(r => r.count), 1);
  const hasFilters = !!(params.severity || params.route || params.org || params.q) || params.status !== 'all';

  const windowKeys = Object.keys(OBS_WINDOWS) as ObsWindowKey[];

  return (
    <div className={kit.page}>
      <AdminPageHeader
        title="Errors"
        actions={
          <>
            <span
              className={`${kit.chip} ${freshnessStale ? kit.chipWarn : !freshnessEnabled && !anyJobError ? kit.chipQuiet : kit.chipOk}`}
              title={
                anyJobError
                  ? 'A rollup/retention job is reporting errors — see observability_cron_heartbeat.error_detail'
                  : sweepStale
                    ? 'The nightly retention sweep has not run in over 26h — check pg_cron'
                    : freshnessEnabled
                      ? `Rollup job last ran ${mostRecent.minutesAgo} min ago`
                      : 'No cron run recorded yet — confirm migration 122 is applied and pg_cron is running'
              }
            >
              {freshnessEnabled
                ? `Last rollup ${mostRecent.minutesAgo}m ago${anyJobError ? ' · job error' : sweepStale ? ' · sweep stale' : ''}`
                : anyJobError
                  ? 'Rollup job failing'
                  : 'Rollup has not run yet'}
            </span>
            <WindowSelect
              value={params.window}
              options={windowKeys.map(wk => ({ key: wk, label: OBS_WINDOWS[wk].label, href: buildHref(params, { window: wk, offset: 0 }) }))}
            />
          </>
        }
      />

      {/* ── Figures ────────────────────────────────────────────────────── */}
      <section className={kit.band} aria-label="Headline metrics">
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>{`Captured errors · ${OBS_WINDOWS[params.window].label}`}</span>
          <strong className={kit.bandValue}>{data.totalErrors.toLocaleString()}</strong>
          <span className={kit.bandNote}>All sources</span>
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Error rate</span>
          <strong className={kit.bandValue}>{data.errorRatePct === null ? '—' : `${data.errorRatePct.toFixed(2)}%`}</strong>
          <span className={kit.bandNote}>Instrumented traffic only</span>
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Open issues</span>
          <strong className={kit.bandValue}>{data.openIssues.toLocaleString()}</strong>
          <span className={kit.bandNote}>{`${data.newIssues} new in window`}</span>
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Affected orgs</span>
          <strong className={kit.bandValue}>{data.affectedOrgs.toLocaleString()}</strong>
          <span className={kit.bandNote}>{data.eventsCapped ? 'In window · sampled' : 'In this window'}</span>
        </div>
      </section>

      <p className={kit.caption}>
        Two different measures on purpose: the <strong>error rate</strong> (and the calls-vs-errors chart) covers only
        instrumented (wrapped) routes, so it can show a true failures-÷-requests rate; <strong>captured errors</strong> and
        the issue list come from global error capture across all sources, so they are more complete. A 0% instrumented error
        rate can therefore sit alongside captured errors from routes not yet wrapped (coverage expands in later phases). Open
        issues include snoozed issues whose snooze has expired.
        {data.eventsCapped && ' The breakdowns and the Affected-orgs count reflect only the most recent 5,000 events in this window.'}
      </p>

      {/* ── Calls vs errors chart ──────────────────────────────────────── */}
      <section className={kit.section}>
        <h2 className={kit.sectionTitle}>Calls vs. errors</h2>
        <div className={`${kit.card} ${kit.cardPad}`}>
          <p className={`${kit.caption} ${styles.chartCaption}`}>
            {data.totalCalls.toLocaleString()} calls · {data.totalErrorsMetric.toLocaleString()} errors (instrumented)
          </p>
          {data.totalCalls === 0 && data.totalErrorsMetric === 0 ? (
            <p className={styles.emptyPanel}>
              No instrumented request metrics in this window yet. Metrics accrue from routes wrapped with{' '}
              <code className={kit.code}>withObservability</code>; coverage expands in later phases.
            </p>
          ) : (
            <CallsVsErrorsChart data={data.series} />
          )}
        </div>
      </section>

      {/* ── §6 breakdown panels ────────────────────────────────────────── */}
      <div className={kit.two}>
        <section className={kit.section}>
          <h2 className={kit.sectionTitle}>Top error routes</h2>
          <div className={`${kit.card} ${kit.cardPad}`}>
            <BreakdownBars rows={data.byRoute.map(r => ({ label: r.route, count: r.count }))} max={routeMax} code />
          </div>
        </section>

        <section className={kit.section}>
          <h2 className={kit.sectionTitle}>Status codes</h2>
          <div className={`${kit.card} ${kit.cardPad}`}>
            {data.byStatusCode.length === 0 ? (
              <p className={styles.emptyPanel}>No data in this window.</p>
            ) : (
              <div className={styles.codeGrid}>
                {data.byStatusCode.map(c => (
                  <div key={c.code} className={styles.codeTile}>
                    <strong>{c.count.toLocaleString()}</strong>
                    <span className={kit.code}>{c.code}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className={kit.section}>
          <h2 className={kit.sectionTitle}>Client vs. server</h2>
          <div className={`${kit.card} ${kit.cardPad}`}>
            <BreakdownBars
              rows={data.bySource.map(r => ({ label: r.source, count: r.count }))}
              max={sourceMax}
              fmtLabel={s => (s === 'client' ? 'Client' : s === 'server' ? 'Server' : s)}
            />
          </div>
        </section>

        <section className={kit.section}>
          <h2 className={kit.sectionTitle}>Triage health</h2>
          <div className={`${kit.card} ${kit.cardPad}`}>
            <div className={styles.mttrValue}>{fmtMttr(data.mttrHours)}</div>
            <div className={styles.mttrSub}>Mean time to resolve · all-time (resolved issues)</div>
            <div className={`${styles.mttrValue} ${styles.mttrSecond}`}>{data.newIssues.toLocaleString()}</div>
            <div className={styles.mttrSub}>New issues in {OBS_WINDOWS[params.window].label.toLowerCase()}</div>
          </div>
        </section>
      </div>

      {/* ── Issue list ─────────────────────────────────────────────────── */}
      <section className={kit.section}>
        <h2 className={kit.sectionTitle}>Issues</h2>

        <div className={kit.callout}>
          <span>
            <strong>What is an issue?</strong>{' '}
            Each row is one distinct error fingerprint — a flood of identical failures collapses into a single triable issue. This dashboard shows this environment&apos;s errors (production on the live site, dev on the dev site). Use the filters to narrow by severity, status, route, or org. Click an issue to read scrubbed samples and resolve / ignore / snooze it.
          </span>
        </div>

        <div className={kit.card}>
          <IssuesFilterBar
            windowKey={params.window}
            severity={params.severity}
            status={params.status}
            route={params.route}
            org={params.org}
            q={params.q}
            severityOptions={SEVERITY_OPTIONS}
            statusOptions={STATUS_OPTIONS}
            hasFilters={hasFilters}
          >
            <IssuesExportClient
              filters={{ severity: params.severity, status: params.status, route: params.route, org: params.org, q: params.q }}
              disabled={issues.rows.length === 0}
            />
          </IssuesFilterBar>

          <div className={`${kit.tableWrap} table-cards`}>
            <table>
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Issue</th>
                  <th>Route</th>
                  <th className={kit.num}>Count</th>
                  <th className={kit.num}>Orgs</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody className={kit.comfortable}>
                {issues.rows.length === 0 && (
                  <tr><td colSpan={7} className={kit.empty}>No issues match these filters.</td></tr>
                )}
                {issues.rows.map(row => (
                  <tr key={row.id}>
                    <td data-label="Severity"><span className={`${kit.chip} ${severityChip(row.severity)}`}>{cap(row.severity)}</span></td>
                    <td data-label="Status">
                      <span className={`${kit.chip} ${issueStatusChip(row.status)}`}>{cap(row.status)}</span>
                      {row.snoozeExpired && <>{' '}<span className={`${kit.chip} ${kit.chipWarn}`}>Expired</span></>}
                    </td>
                    <td className={`table-cards-title ${styles.issueCell}`}>
                      <Link href={`/platform-admin/observability/${row.id}`} className={kit.nameLink}>
                        {row.title || row.errorName || 'Untitled error'}
                      </Link>
                      {row.errorName && row.title && <span className={`${kit.sub} ${kit.code}`}>{row.errorName}</span>}
                    </td>
                    <td data-label="Route" className={styles.routeCell} title={row.route ?? undefined}>
                      <span className={kit.code}>{row.httpMethod ? `${row.httpMethod} ` : ''}{row.route || '—'}</span>
                    </td>
                    <td data-label="Count" className={kit.num}>{row.occurrenceCount.toLocaleString()}</td>
                    <td data-label="Orgs" className={kit.num}>{row.distinctOrgCount.toLocaleString()}</td>
                    <td data-label="Last seen" className={kit.nowrap}>{fmtDateTime(row.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={kit.foot}>
            <span className={kit.countQuiet}>
              {issues.rows.length} shown{params.offset > 0 ? ` · from #${params.offset + 1}` : ''}
            </span>
            {(issues.hasPrev || issues.hasNext) && (
              <span className={kit.toolbarEnd}>
                <span className={kit.countQuiet}>Showing {params.offset + 1}–{params.offset + issues.rows.length}</span>
                {issues.hasPrev
                  ? <Link href={buildHref(params, { offset: Math.max(0, params.offset - ISSUES_PAGE_SIZE) })} className="btn btn-secondary btn-sm">Previous</Link>
                  : <button type="button" className="btn btn-secondary btn-sm" disabled>Previous</button>}
                {issues.hasNext
                  ? <Link href={buildHref(params, { offset: params.offset + ISSUES_PAGE_SIZE })} className="btn btn-secondary btn-sm">Next</Link>
                  : <button type="button" className="btn btn-secondary btn-sm" disabled>Next</button>}
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
