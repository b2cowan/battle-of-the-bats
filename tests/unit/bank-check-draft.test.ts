/**
 * THE BANK CHECK'S WORKING DRAFT (WD1 + WD2; plan docs/projects/active/BANK_CHECK_WORKING_DRAFT_PLAN.md, owner asks 1A–6A
 * 2026-11-07). The pure helpers over an in-memory store, then the guards: the draft touches browser storage only, never a
 * bank route; the club card and the coach card wire it as ruled (restore at once, figures never restored, Start over, Save
 * clears it, focus re-reads, "+ Add entry" / "+ Record" open the Ledger's own window blank); sign-out clears it.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DRAFT_PREFIX, anchorStarted, canKeepDrafts, clearAllDrafts, clearDraft, draftKey, isWorthKeeping, itemOfLine, keepOffered, offeredItems, readDraft,
  startedOffCents, sweepIdleDrafts, writeDraft, type DraftContent, type DraftStore,
} from '../../lib/bank-check-draft.ts';
import type { BankLine, WaitingItem } from '../../lib/bank-check.ts';
import { BANK_WORDS as W } from '../../lib/bank-tab-words.ts';
import { functionBody, readCode } from './_source-code.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 7, 15);

function memoryStore(): DraftStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: k => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: k => { map.delete(k); },
    get length() { return map.size; },
    key: i => [...map.keys()][i] ?? null,
  };
}
/** Storage that refuses everything (a private window, blocked site data). */
const throwingStore: DraftStore = {
  getItem: () => { throw new Error('blocked'); },
  setItem: () => { throw new Error('blocked'); },
  removeItem: () => { throw new Error('blocked'); },
  get length(): number { throw new Error('blocked'); },
  key: () => { throw new Error('blocked'); },
};

const KEY = draftKey({ club: 'riverdale', account: 'acct-1', person: 'sam' });
const work = (over: Partial<DraftContent> = {}): DraftContent =>
  ({ date: '2026-10-31', balance: '5402.10', marked: [], started: null, ...over });
const at = (now = NOW, today = '2026-11-07'): [string, number] => [today, now];

describe('1 · written only when worth keeping', () => {
  it('a typed balance or a marked line is worth keeping; an empty card is not', () => {
    assert.equal(isWorthKeeping({ balance: '5402.10', marked: [] }), true);
    assert.equal(isWorthKeeping({ balance: '', marked: ['entry:a'] }), true);
    assert.equal(isWorthKeeping({ balance: '  ', marked: [] }), false);
  });
  it('an empty card writes nothing, and emptying a card removes what was kept', () => {
    const s = memoryStore();
    assert.equal(writeDraft(s, KEY, work({ balance: '' }), ...at()), false);
    assert.equal(s.map.size, 0);
    assert.equal(writeDraft(s, KEY, work(), ...at()), true);
    assert.equal(s.map.size, 1);
    writeDraft(s, KEY, work({ balance: '' }), ...at());
    assert.equal(s.map.size, 0, 'the balance cleared and nothing marked: the draft goes');
  });
});

describe('2 · one draft per club, account and person', () => {
  it('each key is its own; another person or account on the same browser reads nothing', () => {
    const s = memoryStore();
    writeDraft(s, KEY, work(), ...at());
    assert.ok(readDraft(s, KEY, NOW));
    assert.equal(readDraft(s, draftKey({ club: 'riverdale', account: 'acct-1', person: 'alex' }), NOW), null);
    assert.equal(readDraft(s, draftKey({ club: 'riverdale', account: 'acct-2', person: 'sam' }), NOW), null);
    assert.equal(readDraft(s, draftKey({ club: 'other-club', account: 'acct-1', person: 'sam' }), NOW), null);
  });
  it('a separator in a part cannot make two keys collide', () => {
    assert.notEqual(draftKey({ club: 'a:b', account: 'c', person: 'd' }), draftKey({ club: 'a', account: 'b:c', person: 'd' }));
    assert.ok(KEY.startsWith(DRAFT_PREFIX));
  });
});

