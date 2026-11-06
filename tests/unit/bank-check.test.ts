import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  HINT_CAP, MAX_COMBOS, booksNowSay, closingDirection, closingDirectionAtStart, coachBooksOnDate, figureCheck, figureOfSaved,
  findHints, hintsFor, latestBefore, matchedWhenSaved, stillWaitingOn, onItsWayOnCheck, savedTerms, startBooks, suspectsSince, typedCents,
  waitingOnCheck, waitingOnStart,
  type BankLine, type SavedCheck, type WaitingItem,
} from '../../lib/bank-check.ts';

/**
 * Bank balance check BC1 — THE ENGINE (lib/bank-check.ts, plan §4). The drawing examples figure to the cent as drawn
 * (BANK_BALANCE_CHECK_DRAWINGS.html tabs 2 and 3, the coach phone frame, and the asks page's Q2 example); the rest pin
 * the bounds the plan sets: the hint cap, the cents parity of "half", the ordering, a transfer inside one account.
 */

const line = (key: string, date: string, direction: 'in' | 'out', amountCents: number, extra: Partial<BankLine> = {}): BankLine =>
  ({ key, date, direction, amountCents, ...extra });

const saved = (c: Partial<SavedCheck> & Pick<SavedCheck, 'id' | 'date'>): SavedCheck => ({
  kind: 'check', bankCents: 0, booksCents: 0, onItsWayCents: 0, cashCents: null, waiting: [], ...c,
});

describe('figureCheck — the drawings, to the cent', () => {
  it('Lakeshore Lynx, Oct 31: books $8,255.53 less $412.00 on its way = $7,843.53, Matches', () => {
    const f = figureCheck({ bankCents: 784353, booksCents: 825553, onItsWayCents: 41200, waiting: [], cashCents: null });
    assert.equal(f.shouldBeCents, 784353);
    assert.equal(f.differenceCents, 0);
    assert.equal(f.result, 'matches');
    assert.equal(f.direction, null);
  });

  it('the same check with the bank at $7,918.53 is Off by $75.00, the bank showing more, and Cheque #214 is exact', () => {
    const f = figureCheck({ bankCents: 791853, booksCents: 825553, onItsWayCents: 41200, waiting: [], cashCents: null });
    assert.equal(f.result, 'off');
    assert.equal(f.offByCents, 7500);
    assert.equal(f.direction, 'bank_more');
    const cheque = line('entry:214', '2026-10-28', 'out', 7500, { label: 'Cheque #214' });
    const h = findHints(f.differenceCents, [line('entry:a', '2026-10-30', 'in', 12000), cheque, line('entry:b', '2026-10-02', 'out', 3000)]);
    assert.deepEqual(h.exact.map(l => l.label), ['Cheque #214']);
    // Marked Not in the bank yet, the money-out item adds back and the check matches.
    const after = figureCheck({ bankCents: 791853, booksCents: 825553, onItsWayCents: 41200,
      waiting: [{ key: cheque.key, date: cheque.date, direction: 'out', amountCents: 7500 }], cashCents: null });
    assert.equal(after.shouldBeCents, 791853);
    assert.equal(after.result, 'matches');
  });

  it('Ridge 13U (coach): books $3,240.00 less $180.00 cash = $3,060.00, Matches', () => {
    const f = figureCheck({ bankCents: 306000, booksCents: 324000, onItsWayCents: null, waiting: [], cashCents: 18000 });
    assert.equal(f.shouldBeCents, 306000);
    assert.equal(f.result, 'matches');
    assert.equal(f.cashCents, 18000);
  });

  it('a money-in item waiting subtracts, a money-out item adds; the bank showing less reads bank_less', () => {
    const waiting: WaitingItem[] = [
      { key: 'entry:dep', date: '2026-10-31', direction: 'in', amountCents: 50000 },
      { key: 'entry:chq', date: '2026-10-30', direction: 'out', amountCents: 2000 },
    ];
    const f = figureCheck({ bankCents: 100000, booksCents: 160000, onItsWayCents: 0, waiting, cashCents: null });
    assert.equal(f.waitingInCents, 50000);
    assert.equal(f.waitingOutCents, 2000);
    assert.equal(f.shouldBeCents, 160000 + 2000 - 50000);
    assert.equal(f.differenceCents, 100000 - 112000);
    assert.equal(f.direction, 'bank_less');
  });

  it('on its way NOT counted (null) is left out of the figure, and the check reads off', () => {
    const f = figureCheck({ bankCents: 784353, booksCents: 825553, onItsWayCents: null, waiting: [], cashCents: null });
    assert.equal(f.onItsWayCents, null);
    assert.equal(f.shouldBeCents, 825553);
    assert.equal(f.result, 'off');
    assert.equal(f.direction, 'bank_less');
  });

  it('refuses a figure that is not whole cents', () => {
    assert.throws(() => figureCheck({ bankCents: 1.5, booksCents: 0, onItsWayCents: 0, waiting: [], cashCents: null }));
  });
});

