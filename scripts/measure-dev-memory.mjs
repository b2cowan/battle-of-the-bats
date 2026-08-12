#!/usr/bin/env node
/**
 * Dev-server memory measurement — the permanent yardstick for Next upgrades.
 *
 * WHY THIS EXISTS. The 2026-08-11 leak diagnosis and the 16.2.4 → 16.3.0 upgrade plan
 * (docs/projects/active/NEXT_16_3_UPGRADE_PLAN.md §8 V4) both rest on before/after memory numbers
 * that must be METHOD-IDENTICAL to compare. The 08-11 numbers were taken with throwaway scripts;
 * this file is the committed replacement, so every future Next bump gets the same instrument for
 * free (plan decision D5). It is run on demand — deliberately NOT part of verify:changed, because
 * it needs an exclusive dev server and minutes of runtime.
 *
 * WHAT IT MEASURES (three separate behaviors — they gate different decisions):
 *   1. Per-REQUEST slope: 200+ GETs against ONE already-compiled coach page. This is the ~2.7
 *      MB/req drip measured 2026-08-11 (best upstream match: open vercel/next.js#85666). Its
 *      verdict gates the scripts/dev.mjs SUPERVISOR's retirement — not the upgrade itself.
 *   2. Per-COMPILE cost: first visit to each of ~15 coach routes (the ~240 MB/page hold that made
 *      "a swept server a spent server"). 16.3.0's eviction work targets exactly this.
 *   3. EVICTION: forced-GC heap after the walk plus an idle window, vs the cold-boot reading —
 *      does the server ever shrink back (plan §8 V4b)?
 *
 * METHOD RULES (breaking any of these makes numbers incomparable with the record):
 *   · Readings come from the worker's own process.memoryUsage() over the V8 inspector, after
 *     TWO forced GCs (HeapProfiler.collectGarbage). NEVER working-set/RSS as the gate metric —
 *     RSS is recorded as context only. Track arrayBuffers alongside heapUsed (the 08-11
 *     fingerprint grew both).
 *   · The server is spawned FRESH by this script, through scripts/dev.mjs, so the heap ceiling
 *     and supervisor are the same ones real dev use has. A supervisor restart mid-run INVALIDATES
 *     the measurement (the heap resets) — the script detects the restart banner and aborts.
 *   · Requests are sequential, cookie-authenticated document GETs — the same shape as a coach
 *     clicking, which is the workload the 08-11 numbers describe.
 *
 * ⚠ This script OWNS the server it measures. It refuses to start if port 3000 is already in use
 *   (measuring somebody's warm, half-swept server produces numbers that mean nothing), and it
 *   kills its server on exit. Per AGENTS.md, a measurement run counts as a sweep: do not point it
 *   at a server another task is using.
 *
 * ⚠ A partial run is a FAILURE, not a result (same rule as scripts/memory-guard.mjs): it exits
 *   non-zero and stamps the output PARTIAL rather than letting truncated numbers pass as clean.
 *
 * Usage:
 *   node scripts/measure-dev-memory.mjs                       # full dev measurement (V0/V4)
 *   node scripts/measure-dev-memory.mjs --server=start        # prod build via `next start` (V7)
 *   Flags: --requests=220 --sample-every=10 --routes=15 --idle-seconds=180
 *          --screen=coach-overview --base-port=9230 --json=<path>
 *   Env:   DEV_HEAP_MB (ceiling, as npm run dev) · DEV_FREE_FLOOR_MB (abort floor)
 */
import { spawn } from 'node:child_process';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServerClient } from '@supabase/ssr';
import WebSocket from 'ws';
import { SCREENS } from './layout-screens.mjs';
import { resolveUatContext } from './uat-fixture-context.mjs';
import { preflight, createWatchdog } from './memory-guard.mjs';

const exec = promisify(execCb);
const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mb = (bytes) => Math.round((bytes / 1048576) * 10) / 10;

