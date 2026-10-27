import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import type { DisputeRecord } from '../../lib/online-payment-dispute.ts';
import { feeCell, phoneDetail } from '../../lib/house-league-registrations.ts';
import type { LeagueMoneyLine } from '../../lib/league-money.ts';
import type { LeagueRegistration } from '../../lib/types.ts';
import { DISPUTE_WORDS as D, disputeFactsText, disputeWhyShort } from '../../lib/online-payment-words.ts';

/**
 * Club Tier Stage 12d-1 Part 3 — a card dispute on the screens (words CLUB_TIER_STAGE12D_COPY.md §1.1–§1.5): the Fee cell
 * through a dispute's life, Copy the facts, amber and the Stripe door for the answerer alone, no refund door while it is
 * open, the season's book, and the family never told (ask 2). The server's half is online-payments-card-dispute.test.ts.
 */
const TODAY = '2026-11-05';
const SEASON = { registrationFee: 150, owingAmberDays: 14 };
const reg = (over: Partial<LeagueRegistration> = {}): LeagueRegistration => ({
  id: 'r1', seasonId: 's', divisionId: 'd', playerFirstName: 'Henry', playerLastName: 'Kim', playerDateOfBirth: null, playerJerseyPref: null,
  playerPositionPref: null, playerNotes: null, guardianFirstName: 'Grace', guardianLastName: 'Kim', guardianEmail: 'g@x.ca', guardianPhone: null,
  status: 'active', waitlistPosition: null, teamId: null, registrationFeePaid: true, feeEntryId: null, adminNotes: null, source: 'public_form',
  waiverAcceptedAt: null, signupRef: null, signupPosition: null, feeAmount: 150, acceptedAt: '2026-10-20T15:00:00Z', endedAt: null,
  spotReleased: false, endMoney: null, endMoneyReason: null, withdrawRequestedAt: null, withdrawRequestNote: null,
  registeredAt: '2026-10-01T15:00:00Z', updatedAt: '2026-10-01T15:00:00Z', ...over,
} as LeagueRegistration);
const paid = (over: Partial<LeagueMoneyLine> = {}): LeagueMoneyLine => ({
  id: 'l1', regId: 'r1', dir: 'in', amount: 150, day: '2026-10-24', method: 'online_card', status: 'posted', note: null, createdAt: '2026-10-24T15:00:00Z', ...over,
});
const rec = (over: Partial<DisputeRecord> = {}): DisputeRecord => ({
  id: 'd1', status: 'needs_response', reason: 'fraudulent', amount: 150, held: 150, dueBy: '2026-11-11T23:59:00Z', answered: false,
  answeredAt: null, openedAt: '2026-11-01T15:00:00Z', closedAt: null, stripeFee: 15, feePaidFrom: 'club', stripeDisputeId: 'du_1',
  lostBookedAt: null, wonBackAt: null, openedEmailedAt: null, receiptNo: 1041, answererName: 'Sam Lee', youAnswer: false, canCopy: true,
  showFee: false, factsList: '', factsText: '', refundedOn: null, children: [], paidAgain: [], owesAgain: '', book: 'season', ...over,
});

describe('the Fee cell through a dispute’s life (words §1.1)', () => {
  it('open: the paid line stays; the chip is the info colour for the desk, amber for the answerer; the second line names who answers', () => {
    const desk = feeCell(reg(), SEASON, [paid()], TODAY, [], [], null, null, rec());
    assert.ok(desk.primary, 'the paid line stays while a dispute is open (ask 3)');
    assert.deepEqual([desk.flag?.text, desk.flag?.tone], ['Disputed', 'info']);
    assert.equal(desk.sub, 'Sam Lee answers by Nov 11');
    const you = feeCell(reg(), SEASON, [paid()], TODAY, [], [], null, null, rec({ youAnswer: true }));
    assert.deepEqual([you.flag?.tone, you.sub], ['warn', 'Answer by Nov 11']);
    const answered = feeCell(reg(), SEASON, [paid()], TODAY, [], [], null, null, rec({ status: 'under_review', answered: true, answeredAt: '2026-11-03T15:00:00Z' }));
    assert.deepEqual([answered.flag?.text, answered.sub], ['Disputed · with the bank', 'Answered Nov 3']);
    assert.match(phoneDetail('U11', null, desk), / · Disputed · Sam Lee answers by Nov 11$/);
  });

  it('lost: owing again, amber, taken back by the bank with the receipt; won: plain paid with "dispute won" last', () => {
    const lines = [paid(), paid({ id: 'l2', dir: 'out', returned: true, day: '2026-11-04', createdAt: '2026-11-04T15:00:00Z' })];
    const lost = feeCell(reg({ registrationFeePaid: false }), SEASON, lines, TODAY, [], [], null, null,
      rec({ status: 'lost', lostBookedAt: '2026-11-04T15:00:00Z', closedAt: '2026-11-04T15:00:00Z' }));
    assert.deepEqual([lost.primary, lost.tone, lost.sub, lost.flag], ['$150 owing · dispute lost', 'warn', 'Taken back by the bank Nov 4 · receipt 1041', null]);
    const won = feeCell(reg(), SEASON, [paid()], TODAY, [], [], null, null, rec({ status: 'won', closedAt: '2026-11-04T15:00:00Z', answered: true }));
    assert.match(won.sub ?? '', / · dispute won Nov 4$/);
    assert.equal(won.flag, null);
  });
});

