import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type Stripe from 'stripe';
import { readCode } from './_source-code.ts';
import { currentDispute, disputeChip, disputeFromStripe, disputeOutcome, isDisputeOpen, refundBlockedByDispute } from '../../lib/online-payment-dispute.ts';
import { DISPUTE_EMAIL_WORDS as M, DISPUTE_WORDS as D, disputeWhyFull, disputeWhyShort, endSentence } from '../../lib/online-payment-words.ts';

/**
 * Club Tier Stage 12d-1 Part 3 — a card dispute is seen and answered (words CLUB_TIER_STAGE12D_COPY.md §1; plan §0 "Stripe
 * facts" and owner rulings 5–6). The database's half (a dispute's whole life: created → won, created → lost, replayed,
 * out of order, a loss then a win) is scripts/online-payments-12d1-check.sql T5–T12; this holds the server's half: what
 * is read from Stripe, which event goes where, who hears, and that nothing refunds while a dispute is open.
 */
const LANDING = readCode('lib/online-payment-landing.ts');
const HOOK = readCode('app/api/payments/connect-webhook/route.ts');
const TEAM_REFUND_ROUTE = readCode('app/api/admin/tournaments/[tournamentId]/registrations/online-payments/route.ts');
const body = (code: string, name: string) => {
  const start = code.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`function ${name} is gone — the guard reads it`);
  return code.slice(start, code.indexOf('\n}\n', start));
};

const bt = (amount: number, fee: number) => ({ amount, fee }) as unknown as Stripe.BalanceTransaction;
const dispute = (over: Partial<Stripe.Dispute> & { submissions?: number; due?: number | null } = {}): Stripe.Dispute => ({
  id: 'du_1', object: 'dispute', amount: 15000, currency: 'cad', charge: 'ch_1', payment_intent: 'pi_1', created: 1_793_000_000,
  livemode: false, reason: 'fraudulent', status: 'needs_response', balance_transactions: [bt(-15000, 1500)],
  evidence_details: { due_by: over.due === undefined ? 1_794_000_000 : over.due, submission_count: over.submissions ?? 0, has_evidence: false, past_due: false },
  ...over,
} as unknown as Stripe.Dispute);

