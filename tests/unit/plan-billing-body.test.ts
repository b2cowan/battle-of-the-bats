import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import { PLAN_BILLING_PROFILES, PLAN_BILLING_DEFINITIONS, createPlanBillingRegistry, planCancellationImpact } from '../../lib/plan-billing-profile.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import { PLAN_BILLING_WORDS as W } from '../../lib/plan-billing-words.ts';
import type { BillingSnapshot, BillingRead, BillingFreeTime } from '../../lib/plan-billing-data.ts';
import type { BillingBodyViewProps } from '../../components/billing/BillingBody.tsx';
import { readCode } from './_source-code.ts';

const load = billingTestLoader();
const { BillingBodyView, billingReturnState } = load('components/billing/BillingBody.tsx') as {
  BillingBodyView: ComponentType<BillingBodyViewProps>;
  billingReturnState: (search: string, billingBase: string, showFounding: boolean) => { justChose: boolean; detail: string | null; notice: { text: string } | null; consumed: boolean; destination: string };
};
const ready = <T>(data: T): BillingRead<T> => ({ status: 'ready', data });
function fixture(key: keyof typeof PLAN_CONFIG): BillingBodyViewProps {
  const profile = PLAN_BILLING_PROFILES[key];
  const impact = planCancellationImpact(profile, ['module_public_site'], 9);
  const snapshot: BillingSnapshot = {
    org: { id: 'org-a', slug: 'club-a', name: 'Falcons', planId: key, ownPlanId: key, enabledAddons: ['module_public_site'], subscriptionStatus: 'active', subscriptionPeriod: 'monthly', currentPeriodEnd: '2027-03-01', teamLimit: 15, tournamentLimit: 1 } as BillingSnapshot['org'],
    isOwner: true, usage: ready({ teams: { count: 9, limit: 15 }, tournament_slots: { count: 1, limit: 1 }, staff_seats: { count: 2, limit: profile.config.seatLimit }, officials: 4 }),
    freeTime: ready({ freeTime: null, portal: null, foundingThrough: null, overLimitAfter: false }),
    founding: ready({ isFoundingSeason: false, compUntil: null }),
    gating: ready({ tournament: false, tournament_plus: false, team: false, league: true, club: true, club_large: true }),
    cancellation: ready({ currentPlan: key, ...impact, activeTeams: 9, activeTournamentCount: 0, tournaments: [], cancelled: null }),
    move: ready({ live: false, scheduledMove: null }),
  };
  return { snapshot, profile, ownProfile: profile, actions: { busy: null, cycle: 'monthly', setCycle() {}, portal() {}, card() {}, reactivate() {}, keep() {}, cancel() {}, change() {}, details() {}, choose() {}, retry() {} }, fees: createElement('div', { 'data-fees': true }, 'Stripe fees fixture') };
}
const html = (props: BillingBodyViewProps) => renderToStaticMarkup(createElement(BillingBodyView, props)).replaceAll('&#x27;', "'").replaceAll('&amp;', '&');
const body = readCode('components/billing/BillingBody.tsx');

