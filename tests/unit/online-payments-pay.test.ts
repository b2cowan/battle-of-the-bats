import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { payOptions } from '../../lib/team-pay-options.ts';
import { onlineFee } from '../../lib/online-payment-fee.ts';
import { readTeamPayToken, signTeamPayToken, teamPayPath } from '../../lib/team-pay-link.ts';
import { refusalMessage, type RefusalFacts } from '../../lib/team-pay-refusal.ts';
import { payoutsState, takesPayments, type PayoutsAccountFacts } from '../../lib/online-payment-account.ts';

/**
 * Club Tier Stage 12a, Parts 2–4: deposit or full (A7), the signed pay link, the pay route's refusals (copy §18) and the
 * Payouts card's five states.
 */

const fee = (total: number | null, deposit: number | null) => ({
  totalFeeAmount: total, totalFeeDueDate: '2026-11-30', depositAmount: deposit, depositDueDate: '2026-11-01',
});

describe('deposit or full (A7)', () => {
  it('offers the deposit, pre-selected, and the whole fee when nothing is paid', () => {
    const o = payOptions({ totalPaid: 0, depositPaid: 0 }, fee(300, 100), 'family')!;
    assert.deepEqual(o.choices.map(c => c.scope), ['deposit', 'full']);
    assert.equal(o.preselected, 'deposit');
    assert.equal(o.choices[0].fee.baseCents, 10_000);
    assert.equal(o.choices[1].fee.baseCents, 30_000);
  });

  it('shows the saving of paying in full only while the team pays the fee, and it is one flat part', () => {
    const family = payOptions({ totalPaid: 0, depositPaid: 0 }, fee(300, 100), 'family')!;
    const split = onlineFee(10_000, 'family').feeCents + onlineFee(20_000, 'family').feeCents;
    assert.equal(family.savingCents, split - onlineFee(30_000, 'family').feeCents);
    assert.ok((family.savingCents ?? 0) > 0);
    assert.equal(payOptions({ totalPaid: 0, depositPaid: 0 }, fee(300, 100), 'club')!.savingCents, null);
  });

  it('offers one choice, the whole fee, with no deposit step', () => {
    const o = payOptions({ totalPaid: 0, depositPaid: 0 }, fee(300, null), 'family')!;
    assert.deepEqual(o.choices.map(c => c.scope), ['full']);
    assert.equal(o.savingCents, null);
  });

  it('offers only the balance once anything is paid — after the deposit or a part-payment', () => {
    for (const paid of [100, 40]) {
      const o = payOptions({ totalPaid: paid, depositPaid: Math.min(paid, 100) }, fee(300, 100), 'family')!;
      assert.deepEqual(o.choices.map(c => c.scope), ['balance']);
      assert.equal(o.choices[0].fee.baseCents, (300 - paid) * 100);
    }
  });

  it('offers nothing when paid in full or when no fee is set', () => {
    assert.equal(payOptions({ totalPaid: 300, depositPaid: 100 }, fee(300, 100), 'family'), null);
    assert.equal(payOptions({ totalPaid: 0, depositPaid: 0 }, fee(null, null), 'family'), null);
  });

  it('the club-pays total is the base; the family-pays total adds the fee', () => {
    const club = payOptions({ totalPaid: 0, depositPaid: 0 }, fee(300, null), 'club')!.choices[0].fee;
    const fam = payOptions({ totalPaid: 0, depositPaid: 0 }, fee(300, null), 'family')!.choices[0].fee;
    assert.equal(club.totalCents, 30_000);
    assert.equal(fam.totalCents, 30_000 + fam.feeCents);
  });
});

describe('the pay link: signed, one team, never stored', () => {
  const secret = 'x'.repeat(40);
  const team = '44e793cd-617d-40bd-bad3-406a6304a1bc';

  it('reads back the team it was signed for', () => {
    assert.equal(readTeamPayToken(signTeamPayToken(team, secret), secret), team);
  });

  it('refuses a token signed under another secret, a changed team, or a mangled token', () => {
    const t = signTeamPayToken(team, secret);
    assert.equal(readTeamPayToken(t, 'y'.repeat(40)), null);
    const other = signTeamPayToken('e54b9845-ed78-4a9d-be6f-dbbfff184f10', secret);
    assert.equal(readTeamPayToken(`${other.split('.')[0]}.${t.split('.')[1]}`, secret), null);
    assert.equal(readTeamPayToken('not-a-token', secret), null);
    assert.equal(readTeamPayToken(`${t}x`, secret), null);
  });

  it('lives under the tournament’s own address, never a top-level /pay', () => {
    assert.equal(teamPayPath('dev-club', 'spring-cup', 'abc.def'), '/dev-club/spring-cup/pay/abc.def');
  });
});

