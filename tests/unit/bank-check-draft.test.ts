/**
 * THE BANK CHECK'S WORK (WD1 + WD2, kept on our servers by S7 Part 2; plans docs/projects/active/BANK_CHECK_WORKING_DRAFT_PLAN.md
 * and BANK_CHECK_NOVICE_UX_PLAN.md §0 A18 rulings 1–9, 2026-11-22). The pure helpers first (the canonical text of a piece
 * of work, the legacy-key sweep, marks validated against what the books offer, "Started off by"), then the guards: the one
 * hook is the only code that calls the `/work` route and sends keys, never figures; the club card and the coach card wire it
 * as ruled (nothing kept before Start, "Check this statement again" with other work saved opens Change, figures never
 * restored, Save settles then forgets only once the check saved, Start over asks only when lines are marked, focus re-reads,
 * "+ Add entry" / "+ Record" once started); sign-out clears only the old browser copies, never the work.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as helpers from '../../lib/bank-check-draft.ts';
import {
  LEGACY_DRAFT_PREFIX, anchorStarted, clearLegacyDrafts, itemOfLine, keepOffered, offeredItems, startedOffCents,
} from '../../lib/bank-check-draft.ts';
import { seedOfWork, workOfSaved, workText, type CheckWork, type SavedWork } from '../../lib/bank-check-work.ts';
import type { BankLine, WaitingItem } from '../../lib/bank-check.ts';
import { BANK_WORDS as W } from '../../lib/bank-tab-words.ts';
import { filesUnder, functionBody, readCode } from './_source-code.ts';

const HOOK = 'lib/hooks/useBankCheckWork.ts';

/** `workText` and `workOfSaved`: pure, beside the shape they read (lib/bank-check-work.ts); the hook imports them. */
async function loadWorkHelpers(): Promise<{ workText: (w: CheckWork) => string; workOfSaved: (s: SavedWork) => CheckWork }> {
  return { workText, workOfSaved };
}

type LegacyStore = Pick<Storage, 'length' | 'key' | 'removeItem'>;
function memoryStore(initial: Record<string, string>): LegacyStore & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    map,
    removeItem: k => { map.delete(k); },
    get length() { return map.size; },
    key: i => [...map.keys()][i] ?? null,
  };
}
/** Storage that refuses everything (a private window, blocked site data). */
const throwingStore: LegacyStore = {
  removeItem: () => { throw new Error('blocked'); },
  get length(): number { throw new Error('blocked'); },
  key: () => { throw new Error('blocked'); },
};

const SAVED: SavedWork = {
  date: '2026-10-31', balance: '5402.10', marked: ['entry:a', 'entry:b'],
  started: { date: '2026-10-31', balance: '5402.10', differenceCents: 41200 },
  revision: 3, changedOn: '2026-11-20', endsOn: '2026-12-20',
};

describe('1 · one canonical text per piece of work (the hook\'s workText)', () => {
  it('the keys always come in one order, whatever order the card built them in', async () => {
    const { workText } = await loadWorkHelpers();
    const scrambled = { started: null, marked: ['entry:a'], balance: '5402.10', date: '2026-10-31' } as CheckWork;
    assert.equal(workText(scrambled), '{"date":"2026-10-31","balance":"5402.10","marked":["entry:a"],"started":null}');
    assert.deepEqual(Object.keys(JSON.parse(workText({ ...scrambled, cash: '120.00' }))), ['date', 'balance', 'cash', 'marked', 'started']);
  });
  it('the coach\'s cash is in the text only when something is typed; blank is no cash, as the server reads it', async () => {
    const { workText } = await loadWorkHelpers();
    const base: CheckWork = { date: '2026-10-31', balance: '5402.10', marked: [], started: null };
    assert.equal(workText({ ...base, cash: '' }), workText(base));
    assert.equal(workText({ ...base, cash: '   ' }), workText(base));
    assert.equal('cash' in JSON.parse(workText({ ...base, cash: '' })), false);
    assert.equal(JSON.parse(workText({ ...base, cash: '120.00' })).cash, '120.00');
  });
  it('keys, never figures: the text carries the date, the balance, the cash, the marks\' keys and the anchor, and nothing else', async () => {
    const { workText } = await loadWorkHelpers();
    const loud = { ...SAVED, cash: '40', amountCents: 123, booksCents: 5, label: 'x', started: { ...SAVED.started!, extra: 1 } } as unknown as CheckWork;
    const got = JSON.parse(workText(loud));
    assert.deepEqual(Object.keys(got), ['date', 'balance', 'cash', 'marked', 'started']);
    assert.deepEqual(Object.keys(got.started), ['date', 'balance', 'differenceCents']);
    assert.ok(got.marked.every((k: unknown) => typeof k === 'string'), 'a mark is its key');
  });
  it('the order the lines were marked in is part of the work', async () => {
    const { workText } = await loadWorkHelpers();
    const base: CheckWork = { date: '2026-10-31', balance: '1', marked: ['entry:a', 'entry:b'], started: null };
    assert.notEqual(workText(base), workText({ ...base, marked: ['entry:b', 'entry:a'] }));
  });
});

describe('2 · opening the card on saved work keeps nothing (workOfSaved compares equal)', () => {
  it('the saved work, as the card would send it, has the same text as the card\'s own work for it', async () => {
    const { workText, workOfSaved } = await loadWorkHelpers();
    const card: CheckWork = { date: SAVED.date, balance: SAVED.balance, marked: [...SAVED.marked], started: { ...SAVED.started! } };
    assert.equal(workText(workOfSaved(SAVED)), workText(card));
    const withCash = { ...SAVED, cash: '120.00' };
    assert.equal(workText(workOfSaved(withCash)), workText({ ...card, cash: '120.00' }));
  });
  it('the server\'s own fields (revision, the days) are not part of the work, an empty cash is none, and the marks are a copy', async () => {
    const { workOfSaved } = await loadWorkHelpers();
    const work = workOfSaved({ ...SAVED, cash: '' });
    assert.deepEqual(Object.keys(work).sort(), ['balance', 'date', 'marked', 'started']);
    assert.notEqual(work.marked, SAVED.marked, 'the card never edits the read\'s own array');
  });
});