describe('Stripe’s read of a dispute is what is stored (never our arithmetic)', () => {
  it('a dispute that took money: held is what was withdrawn, the fee is the one Stripe charged the club’s balance', () => {
    const r = disputeFromStripe(dispute())!;
    assert.equal(r.status, 'needs_response');
    assert.equal(r.amount, 150);
    assert.equal(r.held, 150);
    assert.equal(r.stripeFee, 15);
    assert.equal(r.feePaidFrom, 'club'); // ruling 5: recorded on the dispute, never invoiced
    assert.equal(r.answered, false);
    assert.equal(r.dueBy, new Date(1_794_000_000 * 1000).toISOString());
  });

  it('an inquiry takes nothing and has no fee; a bank that allows no answer has no due date', () => {
    const r = disputeFromStripe(dispute({ status: 'warning_needs_response', balance_transactions: [], due: 0 }))!;
    assert.equal(r.held, 0);
    assert.equal(r.stripeFee, null);
    assert.equal(r.feePaidFrom, null);
    assert.equal(r.dueBy, null);
  });

  it('a win puts the money back (withdrawn less reinstated), and the dispute fee stays what Stripe took', () => {
    const r = disputeFromStripe(dispute({ status: 'won', balance_transactions: [bt(-15000, 1500), bt(15000, 0)], submissions: 1 }))!;
    assert.equal(r.held, 0);
    assert.equal(r.stripeFee, 15);
    assert.equal(r.answered, true);
  });

  it('answered = evidence sent, or Stripe already reviewing it', () => {
    assert.equal(disputeFromStripe(dispute({ submissions: 1 }))!.answered, true);
    assert.equal(disputeFromStripe(dispute({ status: 'under_review' }))!.answered, true);
    assert.equal(disputeFromStripe(dispute({ status: 'warning_under_review' }))!.answered, true);
  });

  it('a status this code does not know is acknowledged, never refused forever by the database', () => {
    assert.equal(disputeFromStripe(dispute({ status: 'something_new' as Stripe.Dispute.Status })), null);
    assert.match(body(LANDING, 'applyCardDispute'), /if \(!read\) \{[\s\S]*?console\.error[\s\S]*?return;/);
  });
});

describe('how a dispute reads (words §1.1–§1.2)', () => {
  it('open, won (a closed inquiry and a prevented dispute too) or lost', () => {
    for (const s of ['warning_needs_response', 'warning_under_review', 'needs_response', 'under_review']) assert.equal(disputeOutcome(s), 'open');
    for (const s of ['won', 'warning_closed', 'prevented']) assert.equal(disputeOutcome(s), 'won');
    assert.equal(disputeOutcome('lost'), 'lost');
  });

  it('the chip: bank asking, disputed, with the bank once answered, not answered past due', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    assert.equal(disputeChip({ status: 'warning_needs_response', answered: false, dueBy: '2026-11-11T23:59:00Z' }, now), 'inquiry');
    assert.equal(disputeChip({ status: 'needs_response', answered: false, dueBy: '2026-11-11T23:59:00Z' }, now), 'disputed');
    assert.equal(disputeChip({ status: 'under_review', answered: true, dueBy: '2026-11-01T23:59:00Z' }, now), 'withBank');
    assert.equal(disputeChip({ status: 'needs_response', answered: false, dueBy: '2026-11-01T23:59:00Z' }, now), 'notAnswered');
    assert.equal(disputeChip({ status: 'won', answered: true, dueBy: null }, now), null);
    assert.equal(D.chip.inquiry, 'Bank asking');
    assert.equal(D.chip.withBank, 'Disputed · with the bank');
  });

  it('the open dispute is the one a row speaks of; else the latest', () => {
    const a = { status: 'won', openedAt: '2026-11-01T00:00:00Z' };
    const b = { status: 'needs_response', openedAt: '2026-10-01T00:00:00Z' };
    assert.equal(currentDispute([a, b]), b);
    assert.equal(currentDispute([a, { status: 'lost', openedAt: '2026-11-02T00:00:00Z' }])?.status, 'lost');
    assert.equal(currentDispute([]), null);
  });

  it('"fraud" is never printed (§7 ruling 4): the cardholder "says they didn’t make this payment"; anything unmapped prints nothing', () => {
    assert.equal(disputeWhyFull('fraudulent'), ': the cardholder says they didn’t make this payment');
    assert.equal(disputeWhyShort('unrecognized'), 'didn’t make it');
    assert.equal(disputeWhyFull('general'), '');
    assert.equal(disputeWhyFull(null), '');
    const every = JSON.stringify([D, M, ['fraudulent', 'unrecognized', 'duplicate', 'credit_not_processed', 'product_not_received', 'product_unacceptable'].map(disputeWhyFull)]);
    assert.doesNotMatch(every.replace(/fraudulent/g, ''), /fraud/i);
  });

  it('no "Answer in Stripe by ." when the bank allows no answer (no due date)', () => {
    assert.equal(D.itemBody('Grace Kim’s', '1041', '$150.00', '', '$150.00', ''),
      'Grace Kim’s bank is disputing receipt 1041 ($150.00). Stripe has taken $150.00 from the club’s Stripe balance until the bank decides.');
    assert.equal(D.itemBodyOthers('Grace Kim’s', '1041', '$150.00', 'Sam Lee', ''),
      'Grace Kim’s bank is disputing receipt 1041 ($150.00). If the club wins, nothing changes here.');
    assert.equal(M.button(null), 'Open the registrations');
  });

  it('a sentence that ends on a clock absorbs its own full stop (Part 2’s lesson)', () => {
    assert.equal(endSentence('Nov 11 at 7:59 p.m.'), 'Nov 11 at 7:59 p.m.');
    assert.equal(D.itemBody('Grace Kim’s', '1041', '$150.00', '', '$150.00', 'Nov 11 at 7:59 p.m.'),
      'Grace Kim’s bank is disputing receipt 1041 ($150.00). Stripe has taken $150.00 from the club’s Stripe balance until the bank decides. Answer in Stripe by Nov 11 at 7:59 p.m.');
    assert.equal(D.itemBodyOthers('Grace Kim’s', '1041', '$150.00', 'Sam Lee', 'Nov 11 at 7:59 p.m.'),
      'Grace Kim’s bank is disputing receipt 1041 ($150.00). Sam Lee answers it in Stripe by Nov 11 at 7:59 p.m. If the club wins, nothing changes here.');
  });

  it('no refund while it’s open, in both flows; an inquiry never blocks (Stripe settles one by a refund)', () => {
    assert.equal(refundBlockedByDispute([{ status: 'won' }, { status: 'under_review' }]), true);
    assert.equal(refundBlockedByDispute([{ status: 'warning_needs_response' }]), false);
    assert.equal(refundBlockedByDispute([{ status: 'warning_under_review' }]), false);
    assert.equal(refundBlockedByDispute([{ status: 'lost' }]), false);
    assert.equal(isDisputeOpen('warning_needs_response'), true);
    assert.match(D.noRefund(true), /pay the team twice\.$/);
    assert.match(D.noRefund(false), /pay the family twice\.$/);
  });
});

