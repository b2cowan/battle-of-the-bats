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
import { filesUnder, functionBody, readCode } from './_source-code.ts';
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
    // Named for what it does (Bank check novice UX S1, A2).
    assert.match(ledger, /bank: 'Balance check',/);
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
    assert.match(ledger, /onAddLine=\{canWriteMoney \? line => \{[\s\S]{0,400}?openConversationFrom\(line\.direction === 'in'/);
    // S3 (A5): the fee / interest door adds the description, the platform word and the door; without one, nothing more.
    assert.match(ledger, /const fill = line\.door \? \{ \.\.\.doorFill\('coach', line\.door\), bankDoor: line\.door \} : \{\};/);
    assert.match(ledger, /\{ branch: 'other-in', amount: line\.amount, prefill: \{ receivedDate: line\.date, \.\.\.fill \} \}/);
    assert.match(ledger, /\{ branch: 'spend', amount: line\.amount, prefill: \{ paidDate: line\.date, \.\.\.fill \} \}/);
    assert.match(ledger, /\.\.\.\(paidDate \? \{ paidDate \} : \{\}\)/, 'the opener seeds the paid date into the form and its baseline');
    assert.doesNotMatch(ALL, /\/register|\/expenses|accounting_entries|rep_team_expenses/, 'no bank screen writes a money line (ask 1)');
  });
});

