import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { between, functionBody, readCode } from './_source-code.ts';
import { BANK_WORDS as W } from '../../lib/bank-tab-words.ts';
import {
  GAP_DOOR_MAX_CENTS, GAP_DOOR_WORDS, doorFill, doorFootLine, findPlatformWord, gapDoorFor, sameGapAs,
} from '../../lib/bank-gap-doors.ts';

/**
 * BANK CHECK NOVICE UX S3 — Find's doors and its quiet list, both portals (build prompt
 * docs/projects/active/BANK_CHECK_NOVICE_UX_S3_BUILD_PROMPT.md; drawing BANK_CHECK_NOVICE_UX_S3_DRAWINGS.html; owner rulings
 * 1–8 and D1–D4, 2026-11-09). The rules are pure (`lib/bank-gap-doors.ts`); the screens are pinned by their source.
 */

const COACH_FIND = 'components/coaches/bank/CoachBankFind.tsx';
const CLUB_FIND = 'components/admin/kit/club/money/bank/BankFind.tsx';
const PANEL = 'app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx';
const LEDGER_WINDOWS = 'components/admin/kit/club/money/LedgerWindows.tsx';
const CLUB_FORM = 'components/admin/kit/club/money/bank/BankCheckForm.tsx';
const COACH_CHECK = 'components/coaches/bank/CoachBankCheck.tsx';

const band = (offByCents: number, direction: 'bank_more' | 'bank_less' | null) => ({ offByCents, direction });

describe('S3 · which door (rulings 3, 4, 5)', () => {
  it('a fee when the bank holds less, interest when it holds more, only off and only with nothing to name', () => {
    assert.equal(gapDoorFor({ off: true, named: false, band: band(450, 'bank_less') }), 'fee');
    assert.equal(gapDoorFor({ off: true, named: false, band: band(85, 'bank_more') }), 'interest');
    assert.equal(gapDoorFor({ off: true, named: true, band: band(450, 'bank_less') }), null, 'a callout that names a line keeps its own buttons');
    assert.equal(gapDoorFor({ off: false, named: false, band: band(450, 'bank_less') }), null);
    assert.equal(gapDoorFor({ off: true, named: false, band: band(0, null) }), null);
  });
  it('$100.00 or less, both directions; above it, today\'s one door', () => {
    assert.equal(GAP_DOOR_MAX_CENTS, 10_000);
    assert.equal(gapDoorFor({ off: true, named: false, band: band(10_000, 'bank_less') }), 'fee');
    assert.equal(gapDoorFor({ off: true, named: false, band: band(10_000, 'bank_more') }), 'interest');
    assert.equal(gapDoorFor({ off: true, named: false, band: band(10_001, 'bank_less') }), null);
    assert.equal(gapDoorFor({ off: true, named: false, band: band(35_000, 'bank_more') }), null);
  });
  it('never a deposit door (ruling 3)', () => {
    for (const f of [COACH_FIND, CLUB_FIND]) assert.doesNotMatch(readCode(f), /[Dd]eposit[A-Z]?\w*Door|recordDeposit|addDeposit/);
    assert.doesNotMatch(Object.keys(W).join(' '), /[Dd]epositDoor/);
  });
});

