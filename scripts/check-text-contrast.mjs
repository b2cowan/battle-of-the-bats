/**
 * check-text-contrast.mjs — the SEAM between the two contrast guardrails.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────────────────────
 *
 * Two checks already guard colour, and a whole class of real defects fell between them:
 *
 *   · `check-contrast.mjs` proves every PALETTE TOKEN clears AA on its grounds. It reasons about
 *     `--data-gray`, never about `text-data-gray/40` — a token at 40% opacity is a different
 *     colour that no token assertion has ever seen.
 *   · `check-layout` renders real screens and measures real pixels, which WOULD catch it — but its
 *     screen list is the 28 coach-portal screens. Not one marketing page is in it.
 *
 * So an opacity-modified text colour on a marketing page was checked by nothing. On 2026-08-11 a
 * sweep found 30 such usages; 22 were informational text sitting between 2.12:1 and 4.24:1 against
 * a 4.5:1 floor — including body copy, CTAs and a dismiss control — on the homepage, the pricing
 * page and the four platform pages. Every one of them passed `verify:changed` for months.
 *
 * The lesson is the one this repo keeps relearning: **a guardrail that reads files and a guardrail
 * that renders pages do not add up to coverage, and the gap between them is invisible from either
 * side.** This script closes that specific gap statically, for the case that can be computed
 * without a browser: a known-hex token, an opacity modifier, and a dark ground.
 *
 * ── What it enforces ────────────────────────────────────────────────────────────────────────
 *
 *  1. **Opacity modifiers on a `var()`-backed token are refused outright.** Tailwind composites
 *     opacity by rewriting the colour channel; it cannot do that to `var(--x)`, so the modifier
 *     silently produces a broken or ignored colour. `tailwind.config.ts` already states this
 *     invariant in a comment about `blueprint-light` — this makes it enforced rather than hoped.
 *  2. **Every other opacity-modified text colour must clear WCAG AA (4.5:1)** composited over the
 *     darkest ground in the palette, which is the conservative assumption for a dark-first product.
 *  3. **Anything that fails must be named in `ALLOWED` with a reason.** A dead entry fails too, so
 *     the list ratchets toward zero rather than accumulating.
 *
 * Genuinely decorative text (a separator glyph, a watermark numeral) and logotypes are legitimately
 * exempt under WCAG 1.4.3 — but "this one is decorative" is a JUDGEMENT, and the point of the list
 * is that making it requires editing this file, which is the decision point.
 *
 *   npm run check:text-contrast
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['app', 'components', 'lib'];
const AA_NORMAL = 4.5;

/**
 * The approved exemptions. Each needs a REASON that survives being read by a stranger — "it looked
 * fine" is not one. Keyed by file + the exact utility, not by line, so ordinary edits above it
 * don't churn this list.
 */
const ALLOWED = [
  {
    file: 'app/page.tsx',
    cls: 'text-data-gray/40',
    reason:
      'The "·" separators in the two Founding Season strips. Decorative punctuation carrying no ' +
      'information — the facts either side are full-strength — and marked aria-hidden so a screen ' +
      'reader does not announce them either. WCAG 1.4.3 does not reach them.',
  },
  {
    file: 'app/page.tsx',
    cls: 'text-blueprint-blue/20',
    reason:
      'The oversized step numeral watermarked behind each "how it works" card (absolute, ' +
      'select-none). Pure texture at 1.08:1; the step is stated in full-strength text beside it.',
  },
  {
    file: 'app/not-found.tsx',
    cls: 'text-blueprint-blue/30',
    reason:
      'The 7xl "404" watermark. The readable statement is the full-strength ' +
      '"[DIAGNOSTIC]: ROUTE_NOT_FOUND" line directly beneath it, so the numeral is a decorative ' +
      'echo rather than the message.',
  },
  {
    file: 'components/Navbar.tsx',
    cls: 'text-data-gray/50',
    reason:
      'The dimmed "HQ" in the FIELDLOGICHQ wordmark. WCAG 1.4.3 explicitly exempts text that is ' +
      'part of a logo or brand name; changing it would alter the mark, which is a brand decision ' +
      'and not this script\'s to force.',
  },
];

