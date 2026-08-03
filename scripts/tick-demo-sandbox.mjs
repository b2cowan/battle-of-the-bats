/**
 * Run one demo-sandbox reconcile from the command line.
 *
 * Same implementation the scheduled route uses (`lib/demo-reconcile-core.ts`) — this just hands
 * it a service-role client instead of the app's. Useful for:
 *   • watching the demo advance during development without waiting for a scheduler;
 *   • repairing a sandbox that has gone stale;
 *   • proving the tick works before any scheduler is wired up.
 *
 * Add `--watch` to keep ticking every 30 seconds, which is roughly what a visitor experiences.
 *
 * Run: node --env-file=.env.local scripts/tick-demo-sandbox.mjs [--watch]
 */
import { createClient } from '@supabase/supabase-js';
import { reconcileDemoTournament } from '../lib/demo-reconcile-core.ts';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const watch = process.argv.includes('--watch');

async function tick() {
  const result = await reconcileDemoTournament(db);
  const stamp = new Date().toLocaleTimeString('en-CA', { timeZone: 'America/Toronto' });
  if (!result.ok) {
    console.error(`[${stamp}] ✗ ${result.errors.join('; ')}`);
    return false;
  }
  if (result.phase === null) {
    console.log(`[${stamp}] sandbox not seeded here — nothing to do`);
    return true;
  }
  const summary = `${result.phase} · minute ${result.minuteInCycle} · ${result.gamesUpdated}/${result.gamesExamined} game(s) updated`;
  console.log(`[${stamp}] ✓ ${summary}`);
  result.changes.forEach(change => console.log(`            ${change}`));
  return true;
}

const first = await tick();
if (!watch) process.exit(first ? 0 : 1);

console.log('\nWatching — one tick every 30s. Ctrl+C to stop.\n');
setInterval(tick, 30_000);
