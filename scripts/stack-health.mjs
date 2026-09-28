/**
 * stack-health.mjs — the morning stack health check: a part-time devops team and DBA
 * (owner, 2026-09-26: "safety nets that can run checks to make sure that our processes are as
 * efficient as possible … without taking up a lot of time or resources").
 * Plan: docs/projects/active/STACK_HEALTH_CHECK_PLAN.md.
 *
 *   npm run health                        report on yesterday (UTC); read-only, no history, no alerts
 *   npm run health -- --scheduled         the 7:30 a.m. task (scripts/stack-health-schedule.ps1):
 *                                         also records .health/ history, and on red shows a desktop
 *                                         notification + emails; Mondays, a digest (the heartbeat)
 *   npm run health -- --day=2026-09-21    replay a past day (log-based checks only; the live
 *                                         checks — vitals, heaviest queries, advisors, drift,
 *                                         builds — describe NOW and are skipped)
 *   --health-dir=<dir>   keep history somewhere else (tests)    --record   write history anyway
 *   --no-email           never email          --email-test / --notify-test   one test alert
 *
 * Email needs HEALTH_RESEND_API_KEY in .env.local: a Resend key with sending access, used ONLY by
 * this check. Never the product's RESEND_API_KEY, which would make the dev app email real people.
 * Without it, the desktop notification is the alert.
 *
 * Cost per run: about 0.2 s of database work per project (one vitals read, one pg_stat_statements
 * read); everything else reads Supabase's log and advisor services, AWS Amplify, git and local
 * files. Read-only everywhere; the only writes are .health/ and the email.
 *
 * Every check returns ✅ green / 🟡 amber / 🔴 red / ❔ unknown with one line of detail, and a
 * "what to do" for anything not green. Anomalies are judged against the median of the last 7
 * recorded days (3 or more needed); until then, only absolute limits apply. Thresholds: LIMITS below.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import https from 'https';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { sql, logs, advisors } from './lib/supabase-ops.mjs';
import { automationChanges } from './check-agent-automation.mjs';
import { buildDashboard } from './stack-health-dashboard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENVS = ['dev', 'prod'];

// ── thresholds (one place) ─────────────────────────────────────────────────────────────────────
const LIMITS = {
  slowStatementsRed: 10, slowSecondsRed: 300, slowStatementsAmber: 3,
  queryTimePerDayRed: 1800,        // one query using >30 min of DB time per day (the incident: 11,643 s)
  queryTimePerDayAmber: 600,       // …and newly in the top 3
  connectionsRedPct: 80, connectionsAmberPct: 60,
  slotLagRedBytes: 1024 ** 3, slotLagAmberBytes: 100 * 1024 ** 2,
  httpQueueAmber: 1000,
  bloatRatio: 0.2, bloatMinDead: 10_000,
  cacheHitAmberPct: 99,
  dbGrowthAmberPct: 20,
  trafficAmberX: 3, trafficAmberMin: 50_000, trafficRedX: 5, trafficRedMin: 200_000,
  prod5xxRedPct: 1, prod5xxRedMin: 20, dev5xxAmber: 100,
  realtimeErrorsAmber: 100,
  pgErrorsProdAmber: 50,
  p95AmberX: 2,
  hookErrorsRed: 20,
  buildSlowX: 1.5,
  anomalyX: 3, historyDays: 7, historyMin: 3,
};

// ── args ───────────────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const SCHEDULED = flag('--scheduled');
const REPLAY_DAY = opt('day');
const DAY = REPLAY_DAY ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const REPLAY = Boolean(REPLAY_DAY);
const HEALTH_DIR = path.resolve(opt('health-dir') ?? path.join(ROOT, '.health'));
const RECORD = SCHEDULED || flag('--record');
const EMAIL = (SCHEDULED && !flag('--no-email')) || flag('--email-test');
if (!/^\d{4}-\d{2}-\d{2}$/.test(DAY)) { console.error('--day must be YYYY-MM-DD'); process.exit(2); }

// ── history + state ────────────────────────────────────────────────────────────────────────────
const P = {
  history: path.join(HEALTH_DIR, 'history.jsonl'),
  state: path.join(HEALTH_DIR, 'state.json'),
  latest: path.join(HEALTH_DIR, 'latest.md'),
  reports: path.join(HEALTH_DIR, 'reports'),
};
const readJson = (p, dflt) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return dflt; } };
const history = (() => {
  try {
    return fs.readFileSync(P.history, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch { return []; }
})();
const state = readJson(P.state, {});
const dig = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
function median(metricPath) {
  const vals = history.filter((h) => h.day < DAY).slice(-LIMITS.historyDays)
    .map((h) => dig(h.metrics, metricPath)).filter((v) => typeof v === 'number');
  if (vals.length < LIMITS.historyMin) return null;
  const s = [...vals].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

// ── checks ─────────────────────────────────────────────────────────────────────────────────────
const checks = [];
const metrics = { dev: {}, prod: {} };
const nextState = structuredClone(state);
const ICON = { red: '🔴', amber: '🟡', green: '✅', unknown: '❔' };
const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-CA') : String(n));
function add(area, env, name, status, detail, todo) {
  checks.push({ area, env, name, status, detail, todo: status === 'green' ? undefined : todo });
}
function unknown(area, env, name, e) {
  add(area, env, name, 'unknown', `could not check (${String(e?.message ?? e).slice(0, 120)})`,
    'Usually a network or token problem; if it repeats, run `npm run health` by hand to see the error.');
}
const vsMedian = (value, metricPath) => {
  const m = median(metricPath);
  return { m, x: m ? value / m : null, note: m == null ? 'baseline still building' : `7-day median ${fmt(Math.round(m))}` };
};

// ── DBA: slow statements, realtime and Postgres errors (log service; replayable) ───────────────
const PG_SQL = `
  select count() as log_rows,
    countIf(event_message like 'duration:%') as slow,
    round(sumIf(toFloat64OrZero(extract(event_message, 'duration: ([0-9.]+) ms')), event_message like 'duration:%') / 1000, 0) as slow_s,
    countIf(event_message like 'invalid column for filter%') as realtime_filter_errors,
    countIf(log_attributes['parsed.error_severity'] in ('ERROR', 'FATAL', 'PANIC')) as pg_errors
  from logs where source = 'postgres_logs'`;
const SLOW_TOP_SQL = `
  select left(replaceRegexpAll(substring(event_message, position(event_message, 'Query Text:') + 11, 400), '[[:space:]]+', ' '), 90) as query,
    count() as n, round(sum(toFloat64OrZero(extract(event_message, 'duration: ([0-9.]+) ms'))) / 1000, 0) as total_s
  from logs where source = 'postgres_logs' and event_message like 'duration:%'
  group by query order by total_s desc limit 1`;

async function checkPostgresLogs(env) {
  const area = 'Database';
  try {
    const [r] = await logs(env, PG_SQL, DAY);
    const slow = Number(r?.slow ?? 0), slowS = Number(r?.slow_s ?? 0), rows = Number(r?.log_rows ?? 0);
    const rt = Number(r?.realtime_filter_errors ?? 0), pgErr = Number(r?.pg_errors ?? 0);
    Object.assign(metrics[env], { slow, slowS, realtimeErrors: rt, pgErrors: pgErr });
    if (rows === 0) {
      add(area, env, 'Slow queries', 'unknown', 'no Postgres log rows for the day (outside the log window?)', 'Re-run later; a day with no logs cannot be judged.');
    } else {
      let top = '';
      if (slow > 0) {
        const [t] = await logs(env, SLOW_TOP_SQL, DAY);
        if (t) top = ` Worst: ${String(t.query).trim()}… (${fmt(Number(t.n))}×, ${fmt(Number(t.total_s))} s)`;
      }
      const status = slow > LIMITS.slowStatementsRed || slowS > LIMITS.slowSecondsRed ? 'red' : slow >= LIMITS.slowStatementsAmber ? 'amber' : 'green';
      add(area, env, 'Slow queries', status, `${fmt(slow)} statement${slow === 1 ? '' : 's'} over 10 s (${fmt(slowS)} s).${top}`,
        'Find what runs the worst query (an agent hook, a sweep, a cron job) before it grows. See DB_SNAPSHOT_REFRESH_LOAD_PLAN.md for how the 09-25 incident was traced.');
    }
    const rtStatus = rt >= LIMITS.realtimeErrorsAmber ? 'amber' : 'green';
    add(area, env, 'Live-update errors', rtStatus, `${fmt(rt)} failed live-update subscriptions ("invalid column for filter")`,
      'A live-update subscription filters on a column its table does not have, and retries. Find the subscription.');
    const { m, x, note } = vsMedian(pgErr, `${env}.pgErrors`);
    const errStatus = (env === 'prod' && pgErr >= LIMITS.pgErrorsProdAmber) || (m && x >= LIMITS.anomalyX && pgErr >= 20) ? 'amber' : 'green';
    add(area, env, 'Database errors', errStatus, `${fmt(pgErr)} errors logged (${note})`, 'Read the day\'s Postgres errors in the Supabase logs and find the source.');
  } catch (e) { unknown(area, env, 'Slow queries', e); }
}

// ── DBA: vitals (one catalog read; live) ───────────────────────────────────────────────────────
const VITALS_SQL = `select
  (select count(*) from pg_stat_activity)::int as connections,
  current_setting('max_connections')::int as max_connections,
  (select count(*) from pg_stat_activity where state = 'active' and now() - query_start > interval '5 minutes' and backend_type = 'client backend')::int as long_running,
  (select count(*) from pg_stat_activity where state like 'idle in transaction%' and now() - state_change > interval '5 minutes')::int as idle_in_tx,
  (select sum(blks_hit) from pg_stat_database)::bigint as blks_hit,
  (select sum(blks_read) from pg_stat_database)::bigint as blks_read,
  pg_database_size(current_database())::bigint as db_bytes,
  (select coalesce(max(pg_wal_lsn_diff(pg_current_wal_lsn(), coalesce(confirmed_flush_lsn, restart_lsn))), 0) from pg_replication_slots)::bigint as slot_lag,
  (select count(*) from pg_replication_slots where not active)::int as inactive_slots,
  (select json_build_object('table', relname, 'dead', n_dead_tup, 'live', n_live_tup) from pg_stat_user_tables where n_dead_tup > 1000 order by n_dead_tup desc limit 1) as worst_bloat,
  (select count(*) from cron.job_run_details where start_time > now() - interval '24 hours' and status = 'failed')::int as cron_failed,
  (select string_agg(distinct j.jobname, ', ') from cron.job_run_details d join cron.job j on j.jobid = d.jobid where d.start_time > now() - interval '24 hours' and d.status = 'failed') as cron_failed_jobs,
  (select count(*) from net.http_request_queue)::int as http_queue
  /* stack-health */`;

async function checkVitals(env) {
  const area = 'Database';
  let v;
  try { [v] = await sql(env, VITALS_SQL); } catch (e) { return unknown(area, env, 'Vital signs', e); }
  const pct = Math.round((100 * v.connections) / v.max_connections);
  Object.assign(metrics[env], { connections: v.connections, dbBytes: Number(v.db_bytes) });
  add(area, env, 'Connections', pct >= LIMITS.connectionsRedPct ? 'red' : pct >= LIMITS.connectionsAmberPct ? 'amber' : 'green',
    `${v.connections} of ${v.max_connections} in use (${pct}%)`,
    'Something is holding connections open: look for many dev-server or test processes, or a pooler misconfiguration. Near the limit, new requests fail.');
  const stuck = v.long_running + v.idle_in_tx;
  add(area, env, 'Stuck work', v.long_running > 0 ? (env === 'prod' ? 'red' : 'amber') : v.idle_in_tx > 0 ? 'amber' : 'green',
    `${v.long_running} queries running over 5 min · ${v.idle_in_tx} transactions left open over 5 min`,
    stuck ? 'Find the session in pg_stat_activity; a stuck transaction blocks cleanup and can hold locks.' : undefined);
  const lag = Number(v.slot_lag);
  add(area, env, 'Replication backlog', lag >= LIMITS.slotLagRedBytes ? 'red' : lag >= LIMITS.slotLagAmberBytes || v.inactive_slots > 0 ? 'amber' : 'green',
    `largest slot lag ${fmt(Math.round(lag / 1024 ** 2))} MB · ${v.inactive_slots} inactive slot${v.inactive_slots === 1 ? '' : 's'}`,
    'A replication slot is not being consumed (usually live updates); it holds WAL and grows the disk until it is dropped or catches up.');
  add(area, env, 'Scheduled jobs', v.cron_failed > 0 ? (env === 'prod' ? 'red' : 'amber') : 'green',
    v.cron_failed ? `${v.cron_failed} failed run${v.cron_failed === 1 ? '' : 's'} in 24 h: ${v.cron_failed_jobs}` : 'no failed runs in 24 h',
    'Read cron.job_run_details for the failing job\'s return_message.');
  add(area, env, 'Background HTTP queue', v.http_queue >= LIMITS.httpQueueAmber ? 'amber' : 'green', `${fmt(v.http_queue)} requests waiting`,
    'pg_net requests are piling up: a job is calling faster than the endpoint answers.');
  const b = v.worst_bloat;
  const ratio = b ? b.dead / Math.max(1, b.dead + b.live) : 0;
  add(area, env, 'Table bloat', b && ratio >= LIMITS.bloatRatio && b.dead >= LIMITS.bloatMinDead ? 'amber' : 'green',
    b ? `worst: ${b.table}, ${fmt(b.dead)} dead rows (${Math.round(ratio * 100)}%)` : 'no table over 1,000 dead rows',
    'Autovacuum is behind on that table; check what churns it (a job that updates every row?).');
  const prevCache = state.cache?.[env];
  const hit = Number(v.blks_hit), read = Number(v.blks_read);
  nextState.cache = { ...(nextState.cache ?? {}), [env]: { hit, read } };
  if (prevCache && hit >= prevCache.hit) {
    const dh = hit - prevCache.hit, dr = read - prevCache.read;
    const pctHit = dh + dr > 0 ? (100 * dh) / (dh + dr) : 100;
    add(area, env, 'Cache hit rate', pctHit < LIMITS.cacheHitAmberPct ? 'amber' : 'green', `${pctHit.toFixed(2)}% since the last run`,
      'Reads are missing memory and going to disk: the working set outgrew the instance, or a query scans a big table.');
  }
  const weekAgo = history.filter((h) => h.day < DAY).slice(-7)[0]?.metrics?.[env]?.dbBytes;
  const growth = weekAgo ? (100 * (Number(v.db_bytes) - weekAgo)) / weekAgo : null;
  add(area, env, 'Database size', growth != null && growth >= LIMITS.dbGrowthAmberPct ? 'amber' : 'green',
    `${fmt(Math.round(Number(v.db_bytes) / 1024 ** 2))} MB${growth != null ? ` (${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% vs a week ago)` : ''}`,
    'Find the table that grew (logs, history or job tables usually); decide on retention.');
}

// ── DBA: heaviest queries (pg_stat_statements delta since the last run; live) ──────────────────
async function checkHeavyQueries(env) {
  const area = 'Database';
  let rows, info;
  try {
    [rows, [info]] = await Promise.all([
      sql(env, 'select queryid::text as id, calls::bigint as calls, round(total_exec_time)::bigint as ms from pg_stat_statements where queryid is not null and query not like \x27%stack-health%\x27 /* stack-health */'),
      sql(env, 'select stats_reset::text as since from pg_stat_statements_info /* stack-health */'),
    ]);
  } catch (e) { return unknown(area, env, 'Heaviest queries', e); }
  const now = Date.now();
  const cur = Object.fromEntries(rows.map((r) => [r.id, Number(r.ms)]));
  const totalMs = rows.reduce((a, r) => a + Number(r.ms), 0);
  const prev = state.pgss?.[env];
  if (RECORD) nextState.pgss = { ...(nextState.pgss ?? {}), [env]: { at: now, since: info.since, ms: cur, totalMs, top3: [] } };
  if (!prev || prev.since !== info.since) {
    const what = RECORD ? 'baseline recorded; the next run shows what each query cost' : 'no baseline yet (the scheduled run records one)';
    add(area, env, 'Heaviest queries', 'green', prev ? `statistics were reset (${info.since}); ${what}` : what);
    return;
  }
  const hours = (now - prev.at) / 3_600_000;
  const per24 = (ms) => (ms / 1000) * (24 / Math.max(hours, 1));
  const deltas = Object.entries(cur).map(([id, ms]) => [id, ms - (prev.ms[id] ?? 0)]).filter(([, d]) => d > 0).sort((a, b) => b[1] - a[1]);
  const top = deltas.slice(0, 3);
  const dbTimePerDay = per24(Math.max(0, totalMs - prev.totalMs));
  metrics[env].dbTimePerDay = Math.round(dbTimePerDay);
  if (RECORD) nextState.pgss[env].top3 = top.map(([id]) => id);
  let texts = {};
  if (top.length) {
    try {
      const t = await sql(env, `select queryid::text as id, left(query, 90) as q from pg_stat_statements where queryid::text in (${top.map(([id]) => `'${id.replace(/[^0-9-]/g, '')}'`).join(',')}) /* stack-health */`);
      texts = Object.fromEntries(t.map((r) => [r.id, String(r.q).replace(/\s+/g, ' ').trim()]));
    } catch { /* names are a nicety */ }
  }
  const [worstId, worstMs] = top[0] ?? [null, 0];
  const worst24 = per24(worstMs);
  const isNew = worstId && !(prev.top3 ?? []).includes(worstId);
  const status = worst24 > LIMITS.queryTimePerDayRed ? 'red' : worst24 > LIMITS.queryTimePerDayAmber && isNew ? 'amber' : 'green';
  const { note, x } = vsMedian(dbTimePerDay, `${env}.dbTimePerDay`);
  const lines = top.map(([id, ms]) => `${fmt(Math.round(per24(ms)))} s/day: ${texts[id] ?? `query ${id}`}`).join(' · ');
  add(area, env, 'Heaviest queries', x && x >= LIMITS.anomalyX && status === 'green' ? 'amber' : status,
    `total ${fmt(Math.round(dbTimePerDay))} s of query time per day (${note}). Top: ${lines || 'none'}`,
    'One query dominating the database: find its caller. A new one in the top 3 is the early sign of a runaway.');
}

// ── DBA: Supabase advisors, new findings only (live) ───────────────────────────────────────────
async function checkAdvisors(env) {
  const area = 'Database';
  for (const kind of ['security', 'performance']) {
    let lints;
    try { lints = await advisors(env, kind); } catch (e) { unknown(area, env, `Advisors (${kind})`, e); continue; }
    const keys = Object.fromEntries(lints.map((l) => [`${l.name}|${l.cache_key ?? l.title}`, l]));
    const base = state.advisors?.[env]?.[kind];
    nextState.advisors = { ...(nextState.advisors ?? {}), [env]: { ...(nextState.advisors?.[env] ?? {}), [kind]: Object.keys(keys) } };
    if (!base) {
      add(area, env, `Advisors (${kind})`, 'green', RECORD
        ? `baseline recorded: ${lints.length} standing findings (only NEW ones are reported from here on)`
        : `${lints.length} standing findings; no baseline yet (the scheduled run records one, then only NEW ones are reported)`);
      continue;
    }
    const baseSet = new Set(base);
    const fresh = Object.entries(keys).filter(([k]) => !baseSet.has(k)).map(([, l]) => l);
    const fixed = base.filter((k) => !(k in keys)).length;
    const warn = fresh.filter((l) => l.level === 'WARN' || l.level === 'ERROR');
    const status = warn.length ? (kind === 'security' ? 'red' : 'amber') : fresh.length && kind === 'security' ? 'amber' : 'green';
    const names = [...new Set(fresh.map((l) => `${l.level} ${l.name}`))].slice(0, 4).join(', ');
    add(area, env, `Advisors (${kind})`, status,
      `${fresh.length} new finding${fresh.length === 1 ? '' : 's'}${names ? ` (${names})` : ''} · ${fixed} fixed · ${lints.length} standing`,
      kind === 'security' ? 'A new security warning from Supabase: read it in Advisors → Security in the dashboard and fix it before it ships.' : 'A new performance warning (often a missing index or a slow policy): read it in Advisors → Performance.');
  }
}

// ── DBA: prod behind dev (live) ────────────────────────────────────────────────────────────────
function checkDrift() {
  try {
    execFileSync('node', [path.join(ROOT, 'scripts', 'check-prod-migration-drift.mjs')], { cwd: ROOT, stdio: 'pipe', timeout: 60_000 });
    add('Database', 'both', 'Prod vs dev schema', 'green', 'prod is in sync with dev');
  } catch (e) {
    const out = String(e.stdout ?? '') + String(e.stderr ?? '');
    const lines = out.split('\n').filter((l) => /✖|missing|behind/i.test(l)).slice(0, 2).join(' ').trim();
    add('Database', 'both', 'Prod vs dev schema', 'amber', lines || 'prod is behind dev',
      'Migrations are waiting for prod. Normal between releases; they must be applied before the next promote.');
  }
}

// ── DevOps: traffic, errors, slow endpoints (log service; replayable) ──────────────────────────
const EDGE_SQL = `
  select count() as requests,
    countIf(position(log_attributes['request.headers.x_client_info'], 'supabase-js-node') > 0) as server_js,
    countIf(position(log_attributes['request.headers.x_client_info'], 'createServerClient') > 0) as server_ssr,
    countIf(position(log_attributes['request.headers.user_agent'], 'Mozilla') > 0) as browser,
    countIf(toUInt16OrZero(log_attributes['response.status_code']) >= 500) as http_5xx,
    round(quantile(0.95)(toFloat64OrZero(log_attributes['response.origin_time'])), 0) as p95_ms
  from logs where source = 'edge_logs'`;
const SLOWEST_SQL = `
  select concat(log_attributes['request.method'], ' ', replaceRegexpAll(log_attributes['request.path'], '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', ':id')) as endpoint,
    count() as n, round(quantile(0.95)(toFloat64OrZero(log_attributes['response.origin_time'])), 0) as p95_ms
  from logs where source = 'edge_logs' group by endpoint having n >= 100 order by p95_ms desc limit 3`;
const AUTH_SQL = `select count() as auth_requests, countIf(log_attributes['status'] = '429') as auth_429 from logs where source = 'auth_logs'`;

async function checkTraffic(env) {
  const area = 'Traffic';
  let e, slowest, a;
  try {
    [[e], slowest, [a]] = await Promise.all([logs(env, EDGE_SQL, DAY), logs(env, SLOWEST_SQL, DAY), logs(env, AUTH_SQL, DAY)]);
  } catch (err) { return unknown(area, env, 'Requests', err); }
  const req = Number(e?.requests ?? 0), x5 = Number(e?.http_5xx ?? 0), p95 = Number(e?.p95_ms ?? 0), a429 = Number(a?.auth_429 ?? 0);
  Object.assign(metrics[env], { requests: req, serverJs: Number(e?.server_js ?? 0), serverSsr: Number(e?.server_ssr ?? 0), browser: Number(e?.browser ?? 0), http5xx: x5, p95, auth429: a429 });
  const t = vsMedian(req, `${env}.requests`);
  const tStatus = t.x && t.x >= LIMITS.trafficRedX && req >= LIMITS.trafficRedMin ? 'red' : t.x && t.x >= LIMITS.trafficAmberX && req >= LIMITS.trafficAmberMin ? 'amber' : 'green';
  add(area, env, 'Requests', tStatus,
    `${fmt(req)} (server ${fmt(metrics[env].serverJs + metrics[env].serverSsr)} · browser ${fmt(metrics[env].browser)}) · ${t.note}${t.x ? `, ×${t.x.toFixed(1)}` : ''}`,
    'Traffic jumped: on dev, usually a sweep, a probe loop or a polling tab; on prod, check who (IP / client) in the edge logs.');
  const rate = req ? (100 * x5) / req : 0;
  const m5 = vsMedian(x5, `${env}.http5xx`);
  const s5 = env === 'prod'
    ? (rate >= LIMITS.prod5xxRedPct && x5 >= LIMITS.prod5xxRedMin ? 'red' : m5.x && m5.x >= LIMITS.anomalyX && x5 >= 10 ? 'amber' : 'green')
    : (x5 >= LIMITS.dev5xxAmber ? 'amber' : 'green');
  add(area, env, 'Server errors (5xx)', s5, `${fmt(x5)} (${rate.toFixed(2)}% of requests)`, 'Read the failing requests in the edge logs; a 5xx on prod is a customer seeing an error.');
  add(area, env, 'Sign-in rate limits', env === 'prod' && a429 > 0 ? 'amber' : 'green', `${fmt(a429)} requests refused with 429`,
    env === 'prod' ? 'Real users hit the sign-in rate limit: find the client refreshing tokens in a loop.' : undefined);
  const mp = vsMedian(p95, `${env}.p95`);
  const slow = (slowest ?? []).map((s) => `${s.endpoint} ${fmt(Number(s.p95_ms))} ms`).join(' · ');
  add(area, env, 'Response time', mp.x && mp.x >= LIMITS.p95AmberX ? 'amber' : 'green', `p95 ${fmt(p95)} ms (${mp.note}). Slowest: ${slow || 'n/a'}`,
    'Responses got slower across the board: check the heaviest queries and connections first.');
}

// ── DevOps: deployments (AWS Amplify; live) ────────────────────────────────────────────────────
function checkDeploys() {
  const area = 'Deploys';
  for (const branch of ['dev', 'master']) {
    let jobs;
    try {
      // --query keeps commit messages out of the output: on Windows the AWS CLI crashes writing an
      // emoji from a commit message into a pipe ("'charmap' codec can't encode"), and the UTF-8
      // setting below is the second guard against the same thing.
      const out = execFileSync('aws', ['amplify', 'list-jobs', '--app-id', 'd3ld0l2bgmmlga', '--branch-name', branch, '--max-results', '10',
        '--region', 'us-east-2', '--output', 'json', '--query', 'jobSummaries[].{jobId:jobId,status:status,startTime:startTime,endTime:endTime}'],
      { encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
      jobs = JSON.parse(out) ?? [];
    } catch (e) { unknown(area, branch, 'Latest build', e); continue; }
    if (!jobs.length) { add(area, branch, 'Latest build', 'unknown', 'no builds found'); continue; }
    const dur = (j) => (j.endTime && j.startTime ? (Date.parse(j.endTime) - Date.parse(j.startTime)) / 60_000 : null);
    const [latest, ...rest] = jobs;
    const past = rest.map(dur).filter((d) => d != null).sort((a, b) => a - b);
    const med = past.length ? past[Math.floor(past.length / 2)] : null;
    const d = dur(latest);
    const failed = latest.status === 'FAILED';
    const status = failed ? 'red' : d && med && d >= LIMITS.buildSlowX * med ? 'amber' : 'green';
    add(area, branch, 'Latest build', status,
      `job ${latest.jobId} ${latest.status} ${String(latest.startTime).slice(0, 16).replace('T', ' ')}${d ? ` · ${d.toFixed(1)} min` : ''}${med ? ` (usual ${med.toFixed(1)} min)` : ''}`,
      failed ? `The ${branch} build failed: run /release fix logs ${branch}.` : 'Builds got slower: look at what the last commits added to the build.');
  }
}

// ── Agent tooling: hook errors in sessions, automation changes (local; replayable) ─────────────
function transcriptsDir() {
  const enc = ROOT.replace(/^([A-Za-z]):/, (_, d) => d.toLowerCase()).replace(/^([a-z])[\\/]/, '$1--').replace(/[\\/\s]+/g, '-');
  return path.join(os.homedir(), '.claude', 'projects', enc);
}
function checkAgentTooling() {
  const area = 'Agent tooling';
  const start = Date.parse(`${DAY}T00:00:00Z`), end = start + 86_400_000;
  const dir = transcriptsDir();
  const errors = {};
  let scanned = 0;
  try {
    (function walk(d) {
      for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (p.endsWith('.jsonl') && fs.statSync(p).mtimeMs >= start) {
          scanned++;
          for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
            if (!line.includes('hook_non_blocking_error') && !line.includes('hook_blocking_error')) continue;
            let o; try { o = JSON.parse(line); } catch { continue; }
            const ts = Date.parse(o.timestamp ?? '');
            if (!(ts >= start && ts < end) || !o.attachment) continue;
            const first = String(o.attachment.stderr ?? o.attachment.content ?? '').split('\n').find((l) => /Error|Cannot|failed/i.test(l)) ?? 'error';
            const k = `${o.attachment.hookName ?? 'hook'}: ${first.trim().slice(0, 110)}`;
            errors[k] = (errors[k] ?? 0) + 1;
          }
        }
      }
    })(dir);
    const total = Object.values(errors).reduce((a, b) => a + b, 0);
    metrics.hookErrors = total;
    const worst = Object.entries(errors).sort((a, b) => b[1] - a[1])[0];
    add(area, 'local', 'Hook errors', total >= LIMITS.hookErrorsRed ? 'red' : total > 0 ? 'amber' : 'green',
      total ? `${total} hook failure${total === 1 ? '' : 's'} in agent sessions; most: ${worst[0]} (${worst[1]}×)` : `none (${scanned} session file${scanned === 1 ? '' : 's'} read)`,
      'A hook is failing for agents (the 09-25 case: run from a subfolder). Fix the hook command; every failure is noise in an agent session.');
  } catch (e) { unknown(area, 'local', 'Hook errors', e); }
  try {
    const { commits, uncommitted } = automationChanges({ since: `${DAY}T00:00:00Z`, until: new Date(end).toISOString() });
    add(area, 'local', 'Automation changes', commits.length ? 'amber' : 'green',
      commits.length ? commits.map((c) => `${c.hash} "${c.subject.slice(0, 70)}" (${c.files.length} watched file${c.files.length === 1 ? '' : 's'})`).join(' · ') : `no commit touched agent automation or the database checks${uncommitted.length ? ` · ${uncommitted.length} uncommitted edit(s) now` : ''}`,
      'Review: does each commit say what it changed in the automation or the database checks? (AGENCY_RULES shared-automation rule)');
  } catch (e) { unknown(area, 'local', 'Automation changes', e); }
}

// ── run ────────────────────────────────────────────────────────────────────────────────────────
const t0 = Date.now();
const jobs = [];
for (const env of ENVS) {
  jobs.push(checkPostgresLogs(env), checkTraffic(env));
  if (!REPLAY) jobs.push(checkVitals(env), checkHeavyQueries(env), checkAdvisors(env));
}
await Promise.all(jobs);
if (!REPLAY) { checkDrift(); checkDeploys(); }
checkAgentTooling();
const seconds = ((Date.now() - t0) / 1000).toFixed(0);

// ── report ─────────────────────────────────────────────────────────────────────────────────────
const ORDER = { red: 0, amber: 1, unknown: 2, green: 3 };
checks.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.area.localeCompare(b.area));
const count = (s) => checks.filter((c) => c.status === s).length;
const overall = count('red') ? 'red' : count('amber') ? 'amber' : count('unknown') ? 'unknown' : 'green';
const runAt = new Date();
const line = (c) => `- ${ICON[c.status]} **${c.area} · ${c.env} · ${c.name}**: ${c.detail}${c.todo ? `\n  → ${c.todo}` : ''}`;
const report = [
  `# Stack health — ${DAY}${REPLAY ? ' (replay)' : ''}`,
  '',
  `${ICON[overall]} **${count('red')} problem${count('red') === 1 ? '' : 's'} · ${count('amber')} to review · ${count('green')} fine${count('unknown') ? ` · ${count('unknown')} could not check` : ''}**`,
  `Day-based checks cover ${DAY} (UTC); live checks describe the moment of the run. Run ${runAt.toLocaleString('en-CA', { timeZone: 'America/Toronto' })}, ${seconds} s.${REPLAY ? ' Replay: vitals, heaviest queries, advisors, schema drift and builds describe NOW, so they are skipped.' : ''}`,
  '',
  ...(count('red') ? ['## 🔴 Problems', ...checks.filter((c) => c.status === 'red').map(line), ''] : []),
  ...(count('amber') ? ['## 🟡 To review', ...checks.filter((c) => c.status === 'amber').map(line), ''] : []),
  ...(count('unknown') ? ['## ❔ Could not check', ...checks.filter((c) => c.status === 'unknown').map(line), ''] : []),
  '## ✅ Fine',
  ...checks.filter((c) => c.status === 'green').map((c) => `- ${c.area} · ${c.env} · ${c.name}: ${c.detail}`),
  '',
].join('\n');
console.log(report);