describe('2b · how a card opens (seedOfWork, the one seeding rule both cards use)', () => {
  it('no saved work: before Start, on the opening day, empty; the handed day is never a swap', () => {
    const seed = seedOfWork(null, '2026-11-07', '2026-10-31');
    assert.deepEqual(seed, { working: false, date: '2026-11-07', balance: '', cash: '', started: null, marks: [], answeredNo: [], changedOn: null, swapTo: null });
  });
  it('saved work: straight into it, with its marks waiting for the figure and the day it was last worked on', () => {
    const seed = seedOfWork({ ...SAVED, cash: '120.00' }, '2026-11-07');
    assert.equal(seed.working, true);
    assert.deepEqual([seed.date, seed.balance, seed.cash, seed.changedOn, seed.swapTo], ['2026-10-31', '5402.10', '120.00', '2026-11-20', null]);
    assert.deepEqual(seed.marks, ['entry:a', 'entry:b']);
  });
  it('"Check this statement again" on ANOTHER day opens Change on it; on the saved day it is no swap', () => {
    assert.equal(seedOfWork(SAVED, '2026-11-07', '2026-09-30').swapTo, '2026-09-30');
    assert.equal(seedOfWork(SAVED, '2026-11-07', SAVED.date).swapTo, null);
    assert.equal(seedOfWork(SAVED, '2026-11-07').swapTo, null);
  });
});

describe('3 · the pre-S7 browser copies are only ever deleted', () => {
  it('removes every key under the old prefix and nothing else (also three in a row)', () => {
    assert.equal(LEGACY_DRAFT_PREFIX, 'fieldlogic:bank-check-draft:v1:');
    const s = memoryStore({
      [`${LEGACY_DRAFT_PREFIX}riverdale:acct-1:sam`]: '{}',
      [`${LEGACY_DRAFT_PREFIX}riverdale:acct-1:alex`]: '{}',
      [`${LEGACY_DRAFT_PREFIX}other:acct-9:sam`]: '{}',
      'flhq.console.recent.v1': '[]',
      'club-money-year:riverdale': '2026-04-01',
      'fieldlogic:bank-check-draft:v2:x': 'a later version is not ours to delete',
    });
    clearLegacyDrafts(s);
    assert.deepEqual([...s.map.keys()].sort(), ['club-money-year:riverdale', 'fieldlogic:bank-check-draft:v2:x', 'flhq.console.recent.v1']);
  });
  it('blocked storage, no storage and no window each just mean nothing to clear', () => {
    assert.doesNotThrow(() => clearLegacyDrafts(throwingStore));
    assert.doesNotThrow(() => clearLegacyDrafts(null));
    assert.doesNotThrow(() => clearLegacyDrafts(), 'no window here: the default store is none');
  });
});

describe('4 · the browser store is gone from the helper', () => {
  it('no store, key, read, write, sweep or idle rule is exported; the pure helpers are', () => {
    for (const gone of ['DraftStore', 'draftKey', 'browserDraftStore', 'readDraft', 'writeDraft', 'canKeepDrafts', 'clearDraft', 'clearAllDrafts',
      'sweepIdleDrafts', 'isWorthKeeping', 'DRAFT_IDLE_DAYS', 'DRAFT_PREFIX']) {
      assert.equal(gone in helpers, false, `${gone} is retired (S7 moved the work to the server)`);
    }
    for (const kept of ['anchorStarted', 'startedOffCents', 'itemOfLine', 'offeredItems', 'keepOffered', 'clearLegacyDrafts', 'LEGACY_DRAFT_PREFIX']) {
      assert.equal(kept in helpers, true, kept);
    }
  });
});

describe('6 · marks are validated against what the books offer now', () => {
  const line = (key: string, amountCents: number, direction: 'in' | 'out' = 'out'): BankLine =>
    ({ key, date: '2026-10-20', direction, amountCents, label: `Line ${key}` });
  const still: WaitingItem = { key: 'entry:old', date: '2026-09-28', direction: 'out', amountCents: 9000 };
  const figure = {
    suspects: { lines: [line('entry:a', 22500), line('entry:b', 18700), line('entry:pay', 5000, 'in')] },
    stillWaiting: [still],
    onItsWay: { state: 'counted', lines: [{ key: 'entry:pay' }] },
  };
  it('a line Find lists and a Still-waiting item are offered; an online payment on its way is not', () => {
    const offered = offeredItems(figure);
    assert.deepEqual([...offered.keys()].sort(), ['entry:a', 'entry:b', 'entry:old']);
    assert.equal(offeredItems({ ...figure, onItsWay: { state: 'not_counted' } }).has('entry:pay'), true,
      'not counted, so Find lists it like any line');
  });
  it('the coach\'s figure: no online payments (no onItsWay), and last season\'s lines Find lists are offered too', () => {
    const coach = { suspects: { lines: [line('entry:a', 22500)] }, lastSeason: { lines: [line('entry:x', 4000), line('entry:a', 22500)] }, stillWaiting: [still] };
    assert.deepEqual([...offeredItems(coach).keys()], ['entry:a', 'entry:x', 'entry:old'], 'a cheque across the rollover stays marked');
    assert.deepEqual([...offeredItems({ ...coach, lastSeason: null }).keys()], ['entry:a', 'entry:old']);
  });
  it('a line becomes an item with its own key, figures and words (Find marks with the same helper)', () => {
    assert.deepEqual(itemOfLine(line('entry:a', 22500)), { key: 'entry:a', date: '2026-10-20', direction: 'out', amountCents: 22500, label: 'Line entry:a' });
    assert.equal('label' in itemOfLine({ key: 'k', date: '2026-10-20', direction: 'in', amountCents: 1 }), false, 'no words, no label key');
  });
  it('a mark comes back with the books\' amount NOW,in the order marked; one the books dropped is counted, not kept', () => {
    const offered = offeredItems({ ...figure, suspects: { lines: [line('entry:a', 23000), line('entry:b', 18700)] } });
    const { kept, dropped } = keepOffered(['entry:b', 'entry:gone', 'entry:a', 'entry:pay'], offered);
    assert.deepEqual(kept.map(w => w.key), ['entry:b', 'entry:a']);
    assert.equal(kept[1].amountCents, 23000, 'the remembered figure is never restored');
    assert.equal(dropped, 2);
  });
  it('the callout says one line, or how many', () => {
    assert.equal(W.draftDropped(1), 'One line you marked isn’t in your books any more, so we took it off.');
    assert.equal(W.draftDropped(3), '3 lines you marked aren’t in your books any more, so we took them off.');
  });
});

