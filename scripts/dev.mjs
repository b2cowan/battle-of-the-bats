#!/usr/bin/env node
/**
 * Dev-server launcher.
 *
 * ⚠ This file exists for ONE reason: to make the dev server's heap ceiling real.
 *
 * `next dev` does not serve anything from its own process — it forks a worker, and it decides
 * that worker's `--max-old-space-size` itself. To find out whether a limit was already asked
 * for, it calls `getMaxOldSpaceSize()` (next/dist/server/lib/utils.js), which reads the
 * NODE_OPTIONS **environment variable** and nothing else. A `--max-old-space-size` passed on
 * the command line lands in `process.execArgv`, which that lookup never reads — so Next
 * concludes no limit was requested and substitutes its own default, **half of installed RAM**,
 * overwriting whatever the command line asked for.
 *
 * The failure that produced this file: on a 21.8 GB machine that default is 10.92 GB. On
 * 2026-08-11 the dev server reached 10.31 GB working set / 14.6 GB committed during a routine
 * layout sweep and was killed at exactly that ceiling, with the machine down to 1.7 GB free.
 * The `--max-old-space-size=3072` that had been sitting in the dev script was inert the whole
 * time. The same sweep had already died the same way on 2026-08-02 — see the
 * refuse-to-write-a-partial-baseline guard in scripts/check-layout-invariants.mjs, which was
 * added to contain that crash without ever finding out why the memory was unbounded.
 *
 * So: set the limit in the ENVIRONMENT, which is where Next actually looks.
 *
 * ⚠ Do NOT "simplify" this back to `node --max-old-space-size=N node_modules/next/... dev`.
 *    That is the precise shape of the bug. It reads as correct and does nothing at all.
 *
 * Note on what this does and does not bound: the ceiling is V8's JavaScript heap. Turbopack
 * compiles in native Rust memory that V8 knows nothing about, so the process footprint will sit
 * some way above the number below — expect the ceiling to bound the runaway, not the total.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';

const require = createRequire(import.meta.url);

/** Owner-set 2026-08-11. Override for a one-off with DEV_HEAP_MB=<mb> npm run dev. */
const DEFAULT_HEAP_MB = 6144;
const MIN_HEAP_MB = 512;

const totalMb = Math.floor(os.totalmem() / 1024 / 1024);
const nextWouldPickMb = Math.floor(totalMb * 0.5);

const requested = Number(process.env.DEV_HEAP_MB);
const heapMb =
  Number.isFinite(requested) && requested >= MIN_HEAP_MB ? Math.floor(requested) : DEFAULT_HEAP_MB;

const existing = (process.env.NODE_OPTIONS ?? '').trim();
const alreadyCapped = /--max[-_]old[-_]space[-_]size/.test(existing);
const nodeOptions = alreadyCapped
  ? existing
  : `${existing} --max-old-space-size=${heapMb}`.trim();

if (alreadyCapped) {
  console.log(`dev · NODE_OPTIONS already sets a heap ceiling — leaving it alone (${existing})`);
} else {
  console.log(
    `dev · heap ceiling ${heapMb} MB of ${totalMb} MB installed ` +
      `(Next would otherwise have picked ${nextWouldPickMb} MB)`,
  );
  // A "cap" at or above what Next would have chosen anyway is decoration. Say so out loud
  // rather than letting it look like protection.
  if (heapMb >= nextWouldPickMb) {
    console.warn(
      `dev · ⚠ ${heapMb} MB is not below Next's own default of ${nextWouldPickMb} MB on this ` +
        `machine — this ceiling is not buying you anything. Lower DEV_HEAP_MB.`,
    );
  }
}

/**
 * ── Supervisor ───────────────────────────────────────────────────────────────
 *
 * Next 16.2.4's dev runtime leaks roughly 2.7 MB per request and never gives it back (measured
 * 2026-08-11 with a forced GC over the inspector: the surviving bytes trace almost entirely to
 * `next/dist/compiled/next-server/app-page-turbo.runtime.dev.js`, the DEV build of the runtime —
 * production loads the `.prod` one). In practice ~21 coach pages of ordinary clicking exhausts
 * the ceiling. When it goes, `next dev` exits outright rather than reviving its worker, so the
 * site simply stops answering until somebody notices and restarts by hand.
 *
 * Until the fix lands (Next 16.3.0, which targets exactly this), bring it back automatically.
 * This is recovery, not a cure — the log line is deliberately loud so the frequency stays
 * visible rather than becoming invisible background noise that hides how bad it is.
 *
 * ⚠ Restart ONLY what looks like a running server that fell over. A process dying immediately
 *   after boot is a broken build or a taken port, and relaunching that is an infinite loop that
 *   buries the real error.
 */
const MIN_HEALTHY_MS = 15_000;
const MAX_FAST_FAILURES = 3;
const OOM_EXIT_CODE = 134; // SIGABRT — how a V8 "heap out of memory" abort surfaces on Windows

const nextBin = require.resolve('next/dist/bin/next');

