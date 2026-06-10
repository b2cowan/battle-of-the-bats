// Server-only read helpers for the platform-admin Observability dashboard (Phase 2).
//
// All reads go through supabaseAdmin (service_role) because the observability tables
// have RLS ENABLED with no policies — anon/authenticated resolve to zero rows. Never
// import this module from a client component; it is consumed only by the server pages
// under app/platform-admin/observability/*. It is intentionally NOT re-exported from
// lib/observability/index.ts (the capture barrel) so it never reaches a client bundle.
//
// Coverage note: the calls-vs-errors chart + error-rate come from request_metrics_*
// (instrumented/wrapped routes only). Issue counts + the §6 breakdowns come from
// error_groups/error_events (global capture via instrumentation.ts onRequestError), so
// the issue list is more complete than the chart. The dashboard surfaces this caveat.

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-admin';

export type ObsEnv = 'production' | 'dev';
export type ObsSeverity = 'critical' | 'error' | 'warning' | 'info';
export type ObsStatus = 'open' | 'resolved' | 'ignored' | 'snoozed';

export const OBS_WINDOWS = {
  '24h': { label: 'Last 24h', ms: 24 * 3_600_000, bucketMs: 3_600_000 },       // 24 hourly buckets
  '7d':  { label: 'Last 7d',  ms: 7 * 86_400_000, bucketMs: 6 * 3_600_000 },    // 28 six-hour buckets
  '30d': { label: 'Last 30d', ms: 30 * 86_400_000, bucketMs: 86_400_000 },      // 30 daily buckets
} as const;
export type ObsWindowKey = keyof typeof OBS_WINDOWS;

export const ISSUES_PAGE_SIZE = 50;
const EVENTS_CAP = 5000; // breakdowns aggregate at most this many recent events in-window

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

export function normalizeEnv(v: string | undefined): ObsEnv {
  return v === 'dev' ? 'dev' : 'production';
}
export function normalizeWindow(v: string | undefined): ObsWindowKey {
  return v === '7d' || v === '30d' ? v : '24h';
}

/** Strip characters that would break a PostgREST ilike / or() filter, then bound length. */
function safeLike(v: string | undefined): string {
  return (v ?? '').replace(/[,()%*\\]/g, ' ').trim().slice(0, 120);
}

