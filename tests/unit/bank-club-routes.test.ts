import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BankAccountState, BankCheckRecord, BankLine, BankMark } from '../../lib/bank-check.ts';
import type { EntryRow, PayoutGapFacts } from '../../lib/bank-club-map.ts';
import { withAddedMembers } from '../../lib/bank-club-map.ts';
import { evaluateCheck } from '../../lib/bank-check.ts';
import {
  checkSummaries, keptOutPlan, markPlan, openingPlan, payoutGapViews, readCents, readDay, refusalOfDbError, refusalOfStep,
  statusOfRefusal, tickPlan, undoPlan,
} from '../../lib/bank-club-rules.ts';
import { BANK_REFUSAL } from '../../lib/bank-check-words.ts';

/**
 * Bank reconciliation R2b — THE ROUTES, DECIDED (lib/bank-club-rules.ts). The client sends intent; these are the rows a
 * route writes or the code it refuses with. The R1 review's rules the database does NOT enforce are held here: rule 2
 * (a checked statement's figures — the SQL half is in bank-r2-server-guard), rule 3 (a payout and its members together),
 * rule 4 (Mark checked replaces the ticks), rule 5 (a typed key is minted by the database, never sent), rule 6 (the
 * Difference recomputed on the server).
 */

const line = (key: string, date: string, direction: 'in' | 'out', amountCents: number, over: Partial<BankLine> = {}): BankLine =>
  ({ key, date, direction, amountCents, status: 'posted', ...over });
const mark = (key: string, checkId: string, date: string, direction: 'in' | 'out', amountCents: number, payoutKey?: string): BankMark =>
  ({ key, checkId, date, direction, amountCents, ...(payoutKey ? { payoutKey } : {}) });
const check = (id: string, end: string, endingCents: number, over: Partial<BankCheckRecord> = {}): BankCheckRecord =>
  ({ id, statementEndDate: end, statementEndingBalanceCents: endingCents, status: 'open', ...over });

const A = line('entry:a', '2026-09-05', 'in', 20_000);
const B = line('entry:b', '2026-09-10', 'out', 5_000);
const P1 = line('entry:p1', '2026-09-12', 'in', 10_000, { payoutKey: 'payout:po_1' });
const P2 = line('entry:p2', '2026-09-13', 'in', 5_000, { payoutKey: 'payout:po_1' });
const LATE = line('entry:late', '2026-10-05', 'in', 1_000);
const PO = { key: 'payout:po_1', arrivalDate: '2026-09-15', amountCents: 15_000 };
/** $1,000.00 at Aug 31; everything ticked = $1,300.00 at Sep 30. */
const state = (over: Partial<BankAccountState> = {}): BankAccountState => ({
  setup: { openingDate: '2026-08-31', openingBalanceCents: 100_000 },
  lines: [A, B, P1, P2, LATE], payouts: [PO], checks: [check('c1', '2026-09-30', 130_000)], marks: [], ...over,
});

