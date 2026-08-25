#!/usr/bin/env node
/**
 * check-spelling-consistency.mjs — one word, one spelling, everywhere a customer can read it.
 *
 * ⚠ WHY THIS EXISTS, and it is not hypothetical. On 2026-08-24 the product was shipping
 * `instalment` and `installment` side by side: ~220 occurrences repo-wide, ~31 of them in copy a
 * coach actually reads. Budget vs. Actual printed "Remaining dues instalments" one row below a
 * panel that said the same thing the other way. A single help article contradicted itself three
 * words into its own body — title one-L, quoting the real "By installment" button two-L. Worst of
 * all, two of that article's SEARCH KEYWORD lists carried the wrong spelling, so a coach typing the
 * spelling the product itself shows got a worse match than one typing the spelling it doesn't.
 *
 * Every one of those thirty-one strings read perfectly fine on its own. That is the whole problem:
 * spelling drift is invisible at the point of writing and only visible in aggregate, which is
 * exactly the shape of defect a gate catches and a reviewer does not. It survived lint, typecheck,
 * `verify:changed`, a `/simplify` pass and a `/review` pass for months.
 *
 * ⚠⚠ THIS GATE ENFORCES ONE WORD, AND THAT IS DELIBERATE — DO NOT "FINISH THE JOB" BY MOVING THE
 * SURVEY LIST INTO `ENFORCED`. Building this gate surfaced 156 further customer-visible strings in
 * two very different piles, and they are NOT one decision:
 *
 *   ~126  -our/-re/-ce   `colour` (121), `behaviour` (4), `coloured` (1)
 *         → CORRECT CANADIAN ENGLISH in a product built for Canadian sports clubs. Changing these
 *           is a BRAND VOICE decision belonging to the owner and `/marketing`, not a typo fix, and
 *           it is entirely coherent to ship `installment` beside `colour` (Canadian usage accepts
 *           both spellings of the former and only one of the latter).
 *
 *   ~31   -ise             `customised` (19), `organisation` (6), `recognised` (5), `analyses` (1)
 *         → BRITISH-ONLY. Canadian English follows Oxford `-ize`, so unlike the pile above these
 *           are wrong on their own terms. They are still not swept here, because `is_customised`
 *           is a real DATABASE COLUMN (mig 083) read by the email-template resolver — so this pile
 *           is part copy, part migration, and cannot be done as a spelling pass.
 *
 * Run `--report` to see the current standing of both piles. Enforcing either one is an owner call
 * plus a scoped sweep; until then this gate holds the line on the word that IS settled rather than
 * failing the build over 156 pre-existing strings, which would only teach everyone to skip it.
 *
 * ⚠ THIS GATE READS COPY, NEVER IDENTIFIERS. Renaming a column, enum value, route segment, class
 * name or help-article id is a MIGRATION, not a spelling fix (AGENCY_RULES.md, owner ruling
 * 2026-08-24). So comments are stripped before scanning, `scripts/`, `tests/` and
 * `supabase/migrations/` are out of scope entirely, and an applied migration's stored column note
 * is history — correct one with a NEW migration or leave it.
 *
 * ⚠ THE CANADIAN EXCEPTIONS ARE DELIBERATE AND MUST NOT BE "TIDIED UP" even if the piles above are
 * ever settled: `cheque` is a real payment method a Canadian club treasurer picks from a list, and
 * `licence` is the noun on a Canadian document. Neither is a typo. Likewise `grey` is load-bearing
 * in design-token names (a rename there is a token migration), `defence` is a SPORTS term this
 * product is built on, and `Centre` appears inside venue proper nouns.
 *
 * Escape hatch, for the rare line that genuinely needs the other spelling (quoting an external
 * document, a proper noun): put `spelling-ok` in a comment on that line or the line above it.
 *
 * Usage: node scripts/check-spelling-consistency.mjs            (exit 1 on an ENFORCED violation)
 *        node scripts/check-spelling-consistency.mjs --report   (enforced + survey, always exit 0)
 *        node scripts/check-spelling-consistency.mjs --json
 */
import fs from 'node:fs';
import path from 'node:path';

const REPORT = process.argv.includes('--report');
const JSON_OUT = process.argv.includes('--json');
const SCAN_ROOTS = ['app', 'components', 'lib'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build']);
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);
const BACKSLASH = String.fromCharCode(92);

/** Settled by the owner 2026-08-24. A violation here fails the build. */
const ENFORCED = [
  { wrong: 'instalment', right: 'installment' },
  { wrong: 'instalments', right: 'installments' },
];

/**
 * Reported by `--report`, never enforced — see the two piles in the header. This list is the
 * standing evidence for the owner decision, so keep it accurate rather than pruning it.
 */
const SURVEY = [
  // -our / -re / -ce — correct Canadian English. Owner + /marketing call.
  { wrong: 'colour', right: 'color' },
  { wrong: 'colours', right: 'colors' },
  { wrong: 'coloured', right: 'colored' },
  { wrong: 'behaviour', right: 'behavior' },
  { wrong: 'behaviours', right: 'behaviors' },
  // -ise — British-only; Canadian English takes -ize. Part copy, part column rename.
  { wrong: 'customise', right: 'customize' },
  { wrong: 'customised', right: 'customized' },
  { wrong: 'organisation', right: 'organization' },
  { wrong: 'organisations', right: 'organizations' },
  { wrong: 'organise', right: 'organize' },
  { wrong: 'organised', right: 'organized' },
  { wrong: 'recognise', right: 'recognize' },
  { wrong: 'recognised', right: 'recognized' },
  { wrong: 'analyse', right: 'analyze' },
  { wrong: 'analysed', right: 'analyzed' },
  { wrong: 'analyses', right: 'analyzes' },
  { wrong: 'summarise', right: 'summarize' },
  { wrong: 'prioritise', right: 'prioritize' },
  { wrong: 'apologise', right: 'apologize' },
  { wrong: 'enrolment', right: 'enrollment' },
  { wrong: 'catalogue', right: 'catalog' },
  { wrong: 'fulfil', right: 'fulfill' },
  { wrong: 'practise', right: 'practice' },
];

