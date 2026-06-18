// DEV-ONLY: open the Coaches Portal Premium ('team') self-serve checkout gate on the dev database.
// Flips plan_gating.team from 'early_access' to 'live' so /coaches/start shows the real checkout
// instead of the express-interest form. Targets the dev Supabase project ONLY and hard-aborts if
// the configured URL looks like prod. Reversible: set gating_status back to 'early_access'.
//
//   node scripts/dev-open-team-gate.mjs
//
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('ABORT: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env.local.');
  process.exit(1);
}

// Safety rails — this script may ONLY touch the dev project.
const PROD_REF = 'qcttcboqysynwcdyghil';
const DEV_REF = 'npgnrxaitgbtbtvvykto';
if (url.includes(PROD_REF) || !url.includes(DEV_REF)) {
  console.error(`ABORT: Supabase URL is not the dev project (got ${url}). Refusing to modify plan_gating.`);
  process.exit(1);
}

const supa = createClient(url, key, { auth: { persistSession: false } });

const { data: before, error: selErr } = await supa
  .from('plan_gating')
  .select('plan_key, gating_status')
  .eq('plan_key', 'team')
  .maybeSingle();

if (selErr) {
  console.error('ABORT: could not read plan_gating:', selErr.message);
  process.exit(1);
}
console.log(`Dev project: ${DEV_REF}`);
console.log('plan_gating.team before:', before);

if (!before) {
  console.error("ABORT: no plan_gating row for plan_key='team' on dev. (Migration 065 may not have run.)");
  process.exit(1);
}
if (before.gating_status === 'live') {
  console.log('✓ Already live — Coaches Portal Premium checkout is already open on dev. No change made.');
  process.exit(0);
}

const { error: updErr } = await supa
  .from('plan_gating')
  .update({ gating_status: 'live' })
  .eq('plan_key', 'team');

if (updErr) {
  console.error('ABORT: update failed:', updErr.message);
  process.exit(1);
}

const { data: after } = await supa
  .from('plan_gating')
  .select('plan_key, gating_status')
  .eq('plan_key', 'team')
  .maybeSingle();

console.log('plan_gating.team after:', after);
console.log('✓ Coaches Portal Premium (team) gate opened on DEV. Self-serve checkout is now live on dev.fieldlogichq.ca.');
console.log('  To revert: set gating_status back to \'early_access\' for plan_key=team on the dev DB.');
