import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { stripComments } from './_source-code';

/**
 * THE TABLE RECIPE GUARD — the stylesheet half of the app-wide table & list standard
 * (docs/agents/design/TABLE_AND_LIST_STANDARD.md §9; exceptions in TABLE_EXCEPTION_REGISTER.md).
 *
 * ⚠ WHY THIS EXISTS. The 2026-09-06 review rendered 319 tables and found two classes of defect no
 * existing gate could see, both in stylesheets that read perfectly well on their own:
 *
 *   1. A table rule naming a TOKEN THAT DOES NOT EXIST. The Ledger's register banded its even rows
 *      with `var(--white-4)`; nothing defines `--white-4`, an undefined token resolves to `initial`,
 *      and the zebra never painted — on any skin, from the day it was written. A plan recorded it
 *      as an "earned exception" by reading the stylesheet. `check:css-selectors` looks for the
 *      opposite problem (a rule nobody uses); nothing looked for a rule that uses nothing. (On its
 *      first run this guard found a second one: `--white-15` under the team budget items heading.)
 *
 *   2. A table rule MINTING A SIZE. Sixteen platform modules restated one recipe with headings at
 *      0.55rem — 8.8px, the smallest text in the product, labelling its columns — and the coach
 *      type ladder (eight `--type-*` steps, owner-ruled 2026-08-28) was never consumed by a single
 *      list cell. The standard says a cell decides its own size FROM THE LADDER; a literal on a
 *      table part is a ninth rung by another name.
 *
 * It follows `money-hierarchy-type-scale.test.ts`: read the real stylesheets, assert MEMBERSHIP and
 * RELATIONSHIPS, never restate a number. Two escape hatches, both deliberate and both visible in
 * the diff: a `table-exception: K-nn` comment on the declaration's line (the register row that
 * licenses it — K-01 register density, K-16 public padding), and KNOWN_DEBT below, which pins the
 * files the review could not render (register F-18: the club-side admin, blocked on a fixture)
 * and the surfaces the standard scopes out. A NEW file with a literal fails; a pinned file that
 * grows a new one does not, which is the ratchet's one honest limit (file grain, not rule grain —
 * a follow-up may tighten it) — shrink the list when a file is fixed, never grow it without a
 * register id.
 *
 * ⚠ WHAT ITS FIRST /review CAUGHT IN THE GUARD ITSELF (2026-09-06), so nobody re-introduces it:
 * declarations are found by splitting a rule's BODY on `;`, never by scanning lines — the first
 * version anchored `font-size` to the start of a line and was green over `.table { width: 100%;
 * font-size: 0.87rem; }`; a class named with a part SUFFIX (`.periodTh`, `.periodTd`) is a table
 * part too; and token definitions are collected from comment-STRIPPED source, or a comment saying
 * `--foo: 12px` would make `--foo` "defined".
 */

const ROOT = process.cwd();

/** Files whose table rules still carry literal sizes, each with the register row that owns it. */
const KNOWN_DEBT: Record<string, string> = {
  // F-18 — club-side admin tables; no fixture could render them, so they were not touched.
  'app/[orgSlug]/admin/accounting/accounting.module.css': 'F-18',
  'app/[orgSlug]/admin/accounting/budget/budget.module.css': 'F-18',
  'app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css': 'F-18',
  'app/[orgSlug]/admin/families/families.module.css': 'F-18',
  'app/[orgSlug]/admin/house-league/house-league.module.css': 'F-18',
  'app/[orgSlug]/admin/org/members/members.module.css': 'F-18',
  'app/[orgSlug]/admin/rep-teams/rep-teams.module.css': 'F-18',
  'app/[orgSlug]/admin/org/tournaments/tournaments-admin.module.css': 'F-18',
  'app/[orgSlug]/admin/tournaments/archives/archives-admin.module.css': 'F-18',
  // K-13 — the tournament admin's schedule generator preview and health tables keep the shell's
  // own cell sizes beside the flat-row list; headings were moved to the baseline in the same pass.
  'app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css': 'K-13',
  'components/admin/import/TournamentTeamsImportDialog.module.css': 'out of scope — a dialog (standard §1)',
  'app/platform-admin/dev-tools/playbook.module.css': 'internal dev tool, not a customer surface',
};

