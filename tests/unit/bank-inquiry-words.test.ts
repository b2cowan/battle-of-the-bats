/**
 * A BANK ONLY ASKING NEVER READS AS A DISPUTE (Board Ready Stage 6 fixes, B-3 and B-4; owner 2026-11-25). An inquiry
 * (`warning_*`) takes no money and leaves refunds open, so nothing a club reads may call it a dispute, say money is held,
 * or say not to refund. When it becomes a dispute under the same id, the "only asking" notice makes way for the dispute's.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { disputeChip, isPastDue } from '../../lib/online-payment-dispute.ts';
import { DISPUTE_EMAIL_WORDS as EMAIL, DISPUTE_WORDS as D, LEAVING_WORDS as L, SPONSOR_DISPUTE_WORDS as S, disputeFactsText } from '../../lib/online-payment-words.ts';

const NOW = new Date('2026-11-25T12:00:00Z');
const row = (status: string, over: { answered?: boolean; dueBy?: string | null } = {}) => ({ status, answered: false, dueBy: '2026-12-01T12:00:00Z', ...over });

describe('the chip', () => {
  it('an inquiry keeps "Bank asking" when answered or past due', () => {
    const says = (r: ReturnType<typeof row>) => D.chip[disputeChip(r, NOW)!];
    assert.equal(says(row('warning_needs_response')), 'Bank asking');
    assert.equal(says(row('warning_under_review', { answered: true })), 'Bank asking · answered');
    assert.equal(says(row('warning_needs_response', { dueBy: '2026-11-01T12:00:00Z' })), 'Bank asking · not answered');
    assert.equal(says(row('under_review', { answered: true })), 'Disputed · with the bank');
    assert.equal(disputeChip(row('warning_closed'), NOW), null);
  });
  it('past due is the same question for both', () => {
    assert.ok(isPastDue(row('warning_needs_response', { dueBy: '2026-11-01T12:00:00Z' }), NOW));
    assert.ok(!isPastDue(row('warning_needs_response', { dueBy: '2026-11-01T12:00:00Z', answered: true }), NOW));
    assert.ok(!isPastDue(row('warning_closed', { dueBy: '2026-11-01T12:00:00Z' }), NOW));
  });
});

describe('the sponsor’s notice', () => {
  it('asks, takes nothing, and says a refund is open', () => {
    assert.equal(S.inquiryTitle('Northside Auto'), 'Northside Auto’s bank is asking about a card payment');
    assert.equal(S.inquiryBody('$500.00', 'Dec 1'),
      'The sponsor’s bank is asking about $500.00. No money has been taken. Answer it in Stripe by Dec 1. If the money should go back, you can refund the payment.');
    assert.doesNotMatch(S.inquiryBody('$500.00', null), /disput|Don’t refund/i);
  });
});

describe('the titles, the copied facts and the emails', () => {
  it('the title never says disputed', () => {
    assert.equal(D.itemTitleInquiry('Henry’s'), 'The bank is asking about Henry’s card payment');
    assert.doesNotMatch(D.itemTitleManyInquiry('Henry and Ada'), /disput/i);
  });
  it('the record’s line about brothers and sisters says a question', () => {
    assert.equal(D.siblingsInquiry('Henry and Ada'), 'This is one payment for Henry and Ada. The bank’s question is about the whole payment.');
    assert.ok(readCode('components/admin/kit/club/DisputeBlock.tsx').includes('(inquiry ? D.siblingsInquiry : D.siblings)(childList(d.children))'));
  });
  it('"Copy the facts" names a question', () => {
    const base = {
      test: false, receiptNo: '7', amount: '$10.00', paidDay: 'Oct 2, 2026', cardLast4: null, payerName: null, payerEmail: null,
      forLine: 'Henry Kim', registeredDay: null, registeredBy: null, refundPolicy: null, receiptEmailedDay: null, club: 'Northfield', contactEmail: null,
    };
    assert.match(disputeFactsText({ ...base, inquiry: true }), /^Payment the bank is asking about: receipt 7,/);
    assert.match(disputeFactsText(base), /^Disputed payment: receipt 7,/);
  });
  it('the opening email drops "If the club wins"; the reminder asks, and names a dispute only as what answering can stop', () => {
    const R = EMAIL.reminder;
    assert.equal(R.subjectInquiry('Dec 1', 'Northfield'), 'Answer by Dec 1: a bank is asking about a card payment to Northfield');
    assert.doesNotMatch(R.subjectInquiry('Dec 1', 'Northfield') + R.leadInquiry('7', 'Henry', 'Dec 1, 2026 at 7:00 a.m.'), /disput/i);
    assert.equal(R.afterInquiry, 'Nothing has been taken. Answering can stop it becoming a dispute.');
    const src = readCode('lib/online-dispute-email.ts');
    for (const pick of ["inquiry ? '' : warmEmailSmall(escapeHtml(M.noChange)),", '(inquiry ? R.subjectInquiry : R.subject)',
      '(inquiry ? R.leadInquiry : R.lead)', 'inquiry ? R.afterInquiry : R.after']) {
      assert.ok(src.includes(pick), pick);
    }
    assert.ok(readCode('lib/online-payment-landing.ts').includes('dueBy: d.due_by, status: d.status, test: !op.livemode,'));
  });
});

describe('leaving online payments counts a question as a question', () => {
  it('Disconnect, cancel and delete', () => {
    assert.equal(L.disconnect.inquiries(1, 'Dec 1'), 'A bank is asking about a card payment. Answer it in Stripe by Dec 1. No money has been taken.');
    assert.equal(L.delete.waiting(0, 0, 1), '1 bank question about a card payment is open. We wait for them before deleting.');
    assert.equal(L.delete.waiting(1, 2, 2),
      '1 card dispute is open, 2 bank questions about card payments are open and 2 bank debits are still clearing. We wait for them before deleting.');
    assert.match(L.cancel.stripe(0, 1), /Refunds and the 1 open bank question are handled in Stripe/);
    assert.match(L.cancel.stripe(2, 1), /Refunds, the 2 open disputes and the 1 open bank question are handled in Stripe/);
    assert.match(L.cancel.stripe(1), /Refunds and the 1 open dispute are handled in Stripe/);
  });
  it('the count splits them, and the operator’s Delete still waits for a question', () => {
    const src = readCode('lib/online-payment-endings.ts');
    assert.match(src, /openDisputes: real\.length,/);
    assert.match(src, /openInquiries: inquiries\.length,/);
    assert.match(src, /if \(o\.openInquiries\) out\.push\(\{ kind: 'inquiries', n: o\.openInquiries \}\);/);
  });
});

describe('an inquiry that becomes a dispute', () => {
  const landing = readCode('lib/online-payment-landing.ts');
  it('its "only asking" notice is settled before the dispute’s own is raised', () => {
    const settle = landing.indexOf("if (isDisputeOpen(d.status) && !isInquiry(d.status)) await clearSettled({ orgIds: [op.org_id], kinds: ['card_disputed'] });");
    assert.ok(settle > 0);
    assert.ok(settle < landing.indexOf("if (op.flow === 'sponsorship') { await afterSponsorDispute(org, op, d); return; }"));
    assert.ok(settle < landing.indexOf('await raiseDisputed(org, op, d);'));
  });
  it('both flows mark an inquiry’s notice, and the resolver reads the mark', () => {
    assert.match(landing, /\.\.\.\(inquiry \? \{ inquiry: 'yes' \} : \{\}\),/);
    assert.match(landing, /extra: inquiry \? \{ \.\.\.extra, inquiry: 'yes' \} : extra,/);
    const resolver = readCode('lib/needs-attention.ts');
    assert.match(resolver, /d\.status === 'warning_closed' \? W\.inquiryClosed : W\.disputeWon/);
    assert.match(resolver, /meta\(r, 'inquiry'\) === 'yes' && !isInquiry\(d\.status\)\) out\.set\(r\.id, said\(W\.inquiryDisputed/);
  });
});
