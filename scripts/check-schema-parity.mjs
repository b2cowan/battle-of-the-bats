/**
 * Schema-parity gate — fail when dev and prod diverge in a NEW way.
 *
 * WHY THIS EXISTS, given check-prod-migration-drift.mjs already runs:
 * that gate compares table + column EXISTENCE only. It cannot see defaults, nullability,
 * constraints, indexes or CHECKs — which is every single one of the 51 divergences catalogued
 * on 2026-07-27. It reported "prod is in sync with dev" while prod was defaulting new
 * tournaments to `completed`, hiding them from the directory, missing the games→division
 * foreign key, and missing a practice-schedule index. This gate closes that blind spot.
 *
 * Runs OFFLINE against the COMMITTED snapshots in docs/agents/db/schema-snapshots/ — no
 * network, no credentials — so it is safe in verify:changed, the pre-commit hook and the
 * deploy build. Snapshot staleness is already covered by check-snapshot-freshness.mjs (a
 * migration cannot land without a snapshot refresh), so the two gates compose:
 *   freshness  = "the snapshot reflects the migrations"
 *   parity     = "the two databases agree"
 *
 * It reuses buildDrift() from refresh-db-snapshots.mjs rather than re-deriving drift, so
 * there is exactly one definition of what a divergence is.
 *
 * Per-item ratchet: the 51 known divergences are recorded in the baseline as ACCEPTED, each
 * with a signature. A new divergence fails. A divergence whose shape CHANGES fails (an
 * accepted "prod default is false" does not silently cover "prod default is now 7"). Fixing
 * one is reported so the baseline can be lowered — the target is 0.
 *
 *   node scripts/check-schema-parity.mjs           RATCHET (default)
 *   node scripts/check-schema-parity.mjs --init    accept the current divergences
 *   node scripts/check-schema-parity.mjs --list    print every current divergence
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildDrift } from './refresh-db-snapshots.mjs';

const ROOT = process.cwd();
const SNAP = 'docs/agents/db/schema-snapshots';
const BASELINE = 'scripts/.schema-parity-baseline.json';

const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

function loadEnv(env) {
  // Reconstruct the shape buildDrift expects from the committed per-env dumps. The split
  // files preserve every field it reads; `rls` lives only in the combined canonical file.
  const combined = readJson(`${SNAP}/schema_dumps.json`);
  return {
    columns: readJson(`${SNAP}/schema-dump-columns-${env}.json`),
    constraints: readJson(`${SNAP}/schema-dump-constraints-${env}.json`),
    indexes: readJson(`${SNAP}/schema-dump-indexes-${env}.json`),
    rls: combined?.[env]?.rls ?? [],
  };
}

let drift;
try {
  drift = buildDrift({ dev: loadEnv('dev'), prod: loadEnv('prod') });
} catch (e) {
  console.error('✖ Schema-parity gate could not read the committed snapshots.');
  console.error(`  ${e.message}`);
  console.error('  Run `npm run refresh:snapshots` (needs SUPABASE_ACCESS_TOKEN) and commit the result.');
  process.exit(1);
}

const current = new Map(drift.items.map(i => [i.key, i.sig]));

if (process.argv.includes('--list')) {
  console.log(`${drift.total} divergence(s): ${JSON.stringify(drift.counts)}\n`);
  for (const [k, sig] of [...current].sort()) console.log(`  ${k}${sig ? `\n      ${sig}` : ''}`);
  process.exit(0);
}

if (process.argv.includes('--init')) {
  writeFileSync(
    join(ROOT, BASELINE),
    JSON.stringify(
      {
        _comment:
          'ACCEPTED dev↔prod divergences (scripts/check-schema-parity.mjs). Every entry is debt, ' +
          'not a decision — the target is an empty object. A NEW divergence, or an accepted one ' +
          'whose signature changes, fails the gate. Lower this as items are reconciled; re-init ' +
          'only after refreshing the snapshots.',
        accepted: Object.fromEntries([...current].sort()),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Baseline written: ${BASELINE} — ${current.size} accepted divergence(s).`);
  process.exit(0);
}

const baseline = existsSync(join(ROOT, BASELINE)) ? readJson(BASELINE).accepted ?? {} : {};

const added = [...current].filter(([k]) => !(k in baseline));
const changed = [...current].filter(([k, sig]) => k in baseline && baseline[k] !== sig);
const resolved = Object.keys(baseline).filter(k => !current.has(k));

if (added.length || changed.length) {
  console.error('✖ Schema parity: dev and prod diverge in a way the baseline does not cover.');
  for (const [k, sig] of added) console.error(`    NEW      ${k}${sig ? `\n                 ${sig}` : ''}`);
  for (const [k, sig] of changed) {
    console.error(`    CHANGED  ${k}`);
    console.error(`                 was: ${baseline[k] || '(none)'}`);
    console.error(`                 now: ${sig || '(none)'}`);
  }
  console.error('  Apply the migration to BOTH environments, then `npm run refresh:snapshots`.');
  console.error(`  Genuinely accepted? re-baseline: node scripts/check-schema-parity.mjs --init`);
  process.exit(1);
}

if (resolved.length) {
  console.log(`✓ Schema parity: ${resolved.length} divergence(s) RESOLVED since the baseline — lower it:`);
  for (const k of resolved.sort()) console.log(`    fixed  ${k}`);
  console.log('    node scripts/check-schema-parity.mjs --init');
}
console.log(`✓ Schema parity: ${current.size} accepted divergence(s), none new. (target: 0)`);