describe('S3 · the platform word (rulings 1, 2)', () => {
  const plat = (name: string, items: { name: string; direction: 'in' | 'out' }[], over: { orgId?: string | null; teamId?: string | null } = {}) => ({
    id: `c-${name}-${over.orgId ?? 'p'}-${over.teamId ?? ''}`, name, orgId: over.orgId ?? null, teamId: over.teamId ?? null,
    items: items.map(i => ({ id: `i-${name}-${i.name}-${over.orgId ?? 'p'}`, name: i.name, direction: i.direction, orgId: over.orgId ?? null, teamId: over.teamId ?? null })),
  });
  it('the coach\'s and the club\'s words, by names and direction', () => {
    assert.deepEqual(GAP_DOOR_WORDS.coach.fee, { category: 'League & Fees', item: 'Bank & payment fees', direction: 'out' });
    assert.deepEqual(GAP_DOOR_WORDS.coach.interest, { category: 'Other Income', item: 'Interest', direction: 'in' });
    assert.deepEqual(GAP_DOOR_WORDS.club.fee, { category: 'Admin', item: 'Bank & payment fees', direction: 'out' });
    assert.deepEqual(GAP_DOOR_WORDS.club.interest, { category: 'Other Income', item: 'Interest', direction: 'in' });
  });
  it('only a platform row matches; a club\'s or a team\'s own word of the same name never does', () => {
    const lists = [
      plat('Other Income', [{ name: 'Interest', direction: 'in' }], { orgId: 'org1' }),
      plat('Other Income', [{ name: 'Interest', direction: 'in' }], { orgId: 'org1', teamId: 't1' }),
      plat('Other Income', [{ name: 'Interest', direction: 'out' }]),
      plat('Other Income', [{ name: 'Rebate', direction: 'in' }, { name: 'Interest', direction: 'in' }]),
    ];
    const hit = findPlatformWord(lists, GAP_DOOR_WORDS.coach.interest);
    assert.equal(hit?.item.id, 'i-Other Income-Interest-p');
    assert.equal(hit?.category.orgId, null);
  });
  it('a word the person can\'t see is null (the window opens with the description only, never an invented word)', () => {
    assert.equal(findPlatformWord([plat('League & Fees', [{ name: 'Insurance', direction: 'out' }])], GAP_DOOR_WORDS.coach.fee), null);
    assert.equal(findPlatformWord([], GAP_DOOR_WORDS.club.fee), null);
  });
  it('what the window opens with: the description, the word, and the banking-app line', () => {
    assert.deepEqual(doorFill('coach', 'fee'), { description: 'Bank fee', word: GAP_DOOR_WORDS.coach.fee });
    assert.deepEqual(doorFill('club', 'interest'), { description: 'Bank interest', word: GAP_DOOR_WORDS.club.interest });
    assert.equal(doorFootLine('fee'), 'Check your banking app first: was this a bank fee? Use the date it shows.');
    assert.equal(doorFootLine('interest'), 'Check your banking app first: was this interest? Use the date it shows.');
  });
});

describe('S3 · A7, the repeat line', () => {
  const check = (date: string, differenceCents: number, kind: 'start' | 'check' = 'check') => ({ kind, date, figure: { differenceCents } });
  it('the newest check before the date, its SIGNED gap equal to today\'s', () => {
    assert.equal(sameGapAs([check('2026-09-30', -450), check('2026-10-31', -450)], '2026-11-08', -450), '2026-10-31');
    assert.equal(sameGapAs([check('2026-10-31', -450), check('2026-09-30', -100)], '2026-11-08', -450), '2026-10-31', 'order-free');
    assert.equal(sameGapAs([check('2026-10-31', 450)], '2026-11-08', -450), null, 'a fee and a deposit never match');
    assert.equal(sameGapAs([check('2026-10-31', -100), check('2026-09-30', -450)], '2026-11-08', -450), null, 'only the newest counts');
  });
  it('never a same-date check (saving replaces it), never a start, never a zero gap', () => {
    assert.equal(sameGapAs([check('2026-11-08', -450)], '2026-11-08', -450), null);
    assert.equal(sameGapAs([check('2026-10-31', -450, 'start')], '2026-11-08', -450), null);
    assert.equal(sameGapAs([check('2026-10-31', 0)], '2026-11-08', 0), null);
  });
  it('the words: "The same **$4.50** as your last check, on Oct 31, 2026."', () => {
    assert.equal(`${W.sameGapLead} $4.50 ${W.sameGapTail('Oct 31, 2026')}`, 'The same $4.50 as your last check, on Oct 31, 2026.');
    for (const f of [COACH_FIND, CLUB_FIND]) {
      assert.match(readCode(f), /\{off && repeatOf && <p className=\{(b|s)\.repeat\}>\{W\.sameGapLead\} <b>\{cents\(band\.offByCents\)\}<\/b> \{W\.sameGapTail\(dayYear\(repeatOf\)\)\}<\/p>\}/);
    }
    assert.match(readCode(COACH_CHECK), /repeatOf=\{typed !== null \? sameGapAs\(view\.checks, date, band\.differenceCents\) : null\}/);
    assert.match(readCode(CLUB_FORM), /repeatOf=\{typed !== null \? sameGapAs\(view\.checks, date, band\.differenceCents\) : null\}/);
  });
});

