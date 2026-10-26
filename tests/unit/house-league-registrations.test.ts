import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import {
  bulkActions, bulkResult, feeCell, parsePrice, receiveDayError, refundDayError, rowActions, tallyWhy, whyOf, matchesFee, regTab,
  registrationHistory, regFilterOffer, regFlags, matchesPicks, regFilterCounts, NO_PICKS, NOT_PLACED,
} from '../../lib/house-league-registrations.ts';
import type { CardRefund } from '../../lib/league-card-refunds.ts';
import { MONEY_REFUSAL, REGS_WORDS } from '../../lib/house-league-money-words.ts';
import { feeState, type LeagueMoneyLine } from '../../lib/league-money.ts';
import type { LeagueRegistration } from '../../lib/types.ts';

/**
 * Club Tier Stage 9b-2, Part 3 — what the Registrations screen decides (copy HOUSE_LEAGUE_STAGE9B2_COPY.md §1, §2).
 */
const TODAY = '2026-10-25';
const SEASON = { registrationFee: 150, owingAmberDays: 14 };
const reg = (over: Partial<LeagueRegistration> = {}): LeagueRegistration => ({
  id: 'r1', seasonId: 's', divisionId: 'd', playerFirstName: 'Ava', playerLastName: 'Kim', playerDateOfBirth: null, playerJerseyPref: null,
  playerPositionPref: null, playerNotes: null, guardianFirstName: 'Grace', guardianLastName: 'Kim', guardianEmail: 'g@x.ca', guardianPhone: null,
  status: 'active', waitlistPosition: null, teamId: null, registrationFeePaid: false, feeEntryId: null, adminNotes: null, source: 'public_form',
  waiverAcceptedAt: null, signupRef: null, signupPosition: null, feeAmount: 150, acceptedAt: '2026-10-11T15:00:00Z', endedAt: null,
  spotReleased: false, endMoney: null, endMoneyReason: null, withdrawRequestedAt: null, withdrawRequestNote: null,
  registeredAt: '2026-10-01T15:00:00Z', updatedAt: '2026-10-01T15:00:00Z', ...over,
} as LeagueRegistration);
const line = (over: Partial<LeagueMoneyLine> = {}): LeagueMoneyLine => ({
  id: 'l1', regId: 'r1', dir: 'in', amount: 150, day: '2026-10-24', method: 'etransfer', status: 'posted', note: null, createdAt: '2026-10-24T15:00:00Z', ...over,
});
const RIGHTS = { register: true, takeFees: true, run: true, email: true };

describe('the Fee cell (copy §1.3)', () => {
  it('owing reads its days, and turns amber only at or past the threshold', () => {
    const under = feeCell(reg(), SEASON, [], TODAY, []);
    assert.equal(under.primary, '$150 owing · 14 days');
    assert.equal(under.tone, 'warn', '14 days is at the threshold');
    const fresh = feeCell(reg({ acceptedAt: '2026-10-20T15:00:00Z' }), SEASON, [], TODAY, []);
    assert.equal(fresh.primary, '$150 owing · 5 days');
    assert.equal(fresh.tone, 'plain');
    assert.equal(fresh.sub, 'Accepted Oct 20');
    assert.equal(feeCell(reg({ acceptedAt: '2026-10-25T15:00:00Z' }), SEASON, [], TODAY, []).sub, 'Accepted today');
  });
  it('an acceptance with no date states no day count and never turns amber', () => {
    const c = feeCell(reg({ acceptedAt: null }), SEASON, [], TODAY, []);
    assert.deepEqual([c.primary, c.sub, c.tone], ['$150 owing', null, 'plain']);
  });
  it('received, part, refunded, kept and free', () => {
    assert.deepEqual([feeCell(reg(), SEASON, [line()], TODAY, []).primary, feeCell(reg(), SEASON, [line()], TODAY, []).sub], ['$150 received', 'Oct 24 · E-Transfer']);
    assert.equal(feeCell(reg(), SEASON, [line()], TODAY, []).tone, 'good');
    assert.equal(feeCell(reg({ feeAmount: 180 }), SEASON, [line()], TODAY, []).primary, '$150 received · $30 owing');
    assert.equal(feeCell(reg({ status: 'declined' }), SEASON, [line(), line({ id: 'l2', dir: 'out', day: '2026-10-25' })], TODAY, []).primary, '$150 refunded');
    const kept = feeCell(reg({ status: 'withdrawn', endMoney: 'kept', endMoneyReason: 'Withdrew after the date' }), SEASON, [line()], TODAY, []);
    assert.deepEqual([kept.primary, kept.sub], ['$150 kept by the club', 'Withdrew after the date']);
    assert.equal(feeCell(reg({ feeAmount: 0 }), { registrationFee: 0, owingAmberDays: 14 }, [], TODAY, []).primary, 'Free');
    assert.equal(feeCell(reg({ status: 'declined' }), SEASON, [], TODAY, []).primary, null);
  });
  it('a correction adds the third line, clipped, with the whole record as its tip', () => {
    const c = feeCell(reg(), SEASON, [], TODAY, [{ registrationId: 'r1', kind: 'corrected', oldAmount: 150, newAmount: 120, reason: 'Coach’s child', changedAt: '2026-10-24T15:00:00Z' }]);
    assert.equal(c.third?.text, 'Price corrected · Coach’s child');
    assert.equal(c.third?.tip, 'Was $150, now $120. Corrected on Oct 24. Coach’s child');
  });
});

