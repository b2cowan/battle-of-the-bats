import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bankFeeDate, canMarkChecked, canMarkCheckedAgain, canStartCheck, canUndo, carriedAtRollover, evaluateCheck,
  payoutTickMarks, snapshotForMarking,
  type BankAccountState, type BankCheckRecord, type BankLine, type BankMark, type BankPayout,
} from '../../lib/bank-check.ts';

/**
 * Bank reconciliation R1 — THE ENGINE (lib/bank-check.ts). The two example statements are the approved drawings'
 * tab 2 (BANK_RECONCILIATION_DRAWINGS.html), to the cent; the rest are the rulings the schema and engine must
 * hold up: a fiscal-year straddle and the re-dated fee (Ask 8), a rollover (Ask 12), a moved book (Ask 13), undo
 * then step back (Ask 9), changed since then checked again (Ask 11).
 */

const line = (key: string, date: string, direction: 'in' | 'out', amountCents: number, over: Partial<BankLine> = {}): BankLine =>
  ({ key, date, direction, amountCents, status: 'posted', ...over });
const tick = (l: { key: string; date: string; direction: 'in' | 'out'; amountCents: number }, checkId: string, payoutKey?: string): BankMark =>
  ({ key: l.key, checkId, date: l.date, direction: l.direction, amountCents: l.amountCents, payoutKey: payoutKey ?? null });
const check = (id: string, end: string, endingCents: number, over: Partial<BankCheckRecord> = {}): BankCheckRecord =>
  ({ id, statementEndDate: end, statementEndingBalanceCents: endingCents, status: 'open', ...over });

// ── The club's example: Lakeshore Lynx · Club chequing · statement ending Oct 31, 2026 ─────────────────────
function clubOctober() {
  // Money in: 13 lines + one Stripe payout of $1,284.50 = $3,910.00. Money out: 9 lines = $1,617.55.
  const ins = Array.from({ length: 12 }, (_, i) => line(`entry:in-${i}`, `2026-10-${String(i + 2).padStart(2, '0')}`, 'in', 20000));
  ins.push(line('entry:in-12', '2026-10-20', 'in', 22550));
  const outs = Array.from({ length: 8 }, (_, i) => line(`entry:out-${i}`, `2026-10-${String(i + 3).padStart(2, '0')}`, 'out', 18000));
  outs.push(line('entry:out-8', '2026-10-25', 'out', 17755));
  const members = [
    line('entry:pay-a', '2026-10-09', 'in', 50000, { payoutKey: 'payout:po_1' }),
    line('entry:pay-b', '2026-10-10', 'in', 40000, { payoutKey: 'payout:po_1' }),
    line('entry:pay-c', '2026-10-11', 'in', 38450, { payoutKey: 'payout:po_1' }),
  ];
  const cashOfficials = line('entry:cash-officials', '2026-10-27', 'out', 12000);
  const cheque214 = line('entry:cheque-214', '2026-10-29', 'out', 45000, { label: 'Cheque #214 · indoor training' });
  const others = [
    // A transfer between two books in this account never reaches the bank (B6, automatic).
    line('entry:xfer-out', '2026-10-15', 'out', 30000, { transferPairKey: 'entry:xfer-in' }),
    line('entry:xfer-in', '2026-10-15', 'in', 30000, { transferPairKey: 'entry:xfer-out' }),
    line('entry:voided', '2026-10-16', 'out', 9900, { status: 'void' }),
    line('entry:pending', '2026-10-17', 'in', 5000, { status: 'pending' }),
    line('entry:november', '2026-11-02', 'in', 7500),
  ];
  const state: BankAccountState = {
    setup: { openingDate: '2026-08-31', openingBalanceCents: 540210 },
    lines: [...ins, ...outs, ...members, cashOfficials, cheque214, ...others],
    payouts: [{ key: 'payout:po_1', arrivalDate: '2026-10-14', amountCents: 128450, label: 'Stripe payout' }],
    checks: [check('sep', '2026-09-30', 612045, { status: 'checked', outstandingSnapshot: [] }), check('oct', '2026-10-31', 840050)],
    marks: [...ins, ...outs].map(l => tick(l, 'oct')),
    exclusions: ['entry:cash-officials'],
  };
  state.marks.push(...payoutTickMarks(state, 'oct', 'payout:po_1'));
  return state;
}

