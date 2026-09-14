/**
 * Re-seed a demo sandbox whose world has moved — the build step that retired the manual reseed.
 *
 * ── WHY THIS RUNS IN THE BUILD ───────────────────────────────────────────────
 *
 * Both public demos are seeded worlds inside the real product. A release that changes the demo
 * world ships the feature to prod and leaves the demo's ROWS behind — silently, on a page a
 * prospect is reading — unless someone re-seeds. Until 2026-09-13 that someone was a person with a
 * laptop, and the step was "owed" for weeks at a time; twice it was run from a checkout AHEAD of
 * what was deployed, which put an unreleased world on the public demo (release history, 09-04 and
 * 09-08). The owner's ruling (`DEMO_PROCESS_DECOUPLING_PLAN.md`): a release never waits on a demo.
 *
 * The Amplify build is the one place a seed can never be ahead of the code: it has Node, the
 * credentials, the files and the exact commit being deployed. So it runs here, last in `build`.
 *
 * ── WHAT IT DOES ─────────────────────────────────────────────────────────────
 *
 * For each sandbox: compute the world fingerprint of THIS checkout (`demo-world-fingerprint.mjs`
 * — the seed, everything it imports, and the migration list), read the stamp the last seed left
 * on the org, and re-run the seed only when they differ. A steady release does nothing. Every seed
 * that succeeds writes the new stamp itself.
 *
 * ── WHAT IT NEVER DOES ───────────────────────────────────────────────────────
 *
 *   · **Fail the build.** A demo that could not be rebuilt is loud here and is caught by
 *     `check:demos:prod` the morning after; the product deploy does not wait for it. The stamp is
 *     written only on success, so a failed reseed is retried by the next build.
 *   · **Seed production without saying so.** `--allow-prod` is passed to the seed only when the
 *     build is on `master`; the seed's own production refusal stays in force everywhere else.
 *   · **Run without credentials.** No URL or service key → one line, exit 0.
 *
 * `--dry-run` computes and compares but never seeds — the same output the build would print, so
 * a developer can see what a push would do. Off the build (no `AWS_BRANCH`) it seeds only when
 * `--allow-prod` is passed AND the target is production; against dev it simply seeds.
 *
 * Run: node scripts/reseed-demos-if-stale.mjs [--dry-run] [--allow-prod]
 *      (locally: node --env-file=.env.local scripts/reseed-demos-if-stale.mjs --dry-run)
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { getDemoOrgByKind } from '../lib/demo-org.ts';
import { ROOT, demoWorldFingerprint, readDemoWorldStamp } from './lib/demo-world-fingerprint.mjs';

const dryRun = process.argv.includes('--dry-run');
const allowProdFlag = process.argv.includes('--allow-prod');
const PROD_PROJECT_REF = 'qcttcboqysynwcdyghil';

const SANDBOXES = [
  { kind: 'tournament', label: 'tournament sandbox', seed: 'scripts/seed-demo-tournament.mjs' },
  { kind: 'coach',      label: 'coach sandbox',      seed: 'scripts/seed-demo-coach.mjs' },
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const branch = process.env.AWS_BRANCH ?? null;
const isProd = supabaseUrl.includes(PROD_PROJECT_REF);

const log = (line) => console.log(`[reseed-demos] ${line}`);

if (!supabaseUrl || !serviceKey) {
  log('skipped — no Supabase credentials in this environment.');
  process.exit(0);
}

// The seeds import `.ts` modules directly; that needs Node's built-in type stripping (unflagged
// from 22.18 / 23.6). The build image's Node is not pinned by this repo, so say what we have and
// bow out honestly rather than crash the build with a syntax error three imports deep.
const [major, minor] = process.versions.node.split('.').map(Number);
const canImportTs = major >= 24 || (major === 23 && minor >= 6) || (major === 22 && minor >= 18);
log(`node ${process.versions.node} · branch ${branch ?? '(local)'} · target ${isProd ? 'PRODUCTION' : 'dev/local'}`);
if (!canImportTs) {
  log('⚠ this Node cannot import .ts without a flag — the seeds cannot run here. Fallback: release runbook §1d-1.');
  process.exit(0);
}

// Production is seeded from a master build, or by a person who said so. Never from a dev-branch
// build whose env happens to point at prod, and never by accident.
const mayWriteProd = isProd && (branch === 'master' || (!branch && allowProdFlag));
if (isProd && !mayWriteProd) {
  log(`⚠ target is production but this is ${branch ? `the ${branch} branch build` : 'a local run without --allow-prod'} — comparing only.`);
}

const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
let failures = 0;

for (const box of SANDBOXES) {
  const demoOrg = getDemoOrgByKind(box.kind);
  if (!demoOrg) { log(`${box.label}: no demo org registered — skipped.`); continue; }

  let orgId = null;
  try {
    const { data, error } = await db.from('organizations').select('id').eq('slug', demoOrg.slug).maybeSingle();
    if (error) throw new Error(error.message);
    orgId = data?.id ?? null;
  } catch (err) {
    failures += 1;
    log(`${box.label}: ✗ could not read the org — ${err.message}`);
    continue;
  }
  if (!orgId) { log(`${box.label}: not seeded in this database — nothing to keep current.`); continue; }

  const want = demoWorldFingerprint(box.seed);
  let stamp = null;
  try {
    stamp = await readDemoWorldStamp(db, orgId);
  } catch (err) {
    failures += 1;
    log(`${box.label}: ✗ ${err.message}`);
    continue;
  }

  const have = stamp?.fingerprint ?? null;
  if (have === want.fingerprint) {
    log(`${box.label}: ✓ current (world ${have}, stamped ${stamp.stampedAt}).`);
    continue;
  }

  log(`${box.label}: world moved — stamped ${have ?? 'never'}${stamp ? ` (${stamp.stampedAt}, ${stamp.commit ?? 'no commit'})` : ''}, this checkout ${want.fingerprint} (${want.files.length} files, ${want.migrationCount} migrations, last ${want.lastMigration}).`);

  if (dryRun) { log(`${box.label}: dry run — would reseed.`); continue; }
  if (isProd && !mayWriteProd) { failures += 1; log(`${box.label}: ✗ NOT reseeded (production, not permitted from here).`); continue; }

  const args = [path.join(ROOT, box.seed)];
  if (isProd) args.push('--allow-prod');
  log(`${box.label}: reseeding …`);
  const started = Date.now();
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT, stdio: 'inherit', env: process.env, timeout: 10 * 60_000,
  });
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  if (result.status === 0) {
    log(`${box.label}: ✓ reseeded in ${secs}s.`);
  } else {
    failures += 1;
    log(`${box.label}: ✗ SEED FAILED after ${secs}s (exit ${result.status ?? result.signal}). The old stamp stands; the next build retries. check:demos:prod will report it.`);
  }
}

if (failures) {
  log(`⚠ ${failures} sandbox(es) could not be brought current. This does NOT fail the build — the product does not wait on a demo. See release runbook §1d-1.`);
}
process.exit(0);
