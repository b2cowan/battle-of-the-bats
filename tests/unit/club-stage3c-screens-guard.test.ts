/**
 * CLUB TIER STAGE 3c — THE SCREENS (session 2), held in place.
 *
 * Session 1 (`club-stage3c-server-guard.test.ts`) holds the server: the fiscal year's one definition, the lock as one
 * database rule, Close / Reopen / the carry, New allocation's one form. This file holds what the screens were drawn
 * to do (hub v46, Mockups → Stage 3c; plan §6 Stage 3) and must not drift back from:
 *
 *   1. "FISCAL YEAR", ONE SPELLING, THE CLUB SIDE ONLY (Ask 9): one constant, every club surface reads it, and the
 *      coaches portal never says it.
 *   2. A CLOSED YEAR RENDERS NO WRITE CONTROL (Ask 1): the screens read the server's one answer (`canMove` /
 *      `canWrite`, false on a locked year), and the Ledger's, a bill's and a request's corrections are absent on a
 *      line in a closed year (Ask 8d).
 *   3. NEW ALLOCATION (Ask 6): no "Program Year", no "(optional)", the word "Season"; the teams are the SHARED form
 *      table; no page — the old one retired and its address forwards.
 *   4. A PAYEE'S WINDOW (Ask 7): no Export; the report page retired and its address forwards.
 *   5. THE YEAR PILL'S GLYPHS speak their names (a lock "closed", a dot "this year").
 *   6. THE CLOSE WARNS, NEVER BLOCKS (Ask 2): only the step's own refusals (not ended, closed, oldest first) hold
 *      Close — never the open money.
 *   7. THE COACH'S CLUB TAB keeps an earlier season's unpaid bill under its season (Ask 8b), with no year asked for.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { FISCAL_YEAR_WORD } from '../../lib/club-fiscal-year.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const KIT = 'components/admin/kit/club/money';
const PARTS = `${KIT}/FiscalYearParts.tsx`;
const ALLOC = `${KIT}/AllocationWindow.tsx`;
const PAYEES = 'app/[orgSlug]/admin/accounting/payees/page.tsx';
const BUDGET = 'app/[orgSlug]/admin/accounting/budget/page.tsx';
const BVA = 'app/[orgSlug]/admin/accounting/budget-vs-actual/page.tsx';
const OVERVIEW = 'app/[orgSlug]/admin/accounting/page.tsx';
const COACH_CLUB = 'app/[orgSlug]/coaches/teams/[teamId]/accounting/club/panel.tsx';

function walk(dir: string): string[] {
  const abs = path.join(REPO, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap(name => {
    const rel = `${dir}/${name}`;
    return statSync(path.join(REPO, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(name) ? [rel] : [];
  });
}

describe('1. "fiscal year" — one spelling, the club side only (Ask 9)', () => {
  it('the word has one home, spelled as ruled', () => {
    assert.equal(FISCAL_YEAR_WORD, 'Fiscal year');
  });
  it('the Year pill and the window read the constant, never a typed copy', () => {
    assert.match(readCode(`${KIT}/YearPill.tsx`), /label=\{FISCAL_YEAR_WORD\}/);
    assert.match(readCode(PARTS), /title=\{FISCAL_YEAR_WORD\}/);
    assert.match(readCode(BUDGET), /label=\{FISCAL_YEAR_WORD\}/, 'Tools › Fiscal year');
  });
  it('no club money surface spells it another way', () => {
    const files = [...walk('app/[orgSlug]/admin/accounting'), ...walk(KIT), 'lib/club-money-words.ts'];
    const off = files.filter(f => /['"`][^'"`]*\b(Fiscal Year|FISCAL YEAR|financial year|budget year)\b/i.test(readCode(f)
      .replace(/Fiscal year|fiscal year/g, '')));
    assert.deepEqual(off, []);
  });
  it('the coaches portal never names the club\'s fiscal year (the coach keeps "season")', () => {
    const coach = [...walk('app/[orgSlug]/coaches'), ...walk('components/coaches')];
    assert.ok(coach.length > 50, 'the scan sees the portal');
    const off = coach.filter(f => /fiscal/i.test(readCode(f)));
    assert.deepEqual(off, []);
  });
});

describe('2. a closed year renders no write control (Ask 1, Ask 8d)', () => {
  it('the reads answer "can write" with no on a locked year — the screens\' one switch', () => {
    assert.match(readCode('lib/club-fiscal-year-server.ts'), /canWrite: canMove && !year\.locked/);
    for (const route of ['app/api/admin/accounting/budget-plan/route.ts', 'app/api/admin/accounting/budget-vs-actual/route.ts']) {
      assert.match(readCode(route), /canMove: read\.canWrite/, route);
    }
  });
  it('the Budget draws Add line, Start from and Allocate only under that answer', () => {
    const budget = readCode(BUDGET);
    assert.match(budget, /\{canMove && \(\s*<button type="button" className=\{`btn btn-lime/);
    assert.match(budget, /\{canMove && \(\s*<div className=\{cr\.emptyYearActions\}>/);
    const win = readCode(`${KIT}/BudgetWindows.tsx`);
    assert.match(win, /edit=\{canMove \? \{ editing/);
    assert.match(win, /\{canMove && \(\s*<button type="button" className="btn btn-outline" onClick=\{\(\) => setAllocating\(true\)\}>/);
  });
  it('a closed year says so under the toolbar on the three tabs that read a year', () => {
    for (const f of [BUDGET, BVA, OVERVIEW]) assert.match(readCode(f), /<YearLine year=\{read\.year\}/, f);
  });
  it('the Ledger: a date in the closed stretch is refused under its field, and a locked line offers no Void', () => {
    const ledger = readCode(`${KIT}/LedgerWindows.tsx`);
    assert.match(ledger, /disabled=\{busy \|\| !!dateRefusal\}/);
    assert.match(ledger, /const canVoidBoth = canMove && !row\.locked/);
    assert.match(ledger, /row\.clears && canMove/, 'a closed year\'s pending line keeps its one action: it clears');
  });
  it('a bill\'s Undo and a request\'s Reverse are absent on a closed year\'s record, one locked sentence in their place', () => {
    const bill = readCode(`${KIT}/BillWindows.tsx`);
    assert.match(bill, /some\(i => i\.received && !i\.received\.locked\)/);
    assert.match(bill, /lockedRecordWords\('undo'/);
    const req = readCode(`${KIT}/RequestWindows.tsx`);
    assert.match(req, /r\.status === 'approved' && !r\.lockedIn/);
    assert.match(req, /lockedRecordWords\('reverse'/);
  });
});

describe('3. New allocation, in the line\'s window (Ask 6)', () => {
  const code = readCode(ALLOC);
  it('the words are the portal\'s: Season, never "Program Year"; required marked, never "(optional)"', () => {
    const words = readCode('lib/club-money-words.ts');
    assert.doesNotMatch(code, /Program Year|\(optional\)/i);
    assert.match(words, /season: 'Season'/);
    assert.doesNotMatch(words.slice(words.indexOf('NEW_ALLOCATION_WORDS')), /Program Year|\(optional\)/i);
  });
  it('the teams are the SHARED form table — never a table of its own', () => {
    assert.match(code, /import FormTable, \{[^}]*type FormTableRow[^}]*\} from '@\/components\/shared\/FormTable'/);
    assert.doesNotMatch(code, /<table\b/);
  });
  it('one window: no page, no step bar; the old page retired and its addresses forward', () => {
    assert.equal(existsSync(path.join(REPO, 'app/[orgSlug]/admin/accounting/allocations/new/page.tsx')), false);
    assert.doesNotMatch(code, /Team Splits|Review ›|KIT_STEP/);
    const proxy = readCode('proxy.ts');
    assert.match(proxy, /url\.searchParams\.set\('new', '1'\)/);
    assert.match(readCode('app/[orgSlug]/admin/accounting/allocations/page.tsx'), /search\.get\('new'\) === '1'/);
  });
  it('only a team\'s running season is offered; one without leaves the list, named under it with why (Ask 11)', () => {
    assert.match(code, /const billable = useMemo\(\(\) => \(teams \?\? \[\]\)\.filter\(t => t\.season\)/);
    assert.match(code, /const rows: FormTableRow\[\] = billable\.map\(/, 'only a team that can be billed is a row');
    assert.match(code, /W\.noSeasonCount\(noSeason\.length\)/);
    assert.match(code, /W\.noSeasonWhy\(t\.lastSeason\)/);
    assert.match(code, /aria-expanded=\{noSeasonOpen\}/, 'the line opens and closes like a door');
  });
  it('the teams sit under their groups, a heading ticks its group, All · None beside "Team" (Ask 11)', () => {
    assert.match(code, /groups=\{groups\}/);
    assert.match(code, /state: on === 0 \? 'none' : on === members\.length \? 'all' : 'some'/);
    assert.match(code, /leadLabel=\{<>\{W\.team\}\{allNone\}<\/>\}/);
    assert.match(code, /billable\.some\(t => t\.group\) \?/, 'a club with no groups keeps the flat list');
    assert.match(code, /localeCompare\(b, undefined, \{ numeric: true/, 'age order: 9U before 11U');
    const options = readCode('app/api/admin/accounting/team-options/route.ts');
    assert.match(options, /group: t\.group_id \? groupOf\.get/);
  });
  it('a group figure is a typing aid — spread exactly by the pure module, one value per team sent (Ask 11)', () => {
    assert.match(code, /spreadGroupFigure\(typed, members\.length, split\)/);
    assert.match(code, /\.\.\.\(split !== 'even' \? \{ value: positive\(values\[t\.id\] \?\? ''\) \} : \{\}\)/);
    assert.doesNotMatch(code, /groupId:|group_id/, 'the group is never sent with the bill');
  });
  it('the button says what it bills; Due speaks only for a team on its own schedule (Ask 11)', () => {
    assert.match(code, /W\.bill\(inBill\.length, isPhone \? null : amountWords\)/, 'a phone leaves the amount to the closing row');
    assert.match(code, /due: own \? <span className=\{moneyKit\.ownDue\}>\{own\}<\/span> : ''/);
    assert.doesNotMatch(code, /key: 'season'/, 'the season is a note beside the name, not a column');
  });
});

describe('3b. why a button was refused sits beside it, in every club money window (Ask 11)', () => {
  const dialog = readCode('components/admin/kit/club/KitDialog.tsx');
  const moneyKit = readCode(`${KIT}/MoneyKit.tsx`);
  it('the window has a reason slot in its foot, quiet after a change and speaking again on a press', () => {
    assert.match(dialog, /<div ref=\{setReasonSlot\} className=/);
    assert.match(dialog, /onInputCapture=\{hasFoot \? \(\) => setReasonQuiet\(true\) : undefined\}/);
    assert.match(dialog, /onClickCapture=\{\(\) => setReasonQuiet\(false\)\}/);
  });
  it('FormError writes into the slot unless it belongs to one field (inPlace)', () => {
    assert.match(moneyKit, /if \(!inPlace && reason\?\.slot\) \{\s*return createPortal\(/);
  });
  it('the reasons that belong to ONE field stay under it', () => {
    assert.match(readCode(PARTS), /<FormError inPlace>\{monthError\}<\/FormError>/);
    assert.match(readCode(PARTS), /<FormError inPlace>\{refusalWords\(question\)\}<\/FormError>/);
    assert.match(readCode(`${KIT}/LedgerWindows.tsx`), /<FormError inPlace>\{clearError\}<\/FormError>/);
    assert.match(readCode(PAYEES), /<FormError inPlace>\{shareError\}<\/FormError>/);
    assert.match(readCode(`${KIT}/BudgetWindows.tsx`), /<FormError inPlace>\{error\}<\/FormError>/, 'the Categories rename: its Save is in the body');
  });
});

describe('4. a payee\'s window reads first, its report inside, no Export (Ask 7)', () => {
  const code = readCode(PAYEES);
  it('no Export in the window, and the report page retired (its address forwards)', () => {
    assert.doesNotMatch(code, /ClubMoneyExport|useClubMoneyFile/);
    assert.equal(existsSync(path.join(REPO, 'app/[orgSlug]/admin/accounting/payees/[payeeId]/page.tsx')), false);
    assert.match(readCode('proxy.ts'), /url\.searchParams\.set\('payee', segments\[4\]\)/);
  });
  it('the window reads first: the pencil (a money mover\'s) turns it into its form', () => {
    assert.match(code, /edit=\{canMove \? \{ editing, onToggle/);
    assert.match(code, /enabled: canMove && editing/, 'the name autosaves only while editing');
  });
});

describe('5. the Year pill\'s glyphs speak their names', () => {
  it('a lock "closed", a dot "this year" — glyphs, never words in the rows', () => {
    const pill = readCode(`${KIT}/YearPill.tsx`);
    assert.match(pill, /role="img" aria-label="closed"/);
    assert.match(pill, /role="img" aria-label="this year"/);
  });
});

describe('6. the close warns and never blocks (Ask 2)', () => {
  it('Close is held only by the step\'s own refusals, never by the open money it lists', () => {
    const parts = readCode(PARTS);
    assert.match(parts, /disabled=\{busy \|\| !question\?\.canClose\}/);
    assert.doesNotMatch(parts, /disabled=\{[^}]*open\./);
  });
});

describe('7. the coach\'s Club tab keeps an earlier season\'s unpaid bill (Ask 8b)', () => {
  const code = readCode(COACH_CLUB);
  it('it reads the still-owed bills, names their season, and counts them in Still to pay', () => {
    assert.match(code, /allocData\.earlierSplits/);
    assert.match(code, /stillOwedFromSeasonWord\(b\.season\.name\)/);
    assert.match(code, /const owed = Math\.round\(\(thisOwed \+ old\.outstanding\) \* 100\) \/ 100/);
  });
  it('no year or season is asked of the route (the history guard\'s rule)', () => {
    assert.doesNotMatch(readCode('app/api/coaches/[orgSlug]/teams/[teamId]/allocations/route.ts'), /searchParams\.get\('(year|season)'\)/);
  });
});

describe('8. what the /review found, held (2026-10-07)', () => {
  it('the close question\'s Ledger doors narrow by the Category\'s WORD and open on the book holding the lines', () => {
    const reads = readCode('lib/club-fiscal-reads.ts');
    assert.match(reads, /category: NOT_FILED_WORD, \.\.\.busiestBook\(unfiled\)/);
    assert.match(reads, /status: 'pending', \.\.\.busiestBook\(pending\)/);
    assert.doesNotMatch(reads, /category: NOT_FILED_ID/, 'the Ledger filters by the word; the id opened an empty Ledger');
  });
  it('By percentage is judged in hundredths, the server\'s rule — 33.33 × 3 bills', () => {
    const alloc = readCode(ALLOC);
    assert.match(alloc, /Math\.abs\(percentHundredths - 10000\) > 1/);
  });
  it('New allocation is absent for a reader who cannot move the club\'s money', () => {
    assert.match(readCode('app/api/admin/accounting/allocations/route.ts'), /canMove: canMoveClubMoney\(ctx, ctx\.org\)/);
    const page = readCode('app/[orgSlug]/admin/accounting/allocations/page.tsx');
    assert.match(page, /\{canMove && \(\s*<button[^>]*aria-label="New allocation"/);
    assert.match(page, /\{creating && canMove && \(/);
  });
  it('a refused rename holds the fiscal year window once — never a window that cannot be closed', () => {
    const parts = readCode(PARTS);
    assert.match(parts, /!closeRefused\.current && !\(await handleSave\(\)\)\) \{ closeRefused\.current = true; return; \}/);
  });
  it('the year-end report gives a category only last year had its own row, so the last-year column adds up', () => {
    assert.match(readCode('lib/club-money-reports.ts'), /for \(const x of lastSec\?\.categories \?\? \[\]\)/);
  });
});