describe('the club example statement (drawings tab 2)', () => {
  it('ticks to $8,412.90 against a statement of $8,400.50: off by the $12.40 fee', () => {
    const ev = evaluateCheck(clubOctober(), 'oct');
    assert.equal(ev.startingBalanceCents, 612045, 'starts where Sep 30’s check ended');
    assert.equal(ev.startDate, '2026-09-30');
    assert.equal(ev.tickedInCents, 391000);
    assert.equal(ev.tickedOutCents, 161755);
    assert.equal(ev.tickedBalanceCents, 841290);
    assert.equal(ev.differenceCents, -1240);
    assert.equal(ev.ticked.length, 13 + 9 + 1, '14 money-in rows (one the payout) and 9 out');
    const payout = ev.ticked.find(r => r.kind === 'payout');
    assert.ok(payout && payout.kind === 'payout');
    assert.equal(payout.members.length, 3, 'the payout ticks its members as one row');
    assert.equal(payout.gapCents, 0);
    assert.deepEqual(ev.payoutGaps, []);
  });

  it('reaches $0.00 once the fee is added and ticked, and can be marked checked', () => {
    const s = clubOctober();
    const fee = line('entry:fee', '2026-10-31', 'out', 1240, { label: 'Bank fee' });
    s.lines.push(fee);
    s.marks.push(tick(fee, 'oct'));
    const ev = evaluateCheck(s, 'oct');
    assert.equal(ev.tickedBalanceCents, 840050);
    assert.equal(ev.differenceCents, 0);
    assert.deepEqual(canMarkChecked(s, 'oct'), { ok: true });
  });

  it('keeps cash out, leaves transfers, void and pending out by itself, holds cheque #214 outstanding, and waits November', () => {
    const ev = evaluateCheck(clubOctober(), 'oct');
    assert.equal(ev.keptOutOutCents, 12000);
    assert.equal(ev.keptOutInCents, 0);
    assert.deepEqual(ev.outstanding.map(r => r.key), ['entry:cheque-214']);
    assert.equal(ev.outstandingOutCents, 45000);
    assert.deepEqual(ev.autoExcluded.map(a => [a.row.key, a.reason]), [
      ['entry:xfer-in', 'same_account_transfer'], ['entry:xfer-out', 'same_account_transfer'],
      ['entry:voided', 'void'], ['entry:pending', 'pending'],
    ]);
    assert.equal(ev.waitingCount, 1, 'a line dated after the statement waits for the next one');
  });

  it('a transfer whose other half lives in another account goes through the bank', () => {
    const s = clubOctober();
    s.lines = s.lines.filter(l => l.key !== 'entry:xfer-in');
    const ev = evaluateCheck(s, 'oct');
    assert.ok(ev.outstanding.some(r => r.key === 'entry:xfer-out'));
  });

  it('a payout whose book side misses the deposit names the gap and keeps it out of the Difference (Ask 7)', () => {
    const s = clubOctober();
    s.lines = s.lines.map(l => (l.key === 'entry:pay-c' ? { ...l, amountCents: 38610 } : l)); // book $1.60 more
    s.marks = s.marks.map(m => (m.key === 'entry:pay-c' ? { ...m, amountCents: 38610 } : m));
    const ev = evaluateCheck(s, 'oct');
    assert.deepEqual(ev.payoutGaps, [{ key: 'payout:po_1', depositCents: 128450, bookCents: 128610, gapCents: -160 }]);
    assert.equal(ev.payoutGapCents, -160);
    assert.equal(ev.differenceCents, -1240, 'the Difference is still only the bank fee');
  });
});

// ── The coach's example: Lynx 12U AAA · Team account · statement ending Sep 30, 2026 (the first check) ─────
function coachSeptember() {
  const ins = [
    line('dues-payment-1', '2026-09-03', 'in', 50000), line('dues-payment-2', '2026-09-05', 'in', 50000),
    line('dues-payment-3', '2026-09-08', 'in', 50000), line('dues-payment-4', '2026-09-12', 'in', 50000),
    line('money-in-sponsor', '2026-09-15', 'in', 46235),
  ];
  const outs = [line('expense-e1-payment-p1', '2026-09-10', 'out', 100000), line('expense-e2-payment-p2', '2026-09-20', 'out', 13320)];
  const state: BankAccountState = {
    setup: { openingDate: '2026-09-01', openingBalanceCents: 118000 },
    lines: [
      ...ins, ...outs,
      line('money-in-cash-dues', '2026-09-06', 'in', 12000),
      line('expense-e3-payment-p3', '2026-09-14', 'out', 12000, { label: 'Officials, paid in cash' }),
      line('expense-e4-payment-p4', '2026-09-18', 'out', 16000, { familyPaidVendor: true, label: 'Hotel · the Okafor family paid' }),
      line('expense-e5-payment-p5', '2026-09-28', 'out', 50000, { label: 'Cheque #032 · hotel deposit' }),
    ],
    checks: [check('sep', '2026-09-30', 250420)],
    marks: [...ins, ...outs].map(l => tick(l, 'sep')),
    exclusions: ['money-in-cash-dues', 'expense-e3-payment-p3'],
  };
  return state;
}

