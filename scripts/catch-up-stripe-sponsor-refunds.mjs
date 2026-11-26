/**
 * catch-up-stripe-sponsor-refunds.mjs — Board Ready Stage 6 fixes Part A, ask 5 (RULED 2026-11-25): the ONE-TIME catch-up.
 *
 * A refund a club made in its own Stripe dashboard on a sponsor's card payment, before mig 542 shipped, sits as an open
 * "refund made in Stripe" notice and is in nobody's books. This reads each one's refund back from Stripe and records it the
 * new way, through the same code as a live event (lib/online-payment-landing.ts `catchUpStripeSponsorRefunds`). Safe to run
 * twice: the record is keyed on Stripe's refund id. A family's or a team's notice is left as it is.
 *
 * DEV ONLY. It refuses unless the Supabase URL is the dev project and the Stripe key is a test key. Production was counted
 * instead; running it there is a separate owner decision.
 *
 * Usage:
 *   node scripts/catch-up-stripe-sponsor-refunds.mjs           # look only: how many open notices of the old kind
 *   node scripts/catch-up-stripe-sponsor-refunds.mjs --write   # record them
 */
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { PROJECTS } from './lib/supabase-ops.mjs'; // loads .env.local

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The app's server code, loaded outside Next: the repo's own loader (tests/ts-resolver.mjs) can't compile lib/db.ts or resolve
// the `@/` alias, so jiti compiles the TypeScript; `server-only` (Next's empty marker) is a stub.
const require = createRequire(import.meta.url);
const jiti = require('jiti')(fileURLToPath(import.meta.url), {
  alias: { '@': ROOT, 'server-only': path.join(ROOT, 'scripts/lib/server-only-stub.cjs') }, interopDefault: true, esmResolve: true,
});
if (!(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').includes(PROJECTS.dev)) { console.error('Not the dev database: stopping.'); process.exit(1); }
// Live or test is decided in one place (lib/stripe-mode.ts), never by a prefix test of a script's own.
if (!jiti('../lib/stripe-mode.ts').stripeKeyIsTest()) { console.error('Not a Stripe test key: stopping.'); process.exit(1); }

const write = process.argv.includes('--write');
const { catchUpStripeSponsorRefunds } = jiti('../lib/online-payment-landing.ts');
const out = await catchUpStripeSponsorRefunds({ write });
console.log(`Open "refund made in Stripe" notices of the old kind: ${out.looked} refund(s).`);
console.log(write ? JSON.stringify(out) : 'Look only. Run with --write to record them.');
process.exit(0);