describe('rule 3: a payout tick and its members are written and removed together', () => {
  it('ticking a payout writes its tick and one per member line, each naming the payout', () => {
    const p = tickPlan(state(), 'c1', 'payout:po_1', true);
    assert.ok(p.ok);
    assert.deepEqual(p.insert.map(m => [m.key, m.payoutKey ?? null]).sort(),
      [['entry:p1', 'payout:po_1'], ['entry:p2', 'payout:po_1'], ['payout:po_1', null]]);
    assert.deepEqual(p.remove, []);
  });
  it('a member already ticked on its own (Stripe was down) is not written twice', () => {
    const s = state({ marks: [mark('entry:p1', 'c1', P1.date, 'in', 10_000)] });
    const p = tickPlan(s, 'c1', 'payout:po_1', true);
    assert.ok(p.ok);
    assert.deepEqual(p.insert.map(m => m.key).sort(), ['entry:p2', 'payout:po_1']);
  });
  it('unticking the payout removes it and every member it stamped', () => {
    const s = state({ marks: [mark('payout:po_1', 'c1', PO.arrivalDate, 'in', 15_000), mark('entry:p1', 'c1', P1.date, 'in', 10_000, 'payout:po_1'),
      mark('entry:p2', 'c1', P2.date, 'in', 5_000, 'payout:po_1'), mark('entry:a', 'c1', A.date, 'in', 20_000)] });
    const p = tickPlan(s, 'c1', 'payout:po_1', false);
    assert.ok(p.ok);
    assert.deepEqual(p.remove.sort(), ['entry:p1', 'entry:p2', 'payout:po_1']);
  });
  it('unticking a stamped member while Stripe is down removes the whole group, not the member alone', () => {
    const s = state({ payouts: [], marks: [mark('payout:po_1', 'c1', PO.arrivalDate, 'in', 15_000),
      mark('entry:p1', 'c1', P1.date, 'in', 10_000, 'payout:po_1'), mark('entry:p2', 'c1', P2.date, 'in', 5_000, 'payout:po_1')] });
    const p = tickPlan(s, 'c1', 'entry:p1', false);
    assert.ok(p.ok);
    assert.deepEqual(p.remove.sort(), ['entry:p1', 'entry:p2', 'payout:po_1']);
  });
  it('a plain line ticks alone and keeps no payout link', () => {
    const p = tickPlan(state({ payouts: [] }), 'c1', 'entry:p1', true);
    assert.ok(p.ok);
    assert.deepEqual(p.insert, [{ key: 'entry:p1', checkId: 'c1', date: P1.date, direction: 'in', amountCents: 10_000 }]);
  });
});

describe('ticks are intent: the server decides what is tickable', () => {
  it('a line waiting for the next statement is refused', () => {
    const p = tickPlan(state(), 'c1', 'entry:late', true);
    assert.deepEqual(p, { ok: false, status: 409, code: 'not_outstanding' });
  });
  it('a key the account does not hold is refused', () => {
    assert.equal((tickPlan(state(), 'c1', 'entry:someone-elses', true) as { code: string }).code, 'not_outstanding');
  });
  it('a checked statement takes no ticks (undo it first)', () => {
    const s = state({ checks: [check('c1', '2026-09-30', 130_000, { status: 'checked', outstandingSnapshot: [] })] });
    assert.deepEqual(tickPlan(s, 'c1', 'entry:a', true), { ok: false, status: 409, code: 'not_open' });
    assert.deepEqual(keptOutPlan(s, 'c1', 'entry:a', true), { ok: false, status: 409, code: 'not_open' });
  });
  it('a double tap is a no-op, both ways', () => {
    const s = state({ marks: [mark('entry:a', 'c1', A.date, 'in', 20_000)] });
    assert.deepEqual(tickPlan(s, 'c1', 'entry:a', true), { ok: true, insert: [], remove: [] });
    assert.deepEqual(tickPlan(state(), 'c1', 'entry:a', false), { ok: true, insert: [], remove: [] });
  });
  it('an unknown statement is not found', () => {
    assert.deepEqual(tickPlan(state(), 'nope', 'entry:a', true), { ok: false, status: 404, code: 'check_not_found' });
  });
});

describe('"Didn\'t go through the bank" (B6)', () => {
  it('a payout never', () => assert.equal((keptOutPlan(state(), 'c1', 'payout:po_1', true) as { code: string }).code, 'not_a_line'));
  it('an outstanding line may be kept out; one already out is a no-op; Put it back on a line not out is a no-op', () => {
    assert.deepEqual(keptOutPlan(state(), 'c1', 'entry:b', true), { ok: true, noop: false });
    assert.deepEqual(keptOutPlan(state({ exclusions: ['entry:b'] }), 'c1', 'entry:b', true), { ok: true, noop: true });
    assert.deepEqual(keptOutPlan(state({ exclusions: ['entry:b'] }), 'c1', 'entry:b', false), { ok: true, noop: false });
    assert.deepEqual(keptOutPlan(state(), 'c1', 'entry:b', false), { ok: true, noop: true });
  });
  it('a line already ticked can\'t be kept out', () => {
    const s = state({ marks: [mark('entry:b', 'c1', B.date, 'out', 5_000)] });
    assert.equal((keptOutPlan(s, 'c1', 'entry:b', true) as { code: string }).code, 'not_outstanding');
  });
});