const { values: opts } = parseArgs({
  options: {
    server: { type: 'string', default: 'dev' }, // dev | start
    requests: { type: 'string', default: '220' },
    'sample-every': { type: 'string', default: '10' },
    routes: { type: 'string', default: '15' },
    'idle-seconds': { type: 'string', default: '180' },
    screen: { type: 'string', default: 'coach-overview' },
    'base-port': { type: 'string', default: '9230' },
    json: { type: 'string' },
  },
});
const MODE = opts.server === 'start' ? 'start' : 'dev';
// --requests=0 is meaningful: it skips the request phase so the compile walk runs on a fresh
// server. Measured 2026-08-12: request phase + walk on ONE 16.2.4 server is not survivable —
// 220 requests retain ~755 MB and the help route's compile then blows the ceiling. Phase-split
// runs are the comparable method (each phase gets a fresh server, on every version).
// ⚠ zero is a legitimate value for these — `Number(x) || fallback` would silently turn an
// explicit 0 back into the default (bitten once, 2026-08-12).
const intArg = (raw, fallback) => {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};
const N_REQUESTS = intArg(opts.requests, 220);
const SAMPLE_EVERY = Math.max(1, intArg(opts['sample-every'], 10));
const N_ROUTES = intArg(opts.routes, 15);
const IDLE_SECONDS = intArg(opts['idle-seconds'], 180);
const BASE_PORT = Number(opts['base-port']) || 9230;
const nextVersion = require('next/package.json').version;
/** Same default + override as scripts/dev.mjs — the ceiling is part of the measured environment. */
const heapCeilingMb = Number(process.env.DEV_HEAP_MB) >= 512 ? Number(process.env.DEV_HEAP_MB) : 6144;

// ── Server lifecycle ─────────────────────────────────────────────────────────

function portInUse(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host: '127.0.0.1' });
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('error', () => resolve(false));
  });
}

const serverLog = []; // ring buffer of recent output, printed on failure
let sawReady = false;
let sawRestart = false;
let sawEacces = false;