function bucketLabel(t: number, windowKey: ObsWindowKey): string {
  const d = new Date(t);
  if (windowKey === '24h') {
    return d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (windowKey === '7d') {
    return (
      d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) +
      ' ' +
      d.toLocaleTimeString('en-CA', { hour: '2-digit', hour12: false }).replace(/:.*/, 'h')
    );
  }
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

export interface ChartPoint {
  t: number;
  label: string;
  calls: number;
  errors: number;
}

export interface DashboardData {
  series: ChartPoint[];
  totalCalls: number;          // instrumented-route call tally (metrics)
  totalErrorsMetric: number;   // instrumented-route error tally (metrics) — chart error line total
  totalErrors: number;         // exact error_events count in window (global)
  errorRatePct: number | null; // metrics errors / metrics calls; null when no calls recorded
  openIssues: number;
  affectedOrgs: number;
  newIssues: number;
  byRoute: { route: string; count: number }[];
  byStatusCode: { code: string; count: number }[];
  bySource: { source: string; count: number }[];
  mttrHours: number | null;
  eventsCapped: boolean;       // true when breakdowns were computed over a capped event set
}

export async function getDashboardData(env: ObsEnv, windowKey: ObsWindowKey): Promise<DashboardData> {
  const w = OBS_WINDOWS[windowKey];
  const now = Date.now();
  const startMs = now - w.ms;
  const startIso = new Date(startMs).toISOString();
  const nowIso = new Date(now).toISOString();
  const nBuckets = Math.max(1, Math.ceil(w.ms / w.bucketMs));

  const buckets: ChartPoint[] = [];
  for (let i = 0; i < nBuckets; i++) {
    const t = startMs + i * w.bucketMs;
    buckets.push({ t, label: bucketLabel(t, windowKey), calls: 0, errors: 0 });
  }
  function addToBucket(timeMs: number, calls: number, errors: number) {
    const idx = Math.floor((timeMs - startMs) / w.bucketMs);
    if (idx < 0 || idx >= nBuckets) return;
    buckets[idx].calls += calls;
    buckets[idx].errors += errors;
  }

  const [rollupRes, rawRes, eventsRes, totalErrRes, openRes, snoozedExpiredRes, newRes, resolvedRes] = await Promise.all([
    supabaseAdmin
      .from('request_metrics_rollup')
      .select('bucket_start, call_count, error_count')
      .eq('env', env)
      .gte('bucket_start', startIso)
      .limit(20000),
    supabaseAdmin
      .from('request_metrics_raw')
      .select('flushed_at, call_count, error_count')
      .eq('env', env)
      .gte('flushed_at', startIso)
      .limit(20000),
    supabaseAdmin
      .from('error_events')
      .select('occurred_at, route, status_code, source, org_id')
      .eq('env', env)
      .gte('occurred_at', startIso)
      .order('occurred_at', { ascending: false })
      .limit(EVENTS_CAP),
    supabaseAdmin
      .from('error_events')
      .select('id', { count: 'exact', head: true })
      .eq('env', env)
      .gte('occurred_at', startIso),
    supabaseAdmin
      .from('error_groups')
      .select('id', { count: 'exact', head: true })
      .eq('env', env)
      .eq('status', 'open'),
    // Expired snoozes count as "open" again — nothing auto-reopens them until Phase 4 cron.
    supabaseAdmin
      .from('error_groups')
      .select('id', { count: 'exact', head: true })
      .eq('env', env)
      .eq('status', 'snoozed')
      .lt('snooze_until', nowIso),
    supabaseAdmin
      .from('error_groups')
      .select('id', { count: 'exact', head: true })
      .eq('env', env)
      .gte('first_seen_at', startIso),
    supabaseAdmin
      .from('error_groups')
      .select('first_seen_at, resolved_at')
      .eq('env', env)
      .eq('status', 'resolved')
      .not('resolved_at', 'is', null)
      .order('resolved_at', { ascending: false })
      .limit(2000),
  ]);

  let totalCalls = 0;
  let totalErrorsMetric = 0;
  for (const r of rollupRes.data ?? []) {
    const c = Number(r.call_count) || 0;
    const e = Number(r.error_count) || 0;
    totalCalls += c;
    totalErrorsMetric += e;
    addToBucket(new Date(r.bucket_start as string).getTime(), c, e);
  }
  for (const r of rawRes.data ?? []) {
    const c = Number(r.call_count) || 0;
    const e = Number(r.error_count) || 0;
    totalCalls += c;
    totalErrorsMetric += e;
    addToBucket(new Date(r.flushed_at as string).getTime(), c, e);
  }

  const events = eventsRes.data ?? [];
  const eventsCapped = events.length >= EVENTS_CAP;
  const routeMap = new Map<string, number>();
  const codeMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();
  const orgSet = new Set<string>();
  for (const e of events) {
    const route = (e.route as string | null) || '(unknown)';
    routeMap.set(route, (routeMap.get(route) ?? 0) + 1);
    const code = e.status_code != null ? String(e.status_code) : '—';
    codeMap.set(code, (codeMap.get(code) ?? 0) + 1);
    const src = (e.source as string | null) || 'server';
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
    if (e.org_id) orgSet.add(e.org_id as string);
  }

  const byRoute = [...routeMap.entries()]
    .map(([route, count]) => ({ route, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const byStatusCode = [...codeMap.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);
  const bySource = [...sourceMap.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  let mttrHours: number | null = null;
  const resolved = resolvedRes.data ?? [];
  if (resolved.length > 0) {
    let sum = 0;
    let n = 0;
    for (const g of resolved) {
      const f = new Date(g.first_seen_at as string).getTime();
      const r = new Date(g.resolved_at as string).getTime();
      if (Number.isFinite(f) && Number.isFinite(r) && r >= f) {
        sum += r - f;
        n++;
      }
    }
    if (n > 0) mttrHours = sum / n / 3_600_000;
  }

  return {
    series: buckets,
    totalCalls,
    totalErrorsMetric,
    totalErrors: totalErrRes.count ?? 0,
    errorRatePct: totalCalls > 0 ? (totalErrorsMetric / totalCalls) * 100 : null,
    openIssues: (openRes.count ?? 0) + (snoozedExpiredRes.count ?? 0),
    affectedOrgs: orgSet.size,
    newIssues: newRes.count ?? 0,
    byRoute,
    byStatusCode,
    bySource,
    mttrHours,
    eventsCapped,
  };
}

export interface CronFreshness {
  rows: { jobName: string; lastRunAt: string | null; status: string | null; minutesAgo: number | null }[];
  enabled: boolean;
}

export async function getCronFreshness(): Promise<CronFreshness> {
  const { data } = await supabaseAdmin
    .from('observability_cron_heartbeat')
    .select('job_name, last_run_at, status')
    .order('job_name');
  const rows = (data ?? []).map(r => {
    const lastRunAt = (r.last_run_at as string | null) ?? null;
    const minutesAgo = lastRunAt ? Math.max(0, Math.round((Date.now() - new Date(lastRunAt).getTime()) / 60000)) : null;
    return { jobName: r.job_name as string, lastRunAt, status: (r.status as string | null) ?? null, minutesAgo };
  });
  return { rows, enabled: rows.length > 0 };
}

export interface IssueRow {
  id: string;
  fingerprint: string;
  title: string | null;
  errorName: string | null;
  route: string | null;
  httpMethod: string | null;
  severity: ObsSeverity;
  status: ObsStatus;
  occurrenceCount: number;
  distinctOrgCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  snoozeUntil: string | null;
  snoozeExpired: boolean;
}

export interface IssueFilters {
  env: ObsEnv;
  severity: string;
  status: string;
  route: string;
  org: string;
  q: string;
  offset: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapIssueRow(r: any): IssueRow {
  return {
    id: r.id as string,
    fingerprint: r.fingerprint as string,
    title: (r.title as string | null) ?? null,
    errorName: (r.error_name as string | null) ?? null,
    route: (r.route as string | null) ?? null,
    httpMethod: (r.http_method as string | null) ?? null,
    severity: (r.severity as ObsSeverity) ?? 'error',
    status: (r.status as ObsStatus) ?? 'open',
    occurrenceCount: Number(r.occurrence_count) || 0,
    distinctOrgCount: Number(r.distinct_org_count) || 0,
    firstSeenAt: r.first_seen_at as string,
    lastSeenAt: r.last_seen_at as string,
    snoozeUntil: (r.snooze_until as string | null) ?? null,
    snoozeExpired:
      (r.status as ObsStatus) === 'snoozed' &&
      !!r.snooze_until &&
      new Date(r.snooze_until as string).getTime() < Date.now(),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const ISSUE_SELECT =
  'id, fingerprint, title, error_name, route, http_method, severity, status, occurrence_count, distinct_org_count, first_seen_at, last_seen_at, snooze_until';
const EXPORT_CAP = 5000;

export async function getErrorGroups(
  f: IssueFilters,
): Promise<{ rows: IssueRow[]; hasNext: boolean; hasPrev: boolean }> {
  // Org filter: error_groups has no org_id (it lives on events). Resolve the org slug
  // to the set of group_ids that have an event for it, then constrain the group query.
  let groupIdFilter: string[] | null = null;
  const org = safeLike(f.org);
  if (org) {
    const { data } = await supabaseAdmin
      .from('error_events')
      .select('group_id')
      .eq('env', f.env)
      .ilike('org_slug', `%${org}%`)
      .limit(5000);
    groupIdFilter = [...new Set((data ?? []).map(r => r.group_id as string))];
    if (groupIdFilter.length === 0) return { rows: [], hasNext: false, hasPrev: f.offset > 0 };
  }

  let q = supabaseAdmin
    .from('error_groups')
    .select(ISSUE_SELECT)
    .eq('env', f.env)
    .order('last_seen_at', { ascending: false })
    .range(f.offset, f.offset + ISSUES_PAGE_SIZE - 1);

  if (f.severity) q = q.eq('severity', f.severity);
  if (f.status) q = q.eq('status', f.status);
  const route = safeLike(f.route);
  if (route) q = q.ilike('route', `%${route}%`);
  if (groupIdFilter) q = q.in('id', groupIdFilter);
  const search = safeLike(f.q);
  if (search) q = q.or(`title.ilike.%${search}%,error_name.ilike.%${search}%,route.ilike.%${search}%`);

  const { data, error } = await q;
  if (error || !data) return { rows: [], hasNext: false, hasPrev: f.offset > 0 };
  const rows = data.map(mapIssueRow);
  return { rows, hasNext: rows.length === ISSUES_PAGE_SIZE, hasPrev: f.offset > 0 };
}

/**
 * The full filtered issue set (not just one page) for CSV/XLSX export, capped at
 * EXPORT_CAP. Mirrors getErrorGroups' filters but without pagination — used by the
 * server export route so the download is the whole filtered list, not the page.
 */
export async function getErrorGroupsForExport(f: IssueFilters, cap = EXPORT_CAP): Promise<IssueRow[]> {
  let groupIdFilter: string[] | null = null;
  const org = safeLike(f.org);
  if (org) {
    const { data } = await supabaseAdmin
      .from('error_events')
      .select('group_id')
      .eq('env', f.env)
      .ilike('org_slug', `%${org}%`)
      .limit(5000);
    groupIdFilter = [...new Set((data ?? []).map(r => r.group_id as string))];
    if (groupIdFilter.length === 0) return [];
  }

  let q = supabaseAdmin
    .from('error_groups')
    .select(ISSUE_SELECT)
    .eq('env', f.env)
    .order('last_seen_at', { ascending: false })
    .limit(cap);

  if (f.severity) q = q.eq('severity', f.severity);
  if (f.status) q = q.eq('status', f.status);
  const route = safeLike(f.route);
  if (route) q = q.ilike('route', `%${route}%`);
  if (groupIdFilter) q = q.in('id', groupIdFilter);
  const search = safeLike(f.q);
  if (search) q = q.or(`title.ilike.%${search}%,error_name.ilike.%${search}%,route.ilike.%${search}%`);

  const { data, error } = await q;
  if (error || !data) return [];
  return data.map(mapIssueRow);
}

export interface IssueGroupFull {
  id: string;
  fingerprint: string;
  title: string | null;
  error_name: string | null;
  route: string | null;
  http_method: string | null;
  severity: ObsSeverity;
  status: ObsStatus;
  env: string;
  first_seen_at: string;
  last_seen_at: string;
  occurrence_count: number;
  distinct_org_count: number;
  resolved_at: string | null;
  resolved_by: string | null;
  snooze_until: string | null;
  sample_stack: string | null;
  sample_context: unknown;
}

export interface EventSample {
  id: string;
  occurred_at: string;
  route: string | null;
  http_method: string | null;
  status_code: number | null;
  source: string | null;
  org_slug: string | null;
  user_role: string | null;
  user_email: string | null;
  request_id: string | null;
  error_message: string | null;
  stack_trace: string | null;
  request_context: unknown;
}

export interface IssueDetail {
  group: IssueGroupFull;
  events: EventSample[];
  daily: { day: string; label: string; count: number }[];
  snoozeExpired: boolean;
}

export async function getErrorGroupDetail(groupId: string): Promise<IssueDetail | null> {
  if (!isUuid(groupId)) return null;

  const { data: group } = await supabaseAdmin
    .from('error_groups')
    .select('*')
    .eq('id', groupId)
    .maybeSingle();
  if (!group) return null;

  const days = 14;
  const sinceMs = Date.now() - days * 86_400_000;
  const sinceIso = new Date(sinceMs).toISOString();

  const [eventsRes, dailyRes] = await Promise.all([
    supabaseAdmin
      .from('error_events')
      .select(
        'id, occurred_at, route, http_method, status_code, source, org_slug, user_role, user_email, request_id, error_message, stack_trace, request_context',
      )
      .eq('group_id', groupId)
      .order('occurred_at', { ascending: false })
      .limit(25),
    supabaseAdmin
      .from('error_events')
      .select('occurred_at')
      .eq('group_id', groupId)
      .gte('occurred_at', sinceIso)
      .limit(5000),
  ]);

  // Per-day occurrence sparkline over the trailing `days` window (from sampled events).
  const dayMs = 86_400_000;
  const todayStart = Math.floor(Date.now() / dayMs) * dayMs;
  const counts = new Array<number>(days).fill(0);
  for (const r of dailyRes.data ?? []) {
    const t = new Date(r.occurred_at as string).getTime();
    // Bucket by the event's own day-start so "today" lands at the last index (no off-by-one).
    const evtDayStart = Math.floor(t / dayMs) * dayMs;
    const idx = days - 1 - Math.round((todayStart - evtDayStart) / dayMs);
    if (idx >= 0 && idx < days) counts[idx]++;
  }
  const daily = counts.map((count, i) => {
    const dayStart = todayStart - (days - 1 - i) * dayMs;
    return {
      day: new Date(dayStart).toISOString().slice(0, 10),
      label: new Date(dayStart).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }),
      count,
    };
  });

  const g = group as unknown as IssueGroupFull;
  const snoozeExpired =
    g.status === 'snoozed' && !!g.snooze_until && new Date(g.snooze_until).getTime() < Date.now();

  return {
    group: g,
    events: (eventsRes.data ?? []) as unknown as EventSample[],
    daily,
    snoozeExpired,
  };
}
