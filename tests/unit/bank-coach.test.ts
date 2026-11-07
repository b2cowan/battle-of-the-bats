import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { figureCheck, type BankLine, type WaitingItem } from '../../lib/bank-check.ts';
import {
  checksBetween, checksInSeason, coachChecksNow, coachFind, coachHints, coachLineOf, coachLinesOf, coachMarkable, coachStillWaiting,
  LOOK_BACK_DAYS, needsLastSeason, seasonStartOf, type CoachRow, type LastSeason, type TeamSavedCheck,
} from '../../lib/bank-coach-map.ts';
import { coachCheckedThrough, coachFigureOn, coachSavePlan, coachSaveRefusal, type CoachSaveFacts } from '../../lib/bank-coach-rules.ts';
import { STATUS_OF } from '../../lib/bank-club-rules.ts';
import { BANK_REFUSAL } from '../../lib/bank-check-words.ts';
import { coachBooksOnDate } from '../../lib/bank-check.ts';

/**
 * Bank balance check BC6a — THE COACH'S FIGURE AND FIND (lib/bank-coach-map.ts, lib/bank-coach-rules.ts). P2' (Your books
 * = Cash on hand with a cutoff), ask 7 (the opening balance is the start), O5 (the season's start, "Two cases"), Q1 (last
 * season's lines after its last match, else its final 60 days, while this season has no match), ask 2 across the rollover,
 * ruling 3 (a check saves off), rule 6 (the figures are the server's). The drawing's Ridge 13U example first.
 */

const row = (id: string, date: string | null, over: Partial<CoachRow> = {}): CoachRow => ({
  id, date, description: `Row ${id}`, moneyIn: 0, moneyOut: 0, movesCash: true, scheduled: false, ...over,
});
const inRow = (id: string, date: string, dollars: number, over: Partial<CoachRow> = {}) => row(id, date, { moneyIn: dollars, ...over });
const outRow = (id: string, date: string, dollars: number, over: Partial<CoachRow> = {}) => row(id, date, { moneyOut: dollars, ...over });

const check = (id: string, date: string, bankCents: number, booksCents: number, over: Partial<TeamSavedCheck> = {}): TeamSavedCheck => ({
  id, kind: 'check', date, bankCents, booksCents, onItsWayCents: null, cashCents: null, waiting: [], bookIds: [],
  createdBy: 'coach-1', createdAt: `${date}T20:00:00.000Z`, correctedAt: null, ...over,
});
const item = (l: BankLine): WaitingItem => ({ key: l.key, date: l.date, direction: l.direction, amountCents: l.amountCents });

// ── Ridge 13U, the drawing (tab 2 + tab 4): opening $2,500.00, Your books on Oct 31 $3,240.00 ──────────────────────
const OPENING = 250_000;
const RIDGE: CoachRow[] = [
  inRow('dues-payment-1', '2026-09-07', 900),
  outRow('expense-2-payment-1', '2026-09-20', 340),
  inRow('dues-payment-3', '2026-10-30', 180),           // tab 4: $180 dues collected in cash
  outRow('expense-4-payment-1', '2026-11-02', 40),       // tab 4: the umpire, paid from that cash
  outRow('expense-5', '2026-11-15', 600, { scheduled: true }),          // not cash yet
  outRow('expense-6-payment-1', '2026-10-10', 125, { movesCash: false }), // a family paid the vendor
  row('expense-7', null, { moneyOut: 50 }),                               // an unpaid plain expense: no date
];

describe('the drawing: Ridge 13U (tab 2, tab 4)', () => {
  it('Your books on Oct 31 = $3,240.00 (the opening + settled cash-moving rows on or before the day)', () => {
    assert.equal(coachBooksOnDate(RIDGE, OPENING, '2026-10-31'), 324_000);
  });
  it('Oct 31: bank $3,060.00 + $180.00 cash not deposited yet → Should be in the bank $3,060.00, Matches', () => {
    const f = figureCheck({ bankCents: 306_000, booksCents: 324_000, onItsWayCents: null, waiting: [], cashCents: 18_000 });
    assert.equal(f.shouldBeCents, 306_000);
    assert.equal(f.result, 'matches');
  });
  it('Nov 30, the field blank: books −$40 umpire, bank +$140 deposited → $3,200.00 both, Matches', () => {
    const books = coachBooksOnDate(RIDGE, OPENING, '2026-11-30');
    assert.equal(books, 320_000);
    assert.equal(figureCheck({ bankCents: 306_000 + 14_000, booksCents: books, onItsWayCents: null, waiting: [], cashCents: null }).result, 'matches');
  });
});

