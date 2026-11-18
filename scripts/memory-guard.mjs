/**
 * Memory guard for the checks that drive a browser through many pages.
 *
 * Why this exists: on Next ≤16.2.x the dev server compiled each route on first visit and held it
 * for the life of the process — a sweep was the one thing in this repo that reliably walked the
 * machine into swap, while the operator watched a progress log that looked completely healthy.
 * On 2026-08-11 that ended with the dev server killed at its heap ceiling and 1.7 GB free; on
 * 2026-08-02 it ended with 26 of 112 screens unmeasured. scripts/dev.mjs stops the dev server
 * itself from being the thing that eats the machine — this stops a sweep from riding it down
 * when something else already has.
 *
 * ⚠ 16.3.0 (re-measured 2026-08-12) changed the shape of the risk, not the need for the guard:
 *   compile memory now largely returns at the PROCESS level and a full sweep ends far from the
 *   ceiling — but compiles still SPIKE while they run, the V8 heap keeps what it holds, and the
 *   per-request drip persists (scripts/dev.mjs's header is the single home for those numbers).
 *   An abort-before-partial-baseline guard on total-system free memory stays correct even on a
 *   healthy framework — that was the keep-forever verdict in NEXT_16_3_UPGRADE_PLAN.md §6.
 *
 * The signal is free physical memory, deliberately: it needs no process enumeration, behaves the
 * same on every platform, and it is the quantity that actually decides whether the machine stays
 * usable. It is a blunt instrument — Windows keeps free memory low on purpose — so the floor is
 * set low enough to mean real trouble rather than ordinary busyness.
 *
 * ⚠ A trip must never be treated as "the sweep finished with no findings". Callers stop, close
 *   their browser, and exit non-zero BEFORE any baseline is written — an aborted run has
 *   unmeasured screens, and a baseline written from one records the product as cleaner than it
 *   is. That is not theoretical; it is why check-layout-invariants.mjs refuses partial runs.
 */
import os from 'node:os';

const MB = 1024 * 1024;

/** Low enough to mean genuine trouble, not ordinary Windows bookkeeping. */
const DEFAULT_FLOOR_MB = 1536;

export const freeMb = () => Math.round(os.freemem() / MB);
export const totalMb = () => Math.round(os.totalmem() / MB);

export function floorMb() {
  const raw = Number(process.env.DEV_FREE_FLOOR_MB);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_FLOOR_MB;
}

/**
 * `remote` — the sweep is pointed at another server (staging, a production build), so the memory that ran out is
 * this PC's browsers beside other work, and restarting the dev server would not help. (Release process hardening,
 * Stage 1A: the old text told a staging run to restart a dev server it was not using.)
 */
function repairLines({ remote = false, resumeCommand = null } = {}) {
  const lines = remote
    ? [
        'The server is remote; what ran low is this PC. Stop other heavy work beside the sweep',
        '(type-checks, dev servers, another sweep), or run fewer pages at once (--workers=1).',
      ]
    : [
        'A dev server that has been swept or heavily browsed may still be holding memory (the',
        'per-request drip persists even on 16.3+). Restart it, then re-run:',
        '    1. stop `npm run dev`   2. npm run dev   3. re-run this check',
      ];
  if (resumeCommand) lines.push(`Finished screens are kept: ${resumeCommand} measures only the rest.`);
  lines.push(`To move the trip point deliberately: DEV_FREE_FLOOR_MB=<mb> (default ${DEFAULT_FLOOR_MB}).`);
  return lines;
}

/**
 * Refuse to start a long browser sweep on a machine that is already out of room. Prints the
 * headroom either way, so the number is on the record when a run does go wrong.
 */
export function preflight(label, opts = {}) {
  const free = freeMb();
  const floor = floorMb();
  console.log(`${label} · ${free} MB free of ${totalMb()} MB · will abort below ${floor} MB`);
  if (free >= floor) return;
  console.error(`\n✗ Not enough free memory to start (${free} MB free, floor ${floor} MB).`);
  for (const l of repairLines(opts)) console.error(`  ${l}`);
  process.exit(1);
}

/**
 * THE PAUSE DECISION (Stage 1A, 2026-11-15) — pure, so it is unit-tested. After a trip, a caller that can wait polls
 * this: resume once free memory is back above the floor PLUS a margin (back exactly at the floor would trip again on
 * the next page), keep waiting while there is time, give up when the wait runs out. Giving up is today's abort.
 * @returns {'resume'|'wait'|'give-up'}
 */
export function pauseDecision({ free, floor, marginMb, waitedMs, maxWaitMs }) {
  if (free >= floor + marginMb) return 'resume';
  return waitedMs < maxWaitMs ? 'wait' : 'give-up';
}

/** The pause's defaults: wait up to 10 minutes, polling every 15 s, for the floor plus 512 MB. */
export const PAUSE_DEFAULTS = { maxWaitMs: 10 * 60_000, pollMs: 15_000, marginMb: 512 };

/**
 * Watches headroom across a run. `check()` returns null while things are fine and a trip object
 * when they are not — it does NOT exit, because the caller has a browser to close and a baseline
 * it must not write. Track the low-water mark so a run that survives still reports how close it
 * came.
 */
export function createWatchdog(label, opts = {}) {
  // Read the floor once. It cannot change mid-run, and pinning it here means `check()` and
  // `summarise()` are obviously talking about the same number rather than two reads to reconcile.
  const floor = floorMb();
  let low = freeMb();
  return {
    check(where) {
      const free = freeMb();
      if (free < low) low = free;
      return free >= floor ? null : { where, free, floor };
    },
    /**
     * Beside `check()`, for a caller that can stop handing out work and WAIT (the layout sweep, Stage 1A). Polls until
     * `pauseDecision` says resume or give up. `check()` is unchanged, so every other caller keeps the abort it has.
     * @returns {Promise<{ recovered: boolean, free: number, waitedMs: number }>}
     */
    async waitForHeadroom({ maxWaitMs = PAUSE_DEFAULTS.maxWaitMs, pollMs = PAUSE_DEFAULTS.pollMs, marginMb = PAUSE_DEFAULTS.marginMb } = {}) {
      const started = Date.now();
      for (;;) {
        const free = freeMb();
        if (free < low) low = free;
        const waitedMs = Date.now() - started;
        const d = pauseDecision({ free, floor, marginMb, waitedMs, maxWaitMs });
        if (d !== 'wait') return { recovered: d === 'resume', free, waitedMs };
        await new Promise((r) => setTimeout(r, pollMs));
      }
    },
    /** The lowest free memory seen so far, for a run's cost line. */
    lowWater: () => low,
    floor,
    report(trip) {
      console.error(
        `\n✗ Aborted ${label} — free memory fell to ${trip.free} MB ` +
          `(floor ${trip.floor} MB) at ${trip.where}.`,
      );
      console.error('  Stopped on purpose: going further takes the whole machine down with it,');
      console.error('  and a partial sweep must never be written as a baseline.');
      for (const l of repairLines(opts)) console.error(`  ${l}`);
    },
    /** Called on a clean finish — the run survived, but say how close it came. */
    summarise() {
      const margin = low - floor;
      const note =
        margin <= 512
          ? opts.remote
            ? '  ⚠ That is close to the abort floor. Stop other heavy work on this PC before the next sweep.'
            : '  ⚠ That is close to the abort floor. Restart the dev server before the next sweep.'
          : '';
      console.log(`\nMemory low-water mark: ${low} MB free (floor ${floor} MB).${note ? '\n' + note : ''}`);
    },
  };
}
