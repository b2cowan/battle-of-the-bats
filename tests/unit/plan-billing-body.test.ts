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
  billingReturnState: (search: string, billingBase: string) => { detail: string | null; notice: { text: string } | null; consumed: boolean; destination: string };
};
const ready = <T>(data: T): BillingRead<T> => ({ status: 'ready', data });
function fixture(key: keyof typeof PLAN_CONFIG): BillingBodyViewProps {
  const profile = PLAN_BILLING_PROFILES[key];
  const impact = planCancellationImpact(profile, ['module_public_site'], 9);
  const snapshot: BillingSnapshot = {
    org: { id: 'org-a', slug: 'club-a', name: 'Falcons', planId: key, ownPlanId: key, enabledAddons: ['module_public_site'], subscriptionStatus: 'active', subscriptionPeriod: 'monthly', currentPeriodEnd: '2027-03-01', teamLimit: 15, tournamentLimit: 1 } as BillingSnapshot['org'],
    canManageBilling: true, usage: ready({ teams: { count: 9, limit: 15 }, tournament_slots: { count: 1, limit: 1 }, staff_seats: { count: 2, limit: profile.config.seatLimit }, officials: 4 }),
    freeTime: ready({ freeTime: null, portal: null, overLimitAfter: false }),
    gating: ready({ tournament: false, tournament_plus: false, team: false, league: true, club: true, club_large: true }),
    cancellation: ready({ currentPlan: key, ...impact, activeTeams: 9, activeTournamentCount: 0, tournaments: [], cancelled: null }),
    move: ready({ live: false, scheduledMove: null }),
  };
  return { snapshot, profile, ownProfile: profile, actions: { busy: null, cycle: 'monthly', setCycle() {}, portal() {}, reactivate() {}, keep() {}, keepPlan() {}, cancel() {}, change() {}, details() {}, retry() {} } };
}
const html = (props: BillingBodyViewProps) => renderToStaticMarkup(createElement(BillingBodyView, props)).replaceAll('&#x27;', "'").replaceAll('&amp;', '&');
const body = readCode('components/billing/BillingBody.tsx');

