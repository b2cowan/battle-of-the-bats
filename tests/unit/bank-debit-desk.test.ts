import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { feeCell, phoneDetail, rowActions, whyOf, registrationHistory } from '../../lib/house-league-registrations.ts';
import { feeState, refundedOf, receivedOf, lastRefund, seasonMoney, type LeagueMoneyLine } from '../../lib/league-money.ts';
import type { RegDebit } from '../../lib/league-debits.ts';
import type { LeagueRegistration } from '../../lib/types.ts';

/**
 * Club Tier Stage 12c Part 6 — a bank debit at the house-league desk (words CLUB_TIER_STAGE12C_PARTREFUND_BANKDEBIT_COPY.md
 * §3.1–§3.5): the Fee cell, what the menu leaves out while a debit clears, the band, and the bank's returned line.
 */
const TODAY = '2026-10-28';
const SEASON = { registrationFee: 150, owingAmberDays: 14 };
const reg = (over: Partial<LeagueRegistration> = {}): LeagueRegistration => ({
  id: 'r1', seasonId: 's', divisionId: 'd', playerFirstName: 'Henry', playerLastName: 'Grant', playerDateOfBirth: null, playerJerseyPref: null,
  playerPositionPref: null, playerNotes: null, guardianFirstName: 'Pat', guardianLastName: 'Grant', guardianEmail: 'g@x.ca', guardianPhone: null,
  status: 'active', waitlistPosition: null, teamId: null, registrationFeePaid: false, feeEntryId: null, adminNotes: null, source: 'public_form',
  waiverAcceptedAt: null, signupRef: null, signupPosition: null, feeAmount: 150, acceptedAt: '2026-10-20T15:00:00Z', endedAt: null,
  spotReleased: false, endMoney: null, endMoneyReason: null, withdrawRequestedAt: null, withdrawRequestNote: null,
  registeredAt: '2026-10-01T15:00:00Z', updatedAt: '2026-10-01T15:00:00Z', ...over,
} as LeagueRegistration);
const line = (over: Partial<LeagueMoneyLine> = {}): LeagueMoneyLine => ({
  id: 'l1', regId: 'r1', dir: 'in', amount: 150, day: '2026-10-24', method: 'online_bank', status: 'posted', note: null, createdAt: '2026-10-24T15:00:00Z', ...over,
});
const debit = (over: Partial<RegDebit> = {}): RegDebit => ({
  state: 'clearing', onlinePaymentId: 'op1', itemId: 'i1', totalCents: 15475, shareCents: 15000, feeShareCents: 475, familyPaysFee: true,
  last4: '1234', startedAt: '2026-10-26T14:00:00Z', returnedAt: null, reversedAt: null, reason: null, receiptNo: null, siblings: [], decision: null, ...over,
});
const RIGHTS = { register: true, takeFees: true, run: true, email: true, payLinks: true };

describe('the Fee cell while a bank debit clears (words §3.1)', () => {
  it('the first line keeps the fee as an info chip; the debit\'s total and day on the second; the detail on tap', () => {
    const c = feeCell(reg(), SEASON, [], TODAY, [], [], null, debit());
    assert.equal(c.chip?.text, '$150 clearing');
    assert.equal(c.primary, null);
    assert.equal(c.sub, 'Bank debit · $154.75 · started Oct 26');
    assert.equal(c.chip?.tip, 'A bank debit of $154.75 started on Oct 26. The registration fee is $150; the rest is the processing fee. Banks take up to 5 business days. It goes in the season’s book when it clears.');
    assert.equal(c.tone, 'plain', 'never amber while it is on its way');
    assert.equal(phoneDetail('U11', null, c), 'U11 · $150 clearing · Bank debit · $154.75 · started Oct 26');
  });
  it('a sibling\'s debit names the others; the club paying the fee drops the fee clause', () => {
    assert.equal(feeCell(reg(), SEASON, [], TODAY, [], [], null, debit({ siblings: ['Lily'] })).sub, 'Part of one $154.75 bank debit with Lily · started Oct 26');
    const club = feeCell(reg(), SEASON, [], TODAY, [], [], null, debit({ familyPaysFee: false, totalCents: 15000 }));
    assert.equal(club.chip?.tip, 'A bank debit of $150 started on Oct 26. Banks take up to 5 business days. It goes in the season’s book when it clears.');
  });
  it('returned: owing again, the reason under it (none when unmapped); reversed: the receipt the bank took back', () => {
    const back = feeCell(reg(), SEASON, [], TODAY, [], [], null, debit({ state: 'returned', returnedAt: '2026-10-28T14:00:00Z', reason: 'account_closed' }));
    assert.equal(back.chip, null);
    assert.equal(back.primary, '$150 owing · 8 days');
    assert.equal(back.sub, 'Bank debit returned Oct 28 · account closed');
    assert.equal(feeCell(reg(), SEASON, [], TODAY, [], [], null, debit({ state: 'returned', returnedAt: '2026-10-28T14:00:00Z' })).sub, 'Bank debit returned Oct 28');
    const lines = [line(), line({ id: 'l2', dir: 'out', returned: true, day: '2026-11-02', createdAt: '2026-11-02T15:00:00Z' })];
    const rev = feeCell(reg(), SEASON, lines, '2026-11-02', [], [], null, debit({ state: 'reversed', reversedAt: '2026-11-02T14:00:00Z', receiptNo: 1043 }));
    assert.equal(rev.sub, 'Returned by the bank Nov 2 · receipt 1043');
    assert.equal(rev.state.kind, 'owing');
  });
});