describe('the pay route’s refusals (copy §18)', () => {
  const facts = (refusal: RefusalFacts['refusal'], over: Partial<RefusalFacts> = {}): RefusalFacts => ({
    refusal, teamName: 'Riverdale 13U', teamStatus: 'accepted', totalPaid: 0, org: { name: 'Dev Club' }, tournament: { name: 'Spring Cup' }, ...over,
  });

  it('says nothing when the team may pay', () => {
    assert.equal(refusalMessage(facts(null)), null);
  });

  it('refuses an unaccepted team, and names a declined one as no longer in the tournament', () => {
    assert.match(refusalMessage(facts('not_accepted', { teamStatus: 'pending' }))!, /hasn’t been accepted yet/);
    assert.match(refusalMessage(facts('not_accepted', { teamStatus: 'rejected' }))!, /no longer in Spring Cup/);
    assert.match(refusalMessage(facts('tournament_over'))!, /no longer in Spring Cup/);
  });

  it('refuses a paid team as paid in full, and an owing-nothing team as nothing to pay', () => {
    assert.match(refusalMessage(facts('nothing_owed', { totalPaid: 300 }))!, /already paid in full/);
    assert.match(refusalMessage(facts('nothing_owed'))!, /nothing to pay/);
    assert.match(refusalMessage(facts('our_team'))!, /nothing to pay/);
  });

  it('refuses when the club is not taking payments, and when the switch is off', () => {
    assert.match(refusalMessage(facts('not_taking_payments'))!, /Dev Club isn’t taking online payments/);
    assert.match(refusalMessage(facts('not_tracked'))!, /Dev Club isn’t taking online payments/);
    assert.match(refusalMessage(facts('switch_off'))!, /aren’t available/);
  });
});

describe('the Payouts card’s five states', () => {
  const acct = (over: Partial<PayoutsAccountFacts> = {}): PayoutsAccountFacts => ({
    stripeAccountId: 'acct_1', livemode: false, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false,
    requirementsDue: [], disabledReason: null, requirementsDeadline: null, feePayer: 'family', refundPolicy: null, disconnectedAt: null, ...over,
  });

  it('reads not set up, setting up, taking payments, needs attention and disconnected', () => {
    assert.equal(payoutsState(null), 'not_set_up');
    assert.equal(payoutsState(acct()), 'setting_up');
    assert.equal(payoutsState(acct({ detailsSubmitted: true })), 'setting_up', 'just submitted, nothing due: still a wait');
    assert.equal(payoutsState(acct({ detailsSubmitted: true, disabledReason: 'requirements.pending_verification' })), 'setting_up');
    assert.equal(payoutsState(acct({ detailsSubmitted: true, chargesEnabled: true })), 'taking_payments');
    assert.equal(payoutsState(acct({ detailsSubmitted: true, chargesEnabled: true, requirementsDue: ['individual.verification.document'] })), 'needs_attention');
    assert.equal(payoutsState(acct({ detailsSubmitted: true, disabledReason: 'requirements.past_due', requirementsDue: ['x'] })), 'needs_attention');
    assert.equal(payoutsState(acct({ chargesEnabled: true, disconnectedAt: '2026-10-25T00:00:00Z' })), 'disconnected');
  });

  it('takes payments only on Stripe’s word and never once disconnected', () => {
    assert.equal(takesPayments(acct({ chargesEnabled: true })), true);
    assert.equal(takesPayments(acct({ chargesEnabled: true, requirementsDue: ['x'] })), true, 'a deadline still takes payments');
    assert.equal(takesPayments(acct({ chargesEnabled: true, disconnectedAt: '2026-10-25T00:00:00Z' })), false);
    assert.equal(takesPayments(null), false);
  });
});
