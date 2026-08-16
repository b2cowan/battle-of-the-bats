/**
 * A budget line is a COST, EXPECTED FUNDRAISING or EXPECTED SPONSORSHIP — enforced as a RULE over
 * the source tree rather than surface by surface.
 *
 * ⚠⚠ THIS FILE PASSED WHILE FIVE READERS WERE WRONG (2026-08-15), and that is the second rule
 * below. The original check asked whether a file MENTIONS the kind column. Every one of the five
 * mentioned it — and then compared it to a literal: `row.line_kind === 'funding' ? 'funding' :
 * 'cost'`. That shorthand was correct with two kinds and became silently wrong with three, filing
 * every sponsorship line as a COST, which flips the sign on real money: a team that budgeted
 * $2,000 of sponsorship gets asked for $2,000 MORE from families instead of less. TypeScript
 * cannot see it, nothing throws, and a guard that only checks for a mention reports green.
 *
 * So there are now TWO rules, and they catch different failures:
 *   1. **the kind-BLIND reader** — a file that reads the table and has never heard of the column;
 *   2. **the banned SHAPE** — a kind compared to a literal anywhere outside the shared reader.
 * Neither subsumes the other, which is why both are kept.
 *
 * WHY THIS EXISTS, PRECISELY. Migration 230 gave `rep_budget_lines` a `line_kind`, and its own
 * comment warned "consumers must EXCLUDE funding lines from cost paths". A comment has no teeth.
 * The `/simplify` altitude pass on the day it shipped found THREE live readers that had never
 * heard of the column, all of them written before it existed and none of them touched by the
 * change that introduced it:
 *
 *   · season rollover copied lines forward without the kind, so every expected-funding line came
 *     back next season as a COST — a write path, so the damage was permanent and invisible;
 *   · the Generate-Installments preview summed every line, so a team that budgeted $4,000 of
 *     fundraising was still offered dues for the full season cost;
 *   · the tryout accept-to-roster drawer prefilled a family's dues the same way.
 *
 * All three were "somebody forgets to filter" — the failure mode a per-consumer convention
 * guarantees eventually. So the rule is stated once, here, over the whole tree: **every reader of
 * `rep_budget_lines` either understands the kind, or is on the list below saying why it doesn't
 * have to.** Adding a call site fails the build until someone edits this file, which is the point:
 * that edit IS the decision. (Same shape as the archive-door allow-lists in
 * `coach-season-write-guard.test.ts`.)
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
// `scripts` is in scope too: the seeds WRITE budget lines, and a seed that quietly files a
// fundraising line as a cost puts a wrong world in front of a prospect (the coach sandbox) or a
// wrong number in front of the owner during QA.
const SCAN_DIRS = ['app', 'lib', 'components', 'scripts'];
const TABLE = 'rep_budget_lines';

/**
 * Readers that DO NOT need to know about the kind, each with the reason it doesn't.
 *
 * ⚠ A path here is a decision, not a formality. "It happens to work today" is not a reason —
 * write down what makes the file kind-agnostic BY CONSTRUCTION, so the next person can tell
 * whether their change breaks that.
 */