describe('absent while it clears (words §3.2)', () => {
  it('Mark received and the pay link are not offered; everything else stays', () => {
    const state = feeState(reg(), SEASON, [], TODAY);
    const live = rowActions(reg(), state, [], RIGHTS);
    assert.ok(live.all.includes('markReceived') && live.all.includes('payLink'));
    const clearing = rowActions(reg(), state, [], RIGHTS, true);
    assert.ok(!clearing.all.includes('markReceived') && !clearing.all.includes('payLink'));
    assert.ok(clearing.all.includes('withdraw') && clearing.all.includes('decline'));
    assert.notEqual(clearing.primary, 'markReceived');
  });
  it('a bank debit that landed is never undone (a refund is the way back)', () => {
    const lines = [line()];
    assert.ok(!rowActions(reg({ feeAmount: 150 }), feeState(reg(), SEASON, lines, TODAY), lines, RIGHTS).all.includes('undo'));
  });
  it('a batch skipped for a clearing debit says why', () => {
    assert.deepEqual(whyOf({ code: 'clearing', status: 409, error: 'x' } as never, { division: null, free: false }), { key: 'clearing' });
  });
  it('the routes refuse a stale window: Mark received and the pay link', () => {
    const route = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts');
    assert.match(route, /move\.kind === 'receive' && await isRegClearing\(regId\)/);
    assert.match(readCode('lib/online-payment-receipt.ts'), /facts\.refusal === 'clearing'[\s\S]*?clearingLink/);
  });
});

describe('the band and the book (words §3.4, §3.5)', () => {
  it('Clearing moves out of Still owing, so the band still adds up', () => {
    const regs = [reg(), reg({ id: 'r2' }), reg({ id: 'r3' })];
    const lines = new Map([['r3', [line({ regId: 'r3' })]]]);
    const m = seasonMoney(regs, SEASON, lines, new Map([['r1', 15000]]));
    assert.deepEqual([m.owed, m.received, m.clearing, m.owing], [450, 150, 150, 150]);
    assert.deepEqual([m.clearingPlayers, m.owingPlayers], [1, 1]);
    assert.equal(m.owed, m.received + m.clearing + m.owing);
    assert.equal(seasonMoney(regs, SEASON, lines).clearing, 0, 'no tile without a debit on its way');
  });
  it('a returned line lowers received but is never a refund', () => {
    const lines = [line(), line({ id: 'l2', dir: 'out', returned: true })];
    assert.equal(receivedOf(lines), 0);
    assert.equal(refundedOf(lines), 0);
    assert.equal(lastRefund(lines), null);
    const h = registrationHistory(reg(), lines, [], TODAY, []);
    assert.ok(h.some(x => x.text === 'Returned by the bank · $150'));
    assert.ok(!h.some(x => x.text.startsWith('Refunded')));
  });
  it('the book reads the category, and the Refunds tab leaves the bank\'s line out', () => {
    assert.match(readCode('lib/league-money-read.ts'), /r\.category === 'registration_returned' \? \{ returned: true \}/);
    const page = readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/money/page.tsx');
    assert.match(page, /!r\.key\.startsWith\('returned:'\)/);
  });
});

