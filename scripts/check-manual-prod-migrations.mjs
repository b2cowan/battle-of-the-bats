/**
 * check-manual-prod-migrations.mjs — the gate for migrations the drift check CANNOT SEE.
 *
 * ── The blind spot this exists to close ─────────────────────────────────────────────────────
 *
 * `check-prod-migration-drift.mjs` (npm run check:migrations) is the release guardrail for
 * "was this migration applied to prod?". It answers that question by comparing LIVE SCHEMA —
 * it fails when prod is missing a table or a column that dev has. That catches the common case
 * and it caught the migration-040 register-500 incident it was built for.
 *
 * But a migration that changes no tables and no columns is INVISIBLE TO IT BY CONSTRUCTION:
 *
 *   • a cron schedule (`cron.schedule`) — migrations 122, 183, 224, 226, 273
 *   • a data-only INSERT / UPDATE / DELETE — migration 264 and many others
 *   • a dropped column (prod having MORE than dev never fails a "prod is missing" check)
 *   • a created / replaced / dropped function
 *
 * For all of these, `check:migrations` reports "prod in sync" and the release proceeds with a
 * clean bill of health, whether or not the migration was ever applied to prod. And the miss is
 * SILENT IN BOTH DIRECTIONS: nothing 500s, no gate turns red, the product renders perfectly —
 * the change simply never happened on prod and nobody finds out.
 *
 * That is not hypothetical. Migration 264 (a data-only DELETE of three retired email templates)
 * was deliberately held back from prod on 2026-08-27, and `check:migrations` reported "in sync"
 * the entire time it was outstanding — CLAUDE.md records exactly that. Migration 273 (this file's
 * immediate cause) reschedules the demo sandbox's refresh job from every two minutes to nightly:
 * if it is skipped at promote, the demo keeps working perfectly and the whole point of the change
 * — the reduced call volume — silently never happens.
 *
 * ── How this closes it ──────────────────────────────────────────────────────────────────────
 *
 * The candidate list is DERIVED FROM THE MIGRATION FILES, never from someone remembering to add
 * an entry — the same "the gate is the list" discipline as HISTORY_ENDPOINTS. Any migration above
 * the manifest's watermark that performs a schema-invisible operation MUST carry an entry in
 * `supabase/migrations/MANUAL_PROD_STEPS.json` saying where it stands on prod. A new one that
 * doesn't fails this check, which is the decision point: the session that writes the migration is
 * the session that knows whether prod needs it.
 *
 * Statuses:
 *   applied     — confirmed applied to prod. Record the anchor (date / Amplify job) in `note`.
 *   pending     — must be applied to prod at or before the next promote. BLOCKS a promote.
 *   held        — deliberately NOT applied, as an owner decision. Does not block; stays visible.
 *   unverified  — nobody has checked. BLOCKS a promote — resolving it is a one-minute lookup.
 *
 * ── Modes ───────────────────────────────────────────────────────────────────────────────────
 *
 *   (default)    Authoring gate, wired into `npm run verify:changed`. Fails ONLY on an undeclared
 *                or stale entry — the cheap, always-correct half. Pending/unverified items are
 *                reported but do not block ordinary development, where "not on prod yet" is the
 *                normal state of affairs.
 *
 *   --promote    Release gate, wired into the pre-promote checks in `.claude/commands/release.md`.
 *                Additionally fails on `pending` and `unverified` — the point at which "not on
 *                prod yet" stops being normal and becomes the thing about to be shipped past.
 *
 * Exit 0 = nothing outstanding for this mode. Non-zero = read the output; it names each file.
 *
 * Run: node scripts/check-manual-prod-migrations.mjs [--promote] [--json]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const MANIFEST_PATH = path.join(MIGRATIONS_DIR, 'MANUAL_PROD_STEPS.json');

const promoteMode = process.argv.includes('--promote');
const jsonMode = process.argv.includes('--json');

/**
 * Strip SQL comments before matching.
 *
 * Load-bearing, not tidiness: every migration in this repo opens with a long prose header
 * explaining itself, and that prose says things like "a data-only DELETE" or "the cron schedule"
 * in plain English. Matching against it would flag essentially every file and the gate would be
 * noise within a week.
 */
function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // /* block */
    .replace(/--[^\n]*/g, ' ');           // -- line
}

