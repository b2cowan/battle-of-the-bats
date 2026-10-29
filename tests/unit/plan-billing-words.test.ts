import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PLAN_BILLING_WORDS as W } from '../../lib/plan-billing-words.ts';
import { PLAN_CONFIG, FOUNDING_SEASON_END_LABEL, FOUNDING_SEASON_FIRST_CHARGE_LABEL } from '../../lib/plan-config.ts';
import { freeTimeCopy } from '../../lib/free-time-copy.ts';
import { portalFreeTimeCopy } from '../../lib/portal-free-time.ts';
import { STRIPE_FEE_WORDS } from '../../lib/online-payment-words.ts';
import { subscriptionStatusLabel } from '../../lib/platform-labels.ts';

describe('shared billing vocabulary', () => {
  it('uses the one possessive and the existing status/free-time/fee copy builders', () => {
    assert.equal(W.page.lockedBody('Riverdale Reds'), 'Only Riverdale Reds’ owner can see and change the plan and how it’s paid.');
    assert.equal(W.page.lockedBody('Riverdale'), 'Only Riverdale’s owner can see and change the plan and how it’s paid.');
    assert.strictEqual(W.plan.status, subscriptionStatusLabel);
    assert.strictEqual(W.freeTime, freeTimeCopy);
    assert.strictEqual(W.portalFreeTime, portalFreeTimeCopy);
    assert.strictEqual(W.stripeFees, STRIPE_FEE_WORDS);
    assert.equal(W.page.title, 'Plan & billing');
  });

  it('formats price/cycle/date values without a fresh price or US date', () => {
    assert.equal(W.plan.price(PLAN_CONFIG.club.monthlyPrice, 'monthly'), '$219 CAD / month');
    assert.equal(W.plan.price(PLAN_CONFIG.club.annualPrice, 'annual'), '$2,190 CAD / year');
    assert.equal(W.plan.price(0, 'monthly'), 'Free');
    assert.equal(W.plan.fromPrice(0), 'Free');
    assert.equal(W.plan.billed('annual'), 'billed yearly');
    assert.equal(W.plan.billed('monthly'), 'billed monthly');
    assert.equal(W.change.headings.holds, 'Holds');
    assert.equal(W.plan.renews('2026-11-03'), 'Renews November 3, 2026');
    assert.equal(W.plan.trialEnds('2026-11-03'), 'Trial ends November 3, 2026');
    assert.equal(W.plan.scheduled('Target', null), 'Moves to Target at renewal.');
    assert.equal(W.plan.scheduled('Target', '2026-11-03'), 'Moves to Target on November 3, 2026.');
  });

  it('cannot infer a trial from the plan defaults or advertise a zero-day trial', () => {
    assert.equal(W.plan.trial(false, 90), 'Payment details collected in Stripe');
    assert.equal(W.plan.trial(true, null), 'Payment details collected in Stripe');
    assert.equal(W.plan.trial(true, 0), 'Payment details collected in Stripe');
    assert.equal(W.plan.trial(true, 14), "14-day trial — you add a payment method at checkout, and you're first charged when the trial ends.");
  });

  it('keeps coach/org cancellation meaning and retention values separate', () => {
    assert.equal(W.cancel.premiumDoor, 'Cancel Premium…');
    assert.equal(W.cancel.orgDoor('Riverdale'), 'Cancel and suspend Riverdale…');
    assert.equal(W.cancel.premiumConfirm, 'Cancel Premium');
    assert.equal(W.cancel.confirm, 'Cancel and suspend');
    assert.match(W.cancel.orgBody('Riverdale', ['Accounting', 'Families'], 90), /Accounting and Families go offline.*90 days.*within that time/);
    assert.match(W.cancel.premiumBody(365), /Basic tournament records stay available.*365 days/);
    assert.match(W.notice.premiumCancelled(365), /365 days/);
    assert.doesNotMatch(W.notice.premiumCancelled(365), /90 days|suspend/);
    assert.equal(W.cancel.archived(0), 'No tournament records need to be archived.');
    assert.equal(W.cancel.archived(1), '1 tournament moves into the archive until then.');
    assert.equal(W.cancel.archived(2), '2 tournaments move into the archive until then.');
    assert.match(W.cancel.accountingOffline, /ledgers, the club budget, allocations to teams/);
    assert.doesNotMatch(W.cancel.accountingOffline, /invoices|reconciliation/);
  });

  it('reports actual restore counts without promising restoration after retention or inventing a deadline', () => {
    assert.equal(W.notice.updated('Target'), 'Your plan is now Target.');
    assert.match(W.notice.updated('Target', 1, 2), /1 retained tournament restored.*2 retained tournaments remain/);
    assert.match(W.notice.updated('Target', 0, 1), /1 retained tournament remains in retention because it exceeds/);
    assert.equal(W.notice.downgraded('Target', 0, 90), 'Your plan is now Target.');
    assert.match(W.notice.downgraded('Target', 2, 90), /2 tournaments moved to retention for 90 days/);
    assert.match(W.reactivate.premiumBody(null), /during the retention window/);
    assert.doesNotMatch(W.reactivate.premiumBody(null), /until null|undefined/);
    assert.match(W.reactivate.premiumBody('2027-10-03'), /until October 3, 2027/);
    assert.match(W.reactivate.tournaments, /slot limit/);
    assert.equal(W.reactivate.title('Target'), 'Reactivate Target and restore your data');
  });

  it('retains Founding promises from config dates rather than copied calendar literals', () => {
    assert.equal(W.founding.price, `Free through ${FOUNDING_SEASON_END_LABEL}`);
    assert.equal(W.founding.priceHelp(PLAN_CONFIG.team.annualPrice), 'Normally $290 a year.');
    assert.match(W.notice.nextSeason, new RegExp(FOUNDING_SEASON_FIRST_CHARGE_LABEL));
    assert.match(W.notice.foundingCardSaved, new RegExp(FOUNDING_SEASON_END_LABEL));
    assert.match(W.founding.chosenBody(290, null), /290/);
    assert.doesNotMatch(W.founding.chosenBody(290, null), / to null|undefined/);
    assert.match(W.founding.chosenBody(290, 'Visa ••4242'), /to Visa ••4242/);
    assert.equal(W.founding.choiceLabel('Target', 'annual'), 'Target · yearly');
    assert.equal(W.founding.choose('Target', 'monthly'), 'Choose Target · monthly');
  });

  it('describes supported move/downgrade refusals with the applicable next step', () => {
    assert.equal(W.move.tooSmall('Target', 15, 'Riverdale', 16), 'Target holds 15 teams and Riverdale has 16 active. Archive 1 team first, then come back.');
    assert.match(W.move.down('Riverdale', 'Target', 15, null), /at your next renewal/);
    assert.match(W.move.downHelp('Current', '$219', 'monthly'), /no credit.*CAD \/ month/);
    assert.match(W.downgrade.capacity(1), /finished one stays online/);
    assert.equal(W.downgrade.capacity(9999), 'Unlimited tournaments.');
    assert.equal(W.downgrade.title('Target'), 'Downgrade to Target?');
    assert.equal(W.downgrade.reason, 'Why are you downgrading?');
    assert.match(W.downgrade.lost('Target', 'Current', ['branding', 'exports']), /branding and exports.*Saved branding is kept/);
    assert.match(W.downgrade.choose(1, 90), /Choose 1 tournament.*90 days/);
    assert.equal(W.errors.read('staff seats'), 'We couldn’t load staff seats. Try again.');
    assert.equal(W.change.details('Target'), 'See what Target includes');
  });
});
