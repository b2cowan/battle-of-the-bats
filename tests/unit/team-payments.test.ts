/**
 * A TEAM'S PAYMENTS — the model (mig 345; TEAM_PAYMENTS_LIST_PLAN.md). What is still due comes from the fee and the SUM
 * received, never from a row's label: $50 recorded on a $100 deposit leaves "Owes $250", with the deposit's $50 and the whole
 * balance still due. The form and the server check an amount and a day the same way.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { draftIssue, formatPaymentMoney, labelForDue, paymentDay, receivedOrder, stillDue, type TeamPayment } from '../../lib/team-payments';
import { paymentLine, type FeeSchedule, type TeamRecord } from '../../lib/tournament-teams';

const WITH_DEPOSIT: FeeSchedule = { depositAmount: 100, depositDueDate: '2026-10-10', totalFeeAmount: 300, totalFeeDueDate: '2026-11-01' };
const ONE_PAYMENT: FeeSchedule = { depositAmount: null, depositDueDate: null, totalFeeAmount: 300, totalFeeDueDate: '2026-11-01' };
const NO_FEE: FeeSchedule = { depositAmount: null, depositDueDate: null, totalFeeAmount: null, totalFeeDueDate: null };

const pay = (over: Partial<TeamPayment>): TeamPayment => ({ id: 'p', amount: 10, paidOn: '2026-10-09', label: 'Payment', method: null, inLedger: false, ...over });

describe('what is still due', () => {
  it('the deposit first, then the balance, when nothing is paid', () => {
    assert.deepEqual(stillDue(WITH_DEPOSIT, 0).map(r => [r.label, r.amount, r.dueDate]), [
      ['Deposit', 100, '2026-10-10'], ['Balance', 200, '2026-11-01'],
    ]);
  });

  it('a part payment leaves the rest of the deposit AND the whole balance due (the label never decides)', () => {
    assert.deepEqual(stillDue(WITH_DEPOSIT, 50).map(r => [r.label, r.amount]), [['Deposit', 50], ['Balance', 200]]);
  });

  it('the deposit paid leaves the balance; more than the deposit shortens the balance', () => {
    assert.deepEqual(stillDue(WITH_DEPOSIT, 100).map(r => [r.label, r.amount]), [['Balance', 200]]);
    assert.deepEqual(stillDue(WITH_DEPOSIT, 250).map(r => [r.label, r.amount]), [['Balance', 50]]);
  });

  it('nothing is due once the fee is paid, or over-paid, or when there is no fee', () => {
    assert.deepEqual(stillDue(WITH_DEPOSIT, 300), []);
    assert.deepEqual(stillDue(WITH_DEPOSIT, 350), []);
    assert.deepEqual(stillDue(NO_FEE, 0), []);
  });

  it('an event with no deposit has one Entry fee row', () => {
    assert.deepEqual(stillDue(ONE_PAYMENT, 0).map(r => [r.label, r.amount, r.dueDate]), [['Entry fee', 300, '2026-11-01']]);
    assert.deepEqual(stillDue(ONE_PAYMENT, 120).map(r => [r.label, r.amount]), [['Entry fee', 180]]);
  });

  it('cents survive, and are not rounded to a dollar', () => {
    assert.deepEqual(stillDue(WITH_DEPOSIT, 109.5).map(r => [r.label, r.amount]), [['Balance', 190.5]]);
    assert.deepEqual(stillDue(ONE_PAYMENT, 109.5).map(r => r.amount), [190.5]);
    assert.equal(formatPaymentMoney(109.5), '$109.50');
    assert.equal(formatPaymentMoney(100), '$100');
  });

  it('a Record button gives its payment the row’s label; the "different amount" door gives Payment', () => {
    const [deposit, balance] = stillDue(WITH_DEPOSIT, 0);
    assert.equal(labelForDue(deposit), 'Deposit');
    assert.equal(labelForDue(balance), 'Balance');
    assert.equal(labelForDue(null), 'Payment');
  });
});

describe('the summary line', () => {
  const team = (totalPaid: number): TeamRecord => ({ totalPaid, depositPaid: Math.min(totalPaid, 100) } as TeamRecord);
  it('says what is owed and what has been received', () => {
    assert.deepEqual(paymentLine(team(0), WITH_DEPOSIT, '2026-10-01'), { lead: 'Owes $300', owes: true, rest: [] });
    assert.deepEqual(paymentLine(team(50), WITH_DEPOSIT, '2026-10-01'), { lead: 'Owes $250', owes: true, rest: ['paid $50 of $300'] });
  });
  it('paid in full, and over the fee', () => {
    assert.deepEqual(paymentLine(team(300), WITH_DEPOSIT, '2026-10-01'), { lead: 'Paid in full · $300', owes: false, rest: [] });
    assert.deepEqual(paymentLine(team(350), WITH_DEPOSIT, '2026-10-01'), { lead: 'Paid $350', owes: false, rest: ['$50 over the fee'], over: true });
  });
  it('past due is said after what was received', () => {
    assert.deepEqual(paymentLine(team(0), WITH_DEPOSIT, '2026-12-01'), { lead: 'Owes $300', owes: true, rest: ['past due'] });
  });
  it('nothing with no fee schedule (the record then offers Mark paid on its own)', () => {
    assert.equal(paymentLine(team(0), NO_FEE, '2026-10-01'), null);
  });
});

describe('what the form and the server both refuse', () => {
  it('an amount that is not above $0, or absurd', () => {
    assert.equal(draftIssue(0, '2026-10-09', '2026-10-21'), 'amount');
    assert.equal(draftIssue(-5, '2026-10-09', '2026-10-21'), 'amount');
    assert.equal(draftIssue(Number.NaN, '2026-10-09', '2026-10-21'), 'amount');
    assert.equal(draftIssue(1_000_001, '2026-10-09', '2026-10-21'), 'amount');
  });
  it('a day that is missing, malformed or in the future', () => {
    assert.equal(draftIssue(10, '', '2026-10-21'), 'date');
    assert.equal(draftIssue(10, '10/09/2026', '2026-10-21'), 'date');
    assert.equal(draftIssue(10, '2026-10-22', '2026-10-21'), 'future');
  });
  it('any day up to today, and cents', () => {
    assert.equal(draftIssue(10, '2026-10-21', '2026-10-21'), null);
    assert.equal(draftIssue(109.5, '2026-01-02', '2026-10-21'), null);
  });
});

describe('the list reads in the order the money arrived', () => {
  it('an undated "Earlier payment" first, then by day', () => {
    const rows = receivedOrder([
      pay({ id: 'c', paidOn: '2026-10-12' }), pay({ id: 'a', paidOn: null, label: 'Earlier payment' }), pay({ id: 'b', paidOn: '2026-10-09' }),
    ]);
    assert.deepEqual(rows.map(r => r.id), ['a', 'b', 'c']);
  });
  it('a day prints without a year, an undated one says Earlier', () => {
    assert.equal(paymentDay('2026-10-09', 'Earlier'), 'Oct 9');
    assert.equal(paymentDay(null, 'Earlier'), 'Earlier');
  });
});
