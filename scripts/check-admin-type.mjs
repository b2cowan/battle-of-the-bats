#!/usr/bin/env node
/**
 * check-admin-type.mjs — THE ADMIN'S OLD LETTERING MAY ONLY SHRINK (Admin type sweep, owner A14, 2026-10-19).
 *
 * The September kit pass moved the admin onto the new look by changing COLOUR. On many screens it left the old
 * console lettering underneath — the typewriter face, forced capitals, extra-wide tracking, 800–900 weights —
 * and nothing measured it: `check:old-look` counts code shapes, `check:public-tokens` counts colours. The owner
 * found it from a screenshot of the bracket editor. The rule it enforces is F2 (2026-09-25) with the sweep's
 * rulings A1–A14 (`memory/design_decisions.md` 2026-10-19; `docs/projects/archive/ADMIN_TYPE_SWEEP_PLAN.md`):
 * the data face only on eyebrows, chips, codes and readouts; capitals only on eyebrows, chips, column headings,
 * band headings and nav group headings; everything else the body face in sentence case.
 *
 * Counted per file, in CODE only (comments blanked first), four signals:
 *
 *   face    the data face — `font-family`/`font:`/`fontFamily` naming `--font-data`, `--font-mono` or monospace
 *   caps    forced capitals — `text-transform: uppercase` / `textTransform: 'uppercase'`
 *   track   tracking wider than the nav group heading's 0.1em — `letter-spacing`/`letterSpacing` above 0.1em
 *   heavy   an 800 or 900 weight — `font-weight`/`font:`/`fontWeight`
 *
 * ⚖ AN ALLOWED PLACE SAYS WHICH ONE IT IS. A line that holds one of the allowed roles carries a
 * `type-ok: <role>` comment on that line or the one above (`/* type-ok: eyebrow *\/`, `// type-ok: chip`), and
 * is not counted. The roles: eyebrow, chip, column heading, band heading, nav group heading, code, readout,
 * an address. Anything else is the old lettering, and the fix is the body face in sentence case.
 *
 * The ratchet, as `check:old-look`'s:
 *   • per file, each count may only go DOWN from its baseline (`scripts/.admin-type-baseline.json`);
 *   • a count that went down must be LOCKED IN in the same change: `node scripts/check-admin-type.mjs --init`;
 *   • a file NOT in the baseline may hold none of it unmarked — new lettering declares its role or is the
 *     body face;
 *   • `--init` can only LOWER the baseline: it refuses to raise a count or admit a file. Raising one means
 *     editing the baseline by hand, where a reviewer sees it.
 *
 * Scope: the org admin and the volunteer shells, and the shared parts every admin screen wears (the top
 * strip's menus, the notification drawer and page, the help guide and drawer, the plan drawer, the install
 * banner, the phone bar). `app/globals.css` is not scanned: it is every surface's sheet (public site,
 * marketing, platform console), and its admin rules are scoped and few.
 *
 * Modes:  node scripts/check-admin-type.mjs            check (verify:changed)
 *         node scripts/check-admin-type.mjs --init     lock in the drops (lower only)
 *         node scripts/check-admin-type.mjs --report   what is left, file by file, largest first
 *         node scripts/check-admin-type.mjs --help
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { blankCodeComments, blankCssComments } from './lib/code-comments.mjs';

const ROOT = process.cwd();
const BASELINE = 'scripts/.admin-type-baseline.json';
const KINDS = ['face', 'caps', 'track', 'heavy'];

// Directories scanned whole, and single shared files the admin wears.
const DIRS = [
  'app/[orgSlug]/admin',
  'app/[orgSlug]/scorekeeper',
  'app/[orgSlug]/check-in',
  'components/admin',
  'components/volunteer',
  'components/shared',
  'components/notifications',
  'components/help',
  'components/billing',
  'components/chat',
  'components/feedback',
  // The support console (Support console Stage 1, 2026-10-24): it took the house look, so it is held to the lettering rules
  // from zero — a new console file declares its role or is the body face.
  'app/platform-admin',
  'components/platform-admin',
];
// Held out until its own plan finishes: Bookkeeping's screen belongs to `BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md`'s session and still
// carries the old console lettering; it joins the gate (and drops from here) when that plan closes.
const HELD_OUT = ['app/platform-admin/bookkeeping/'];
const FILES = [
  'components/FeedbackModal.module.css',
  'components/FeedbackModal.tsx',
  'components/InstallAppPrompt.module.css',
  'components/InstallAppPrompt.tsx',
  'components/coaches/CoachTopStrip.module.css',
  'components/coaches/CoachesBottomNav.module.css',
];

const argv = process.argv.slice(2);
const KNOWN = new Set(['--init', '--report', '--help', '-h']);
const unknown = argv.filter((a) => !KNOWN.has(a));
if (unknown.length) { console.error(`✖ Unknown option: ${unknown.join(' ')} (see --help)`); process.exit(2); }
if (argv.includes('--help') || argv.includes('-h')) {
  const doc = readFileSync(new URL(import.meta.url), 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[1];
  console.log(doc.split('\n').map((l) => l.replace(/^ \* ?/, '')).join('\n').trim());
  process.exit(0);
}

const CSS = {
  face: [/\bfont-family\s*:[^;]*(?:--font-data|--font-mono|monospace)/g, /(?<![-\w])font\s*:[^;]*(?:--font-data|--font-mono|monospace)/g],
  caps: [/\btext-transform\s*:\s*uppercase/g],
  heavy: [/\bfont-weight\s*:\s*(?:800|900)\b/g, /(?<![-\w])font\s*:\s*(?:italic\s+)?(?:800|900)\b/g],
};
const TS = {
  face: [/\bfontFamily\s*:\s*[^,}\n]*(?:font-data|font-mono|monospace)/g],
  caps: [/\btextTransform\s*:\s*['"`]uppercase/g],
  heavy: [/\bfontWeight\s*:\s*['"`]?(?:800|900)\b/g],
};
const TRACK_CSS = /\bletter-spacing\s*:\s*(\d*\.?\d+)em/g;
const TRACK_TS = /\bletterSpacing\s*:\s*['"`]?(\d*\.?\d+)em/g;
const WIDEST = 0.1;

function countsOf(file) {
  const raw = readFileSync(join(ROOT, file), 'utf8');
  const isCss = file.endsWith('.css');
  const code = isCss ? blankCssComments(raw) : blankCodeComments(raw);
  const rawLines = raw.split('\n');
  const codeLines = code.split('\n');
  const rules = isCss ? CSS : TS;
  const track = isCss ? TRACK_CSS : TRACK_TS;
  const c = {};
  const lines = [];
  codeLines.forEach((line, i) => {
    if (/type-ok/.test(rawLines[i] ?? '') || /type-ok/.test(rawLines[i - 1] ?? '')) return;
    const hit = {};
    for (const k of ['face', 'caps', 'heavy']) {
      const n = rules[k].reduce((a, re) => a + (line.match(re) ?? []).length, 0);
      if (n) hit[k] = n;
    }
    const wide = [...line.matchAll(track)].filter((m) => parseFloat(m[1]) > WIDEST + 1e-9).length;
    if (wide) hit.track = wide;
    if (Object.keys(hit).length) {
      for (const [k, n] of Object.entries(hit)) c[k] = (c[k] ?? 0) + n;
      lines.push(i + 1);
    }
  });
  return { c, lines };
}

function listFiles() {
  const out = [];
  for (const d of DIRS) {
    if (!existsSync(join(ROOT, d))) continue;
    for (const rel of readdirSync(join(ROOT, d), { recursive: true })) {
      const f = `${d}/${String(rel).split(sep).join('/')}`;
      if (!/\.(tsx?|css)$/.test(f) || f.includes('/node_modules/') || /\.test\.tsx?$/.test(f)) continue;
      if (HELD_OUT.some((h) => f.startsWith(h))) continue;
      if (statSync(join(ROOT, f)).isFile()) out.push(f);
    }
  }
  for (const f of FILES) if (existsSync(join(ROOT, f))) out.push(f);
  return out;
}

const now = {};
const where = {};
for (const f of listFiles()) {
  const { c, lines } = countsOf(f);
  if (Object.keys(c).length) { now[f] = c; where[f] = lines; }
}
const base = existsSync(join(ROOT, BASELINE)) ? JSON.parse(readFileSync(join(ROOT, BASELINE), 'utf8')) : null;
const fmt = (c) => KINDS.filter((k) => c?.[k]).map((k) => `${k} ${c[k]}`).join(' · ');
const sum = (c) => KINDS.reduce((a, k) => a + (c?.[k] ?? 0), 0);
function totals(map) {
  const t = Object.fromEntries(KINDS.map((k) => [k, 0]));
  for (const c of Object.values(map)) for (const k of KINDS) t[k] += c[k] ?? 0;
  return `${Object.keys(map).length} files · ${fmt(t)}`;
}

if (argv.includes('--report')) {
  for (const [f, c] of Object.entries(now).sort((a, b) => sum(b[1]) - sum(a[1]))) {
    console.log(`  ${f}  —  ${fmt(c)}  (lines ${where[f].slice(0, 12).join(', ')}${where[f].length > 12 ? ', …' : ''})`);
  }
  console.log(`\nThe admin's old lettering, unmarked: ${totals(now)}`);
  process.exit(0);
}

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
    console.error('  Use the body face in sentence case, or mark an allowed role with `type-ok: <role>`. Raising a count');
    console.error('  means editing the baseline by hand, where review sees it.');
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
  console.error("✖ Admin lettering: the old console lettering may only shrink, and this change adds to it.");
  for (const r of rises) {
    const what = r.b ? `above its baseline (${r.over.map((k) => `${k} ${r.b[k] ?? 0} → ${r.c[k]}`).join(', ')})` : `old lettering in a file that had none (${fmt(r.c)})`;
    console.error(`    ${r.f}: ${what}\n        lines ${where[r.f]?.join(', ') ?? '—'}`);
  }
  console.error('  The admin writes the body face in sentence case (F2; Admin type sweep 2026-10-19). An eyebrow, chip, code,');
  console.error('  readout, column, band or nav group heading is allowed: say so with `type-ok: <role>` on the line.');
}
if (drops.length) {
  ok = false;
  console.error('✖ Admin lettering: these went DOWN — lock it in, in the same change, so it cannot creep back:');
  for (const d of drops) console.error(`    ${d.f}: ${fmt(d.b) || '—'} → ${fmt(d.c) || 'none (leaves the baseline)'}`);
  console.error("  node scripts/check-admin-type.mjs --init   (if the drop is another session's uncommitted work, it is theirs to lock in)");
}
if (!ok) process.exit(1);
console.log(`✓ Admin lettering: ${totals(now)} unmarked, held, none new.`);
