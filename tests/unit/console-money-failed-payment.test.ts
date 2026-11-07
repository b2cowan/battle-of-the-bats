import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type Stripe from 'stripe';
import { consoleDay } from '../../lib/console-dates.ts';
import {
  chargeFailureWords, failedBillOf, failedBills, failedStoryWords, nextTry, nextTryShort, stripeSaysWords, triesWords,
  type MoneyCharge, type MoneyInvoice, type MoneyRead,
} from '../../lib/console-money.ts';
import { SALES_WORDS, joinSales, saleStripeSays } from '../../lib/console-money-sales.ts';
import { readClubMoney, toMoneyCharge, toMoneyInvoice } from '../../lib/console-money-stripe.ts';
import { functionBody, readCode } from './_source-code.ts';

/**
 * Plans & pricing Stage 2 Part 2 (owner go 2026-11-06): the failed-payment story on one customer's Money tab, read from the
 * bills and charges the tab already reads. Read only. Stripe reports the tries made and the next one; the schedule's total is
 * never printed. "Stripe could not be read" is never "nothing failed".
 */

const READ_AT = '2026-11-05T15:00:00.000Z';
const FAILED_AT = '2026-11-03T15:00:00.000Z';
const NEXT_AT = '2026-11-06T15:00:00.000Z';

const inv = (over: Partial<MoneyInvoice> = {}): MoneyInvoice => ({
  id: 'in_1', number: 'A-1', billingReason: 'subscription_cycle', subscriptionId: 'sub_1', periodStart: FAILED_AT, periodEnd: '2027-11-03T15:00:00.000Z',
  planId: 'club', cycle: 'annual', fromPlanId: null, description: null, taxCents: 7800, status: 'open', issuedAt: FAILED_AT,
  currency: 'cad', totalCents: 67800, amountDueCents: 67800, amountRemainingCents: 67800, dueDate: null, markedUncollectibleAt: null,
  attemptCount: 1, nextAttemptAt: NEXT_AT, ...over,
});
const charge = (over: Partial<MoneyCharge> = {}, invoice: MoneyInvoice | null = inv()): MoneyCharge => ({
  id: 'ch_f1', createdAt: FAILED_AT, amountCents: 67800, currency: 'cad', status: 'failed', refundedCents: 0, disputed: false,
  failureCode: 'card_declined', declineCode: 'insufficient_funds', adviceCode: 'try_again_later', card: { brand: 'visa', last4: '4242' },
  refunds: [], invoice, ...over,
});
const read = (invoices: MoneyInvoice[], charges: MoneyCharge[]): Pick<MoneyRead, 'invoices' | 'charges' | 'readAt'> => ({ invoices, charges, readAt: READ_AT });