describe('the real shared billing body renders every profile', () => {
  for (const key of Object.keys(PLAN_CONFIG) as (keyof typeof PLAN_CONFIG)[]) {
    it(`${key}: owner gets its own price, included variant, usage and ordered sections`, () => {
      const props = fixture(key), rendered = html(props);
      assert.ok(rendered.includes(props.profile.config.label));
      for (const item of props.profile.included.billing) assert.ok(rendered.includes(item), item);
      const order = ['Your plan', "What's in use", 'Stripe fees fixture', "What's included"];
      for (const item of order) assert.ok(rendered.includes(item), `Missing section: ${item}`);
      for (let i = 1; i < order.length; i++) assert.ok(rendered.indexOf(order[i - 1]) < rendered.indexOf(order[i]), order.join(' → '));
      if (props.profile.changes.length) assert.ok(rendered.indexOf('Change plan') < rendered.indexOf("What's included"));
      if (key === 'club' || key === 'club_large') assert.match(rendered, /9 of 15 teams/);
      if (key === 'tournament_plus') { assert.match(rendered, /2 staff seats · unlimited/); assert.match(rendered, /Contact us to move/); }
    });
    for (const state of ['active', 'canceled', 'past_due', 'trialing'] as const) it(`${key}/${state}: non-owner gets no billing facts or actions`, () => {
      const props = fixture(key); props.snapshot.isOwner = false; props.snapshot.org.subscriptionStatus = state;
      const rendered = html(props);
      assert.match(rendered, /Only Falcons’ owner/);
      assert.doesNotMatch(rendered, /Stripe fees fixture|billing-manage-btn|billing-reactivate-btn|<button|<a |9 of 15|CAD/);
    });
  }
  it('an isolated extra profile renders its own facts with no component edit or production mutation', () => {
    const configs = { ...PLAN_CONFIG, future: { ...PLAN_CONFIG.club, label: 'Future fixture', monthlyPrice: 123, annualPrice: 1230 } };
    const registry = createPlanBillingRegistry<keyof typeof configs>(configs, { ...PLAN_BILLING_DEFINITIONS, future: { ...PLAN_BILLING_DEFINITIONS.club, changes: [], included: { billing: ['Only the future billing feature'], article: ['Only the future article feature'] } } });
    const props = fixture('club'); props.profile = registry.future; props.ownProfile = registry.future; props.profiles = registry;
    const rendered = html(props);
    assert.match(rendered, /Future fixture/); assert.match(rendered, /123 CAD \/ month/); assert.match(rendered, /Only the future billing feature/);
    assert.doesNotMatch(rendered, /Only the future article feature/); assert.equal(PLAN_CONFIG.club.label, 'Club');
  });
});