describe('the coach example statement (drawings tab 2)', () => {
  it('ticks to $2,509.15 against $2,504.20, then $0.00 with the $4.95 fee as a cost record', () => {
    const s = coachSeptember();
    let ev = evaluateCheck(s, 'sep');
    assert.equal(ev.startingBalanceCents, 118000, 'the bank balance typed once (K1)');
    assert.equal(ev.tickedInCents, 246235);
    assert.equal(ev.tickedBalanceCents, 250915);
    assert.equal(ev.differenceCents, -495);
    const fee = line('expense-e6-payment-p6', '2026-09-30', 'out', 495);
    s.lines.push(fee); s.marks.push(tick(fee, 'sep'));
    ev = evaluateCheck(s, 'sep');
    assert.equal(ev.tickedOutCents, 113815);
    assert.equal(ev.tickedBalanceCents, 250420);
    assert.equal(ev.differenceCents, 0);
  });

  it('kept out $120.00 in / $120.00 out; the family-paid hotel left out by itself; cheque #032 outstanding', () => {
    const ev = evaluateCheck(coachSeptember(), 'sep');
    assert.equal(ev.keptOutInCents, 12000);
    assert.equal(ev.keptOutOutCents, 12000);
    assert.deepEqual(ev.autoExcluded.map(a => [a.row.key, a.reason, a.row.amountCents]),
      [['expense-e4-payment-p4', 'family_paid_vendor', 16000]]);
    assert.deepEqual(ev.outstanding.map(r => [r.key, r.amountCents]), [['expense-e5-payment-p5', 50000]]);
  });

  it('"Put it back" returns a kept-out line to the tick list', () => {
    const s = coachSeptember();
    s.exclusions = ['expense-e3-payment-p3'];
    const ev = evaluateCheck(s, 'sep');
    assert.ok(ev.outstanding.some(r => r.key === 'money-in-cash-dues'));
    assert.equal(ev.keptOutInCents, 0);
  });
});

describe('the first check’s “still outstanding then” (Ask 3)', () => {
  it('lists the picked book lines and the typed ones; other lines before the start are through the bank already', () => {
    const s: BankAccountState = {
      setup: { openingDate: '2026-08-31', openingBalanceCents: 540210 },
      lines: [
        line('entry:cheque-201', '2026-08-29', 'out', 24000),
        line('entry:supplies', '2026-08-27', 'out', 9620), // cleared before the start: not picked
        line('entry:sep-1', '2026-09-04', 'in', 10000),
      ],
      openingItems: [
        { kind: 'picked', key: 'entry:cheque-201', date: '2026-08-29', direction: 'out', amountCents: 24000 },
        { kind: 'typed', key: 'typed:t1', date: '2026-07-15', direction: 'out', amountCents: 7500, label: 'Cheque #188' },
      ],
      checks: [check('sep', '2026-09-30', 0)],
      marks: [],
    };
    const ev = evaluateCheck(s, 'sep');
    assert.deepEqual(ev.outstanding.map(r => [r.key, r.kind === 'line' ? r.origin : '']),
      [['typed:t1', 'opening'], ['entry:cheque-201', 'book'], ['entry:sep-1', 'book']]);
  });

  it('a typed line keeps its words once ticked (its mark carries figures only — R2c found it reading "a line")', () => {
    const typed = { key: 'typed:t1', date: '2026-07-15', direction: 'out' as const, amountCents: 7500 };
    const s: BankAccountState = {
      setup: { openingDate: '2026-08-31', openingBalanceCents: 540210 },
      lines: [],
      openingItems: [{ kind: 'typed', ...typed, label: 'Cheque #188' }],
      checks: [check('sep', '2026-09-30', 532710)],
      marks: [tick(typed, 'sep')],
    };
    const ev = evaluateCheck(s, 'sep');
    assert.equal(ev.ticked.length, 1);
    assert.equal(ev.ticked[0].label, 'Cheque #188');
    assert.equal(ev.differenceCents, 0, 'the words change nothing in the sum');
  });
});

