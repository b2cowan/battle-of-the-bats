/**
 * CLUB TIER STAGE 3b — THE SCREENS (session 2), held in place.
 *
 * Session 1 (`club-stage3b-server-guard.test.ts`) holds the server: the one money rule, the one-step
 * allocation, the figures' one definition. This file holds what the screens were drawn to do and must
 * not drift back from (hub v38/39, Mockups → Stage 3b; plan `CLUB_TIER_STAGE3B_PLAN.md`):
 *
 *   1. SHARED, NOT COPIED — the club's Budget vs. Actual and Budget render the coach's own Statement rows,
 *      period grid and month grid, so a fix to one portal's report is a fix to both.
 *   2. The month grids open on this month on a phone, in both portals (fix 2).
 *   3. A team's cash is READ and labelled, never added in: the club's Cash on hand is its own books, and
 *      the held-by column's cell in the closing row stays blank.
 *   4. The drawn removals stay removed: no "Not in the plan" chip on the club's reports, the old Allocate
 *      page, its route and the club's two old stylesheets.
 *   5. One way to bill teams: New allocation, opened from a line, sends the line as its source and never
 *      offers the "Org Ledger Entry ID" box.
 *   6. The coach is told what the club reads (Ask 4c), and the empty Club tab's two stale lines are gone.
 *   7. The Ledger files every new line under a budget word (no free-text category).
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readCode, functionBody } from './_source-code.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const BVA = 'app/[orgSlug]/admin/accounting/budget-vs-actual/page.tsx';
const BUDGET = 'app/[orgSlug]/admin/accounting/budget/page.tsx';
const OVERVIEW = 'app/[orgSlug]/admin/accounting/page.tsx';
/* Stage 3c retired the New allocation PAGE into the line window's one form (Ask 6); "one way to bill teams" lives there. */
const NEW_ALLOC = 'components/admin/kit/club/money/AllocationWindow.tsx';
const COACH_BVA = 'app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/panel.tsx';
const COACH_BUDGET = 'app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/panel.tsx';
const COACH_CLUB = 'app/[orgSlug]/coaches/teams/[teamId]/accounting/club/panel.tsx';

describe('1. shared, not copied — both portals render the same report parts', () => {
  it('Budget vs. Actual: the Statement rows and the month grid are the coach’s', () => {
    for (const f of [BVA, COACH_BVA]) {
      const code = readCode(f);
      assert.match(code, /from '@\/components\/coaches\/MoneyStatementRows'/, f);
      assert.match(code, /from '@\/components\/coaches\/MoneyMonthGrid'/, f);
    }
  });
  it('the Budget’s By period is the coach’s period grid', () => {
    for (const f of [BUDGET, COACH_BUDGET]) assert.match(readCode(f), /from '@\/components\/coaches\/MoneyPeriodGrid'/, f);
  });
  it('the Statement rows are defined once — not again inside either page', () => {
    for (const f of [BVA, COACH_BVA]) {
      assert.doesNotMatch(readCode(f), /function (CategoryGroup|ItemRows|CatFoldRow|SectionBand)\b/, f);
    }
    for (const f of [BUDGET, COACH_BUDGET]) assert.doesNotMatch(readCode(f), /function PeriodGrid\b/, f);
  });
  it('the type scale is one stylesheet both portals compose', () => {
    assert.match(readCode('app/[orgSlug]/coaches/coaches.module.css'), /composes: moneyScale from '\.\.\/\.\.\/\.\.\/components\/coaches\/moneyScale\.module\.css'/);
    assert.match(readCode('components/admin/kit/club/money/ClubReport.module.css'), /composes: moneyScale from/);
  });
});