describe('3 · restore, and the 14-day idle rule (ask 4 = A)', () => {
  it('reads back what was typed and marked, and the day it was last worked on', () => {
    const s = memoryStore();
    const started = { date: '2026-10-31', balance: '5402.10', differenceCents: 41200 };
    writeDraft(s, KEY, work({ marked: ['entry:a', 'entry:b'], started }), ...at(NOW - 2 * DAY, '2026-11-05'));
    assert.deepEqual(readDraft(s, KEY, NOW), {
      date: '2026-10-31', balance: '5402.10', marked: ['entry:a', 'entry:b'], started, savedOn: '2026-11-05', savedAt: NOW - 2 * DAY,
    });
  });
  it('the cash (the coach card\'s, WD2) is kept and read back; a card without the field stores what WD1 stored', () => {
    const s = memoryStore();
    writeDraft(s, KEY, work({ cash: '120.00' }), ...at());
    assert.equal(readDraft(s, KEY, NOW)?.cash, '120.00');
    writeDraft(s, KEY, work(), ...at());
    assert.equal('cash' in JSON.parse(s.map.get(KEY)!), false, 'no cash typed, no cash key: the club\'s draft is unchanged');
    writeDraft(s, KEY, work({ cash: '  ' }), ...at());
    assert.equal('cash' in JSON.parse(s.map.get(KEY)!), false);
  });
  it('a WD1 draft (no cash) still reads, as it was; the key version stays v1', () => {
    const s = memoryStore();
    s.setItem(KEY, JSON.stringify({ date: '2026-10-31', balance: '5402.10', marked: ['entry:a'], started: null, savedOn: '2026-11-06', savedAt: NOW - DAY }));
    assert.deepEqual(readDraft(s, KEY, NOW), {
      date: '2026-10-31', balance: '5402.10', marked: ['entry:a'], started: null, savedOn: '2026-11-06', savedAt: NOW - DAY,
    });
    assert.ok(DRAFT_PREFIX.endsWith(':v1:'));
  });
  it('cash typed alone is worth keeping, written and read back', () => {
    assert.equal(isWorthKeeping({ balance: '', cash: '40', marked: [] }), true);
    assert.equal(isWorthKeeping({ balance: '', cash: ' ', marked: [] }), false);
    const s = memoryStore();
    assert.equal(writeDraft(s, KEY, work({ balance: '', cash: '40' }), ...at()), true);
    assert.deepEqual(readDraft(s, KEY, NOW), { ...work({ balance: '', cash: '40' }), savedOn: '2026-11-07', savedAt: NOW });
    writeDraft(s, KEY, work({ balance: '', cash: '' }), ...at());
    assert.equal(s.map.size, 0, 'the cash cleared too: the draft goes');
  });
  it('a draft idle more than 14 days is gone, and removed; at 14 days it stays', () => {
    const s = memoryStore();
    writeDraft(s, KEY, work(), ...at(NOW - 14 * DAY));
    assert.ok(readDraft(s, KEY, NOW), 'exactly 14 days: kept');
    writeDraft(s, KEY, work(), ...at(NOW - 14 * DAY - 1));
    assert.equal(readDraft(s, KEY, NOW), null);
    assert.equal(s.map.size, 0, 'removed, not only ignored');
  });
  it('the sweep removes idle drafts of other accounts and leaves the rest of storage alone', () => {
    const s = memoryStore();
    const other = draftKey({ club: 'riverdale', account: 'acct-9', person: 'sam' });
    writeDraft(s, KEY, work(), ...at());
    writeDraft(s, other, work(), ...at(NOW - 30 * DAY));
    s.setItem('club-money-year:riverdale', '2026-04-01');
    sweepIdleDrafts(s, NOW);
    assert.ok(s.map.has(KEY));
    assert.ok(!s.map.has(other));
    assert.ok(s.map.has('club-money-year:riverdale'));
  });
  it('a stored value that is not a draft is dropped, never trusted', () => {
    const s = memoryStore();
    for (const bad of ['{', '[]', JSON.stringify({ date: 'Oct 31', balance: '1', marked: [], started: null, savedOn: '2026-11-07', savedAt: NOW }),
      JSON.stringify({ date: '2026-10-31', balance: '1', marked: [3], started: null, savedOn: '2026-11-07', savedAt: NOW }),
      JSON.stringify({ date: '2026-10-31', balance: '1', cash: 40, marked: [], started: null, savedOn: '2026-11-07', savedAt: NOW })]) {
      s.setItem(KEY, bad);
      assert.equal(readDraft(s, KEY, NOW), null, bad);
    }
  });
});