function watchOutput(chunk) {
  const text = chunk.toString();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    serverLog.push(line);
    if (serverLog.length > 200) serverLog.shift();
    if (/✓ Ready|Ready in \d/.test(line)) sawReady = true;
    // dev.mjs supervisor banner — a restart mid-measurement resets the heap: run is void.
    if (/— restarting \(restart #/.test(line)) sawRestart = true;
    if (/EACCES/.test(line)) sawEacces = true;
  }
}

function startServer() {
  const extra = `--inspect=${BASE_PORT}`;
  const existing = (process.env.NODE_OPTIONS ?? '').trim();
  const env = { ...process.env, NODE_OPTIONS: existing ? `${existing} ${extra}` : extra };
  const args =
    MODE === 'dev'
      ? [path.join(ROOT, 'scripts/dev.mjs')]
      : [require.resolve('next/dist/bin/next'), 'start'];
  if (MODE === 'start' && !fs.existsSync(path.join(ROOT, '.next', 'BUILD_ID'))) {
    fail('No production build found (.next/BUILD_ID missing). Run `npm run build` first.');
  }
  // The launcher and CLI also try to bind the inspector port and warn that it is taken — that is
  // expected and harmless; discovery below identifies the real worker by its process title.
  const proc = spawn(process.execPath, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout.on('data', watchOutput);
  proc.stderr.on('data', watchOutput);
  return proc;
}

async function stopServer(proc) {
  if (!proc || proc.exitCode !== null) return;
  try {
    if (process.platform === 'win32') {
      // kill the whole tree — the worker holding port 3000 is a grandchild
      await exec(`taskkill /pid ${proc.pid} /T /F`);
    } else {
      proc.kill('SIGTERM');
    }
  } catch { /* already gone */ }
  for (let i = 0; i < 30 && (await portInUse(3000)); i++) await sleep(500);
}

// ── Minimal Chrome-DevTools-Protocol client (over ws) ────────────────────────

class Cdp {
  static connect(url) {
    return new Promise((resolve, reject) => {
      const sock = new WebSocket(url, { maxPayload: 64 * 1024 * 1024 });
      const client = new Cdp(sock);
      sock.once('open', () => resolve(client));
      sock.once('error', reject);
    });
  }
  constructor(sock) {
    this.sock = sock;
    this.nextId = 1;
    this.pending = new Map();
    this.closed = false;
    sock.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject, timer } = this.pending.get(msg.id);
        clearTimeout(timer);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
    sock.on('close', () => {
      this.closed = true;
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer);
        reject(new Error('inspector connection closed'));
      }
      this.pending.clear();
    });
  }
  call(method, params = {}, timeoutMs = 20_000) {
    if (this.closed) return Promise.reject(new Error('inspector connection closed'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out after ${timeoutMs} ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.sock.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const r = await this.call('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`evaluate failed: ${r.exceptionDetails.text}`);
    return r.result?.value;
  }
  close() { try { this.sock.close(); } catch { /* noop */ } }
}

/** Find the process that actually serves requests: Next titles its worker `next-server (vX)`. */
async function discoverWorker() {
  for (let attempt = 0; attempt < 40; attempt++) {
    for (let port = BASE_PORT; port < BASE_PORT + 12; port++) {
      let targets;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1500) });
        targets = await res.json();
      } catch { continue; }
      for (const t of targets ?? []) {
        if (!t.webSocketDebuggerUrl) continue;
        let probe;
        try { probe = await Cdp.connect(t.webSocketDebuggerUrl); } catch { continue; }
        try {
          const title = String(await probe.evaluate('process.title'));
          if (/^next-server/.test(title)) {
            console.log(`  · inspector attached — "${title}" (pid ${await probe.evaluate('process.pid')}, port ${port})`);
            return probe;
          }
        } catch { /* fall through */ }
        probe.close();
      }
    }
    await sleep(500);
  }
  throw new Error(
    `could not find the next-server worker's inspector on ports ${BASE_PORT}–${BASE_PORT + 11}`,
  );
}

// ── Readings ─────────────────────────────────────────────────────────────────

const samples = [];
const perRoute = [];
let runSummary = null;
let runTarget = null;

/** Always callable — a failed run still records its evidence, stamped `completed: false`. */
function writeJson(completed) {
  if (!opts.json) return;
  try {
    fs.writeFileSync(
      opts.json,
      JSON.stringify({
        when: new Date().toISOString(),
        nextVersion, mode: MODE, heapCeilingMb, completed,
        config: { requests: N_REQUESTS, sampleEvery: SAMPLE_EVERY, routes: N_ROUTES, idleSeconds: IDLE_SECONDS, target: runTarget },
        summary: runSummary, samples, perRoute,
      }, null, 2),
    );
    console.error(`  (evidence JSON → ${opts.json}${completed ? '' : ' — completed:false'})`);
  } catch { /* recording must never mask the underlying failure */ }
}

async function reading(cdp, label, requests = null) {
  // Two full GCs with a settle between them: the first pass's finalizers can free more for the
  // second. Reading without this measures allocation noise, not retention — the whole point.
  await cdp.call('HeapProfiler.collectGarbage');
  await sleep(200);
  await cdp.call('HeapProfiler.collectGarbage');
  await sleep(300);
  const raw = await cdp.evaluate('JSON.stringify(process.memoryUsage())');
  const m = JSON.parse(raw);
  const row = {
    label,
    requests,
    heapMb: mb(m.heapUsed),
    arrayBuffersMb: mb(m.arrayBuffers),
    externalMb: mb(m.external),
    rssMb: mb(m.rss),
  };
  samples.push(row);
  const req = requests === null ? '' : ` @ ${String(requests).padStart(3)} req`;
  console.log(
    `  · ${label.padEnd(24)}${req}  heap ${String(row.heapMb).padStart(7)} MB · ` +
      `arrayBuffers ${String(row.arrayBuffersMb).padStart(6)} MB · rss ${String(row.rssMb).padStart(7)} MB`,
  );
  return row;
}