describe('a register row as a bank line', () => {
  it('a settled row: its own cash movement, the row id as the key', () => {
    assert.deepEqual(coachLineOf(RIDGE[0]), { key: 'dues-payment-1', date: '2026-09-07', direction: 'in', amountCents: 90_000, label: 'Row dues-payment-1' });
    assert.equal(coachLineOf(RIDGE[1])!.direction, 'out');
  });
  it('never a scheduled row, a family-paid row, an undated row, or one moving nothing', () => {
    for (const r of [RIDGE[4], RIDGE[5], RIDGE[6], row('x', '2026-10-01')]) assert.equal(coachLineOf(r), null, r.id);
    assert.equal(coachLinesOf(RIDGE).length, 4);
  });
  it('a numeric column arriving as a string still reads to the cent', () => {
    assert.equal(coachLineOf(inRow('m', '2026-10-01', '12.40' as unknown as number))!.amountCents, 1_240);
  });
});

describe('O5: the season starts (owner 2026-11-06, "Two cases")', () => {
  const lines = coachLinesOf(RIDGE);
  it('a season Start next season handed cash: the day it was rolled into, whatever its rows say', () => {
    assert.equal(seasonStartOf({ createdDay: '2026-10-07', carried: true }, lines), '2026-10-07');
  });
  it('otherwise the earlier of its created day and its first recorded money (dev 15U AAA: created Oct 7, money Sep 7)', () => {
    assert.equal(seasonStartOf({ createdDay: '2026-10-07', carried: false }, lines), '2026-09-07');
    assert.equal(seasonStartOf({ createdDay: '2026-08-15', carried: false }, lines), '2026-08-15');
    assert.equal(seasonStartOf({ createdDay: '2026-08-15', carried: false }, []), '2026-08-15');
  });
  it('a statement before the start is refused, on the start is not; after today is refused first', () => {
    assert.equal(coachSaveRefusal({ date: '2026-09-06', today: '2026-11-06', seasonStart: '2026-09-07' }), 'before_season');
    assert.equal(coachSaveRefusal({ date: '2026-09-07', today: '2026-11-06', seasonStart: '2026-09-07' }), null);
    assert.equal(coachSaveRefusal({ date: '2026-11-07', today: '2026-11-06', seasonStart: '2026-09-07' }), 'ends_in_future');
  });
  it('the refusals have their words and their statuses', () => {
    for (const c of ['before_season', 'bad_team_item'] as const) { assert.ok(BANK_REFUSAL[c].length > 20); assert.ok(STATUS_OF[c]); }
    assert.doesNotMatch(BANK_REFUSAL.before_season, /last season/i, 'a closed season is one page with no bank: never send the coach there');
  });
});

describe('B10 / §9 BC6: the working season only', () => {
  const all = [check('old', '2026-08-31', 100_000, 100_000), check('a', '2026-09-30', 320_000, 320_000), check('b', '2026-10-31', 306_000, 307_240)];
  it('a check dated before the start is another season\'s and is never in the list', () => {
    assert.deepEqual(checksInSeason(all, '2026-09-07').map(c => c.id), ['a', 'b']);
    assert.deepEqual(checksBetween(all, '2025-09-01', '2026-09-07').map(c => c.id), ['old']);
  });
  it('checked through = the working season\'s latest (Off by $12.40), null before its first', () => {
    assert.deepEqual(coachCheckedThrough(all, '2026-09-07'), { id: 'b', date: '2026-10-31', result: 'off', offByCents: 1_240 });
    assert.equal(coachCheckedThrough(all.slice(0, 1), '2026-09-07'), null);
  });
  it('Books now say re-figures each check over the working register as it reads now (ask 6)', () => {
    const saved = [check('a', '2026-10-31', 324_000, 324_000), check('b', '2026-09-30', 0, 255_000)];
    const now = coachChecksNow(saved, RIDGE, OPENING);
    assert.equal(now[0].booksNowSayCents, null);
    assert.equal(now[1].booksNowSayCents, 306_000); // $2,500 + $900 − $340: the books moved since it was saved
    assert.ok(now.every(c => c.startCorrected === false));
  });
});

