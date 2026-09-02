#!/usr/bin/env node
/**
 * check-css-selectors.mjs — the two CSS-Module defects nothing else in this repo can see.
 *
 * `check-css-module-purity.mjs` asks whether a rule is legal. `check-public-tokens.mjs` asks what
 * colour it uses. Neither asks the two questions that actually cost us time in cleanup tranche 6
 * (2026-09-01):
 *
 *   A. DEAD  — a class declared in a module that no component ever renders.
 *   B. CLASH — the SAME single-class selector declared twice at top level with rules that
 *              contradict each other, so one silently wins for every caller of both.
 *
 * ⚠⚠ WHY B IS THE ONE THAT MATTERS, AND WHY IT IS NARROW ON PURPOSE. `.statStrip` was declared by
 * two unrelated families ~3,500 lines apart in the coaches stylesheet — an inline text strip
 * (`.statStripItem`/`.statStripDot`, one caller) and a row of stat BOXES (`.statBox`, two callers).
 * The later declaration won for both, so the text strip lost its baseline alignment, its
 * 0.35rem/0.85rem gap and its 1.25rem bottom margin to the box row's flat 0.75rem — a real
 * rendering defect, live, invisible in review because each block reads perfectly correct on its own
 * and you can only see it by holding both in your head at once. That is a machine's job.
 *
 * ⚠⚠ AND WHY IT MUST COMPARE PROPERTIES, NOT NAMES. The tranche-6 inventory found "8 duplicate
 * selectors" by scanning for repeated `.name {`. SIX OF THE EIGHT WERE WRONG — `.duesCardStatic`,
 * `.ptMatrixNever`, `.oneAnswerMuted`, `.setupItemSkipUndo`, `.orderGrip` and the second
 * `.coachesShell` are all deliberate, idiomatic CSS that a name-matching check would cry wolf on
 * every single run. A gate that is usually wrong is a gate people learn to skip. So B fires only on
 * the intersection of three conditions, each of which excludes one of those false positives:
 *
 *   1. BOTH rules' selector list is EXACTLY the one simple class — this excludes the base-plus-
 *      variant idiom (`.duesCard, .duesCardStatic { … }` then `.duesCardStatic { … }`), which is
 *      five of the six. A shared base block is not a second definition; it is the first one.
 *   2. BOTH are at TOP LEVEL — `@media`/`@supports` overrides are the whole point of a media query.
 *      160 of the 168 raw repeats in the coaches stylesheet were exactly this.
 *   3. They declare the SAME PROPERTY with DIFFERENT values — this excludes the second
 *      `.coachesShell`, which is a deliberate second declaration site (the money type scale, hung
 *      on the portal shell next to the families it serves) whose properties are wholly disjoint
 *      from the first's. Additive is not conflicting.
 *
 * ⚠ KNOWN GAP, stated rather than papered over: shorthand/longhand pairs are NOT reconciled, so
 * `margin` in one block and `margin-bottom` in the other read as different properties and do not
 * flag on their own. `.statStrip` still fires (on `gap`), but a clash that exists ONLY between a
 * shorthand and its longhand will be missed. Expanding shorthands correctly is a much larger job
 * than this gate earns; widen it when a real defect escapes through that gap, not before.
 *
 * ── A: what counts as USED, and the bias ──────────────────────────────────────
 * Deliberately GENEROUS. A class is used if its name appears anywhere in app/components/lib/
 * scripts/tests as a member access (`styles.foo`), a quoted string (`'foo'`), or a `composes:`
 * target. That will miss some genuinely dead classes. It will not call a LIVE class dead, which is
 * the only error that costs anything here — the fix for a false positive is deleting working CSS.
 *
 * ⚠ THE DYNAMIC-INDEX GUARD. `styles[`now${phase}`]` builds a class name at runtime, and no static
 * scan can see the result. Any such template literal contributes its static PREFIX, and every class
 * starting with that prefix is treated as used. Without this, one template literal turns a whole
 * family of live classes into "dead" findings.
 *
 * ⚠⚠ **IT RUNS LAST IN `verify:changed`, AND THAT POSITION IS DELIBERATE.** It was originally
 * placed beside the other CSS checks, mid-chain. Within hours a concurrent session's in-flight
 * refactor orphaned four classes and — because the chain is `&&` — those four cosmetic findings
 * stopped schema-parity, index coverage, dictionary coverage, the org-context guard, observability
 * and the demo check from running AT ALL, for every session in the shared working copy. **Tidiness
 * debt must never mask a correctness failure.** What this gate finds is real and worth fixing, but
 * none of it can break a customer today, whereas the checks it was standing in front of all can.
 * Same reasoning applies to `check-root-files.mjs`, which moved with it. If you add a check here,
 * ask which kind it is: correctness goes early, housekeeping goes after.
 *
 * ── Ratchet, exactly like the colour-token guardrail ──────────────────────────
 * A blanket check is red on day one (the coaches stylesheet alone is >12,000 lines), and a gate
 * that is red everywhere is a gate nobody runs. Today's population is baselined; only NEW findings
 * fail. Fixing one is meant to shrink the baseline file.
 *
 *   node scripts/check-css-selectors.mjs            RATCHET (default) — fail on anything new
 *   node scripts/check-css-selectors.mjs --init     snapshot / lower the baseline
 *   node scripts/check-css-selectors.mjs --report   print the full inventory, exit 0
 *   node scripts/check-css-selectors.mjs --json     machine-readable, exit 0
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const BASELINE = join(ROOT, 'scripts/.css-selector-baseline.json');
const CSS_ROOTS = ['app', 'components', 'lib'];
const CODE_ROOTS = ['app', 'components', 'lib', 'scripts', 'tests'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'test-results']);

const mode = process.argv.includes('--init') ? 'init'
  : process.argv.includes('--report') ? 'report'
  : process.argv.includes('--json') ? 'json'
  : 'ratchet';

const rel = (p) => relative(ROOT, p).split(sep).join('/');

function walk(dir, test, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const child = join(dir, entry.name);
    if (entry.isDirectory()) walk(child, test, out);
    else if (test(entry.name)) out.push(child);
  }
  return out;
}

/** Blank comments in place so line numbers stay honest. */
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/** Split a selector list on TOP-LEVEL commas only. */
function splitSelectorList(prelude) {
  const parts = [];
  let depth = 0, quote = null, cur = '';
  for (const c of prelude) {
    if (quote) { cur += c; if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** Drop every `:global(...)` payload — those names are not this module's to own. */
function dropGlobals(selector) {
  let out = '';
  for (let i = 0; i < selector.length; i++) {
    if (selector.startsWith(':global', i)) {
      let j = i + ':global'.length;
      while (j < selector.length && /\s/.test(selector[j])) j++;
      if (selector[j] === '(') {
        let depth = 0;
        for (; j < selector.length; j++) {
          if (selector[j] === '(') depth++;
          else if (selector[j] === ')') { depth--; if (depth === 0) { j++; break; } }
        }
        i = j - 1;
        continue;
      }
      break; // bare `:global` — the rest of the selector is global
    }
    out += selector[i];
  }
  return out;
}

/** Local class names in one selector, with attribute payloads neutralised. */
function classesIn(selector) {
  const cleaned = dropGlobals(selector).replace(/\[[^\]]*\]/g, '[]');
  return [...cleaned.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map((m) => m[1]);
}

/**
 * Parse one stylesheet into the two shapes both checks need.
 * `declared`  Map name → first line it appears on (for the report)
 * `topRules`  the depth-0, single-simple-class rules, with their declarations
 */
function parseModule(file) {
  const raw = readFileSync(file, 'utf8');
  const css = stripComments(raw);
  const declared = new Map();
  const topRules = [];
  const composes = new Set();

  /* ⚠⚠ COMPOSES TARGETS ARE COLLECTED PER FILE BUT APPLIED GLOBALLY (see `composedAnywhere`).
     `composes: warmVars from './warmTheme.module.css'` uses a class that lives in a DIFFERENT
     stylesheet, and nothing in any .ts/.tsx file mentions it — so a per-file set would report the
     target as dead in the file that declares it. There are nine such cross-file composes in this
     repo today (Footer, four coach modules, the consumer start pages, the team page), all pulling
     `warmVars`/`warmTab` out of the warm theme. They survive a per-file check only by the accident
     that those two names are ALSO accessed directly in ~15 components; the next class composed
     without a direct reference would be reported dead, and deleting it would break every composer.
     Union first, judge second. */
  for (const m of css.matchAll(/composes\s*:\s*([^;}]+)/g)) {
    for (const t of m[1].split(/\s+/)) {
      if (/^[A-Za-z_][\w-]*$/.test(t) && t !== 'from' && t !== 'global') composes.add(t);
    }
  }

  const stack = [];            // one entry per open block
  let prelude = '', preludeStart = 0;

  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '{') {
      const text = prelude.trim();
      const isAt = text.startsWith('@');
      const inKeyframes = stack.some((k) => k === 'keyframes');
      const line = css.slice(0, preludeStart).split('\n').length;

      if (isAt) {
        stack.push(/^@(-\w+-)?keyframes/i.test(text) ? 'keyframes' : 'at');
      } else {
        // Is every enclosing block an at-rule? Then this rule is still "top level" for our
        // purposes only if there are NO enclosing blocks at all.
        const atTopLevel = stack.length === 0;
        stack.push('style');
        if (!inKeyframes && text) {
          const selectors = splitSelectorList(text);
          for (const s of selectors) {
            for (const n of classesIn(s)) if (!declared.has(n)) declared.set(n, line);
          }
          // Condition 1 + 2: exactly one selector, a bare simple class, at top level.
          if (atTopLevel && selectors.length === 1 && /^\.-?[A-Za-z_][\w-]*$/.test(selectors[0])) {
            /* Capture the block body to read its declarations.
               ⚠ QUOTE-AWARE, because a CSS VALUE may legally contain a brace or a semicolon:
               `content: "}"`, `background: url("data:image/svg+xml;base64,…")`. Counting raw
               braces would desync this scan for the rest of the file, and splitting on a raw `;`
               would truncate the value. Neither appears in this repo's modules today — which is
               exactly why it is worth handling now, while the parser is new and provably
               equivalent, rather than after a data URI lands and quietly breaks the gate. */
            let depth = 1, j = i + 1, q = null;
            for (; j < css.length && depth > 0; j++) {
              const ch = css[j];
              if (q) { if (ch === q && css[j - 1] !== '\\') q = null; continue; }
              if (ch === '"' || ch === "'") { q = ch; continue; }
              if (ch === '{') depth++;
              else if (ch === '}') depth--;
            }
            const body = css.slice(i + 1, j - 1);
            const decls = new Map();
            // Only the block's OWN declarations — skip anything inside a nested block.
            let nest = 0, buf = '', bq = null, prev = '';
            for (const ch of body) {
              if (bq) { buf += ch; if (ch === bq && prev !== '\\') bq = null; prev = ch; continue; }
              prev = ch;
              if (ch === '"' || ch === "'") { bq = ch; buf += ch; continue; }
              if (ch === '{') { nest++; buf = ''; continue; }
              if (ch === '}') { nest--; buf = ''; continue; }
              if (nest > 0) continue;
              if (ch === ';') {
                const idx = buf.indexOf(':');
                if (idx > 0) {
                  const prop = buf.slice(0, idx).trim().toLowerCase();
                  const val = buf.slice(idx + 1).trim().replace(/\s+/g, ' ');
                  if (/^[a-z-]+$/.test(prop) && !prop.startsWith('--')) decls.set(prop, val);
                }
                buf = '';
                continue;
              }
              buf += ch;
            }
            const idx = buf.indexOf(':');
            if (idx > 0) {
              const prop = buf.slice(0, idx).trim().toLowerCase();
              const val = buf.slice(idx + 1).trim().replace(/\s+/g, ' ');
              if (/^[a-z-]+$/.test(prop) && !prop.startsWith('--')) decls.set(prop, val);
            }
            topRules.push({ name: selectors[0].slice(1), line, decls });
          }
        }
      }
      prelude = ''; preludeStart = i + 1;
      continue;
    }
    if (c === '}' || c === ';') {
      if (c === '}' && stack.length) stack.pop();
      prelude = ''; preludeStart = i + 1;
      continue;
    }
    if (!prelude.trim() && /\s/.test(c)) { preludeStart = i + 1; continue; }
    prelude += c;
  }
  return { declared, topRules, composes };
}

