/**
 * Remove orphaned draft tournaments left behind when the setup wizard created
 * the tournament row but a later step (divisions insert) failed — leaving a
 * contentless draft that blocks retries on the slug/name uniqueness check.
 *
 * SAFE BY DESIGN: only deletes a tournament that is status='draft' AND has zero
 * divisions, teams, and games. Anything with content is reported and skipped.
 *
 * Also probes whether divisions.min_age is still NOT NULL in this database
 * (via the PostgREST OpenAPI schema) so we know if a retry will succeed.
 *
 * Run against PROD:  node --env-file=.env.production.local scripts/cleanup-orphan-draft-tournaments.mjs
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(URL, KEY, { auth: { persistSession: false } });

const ORG_SLUG = 'bob-test-org';
const TOURNAMENT_SLUG = '2026-tournament';

// --- Locate the org ---------------------------------------------------------
const { data: orgs, error: orgErr } = await db.from('organizations').select('id, name').eq('slug', ORG_SLUG);
if (orgErr) { console.error('Org lookup failed:', orgErr.message); process.exit(1); }
const org = orgs?.[0];
if (!org) { console.error(`Org "${ORG_SLUG}" not found`); process.exit(1); }
console.log(`Org: ${org.name} (${org.id})`);

// --- Find candidate draft tournaments --------------------------------------
const { data: tours, error: tErr } = await db
  .from('tournaments')
  .select('id, name, slug, status')
  .eq('org_id', org.id)
  .eq('slug', TOURNAMENT_SLUG);
if (tErr) { console.error('Tournament lookup failed:', tErr.message); process.exit(1); }

if (!tours?.length) {
  console.log(`No tournaments with slug "${TOURNAMENT_SLUG}" in this org — nothing to clean up.`);
} else {
  for (const t of tours) {
    const [{ count: divCount }, { count: teamCount }, { count: gameCount }] = await Promise.all([
      db.from('divisions').select('*', { count: 'exact', head: true }).eq('tournament_id', t.id),
      db.from('teams').select('*', { count: 'exact', head: true }).eq('tournament_id', t.id),
      db.from('games').select('*', { count: 'exact', head: true }).eq('tournament_id', t.id),
    ]);

    const contentless = (divCount ?? 0) === 0 && (teamCount ?? 0) === 0 && (gameCount ?? 0) === 0;
    const label = `  • ${t.name} [${t.slug}] status=${t.status} — divisions=${divCount} teams=${teamCount} games=${gameCount}`;

    if (t.status === 'draft' && contentless) {
      const { error: delErr } = await db.from('tournaments').delete().eq('id', t.id).eq('org_id', org.id);
      if (delErr) console.error(`${label}\n    ❌ delete failed: ${delErr.message}`);
      else console.log(`${label}\n    ✅ deleted (orphaned draft)`);
    } else {
      console.log(`${label}\n    ⏭  SKIPPED (not an empty draft — left untouched for safety)`);
    }
  }
}

// --- Probe divisions.min_age nullability via PostgREST OpenAPI --------------
try {
  const res = await fetch(`${URL}/rest/v1/`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  const spec = await res.json();
  const required = spec?.definitions?.divisions?.required ?? [];
  const minAgeRequired = required.includes('min_age');
  const maxAgeRequired = required.includes('max_age');
  console.log('\nSchema check — divisions age columns:');
  console.log(`  min_age NOT NULL? ${minAgeRequired ? 'YES — migration 108 NOT applied ❌' : 'no — nullable ✅'}`);
  console.log(`  max_age NOT NULL? ${maxAgeRequired ? 'YES — migration 108 NOT applied ❌' : 'no — nullable ✅'}`);
  if (minAgeRequired || maxAgeRequired) {
    console.log('  ⚠  Apply migration 108 in the Supabase SQL editor BEFORE retrying, or setup will 500 again.');
  } else {
    console.log('  Retry should now succeed.');
  }
} catch (e) {
  console.log('\nSchema check skipped (could not read PostgREST schema):', e.message);
}

console.log('\nDone.');
