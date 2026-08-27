import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  commitmentStanding, installmentStatus, installmentStatuses, installmentsInScope, scopeChoiceIsMeaningful,
  PAYABLE_STATUS_DEFAULT,
  installmentLabel, paymentLabel, effectivePayerId, paymentMovedTeamCash,
  type PayableInstallment, type PayablePayment, type EditScope,
} from '../../lib/payable-standing.ts';

/**
 * This module decides whether a coach's bill reads "paid", "partly paid" or "$400 still owing", and
 * which rows a bulk edit on a repeating cost is allowed to touch. Both answers move real money, and
 * both were absent from the product until the Payables Rebuild — so the cases below are written
 * against the RULES in the plan (R1–R6, S1–S8), not against the implementation.
 */

let seq = 0;
function inst(over: Partial<PayableInstallment> = {}): PayableInstallment {
  seq += 1;
  return {
    id: `i${seq}`,
    expenseId: 'e1',
    installmentNumber: seq,
    amount: 450,
    dueDate: '2026-10-01',
    ...over,
  };
}
function pay(over: Partial<PayablePayment> = {}): PayablePayment {
  seq += 1;
  return {
    id: `p${seq}`,
    expenseId: 'e1',
    installmentId: null,
    amount: 450,
    paidDate: '2026-10-01',
    method: null,
    note: null,
    accountingEntryId: `ae${seq}`,
    ...over,
  };
}

/** The six-installment monthly series QA §64 Part E walks, with the first two settled. */
function monthlySeries() {
  const months = ['2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01'];
  const installments = months.map((dueDate, i) =>
    inst({ id: `m${i + 1}`, installmentNumber: i + 1, amount: 450, dueDate }));
  const payments = [
    pay({ id: 'pm1', amount: 450, paidDate: '2026-10-01' }),
    pay({ id: 'pm2', amount: 450, paidDate: '2026-11-03' }),
  ];
  return { installments, payments };
}

describe('what a commitment adds up to', () => {
  test('R2 — the total is the SUM OF INSTALLMENTS, not a separately typed figure', () => {
    const s = commitmentStanding([inst({ amount: 200 }), inst({ amount: 400 })], []);
    assert.equal(s.total, 600);
  });

  test('nothing paid reads unpaid, and owes the whole total', () => {
    const s = commitmentStanding([inst({ amount: 600 })], []);
    assert.equal(s.state, 'unpaid');
    assert.equal(s.remaining, 600);
    assert.equal(s.over, 0);
  });

  test('⚠ THE DEFECT THIS PROJECT EXISTS FOR — $200 against $600 is PARTLY PAID, not paid', () => {
    const s = commitmentStanding([inst({ amount: 600 })], [pay({ amount: 200 })]);
    assert.equal(s.state, 'partly_paid');
    assert.equal(s.paid, 200);
    assert.equal(s.remaining, 400);
    // Before the rebuild this could only be expressed by splitting the bill BEFORE any money moved.
    assert.equal(s.installments[0].state, 'partly_paid');
    assert.equal(s.installments[0].applied, 200);
  });

  test('paying it off in pieces settles it', () => {
    const s = commitmentStanding(
      [inst({ amount: 600 })],
      [pay({ amount: 200, paidDate: '2026-10-01' }), pay({ amount: 400, paidDate: '2026-11-01' })],
    );
    assert.equal(s.state, 'settled');
    assert.equal(s.remaining, 0);
  });

  test('R6 — over-payment is ACCEPTED and STATED, never refused or clamped away', () => {
    const s = commitmentStanding([inst({ amount: 450 })], [pay({ amount: 500 })]);
    assert.equal(s.state, 'settled');
    assert.equal(s.paid, 500);
    assert.equal(s.remaining, 0, 'remaining floors at zero — it must never go negative');
    assert.equal(s.over, 50, 'the screen says "$50 over"; the arithmetic has to hand it that number');
  });

  test('R5 — undo is removing a payment, and the standing simply re-derives', () => {
    const payments = [pay({ id: 'a', amount: 200 }), pay({ id: 'b', amount: 400 })];
    assert.equal(commitmentStanding([inst({ amount: 600 })], payments).state, 'settled');
    const afterUndo = commitmentStanding([inst({ amount: 600 })], payments.filter(p => p.id !== 'b'));
    assert.equal(afterUndo.state, 'partly_paid');
    assert.equal(afterUndo.remaining, 400);
  });
});