describe('the fiscal year (B4, Ask 8): nothing here is keyed to a year', () => {
  function straddle(): BankAccountState {
    return {
      setup: { openingDate: '2025-11-30', openingBalanceCents: 100000 },
      lines: [
        line('entry:dec', '2025-12-20', 'in', 20000),   // in the closed year
        line('entry:jan', '2026-01-10', 'out', 5000),   // in the open year
      ],
      checks: [check('dec-jan', '2026-01-31', 115000)],
      marks: [],
    };
  }

  it('a statement straddling the year end ticks lines on both sides, including one in a closed year', () => {
    const s = straddle();
    s.marks = s.lines.map(l => tick(l, 'dec-jan'));
    const ev = evaluateCheck(s, 'dec-jan');
    assert.equal(ev.differenceCents, 0);
    assert.deepEqual(canMarkChecked(s, 'dec-jan'), { ok: true });
  });

  it('the fee helper re-dates a closed-year fee to today; open years and team books keep the statement date', () => {
    assert.deepEqual(bankFeeDate({ statementEndDate: '2025-12-31', booksClosedThrough: '2025-12-31', today: '2026-11-04' }),
      { date: '2026-11-04', redated: true });
    assert.deepEqual(bankFeeDate({ statementEndDate: '2026-01-31', booksClosedThrough: '2025-12-31', today: '2026-11-04' }),
      { date: '2026-01-31', redated: false });
    assert.deepEqual(bankFeeDate({ statementEndDate: '2025-12-31', booksClosedThrough: null, today: '2026-11-04' }),
      { date: '2025-12-31', redated: false });
  });

  it('the re-dated fee ticks on the statement it was added from, and nowhere else', () => {
    const s: BankAccountState = {
      setup: { openingDate: '2025-11-30', openingBalanceCents: 100000 },
      lines: [line('entry:dec', '2025-12-20', 'in', 20000), line('entry:fee', '2026-11-04', 'out', 1240)],
      checks: [check('dec', '2025-12-31', 118760)],
      marks: [],
    };
    s.marks = [tick(s.lines[0], 'dec')];
    assert.equal(evaluateCheck(s, 'dec').waitingCount, 1, 'without the helper it would wait for a later statement');
    s.checks[0].addedLineKeys = ['entry:fee'];
    assert.ok(evaluateCheck(s, 'dec').outstanding.some(r => r.key === 'entry:fee'));
    s.marks.push(tick(s.lines[1], 'dec'));
    assert.equal(evaluateCheck(s, 'dec').differenceCents, 0);
    s.checks[0].status = 'checked';
    s.checks.push(check('jan', '2026-01-31', 118760));
    const jan = evaluateCheck(s, 'jan');
    assert.equal(jan.startingBalanceCents, 118760);
    assert.ok(!jan.ticked.concat(jan.outstanding).some(r => r.key === 'entry:fee'));
  });
});

describe('across a coach’s seasons (B10, Ask 12)', () => {
  it('the next season’s first check lists the last check’s outstanding list and the carried lines, and balances', () => {
    const chequeA = line('expense-a-payment-a', '2026-08-28', 'out', 30000);
    const ticked = line('money-in-aug', '2026-08-05', 'in', 50000);
    const backDated = line('money-in-backdated', '2026-08-15', 'in', 4000); // recorded after Aug was checked
    const afterCheck = line('money-in-sep3', '2026-09-03', 'in', 7000);
    const keptOut = line('money-in-cash', '2026-09-04', 'in', 2500);
    const oldSeason: BankAccountState = {
      setup: { openingDate: '2026-07-31', openingBalanceCents: 100000 },
      lines: [chequeA, ticked, backDated, afterCheck, keptOut],
      checks: [check('aug', '2026-08-31', 150000, { status: 'checked',
        outstandingSnapshot: [{ key: chequeA.key, date: chequeA.date, direction: 'out', amountCents: 30000 }] })],
      marks: [tick(ticked, 'aug')],
      exclusions: [keptOut.key],
    };
    const carried = carriedAtRollover(oldSeason, oldSeason.lines);
    assert.deepEqual(carried.map(c => c.key), ['money-in-backdated', 'money-in-sep3'],
      'not the ticked line, not the kept-out one, not cheque A (already on the last check’s list)');

    // Start next season: the source now reads only the new season; nothing reads last season again.
    const newLine = line('dues-payment-new', '2026-09-20', 'in', 10000);
    const newSeason: BankAccountState = { ...oldSeason, lines: [newLine], carried, checks: [...oldSeason.checks,
      check('sep', '2026-09-30', 150000 - 30000 + 4000 + 7000 + 10000)] };
    let ev = evaluateCheck(newSeason, 'sep');
    assert.deepEqual(ev.outstanding.map(r => [r.key, r.kind === 'line' ? r.origin : '']), [
      ['money-in-backdated', 'carried'], ['expense-a-payment-a', 'saved'], ['money-in-sep3', 'carried'],
      ['dues-payment-new', 'book'],
    ]);
    newSeason.marks = [...newSeason.marks, ...[chequeA, backDated, afterCheck, newLine].map(l => tick(l, 'sep'))];
    ev = evaluateCheck(newSeason, 'sep');
    assert.equal(ev.differenceCents, 0);
    assert.equal(ev.ticked.length, 4);
    assert.deepEqual(evaluateCheck(newSeason, 'aug').changedSince, [], 'a rolled-over line is not a change');
  });
});