describe('the real shared billing body renders every profile', () => {
  for (const key of Object.keys(PLAN_CONFIG) as (keyof typeof PLAN_CONFIG)[]) {
    it(`${key}: owner gets its own price, included variant, usage and ordered sections`, () => {
      const props = fixture(key), rendered = html(props);
      assert.ok(rendered.includes(props.profile.config.label));
      for (const item of props.profile.included.billing) assert.ok(rendered.includes(item), item);
      // A7 (Settings in both workspaces Session 1): Premium's card is one column — no "What's in use", no staff seats.
      const order = props.profile.usageLine ? ['Your plan', '1 of 1 tournament slot in use', "What's included"] : ['Your plan', "What's in use", "What's included"];
      if (props.profile.usageLine) { assert.doesNotMatch(rendered, /What's in use|staff seat|role="meter"/); }
      for (const item of order) assert.ok(rendered.includes(item), `Missing section: ${item}`);
      for (let i = 1; i < order.length; i++) assert.ok(rendered.indexOf(order[i - 1]) < rendered.indexOf(order[i]), order.join(' → '));
      if (props.profile.changes.length) assert.ok(rendered.indexOf('Change plan') < rendered.indexOf("What's included"));
      if (key === 'club' || key === 'club_large') assert.match(rendered, /9 of 15 teams/);
      // On-sale pages S4 (call 36): a closed move row reads as a closed start — "Coming soon" on the name, "Contact us".
      if (key === 'tournament_plus') {
        assert.match(rendered, /2 staff seats · unlimited/);
        assert.match(rendered, /<strong>Club<\/strong><span class="chip chipQuiet">Coming soon<\/span>/);
        assert.match(rendered, /moveDoor" href="mailto:support@fieldlogichq\.ca">Contact us<\/a>/);
        assert.doesNotMatch(rendered, /Contact us to move/);
      }
    });
    for (const state of ['active', 'canceled', 'past_due', 'trialing'] as const) it(`${key}/${state}: non-owner gets no billing facts or actions`, () => {
      const props = fixture(key); props.snapshot.canManageBilling = false; props.snapshot.org.subscriptionStatus = state;
      const rendered = html(props);
      assert.match(rendered, /Only Falcons’ owner/);
      assert.doesNotMatch(rendered, /billing-manage-btn|billing-reactivate-btn|<button|<a |9 of 15|CAD/);
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
  for (const state of ['running', 'ending'] as const) it(`${state}: staff-given Premium free time retains the identical Club door and sale gate`, () => {
    const props = fixture('team');
    props.snapshot.org.subscriptionStatus = 'canceled';
    props.snapshot.freeTime = ready({ freeTime: null, portal: { state, lastDay: '2026-12-31', daysLeft: 10 }, overLimitAfter: false });
    props.snapshot.gating = ready({ club: false });
    assert.ok(html(props).includes(W.clubUpgrade.start));
    assert.ok(html(props).includes(W.change.details(PLAN_CONFIG.club.label)));
    assert.ok(!html(props).includes(PLAN_CONFIG.club_large.label));
    props.snapshot.gating = ready({ club: true });
    assert.ok(html(props).includes(W.change.contactMove));
    assert.ok(!html(props).includes(W.clubUpgrade.start));
    props.snapshot.canManageBilling = false;
    assert.ok(!html(props).includes(W.clubUpgrade.start));
  });
  it('staff free time hides upgrade purchases even when the underlying own plan is free', () => {
    const props = fixture('tournament');
    props.snapshot.freeTime = ready({ freeTime: { state: 'running', plan: 'club', ownPlan: 'tournament', lastDay: '2027-03-31', daysLeft: 40 }, portal: null, overLimitAfter: false });
    const rendered = html(props);
    assert.doesNotMatch(rendered, /Upgrade to|billing-manage-btn|billing-cancel-btn|<select|Move to/);
  });
  it('choosing an upgrade cycle does not change the current paid plan’s displayed price', () => {
    const props = fixture('tournament_plus'); props.actions.cycle = 'annual';
    assert.ok(html(props).includes(W.plan.price(props.profile.config.monthlyPrice, 'monthly')));
    assert.ok(!html(props).includes(`${props.profile.config.annualPrice} CAD / year`));
  });
  for (const key of ['club', 'team', 'tournament_plus', 'tournament'] as const) {
    for (const status of ['active', 'canceled'] as const) it(`${key}/${status}: failed free-time reads offer retry and help without asserting billing facts`, () => {
      const props = fixture(key);
      props.snapshot.org.subscriptionStatus = status;
      props.snapshot.freeTime = { status: 'error', error: '503' };
      const rendered = html(props);
      assert.match(rendered, /Billing status unavailable/);
      assert.match(rendered, /Try again/);
      assert.match(rendered, /href="mailto:support@fieldlogichq\.ca"/);
      assert.doesNotMatch(rendered, /Loading|Renews|Cancelled|Canceled|Reactivate|Keep Premium|data is kept|CAD|billing-manage-btn|billing-cancel-btn|toneGood/);
    });
  }
  it('a cancelled workspace still offers reactivation, and an ended coach portal still offers Keep Premium', () => {
    for (const key of ['team', 'tournament_plus'] as const) {
      const props = fixture(key);
      props.snapshot.org.subscriptionStatus = 'canceled';
      assert.match(html(props), /billing-reactivate-btn/);
      assert.doesNotMatch(html(props), /Renews|Loading/);
      if (key === 'team') {
        props.snapshot.freeTime = ready({ freeTime: null, portal: { state: 'ended', lastDay: '2027-03-31' }, overLimitAfter: false });
        assert.match(html(props), /billing-keep-premium/);
        assert.doesNotMatch(html(props), /billing-reactivate-btn|data is kept/);
      }
    }
  });
  it('a known running staff grant stored cancelled stays free time', () => {
    const props = fixture('club');
    props.snapshot.org.subscriptionStatus = 'canceled';
    props.snapshot.freeTime = ready({ freeTime: { state: 'running', plan: 'club', ownPlan: 'tournament_plus', lastDay: '2027-03-31', daysLeft: 40 }, portal: null, overLimitAfter: false });
    assert.match(html(props), /Free through March 31, 2027/);
    assert.doesNotMatch(html(props), /billing-reactivate-btn|data is kept|Renews|Canceled|Cancelled/);
  });
  it('unavailable sale gates keep a contact door, including cancelled free Tournament', () => {
    for (const key of ['club', 'tournament_plus', 'tournament'] as const) {
      const props = fixture(key);
      props.snapshot.gating = { status: 'error', error: '503' };
      // A failed gate read counts as closed (On-sale pages S4): the tag and the contact door, never a start.
      assert.match(html(props), /Coming soon<\/span>/);
      assert.match(html(props), /moveDoor" href="mailto:support@fieldlogichq\.ca">Contact us<\/a>/);
      props.snapshot.org.subscriptionStatus = 'canceled';
      assert.match(html(props), /href="mailto:support@fieldlogichq\.ca"[^>]*>Contact us to reactivate/);
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
    props.snapshot.freeTime = ready({ freeTime: { state: 'running', plan: 'club', ownPlan: 'tournament_plus', lastDay: '2027-03-31', daysLeft: 40 }, portal: null, overLimitAfter: false });
    assert.ok(html(props).includes(W.usage.freeTeams(PLAN_CONFIG.club.label)));
  });
  it('the Holds column describes capacity rather than repeating a usage count', () => {
    const rendered = html(fixture('tournament_plus'));
    assert.match(rendered, /data-label="Holds">1 tournament at a time<\/td>/);
    assert.doesNotMatch(rendered, /data-label="Holds">1 of 1/);
  });
  it('Stripe return flags consume once, preserve the drawer and use either host return base', () => {
    assert.equal(billingReturnState('success=1&inPlace=club', '/billing').destination, '/billing?inPlace=club');
    for (const host of ['/club-a/admin/org/billing', '/future-host/billing']) {
      for (const flag of ['success', 'card_saved']) {
        const result = billingReturnState(`${flag}=1&plan=club_large&other=kept`, host);
        assert.equal(result.destination, `${host}?plan=club_large&other=kept`); assert.equal(result.detail, 'club_large'); assert.ok(result.notice);
        const second = billingReturnState(result.destination.split('?')[1], host); assert.equal(second.consumed, false); assert.equal(second.notice, null);
      }
    }
    for (const key of ['constructor', '__proto__', 'unknown']) assert.equal(billingReturnState(`plan=${key}`, '/billing').detail, null);
    assert.equal(billingReturnState('next_season=1', '/billing').notice, null, 'the old next-season return flag is no longer read');
  });
  it('the actual existing details drawer uses the Association profile price/name and article variant', () => {
    const { default: Panel } = load('components/billing/PlanArticlePanel.tsx') as { default: ComponentType<Record<string, unknown>> };
    const rendered = renderToStaticMarkup(createElement(Panel, { planKey: null, profile: PLAN_BILLING_PROFILES.club_large, billingCycle: 'monthly', onClose() {}, onUpgrade() {}, upgradeLoading: null, isComingSoon: true, canUpgrade: false }));
    assert.match(rendered, /Club · Association/); assert.match(rendered, /379 CAD \/ month/); assert.doesNotMatch(rendered, /219 CAD \/ month/);
    assert.ok(rendered.includes(PLAN_BILLING_PROFILES.club_large.included.article[0]));
  });
  it('loading and unavailable counts never render invented zeroes', () => {
    const props = fixture('club'); props.snapshot.usage = { status: 'loading' };
    assert.match(html(props), /Loading billing usage/); assert.doesNotMatch(html(props), /0 of 15 teams/);
    props.snapshot.usage = { status: 'error', error: 'No connection' };
    assert.match(html(props), /couldn’t load billing usage/); assert.doesNotMatch(html(props), /0 of 15 teams/);
  });
  for (const state of ['running', 'ending', 'ended'] as const) it(`organization free time ${state}: controls and contact door match the state`, () => {
    const props = fixture('club');
    props.snapshot.freeTime = ready({ freeTime: state === 'ended' ? { state, plan: 'club', ownPlan: 'tournament_plus', lastDay: '2027-03-31' } : { state, plan: 'club', ownPlan: 'tournament_plus', lastDay: '2027-03-31', daysLeft: state === 'running' ? 40 : 9 }, portal: null, overLimitAfter: false });
    const rendered = html(props); assert.doesNotMatch(rendered, /[Ff]ounding/);
    if (state !== 'ended') assert.doesNotMatch(rendered, /billing-manage-btn|billing-cancel-btn|Move to/);
    else assert.match(rendered, /billing-manage-btn/);
    if (state === 'ending') {
      props.snapshot.gating = ready({ club: false });
      assert.match(html(props), /To keep Club, contact us\./); assert.match(html(props), /href="mailto:support@fieldlogichq\.ca"/);
    }
  });
  for (const state of ['running', 'ending', 'ended'] as const) it(`coach free time ${state}: Keep Premium stays attached to the same portal, with no retention`, () => {
    const props = fixture('team');
    props.snapshot.gating = ready({ team: false, club: false }); // "Join a club" shows only while Club is open (ruling (c), 2026-11-19)
    const portal: NonNullable<BillingFreeTime['portal']> = state === 'ended' ? { state, lastDay: '2027-03-31' } : { state, lastDay: '2027-03-31', daysLeft: state === 'running' ? 40 : 9 };
    props.snapshot.freeTime = ready({ freeTime: null, portal, overLimitAfter: false }); props.snapshot.org.subscriptionStatus = state === 'ended' ? 'canceled' : 'active';
    const rendered = html(props);
    assert.match(rendered, /billing-keep-premium/); assert.match(rendered, /reactivateOrgSlug=club-a/); assert.match(rendered, /keep=1/);
    assert.match(rendered, /btn btn-outline[^>]*>Join a club/);
    assert.doesNotMatch(rendered, /billing-manage-btn|billing-cancel-btn|billing-reactivate-btn|data is kept for|Host one tournament at a time/);
    if (state !== 'ended') assert.ok(rendered.includes(W.portalFreeTime(portal).billingCard!));
  });
  it('cancelled owners see bounded restoration below reactivation', () => {
    for (const key of ['team', 'club'] as const) {
      const props = fixture(key); props.snapshot.org.subscriptionStatus = 'canceled';
      const rendered = html(props);
      assert.match(rendered, key === 'team' ? /365 days/ : /90 days/);
      assert.doesNotMatch(rendered, /everything comes back|brings it all back/);
      if (key === 'team') {
        assert.match(rendered, /Basic tournament records stay available/);
        assert.ok(rendered.includes(W.reactivate.basicTitle));
        assert.ok(rendered.includes(W.reactivate.basicBody));
        assert.match(rendered, /href="\/coaches\/tournaments"[^>]*>Open tournament records/);
      }
      else assert.match(rendered, /remain in retention/);
    }
  });
  it('the scheduled move keeps its Keep action and actual target', () => {
    const props = fixture('club_large'); props.snapshot.move = ready({ live: true, scheduledMove: { toPlan: 'club', effectiveAt: '2027-03-01' } });
    assert.match(html(props), /Moves to Club on March 1, 2027/); assert.match(html(props), /Keep Club · Association/);
  });
  it('past due and actual trial dates render without an invented trial promise', () => {
    const props = fixture('club'); props.snapshot.org.subscriptionStatus = 'past_due'; assert.match(html(props), /last payment didn’t go through/);
    props.snapshot.org.subscriptionStatus = 'trialing'; assert.match(html(props), /Trial ends March 1, 2027/); assert.doesNotMatch(html(props), /0-day trial|add a card at checkout/);
  });
  it('short cancellation programs come from preflight, including its real team count and add-ons', () => {
    const props = fixture('club'); assert.match(html(props), /Rep teams and every team’s coach portal \(9 teams\)/);
    assert.doesNotMatch(html(props), /invoices and reconciliation/);
  });
  it('requires neutral implementation, supported dispatch and host-supplied billing destinations', () => {
    assert.doesNotMatch(body, /AdminPageHeader|ClubKit\.module|\bck\.|useTournament\(|useClubBrief\(|FeedbackModal|router\.push|\/admin\/org\/billing|\/admin\/rep-teams/);
    assert.match(body, /ownProfile\.changes/); assert.match(body, /change\.mechanism === 'move'/); assert.match(body, /change\.mechanism === 'downgrade'/);
    assert.match(body, /returnTo: billingBase/); assert.match(body, /returnTo=\{billingBase\}/);
    assert.match(body, /query\.delete\(flag\)/); assert.match(body, /query\.size/);    assert.match(body, /key=\{currentOrg\.id\}/); assert.match(body, /read\?\.identity === identity/); assert.match(body, /abort\.signal\.aborted/);
    const window = readCode('components/billing/PlanMoveDialog.tsx'); assert.doesNotMatch(window, /\/admin\//); assert.match(window, /returnTo,/);
  });
});

describe('the failed-payment line gains the shipped door', () => {
  const withStatus = (status: string, busy: string | null = null) => {
    const props = fixture('club'); props.snapshot.org.subscriptionStatus = status as typeof props.snapshot.org.subscriptionStatus; props.actions.busy = busy as typeof props.actions.busy;
    return props;
  };
  it('today’s sentence stays word for word, red-edged, with Payment method & invoices beside it', () => {
    const rendered = html(withStatus('past_due'));
    assert.ok(rendered.includes(W.plan.pastDue));
    const callout = rendered.slice(rendered.lastIndexOf('<div', rendered.indexOf(W.plan.pastDue)));
    assert.match(callout, /calloutDanger/);
    assert.ok(callout.includes(`>${W.plan.payment}</button>`));
    assert.doesNotMatch(callout.slice(0, callout.indexOf('</button>')), /disabled/);
  });
  it('busy: the button reads Opening payment portal… and is disabled, like the plan card’s own', () => {
    const rendered = html(withStatus('past_due', 'portal'));
    assert.ok(rendered.includes(W.plan.openingPortal));
    const idx = rendered.indexOf(W.plan.pastDue);
    assert.match(rendered.slice(idx, rendered.indexOf('</button>', idx)), /disabled/);
  });
  it('no failed payment, no line and no second door', () => {
    const rendered = html(withStatus('active'));
    assert.ok(!rendered.includes(W.plan.pastDue));
    assert.equal(rendered.split(W.plan.payment).length - 1, 1, 'the plan card’s own button only');
  });
  it('the failed-payment line sits above the plan card', () => {
    const rendered = html(withStatus('past_due'));
    assert.ok(rendered.indexOf(W.plan.pastDue) < rendered.indexOf('Your plan'));
  });
  it('a non-owner never gets the line', () => {
    const p = withStatus('past_due'); p.snapshot.canManageBilling = false;
    assert.ok(!html(p).includes(W.plan.pastDue));
  });
  it('the body takes only its base and its teams door: no fee props, no fee read', () => {
    assert.doesNotMatch(body, /feeLine|\bfees\??:|useStripeFeesRead|StripeFeesList|FeeInvoiceLine/);
  });
});

describe('the coach’s "Part of a club?" card follows the Club sale gate (owner ruling (c), 2026-11-19)', () => {
  it('shows only while Club is open: closed, still loading, or unreadable all hide the promise', () => {
    const open = fixture('team');
    open.snapshot.gating = ready({ team: false, club: false });
    assert.ok(html(open).includes(W.change.clubTitle), 'Club open: the card is shown');
    assert.ok(html(open).includes(W.change.joinClub));

    for (const gating of [
      ready({ team: false, club: true }),
      ready({ team: false }),
      { status: 'loading' } as BillingRead<never>,
      { status: 'error', error: '503' } as BillingRead<never>,
    ]) {
      const closed = fixture('team');
      closed.snapshot.gating = gating as BillingBodyViewProps['snapshot']['gating'];
      assert.ok(!html(closed).includes(W.change.clubTitle), JSON.stringify(gating));
      assert.ok(!html(closed).includes(W.change.clubBody), JSON.stringify(gating));
    }
  });
});

// ═══════════════════════════════════════════════════════ On-sale pages S4, Part 1 — the starts on Plan & billing (2026-11-21)
describe('S4 · the starts on Plan & billing (drawing tabs 2, 4, 6)', () => {
  const open = ready({ tournament: false, tournament_plus: false, team: false, league: false, club: false, club_large: false });
  const rowsOf = (rendered: string) => [...rendered.matchAll(/<td data-label="Plan"><span class="planNameLine"><strong>([^<]+)<\/strong>/g)].map(m => m[1]);
  const freeTimeOrg = (planGrant: { plan: 'tournament_plus'; lastDay: string | null }) => {
    const props = fixture('tournament');
    props.profile = PLAN_BILLING_PROFILES.tournament_plus;
    props.snapshot.org = { ...props.snapshot.org, planId: 'tournament_plus', ownPlanId: 'tournament' } as BillingSnapshot['org'];
    props.snapshot.freeTime = ready({
      freeTime: planGrant.lastDay ? { state: 'running', plan: 'tournament_plus', ownPlan: 'tournament', lastDay: planGrant.lastDay, daysLeft: 300 } : null,
      portal: null, overLimitAfter: false, planGrant,
    });
    return props;
  };

  it('a free Tournament organization: four starts in price order, each "Upgrade to {plan}" while open (call 35)', () => {
    const props = fixture('tournament'); props.snapshot.gating = open;
    const rendered = html(props);
    assert.deepEqual(rowsOf(rendered), ['Tournament', 'Tournament Plus', 'League Plus', 'Club', 'Club · Association']);
    for (const plan of ['Tournament Plus', 'League Plus', 'Club', 'Club · Association']) assert.ok(rendered.includes(`>Upgrade to ${plan}</button>`), plan);
    assert.doesNotMatch(rendered, /Coming soon/);
  });
  it('closed rows stay, wear "Coming soon" on the name’s first line and read "Contact us" (call 36)', () => {
    const rendered = html(fixture('tournament'));
    assert.deepEqual(rowsOf(rendered), ['Tournament', 'Tournament Plus', 'League Plus', 'Club', 'Club · Association']);
    for (const plan of ['League Plus', 'Club', 'Club · Association']) assert.ok(rendered.includes(`<strong>${plan}</strong><span class="chip chipQuiet">Coming soon</span>`), plan);
    assert.equal((rendered.match(/moveDoor" href="mailto:support@fieldlogichq\.ca">Contact us<\/a>/g) ?? []).length, 3);
    assert.ok(rendered.includes('>Upgrade to Tournament Plus</button>'), 'Tournament Plus is on sale either way');
  });
  it('while the gate is still read, a row shows neither a start nor the closed tag (no flash)', () => {
    const props = fixture('tournament'); props.snapshot.gating = { status: 'loading' };
    assert.doesNotMatch(html(props), /Coming soon|Upgrade to League Plus|moveDoor/);
  });
  it('the shelf keeps the Premium Coaches Portal card only, for both Tournament plans (call 35)', () => {
    for (const key of ['tournament', 'tournament_plus'] as const) {
      const rendered = html(fixture(key));
      const shelf = rendered.slice(rendered.indexOf('billing-discovery'));
      const section = shelf.slice(0, shelf.indexOf('</section>'));
      assert.match(section, /Premium Coaches Portal/);
      assert.doesNotMatch(section, /League Plus|>Club</, key);
    }
  });
  it('the team-count line shows only with a Club row, before the tax line, and absorbs "More than 30 teams?" (call 37)', () => {
    const line = 'Club and Club · Association count the teams you give a Premium Coaches Portal. House league teams are unlimited. More than 30?';
    for (const key of ['tournament', 'tournament_plus', 'club'] as const) {
      const rendered = html(fixture(key));
      assert.ok(rendered.includes(line), key);
      assert.ok(rendered.indexOf(line) < rendered.indexOf('Prices are plus applicable taxes.'), `${key}: before the tax line`);
      assert.doesNotMatch(rendered, /More than 30 teams\?/);
    }
    assert.ok(!html(fixture('league')).includes(line), 'League Plus has no Club row at launch');
    assert.match(html(fixture('club')), /Club holds up to 15 teams with a Premium Coaches Portal\. House league teams are unlimited\./);
  });
  it('a free-time organization: Change plan returns, its given plan is the "Free through" row, and only the plans above it start (call 40)', () => {
    const props = freeTimeOrg({ plan: 'tournament_plus', lastDay: '2027-09-30' });
    props.snapshot.gating = open;
    const rendered = html(props);
    assert.deepEqual(rowsOf(rendered), ['Tournament Plus', 'League Plus', 'Club', 'Club · Association']);
    assert.match(rendered, /<span class="chip chipGood">Free through Sep 30, 2027<\/span>/);
    assert.doesNotMatch(rendered, /Upgrade to Tournament Plus|Downgrade/);
    for (const plan of ['League Plus', 'Club', 'Club · Association']) assert.ok(rendered.includes(`>Upgrade to ${plan}</button>`), plan);
    assert.doesNotMatch(rendered, /billing-cancel/, 'nothing of its own to cancel');
  });
  it('free time with no end date reads the same rows (the grant decides, not only the own plan)', () => {
    const rendered = html(freeTimeOrg({ plan: 'tournament_plus', lastDay: null }));
    assert.deepEqual(rowsOf(rendered), ['Tournament Plus', 'League Plus', 'Club', 'Club · Association']);
    assert.doesNotMatch(rendered, /Upgrade to Tournament Plus/);
  });
  it('a start left halfway: one line above the table while its plan is open; absent while closed (call 41)', () => {
    const props = fixture('tournament'); props.snapshot.gating = open; props.leftStart = 'club';
    const rendered = html(props);
    assert.ok(rendered.includes('id="billing-left-start">You were starting <strong>Club</strong>. Pick up where you left off with Upgrade to Club below.</p>'));
    assert.ok(rendered.indexOf('billing-left-start') < rendered.indexOf('<table'));
    assert.doesNotMatch(html({ ...fixture('tournament'), leftStart: 'club' }), /billing-left-start/, 'closed: the row says Coming soon instead');
  });
  it('a Premium coach’s Plan & billing is unchanged: no closed tag, no count line, "Contact us to move" (S4 is not a coach surface)', () => {
    const rendered = html(fixture('team'));
    assert.doesNotMatch(rendered, /Coming soon|billing-team-count|count the teams you give/);
    assert.match(rendered, /Contact us to move/);
  });
});

describe('S4 · the return from Stripe and the second press (decided from the code)', () => {
  const server = readCode('app/api/billing/create-checkout/route.ts');
  it('any free Tournament organization starting the three plans returns to its Plan & billing wait, never success=1', () => {
    assert.match(server, /const startsWorkspace = !inPlaceClubName && ownPlan === 'tournament' && isStartPaidPlan\(planKey\);/);
    assert.match(server, /billingStart \? billingStartSuccessPath\(fallbackReturnTo, planKey as StartPaidPlan\)/);
    assert.ok(readCode('lib/start-plan-server.ts').includes('${BILLING_START_PARAM}=${plan}&session_id={CHECKOUT_SESSION_ID}'));
  });
  it('a second start is refused while a paid one lands — asked of Stripe before a second page, with a code the screen reads', () => {
    const landing = server.indexOf('landingSubscriptionId(auth.org.stripeCustomerId');
    assert.ok(landing > 0 && landing < server.indexOf('ensureStripeCustomer(auth.org'), 'before the customer work and the session');
    assert.match(server, /code: 'subscription_landing',\s*\}\), \{ status: 409/);
    assert.ok(body.includes("if (data.code === 'subscription_landing') return LANDING;"));
    assert.ok(body.includes('if (landing) return <BillingStartSetup orgSlug={org.slug} orgName={org.name} plan={landing} sessionId={null}'));
  });
  it('a start at or below a running free plan is refused on the server, before any address or Stripe work', () => {
    const refusal = server.indexOf("code: 'below_free_plan'");
    assert.ok(refusal > 0 && refusal < server.indexOf('requireBillingLocation(buyer'));
    assert.ok(server.includes('if (givenPlan && PLAN_RANK[planKey] <= PLAN_RANK[givenPlan]) {'));
  });
  it('the payment window reads the TRUE trial from a read that never makes a Stripe customer', () => {
    const route = readCode('app/api/billing/start-plan/route.ts');
    const trial = readCode('lib/start-plan-server.ts');
    assert.ok(route.includes('startTrialFor({ stripeCustomerId: auth.org.stripeCustomerId ?? null }, plan as OrgPlan)'));
    assert.doesNotMatch(route + trial, /ensureStripeCustomer|customers\.create/);
    const dialog = readCode('components/billing/PlanCycleDialog.tsx');
    assert.ok(dialog.includes('/api/billing/start-plan?orgSlug=${encodeURIComponent(orgSlug)}&plan='));
    assert.ok(dialog.includes('planTrialLine(trialDays)') && dialog.includes('W.clubUpgrade.noTrial'));
  });
});