describe('7 · "Started off by" (ask 2 = A)', () => {
  const where = { date: '2026-10-31', balance: '5402.10' };
  it('anchors when the balance is typed and keeps while the work moves the number', () => {
    const a = anchorStarted(null, where, 41200);
    assert.deepEqual(a, { ...where, differenceCents: 41200 });
    assert.equal(anchorStarted(a, where, 18700), a, 'a line added or marked is the work: the anchor stays');
    assert.equal(startedOffCents(a, 18700), 41200);
    assert.equal(startedOffCents(a, 0), 41200, 'at Matches it still says where it began (drawing tab 2, moment 3)');
    assert.equal(startedOffCents(a, -5000), 41200, 'overshooting zero');
  });
  it('resets on a new date, and on a new balance (typing passes through every keystroke)', () => {
    const a = anchorStarted(null, where, 41200);
    assert.deepEqual(anchorStarted(a, { ...where, date: '2026-11-30' }, 9900), { date: '2026-11-30', balance: '5402.10', differenceCents: 9900 });
    assert.equal(anchorStarted(a, { ...where, date: '2026-11-30' }, null), null, 'a new date with no figure yet: no anchor');
    assert.deepEqual(anchorStarted(a, { ...where, balance: '5412.10' }, 42200), { date: where.date, balance: '5412.10', differenceCents: 42200 });
  });
  it('hidden while it equals the live figure, when it started at a match, and with no live figure', () => {
    const a = anchorStarted(null, where, 41200);
    assert.equal(startedOffCents(a, 41200), null);
    assert.equal(startedOffCents(anchorStarted(null, where, 0), 3000), null);
    assert.equal(startedOffCents(a, null), null);
    assert.equal(startedOffCents(null, 100), null);
    assert.equal(startedOffCents({ ...where, differenceCents: 41200 }, -41200), 41200, 'the same amount the other way has moved');
  });
});

// ── the guards ────────────────────────────────────────────────────────────────────────────────────────────────────────
const HELPER = 'lib/bank-check-draft.ts';
const FORM = 'components/admin/kit/club/money/bank/BankCheckForm.tsx';
const TAB = 'components/admin/kit/club/money/bank/BankTab.tsx';
const COACH = 'components/coaches/bank/CoachBankCheck.tsx';
const COACH_VIEW = 'components/coaches/bank/CoachBankView.tsx';
const COACH_FIND = 'components/coaches/bank/CoachBankFind.tsx';
const LEDGER = 'app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx';
const BANK_DIRS = ['components/admin/kit/club/money/bank', 'components/coaches/bank'];
const bankFiles = () => BANK_DIRS.flatMap(d => [...filesUnder(d, '.tsx'), ...filesUnder(d, '.ts')]).map(f => f.replace(/\\/g, '/'));