describe('rules 4 and 6: Mark checked recomputes the Difference and replaces the ticks', () => {
  const allTicked = () => state({ marks: [
    mark('entry:a', 'c1', A.date, 'in', 20_000), mark('entry:b', 'c1', B.date, 'out', 5_000),
    mark('payout:po_1', 'c1', PO.arrivalDate, 'in', 15_000), mark('entry:p1', 'c1', P1.date, 'in', 10_000, 'payout:po_1'),
    mark('entry:p2', 'c1', P2.date, 'in', 5_000, 'payout:po_1'),
  ] });
  it('a non-zero Difference is refused 422, whatever the client believes', () => {
    const s = allTicked();
    s.marks = s.marks.filter(m => m.key !== 'entry:b');
    assert.deepEqual(markPlan(s, 'c1', false), { ok: false, status: 422, code: 'not_zero' });
  });
  it('at $0.00 it keeps exactly the engine\'s ticks (the complete set), what it saw, and the outstanding list', () => {
    const s = allTicked();
    // A line voided after it was ticked: the statement drops it (its amber can clear).
    s.lines = s.lines.map(l => (l.key === 'entry:a' ? { ...l, status: 'void' as const } : l));
    s.checks = [check('c1', '2026-09-30', 110_000)];
    const p = markPlan(s, 'c1', false);
    assert.ok(p.ok, JSON.stringify(p));
    assert.deepEqual(p.marks.map(m => m.key).sort(), ['entry:b', 'entry:p1', 'entry:p2', 'payout:po_1']);
    assert.deepEqual(p.seen.sort(), ['entry:a', 'entry:b', 'entry:p1', 'entry:p2', 'payout:po_1']);
    assert.deepEqual(p.outstandingSnapshot, []);
  });
  it('an earlier open statement is checked first', () => {
    const s = allTicked();
    s.checks = [check('c0', '2026-09-15', 100_000), check('c1', '2026-09-30', 130_000)];
    assert.deepEqual(markPlan(s, 'c1', false), { ok: false, status: 409, code: 'earlier_open' });
  });
  it('Mark checked again with nothing changed is refused', () => {
    const s = allTicked();
    s.checks = [check('c1', '2026-09-30', 130_000, { status: 'checked', outstandingSnapshot: [] })];
    assert.deepEqual(markPlan(s, 'c1', true), { ok: false, status: 409, code: 'nothing_changed' });
  });
});

describe('Undo (B4, Ask 9)', () => {
  const two = () => state({ checks: [
    check('c1', '2026-09-30', 130_000, { status: 'checked', outstandingSnapshot: [] }),
    check('c2', '2026-10-31', 130_000, { status: 'checked', outstandingSnapshot: [] }),
  ] });
  it('only the latest checked statement', () => assert.deepEqual(undoPlan(two(), 'c1', 'oops'), { ok: false, status: 409, code: 'not_latest' }));
  it('a reason is required, trimmed, 500 at most', () => {
    assert.deepEqual(undoPlan(two(), 'c2', '   '), { ok: false, status: 400, code: 'reason_required' });
    assert.deepEqual(undoPlan(two(), 'c2', 'x'.repeat(501)), { ok: false, status: 400, code: 'reason_required' });
    assert.deepEqual(undoPlan(two(), 'c2', '  Typed the ending balance wrong '), { ok: true, reason: 'Typed the ending balance wrong' });
  });
  it('after an undo the list shows who undid it and why, and the one before gains the Undo (step back)', () => {
    const s = two();
    s.checks[1] = { ...s.checks[1], status: 'open' };
    const sums = checkSummaries(s, [
      { checkId: 'c2', kind: 'checked', at: '2026-11-03T20:14:00Z', byName: 'Priya Shah', reason: null },
      { checkId: 'c2', kind: 'undone', at: '2026-11-04T14:02:00Z', byName: 'Priya Shah', reason: 'Typed the ending balance wrong' },
    ]);
    assert.equal(sums[0].id, 'c2');
    assert.deepEqual(sums[0].undone, { at: '2026-11-04T14:02:00Z', byName: 'Priya Shah', reason: 'Typed the ending balance wrong' });
    assert.equal(sums[0].can.refigure, true);
    assert.equal(sums[1].can.undo, true);
    assert.equal(sums[1].can.refigure, false, 'a checked statement\'s figures are fixed');
  });
});