describe('startBooks — the starting statement (ask 7, Q2, the BC1 Stripe call)', () => {
  it('the asks page: a $5,000.00 start with a $75.00 cheque waiting at the start is books of $4,925.00', () => {
    const books = startBooks({ bankCents: 500000, onItsWayCents: 0,
      waiting: [{ key: 'entry:188', date: '2026-06-28', direction: 'out', amountCents: 7500, atStart: true }] });
    assert.equal(books, 492500);
    // …and the start then figures with no difference.
    assert.equal(figureCheck({ bankCents: 500000, booksCents: books, onItsWayCents: 0,
      waiting: [{ key: 'entry:188', date: '2026-06-28', direction: 'out', amountCents: 7500 }], cashCents: null }).differenceCents, 0);
  });

  it('counts Stripe on its way at the start, and a deposit waiting adds to the books', () => {
    assert.equal(startBooks({ bankCents: 100000, onItsWayCents: 4000,
      waiting: [{ key: 'entry:d', date: '2026-06-30', direction: 'in', amountCents: 2500 }] }), 100000 + 2500 + 4000);
    assert.equal(startBooks({ bankCents: 100000, onItsWayCents: null, waiting: [] }), 100000);
  });
});

describe('saved checks: matched when saved, Books now say, the latest before', () => {
  const start = saved({ id: 's', kind: 'start', date: '2026-06-30', bankCents: 500000, booksCents: 500000 });
  const matched = saved({ id: 'a', date: '2026-07-31', bankCents: 520000, booksCents: 520000 });
  const off = saved({ id: 'b', date: '2026-08-31', bankCents: 530000, booksCents: 520000 });

  it('a start is never a match; a check is matched when its saved figures were', () => {
    assert.equal(matchedWhenSaved(start), false);
    assert.equal(matchedWhenSaved(matched), true);
    assert.equal(matchedWhenSaved(off), false);
    assert.equal(figureOfSaved(off).offByCents, 10000);
  });

  it('Books now say is the books as they read now, only when they differ', () => {
    assert.equal(booksNowSay(520000, 520000), null);
    assert.equal(booksNowSay(520000, 517500), 517500);
  });

  it('the latest check strictly before a date', () => {
    assert.equal(latestBefore([start, matched, off], '2026-08-31')?.id, 'a');
    assert.equal(latestBefore([start, matched, off], '2026-09-30')?.id, 'b');
    assert.equal(latestBefore([start], '2026-06-30'), null);
  });
});