const KIND_AGNOSTIC: Array<{ path: string; reason: string }> = [
  {
    path: 'app/api/admin/accounting/team-budget-items/route.ts',
    reason: 'COUNTS lines per budget ITEM so a club can tell a word tried once from one a season '
      + 'depends on. It sums nothing and reads no amount — and a money-in line carries no item at '
      + 'all (they have no category or item by design), so the kind cannot change the answer.',
  },
  {
    path: 'app/api/admin/accounting/team-budget-items/[itemId]/publish/route.ts',
    reason: 'Repoints lines from an absorbed duplicate ITEM onto the published one. It touches '
      + 'item_id and nothing else — no amount, no kind, no total — and money-in lines carry no '
      + 'item, so none of them can be in the set it moves.',
  },
  {
    path: 'app/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/lines/route.ts',
    reason: 'Creates a line and is where the kind is CHOSEN — it validates the value it writes.',
  },
  {
    path: 'app/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/lines/[lineId]/route.ts',
    reason: 'Edits/deletes ONE line addressed by id. It never sums anything, and it is the one '
      + 'place a coach reclassifies a line, so it must accept both kinds.',
  },
  {
    path: 'app/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/lines/[lineId]/periods/route.ts',
    reason: 'Time-phases ONE line addressed by id. Periods reconcile to their own parent total, '
      + 'which is positive for both kinds.',
  },
  {
    path: 'lib/db.ts',
    reason: 'Counts lines to answer "has this team started its money at all?" — a funding line is '
      + 'as good an answer as a cost line.',
  },
  {
    path: 'lib/demo-coach-reconcile-core.ts',
    reason: 'Re-anchors period DATES by id and sort order. It never reads an amount.',
  },
  {
    path: 'scripts/seed-qa-day-fixtures.mjs',
    reason: 'The owner-QA lab is deliberately COST-ONLY — it exists to exercise the cost side of '
      + 'the money screens. If a funding line is ever seeded there it must say line_kind, and '
      + 'removing this entry is how that gets noticed.',
  },
];

/** Every file under the scan dirs, excluding tests and build output. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Does this file show it understands the kind? Any of:
 *  · it goes through the shared arithmetic (which partitions by kind itself),
 *  · it names the column, or
 *  · it names the funding kind.
 */
function understandsKind(source: string): boolean {
  return source.includes('computeBudgetTotals')
    || source.includes('line_kind')
    || source.includes('lineKind');
}

