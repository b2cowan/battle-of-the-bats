/**
 * A budget line is a COST or EXPECTED FUNDING — enforced as a RULE over the source tree rather
 * than surface by surface.
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