describe('2. a month grid opens on this month on a phone (fix 2, both portals)', () => {
  for (const f of ['components/coaches/MoneyMonthGrid.tsx', 'components/coaches/MoneyPeriodGrid.tsx']) {
    it(f, () => {
      const code = readCode(f);
      assert.match(code, /useOpenOnNow\(scrollerRef,/);
      assert.match(code, /data-now=\{/, 'the column it opens on is marked');
    });
  }
  it('only at the touch widths, and the frame’s own scroll is not mistaken for the reader’s', () => {
    const hook = readCode('components/coaches/useOpenOnNow.ts');
    assert.match(hook, /TOUCH_GRID_QUERY = '\(max-width: 768px\)'/);
    assert.match(readCode('components/coaches/CoachScrollX.tsx'), /AUTO_SCROLL_FLAG/);
  });
});

describe('3. a team’s cash is read and labelled, never added in', () => {
  it('the club’s Cash on hand is its own books only', () => {
    const body = functionBody(readCode('lib/club-money-figures.ts'), 'clubCashOnHand');
    assert.match(body, /isClubOwnedBook\(b\.kind\)/);
    // ⚖ Stage 3c (Ask 1): a CLOSED year's band reads its locked closing — still the club's own books, as of its last day.
    assert.match(readCode('lib/club-budget-report.ts'), /const cashOnHand = year\.closed \? year\.closed\.closingBalance : clubCashOnHand\(books\);/);
  });
  it('the held-by column’s closing cell is blank on the Overview, and the column wears no coloured edge', () => {
    const code = readCode(OVERVIEW);
    // The closing row: the Requests total, then the held cell — blank (standard §3.5, Ask 4e).
    assert.match(code, /waitingOnYou\.count : ''\}<\/td>\s*<td className=\{repKit\.num\} \/>/, 'the closing row’s held cell carries no figure');
    /* ⚖ No edge on the column's cells (owner 2026-10-07): it was never ruled or drawn, and the heading row and
       the group bands broke it into a stray divider. The lock and the heading's words carry the meaning. */
    assert.doesNotMatch(code, /heldCell/, 'the held-by column’s cells carry no coloured edge');
    assert.doesNotMatch(readCode('components/admin/kit/club/money/ClubReport.module.css'), /\.heldCell\b/);
  });
  it('a team’s page labels the figure as held, on its own card', () => {
    assert.match(readCode('app/[orgSlug]/admin/accounting/teams/[teamId]/page.tsx'), /held: true/);
  });
});

describe('4. the drawn removals stay removed', () => {
  it('no "Not in the plan" chip on the club’s reports', () => {
    for (const f of [BVA, BUDGET, 'components/admin/kit/club/money/BudgetPlanList.tsx', 'lib/club-money-words.ts', 'lib/club-money-reports.ts']) {
      assert.doesNotMatch(readCode(f), /Not in the plan|UNPLANNED_DERIVED_CATEGORY/, f);
    }
  });
  it('the old look’s files are gone', () => {
    for (const f of [
      'app/[orgSlug]/admin/accounting/budget/allocate/[lineId]/page.tsx',
      'app/[orgSlug]/admin/accounting/budget/budget.module.css',
      'app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css',
      'app/api/admin/accounting/budget-plan/lines/[lineId]/allocate-to-teams/route.ts',
      'lib/club-budget-legacy.ts',
    ]) assert.equal(existsSync(path.join(REPO, f)), false, `${f} came back`);
  });
  it('an old Allocate bookmark forwards to New allocation from the line', () => {
    const proxy = readCode('proxy.ts');
    assert.match(proxy, /segments\[3\] === 'budget' && segments\[4\] === 'allocate'/);
    assert.match(proxy, /url\.searchParams\.set\('line', segments\[5\]\)/);
  });
});

describe('5. one way to bill teams', () => {
  const code = readCode(NEW_ALLOC);
  it('the line is the source — never an entry id (3c: the pasted ledger-entry id left the form, C17)', () => {
    assert.match(code, /sourceBudgetLineId: source\?\.id \?\? null/);
    assert.doesNotMatch(code, /sourceEntryId|alloc-entry|Org Ledger Entry ID/);
  });
  it('the amount is capped at what is left on the line, and Cancel returns to the line (the window, no page)', () => {
    assert.match(code, /if \(source && amount > source\.left \+ 0\.005\) return W\.amountUpTo/);
    assert.match(readCode('components/admin/kit/club/money/BudgetWindows.tsx'), /onCancel=\{\(\) => setAllocating\(false\)\}/);
  });
});

describe('6. the coach is told what the club reads (Ask 4c)', () => {
  const code = readCode(COACH_CLUB);
  it('one quiet line closes the Club tab', () => {
    assert.match(code, /className=\{styles\.clubReadsLine\}/);
    assert.match(code, /coachWhatTheClubReads\(/);
  });
  it('the empty tab’s stale lines are gone', () => {
    assert.doesNotMatch(code, /owner or treasurer/);
    assert.doesNotMatch(code, /mark each installment paid/);
  });
});

describe('7. the club Ledger files every new line under a budget word', () => {
  it('a new line without a word is refused, and no free-text category is written', () => {
    const post = readCode('app/api/admin/accounting/ledgers/[ledgerId]/entries/route.ts');
    assert.match(post, /code: 'word_required'/);
    assert.doesNotMatch(post, /category: (body\.)?category/);
  });
});