describe('rule 5 and rule 6: the starting point', () => {
  const row = (id: string, over: Partial<EntryRow> = {}): EntryRow => ({
    id, ledger_id: 'gen', entry_date: '2026-08-29', description: 'Cheque #201 · Officials', amount: '240.00', entry_type: 'expense',
    status: 'posted', linked_entry_id: null, ...over,
  });
  const base = { openingDate: '2026-08-31', books: new Set(['gen']) };
  it('a picked item\'s figures come from the book, never the request', () => {
    const p = openingPlan({ ...base, pickedKeys: ['entry:r1'], typed: [], rows: [row('r1')] });
    assert.ok(p.ok);
    assert.deepEqual(p.picked, [{ key: 'entry:r1', date: '2026-08-29', amountCents: 24_000, direction: 'out', description: 'Cheque #201 · Officials' }]);
  });
  it('a picked item outside the account\'s books, after the starting date, not posted, or a typed key is refused', () => {
    for (const [keys, rows] of [
      [['entry:r1'], [row('r1', { ledger_id: 'gaming' })]],
      [['entry:r1'], [row('r1', { entry_date: '2026-09-01' })]],
      [['entry:r1'], [row('r1', { status: 'void' })]],
      [['typed:00000000-0000-0000-0000-000000000000'], []],
      [['entry:missing'], []],
    ] as const) {
      assert.deepEqual(openingPlan({ ...base, pickedKeys: keys, typed: [], rows }), { ok: false, status: 400, code: 'item_not_in_books' });
    }
  });
  it('a typed item needs a date on or before the start, a direction, an amount and words — and never carries a key', () => {
    const ok = openingPlan({ ...base, pickedKeys: [], rows: [],
      typed: [{ key: 'typed:forged', date: '2026-08-30', direction: 'in', amountCents: 30_000, description: ' Sponsor cheque ' }] });
    assert.ok(ok.ok);
    assert.deepEqual(ok.typed, [{ date: '2026-08-30', direction: 'in', amountCents: 30_000, description: 'Sponsor cheque' }]);
    for (const t of [
      { date: '2026-09-01', direction: 'in', amountCents: 1, description: 'x' },
      { date: '2026-08-30', direction: 'sideways', amountCents: 1, description: 'x' },
      { date: '2026-08-30', direction: 'in', amountCents: 0, description: 'x' },
      { date: '2026-08-30', direction: 'in', amountCents: 1.5, description: 'x' },
      { date: '2026-08-30', direction: 'in', amountCents: 1, description: '' },
    ]) assert.deepEqual(openingPlan({ ...base, pickedKeys: [], rows: [], typed: [t] }), { ok: false, status: 400, code: 'bad_item' });
  });
});