describe('R3 — one payment, several installments', () => {
  test('⚠ a single $700 cheque settles the first $450 and part-pays the second', () => {
    const installments = [
      inst({ id: 'a', installmentNumber: 1, amount: 450, dueDate: '2026-10-01' }),
      inst({ id: 'b', installmentNumber: 2, amount: 450, dueDate: '2026-11-01' }),
    ];
    const s = commitmentStanding(installments, [pay({ amount: 700 })]);
    const [first, second] = s.installments;
    assert.equal(first.state, 'settled');
    assert.equal(second.state, 'partly_paid');
    assert.equal(second.applied, 250, 'the coach is never asked to do this arithmetic');
    assert.equal(second.remaining, 200);
  });

  test('money fills by DUE DATE, not by installment number', () => {
    // Installment 2 was moved EARLIER than installment 1. Payments must follow the schedule a
    // coach actually reads, not the order the rows were created in.
    const installments = [
      inst({ id: 'late', installmentNumber: 1, amount: 100, dueDate: '2026-12-01' }),
      inst({ id: 'early', installmentNumber: 2, amount: 100, dueDate: '2026-10-01' }),
    ];
    const s = commitmentStanding(installments, [pay({ amount: 100 })]);
    assert.equal(s.installments[0].id, 'early');
    assert.equal(s.installments[0].state, 'settled');
    assert.equal(s.installments[1].state, 'unpaid');
  });

  test('the coach can override where a payment lands, and the override wins', () => {
    const installments = [
      inst({ id: 'oct', installmentNumber: 1, amount: 450, dueDate: '2026-10-01' }),
      inst({ id: 'nov', installmentNumber: 2, amount: 450, dueDate: '2026-11-01' }),
    ];
    const s = commitmentStanding(installments, [pay({ amount: 450, installmentId: 'nov' })]);
    assert.equal(s.installments[0].state, 'unpaid', 'October is still owed');
    assert.equal(s.installments[1].state, 'settled', 'the coach said this one was for November');
  });

  test('an override that over-fills its target still spills FORWARD, never backward', () => {
    const installments = [
      inst({ id: 'oct', installmentNumber: 1, amount: 450, dueDate: '2026-10-01' }),
      inst({ id: 'nov', installmentNumber: 2, amount: 450, dueDate: '2026-11-01' }),
      inst({ id: 'dec', installmentNumber: 3, amount: 450, dueDate: '2026-12-01' }),
    ];
    const s = commitmentStanding(installments, [pay({ amount: 700, installmentId: 'nov' })]);
    assert.equal(s.installments[0].state, 'unpaid');
    assert.equal(s.installments[1].state, 'settled');
    assert.equal(s.installments[2].applied, 250);
  });

  test('⚠ a payment whose target installment was deleted is NOT lost', () => {
    // Deleting an installment must never quietly reduce what the books say was paid.
    const s = commitmentStanding(
      [inst({ id: 'oct', amount: 450, dueDate: '2026-10-01' })],
      [pay({ amount: 450, installmentId: 'deleted-row' })],
    );
    assert.equal(s.paid, 450);
    assert.equal(s.installments[0].state, 'settled');
  });

  test('the standing is stable — the same records always produce the same answer', () => {
    const { installments, payments } = monthlySeries();
    const forwards = commitmentStanding(installments, payments);
    const backwards = commitmentStanding([...installments].reverse(), [...payments].reverse());
    assert.deepEqual(
      forwards.installments.map(i => [i.id, i.applied]),
      backwards.installments.map(i => [i.id, i.applied]),
    );
  });

  test('cents, not floats — three payments of 0.10 settle a 0.30 bill exactly', () => {
    const s = commitmentStanding(
      [inst({ amount: 0.3 })],
      [pay({ id: 'a', amount: 0.1 }), pay({ id: 'b', amount: 0.1 }), pay({ id: 'c', amount: 0.1 })],
    );
    assert.equal(s.remaining, 0, 'a penny nobody can clear is the bug this guards');
    assert.equal(s.state, 'settled');
  });
});

