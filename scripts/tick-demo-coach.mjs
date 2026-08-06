/**
 * Run one coach-sandbox re-anchor from the command line.
 *
 * Same implementation the scheduled route uses (`lib/demo-coach-reconcile-core.ts`) — this just
 * hands it a service-role client instead of the app's. The tournament sandbox has had this since
 * it was built (`tick-demo-sandbox.mjs`); the coach one only had the API route, so "run the ticker
 * by hand" meant hitting a platform-admin endpoint or re-running the whole seed.
 *
 * That matters more than it sounds: **migration 226 (the nightly schedule) is not applied to the
 * dev database**, so on dev nothing re-anchors the coach demo overnight and it is a day stale every
 * morning. Until that migration lands, this is how the demo gets put right.
 *
 * Safe to run repeatedly: the reconcile is diff-only and idempotent — a steady day writes zero rows
 * (verified over two consecutive passes, 2026-08-05).
 *
 * Run: node --env-file=.env.local scripts/tick-demo-coach.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { reconcileCoachSandbox } from '../lib/demo-coach-reconcile-core.ts';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const result = await reconcileCoachSandbox(db, new Date());
const stamp = new Date().toLocaleTimeString('en-CA', { timeZone: 'America/Toronto' });

if (!result.seeded) {
  console.log(`[${stamp}] coach sandbox not seeded here — nothing to do`);
  process.exit(0);
}

if (result.failures?.length) {
  console.error(`[${stamp}] ✗ ${result.failures.join('; ')}`);
  process.exit(1);
}

console.log(`[${stamp}] ✓ coach sandbox re-anchored · ${result.rowsShifted} row(s) written`);
result.notes.forEach(note => console.log(`            ${note}`));
