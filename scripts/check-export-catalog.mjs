/**
 * scripts/check-export-catalog.mjs
 * THE EXPORT REGISTRY MUST DESCRIBE THE PRODUCT THAT EXISTS.
 *
 * `lib/export/catalog.ts` opens by calling itself "the source of truth" for help documentation,
 * plan-feature audit (pricing accuracy) and coverage-gap detection, and closes that list with
 * "CI **can** check". Nothing ever did, and nothing read the file — so for months it was a
 * confident answer nobody was checking.
 *
 * ⚠⚠ WHAT IT HAD DRIFTED TO, measured on 2026-09-06 before this gate existed:
 *   · **9 of 31 entries pointed at files that do not exist.** Three were routes deleted long ago;
 *     the other six were live exports whose recorded path still said `[id]` after the route was
 *     renamed to `[teamId]` / `[seasonId]`. A path nothing resolves rots in silence.
 *   · **3 entries said "Not yet implemented"** about exports that had shipped — the club Budget
 *     Plan, House League Standings, House League Teams.
 *   · **2 exports were absent entirely** — the platform-admin Feedback queue and the Observability
 *     issues list.
 *
 * That is wrong in both directions plus silent, out of thirty-one. The registry is about to be
 * READ — by an operator page and by the customer help system — so from here it has to be true.
 *
 * ## What this proves, and what it cannot
 *
 * It proves the registry and the code AGREE about which screens export. It cannot judge whether a
 * `helpSummary` is well written or a `minPlan` is commercially right — those are the owner's and
 * `/billing`'s. Fixing a name here is never a substitute for reading the entry.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

/**
 * What "this screen exports" looks like in source.
 *
 * ⚠ THE CONTROLS **AND** THE RAW CALLS. Half the surfaces render a shared control; the other half
 * (platform-admin lists, the coach roster) call the writer directly. Matching only one shape is
 * how a coverage check reports full coverage over a hole.
 */