describe('the status a coach reads and filters by', () => {
  const today = '2026-11-15';

  test('the four statuses, including the one the old pills could not express', () => {
    const settled = commitmentStanding([inst({ amount: 100, dueDate: '2026-10-01' })], [pay({ amount: 100 })]);
    assert.equal(installmentStatus(settled.installments[0], today), 'paid');

    const overdue = commitmentStanding([inst({ amount: 100, dueDate: '2026-10-01' })], []);
    assert.equal(installmentStatus(overdue.installments[0], today), 'overdue');

    const ahead = commitmentStanding([inst({ amount: 100, dueDate: '2026-12-01' })], []);
    assert.equal(installmentStatus(ahead.installments[0], today), 'outstanding');

    const part = commitmentStanding([inst({ amount: 100, dueDate: '2026-12-01' })], [pay({ amount: 40 })]);
    assert.equal(installmentStatus(part.installments[0], today), 'partly_paid');
  });

  test('⚠ overdue beats partly paid — a late bill is chased, not filed as progress', () => {
    const s = commitmentStanding([inst({ amount: 100, dueDate: '2026-10-01' })], [pay({ amount: 40 })]);
    assert.equal(installmentStatus(s.installments[0], today), 'overdue');
  });

  test('the Status filter opens on what is owed, not on a season of settled history', () => {
    assert.deepEqual([...PAYABLE_STATUS_DEFAULT], ['outstanding', 'overdue']);
  });
});

describe('⚠⚠ what the Status DROPDOWN matches on — partly paid cuts across (owner ruling 2026-08-20)', () => {
  const today = '2026-11-15';
  const one = (amount: number, dueDate: string, paid: number) =>
    commitmentStanding([inst({ amount, dueDate })], paid > 0 ? [pay({ amount: paid })] : []).installments[0];

  test('a settled piece is paid and nothing else', () => {
    assert.deepEqual([...installmentStatuses(one(100, '2026-10-01', 100), today)], ['paid']);
  });

  test('an untouched piece carries only its date word', () => {
    assert.deepEqual([...installmentStatuses(one(100, '2026-10-01', 0), today)], ['overdue']);
    assert.deepEqual([...installmentStatuses(one(100, '2026-12-01', 0), today)], ['outstanding']);
  });

  test('a LATE part-paid piece is BOTH — the case the single bucket hid', () => {
    const s = [...installmentStatuses(one(100, '2026-10-01', 40), today)];
    assert.deepEqual(s, ['overdue', 'partly_paid']);
    // The badge still shows one word; only the filter sees both.
    assert.equal(installmentStatus(one(100, '2026-10-01', 40), today), 'overdue');
  });

  test('⚠⚠ THE DEFAULT VIEW KEEPS A PART-PAID BILL — the money the old rule lost', () => {
    // Not yet due, $40 of $100 against it: filed as `partly_paid` alone, it appeared in neither
    // Outstanding nor Overdue, so $60 the team still owed was absent from the opening view.
    const piece = one(100, '2026-12-01', 40);
    const matches = installmentStatuses(piece, today)
      .some(s => (PAYABLE_STATUS_DEFAULT as readonly string[]).includes(s));
    assert.equal(matches, true, 'a part-paid bill must survive the default Outstanding + Overdue');
    assert.equal(piece.remaining, 60);
  });

  test('counts overlap on purpose — one piece, two words', () => {
    const late = one(100, '2026-10-01', 40);
    assert.equal(installmentStatuses(late, today).length, 2);
  });
});