describe('billing state distinctions in the rendered body', () => {
  for (const key of ['club', 'team', 'tournament_plus', 'tournament'] as const) {
    for (const status of ['active', 'canceled'] as const) it(`${key}/${status}: failed free-time reads offer retry and help without asserting billing facts`, () => {
      const props = fixture(key);
      props.snapshot.org.subscriptionStatus = status;
      props.snapshot.freeTime = { status: 'error', error: '503' };
      const rendered = html(props);
      assert.match(rendered, /Billing status unavailable/);
      assert.match(rendered, /Try again/);
      assert.match(rendered, /href="mailto:fieldlogichq@gmail.com"/);
      assert.doesNotMatch(rendered, /Loading|Renews|Cancelled|Canceled|Reactivate|Keep Premium|data is kept|CAD|billing-manage-btn|billing-cancel-btn|toneGood/);
    });
  }
  it('a Founding read failure cannot suppress cancellation recovery or ended-portal Keep Premium', () => {
    for (const key of ['team', 'tournament_plus'] as const) {
      const props = fixture(key);
      props.snapshot.org.subscriptionStatus = 'canceled';
      props.snapshot.founding = { status: 'error', error: '503' };
      assert.match(html(props), /billing-reactivate-btn/);
      assert.doesNotMatch(html(props), /Renews|Loading/);
      if (key === 'team') {
        props.snapshot.freeTime = ready({ freeTime: null, portal: { state: 'ended', lastDay: '2027-03-31' }, foundingThrough: null, overLimitAfter: false });
        assert.match(html(props), /billing-keep-premium/);
        assert.doesNotMatch(html(props), /billing-reactivate-btn|data is kept/);
      }
    }
  });
  it('a known running staff grant stored cancelled stays free time, including when Founding fails', () => {
    const props = fixture('club');
    props.snapshot.org.subscriptionStatus = 'canceled';
    props.snapshot.founding = { status: 'error', error: '503' };
    props.snapshot.freeTime = ready({ freeTime: { state: 'running', plan: 'club', ownPlan: 'tournament_plus', lastDay: '2027-03-31', daysLeft: 40 }, portal: null, foundingThrough: null, overLimitAfter: false });
    assert.match(html(props), /Free through March 31, 2027/);
    assert.doesNotMatch(html(props), /billing-reactivate-btn|data is kept|Renews|Canceled|Cancelled/);
  });
  it('unavailable sale gates keep a contact door, including cancelled free Tournament', () => {
    for (const key of ['club', 'tournament_plus', 'tournament'] as const) {
      const props = fixture(key);
      props.snapshot.gating = { status: 'error', error: '503' };
      assert.match(html(props), /Contact us to move/);
      props.snapshot.org.subscriptionStatus = 'canceled';
      assert.match(html(props), /href="mailto:fieldlogichq@gmail.com"[^>]*>Contact us to reactivate/);
      assert.doesNotMatch(html(props), /<button[^>]*id="billing-reactivate-btn"/);
      if (key === 'tournament') {
        props.snapshot.gating = ready({ tournament: false });
        assert.match(html(props), /Contact us to reactivate/);
        assert.doesNotMatch(html(props), /Reactivate Tournament<\/button>/);
      }
    }
  });
  it('restores all three team helpers with profile-derived limits', () => {
    const props = fixture('club');
    assert.ok(html(props).includes(W.usage.growingTeams(PLAN_CONFIG.club.label, PLAN_CONFIG.club.teamLimit, PLAN_CONFIG.club_large.label, PLAN_CONFIG.club_large.teamLimit)));
    const largest = fixture('club_large');
    largest.snapshot.usage = ready({ teams: { count: 9, limit: PLAN_CONFIG.club_large.teamLimit }, tournament_slots: { count: 0, limit: 1 }, staff_seats: { count: 1, limit: 1 }, officials: 0 });
    assert.ok(html(largest).includes(W.usage.largestTeams(PLAN_CONFIG.club_large.label, PLAN_CONFIG.club_large.teamLimit)));
    props.snapshot.freeTime = ready({ freeTime: { state: 'running', plan: 'club', ownPlan: 'tournament_plus', lastDay: '2027-03-31', daysLeft: 40 }, portal: null, foundingThrough: null, overLimitAfter: false });
    assert.ok(html(props).includes(W.usage.freeTeams(PLAN_CONFIG.club.label)));
  });
  it('the Holds column describes capacity rather than repeating a usage count', () => {
    const rendered = html(fixture('tournament_plus'));
    assert.match(rendered, /data-label="Holds">1 tournament at a time<\/td>/);
    assert.doesNotMatch(rendered, /data-label="Holds">1 of 1/);
  });
  it('Stripe return flags consume once, preserve the drawer and use either host return base', () => {
    for (const host of ['/club-a/admin/org/billing', '/future-host/billing']) {
      for (const flag of ['success', 'card_saved', 'next_season']) {
        const result = billingReturnState(`${flag}=1&plan=club_large&other=kept`, host, true);
        assert.equal(result.destination, `${host}?plan=club_large&other=kept`); assert.equal(result.detail, 'club_large'); assert.ok(result.notice);
        assert.equal(result.justChose, flag === 'next_season');
        const second = billingReturnState(result.destination.split('?')[1], host, true); assert.equal(second.consumed, false); assert.equal(second.notice, null);
      }
    }
    for (const key of ['constructor', '__proto__', 'unknown']) assert.equal(billingReturnState(`plan=${key}`, '/billing', true).detail, null);
    assert.doesNotMatch(billingReturnState('next_season=1', '/billing', false).notice!.text, /Founding/);
  });
  it('the actual existing details drawer uses the Association profile price/name and article variant', () => {
    const { default: Panel } = load('components/billing/PlanArticlePanel.tsx') as { default: ComponentType<Record<string, unknown>> };
    const rendered = renderToStaticMarkup(createElement(Panel, { planKey: null, profile: PLAN_BILLING_PROFILES.club_large, billingCycle: 'monthly', onClose() {}, onUpgrade() {}, upgradeLoading: null, isComingSoon: true, canUpgrade: false, foundingOfferHeld: false }));
    assert.match(rendered, /Club · Association/); assert.match(rendered, /379 CAD \/ month/); assert.doesNotMatch(rendered, /219 CAD \/ month/);
    assert.ok(rendered.includes(PLAN_BILLING_PROFILES.club_large.included.article[0]));
  });
  it('the actual fees component omits its section until a fee has been read', () => {
    const { default: Fees } = load('components/billing/StripeFeesList.tsx') as { default: ComponentType<{ slug: string }> };
    assert.equal(renderToStaticMarkup(createElement(Fees, { slug: 'club-a' })), '');
  });
  it('loading and unavailable counts never render invented zeroes', () => {
    const props = fixture('club'); props.snapshot.usage = { status: 'loading' };
    assert.match(html(props), /Loading billing usage/); assert.doesNotMatch(html(props), /0 of 15 teams/);
    props.snapshot.usage = { status: 'error', error: 'No connection' };
    assert.match(html(props), /couldn’t load billing usage/); assert.doesNotMatch(html(props), /0 of 15 teams/);
  });
  for (const state of ['running', 'ending', 'ended'] as const) it(`organization free time ${state}: controls and contact door match the state`, () => {
    const props = fixture('club');
    props.snapshot.freeTime = ready({ freeTime: state === 'ended' ? { state, plan: 'club', ownPlan: 'tournament_plus', lastDay: '2027-03-31' } : { state, plan: 'club', ownPlan: 'tournament_plus', lastDay: '2027-03-31', daysLeft: state === 'running' ? 40 : 9 }, portal: null, foundingThrough: 'September 30, 2027', overLimitAfter: false });
    props.snapshot.founding = ready({ isFoundingSeason: true, compUntil: '2027-09-30' });
    const rendered = html(props); assert.doesNotMatch(rendered, /[Ff]ounding/);
    if (state !== 'ended') assert.doesNotMatch(rendered, /billing-manage-btn|billing-cancel-btn|Move to/);
    else assert.match(rendered, /billing-manage-btn/);
    if (state === 'ending') {
      props.snapshot.gating = ready({ club: false });
      assert.match(html(props), /To keep Club, contact us\./); assert.match(html(props), /href="mailto:fieldlogichq@gmail.com"/);
    }
  });
  for (const state of ['running', 'ending', 'ended'] as const) it(`coach free time ${state}: Keep Premium stays attached to the same portal, with no retention`, () => {
    const props = fixture('team');
    const portal: NonNullable<BillingFreeTime['portal']> = state === 'ended' ? { state, lastDay: '2027-03-31' } : { state, lastDay: '2027-03-31', daysLeft: state === 'running' ? 40 : 9 };
    props.snapshot.freeTime = ready({ freeTime: null, portal, foundingThrough: null, overLimitAfter: false }); props.snapshot.org.subscriptionStatus = state === 'ended' ? 'canceled' : 'active';
    const rendered = html(props);
    assert.match(rendered, /billing-keep-premium/); assert.match(rendered, /reactivateOrgSlug=club-a/); assert.match(rendered, /keep=1/);
    assert.match(rendered, /btn btn-outline[^>]*>Join a club/);
    assert.doesNotMatch(rendered, /billing-manage-btn|billing-cancel-btn|billing-reactivate-btn|data is kept for|Host one tournament at a time/);
    if (state !== 'ended') assert.ok(rendered.includes(W.portalFreeTime(portal).billingCard!));
  });
  it('cancelled owners see bounded restoration and fees below reactivation', () => {
    for (const key of ['team', 'club'] as const) {
      const props = fixture(key); props.snapshot.org.subscriptionStatus = 'canceled';
      const rendered = html(props);
      assert.match(rendered, key === 'team' ? /365 days/ : /90 days/);
      assert.doesNotMatch(rendered, /everything comes back|brings it all back/);
      assert.ok(rendered.indexOf('billing-reactivate-btn') < rendered.indexOf('Stripe fees fixture'));
      if (key === 'team') {
        assert.match(rendered, /Basic tournament records stay available/);
        assert.ok(rendered.includes(W.reactivate.basicTitle));
        assert.ok(rendered.includes(W.reactivate.basicBody));
        assert.match(rendered, /href="\/coaches\/tournaments"[^>]*>Open tournament records/);
      }
      else assert.match(rendered, /remain in retention/);
    }
  });
  it('legitimate comp uses annual config helper, and the checkout return suppresses a stale chooser', () => {
    const props = fixture('tournament_plus'); props.snapshot.founding = ready({ isFoundingSeason: true, compUntil: '2027-09-30' }); props.foundingActive = true; props.cardWindowOpen = true;
    assert.match(html(props), /Normally \$390 a year\./); assert.match(html(props), /Choose your/);
    props.justChose = true; assert.doesNotMatch(html(props), /Choose your|If you choose nothing/);
  });
  it('the scheduled move keeps its Keep action and actual target', () => {
    const props = fixture('club_large'); props.snapshot.move = ready({ live: true, scheduledMove: { toPlan: 'club', effectiveAt: '2027-03-01' } });
    assert.match(html(props), /Moves to Club on March 1, 2027/); assert.match(html(props), /Keep Club · Association/);
  });
  it('past due and actual trial dates render without an invented trial promise', () => {
    const props = fixture('club'); props.snapshot.org.subscriptionStatus = 'past_due'; assert.match(html(props), /last payment didn’t go through/);
    props.snapshot.org.subscriptionStatus = 'trialing'; assert.match(html(props), /Trial ends March 1, 2027/); assert.doesNotMatch(html(props), /0-day trial|add a card at checkout/);
  });
  it('no card on file and a chosen next season retain honest card/price display', () => {
    const props = fixture('team'); props.cardWindowOpen = true; props.foundingActive = true;
    props.snapshot.founding = ready({ isFoundingSeason: true, compUntil: '2027-09-30', card: null });
    assert.match(html(props), /No payment method on file yet/);
    props.snapshot.founding = ready({ isFoundingSeason: true, compUntil: '2027-09-30', card: { savedAt: '2026-10-28', brand: 'visa', last4: '4242' }, nextSeason: { planKey: 'team', billingCycle: 'annual', chosenAt: '2026-10-28' } });
    const rendered = html(props); assert.match(rendered, /4242/); assert.match(rendered, /290/); assert.doesNotMatch(rendered, /Choose your/);
  });
  it('short cancellation programs come from preflight, including its real team count and add-ons', () => {
    const props = fixture('club'); assert.match(html(props), /Rep teams and every team’s coach portal \(9 teams\)/);
    assert.doesNotMatch(html(props), /invoices and reconciliation/);
  });
  it('requires neutral implementation, supported dispatch and host-supplied billing destinations', () => {
    assert.doesNotMatch(body, /AdminPageHeader|ClubKit\.module|\bck\.|useTournament\(|useClubBrief\(|FeedbackModal|router\.push|\/admin\/org\/billing|\/admin\/rep-teams/);
    assert.match(body, /ownProfile\.changes/); assert.match(body, /change\.mechanism === 'move'/); assert.match(body, /change\.mechanism === 'downgrade'/);
    assert.match(body, /returnTo: billingBase/); assert.match(body, /returnTo=\{billingBase\}/);
    assert.match(body, /query\.delete\(flag\)/); assert.match(body, /query\.size/); assert.match(body, /setJustChose\(true\)/);
    assert.match(body, /key=\{currentOrg\.id\}/); assert.match(body, /read\?\.identity === identity/); assert.match(body, /abort\.signal\.aborted/);
    const window = readCode('components/billing/PlanMoveDialog.tsx'); assert.doesNotMatch(window, /\/admin\//); assert.match(window, /returnTo,/);
  });
});
