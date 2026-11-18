/**
 * run-stripe-fees-daily-dev.mjs — run the daily job once on the DEV server, the way the schedule runs it, and print what its
 * two Stripe fee steps did (Stripe-owned pricing Stage 3). For owner walks: some book lines are written only by the daily job
 * (Stripe's fee on a payment it wasn't ready for at the landing, so "Stripe’s extra"; a stand-alone fee Stripe bills hours
 * later, such as a failed debit's $5 or an answered dispute's $15).
 *
 * Run:  node --env-file=.env.local scripts/run-stripe-fees-daily-dev.mjs            (dev server on http://localhost:3000)
 *       node --env-file=.env.local scripts/run-stripe-fees-daily-dev.mjs --base http://localhost:3001
 *
 * It runs EVERY step of the daily job (the route has no single-step mode), as the schedule would. ⚠ DEV ONLY: refuses unless
 * the Supabase URL it loaded is the dev project and the base is a localhost address. The secret is read from .env.local
 * (CRON_SECRET) and never printed; the one-use receipt is the same one the scheduler writes (`fireJob`, mig 502).
 */
import { createClient } from '@supabase/supabase-js';
import { fireJob } from './lib/billing-walk-fixture.mjs';

const DEV_REF = 'npgnrxaitgbtbtvvykto';
const argv = process.argv.slice(2);
const at = argv.indexOf('--base');
const BASE = at >= 0 ? argv[at + 1] : 'http://localhost:3000';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try { process.loadEnvFile('.env.local'); } catch { /* the checks below say what is missing */ }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const secret = process.env.CRON_SECRET ?? '';
if (!url.includes(DEV_REF)) { console.error(`✗ Refusing: the Supabase URL is not the dev project (${DEV_REF}).`); process.exit(1); }
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) { console.error(`✗ Refusing: ${BASE} is not a localhost address.`); process.exit(1); }
if (!key || !secret) { console.error('✗ SUPABASE_SERVICE_ROLE_KEY or CRON_SECRET is missing from .env.local.'); process.exit(1); }

const db = createClient(url, key, { auth: { persistSession: false } });
console.log(`Running the daily job on ${BASE} …`);
const res = await fireJob(db, { base: BASE, path: '/api/platform-admin/stripe-fees-daily', jobName: 'stripe_fees_tick', secret })
  .catch(e => { console.error(`✗ ${e instanceof Error ? e.message : e}`); process.exit(1); });
const text = await res.text();
let body;
try { body = JSON.parse(text); } catch { console.error(`✗ HTTP ${res.status}: ${text.slice(0, 300)}`); process.exit(1); }
const steps = body.steps ?? [];
const stripe = steps.filter(s => s.step === 'stripe_fee_catch_up' || s.step === 'standalone_stripe_fees');
for (const s of stripe) console.log(`  ${s.step.padEnd(22)} ${s.ok ? 'ok' : 'FAILED'}  ${JSON.stringify(s.result ?? s.error)}`);
const others = steps.filter(s => !stripe.includes(s) && !s.ok).map(s => s.step);
if (others.length) console.log(`  (other steps that did not finish: ${others.join(', ')})`);
console.log(stripe.length === 2 && stripe.every(s => s.ok) ? '✓ Done. Reload the page you were on.' : '✗ A Stripe fee step did not finish (see above).');
process.exit(stripe.length === 2 && stripe.every(s => s.ok) ? 0 : 1);