/** Least-squares slope of heapUsed against request count. */
function slopeOf(rows) {
  const pts = rows.filter((r) => r.requests !== null);
  if (pts.length < 2) return null;
  const n = pts.length;
  const sx = pts.reduce((a, r) => a + r.requests, 0);
  const sy = pts.reduce((a, r) => a + r.heapMb, 0);
  const sxx = pts.reduce((a, r) => a + r.requests * r.requests, 0);
  const sxy = pts.reduce((a, r) => a + r.requests * r.heapMb, 0);
  const denom = n * sxx - sx * sx;
  return denom === 0 ? null : Math.round(((n * sxy - sx * sy) / denom) * 100) / 100;
}

// ── Authenticated requests ───────────────────────────────────────────────────

const jar = new Map();
const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

function absorbCookies(res) {
  for (const sc of res.headers.getSetCookie?.() ?? []) {
    const pair = sc.split(';', 1)[0];
    const eq = pair.indexOf('=');
    if (eq < 1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1);
    if (value) jar.set(name, value);
    else jar.delete(name);
  }
}

/**
 * Sign in headlessly as the UAT coach. Uses @supabase/ssr's own server client with a Map-backed
 * cookie adapter, so the session cookies carry the library's exact serialization (chunking,
 * base64 prefix) rather than a hand-built imitation that rots when the format moves.
 */
async function signInCoach() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.UAT_COACH_EMAIL;
  const password = process.env.UAT_COACH_PASSWORD;
  if (!url || !anon || !email || !password) {
    fail('Missing env: needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, UAT_COACH_EMAIL, UAT_COACH_PASSWORD in .env.local.');
  }
  const supa = createServerClient(url, anon, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cs) => { for (const c of cs) jar.set(c.name, c.value); },
    },
  });
  const { error } = await supa.auth.signInWithPassword({ email, password });
  if (error) fail(`UAT coach sign-in failed: ${error.message}`);
  console.log(`  · signed in as UAT coach (${jar.size} cookie${jar.size === 1 ? '' : 's'})`);
}

/**
 * Set once the fixture org is known. ⚠ The signed-in marker is deliberately NOT an `<h1>`: coach
 * pages stream a chrome-only SSR document and render their heading client-side (verified
 * 2026-08-12 — 57.9 KB of shell with zero h1 tags), so the marker is "a complete document whose
 * chrome carries links into this org" — which a login redirect (307) or a foreign-org page fails.
 */
let orgMarker = null;

async function hit(routePath, { timeoutMs = 180_000, retried = false } = {}) {
  let res;
  try {
    res = await fetch(BASE + routePath, {
      redirect: 'manual', // a redirect on a coach page means the session died — that must FAIL
      signal: AbortSignal.timeout(timeoutMs),
      headers: { cookie: cookieHeader(), accept: 'text/html' },
    });
  } catch (err) {
    // A connection-level failure has two honest readings: the server died (measurement over —
    // and that death IS a finding), or one socket hiccuped under a live server. Distinguish them
    // with evidence before deciding: retry ONCE, and only when the server demonstrably still
    // listens. Anything else fails loudly with the cause attached.
    const cause = err?.cause?.code ?? err?.cause?.message ?? err?.message;
    const alive = serverProc?.exitCode === null && (await portInUse(3000));
    if (alive && !retried) {
      console.log(`  ⚠ ${routePath}: fetch failed (${cause}) with the server still up — one retry`);
      await sleep(2000);
      return hit(routePath, { timeoutMs, retried: true });
    }
    // Typed throw, not fail(): the compile walk treats a server death as a RESULT to record
    // (a route whose compile does not fit under the ceiling), everything else as fatal.
    const e = new Error(
      `fetch ${routePath} failed (${cause}) — server ${alive ? 'still listening' : 'NOT listening (it died mid-request)'}`,
    );
    e.serverDead = !alive;
    throw e;
  }
  const text = await res.text(); // always drain — an unread body pins the socket
  absorbCookies(res);
  const signedIn = text.includes('<html') && (!orgMarker || text.includes(orgMarker));
  return { status: res.status, bytes: text.length, signedIn };
}