/**
 * Club Tier Stage 12c Part 2 — a refund to the card is visible on the row (words CLUB_TIER_STAGE12C_REFUND_VISIBLE_COPY.md §1).
 * A club with no card refund reads today's cell word for word (frame f): every test above passes no refunds.
 */
describe('the Fee cell reads a card refund (12c words §1)', () => {
  const refund = (over: Partial<CardRefund> = {}): CardRefund => ({
    id: 'f1', regId: 'r1', itemId: 'i1', amount: 156.75, feeBack: 6.75, status: 'succeeded', origin: 'app', booked: true,
    entryId: 'l2', inBook: true, landError: null, reason: 'club_ended', partialReason: null, sentAnotherWay: false,
    createdAt: '2026-10-26T18:14:00Z', succeededAt: '2026-10-26T18:15:00Z', failedAt: null, reference: 're_123', by: 'Pat Lee', resolvedBy: null,
    rail: 'card', cardBrand: 'visa', cardLast4: '4242', bankLast4: null, receiptNo: 1046, paidAt: '2026-10-20T15:00:00Z',
    share: 150, shareFee: 6.75, familyPaidFee: true, emailedAt: null, emailFailedAt: null, familyAnswer: null, ...over,
  });
  const declined = reg({ status: 'declined', endedAt: '2026-10-26T18:00:00Z' });
  const paidAndBack = [line(), line({ id: 'l2', dir: 'out', day: '2026-10-26' })];
  it('refunded in full: the fee figure first, the card amount on the second line', () => {
    const c = feeCell(declined, SEASON, paidAndBack, TODAY, [], [refund()]);
    assert.deepEqual([c.primary, c.sub, c.alert], ['$150 refunded', 'Oct 26 · $156.75 to the card', null]);
  });
  it('pending at the bank, and made in Stripe', () => {
    assert.equal(feeCell(declined, SEASON, paidAndBack, TODAY, [], [refund({ status: 'pending', succeededAt: null })]).sub, 'Oct 26 · $156.75 to the card · pending');
    assert.equal(feeCell(declined, SEASON, paidAndBack, TODAY, [], [refund({ origin: 'stripe_dashboard' })]).sub, 'Oct 26 · $156.75 to the card · made in Stripe');
  });
  it('a refund the card sent back never reads "refunded": the amber pill, the door to record it sent another way', () => {
    const c = feeCell(declined, SEASON, paidAndBack, TODAY, [], [refund({ status: 'failed', succeededAt: null, failedAt: '2026-10-23T15:00:00Z' })]);
    assert.equal(c.primary, null);
    assert.deepEqual(c.alert, { text: 'Refund didn’t reach the card', aria: 'Refund didn’t reach the card. Record the refund sent another way.', refundId: 'f1' });
    assert.equal(c.sub, '$156.75 to the card · sent back Oct 23');
  });
  it('sent another way after it came back', () => {
    const c = feeCell(declined, SEASON, paidAndBack, TODAY, [], [refund({ sentAnotherWay: true, succeededAt: '2026-10-30T15:00:00Z', failedAt: '2026-10-23T15:00:00Z' })]);
    assert.deepEqual([c.primary, c.sub, c.alert], ['$150 refunded', 'Oct 30 · sent another way', null]);
  });
  it('a part refund with the rest kept names both (the refund is no longer hidden behind "kept")', () => {
    const r = reg({ status: 'withdrawn', endMoney: 'kept', endMoneyReason: 'After the date', endedAt: '2026-10-19T15:00:00Z' });
    const c = feeCell(r, SEASON, [line(), line({ id: 'l2', dir: 'out', amount: 50, day: '2026-10-19' })], TODAY, [],
      [refund({ amount: 50, feeBack: 0, reason: 'family_left', partialReason: 'After the date' })]);
    assert.deepEqual([c.primary, c.sub], ['$100 kept by the club · $50 refunded', 'Oct 19 · $50 to the card']);
  });
  it('a payment that never went on the registration, refunded: on the row, with the dotted third line and its tip', () => {
    const c = feeCell(declined, SEASON, [], TODAY, [], [refund({ entryId: null, inBook: false, landError: 'ended' })]);
    assert.deepEqual([c.primary, c.sub], ['$150 refunded', 'Oct 26 · $156.75 to the card']);
    assert.equal(c.third?.text, 'Paid after the registration ended');
    assert.equal(c.third?.tip, 'Paid by card on Oct 20 at 11:00 a.m., but it couldn’t go on this registration: the registration had already ended. Refunded to the card on Oct 26 at 2:15 p.m.');
    const also = feeCell(reg(), SEASON, [line()], TODAY, [], [refund({ entryId: null, inBook: false, landError: 'already_received' })]);
    assert.deepEqual([also.primary, also.third?.text], ['$150 received', 'Also paid by card · that payment was refunded']);
  });
  it('a correction whose difference went to the card says so on the third line; a failed one is amber and the door', () => {
    const change = { registrationId: 'r1', kind: 'corrected' as const, oldAmount: 150, newAmount: 135, reason: 'Sibling discount', changedAt: '2026-10-24T15:00:00Z', refundEntryId: 'l2' };
    const lines = [line(), line({ id: 'l2', dir: 'out', amount: 15, day: '2026-10-24' })];
    const ok = feeCell(reg({ feeAmount: 135 }), SEASON, lines, TODAY, [change], [refund({ amount: 15, feeBack: 0, reason: 'price_corrected' })]);
    assert.deepEqual([ok.primary, ok.third?.text, ok.third?.tone, ok.alert], ['$135 received', 'Price corrected · $15 back to the card', 'plain', null]);
    const bad = feeCell(reg({ feeAmount: 135 }), SEASON, lines, TODAY, [change], [refund({ amount: 15, feeBack: 0, reason: 'price_corrected', status: 'failed', failedAt: '2026-10-25T15:00:00Z' })]);
    assert.deepEqual([bad.third?.text, bad.third?.tone, bad.third?.refundId, bad.alert], ['Price corrected · $15 refund didn’t reach the card', 'warn', 'f1', null]);
  });
  it('a refund Stripe refused before booking changed nothing, and is on no screen', () => {
    const c = feeCell(reg(), SEASON, [line()], TODAY, [], [refund({ status: 'failed', booked: false, entryId: null })]);
    assert.deepEqual([c.primary, c.alert, c.third], ['$150 received', null, null]);
  });
  it('the history keeps the book’s figure first and adds the card’s, and the day it came back', () => {
    const h = registrationHistory(declined, paidAndBack, [], TODAY, [refund({ status: 'failed', succeededAt: null, failedAt: '2026-10-27T15:00:00Z' })]).map(x => x.text);
    assert.ok(h.includes('Refunded $150 · $156.75 to Visa •••• 4242'), h.join(' | '));
    assert.ok(h.includes('Refund didn’t reach the card · $156.75 to Visa •••• 4242'), h.join(' | '));
  });
});

