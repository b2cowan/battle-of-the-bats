import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { functionBody, readCode } from './_source-code.ts';
import { ledgerBalanceLabel, ledgerRowDate } from '../../lib/ledger-format.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE TWO LEDGERS READ THE SAME (Ledger Parity, owner rulings D1–D7, 2026-10-02 — hub
 * https://claude.ai/artifact/EQqEd3s4CBLbnrnPuUVAAo, plan docs/projects/active/LEDGER_PARITY_PLAN.md).
 *
 * The club's book was ruled to read EXACTLY like the coach's Ledger (Ask 6, 2026-09-30), and a side by
 * side a day later found five more differences nobody chose — four of them the coach's Ledger, the
 * benchmark, having drifted from the written standard. Each was a screen-by-screen edit that read fine
 * on its own. This pins the facts that keep them one recipe:
 *
 *   D1/D2 — ONE date rule: a row prints the day; the balance lines carry the full date.
 *   D3    — no control in a ledger cell on either portal except Record on an unpaid installment;
 *           every row opens; a row another tab wrote opens a READ window, its body shared.
 *   D3 ⚖  — the What is at BODY weight on both Ledgers (owner, after ratification); a phone card's title
 *           stays bold (a card's lead cell is its title).
 *   D4    — ONE phone card, in the shared kit; both Ledgers render it.
 *   D6    — a rare tool lives behind Tools on both Ledgers.
 *   D7    — the team picker groups by the server's scope, in the ruled words.
 *
 * Asserted against SOURCE with comments stripped (`_source-code.ts`). The differences that STAY are named
 * in docs/agents/design/TABLE_EXCEPTION_REGISTER.md under K-01 — a difference not on that list is a bug.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
const COACH = 'app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx';
const CLUB = 'app/[orgSlug]/admin/accounting/ledger/page.tsx';
const KIT_CSS = 'components/coaches/kit/Ledger.module.css';
const MONEY_CSS = 'components/admin/kit/club/money/Money.module.css';
/** Round 3 (below): the coach's Payees window, and the bill's room it can open over. */
const WINDOW = 'app/[orgSlug]/coaches/teams/[teamId]/accounting/PayeesWindow.tsx';
const VIEW = 'app/[orgSlug]/coaches/teams/[teamId]/accounting/CommitmentView.tsx';
const coach = readCode(COACH);
const club = readCode(CLUB);
// The Ledger's row is assembled from shared pieces (round 3): the door, the date, the What cell, the chevron cell.
const row = ['registerRow', 'rowDoor', 'rowWhat', 'rowGo', 'rowDateCell'].map(f => functionBody(coach, f)).join('\n');
const balance = functionBody(coach, 'registerBalanceRow');
const line = functionBody(club, 'LineRow');
const book = functionBody(club, 'Book');

describe('Ledger Parity — the two Ledgers are one recipe', () => {
  it('D1/D2: one date rule — a row prints the day, a balance line the full date', () => {
    assert.equal(ledgerRowDate('2026-10-01'), 'Oct 1');
    assert.equal(ledgerBalanceLabel('Starting balance', '2026-09-01'), 'Starting balance · Sep 1, 2026');
    assert.equal(ledgerBalanceLabel('Ending balance', null), 'Ending balance', 'no window, no date');
    assert.match(readCode('lib/ledger-format.ts'), /formatStoredDate\(d, \{ withYear: false \}\)/, 'never a hand-roll');
    // Both registers format through it, and neither through a second rule.
    assert.match(row, /ledgerRowDate\(r\.date\)/);
    assert.doesNotMatch(row, /fmtDate\(r\.date\)/, 'the coach row printed the year on every line');
    assert.match(line, /ledgerRowDate\(row\.date\)/);
    assert.doesNotMatch(line, /\bday\(row\.date\)/);
    assert.match(coach, /ledgerBalanceLabel\('Ending balance', dateRange\.to\)/);
    assert.match(coach, /ledgerBalanceLabel\(bookOpensSeason \? 'Opening balance' : 'Starting balance', dateRange\.from\)/);
    assert.match(book, /ledgerBalanceLabel\('Starting balance', from\)/);
    assert.match(book, /ledgerBalanceLabel\('Ending balance', to\)/);
  });

  it('D2: the club’s note under the table is gone — the dated lines say what it explained', () => {
    assert.doesNotMatch(club, /Oldest at the top, as a bank statement reads/);
  });

  it('D3: no control in a ledger cell on either portal except Record on an unpaid installment', () => {
    // The coach's row: the name (the keyboard door) and Record — nothing else; no pencil, no worded link.
    const buttons = row.match(/<button\b/g) ?? [];
    assert.equal(buttons.length, 2, 'the name, and Record');
    assert.match(row, /className=\{ledgerKit\.name\}/);
    assert.match(row, /\{settle && \([\s\S]*?Record\s*<\/button>/);
    assert.doesNotMatch(row, /<Link\b/, 'a derived row opens its read window; it never links out of a cell');
    assert.doesNotMatch(row, /RowEditButton/);
    assert.doesNotMatch(coach, /import RowEditButton/);
    // Every row opens: no `tappable ? … : undefined` gate on the Ledger row's click. (A payee's entry row, its
    // own renderer, is read and never opened while the Payees window stands over an open form — round 3, D8.)
    assert.match(functionBody(coach, 'registerRow'), /onClick=\{\(\) => \{ if \(window\.getSelection\(\)\?\.toString\(\)\) return; openRow\(\); \}\}/);
    assert.match(functionBody(coach, 'payeeEntryRow'), /onClick=\{interactive \? \(\) => \{ if \(window\.getSelection\(\)\?\.toString\(\)\) return; openRow\(\); \} : undefined\}/);
    assert.match(row, /: \(\) => setReadRow\(r\)/, 'what cannot be edited here opens the read window');
    // The coach's balance lines hold no control: the Opening line's words are its door, its cell a chevron.
    assert.doesNotMatch(balance, /<button\b/);
    assert.doesNotMatch(balance, /Change →/);
    // The club's line: the name button and nothing else.
    assert.equal((line.match(/<button\b/g) ?? []).length, 1, 'the name');
    assert.doesNotMatch(line, /<Link\b/);
  });

  it('D3: a line another tab wrote opens a READ window, and the two portals render one body', () => {
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/LedgerLineWindow.tsx'), /<LedgerLineRead\b/);
    assert.match(readCode('components/admin/kit/club/money/LedgerWindows.tsx'), /<LedgerLineRead\b/);
    assert.match(readCode('components/admin/kit/club/money/MoneyKit.tsx'), /export \{ RecordFacts as Facts \} from '@\/components\/coaches\/kit'/,
      'one facts box: the club’s Facts IS the kit’s');
    // It reads what the row carries — never a second fetch that could disagree with the row clicked.
    assert.doesNotMatch(readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/LedgerLineWindow.tsx'), /fetch\(/);
    // /review 2026-10-02: it CLOSES when its view or tab goes away — hidden, it came back stale on the way back.
    assert.match(coach, /if \(!readVisible\) setReadRow\(null\);/);
    assert.match(coach, /<LedgerLineWindow row=\{readRow\} base=\{base\} open=\{readVisible\}/);
  });

  it('the club’s share switch holds its window while it saves; a corrected name is sent on close (/review 2026-10-02)', () => {
    const payees = readCode('app/[orgSlug]/admin/accounting/payees/page.tsx');
    assert.match(payees, /busy=\{sharing\}/, 'Done mid-save left the Teams column stale');
    assert.match(payees, /touch\(\); closeRefused\.current = false;/, 'the club’s: a corrected name after a refusal is sent on close');
    // The coach's payee window (round 3): the same latch, on the name AND the note.
    assert.equal((readCode(WINDOW).match(/touch\(\); refusedOnce\.current = false;/g) ?? []).length, 2, 'the coach’s: name and note both re-arm the save');
  });

  it('D3 ⚖: neither register’s What is bold — the coach’s regular weight on both; a card’s title stays bold', () => {
    const kit = readCode(KIT_CSS);
    const name = kit.match(/\n\.name \{([^}]*)\}/)?.[1] ?? '';
    assert.match(name, /font-weight: 400;/, 'the What at body weight');
    assert.match(kit, /\.cardsFrame td\.whatCell \.name \{ font-weight: 650; \}/, 'a phone card’s title is bold');
    assert.match(line, /className=\{`\$\{ledgerKit\.name\} \$\{moneyKit\.lineName\}`\}/);
    assert.doesNotMatch(line, /moneyKit\.what\b|repKit\.nameButton/, 'the club’s old bold name');
    const money = readCode(MONEY_CSS);
    assert.doesNotMatch(money.match(/\.lineName \{([^}]*)\}/)?.[1] ?? '', /font-weight/, 'the void-row hook carries no weight');
  });

  it('D4: ONE phone card — the shared kit’s, on both Ledgers; never a second recipe', () => {
    assert.match(coach, /className=\{`\$\{styles\.tableWrap\} \$\{ledgerKit\.cardsFrame\} \$\{styles\.registerTableWrap\}`\}/);
    assert.match(book, /className=\{`\$\{repKit\.tableFrame\} \$\{ledgerKit\.cardsFrame\}`\}/);
    assert.match(readCode('app/[orgSlug]/admin/accounting/teams/[teamId]/page.tsx'), /ledgerKit\.cardsFrame/, 'the team-account statement too');
    assert.doesNotMatch(readCode(MONEY_CSS), /\.cardsFrame\b/, 'the card recipe moved out of the club’s sheet');
    assert.doesNotMatch(readCode(MONEY_CSS), /\.phoneBal\b/);
    // The balance lines are plain lines between the cards on BOTH phones, never a card.
    assert.match(coach, /ledgerKit\.phoneBal/);
    assert.match(book, /ledgerKit\.phoneBal/);
    // An unpaid installment's card keeps Record — the cell becomes the card's foot, the chevron its corner.
    assert.match(row, /settle \? ` \$\{ledgerKit\.goCellAction\}` : ''/);
  });

  it('D6: a rare tool lives behind Tools on both Ledgers — Payees is not a button and not a tab', () => {
    for (const [who, src] of [['coach', coach], ['club', club]] as const) {
      assert.match(src, /<CoachToolbarMenu label="Tools"/, `${who}: Tools`);
      assert.match(src, /drawerOnPhone drawerTitle="Tools"/, `${who}: a sheet on a phone`);
      assert.match(src, /label="Payees"/, `${who}: Payees is in it`);
    }
    // No group headings (owner 2026-10-09): a heading earns its place only over two or more groups, one of them
    // holding more than one item. The coach's menu is one group; the club's is two groups of one, kept apart by a
    // divider — Transfer (this book), then Payees (the club's list).
    for (const [who, src] of [['coach', coach], ['club', club]] as const) {
      assert.doesNotMatch(src, /CoachToolbarMenuHeading/, `${who}: no heading over the Tools menu`);
    }
    // The divider rides with Transfer inside the money-writer's fragment: a reader sees Payees alone, no stray line.
    assert.match(club, /\{canMove && \(\s*<>\s*<CoachToolbarMenuItem label="Transfer"[\s\S]*?\/>\s*<CoachToolbarMenuSeparator \/>\s*<\/>\s*\)\}\s*<CoachToolbarMenuItem label="Payees"/,
      'club: Transfer, a divider, then Payees');
    assert.doesNotMatch(functionBody(club, 'LedgerTab').match(/const bookFoot[\s\S]*?;\n/)?.[0] ?? '', /Transfer|Payees/,
      'the Book pill’s foot keeps Add ledger only');
  });

  it('D7: the team picker groups by the server’s scope, never by teamId, in the ruled words', () => {
    const picker = readCode('components/accounting/PayeeCombobox.tsx');
    assert.match(picker, /export const SHARED_PAYEES_HEADING = 'Shared by your club';/);
    assert.match(picker, /export const SHARED_PAYEES_NOTICE = 'Your club sees payments to these payees\.';/);
    assert.match(picker, /export const OWN_PAYEES_HEADING = 'Your team’s own';/);
    assert.match(picker, /scoped \? results\.filter\(p => p\.scope === 'club'\)/, 'a standalone team’s rows carry teamId null and are its own');
    assert.match(picker, />Manage payees…<\/Link>/, 'one spelling of the last row: the club’s link…');
    assert.match(picker, />Manage payees…<\/button>/, '…and the coach’s button, which opens the Payees window over the form');
  });
});

/*
 * ROUND 3 (owner, 2026-10-02 — hub screens 10–12, asked during the §258 walk). Payees is a WINDOW over the
 * Ledger, a payee is a RECORD that reads first with this season's money, and Tools holds the team's three
 * lists; plus the defect found while drawing (D9b): every screen printed a bill's payee as it was TYPED.
 */
describe('Ledger Parity round 3 — Payees over the Ledger, a payee’s record, Tools', () => {
  const win = readCode(WINDOW);

  it('D8: no Payees PAGE — a window over the Ledger, drawn before every other window, raised over a form', () => {
    assert.throws(() => readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/payees/page.tsx'), 'the page is gone');
    assert.doesNotMatch(coach, /accounting\/payees/, 'nothing links to it');
    assert.doesNotMatch(readCode(VIEW), /accounting\/payees/);
    assert.match(win, /<RoomShell\b/);
    // Before the read window and the bill: a bill opened from a payee's entries lands OVER it.
    const at = (s: string) => coach.indexOf(s);
    assert.ok(at('<PayeesWindow') > 0 && at('<PayeesWindow') < at('<LedgerLineWindow') && at('<PayeesWindow') < at('<CommitmentView'),
      'the Payees window is drawn first');
    // From Tools it sits over the Ledger; from the picker inside a bill or the money form it stands above it.
    assert.match(coach, /onSelect=\{\(\) => \{ setListOpen\(null\); setPayeesFrom\('tools'\); \}\}/, 'one of the team’s lists at a time');
    assert.match(coach, /onManage=\{\(\) => setPayeesFrom\('picker'\)\}/, 'the money form’s picker');
    assert.match(coach, /onManagePayees=\{\(\) => setPayeesFrom\('picker'\)\}/, 'the bill’s picker');
    assert.match(coach, /raised=\{payeesFrom === 'picker'\}/);
    assert.match(coach, /open=\{!!payeesFrom && !!tabActive\}/);
    assert.match(coach, /if \(!tabActive\) \{ setPayeesFrom\(null\); setListOpen\(null\); \}/, 'closed, never just hidden, when the tab goes');
    // Its questions stand with it; the raise is one number, inline, in both frames.
    // The room, its two questions where the window opens them, and each question's own frame.
    assert.equal((win.match(/raised=\{raised\}/g) ?? []).length, 5, 'every frame the window opens stands with it');
    assert.match(readCode('components/coaches/RoomShell.tsx'), /style=\{raised \? \{ zIndex: RAISED_OVERLAY_Z \} : undefined\}/);
    assert.match(readCode('components/coaches/QuestionShell.tsx'), /style=\{raised \? \{ zIndex: RAISED_OVERLAY_Z \} : undefined\}/);
    // While raised, a payee's entries are read, never opened.
    assert.match(functionBody(coach, 'renderPayeeRows'), /const interactive = payeesFrom !== 'picker';/);
    // A bill open under it follows a rename or a merge of its payee.
    // One rule (lib/expense-payee.ts) for the bill's draft and the money form's pick.
    // An updater, so a reseed for another bill in the same render is what the change applies to (/review 2026-10-02).
    assert.match(readCode(VIEW), /setPayee\(p => followPayeeChange\(p, change\)\)/);
    assert.match(coach, /setFormPayee\(p => followPayeeChange\(p, change\)\)/);
    assert.match(readCode('lib/expense-payee.ts'), /change\.kind === 'merged' && change\.from === pick\.payeeId\) return \{ \.\.\.pick, payeeId: change\.into, displayName: change\.intoName \}/);
  });

  it('D9: a payee is a record — reads first, one pencil, this season’s money from the Ledger’s own rows', () => {
    assert.match(win, /aria-label=\{editing \? 'Done editing' : 'Edit this payee'\}/, 'one button whose glyph flips');
    // /review 2026-10-02: an abandoned (refused) edit is let go when the coach leaves the payee, and a payee opened
    // again — even the same one — is seeded afresh, so the refused text never comes back or retries itself.
    assert.match(win, /if \(!open\) \{ setOpenId\(null\); setQuestion\(null\); setNotice\(''\); setEditing\(false\); setSeededFor\(null\); \}/);
    assert.match(win, /const leave = \(\) => \{ settle\(\); refusedOnce\.current = false; \};/);
    for (const exit of ['close', 'toList', 'openPayee']) assert.match(win, new RegExp(`const ${exit} = async [^\\n]*if \\(await flush\\(\\)\\) \\{ leave\\(\\);`), exit);
    assert.match(win, /back: \{ label: 'Payees', onBack: \(\) => void toList\(\) \}/, 'one level in, behind ← Payees');
    for (const label of ['Paid this season', 'Still to pay', 'Next due']) assert.match(win, new RegExp(`label: '${label}'`), label);
    for (const th of ['Paid', 'Still to pay', 'Last paid']) assert.match(win, new RegExp(`>${th}</th>`), `the list’s ${th} column`);
    assert.doesNotMatch(win, />Entries<\/th>|>Last used<\/th>/, 'the all-season bill count and the entered-on date are gone');
    // Its money is the Ledger's: grouped from the book's own rows by the bill behind each, never a second query.
    assert.match(coach, /payeeMoneyByPayee\(\s*book\?\.book \?\? \[\],/);
    assert.match(win, /renderRows\(m\.rows\)/);
    assert.doesNotMatch(win, /rep_team_expenses|fetch\(`\$\{api\}\?all=1/, 'the list read is the payees, not their money');
    // The note is the only other thing a payee holds — and the one write takes both.
    assert.match(readCode('app/api/coaches/[orgSlug]/teams/[teamId]/payees/[payeeId]/route.ts'), /updateTeamPayee\(w\.org, w\.teamId, w\.payeeId, \{ name: body\.name, notes: body\.notes \}\)/);
  });

  it('D10: Tools holds the team’s three lists — the two editors for the money-writer only', () => {
    assert.match(coach, /<CoachToolbarMenuItem label="Payees"/);
    assert.match(coach, /\{canWriteMoney && \(\s*<>[\s\S]{0,40}?<CoachToolbarMenuItem label="Categories & items"[\s\S]*?<CoachToolbarMenuItem label="Money tags"/);
    assert.match(coach, /onSelect=\{\(\) => \{ setPayeesFrom\(null\); setListOpen\('categories'\); \}\}/);
    assert.match(coach, /onSelect=\{\(\) => \{ setPayeesFrom\(null\); setListOpen\('tags'\); \}\}/);
    assert.match(coach, /<BudgetItemManagerModal orgSlug=\{orgSlug\}/);
    assert.match(coach, /<TagManagerDrawer\b/);
  });

  it('D9b: a bill’s payee reads as it is named NOW, everywhere it is printed', () => {
    assert.match(readCode('lib/db.ts'), /const REP_EXPENSE_WITH_PAYEE = '\*, payee:org_payees\(name\)';/);
    // Opt-in: only the read that feeds the screens printing a payee pays for the join.
    assert.match(readCode('app/api/coaches/[orgSlug]/teams/[teamId]/expenses/route.ts'), /getRepTeamExpenses\(programYear\.id, \{ withPayeeName: true \}\)/);
    assert.match(readCode('lib/db.ts'), /payeeName: r\.payee\?\.name \?\? null,/);
    assert.match(functionBody(readCode(VIEW), 'seedPayee'), /expensePayeeName\(expense\)/);
    assert.match(coach, /const payeeName = expensePayeeName\(e\);/, 'the money form’s seed');
    assert.match(coach, /!== \(editing \? expensePayeeName\(editing\) : null\)/, 'and its unchanged-check');
    assert.match(readCode('lib/coach-money-exports.ts'), /payee: expensePayeeName\(e\) \?\? '',/);
  });
});