// ── Find: ask 3 + Q1 ────────────────────────────────────────────────────────────────────────
const START = '2026-09-07';
const LINES = coachLinesOf(RIDGE);
const LAST_LINES: BankLine[] = [
  { key: 'expense-90-payment-1', date: '2026-08-20', direction: 'out', amountCents: 7_500, label: 'Cheque 214, umpires' },
  { key: 'dues-payment-91', date: '2026-08-01', direction: 'in', amountCents: 20_000, label: 'Dues' },
  { key: 'expense-92-payment-1', date: '2026-06-01', direction: 'out', amountCents: 3_300, label: 'Old line' },
];
const last = (checks: TeamSavedCheck[] = []): LastSeason => ({ name: '2025 Season', start: '2025-09-01', lines: LAST_LINES, checks });

describe('Find (ask 3): every line of the season on a first check, since the last MATCH after', () => {
  it('a first check: every line on or before D, the start\'s own day included, newest first', () => {
    const f = coachFind({ date: '2026-10-31', start: START, lines: LINES, checks: [], last: null });
    assert.deepEqual(f.lines.map(l => l.key), ['dues-payment-3', 'expense-2-payment-1', 'dues-payment-1']);
    assert.equal(f.since, START);
    assert.equal(f.sinceMatch, false);
  });
  it('a rolled season\'s row dated before the rollover still counts on its first check', () => {
    const f = coachFind({ date: '2026-10-31', start: '2026-09-15', lines: LINES, checks: [], last: null });
    assert.ok(f.lines.some(l => l.key === 'dues-payment-1'));
  });
  it('after a check that MATCHED: only the lines after it; an off check moves nothing', () => {
    const matched = check('m', '2026-09-30', 306_000, 306_000);
    const off = check('o', '2026-10-15', 300_000, 306_000);
    const f = coachFind({ date: '2026-10-31', start: START, lines: LINES, checks: [matched, off], last: null });
    assert.deepEqual(f.lines.map(l => l.key), ['dues-payment-3']);
    assert.equal(f.since, '2026-09-30');
    assert.equal(f.sinceMatch, true);
  });
});

describe('Q1: last season\'s lines while this season has no match (owner 2026-11-06, "Carried-from, else 60 days")', () => {
  it('last season never matched: its final 60 days before the start', () => {
    const f = coachFind({ date: '2026-10-31', start: START, lines: LINES, checks: [], last: last() });
    assert.equal(LOOK_BACK_DAYS, 60);
    assert.equal(f.lastSeason!.after, '2026-07-09');
    assert.equal(f.lastSeason!.name, '2025 Season');
    assert.deepEqual(f.lastSeason!.lines.map(l => l.key), ['expense-90-payment-1', 'dues-payment-91']);
    assert.equal(f.lastSeason!.sinceMatch, false);
  });
  it('last season matched on Aug 10: its lines after that check', () => {
    const f = coachFind({ date: '2026-10-31', start: START, lines: LINES, checks: [], last: last([check('l', '2026-08-10', 1, 1)]) });
    assert.deepEqual(f.lastSeason!.lines.map(l => l.key), ['expense-90-payment-1']);
    assert.equal(f.lastSeason!.sinceMatch, true);
  });
  it('this season matched before D: no look-back (and the reader needn\'t read last season)', () => {
    const working = [check('m', '2026-09-30', 306_000, 306_000)];
    assert.equal(coachFind({ date: '2026-10-31', start: START, lines: LINES, checks: working, last: last() }).lastSeason, null);
    assert.equal(needsLastSeason(working, '2026-10-31', LINES), false);
    assert.equal(needsLastSeason(working, '2026-09-30', LINES), true, 'a re-check of the match\'s own day reads before it');
    assert.equal(needsLastSeason([check('o', '2026-09-30', 1, 2)], '2026-10-31', LINES), true, 'an off check is no match');
  });
  it('no cash carried in: no "last season" at all', () => {
    assert.equal(coachFind({ date: '2026-10-31', start: START, lines: LINES, checks: [], last: null }).lastSeason, null);
  });
  it('THE SIGN: last season\'s uncashed $75.00 cheque leaves the bank $75.00 MORE than the books, and Find names it', () => {
    // The opening already took the cheque out (Cash on hand carried it), the bank still holds it.
    const books = coachBooksOnDate(RIDGE, OPENING, '2026-10-31');
    const f = figureCheck({ bankCents: books + 7_500, booksCents: books, onItsWayCents: null, waiting: [], cashCents: null });
    assert.equal(f.direction, 'bank_more');
    const find = coachFind({ date: '2026-10-31', start: START, lines: LINES, checks: [], last: last() });
    const h = coachHints(f.differenceCents, find, new Set());
    assert.deepEqual(h.hints.map(x => x.key), ['exact:expense-90-payment-1']);
    // Marked Not in the bank yet on this check, it closes the gap with the check's own sign.
    const marked = figureCheck({ bankCents: books + 7_500, booksCents: books, onItsWayCents: null, waiting: [item(LAST_LINES[0])], cashCents: null });
    assert.equal(marked.result, 'matches');
  });
  it('a line already marked is no hint', () => {
    const find = coachFind({ date: '2026-10-31', start: START, lines: LINES, checks: [], last: last() });
    assert.deepEqual(coachHints(7_500, find, new Set(['expense-90-payment-1'])).hints, []);
  });
});