describe('who sees which action (copy §1.4, §1.5, §2)', () => {
  const actions = (r: LeagueRegistration, lines: LeagueMoneyLine[], rights = RIGHTS) =>
    rowActions(r, feeState(r, SEASON, lines, TODAY), lines, rights);
  it('one primary a tab', () => {
    assert.equal(actions(reg({ status: 'pending_review' }), []).primary, 'approve');
    assert.equal(actions(reg(), []).primary, 'markReceived');
    assert.equal(actions(reg(), [line()]).primary, null);
    assert.equal(actions(reg({ status: 'waitlisted' }), []).primary, 'promote');
  });
  it('the menu follows the row and the rights, absent not disabled', () => {
    assert.deepEqual(actions(reg(), []).all, ['markReceived', 'move', 'correct', 'release', 'withdraw', 'decline', 'email', 'waitlist']);
    assert.deepEqual(actions(reg(), [line()]).all, ['move', 'correct', 'withdraw', 'decline', 'email', 'undo', 'waitlist']);
    assert.ok(!actions(reg(), [], { ...RIGHTS, run: false }).all.includes('move'), 'the registrar never sees Move');
    assert.deepEqual(actions(reg({ status: 'declined' }), []).all, ['email']);
    // A finished season: no status change, no Move; fees stay.
    const finished = { register: false, takeFees: true, run: false, email: true };
    assert.deepEqual(actions(reg(), [line()], finished).all, ['correct', 'email', 'undo']);
  });
  it('the bulk bar offers what the tab can use; Decline and Withdraw are never bulk', () => {
    assert.deepEqual(bulkActions('review', RIGHTS, true), ['approve', 'waitlist', 'move', 'email']);
    assert.deepEqual(bulkActions('active', RIGHTS, true), ['markReceived', 'waitlist', 'move', 'email']);
    assert.deepEqual(bulkActions('active', RIGHTS, false), ['waitlist', 'move', 'email']);
    assert.deepEqual(bulkActions('waitlist', RIGHTS, true), ['promote', 'move', 'email']);
    assert.deepEqual(bulkActions('ended', RIGHTS, true), ['email']);
  });
  it('12b: Email the pay link on an owing row only while the club takes card payments; a card payment has no Undo', () => {
    const cards = { ...RIGHTS, payLinks: true };
    assert.deepEqual(actions(reg(), [], cards).all, ['markReceived', 'payLink', 'move', 'correct', 'release', 'withdraw', 'decline', 'email', 'waitlist']);
    assert.ok(!actions(reg(), []).all.includes('payLink'), 'not while the club isn’t taking card payments');
    assert.ok(!actions(reg(), [line()], cards).all.includes('payLink'), 'not on a paid row');
    assert.ok(!actions(reg(), [], { ...cards, takeFees: false }).all.includes('payLink'), 'the desk’s, with takeFees');
    // A card payment really arrived: it comes off only by a refund (drawings m4).
    assert.ok(!actions(reg(), [line({ method: 'online_card' })], cards).all.includes('undo'));
    assert.ok(actions(reg(), [line({ method: 'etransfer' })], cards).all.includes('undo'));
    assert.deepEqual(bulkActions('active', cards, true), ['markReceived', 'payLink', 'waitlist', 'move', 'email']);
  });
  it('12b: the Fee cell reads a card payment’s receipt, and when an owing row was sent its pay link', () => {
    const card = feeCell(reg(), SEASON, [line({ method: 'online_card', receiptNo: 1043 })], TODAY, []);
    assert.equal(card.sub, 'Oct 24 · Online, card · receipt 1043');
    const sent = feeCell(reg({ payLinkSentAt: '2026-10-20T15:00:00Z' }), SEASON, [], TODAY, []);
    assert.equal(sent.sub, 'Pay link sent Oct 20');
  });
  it('tabs and the Fee filter', () => {
    assert.deepEqual(['pending_review', 'active', 'waitlisted', 'declined', 'withdrawn'].map(s => regTab(s as LeagueRegistration['status'])), ['review', 'active', 'waitlist', 'ended', 'ended']);
    const owing = feeState(reg(), SEASON, [], TODAY);
    assert.ok(matchesFee(owing, new Set(['owing'])) && !matchesFee(owing, new Set(['received'])) && matchesFee(owing, new Set()));
  });
});