describe('S1 — a bulk scope may never touch settled money', () => {
  test('"this and later" skips the settled ones and takes the rest', () => {
    const { installments, payments } = monthlySeries();
    const s = commitmentStanding(installments, payments);
    const ids = installmentsInScope(s, 'm4', 'this_and_later').map(i => i.id);
    assert.deepEqual(ids, ['m4', 'm5', 'm6']);
  });

  test('⚠⚠ "all unpaid" reaches EARLIER unpaid rows too, and still never the settled ones', () => {
    const { installments, payments } = monthlySeries();
    const s = commitmentStanding(installments, payments);
    const ids = installmentsInScope(s, 'm4', 'all_unpaid').map(i => i.id);
    assert.deepEqual(ids, ['m3', 'm4', 'm5', 'm6'], 'm3 is earlier than the edited row and IS included');
    assert.ok(!ids.includes('m1') && !ids.includes('m2'), 'money that already left the account is untouchable');
  });

  test('⚠ R4 — a PARTLY PAID installment counts as unpaid and IS in scope', () => {
    const { installments, payments } = monthlySeries();
    // December is part-paid: $100 of $450.
    const s = commitmentStanding(installments, [...payments, pay({ id: 'part', amount: 100, installmentId: 'm3' })]);
    assert.equal(s.installments[2].state, 'partly_paid');
    assert.ok(installmentsInScope(s, 'm4', 'all_unpaid').map(i => i.id).includes('m3'));
  });

  test('⚠⚠ S2 — "this payment only" STILL REACHES a settled installment', () => {
    // Standing owner ruling 2026-08-16, tested by QA §27 Part C (passed 2026-08-19): nothing on a
    // saved record is greyed out; the books follow the edit. A scope that dropped the row the coach
    // deliberately opened would reverse that ruling by accident.
    const { installments, payments } = monthlySeries();
    const s = commitmentStanding(installments, payments);
    assert.equal(s.installments[0].state, 'settled');
    assert.deepEqual(installmentsInScope(s, 'm1', 'this').map(i => i.id), ['m1']);
  });

  test('a bulk scope from a settled row keeps that row and adds only unsettled ones after it', () => {
    const { installments, payments } = monthlySeries();
    const s = commitmentStanding(installments, payments);
    assert.deepEqual(
      installmentsInScope(s, 'm2', 'this_and_later').map(i => i.id),
      ['m2', 'm3', 'm4', 'm5', 'm6'],
    );
  });

  test('every scope on a fully settled series still refuses to bulk-touch anything', () => {
    const installments = [inst({ id: 'a', amount: 100, dueDate: '2026-10-01' }),
                         inst({ id: 'b', amount: 100, dueDate: '2026-11-01' })];
    const s = commitmentStanding(installments, [pay({ amount: 200 })]);
    assert.deepEqual(installmentsInScope(s, 'a', 'all_unpaid'), []);
    assert.deepEqual(installmentsInScope(s, 'a', 'this_and_later').map(i => i.id), ['a']);
  });

  test('an unknown target selects nothing rather than defaulting to everything', () => {
    const { installments, payments } = monthlySeries();
    const s = commitmentStanding(installments, payments);
    for (const scope of ['this', 'this_and_later', 'all_unpaid'] as EditScope[]) {
      assert.deepEqual(installmentsInScope(s, 'not-a-row', scope), []);
    }
  });
});

describe('S4 — the scope question is only asked when it has more than one answer', () => {
  test('a six-month series with unpaid months ahead: worth asking', () => {
    const { installments, payments } = monthlySeries();
    assert.equal(scopeChoiceIsMeaningful(commitmentStanding(installments, payments), 'm4'), true);
  });

  test('⚠ five of six settled: all three scopes mean the same row, so do not ask', () => {
    const { installments } = monthlySeries();
    const payments = ['m1', 'm2', 'm3', 'm4', 'm5'].map((id, n) =>
      pay({ id: `s${n}`, amount: 450, installmentId: id }));
    const s = commitmentStanding(installments, payments);
    assert.equal(scopeChoiceIsMeaningful(s, 'm6'), false);
  });

  test('a one-installment commitment never asks', () => {
    const s = commitmentStanding([inst({ id: 'only', amount: 450 })], []);
    assert.equal(scopeChoiceIsMeaningful(s, 'only'), false);
  });
});

describe('R1 — a commitment always has at least one installment', () => {
  test('the "No schedule" state stops being representable', () => {
    // A payable with an amount and no due date used to be invisible: absent from the payment
    // schedule and from Next 30 days, with no way to mark it paid. Migration 255 gives every one of
    // them a date, so there is no such thing as a commitment this module cannot describe.
    const s = commitmentStanding([inst({ amount: 600, dueDate: '2026-10-01' })], []);
    assert.equal(s.installments.length, 1);
    assert.equal(s.total, 600);
  });

  test('no installments at all is an empty standing, never a crash', () => {
    const s = commitmentStanding([], []);
    assert.equal(s.total, 0);
    assert.equal(s.state, 'settled');
    assert.deepEqual(s.installments, []);
  });
});

/**
 * ⚠⚠ ONE NAME FOR ONE PIECE, ACROSS FOUR SCREENS. Until P1 the product had three spellings for the
 * same dated piece of the same commitment — "— deposit" on the register, "— Deposit" on the ledger
 * entry it posted, "— installment 1 of 2" on the payment schedule — so a coach reconciling a bank
 * statement across three screens had to work out that those were one payment.
 */