// ── One read per file, shared by every collector below ────────────────────────────────────────
function walk(dir: string, keep: (name: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.tmp')) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, keep, out);
    else if (keep(name)) out.push(p);
  }
  return out;
}
const rel = (f: string) => path.relative(ROOT, f).replace(/\\/g, '/');
/** Block comments blanked to spaces (line numbers survive; a marker inside one is still findable). */
const blankComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
const CSS: Map<string, string> = new Map(
  [...walk(path.join(ROOT, 'app'), (n) => n.endsWith('.css')), ...walk(path.join(ROOT, 'components'), (n) => n.endsWith('.css'))]
    .map((f) => [rel(f), readFileSync(f, 'utf8')]),
);

/** Every custom property the product defines anywhere it can — stylesheets, and TS that writes them. */
function definedTokens(): Set<string> {
  const defs = new Set<string>();
  for (const css of CSS.values()) for (const m of blankComments(css).matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) defs.add(m[1]);
  const tsFiles = ['lib', 'app', 'components'].flatMap((d) => walk(path.join(ROOT, d), (n) => /\.(ts|tsx)$/.test(n)));
  for (const f of tsFiles) {
    const src = stripComments(readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/['"`](--[a-zA-Z0-9_-]+)['"`]\s*[:,\]]/g)) defs.add(m[1]);
    for (const m of src.matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*[^;'"`]/g)) defs.add(m[1]);
  }
  return defs;
}

type Rule = { file: string; sel: string; body: string; line: number };

/**
 * A selector names a TABLE PART when it carries an element token (`table`, `thead`, `tbody`,
 * `tfoot`, `tr`, `th`, `td`) or a class that is one by name — the coach vocabulary's `.table`,
 * `.tableWrap`, `.th`, `.td`, `.tr`, `.tdNum`, `.thNum`, and any class whose name ENDS in a part
 * (`.periodTh`, `.periodTd`, `.summaryTr`). Deliberately NOT any class that merely contains "row"
 * or "cell" — an eyebrow is not a row, and a caption span inside a cell is judged where it
 * renders, by the layout sweep's `type-ladder` rule.
 */
const TABLE_SEL = /(^|[\s>+~,(])(table|thead|tbody|tfoot|th|td|tr)\b|\.(table|th|td|tr)([A-Z][a-zA-Z]*)?(?![a-zA-Z_-])|\.[a-z][a-zA-Z]*(Th|Td|Tr|Table)(?![a-zA-Z_-])/;
function tableRules(): Rule[] {
  const rules: Rule[] = [];
  for (const [file, raw] of CSS) {
    const src = blankComments(raw);
    const stack: { sel: string; line: number; bodyStart: number }[] = [];
    let pos = 0;
    let line = 1;
    for (;;) {
      const open = src.indexOf('{', pos);
      const close = src.indexOf('}', pos);
      if (open === -1 && close === -1) break;
      if (open !== -1 && open < close) {
        const head = src.slice(pos, open);
        line += (head.match(/\n/g) || []).length;
        stack.push({ sel: head.trim(), line, bodyStart: open + 1 });
        pos = open + 1;
      } else {
        const chunk = src.slice(pos, close);
        line += (chunk.match(/\n/g) || []).length;
        const top = stack.pop();
        if (top && !top.sel.startsWith('@') && TABLE_SEL.test(top.sel)) {
          rules.push({ file, sel: top.sel.replace(/\s+/g, ' '), body: raw.slice(top.bodyStart, close), line: top.line });
        }
        pos = close + 1;
      }
    }
  }
  return rules;
}

/**
 * The one classification of a `font-size` declaration the two size tests share. Declarations are
 * taken from the BODY split on `;` — a size is a size wherever it sits on the line. The exception
 * marker is honoured when it sits on the same physical line as the declaration.
 */
const LADDER_VALUE = /^var\(--(type|money)-[a-z-]+\)$/;
const EXCEPTION_MARK = /table-exception:\s*[KAF]-\d\d/;
function fontSizes(body: string): { value: string; ok: boolean }[] {
  const out: { value: string; ok: boolean }[] = [];
  const lines = body.split('\n');
  for (const ln of lines) {
    const clean = blankComments(ln);
    for (const decl of clean.split(';')) {
      const m = decl.match(/(^|\s)font-size\s*:\s*(.+)$/);
      if (!m) continue;
      const value = m[2].trim();
      out.push({ value, ok: LADDER_VALUE.test(value) || /^(inherit|1em|100%|0)$/.test(value) || EXCEPTION_MARK.test(ln) });
    }
  }
  return out;
}

const RULES = tableRules();
const DEFINED = definedTokens();

test('every token a table rule names is defined somewhere (an undefined token paints nothing, in silence)', () => {
  const missing: string[] = [];
  for (const r of RULES) {
    for (const m of stripComments(r.body).matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)\s*([,)])/g)) {
      const [, token, next] = m;
      if (next === ',') continue; // a fallback is a decision; the guard is about silent nothing
      if (!DEFINED.has(token)) missing.push(`${r.file}:${r.line} ${r.sel} → var(${token})`);
    }
  }
  assert.deepEqual(missing, [], `Table rules naming tokens that are defined nowhere:\n  ${missing.join('\n  ')}`);
});

test('a table part takes its size from the type ladder, or carries a register id (no ninth rung)', () => {
  const offenders: string[] = [];
  for (const r of RULES) {
    if (KNOWN_DEBT[r.file]) continue;
    for (const fs of fontSizes(r.body)) if (!fs.ok) offenders.push(`${r.file}:${r.line} ${r.sel} → font-size: ${fs.value}`);
  }
  assert.deepEqual(offenders, [], `Table rules minting a size outside the ladder (add a register id, or fix):\n  ${offenders.join('\n  ')}`);
});

test('KNOWN_DEBT only names files that still carry a literal — shrink it as files are fixed', () => {
  const stillLiteral = new Set<string>();
  for (const r of RULES) for (const fs of fontSizes(r.body)) if (!fs.ok) stillLiteral.add(r.file);
  const stale = Object.keys(KNOWN_DEBT).filter((f) => !stillLiteral.has(f));
  assert.deepEqual(stale, [], `KNOWN_DEBT names files with no literal left — remove them:\n  ${stale.join('\n  ')}`);
});

test('the guard itself sees a size wherever it sits (the blind spot /review found on day one)', () => {
  // A one-line rule with the size mid-line, and a size after another declaration on the same line.
  assert.deepEqual(fontSizes(' width: 100%; border-collapse: collapse; font-size: 0.87rem; ').map((f) => f.ok), [false]);
  assert.deepEqual(fontSizes('  padding: 0.45rem 0.7rem; text-align: left;\n  color: red; font-size: 0.72rem; font-weight: 700;').map((f) => f.value), ['0.72rem']);
  assert.ok(TABLE_SEL.test('.periodTh'), 'a class ending in Th is a table part');
  assert.ok(TABLE_SEL.test('.periodTd'), 'a class ending in Td is a table part');
  assert.ok(!TABLE_SEL.test('.heroEyebrow'), 'an eyebrow is not a row');
  assert.ok(!TABLE_SEL.test('.rowLabel'), 'a settings row label is judged by the rendered gate, not here');
});

test('the baseline is the standard: the global cell rule sizes from the ladder and paints no hover', () => {
  const globals = CSS.get('app/globals.css') ?? '';
  const td = globals.match(/\ntd\s*\{([^}]*)\}/);
  const th = globals.match(/\nth\s*\{([^}]*)\}/);
  assert.ok(td && th, 'globals.css declares the th / td baseline');
  assert.match(td![1], /font-size:\s*var\(--type-body\)/, 'td takes --type-body (2026-09-06: 0.9375rem here overrode every table-level size in the app)');
  assert.match(th![1], /font-size:\s*var\(--type-support\)/, 'th takes --type-support');
  assert.doesNotMatch(globals, /\ntbody tr:hover\s*\{/, 'no global row hover — hover belongs to a row that opens');
  assert.match(td![1], /padding:\s*var\(--table-pad-compact\)/, 'the baseline density is the compact token');
});