describe('the Filter: Team · Fee · Flags (owner, 2026-10-26)', () => {
  const fee = (r: LeagueRegistration, lines: LeagueMoneyLine[] = []) => feeState(r, SEASON, lines, TODAY);
  it('what each tab offers: Team on Active only, money only when the season charges, the pay link only with cards', () => {
    const o = { charges: true, payLinks: true, teamIds: ['t1', 't2'] };
    assert.deepEqual(regFilterOffer('active', o), { team: [NOT_PLACED, 't1', 't2'], fee: ['owing', 'received'], flags: ['asked', 'late', 'noPayLink', 'notes'] });
    assert.deepEqual(regFilterOffer('review', o), { team: [], fee: ['owing', 'received'], flags: ['asked', 'notes'] });
    assert.deepEqual(regFilterOffer('ended', o), { team: [], fee: ['owing', 'received', 'refunded'], flags: [] });
    assert.deepEqual(regFilterOffer('active', { charges: false, payLinks: true, teamIds: [] }), { team: [NOT_PLACED], fee: [], flags: ['asked', 'notes'] });
    assert.deepEqual(regFilterOffer('active', { ...o, payLinks: false }).flags, ['asked', 'late', 'notes']);
  });
  it('a row’s flags: late is the row’s own amber; a sent pay link and an ended child drop theirs', () => {
    const late = reg({ withdrawRequestedAt: '2026-10-20T15:00:00Z', playerNotes: ' Peanut allergy ' });
    assert.deepEqual([...regFlags(late, fee(late))].sort(), ['asked', 'late', 'noPayLink', 'notes']);
    const fresh = reg({ acceptedAt: '2026-10-20T15:00:00Z', payLinkSentAt: '2026-10-21T15:00:00Z', playerNotes: '  ' });
    assert.deepEqual([...regFlags(fresh, fee(fresh))], []);
    const ended = reg({ status: 'withdrawn', withdrawRequestedAt: '2026-10-20T15:00:00Z' });
    assert.ok(!regFlags(ended, fee(ended)).has('asked'));
    const paid = reg();
    assert.ok(!regFlags(paid, fee(paid, [line()])).has('noPayLink'), 'nothing owing, nothing to send');
    const part = reg();
    const partFlags = regFlags(part, fee(part, [line({ amount: 50 })]));
    assert.ok(partFlags.has('noPayLink') && !partFlags.has('late'), 'part received still owes a link; only a plain owing row turns amber');
  });
  it('ticks widen within a group and narrow across groups', () => {
    const placed = reg({ teamId: 't1' });
    const picks = { ...NO_PICKS, team: new Set([NOT_PLACED, 't2']) };
    assert.ok(!matchesPicks(picks, placed, fee(placed)));
    assert.ok(matchesPicks({ ...picks, team: new Set([NOT_PLACED, 't1']) }, placed, fee(placed)));
    assert.ok(!matchesPicks({ ...NO_PICKS, team: new Set(['t1']), fee: new Set(['received']) }, placed, fee(placed)));
  });
  it('each count is what ticking it would list, given the OTHER groups’ ticks; a zero stays', () => {
    const rows = [reg({ id: 'a' }), reg({ id: 'b', teamId: 't1' }), reg({ id: 'c', withdrawRequestedAt: '2026-10-20T15:00:00Z' })];
    const offer = regFilterOffer('active', { charges: true, payLinks: false, teamIds: ['t1'] });
    const picks = { ...NO_PICKS, team: new Set([NOT_PLACED]), flags: new Set(['asked']) };
    const c = regFilterCounts(rows, r => fee(r), picks, offer);
    assert.deepEqual([...c.team], [[NOT_PLACED, 1], ['t1', 0]], 'Team counted over the Flags tick only');
    assert.deepEqual([...c.fee], [['owing', 1], ['received', 0]]);
    assert.deepEqual([...c.flags], [['asked', 1], ['late', 2], ['notes', 0]], 'Flags counted over the Team tick only');
  });
  it('the late option says the season’s own days', () => {
    assert.equal(REGS_WORDS.filterLate(14), 'Owing 14 days or more');
    assert.equal(REGS_WORDS.filterLate(1), 'Owing 1 day or more');
  });
});

