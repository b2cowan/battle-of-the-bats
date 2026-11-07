/**
 * THE COACH'S BANK VIEW holds its rules (Bank balance check BC7a — Money → Ledger → View: Bank; plan §0 "Coach desk and
 * reader", "Coach sharing", §6 tab 2, K7). Source guards over the screens; the server's own rules are
 * bank-coach-routes-guard's and bank-r2-server-guard's.
 *   1 · the Ledger's fourth view: one value, its label, its address, nothing of the book's toolbar on it.
 *   2 · K7 / B7: the form, Delete and "Check this statement again" are money write's only (the server's `canWrite`).
 *   3 · rule 6: the screen sends intent; the band is the engine's; a saved check's figures are the server's.
 *   4 · the coach's season: "Statements from this season only", Q1's divider by the season's NAME, no year parameter.
 *   5 · sharing: the look-free module both portals use, the coach view drawn in the portal's own look.
 *   6 · the phone (BC7b): Save last, the cash caption, Find in the portal's one framed list 10 at a time, signed amounts.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, readCode } from './_source-code.ts';
import { BANK_WORDS } from '../../lib/bank-tab-words.ts';

const LEDGER = 'app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx';
const DIR = 'components/coaches/bank';
const FILES = [...filesUnder(DIR, '.tsx'), ...filesUnder(DIR, '.ts')];
const code = (f: string) => readCode(`${DIR}/${f}`);
const ALL = FILES.map(f => readCode(f)).join('\n');

describe('1 · the Ledger\'s fourth view, Bank (B8)', () => {
  const ledger = readCode(LEDGER);
  it('one more LedgerView value, its label, the View pill offers it, `?view=bank` and the memory accept it', () => {
    assert.match(ledger, /type LedgerView = 'timeline' \| 'bills' \| 'due' \| 'bank';/);
    assert.match(ledger, /bank: 'Bank',/);
    assert.match(ledger, /return v === 'timeline' \|\| v === 'bills' \|\| v === 'due' \|\| v === 'bank';/);
    assert.match(ledger, /options=\{\(\['timeline', 'bills', 'due', 'bank'\] as const\)\.map\(/);
  });
  it('on Bank the toolbar is the View pill alone: no Export, Tools, create, filter strip or tag total', () => {
    assert.match(ledger, /\{!onBank && \(<div className=\{kit\.toolbarActions\}>/);
    assert.match(ledger, /\{!onBank && \(<div className=\{styles\.panelFilterStrip\}>/);
    assert.match(ledger, /\{!onBank && tagFilterSummary && showTagFilter && \(/);
    assert.match(ledger, /\{onBank \? \(\s*<CoachBankView orgSlug=\{orgSlug\} teamId=\{teamId\} active=\{tabActive\}/);
  });
  it('"Add the missing line" opens the Ledger\'s own Record money window, money write only, filled with the gap', () => {
    assert.match(ledger, /onAddLine=\{canWriteMoney \? line => openConversationFrom\(line\.direction === 'in'/);
    assert.match(ledger, /\{ branch: 'other-in', amount: line\.amount, prefill: \{ receivedDate: line\.date \} \}/);
    assert.match(ledger, /\{ branch: 'spend', amount: line\.amount, prefill: \{ paidDate: line\.date \} \}/);
    assert.match(ledger, /\.\.\.\(paidDate \? \{ paidDate \} : \{\}\)/, 'the opener seeds the paid date into the form and its baseline');
    assert.doesNotMatch(ALL, /\/register|\/expenses|accounting_entries|rep_team_expenses/, 'no bank screen writes a money line (ask 1)');
  });
});

describe('2 · K7 / B7: money read sees the checks, never the doors', () => {
  it('the form is mounted only for the server\'s canWrite', () => {
    assert.match(code('CoachBankView.tsx'), /\{view\.canWrite && \(\s*<CoachBankCheck /);
    assert.match(code('CoachBankView.tsx'), /canWrite=\{view\.canWrite\}/);
  });
  it('Delete and "Check this statement again" are a writer\'s; there is no print (BC8\'s team report)', () => {
    const win = code('CoachBankWindow.tsx');
    assert.match(win, /footerStart=\{canWrite \? \(asking \?/);
    assert.match(win, /\{canWrite && <button type="button" className=\{styles\.btnPrimary\} onClick=\{\(\) => onAgain\(check\.date\)\}>/);
    assert.doesNotMatch(ALL, /window\.print|printCheck|Printer/);
  });
  it('"never checked" is no checks, never no account (BC6b kept edge a)', () => {
    assert.match(code('CoachBankView.tsx'), /view\.checks\.length === 0 \?/);
    assert.doesNotMatch(ALL, /account === null|!view\.account\b/);
  });
});

describe('3 · rule 6: intent in, the server\'s numbers out', () => {
  const form = code('CoachBankCheck.tsx');
  it('the band is the engine\'s figureCheck, with the cash; a team counts no online payments', () => {
    assert.match(form, /figureCheck\(\{ bankCents: typed \?\? 0, booksCents: fresh\.booksCents, onItsWayCents: null, waiting: items, cashCents \}\)/);
  });
  it('Save sends the date, the balance, the cash and the marked lines\' KEYS only', () => {
    assert.match(form, /date, bankCents: typed, \.\.\.\(cashCents \? \{ cashCents \} : \{\}\), waiting: \[\.\.\.marked\.keys\(\)\],/);
  });
  it('after a save the form starts fresh WITHOUT clearing the notice it just gave (/review BC7a)', () => {
    assert.match(form, /setBalance\(''\); setCash\(''\); setDate\(today\); setAsOf\(today\); setMarked\(new Map\(\)\); setDropped\(new Set\(\)\);/);
    assert.doesNotMatch(form, /pickDate\(today\)/);
    assert.match(form, /if \(!active \|\| !ISO_DAY\.test\(asOf\)\) return;/, 'the hidden Ledger reads nothing');
  });
  it('a refused day says the server\'s sentence (O5), never prose of its own', () => {
    assert.match(form, /figure\.refused\) return <p className=\{b\.status\} role="status">\{BANK_REFUSAL\[figure\.refused\]\}<\/p>/);
  });
  it('the opened check draws the SAVED figure and the engine\'s saved terms; no on-its-way line for a team', () => {
    const win = code('CoachBankWindow.tsx');
    assert.match(win, /bankBandTiles\(\{ date: check\.date, figure: check\.figure, typed: true, saved: true, isPhone \}\)/);
    assert.match(win, /savedTerms\(check\)/);
    assert.doesNotMatch(win, /case 'onItsWay'/);
  });
  it('the hints are the engine\'s, over this season\'s and last season\'s lines (coachHints)', () => {
    assert.match(code('CoachBankFind.tsx'), /coachHints\(band\.differenceCents, \{ since: suspects\.since, sinceMatch: suspects\.sinceMatch, lines: suspects\.lines, lastSeason: last \}, markedKeys\)/);
    assert.doesNotMatch(code('CoachBankFind.tsx'), /atStart|Waiting at the start/, 'a team has no starting statement');
  });
});

describe('4 · the working season only', () => {
  it('"Statements from this season only, since {date}." from the server\'s season start', () => {
    assert.match(code('CoachBankCheck.tsx'), /W\.coachSince\(dayYear\(view\.season\.start\)\)/);
    assert.equal(BANK_WORDS.coachSince('Sep 1, 2026'), 'Statements from this season only, since Sep 1, 2026.');
  });
  it('Q1-A: last season\'s lines sit under "From the {season}" by the season\'s own name', () => {
    assert.match(code('CoachBankFind.tsx'), /W\.coachLastSeason\(last\.name\)/);
    assert.equal(BANK_WORDS.coachLastSeason('2025 Season'), 'From the 2025 Season');
  });
  it('the only parameter a bank read carries is the statement DAY (no year, no season)', () => {
    assert.match(code('coachBank.ts'), /\?date=\$\{encodeURIComponent\(date\)\}/);
    assert.doesNotMatch(ALL, /[?&](year|season|programYear)=/i);
  });
  it('the view reads only while the Ledger is on screen, and again on the money revision', () => {
    assert.match(code('CoachBankView.tsx'), /if \(!active\) return;[\s\S]{0,300}\}, \[active, orgSlug, teamId, revision, retry\]\);/);
  });
});

describe('5 · one look-free module shared, each portal its own look', () => {
  it('the coach view never reaches into the admin kit or the club\'s Bank screens', () => {
    assert.doesNotMatch(ALL, /components\/admin|RepKit|MoneyKit|ClubKit|KitDialog|club\/money\/bank/);
  });
  it('the band tiles and the formatting come from lib/bank-screen.ts in both portals', () => {
    assert.match(code('CoachBankCheck.tsx'), /from '@\/lib\/bank-screen'/);
    assert.match(readCode('components/admin/kit/club/money/bank/BankFigure.tsx'), /from '@\/lib\/bank-screen'/);
    assert.match(readCode('components/admin/kit/club/money/bank/BankShared.ts'), /export \{ cents, fieldAmount, moved, dayYear, nameOf, throughWords \} from '@\/lib\/bank-screen';/);
    assert.doesNotMatch(readCode('lib/bank-screen.ts'), /bank-coach-|components\/admin/);
  });
  it('an off check is amber, never red', () => {
    assert.doesNotMatch(ALL, /tone="danger"|tone: 'danger'/);
  });
});

describe('6 · the phone (BC7b: drawing tab 2, the club\'s BC4b recipe in the portal\'s own list)', () => {
  it('Save is inline at a desk and the card\'s last thing on a phone, its notes and the season\'s line under it', () => {
    const check = code('CoachBankCheck.tsx');
    assert.match(check, /\{!isPhone && saveButton\}\s*<\/div>\s*\{!isPhone && saveNotes\}/);
    assert.match(check, /\{isPhone && saveButton\}\s*\{isPhone && saveNotes\}\s*<\/section>/);
    assert.match(check, /const saveNotes = \([\s\S]*W\.coachSince\(dayYear\(view\.season\.start\)\)[\s\S]*?\);\n\n  return/);
  });
  it('the phone band says "Your books, less $X cash" when the cash is all that is taken off, in the coach view only', () => {
    assert.equal(BANK_WORDS.coachShouldCashPhone('$180.00'), 'Your books, less $180.00 cash');
    assert.match(code('CoachBankCheck.tsx'), /const cashOnly = cashCents !== null && items\.length === 0;/);
    assert.doesNotMatch(readCode('lib/bank-screen.ts'), /coachShouldCashPhone/, 'the shared (club) tiles keep their settled caption');
  });
  it('Find on a phone: the portal\'s framed list (never the table cards), 10 at a time, signed amounts, the action under the row', () => {
    const find = code('CoachBankFind.tsx');
    assert.match(find, /const PAGE_PHONE = 10;/);
    assert.match(find, /const page = isPhone \? PAGE_PHONE : PAGE;/);
    assert.match(find, /<CoachRowList label=\{sinceTitle\}/);
    assert.match(find, /moved\(signed\(l\.direction, l\.amountCents\)\)/);
    assert.match(find, /actions=\{<LineAction name=\{name\} onMark=\{onMark\} undo=\{undo\} shown quiet=\{!chip\} \/>\}/,
      'the bordered button on a hinted phone row only; the rest say it as the quiet link (owner 2026-11-06)');
    assert.doesNotMatch(ALL, /tableAsCards/, 'the phone draws its own list; no label/value table cards');
  });
  it('the saved checks on a phone are rows of the framed list, each the door to its check', () => {
    assert.match(code('CoachBankView.tsx'), /<CoachRow key=\{c\.id\} as="button" door="chevron" aria-haspopup="dialog" onClick=\{\(\) => setOpenId\(c\.id\)\}/);
  });
});

describe('7 · the coach\'s touchpoints (BC8a: K6, K7, R0 tab 7; owner BC8a rulings 2026-11-06)', () => {
  const OVERVIEW = readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/OverviewDashboard.tsx');
  const HUB = readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx');
  const LINE = code('CoachBankOverviewLine.tsx');
  const CLOSE = readCode('components/coaches/CloseSeasonModal.tsx');
  const START = readCode('components/coaches/StartNextSeasonModal.tsx');
  it('the Money Overview line sits in the Cash on hand card above its foot, a door to Ledger → View: Bank', () => {
    assert.match(OVERVIEW, /\{bank && <CoachBankOverviewLine orgSlug=\{bank\.orgSlug\} teamId=\{bank\.teamId\} href=\{hrefs\.bankView\} \/>\}\s*<div className=\{kit\.foot\}>\s*<Link href=\{hrefs\.transactions\}/,
      'above the foot, so the three cards\' feet stay one band (the BC8a walk)');
    assert.match(HUB, /bankView: sectionHref\('ledger', \{ view: 'bank' \}\),/);
    assert.match(HUB, /bank=\{\{ orgSlug, teamId \}\}/);
  });
  it('the line is quiet: a failed read draws nothing, and it never says "Matches" (the club\'s settled line)', () => {
    assert.match(LINE, /if \(r\.ok\) setView\(r\.view\); else setFailed\(true\);/);
    assert.match(LINE, /if \(!view\) return failed \? null : /);
    assert.doesNotMatch(LINE, /W\.matches/);
    assert.equal(BANK_WORDS.coachOverviewNotChecked, 'Bank not checked yet', 'never checked: the same door (owner BC8a)');
  });
  it('every highlight opens what it names: the amber chip opens that check (?bankCheck=, read once)', () => {
    assert.match(LINE, /<Link href=\{bankCheckHref\(href, t\.id\)\} className=\{b\.chipDoor\}/);
    assert.match(HUB, /const ONE_SHOT_KEYS = \[[^\]]*'bankCheck'/);
    const view = code('CoachBankView.tsx');
    assert.match(view, /useRoomAddress\('bankCheck'\)/);
    // The address forgets the key BEFORE the window opens (its Back step), on screen only.
    assert.match(view, /if \(!active\) \{ pendingCheck\.current = null; return; \}\s*if \(askedCheck\) \{ pendingCheck\.current = \{ id: askedCheck, on: view \}; setAskedCheck\(null\); return; \}[^]*?setOpenId\(ask\.id\);[^]*?else if \(view !== ask\.on\) pendingCheck\.current = null;/,
      'the window opens only once the address no longer carries the key (the BC8a walk: Back reopened it otherwise), waits for a read that has the check, and never opens unasked');
  });
  it('the season windows warn only when the season has a check, never block, and the roll knows nothing of the bank', () => {
    assert.match(code('coachBank.ts'), /if \(current && r\.ok && r\.view\.checkedThrough\) setThrough\(r\.view\.checkedThrough\.date\);/);
    assert.match(CLOSE, /useSeasonBankWarning\(orgSlug, teamId, 'close'\)/);
    assert.match(START, /useSeasonBankWarning\(orgSlug, teamId, 'start'\)/);
    // Start next season holds typed answers: the sentence alone, no door out of the form.
    assert.doesNotMatch(START, /view=bank/);
    for (const src of [CLOSE, START]) assert.doesNotMatch(src, /bankWarning[^\n]*disabled|disabled=\{[^}]*bankWarning/, 'warn, never block');
    assert.doesNotMatch(readCode('lib/rep-season-rollover.ts'), /bank/i);
  });
  it('⚖ B (owner BC8a): the club\'s Teams tab shows no bank column — the coach\'s books stay the team\'s', () => {
    assert.doesNotMatch(readCode('components/admin/kit/club/money/TeamsTable.tsx'), /bank/i);
  });
});