describe("stillWaitingOn — the start is the chain's first link (owner 2026-11-06, BC4a)", () => {
  // The owner's example: start Sep 30, a $75 cheque of Sep 26 cleared Oct 10, an Oct 5 check saved earlier, and an Oct 15
  // check on which the cheque was put on the start (Waiting at the start) and then saved.
  type C = SavedCheck & { createdAt: string };
  const at = (day: string) => `2026-${day}T12:00:00.000000+00:00`;
  const cheque: WaitingItem = { key: 'entry:c', date: '2026-09-26', direction: 'out', amountCents: 7500, label: 'Cheque #12',
    atStart: true, addedAt: at('10-16'), addedBy: 'u1' };
  const ownItem: WaitingItem = { key: 'entry:d', date: '2026-10-04', direction: 'in', amountCents: 2000 };
  const start: C = { ...saved({ id: 's', kind: 'start', date: '2026-09-30', waiting: [cheque] }), createdAt: at('10-01') };
  const oct5: C = { ...saved({ id: 'o5', date: '2026-10-05' }), createdAt: at('10-06') };
  const oct15: C = { ...saved({ id: 'o15', date: '2026-10-15' }), createdAt: at('10-16').replace('12:00', '12:05') };
  const asks = (checks: C[], date: string) => stillWaitingOn(checks, date).map(w => w.key);
  const keptOct5: C = { ...oct5, id: 'o5b', createdAt: at('10-17'), waiting: [{ key: 'entry:c', date: '2026-09-26', direction: 'out', amountCents: 7500 }] };

  it("the re-checked Oct 5 asks about the cheque, marked as the start's (no earlier check)", () => {
    const w = stillWaitingOn([start, oct5, oct15], '2026-10-05');
    assert.deepEqual(w, [{ key: 'entry:c', date: '2026-09-26', direction: 'out', amountCents: 7500, label: 'Cheque #12', atStart: true }]);
  });

  it("a check saved before the cheque went on the start never saw the question: it doesn't count", () => {
    assert.deepEqual(asks([start, oct5, oct15], '2026-10-08'), ['entry:c']);
  });

  it('Oct 5 kept it: Oct 8, Oct 12 and the re-checked Oct 15 ask again, once', () => {
    for (const d of ['2026-10-08', '2026-10-12', '2026-10-15']) assert.deepEqual(asks([start, keptOct5, oct15], d), ['entry:c'], d);
    assert.equal(stillWaitingOn([start, keptOct5, oct15], '2026-10-08')[0].atStart, true, "carried by a check, still the start's");
  });

  it("Oct 15 was saved after it went on the start, without it: Oct 31 doesn't ask", () => {
    assert.deepEqual(asks([start, oct5, oct15], '2026-10-31'), []);
    assert.deepEqual(asks([start, keptOct5, oct15], '2026-10-31'), []);
  });

  it("a check's own items still carry to the next check (ask 2), beside the start's", () => {
    const withOwn: C = { ...keptOct5, waiting: [...keptOct5.waiting, ownItem] };
    assert.deepEqual(asks([start, withOwn], '2026-10-08').sort(), ['entry:c', 'entry:d']);
    assert.deepEqual(asks([start, { ...oct15, waiting: [ownItem] }], '2026-10-31'), ['entry:d']);
  });

  it('taken off the start: a check that kept it no longer carries it (the save would refuse it, M3)', () => {
    const bare: C = { ...start, waiting: [] };
    const withOwn: C = { ...keptOct5, waiting: [...keptOct5.waiting, ownItem] };
    assert.deepEqual(asks([bare, withOwn], '2026-10-08'), ['entry:d']);
  });

  it('a line saved with the start itself went on when the start was saved', () => {
    const withStart: WaitingItem = { key: cheque.key, date: cheque.date, direction: cheque.direction, amountCents: cheque.amountCents,
      label: cheque.label, atStart: true };
    const s2: C = { ...start, waiting: [withStart] };
    assert.deepEqual(asks([s2], '2026-10-05'), ['entry:c'], 'no check yet');
    assert.deepEqual(asks([s2, oct5], '2026-10-08'), [], 'Oct 5, saved after the start, answered without it');
  });

  it('as ruled: the latest-DATED check among those saved after the line went on decides, not the latest check overall', () => {
    // Oct 15 was saved before the cheque went on the start; Oct 5 is re-saved after it, without it: Oct 31 doesn't ask.
    const early15: C = { ...oct15, createdAt: at('10-15') };
    const resaved5: C = { ...oct5, id: 'o5c', createdAt: at('10-17') };
    assert.deepEqual(asks([start, resaved5, early15], '2026-10-31'), []);
  });

  it("no start: only the latest earlier check's items", () => {
    const c: C = { ...oct5, waiting: [ownItem] };
    assert.deepEqual(asks([c], '2026-10-08'), ['entry:d']);
  });
});

