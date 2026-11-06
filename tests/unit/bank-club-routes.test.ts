import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkView, checkedThrough, pickerSearch, readCents, readDay, refusalOfDbError, refusalOfStep, savePlan, saveRefusal, STATUS_OF,
  waitingIdsOf, type SaveFacts,
} from '../../lib/bank-club-rules.ts';
import type { ClubSavedCheck, EntryRow, OnItsWay } from '../../lib/bank-club-map.ts';
import { BANK_REFUSAL } from '../../lib/bank-check-words.ts';
import { readFileSync } from 'node:fs';

/**
 * Bank balance check BC1 — THE ROUTES, DECIDED (lib/bank-club-rules.ts). The client sends intent (a date, a balance, the
 * lines not in the bank yet, the cash); the server has read the account; these are what the save step writes or refuses.
 * Ruling 3 (a check saves matching or not), ask 1 (cash is a figure only), ask 7 (the start is a date and a balance),
 * rule 6 (every figure but the balance and the cash is the server's).
 */

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const entry = (n: number, over: Partial<EntryRow> = {}): EntryRow => ({
  id: U(n), ledger_id: 'general', entry_date: '2026-10-28', description: ` Cheque #${n} `, amount: '75.00', entry_type: 'expense',
  status: 'posted', linked_entry_id: null, payment_method: null, ...over,
});
const none: OnItsWay = { state: 'none', cents: 0, lines: [] };
const facts = (over: Partial<SaveFacts> = {}): SaveFacts => ({
  booksCents: 825_553, onItsWay: { state: 'counted', cents: 41_200, lines: [], paysOutOn: null },
  bookIds: ['general', 'tourney'], ...over,
});
const plan = (body: Record<string, unknown>, f: Partial<SaveFacts> = {}, entries: EntryRow[] = [], kind: 'start' | 'check' = 'check') =>
  savePlan({ kind, date: '2026-10-31', body, facts: facts(f), entries });

describe('ruling 3: a check saves whether it matches or not', () => {
  it('Off by $75.00 saves: the step gets the server\'s books and on its way, the typed balance, no difference', () => {
    const p = plan({ bankCents: 791_853 });
    assert.ok(p.ok);
    if (!p.ok) return;
    assert.deepEqual(p.args, { kind: 'check', date: '2026-10-31', bankCents: 791_853, booksCents: 825_553, onItsWayCents: 41_200,
      cashCents: null, bookIds: ['general', 'tourney'], waiting: [] });
  });
  it('a request\'s own books, on its way or difference are never read (rule 6)', () => {
    const p = plan({ bankCents: 1, booksCents: 1, onItsWayCents: 1, differenceCents: 0 });
    assert.ok(p.ok && p.args.booksCents === 825_553 && p.args.onItsWayCents === 41_200);
  });
  it('on its way NOT counted saves as NULL, never 0', () => {
    const p = plan({ bankCents: 1 }, { onItsWay: { state: 'not_counted', reason: 'stripe_down', cents: null, lines: [] } });
    assert.ok(p.ok && p.args.onItsWayCents === null);
    const q = plan({ bankCents: 1 }, { onItsWay: none });
    assert.ok(q.ok && q.args.onItsWayCents === 0);
  });
  it('a balance that is not integer cents is bad_figures; an overdraft is fine', () => {
    assert.deepEqual(plan({ bankCents: 12.5 }), { ok: false, status: 400, code: 'bad_figures' });
    assert.ok(plan({ bankCents: -2_500 }).ok);
  });
});

describe('Not in the bank yet: figures from the books, never the request (ask 2, rule 6)', () => {
  it('the line\'s date, words, amount and direction are the book\'s', () => {
    const p = plan({ bankCents: 1, waiting: [`entry:${U(214)}`, `entry:${U(214)}`] }, {}, [entry(214)]);
    assert.ok(p.ok);
    if (!p.ok) return;
    assert.deepEqual(p.args.waiting, [{ key: `entry:${U(214)}`, date: '2026-10-28', label: 'Cheque #214', amountCents: 7_500, direction: 'out' }]);
  });
  it('a line not posted, in another account\'s book, dated after the statement, unread, or on its way is bad_item', () => {
    const bad = (e: EntryRow, f: Partial<SaveFacts> = {}) => plan({ bankCents: 1, waiting: [`entry:${e.id}`] }, f, [e]);
    assert.equal((bad(entry(1, { status: 'pending' })) as { code: string }).code, 'bad_item');
    assert.equal((bad(entry(2, { ledger_id: 'casino' })) as { code: string }).code, 'bad_item');
    assert.equal((bad(entry(3, { entry_date: '2026-11-01' })) as { code: string }).code, 'bad_item');
    assert.equal((plan({ bankCents: 1, waiting: [`entry:${U(4)}`] }) as { code: string }).code, 'bad_item');
    assert.equal((plan({ bankCents: 1, waiting: ['typed:x'] }) as { code: string }).code, 'bad_item');
    const onWay: OnItsWay = { state: 'counted', cents: 100, paysOutOn: null, lines: [{ key: `entry:${U(5)}`, date: '2026-10-30', label: 'x',
      direction: 'in', amountCents: 100, bookId: 'general', rail: 'card', paysOutOn: null }] };
    assert.equal((bad(entry(5, { entry_type: 'income' }), { onItsWay: onWay }) as { code: string }).code, 'bad_item');
    // Stripe didn't answer: nothing is counted as on its way, so the same line may be marked Not in the bank yet.
    const down: OnItsWay = { state: 'not_counted', reason: 'stripe_down', cents: null, lines: onWay.lines };
    assert.ok(bad(entry(5, { entry_type: 'income' }), { onItsWay: down }).ok);
  });
  it('only entry:{uuid} keys are looked up, at most one past the cap', () => {
    assert.deepEqual(waitingIdsOf([`entry:${U(1)}`, 'entry:not-a-uuid', 7, `typed:${U(2)}`]), [U(1)]);
    assert.deepEqual(waitingIdsOf('entry:x'), []);
  });
});

