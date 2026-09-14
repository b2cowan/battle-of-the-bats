/**
 * The demo world's fingerprint, and the stamp a seed leaves behind.
 *
 * ── WHY ──────────────────────────────────────────────────────────────────────
 *
 * The two public demos are seeded worlds inside the real product. Their DATES are kept true by the
 * nightly scheduler; their CONTENT is whatever the seed last wrote. Until 2026-09-13 the only way
 * content reached production was a person running the seed from a laptop — a step that was "owed"
 * for weeks at a time, and that twice wrote an UNRELEASED world onto the public demo because the
 * laptop was ahead of what was deployed (release history, 2026-09-04 and 2026-09-08).
 *
 * This module lets the BUILD do it instead. A fingerprint answers "what world would this checkout
 * seed?"; a stamp answers "what world did the last seed write?". When they differ, the world has
 * moved and the build re-seeds — from exactly the commit it is deploying, which is the one place a
 * seed can never be ahead of the code. See `reseed-demos-if-stale.mjs` and
 * `DEMO_PROCESS_DECOUPLING_PLAN.md`.
 *
 * ── WHAT IS IN THE FINGERPRINT ───────────────────────────────────────────────
 *
 * sha256 over, in a fixed order:
 *   · the seed script and EVERY file it imports by a relative path, transitively — the world
 *     module, the org registry, the budget rules the seed borrows (`budgetLineKindForItem` and
 *     friends). A rule change the seed merely CALLS still changes the rows it writes, so the
 *     import graph is the honest boundary, not the seed file alone;
 *   · the list of migration FILENAMES. A migration can reshape what the product reads from the
 *     rows the seed wrote without touching the seed (mig 280's "kind comes from the word" was
 *     exactly that), so any release that changes the database reseeds. Reseeds are cheap (~30s,
 *     diff-stable ids, every public link survives), so over-triggering costs nothing and
 *     under-triggering is the whole failure this exists to prevent.
 *
 * Package imports (`@supabase/supabase-js`, `crypto`) are NOT walked — a dependency bump is not
 * a world change, and following node_modules would make every fingerprint unstable.
 *
 * ── THE STAMP ────────────────────────────────────────────────────────────────
 *
 * The latest `platform_audit_log` row for the demo org with action `demo_world_seeded`. No new
 * column, no migration: the audit log already exists to record what was done to an org and by
 * whom, and "this world was seeded from fingerprint X by build Y" is precisely that. Written by
 * the seed itself on SUCCESS ONLY, so a seed that died halfway leaves the old stamp in place and
 * the next build tries again.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const STAMP_ACTION = 'demo_world_seeded';

const RESOLVE_EXTENSIONS = ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx', '/index.mjs', '/index.js'];
// `import x from './y'`, `import './y'`, `export … from './y'`, and dynamic `import('./y')`.
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[^'"`]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolveRelative(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Every file reachable from `entry` through relative imports, `entry` included, sorted. */
export function importGraph(entry) {
  const seen = new Set();
  const stack = [path.resolve(entry)];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (!spec || !spec.startsWith('.')) continue;
      const resolved = resolveRelative(file, spec);
      if (resolved) stack.push(resolved);
    }
  }
  return [...seen].sort();
}

function migrationNames() {
  const dir = path.join(ROOT, 'supabase', 'migrations');
  return readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
}

/**
 * The fingerprint for one seed entry point — a short hex string plus the inputs, so a build log
 * can say WHY two fingerprints differ without anyone diffing by hand.
 */
export function demoWorldFingerprint(seedEntry) {
  const files = importGraph(path.resolve(ROOT, seedEntry));
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(path.relative(ROOT, file).replaceAll('\\', '/'));
    hash.update('\0');
    // Normalise line endings — the same file must hash the same on a Windows checkout and on the
    // Linux build image, or every master build would reseed for no reason.
    hash.update(readFileSync(file, 'utf8').replaceAll('\r\n', '\n'));
    hash.update('\0');
  }
  const migrations = migrationNames();
  hash.update(migrations.join('\n'));
  return {
    fingerprint: hash.digest('hex').slice(0, 16),
    files: files.map(f => path.relative(ROOT, f).replaceAll('\\', '/')),
    migrationCount: migrations.length,
    lastMigration: migrations.at(-1) ?? null,
  };
}

/** The latest stamp for an org, or null when it has never been stamped. */
export async function readDemoWorldStamp(db, orgId) {
  const { data, error } = await db
    .from('platform_audit_log')
    .select('new_value, created_at')
    .eq('org_id', orgId)
    .eq('action', STAMP_ACTION)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`reading the demo world stamp: ${error.message}`);
  if (!data) return null;
  return { ...(data.new_value ?? {}), stampedAt: data.created_at };
}

/**
 * Written by a seed at the very end, after every row is in. `actor` names who ran it: the Amplify
 * build (`amplify-build:<branch>`) or a person (their shell user), so the audit row reads honestly.
 */
export async function writeDemoWorldStamp(db, orgId, { seedEntry, actor }) {
  const { fingerprint, migrationCount, lastMigration } = demoWorldFingerprint(seedEntry);
  const stamp = {
    fingerprint,
    seed: seedEntry.replaceAll('\\', '/'),
    commit: process.env.AWS_COMMIT_ID ?? process.env.GIT_COMMIT ?? null,
    branch: process.env.AWS_BRANCH ?? null,
    node: process.versions.node,
    migrationCount,
    lastMigration,
  };
  const { error } = await db.from('platform_audit_log').insert({
    actor_email: actor,
    org_id: orgId,
    action: STAMP_ACTION,
    field: 'fingerprint',
    old_value: null,
    new_value: stamp,
  });
  if (error) throw new Error(`writing the demo world stamp: ${error.message}`);
  return stamp;
}

/** Who to name on a stamp row. */
export function stampActor() {
  if (process.env.AWS_BRANCH) return `amplify-build:${process.env.AWS_BRANCH}`;
  return `seed-script:${process.env.USERNAME ?? process.env.USER ?? 'unknown'}`;
}