describe('suspectsSince (ask 3)', () => {
  const start = saved({ id: 's', kind: 'start', date: '2026-06-30' });
  const lines = [
    line('entry:1', '2026-06-30', 'out', 100), line('entry:2', '2026-07-15', 'out', 200),
    line('entry:3', '2026-08-10', 'in', 300), line('entry:4', '2026-09-05', 'out', 400), line('entry:5', '2026-10-01', 'out', 500),
  ];

  it('since the start when no check has matched', () => {
    const offJuly = saved({ id: 'j', date: '2026-07-31', bankCents: 1, booksCents: 0 });
    const s = suspectsSince({ lines, checks: [start, offJuly], date: '2026-09-30', startDate: '2026-06-30' });
    assert.equal(s.since, '2026-06-30');
    assert.equal(s.sinceMatch, false);
    assert.deepEqual(s.lines.map(l => l.key), ['entry:4', 'entry:3', 'entry:2']);
  });

  it('since the latest check that matched when saved, never a later off one', () => {
    const matchedJuly = saved({ id: 'j', date: '2026-07-31' });
    const offAug = saved({ id: 'a', date: '2026-08-31', bankCents: 9, booksCents: 0 });
    const s = suspectsSince({ lines, checks: [start, matchedJuly, offAug], date: '2026-09-30', startDate: '2026-06-30' });
    assert.equal(s.since, '2026-07-31');
    assert.equal(s.sinceMatch, true);
    assert.deepEqual(s.lines.map(l => l.key), ['entry:4', 'entry:3']);
  });

  it('a transfer between two books of one account nets to nothing: both halves are left out', () => {
    const pair = [
      line('entry:t-out', '2026-08-01', 'out', 25000, { transferPairKey: 'entry:t-in' }),
      line('entry:t-in', '2026-08-01', 'in', 25000, { transferPairKey: 'entry:t-out' }),
      // A transfer to ANOTHER account: its other half isn't here, so it stays.
      line('entry:x-out', '2026-08-02', 'out', 9000, { transferPairKey: 'entry:x-in' }),
    ];
    const s = suspectsSince({ lines: pair, checks: [start], date: '2026-08-31', startDate: '2026-06-30' });
    assert.deepEqual(s.lines.map(l => l.key), ['entry:x-out']);
    // And as signed movement the pair adds to zero (the books figure is the SQL sum, which nets them the same way).
    assert.equal(pair.slice(0, 2).reduce((n, l) => n + (l.direction === 'in' ? l.amountCents : -l.amountCents), 0), 0);
  });
});