describe('the failed bill: which bills are a failed payment', () => {
  it('nothing failed: a paid bill, a void bill and a written-off bill give no story', () => {
    assert.deepEqual(failedBills(read([inv({ status: 'paid', amountRemainingCents: 0 })], [])), []);
    assert.deepEqual(failedBills(read([inv({ status: 'void' })], [charge()])), []);
    assert.deepEqual(failedBills(read([inv({ status: 'uncollectible' })], [charge()])), []);
  });

  it('a sent bill not yet tried is owed, not failed', () => {
    assert.deepEqual(failedBills(read([inv({ attemptCount: 0, nextAttemptAt: null, dueDate: NEXT_AT })], [])), []);
  });

  it('a payment on its way is not a failure', () => {
    assert.deepEqual(failedBills(read([inv()], [charge(), charge({ id: 'ch_p', status: 'pending', createdAt: READ_AT })])), []);
  });

  it('a customer who paid on the retry has no story; the row says it paid after the failed try', () => {
    const paidInv = inv({ status: 'paid', amountRemainingCents: 0, attemptCount: 2, nextAttemptAt: null });
    const failed = charge({}, paidInv);
    const paid = charge({ id: 'ch_ok', status: 'succeeded', createdAt: NEXT_AT, failureCode: null, declineCode: null }, paidInv);
    assert.deepEqual(failedBills(read([paidInv], [failed, paid])), []);
    const [row] = joinSales({ records: [], notes: [], charges: [failed, paid], invoices: [paidInv], shownFrom: null });
    const says = saleStripeSays(row, READ_AT);
    assert.equal(says.text, 'Paid');
    assert.equal(says.sub, `after 1 failed try, ${consoleDay(FAILED_AT)}`);
  });

  it('an open bill after a failed try is one: the amount owed, the tax inside it, the reason, Stripe’s count and the next try', () => {
    const [bill] = failedBills(read([inv()], [charge()]));
    assert.deepEqual(bill, {
      invoiceId: 'in_1', amountCents: 67800, currency: 'cad', taxCents: 7800, failedAt: FAILED_AT, reason: 'not enough funds',
      tries: 1, next: { kind: 'at', at: NEXT_AT }, issuedAt: FAILED_AT,
    });
  });

  it('a part-paid bill names what is owed and leaves the tax out (the bill’s tax is not the remainder’s)', () => {
    const bill = failedBillOf(inv({ amountRemainingCents: 30000 }), [charge()], READ_AT)!;
    assert.equal(bill.amountCents, 30000);
    assert.equal(bill.taxCents, null);
  });

  it('several unpaid bills: newest first', () => {
    const older = inv({ id: 'in_0', issuedAt: '2026-10-03T15:00:00.000Z' });
    const bills = failedBills(read([older, inv()], [charge(), charge({ id: 'ch_f0', invoice: older })]));
    assert.deepEqual(bills.map(b => b.invoiceId), ['in_1', 'in_0']);
  });
});

describe('the next try: never an old date shown as coming, never a try Stripe will not run', () => {
  it('a date after the read is the next try', () => {
    assert.deepEqual(nextTry({ nextAttemptAt: NEXT_AT }, charge(), READ_AT), { kind: 'at', at: NEXT_AT });
  });
  it('a date already behind the read was due', () => {
    assert.deepEqual(nextTry({ nextAttemptAt: '2026-11-04T15:00:00.000Z' }, charge(), READ_AT), { kind: 'was_due', at: '2026-11-04T15:00:00.000Z' });
  });
  it('no date: no further try scheduled', () => {
    assert.deepEqual(nextTry({ nextAttemptAt: null }, charge(), READ_AT), { kind: 'none' });
  });
  it('the bank said not to try again: Stripe’s date runs only on a new card', () => {
    assert.deepEqual(nextTry({ nextAttemptAt: NEXT_AT }, charge({ adviceCode: 'do_not_try_again' }), READ_AT), { kind: 'new_card', at: NEXT_AT });
  });
  it('...but a date already behind the read is not said as coming (/review)', () => {
    assert.deepEqual(nextTry({ nextAttemptAt: '2026-11-04T15:00:00.000Z' }, charge({ adviceCode: 'do_not_try_again' }), READ_AT), { kind: 'new_card', at: null });
  });
});

