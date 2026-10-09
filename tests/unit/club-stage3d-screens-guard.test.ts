/**
 * CLUB TIER STAGE 3d — THE LAST CLUB MONEY PAGES BECOME WINDOWS, held in place (hub v61, Mockups → Stage 3d; plan §6
 * Stage 3 "3d"; design decisions 2026-10-08).
 *
 *   1. THE WINDOW KIT learns two things: a NAMED BACK for a level inside a window (it goes up a level — never closes),
 *      and ONE RAISED FORM LAYER between the form layer and the question layer (Ask 7a).
 *   2. PAYEES IS A WINDOW OVER THE LEDGER (Ask 1): Tools opens it (a row that opens a window, never a page link); the
 *      payee picker's "Manage payees…" opens it RAISED over the entry being typed (`onManage`, never `manageHref`); a
 *      payee opens in place behind "← Payees", with Previous · Next, no Done, Delete out of the foot (Ask 2).
 *   3. AN ALLOCATION IS ONE WINDOW every door opens (Asks 3–5): no page link to an allocation is left; it reads the
 *      bill first, its pencil edits only the name and the note, on an open year; no Send reminders in it; its Export
 *      in its foot; a team's bill one level in.
 *   4. THE TWO PAGES ARE GONE and their addresses forward in one hop; notices write the window's address and the bell
 *      names it from the new shape and the old.
 *   5. ONE JOINED BAND for every club money summary: no separate figure cards or tiles are left in club money.
 *   6. THE SERVER: the read carries the note; one Accounting PATCH for the name and the note, refusing a blank name, a
 *      long note and a closed year before it writes; the Rep Teams PATCH retired.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { notificationDestination } from '../../lib/notification-view.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const KIT = 'components/admin/kit/club';
const MONEY = `${KIT}/money`;
const ACCT = 'app/[orgSlug]/admin/accounting';
const ALLOC_WINDOW = `${MONEY}/AllocationRecordWindow.tsx`;
const PAYEES_WINDOW = `${MONEY}/PayeesWindow.tsx`;

function walk(dir: string): string[] {
  const abs = path.join(REPO, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap(name => {
    const rel = `${dir}/${name}`;
    return statSync(path.join(REPO, rel)).isDirectory() ? walk(rel) : /\.(tsx?|mjs)$/.test(name) ? [rel] : [];
  });
}

/** The first `z-index` the rule named exactly `selector` declares. */
function zOf(css: string, selector: string): number {
  const at = css.search(new RegExp(`(^|\\n)${selector.replace(/\./g, '\\.')}\\s*\\{`));
  assert.ok(at >= 0, `${selector} is gone — the guard reads its layer`);
  const body = css.slice(at, css.indexOf('}', at));
  const z = body.match(/z-index:\s*(\d+)/);
  assert.ok(z, `${selector} declares no z-index`);
  return Number(z![1]);
}