const EXPORT_SIGNALS = [
  /<ExportMenu\b/,
  /<CoachExportButton\b/,
  /<MoneyExportButton\b/,
  /\bdownloadXLSX\s*\(/,
  /\bdownloadCSVBlob\s*\(/,
  /\bdownloadMoneyExport\s*\(/,
  /\bdownloadPDF\s*\(/,
];

/**
 * Files that legitimately contain those words without BEING an export surface: the controls
 * themselves, the writers, and the fixture/gate scripts that drive them.
 *
 * ⚠ PATH PREFIXES, NOT NAMES. A guard that matches imported symbols dies the first time somebody
 * aliases an import — the lesson the page-actions guard already learned here.
 */
const NOT_A_SURFACE = [
  'components/admin/ExportMenu',
  'components/coaches/CoachExportButton',
  'components/coaches/MoneyExportButton',
  'lib/',
  'scripts/',
  'tests/',
  /* ⚠ A PREVIEW IS NOT AN EXPORT. "How your documents look" renders a sample PDF from placeholder
     data so an admin can see their branding before saving it — no customer record leaves the
     product, so there is nothing for a registry of data exports to describe. It reaches the same
     writer as a real export, which is exactly why a signal-based check has to be told. */
  'app/[orgSlug]/admin/org/settings/pdf/page.tsx',
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** The catalog is TypeScript, so it is read as text — a gate that imported it would need the
 *  whole app's module graph to resolve, for four fields it can read with a regex. */
function readCatalog() {
  /* ⚠ CRLF NORMALISED FIRST, and this bit me on the first run. The repo checks out with Windows
     line endings, so a splitter written as `\n  {\n` matched nothing, `readCatalog` returned an
     EMPTY catalog — and an empty catalog makes this gate report every export surface in the app as
     uncatalogued while silently skipping the three checks that matter. A broken parser here fails
     LOUD in one direction and SILENT in the other; the loud half is the only reason it was caught. */
  const src = fs.readFileSync(path.join(ROOT, 'lib/export/catalog.ts'), 'utf8').replace(/\r\n/g, '\n');
  const body = src.slice(src.indexOf('export const EXPORT_CATALOG'));
  const entries = [];
  for (const block of body.split(/\n  \{\n/).slice(1)) {
    const get = key => block.match(new RegExp(`\\b${key}: '([^']*)'`))?.[1];
    const id = get('id');
    if (!id) continue;
    entries.push({
      id,
      file: get('file'),
      label: get('label'),
      omittedReason: get('omittedReason'),
      plannedPhase: get('plannedPhase'),
      roundTrip: get('roundTrip'),
      roundTripTest: get('roundTripTest'),
      roundTripTestGap: get('roundTripTestGap'),
    });
  }
  /* A parse that finds nothing is a broken parser, never an empty registry — the registry is a
     checked-in constant with dozens of entries. Refusing here stops a silent pass. */
  if (entries.length < 10) {
    console.error(`✗ Export registry: parsed only ${entries.length} entries — the reader is broken,`
      + ' not the registry. Fix this script before trusting a pass.');
    process.exit(1);
  }
  return entries;
}

const catalog = readCatalog();
const problems = [];

// ── A. Every recorded path resolves ──────────────────────────────────────────
for (const e of catalog) {
  if (!e.file) { problems.push(`${e.id} — no \`file\` recorded`); continue; }
  if (!fs.existsSync(path.join(ROOT, e.file))) {
    problems.push(`${e.id} — \`file\` does not exist: ${e.file}`
      + '\n      (a renamed route segment, or a page deleted without its entry)');
  }
}

// ── B. A "there is no export here" claim must be true ────────────────────────
for (const e of catalog) {
  const why = e.omittedReason ?? e.plannedPhase;
  if (!why || !e.file) continue;
  const full = path.join(ROOT, e.file);
  if (!fs.existsSync(full)) continue; // already reported by A
  const src = fs.readFileSync(full, 'utf8');
  if (EXPORT_SIGNALS.some(re => re.test(src))) {
    problems.push(`${e.id} — claims no export ("${why}") but ${e.file} exports today`);
  }
}

// ── C. Every screen that exports is in the registry ──────────────────────────
const catalogued = new Set(catalog.map(e => e.file));
for (const file of walk(path.join(ROOT, 'app'))) {
  const r = rel(file);
  if (NOT_A_SURFACE.some(p => r.startsWith(p))) continue;
  const src = fs.readFileSync(file, 'utf8');
  if (!EXPORT_SIGNALS.some(re => re.test(src))) continue;
  if (!catalogued.has(r)) {
    problems.push(`${r} — exports, but has no catalog entry`
      + '\n      (add one, or say why it is not a catalogued surface)');
  }
}

// ── D. A declared round trip must name an importer that exists, AND a test that proves it ────
//
// ⚠⚠ THE TEST HALF WAS ADDED 2026-09-10, AND THE REASON IS WORTH THE LINES. This check used to be
// only the first clause: does the named reader FILE EXIST. That is a spell-check of a path, not
// evidence of anything — and it reported green for eight days over a Budget plan export whose own
// file came back with no amounts, with every cost line silently dropped, and with every money-in
// line re-read as a new cost. `roundTrip` is not an internal note: it is published to the
// platform-admin Export Registry and to the customer help system, so it is the PRODUCT telling a
// coach "edit this file and bring it back". A claim like that is either proven or recorded as
// unproven — there is no third state, and "the reader file exists" was pretending to be one.
for (const e of catalog) {
  if (!e.roundTrip || e.roundTrip === 'none') continue;
  if (!fs.existsSync(path.join(ROOT, e.roundTrip))) {
    problems.push(`${e.id} — \`roundTrip\` names a reader that does not exist: ${e.roundTrip}`);
  }
  if (e.roundTripTest) {
    if (!fs.existsSync(path.join(ROOT, e.roundTripTest))) {
      problems.push(`${e.id} — \`roundTripTest\` names a test that does not exist: ${e.roundTripTest}`
        + '\n      (that test is the only thing standing behind this claim — restore it, or record the'
        + ' gap in `roundTripTestGap`)');
    }
  } else if (!e.roundTripTestGap) {
    problems.push(`${e.id} — declares \`roundTrip\` with no \`roundTripTest\` and no \`roundTripTestGap\``
      + '\n      (this export tells coaches their edited file reads back. Prove it with a round-trip'
      + " test built from the exporter's OWN column definitions — copy"
      + ' tests/unit/coach-budget-plan-round-trip.test.ts — or say in `roundTripTestGap` why there'
      + ' is nothing behind the promise yet.)');
  }
}

if (problems.length) {
  console.error(`\n✗ Export registry disagrees with the code — ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  · ${p}`);
  console.error('\n  The registry is read by the platform-admin Export Registry page and by the');
  console.error('  customer help system. A wrong entry is a wrong answer about what the product');
  console.error('  does — and about what a plan includes.\n');
  process.exit(1);
}

const live = catalog.filter(e => !e.omittedReason && !e.plannedPhase).length;
const roundTrips = catalog.filter(e => e.roundTrip && e.roundTrip !== 'none');
const proven = roundTrips.filter(e => e.roundTripTest).length;
const gaps = roundTrips.filter(e => !e.roundTripTest && e.roundTripTestGap);
console.log(`✓ Export registry: ${catalog.length} surface(s) — ${live} live, `
  + `${catalog.length - live} deliberately none, ${roundTrips.length} round trip(s) `
  + `(${proven} proven by a test) — all agree with the code.`);
/* ⚠ A RECORDED GAP IS NOT A PASS. The registry stays green because the gap is DECLARED rather than
   silent — but a promise the product makes to a coach with nothing standing behind it gets read out
   on every single run. A line nobody sees is how the last one survived eight days. */
for (const e of gaps) {
  console.log(`  ⚠ ${e.id} — round trip CLAIMED, not proven: ${e.roundTripTestGap}`);
}