describe('the words', () => {
  const day = consoleDay(NEXT_AT);
  it('the notice: the drawing’s sentence, with Stripe’s count and no total', () => {
    const w = failedStoryWords(failedBills(read([inv()], [charge()]))[0], { pastDue: true, more: 0 });
    assert.equal(w.lead, `The ${consoleDay(FAILED_AT)} payment of $678.00 failed`);
    assert.equal(w.text, `: not enough funds. It includes $78.00 tax. Stripe has tried once and tries again on ${day}. The club is past due and keeps using everything meanwhile.`);
  });

  it('the attempt count unreadable: no count at all, never one of our own', () => {
    const bill = failedBillOf(inv({ attemptCount: null }), [charge(), charge({ id: 'ch_f2' })], READ_AT)!;
    assert.equal(bill.tries, null);
    assert.equal(triesWords(bill), `Stripe tries again on ${day}.`);
  });

  it('never prints a schedule total ("of 4"), whatever the count', () => {
    for (const tries of [1, 2, 3, 7, null]) {
      for (const next of [{ kind: 'at', at: NEXT_AT }, { kind: 'was_due', at: NEXT_AT }, { kind: 'none' }, { kind: 'new_card', at: NEXT_AT }, { kind: 'new_card', at: null }] as const) {
        const text = triesWords({ tries, next }) + nextTryShort(next);
        assert.doesNotMatch(text, /\bof \d|attempt \d/i, text);
      }
    }
  });

  it('each next try in words', () => {
    assert.equal(triesWords({ tries: 2, next: { kind: 'at', at: NEXT_AT } }), `Stripe has tried twice and tries again on ${day}.`);
    assert.equal(triesWords({ tries: 3, next: { kind: 'was_due', at: NEXT_AT } }), `Stripe has tried 3 times. It was due to try again on ${day}. Read again for the result.`);
    assert.equal(triesWords({ tries: 4, next: { kind: 'none' } }), 'Stripe has tried 4 times. It has no further try scheduled.');
    assert.equal(triesWords({ tries: null, next: { kind: 'none' } }), 'Stripe has no further try scheduled.');
    assert.equal(triesWords({ tries: 1, next: { kind: 'new_card', at: NEXT_AT } }),
      `Stripe has tried once. The bank said not to try this card again, so Stripe’s ${day} try runs only on a new card.`);
    assert.equal(triesWords({ tries: 1, next: { kind: 'new_card', at: null } }),
      'Stripe has tried once. The bank said not to try this card again, so Stripe tries again only on a new card.');
    assert.equal(nextTryShort({ kind: 'at', at: NEXT_AT }), `Stripe tries again ${day}`);
    assert.equal(nextTryShort({ kind: 'none' }), 'No further try scheduled');
    assert.equal(nextTryShort({ kind: 'new_card', at: null }), 'Tries again only on a new card');
  });

  it('not past due in our record: the access line is left out; more bills are counted', () => {
    const w = failedStoryWords(failedBills(read([inv()], [charge()]))[0], { pastDue: false, more: 2 });
    assert.doesNotMatch(w.text, /keeps using/);
    assert.match(w.text, /2 more bills are unpaid too\.$/);
  });

  it('tried with no failed charge read (a card that needed its holder): no date, no reason invented', () => {
    const w = failedStoryWords(failedBillOf(inv({ attemptCount: 1 }), [], READ_AT)!, { pastDue: false, more: 0 });
    assert.equal(w.lead, 'A payment of $678.00 did not go through');
    assert.match(w.text, /^\. It includes/);
  });

  it('the reason: the bank’s code first, in fixed words; Stripe’s own code otherwise', () => {
    assert.equal(chargeFailureWords(charge()), 'not enough funds');
    assert.equal(chargeFailureWords(charge({ declineCode: 'fraudulent' })), 'declined by the bank');
    assert.equal(chargeFailureWords(charge({ declineCode: 'some_new_code' })), 'card declined');
    assert.equal(chargeFailureWords(charge({ declineCode: null, failureCode: 'expired_card' })), 'card expired');
    assert.equal(stripeSaysWords(charge()).text, 'Failed · not enough funds');
  });

  it('the sale row: an unpaid bill’s second line says the next try, only when the read time is given', () => {
    const [row] = joinSales({ records: [], notes: [], charges: [charge()], invoices: [inv()], shownFrom: null });
    const says = saleStripeSays(row, READ_AT);
    assert.equal(says.text, `Owes $678.00 · not enough funds ${consoleDay(FAILED_AT)}`);
    assert.equal(says.tone, 'bad');
    assert.equal(says.sub, `Stripe tries again ${day}`);
    assert.equal(saleStripeSays(row).sub, null);
  });

  it('Stripe not answering: the lines name the failed payment as waiting, never "no failed payments"', () => {
    assert.match(SALES_WORDS.unreachable('9:00 a.m.'), /any failed payment and when Stripe tries again/);
    assert.match(SALES_WORDS.bothFailed('9:00 a.m.'), /any failed payment/);
    for (const w of [SALES_WORDS.unreachable('x'), SALES_WORDS.bothFailed('x')]) assert.doesNotMatch(w, /no failed/i);
  });
});