describe('a payout\'s gap, named by reason, and the payment-processing offer (P4, Ask 7)', () => {
  const facts = (over: Partial<PayoutGapFacts> = {}): PayoutGapFacts =>
    ({ disputesHeld: [], disputeHeldCents: 0, disputeNetCents: 0, disputeReturnedCents: 0, notOursCents: 0, stripeFeeCents: 0, ...over });
  const withDeposit = (cents: number) => state({ payouts: [{ ...PO, amountCents: cents }] });
  const view = (s: BankAccountState, f: PayoutGapFacts, members = ['entry:p1', 'entry:p2']) =>
    payoutGapViews(evaluateCheck(s, 'c1'), { 'payout:po_1': f }, { 'payout:po_1': members })['payout:po_1'];

  it('a Stripe fee the books lack is offered, at the server\'s figure', () => {
    const v = view(withDeposit(14_500), facts({ stripeFeeCents: -500 }));
    assert.equal(v.gapCents, -500);
    assert.equal(v.offerPaymentProcessing, true);
    assert.equal(v.processingCents, 500);
  });
  it('an open dispute is named "held", never offered as payment processing', () => {
    const v = view(withDeposit(15_000 - 17_175), facts({
      disputesHeld: [{ disputeId: 'dp_1', amountCents: 15_675, feeCents: 1_500 }], disputeHeldCents: -17_175, disputeNetCents: -17_175 }));
    assert.equal(v.disputeHeldCents, -17_175);
    assert.equal(v.otherCents, 0);
    assert.equal(v.offerPaymentProcessing, false);
  });
  it('a member line voided (or in another account\'s book) means the gap is not a fee: no offer', () => {
    const s = withDeposit(15_000);
    s.lines = s.lines.map(l => (l.key === 'entry:p2' ? { ...l, status: 'void' as const } : l));
    const v = view(s, facts());
    assert.equal(v.gapCents, 5_000);
    assert.equal(v.missingMembers, 1);
    assert.equal(v.offerPaymentProcessing, false);
    const fee = view(withDeposit(14_500), facts({ stripeFeeCents: -500 }), ['entry:p1', 'entry:p2', 'entry:moved-away']);
    assert.equal(fee.offerPaymentProcessing, false);
  });
  it('a held dispute whose stored figure disagrees with Stripe\'s own net: no offer', () => {
    const v = view(withDeposit(15_000 - 17_175 - 500), facts({
      disputesHeld: [{ disputeId: 'dp_1', amountCents: 15_675, feeCents: 1_500 }], disputeHeldCents: -17_175, disputeNetCents: -17_000,
      stripeFeeCents: -500 }));
    assert.equal(v.offerPaymentProcessing, false);
  });
});

describe('a payment-processing line closes its payout\'s gap; it is never counted beside it (R2b review)', () => {
  // Deposit $145.00 for $150.00 of book lines: Stripe kept $5.00. Everything ticked, statement at $1,000 + 200 - 50 + 145.
  const FEE = line('entry:fee', '2026-09-30', 'out', 500);
  const ticks = (feeMark: BankMark[]) => [
    mark('payout:po_1', 'c1', PO.arrivalDate, 'in', 14_500), mark('entry:p1', 'c1', P1.date, 'in', 10_000, 'payout:po_1'),
    mark('entry:p2', 'c1', P2.date, 'in', 5_000, 'payout:po_1'), mark('entry:a', 'c1', A.date, 'in', 20_000),
    mark('entry:b', 'c1', B.date, 'out', 5_000), ...feeMark,
  ];
  const at = (lines: BankLine[], marks: BankMark[]) =>
    evaluateCheck({ ...state({ payouts: [{ ...PO, amountCents: 14_500 }], lines, marks }), checks: [check('c1', '2026-09-30', 129_500, { addedLineKeys: ['entry:fee'] })] }, 'c1');

  it('a fee line that rides the payout: the gap closes and the statement stays at $0.00', () => {
    const rides = at([A, B, P1, P2, { ...FEE, payoutKey: 'payout:po_1' }], ticks([mark('entry:fee', 'c1', FEE.date, 'out', 500, 'payout:po_1')]));
    assert.equal(rides.payoutGapCents, 0);
    assert.equal(rides.differenceCents, 0);
  });
  it('the same line ticked on its own (the first version) left the gap AND the line: the statement was $5.00 off', () => {
    const alone = at([A, B, P1, P2, FEE], ticks([mark('entry:fee', 'c1', FEE.date, 'out', 500)]));
    assert.equal(alone.payoutGapCents, -500);
    assert.equal(alone.differenceCents, 500);
  });
  it('once the line rides the payout, the offer is gone (no second line to add)', () => {
    const s = state({ payouts: [{ ...PO, amountCents: 14_500 }], lines: [A, B, P1, P2, { ...FEE, payoutKey: 'payout:po_1' }],
      marks: ticks([mark('entry:fee', 'c1', FEE.date, 'out', 500, 'payout:po_1')]) });
    const v = payoutGapViews(evaluateCheck({ ...s, checks: [check('c1', '2026-09-30', 129_500, { addedLineKeys: ['entry:fee'] })] }, 'c1'),
      { 'payout:po_1': { disputesHeld: [], disputeHeldCents: 0, disputeNetCents: 0, disputeReturnedCents: 0, notOursCents: 0, stripeFeeCents: -500 } },
      { 'payout:po_1': ['entry:p1', 'entry:p2', 'entry:fee'] })['payout:po_1'];
    assert.equal(v.gapCents, 0);
    assert.equal(v.offerPaymentProcessing, false);
  });
  it('the reader joins an added line to the payout its tick names, and only that', () => {
    const bank = { payouts: [], payoutOf: new Map([['p1', 'payout:po_1']]), membersOf: new Map([['payout:po_1', ['p1']]]), facts: {} };
    const marks = [mark('entry:fee', 'c1', FEE.date, 'out', 500, 'payout:po_1'), mark('entry:other', 'c1', FEE.date, 'out', 100, 'payout:po_1'),
      mark('entry:gone', 'c1', FEE.date, 'out', 100, 'payout:po_9')];
    const out = withAddedMembers(bank, marks, new Set(['entry:fee', 'entry:gone']));
    assert.equal(out.payoutOf.get('fee'), 'payout:po_1');
    assert.deepEqual(out.membersOf.get('payout:po_1'), ['p1', 'fee']);
    assert.equal(out.payoutOf.has('other'), false, 'not an added line');
    assert.equal(out.payoutOf.has('gone'), false, 'its payout is not here');
    assert.deepEqual(bank.membersOf.get('payout:po_1'), ['p1'], 'the Stripe read is not mutated');
  });
});

