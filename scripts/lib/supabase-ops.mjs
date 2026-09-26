/**
 * supabase-ops.mjs — read-only Supabase Management API helpers for the ops checks
 * (scripts/stack-health.mjs). One account token (SUPABASE_ACCESS_TOKEN in .env.local) reaches both
 * projects.
 *
 *   sql(env, query)              → rows. SELECT/WITH only; anything else is refused before it is sent.
 *   logs(env, query, day)        → rows from the log service (ClickHouse SQL over the unified `logs`
 *                                  table; column `source`, fields in `log_attributes['…']`). The
 *                                  databases do no work for these.
 *   advisors(env, kind)          → Supabase's own lints ('performance' | 'security').
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PROJECTS = { dev: 'npgnrxaitgbtbtvvykto', prod: 'qcttcboqysynwcdyghil' };

export function loadEnv() {
  const p = path.join(ROOT, '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0 && !process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}
loadEnv();

// The Management API rate-limits per ACCOUNT TOKEN, and every agent session shares this one. So:
// at most MAX_IN_FLIGHT requests at once, and a 429/503 waits and retries (Retry-After if given,
// else 5 → 15 → 30 → 60 s) instead of failing the check. Found on 09-26: back-to-back replays
// drew "ThrottlerException: Too Many Requests".
const MAX_IN_FLIGHT = 3;
const BACKOFF_S = [5, 15, 30, 60];
let inFlight = 0;
const waiting = [];
const acquire = () => (inFlight < MAX_IN_FLIGHT ? (inFlight++, Promise.resolve()) : new Promise((r) => waiting.push(r)));
const release = () => { const next = waiting.shift(); if (next) next(); else inFlight--; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function requestOnce(method, apiPath, data, timeoutMs) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) return Promise.reject(new Error('SUPABASE_ACCESS_TOKEN not set in .env.local'));
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.supabase.com', path: apiPath, method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) },
    }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, retryAfter: Number(res.headers['retry-after']) || null, body: d }));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timed out after ${timeoutMs} ms`)));
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function request(method, apiPath, body, timeoutMs = 60_000) {
  const data = body ? JSON.stringify(body) : null;
  await acquire();
  try {
    for (let attempt = 0; ; attempt++) {
      const r = await requestOnce(method, apiPath, data, timeoutMs);
      if ((r.status === 429 || r.status === 503) && attempt < BACKOFF_S.length) {
        await sleep(1000 * (r.retryAfter ?? BACKOFF_S[attempt]));
        continue;
      }
      if (r.status >= 300) throw new Error(`HTTP ${r.status}: ${r.body.slice(0, 200)}`);
      try { return JSON.parse(r.body); } catch { throw new Error(`unparseable response: ${r.body.slice(0, 200)}`); }
    }
  } finally {
    release();
  }
}

export async function sql(env, query) {
  const first = query.trim().split(/\s+/)[0].toLowerCase();
  if (!['select', 'with'].includes(first)) throw new Error(`refusing a non-read statement (${first})`);
  const rows = await request('POST', `/v1/projects/${PROJECTS[env]}/database/query`, { query });
  if (!Array.isArray(rows)) throw new Error(JSON.stringify(rows).slice(0, 200));
  return rows;
}

/** @param {string} day YYYY-MM-DD, a whole UTC day */
export async function logs(env, query, day) {
  const qs = new URLSearchParams({
    sql: query, iso_timestamp_start: `${day}T00:00:00Z`, iso_timestamp_end: `${day}T23:59:59.999Z`,
  }).toString();
  const j = await request('GET', `/v1/projects/${PROJECTS[env]}/analytics/endpoints/logs?${qs}`);
  if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 200));
  return j.result ?? [];
}

export async function advisors(env, kind) {
  const j = await request('GET', `/v1/projects/${PROJECTS[env]}/advisors/${kind}`);
  return j.lints ?? [];
}