describe('findHints — bounded (plan §4)', () => {
  it('half only on an even number of cents, either direction', () => {
    const xs = [line('entry:h', '2026-10-01', 'in', 3750), line('entry:o', '2026-10-02', 'out', 3751)];
    assert.deepEqual(findHints(7500, xs).half.map(l => l.key), ['entry:h']);
    assert.deepEqual(findHints(7501, xs).half, []);
    assert.deepEqual(findHints(-7500, xs).half.map(l => l.key), ['entry:h']);
  });

  it('pairs and triples in one direction, nearest-dated first, at most three', () => {
    const xs = [
      line('entry:a', '2026-10-01', 'out', 2500), line('entry:b', '2026-10-20', 'out', 5000),
      line('entry:c', '2026-09-01', 'out', 5000), line('entry:d', '2026-10-25', 'out', 2500),
      line('entry:e', '2026-08-01', 'out', 1000), line('entry:f', '2026-08-02', 'out', 1500),
      line('entry:g', '2026-10-30', 'in', 2500), line('entry:h', '2026-10-30', 'in', 5000),
    ];
    const h = findHints(7500, xs);
    assert.equal(h.combos.length, MAX_COMBOS);
    // Every combination is one direction and adds up to the difference.
    for (const c of h.combos) {
      assert.equal(new Set(c.map(l => l.direction)).size, 1);
      assert.equal(c.reduce((n, l) => n + l.amountCents, 0), 7500);
    }
    // Nearest-dated first: the in pair (Oct 30) leads, then the out pairs with Oct 25's line.
    assert.deepEqual(h.combos.map(c => c.map(l => l.key)), [['entry:g', 'entry:h'], ['entry:d', 'entry:b'], ['entry:d', 'entry:c']]);
  });

  it('finds a triple when no pair adds up', () => {
    const xs = [line('entry:1', '2026-10-01', 'out', 1000), line('entry:2', '2026-10-02', 'out', 2000), line('entry:3', '2026-10-03', 'out', 4500)];
    assert.deepEqual(findHints(7500, xs).combos.map(c => c.map(l => l.key).sort()), [['entry:1', 'entry:2', 'entry:3']]);
  });

  it('looks through the most recent 400 only', () => {
    const many: BankLine[] = [];
    for (let i = 0; i < HINT_CAP + 50; i++) {
      const day = String(1 + (i % 28)).padStart(2, '0');
      const month = String(1 + Math.floor(i / 28) % 12).padStart(2, '0');
      many.push(line(`entry:${String(i).padStart(4, '0')}`, `20${20 + Math.floor(i / 336)}-${month}-${day}`, 'out', 100 + i));
    }
    // The oldest line holds the exact amount: past the cap, so it is not found.
    const oldest = line('entry:old', '2019-01-01', 'out', 99999);
    const h = findHints(99999, [...many, oldest]);
    assert.equal(h.capped, true);
    assert.deepEqual(h.exact, []);
    const t0 = Date.now();
    findHints(123457, many);
    assert.ok(Date.now() - t0 < 500, 'the bounded walk stays quick');
  });

  it('a list of identical amounts can not run away', () => {
    const same = Array.from({ length: HINT_CAP }, (_, i) => line(`entry:${i}`, '2026-10-01', 'out', 2500));
    const h = findHints(7500, same);
    assert.equal(h.combos.length, MAX_COMBOS);
    assert.equal(h.exact.length, 0);
  });

  it('nothing to find at a difference of zero', () => {
    const h = findHints(0, [line('entry:z', '2026-10-01', 'out', 0 + 1)]);
    assert.deepEqual([h.exact, h.half, h.combos], [[], [], []]);
  });
});