// ── history, state, email (scheduled / --record) ───────────────────────────────────────────────
if (RECORD) {
  fs.mkdirSync(P.reports, { recursive: true });
  fs.writeFileSync(path.join(P.reports, `${DAY}.md`), report, 'utf8');
  if (!REPLAY) fs.writeFileSync(P.latest, report, 'utf8');
  const entry = { day: DAY, runAt: runAt.toISOString(), overall, replay: REPLAY, metrics, statuses: checks.map((c) => ({ area: c.area, env: c.env, name: c.name, status: c.status })) };
  const kept = history.filter((h) => h.day !== DAY);
  fs.writeFileSync(P.history, [...kept, entry].sort((a, b) => a.day.localeCompare(b.day)).map((h) => JSON.stringify(h)).join('\n') + '\n', 'utf8');
  if (!REPLAY) fs.writeFileSync(P.state, JSON.stringify({ ...nextState, lastRun: runAt.toISOString() }, null, 2), 'utf8');
  try {
    console.error(`Dashboard rebuilt: ${buildDashboard({ healthDir: HEALTH_DIR })}`);
  } catch (e) { console.error(`Dashboard rebuild FAILED: ${e.message}`); }
}

// Desktop notification (Windows toast): the alert that needs no setup. It shows at run time and
// stays in the notification centre. Built-in WinRT API through Windows PowerShell; no module.
function notifyDesktop(title, body) {
  if (process.platform !== 'win32') return false;
  const q = (s) => String(s).replace(/'/g, "''").slice(0, 250);
  const ps = [
    '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null',
    '$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)',
    `$n = $t.GetElementsByTagName('text'); $n.Item(0).AppendChild($t.CreateTextNode('${q(title)}')) | Out-Null; $n.Item(1).AppendChild($t.CreateTextNode('${q(body)}')) | Out-Null`,
    "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show([Windows.UI.Notifications.ToastNotification]::new($t))",
  ].join('; ');
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'ignore', timeout: 20_000 });
    return true;
  } catch { return false; }
}