describe('installmentLabel — what a piece is called', () => {
  test('a one-piece commitment takes NO suffix', () => {
    // Every plain cost in the product is a one-installment commitment now (R1), so a suffix here
    // would append six words to most rows on the register for no information at all.
    assert.equal(installmentLabel('Dome rental', 1, 1), 'Dome rental');
  });

  test('a split commitment names its piece and how many there are', () => {
    assert.equal(installmentLabel('Regional entry', 1, 2), 'Regional entry — installment 1 of 2');
    assert.equal(installmentLabel('Regional entry', 2, 2), 'Regional entry — installment 2 of 2');
  });

  test('a monthly series does not pretend to be a deposit and a balance', () => {
    assert.equal(installmentLabel('Dome rental', 5, 6), 'Dome rental — installment 5 of 6');
  });
});

describe('paymentLabel — which piece a payment is NAMED for', () => {
  test('the coach’s own override decides where the money starts', () => {
    const s = commitmentStanding(
      [inst({ id: 'a', installmentNumber: 1, amount: 300, dueDate: '2026-10-01' }),
       inst({ id: 'b', installmentNumber: 2, amount: 300, dueDate: '2026-11-01' })],
      [pay({ id: 'x', amount: 300, installmentId: 'b' })],
    );
    assert.equal(paymentLabel('Dome', s.payments[0], 2), 'Dome — installment 2 of 2');
  });

  test('an untargeted payment is named for the earliest piece the money touched', () => {
    /* ⚠ NAMING IS NOT THE APPLICATION RULE. One $700 cheque covering a full month and half the next
       settles two pieces; the row describing it says which piece it started on, because a one-line
       description cannot say "and half of the next one" without lying about how many payments were
       made. */
    const s = commitmentStanding(
      [inst({ id: 'a', installmentNumber: 1, amount: 400, dueDate: '2026-10-01' }),
       inst({ id: 'b', installmentNumber: 2, amount: 600, dueDate: '2026-11-01' })],
      [pay({ id: 'x', amount: 700, installmentId: null })],
    );
    assert.equal(paymentLabel('Dome', s.payments[0], 2), 'Dome — installment 1 of 2');
  });

  test('⚠⚠ SEVERAL UNTARGETED PAYMENTS EACH NAME THEIR OWN PIECE', () => {
    /* THE DEFECT THIS REPLACED (`/review`, correctness lens, 2026-08-19). The number used to be
       found by scanning the commitment for the first piece carrying any money — which cannot tell
       two payments apart, so three monthly payments correctly applied to pieces 1, 2 and 3 were ALL
       labelled "installment 1 of 3" on the register and on Budget vs. Actual. That is precisely the
       reconcile-against-a-bank-statement use the label exists for. Dormant while every payment
       carried an explicit piece; live the moment P2's Record a payment lands. */
    const s = commitmentStanding(
      [inst({ id: 'a', installmentNumber: 1, amount: 100, dueDate: '2026-10-01' }),
       inst({ id: 'b', installmentNumber: 2, amount: 100, dueDate: '2026-11-01' }),
       inst({ id: 'c', installmentNumber: 3, amount: 100, dueDate: '2026-12-01' })],
      [pay({ id: 'p1', amount: 100, installmentId: null, paidDate: '2026-10-02' }),
       pay({ id: 'p2', amount: 100, installmentId: null, paidDate: '2026-11-02' }),
       pay({ id: 'p3', amount: 100, installmentId: null, paidDate: '2026-12-02' })],
    );
    assert.deepEqual(s.payments.map(p => p.landedOn), [1, 2, 3]);
    assert.deepEqual(s.payments.map(p => paymentLabel('Dome', p, 3)), [
      'Dome — installment 1 of 3',
      'Dome — installment 2 of 3',
      'Dome — installment 3 of 3',
    ]);
  });

  test('a payment aimed at a FULL piece is named for where the money actually went', () => {
    // Naming the full piece would be a lie about where the money landed. The override still decides
    // where the pour starts, which is what it is for.
    const s = commitmentStanding(
      [inst({ id: 'a', installmentNumber: 1, amount: 100, dueDate: '2026-10-01' }),
       inst({ id: 'b', installmentNumber: 2, amount: 100, dueDate: '2026-11-01' })],
      [pay({ id: 'first', amount: 100, installmentId: 'a', paidDate: '2026-10-02' }),
       pay({ id: 'second', amount: 100, installmentId: 'a', paidDate: '2026-10-03' })],
    );
    assert.deepEqual(s.payments.map(p => p.landedOn), [1, 2]);
  });

  test('a payment that fits nowhere takes the bare description', () => {
    const s = commitmentStanding(
      [inst({ id: 'a', installmentNumber: 1, amount: 100, dueDate: '2026-10-01' })],
      [pay({ id: 'p1', amount: 100, paidDate: '2026-10-02' }),
       pay({ id: 'over', amount: 50, paidDate: '2026-10-03' })],
    );
    assert.equal(s.payments[1].landedOn, null);
    assert.equal(paymentLabel('Dome', s.payments[1], 1), 'Dome');
  });

  test('a payment whose target was deleted falls back rather than vanishing', () => {
    const s = commitmentStanding(
      [inst({ id: 'a', installmentNumber: 1, amount: 300, dueDate: '2026-10-01' })],
      [pay({ id: 'x', amount: 300, installmentId: 'gone' })],
    );
    assert.equal(s.payments[0].landedOn, 1);
  });
});