describe('Copy the facts (words §1.3): plain statements, every line dropped when its fact is missing', () => {
  it('the whole text, and the test line first in test mode', () => {
    const full = disputeFactsText({
      test: true, receiptNo: '1041', amount: '$154.75', paidDay: 'Oct 2, 2026', cardLast4: '4242', payerName: 'Grace Kim',
      payerEmail: 'grace.kim@example.ca', forLine: 'Henry Kim, U11, 2026 Spring with Northfield Minor Ball', registeredDay: 'Sep 14, 2026',
      registeredBy: 'Grace Kim', refundPolicy: 'Full refund before the first game.', receiptEmailedDay: 'Oct 2, 2026',
      club: 'Northfield Minor Ball', contactEmail: 'registrar@northfield.ca',
    });
    assert.equal(full, [
      'Test mode: no money moved.',
      'Disputed payment: receipt 1041, $154.75, paid Oct 2, 2026 by card ending 4242.',
      'Paid by Grace Kim (grace.kim@example.ca).',
      'For: Henry Kim, U11, 2026 Spring with Northfield Minor Ball.',
      'Registered Sep 14, 2026 by Grace Kim.',
      'The payer entered the card on Stripe’s secure payment page.',
      'Refund policy shown beside Pay: “Full refund before the first game.”',
      'Receipt 1041 was emailed to grace.kim@example.ca on Oct 2, 2026.',
      'Contact: Northfield Minor Ball, registrar@northfield.ca.',
    ].join('\n'));
    const bare = disputeFactsText({
      test: false, receiptNo: '7', amount: '$10.00', paidDay: 'Oct 2, 2026', cardLast4: null, payerName: null, payerEmail: null,
      forLine: 'Rockets’ deposit for Fall Classic', registeredDay: null, registeredBy: null, refundPolicy: null, receiptEmailedDay: null,
      club: 'Northfield', contactEmail: null,
    });
    assert.doesNotMatch(bare, /Paid by|Registered|Refund policy|was emailed|Test mode/);
    assert.match(bare, /^Disputed payment: receipt 7, \$10\.00, paid Oct 2, 2026 by card\.$/m);
  });
});

describe('amber and the Stripe door are the answerer’s; no refund door while open; the family never told', () => {
  const BLOCK = readCode('components/admin/kit/club/DisputeBlock.tsx');
  const TEAM = readCode('app/[orgSlug]/admin/tournaments/registrations/components/TeamPayments.tsx');
  const SCREEN = readCode('components/admin/kit/club/league/registrations/RegistrationsScreen.tsx');

  it('"Answer in Stripe" renders only for the answerer; "Copy the facts" for whoever may copy; the block is amber for the answerer only', () => {
    assert.match(BLOCK, /\{d\.youAnswer && \([\s\S]*?\{opening \? PAYOUTS_WORDS\.opening : D\.answer\}/);
    assert.match(BLOCK, /\{d\.canCopy && \([\s\S]*?aria-label=\{D\.copyAria\}/);
    assert.match(BLOCK, /const amber = d\.youAnswer;/);
    assert.match(BLOCK, /action: 'dashboard'/); // the owner's own Express Dashboard sign-in; never emailed
  });

  it('the team row offers no refund while a dispute is open, and a card loss reads its own words', () => {
    assert.match(TEAM, /p\.online\.refund !== 'pending'\s*&& !isDisputeOpen\(p\.online\.dispute\?\.status \?\? ''\)/);
    assert.match(TEAM, /p\.online\.rail === 'card' && p\.online\.dispute\?\.lostBookedAt\s*\? <span className=\{styles\.payTag\}>\{DPW\.teamRowLost/);
  });

  it('house league: the row’s refund door waits while open; "Email families who owe" leaves out a lost dispute', () => {
    assert.match(SCREEN, /unrecordedCard\?\.\[reg\.id\]\?\.length && !isDisputeOpen\(read\?\.disputes\?\.\[reg\.id\]\?\.status \?\? ''\)\) actions\.all\.push\('refundCard'\)/);
    assert.match(SCREEN, /lost\?\.status === 'lost' && lost\.lostBookedAt\) \{ skipped\.push\(id\); disputeSkipped \+= 1; continue; \}/);
    assert.equal(D.bulkWhy, 'a dispute was lost');
  });

  it('the family’s status page shows a reversal for a bank debit only (ask 2: nobody tells a family about a dispute)', () => {
    assert.match(readCode('lib/league-pay-facts.ts'), /reversed: newest && newest\.op\.status === 'reversed' && newest\.op\.rail === 'bank_debit'/);
  });

  it('the season’s book names a lost dispute’s line, never "Returned by the bank"', () => {
    assert.equal(D.moneyLine('1041', disputeWhyShort('duplicate')), 'Dispute lost · charged twice · receipt 1041');
    assert.equal(D.moneyLine('1041', ''), 'Dispute lost · receipt 1041');
    assert.match(readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/money/page.tsx'), /l\.kind === 'returned' && l\.disputeLost \? DISPUTE_WORDS\.moneyLine/);
  });
});
