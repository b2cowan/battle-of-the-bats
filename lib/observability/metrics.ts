/**
 * Request metrics — coarse calls-vs-errors counting that feeds the dashboard chart.
 *
 * We never insert one row per HTTP call. Each worker buffers per-route tallies in memory and
 * flushes an aggregate batch into request_metrics_raw opportunistically (on age or size), which
 * survives serverless freezing because the flush happens DURING a later request, not after the
 * instance idles. Phase 4 pg_cron folds request_metrics_raw → request_metrics_rollup (5-min
 * buckets) then truncates the staging table. All best-effort — never throws into the request path.
 */
import { supabaseAdmin } from '../supabase-admin';
import { observabilityEnv } from './env';

interface Tally {
  call: number;
  error: number;
}

const buffer = new Map<string, Tally>(); // key = route
let lastFlush = 0;
let flushing = false;
const FLUSH_INTERVAL_MS = 60_000;
const FLUSH_MAX_CALLS = 200;

function totalCalls(): number {
  let n = 0;
  for (const t of buffer.values()) n += t.call;
  return n;
}

export function recordRequest(route: string, isError: boolean): void {
  try {
    const t = buffer.get(route) ?? { call: 0, error: 0 };
    t.call += 1;
    if (isError) t.error += 1;
    buffer.set(route, t);
    maybeFlush();
  } catch {
    /* metrics must never break the request path */
  }
}

function maybeFlush(): void {
  const now = Date.now();
  if (lastFlush === 0) lastFlush = now;
  if (flushing) return;
  if (now - lastFlush < FLUSH_INTERVAL_MS && totalCalls() < FLUSH_MAX_CALLS) return;
  void flush();
}

function remerge(snapshot: [string, Tally][]): void {
  // On a failed flush, fold the snapshot back into the buffer so the counts are retried on the
  // next flush instead of being silently lost (the buffer was already cleared).
  for (const [route, t] of snapshot) {
    const cur = buffer.get(route) ?? { call: 0, error: 0 };
    cur.call += t.call;
    cur.error += t.error;
    buffer.set(route, cur);
  }
}

export async function flush(): Promise<void> {
  if (flushing || buffer.size === 0) return;
  flushing = true;
  const snapshot = [...buffer.entries()];
  buffer.clear();
  try {
    const env = observabilityEnv();
    const rows = snapshot.map(([route, t]) => ({
      env,
      route,
      org_id: null,
      call_count: t.call,
      error_count: t.error,
    }));
    const { error } = await supabaseAdmin.from('request_metrics_raw').insert(rows);
    if (error) {
      console.error('[observability] metrics flush failed:', error.message);
      remerge(snapshot);
    }
  } catch (e) {
    console.error('[observability] metrics flush error:', e);
    remerge(snapshot);
  } finally {
    // Advance lastFlush only AFTER the attempt (not before the insert) so a failed flush doesn't
    // both lose data AND lock out flushing for the interval. Re-merged counts flush next round
    // (or sooner, once the buffer crosses FLUSH_MAX_CALLS).
    lastFlush = Date.now();
    flushing = false;
  }
}