async function sendEmail(subject, markdown) {
  // A key used ONLY by this check (HEALTH_RESEND_API_KEY, "sending access" in Resend). Never put the
  // product's RESEND_API_KEY in .env.local: the dev app would start emailing real people.
  const key = process.env.HEALTH_RESEND_API_KEY || process.env.RESEND_API_KEY;
  const to = (process.env.HEALTH_ALERT_EMAILS || process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!key || !to.length) { console.error('Email skipped: HEALTH_RESEND_API_KEY (or PLATFORM_ADMIN_EMAILS) not set in .env.local.'); return false; }
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;max-width:720px">${markdown.split('\n').map((l) => {
    if (l.startsWith('# ')) return `<h2 style="margin:0 0 8px">${esc(l.slice(2))}</h2>`;
    if (l.startsWith('## ')) return `<h3 style="margin:16px 0 4px">${esc(l.slice(3))}</h3>`;
    if (l.startsWith('  → ')) return `<div style="margin:0 0 6px 24px;color:#555">→ ${esc(l.slice(4))}</div>`;
    if (l.startsWith('- ')) return `<div style="margin:4px 0">${esc(l.slice(2)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</div>`;
    return l ? `<p style="margin:4px 0">${esc(l).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>` : '';
  }).join('')}<p style="color:#888;margin-top:16px">From the morning stack health check on the dev PC. History: .health/ in the repo.</p></div>`;
  const body = JSON.stringify({ from: process.env.RESEND_FROM ?? 'FieldLogicHQ <hello@fieldlogichq.ca>', to, subject, html, text: markdown });
  return new Promise((resolve) => {
    const req = https.request({ hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
    (res) => { let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => {
      const ok = res.statusCode < 300;
      console.error(ok ? `Email sent to ${to.length} recipient(s): ${subject}` : `Email FAILED (HTTP ${res.statusCode}): ${d.slice(0, 200)}`);
      resolve(ok);
    }); });
    req.on('error', (e) => { console.error(`Email FAILED: ${e.message}`); resolve(false); });
    req.write(body); req.end();
  });
}

const NOTIFY = SCHEDULED || flag('--notify-test');
if (EMAIL || NOTIFY) {
  const reds = checks.filter((c) => c.status === 'red');
  const redSummary = reds.slice(0, 3).map((c) => `${c.env} ${c.name.toLowerCase()}`).join(', ');
  if (flag('--email-test')) {
    await sendEmail(`Stack health (test) — ${ICON[overall]} ${count('red')} problems, ${count('amber')} to review`, report);
  }
  if (flag('--notify-test')) {
    const shown = notifyDesktop(`Stack health (test): ${count('red')} problems, ${count('amber')} to review`, 'This is a test. The morning report is in .health/latest.md in the project.');
    console.error(shown ? 'Desktop notification shown.' : 'Desktop notification FAILED.');
  }
  if (SCHEDULED && reds.length) {
    const keyset = reds.map((c) => `${c.area}|${c.env}|${c.name}`).sort().join(',');
    if (!(state.lastAlert?.day === DAY && state.lastAlert?.keys === keyset)) {
      const shown = notifyDesktop(`🔴 Stack health: ${reds.length} problem${reds.length === 1 ? '' : 's'}`, `${redSummary}. Open the dashboard: npm run health:open`);
      console.error(shown ? 'Desktop notification shown.' : 'Desktop notification FAILED.');
      const ok = EMAIL ? await sendEmail(`🔴 Stack health: ${reds.length} problem${reds.length === 1 ? '' : 's'} — ${redSummary}`, report) : false;
      if (RECORD) { const s = readJson(P.state, {}); s.lastAlert = { day: DAY, keys: keyset, emailed: ok }; fs.writeFileSync(P.state, JSON.stringify(s, null, 2), 'utf8'); }
    }
  }
  const localToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  const isMonday = new Date().toLocaleDateString('en-US', { timeZone: 'America/Toronto', weekday: 'long' }) === 'Monday';
  if (SCHEDULED && isMonday && state.lastDigest !== localToday) {
    const week = [...history.filter((h) => !h.replay && h.day !== DAY), { day: DAY, overall }].slice(-7);
    const digest = [
      `# Stack health — weekly digest (${week[0]?.day ?? DAY} to ${DAY})`, '',
      `Days: ${week.map((h) => `${h.day.slice(5)} ${ICON[h.overall]}`).join(' · ')}`, '',
      'This email arrives every Monday even when everything is fine. If it does not arrive, the check has stopped running.', '',
      report.split('\n').slice(2).join('\n'),
    ].join('\n');
    const redDays = week.filter((h) => h.overall === 'red').length;
    notifyDesktop(`Stack health — weekly: ${redDays} red day${redDays === 1 ? '' : 's'}`, `Today ${overall}. ${EMAIL ? 'The digest is in your email.' : 'The reports are in .health/ in the project.'}`);
    const ok = EMAIL ? await sendEmail(`Stack health weekly: ${redDays} red day(s), ${ICON[overall]} today`, digest) : false;
    if (RECORD) { const s = readJson(P.state, {}); s.lastDigest = localToday; s.lastDigestEmailed = ok; fs.writeFileSync(P.state, JSON.stringify(s, null, 2), 'utf8'); }
  }
}

process.exit(0);