// ── usage index, built once across every code root ────────────────────────────
const codeFiles = CODE_ROOTS.flatMap((d) =>
  walk(join(ROOT, d), (n) => /\.(tsx?|mjs|jsx)$/.test(n) && !n.endsWith('.d.ts')));

const used = new Set();
const dynamicPrefixes = new Set();

for (const f of codeFiles) {
  const src = readFileSync(f, 'utf8');
  // `styles.foo` and any other member access — generous by design (see header).
  for (const m of src.matchAll(/\.([A-Za-z_][\w]*)/g)) used.add(m[1]);
  // Every WORD inside every quoted string. Tokenising the contents rather than requiring the
  // whole string to be one identifier is what catches a lookup map (`x: 'chipDone'`) AND a
  // multi-class literal (`className="card cardWide"`) — the second of which a whole-string
  // match silently misses, turning two live classes into "dead" findings.
  for (const m of src.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)) {
    const body = m[1] ?? m[2] ?? m[3] ?? '';
    for (const t of body.split(/[^A-Za-z0-9_-]+/)) if (t) used.add(t);
  }
  // ⚠ The dynamic-index guard: styles[`now${x}`] → prefix "now" keeps the whole family alive.
  for (const m of src.matchAll(/\[\s*`([A-Za-z_][\w-]*)\$\{/g)) dynamicPrefixes.add(m[1]);
}

// ── run both checks over every module ─────────────────────────────────────────
const cssFiles = CSS_ROOTS
  .flatMap((d) => walk(join(ROOT, d), (n) => n.endsWith('.module.css')))
  .sort();

/* PASS 1 — parse every module, and union every `composes` target across ALL of them before judging
   anything. A cross-file compose is a real usage of a class in another file (see parseModule). */
const parsed = cssFiles.map((file) => ({ file, key: rel(file), ...parseModule(file) }));
const composedAnywhere = new Set();
for (const p of parsed) for (const n of p.composes) composedAnywhere.add(n);

const isUsed = (name) =>
  used.has(name) || composedAnywhere.has(name) ||
  [...dynamicPrefixes].some((p) => name.startsWith(p));

const dead = {};       // file → [name, …]
const clashes = {};    // file → ["name|property", …]
const clashDetail = [];

// PASS 2 — judge.
for (const { key, declared, topRules } of parsed) {
  const deadHere = [...declared.keys()].filter((n) => !isUsed(n)).sort();
  if (deadHere.length) dead[key] = deadHere;

  // Condition 3: same property, different value, between two top-level single-class rules.
  const byName = new Map();
  for (const r of topRules) {
    if (!byName.has(r.name)) byName.set(r.name, []);
    byName.get(r.name).push(r);
  }
  const found = [];
  for (const [name, rules] of byName) {
    if (rules.length < 2) continue;
    for (let a = 0; a < rules.length; a++) {
      for (let b = a + 1; b < rules.length; b++) {
        for (const [prop, valA] of rules[a].decls) {
          if (!rules[b].decls.has(prop)) continue;
          const valB = rules[b].decls.get(prop);
          if (valA === valB) continue;
          found.push(`${name}|${prop}`);
          clashDetail.push({
            file: key, name, prop,
            a: { line: rules[a].line, value: valA },
            b: { line: rules[b].line, value: valB },
          });
        }
      }
    }
  }
  if (found.length) clashes[key] = [...new Set(found)].sort();
}

const totalDead = Object.values(dead).reduce((n, a) => n + a.length, 0);
const totalClash = Object.values(clashes).reduce((n, a) => n + a.length, 0);

// ── modes ─────────────────────────────────────────────────────────────────────
if (mode === 'json') {
  console.log(JSON.stringify({ modules: cssFiles.length, dead, clashes, clashDetail }, null, 2));
  process.exit(0);
}

if (mode === 'report') {
  console.log(`CSS selector inventory — ${cssFiles.length} module(s)\n`);
  console.log(`CLASHING top-level selectors (${totalClash}) — one silently wins for every caller:`);
  if (!clashDetail.length) console.log('  (none)');
  for (const c of clashDetail) {
    console.log(`  ${c.file}`);
    console.log(`    .${c.name} — "${c.prop}" declared twice at top level`);
    console.log(`      line ${c.a.line}: ${c.prop}: ${c.a.value}`);
    console.log(`      line ${c.b.line}: ${c.prop}: ${c.b.value}   ← this one wins`);
  }
  console.log(`\nDEAD classes (${totalDead}) — declared, never rendered:`);
  for (const [f, names] of Object.entries(dead).sort()) {
    console.log(`  ${f}  (${names.length})`);
    console.log(`    ${names.join(', ')}`);
  }
  if (dynamicPrefixes.size) {
    console.log(`\nDynamic class prefixes kept alive: ${[...dynamicPrefixes].join(', ')}`);
  }
  process.exit(0);
}

if (mode === 'init') {
  writeFileSync(BASELINE, JSON.stringify({ dead, clashes }, null, 2) + '\n');
  console.log(`Baseline written: scripts/.css-selector-baseline.json`);
  console.log(`  ${totalDead} dead class(es) across ${Object.keys(dead).length} module(s)`);
  console.log(`  ${totalClash} clashing selector(s) across ${Object.keys(clashes).length} module(s)`);
  process.exit(0);
}

// ── ratchet ───────────────────────────────────────────────────────────────────
const base = existsSync(BASELINE)
  ? JSON.parse(readFileSync(BASELINE, 'utf8'))
  : { dead: {}, clashes: {} };

const newDead = [];
for (const [f, names] of Object.entries(dead)) {
  const allowed = new Set(base.dead?.[f] ?? []);
  for (const n of names) if (!allowed.has(n)) newDead.push({ file: f, name: n });
}
const newClash = [];
for (const [f, keys] of Object.entries(clashes)) {
  const allowed = new Set(base.clashes?.[f] ?? []);
  for (const k of keys) if (!allowed.has(k)) newClash.push({ file: f, key: k });
}

if (!newDead.length && !newClash.length) {
  console.log(`✓ CSS selectors: ${cssFiles.length} module(s) — no new dead or clashing selectors `
    + `(${totalDead} dead / ${totalClash} clashing grandfathered).`);
  process.exit(0);
}

if (newClash.length) {
  console.error(`\n✗ ${newClash.length} NEW clashing top-level selector(s) — one silently wins for `
    + `every caller of both:\n`);
  for (const { file, key } of newClash) {
    const d = clashDetail.find((c) => c.file === file && `${c.name}|${c.prop}` === key);
    console.error(`  ${file}`);
    console.error(`    .${d.name} — "${d.prop}" declared twice at top level`);
    console.error(`      line ${d.a.line}: ${d.prop}: ${d.a.value}`);
    console.error(`      line ${d.b.line}: ${d.prop}: ${d.b.value}   ← this one wins`);
  }
  console.error(`\n  Two families have claimed one name. Rename the one whose name describes it`);
  console.error(`  LESS well and update its callers — do not merge them, and do not reorder the`);
  console.error(`  blocks to pick a winner (that just moves the surprise).`);
}

if (newDead.length) {
  console.error(`\n✗ ${newDead.length} NEW dead class(es) — declared, never rendered:\n`);
  const byFile = new Map();
  for (const { file, name } of newDead) {
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(name);
  }
  for (const [f, names] of byFile) console.error(`  ${f}\n    ${names.join(', ')}`);
  console.error(`\n  Delete them, or — if a class is applied by a name this scan cannot see —`);
  console.error(`  make that construction visible (a static string, or a template whose prefix`);
  console.error(`  this check already honours).`);
}

console.error(`\n  Inventory:   node scripts/check-css-selectors.mjs --report`);
console.error(`  Re-baseline: node scripts/check-css-selectors.mjs --init   (last resort)\n`);
process.exit(1);