const buildPattern = (list) => new RegExp(`\\b(${list.map((v) => v.wrong).join('|')})\\b`, 'gi');
const rightOf = (list) => new Map(list.map((v) => [v.wrong, v.right]));

function collectFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectFiles(full, out);
    } else if (EXTS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Blank out comments so the gate reads only what ships. Quote-aware, because `//` inside a URL or a
 * sentence is not a comment and blanking from there would hide real copy on the rest of the line.
 * Returns an array parallel to the source lines: the code half of each line, comments removed.
 */
function stripComments(lines, isCss) {
  let inBlock = false;
  return lines.map((line) => {
    let l = line;
    if (inBlock) {
      const end = l.indexOf('*/');
      if (end === -1) return '';
      l = l.slice(end + 2);
      inBlock = false;
    }
    let quote = null;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (quote) {
        if (c === BACKSLASH) { i++; continue; }
        if (c === quote) quote = null;
        continue;
      }
      if (!isCss && (c === '"' || c === "'" || c === '`')) { quote = c; continue; }
      if (!isCss && c === '/' && l[i + 1] === '/') return l.slice(0, i);
      if (c === '/' && l[i + 1] === '*') {
        const end = l.indexOf('*/', i + 2);
        if (end === -1) { inBlock = true; return l.slice(0, i); }
        l = l.slice(0, i) + ' '.repeat(end + 2 - i) + l.slice(end + 2);
        i = end + 1;
      }
    }
    return l;
  });
}

function scan(list) {
  const pattern = buildPattern(list);
  const expected = rightOf(list);
  const hits = [];
  for (const root of SCAN_ROOTS) {
    for (const file of collectFiles(root)) {
      const src = fs.readFileSync(file, 'utf8');
      pattern.lastIndex = 0;
      const anyHit = pattern.test(src);
      // ⚠ `.test()` on a /g/ regex ADVANCES lastIndex, and `String#matchAll` inherits it — leaving
      // it set makes every scan skip the head of each line and silently report zero. Found doing
      // exactly that: the survey read 0 where a plain grep read 156.
      pattern.lastIndex = 0;
      if (!anyHit) continue;
      const raw = src.split(/\r?\n/);
      const code = stripComments(raw, path.extname(file) === '.css');
      code.forEach((line, i) => {
        // `spelling-ok` on this line or the one above waives it — see the escape hatch above.
        if (/spelling-ok/i.test(raw[i]) || (i > 0 && /spelling-ok/i.test(raw[i - 1]))) return;
        for (const m of line.matchAll(pattern)) {
          hits.push({
            file: file.split(path.sep).join('/'),
            line: i + 1,
            found: m[0],
            expected: expected.get(m[0].toLowerCase()),
            text: raw[i].trim().slice(0, 140),
          });
        }
      });
    }
  }
  return hits;
}

const violations = scan(ENFORCED);

if (JSON_OUT) {
  const survey = scan(SURVEY);
  console.log(JSON.stringify({ violations, survey, count: violations.length }, null, 2));
  process.exit(violations.length === 0 || REPORT ? 0 : 1);
}

if (REPORT) {
  const survey = scan(SURVEY);
  const byWord = survey.reduce((m, v) => ((m[v.found.toLowerCase()] = (m[v.found.toLowerCase()] ?? 0) + 1), m), {});
  console.log(`\nENFORCED — ${violations.length} violation(s)`);
  for (const v of violations) console.log(`  ${v.file}:${v.line}  "${v.found}" → "${v.expected}"`);
  console.log(`\nSURVEY (not enforced; the standing owner decision) — ${survey.length} string(s)`);
  for (const [word, n] of Object.entries(byWord).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${word}`);
  }
  console.log('\n  Run with --json for the full survey with file and line.\n');
  process.exit(0);
}

if (violations.length === 0) {
  console.log('✓ spelling consistency — one spelling per word across every customer-visible surface');
  process.exit(0);
}

console.error(`\n✗ spelling consistency — ${violations.length} customer-visible string(s) use a non-house spelling\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  "${v.found}" → "${v.expected}"`);
  console.error(`    ${v.text}`);
}
console.error(`
  One word, one spelling, everywhere a customer can read it (AGENCY_RULES.md, owner ruling
  2026-08-24) — screen copy, headings, empty states, buttons, toasts, API error messages, help
  articles AND their keywords/searchText, and the demo sandboxes' dock lines and tour narration.

  Fix the COPY only. Do NOT rename a column, enum value, route segment, class name or article id
  to satisfy this gate: that is a migration, not a spelling fix.

  If a line genuinely needs the other spelling (a proper noun, a quoted external document), put
  \`spelling-ok\` in a comment on that line or the line above it.
`);
process.exit(1);