describe('4 · Start over, Save and sign-out clear it', () => {
  it('clearDraft removes this draft only; clearAllDrafts removes every draft and nothing else', () => {
    const s = memoryStore();
    const other = draftKey({ club: 'riverdale', account: 'acct-2', person: 'sam' });
    writeDraft(s, KEY, work(), ...at());
    writeDraft(s, other, work(), ...at());
    s.setItem('flhq.console.recent.v1', '[]');
    clearDraft(s, KEY);
    assert.ok(!s.map.has(KEY) && s.map.has(other));
    clearAllDrafts(s);
    assert.deepEqual([...s.map.keys()], ['flhq.console.recent.v1']);
  });
});

describe('5 · storage that throws (the card works with storage blocked)', () => {
  it('every helper answers quietly: no draft, nothing kept', () => {
    assert.equal(readDraft(throwingStore, KEY, NOW), null);
    assert.equal(writeDraft(throwingStore, KEY, work(), ...at()), false);
    assert.doesNotThrow(() => clearDraft(throwingStore, KEY));
    assert.doesNotThrow(() => clearAllDrafts(throwingStore));
    assert.doesNotThrow(() => sweepIdleDrafts(throwingStore, NOW));
    assert.equal(readDraft(null, KEY, NOW), null);
    assert.equal(canKeepDrafts(throwingStore), false, 'never "Kept in this browser" over blocked storage');
    assert.equal(canKeepDrafts(null), false);
    const s = memoryStore();
    assert.equal(canKeepDrafts(s), true);
    assert.equal(s.map.size, 0, 'the probe leaves nothing behind');
    assert.equal(writeDraft(null, KEY, work(), ...at()), false);
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

describe('8 · the draft touches browser storage only, never a bank route', () => {
  it('the helper has no network, no route, no server import; only localStorage', () => {
    const src = readCode(HELPER);
    assert.doesNotMatch(src, /\bfetch\(|bankUrl|bankWrite|moneyFetch|readFigure|\/api\/|supabase|import (?!type)[^;]*from '\.\/(db|supabase)/);
    assert.doesNotMatch(src, /sessionStorage|document\.cookie|indexedDB/, 'one store: the browser\'s localStorage');
    assert.match(src, /window\.localStorage/);
    assert.match(src, /^import type \{ BankLine, WaitingItem \} from '\.\/bank-check';$/m, 'its one import is a type');
  });
  it('the card reaches storage only through the helper', () => {
    const form = readCode(FORM);
    assert.doesNotMatch(form, /localStorage|sessionStorage/);
  });
  it('the card\'s draft writes are local: none of them sits beside a bank write', () => {
    const form = readCode(FORM);
    for (const call of form.match(/(writeDraft|clearDraft)\([^)]*\)/g) ?? []) assert.doesNotMatch(call, /bankWrite|readFigure|fetch/);
  });
});

describe('9 · the club card wires it as ruled', () => {
  const form = readCode(FORM);
  it('the draft is this person\'s, and "Check this statement again" starts that day fresh', () => {
    assert.match(form, /draftKey\(\{ club: orgSlug, account: accountId, person: personId \}\)/);
    assert.match(form, /draftAt && !againDate \? readDraft\(browserDraftStore\(\), draftAt, Date\.now\(\)\)/);
    assert.match(readCode('components/admin/kit/club/money/bank/BankTab.tsx'), /const personId = useOrg\(\)\.user\?\.id \?\? null;/);
  });
  it('figures are never restored: the band waits for the day, and marks come back only as the day offers them', () => {
    assert.match(form, /!figure\.refused && pending === null \? figure : null/);
    // Each new figure for this day checks the marks again, before the band can draw (adjusted while rendering).
    assert.match(form, /if \(figure && figure !== checkedFor && figure\.date === date && !figure\.refused\) \{\s*setCheckedFor\(figure\);\s*const keys = pending \?\? \[\.\.\.marked\.keys\(\)\];/);
    assert.match(form, /keepOffered\(keys, offeredItems\(figure\)\)/);
    assert.match(form, /if \(gone > 0\) setDroppedMarks\(gone\);/);
    assert.match(form, /const hasDraft = canKeep && worthKeeping;/, '"Kept in this browser" only where the browser keeps it');
    assert.match(form, /<Callout tone="warn" role="status" flush>\{W\.draftDropped\(droppedMarks\)\}<\/Callout>/);
  });
  it('Save clears it only once the check saved; Start over clears it at once', () => {
    const save = functionBody(form, 'save');
    assert.ok(save.indexOf('startOver()') > save.indexOf('if (!r.ok)'), 'after the refusal branch returns');
    assert.match(functionBody(form, 'startOver'), /if \(draftAt\) clearDraft\(browserDraftStore\(\), draftAt\);/);
    assert.match(form, /onClick=\{startOver\}>\{W\.startOver\}<\/button>/);
  });
  it('the restore line names an earlier day through the shipped date helper', () => {
    assert.match(form, /restoredOn < today \? W\.draftPickedUpOn\(dayYear\(restoredOn\)\) : W\.draftPickedUp/);
  });
  it('coming back to the browser tab reads the day again, debounced, and nothing polls', () => {
    assert.match(form, /window\.addEventListener\('focus', soon\);/);
    assert.match(form, /document\.addEventListener\('visibilitychange', soon\);/);
    assert.match(form, /window\.setTimeout\(\(\) => setAgain\(n => n \+ 1\), DEBOUNCE_MS\)/);
    assert.doesNotMatch(form, /setInterval/);
  });
  it('"+ Add entry" opens the Ledger\'s own window blank: the check\'s date, Money after the gap, no amount', () => {
    const add = form.slice(form.indexOf('const addEntry = '), form.indexOf('const addEntry = ') + 300);
    assert.match(add, /setAdding\(\{\s*date,/);
    assert.doesNotMatch(add, /amount/);
    assert.match(form, /className=\{`btn btn-outline \$\{s\.addEntry\}`\} onClick=\{addEntry\} disabled=\{!canAdd\}/);
    assert.match(form, /const canAdd = !!fresh && fresh\.booksCents !== null && !!ownBook && !busy;/);
  });
});

describe('10 · sign-out clears every draft in this browser', () => {
  it('the sign-out wrapper clears them beside the support console\'s Recent', () => {
    const body = functionBody(readCode('lib/auth.ts'), 'signOut');
    assert.match(body, /clearConsoleRecent\(\);\s*clearAllDrafts\(browserDraftStore\(\)\);/);
  });
});

describe('11 · the words (plan §4b)', () => {
  it('the settled strings: the club\'s "entry", the coach\'s "record" (WD2 renamed the coach\'s gap link)', () => {
    assert.equal(W.addEntry, 'Add entry');
    assert.equal(W.addMissingEntry, 'Add the missing entry');
    assert.equal(W.record, 'Record');
    assert.equal(W.recordMissingAmount, 'Record the missing amount');
    assert.equal('addMissing' in W, false, '"Add the missing line" is retired in both portals');
    assert.equal(W.draftPickedUpOn('Nov 5, 2026'), 'Picked up where you left off · last worked on Nov 5, 2026');
    assert.equal(W.startedOffBy('$412.00'), 'Started off by $412.00');
    assert.equal(W.draftKept, 'Kept in this browser only, until you save this check or sign out.');
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
    const coach = readCode('components/coaches/bank/CoachBankFind.tsx');
    for (const k of ['hintOrMore', 'hintOrLess', 'hintHalf']) {
      const coachKey = `coach${k[0].toUpperCase()}${k.slice(1)}`;
      assert.match(club, new RegExp(`W\\.${k}\\b`), `the club's Find reads ${k}`);
      assert.doesNotMatch(club, new RegExp(`W\\.${coachKey}\\b`), `the club's Find never reads ${coachKey}`);
      assert.match(coach, new RegExp(`W\\.${coachKey}\\b`), `the coach's Find reads ${coachKey}`);
      assert.doesNotMatch(coach, new RegExp(`W\\.${k}\\b`), `the coach's Find never reads the club's ${k}`);
    }
  });
});

const COACH = 'components/coaches/bank/CoachBankCheck.tsx';
const COACH_VIEW = 'components/coaches/bank/CoachBankView.tsx';
const COACH_FIND = 'components/coaches/bank/CoachBankFind.tsx';
const LEDGER = 'app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx';

describe('12 · the coach card wires it as the club card does (WD2)', () => {
  const card = readCode(COACH);
  it('reaches storage only through the helper, and no draft write sits beside a bank call', () => {
    assert.doesNotMatch(card, /localStorage|sessionStorage/);
    for (const call of card.match(/(writeDraft|clearDraft|readDraft)\([^)]*\)/g) ?? []) assert.doesNotMatch(call, /saveTeamCheck|readTeamBank|fetch/);
  });
  it('the draft is this coach\'s, on this team; read only once the person is known; the view re-keys on the person', () => {
    assert.match(card, /const draftAt = personId \? draftKey\(\{ club: orgSlug, account: teamId, person: personId \}\) : null;/);
    assert.match(card, /draftAt && !againDate \? readDraft\(browserDraftStore\(\), draftAt, Date\.now\(\)\)/);
    const view = readCode(COACH_VIEW);
    assert.match(view, /const personId = useOrg\(\)\.user\?\.id \?\? null;/);
    assert.match(view, /<CoachBankCheck key=\{`\$\{teamId\}:\$\{again \? `again-\$\{again\.n\}` : 'check'\}:\$\{personId \?\? ''\}`\}/);
  });
  it('keeps the cash with the work, and figures are never restored', () => {
    assert.match(card, /const \[cash, setCash\] = useState\(restored\?\.cash \?\? ''\);/);
    assert.match(card, /const draft: DraftContent = \{ date: ISO_DAY\.test\(date\) \? date : today, balance, cash, marked: pending \?\? \[\.\.\.marked\.keys\(\)\], started: anchor \};/);
    assert.match(card, /!figure\.refused && pending === null \? figure : null/);
    assert.match(card, /if \(figure && figure !== checkedFor && figure\.date === date && !figure\.refused\) \{\s*setCheckedFor\(figure\);\s*const keys = pending \?\? \[\.\.\.marked\.keys\(\)\];/);
    assert.match(card, /keepOffered\(keys, offeredItems\(figure\)\)/, 'the shared helper, on the coach\'s own figure, no cast');
    assert.match(card, /<p className=\{`\$\{b\.callout\} \$\{b\.droppedNote\}`\} role="status">\{W\.draftDropped\(droppedMarks\)\}<\/p>/);
    assert.match(card, /const hasDraft = canKeep && worthKeeping;/);
    // S1 row 10: the resting sentence is one of the card's single note line's sentences, only while a draft exists.
    assert.match(card, /hasDraft \? W\.draftKept : null,/);
    assert.match(card, /<p className=\{`\$\{styles\.formHint\} \$\{b\.note\}`\}>\s*\{notes\.join\(' '\)\}/);
  });
  it('Save clears it only once the check saved; Start over clears it at once; the restore line names an earlier day', () => {
    const save = functionBody(card, 'save');
    assert.ok(save.indexOf('startOver()') > save.indexOf('if (!r.ok)'), 'after the refusal branch returns');
    assert.match(functionBody(card, 'startOver'), /if \(draftAt\) clearDraft\(browserDraftStore\(\), draftAt\);/);
    assert.doesNotMatch(functionBody(card, 'startOver'), /touch\(\)|onTouched/, 'a save\'s notice survives the fresh card');
    assert.match(card, /restoredOn < today \? W\.draftPickedUpOn\(dayYear\(restoredOn\)\) : W\.draftPickedUp/);
    assert.match(card, /onClick=\{startOver\}>\{W\.startOver\}<\/button>/);
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
  it('"+ Record" is always drawn, the word on a phone too, and opens the Record money window blank but for the date', () => {
    assert.match(card, /className=\{`\$\{styles\.btnSecondary\} \$\{b\.recordBtn\}`\} disabled=\{!canRecord\}/);
    assert.match(card, /<Plus size=\{15\} aria-hidden \/>\{W\.record\}/);
    assert.match(card, /const canRecord = !!onRecord && !!fresh && fresh\.booksCents !== null && !busy;/);
    assert.match(readCode(LEDGER), /onRecord=\{canWriteMoney \? date => openConversationFrom\(\{ prefill: \{ receivedDate: date, paidDate: date \} \}\) : undefined\}/,
      'no branch, no amount: the coach answers what happened');
  });
  it('Find marks with the shared line-to-item helper and says "Record the missing amount"', () => {
    const find = readCode(COACH_FIND);
    assert.match(find, /import \{ itemOfLine \} from '@\/lib\/bank-check-draft';/);
    assert.doesNotMatch(find, /const itemOf\b/);
    assert.equal((find.match(/\{W\.recordMissingAmount\}/g) ?? []).length, 2, 'the link and the callout button');
    assert.doesNotMatch(find, /W\.addMissing\b/);
  });
});