describe('the read: Stripe’s own objects, no second call', () => {
  const unix = (iso: string) => Math.floor(Date.parse(iso) / 1000);
  const stripeInvoice = {
    id: 'in_1', number: 'A-1', billing_reason: 'subscription_cycle', status: 'open', currency: 'cad', total: 67800, amount_due: 67800,
    amount_remaining: 67800, due_date: null, created: unix(FAILED_AT), status_transitions: { finalized_at: unix(FAILED_AT) },
    total_taxes: [{ amount: 7800 }], lines: { data: [] }, metadata: {}, parent: null, attempt_count: 2, next_payment_attempt: unix(NEXT_AT), payments: { data: [] },
  };
  const stripeCharge = {
    id: 'ch_f1', created: unix(FAILED_AT), amount: 67800, currency: 'cad', status: 'failed', amount_refunded: 0, disputed: false,
    failure_code: 'card_declined', outcome: { type: 'issuer_declined', reason: 'insufficient_funds', advice_code: 'do_not_try_again' },
    payment_method_details: { type: 'card', card: { brand: 'visa', last4: '4242' } }, refunds: { data: [] }, payment_intent: null,
  };

  it('the bill carries Stripe’s count and next try; the charge the bank’s code and advice', () => {
    const m = toMoneyInvoice(stripeInvoice as unknown as Stripe.Invoice, new Map());
    assert.equal(m.attemptCount, 2);
    assert.equal(m.nextAttemptAt, NEXT_AT);
    assert.equal(toMoneyInvoice({ ...stripeInvoice, next_payment_attempt: null } as unknown as Stripe.Invoice, new Map()).nextAttemptAt, null);
    const c = toMoneyCharge(stripeCharge as unknown as Stripe.Charge, null);
    assert.equal(c.declineCode, 'insufficient_funds');
    assert.equal(c.adviceCode, 'do_not_try_again');
  });

  it('a Radar block’s reason is not taken for a bank decline code', () => {
    const c = toMoneyCharge({ ...stripeCharge, failure_code: null, outcome: { type: 'blocked', reason: 'highest_risk_level', advice_code: null } } as unknown as Stripe.Charge, null);
    assert.equal(c.declineCode, null);
  });

  it('the tab’s read makes the same Stripe calls as before (no second round-trip for the story)', async () => {
    const calls: string[] = [];
    const list = <T>(name: string, data: T[]) => { calls.push(name); return Promise.resolve({ object: 'list', data, has_more: false, url: '' }); };
    const stripe = {
      customers: { retrieve: () => { calls.push('customers.retrieve'); return Promise.resolve({ id: 'cus_1', email: null, invoice_settings: { default_payment_method: null } }); } },
      subscriptions: { list: () => list('subscriptions.list', []) },
      charges: { list: () => list('charges.list', [stripeCharge]) },
      invoices: { list: () => list('invoices.list', [stripeInvoice]), createPreview: () => { calls.push('invoices.createPreview'); return Promise.resolve({}); } },
      invoicePayments: { list: () => list('invoicePayments.list', []) },
    } as unknown as Stripe;
    const r = await readClubMoney(stripe, 'cus_1', { prices: new Map(), testMode: true, now: new Date(READ_AT) });
    assert.deepEqual([...new Set(calls)].sort(), ['charges.list', 'customers.retrieve', 'invoices.list', 'subscriptions.list']);
    assert.equal(r.invoices?.[0].attemptCount, 2);
  });
});

describe('the screen: read only, and nothing from Stripe for a role without the Stripe power', () => {
  const tab = functionBody(readCode('app/platform-admin/orgs/[id]/MoneyTab.tsx'), 'MoneyTab');
  it('a role that does not read Stripe returns before the story is built', () => {
    const gate = tab.indexOf('if (!readsStripe)');
    assert.ok(gate > 0 && gate < tab.indexOf('failedBills('), 'the readsStripe gate must come before the failed-payment story');
  });
  it('the notice is built only from a read of Stripe, and its doors only open the bill or filter the list', () => {
    assert.match(tab, /const failing = read \? failedBills\(read\) : \[\];/);
    const notice = tab.slice(tab.indexOf('const failedNotice'), tab.indexOf('const gate ='));
    assert.doesNotMatch(notice, /sendJson|fetch\(|POST/);
  });
});
