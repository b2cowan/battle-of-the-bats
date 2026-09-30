#!/usr/bin/env node
/**
 * check-admin-old-look.mjs — THE ADMIN'S OLD LOOK MAY ONLY SHRINK (Admin Design Continuity, closed 2026-09-30).
 *
 * The admin moved onto the coaches portal's kit in 2026-09 (released 2026-09-28, `74f45113`). The old look it
 * replaced is dead code, but it is still IN the code, in five shapes:
 *
 *   useAdminKit   an admin page's `useAdminKit()` — its false branch is the old screen
 *   kx            a `kx(legacy, kit)` inline style — its first half is the old look
 *   helpers       a call to `useKitStyle` / `useKitButtons` / `useKitAsterisk` / `kitStyler` — the switch-era
 *                 helpers (`AdminKitProvider`, `kit-inline.ts`), which go with their last caller
 *   legacy        a `legacy={…}` prop — `AdminPageHeader`'s old header markup, which it no longer reads
 *   kitScope      a `[data-admin-kit]` in a stylesheet — a kit layer over old base rules, not yet folded
 *
 * Admin Design Continuity's Part B retired it from every screen no redesign is coming for, and handed the
 * rest to the two programs that rebuild those screens — the tournament admin redesign and Club Tier —
 * whose definition of done is "retire the old look of every file you rebuild". This is the ledger of what
 * is left, and the rule that it only goes one way:
 *
 *   • per file, each count may only go DOWN from its baseline (`scripts/.admin-old-look-baseline.json`);
 *   • a count that went down must be LOCKED IN, in the same change: `node scripts/check-admin-old-look.mjs
 *     --init` — otherwise the headroom lets the old look creep back to where it was;
 *   • a file at zero leaves the baseline (`--init` drops it);
 *   • a file NOT in the baseline may hold none of it — the old look is never added, anywhere;
 *   • `--init` can only LOWER an existing baseline: it refuses to raise a count or admit a new file (with no
 *     baseline at all it creates one, a whole-file diff in review). Raising one means editing
 *     the baseline by hand, where a reviewer sees it.
 *
 * Counted in CODE only: comments are blanked first (a comment that explains why a layer stays scoped is
 * not old look).
 *
 * ⚠ KEEP — not counted, by design. A part another surface also wears keeps its kit layer scoped, because
 * its BASE rules are that surface's look: folding them would restyle the public site, the platform console
 * or the coaches portal (Part B area 1's ruling). And the provider is the machinery itself.
 *
 * Every failure names the stage that owns the file (`scripts/lib/admin-old-look.mjs`, shared with the strict
 * admin colour gate in `check-public-tokens.mjs`), so the fix lands with the right program.
 *
 * Modes:  node scripts/check-admin-old-look.mjs            check (verify:changed)
 *         node scripts/check-admin-old-look.mjs --init     lock in the drops (lower only)
 *         node scripts/check-admin-old-look.mjs --report   what is left, per owner
 *         node scripts/check-admin-old-look.mjs --help
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';
import { ownerOf, SHARED_SURFACE } from './lib/admin-old-look.mjs';
import { blankCodeComments, blankCssComments } from './lib/code-comments.mjs';

const ROOT = process.cwd();
const BASELINE = 'scripts/.admin-old-look-baseline.json';
const SCAN = ['app', 'components', 'lib'];
const KINDS = ['useAdminKit', 'kx', 'helpers', 'legacy', 'kitScope'];

// Not counted, by design: the parts another surface also wears, and the provider — the machinery itself (its
// OFF answer is live: the public-preview island and other surfaces rely on it).
const KEEP = new Map([
  ...SHARED_SURFACE,
  ['components/admin/AdminKitProvider.tsx', 'the provider and the switch-era helpers themselves'],
]);

const argv = process.argv.slice(2);
const KNOWN = new Set(['--init', '--report', '--help', '-h']);
const unknown = argv.filter((a) => !KNOWN.has(a));
if (unknown.length) { console.error(`✖ Unknown option: ${unknown.join(' ')} (see --help)`); process.exit(2); }
if (argv.includes('--help') || argv.includes('-h')) {
  const doc = readFileSync(new URL(import.meta.url), 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[1];
  console.log(doc.split('\n').map((l) => l.replace(/^ \* ?/, '')).join('\n').trim());
  process.exit(0);
}


const hits = (s, re) => (s.match(re) ?? []).length;
function countsOf(file) {
  const raw = readFileSync(join(ROOT, file), 'utf8');
  const c = {};
  if (file.endsWith('.css')) {
    c.kitScope = hits(blankCssComments(raw), /\[data-admin-kit(?:[~|^$*]?=[^\]]*)?\]/g);
  } else {
    const code = blankCodeComments(raw);
    // Spacing and an optional call are tolerated (`kx (`, `kx?.(`, `legacy = {`): a formatter's choice is
    // not a way out. A `const legacy = {…}` declaration is not the header prop.
    c.useAdminKit = hits(code, /\buseAdminKit\s*\(\s*\)/g);
    c.kx = hits(code, /\bkx\s*(?:\?\.\s*)?\(/g);
    // A call, not the helper's own definition (`kit-inline.ts` defines `kitStyler`).
    c.helpers = hits(code, /(?<!function\s+)\b(?:useKitStyle|useKitButtons|useKitAsterisk|kitStyler)\s*\(/g);
    c.legacy = hits(code, /(?<!(?:const|let|var)\s+)\blegacy\s*=\s*\{/g);
  }
  for (const k of Object.keys(c)) if (!c[k]) delete c[k];
  return c;
}

function scanTree() {
  const out = {};
  for (const d of SCAN) {
    for (const rel of readdirSync(join(ROOT, d), { recursive: true })) {
      const f = `${d}/${String(rel).split(sep).join('/')}`;
      if (!/\.(tsx?|css)$/.test(f) || f.includes('/node_modules/') || KEEP.has(f)) continue;
      const c = countsOf(f);
      if (Object.keys(c).length) out[f] = c;
    }
  }
  return out;
}

const fmt = (c) => KINDS.filter((k) => c[k]).map((k) => `${k} ${c[k]}`).join(' · ');
const now = scanTree();
const base = existsSync(join(ROOT, BASELINE)) ? JSON.parse(readFileSync(join(ROOT, BASELINE), 'utf8')) : null;

function totals(map) {
  const t = Object.fromEntries(KINDS.map((k) => [k, 0]));
  for (const c of Object.values(map)) for (const k of KINDS) t[k] += c[k] ?? 0;
  return `${Object.keys(map).length} files · ${fmt(t)}`;
}

if (argv.includes('--report')) {
  const byOwner = new Map();
  for (const [f, c] of Object.entries(now)) {
    const o = ownerOf(f);
    if (!byOwner.has(o)) byOwner.set(o, {});
    byOwner.get(o)[f] = c;
  }
  for (const [o, files] of [...byOwner].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`\n${o}\n  ${totals(files)}`);
    for (const [f, c] of Object.entries(files)) console.log(`    ${f}  —  ${fmt(c)}`);
  }
  console.log(`\nThe admin's old look, all of it: ${totals(now)} (KEEP, not counted: ${KEEP.size} files)`);
  process.exit(0);
}

// One pass over every file either side knows: a RISE is a count above its baseline (or old look in a file the
// baseline does not hold); a DROP is a count below it (or a baseline file that is now clean).
const rises = [];
const drops = [];
for (const f of new Set([...Object.keys(now), ...Object.keys(base ?? {})])) {
  const c = now[f] ?? {};
  const b = base?.[f];
  const over = KINDS.filter((k) => (c[k] ?? 0) > (b?.[k] ?? 0));
  if (over.length) rises.push({ f, c, b, over });
  if (b && KINDS.some((k) => (c[k] ?? 0) < (b[k] ?? 0))) drops.push({ f, c, b });
}

if (argv.includes('--init')) {
  if (base && rises.length) {
    console.error('✖ --init only lowers the baseline; these would RAISE it (or admit a file):');
    for (const r of rises) console.error(`    ${r.f}: ${r.over.map((k) => `${k} ${r.b?.[k] ?? 0} → ${r.c[k]}`).join(', ')}`);
    console.error('  Retire the old look instead. Raising a count means editing the baseline by hand, where review sees it.');
    process.exit(1);
  }
  const sorted = Object.fromEntries(Object.keys(now).sort().map((f) => [f, now[f]]));
  writeFileSync(join(ROOT, BASELINE), JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Baseline written: ${BASELINE} — ${totals(sorted)}`);
  process.exit(0);
}

if (!base) { console.error(`✖ No baseline at ${BASELINE}. Create it once with --init.`); process.exit(1); }

let ok = true;
if (rises.length) {
  ok = false;
  console.error('✖ Admin old look: it may only shrink, and this change adds to it.');
  for (const r of rises) {
    const what = r.b ? `above its baseline (${r.over.map((k) => `${k} ${r.b[k] ?? 0} → ${r.c[k]}`).join(', ')})` : `new old look in a file that had none (${fmt(r.c)})`;
    console.error(`    ${r.f}: ${what}\n        owned by: ${ownerOf(r.f)}`);
  }
  console.error("  Write the kit's answer directly: tokens, no `useAdminKit()` branch, no `kx()`, no `legacy` header,");
  console.error('  no `[data-admin-kit]` scope (the admin is always on the kit — fold the rule into its base class).');
}
if (drops.length) {
  ok = false;
  console.error('✖ Admin old look: these went DOWN — lock it in, in the same change, so it cannot creep back:');
  for (const d of drops) console.error(`    ${d.f}: ${fmt(d.b) || '—'} → ${fmt(d.c) || 'none (leaves the baseline)'}`);
  console.error('  node scripts/check-admin-old-look.mjs --init   (if the drop is another session\'s uncommitted work, it is theirs to lock in)');
}
if (!ok) process.exit(1);
console.log(`✓ Admin old look: ${totals(now)} held, none new (${KEEP.size} shared-surface files kept scoped by design).`);