describe('a batch says what stayed, and why (copy §2.2)', () => {
  it('a clean result and a partial one', () => {
    assert.deepEqual(bulkResult({ verb: 'approve', ok: 3, tally: [] }), { text: '3 approved.', partial: false, failed: 0 });
    const one = whyOf({ status: 409, code: 'division_full', error: 'x' }, { division: 'Division A', free: false });
    assert.equal(bulkResult({ verb: 'promote', ok: 3, tally: tallyWhy([one, one]) }).text, '3 promoted; 2 stay on the waitlist: Division A is full.');
  });
  it('several reasons are counted', () => {
    const t = tallyWhy([
      whyOf({ status: 409, code: 'division_full', error: '' }, { division: 'Division C', free: false }),
      whyOf({ status: 409, code: 'division_full', error: '' }, { division: 'Division C', free: false }),
      whyOf({ status: 409, code: 'already_received', error: '' }, { division: null, free: false }),
    ]);
    assert.equal(bulkResult({ verb: 'markReceived', ok: 1, tally: t }).text, '1 marked received; 3 skipped: 2 are full in Division C; 1 already received.');
  });
  it('a move that kept a paid child’s price stays until dismissed', () => {
    const r = bulkResult({ verb: 'move', ok: 4, tally: [], division: 'Division B', kept: 2 });
    assert.equal(r.text, '4 moved to Division B. 2 kept their price: paid. Correct one at a time.');
    assert.equal(r.partial, true);
  });
  it('a refund or receipt date is refused in the route’s own words', () => {
    assert.equal(refundDayError('2026-10-20', TODAY, '2026-10-20'), null);
    assert.equal(refundDayError('2026-10-20', TODAY, null), null);
    assert.equal(refundDayError('', TODAY, null), MONEY_REFUSAL.date);
    assert.equal(refundDayError('2026-10-26', TODAY, null), MONEY_REFUSAL.futureRefund);
    assert.equal(refundDayError('2026-10-19', TODAY, '2026-10-20'), MONEY_REFUSAL.beforePayment);
    assert.equal(receiveDayError(TODAY, TODAY), null);
    assert.equal(receiveDayError('', TODAY), MONEY_REFUSAL.date);
    assert.equal(receiveDayError('2026-10-26', TODAY), MONEY_REFUSAL.futurePayment);
  });
  it('small helpers', () => {
    assert.deepEqual(['120', '$1,200.50', '12.345', '-5', '', 'abc'].map(parsePrice), [120, 1200.5, null, null, null, null]);
  });
});