describe('hintsFor — only the lines that can explain the gap (BC3a, said to the owner 2026-11-06)', () => {
  const xs = [
    line('entry:out75', '2026-10-29', 'out', 7500), line('entry:in75', '2026-10-30', 'in', 7500),
    line('entry:outHalf', '2026-10-20', 'out', 3750), line('entry:inHalf', '2026-10-21', 'in', 3750),
    line('entry:o1', '2026-10-10', 'out', 2500), line('entry:o2', '2026-10-11', 'out', 5000),
    line('entry:i1', '2026-10-12', 'in', 2500), line('entry:i2', '2026-10-13', 'in', 5000),
  ];
  it('the bank showing MORE: money-out lines only, exact then half then combinations', () => {
    const { targetCents, hints } = hintsFor(7500, xs);
    assert.equal(targetCents, 7500);
    assert.deepEqual(hints.map(h => [h.kind, h.lines.map(l => l.key)]), [
      ['exact', ['entry:out75']], ['half', ['entry:outHalf']], ['combo', ['entry:o2', 'entry:o1']],
    ]);
    for (const h of hints) for (const l of h.lines) assert.equal(l.direction, 'out');
  });
  it('the bank showing LESS: money-in lines only', () => {
    const { hints } = hintsFor(-7500, xs);
    assert.deepEqual(hints.filter(h => h.kind !== 'combo').map(h => h.lines[0].key), ['entry:in75', 'entry:inHalf']);
    for (const h of hints) for (const l of h.lines) assert.equal(l.direction, 'in');
  });
  it('marking a hinted line closes the gap; the same amount the other way would double it (why the rule)', () => {
    const books = 100_000;
    const off = figureCheck({ bankCents: books + 7500, booksCents: books, onItsWayCents: 0, waiting: [], cashCents: null });
    const asItem = (l: BankLine): WaitingItem => ({ key: l.key, date: l.date, direction: l.direction, amountCents: l.amountCents });
    const right = hintsFor(off.differenceCents, xs).hints[0].lines[0];
    assert.equal(figureCheck({ bankCents: books + 7500, booksCents: books, onItsWayCents: 0, waiting: [asItem(right)], cashCents: null }).result, 'matches');
    const wrong = figureCheck({ bankCents: books + 7500, booksCents: books, onItsWayCents: 0, waiting: [asItem(xs[1])], cashCents: null });
    assert.equal(wrong.offByCents, 15_000);
  });
  it('every hint has a stable key; nothing at a difference of zero', () => {
    const keys = hintsFor(7500, xs).hints.map(h => h.key);
    assert.equal(new Set(keys).size, keys.length);
    assert.deepEqual(hintsFor(0, xs).hints, []);
    assert.equal(closingDirection(1), 'out');
    assert.equal(closingDirection(-1), 'in');
    assert.equal(closingDirection(0), null);
  });
  it('a waiting item on a check: a money-out line adds back, a money-in line comes off (the sums\' signs)', () => {
    assert.equal(waitingOnCheck({ direction: 'out', amountCents: 7500 }), 7500);
    assert.equal(waitingOnCheck({ direction: 'in', amountCents: 7500 }), -7500);
  });
});

describe('Waiting at the start — a line before the starting statement (Q2-A, BC3b)', () => {
  const posts = [line('entry:o75', '2026-11-20', 'out', 7500), line('entry:i75', '2026-11-21', 'in', 7500)];
  const pre = [
    line('entry:chq', '2026-09-26', 'out', 50_000), line('entry:dep', '2026-09-27', 'in', 50_000),
    line('entry:near', '2026-09-28', 'out', 49_999),
  ];
  it('the bank showing LESS names a money-OUT cheque before the start (it cleared after; the start held it)', () => {
    const { hints } = hintsFor(-50_000, [], pre);
    assert.deepEqual(hints.map(h => [h.kind, h.lines[0].key]), [['atStart', 'entry:chq']]);
  });
  it('the bank showing MORE names a money-IN deposit before the start; exact only, never a half or a combination', () => {
    assert.deepEqual(hintsFor(50_000, [], pre).hints.map(h => [h.kind, h.lines[0].key]), [['atStart', 'entry:dep']]);
    assert.deepEqual(hintsFor(100_000, [], pre).hints, [], 'a half or a sum of lines before the start is never offered');
    assert.equal(closingDirectionAtStart(1), 'in');
    assert.equal(closingDirectionAtStart(-1), 'out');
    assert.equal(closingDirectionAtStart(0), null);
  });
  it('a check\'s own exact line comes first, then the one before the start, then the half', () => {
    const { hints } = hintsFor(-7500, [...posts, line('entry:half', '2026-11-10', 'in', 3750)], [line('entry:pre75', '2026-09-20', 'out', 7500)]);
    assert.deepEqual(hints.map(h => h.kind), ['exact', 'atStart', 'half']);
  });
  it('attaching it closes the gap: the start\'s books move by waitingOnStart (out −, in +), the opposite of a check\'s item', () => {
    const start = saved({ id: 's', kind: 'start', date: '2026-09-30', bankCents: 500_000, onItsWayCents: 0, waiting: [] });
    const chq: WaitingItem = { key: 'entry:chq', date: '2026-09-26', direction: 'out', amountCents: 50_000, atStart: true };
    const before = startBooks(start);
    const after = startBooks({ ...start, waiting: [chq] });
    assert.equal(after, before + waitingOnStart(chq));
    assert.equal(waitingOnStart(chq), -waitingOnCheck(chq));
    // Every later check: the books move with the start; the cleared cheque left the bank — now they agree.
    const movement = 10_000;
    const bank = before + movement - 50_000;
    assert.equal(figureCheck({ bankCents: bank, booksCents: before + movement, onItsWayCents: 0, waiting: [], cashCents: null }).offByCents, 50_000);
    assert.equal(figureCheck({ bankCents: bank, booksCents: after + movement, onItsWayCents: 0, waiting: [], cashCents: null }).result, 'matches');
  });
});

