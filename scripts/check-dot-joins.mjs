#!/usr/bin/env node
/**
 * check-dot-joins.mjs — A NEW DOT JOIN SAYS WHY (owner, 2026-11-26).
 *
 * The rule (docs/agents/design/TABLE_AND_LIST_STANDARD.md, "A list or a table cell is not a dotted line"):
 * different facts get columns; a list of like things gets a count with the names underneath; anything more
 * belongs in the opened row. A dot is allowed only in a quiet caption, with two items at most.
 *
 * It was ruled after the same finding came up again and again: several things in one font, joined by "·",
 * because it fits any number of things into one slot without deciding which matters. A first pass took it by
 * default, and nothing stopped it.
 *
 * Every line in app/, components/ and lib/ whose CODE holds a separator dot (the "·" itself, its escapes and
 * HTML entities, or a bullet used as one) must either
 *   • be one that was already there when the rule landed (`scripts/.dot-join-baseline.json`), or
 *   • carry `dot-join-ok: <reason>` on the line, or in the comment directly above it.
 * "Code" is read with the TypeScript parser: strings, template text, JSX text and regular expressions. A dot in
 * a comment is not counted, and a "//" inside a URL or a pattern hides nothing. It scans all of the code, not
 * only files that draw tables: the string in a table cell is often built somewhere else.
 *
 * The baseline holds a fingerprint of each old line, so:
 *   • a new dotted line fails, and so does an old one that is edited (its comment included) or copied;
 *   • a line that is re-indented or moves within its file still passes;
 *   • a line that moves to another file passes only if it is distinctive (40 characters or more, and the only
 *     one of its kind). A short or repeated one needs its reason: otherwise removing any `.join(' · ')` would
 *     leave a free pass for the next new one;
 *   • removing one needs no follow-up.
 * `--init` prunes removed lines. It reads the WORKING COPY, which several sessions share: commit a pruned
 * baseline only when no one else's unfinished edits touch a dotted line, or a clean checkout fails.
 *
 * What it cannot see: items added to a join on a neighbouring line (only the line with the dot is held); a join
 * through a separator defined elsewhere (the definition is checked, its later uses are not); and whether a
 * stated reason is a good one. Those are the reviewer's call.
 *
 * Modes:  node scripts/check-dot-joins.mjs            check (verify:changed)
 *         node scripts/check-dot-joins.mjs --init     first run writes the baseline; later runs only prune it
 *         node scripts/check-dot-joins.mjs --report   the old dotted lines, file by file, largest first
 *         node scripts/check-dot-joins.mjs --help
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import ts from 'typescript';
import { blankCssComments } from './lib/code-comments.mjs';

const ROOT = process.cwd();
const BASELINE = 'scripts/.dot-join-baseline.json';
const DIRS = ['app', 'components', 'lib'];

// The dot, the ways of writing it that render the same, and the bullet that would stand in for it (spaced, or
// alone in JSX text; a run of bullets masking a value is not a separator).
const DOT = /\u00b7|\\u00b7|\\u\{0*b7\}|\\xb7|&middot;|&centerdot;|&#0*183;|&#x0*b7;|&bull;| \u2022 | \\u2022 /gi;
const CSS_DOT = /\u00b7|\\0*b7(?![0-9a-f])/gi;
const JSX_BULLET = /(?<!\u2022)\u2022(?!\u2022)/g;
const REASON = /dot-join-ok:\s*[A-Za-z0-9"'(]/;
/** A line that is nothing but (part of) a comment, `{/* … *\/}` included. */
const COMMENT_LINE = /^\s*(?:\/\/.*|(?:\{\s*)?\/\*(?:(?!\*\/).)*(?:\*\/\s*\}?)?\s*|\*(?:(?!\*\/).)*(?:\*\/\s*\}?)?\s*|(?:(?!\*\/|\/\*).)*\*\/\s*\}?\s*)$/;
const TEXT_KINDS = new Set([
  ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NoSubstitutionTemplateLiteral, ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail, ts.SyntaxKind.JsxText, ts.SyntaxKind.RegularExpressionLiteral,
]);
const MOVABLE_LENGTH = 40;

