/**
 * Date-correctness guardrail — block calendar-day reasoning that uses the RUNTIME's timezone.
 *
 * Production runs UTC (Amplify); orgs schedule in America/Toronto. So `new Date()` on the
 * server is a day ahead from ~8 PM Toronto, and in the browser it is whatever zone the viewer's
 * device is in. Any "what day is it / is this overdue / how many days until" answer derived
 * that way is wrong for part of every day — and, because a dev machine runs on Toronto time,
 * it is invisible locally and only wrong in production. That is the J6-056 bug class: it once
 * emptied "Today's Games" and killed the live ticker on a championship evening.
 *
 * Use the helpers in lib/timezone.ts instead:
 *   tournamentToday()                  "today" as YYYY-MM-DD in the org zone
 *   tournamentNow()                    wall-clock { date, time } for "has this time passed?"
 *   addCalendarDays(date, n)           step N calendar days from a date string
 *   daysBetweenDateStrings(a, b)       whole days between two date strings
 *   calendarDaysBetween(from, to)      same, from two Dates, counting date boundaries
 *
 * Per-file ratchet, exactly like the color-token guardrail: existing debt is grandfathered,
 * new occurrences fail. A genuinely-intentional UTC use (machine timestamps, audit stamps,
 * cache keys) opts out in place with a REASON:
 *
 *     const stamp = new Date().toISOString().slice(0, 10); // utc-intentional: nightly job key
 *
 *   node scripts/check-date-correctness.mjs            RATCHET (default)
 *   node scripts/check-date-correctness.mjs --report   write the inventory doc
 *   node scripts/check-date-correctness.mjs --init     snapshot / lower the baseline
 *   node scripts/check-date-correctness.mjs --staged <files…>   pre-commit: staged only
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const BASELINE = 'scripts/.date-correctness-baseline.json';
const REPORT = 'docs/projects/active/DATE_CORRECTNESS_DEBT.md';
const ROOTS = ['lib', 'app', 'components'];

// The file that DEFINES the safe helpers necessarily names the unsafe forms in its docs.
const EXEMPT_FILES = new Set(['lib/timezone.ts', 'scripts/check-date-correctness.mjs']);
const EXEMPT_MARKER = /utc-intentional:\s*\S/;

const RULES = [
  {
    id: 'utc-today',
    // Quote style is free ('T' / "T" / `T`) — a double-quoted variant is the same bug and
    // must not slip through (it did, until the guardrail's own self-test caught it).
    re: /new Date\(\)\s*\.toISOString\(\)\s*\.(?:split\(\s*['"`]T['"`]\s*\)\s*\[\s*0\s*\]|slice\(\s*0\s*,\s*10\s*\)|substring\(\s*0\s*,\s*10\s*\)|substr\(\s*0\s*,\s*10\s*\))/g,
    fix: 'tournamentToday()',
  },
  {
    id: 'runtime-midnight',
    re: /\.setHours\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/g,
    fix: 'compare YYYY-MM-DD strings against tournamentToday() instead of building a local midnight',
  },
];

function files() {
  const out = [];
  for (const base of ROOTS) {
    const abs = join(ROOT, base);
    if (!existsSync(abs)) continue;
    for (const rel of readdirSync(abs, { recursive: true })) {
      const p = String(rel).split(sep).join('/');
      if (!/\.tsx?$/.test(p)) continue;
      if (/\.test\.|\.spec\.|__tests__/.test(p)) continue;
      const full = `${base}/${p}`;
      if (!EXEMPT_FILES.has(full)) out.push(full);
    }
  }
  return out.sort();
}

function scan(file) {
  const raw = readFileSync(join(ROOT, file), 'utf8');
  const lines = raw.split(/\r?\n/);
  const hits = [];
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;      // comment line
    if (EXEMPT_MARKER.test(line)) return;             // opted out, with a reason
    if (EXEMPT_MARKER.test(lines[i - 1] || '')) return;
    for (const r of RULES) {
      r.re.lastIndex = 0;
      if (r.re.test(line)) hits.push({ line: i + 1, id: r.id, fix: r.fix, src: line.trim().slice(0, 110) });
    }
  });
  return hits;
}

const readBaseline = () =>
  existsSync(join(ROOT, BASELINE)) ? JSON.parse(readFileSync(join(ROOT, BASELINE), 'utf8')) : {};

// ── pre-commit ────────────────────────────────────────────────────────────────
if (process.argv.includes('--staged')) {
  let staged = process.argv.slice(2).filter(a => /\.tsx?$/.test(a));
  if (!staged.length) {
    try {
      staged = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
        .split(/\r?\n/).map(s => s.trim()).filter(f => /\.tsx?$/.test(f));
    } catch { staged = []; }
  }
  const set = new Set(staged.map(f => f.replace(/\\/g, '/')));
  if (!set.size) { console.log('✓ Pre-commit date check: nothing to check.'); process.exit(0); }
  const baseline = readBaseline();
  const bad = [];
  for (const f of files()) {
    if (!set.has(f)) continue;
    const hits = scan(f);
    if (hits.length > (baseline[f] ?? 0)) bad.push({ f, hits, allowed: baseline[f] ?? 0 });
  }
  if (bad.length) {
    console.error('✖ Pre-commit: staged file(s) answer a CALENDAR question from the runtime timezone.');
    console.error('  Production runs UTC, so this is a day late from ~8 PM Toronto every evening.');
    for (const b of bad) {
      console.error(`    ${b.f}: ${b.hits.length} (baseline ${b.allowed})`);
      for (const h of b.hits.slice(-4)) console.error(`        line ${h.line}: ${h.src}\n            → ${h.fix}`);
    }
    console.error('  Helpers: lib/timezone.ts. Genuinely a machine timestamp? // utc-intentional: why');
    process.exit(1);
  }
  console.log(`✓ Pre-commit date check: ${set.size} staged file(s) clean.`);
  process.exit(0);
}

const all = files().map(f => ({ f, hits: scan(f) })).filter(x => x.hits.length);

if (process.argv.includes('--init')) {
  const out = {};
  for (const { f, hits } of all) out[f] = hits.length;
  writeFileSync(join(ROOT, BASELINE), JSON.stringify(out, null, 2) + '\n');
  const total = all.reduce((s, x) => s + x.hits.length, 0);
  console.log(`Baseline written: ${BASELINE} — ${all.length} file(s), ${total} site(s)`);
  process.exit(0);
}

if (process.argv.includes('--report')) {
  const total = all.reduce((s, x) => s + x.hits.length, 0);
  let md = '# Date Correctness — Debt Inventory\n\n';
  md += '> Auto-generated: `node scripts/check-date-correctness.mjs --report`.\n';
  md += '> Calendar-day reasoning derived from the RUNTIME timezone (UTC in production).\n\n';
  md += `## Summary\n\n- **${total}** site(s) across **${all.length}** file(s)\n\n`;
  md += '| File:line | Rule | Code |\n|---|---|---|\n';
  for (const { f, hits } of all) for (const h of hits) md += `| \`${f}:${h.line}\` | ${h.id} | \`${h.src.replace(/\|/g, '\\|')}\` |\n`;
  writeFileSync(join(ROOT, REPORT), md);
  console.log(`Report: ${REPORT} — ${total} site(s) / ${all.length} file(s)`);
  process.exit(0);
}

// ratchet
const baseline = readBaseline();
const offenders = all.filter(({ f, hits }) => hits.length > (baseline[f] ?? 0));
if (offenders.length) {
  console.error('✖ Date-correctness ratchet: calendar-day logic using the runtime timezone.');
  console.error('  Production runs UTC — this reads a day late from ~8 PM Toronto every evening.');
  for (const o of offenders) {
    console.error(`    ${o.f}: ${o.hits.length} (baseline ${baseline[o.f] ?? 0})`);
    for (const h of o.hits.slice(0, 4)) console.error(`        line ${h.line}: ${h.src}\n            → ${h.fix}`);
  }
  console.error('  Helpers: lib/timezone.ts. Genuinely a machine timestamp? // utc-intentional: why');
  process.exit(1);
}
const total = all.reduce((s, x) => s + x.hits.length, 0);
console.log(`✓ Date-correctness ratchet: ${files().length} file(s) scanned, ${total} grandfathered site(s).`);