describe('every reader of rep_budget_lines accounts for the line kind', () => {
  it('has no unlisted, kind-blind call site', () => {
    const allowed = new Set(KIND_AGNOSTIC.map(e => e.path));
    const offenders: string[] = [];

    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        const source = readFileSync(file, 'utf8');
        if (!source.includes(TABLE)) continue;
        const rel = relative(ROOT, file).split(sep).join('/');
        if (allowed.has(rel)) continue;
        if (understandsKind(source)) continue;
        offenders.push(rel);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      'These files read rep_budget_lines without accounting for line_kind. A funding line is money '
      + 'coming IN: summing it as a cost inflates the season and the dues generated from it. Either '
      + 'filter/partition by kind (or go through computeBudgetTotals), or add the file to '
      + 'KIND_AGNOSTIC in this test with the reason it does not need to:\n  '
      + offenders.join('\n  '),
    );
  });

  it('lists a reason for every kind-agnostic exception', () => {
    for (const entry of KIND_AGNOSTIC) {
      assert.ok(
        entry.reason.trim().length > 30,
        `${entry.path} is exempt without a real reason — say what makes it kind-agnostic.`,
      );
    }
  });

  it('has no stale exception — every listed file still touches the table', () => {
    for (const entry of KIND_AGNOSTIC) {
      const full = join(ROOT, entry.path);
      let source: string;
      try {
        source = readFileSync(full, 'utf8');
      } catch {
        assert.fail(`${entry.path} is on the exception list but no longer exists. Remove it.`);
      }
      assert.ok(
        source.includes(TABLE),
        `${entry.path} is on the exception list but no longer reads ${TABLE}. Remove it.`,
      );
    }
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * RULE 2 — THE BANNED SHAPE
 *
 * A budget line's kind may not be compared to a literal outside `lib/coach-budget-totals.ts`.
 *
 * That module owns the vocabulary: `normalizeBudgetLineKind` narrows a raw column value,
 * `isFundingKind` answers "is this money coming in", `FUNDING_LINE_KINDS` lists the money-in
 * kinds, and `computeBudgetTotals` partitions by them. Every reader goes through one of those, so
 * adding a FOURTH kind is one edit in one file — which is the property the two-kind shorthand
 * destroyed and this rule restores.
 *
 * ⚠ It bans COMPARISON, not the literal. Writing a chosen kind (`line_kind: 'funding'` in a create
 * route, an importer or a seed) is how a value gets INTO the column and is perfectly correct; it is
 * `=== 'funding'` — and its database twin `.eq('line_kind', 'funding')` — that silently splits the
 * world in two when there are three of them.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
const SHARED_KIND_READER = 'lib/coach-budget-totals.ts';
const KIND_LITERALS = 'cost|funding|sponsorship';

/**
 * ⚠ Deliberately widened past `lineKind`/`line_kind` on the left-hand side. The five readers that
 * got through wrote it that way, but `const k = row.line_kind; if (k === 'funding')` is the same
 * bug behind one more variable, and a guard that can be stepped around by renaming a local is not
 * a guard. So in any file that touches the kind at all, comparing ANYTHING to a kind literal is
 * the offence — which is strict on purpose, and has an exemption list with reasons below.
 */
const BANNED_SHAPES: { id: string; re: RegExp }[] = [
  { id: 'x === \'funding\'', re: new RegExp(`(===|!==|==(?!=)|!=(?!=))\\s*['"\`](${KIND_LITERALS})['"\`]`) },
  { id: '\'funding\' === x', re: new RegExp(`['"\`](${KIND_LITERALS})['"\`]\\s*(===|!==|==(?!=)|!=(?!=))`) },
  { id: '.eq(\'line_kind\', …)', re: new RegExp(`\\.(eq|neq|filter)\\(\\s*['"\`]line_kind['"\`]`) },
  /**
   * ⚠ THE TWO SHAPES A COMPARISON BECOMES WHEN SOMEBODY "TIDIES IT UP" — added after review
   * pointed out the first three would wave both through.
   *
   * `switch (lineKind) { case 'funding': … }` and `{ funding: …, cost: … }[lineKind]` are the
   * natural next refactors of `=== 'funding'`, and both carry the identical defect: a fourth kind
   * falls to `default` / `undefined` instead of failing loudly. A guard that only knows the shape
   * the last bug happened to wear teaches the next author to wear a different one.
   */
  { id: 'case \'funding\':', re: new RegExp(`\\bcase\\s+['"\`](${KIND_LITERALS})['"\`]\\s*:`) },
  // An INLINE object literal indexed by the kind. Requiring the `}` immediately before the `[`
  // is what keeps this off the CORRECT pattern — a NAMED exhaustive `Record<BudgetLineKind, …>`
  // indexed by the kind (`LINE_KIND_LABEL[k]`, `KIND_HINT_LONG[form.lineKind]`), which a fourth
  // kind turns into a compile error and is exactly what readers should be using instead.
  { id: '{ funding: … }[kind]', re: /\}\s*\[\s*[\w.?]*[Ll]ine[Kk]ind/ },
];

/**
 * Comparisons that are NOT this bug, each with the reason it isn't.
 *
 * ⚠ A path here is a decision. "It reads fine" is not a reason — say what makes the comparison
 * safe against a FOURTH kind being added, because that is the event this rule exists to survive.
 */
const SHAPE_EXCEPTIONS: Array<{ path: string; reason: string }> = [];

/** Does this file deal in budget-line kinds at all? Anything else cannot commit this offence. */
function touchesLineKind(source: string): boolean {
  return source.includes('line_kind') || source.includes('lineKind') || source.includes('BudgetLineKind');
}

describe('a budget line kind is never compared to a literal outside the shared reader', () => {
  it('finds files that deal in the kind at all (guards against a vacuous pass)', () => {
    let seen = 0;
    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        if (touchesLineKind(readFileSync(file, 'utf8'))) seen += 1;
      }
    }
    assert.ok(seen > 10, `expected the budget-line readers, found ${seen} files mentioning the kind`);
  });

  it('has no banned comparison', () => {
    const allowed = new Set(SHAPE_EXCEPTIONS.map(e => e.path));
    const offenders: string[] = [];

    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        const rel = relative(ROOT, file).split(sep).join('/');
        if (rel === SHARED_KIND_READER || allowed.has(rel)) continue;
        const source = readFileSync(file, 'utf8');
        if (!touchesLineKind(source)) continue;
        source.split('\n').forEach((line, i) => {
          // ⚠ Comments are stripped, INCLUDING block-comment continuations. Several of these files
          // quote the banned shape in order to warn about it — the warning must not be the offence.
          const trimmed = line.trim();
          if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//')) return;
          const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
          if (!/line_kind|lineKind/.test(code) && !new RegExp(`['"\`](${KIND_LITERALS})['"\`]`).test(code)) return;
          for (const shape of BANNED_SHAPES) {
            if (shape.re.test(code)) offenders.push(`${rel}:${i + 1}  ${shape.id}  →  ${line.trim()}`);
          }
        });
      }
    }

    assert.deepEqual(
      offenders,
      [],
      'A budget line kind is compared to a literal. That shorthand was correct with two kinds and '
      + 'became silently wrong with three — every sponsorship line lands in the COST bucket, which '
      + 'ADDS its amount to what families are asked for instead of subtracting it, so the error is '
      + 'twice the money. Use isFundingKind / normalizeBudgetLineKind / FUNDING_LINE_KINDS from '
      + `${SHARED_KIND_READER}, or add the file to SHAPE_EXCEPTIONS with the reason it is safe `
      + 'when a FOURTH kind is added:\n  '
      + offenders.join('\n  '),
    );
  });

  it('proves it can still see the offence (the guard is not looking at nothing)', () => {
    // The exact five shapes that got through, plus the database twin the money lens found last.
    const shouldFail = [
      `const bucket = row.line_kind === 'funding' ? 'funding' : 'cost';`,
      `if (line.lineKind !== 'cost') total -= line.totalAmount;`,
      `const isIn = 'funding' === l.lineKind;`,
      `.neq('line_kind', 'funding')`,
      `q = q.eq('line_kind', 'sponsorship')`,
      // The two "tidied up" refactors of the same defect (added after review, 2026-08-15).
      `switch (line.lineKind) { case 'funding': total -= amt; break; default: total += amt; }`,
      `const dir = { funding: 'in', cost: 'out' }[line.lineKind];`,
    ];
    for (const sample of shouldFail) {
      assert.ok(
        BANNED_SHAPES.some(s => s.re.test(sample)),
        `this guard no longer recognises the shape it exists to catch: ${sample}`,
      );
    }
    // …and does not fire on WRITING a chosen kind, or on the shared reader's own vocabulary.
    const shouldPass = [
      `line_kind: 'funding',`,
      `lineKind: normalizeBudgetLineKind(l.line_kind),`,
      `if (isFundingKind(line.lineKind)) expectedFunding += line.totalAmount;`,
      `.in('line_kind', FUNDING_LINE_KINDS)`,
      // ⚠ The CORRECT replacement for a per-kind fork: a NAMED exhaustive Record, which a fourth
      // kind turns into a compile error. Flagging this would push authors back to the ternary.
      `<p>{KIND_HINT_LONG[form.lineKind]}</p>`,
      `{LINE_KIND_SECTION[kind]}`,
    ];
    for (const sample of shouldPass) {
      assert.ok(
        !BANNED_SHAPES.some(s => s.re.test(sample)),
        `this guard flags a correct line, which will teach the next reader to work around it: ${sample}`,
      );
    }
  });

  it('lists a reason for every exempted comparison', () => {
    for (const entry of SHAPE_EXCEPTIONS) {
      assert.ok(
        entry.reason.trim().length > 30,
        `${entry.path} is exempt without a real reason — say why it survives a fourth kind.`,
      );
    }
  });
});
