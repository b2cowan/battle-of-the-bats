import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import {
  bulkActions, bulkResult, feeCell, parsePrice, receiveDayError, refundDayError, rowActions, tallyWhy, whyOf, matchesFee, regTab,
} from '../../lib/house-league-registrations.ts';
import { MONEY_REFUSAL } from '../../lib/house-league-money-words.ts';
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
    assert.equal(c.corrected?.text, 'Price corrected · Coach’s child');
    assert.equal(c.corrected?.tip, 'Was $150, now $120. Corrected on Oct 24. Coach’s child');
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