describe('S3 · Find, both portals (A5, A13, D1, D4)', () => {
  for (const [f, fee, interest, missing] of [
    [COACH_FIND, 'coachFeeDoor', 'coachInterestDoor', 'recordMissingAmount'],
    [CLUB_FIND, 'feeDoor', 'interestDoor', 'addMissingEntry'],
  ] as const) {
    it(`${f}: the fee / interest door only in the nothing-to-name callout`, () => {
      const src = readCode(f);
      assert.match(src, /const quiet = off && !current;/);
      assert.match(src, /const door = gapDoorFor\(\{ off, named: !!current, band \}\);/);
      const quietBranch = between(src, '{quiet && (', '{quiet && listCount > 0 && (');
      assert.match(quietBranch, new RegExp(`door === 'fee' \\? W\\.${fee} : W\\.${interest}`));
      assert.match(quietBranch, new RegExp(`\\{W\\.${missing}\\}`), 'today\'s door stays beside it');
      assert.doesNotMatch(functionBody(src, 'HintCallout'), /Door\b|gapDoor/, 'a callout that names a line keeps today\'s buttons');
      assert.equal((src.match(new RegExp(`W\\.${fee}\\b`, 'g')) ?? []).length, 1);
    });
    it(`${f}: the list closed only when nothing can be named, behind "Show the n lines"`, () => {
      const src = readCode(f);
      assert.match(src, /const listOpen = \(off && !quiet\) \|\| open;/);
      const line = between(src, '{quiet && listCount > 0 && (', '{listOpen && (');
      assert.match(line, /\{W\.noLineOnItsOwn\(target\)\}/);
      assert.match(line, /aria-expanded=\{open\} onClick=\{\(\) => setOpen\(o => !o\)\}/);
      assert.match(line, /\{open \? W\.hideTheLines\(listCount\) : W\.showTheLines\(listCount\)\}/);
      assert.match(line, /\{open \? '\.' : <>\{' '\}\{W\.toMarkAny\}<\/>\}/, 'the trailing words drop once the list is open (/marketing)');
    });
  }
  it('the words (/marketing 2026-11-09)', () => {
    assert.equal(W.coachFeeDoor, 'Record a bank fee');
    assert.equal(W.coachInterestDoor, 'Record interest');
    assert.equal(W.feeDoor, 'Add a bank fee');
    assert.equal(W.interestDoor, 'Add interest');
    assert.equal(`${W.noLineOnItsOwn('$4.50')} ${W.showTheLines(31)} ${W.toMarkAny}`,
      'No line matches $4.50 on its own. Show the 31 lines to mark any the bank hasn’t received yet.');
    assert.equal(W.showTheLines(1), 'Show the line');
    assert.equal(W.hideTheLines(31), 'Hide the 31 lines');
    assert.equal(W.hideTheLines(1), 'Hide the line');
    assert.equal(W.coachOffPlanNote, 'Not in your budget yet, so it shows as off-plan on Budget vs. Actual.');
  });
  it('the counts: the coach\'s this season\'s and last season\'s lines; the club\'s lines, on-the-way row and look-back', () => {
    assert.match(readCode(COACH_FIND), /const listCount = suspects\.lines\.length \+ lastCount;/);
    assert.match(readCode(CLUB_FIND), /const listCount = lines\.length \+ \(onWay\.length > 0 \? 1 : 0\) \+ before\.length;/);
  });
  it('D4: the coach\'s phone callout stacks its buttons full width, 44px (the club\'s shipped rule)', () => {
    assert.match(readCode('components/coaches/bank/CoachBank.module.css'),
      /@media \(max-width: 768px\) \{[\s\S]*?\.calloutActs \{ display: flex; flex-direction: column; align-items: stretch; flex: 1 1 100%; \}\s*\.calloutActs > button \{ width: 100%; min-height: var\(--tap-min, 44px\); justify-content: center; \}/);
  });
  it('a door passes its name; the plain doors pass none (a click event is never read as a door)', () => {
    for (const f of [COACH_FIND, CLUB_FIND]) {
      const src = readCode(f);
      assert.match(src, /onClick=\{\(\) => onAddLine\(door\)\}/);
      // Find's own buttons wrap it; the hint callout is handed a no-argument door.
      assert.doesNotMatch(between(src, 'export default function', 'function HintCallout'), /onClick=\{onAddLine\}/);
      assert.match(src, /onAddLine=\{(onAddLine \? )?\(\) => onAddLine\(\)( : undefined)?\}/);
    }
  });
});

describe('S3 · the windows the doors open (A5, D3, ruling 6)', () => {
  it('coach: the description, the word (resolved late, platform-only) and the door ride the intent; nothing else changes', () => {
    const panel = readCode(PANEL);
    assert.match(panel, /const \{ receivedDate, paidDate, method, note, description, word, bankDoor: door \} = intent\.prefill;/);
    assert.match(panel, /\.\.\.\(description !== undefined \? \{ description \} : \{\}\),/);
    assert.match(panel, /if \(word\) setPendingWord\(word\);\s*if \(door\) setBankDoor\(door\);/);
    // Late: chosen when the list lands, into the baseline too; a word the team can't see is dropped.
    assert.match(panel, /if \(pendingWord && categories\.length > 0\) \{\s*const hit = findPlatformWord\(categories, pendingWord\);\s*setPendingWord\(null\);\s*if \(hit\) \{/);
    assert.match(panel, /setFormOpenedWith\(f => \(\{ \.\.\.f, \.\.\.seed \}\)\);\s*\}\s*\}/);
    // The adjustment reads the form's state, so it must sit below its declarations (a TDZ crash otherwise).
    assert.ok(panel.indexOf('if (pendingWord && categories.length > 0)') > panel.indexOf('const [formOpenedWith, setFormOpenedWith]'));
    const reset = functionBody(panel, 'resetForm');
    assert.match(reset, /setBankDoor\(null\);/);
    assert.match(reset, /setPendingWord\(null\);/);
  });
  it('coach, ruling 6: the plain note only with the bank door; every other opener keeps the amber warning', () => {
    const panel = readCode(PANEL);
    assert.match(panel, /\{unplanned && bankDoor && <p className=\{styles\.formHint\}[^>]*>\{BANK_WORDS\.coachOffPlanNote\}<\/p>\}/);
    assert.match(panel, /\{unplanned && !bankDoor && fieldWarning\(/);
    assert.match(panel, /footerAbove=\{bankDoor && !confirmDelete \? doorFootLine\(bankDoor\) : undefined\}/);
  });
  it('club: Add an entry takes the description, the word (resolved when the list lands) and the footer line', () => {
    const lw = readCode(LEDGER_WINDOWS);
    assert.match(lw, /const \[what, setWhat\] = useState\(prefill\?\.description \?\? ''\);/);
    assert.match(lw, /if \(wordWanted && words !== null\) \{\s*setWordWanted\(null\);\s*const hit = findPlatformWord\(words, wordWanted\);/);
    assert.match(lw, /footerAbove=\{prefill\?\.footLine\}/);
    // Changing Money in / out still clears the word, as it always has.
    assert.match(lw, /onChange=\{v => \{ setEntryType\(v\); setWord\(null\); \}\}/);
    assert.match(readCode(CLUB_FORM), /\.\.\.\(door \? \{ \.\.\.doorFill\('club', door\), footLine: doorFootLine\(door\) \} : \{\}\),/);
  });
  it('the foot line is the shared window\'s own slot, its first row, gone while the foot asks', () => {
    const kd = readCode('components/shared/KitDialog.tsx');
    assert.match(kd, /\{footerAbove != null && !asking && <p className=\{styles\.footAbove\}>\{footerAbove\}<\/p>\}/);
    assert.match(readCode('components/coaches/QuestionShell.tsx'), /footerAbove=\{footerAbove\}/);
  });
  it('no tax and Posted stay the windows\' own defaults (the doors set neither)', () => {
    assert.doesNotMatch(readCode('lib/bank-gap-doors.ts'), /\btax|status|pending/i);
    assert.match(readCode(LEDGER_WINDOWS), /useState<'posted' \| 'pending'>\('posted'\)/);
  });
});
