/**
 * Club Tier Stage 13d, Session C — the coach's request (build prompt docs/projects/active/CLUB_TIER_STAGE13D_BUILD_PROMPT.md,
 * "Session C guards"; drawing tab 6).
 *
 *   · the saved value is an Approve code, by direction (Card only for paying the club)
 *   · a request filed under the old question still renders, "(as filed)", and an edit that leaves it alone keeps its words
 *   · the coach's window never prints a raw code; the treasurer's label is by direction
 *   · "Paid" appears only once the club recorded paying it
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLUB_REQUEST_METHOD_WORDS as W, clubRequestMethods, requestMethodAsFiled, requestMethodLabel,
  requestPaidFacts, requestPaidOn, resolveRequestMethod,
} from '../../lib/coach-club-money.ts';
import { DUES_PAYMENT_METHODS } from '../../lib/types.ts';
import { methodWord } from '../../lib/club-money-words.ts';
import { readCode } from './_source-code.ts';

describe('the coach is asked what the treasurer needs (13d-9 A)', () => {
  it('asks by direction, in the drawing’s words', () => {
    assert.equal(W.ask.charge_to_org, 'How should the club pay you?');
    assert.equal(W.ask.payment_to_org, 'How are you paying the club?');
    assert.equal(W.hint('charge_to_org'), 'Cash, E-Transfer, Cheque or Other. Optional.');
  });
  it('offers only the codes Approve reads, and Card only for paying the club', () => {
    for (const side of ['charge_to_org', 'payment_to_org'] as const) {
      for (const m of clubRequestMethods(side)) assert.ok((DUES_PAYMENT_METHODS as readonly string[]).includes(m), m);
    }
    assert.deepEqual([...clubRequestMethods('charge_to_org')], ['cash', 'etransfer', 'cheque', 'other']);
    assert.ok(clubRequestMethods('payment_to_org').includes('card'));
  });
  it('saves a code; refuses a display word, a code this side doesn’t offer, and anything else', () => {
    assert.deepEqual(resolveRequestMethod('charge_to_org', 'etransfer'), { ok: true, value: 'etransfer' });
    assert.deepEqual(resolveRequestMethod('payment_to_org', 'card'), { ok: true, value: 'card' });
    assert.deepEqual(resolveRequestMethod('charge_to_org', ''), { ok: true, value: null }, 'optional');
    assert.deepEqual(resolveRequestMethod('charge_to_org', null), { ok: true, value: null });
    assert.equal(resolveRequestMethod('charge_to_org', 'card').ok, false, 'the club does not pay a team by card');
    assert.equal(resolveRequestMethod('charge_to_org', 'E-Transfer').ok, false, 'a new answer is a code');
    assert.equal(resolveRequestMethod('payment_to_org', 42).ok, false);
  });
  it('keeps an old request’s words through an edit that never touched them, and never rewrites them', () => {
    assert.deepEqual(resolveRequestMethod('charge_to_org', 'Card', 'Card'), { ok: true, value: 'Card' });
    assert.equal(resolveRequestMethod('charge_to_org', 'Card', 'E-Transfer').ok, false, 'only its own words come back');
    // A stored CODE gets no such pass: Card turned round to "the club pays us" is refused.
    assert.equal(resolveRequestMethod('charge_to_org', 'card', 'card').ok, false);
  });
  it('both write doors run the one rule; the edit door reads what is stored', () => {
    const post = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/payment-requests/route.ts');
    const patch = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/payment-requests/[id]/route.ts');
    assert.match(post, /resolveRequestMethod\(requestType, paymentMethod\)/);
    assert.match(post, /payment_method:\s+method\.value/);
    assert.match(patch, /resolveRequestMethod\(requestType, paymentMethod, existing\.payment_method/);
    assert.match(patch, /payment_method:\s+method\.value/);
    assert.doesNotMatch(post + patch, /paymentMethod\?\.trim\(\)/, 'no free-text write left');
  });
});

describe('reading it back (13d-9 A, drawing notes 1 and 4)', () => {
  it('an old-words request reads "(as filed)" for both readers; a code reads by direction', () => {
    assert.equal(requestMethodAsFiled('E-Transfer'), true);
    assert.equal(requestMethodAsFiled('etransfer'), false);
    assert.equal(requestMethodAsFiled(null), false);
    assert.equal(requestMethodLabel({ requestType: 'charge_to_org', paymentMethod: 'Card' }, 'club'), 'Payment method (as filed)');
    assert.equal(requestMethodLabel({ requestType: 'charge_to_org', paymentMethod: 'Card' }, 'coach'), 'Payment method (as filed)');
    assert.equal(requestMethodLabel({ requestType: 'charge_to_org', paymentMethod: 'etransfer' }, 'club'), 'How they’d like to be paid');
    assert.equal(requestMethodLabel({ requestType: 'payment_to_org', paymentMethod: 'cheque' }, 'club'), 'How it’s coming');
    assert.equal(requestMethodLabel({ requestType: 'charge_to_org', paymentMethod: 'etransfer' }, 'coach'), 'How you’d like the club to pay you');
  });
  it('the words are the code’s word, or the old word itself', () => {
    assert.equal(methodWord('etransfer'), 'E-Transfer');
    assert.equal(methodWord('Card'), 'Card');
  });
  it('the coach’s window never prints the stored value raw, and the old list is gone', () => {
    const panel = readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/club/panel.tsx');
    assert.doesNotMatch(panel, /\{formMethod \|\| '—'\}/, 'the raw stored value');
    assert.match(panel, /methodWord\(formMethod\) \?\? '—'/);
    assert.doesNotMatch(panel, /const PAYMENT_METHODS =/);
    assert.match(panel, /RMW\.ask\[formType\]/);
  });
  it('the treasurer’s window labels by direction from the one rule; Approve still pre-fills from the code', () => {
    const win = readCode('components/admin/kit/club/money/RequestWindows.tsx');
    assert.match(win, /requestMethodLabel\(r, 'club'\)/);
    assert.doesNotMatch(win, /How they’d like it/);
    assert.match(win, /useState<DuesPaymentMethod \| ''>\(methodOf\(r\.paymentMethod\)\)/);
  });
  it('the export and the club’s statement print words, not codes', () => {
    assert.match(readCode('lib/coach-money-exports.ts'), /method: methodWord\(r\.paymentMethod\)/);
    assert.match(readCode('lib/club-money-reads.ts'), /methodWord\(r\.paid_method\) \?\? methodWord\(r\.payment_method\)/);
  });
});

describe('Paid: how, when, the reference (13d-10 A)', () => {
  const base = { amount: 120, paidOn: '2026-10-19', paidMethod: 'etransfer', paidReference: '6602' } as const;
  it('money back reads "Paid · $120.00 by E-Transfer on {date}", the reference under it', () => {
    const p = requestPaidFacts({ ...base, requestType: 'charge_to_org', status: 'approved' })!;
    assert.equal(p.label, 'Paid');
    assert.match(p.value, /^\$120\.00 by E-Transfer on Oct 19/);
    assert.equal(p.sub, 'Reference 6602');
  });
  it('money to the club reads "The club received it on {date} · {method} · reference {ref}"', () => {
    const p = requestPaidFacts({ ...base, requestType: 'payment_to_org', status: 'approved', paidReference: '7710' })!;
    assert.equal(p.label, 'Received');
    assert.match(p.value, /^The club received it on Oct 19.* · E-Transfer · reference 7710$/);
  });
  it('only once the record exists: not pending, declined, reversed, or an approval with no day', () => {
    for (const status of ['pending', 'denied', 'reversed', 'accepted', 'credited'] as const) {
      assert.equal(requestPaidFacts({ ...base, requestType: 'charge_to_org', status }), null, status);
    }
    assert.equal(requestPaidFacts({ ...base, requestType: 'charge_to_org', status: 'approved', paidOn: null }), null);
    assert.equal(requestPaidOn({ status: 'approved', paidOn: null }), null, 'an approval before the club recorded days stays "Approved"');
    assert.equal(requestPaidOn({ status: 'approved', paidOn: '2026-10-19' }), '2026-10-19');
  });
  it('the list row says "Paid {day}" from that rule, and the window adds no read for it', () => {
    const panel = readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/club/panel.tsx');
    assert.match(panel, /const paidOn = requestPaidOn\(r\)/);
    assert.match(panel, /paid=\{!!paidOn\}/);
    assert.match(panel, /requestPaidFacts\(editing\)/);
  });
});