describe('moving a book (Ask 13)', () => {
  it('unticked lines move with the book; a ticked one stays on the old account’s check', () => {
    const g1 = line('entry:g1', '2026-09-05', 'in', 10000);
    const x1 = line('entry:x1', '2026-09-06', 'in', 20000); // gaming book, ticked on Club chequing
    const x2 = line('entry:x2', '2026-09-07', 'in', 30000); // gaming book, outstanding
    const chequing: BankAccountState = {
      setup: { openingDate: '2026-08-31', openingBalanceCents: 0 },
      lines: [g1, x1, x2],
      checks: [check('sep', '2026-09-30', 30000, { status: 'checked',
        outstandingSnapshot: [{ key: x2.key, date: x2.date, direction: 'in', amountCents: 30000 }] }),
        check('oct', '2026-10-31', 30000)],
      marks: [tick(g1, 'sep'), tick(x1, 'sep')],
      // The gaming book now lives in the gaming account: its lines are claimed there.
      claimedElsewhere: [x1.key, x2.key],
    };
    const sep = evaluateCheck(chequing, 'sep');
    assert.equal(sep.differenceCents, 0, 'no checked statement changes');
    assert.deepEqual(sep.ticked.map(r => r.key), ['entry:g1', 'entry:x1']);
    const oct = evaluateCheck(chequing, 'oct');
    assert.deepEqual(oct.outstanding, [], 'x2 left with its book, from the book and from the saved list alike');

    const gaming: BankAccountState = {
      setup: { openingDate: '2026-08-31', openingBalanceCents: 0 },
      lines: [x1, x2],
      checks: [check('sep', '2026-09-30', 30000)],
      marks: [],
      claimedElsewhere: [x1.key], // ticked on another account
    };
    assert.deepEqual(evaluateCheck(gaming, 'sep').outstanding.map(r => r.key), ['entry:x2']);
  });
});

describe('undo, then step back (Ask 9)', () => {
  function twoChecked(): BankAccountState {
    const a = line('entry:a', '2026-09-10', 'in', 10000);
    const b = line('entry:b', '2026-10-10', 'in', 5000);
    return {
      setup: { openingDate: '2026-08-31', openingBalanceCents: 0 },
      lines: [a, b],
      checks: [check('sep', '2026-09-30', 10000, { status: 'checked' }), check('oct', '2026-10-31', 15000, { status: 'checked' })],
      marks: [tick(a, 'sep'), tick(b, 'oct')],
    };
  }

  it('only the latest checked statement undoes; it reopens with its ticks; then the one before becomes the latest', () => {
    const s = twoChecked();
    assert.equal(canUndo(s, 'sep').ok, false);
    assert.equal(canUndo(s, 'oct').ok, true);
    s.checks[1].status = 'open'; // the route's undo: status back to open, marks untouched
    const oct = evaluateCheck(s, 'oct');
    assert.deepEqual(oct.ticked.map(r => r.key), ['entry:b'], 'ticks kept');
    assert.equal(oct.differenceCents, 0);
    assert.equal(canUndo(s, 'sep').ok, true, 'step back one more');
    s.checks[0].status = 'open';
    assert.deepEqual(canMarkChecked(s, 'oct'), { ok: false, reason: 'earlier_open' });
    assert.deepEqual(canStartCheck(s, '2026-11-30'), { ok: false, reason: 'one_is_open' });
    assert.deepEqual(canMarkChecked(s, 'sep'), { ok: true });
    s.checks[0].status = 'checked';
    assert.deepEqual(canMarkChecked(s, 'oct'), { ok: true });
    s.checks[1].status = 'checked';
    assert.deepEqual(canStartCheck(s, '2026-10-31'), { ok: false, reason: 'ends_too_early' });
    assert.deepEqual(canStartCheck(s, '2026-11-30'), { ok: true });
  });
});

describe('changed since, then checked again (B4, Ask 11)', () => {
  function checkedOctober(): BankAccountState {
    const a = line('entry:a', '2026-10-05', 'in', 20000);
    const b = line('entry:b', '2026-10-12', 'out', 5000);
    return {
      setup: { openingDate: '2026-09-30', openingBalanceCents: 10000 },
      lines: [a, b],
      checks: [check('oct', '2026-10-31', 25000, { status: 'checked' })],
      marks: [tick(a, 'oct'), tick(b, 'oct')],
    };
  }

  it('an edited amount shows as was / now with who and when; the Difference moves off $0.00', () => {
    const s = checkedOctober();
    s.lines = s.lines.map(l => (l.key === 'entry:a' ? { ...l, amountCents: 21000 } : l));
    s.stampedChanges = [{ key: 'entry:a', checkId: 'oct', changedBy: 'user-1', changedAt: '2026-11-03T10:00:00Z' }];
    const ev = evaluateCheck(s, 'oct');
    assert.equal(ev.changedSince.length, 1);
    assert.deepEqual([ev.changedSince[0].was.amountCents, ev.changedSince[0].now?.amountCents], [20000, 21000]);
    assert.equal(ev.changedSince[0].changedBy, 'user-1');
    assert.equal(ev.differenceCents, -1000);
    assert.deepEqual(canMarkCheckedAgain(s, 'oct'), { ok: false, reason: 'not_zero' });
  });

  it('put right, it can be marked checked again at $0.00; the refreshed ticks clear it', () => {
    const s = checkedOctober();
    s.stampedChanges = [{ key: 'entry:a', checkId: 'oct', changedBy: 'user-1', changedAt: '2026-11-03T10:00:00Z' }];
    assert.equal(evaluateCheck(s, 'oct').changedSince.length, 1, 'a stamp stays until checked again, even put back');
    assert.deepEqual(canMarkCheckedAgain(s, 'oct'), { ok: true });
    const { marks } = snapshotForMarking(s, 'oct');
    s.marks = marks;
    s.stampedChanges = []; // the route clears its stamps (who and when recorded on them)
    assert.deepEqual(evaluateCheck(s, 'oct').changedSince, []);
    assert.deepEqual(canMarkCheckedAgain(s, 'oct'), { ok: false, reason: 'nothing_changed' });
  });

  it('a voided ticked line is a change with nothing now, and counts for nothing in the band', () => {
    const s = checkedOctober();
    s.lines = s.lines.map(l => (l.key === 'entry:b' ? { ...l, status: 'void' as const } : l));
    const ev = evaluateCheck(s, 'oct');
    assert.deepEqual(ev.changedSince.map(c => [c.key, c.now]), [['entry:b', null]]);
    assert.equal(ev.differenceCents, -5000);
  });

  it('an open statement never reports changed since', () => {
    const s = checkedOctober();
    s.checks[0].status = 'open';
    s.lines = s.lines.map(l => (l.key === 'entry:a' ? { ...l, amountCents: 21000 } : l));
    assert.deepEqual(evaluateCheck(s, 'oct').changedSince, []);
  });
});

