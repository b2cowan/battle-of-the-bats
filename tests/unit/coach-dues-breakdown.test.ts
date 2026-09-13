import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDuesBreakdown } from '../../lib/coach-dues-breakdown';
import { splitDuesLadder } from '../../lib/dues-payments';

test('two adjustments and forgiveness have their own total without changing the balance', () => {
  const credits = [
    { creditType: 'other', amount: 17, description: 'Photos' },
    { creditType: 'other', amount: 30, description: 'Training' },
    { creditType: 'forgiven', amount: 100, description: 'Bill forgiven' },
    { creditType: 'reimbursement', amount: 180, description: 'Umpires' },
    { creditType: 'reimbursement', amount: 200, description: 'Entry fee' },
    { creditType: 'fundraiser', amount: 198.15, description: 'Raised' },
  ];
  const base = { dues: 1000, grossPayments: 200, cappedPaid: 200, creditsIssued: 725.15, fundraiserIssued: 198.15, overpaymentIssued: 0, paidOut: 0 };
  const before = splitDuesLadder(base), after = splitDuesLadder({ ...base, billLowered: 147 });
  const result = buildDuesBreakdown({ credits, grossDues: 1000, netDues: after.dues, ownMoney: after.ownMoney });
  assert.equal(result.adjustmentsTotal, 147);
  assert.equal(result.other.reduce((s, r) => s + r.amount, 0), after.otherCredits);
  assert.equal(result.adjustments.length, 3);
  assert.equal(before.dues - before.fundraising - before.otherCredits - before.paid,
    after.dues - after.fundraising - after.otherCredits - after.paid);
  assert.equal(result.adjustmentsReturned, 0);
});

test('partly returned adjustments reconcile original charges to net dues and other credits', () => {
  const credits = [{ creditType: 'other', amount: 17 }, { creditType: 'reimbursement', amount: 180 }];
  const ladder = splitDuesLadder({ dues: 700, grossPayments: 0, cappedPaid: 0, creditsIssued: 197, fundraiserIssued: 0, overpaymentIssued: 0, paidOut: 5, billLowered: 12 });
  const b = buildDuesBreakdown({ credits, grossDues: 700, netDues: ladder.dues, ownMoney: 0 });
  assert.equal(b.adjustmentsTotal, 17);
  assert.equal(b.adjustmentsReturned, 5);
  assert.equal(700 - b.adjustmentsTotal + b.adjustmentsReturned, ladder.dues);
  assert.equal(b.other.reduce((s, r) => s + r.amount, 0) + b.adjustmentsReturned, ladder.otherCredits);
  assert.equal(ladder.dues - ladder.otherCredits + ladder.handedBack, 508);
});

test('a partially own-money overpayment keeps only its remainder in Other credits and retains the original edit record', () => {
  const c = { creditType: 'overpayment', amount: 75, description: 'Older credit' };
  const b = buildDuesBreakdown({ credits: [c], grossDues: 700, netDues: 700, ownMoney: 50 });
  assert.equal(b.other[0].amount, 25);
  assert.equal(b.other[0].credit, c);
  assert.equal(c.amount, 75);
  assert.equal(b.adjustments.length, 0);
});

test('empty and cent-valued adjustment lists retain exact totals', () => {
  assert.deepEqual(buildDuesBreakdown({ credits: [], grossDues: 700, netDues: 700, ownMoney: 0 }).adjustments, []);
  const b = buildDuesBreakdown({ credits: [{ creditType: 'other', amount: 0.1 }, { creditType: 'other', amount: 0.2 }], grossDues: 700, netDues: 699.7, ownMoney: 0 });
  assert.equal(b.adjustmentsTotal, 0.3);
  assert.equal(b.reduction, 0.3);
  assert.equal(b.adjustmentsReturned, 0);
});

/* /review 2026-09-12 (F04 follow-through): a row written before both schedule doors refused it —
   write-offs past the bill — now reads Dues $0.00 instead of a negative, and the breakdown must
   not turn the over-bill excess into "already returned" money nobody was ever paid. */
test('write-offs past the bill (pre-guard data) never print as adjustments already returned', () => {
  const credits = [{ creditType: 'other', amount: 600, description: 'Legacy write-off' }];
  const ladder = splitDuesLadder({ dues: 300, grossPayments: 0, cappedPaid: 0, creditsIssued: 600, fundraiserIssued: 0, overpaymentIssued: 0, paidOut: 0, billLowered: 600 });
  assert.equal(ladder.dues, 0, 'floored at the bill');
  const b = buildDuesBreakdown({ credits, grossDues: 300, netDues: ladder.dues, ownMoney: 0 });
  assert.equal(b.adjustmentsTotal, 600);
  assert.equal(b.reduction, 300, 'the bill was lowered by the bill');
  assert.equal(b.adjustmentsReturned, 0, 'nothing was handed back, so nothing reads as returned');
});