// ── Failure handling ─────────────────────────────────────────────────────────

let serverProc = null;
function fail(message) {
  console.error(`\n✗ ${message}`);
  if (serverLog.length) {
    console.error('\nLast server output:');
    for (const l of serverLog.slice(-25)) console.error(`    ${l}`);
  }
  if (samples.length) {
    console.error('\n⚠ PARTIAL DATA — this run did not complete; do NOT record these as results.');
  }
  writeJson(false);
  stopServer(serverProc).finally(() => process.exit(1));
  const err = new Error(message); // stop the caller's control flow while the async teardown runs
  err.handled = true;
  throw err;
}

function assertRunStillValid(where) {
  if (sawRestart) fail(`the dev.mjs supervisor restarted the server during ${where} — the heap reset, so this measurement is void. The restart itself is a finding: the server did not survive the run.`);
  if (sawEacces) fail(`Supabase EACCES in server output during ${where} — the server is running network-restricted (see AGENTS.md); measurements against it are meaningless.`);
}

// ── The measurement ──────────────────────────────────────────────────────────

async function main() {
  console.log(`\nmeasure-dev-memory · next ${nextVersion} · mode=${MODE} · ${new Date().toISOString()}`);
  console.log(`  requests=${N_REQUESTS} (sample every ${SAMPLE_EVERY}) · compile routes=${N_ROUTES} · idle=${IDLE_SECONDS}s · heap ceiling=${heapCeilingMb} MB\n`);

  preflight('measure-dev-memory');
  const watchdog = createWatchdog('measure-dev-memory');

  if (await portInUse(3000)) {
    fail('port 3000 is already in use. This script must own a FRESH server (a warm one measures as dirty). Stop the running dev server first.');
  }

  // Resolve fixtures + sign in BEFORE the server exists — auth talks to Supabase directly.
  const ctx = await resolveUatContext();
  await signInCoach();

  orgMarker = `/${ctx.orgSlug}/`;
  const coachScreens = SCREENS.filter((s) => s.session === 'coach');
  const target = coachScreens.find((s) => s.id === opts.screen);
  if (!target) fail(`--screen=${opts.screen} is not a coach screen id in scripts/layout-screens.mjs`);
  const targetPath = target.path(ctx);
  const walkList = coachScreens.filter((s) => s.id !== target.id).slice(0, N_ROUTES);

  runTarget = target.id;
  console.log(`  · target page (request phase): ${target.id} → ${targetPath}`);
  console.log(`  · compile walk: ${walkList.length} routes\n`);

  let serverExited = null;
  serverProc = startServer();
  serverProc.on('exit', (code) => { serverExited = code ?? -1; });

  // Wait for Ready WITHOUT issuing a request — the first request must be the one we attribute.
  const readyDeadline = Date.now() + 240_000;
  while (!sawReady) {
    if (serverExited !== null) fail(`server exited (code ${serverExited}) before Ready`);
    if (Date.now() > readyDeadline) fail('server did not report Ready within 240s');
    await sleep(500);
  }
  console.log('  · server Ready');
  const cdp = await discoverWorker();

  // ① Cold boot — nothing compiled, nothing requested.
  const cold = await reading(cdp, 'cold boot');

  // ② Warm the target page: first hit compiles it (a bonus per-compile datapoint), second settles.
  const orFail = (p) => p.catch((e) => fail(e.message));
  const first = await orFail(hit(targetPath));
  if (first.status !== 200 || !first.signedIn) {
    fail(`target page ${targetPath} answered ${first.status}${first.signedIn ? '' : ' (missing signed-in markers)'} — expected a signed-in 200. A redirect means the coach session did not take.`);
  }
  await orFail(hit(targetPath));
  const warmed = await reading(cdp, 'target compiled+warm', 0);
  assertRunStillValid('warmup');

  // ③ Per-request phase — the #85666-class drip. Sequential, one page, forced-GC samples.
  if (N_REQUESTS > 0) {
    console.log(`\n  Request phase: ${N_REQUESTS} × GET ${targetPath}`);
    for (let i = 1; i <= N_REQUESTS; i++) {
      const r = await orFail(hit(targetPath, { timeoutMs: 60_000 }));
      if (r.status !== 200) fail(`request ${i} answered ${r.status} — aborting (session or server failure)`);
      if (i % SAMPLE_EVERY === 0) {
        const row = await reading(cdp, 'request phase', i);
        assertRunStillValid(`request phase (req ${i})`);
        const trip = watchdog.check(`request ${i}`);
        if (trip) { watchdog.report(trip); fail('system memory floor tripped'); }
        if (row.heapMb > heapCeilingMb * 0.85) {
          fail(`heap ${row.heapMb} MB is within 15% of the ${heapCeilingMb} MB ceiling — aborting before the supervisor kills the run. That proximity IS the result: the leak is alive.`);
        }
      }
    }
  }
  const requestRows = samples.filter((s) => s.label === 'request phase');
  const overallSlope = slopeOf([warmed, ...requestRows]);
  const lastThird = requestRows.slice(-Math.max(2, Math.floor(requestRows.length / 3)));
  const lateSlope = slopeOf(lastThird);

  // ④ Per-compile walk — first visit to each route while watching forced-GC heap.
  console.log(`\n  Compile walk: ${walkList.length} first-visit coach routes`);
  let prev = await reading(cdp, 'pre-walk');
  let diedCompiling = null;
  for (const screen of walkList) {
    const p = screen.path(ctx);
    const t0 = Date.now();
    let r;
    try {
      r = await hit(p);
    } catch (err) {
      if (err.serverDead) {
        // The route's compile blew the heap ceiling and V8 fatal-errored. That is a RESULT —
        // record it and stop cleanly (the worker, and our inspector socket, are gone).
        diedCompiling = screen.id;
        perRoute.push({ id: screen.id, status: 'DIED', ms: Date.now() - t0, deltaHeapMb: null });
        console.log(`\n  ☠ server DIED compiling ${screen.id} — its compile does not fit above what the walk had already retained (ceiling ${heapCeilingMb} MB)`);
        break;
      }
      fail(err.message);
    }
    const row = await reading(cdp, screen.id);
    perRoute.push({
      id: screen.id,
      status: r.status,
      ms: Date.now() - t0,
      deltaHeapMb: Math.round((row.heapMb - prev.heapMb) * 10) / 10,
    });
    prev = row;
    assertRunStillValid(`compile walk (${screen.id})`);
    const trip = watchdog.check(screen.id);
    if (trip) { watchdog.report(trip); fail('system memory floor tripped'); }
    if (row.heapMb > heapCeilingMb * 0.85) {
      console.log(`  ⚠ stopping walk at ${perRoute.length}/${walkList.length} routes — heap ${row.heapMb} MB is near the ceiling (that is itself the 16.2.x finding)`);
      break;
    }
  }
  const postSweep = prev;

  // ⑤ Idle — does eviction ever give anything back? (Unmeasurable if the walk killed the server.)
  let idle = null;
  if (!diedCompiling) {
    if (IDLE_SECONDS > 0) {
      console.log(`\n  Idle ${IDLE_SECONDS}s (eviction window)…`);
      await sleep(IDLE_SECONDS * 1000);
    }
    idle = await reading(cdp, `idle +${IDLE_SECONDS}s`);
    assertRunStillValid('idle');
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const compiled = perRoute.filter((r) => r.status === 200);
  const badRoutes = perRoute.filter((r) => r.status !== 200);
  const meanCompile = compiled.length
    ? Math.round((compiled.reduce((a, r) => a + r.deltaHeapMb, 0) / compiled.length) * 10) / 10
    : null;
  const targetCompileMb = Math.round((warmed.heapMb - cold.heapMb) * 10) / 10;
  const abGrowth = requestRows.length
    ? Math.round((requestRows[requestRows.length - 1].arrayBuffersMb - warmed.arrayBuffersMb) * 10) / 10
    : null;
  const plateau = overallSlope !== null && lateSlope !== null && lateSlope < 0.3;

  console.log(`\n${'─'.repeat(74)}`);
  console.log(`RESULTS · next ${nextVersion} · ${MODE} server\n`);
  if (N_REQUESTS > 0) {
    console.log(`  Per-request slope (${N_REQUESTS} req, forced-GC heap): ${overallSlope} MB/req · last-third ${lateSlope} MB/req · plateau: ${plateau ? 'YES' : 'NO'}`);
    console.log(`  arrayBuffers growth over request phase:              ${abGrowth} MB`);
  }
  console.log(`  Target page compile cost (${target.id}):     ${targetCompileMb} MB`);
  if (walkList.length) {
    console.log(`  Per-compile mean over ${String(compiled.length).padStart(2)} routes:                    ${meanCompile} MB/route`);
    if (badRoutes.length) console.log(`  ⚠ non-200 routes (excluded from mean): ${badRoutes.map((r) => `${r.id}=${r.status}`).join(', ')}`);
    if (diedCompiling) console.log(`  ☠ walk FATALITY: the server died compiling ${diedCompiling} (V8 heap-limit) — routes measured before it: ${compiled.length}`);
  }
  if (idle) {
    console.log(`  Cold boot ${cold.heapMb} MB → post-sweep ${postSweep.heapMb} MB → after ${IDLE_SECONDS}s idle ${idle.heapMb} MB (${Math.round((idle.heapMb / cold.heapMb) * 10) / 10}× cold)`);
  } else {
    console.log(`  Cold boot ${cold.heapMb} MB → post-sweep ${postSweep.heapMb} MB → idle reading N/A (server died mid-walk)`);
  }
  if (N_REQUESTS > 0) console.log(`\n  Plan §8 V4a gate (supervisor): slope <0.3+plateau retires it · ≥1.0 keeps it (and we take the repro to vercel/next.js#85666)`);
  console.log(`  Plan §8 V4b gate (eviction):   idle <2× cold-boot = eviction observed working here`);
  watchdog.summarise();

  runSummary = { overallSlope, lateSlope, plateau, abGrowth, targetCompileMb, meanCompile, diedCompiling, coldHeapMb: cold.heapMb, postSweepHeapMb: postSweep.heapMb, idleHeapMb: idle?.heapMb ?? null };
  writeJson(true);

  cdp.close();
  await stopServer(serverProc);
  console.log('\n✓ measurement complete (server stopped)');
}

main().catch((err) => {
  // fail() already printed + scheduled teardown for its own throws; this catches everything else.
  if (!err?.handled) {
    console.error(`\n✗ ${err?.stack ?? err}`);
    if (err?.cause) console.error(`  cause: ${err.cause?.stack ?? err.cause}`);
    if (serverLog.length) {
      console.error('\nLast server output:');
      for (const l of serverLog.slice(-25)) console.error(`    ${l}`);
    }
    if (samples.length) {
      console.error('\n⚠ PARTIAL DATA — this run did not complete; do NOT record these as results.');
    }
    writeJson(false);
    stopServer(serverProc).finally(() => process.exit(1));
  }
});