describe('the standing carries its payments, so every screen reads ONE object', () => {
  test('payments come back oldest first', () => {
    const s = commitmentStanding(
      [inst({ id: 'a', amount: 900, dueDate: '2026-10-01' })],
      [pay({ id: 'late', amount: 600, paidDate: '2026-11-09' }),
       pay({ id: 'early', amount: 300, paidDate: '2026-10-14' })],
    );
    assert.deepEqual(s.payments.map(p => p.id), ['early', 'late']);
  });

  test('a commitment with nothing recorded carries an empty list, never undefined', () => {
    assert.deepEqual(commitmentStanding([inst({ amount: 450 })], []).payments, []);
  });
});

/**
 * ⚠⚠ WHOSE MONEY MOVED — money centralization P4, mig 267.
 *
 * These two functions exist so that eight readers cannot each invent the rule. Three of them
 * decide load-bearing figures: the register's running balance (which IS cash on hand), the season
 * settlement pot (which sets every family's refund) and Budget vs. Actual's cash strip. Every case
 * below is one those three used to get wrong by real money when they asked the COST instead.
 */
describe('effectivePayerId / paymentMovedTeamCash — the payer is the payment’s, then the cost’s', () => {
  test('nobody named anywhere: the team paid it', () => {
    assert.equal(effectivePayerId({ paidByPlayerId: null }, null), null);
    assert.equal(paymentMovedTeamCash({ paidByPlayerId: null }, null), true);
  });

  test('the payment names a family: no team cash moved', () => {
    assert.equal(effectivePayerId({ paidByPlayerId: 'avery' }, null), 'avery');
    assert.equal(paymentMovedTeamCash({ paidByPlayerId: 'avery' }, null), false);
  });

  test('⚠ the COST names a family: every payment against it is theirs (mig 234, unchanged)', () => {
    assert.equal(effectivePayerId({ paidByPlayerId: null }, 'avery'), 'avery');
    assert.equal(paymentMovedTeamCash({ paidByPlayerId: null }, 'avery'), false);
  });

  test('an absent field reads exactly like an explicit null', () => {
    // Pure callers build payment-shaped objects for arithmetic and must not have to answer a
    // question they are not asking.
    assert.equal(effectivePayerId({}, null), null);
    assert.equal(paymentMovedTeamCash({}, 'avery'), false);
  });

  test('⚠⚠ ONE BILL, BOTH KINDS — the case the cost-level answer could not express', () => {
    // The owner's case: $600 entry; a parent pays the $200 deposit direct, the team pays $400.
    const s = commitmentStanding(
      [inst({ amount: 200, dueDate: '2026-05-01' }), inst({ amount: 400, dueDate: '2026-06-01' })],
      [pay({ id: 'dep', amount: 200, paidDate: '2026-05-02', paidByPlayerId: 'avery' }),
       pay({ id: 'bal', amount: 400, paidDate: '2026-06-02' })],
    );
    const cash = s.payments.filter(p => paymentMovedTeamCash(p, null));
    assert.deepEqual(cash.map(p => p.id), ['bal']);
    assert.equal(cash.reduce((t, p) => t + p.amount, 0), 400,
      'asking the cost would have counted $600 of team cash or $0 — both wrong by real money');
  });

  test('the standing carries the payer through, so a screen reads ONE object', () => {
    const s = commitmentStanding([inst({ amount: 200 })], [pay({ amount: 200, paidByPlayerId: 'blake' })]);
    assert.equal(s.payments[0].paidByPlayerId, 'blake');
  });
});
