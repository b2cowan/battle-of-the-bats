/**
 * Are both demo sandboxes still presentable? — the routine-sweep wrapper.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * `check-demo-sandbox.mjs` (tournament) and `check-demo-coach.mjs` (coach) have existed since each
 * sandbox was built, and until 2026-08-05 they ran **only when somebody remembered**. They were in
 * no npm script; this repo has no CI. So the two demos a prospect walks into — the only surfaces
 * where the product sells itself unattended — were the least-checked things we ship.
 *
 * That gap was not theoretical. Designing the coach sandbox's guided tour turned up three pieces of
 * demo copy pointing at things the product no longer shows, all of which had already survived a
 * build, a `/simplify` pass and a `/review` pass. See `DEMO_SANDBOX_DRIFT_GUARDS_PLAN.md` — this
 * script is measure 1 of four.
 *
 * ── THE SKIP RULE, AND WHY IT IS GENEROUS ────────────────────────────────────
 *
 * This now runs inside `npm run verify:changed`, on every machine, including ones that have never
 * pointed at a database. Three states, and only one of them is a failure:
 *
 *   · no Supabase credentials      → SKIP. A contributor without `.env.local` is not a problem.
 *   · credentials, but no demo org → SKIP (child exit code 3). A database nobody seeded is fine.
 *   · a demo that exists and is WRONG → FAIL, loudly. That is the whole point.
 *
 * A check that cries wolf on a fresh clone teaches everyone to ignore a red build, which costs more
 * than the check is worth. The failure this exists to catch is a demo that is broken, not absent.
 *
 * ⚠ It reads a DATABASE, unlike everything else in the sweep, which reads source text. That is
 * unavoidable — a demo's state IS data — and it is why the skip rule has to be this forgiving.
 *
 * Run directly: `node scripts/check-demos.mjs`
 */
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = path.join(ROOT, '.env.local');

const CHECKS = [
  { label: 'tournament sandbox', script: 'check-demo-sandbox.mjs', tick: 'tick-demo-sandbox.mjs' },
  { label: 'coach sandbox', script: 'check-demo-coach.mjs', tick: 'tick-demo-coach.mjs' },
];

/** Production. A check must never quietly write there — see the re-anchor note below. */
const PROD_PROJECT_REF = 'qcttcboqysynwcdyghil';
/** The shared development project. The re-anchor is only ever run against this or a local stack. */
const DEV_PROJECT_REF = 'npgnrxaitgbtbtvvykto';

/** Exit code the two checkers use for "this database has no demo" — a skip, never a failure. */
const NOT_SEEDED = 3;

/**
 * ⚠ **Load the env file into THIS process, not just the children.**
 *
 * The first version of this script read `process.env.NEXT_PUBLIC_SUPABASE_URL` to decide whether it
 * was pointed at production — while passing `--env-file=.env.local` only to the child processes it
 * spawned. `verify:changed` runs this script with no env file of its own, so the parent's copy of
 * that variable was **undefined on every ordinary run** (measured). The production guard below was
 * therefore reading a value that is always empty, always concluding "not production", and always
 * running the re-anchor — including for a developer whose `.env.local` is temporarily pointed at
 * the live database, which is a documented workflow. A routine `npm run verify:changed` would then
 * have written to production with the service-role key.
 *
 * Loading the file here means the parent judges the SAME database its children will connect to.
 */