describe('Still waiting? across the rollover (owner 2026-11-06)', () => {
  const cheque = LAST_LINES[0];
  // Matched WITH the cheque marked: the bank still held the $75.00 the books had paid out.
  const final = check('final', '2026-08-31', 115_000, 107_500, { waiting: [item(cheque)] });
  it('(the fixture: the final check matched)', () => {
    assert.equal(figureCheck({ bankCents: final.bankCents, booksCents: final.booksCents, onItsWayCents: null, waiting: final.waiting, cashCents: null }).result, 'matches');
  });
  it('the first check of the new season asks about last season\'s final check\'s items', () => {
    const asked = coachStillWaiting({ date: '2026-09-30', checks: [], last: last([check('aug', '2026-08-10', 1, 1), final]) });
    assert.deepEqual(asked.map(w => w.key), [cheque.key]);
  });
  it('…and it is markable although it sits before the look-back (the final check matched)', () => {
    const l = last([final]);
    const find = coachFind({ date: '2026-09-30', start: START, lines: LINES, checks: [], last: l });
    assert.equal(find.lastSeason!.after, '2026-08-31');
    assert.ok(!find.lastSeason!.lines.some(x => x.key === cheque.key));
    const stillWaiting = coachStillWaiting({ date: '2026-09-30', checks: [], last: l });
    assert.ok(coachMarkable({ date: '2026-09-30', lines: LINES, find, stillWaiting, last: l }).has(cheque.key));
  });
  it('after the season\'s first check, the chain is this season\'s', () => {
    const sep = check('sep', '2026-09-30', 1, 2, { waiting: [item(LINES[1])] });
    assert.deepEqual(coachStillWaiting({ date: '2026-10-31', checks: [sep], last: last([final]) }).map(w => w.key), [LINES[1].key]);
  });
  it('/review: last season\'s cheque kept on a MATCHED working check is still markable on the next check', () => {
    // Oct 31 matched with cheque 214 marked; Nov 30 asks "Still waiting?" about it, and a yes must save.
    const oct = check('oct', '2026-10-31', 324_000 + 7_500, 324_000, { waiting: [item(cheque)] });
    assert.equal(figureCheck({ bankCents: oct.bankCents, booksCents: oct.booksCents, onItsWayCents: null, waiting: oct.waiting, cashCents: null }).result, 'matches');
    assert.equal(needsLastSeason([oct], '2026-11-30', LINES), true, 'the asked line is last season\'s: the reader must read it');
    assert.equal(needsLastSeason([check('m', '2026-10-31', 1, 1)], '2026-11-30', LINES), false, 'nothing of last season asked: no read');
    const l = last([final]);
    const find = coachFind({ date: '2026-11-30', start: START, lines: LINES, checks: [oct], last: l });
    assert.equal(find.lastSeason, null, 'no look-back once this season matched');
    const stillWaiting = coachStillWaiting({ date: '2026-11-30', checks: [oct], last: l });
    assert.deepEqual(stillWaiting.map(w => w.key), [cheque.key]);
    const markable = coachMarkable({ date: '2026-11-30', lines: LINES, find, stillWaiting, last: l });
    const r = coachSavePlan({ date: '2026-11-30', body: { bankCents: 1, waiting: [cheque.key] },
      facts: { today: '2026-12-01', seasonStart: START, booksCents: 320_000, markable } });
    assert.ok(r.ok);
  });
  it('no carry: nothing from last season is asked', () => {
    assert.deepEqual(coachStillWaiting({ date: '2026-09-30', checks: [], last: null }), []);
  });
});