describe('cash (ask 1) and the start (ask 7)', () => {
  it('cash is a positive figure on a check; 0 or empty is none', () => {
    const p = plan({ bankCents: 306_000, cashCents: 18_000 });
    assert.ok(p.ok && p.args.cashCents === 18_000);
    for (const empty of [0, null, undefined]) { const q = plan({ bankCents: 1, cashCents: empty }); assert.ok(q.ok && q.args.cashCents === null); }
    assert.equal((plan({ bankCents: 1, cashCents: -5 }) as { code: string }).code, 'bad_amount');
  });
  it('the start: its books are the bank solved (− a cheque waiting at the start), no cash, its own kind', () => {
    const p = plan({ bankCents: 500_000, waiting: [`entry:${U(188)}`] }, { booksCents: null, onItsWay: none },
      [entry(188, { entry_date: '2026-06-28' })], 'start');
    assert.ok(p.ok);
    if (!p.ok) return;
    assert.equal(p.args.kind, 'start');
    assert.equal(p.args.booksCents, 492_500);
    assert.equal((plan({ bankCents: 1, cashCents: 100 }, { booksCents: null }, [], 'start') as { code: string }).code, 'bad_amount');
  });
});

describe("the date rules, before any figure is read (saveRefusal: bank_check_save's order)", () => {
  const start = { kind: 'start' as const, date: '2026-09-30' };
  const sep = { kind: 'check' as const, date: '2026-10-15' };
  const r = (asked: 'start' | 'check', date: string, checks: { kind: 'start' | 'check'; date: string }[]) =>
    saveRefusal({ asked, date, today: '2026-11-05', checks });
  it("never after the club's today, whatever the door", () => {
    assert.equal(r('check', '2026-11-06', [start]), 'ends_in_future');
    assert.equal(r('start', '2026-11-06', []), 'ends_in_future');
  });
  it('a check: no start is no_start; on or before the start is before_start (O2); after it is fine', () => {
    assert.equal(r('check', '2026-10-31', []), 'no_start');
    assert.equal(r('check', '2026-09-30', [start]), 'before_start');
    assert.equal(r('check', '2026-09-01', [start]), 'before_start');
    assert.equal(r('check', '2026-10-31', [start, sep]), null);
  });
  it('a start: another date is start_exists; its own date replaces it; never on or after a live check', () => {
    assert.equal(r('start', '2026-09-29', [start]), 'start_exists');
    assert.equal(r('start', '2026-09-30', [start]), null);
    assert.equal(r('start', '2026-10-20', [sep]), 'start_after_checks');
    assert.equal(r('start', '2026-09-30', []), null);
  });
});

describe('what the list shows', () => {
  const c = (id: string, kind: 'start' | 'check', date: string, bank: number, books: number, extra: Partial<ClubSavedCheck> = {}) =>
    ({ id, kind, date, bankCents: bank, booksCents: books, onItsWayCents: 0, cashCents: null, waiting: [], bookIds: [],
      createdBy: 'u1', createdAt: `${date}T12:00:00Z`, ...extra });
  it('a saved check\'s band from its own figures, its "Books now say", who checked it', () => {
    const v = checkView({ ...c('oct', 'check', '2026-10-31', 791_853, 825_553, { onItsWayCents: 41_200 }), booksNowSayCents: 817_553 },
      id => (id === 'u1' ? 'Dana' : null));
    assert.deepEqual([v.figure.result, v.figure.offByCents, v.figure.shouldBeCents, v.booksNowSayCents, v.checkedBy],
      ['off', 7_500, 784_353, 817_553, 'Dana']);
  });
  it('checked through = the latest CHECK (never the start), with its result', () => {
    assert.equal(checkedThrough([c('s', 'start', '2026-08-31', 5, 5)]), null);
    assert.deepEqual(checkedThrough([c('s', 'start', '2026-08-31', 5, 5), c('sep', 'check', '2026-09-30', 10, 10), c('oct', 'check', '2026-10-31', 12, 10)]),
      { date: '2026-10-31', result: 'off', offByCents: 2 });
  });
});