describe('coachBooksOnDate — Cash on hand with a date cutoff (P2\')', () => {
  it('the opening + settled cash-moving rows on or before the date', () => {
    const rows = [
      { date: '2026-09-01', moneyIn: 500, moneyOut: 0, movesCash: true, scheduled: false },
      { date: '2026-09-15', moneyIn: 0, moneyOut: 120.5, movesCash: true, scheduled: false },
      // A bill a family paid the vendor: no cash moved.
      { date: '2026-09-20', moneyIn: 0, moneyOut: 80, movesCash: false, scheduled: false },
      // After the statement date.
      { date: '2026-10-02', moneyIn: 0, moneyOut: 40, movesCash: true, scheduled: false },
      // Scheduled: not cash yet.
      { date: '2026-09-25', moneyIn: 300, moneyOut: 0, movesCash: true, scheduled: true },
      { date: null, moneyIn: 10, moneyOut: 0, movesCash: true, scheduled: false },
    ];
    assert.equal(coachBooksOnDate(rows, 100000, '2026-09-30'), 100000 + 50000 - 12050);
  });
});

describe('typedCents — what a treasurer types, in cents (BC2: the bracket form the product prints)', () => {
  const t = (s: string, positive = false) => typedCents(s, { positive });
  it('plain, dollar-signed and comma-grouped amounts', () => {
    assert.equal(t('5402.10'), 540_210);
    assert.equal(t('$5,402.10'), 540_210);
    assert.equal(t(' $ 12 '), 1_200);
    assert.equal(t('0'), 0);
    assert.equal(t('.5'), null, 'a bare fraction is not an amount');
  });
  it('an overdraft: a minus sign, the typographic minus, and the bracket form the product prints', () => {
    assert.equal(t('-12.40'), -1_240);
    assert.equal(t('−12.40'), -1_240);
    assert.equal(t('($50.00)'), -5_000);
    assert.equal(t('(50)'), -5_000);
    assert.equal(t('($1,284.50)'), -128_450);
    assert.equal(t('-($50.00)'), null, 'two minus signs is not a number');
    assert.equal(t('($-50.00)'), null);
    assert.equal(t('($50.00'), null, 'unbalanced bracket');
  });
  it('never a negative zero, never a third decimal, never words', () => {
    assert.ok(Object.is(t('-0'), 0) && Object.is(t('(0.00)'), 0));
    assert.equal(t('1.234'), null);
    assert.equal(t('abc'), null);
    assert.equal(t(''), null);
  });
  it('a decimal comma before exactly two digits (O4, BC3b); every other comma is a thousands group of three, or nothing', () => {
    assert.equal(t('12,50'), 1_250);
    assert.equal(t('$1250,00'), 125_000);
    assert.equal(t('-12,50'), -1_250);
    assert.equal(t('(12,50)'), -1_250);
    assert.equal(t('1,250'), 125_000, 'three digits after a comma: a thousands comma, never $1.25');
    assert.equal(t('1,234,567.89'), 123_456_789);
    assert.equal(t('12,5'), null);
    assert.equal(t('1,2,3'), null);
    assert.equal(t('12,50.10'), null);
    assert.equal(t('1,2500'), null);
  });
  it('positive demands more than zero (cash); too large is refused', () => {
    assert.equal(t('0', true), null);
    assert.equal(t('($5.00)', true), null);
    assert.equal(t('5', true), 500);
    assert.equal(t('9999999999999'), null);
  });
});

