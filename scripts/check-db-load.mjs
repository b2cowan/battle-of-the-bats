/**
 * check-db-load.mjs — the daily database-load check: how many statements ran longer than 10 s on
 * dev and prod in one day, and which queries they were.
 *
 * Why it exists: an agent hook refreshed the schema snapshots up to ~580 times a day from 06-01 to
 * 09-25. Each refresh was a 12–20 s query on BOTH databases, about 90% of all prod query time, and
 * nobody saw it until dev's CPU hit 99% (docs/projects/active/DB_SNAPSHOT_REFRESH_LOAD_PLAN.md). This
 * check would have flagged it the next morning.
 *
 * Cost: it reads Supabase's LOG service (the Management API logs endpoint), not the databases, so
 * neither database does any work. Takes about 3 s per project.
 *
 * Usage:
 *   npm run check:db-load                       # yesterday (UTC), dev + prod
 *   node scripts/check-db-load.mjs --day=2026-09-21
 *   node scripts/check-db-load.mjs --env=prod --max=5
 *
 * "Slow" = a statement Postgres's auto_explain logged as `duration:`, i.e. longer than 10 s (the
 * projects' auto_explain.log_min_duration). Exit 1 when a project is over --max statements
 * (default 10) or --max-seconds of slow time (default 300), so it can gate a routine. Read-only.
 * Supabase keeps logs for a limited window, so a day beyond it reads as empty. The check says so
 * when a day has no log rows at all, rather than passing silently.
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECTS = { dev: 'npgnrxaitgbtbtvvykto', prod: 'qcttcboqysynwcdyghil' };

for (const line of (fs.existsSync(path.join(ROOT, '.env.local')) ? fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8') : '').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq > 0 && !process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN not set in .env.local'); process.exit(1); }

const arg = (name, dflt) => (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? `--${name}=${dflt}`).split('=')[1];
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const DAY = arg('day', yesterday);
const ENVS = arg('env', 'both') === 'both' ? ['dev', 'prod'] : [arg('env', 'both')];
const MAX = Number(arg('max', 10));
const MAX_SECONDS = Number(arg('max-seconds', 300));
if (!/^\d{4}-\d{2}-\d{2}$/.test(DAY) || ENVS.some((e) => !PROJECTS[e]) || !(MAX >= 0) || !(MAX_SECONDS >= 0)) {
  console.error('Usage: node scripts/check-db-load.mjs [--day=YYYY-MM-DD] [--env=dev|prod|both] [--max=N] [--max-seconds=N]');
  process.exit(1);
}

// ClickHouse SQL over the unified `logs` table (Management API logs endpoint).
const SQL = `
  select
    count() as log_rows,
    countIf(event_message like 'duration:%') as slow,
    round(sumIf(toFloat64OrZero(extract(event_message, 'duration: ([0-9.]+) ms')), event_message like 'duration:%') / 1000, 0) as slow_s
  from logs where source = 'postgres_logs'`;
const TOP_SQL = `
  select
    left(replaceRegexpAll(substring(event_message, position(event_message, 'Query Text:') + 11, 400), '[[:space:]]+', ' '), 90) as query,
    count() as n,
    round(sum(toFloat64OrZero(extract(event_message, 'duration: ([0-9.]+) ms'))) / 1000, 0) as total_s
  from logs where source = 'postgres_logs' and event_message like 'duration:%'
  group by query order by total_s desc limit 3`;

function logsQuery(ref, sql) {
  const qs = new URLSearchParams({
    sql, iso_timestamp_start: `${DAY}T00:00:00Z`, iso_timestamp_end: `${DAY}T23:59:59.999Z`,
  }).toString();
  return new Promise((resolve, reject) => {
    https.get({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${ref}/analytics/endpoints/logs?${qs}`,
      headers: { Authorization: `Bearer ${TOKEN}` },
    }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        if (res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}: ${d.slice(0, 200)}`));
        const j = JSON.parse(d);
        if (j.error) return reject(new Error(JSON.stringify(j.error).slice(0, 200)));
        resolve(j.result ?? []);
      });
    }).on('error', reject);
  });
}

let over = false;
console.log(`Database load on ${DAY} (UTC) — statements over 10 s. Limit: ${MAX} statements or ${MAX_SECONDS} s per project.`);
for (const env of ENVS) {
  try {
    const [row] = await logsQuery(PROJECTS[env], SQL);
    const logRows = Number(row?.log_rows ?? 0);
    const slow = Number(row?.slow ?? 0);
    const slowS = Number(row?.slow_s ?? 0);
    if (logRows === 0) {
      console.log(`  ?  ${env}: no Postgres log rows for this day — outside the log window, or the logs are unavailable. Not a pass.`);
      over = true;
      continue;
    }
    const bad = slow > MAX || slowS > MAX_SECONDS;
    over ||= bad;
    console.log(`  ${bad ? '✖' : '✓'}  ${env}: ${slow} slow statement${slow === 1 ? '' : 's'}, ${slowS} s in total`);
    if (slow > 0) {
      for (const q of await logsQuery(PROJECTS[env], TOP_SQL)) {
        console.log(`       ${String(q.n).padStart(5)}× ${String(q.total_s).padStart(6)} s  ${String(q.query).trim()}`);
      }
    }
  } catch (e) {
    console.log(`  ?  ${env}: could not read the logs (${e.message}). Not a pass.`);
    over = true;
  }
}
if (over) {
  console.log('\nOver the limit (or unreadable). Find what runs the query above: an agent hook, a sweep, a cron');
  console.log('job. See docs/projects/active/DB_SNAPSHOT_REFRESH_LOAD_PLAN.md for how the 09-25 incident was traced.');
}
process.exit(over ? 1 : 0);