describe('2 · K7 / B7: money read sees the checks, never the doors', () => {
  it('the form is mounted only for the server\'s canWrite', () => {
    assert.match(code('CoachBankView.tsx'), /\{view\.canWrite && \(\s*<CoachBankCheck /);
    assert.match(code('CoachBankView.tsx'), /canWrite=\{view\.canWrite\}/);
  });
  it('Delete and "Check this statement again" are a writer\'s', () => {
    const win = code('CoachBankWindow.tsx');
    assert.match(win, /\{canWrite && \(\s*<button type="button" className=\{styles\.deleteRecordBtn\} onClick=\{\(\) => setAsking\(true\)\}/);
    assert.match(win, /\{canWrite && <button type="button" className=\{styles\.btnPrimary\} onClick=\{\(\) => onAgain\(check\.date\)\}>/);
  });
  it('"Print this check" is EVERYONE\'s who opens the check, money read too, a desk\'s door only (BC8b, "Report door")', () => {
    // Changed on purpose at BC8b (owner, plan §0 "Report door", carried to the team): BC7 pinned "no print" until the
    // team's report existed.
    const win = code('CoachBankWindow.tsx');
    const door = win.match(/<button type="button" className=\{b\.printDoor\} onClick=\{\(\) => window\.print\(\)\}/);
    assert.ok(door, 'the print door prints from the same screen');
    const before = win.slice(Math.max(0, door!.index! - 400), door!.index!);
    assert.doesNotMatch(before.slice(before.lastIndexOf('</button>')), /canWrite/, 'not behind money write');
    assert.match(win, /<CoachBankReport teamName=\{teamName\} accountName=\{accountName\} check=\{check\} \/>/);
    assert.match(readCode(`${DIR}/CoachBank.module.css`), /@media \(max-width: 640px\) \{ \.printDoor \{ display: none; \} \}/, 'absent at 640 and under (R0 tab 9: no phone version)');
    assert.equal(BANK_WORDS.printCheck, 'Print this check');
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
    // WD2: the fresh card is Start over's (it clears the draft too), and Start over never touches the notice.
    assert.match(functionBody(form, 'save'), /\n {4}startOver\(\);\n/);
    const fresh = functionBody(form, 'startOver');
    // S1 (A8): the cash field closes behind its link again.
    assert.match(fresh, /setBalance\(''\); setCash\(''\); setCashAsked\(false\); newDay\(today\); setAsOf\(today\);/);
    assert.match(form, /const newDay = \(v: string\) => \{ setDate\(v\); setMarked\(new Map\(\)\); setDropped\(new Set\(\)\);/);
    assert.doesNotMatch(fresh, /touch\(\)|onTouched|pickDate/);
    assert.doesNotMatch(form, /pickDate\(today\)/);
    assert.match(form, /if \(!active \|\| !ISO_DAY\.test\(asOf\)\) return;/, 'the hidden Ledger reads nothing');
  });
  it('a refused day says the server\'s sentence (O5), never prose of its own', () => {
    assert.match(form, /figure\.refused\) return <p className=\{b\.status\} role="status">\{BANK_REFUSAL\[figure\.refused\]\}<\/p>/);
  });
  it('the opened check draws the SAVED figure and the engine\'s saved terms; no on-its-way line for a team', () => {
    const win = code('CoachBankWindow.tsx');
    assert.match(win, /bankBandTiles\(\{ date: check\.date, figure: check\.figure, typed: true, saved: true, isPhone, coach: true \}\)/);
    assert.match(win, /savedTerms\(check\)/);
    assert.doesNotMatch(win, /case 'onItsWay'/);
  });
  it('the hints are the engine\'s, over this season\'s and last season\'s lines (coachHints)', () => {
    assert.match(code('CoachBankFind.tsx'), /coachHints\(band\.differenceCents, \{ since: suspects\.since, sinceMatch: suspects\.sinceMatch, lines: suspects\.lines, lastSeason: last \}, markedKeys\)/);
    assert.doesNotMatch(code('CoachBankFind.tsx'), /atStart|Waiting at the start/, 'a team has no starting statement');
  });
});

describe('4 · the working season only', () => {
  it('"Any day this season, from {date} to today." from the server\'s season start (S1, row 7)', () => {
    assert.match(code('CoachBankCheck.tsx'), /W\.coachSince\(dayYear\(view\.season\.start\)\)/);
    assert.equal(BANK_WORDS.coachSince('Sep 1, 2026'), 'Any day this season, from Sep 1, 2026 to today.');
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
    // ⚖ One exception, BC8b: the team's report sits in the shipped paper frame `PrintedPage` (look-free: paper inks fixed,
    //   the mounting portal's own type), as the club's report and the tournament Summary do. Nothing else of admin.
    const frame = "import PrintedPage from '@/components/admin/tournament/PrintedPage';";
    assert.ok(code('CoachBankReport.tsx').includes(frame));
    assert.doesNotMatch(ALL.split(frame).join(''), /components\/admin|RepKit|MoneyKit|ClubKit|KitDialog|club\/money\/bank|BankCheckReport/);
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
  it('Save is inline at a desk and the card\'s last thing on a phone; the one note line sits under the fields on both (S1, D1/D2)', () => {
    const check = code('CoachBankCheck.tsx');
    assert.match(check, /\{!isPhone && saveButton\}\s*<\/div>\s*\{!isPhone && errorLine\}\s*\{noteLine\}/);
    assert.match(check, /\{isPhone && errorLine\}\s*\{isPhone && saveButton\}\s*<\/section>/);
    assert.match(check, /const notes = \[[\s\S]*?typed === null \? W\.coachSince\(dayYear\(view\.season\.start\)\) : null,/);
  });
  it('the phone band says "Your Ledger, less $X not deposited" when the cash is all that is taken off, in the coach view only', () => {
    assert.equal(BANK_WORDS.coachShouldCashPhone('$180.00'), 'Your Ledger, less $180.00 not deposited');
    assert.match(code('CoachBankCheck.tsx'), /const cashOnly = cashCents !== null && items\.length === 0;/);
    assert.doesNotMatch(readCode('lib/bank-screen.ts'), /coachShouldCashPhone/, 'the shared (club) tiles keep their settled caption');
  });
  it('Find on a phone: the portal\'s framed list (never the table cards), 10 at a time, signed amounts, the action under the row', () => {
    const find = code('CoachBankFind.tsx');
    assert.match(find, /const PAGE_PHONE = 10;/);
    assert.match(find, /const page = isPhone \? PAGE_PHONE : PAGE;/);
    assert.match(find, /<CoachRowList label=\{sinceTitle\}/);
    assert.match(find, /moved\(signed\(l\.direction, l\.amountCents\)\)/);
    assert.match(find, /actions=\{<LineAction name=\{name\} onMark=\{onMark\} undo=\{undo\} quiet=\{!chip\} \/>\}/,
      'the bordered button on a hinted phone row only; the rest say it as the quiet link (owner 2026-11-06)');
    // S3, D1: the desk row takes the same recipe (it hid the button until hover or focus before).
    assert.match(find, /<LineAction name=\{name\} onMark=\{onMark\} undo=\{undo\} quiet=\{!chip\} \/>\s*<\/td>/);
    assert.doesNotMatch(readCode('components/coaches/bank/CoachBank.module.css'), /opacity: 0;/, 'no row action hides until hover');
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
    // Never checked: the same door (owner BC8a), in the club's settled no-account words (BC8b `/marketing`: one spelling).
    assert.match(LINE, /\{W\.overviewLead\} \{W\.overviewThrough\} /);
    assert.match(LINE, /\{W\.overviewLead\} <span className=\{b\.overviewDate\}>\{W\.overviewNoAccount\}/);
    assert.equal(`${BANK_WORDS.overviewLead} ${BANK_WORDS.overviewNoAccount}`, 'Bank: not checked yet');
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
    assert.match(code('coachBank.ts'), /if \(current && r\.ok && r\.view\.checkedThrough\) setThrough\(r\.view\.checkedThrough\);/);
    assert.match(code('coachBank.ts'), /if \(!through\) return null;/);
    assert.match(CLOSE, /useSeasonBankWarning\(orgSlug, teamId, 'close'\)/);
    assert.match(START, /useSeasonBankWarning\(orgSlug, teamId, 'start'\)/);
    // Start next season holds typed answers: the sentence alone, no door out of the form.
    assert.doesNotMatch(START, /view=bank/);
    for (const src of [CLOSE, START]) assert.doesNotMatch(src, /bankWarning[^\n]*disabled|disabled=\{[^}]*bankWarning/, 'warn, never block');
    assert.doesNotMatch(readCode('lib/rep-season-rollover.ts'), /bank/i);
  });
  it('⚖ off or matching (owner BC8b 2026-11-07): an off check is the amber warning, a match a plain line outside the box', () => {
    assert.match(code('coachBank.ts'), /through\.result === 'off'\s*\? \{ off: true, text: W\.coachSeasonOff\(/);
    assert.match(CLOSE, /const bankWarning = bankNote\?\.off \? bankNote\.text : null;/);
    assert.match(CLOSE, /const hasWarnings = owesDues \|\| owesBack \|\| !!bankWarning;/, 'a match never opens the "Before you do" box');
    assert.match(CLOSE, /You can still close — but these get harder to sort out afterwards\.\s*<\/p>\s*<\/div>\s*\)\}\s*\{bankMatches && \(/, 'the match sits under the box');
    assert.match(START, /\{bankNote && \(bankNote\.off \? \(\s*<div [\s\S]*?<AlertTriangle [\s\S]*?\) : \(\s*<p /);
    // Under the consequence it is about, never at the form's foot (/design BC8b: out of sight while Start was live).
    assert.ok(START.indexOf('{bankNote && (bankNote.off') < START.indexOf('{ROLL_QUESTION}'), 'above the roll question');
    // S1 (row 16 + A15): no "statement", and the print sentence, said once (both windows close this season).
    assert.equal(BANK_WORDS.coachSeasonOff('$75.00', 'Oct 31, 2026', 'close'),
      'Your balance check was off by $75.00 on Oct 31, 2026. Before you close the season, check your bank balance for the season’s last day. Print any check you want to keep first, from a computer: a closed season has no balance check.');
    assert.equal(BANK_WORDS.coachSeasonMatches('Oct 31, 2026', 'start'),
      'The bank matches through Oct 31, 2026. If you have a later balance, check it before you start the new season. Print any check you want to keep first, from a computer: a closed season has no balance check.');
  });
  it('⚖ B (owner BC8a): the club\'s Teams tab shows no bank column — the coach\'s books stay the team\'s', () => {
    assert.doesNotMatch(readCode('components/admin/kit/club/money/TeamsTable.tsx'), /bank/i);
  });
});

describe('8 · the team\'s printed check (BC8b: K8, R0 tab 9, the club\'s report rulings carried; owner 2026-11-07)', () => {
  const rep = code('CoachBankReport.tsx');
  const css = readCode(`${DIR}/CoachBankReport.module.css`);
  it('bank first from the engine, the saved result, no arithmetic on the page', () => {
    assert.match(rep, /const \{ terms, totalCents \} = reportTerms\(check\);/);
    assert.match(rep, /<PrintedPage\s+name="team-bank-check"/);
    assert.doesNotMatch(rep, /bankCents \+|booksCents -|\+ check\.|- check\./, 'the page only formats');
  });
  it('the team drops what it has not: no starting point (owner "Team report start line"), no on its way, no books list', () => {
    assert.doesNotMatch(rep, /startingPoint|reportStartingPoint|reportOnItsWay|reportBooks\(|dates=/);
  });
  it('who checked carries the team role, as the staff list reads today (owner "Team report role")', () => {
    assert.match(rep, /W\.reportCheckedBy\(check\.checkedBy, check\.checkedByRole, dayYear\(at\.date\), formatTime\(at\.time\)\)/);
    assert.match(readCode('lib/bank-coach-steps.ts'), /checkedByRole: roleOf\(ch\.createdBy\)/);
    // Only on the plain read, beside it (never on a statement day's figure read, which runs as the coach types).
    assert.match(readCode('lib/bank-coach-steps.ts'), /date === null \? teamCheckerRoles\(c\.orgId, c\.season\.teamId\) : Promise\.resolve\(\(\) => null\)/);
    // Quiet: a failed role read drops the role, never the bank read.
    assert.match(readCode('lib/bank-coach-read.ts'), /export async function teamCheckerRoles[\s\S]*?try \{[\s\S]*?\} catch \(e\) \{[\s\S]*?return \(\) => null;/);
  });
  it('both signature lines stay (owner "Team report sign lines"), and the foot names the coach\'s path', () => {
    assert.match(rep, /\[W\.reportPrepared, W\.reportReviewed\]\.map\(/);
    assert.equal(BANK_WORDS.coachReportFoot('Nov 7, 2026', 'U13 Raptors'), 'Printed Nov 7, 2026 from FieldLogicHQ · U13 Raptors · Money → Ledger → Balance check');
  });
  it('⚠ BC5b\'s trap: printed th/td are put back to paper ink, whatever the coach\'s theme', () => {
    assert.match(css, /\.sums th, \.sums td \{[^}]*color: #1F1B14;[^}]*background: transparent;/);
  });
});

describe('9 · through a volunteer\'s eyes (Bank check novice UX S1, plan BANK_CHECK_NOVICE_UX_PLAN.md §2)', () => {
  const check = code('CoachBankCheck.tsx');
  it('A1a + A4 + A11: the heading, the purpose line always, the team-only sentence until the first check, "Date"', () => {
    assert.equal(BANK_WORDS.checkTitle, 'Check your bank balance');
    assert.match(check, /<p className=\{b\.purpose\}>\{W\.coachCheckPurpose\}<\/p>/);
    assert.match(check, /\{view\.checks\.length === 0 && <p className=\{styles\.formHint\}>\{W\.coachTeamOnly\}<\/p>\}/);
    assert.match(BANK_WORDS.coachCheckPurpose, /your Ledger/);
    assert.doesNotMatch(BANK_WORDS.coachCheckPurpose, /books/, 'the coach card\'s one noun');
    assert.match(check, /\{W\.checkDate\} \*<\/label>/);
    assert.doesNotMatch(check, /W\.statementDate/);
  });
  it('A8: the cash field waits behind "Holding cash you haven\'t deposited?"; open once asked for or with cash in it', () => {
    assert.match(check, /const cashOpen = cashAsked \|\| cash !== '';/);
    assert.match(check, /\{cashOpen && \(\s*<div className=\{styles\.field\}>\s*<label className=\{styles\.label\} htmlFor=\{CASH_ID\}>\{W\.coachCash\}<\/label>/);
    assert.match(check, /\{!cashOpen && \([\s\S]*?\{W\.coachCashOpen\}<\/button>/);
    assert.equal(BANK_WORDS.coachCashOpen, 'Holding cash you haven’t deposited?');
  });
  it('row 8: the coach card names the figure "your Ledger"; the club\'s shared words keep "your books"', () => {
    assert.match(check, /bankBandTiles\(\{ date, figure: band, typed: typed !== null, isPhone, coach: true \}\)/);
    assert.match(check, /W\.coachSumBooks\(dayYear\(date\)\)/);
    assert.match(check, /W\.coachSavedMatches\(dayYear\(date\)\)/);
    assert.match(code('CoachBankFind.tsx'), /W\.coachNoLinesSince/);
    assert.equal(BANK_WORDS.coachBandShouldCaption('Nov 8, 2026'), 'Your Ledger on Nov 8, 2026, adjusted for what hasn’t reached the bank yet');
    assert.equal(BANK_WORDS.coachBandBankLess('$4.50'), 'The bank shows $4.50 less than your Ledger.');
    assert.equal(BANK_WORDS.bandBankLess('$4.50'), 'The bank shows $4.50 less than your books.');
  });
  it('rows 10 + 21 + 6: one note line; the balance hint and the season\'s days until a balance is typed', () => {
    assert.match(check, /typed === null \? W\.balanceHint : null,/);
    assert.match(check, /off \? W\.coachSaveOffNote : null,/);
    assert.match(check, /fresh\?\.replaces \? W\.replacesNote\(dayYear\(date\)\) : null,/);
    assert.equal(BANK_WORDS.replacesNote('Nov 8, 2026'), 'Nov 8, 2026 is checked already. Saving again replaces that check.');
    // S7 replaces the draft's resting sentence; S1 leaves it exactly as WD2 wrote it.
    assert.equal(BANK_WORDS.draftKept, 'Kept in this browser only, until you save this check or sign out.');
  });
  it('rows 13 + 25: the list\'s names, and a view-only coach is told who can check', () => {
    assert.equal(BANK_WORDS.listTitle, 'Balance checks');
    assert.equal(BANK_WORDS.savedTitle('Nov 8, 2026'), 'The check for Nov 8, 2026');
    assert.equal(BANK_WORDS.checkAgain, 'Check this date again');
    assert.match(code('CoachBankView.tsx'), /view\.canWrite \? W\.coachNoChecksYet : `\$\{W\.coachNoChecksYet\} \$\{W\.coachReaderCanCheck\}`/);
  });
});

describe('8 · S2, the door (bank check novice UX: asks A3 and A16, words rows 2 and 20)', () => {
  const SETUP = readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/SetupOverview.tsx');
  const HUB = readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx');
  const LINE = code('CoachBankOverviewLine.tsx');
  const ledger = readCode(LEDGER);
  it('A3: the line renders in EVERY season stage — Plan and Collect too, standing on its own above the rail', () => {
    assert.match(SETUP, /\{bank && <CoachBankOverviewLine orgSlug=\{bank\.orgSlug\} teamId=\{bank\.teamId\} href=\{hrefs\.bankView\} standalone \/>\}\s*(?:\{ \}\s*)?<MoneyRail summary=\{summary\} hrefs=\{hrefs\} variant="index" \/>/);
    // The hub hands the setup Overview the team, as it hands the operating one.
    assert.match(HUB, /<SetupOverview[^]*?bank=\{\{ orgSlug, teamId \}\}\s*\/>/);
    assert.match(HUB, /<OverviewDashboard[^]*?bank=\{\{ orgSlug, teamId \}\}\s*\/>/);
  });
  it('A3: until the first check it INVITES — one door, both lines — for someone who can check; a reader keeps "Bank: not checked yet"', () => {
    assert.match(LINE, /if \(!t && view\.canWrite\) \{/);
    assert.match(LINE, /<Link href=\{href\} className=\{`\$\{b\.overviewDoor\} \$\{b\.overviewInvite\}`\}>\s*<span className=\{b\.inviteMain\}>\{W\.inviteLead\}<ChevronRight size=\{14\} aria-hidden \/><\/span>\s*<span className=\{b\.inviteNote\}>\{W\.inviteNote\}<\/span>\s*<\/Link>/);
    // The checked words and the chip are as they were.
    assert.match(LINE, /\{W\.overviewLead\} \{W\.overviewThrough\} /);
    assert.match(LINE, /<Link href=\{bankCheckHref\(href, t\.id\)\} className=\{b\.chipDoor\}/);
    // One spelling for one state: the club's line uses these very words.
    assert.equal(BANK_WORDS.inviteLead, 'Check your bank balance');
    assert.equal(BANK_WORDS.inviteNote, 'Type what the bank shows to see if you’re in step.');
  });
  it('the hold keeps the invitation\'s height on a phone, so the page below it does not jump when the read lands', () => {
    const css = readCode(`${DIR}/CoachBank.module.css`);
    assert.match(css, /\.overviewHold \{ min-height: calc\(var\(--tap-min, 44px\) \+ 1\.1rem\); \}/);
  });
  it('row 20: "How the bank check works" ends the head line and opens the coach bank article, which exists', () => {
    assert.match(code('CoachBankView.tsx'), /<DotPart help>\s*<Link href=\{`\/\$\{orgSlug\}\/coaches\/help#premium-money-bank`\} className=\{b\.link\}>\{W\.helpLink\}<\/Link>\s*<\/DotPart>/);
    assert.equal(BANK_WORDS.helpLink, 'How the bank check works');
    assert.match(readCode('lib/help-content/coaches.tsx'), /id: 'premium-money-bank',/);
  });
  it('A16: the View pill writes the chosen view into the address — from the press, only while the Ledger is on screen', () => {
    assert.match(ledger, /const \[, setViewInAddress\] = useRoomAddress\('view', VIEW_PRESS_DROPS\);/);
    // A press also drops `?filter=` / `?scheduled=`: left in the address they force the timeline again on a reload, so the
    // address would name a view the screen does not show (/review S2).
    assert.match(ledger, /const VIEW_PRESS_DROPS = \['filter', 'scheduled'\] as const;/);
    assert.match(readCode('components/coaches/useRoomAddress.ts'), /for \(const k of alsoClear \?\? \[\]\) next\.delete\(k\);/);
    assert.match(ledger, /onChange=\{next => \{\s*setView\(next as LedgerView\);[^]*?if \(tabActive && isLedgerView\(next\)\) setViewInAddress\(next\);\s*\}\}/);
    // Never from an effect (the filter / scheduled links set the view themselves: a write there would loop), and `view` has ONE reader.
    const reads = ledger.match(/seasonSearchParams\.get\('view'\)/g) ?? [];
    assert.equal(reads.length, 1, 'the panel reads ?view= once');
    assert.doesNotMatch(ledger, /useEffect\(\(\) => \{[^}]*setViewInAddress/);
    // The hub scrubs `view` from the other tabs' links, as a room key must be.
    assert.match(HUB, /const ONE_SHOT_KEYS = \[[^\]]*'view'/);
  });
});