// ⚠ Self-retirement notice. The supervisor below exists ONLY for the 16.2.x leak, and a comment
// saying so is not a mechanism — bumping the pinned version does not touch this file, so without
// this the workaround quietly outlives its reason and nobody is ever prompted to delete it.
const nextVersion = require('next/package.json').version;
const [major, minor] = nextVersion.split('.').map(Number);
if (major > 16 || (major === 16 && minor >= 3)) {
  console.warn(
    `\ndev · ⚠ Next is ${nextVersion}. The dev-runtime leak this launcher supervises was fixed in\n` +
      `dev ·   16.3.0, so the auto-restart below may now be dead weight. Confirm the leak is gone\n` +
      `dev ·   (re-measure), then delete the Supervisor section and this notice.\n`,
  );
}

// ⚠ Two independent brakes, because they catch different things. The consecutive-fast-failure
// counter catches "cannot boot at all". It does NOT catch a server that limps past the healthy
// threshold and dies again, forever — that resets the counter every time, so it could thrash
// indefinitely with no cap. The rolling window catches that. Real leak cadence is a restart every
// few minutes of hard browsing, so 10 in 10 minutes is comfortably clear of normal and nowhere
// near a 16-second thrash loop (~37/10min).
const RESTART_WINDOW_MS = 10 * 60_000;
const MAX_RESTARTS_PER_WINDOW = 10;

let child = null;
let shuttingDown = false;
let fastFailures = 0;
let restarts = 0;
let startedAt = 0;
const restartTimes = []; // pruned to the window below, so it cannot grow over a long session

function launch() {
  // ⚠ Ctrl+C reaches the parent and the child independently, with no ordering guarantee between
  // them. If the child's exit lands first, the handler below has not set shuttingDown yet and
  // treats a deliberate stop as a crash — spawning a fresh server as the user is trying to quit.
  // Guarding here rather than only at the exit site closes that race and the startup-window one.
  if (shuttingDown) return;
  startedAt = Date.now();
  child = spawn(process.execPath, [nextBin, 'dev', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
  });

  child.on('error', (err) => {
    console.error(`dev · could not start Next: ${err.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    // A deliberate stop SUCCEEDED, even though the child died by signal. Reporting failure here
    // makes every clean Ctrl+C look like a broken run to anything checking the exit status.
    if (shuttingDown) return process.exit(0);
    // A clean exit is Next deciding it is done; respect that rather than fighting it.
    if (!signal && code === 0) return process.exit(0);

    const upMs = Date.now() - startedAt;
    const upDesc = upMs >= 60_000 ? `${Math.round(upMs / 60_000)}m` : `${Math.round(upMs / 1000)}s`;

    if (upMs < MIN_HEALTHY_MS) {
      if (++fastFailures >= MAX_FAST_FAILURES) {
        console.error(
          `\ndev · giving up — died ${fastFailures}× within ${MIN_HEALTHY_MS / 1000}s of starting.\n` +
            `dev · That is a startup failure (broken build, port already taken), not the memory\n` +
            `dev · leak. Fix the error above, then run npm run dev again.`,
        );
        return process.exit(code ?? 1);
      }
    } else {
      fastFailures = 0; // it ran properly for a while; this is the leak, not a boot loop
    }

    const now = Date.now();
    restartTimes.push(now);
    while (restartTimes.length && now - restartTimes[0] > RESTART_WINDOW_MS) restartTimes.shift();
    if (restartTimes.length > MAX_RESTARTS_PER_WINDOW) {
      console.error(
        `\ndev · giving up — ${restartTimes.length} restarts in the last ` +
          `${RESTART_WINDOW_MS / 60_000} minutes.\n` +
          `dev · Something is failing repeatedly rather than leaking slowly. Read the errors above;\n` +
          `dev · restarting past this point would just hide them. Fix it, then run npm run dev again.`,
      );
      return process.exit(code ?? 1);
    }

    restarts++;
    const oom = code === OOM_EXIT_CODE;
    // Windows reports a killed process as unsigned -1; printing 4294967295 helps nobody.
    const codeDesc = signal || (code > 0x7fffffff ? 'killed' : `code ${code}`);
    const why = oom
      ? `ran out of memory after ${upDesc}`
      : `exited unexpectedly after ${upDesc} (${codeDesc})`;
    // ⚠ Only blame the leak when it actually WAS the leak. Attributing every crash to a known
    // upstream bug is how a genuine, unrelated failure gets waved through as "oh, that again".
    const because = oom
      ? `dev ·   Known Next 16.2.4 dev-runtime leak; fixed upstream in 16.3.0. The first few\n` +
        `dev ·   page loads after this will recompile and feel slow. Nothing is wrong with your app.\n`
      : `dev ·   This was NOT the memory leak — check the output above for the real cause.\n`;
    console.warn(
      `\ndev · ⚠ dev server ${why} — restarting (restart #${restarts} this session).\n${because}`,
    );
    launch();
  });
}

// Ctrl+C already reaches the child through the process group on every platform we run on; this
// is here so a programmatic kill of the launcher does not orphan a dev server holding port 3000,
// and so a deliberate stop is never mistaken for a crash worth restarting.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    shuttingDown = true;
    if (child && !child.killed) child.kill(sig);
  });
}

launch();