describe('the screen is built on the kit, once', () => {
  const dir = 'components/admin/kit/club/league/registrations';
  const files = ['RegistrationsScreen', 'RegistrationsList', 'FeeCell', 'RowMenu', 'BulkBar', 'ReceiveWindow', 'EndWindow', 'PriceWindow', 'MoveWindow', 'UndoWindow', 'EmailWindow', 'AddRegistrationWindow', 'ConfirmWindow', 'RegistrationRecordWindow'];
  it('none of it wears the old look', () => {
    for (const f of files) {
      const code = readCode(`${dir}/${f}.tsx`);
      assert.doesNotMatch(code, /useAdminKit|useKitStyle|kx\(|modalOverlay|styles\.modal|#[0-9a-fA-F]{3,6}\b/, f);
    }
  });
  it('the route is thin, and the ending starts with nothing picked', () => {
    assert.ok(readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx').split('\n').length < 20);
    const end = readCode(`${dir}/EndWindow.tsx`);
    // 12b adds the card choices (Refund to the card, Refund part of it); nothing is picked still.
    assert.match(end, /useState<'refunded' \| 'kept' \| 'card' \| 'cardPart' \| null>\(null\)/);
    assert.match(end, /\{!needsChoice && \(/, 'the primary is absent until Refunded or Kept is chosen');
  });
});