describe('marking keeps the outstanding list (B10)', () => {
  it('saves every outstanding line, a pending payout as its members', () => {
    const s = clubOctober();
    const fee = line('entry:fee', '2026-10-31', 'out', 1240);
    s.lines.push(fee); s.marks.push(tick(fee, 'oct'));
    const { outstandingSnapshot, marks } = snapshotForMarking(s, 'oct');
    assert.deepEqual(outstandingSnapshot.map(x => x.key), ['entry:cheque-214']);
    assert.equal(marks.filter(m => m.payoutKey === 'payout:po_1').length, 3);
    assert.equal(marks.length, 13 + 9 + 1 + 1 + 3);
  });

  it('refuses amounts that are not integer cents', () => {
    const s = coachSeptember();
    s.lines.push(line('money-in-bad', '2026-09-09', 'in', 12.5));
    assert.throws(() => evaluateCheck(s, 'sep'), /integer cents/);
  });
});

describe('review findings (R1 /review) — re-marking, individual ticks, voids, deletes, opening items', () => {
  const payoutBook = () => {
    const a = line('entry:a', '2026-10-06', 'in', 5000, { payoutKey: 'payout:p1' });
    const b = line('entry:b', '2026-10-07', 'in', 4000, { payoutKey: 'payout:p1' });
    const p = { key: 'payout:p1', arrivalDate: '2026-10-05', amountCents: 8900 };
    const base = (): BankAccountState => ({
      setup: { openingDate: '2026-09-30', openingBalanceCents: 100000 },
      lines: [a, b], payouts: [p],
      checks: [check('c1', '2026-10-31', 108900, { status: 'checked', outstandingSnapshot: [] })],
      marks: [tick({ key: p.key, date: p.arrivalDate, direction: 'in', amountCents: p.amountCents }, 'c1'),
        tick(a, 'c1', p.key), tick(b, 'c1', p.key)],
    });
    return { a, b, p, base };
  };

  it('re-marking while the Stripe read is down keeps the payout tick and its members’ link to it', () => {
    const { base } = payoutBook();
    const down = { ...base(), payouts: [] };
    const { marks } = snapshotForMarking(down, 'c1');
    assert.deepEqual(marks.map(m => m.key).sort(), ['entry:a', 'entry:b', 'payout:p1']);
    assert.equal(marks.find(m => m.key === 'entry:a')?.payoutKey, 'payout:p1');
    const healthy = { ...base(), marks };
    const ev = evaluateCheck(healthy, 'c1');
    assert.equal(ev.differenceCents, 0, 'the payout is still ticked once Stripe is back');
    assert.deepEqual(ev.outstanding, []);
  });

  // R2c finding: the reader asks Stripe only from the last CHECKED statement's end, and a book line carries no payout key
  // for a payout it did not read. A payout ticked on that checked statement then dropped out: its members counted as
  // plain lines and the gap (deposit minus book side) fell out of the Difference.
  describe('a payout ticked on a checked statement Stripe is no longer asked about (R2c finding)', () => {
    const unread = () => {
      // The deposit is $89.00; the book side is $90.00 ($1.00 of Stripe fee the book never recorded): a gap of -$1.00.
      const a = line('entry:a', '2026-10-06', 'in', 5000);
      const b = line('entry:b', '2026-10-07', 'in', 4000);
      const po = { key: 'payout:p1', arrivalDate: '2026-10-05', amountCents: 8900 };
      const state = (payouts: BankPayout[]): BankAccountState => ({
        setup: { openingDate: '2026-09-30', openingBalanceCents: 100000 },
        lines: [a, b], payouts,
        checks: [check('c1', '2026-10-31', 108900, { status: 'checked', outstandingSnapshot: [] })],
        marks: [tick({ key: po.key, date: po.arrivalDate, direction: 'in', amountCents: po.amountCents }, 'c1'),
          tick(a, 'c1', po.key), tick(b, 'c1', po.key)],
      });
      return { po, state };
    };

    it('reads $0.00 off, the same as when Stripe still lists it', () => {
      const { po, state } = unread();
      const unlisted = evaluateCheck(state([]), 'c1');
      assert.equal(unlisted.differenceCents, 0);
      assert.equal(unlisted.payoutGapCents, -100, 'the gap is counted, not dropped');
      assert.deepEqual(unlisted.payoutGaps, [{ key: po.key, depositCents: 8900, bookCents: 9000, gapCents: -100 }]);
      const listed = evaluateCheck(state([po]), 'c1');
      assert.equal(listed.differenceCents, unlisted.differenceCents);
      assert.equal(listed.tickedBalanceCents, unlisted.tickedBalanceCents);
    });

    it('is one payout row with its members, not two plain lines', () => {
      const ev = evaluateCheck(unread().state([]), 'c1');
      assert.deepEqual(ev.ticked.map(r => [r.kind, r.key]), [['payout', 'payout:p1']]);
      const row = ev.ticked[0];
      assert.ok(row.kind === 'payout' && row.fromMark && row.members.map(m => m.key).join() === 'entry:a,entry:b');
    });

    it('does not read as changed since, and Mark checked again keeps the members’ link to it', () => {
      const s = unread().state([]);
      assert.deepEqual(evaluateCheck(s, 'c1').changedSince, []);
      const { marks } = snapshotForMarking(s, 'c1');
      assert.deepEqual(marks.map(m => m.key).sort(), ['entry:a', 'entry:b', 'payout:p1']);
      assert.equal(marks.find(m => m.key === 'entry:a')?.payoutKey, 'payout:p1');
    });

    it('a member the book has since deleted is not inside the rebuilt payout: the gap grows, and re-marking drops its tick', () => {
      const { state } = unread();
      const s = state([]);
      s.lines = [s.lines[0]]; // entry:b is gone from the book; a route stamped it removed
      s.stampedChanges = [{ key: 'entry:b', checkId: 'c1', changedBy: null, changedAt: '2026-11-01T00:00:00Z', removed: true }];
      const ev = evaluateCheck(s, 'c1');
      const row = ev.ticked[0];
      assert.ok(row.kind === 'payout' && row.members.map(m => m.key).join() === 'entry:a');
      assert.equal(ev.differenceCents, 0, 'the deposit is still counted once; the gap absorbs the deleted line');
      assert.deepEqual(ev.changedSince.map(c => c.key), ['entry:b'], 'and it still reads as changed since');
      assert.deepEqual(snapshotForMarking(s, 'c1').marks.map(m => m.key).sort(), ['entry:a', 'payout:p1']);
    });

    it('a ticked member rides the payout its tick names, even when the book now names another (review: counted twice)', () => {
      // Payout P ($97.00) was ticked with e:1 ($60.00) and e:2 ($40.00). The book now says e:1 rode a LATER payout Q.
      const e1 = line('entry:e1', '2026-10-06', 'in', 6000, { payoutKey: 'payout:q' });
      const e2 = line('entry:e2', '2026-10-07', 'in', 4000);
      const s: BankAccountState = {
        setup: { openingDate: '2026-09-30', openingBalanceCents: 0 },
        lines: [e1, e2], payouts: [],
        checks: [check('c1', '2026-10-31', 9700, { status: 'checked', outstandingSnapshot: [] })],
        marks: [tick({ key: 'payout:p', date: '2026-10-05', direction: 'in', amountCents: 9700 }, 'c1'),
          tick(e1, 'c1', 'payout:p'), tick(e2, 'c1', 'payout:p')],
      };
      const ev = evaluateCheck(s, 'c1');
      assert.equal(ev.differenceCents, 0, 'the deposit is counted once');
      assert.deepEqual(ev.ticked.map(r => r.key), ['payout:p']);
      assert.equal(ev.payoutGapCents, -300);
    });

    it('a payout Stripe still lists is read from Stripe, not from the tick', () => {
      const { po, state } = unread();
      // Stripe now says $88.00 (the tick was $89.00): Stripe's figure is the one read, and the statement shows it.
      const ev = evaluateCheck(state([{ ...po, amountCents: 8800 }]), 'c1');
      const row = ev.ticked[0];
      assert.ok(row.kind === 'payout' && !row.fromMark && row.amountCents === 8800);
      assert.equal(ev.payoutGapCents, -200);
      assert.equal(ev.differenceCents, 100);
      assert.deepEqual(ev.changedSince.map(c => c.key), ['payout:p1'], 'and the changed deposit is flagged');
    });

    it('a payout ticked on ANOTHER statement shows nothing here: no row, no members, no gap', () => {
      const s = unread().state([]);
      s.checks = [...s.checks, check('c2', '2026-11-30', 108900)];
      const ev = evaluateCheck(s, 'c2');
      assert.deepEqual([ev.ticked, ev.outstanding], [[], []]);
      assert.equal(ev.payoutGapCents, 0);
      assert.equal(ev.differenceCents, 0);
    });

    it('a debit payout (refunds outran payments) is rebuilt in the out direction', () => {
      const a = line('entry:r1', '2026-10-06', 'out', 5200);
      const s: BankAccountState = {
        setup: { openingDate: '2026-09-30', openingBalanceCents: 100000 },
        lines: [a], payouts: [],
        checks: [check('c1', '2026-10-31', 95000, { status: 'checked', outstandingSnapshot: [] })],
        marks: [tick({ key: 'payout:p9', date: '2026-10-05', direction: 'out', amountCents: 5000 }, 'c1'), tick(a, 'c1', 'payout:p9')],
      };
      const ev = evaluateCheck(s, 'c1');
      const row = ev.ticked[0];
      assert.ok(row.kind === 'payout' && row.direction === 'out' && row.amountCents === 5000 && row.bookCents === -5200);
      assert.equal(ev.payoutGapCents, 200);
      assert.equal(ev.differenceCents, 0);
    });
  });

  it('a member ticked on its own while its payout was unreadable stays ticked when the payout reappears', () => {
    const { a, b, base } = payoutBook();
    const s = base();
    s.marks = [tick(a, 'c1'), tick(b, 'c1')];
    s.checks[0].statementEndingBalanceCents = 109000;
    const ev = evaluateCheck(s, 'c1');
    assert.equal(ev.differenceCents, 0);
    assert.deepEqual(ev.ticked.map(r => r.key), ['entry:a', 'entry:b']);
  });

  it('a voided ticked line is dropped by Mark checked again, so its amber clears', () => {
    const x = line('entry:x', '2026-10-05', 'in', 1000, { status: 'void' });
    const y = line('entry:y', '2026-10-06', 'in', 1000);
    const s: BankAccountState = {
      setup: { openingDate: '2026-09-30', openingBalanceCents: 100000 }, lines: [x, y],
      checks: [check('c1', '2026-10-31', 101000, { status: 'checked', outstandingSnapshot: [] })],
      marks: [tick(x, 'c1'), tick(y, 'c1')],
    };
    assert.deepEqual(canMarkCheckedAgain(s, 'c1'), { ok: true });
    const { marks } = snapshotForMarking(s, 'c1');
    assert.deepEqual(marks.map(m => m.key), ['entry:y']);
    const after = { ...s, marks };
    assert.deepEqual(evaluateCheck(after, 'c1').changedSince, []);
    assert.deepEqual(canMarkCheckedAgain(after, 'c1'), { ok: false, reason: 'nothing_changed' });
  });

  it('a ticked line the book deleted (stamped removed) counts for nothing and reads as a change', () => {
    const z = { key: 'entry:z', date: '2026-10-05', direction: 'in' as const, amountCents: 1000 };
    const s: BankAccountState = {
      setup: { openingDate: '2026-09-30', openingBalanceCents: 100000 }, lines: [],
      checks: [check('c1', '2026-10-31', 100000, { status: 'checked', outstandingSnapshot: [] })],
      marks: [tick(z, 'c1')],
      stampedChanges: [{ key: 'entry:z', checkId: 'c1', changedBy: 'u1', changedAt: '2026-11-01T10:00:00Z', removed: true }],
    };
    const ev = evaluateCheck(s, 'c1');
    assert.equal(ev.differenceCents, 0, 'the deleted money is not in the band');
    assert.deepEqual(ev.changedSince.map(c => [c.key, c.now]), [['entry:z', null]]);
    assert.deepEqual(snapshotForMarking(s, 'c1').marks, [], 'and marking again lets it go');
  });

  it('a picked opening item the book still reads stays outstanding on the second statement', () => {
    const old = line('entry:old', '2026-09-20', 'out', 3000);
    const s: BankAccountState = {
      setup: { openingDate: '2026-09-30', openingBalanceCents: 100000 }, lines: [old],
      openingItems: [{ ...old, kind: 'picked' }],
      checks: [check('c1', '2026-10-31', 100000)], marks: [],
    };
    const { outstandingSnapshot } = snapshotForMarking(s, 'c1');
    const second: BankAccountState = {
      setup: s.setup, lines: [old], // openingItems deliberately NOT passed again
      checks: [check('c1', '2026-10-31', 100000, { status: 'checked', outstandingSnapshot }), check('c2', '2026-11-30', 100000)],
      marks: [],
    };
    assert.deepEqual(evaluateCheck(second, 'c2').outstanding.map(r => r.key), ['entry:old']);
  });
});