/** Which schema-invisible operations does this migration perform? */
function invisibleOps(sql) {
  const body = stripSqlComments(sql).toLowerCase();
  const ops = [];
  if (/\bcron\.(schedule|unschedule|alter_job)\s*\(/.test(body)) ops.push('cron');
  // Statement-leading data writes. A write inside a function body counts too — deliberately
  // conservative: over-flagging costs one manifest line, under-flagging costs a silent miss.
  //
  // Two things here are load-bearing, both found by this gate under-reporting on its own first run:
  //   • the `m` flag — without it `^` anchors to the start of the WHOLE FILE rather than each
  //     line, so only statements sitting right after a `;`/`begin`/`then` were seen;
  //   • the UPDATE branch uses a LOOKAHEAD for its identifier. Consuming one identifier character
  //     and then demanding `\b` can never match a multi-character table name (`update budget_items`
  //     consumes "update b", then asks for a boundary between "b" and "u"), which silently missed
  //     every UPDATE-only migration in the repo.
  if (/(^|;|\bbegin\b|\bthen\b)\s*(insert\s+into\b|update\s+(?=[a-z_."])|delete\s+from\b)/m.test(body)) ops.push('data');
  if (/\bdrop\s+column\b/.test(body)) ops.push('drop-column');
  if (/\b(create\s+(or\s+replace\s+)?function|drop\s+function)\b/.test(body)) ops.push('function');
  /* A DROPPED CONSTRAINT — the hole mig 287 fell through, and it is the same shape as `drop-column`:
     the drift check compares TABLES AND COLUMNS plus CHECK constraints that admit LESS in prod, so a
     UNIQUE or FK constraint that dev has dropped and prod still holds adds no table, adds no column
     and loosens no CHECK. `check:migrations` reports "in sync" with the rule still standing on
     production — and the code that ships expecting it gone gets refused by the live database.
     ⚠ THE DROP, NOT THE ADD. An ADDED constraint that prod lacks fails loudly the first time prod
     writes a row dev would have refused; what needs declaring is the direction where prod is
     STRICTER than the code expects.
     ⚠⚠ AND `check-schema-parity` DOES SEE THIS ONE — it diffs constraints both ways off the
     snapshots and reports `constraint:only-prod:…`. So the reason an entry here still earns its
     place is NOT that nothing else can see the drop; it is that the parity ratchet can be SILENCED
     with `--init`, which accepts the divergence into the baseline and is afterwards
     indistinguishable from having applied the migration, whereas a `pending` status in this file
     BLOCKS a promote and cannot be quieted that way. State it that way round: the first draft of
     this comment claimed the drop was invisible everywhere, and it is not.
     ⚠ `if exists` is matched too — every drop in this repo is written that way. */
  /* ⚠⚠ A DROP THAT LEAVES NOTHING BEHIND — not every `drop constraint`, and the difference is the
     whole accuracy of this rule. The commonest use of `DROP CONSTRAINT` in this repo is the
     drop-then-re-ADD that WIDENS a CHECK (migs 266 and 274 both do it, to admit a new enum value),
     and the drift gate compares CHECK DEFINITIONS in both directions — that is the `divergentChecks`
     mechanism built for the 266 incident itself — so a re-added CHECK is perfectly visible to it.
     Flagging those was a false positive on this gate's first widened run, and it dragged two
     unrelated pre-existing migrations in front of an authoring check they had never needed.
     What IS invisible is a constraint dropped and NOT put back: no table added, no column added, no
     CHECK to compare, so `check:migrations` reports "in sync" with the rule still standing on prod.
     ⚠ Matched by NAME, so `drop constraint x` immediately followed by `add constraint x` is not a
     finding, while mig 287 — which drops a UNIQUE and never re-adds it — is. */
  /* ⚠ WHITESPACE FLATTENED AND MATCHED AS PLAIN TEXT, deliberately. The first cut built the
     re-add test with `new RegExp(`\badd\s+constraint …`)` inside a TEMPLATE LITERAL, where `\b` is
     the backspace character and `\s` is just an `s` — so the pattern was
     "backspace-a-d-d-s-plus…", it matched nothing, every drop-and-re-add read as a bare drop, and
     the gate reported two false positives on its first run. A regex LITERAL would have been fine;
     a template literal is where that escape silently changes meaning. */
  const flat = body.replace(/\s+/g, ' ');
  for (const name of flat.matchAll(/\bdrop constraint (?:if exists )?([a-z0-9_."]+)/g)) {
    const dropped = name[1].replace(/["']/g, '');
    if (!flat.includes(`add constraint ${dropped}`)) {
      ops.push('drop-constraint');
      break;
    }
  }
  return ops;
}

/** `273_demo_sandbox_tick_goes_nightly.sql` → 273 */
function migrationNumber(filename) {
  const n = Number.parseInt(filename.split('_')[0], 10);
  return Number.isNaN(n) ? null : n;
}

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`✖ Missing manifest: ${path.relative(ROOT, MANIFEST_PATH)}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
} catch (err) {
  console.error(`✖ Manifest is not valid JSON: ${err.message}`);
  process.exit(1);
}

const watermark = manifest.grandfatheredThrough;
if (typeof watermark !== 'number') {
  console.error('✖ Manifest is missing a numeric "grandfatheredThrough" watermark.');
  process.exit(1);
}

const VALID_STATUSES = new Set(['applied', 'pending', 'held', 'unverified']);
const declared = new Map(Object.entries(manifest.migrations ?? {}));

const files = fs.readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort();

const undeclared = [];
const outstanding = [];   // pending / unverified
const held = [];
const applied = [];
const badStatus = [];

for (const file of files) {
  const num = migrationNumber(file);
  if (num === null || num <= watermark) continue;

  const ops = invisibleOps(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  if (ops.length === 0) continue;

  const entry = declared.get(file);
  if (!entry) { undeclared.push({ file, ops }); continue; }

  const status = entry.prod;
  if (!VALID_STATUSES.has(status)) { badStatus.push({ file, status }); continue; }

  const row = { file, ops, status, note: entry.note ?? '' };
  if (status === 'applied') applied.push(row);
  else if (status === 'held') held.push(row);
  else outstanding.push(row);
}

// An entry that outlives the migration it describes is how a list quietly stops meaning anything.
const stale = [...declared.keys()].filter(f => !files.includes(f));

const blocking = undeclared.length > 0 || badStatus.length > 0 || stale.length > 0
  || (promoteMode && outstanding.length > 0);

if (jsonMode) {
  // Machine mode is machine-ONLY — a consumer piping this must not also receive the prose report.
  console.log(JSON.stringify(
    { watermark, promoteMode, blocking, undeclared, outstanding, held, applied, stale, badStatus },
    null, 2,
  ));
  process.exit(blocking ? 1 : 0);
}

const line = (row) => `    ${row.file}  [${row.ops.join(', ')}]${row.note ? `\n        ${row.note}` : ''}`;

if (!jsonMode) {
  console.log(`\nManual prod steps — migrations the schema drift check cannot see`);
  console.log(`(watermark: #${watermark} and below are grandfathered)\n`);
}

let failed = false;

if (undeclared.length > 0) {
  failed = true;
  console.log(`✖ ${undeclared.length} migration(s) perform a schema-invisible change but are NOT declared:`);
  undeclared.forEach(r => console.log(line(r)));
  console.log(`\n  These cannot be seen by \`npm run check:migrations\`, so nothing else will ever`);
  console.log(`  tell you whether prod has them. Add each to supabase/migrations/MANUAL_PROD_STEPS.json:`);
  console.log(`      "<file>.sql": { "prod": "pending", "note": "what it does / where it stands" }`);
  console.log(`  Statuses: applied | pending | held | unverified\n`);
}

if (badStatus.length > 0) {
  failed = true;
  console.log(`✖ ${badStatus.length} entr(y/ies) carry an unknown status:`);
  badStatus.forEach(r => console.log(`    ${r.file} → "${r.status}" (expected: applied | pending | held | unverified)`));
  console.log('');
}

if (stale.length > 0) {
  failed = true;
  console.log(`✖ ${stale.length} manifest entr(y/ies) name a migration that no longer exists:`);
  stale.forEach(f => console.log(`    ${f}`));
  console.log('');
}

if (outstanding.length > 0) {
  console.log(`${promoteMode ? '✖' : '⚠'} ${outstanding.length} migration(s) are NOT on prod:`);
  outstanding.forEach(r => console.log(`${line(r)}\n        status: ${r.status}`));
  if (promoteMode) {
    failed = true;
    console.log(`\n  Apply each to prod before promoting:`);
    console.log(`      node scripts/apply-migration-api.mjs supabase/migrations/<file>.sql --prod`);
    console.log(`  then mark it "applied" in MANUAL_PROD_STEPS.json with its date as the note.`);
    console.log(`  If a divergence is intentional, mark it "held" with the reason instead.\n`);
  } else {
    console.log(`  (not blocking here — this is the authoring gate. The pre-promote run blocks on these.)\n`);
  }
}

if (held.length > 0) {
  console.log(`● ${held.length} migration(s) deliberately held back from prod:`);
  held.forEach(r => console.log(line(r)));
  console.log('');
}

if (!failed && outstanding.length === 0) {
  console.log(`✓ Manual prod steps: ${applied.length} applied, ${held.length} held, nothing outstanding.`);
}

process.exit(failed ? 1 : 0);
