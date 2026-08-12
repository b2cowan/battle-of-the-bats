/**
 * Memory guard for the checks that drive a browser through many pages.
 *
 * Why this exists: the dev server compiles each route on first visit and then holds it for the
 * life of the process — it never gives that memory back. So a sweep is the one thing in this
 * repo that reliably walks the machine into swap, and it does it while the operator is watching
 * a progress log that looks completely healthy. On 2026-08-11 that ended with the dev server
 * killed at its heap ceiling and 1.7 GB free; on 2026-08-02 it ended with 26 of 112 screens
 * unmeasured. scripts/dev.mjs stops the dev server itself from being the thing that eats the
 * machine — this stops a sweep from riding it down when something else already has.
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

function repairLines() {
  return [
    'The dev server never releases what it compiled, so one that has already been swept stays',
    'large until it is restarted. Restart it, then re-run:',
    '    1. stop `npm run dev`   2. npm run dev   3. re-run this check',
    `To move the trip point deliberately: DEV_FREE_FLOOR_MB=<mb> (default ${DEFAULT_FLOOR_MB}).`,
  ];
}

/**
 * Refuse to start a long browser sweep on a machine that is already out of room. Prints the
 * headroom either way, so the number is on the record when a run does go wrong.
 */
export function preflight(label) {
  const free = freeMb();
  const floor = floorMb();
  console.log(`${label} · ${free} MB free of ${totalMb()} MB · will abort below ${floor} MB`);
  if (free >= floor) return;
  console.error(`\n✗ Not enough free memory to start (${free} MB free, floor ${floor} MB).`);
  for (const l of repairLines()) console.error(`  ${l}`);
  process.exit(1);
}

/**
 * Watches headroom across a run. `check()` returns null while things are fine and a trip object
 * when they are not — it does NOT exit, because the caller has a browser to close and a baseline
 * it must not write. Track the low-water mark so a run that survives still reports how close it
 * came.
 */
export function createWatchdog(label) {
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
    report(trip) {
      console.error(
        `\n✗ Aborted ${label} — free memory fell to ${trip.free} MB ` +
          `(floor ${trip.floor} MB) at ${trip.where}.`,
      );
      console.error('  Stopped on purpose: going further takes the whole machine down with it,');
      console.error('  and a partial sweep must never be written as a baseline.');
      for (const l of repairLines()) console.error(`  ${l}`);
    },
    /** Called on a clean finish — the run survived, but say how close it came. */
    summarise() {
      const margin = low - floor;
      const note =
        margin <= 512
          ? '  ⚠ That is close to the abort floor. Restart the dev server before the next sweep.'
          : '';
      console.log(`\nMemory low-water mark: ${low} MB free (floor ${floor} MB).${note ? '\n' + note : ''}`);
    },
  };
}
