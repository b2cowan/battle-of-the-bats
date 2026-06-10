import Link from 'next/link';
import {
  AlertOctagon, Activity, FolderOpen, Building2, Clock, Sparkles, Route as RouteIcon, Hash, MonitorSmartphone,
} from 'lucide-react';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import HelpCallout from '@/components/help/HelpCallout';
import MetricCard from '@/components/platform-admin/MetricCard';
import {
  getDashboardData, getCronFreshness, getErrorGroups,
  normalizeEnv, normalizeWindow, OBS_WINDOWS, ISSUES_PAGE_SIZE,
  type ObsEnv, type ObsWindowKey,
} from '@/lib/observability/dashboard';
import CallsVsErrorsChart from './CallsVsErrorsChart';
import IssuesExportClient from './IssuesExportClient';
import styles from './observability.module.css';

export const dynamic = 'force-dynamic';

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'badge-danger',
  error: 'badge-danger',
  warning: 'badge-warning',
  info: 'badge-info',
};
const STATUS_BADGE: Record<string, string> = {
  open: 'badge-warning',
  resolved: 'badge-success',
  ignored: 'badge-neutral',
  snoozed: 'badge-info',
};

const SEVERITY_OPTIONS = ['critical', 'error', 'warning', 'info'];
const STATUS_OPTIONS = ['open', 'resolved', 'ignored', 'snoozed'];

interface SearchParamsShape {
  env?: string;
  window?: string;
  severity?: string;
  status?: string;
  route?: string;
  org?: string;
  q?: string;
  offset?: string;
}