describe('savedTerms — an opened check’s sums, line by line (BC2b): the signs are the engine’s, never the screen’s', () => {
  const sum = (ts: ReturnType<typeof savedTerms>['terms']) => ts.reduce((n, t) => n + (t.cents ?? 0), 0);
  const items: WaitingItem[] = [
    { key: 'entry:chq', date: '2026-10-28', direction: 'out', amountCents: 41_200, label: 'Cheque 214' },
    { key: 'entry:dep', date: '2026-10-30', direction: 'in', amountCents: 7_500 },
  ];
  it('a check: books, on its way off, an out-item added back, an in-item off, cash off; the lines add to Should have been', () => {
    const c = saved({ id: 'c', date: '2026-10-31', bankCents: 500_000, booksCents: 520_000, onItsWayCents: 12_000, cashCents: 3_000, waiting: items });
    const { terms, totalCents } = savedTerms(c);
    assert.deepEqual(terms.map(t => [t.kind, t.cents]), [['base', 520_000], ['onItsWay', -12_000], ['waiting', 41_200], ['waiting', -7_500], ['cash', -3_000]]);
    assert.equal(totalCents, figureOfSaved(c).shouldBeCents);
    assert.equal(sum(terms), totalCents);
  });
  it('the start: the bank, on its way added, an out-item off, an in-item added; the lines add to the books it starts from', () => {
    const c = saved({ id: 's', kind: 'start', date: '2026-09-30', bankCents: 500_000, onItsWayCents: 12_000, waiting: items });
    const books = startBooks(c);
    const { terms, totalCents } = savedTerms({ ...c, booksCents: books });
    assert.deepEqual(terms.map(t => [t.kind, t.cents]), [['base', 500_000], ['onItsWay', 12_000], ['waiting', -41_200], ['waiting', 7_500]]);
    assert.equal(totalCents, books);
    assert.equal(sum(terms), totalCents);
  });
  it('a zero on-its-way and zero cash are left out; not counted stays as null; a start never shows cash', () => {
    assert.deepEqual(savedTerms(saved({ id: 'z', date: '2026-10-31', booksCents: 100, cashCents: 0 })).terms.map(t => t.kind), ['base']);
    const nc = savedTerms(saved({ id: 'n', date: '2026-10-31', booksCents: 100, onItsWayCents: null })).terms;
    assert.deepEqual(nc.map(t => [t.kind, t.cents]), [['base', 100], ['onItsWay', null]]);
    assert.deepEqual(savedTerms(saved({ id: 'sc', kind: 'start', date: '2026-09-30', bankCents: 100, booksCents: 100, cashCents: 500 })).terms.map(t => t.kind), ['base']);
  });
  it('the live sums take the same on-its-way sign: off the books on a check, so a negative (a refund) adds back', () => {
    assert.equal(onItsWayOnCheck(12_000), -12_000);
    assert.equal(onItsWayOnCheck(-2_500), 2_500);
  });
});