// ── the save (ruling 3, ask 1, rule 6) ──────────────────────────────────────────────────────
const markable = coachMarkable({
  date: '2026-10-31', lines: LINES, find: coachFind({ date: '2026-10-31', start: START, lines: LINES, checks: [], last: last() }),
  stillWaiting: [], last: last(),
});
const facts: CoachSaveFacts = { today: '2026-11-06', seasonStart: START, booksCents: 324_000, markable };
const save = (body: Record<string, unknown>) => coachSavePlan({ date: '2026-10-31', body, facts });

describe('coachSavePlan', () => {
  it('saves OFF as well as matching (ruling 3), as a check with no book ids, no on its way', () => {
    const r = save({ bankCents: 300_000 });
    assert.ok(r.ok);
    assert.deepEqual(r.args, { kind: 'check', date: '2026-10-31', bankCents: 300_000, booksCents: 324_000, onItsWayCents: null,
      cashCents: null, bookIds: null, waiting: [] });
  });
  it('the items\' figures are the server\'s line, never the client\'s; a key twice is one item', () => {
    const r = save({ bankCents: 300_000, waiting: ['dues-payment-3', 'expense-90-payment-1', 'dues-payment-3'] });
    assert.ok(r.ok);
    assert.deepEqual(r.args.waiting, [
      { key: 'dues-payment-3', date: '2026-10-30', direction: 'in', amountCents: 18_000, label: 'Row dues-payment-3' },
      { key: 'expense-90-payment-1', date: '2026-08-20', direction: 'out', amountCents: 7_500, label: 'Cheque 214, umpires' },
    ]);
  });
  it('refuses a line that isn\'t markable on D: after D, scheduled, family-paid, older than the look-back, not the team\'s', () => {
    for (const k of ['expense-4-payment-1', 'expense-5', 'expense-6-payment-1', 'expense-92-payment-1', 'expense-of-another-team', 7, null]) {
      const r = save({ bankCents: 1, waiting: [k] });
      assert.ok(!r.ok && r.code === 'bad_team_item', String(k));
    }
    const notList = save({ bankCents: 1, waiting: 'dues-payment-3' });
    assert.ok(!notList.ok && notList.code === 'bad_team_item');
  });
  it('/review: the plan re-checks the date itself, whoever built the facts (the step can\'t see a season)', () => {
    for (const [date, code] of [['2026-09-01', 'before_season'], ['2026-11-07', 'ends_in_future'], ['2026-02-30', 'bad_date'], ['1999-12-31', 'bad_date']] as const) {
      const r = coachSavePlan({ date, body: { bankCents: 1 }, facts });
      assert.ok(!r.ok && r.code === code, date);
    }
  });
  it('the cash figure: above $0.00 or none; the balance may be overdrawn; a missing balance is refused', () => {
    assert.ok(save({ bankCents: -5_000, cashCents: 18_000 }).ok);
    assert.equal((save({ bankCents: 1, cashCents: 0 }) as { args: { cashCents: unknown } }).args.cashCents, null);
    for (const cashCents of [-1, 1.5, '18000']) {
      const r = save({ bankCents: 1, cashCents });
      assert.ok(!r.ok && r.code === 'bad_amount', String(cashCents));
    }
    const r = save({});
    assert.ok(!r.ok && r.code === 'bad_figures');
  });
});

describe('coachFigureOn: the day\'s figure and what its save stands on', () => {
  const base = { today: '2026-11-06', seasonStart: START, openingCents: OPENING, rows: RIDGE, lines: LINES, checks: [] as TeamSavedCheck[] };
  it('Oct 31: books $3,240.00, every line of the season, last season under its own name', () => {
    const { figure, facts: f } = coachFigureOn({ ...base, date: '2026-10-31', last: last() });
    assert.equal(figure.booksCents, 324_000);
    assert.equal(figure.suspects.total, 3);
    assert.equal(figure.lastSeason!.name, '2025 Season');
    assert.equal(figure.lastSeason!.total, 2);
    assert.equal(f!.booksCents, 324_000);
    assert.equal(figure.refused, null);
  });
  it('a day before the season: refused, no books, nothing to save', () => {
    const { figure, facts: f } = coachFigureOn({ ...base, date: '2026-09-01', last: last() });
    assert.equal(figure.refused, 'before_season');
    assert.equal(figure.booksCents, null);
    assert.equal(f, null);
  });
  it('the live check of the day is the one a save replaces', () => {
    const { figure } = coachFigureOn({ ...base, checks: [check('x', '2026-10-31', 1, 1)], date: '2026-10-31', last: null });
    assert.equal(figure.replaces, 'x');
  });
});