describe('kept out: only a line inside the statement\'s window (R2b review)', () => {
  it('a starting-point item or a back-dated line is refused, not hidden from every list', () => {
    const OLD = line('entry:old', '2026-08-10', 'out', 700);
    const s = state({ lines: [A, B, OLD], openingItems: [{ kind: 'picked', key: 'entry:old', date: '2026-08-10', direction: 'out', amountCents: 700 }] });
    assert.equal(evaluateCheck(s, 'c1').outstanding.some(r => r.key === 'entry:old'), true);
    assert.deepEqual(keptOutPlan(s, 'c1', 'entry:old', true), { ok: false, status: 409, code: 'not_outstanding' });
  });
});

describe('refusals are codes', () => {
  it('every code has words and a status', () => {
    assert.equal(statusOfRefusal('not_zero'), 422);
    assert.equal(statusOfRefusal('account_not_found'), 404);
    assert.equal(statusOfRefusal('one_is_open'), 409);
    assert.equal(refusalOfStep('ends_too_early'), 'ends_too_early');
    assert.equal(refusalOfStep('something new'), 'changed');
  });
  it('the database\'s refusals map to codes; anything else is a real failure', () => {
    assert.equal(refusalOfDbError({ message: 'bank_book_is_team_book' }), 'team_book');
    assert.equal(refusalOfDbError({ message: 'bank_book_other_club' }), 'book_not_found');
    assert.equal(refusalOfDbError({ message: 'bank_book_not_club_account' }), 'account_not_found');
    assert.equal(refusalOfDbError({ message: 'bank_step_refused:ticked_elsewhere' }), 'ticked_elsewhere');
    assert.equal(refusalOfDbError({ code: '23505', message: 'duplicate key value violates unique constraint "bank_accounts_club_name"' }), 'name_taken');
    assert.equal(refusalOfDbError({ code: '23505', message: 'duplicate key value violates unique constraint "bank_checks_one_per_end_date"' }), 'ends_too_early');
    assert.equal(refusalOfDbError({ message: 'connection reset' }), null);
    for (const c of ['ticked_elsewhere', 'team_book', 'name_taken'] as const) assert.ok(BANK_REFUSAL[c]);
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
