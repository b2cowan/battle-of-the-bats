/**
 * Plans end at the renewal date, Stage 1 Part B — the screens. The owner's billing page while a cancel waits (the real shared
 * body, rendered), and the operator record's doors (read from source, like the console's other guards). The server half is
 * tests/unit/plan-ending.test.ts; the owner's request contracts are in plan-billing-actions.test.ts.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import { PLAN_BILLING_PROFILES, planCancellationImpact } from '../../lib/plan-billing-profile.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import { PLAN_BILLING_WORDS as W } from '../../lib/plan-billing-words.ts';
import type { BillingSnapshot, BillingRead, BillingEnding } from '../../lib/plan-billing-data.ts';
import type { BillingBodyViewProps } from '../../components/billing/BillingBody.tsx';
import type { OrgPlan } from '../../lib/types.ts';
import { readCode } from './_source-code.ts';

const { BillingBodyView } = billingTestLoader()('components/billing/BillingBody.tsx') as { BillingBodyView: ComponentType<BillingBodyViewProps> };
const ready = <T>(data: T): BillingRead<T> => ({ status: 'ready', data });
const ENDS = '2027-03-01T05:00:00Z';

function page(key: OrgPlan, ending: BillingEnding | null, canManageBilling = true): string {
  const profile = PLAN_BILLING_PROFILES[key];
  const snapshot: BillingSnapshot = {
    org: { id: 'org-a', slug: 'club-a', name: 'Falcons', planId: key, ownPlanId: key, enabledAddons: [], subscriptionStatus: 'active', subscriptionPeriod: 'monthly', currentPeriodEnd: ENDS, teamLimit: 15, tournamentLimit: 1 } as unknown as BillingSnapshot['org'],
    canManageBilling, usage: ready({ teams: { count: 9, limit: 15 }, tournament_slots: { count: 1, limit: 3 }, staff_seats: { count: 2, limit: 10 }, officials: 0 }),
    freeTime: ready({ freeTime: null, portal: null, foundingThrough: null, overLimitAfter: false }),
    founding: ready({ isFoundingSeason: false, compUntil: null }),
    gating: ready({ tournament: false, tournament_plus: false, team: false, league: false, club: false, club_large: false }),
    cancellation: ready({ currentPlan: key, ...planCancellationImpact(profile, [], 9), activeTeams: 9, activeTournamentCount: 0, tournaments: [], cancelled: null, ending }),
    move: ready({ live: true, scheduledMove: null }),
  };
  const noop = () => {};
  const actions = { busy: null, cycle: 'monthly' as const, setCycle: noop, portal: noop, card: noop, reactivate: noop, keep: noop, keepPlan: noop, cancel: noop, change: noop, details: noop, choose: noop, retry: noop };
  return renderToStaticMarkup(createElement(BillingBodyView, { snapshot, profile, ownProfile: profile, actions }))
    .replaceAll('&#x27;', "'").replaceAll('&amp;', '&');
}
const waiting = (endsAt = ENDS, heldMovePlan: OrgPlan | null = null): BillingEnding => ({ waits: true, endsOn: endsAt, pending: { endsAt, heldMovePlan } });
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe('the owner billing page while a cancel waits (Stage 0 rulings 1–3, 7)', () => {
  it('the plan card says Ending and the date, with Keep {Plan} as ONE lime button at every width; no renewal line', () => {
    const html = page('tournament_plus', waiting());
    assert.match(html, />Ending</);
    assert.match(html, /Ends on March 1, 2027, the last day you paid for\./);
    assert.equal(count(html, 'Keep Tournament Plus'), 2, 'the lime button and the change-plan line (the sentence-end link is gone)');
    assert.doesNotMatch(html, /Renews March/);
  });

  it('the change doors are ABSENT, prices stay readable, one line says why; Reduce or cancel is hidden', () => {
    const html = page('tournament_plus', waiting());
    assert.ok(html.includes(W.cancel.endingRefusal('tournament_plus', ENDS)));
    assert.doesNotMatch(html, /Downgrade to Tournament|Upgrade to|Move to |Contact us to move/);
    assert.ok(html.includes(PLAN_CONFIG.tournament.label) && html.includes('Free'), 'the table still reads');
    assert.doesNotMatch(html, /Reduce or cancel|billing-cancel-btn/);
  });

  it('a Premium coach sees the same line with Keep Premium, and no Start my club door', () => {
    const html = page('team', waiting());
    assert.match(html, /Ends on March 1, 2027/);
    assert.equal(count(html, 'Keep Premium'), 2);
    assert.ok(!html.includes(W.clubUpgrade.start));
  });

  it('a cheaper move the cancel set aside is named under the line (G1)', () => {
    const html = page('club_large', waiting(ENDS, 'club'));
    assert.match(html, /If you keep it, you renew as Club, the move you chose\./);
    assert.match(html, /Keep Club · Association/);
  });

  it('one date on the page for an evening-Eastern end (G4: …T02:00Z is the day before in Toronto)', () => {
    assert.match(page('tournament_plus', waiting('2027-03-01T02:00:00Z')), /Ends on February 28, 2027/);
  });

  it('a non-owner who types the URL sees the locked card and no Keep', () => {
    const html = page('tournament_plus', waiting(), false);
    assert.match(html, /Only Falcons’ owner/);
    assert.doesNotMatch(html, /Keep Tournament Plus|Ends on/);
  });
});

describe('Reduce or cancel before a cancel: words that are true at the click', () => {
  it('a paying plan says it ends on its date, and the door names the plan, not a suspension', () => {
    const html = page('tournament_plus', { waits: true, endsOn: ENDS, pending: null });
    assert.match(html, /Cancelling ends Falcons’ plan on March 1, 2027, the end of the period you paid for\./);
    assert.match(html, /Cancel Tournament Plus…/);
    assert.doesNotMatch(html, /Cancel and suspend|Cancelling suspends/);
  });
  it('no paid period: today’s immediate words stay (they are still true)', () => {
    assert.match(page('tournament_plus', { waits: false, endsOn: null, pending: null }), /Cancel and suspend Falcons…/);
  });
  it('a subscription with no date on record offers no door, rather than promising a date or saying "now"', () => {
    const html = page('tournament_plus', { waits: true, endsOn: null, pending: null });
    assert.match(html, /We couldn’t load the renewal date/);
    assert.doesNotMatch(html, /billing-cancel-btn/);
  });
});

describe('the Keep door and the wait callout (source)', () => {
  const css = readCode('components/billing/Billing.module.css');
  it('the lime button shows at every width (no sentence-end link); full width at the 44px tap floor on a phone', () => {
    assert.match(css, /\.keepButton\.keepButton \{ display: inline-flex;/);
    assert.doesNotMatch(css, /\.keepLink/);
    assert.match(css, /@media \(max-width: 640px\) \{\s*\.keepButton\.keepButton \{[^}]*width: 100%; min-height: var\(--tap-min, 44px\)/);
  });
  it('a wait is the white callout with an amber left edge — PageNotice gains no amber tone', () => {
    assert.match(css, /\.waitCallout \{[^}]*background: var\(--card-bg\);[^}]*border-left: 3px solid var\(--warning\)/);
    assert.doesNotMatch(readCode('components/shared/PageNotice.tsx'), /'warn'|amber/);
  });
});

describe('the operator record while a cancel waits (source)', () => {
  const record = readCode('app/platform-admin/orgs/[id]/ClubRecord.tsx');
  const page = readCode('app/platform-admin/orgs/[id]/page.tsx');
  const fn = (name: string) => {
    const start = record.indexOf(`function ${name}(`);
    assert.ok(start >= 0, name);
    return record.slice(start, record.indexOf('\n}\n', start));
  };
  it('the record reads the waiting cancel, and a failed read holds the Cancel door back instead of guessing', () => {
    assert.match(page, /readPendingEnding\(id\)/);
    assert.match(page, /endingReadFailed: waiting\.failed/);
    assert.match(record, /&& !props\.ending && !props\.endingReadFailed/);
  });
  it('the callout offers Keep and End now only to a billing operator', () => {
    assert.match(record, /\{can\.billing && \([\s\S]{0,200}kind: 'keepPlan'[\s\S]{0,200}kind: 'endPlanNow'/);
  });
  it('Cancel waits for the date and drops "cannot be put back"; End now is a quiet red link inside it', () => {
    const cancel = fn('CancelWindow');
    assert.match(cancel, /'Cancel at the period end'/);
    assert.match(cancel, /Reaches Stripe\. Can be kept until/);
    assert.match(cancel, /End it today instead…/);
    assert.match(cancel, /notifyOwner: notify/);
    assert.doesNotMatch(cancel, /askWhy=\{false\}/);
  });
  it('End now is its own red window, typed Why required, the ruled sentence, and the endNow flag', () => {
    const endNow = fn('EndPlanNowWindow');
    assert.match(endNow, /danger/);
    assert.match(endNow, /Ends immediately\. No refund\. This cannot be put back\./);
    assert.match(endNow, /endNow: true/);
    assert.match(endNow, /This finishes it today instead/);
    assert.doesNotMatch(endNow, /askWhy=\{false\}/);
  });
  it('Keep the plan withdraws through the console DELETE with a typed Why', () => {
    const keep = fn('KeepPlanWindow');
    assert.match(keep, /'DELETE', \{ reason, notifyOwner: notify \}/);
    // Part C (G6 b): the owner hears of an operator's keep only when ticked — off by default, like Cancel's tick.
    assert.match(keep, /useState\(false\)[\s\S]*Email the owner that the plan renews on/);
    assert.doesNotMatch(keep, /askWhy=\{false\}|danger/);
  });
  it('a mock subscription id is not said to reach Stripe (lead 8: the old `!!id` read a mock as real)', () => {
    assert.match(record, /hasStripe=\{!!org\.stripeSubscriptionId\?\.startsWith\('sub_'\)\}/);
    assert.doesNotMatch(record, /hasStripe=\{!!org\.stripeSubscriptionId\}/);
  });
  it('a trial says it ends with the trial, not "the period you paid for" (review)', () => {
    assert.match(W.cancel.waitBody('Falcons', ['the pay page'], ENDS, 30, true), /when your trial ends/);
    assert.doesNotMatch(W.cancel.waitBody('Falcons', ['the pay page'], ENDS, 30, true), /paid for/);
    assert.match(W.cancel.waitBody('Falcons', ['the pay page'], ENDS, 30), /the end of the period you paid for/);
    assert.match(W.cancel.premiumWaitBody(ENDS, 30, true), /when your trial ends/);
  });
  it('the operator hears about a move that could not be put back in staff words, not the owner’s (review)', () => {
    assert.doesNotMatch(W.cancel.moveNotRestoredStaff('Club', 'Tournament Plus', ENDS), /Your plan/);
    assert.match(W.cancel.moveNotRestoredStaff('Club', 'Tournament Plus', ENDS), /they can choose it again/);
    assert.match(readCode('app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts'), /moveNotRestoredStaff/);
  });
});