describe('ending while it clears (words §3.3)', () => {
  it('the window asks first, nothing picked; only "Keep it" once payouts are disconnected', () => {
    const w = readCode('components/admin/kit/club/league/registrations/EndWindow.tsx');
    assert.match(w, /useState<'send_back' \| 'keep' \| null>\(null\)/);
    assert.match(w, /needsChoice = \(hasMoney && !answer\) \|\| \(!!clearing && !clearAnswer\)/);
    assert.match(w, /canSendBack = !!clearing && payoutsOn/);
    assert.match(w, /useState\(clubEnding\)[\s\S]*clearFeeOn/, 'A2\'s box defaults as the card window does');
  });
  it('the route stores the answer after the ending, and refuses a send-back without the fee right or payouts', () => {
    const route = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts');
    assert.match(route, /if \(!clearAsk\) return NextResponse\.json\(\{ error: END_WORDS\.clear\.footChoose/);
    assert.match(route, /clearAsk\.choice === 'send_back'\) \{\s*if \(!canMarkLeagueFeePaid\(ctx!\)\) return forbidden\(\);\s*if \(!\(await clubTakesCards/);
    assert.ok(route.indexOf("from('online_payment_clear_decisions').insert") > route.indexOf('const ended = await endLeagueRegistration'));
  });
});

describe('a tournament team while its bank debit clears (words §3.7)', () => {
  const fee = { depositAmount: 100, depositDueDate: '2026-10-01', totalFeeAmount: 400, totalFeeDueDate: '2026-10-15' };
  const team = { status: 'accepted', depositPaid: 0, totalPaid: 0, paymentStatus: 'pending' } as never as import('../../lib/tournament-teams.ts').TeamRecord;
  it('never past due while it clears; the summary says what is on its way, plain', async () => {
    const { computePaymentStatus, paymentLine } = await import('../../lib/tournament-teams.ts');
    assert.equal(computePaymentStatus(team, fee, TODAY), 'past-due');
    assert.notEqual(computePaymentStatus({ ...team, clearingAmount: 100 }, fee, TODAY), 'past-due');
    const line = paymentLine({ ...team, clearingAmount: 100 }, fee, TODAY)!;
    assert.equal(line.lead, 'Owes $400 · $100 clearing');
    assert.equal(line.owes, false, '"Owes" stays plain: the only thing owing is on its way');
    assert.ok(!line.rest.includes('past due'));
  });
  it('Mark paid waits (absent, and refused for a stale window); reminders skip the team; Record waits', () => {
    assert.match(readCode('app/[orgSlug]/admin/tournaments/registrations/components/TeamRecord.tsx'), /recordsPayments && !clearingNow &&/);
    assert.match(readCode('app/api/admin/teams/route.ts'), /\.eq\('status', 'clearing'\);\s*if \(\(clearing \?\? 0\) > 0\) return Response\.json\(\{ error: TEAM_RECORD_WORDS\.clearingMarkPaid/);
    assert.match(readCode('app/api/admin/tournaments/[tournamentId]/registrations/payment-reminders/route.ts'), /&& !clearingTeams\.has\(team\.id\)/);
    assert.match(readCode('app/[orgSlug]/admin/tournaments/registrations/components/TeamPayments.tsx'), /canRecord && !clearing && \(/);
  });
  it('a team ended while it clears is asked in its record; the route refuses an accepted team and a send-back after disconnect', () => {
    const route = readCode('app/api/admin/tournaments/[tournamentId]/registrations/online-payments/route.ts');
    assert.match(route, /body\.action === 'clear_decision'/);
    assert.match(route, /team\?\.status === 'accepted'\) return json/);
    assert.match(route, /choice === 'send_back'\) \{[\s\S]*?disconnected_at\) return json/);
    assert.match(readCode('app/[orgSlug]/admin/tournaments/registrations/components/TeamRecord.tsx'), /\(t\.status === 'accepted' \|\| clearingNow\)/);
  });
  it('a reversed row stays, struck, and never counts; a bank row reads its own method', () => {
    const tp = readCode('app/[orgSlug]/admin/tournaments/registrations/components/TeamPayments.tsx');
    assert.match(tp, /p\.status === 'refunded' \|\| p\.status === 'reversed' \? 0 :/);
    assert.match(tp, /p\.online\.rail === 'bank_debit' \? OW\.methodBank/);
    assert.match(readCode('lib/team-payments-server.ts'), /status\.in\.\(refunded,reversed\)/);
  });
});

describe('payouts: both rates, and Disconnect counts what is clearing (words §3.8, §4)', () => {
  it('every rate line prints both labels while bank debit is offered, card only otherwise', async () => {
    const { PAYOUTS_WORDS: W } = await import('../../lib/online-payment-words.ts');
    const { onlineFeeRateLabel } = await import('../../lib/plan-config.ts');
    const card = onlineFeeRateLabel('card');
    const bank = onlineFeeRateLabel('bankDebit');
    assert.equal(W.ratesLine(card, bank), `Processing fee: ${card} per card payment, ${bank} per bank debit.`);
    assert.equal(W.ratesLine(card), `Processing fee: ${card} per card payment.`);
    assert.equal(W.before.costRate(card, bank), `${card} per card payment · ${bank} per bank debit`);
    assert.equal(W.record.feeRates(card, bank), `${card} per card payment · ${bank} per bank debit`);
    assert.ok(W.notSetUpBody(card, bank).includes(`a processing fee of ${card} and a bank debit ${bank}`));
    assert.equal(W.disconnect.clearing(1), '1 bank debit is still clearing. It’ll finish, and its money still reaches you.');
  });
  it('the route prints the bank rate from the constant, and the example is computed, never typed', () => {
    const route = readCode('app/api/admin/payouts/route.ts');
    assert.match(route, /bankRateLabel: bank \? onlineFeeRateLabel\('bankDebit'\) : null/);
    assert.match(route, /onlineFee\(16_500, facts\?\.feePayer \?\? 'family', 'bankDebit'\)/);
    assert.match(route, /debitsClearing: isOwner && facts && !facts\.disconnectedAt \? await debitsClearing/);
    assert.match(readCode('components/admin/kit/club/PayoutsCard.tsx'), /\{clearing > 0 && <p>\{W\.disconnect\.clearing\(clearing\)\}<\/p>\}/);
  });
});