const argv = process.argv.slice(2);
const KNOWN = new Set(['--init', '--report', '--help', '-h']);
const unknown = argv.filter((a) => !KNOWN.has(a));
if (unknown.length) { console.error(`✖ Unknown option: ${unknown.join(' ')} (see --help)`); process.exit(2); }
if (argv.includes('--help') || argv.includes('-h')) {
  const doc = readFileSync(new URL(import.meta.url), 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[1];
  console.log(doc.split('\n').map((l) => l.replace(/^ \* ?/, '')).join('\n').trim());
  process.exit(0);
}

/** Where in the source a dot sits inside code (never a comment): character offsets. */
function dotOffsets(file, raw) {
  const at = [];
  const scan = (text, from, re) => { for (const m of text.matchAll(re)) at.push(from + m.index); };
  if (file.endsWith('.css')) { scan(blankCssComments(raw), 0, CSS_DOT); return at; }
  const source = ts.createSourceFile(file, raw, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    if (TEXT_KINDS.has(node.kind)) {
      const from = node.kind === ts.SyntaxKind.JsxText ? node.pos : node.getStart(source);
      const text = raw.slice(from, node.end);
      scan(text, from, DOT);
      if (node.kind === ts.SyntaxKind.JsxText) scan(text, from, JSX_BULLET);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return at;
}

/** The unexplained dotted lines of one file: [{ line, print, text }]. */
function dottedLines(file) {
  const raw = readFileSync(join(ROOT, file), 'utf8');
  if (!/\u00b7|\u2022|b7|183|middot|centerdot|bull|u2022/i.test(raw)) return [];
  const offsets = dotOffsets(file, raw);
  if (!offsets.length) return [];
  const rawLines = raw.split('\n');
  const starts = [0];
  for (let i = raw.indexOf('\n'); i >= 0; i = raw.indexOf('\n', i + 1)) starts.push(i + 1);
  const lineOf = (pos) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; } return lo; };
  const found = [];
  for (const i of [...new Set(offsets.map(lineOf))].sort((a, b) => a - b)) {
    if (REASON.test(rawLines[i])) {
      // A reason written on the line itself.
      continue;
    }
    // Or in the comment directly above: walk up while the lines are nothing but comment.
    let excused = false;
    for (let j = i - 1; j >= 0 && COMMENT_LINE.test(rawLines[j].replace(/\r$/, '')); j--) {
      if (REASON.test(rawLines[j])) { excused = true; break; }
    }
    if (excused) continue;
    const text = rawLines[i].trim().replace(/\s+/g, ' ');
    found.push({ line: i + 1, print: createHash('sha1').update(text).digest('hex').slice(0, 12), text });
  }
  return found;
}

function listFiles() {
  const out = [];
  for (const d of DIRS) {
    if (!existsSync(join(ROOT, d))) continue;
    for (const rel of readdirSync(join(ROOT, d), { recursive: true })) {
      const f = `${d}/${String(rel).split(sep).join('/')}`;
      if (!/\.(tsx?|css)$/.test(f) || f.includes('/node_modules/') || /\.test\.tsx?$/.test(f)) continue;
      if (statSync(join(ROOT, f)).isFile()) out.push(f);
    }
  }
  return out.sort();
}

const now = {};
for (const f of listFiles()) {
  const found = dottedLines(f);
  if (found.length) now[f] = found;
}
const base = existsSync(join(ROOT, BASELINE)) ? JSON.parse(readFileSync(join(ROOT, BASELINE), 'utf8')) : null;
const total = (map) => Object.values(map).reduce((a, v) => a + v.length, 0);

if (argv.includes('--report')) {
  for (const [f, found] of Object.entries(now).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${f}  —  ${found.length}  (lines ${found.slice(0, 12).map((x) => x.line).join(', ')}${found.length > 12 ? ', …' : ''})`);
  }
  console.log(`\nDotted lines with no stated reason: ${total(now)} in ${Object.keys(now).length} files.`);
  process.exit(0);
}

/**
 * Match today's lines against the baseline. Each file spends its own fingerprints first; what a file has over is
 * then allowed only if it is a distinctive line that went missing from another file (it moved). The rest is new.
 * `kept` is the baseline as it stands today: only matched lines, so writing it can never admit a new one.
 */
function compare() {
  const kept = {};
  const over = [];
  const spare = new Map();
  const inBase = new Map();
  for (const list of Object.values(base)) for (const p of list) inBase.set(p, (inBase.get(p) ?? 0) + 1);
  for (const f of new Set([...Object.keys(base), ...Object.keys(now)])) {
    const left = new Map();
    for (const p of base[f] ?? []) left.set(p, (left.get(p) ?? 0) + 1);
    for (const x of now[f] ?? []) {
      if (left.get(x.print)) { left.set(x.print, left.get(x.print) - 1); (kept[f] ??= []).push(x.print); }
      else over.push({ f, ...x });
    }
    for (const [p, n] of left) if (n) spare.set(p, (spare.get(p) ?? 0) + n);
  }
  const added = [];
  for (const x of over) {
    const movable = x.text.length >= MOVABLE_LENGTH && inBase.get(x.print) === 1;
    if (movable && spare.get(x.print)) { spare.set(x.print, spare.get(x.print) - 1); (kept[x.f] ??= []).push(x.print); }
    else added.push(x);
  }
  const stale = [...spare.values()].reduce((a, n) => a + n, 0);
  return { kept, added, stale };
}

function write(map) {
  const sorted = Object.fromEntries(Object.keys(map).sort().map((f) => [f, [...map[f]].sort()]));
  writeFileSync(join(ROOT, BASELINE), JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Baseline written: ${BASELINE} — ${total(sorted)} old dotted lines in ${Object.keys(sorted).length} files.`);
}

if (!base) {
  if (!argv.includes('--init')) { console.error(`✖ No baseline at ${BASELINE}. Create it once with --init.`); process.exit(1); }
  write(Object.fromEntries(Object.entries(now).map(([f, found]) => [f, found.map((x) => x.print)])));
  process.exit(0);
}

const { kept, added, stale } = compare();

if (argv.includes('--init')) {
  write(kept);
  if (added.length) console.log(`  ${added.length} new dotted line(s) were NOT admitted; run the check to see them.`);
  process.exit(0);
}

if (added.length) {
  console.error('✖ Dot joins: a new or reworded line joins things with "·" and does not say why.');
  for (const x of added) console.error(`    ${x.f}:${x.line}\n        ${x.text.slice(0, 160)}`);
  console.error('  Different facts get columns. A list of like things gets a count with the names underneath. Anything more');
  console.error('  belongs in the opened row. A dot is allowed only in a quiet caption, with two items at most');
  console.error('  (docs/agents/design/TABLE_AND_LIST_STANDARD.md). Where it is right, say why on the line or the line above:');
  console.error('  `// dot-join-ok: <reason>`  (in JSX: `{/* dot-join-ok: <reason> */}`).');
  process.exit(1);
}
console.log(`✓ Dot joins: ${total(kept)} old dotted lines held, none new${stale ? ` (${stale} since removed; --init prunes them)` : ''}.`);