interface ResolvedParams {
  env: ObsEnv;
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
  if (next.env !== 'production') sp.set('env', next.env);
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

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-CA', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function fmtMttr(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function BreakdownBars({ rows, max, fmtLabel }: { rows: { label: string; count: number }[]; max: number; fmtLabel?: (s: string) => string }) {
  if (rows.length === 0) return <p className={styles.emptyPanel}>No data in this window.</p>;
  return (
    <div className={styles.barList}>
      {rows.map(r => (
        <div key={r.label} className={styles.barRow}>
          <div className={styles.barMeta}>
            <span>{fmtLabel ? fmtLabel(r.label) : r.label}</span>
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
    env: normalizeEnv(sp.env),
    window: normalizeWindow(sp.window),
    severity: SEVERITY_OPTIONS.includes(sp.severity ?? '') ? sp.severity! : '',
    status: STATUS_OPTIONS.includes(sp.status ?? '') ? sp.status! : '',
    route: (sp.route ?? '').slice(0, 120),
    org: (sp.org ?? '').slice(0, 120),
    q: (sp.q ?? '').slice(0, 120),
    offset: Math.max(0, parseInt(sp.offset ?? '0', 10) || 0),
  };

  const [data, freshness, issues] = await Promise.all([
    getDashboardData(params.env, params.window),
    getCronFreshness(),
    getErrorGroups(params),
  ]);

  // Freshness chip — most-recent cron run, or "not yet enabled" before Phase 4.
  const mostRecent = freshness.rows
    .filter(r => r.minutesAgo !== null)
    .sort((a, b) => (a.minutesAgo ?? Infinity) - (b.minutesAgo ?? Infinity))[0];
  const freshnessEnabled = freshness.enabled && !!mostRecent;
  const freshnessStale = freshnessEnabled && (mostRecent.minutesAgo ?? 0) > 15;

  const routeMax = Math.max(...data.byRoute.map(r => r.count), 1);
  const sourceMax = Math.max(...data.bySource.map(r => r.count), 1);
  const hasFilters = !!(params.severity || params.status || params.route || params.org || params.q);

  return (
    <div className={styles.page}>
      {/* ── Header + toolbar ───────────────────────────────────────────── */}
      <header className={styles.header}>
        <div>
          <div className={styles.headerLabel}>System</div>
          <h1 className={styles.title}>Observability</h1>
        </div>
        <div className={styles.toolbar}>
          <div className={styles.segmented} role="group" aria-label="Environment">
            {(['production', 'dev'] as ObsEnv[]).map(e => (
              <Link
                key={e}
                href={buildHref(params, { env: e, offset: 0 })}
                className={`${styles.segLink} ${params.env === e ? styles.segActive : ''}`}
              >
                {e === 'production' ? 'Production' : 'Dev'}
              </Link>
            ))}
          </div>
          <div className={styles.segmented} role="group" aria-label="Time window">
            {(Object.keys(OBS_WINDOWS) as ObsWindowKey[]).map(wk => (
              <Link
                key={wk}
                href={buildHref(params, { window: wk, offset: 0 })}
                className={`${styles.segLink} ${params.window === wk ? styles.segActive : ''}`}
              >
                {OBS_WINDOWS[wk].label}
              </Link>
            ))}
          </div>
          <span
            className={`${styles.freshnessChip} ${freshnessStale ? styles.freshnessStale : ''} ${!freshnessEnabled ? styles.freshnessOff : ''}`}
            title={freshnessEnabled ? `Rollup job last ran ${mostRecent.minutesAgo} min ago` : 'The pg_cron rollup job ships in Phase 4'}
          >
            <span className={styles.freshnessDot} />
            {freshnessEnabled
              ? `Last rollup ${mostRecent.minutesAgo}m ago`
              : 'Rollup not yet enabled (Phase 4)'}
          </span>
        </div>
      </header>

      {/* ── Metric cards ───────────────────────────────────────────────── */}
      <section className={styles.metricGrid} aria-label="Headline metrics">
        <MetricCard label={`Errors · ${OBS_WINDOWS[params.window].label}`} value={data.totalErrors} Icon={AlertOctagon} />
        <MetricCard
          label="Error rate"
          value={data.errorRatePct === null ? '—' : `${data.errorRatePct.toFixed(2)}%`}
          sub="instrumented routes"
          Icon={Activity}
        />
        <MetricCard label="Open issues" value={data.openIssues} sub={`${data.newIssues} new in window`} Icon={FolderOpen} />
        <MetricCard label="Affected orgs" value={data.affectedOrgs} sub={data.eventsCapped ? 'in window · sampled' : 'in this window'} Icon={Building2} />
      </section>

      <p className={styles.coverageNote}>
        The calls-vs-errors chart and error rate are computed from instrumented (wrapped) routes only; issue counts and the
        breakdowns below come from global error capture, so the issue list is more complete than the chart. Open issues
        include snoozed issues whose snooze has expired.
        {data.eventsCapped && ' The breakdowns and the Affected-orgs count reflect only the most recent 5,000 events in this window.'}
      </p>

      {/* ── Calls vs errors chart ──────────────────────────────────────── */}
      <section className={`${styles.panel} ${styles.panelWide}`} style={{ marginBottom: '1.25rem' }}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Calls vs. Errors</h2>
          <span className={styles.panelHint}>
            {data.totalCalls.toLocaleString()} calls · {data.totalErrorsMetric.toLocaleString()} errors (instrumented)
          </span>
        </div>
        {data.totalCalls === 0 && data.totalErrorsMetric === 0 ? (
          <p className={styles.emptyPanel}>
            No instrumented request metrics in this window yet. Metrics accrue from routes wrapped with{' '}
            <code>withObservability</code>; coverage expands in later phases.
          </p>
        ) : (
          <CallsVsErrorsChart data={data.series} />
        )}
      </section>

      {/* ── §6 breakdown panels ────────────────────────────────────────── */}
      <section className={styles.panelsGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}><RouteIcon size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />Top error routes</h2>
          </div>
          <BreakdownBars rows={data.byRoute.map(r => ({ label: r.route, count: r.count }))} max={routeMax} />
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}><Hash size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />Status codes</h2>
          </div>
          {data.byStatusCode.length === 0 ? (
            <p className={styles.emptyPanel}>No data in this window.</p>
          ) : (
            <div className={styles.codeGrid}>
              {data.byStatusCode.map(c => (
                <div key={c.code} className={styles.codeTile}>
                  <strong>{c.count.toLocaleString()}</strong>
                  <span>{c.code}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}><MonitorSmartphone size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />Client vs. server</h2>
          </div>
          <BreakdownBars
            rows={data.bySource.map(r => ({ label: r.source, count: r.count }))}
            max={sourceMax}
            fmtLabel={s => (s === 'client' ? 'Client' : s === 'server' ? 'Server' : s)}
          />
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}><Clock size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />Triage health</h2>
          </div>
          <div className={styles.mttrValue}>{fmtMttr(data.mttrHours)}</div>
          <div className={styles.mttrSub}>Mean time to resolve · all-time (resolved issues)</div>
          <div className={styles.mttrValue} style={{ marginTop: '0.9rem' }}>{data.newIssues.toLocaleString()}</div>
          <div className={styles.mttrSub}>New issues in {OBS_WINDOWS[params.window].label.toLowerCase()}</div>
        </div>
      </section>

      {/* ── Issue list ─────────────────────────────────────────────────── */}
      <div className={styles.sectionHead}>
        <Sparkles size={15} style={{ color: 'var(--logic-lime)' }} />
        <span className={styles.sectionKicker}>Triage</span>
        <h2 className={styles.sectionTitle}>Issues</h2>
        <span className={styles.count}>
          {issues.rows.length} shown{params.offset > 0 ? ` · from #${params.offset + 1}` : ''}
        </span>
      </div>

      <HelpCallout
        variant="info"
        title="What is an issue?"
        body="Each row is one distinct error fingerprint — a flood of identical failures collapses into a single triable issue. Use the filters to narrow by severity, status, environment, route, or org. Click an issue to read scrubbed samples and resolve / ignore / snooze it."
      />

      <form method="GET" action="/platform-admin/observability" className={styles.filterBar}>
        {/* Preserve env + window across a filter submit */}
        {params.env !== 'production' && <input type="hidden" name="env" value={params.env} />}
        {params.window !== '24h' && <input type="hidden" name="window" value={params.window} />}
        <input type="search" name="q" defaultValue={params.q} placeholder="Search title / error / route…" className={styles.filterInput} />
        <select name="severity" defaultValue={params.severity} className={styles.filterSelect} aria-label="Severity">
          <option value="">All severities</option>
          {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select name="status" defaultValue={params.status} className={styles.filterSelect} aria-label="Status">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="text" name="route" defaultValue={params.route} placeholder="Route…" className={styles.filterInput} style={{ maxWidth: 160 }} />
        <input type="text" name="org" defaultValue={params.org} placeholder="Org slug…" className={styles.filterInput} style={{ maxWidth: 140 }} />
        <button type="submit" className={styles.filterBtn}>Filter</button>
        <IssuesExportClient
          filters={{ env: params.env, severity: params.severity, status: params.status, route: params.route, org: params.org, q: params.q }}
          disabled={issues.rows.length === 0}
        />
        {hasFilters && <Link href={buildHref({ ...params, severity: '', status: '', route: '', org: '', q: '', offset: 0 })} className={styles.filterClear}>Clear</Link>}
      </form>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Severity</th>
              <th>Status</th>
              <th>Issue</th>
              <th>Route</th>
              <th style={{ textAlign: 'right' }}>Count</th>
              <th style={{ textAlign: 'right' }}>Orgs</th>
              <th>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {issues.rows.length === 0 && (
              <tr><td colSpan={7} className={styles.emptyCell}>No issues match these filters.</td></tr>
            )}
            {issues.rows.map(row => (
              <tr key={row.id} className={styles.rowLink}>
                <td><span className={`badge ${SEVERITY_BADGE[row.severity] ?? 'badge-neutral'}`}>{row.severity}</span></td>
                <td>
                  <span className={`badge ${STATUS_BADGE[row.status] ?? 'badge-neutral'}`}>{row.status}</span>
                  {row.snoozeExpired && <span className={styles.expiredTag}>expired</span>}
                </td>
                <td>
                  <Link href={`/platform-admin/observability/${row.id}`} className={styles.issueTitle}>
                    {row.title || row.errorName || 'Untitled error'}
                  </Link>
                  {row.errorName && row.title && <span className={styles.issueName}>{row.errorName}</span>}
                </td>
                <td className={styles.routeCell}>{row.httpMethod ? `${row.httpMethod} ` : ''}{row.route || '—'}</td>
                <td className={styles.numCell}>{row.occurrenceCount.toLocaleString()}</td>
                <td className={styles.numCell}>{row.distinctOrgCount.toLocaleString()}</td>
                <td className={styles.tsCell}>{fmtDateTime(row.lastSeenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(issues.hasPrev || issues.hasNext) && (
        <div className={styles.pagination}>
          {issues.hasPrev
            ? <Link href={buildHref(params, { offset: Math.max(0, params.offset - ISSUES_PAGE_SIZE) })} className={styles.pageBtn}>Previous</Link>
            : <span className={styles.pageBtnDisabled}>Previous</span>}
          <span className={styles.pageInfo}>Showing {params.offset + 1}–{params.offset + issues.rows.length}</span>
          {issues.hasNext
            ? <Link href={buildHref(params, { offset: params.offset + ISSUES_PAGE_SIZE })} className={styles.pageBtn}>Next</Link>
            : <span className={styles.pageBtnDisabled}>Next</span>}
        </div>
      )}
    </div>
  );
}