describe('8 · the work reaches our servers through ONE hook, keys only; the cards touch no browser storage', () => {
  const hook = readCode(HOOK);
  it('the hook is the only code that calls a work route (GET, PUT, DELETE); the cards hand it their URL and fetch nothing', () => {
    assert.match(hook, /moneyFetch<[^>]*>\(url\)\.catch/, 'the read');
    assert.match(hook, /jsonInit\('PUT', \{ work: JSON\.parse\(text\) as CheckWork, revision: revision\.current \}\)/, 'the PUT is the keys\' text and the revision it read');
    assert.match(hook, /moneyFetch<[^>]*>\(url, \{ method: 'DELETE' \}\)/);
    const users = bankFiles().filter(f => /\buseBankCheckWork\(/.test(readCode(f)));
    assert.deepEqual(users.sort(), [COACH, FORM].sort(), 'the two cards, and nothing else, call the hook');
    for (const f of [FORM, COACH]) {
      assert.doesNotMatch(readCode(f), /\bfetch\(|moneyFetch|method:\s*['"](PUT|DELETE|GET)/, `${f}: the card never calls the work route itself`);
    }
    assert.match(readCode(FORM), /useBankCheckWork\(bankUrl\(props\.orgSlug, `\/accounts\/\$\{props\.view\.account\.id\}\/work`\), W\.workKeepFailed\)/);
    assert.match(readCode(COACH), /useBankCheckWork\(coachBankUrl\(props\.orgSlug, props\.teamId, '\/work'\), W\.workKeepFailed\)/);
    // No other bank file names a work route (the club's tab and the coach's view only receive what the hook read).
    for (const f of bankFiles()) {
      if (f === FORM || f === COACH) continue;
      assert.doesNotMatch(readCode(f), /\/work['`"]/, `${f} names a work route`);
    }
  });
  it('the hook sends keys, never figures: the body is workText\'s text and nothing from the books', () => {
    assert.match(hook, /jsonInit\('PUT', \{ work: JSON\.parse\(text\) as CheckWork, revision: revision\.current \}\)/);
    assert.doesNotMatch(hook, /\bkeep\(work\b/, 'the cards hand `keep` workText\'s text; only Start and Save for later (keepNow) hand over a work');
    assert.doesNotMatch(hook, /amountCents|booksCents|figure|WaitingItem|offeredItems/, 'the hook knows no figure');
    // What each card builds as its work: the date, the balance, (the coach's cash,) the marks' keys, the anchor.
    assert.match(readCode(FORM), /const current: CheckWork = \{ date, balance, marked: pending \?\? \[\.\.\.marked\.keys\(\)\], \.\.\.\(dropped\.size \? \{ answeredNo: \[\.\.\.dropped\] \} : \{\}\), started: anchor \};/);
    assert.match(readCode(COACH), /const current: CheckWork = \{ date, balance, \.\.\.\(cash\.trim\(\) \? \{ cash \} : \{\}\), marked: pending \?\? \[\.\.\.marked\.keys\(\)\], \.\.\.\(dropped\.size \? \{ answeredNo: \[\.\.\.dropped\] \} : \{\}\), started: anchor \};/);
  });
  it('kept as you go, one at a time, and a leaving page sends what waits (keepalive); nothing polls', () => {
    assert.match(hook, /const KEEP_PAUSE_MS = 600;/);
    assert.match(hook, /document\.addEventListener\('visibilitychange', away\);/);
    assert.match(hook, /window\.addEventListener\('pagehide', closing\);/);
    assert.match(hook, /\.\.\.\(keepalive \? \{ keepalive: true \} : \{\}\)/);
    assert.match(hook, /onTheWay\.set\(url, go\);/, 'the next read waits for a keep still on its way');
    assert.match(hook, /await onTheWay\.get\(url\)\?\.catch\(\(\) => undefined\);/);
    assert.match(hook, /r\.data\.code === 'work_changed'/, 'another device\'s newer work is read again, never re-sent');
    assert.doesNotMatch(hook, /setInterval/);
  });
  it('the helper has no network, no route and no server import; its one browser touch is deleting the old keys', () => {
    const src = readCode(HELPER);
    assert.doesNotMatch(src, /\bfetch\(|bankUrl|bankWrite|moneyFetch|readFigure|\/api\/|supabase|import (?!type)[^;]*from '\.\/(db|supabase)/);
    assert.doesNotMatch(src, /sessionStorage|document\.cookie|indexedDB/);
    assert.match(src, /window\.localStorage/);
    assert.doesNotMatch(src, /\.setItem\(|\.getItem\(/, 'nothing is read or written there any more: only removed');
    assert.match(src, /^import type \{ BankLine, WaitingItem \} from '\.\/bank-check';$/m, 'its one import is a type');
  });
  it('no card, tab or hook touches browser storage; the hook sweeps the old keys as a card opens', () => {
    for (const f of [FORM, COACH, TAB, COACH_VIEW, HOOK]) assert.doesNotMatch(readCode(f), /localStorage|sessionStorage|indexedDB/, f);
    // The hook's mount effect sweeps the old keys (both cards use it); neither card calls the sweep itself.
    assert.match(hook, /live\.current = true;\s*clearLegacyDrafts\(\);/);
    for (const f of [FORM, COACH]) assert.doesNotMatch(readCode(f), /clearLegacyDrafts/, f);
  });
});

describe('9 · the club card wires it as ruled (S7)', () => {
  const form = readCode(FORM);
  const tab = readCode(TAB);
  it('the card opens on the person\'s read, again after another device\'s keep; no person key anywhere', () => {
    // The wrapper draws the loading card itself; the card mounts only after the read, keyed on the seed (again after another device's keep).
    assert.match(form, /if \(work\.read === 'loading'\) \{\s*return \(\s*<section className=\{s\.checkCard\} aria-labelledby="bank-check-title" aria-busy="true">/);
    assert.match(form, /return <CheckCard key=\{`seed-\$\{work\.seed\}`\} \{\.\.\.props\} work=\{work\} \/>;/);
    assert.doesNotMatch(form + tab, /personId|useOrg\(\)/, 'the work follows the person on the server: the form is not keyed on them');
    assert.match(tab, /<BankCheckForm key=\{again\?\.n \?\? 0\} againDate=\{again\?\.date\}/);
    assert.match(tab, /onNotice=\{text => setNotice\(\{ tone: 'good', text \}\)\} onElsewhere=\{setElsewhere\}/);
    assert.match(tab, /W\.workElsewhere\(/, 'the Account pill names the other account holding the person\'s work');
  });
  it('nothing is kept before Start: the keep effect is guarded by `working`, and Start is the first keep', () => {
    assert.match(form, /useEffect\(\(\) => \{ if \(working\) keep\(currentText\); \}, \[working, currentText, keep\]\);/);
    assert.equal((form.match(/\bkeep\(/g) ?? []).length, 1, 'the one call of keep is the guarded one');
    assert.match(functionBody(form, 'start'), /const r = await work\.keepNow\(current\);\s*setBusy\(null\);\s*if \(r\.ok\) \{ setWorking\(true\); setAsOf\(date\); \} else if \(r\.error !== null\) setError\(r\.error\);/);
    assert.match(form, /\{busy === 'start' \? W\.saving : W\.startChecking\}/);
    // Before Start: no band, no sums, no Find, no foot (they are the working branch's, below its own return).
    const before = form.slice(form.indexOf('if (!working) {'), form.indexOf('const off = '));
    assert.doesNotMatch(before, /BankBand|BankSums|BankFind|saveCheck|saveForLater/);
  });
  it('"Check this statement again" with other work saved opens Change on that day, never a silent swap; just started never discards saved work', () => {
    assert.match(form, /const \[seed\] = useState\(\(\) => seedOfWork\(afterStart \? null : work\.mine, afterStart \? '' : againDate \?\? today, againDate\)\);/,
      'just started opens before Start on the empty date and never reads the saved work; otherwise the handed day, or today');
    assert.match(form, /useState<\{ date: string; balance: string \} \| null>\(seed\.swapTo \? \{ date: seed\.swapTo, balance: '' \} : null\);/,
      'other work saved + another date: Change opens on that date, never a silent swap');
    assert.doesNotMatch(form, /function seedOf\(/, 'one seeding rule, in lib/bank-check-work.ts');
    assert.equal((form.match(/work\.startOver\(\)/g) ?? []).length, 1, 'the work goes only through Start over, which the person asks for');
    assert.match(form, /\{afterStart && <p id=\{AFTER_START_ID\} className=\{`\$\{s\.statusNote\} \$\{s\.afterStart\}`\} role="status">\{W\.afterStart\(dayYear\(afterStart\)\)\}<\/p>\}/);
  });
  it('Change: a new balance keeps every mark, a new date says so first, then clears them; the work waits, inert', () => {
    const use = functionBody(form, 'useThese');
    assert.match(use, /if \(edit\.date !== date\) \{ newDay\(edit\.date\); setAsOf\(edit\.date\); \}\s*setBalance\(edit\.balance\); setEdit\(null\); touch\(\);/);
    assert.match(form, /\{dateChanges && markCount > 0 && <p className=\{s\.warnLine\} role="status">\{W\.changeClears\(markCount, false\)\}<\/p>\}/);
    assert.match(form, /const dateChanges = !!edit && edit\.date !== date;/);
    assert.match(form, /<div className=\{edit \? s\.waiting : undefined\} inert=\{!!edit\}>/);
    assert.match(form, /onClick=\{useThese\} disabled=\{!ISO_DAY\.test\(edit\.date\)\}>\{W\.changeUse\}/);
  });
  it('figures are never restored: the band waits for the day, and marks come back only as the day offers them', () => {
    assert.match(form, /!figure\.refused && pending === null \? figure : null/);
    // Each new figure for this day checks the marks again, before the band can draw (adjusted while rendering).
    assert.match(form, /if \(figure && figure !== checkedFor && figure\.date === date && !figure\.refused\) \{\s*setCheckedFor\(figure\);\s*const keys = pending \?\? \[\.\.\.marked\.keys\(\)\];/);
    assert.match(form, /keepOffered\(keys, offeredItems\(figure\)\)/);
    assert.match(form, /if \(gone > 0\) setDroppedMarks\(gone\);/);
    assert.match(form, /const \[pending, setPending\] = useState<string\[\] \| null>\(seed\.marks\.length \? seed\.marks : null\);/);
    assert.match(form, /marked: pending \?\? \[\.\.\.marked\.keys\(\)\]/, 'marks still waiting on the figure are kept as they came');
    assert.match(form, /<Callout tone="warn" role="status" flush>\{W\.draftDropped\(droppedMarks\)\}<\/Callout>/);
  });
  it('the resting sentence is the server\'s promise; a failed keep says so in its place, with Try again', () => {
    assert.match(form, /\{work\.keepFailed\s*\? <>\{W\.workKeepFailed\}\{' '\}<button type="button" className=\{s\.link\} onClick=\{\(\) => void work\.flush\(\)\}>\{W\.tryAgain\}<\/button><\/>\s*: W\.workKept\}/);
    assert.doesNotMatch(form, /draftKept|hasDraft|canKeep\b/, 'no browser-storage promise is left on the card');
  });
  it('Save settles what waits, then saves the check, and forgets the work only once the check saved; a refusal keeps it', () => {
    const save = functionBody(form, 'save');
    assert.ok(save.indexOf('await work.flush()') > 0 && save.indexOf('await work.flush()') < save.indexOf('bankWrite('), 'what waits is sent and landed BEFORE the check is posted');
    assert.ok(save.indexOf('work.forget()') > save.indexOf('if (!r.ok)'), 'after the refusal branch returns');
    assert.ok(save.indexOf('work.forget()') > save.indexOf('onSaved('), 'after the page took the saved check');
    assert.match(save, /work\.forget\(\);\s*reset\(\);/);
    assert.doesNotMatch(save, /work\.startOver|DELETE/, 'the server takes the work with the check; the card never deletes it itself');
  });
  it('Start over is in the foot and asks in one line only when lines are marked; a failure says the check is still here', () => {
    assert.match(form, /const markCount = pending\?\.length \?\? marked\.size;/);
    assert.match(form, /const askStartOver = \(\) => \{ if \(markCount > 0\) setAskOver\(true\); else void startOver\(\); \};/);
    assert.match(form, /onClick=\{askStartOver\} disabled=\{!!busy\}>\{W\.startOver\}<\/button>/);
    assert.match(form, /<span>\{W\.startOverAsk\(markCount, false\)\}<\/span>/);
    assert.match(form, /onClick=\{\(\) => setAskOver\(false\)\}>\{W\.keepWorking\}<\/button>/);
    const over = functionBody(form, 'startOver');
    assert.match(over, /const r = await work\.startOver\(\);\s*setBusy\(null\);\s*if \(!r\.ok\) \{ setAskOver\(false\); setError\(W\.startOverFailed\); return; \}\s*reset\(\);/);
    assert.doesNotMatch(over, /touch\(\)/);
  });
  it('Save for later keeps what is on the card now and says the end date; the work\'s own end shows in the last 7 days', () => {
    assert.match(functionBody(form, 'saveForLater'), /const r = await work\.keepNow\(current\);[\s\S]*onNotice\(W\.savedForLater\(dayYear\(r\.endsOn\)\)\)[\s\S]*else if \(!r\.ok && r\.error !== null\) setError\(W\.saveForLaterFailed\)/,
      'another device\'s newer work (error null) says nothing here: the hook reads again');
    assert.match(form, /const endsSoonOn = working && work\.endsOn && inLastWeek\(work\.endsOn, today\) \? work\.endsOn : null;/);
    assert.match(form, /\{endsSoonOn && <span className=\{s\.endsSoon\}>\{W\.workEndsSoon\(dayYear\(endsSoonOn\)\)\}<\/span>\}/);
  });
  it('the restore line names an earlier day through the shipped date helper; a colleague\'s line is three facts and never the work', () => {
    assert.match(form, /restoredOn < today \? W\.draftPickedUpOn\(dayYear\(restoredOn\)\) : W\.draftPickedUp/);
    assert.match(form, /<b>\{W\.colleagueWho\(c\.name\)\}<\/b>\{W\.colleagueWork\(dayYear\(c\.date\), dayShort\(c\.changedOn\)\)\}/);
    assert.doesNotMatch(functionBody(form, 'ColleagueLine'), /balance|marked|cash|started/);
  });
  it('coming back to the browser tab reads the day again, debounced, and nothing polls', () => {
    assert.match(form, /window\.addEventListener\('focus', soon\);/);
    assert.match(form, /document\.addEventListener\('visibilitychange', soon\);/);
    assert.match(form, /window\.setTimeout\(\(\) => setAgain\(n => n \+ 1\), DEBOUNCE_MS\)/);
    assert.doesNotMatch(form, /setInterval/);
  });
  it('"+ Add entry" opens the Ledger\'s own window blank, only once started and not during Change: the check\'s date, Money after the gap, no amount', () => {
    const add = form.slice(form.indexOf('const addEntry = '), form.indexOf('const addEntry = ') + 300);
    assert.match(add, /setAdding\(\{\s*date,/);
    assert.doesNotMatch(add, /amount/);
    assert.match(form, /<button type="button" className=\{`btn btn-outline \$\{s\.addEntry\}`\} onClick=\{onAdd\} disabled=\{!onAdd\}>\s*<Plus size=\{15\} aria-hidden \/>\{W\.addEntry\}/);
    assert.match(form, /const head = <CardHead onAdd=\{canAdd \? addEntry : undefined\} \/>;/, 'off until started, the day read, and not during Change');
    assert.match(form, /const canAdd = working && !edit && !!fresh && fresh\.booksCents !== null && !!ownBook && !busy;/);
  });
});

describe('10 · sign-out clears the old browser copies, never the work', () => {
  it('the sign-out wrapper sweeps the legacy keys beside the support console\'s Recent', () => {
    const auth = readCode('lib/auth.ts');
    assert.match(functionBody(auth, 'signOut'), /clearConsoleRecent\(\);\s*clearLegacyDrafts\(\);/);
    assert.match(auth, /import \{ clearLegacyDrafts \} from '\.\/bank-check-draft';/);
  });
  it('the work follows the person: sign-out calls no work route and no store sweep', () => {
    const auth = readCode('lib/auth.ts');
    assert.doesNotMatch(functionBody(auth, 'signOut'), /clearAllDrafts|browserDraftStore|\/work|bank-check-work|DELETE/);
    assert.doesNotMatch(auth, /clearAllDrafts|browserDraftStore/);
  });
});

describe('11 · the words (S7 settled with /marketing 2026-11-22; plan §4b)', () => {
  it('the settled strings: the club\'s "entry", the coach\'s "record" (WD2 renamed the coach\'s gap link)', () => {
    assert.equal(W.addEntry, 'Add entry');
    assert.equal(W.addMissingEntry, 'Add the missing entry');
    assert.equal(W.record, 'Record');
    assert.equal(W.recordMissingAmount, 'Record the missing amount');
    assert.equal('addMissing' in W, false, '"Add the missing line" is retired in both portals');
    assert.equal(W.draftPickedUpOn('Nov 5, 2026'), 'Picked up where you left off · last worked on Nov 5, 2026');
    assert.equal(W.startedOffBy('$412.00'), 'Started off by $412.00');
  });
  it('S7: the resting sentence is the server\'s promise, and the browser one is gone', () => {
    assert.equal(W.workKept, 'Kept as you go, on any device you sign in on, until you save this check.');
    assert.equal(W.workKeepFailed, 'Your latest changes aren’t kept yet.');
    assert.equal('draftKept' in W, false, '"Kept in this browser only…" promised what S7 no longer does');
    assert.equal(W.startChecking, 'Start checking this statement');
    assert.equal(W.saveForLater, 'Save for later');
    assert.equal(W.savedForLater('Dec 22, 2026'), 'Saved for later. Pick it up here, on any device you sign in on, until Dec 22, 2026.');
  });
  it('S7: Change and Start over say what a tap will do before it does it', () => {
    assert.equal(W.changeClears(1, false), 'A new date clears the 1 line you marked. Changing only the balance keeps it.');
    assert.equal(W.changeClears(2, true), 'A new date clears the 2 lines you marked. Changing only the balance or the cash keeps them.');
    assert.equal(W.startOverAsk(1, false), 'Start over? The 1 line you marked and the balance go.');
    assert.equal(W.startOverAsk(2, true), 'Start over? The 2 lines you marked, the balance and the cash go.');
    assert.equal(W.keepWorking, 'Keep working');
    assert.equal(W.startOverFailed, 'Start over didn’t go through. Your check is still here.');
  });
  it('S7: a colleague\'s line is who, which date and when it changed (an unknown name reads "Someone"); the 30 days end in warn ink', () => {
    // The name is its own key (the card bolds it); the rest follows it with a leading space.
    assert.equal(W.colleagueWho(null), 'Someone');
    assert.equal(W.colleagueWho('Sam'), 'Sam');
    assert.equal(W.colleagueWho(null) + W.colleagueWork('Oct 31, 2026', 'Nov 5'), 'Someone has a check of Oct 31, 2026 saved for later (Nov 5).');
    assert.equal(W.colleagueWho('Sam') + W.colleagueWork('Oct 31, 2026', 'Nov 5'), 'Sam has a check of Oct 31, 2026 saved for later (Nov 5).');
    assert.equal(W.workEndsSoon('Dec 22, 2026'), 'Kept until Dec 22, 2026. Any change, or Save for later, keeps it 30 more days.');
  });
  it('Find\'s "you haven\'t…" sentences: the club "entered" (its Ledger), the coach "recorded" (owner, WD3)', () => {
    assert.equal(W.hintOrMore('$40.00'), 'Or the bank received $40.00 your books don’t have: a deposit or interest you haven’t entered.');
    assert.equal(W.hintOrLess('$40.00', true), 'The bank took out $40.00 your books don’t have: a fee or a payment you haven’t entered.');
    assert.equal(W.hintHalf('$20.00', '$40.00'), 'is $20.00, half of the $40.00 gap. Was it entered the wrong way round?');
    // The coach card's one noun is "your Ledger" (Bank check novice UX S1, row 8).
    assert.equal(W.coachHintOrMore('$40.00'), 'Or the bank received $40.00 your Ledger doesn’t have: a deposit or interest you haven’t recorded.');
    assert.equal(W.coachHintOrLess('$40.00', true), 'The bank took out $40.00 your Ledger doesn’t have: a fee or a payment you haven’t recorded.');
    assert.equal(W.coachHintHalf('$20.00', '$40.00'), 'is $20.00, half of the $40.00 gap. Was it recorded the wrong way round?');
  });
  it('each portal\'s Find reads its own three, never the other\'s', () => {
    const club = readCode('components/admin/kit/club/money/bank/BankFind.tsx');
    const coach = readCode(COACH_FIND);
    for (const k of ['hintOrMore', 'hintOrLess', 'hintHalf']) {
      const coachKey = `coach${k[0].toUpperCase()}${k.slice(1)}`;
      assert.match(club, new RegExp(`W\\.${k}\\b`), `the club's Find reads ${k}`);
      assert.doesNotMatch(club, new RegExp(`W\\.${coachKey}\\b`), `the club's Find never reads ${coachKey}`);
      assert.match(coach, new RegExp(`W\\.${coachKey}\\b`), `the coach's Find reads ${coachKey}`);
      assert.doesNotMatch(coach, new RegExp(`W\\.${k}\\b`), `the coach's Find never reads the club's ${k}`);
    }
  });
});

describe('12 · the coach card wires it as the club card does (S7)', () => {
  const card = readCode(COACH);
  it('the card opens on the coach\'s read; the view is not keyed on the person; the card calls no storage or route itself', () => {
    assert.match(card, /if \(work\.read === 'loading'\) \{\s*return \(\s*<section className=\{b\.card\} aria-labelledby="coach-bank-check-title" aria-busy="true">/);
    assert.match(card, /return <CheckCard key=\{`seed-\$\{work\.seed\}`\} \{\.\.\.props\} work=\{work\} \/>;/);
    const view = readCode(COACH_VIEW);
    assert.doesNotMatch(card + view, /personId|useOrg\(\)/);
    assert.match(view, /<CoachBankCheck key=\{`\$\{teamId\}:\$\{again \? `again-\$\{again\.n\}` : 'check'\}`\}/);
    assert.doesNotMatch(card, /localStorage|sessionStorage|fetch\(/);
  });
  it('nothing is kept before Start: the keep effect is guarded by `working`; Start is the first keep', () => {
    assert.match(card, /useEffect\(\(\) => \{ if \(working\) keep\(currentText\); \}, \[working, currentText, keep\]\);/);
    assert.equal((card.match(/\bkeep\(/g) ?? []).length, 1);
    assert.match(functionBody(card, 'start'), /const r = await work\.keepNow\(current\);\s*setBusy\(null\);\s*if \(r\.ok\) \{ setWorking\(true\); setAsOf\(date\); \} else if \(r\.error !== null\) setError\(r\.error\);/);
    const before = card.slice(card.indexOf('if (!working) {'), card.indexOf('const off = '));
    assert.doesNotMatch(before, /MoneySummaryBand|CoachBankFind|saveCheck|saveForLater/);
  });
  it('"Check this statement again" with other work saved opens Change on that day (the cash with it), never a silent swap', () => {
    assert.match(card, /const \[seed\] = useState\(\(\) => seedOfWork\(work\.mine, againDate \?\? today, againDate\)\);/);
    assert.match(card, /useState<Edit \| null>\(seed\.swapTo \? \{ date: seed\.swapTo, balance: '', cash: seed\.cash, cashAsked: !!seed\.cash \} : null\);/);
    assert.doesNotMatch(card, /function seedOf\(/, 'one seeding rule, in lib/bank-check-work.ts');
    assert.equal((card.match(/work\.startOver\(\)/g) ?? []).length, 1);
  });
  it('keeps the cash with the work, and figures are never restored', () => {
    assert.match(card, /const \[cash, setCash\] = useState\(seed\.cash\);/);
    assert.match(card, /!figure\.refused && pending === null \? figure : null/);
    assert.match(card, /if \(figure && figure !== checkedFor && figure\.date === date && !figure\.refused\) \{\s*setCheckedFor\(figure\);\s*const keys = pending \?\? \[\.\.\.marked\.keys\(\)\];/);
    assert.match(card, /keepOffered\(keys, offeredItems\(figure\)\)/, 'the shared helper, on the coach\'s own figure, no cast');
    assert.match(card, /<p className=\{`\$\{b\.callout\} \$\{b\.droppedNote\}`\} role="status">\{W\.draftDropped\(droppedMarks\)\}<\/p>/);
    assert.match(card, /\{cashCents !== null && <><span className=\{b\.stripDot\} aria-hidden>·<\/span><span>\{W\.stripCash\} <b>\{cents\(cashCents\)\}<\/b><\/span><\/>\}/);
  });
  it('the resting sentence is one of the card\'s note line\'s sentences, replaced by the failed keep\'s when a keep failed', () => {
    assert.match(card, /\{work\.keepFailed\s*\? <>\{W\.workKeepFailed\}\{' '\}<button type="button" className=\{b\.link\} onClick=\{\(\) => void work\.flush\(\)\}>\{W\.tryAgain\}<\/button><\/>\s*: W\.workKept\}/);
    assert.doesNotMatch(card, /draftKept|hasDraft|canKeep\b/);
  });
  it('Save settles, saves, and forgets only once the check saved; Start over asks only when lines are marked and never touches the notice', () => {
    const save = functionBody(card, 'save');
    assert.ok(save.indexOf('await work.flush()') > 0 && save.indexOf('await work.flush()') < save.indexOf('saveTeamCheck('), 'what waits is sent and landed BEFORE the check is posted');
    assert.ok(save.indexOf('work.forget()') > save.indexOf('if (!r.ok)'), 'after the refusal branch returns');
    assert.ok(save.indexOf('work.forget()') > save.indexOf('onSaved('));
    assert.match(save, /work\.forget\(\);\s*reset\(\);/);
    assert.match(card, /const askStartOver = \(\) => \{ if \(markCount > 0\) setAskOver\(true\); else void startOver\(\); \};/);
    assert.match(card, /<span>\{W\.startOverAsk\(markCount, cashCents !== null\)\}<\/span>/);
    assert.match(functionBody(card, 'startOver'), /const r = await work\.startOver\(\);[\s\S]*setError\(W\.startOverFailed\);[\s\S]*reset\(\);/);
    assert.doesNotMatch(functionBody(card, 'startOver') + functionBody(card, 'reset'), /touch\(\)|onTouched/, 'a save\'s notice survives the fresh card');
    assert.match(card, /restoredOn < today \? W\.draftPickedUpOn\(dayYear\(restoredOn\)\) : W\.draftPickedUp/);
  });
  it('Change keeps the marks for a new balance or cash, and says a new date clears them', () => {
    assert.match(card, /\{edit\.date !== date && markCount > 0 && <p className=\{b\.warnLine\} role="status">\{W\.changeClears\(markCount, true\)\}<\/p>\}/);
    assert.match(card, /<div className=\{edit \? b\.waiting : undefined\} inert=\{!!edit\}>/);
    assert.match(functionBody(card, 'useThese'), /if \(edit\.date !== date\) \{ newDay\(edit\.date\); setAsOf\(edit\.date\); \}/);
  });
  it('reads on focus only while the Ledger is on screen, debounced, and nothing polls', () => {
    const at = card.indexOf("window.addEventListener('focus', soon);");
    const effect = card.slice(card.lastIndexOf('useEffect(() => {', at), at);
    assert.match(effect, /^useEffect\(\(\) => \{\s*if \(!active\) return;/, 'a hidden card never reads');
    assert.match(card, /document\.addEventListener\('visibilitychange', soon\);/);
    assert.match(card, /window\.setTimeout\(\(\) => setAgain\(n => n \+ 1\), DEBOUNCE_MS\)/);
    // The same effect closes on `[active]`: it re-subscribes when the Ledger shows, never reads while hidden. (The day's
    // own read gates on `active` too: pinned in bank-coach-view-guard.)
    const close = card.indexOf('}, [active]);', at);
    assert.ok(close > at && !card.slice(at, close).includes('useEffect('), 'the listeners\' own effect ends on [active]');
    assert.doesNotMatch(card, /setInterval/);
  });
  it('"+ Record" is always drawn, the word on a phone too, enabled once started and not during Change, and opens the Record money window blank but for the date', () => {
    assert.match(card, /className=\{`\$\{styles\.btnSecondary\} \$\{b\.recordBtn\}`\} disabled=\{!onRecord\} onClick=\{onRecord\}/);
    assert.match(card, /const head = <CardHead onRecord=\{canRecord \? \(\) => onRecord\?\.\(date\) : undefined\} \/>;/);
    assert.match(card, /<Plus size=\{15\} aria-hidden \/>\{W\.record\}/);
    assert.match(card, /const canRecord = !!onRecord && working && !edit && !!fresh && fresh\.booksCents !== null && !busy;/);
    assert.match(readCode(LEDGER), /onRecord=\{canWriteMoney \? date => openConversationFrom\(\{ prefill: \{ receivedDate: date, paidDate: date \} \}\) : undefined\}/,
      'no branch, no amount: the coach answers what happened');
  });
  it('Find marks with the shared line-to-item helper and says "Record the missing amount"', () => {
    const find = readCode(COACH_FIND);
    assert.match(find, /import \{ itemOfLine \} from '@\/lib\/bank-check-draft';/);
    assert.doesNotMatch(find, /const itemOf\b/);
    assert.equal((find.match(/\{W\.recordMissingAmount\}/g) ?? []).length, 2,
      'the nothing-to-name callout\'s button (S3, a button since) and the hint callout\'s');
    assert.doesNotMatch(find, /W\.addMissing\b/);
  });
});