describe('the webhook: every dispute event, any order; a bank debit keeps 12c’s path exactly', () => {
  it('the five dispute events go to the card path; `created` still reaches reverseDebit first', () => {
    for (const t of ['created', 'updated', 'closed', 'funds_withdrawn', 'funds_reinstated']) assert.match(HOOK, new RegExp(`case 'charge\\.dispute\\.${t}':`));
    assert.match(HOOK, /if \(event\.type === 'charge\.dispute\.created'\) await reverseDebit\(account, dispute\);\s*[\s\S]*?await applyCardDispute\(account, dispute\);/);
  });

  it('a card dispute is re-read from Stripe on every event, after the payment is known to be a card, and written by the one function', () => {
    const fn = body(LANDING, 'applyCardDispute');
    assert.match(fn, /op\.rail !== 'card'\) return;[\s\S]*retrieveDispute\(stripeAccountId, event\.id\)/);
    assert.match(fn, /supabaseAdmin\.rpc\('online_payment_dispute_apply'/);
    // A card not landed yet is retried, never consumed.
    assert.match(fn, /!op\.landed_at && op\.status === 'open'\) throw/);
    assert.doesNotMatch(fn, /online_payment_reverse/); // the loss is booked inside the apply, once
  });

  it('reverseDebit is untouched: a card dispute returns early there', () => {
    assert.match(body(LANDING, 'reverseDebit'), /op\.rail !== 'bank_debit'\) return;/);
  });
});

describe('who hears (ask 3, words §1.4) and no family email (ask 2)', () => {
  it('the answerer’s copy is raised only while unanswered and carries `answerer: yes`; the desk’s copy leaves the answerer out', () => {
    const fn = body(LANDING, 'raiseDisputed');
    assert.match(fn, /if \(!d\.answered\) \{[\s\S]*?userIds: answerer\.ids, eventType: 'card_disputed'[\s\S]*?answerer: 'yes'/);
    assert.match(fn, /!answerer\.ids\.includes\(m\.user_id\)/);
    assert.match(fn, /subjectKey: 'onlineDisputeId'/);
  });

  it('the answerer is the person who set up payouts (canConnectPayouts), the one who connected leading', () => {
    const fn = body(LANDING, 'disputeAnswerer');
    assert.match(fn, /canConnectPayouts\(m\)/);
    assert.match(fn, /connected_by/);
  });

  it('items are raised only under the rule’s own waiting condition; the lost item once, when the loss is booked', () => {
    const fn = body(LANDING, 'afterDisputeApplied');
    assert.match(fn, /if \(isDisputeOpen\(d\.status\)\) \{[\s\S]*?raiseDisputed/);
    // From the rows, never this call's answer (/review 2026-10-27): a failure after the commit can't lose the item; raised
    // once ever per dispute, so a settled one is never raised again.
    assert.match(fn, /if \(d\.lost_booked_at && !d\.won_back_at && !\(await disputeLostRaised\(op\.org_id, d\.id\)\)\) await raiseDisputeLost/);
    assert.doesNotMatch(fn, /out\.lostNow/);
    assert.match(fn, /if \(d\.won_back_at && op\.flow === 'tournament_team'\) await raiseOverpaid\(op\.id\)/);
    // The lost item carries what its rule reads: the team, or the children.
    assert.match(body(LANDING, 'raiseDisputeLost'), /teamId: op\.team_id[\s\S]*registrationIds:/);
  });

  it('the email goes to the answerer once (once-only key, then stamped) and never to the family', () => {
    const fn = body(LANDING, 'sendDisputeOpenedEmail');
    assert.match(fn, /sendEmail\(answerer\.email,/);
    assert.match(fn, /idempotencyKey: `dispute-opened:\$\{d\.id\}`/);
    assert.match(fn, /opened_emailed_at: new Date\(\)\.toISOString\(\)[\s\S]*?\.is\('opened_emailed_at', null\)/);
    for (const name of ['applyCardDispute', 'afterDisputeApplied', 'raiseDisputed', 'raiseDisputeLost', 'sendDisputeOpenedEmail']) {
      assert.doesNotMatch(body(LANDING, name), /payer_email/, `${name} never reaches the family`);
    }
  });
});

describe('no refund while a dispute is open (words §1.2), at the one place every refund goes through', () => {
  it('the check fails closed: a failed read refuses, never lets a second payment out', () => {
    assert.match(body(LANDING, 'refuseWhileDisputed'), /if \(error\) throw new Error\(error\.message\);/);
  });

  it('all three refunds to the card ask first', () => {
    for (const name of ['refundOnlinePayment', 'refundTeamPart', 'refundLeagueToCard']) {
      assert.match(body(LANDING, name), /await refuseWhileDisputed\(/, `${name} refuses while a dispute is open`);
    }
    assert.match(TEAM_REFUND_ROUTE, /e instanceof DisputeOpenError\) return json\(\{ error: e\.message \}, 409\)/);
  });
});