// ── colour maths ────────────────────────────────────────────────────────────────────────────
const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const linear = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const composite = (fg, bg, alpha) => fg.map((c, i) => alpha * c + (1 - alpha) * bg[i]);

/** Palette read from the config, so this can never drift from the tokens it judges. */
function readPalette() {
  const src = fs.readFileSync(path.join(ROOT, 'tailwind.config.ts'), 'utf8');
  const block = src.slice(src.indexOf('colors: {'), src.indexOf('fontFamily'));
  const out = {};
  for (const m of block.matchAll(/'([a-z-]+)':\s*'([^']+)'/g)) out[m[1]] = m[2];
  // Tailwind built-ins that carry no config entry but are used with modifiers.
  out.white = '#FFFFFF';
  out.black = '#000000';
  return out;
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, acc); }
    else if (e.name.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

const palette = readPalette();
// The darkest ground any of this text can land on — the conservative assumption for a dark-first
// product, and within 0.1 of the other two dark grounds in practice.
const GROUND_NAME = 'pitch-black';
const ground = hex(palette[GROUND_NAME]);
const tokenAlt = Object.keys(palette).sort((a, b) => b.length - a.length).join('|');
const RE = new RegExp(`text-(${tokenAlt})/(\\d{1,3})\\b`, 'g');

const failures = [];
const varModifiers = [];
const hits = new Map(); // `${file}::${cls}` -> count

for (const dir of SCAN_DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs)) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(RE)) {
        const [cls, token, pct] = [m[0], m[1], Number(m[2])];
        const value = palette[token];
        if (value.startsWith('var(')) { varModifiers.push({ rel, line: i + 1, cls }); continue; }
        const ratio = contrast(composite(hex(value), ground, pct / 100), ground);
        if (ratio >= AA_NORMAL) continue;
        const key = `${rel}::${cls}`;
        hits.set(key, (hits.get(key) ?? 0) + 1);
        failures.push({ rel, line: i + 1, cls, ratio });
      }
    });
  }
}

const allowKeys = new Set(ALLOWED.map((a) => `${a.file}::${a.cls}`));
const unapproved = failures.filter((f) => !allowKeys.has(`${f.rel}::${f.cls}`));
const dead = ALLOWED.filter((a) => !hits.has(`${a.file}::${a.cls}`));

let bad = false;

if (varModifiers.length) {
  bad = true;
  console.error('✗ Opacity modifier on a var()-backed colour — Tailwind cannot composite it.\n');
  for (const v of varModifiers) console.error(`  ${v.rel}:${v.line}  ${v.cls}`);
  console.error('\n  Use the solid token, or add a real hex to the palette.');
}

if (unapproved.length) {
  bad = true;
  console.error(`\n✗ Text contrast: ${unapproved.length} opacity-modified colour(s) below WCAG AA ` +
                `(${AA_NORMAL}:1) on ${GROUND_NAME}.\n`);
  for (const f of unapproved) {
    console.error(`  ${f.rel}:${f.line}  ${f.cls}  →  ${f.ratio.toFixed(2)}:1`);
  }
  console.error('\n  Drop the opacity modifier (the solid token clears AA) and let size/weight carry');
  console.error('  the hierarchy — or, if it is genuinely decorative or a logotype, add it to');
  console.error('  ALLOWED in scripts/check-text-contrast.mjs WITH A REASON.');
}

if (dead.length) {
  bad = true;
  console.error('\n✗ Text contrast: stale exemption(s) — the usage is gone, so the entry must go too.\n');
  for (const d of dead) console.error(`  ${d.file}  ${d.cls}`);
}

if (bad) process.exit(1);

const scanned = failures.length;
console.log(`✓ Text contrast: every opacity-modified text colour clears AA on ${GROUND_NAME}, ` +
            `or is 1 of ${ALLOWED.length} approved decorative/logotype exemption(s) (${scanned} occurrence(s)).`);
