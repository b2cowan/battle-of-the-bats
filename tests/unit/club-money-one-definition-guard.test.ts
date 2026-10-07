import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { functionBody, readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * "THE SAME FIGURE, ONE DEFINITION" (Club Tier Stage 3a; plan §4C "The same figure, computed
 * differently", S3A-05, C06, J4-019, C14).
 *
 * On 2026-09-25 "Collected" had four definitions on the club side, "overdue" two (one of which could
 * never count one), and a book's balance two scopes. Every club surface that shows Collected,
 * Outstanding, Overdue, Next due, Sent or a book's Balance now asks lib/club-money-figures.ts, and this
 * guard holds them to it in two directions:
 *   1. each named surface READS the module (directly, or through lib/club-money-reads.ts which does);
 *   2. nothing on the club side computes one of those figures by hand — no `paid_at` filter summed
 *      into a Collected, no `due_date < today` overdue — except the files named below, each for a
 *      stated reason and an owner who removes it.
 * `scripts/check-club-money-arithmetic.mjs` is the other half: it recomputes the module's figures
 * from rows by an independent walk.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const READS_THE_MODULE: Record<string, RegExp> = {
  'app/api/admin/accounting/allocations/route.ts': /from '@\/lib\/club-money-reads'/,
  'app/api/admin/accounting/allocations/[allocationId]/route.ts': /from '@\/lib\/club-money-reads'/,
  'app/api/admin/accounting/coming-due/route.ts': /from '@\/lib\/club-money-reads'/,
  'app/api/admin/accounting/teams/route.ts': /from '@\/lib\/club-money-reads'/,
  'app/api/admin/accounting/teams/[teamId]/account/route.ts': /from '@\/lib\/club-money-reads'/,
  'app/api/admin/accounting/payment-requests/route.ts': /from '@\/lib\/club-money-reads'/,
  'app/api/admin/club-brief/route.ts': /briefMoneyCounts/,
  'app/api/admin/rep-teams/teams/[teamId]/route.ts': /withTheClub/,
  'app/api/admin/rep-teams/teams/[teamId]/seasons/route.ts': /seasonOwedToClub/,
  'lib/club-money-reads.ts': /from '\.\/club-money-figures'/,
  'lib/club-ledger-read.ts': /from '\.\/club-money-figures'/,
  'lib/club-money-reminders.ts': /from '\.\/club-money-figures'/,
  // Club Tier Stage 3b: the Budget, Budget vs. Actual and the board summary — every figure through the
  // definitions module, assembled by lib/club-budget-report.ts (it computes nothing itself).
  'app/api/admin/accounting/budget-plan/route.ts': /from '@\/lib\/club-budget-read'/,
  'app/api/admin/accounting/budget-vs-actual/route.ts': /from '@\/lib\/club-budget-read'/,
  'app/api/admin/accounting/summary/route.ts': /from '@\/lib\/club-budget-read'/,
  'lib/club-budget-read.ts': /from '\.\/club-budget-report'/,
  'lib/club-budget-report.ts': /from '\.\/club-money-figures'/,
  'lib/club-team-cash.ts': /seasonClosingCashCents\(/,
};

/**
 * Files on the club side that still compute a figure by hand, each with the stage that removes it.
 * ⚠ THIS LIST ONLY SHRINKS. A new entry is a decision, not a fix.
 */
const NOT_YET: Record<string, string> = {
  /* EMPTY since Club Tier Stage 3b session 1: the budget-plan and Budget vs. Actual routes left it — every
     figure on them is now the definitions module's (the plan's Allocated / Collected / Not allocated, the
     report's Actual / Spent / Off-plan / Headroom; team health left Budget vs. Actual for the summary). */
};

const HAND_ROLLED: [string, RegExp][] = [
  ['a hand-rolled overdue', /\b(due_date|dueDate)\s*<\s*(today|now|todayStr|tournamentToday\(\))/],
  ['a hand-summed Collected / Outstanding', /\.filter\(\(?\w+(?::\s*any)?\)?\s*=>\s*!?\w+\.(paid_at|paidAt)\)\s*\.reduce\(/],
  ['overdue asked of the dues helper instead of the club\'s module', /isInstallmentOverdue\(/],
  // Club Tier Stage 3b: Allocated is the teams' shares of EVERY allocation drawn from a line (`lineAllocated`),
  // never one allocation's total kept in a Map, and never a sum of STORED split rows rolled by hand (`Number(…)`
  // off a row). A form adding up the shares being TYPED (`parseFloat`) is the form's arithmetic, not the figure.
  ['a hand-summed Allocated', /\bsplit\w*\.reduce\(\s*\([^)]*\)\s*=>\s*\w+\s*\+\s*Number\(/i],
  // ONE Headroom (`headroom`: planned expenses − Spent). "Unallocated Budget" and "Org Headroom" were one word,
  // two sums (C05).
  ['a re-derived Headroom', /\b(?:org)?[hH]eadroom\s*[:=]\s*[\w.]+\s*-\s*[\w.]+/],
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe('every club money surface reads the one definition', () => {
  for (const [file, rule] of Object.entries(READS_THE_MODULE)) {
    it(file, () => assert.match(readCode(file), rule));
  }
  it('a book\'s Balance is ONE SQL sum, wherever a summary prints one (C14, mig 317)', () => {
    // `club_book_totals` is `bookBalance`'s definition summed in SQL (posted in − posted out, all-time);
    // `check:club-money-atomicity` holds it to a naive walk of the same rows on the database.
    // One mapper of its row (getBookTotals), and every summary reads it.
    const db = readCode('lib/db.ts');
    assert.match(functionBody(db, 'getBookTotals'), /rpc\('club_book_totals'/);
    const summary = functionBody(db, 'getLedgerSummaries');
    assert.match(summary, /getBookTotals\(/);
    assert.match(summary, /balance:\s+t\.balance/);
    assert.match(readCode('lib/club-budget-read.ts'), /getBookTotals\(/, 'the year\'s books read the same sum');
    assert.doesNotMatch(readCode('lib/club-budget-read.ts'), /rpc\('club_book_totals'/, 'never a second mapper of the row');
  });
});

describe('nothing on the club side computes a figure by hand', () => {
  const repo = path.join(import.meta.dirname, '..', '..');
  const files = [
    ...walk(path.join(repo, 'app', 'api', 'admin')),
    ...walk(path.join(repo, 'app', '[orgSlug]', 'admin')),
    ...readdirSync(path.join(repo, 'lib')).filter(f => /^club-.*\.ts$/.test(f) && f !== 'club-money-figures.ts').map(f => path.join(repo, 'lib', f)),
    // The coach's club bill reads the same installments (found by /review 2026-10-01: it still said
    // "Overdue" on a payment the team had sent). Only this screen — the portal's dues use the dues rule.
    path.join(repo, 'app', '[orgSlug]', 'coaches', 'teams', '[teamId]', 'accounting', 'club', 'panel.tsx'),
  ].map(f => path.relative(repo, f).split(path.sep).join('/'));

  it('the scan sees the surfaces it guards (it must not go blind)', () => {
    assert.ok(files.includes('app/api/admin/accounting/coming-due/route.ts'));
    assert.ok(files.includes('lib/club-money-reads.ts'));
    assert.ok(files.length > 100);
  });
  for (const [what, pattern] of HAND_ROLLED) {
    it(`no ${what}`, () => {
      const offenders = files.filter(f => !(f in NOT_YET) && pattern.test(readCode(f)));
      assert.deepEqual(offenders, [], `${what} in ${offenders.join(', ')} — ask lib/club-money-figures.ts`);
    });
  }
  it('every not-yet entry still needs its place (the list only shrinks)', () => {
    for (const file of Object.keys(NOT_YET)) {
      const code = readCode(file);
      assert.ok(HAND_ROLLED.some(([, p]) => p.test(code)), `${file} no longer computes by hand — remove it from NOT_YET`);
    }
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ONE DEFINITION OF THE YEAR (Club Tier Stage 3c; S3C-01, S3C-02, S3C-03). The club's year is its FISCAL year
 * (lib/club-fiscal-year.ts — its first month and its rows); every club money read returns the year it read, so no
 * file works a year out by hand: no date's first four characters, no `${year}-01-01` span, no UTC year. The
 * definition module is the one place allowed to take a date apart.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
const YEAR_BY_HAND: [string, RegExp][] = [
  ['a date\'s first four characters read as a year', /\.slice\(\s*0\s*,\s*4\s*\)/],
  ['a calendar-year span written by hand', /\$\{[^}]+\}-(?:01-01|12-31)|['"]-(?:01-01|12-31)['"]/],
  ['a year read on the UTC clock', /getUTCFullYear\(/],
];

/**
 * PAGES that still work a year out by hand, each with its lines and the session that empties it. ⚠ THIS LIST
 * ONLY SHRINKS. (3c session 1 moved the rest onto the server's year: Budget vs. Actual's current-year test and
 * Ledger doors, StatementBehindWindow, the Overview, the Filed-under hint, and both payee pages.)
 */
const YEAR_NOT_YET: Record<string, string> = {
  'app/[orgSlug]/admin/accounting/allocations/page.tsx':
    'lines 136, 143 — "This year" from today\'s first four characters and each allocation\'s creation stamp in UTC; '
    + 'the allocations read now returns each one\'s fiscal `year` (3c session 1). Session 2 reads it.',
};

describe('one definition of the year — nothing in the club\'s money files works a year out by hand', () => {
  const repo = path.join(import.meta.dirname, '..', '..');
  const MONEY_LIB = /^club-(money|budget|ledger|payee|checklist|fiscal|year|team-cash).*\.ts$/;
  const DEFINITION = 'lib/club-fiscal-year.ts';
  const files = [
    ...walk(path.join(repo, 'app', 'api', 'admin', 'accounting')),
    ...walk(path.join(repo, 'app', '[orgSlug]', 'admin', 'accounting')),
    ...walk(path.join(repo, 'components', 'admin', 'kit', 'club', 'money')),
    ...readdirSync(path.join(repo, 'lib')).filter(f => MONEY_LIB.test(f)).map(f => path.join(repo, 'lib', f)),
  ].map(f => path.relative(repo, f).split(path.sep).join('/')).filter(f => f !== DEFINITION && f !== 'lib/club-money-figures.ts');

  it('the scan sees the surfaces it guards, and never the definition itself', () => {
    assert.ok(files.includes('lib/club-budget-report.ts'));
    assert.ok(files.includes('app/[orgSlug]/admin/accounting/budget-vs-actual/page.tsx'));
    assert.ok(files.includes('components/admin/kit/club/money/LedgerWindows.tsx'));
    assert.ok(!files.includes(DEFINITION));
  });
  for (const [what, pattern] of YEAR_BY_HAND) {
    it(`no ${what}`, () => {
      const offenders = files.filter(f => !(f in YEAR_NOT_YET) && pattern.test(readCode(f)));
      assert.deepEqual(offenders, [], `${what} in ${offenders.join(', ')} — ask lib/club-fiscal-year.ts (fiscalYearOf, or the read's own year)`);
    });
  }
  it('every not-yet page still needs its place (the list only shrinks)', () => {
    for (const file of Object.keys(YEAR_NOT_YET)) {
      const code = readCode(file);
      assert.ok(YEAR_BY_HAND.some(([, p]) => p.test(code)), `${file} no longer works a year out by hand — remove it from YEAR_NOT_YET`);
    }
  });
  it('the three definitions take the club\'s fiscal years (the "until 3c" notes are gone)', () => {
    const figures = readCode('lib/club-money-figures.ts');
    assert.match(functionBody(figures, 'allocationYear'), /fiscalYearOf\(/);
    assert.match(functionBody(figures, 'clubYearOf'), /fiscalYearOf\(day, setting\)/);
    assert.doesNotMatch(figures, /Until 3c/);
  });
});
