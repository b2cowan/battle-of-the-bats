/**
 * Re-date the public tournament pages' time-sensitive layout fixtures to NOW, right before a layout sweep. DEV only.
 *
 *   node scripts/refresh-layout-public-fixtures.mjs
 *
 * Why this exists (Release process hardening, Stage 1A, 2026-11-15): 35 `pubt-*` screens did not render on staging on
 * 2026-11-14, and the run spent 2 h 18 min waiting on them. Nothing was wrong with the pages. Their fixtures had been
 * dated around the day they were prepared (3 to 7 November), and the states those screens measure are states of the
 * CLOCK:
 *   - a game is live only from its start to 2 hours after it (`isGameLive`, lib/game-status.ts);
 *   - a bracket is "upcoming" only while its next game is in the future (lib/public-playoffs.ts);
 *   - the schedule's day rail marks today only when a game is dated today.
 * The product read every one of them correctly as over. No header or setting pins the page's clock, so the fixtures
 * have to move instead.
 *
 * It runs the two fixture scripts the screen list names (scripts/layout-screens.mjs):
 *   1. seed-public-stage3-fixtures.mjs prepare: re-dates the Lakeshore fixture in place (its own backup is kept);
 *   2. seed-public-stage4-fixtures.mjs undo, then prepare: rebuilds the five marked Metro clones from today.
 * Neither touches a sign-in, so it is safe beside saved UAT sessions. ⚠ It is NOT safe DURING a sweep: step 2 deletes
 * and re-creates tournaments a running sweep may be measuring. Run it, then start the sweep.
 *
 * ⚠ THE LIVE STATE LASTS ABOUT 1 HOUR 50 MINUTES from this run (the game starts 10 minutes ago, and the live window is
 * 2 hours). Run it again before the dark pass if the warm pass took longer than that. The sweep's first-minute check
 * tells you when it is needed.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (script, mode) => {
  console.log(`\n▸ ${script} ${mode}`);
  execFileSync(process.execPath, ['--env-file=.env.local', path.join('scripts', script), mode], { cwd: ROOT, stdio: 'inherit' });
};

run('seed-public-stage3-fixtures.mjs', 'prepare');
if (existsSync(path.join(ROOT, '.probe/stage4-fixtures.json'))) run('seed-public-stage4-fixtures.mjs', 'undo');
run('seed-public-stage4-fixtures.mjs', 'prepare');

const until = new Date(Date.now() + 110 * 60_000);
// en-CA writes the house clock ("8:00 a.m.").
const clock = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: 'numeric', minute: '2-digit', hour12: true }).format(until);
console.log(`\n✓ Public sweep fixtures dated from now. The live games read as live until about ${clock} (Toronto).`);
