/**
 * THE COACH'S BANK VIEW holds its rules (Bank balance check BC7a — Money → Ledger → View: Bank; plan §0 "Coach desk and
 * reader", "Coach sharing", §6 tab 2, K7). Source guards over the screens; the server's own rules are
 * bank-coach-routes-guard's and bank-r2-server-guard's.
 *   1 · the Ledger's fourth view: one value, its label, its address, nothing of the book's toolbar on it.
 *   2 · K7 / B7: the form, Delete and "Check this statement again" are money write's only (the server's `canWrite`).
 *   3 · rule 6: the screen sends intent; the band is the engine's; a saved check's figures are the server's.
 *   4 · the coach's season: "Statements from this season only", Q1's divider by the season's NAME, no year parameter.
 *   5 · sharing: the look-free module both portals use, the coach view drawn in the portal's own look.
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