describe('Find\'s search, by shape (BC3 reuses it)', () => {
  it('all digits: a cheque number or an amount, both searched', () => {
    assert.deepEqual(pickerSearch(' 1234 '), { kind: 'either', amount: 1234, words: '1234' });
  });
  it('a dollar sign or a decimal: an amount only; words: the description; nothing typed: everything', () => {
    assert.deepEqual(pickerSearch('$12'), { kind: 'amount', amount: 12 });
    assert.deepEqual(pickerSearch('12.50'), { kind: 'amount', amount: 12.5 });
    assert.deepEqual(pickerSearch('Cheque 1234'), { kind: 'words', words: 'Cheque 1234' });
    assert.deepEqual(pickerSearch('   '), { kind: 'none' });
  });
});

describe('refusals are codes', () => {
  it('every code has words and exactly one status', () => {
    assert.deepEqual(Object.keys(STATUS_OF).sort(), Object.keys(BANK_REFUSAL).sort());
    for (const s of Object.values(STATUS_OF)) assert.ok([400, 404, 409].includes(s));
  });
  it('a step\'s unknown code reads as changed (read again)', () => {
    assert.equal(refusalOfStep('before_start'), 'before_start');
    assert.equal(refusalOfStep('not_a_code'), 'changed');
    assert.equal(refusalOfStep(undefined), 'changed');
  });
  it('the database\'s refusals map to codes; anything else is a real failure', () => {
    assert.equal(refusalOfDbError({ message: 'bank_step_refused:bad_item' }), 'bad_item');
    assert.equal(refusalOfDbError({ message: 'bank_book_is_team_book' }), 'team_book');
    assert.equal(refusalOfDbError({ message: 'bank_book_other_club' }), 'book_not_found');
    assert.equal(refusalOfDbError({ message: 'bank_book_not_club_account' }), 'account_not_found');
    assert.equal(refusalOfDbError({ code: '23505', message: 'duplicate key value violates unique constraint "bank_accounts_club_name"' }), 'name_taken');
    assert.equal(refusalOfDbError({ code: '23505', message: 'duplicate key value violates unique constraint "bank_check_waiting_once"' }), 'bad_item');
    assert.equal(refusalOfDbError({ code: '23505', message: 'duplicate key value violates unique constraint "bank_checks_one_live_per_date"' }), 'changed');
    assert.equal(refusalOfDbError({ message: 'connection reset' }), null);
  });
  it('request figures: integer cents, a real calendar day', () => {
    assert.equal(readCents(-1250, { positive: false }), -1250);
    assert.equal(readCents(-1250, { positive: true }), null);
    assert.equal(readCents(12.5, { positive: false }), null);
    assert.equal(readCents('100', { positive: false }), null);
    assert.equal(readDay('2026-02-29'), null);
    assert.equal(readDay('2028-02-29'), '2028-02-29');
    assert.equal(readDay('2026-10-31T00:00'), null);
  });
});

describe('BC1 loose ends: the date floor, the label cut, a body that is not an object', () => {
  it('a statement date before 2000-01-01 is not a day the server takes (0202-10-31 was once a start)', () => {
    assert.equal(readDay('0202-10-31'), null);
    assert.equal(readDay('1999-12-31'), null);
    assert.equal(readDay('2000-01-01'), '2000-01-01');
    assert.equal(readDay('2026-02-30'), null, 'a real calendar day still');
    assert.equal(readDay(20261031), null);
  });
  it('a waiting item\'s label is cut by characters, never mid-emoji', () => {
    const emoji = '😀'.repeat(201); // 402 UTF-16 units, 201 characters
    const p = savePlan({ kind: 'check', date: '2026-10-31', body: { bankCents: 1, waiting: [`entry:${U(9)}`] }, facts: {
      booksCents: 0, bookIds: ['general'], onItsWay: { state: 'none', cents: 0, lines: [] } }, entries: [entry(9, { description: emoji })] });
    assert.ok(p.ok);
    const label = p.args.waiting[0].label!;
    assert.equal(Array.from(label).length, 200);
    assert.equal(label, '😀'.repeat(200));
    assert.ok(!/[\uD800-\uDBFF]$/.test(label), 'no lone high surrogate at the cut');
  });
  it('every bank write route reads its body through bankBody (a JSON null is a coded refusal, not a 500)', () => {
    const dir = 'app/api/admin/accounting/bank';
    const writes = ['route.ts', 'accounts/[accountId]/route.ts', 'accounts/[accountId]/setup/route.ts',
      'accounts/[accountId]/books/route.ts', 'accounts/[accountId]/checks/route.ts'];
    for (const f of writes) {
      const src = readFileSync(`${dir}/${f}`, 'utf8');
      assert.match(src, /await bankBody\(req\)/, f);
      assert.doesNotMatch(src, /req\.json\(\)/, `${f}: reads its own body`);
    }
  });
});