describe('1. the window kit: a named back, and one raised form layer', () => {
  const dialog = readCode(`${KIT}/KitDialog.tsx`);
  const css = readCode(`${KIT}/KitDialog.module.css`);

  it('the named back goes UP a level — the desk line, the phone ← and the phone\'s Back gesture — never closes', () => {
    assert.match(dialog, /<button type="button" className=\{styles\.namedBack\} onClick=\{back\.onBack\}/);
    assert.match(dialog, /className=\{styles\.back\} onClick=\{back \? back\.onBack : onClose\}/);
    assert.match(dialog, /aria-label=\{back \? `Back to \$\{back\.label\}` : 'Back'\}/);
    assert.match(dialog, /useDialogFloor\(true, panelRef, \{ onClose, onBack: back\?\.onBack,/);
    // × still closes the whole window.
    assert.match(dialog, /className=\{styles\.close\} onClick=\{onClose\}/);
  });

  it('a phone shows the head\'s ← (it names where), not the named line', () => {
    assert.match(css, /\.form \.namedBack \{ display: none; \}/);
  });

  it('the layers stand in order: a form (400) < a raised form (405) < a question (410)', () => {
    const form = zOf(css, '.overlay');
    const raised = zOf(css, '.overlayRaised');
    const question = zOf(css, '.overlayQuestion');
    assert.ok(form < raised && raised < question, `form ${form} < raised ${raised} < question ${question}`);
    assert.match(dialog, /raised && kind === 'form' \? ` \$\{styles\.overlayRaised\}` : ''/, 'only a form is raised');
  });
});

describe('2. Payees is a window over the Ledger (Asks 1, 2, 7a)', () => {
  const ledger = readCode(`${ACCT}/ledger/page.tsx`);
  const windows = readCode(`${MONEY}/LedgerWindows.tsx`);
  const payees = readCode(PAYEES_WINDOW);

  it('Ledger › Tools › Payees opens the window — a row that opens a window, never a link to a page', () => {
    assert.match(ledger, /label="Payees"[\s\S]{0,200}onSelect=\{\(\) => setPayees\(\{ payee: null \}\)\} \/>/);
    assert.match(ledger, /<PayeesWindow q=\{q\} initialPayee=\{payees\.payee\}/);
    assert.doesNotMatch(ledger, /payeesHref|accounting\/payees/);
  });

  it('the old Payees addresses are read once on arrival, then dropped from the address', () => {
    assert.match(ledger, /search\.get\('payee'\)/);
    assert.match(ledger, /search\.get\('payees'\) === '1'/);
    assert.match(ledger, /params\.delete\('payees'\);\s*params\.delete\('payee'\);/);
  });

  it('the picker\'s "Manage payees…" opens Payees RAISED over the entry, and its pick follows a merge', () => {
    assert.match(windows, /<PayeeCombobox[\s\S]{0,200}onManage=\{onManage\}/);
    assert.doesNotMatch(windows, /manageHref/);
    assert.equal((windows.match(/<PayeesWindow q=\{q\} raised /g) ?? []).length, 2, 'Add entry and a line\'s window');
    assert.equal((windows.match(/followPayeeChange\(/g) ?? []).length, 2);
  });

  it('a payee opens in place behind "← Payees", walks the list, has no Done, and Delete leaves the foot', () => {
    assert.match(payees, /back=\{current \? \{ label: 'Payees', onBack: \(\) => void toList\(\) \} : undefined\}/);
    assert.match(payees, /noun: 'payee'/);
    assert.doesNotMatch(payees, />Done</, 'no Done: ← Payees goes back and × closes');
    // Merge in the foot's start; Delete at the end of the body, alone, red.
    assert.match(payees, /footerStart: canMove && current\.inUse && others\.length > 0/);
    assert.match(payees, /canMove && !current\.inUse && \(\s*<div className=\{own\.deleteEnd\}>/);
    assert.doesNotMatch(payees, /footerStart[^;]*Delete this payee/);
    // …in every admin record's ONE Delete (owner 2026-10-09 — `admin-record-delete-guard`), never a style of its own.
    assert.match(payees, /<RecordDelete onClick=\{\(\) => setAsking\('delete'\)\}>Delete this payee<\/RecordDelete>/);
    assert.doesNotMatch(readCode(`${MONEY}/PayeesWindow.module.css`), /\.deleteButton\b/);
  });

  it('a payee reopened from the list is seeded afresh, and a merge lets go of a pending rename (/review 2026-10-08)', () => {
    assert.match(payees, /if \(!current && seededFor !== null\) setSeededFor\(null\);/);
    assert.match(payees, /const done = \(text: string, change: PayeeChange\) => \{[\s\S]{0,200}settle\(\);/);
  });

  it('a question from the raised window lands on top (Merge and Delete are questions; New payee rises with it)', () => {
    assert.match(payees, /function MergeQuestion[\s\S]*?kind="question"/);
    assert.match(payees, /function DeleteQuestion[\s\S]*?kind="question"/);
    assert.match(payees, /<NewPayeeWindow q=\{q\} raised=\{raised\}/);
  });
});

describe('3. an allocation is ONE window, opened from every door (Asks 3–5)', () => {
  const win = readCode(ALLOC_WINDOW);

  it('no page link to an allocation is left anywhere in the admin', () => {
    const files = [...walk('app/[orgSlug]/admin'), ...walk('components/admin'), 'lib/club-money-notify.ts'];
    for (const f of files) {
      const code = readCode(f);
      assert.doesNotMatch(code, /[bB]ase\}\/allocations\/\$\{/, `${f}: a link to the retired allocation page`);
      // A PAGE address — the window's own read and its money moves are `/api/admin/accounting/allocations/…`.
      assert.doesNotMatch(code, /(?<!api\/)admin\/accounting\/allocations\/\$\{/, `${f}: a link to the retired allocation page`);
    }
  });

  it('every door opens the one window: the list, Coming due, a line, From the teams, a Ledger line, behind the figure, BvA, the Overview, a team\'s account', () => {
    const doors = [
      `${ACCT}/allocations/page.tsx`, `${MONEY}/BudgetWindows.tsx`, `${MONEY}/LedgerWindows.tsx`, `${MONEY}/StatementBehindWindow.tsx`,
      `${ACCT}/budget-vs-actual/page.tsx`, `${ACCT}/page.tsx`, `${ACCT}/teams/[teamId]/page.tsx`,
    ];
    for (const f of doors) assert.match(readCode(f), /<AllocationRecordWindow\b|useAllocationHandOff\(/, `${f} opens the allocation's window`);
    // From a window, the window HANDS OFF (it turns into the allocation's; × turns it back) — through ONE helper.
    const handOff = readCode(ALLOC_WINDOW);
    assert.match(handOff, /export function useAllocationHandOff\(/);
    assert.match(handOff, /onClose=\{\(\) => setViewing\(null\)\}/, '× turns the host back');
    for (const f of [`${MONEY}/BudgetWindows.tsx`, `${MONEY}/LedgerWindows.tsx`, `${MONEY}/StatementBehindWindow.tsx`]) {
      assert.match(readCode(f), /if \(allocation\.shown\) return allocation\.shown;/, `${f} hands off and turns back`);
    }
    assert.equal((readCode(`${MONEY}/BudgetWindows.tsx`).match(/if \(allocation\.shown\) return allocation\.shown;/g) ?? []).length, 2, 'a line and From the teams');
  });

  it('Allocations is the window\'s address, and walks the list only when opened from it', () => {
    const tab = readCode(`${ACCT}/allocations/page.tsx`);
    assert.match(tab, /search\.get\('allocation'\)/);
    assert.match(tab, /params\.set\('allocation', id\);\s*if \(bill\) params\.set\('bill', bill\);/);
    assert.match(tab, /addressOf=\{addressOf\(win\.id\)\}/);
    assert.match(tab, /steps=\{allocationSteps\(view === 'allocation' \? rows : \[\], win\.id,/);
  });

  it('the window names its place through its OWN Back step — the address is never router-replaced while it is open (/review 2026-10-08)', () => {
    const tab = readCode(`${ACCT}/allocations/page.tsx`);
    assert.match(tab, /const openWin = setWin;/, 'opening, stepping and closing write no address through the router');
    // An arriving address is read whenever it changes, dropped, and the window mounts only once it is gone.
    assert.match(tab, /if \(asked !== seenAsk\) \{/);
    assert.match(tab, /\{win && !askedId && \(/);
    const dialog = readCode(`${KIT}/KitDialog.tsx`);
    assert.match(dialog, /address: address \?\? null \}\);/, 'the kit hands the place to the floor\'s Back step');
    const win = readCode(ALLOC_WINDOW);
    assert.match(win, /key=\{theBill\.splitId\}\s*address=\{addressOf\?\.\(theBill\.splitId\)\}/, 'each bill is its own place');
    assert.match(win, /address=\{addressOf\?\.\(null\)\}/);
    const ledger = readCode(`${ACCT}/ledger/page.tsx`);
    assert.match(ledger, /if \(askPayees !== seenAskPayees\) \{/);
    assert.match(ledger, /\{payees && !askPayees && \(/);
  });

  it('it reads the bill first: the line · year eyebrow, the joined band, the schedule, the teams, the note', () => {
    assert.match(win, /W\.eyebrow\(read\.budgetLineName, read\.year\.name\)/);
    assert.match(win, /<MoneySummaryBand/);
    assert.match(win, /W\.scheduleLabel/);
    assert.match(win, /W\.noteLabel/);
    assert.match(win, /W\.noNote/);
    assert.match(win, /kind="form"\s+wide/, 'an 800 px window: its body is a table');
  });

  it('the pencil edits only the name and the note, and only when the server says it may (an open year)', () => {
    assert.match(win, /edit=\{read\.canEdit \?/);
    assert.match(win, /body\.description = name\.trim\(\)/);
    assert.match(win, /body\.notes = note\.trim\(\) \|\| null/);
    assert.match(win, /const body: \{ description\?: string; notes\?: string \| null \} = \{\};/, 'the PATCH carries the name and the note, nothing else');
    const route = readCode('app/api/admin/accounting/allocations/[allocationId]/route.ts');
    assert.match(route, /canEdit: canMove && !year\.locked/);
  });

  it('leaving the pencil by a team row or Previous · Next saves first and re-reads, as × does (/review 2026-10-08)', () => {
    assert.equal((win.match(/onOpen=\{id => void leaveThen\(\(\) => onOpenBill\(id\)\)\}/g) ?? []).length, 2, 'the desk rows and the phone rows');
    assert.match(win, /prev: leaveStep\(steps\.prev\), next: leaveStep\(steps\.next\)/);
    assert.match(win, /if \(saved\.current\) \{ saved\.current = false; onChanged\?\.\(\); onSaved\(\); \}/);
    assert.match(win, /if \(failed && !read\)/, 'a failed RE-read keeps the window');
  });

  it('a closed year\'s allocation reads with one locked line and no pencil', () => {
    assert.match(win, /\{read\.year\.locked && \(\s*<p className=\{own\.lockLine\}>/);
    assert.match(win, /W\.closedLine\(read\.year\.name, read\.year\.reopen\)/);
  });

  it('no Send reminders in the window (S3D-04: it was the whole club\'s wave); a team\'s bill keeps its own Remind', () => {
    assert.doesNotMatch(win, /Send reminders|remindAll/);
    assert.match(win, /team=\{\{ id: theBill\.teamId, name: theBill\.teamName \}\}/);
  });

  it('its Export stays, at the right of the schedule line above the table — never a foot row of its own (owner, 2026-10-09)', () => {
    assert.match(win, /<div className=\{own\.scheduleRow\}>[\s\S]{0,300}<AllocationExport read=\{read\} orgSlug=\{orgSlug\} \/>\s*<\/div>/);
    assert.doesNotMatch(win, /footerStart=/);
  });

  it('a team\'s bill has one foot row at most: Remind alone, no Close; its account door at the payments\' foot (owner, 2026-10-09)', () => {
    const bills = readCode(`${MONEY}/BillWindows.tsx`);
    assert.match(bills, /footer=\{canRemind \? <button[^>]*onClick=\{onRemind\}>Remind \{bill\.teamName\}<\/button> : undefined\}/);
    assert.doesNotMatch(bills, />Close<\/button>/, 'Close was a third way out (× and ← close it)');
    assert.doesNotMatch(bills.slice(bills.indexOf('export function BillRoom'), bills.indexOf('function inDays')), /footerStart=/);
    assert.match(bills, /<div className=\{moneyKit\.linesFoot\}>\s*<Link href=\{`\$\{accountingBase\}\/teams\/\$\{bill\.teamId\}`\} className=\{kit\.footLink\}>Open \{bill\.teamName\}’s account<\/Link>/);
    assert.match(bills, /eyebrow=\{`\$\{allocation\.description\} · \$\{bandWord\}`\}/, 'the position is Previous · Next\'s to say');
  });

  it('a team\'s bill opens one level in, behind "← {the allocation}", at the same width', () => {
    assert.match(win, /back=\{\{ label: read\.allocation\.description, onBack:/);
    assert.match(win, /<BillRoom[\s\S]{0,700}\n\s+wide\n/);
    const bills = readCode(`${MONEY}/BillWindows.tsx`);
    assert.match(bills, /back=\{back\}\s+levelKey=\{bill\.splitId\}\s+wide=\{wide\}/);
  });
});

describe('4. the two pages are gone; their addresses and the notices land on the windows', () => {
  it('the Payees page and the allocation page are deleted', () => {
    assert.equal(existsSync(path.join(REPO, `${ACCT}/payees/page.tsx`)), false);
    assert.equal(existsSync(path.join(REPO, `${ACCT}/allocations/[allocationId]/page.tsx`)), false);
  });

  it('every old address forwards in one hop', () => {
    const proxy = readCode('proxy.ts');
    assert.match(proxy, /const payees = segments\[2\] === 'accounting' && segments\[3\] === 'payees' && segments\.length <= 5;/);
    assert.match(proxy, /: payees\s*\? `\/\$\{segments\[0\]\}\/admin\/accounting\/ledger`/);
    assert.match(proxy, /if \(segments\.length === 5\) url\.searchParams\.set\('payee', segments\[4\]\);/);
    assert.match(proxy, /else if \(!url\.searchParams\.get\('payee'\)\) url\.searchParams\.set\('payees', '1'\);/);
    assert.match(proxy, /const allocationId = \(segments\[2\] === 'rep-teams' \|\| segments\[2\] === 'accounting'\) && segments\[3\] === 'allocations'/);
    assert.match(proxy, /if \(allocationId\) url\.searchParams\.set\('allocation', allocationId\);/);
    assert.match(proxy, /url\.searchParams\.set\('new', '1'\)/, 'New allocation\'s forward is unchanged');
  });

  it('a notice writes the window\'s address; the bell names it from the new shape and the old', () => {
    assert.match(readCode('lib/club-money-notify.ts'), /admin\/accounting\/allocations\?allocation=\$\{allocationId\}\$\{splitId \? `&bill=/);
    assert.equal(notificationDestination('/o/admin/accounting/allocations?allocation=a&bill=s', 'admin'), 'Open the bill');
    assert.equal(notificationDestination('/o/admin/accounting/allocations?allocation=a', 'admin'), 'Open the allocation');
    assert.equal(notificationDestination('/o/admin/accounting/allocations/a?bill=s', 'admin'), 'Open the bill');
    assert.match(readCode('scripts/seed-uat-treasurer-notifications.mjs'), /admin\/accounting\/allocations\?allocation=/);
  });
});

describe('5. one joined band for every club money summary', () => {
  it('no separate figure cards or tiles are left in club money', () => {
    const files = [...walk(MONEY), ...walk(ACCT)];
    for (const f of files) assert.doesNotMatch(readCode(f), /\bFigureCards\b|<Tiles\b/, `${f}: separate cards are drift`);
    const kit = readCode(`${MONEY}/MoneyKit.tsx`);
    assert.doesNotMatch(kit, /export function (FigureCards|Tiles)\b/);
  });
  it('an allocation, a team\'s bill and a team\'s account open on the band; a team\'s cash keeps its lock', () => {
    assert.match(readCode(ALLOC_WINDOW), /<MoneySummaryBand/);
    assert.match(readCode(`${MONEY}/BillWindows.tsx`), /<MoneySummaryBand/);
    const account = readCode(`${ACCT}/teams/[teamId]/page.tsx`);
    assert.match(account, /<MoneySummaryBand/);
    assert.match(account, /key: 'cash', label: 'Cash on hand', held: true/);
    assert.match(readCode('components/coaches/MoneySummaryBand.tsx'), /data-held=\{t\.held \|\| undefined\}/);
  });
});

describe('6. the server: the note, one edit route, the Rep Teams PATCH retired', () => {
  it('the read carries the club\'s note (S3D-03)', () => {
    const reads = readCode('lib/club-money-reads.ts');
    assert.match(reads, /\.select\('id, description, created_at, total_amount, source_budget_line_id, source_entry_id, notes'\)/);
    assert.match(reads, /notes: a\.notes \?\? null/);
  });
  it('one PATCH under Accounting: a money mover, its checks before its write', () => {
    const route = readCode('app/api/admin/accounting/allocations/[allocationId]/route.ts');
    assert.match(route, /export const PATCH[\s\S]*resolveClubMoney\(req, \{ scope: 'loop', write: true \}\)/);
    const edit = readCode('lib/club-allocation-edit.ts');
    const write = edit.indexOf(".from('rep_cost_allocations')");
    for (const check of ["code: 'description_required'", "code: 'note_too_long'", '!inScope.has(s.teamId)', 'if (year.locked) return closedRefusal(year, setting);']) {
      const at = edit.indexOf(check);
      assert.ok(at > 0 && at < write, `${check} comes before the write`);
    }
    assert.match(edit, /if \(!isClosedYearError\(error\)\) throw error;/, 'a close that raced the write says the same thing');
    assert.doesNotMatch(edit, /amount|due_date|payment_schedule/, 'a bill\'s terms have no writer (Ask 7b)');
    assert.match(edit, /const chars = \(s: string\) => \[\.\.\.s\]\.length;/, 'lengths counted as the database counts them');
  });
  it('the Rep Teams PATCH is gone', () => {
    assert.equal(existsSync(path.join(REPO, 'app/api/admin/rep-teams/allocations/[allocationId]/route.ts')), false);
  });
});