if (existsSync(ENV_FILE)) {
  try {
    process.loadEnvFile(ENV_FILE);
  } catch {
    /* unreadable or malformed — the credential check below then decides, and it fails safe */
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const haveCredentials = !!supabaseUrl && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!haveCredentials) {
  console.log('✓ demo sandboxes — skipped (no Supabase credentials in this environment)');
  process.exit(0);
}

// `--env-file` only when the file is actually there; node errors on a missing one, and a machine
// with credentials already in its environment does not need it.
const nodeArgs = existsSync(ENV_FILE) ? ['--env-file=.env.local'] : [];

/**
 * ── RE-ANCHOR FIRST, OFF PRODUCTION ONLY ─────────────────────────────────────
 *
 * Both demos are anchored to "now", and both rely on a nightly scheduled job to keep them there.
 * **Neither schedule is applied to the dev database.** So on dev the demos are a day stale every
 * single morning — which this check correctly reports, and which would make the whole team's
 * routine sweep red every morning for a reason nobody can act on from here.
 *
 * Silencing that would be worse than not checking at all, so instead the sweep does locally what
 * the scheduler does everywhere else: it runs the re-anchor, then checks. The re-anchor is
 * diff-only and idempotent — a steady day writes zero rows — so this costs nothing when there is
 * nothing to fix, and a demo that is stale merely because nothing ticked it simply stops being
 * stale. Anything still wrong afterwards is a real failure, which is the signal we wanted.
 *
 * ⚠ **Never against production.** There the scheduler genuinely runs, so staleness means the
 * scheduler has broken — an alert, not something a verification sweep should paper over by writing
 * to the live database as a side effect of somebody typing `npm run verify:changed`.
 *
 * ⚠ **The guard is an ALLOW-LIST and it fails closed.** A deny-list on the production project ref
 * would read as "not production" for a custom domain, a pooler hostname, a restored copy of prod,
 * or a URL shape nobody has thought of yet — every one of those a write we did not intend. So the
 * rule is inverted: tick only when the target is recognisably a LOCAL or DEVELOPMENT database.
 * Anything unrecognised is checked but never written to, which costs a stale-demo warning on an
 * exotic setup and cannot cost a write to somebody's live data.
 */
const isKnownProd = supabaseUrl.includes(PROD_PROJECT_REF);
const isRecognisablyLocalOrDev =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(supabaseUrl)
  || supabaseUrl.includes(DEV_PROJECT_REF);
const mayReAnchor = isRecognisablyLocalOrDev && !isKnownProd;

/**
 * ⚠ Every child gets a deadline. Without one, a Supabase call that hangs takes
 * `npm run verify:changed` with it — indefinitely, with no output and no way to tell a slow
 * network from a wedged process. A check that can hang the routine gate is worse than no check.
 */
const CHILD_TIMEOUT_MS = 120_000;
const run = (script) => spawnSync(process.execPath, [...nodeArgs, path.join('scripts', script)], {
  cwd: ROOT,
  encoding: 'utf8',
  timeout: CHILD_TIMEOUT_MS,
  // Captured rather than inherited: a passing check should be ONE line in a sweep of many, and the
  // detail only earns its space when something is wrong. On failure the whole run is echoed.
  stdio: ['ignore', 'pipe', 'pipe'],
});

const failed = [];
const skipped = [];

/**
 * ── CHECK FIRST, RE-ANCHOR ONLY IF SOMETHING IS ACTUALLY WRONG ───────────────
 *
 * The first version re-anchored unconditionally before checking, which made a routine, read-only
 * verification sweep into one that WROTE to the shared development database on every single run.
 * With several agents sharing one working copy that is a race for no reason: two sweeps a second
 * apart would issue two independent re-anchors, and a check reading a half-applied shift would
 * report a failure that was never real — teaching people to distrust the one check built to be
 * trusted.
 *
 * So the write is now a repair, not a ritual: a steady day never writes at all, and the re-anchor
 * only runs when the demo has genuinely fallen behind (the nightly schedule is not applied to the
 * dev database, so on dev that happens most mornings). Off production only, always.
 */
/**
 * `--tick` (i.e. `npm run tick:demos`): re-anchor unconditionally, then report. This is the
 * deliberate "put the demo right" command, as opposed to the sweep's "repair only if broken".
 * Routed through this wrapper rather than calling the tick scripts directly so it inherits the
 * credential skip and the production guard — the direct version crashed outright on a machine
 * with no environment file, which is the one machine most likely to be running it by mistake.
 */
const tickOnly = process.argv.includes('--tick');
if (tickOnly && !mayReAnchor) {
  console.error(`✗ refusing to re-anchor: ${isKnownProd ? 'this is production' : 'unrecognised database'}.`);
  process.exit(1);
}

for (const { label, script, tick } of CHECKS) {
  if (tickOnly) {
    const ticked = run(tick);
    console.log((ticked.stdout ?? '').trimEnd() || `  – ${label}: nothing to do`);
    if (ticked.status !== 0) { failed.push(label); console.error((ticked.stderr ?? '').trimEnd()); }
    continue;
  }

  let result = run(script);

  if (result.status !== 0 && result.status !== NOT_SEEDED && mayReAnchor) {
    const ticked = run(tick);
    if (ticked.status === 0) result = run(script);
  }

  if (result.status === NOT_SEEDED) {
    skipped.push(label);
    continue;
  }
  if (result.status !== 0) {
    failed.push(label);
    console.error(`\n──────── ${label} ────────`);
    console.error((result.stdout ?? '').trimEnd());
    if (result.stderr?.trim()) console.error(result.stderr.trimEnd());
    if (!mayReAnchor) {
      console.error(`  (not re-anchored: ${isKnownProd ? 'this is production' : 'unrecognised database'} — checked only)`);
    }
  }
}

if (failed.length) {
  console.error(`\n✗ demo sandboxes — ${failed.join(' and ')} would not be presentable to a prospect.`);
  if (mayReAnchor) console.error('  A re-anchor was already attempted, so this is not merely stale dates.');
  console.error('  Re-seed it (scripts/seed-demo-*.mjs), or fix what changed underneath it. A broken');
  console.error('  demo still renders perfectly, which is why this is checked rather than noticed.');
  process.exit(1);
}

const checked = CHECKS.length - skipped.length;
const parts = [];
if (checked) parts.push(`${checked} presentable`);
if (skipped.length) parts.push(`${skipped.join(', ')} not seeded here`);
console.log(`✓ demo sandboxes — ${parts.join('; ')}`);
