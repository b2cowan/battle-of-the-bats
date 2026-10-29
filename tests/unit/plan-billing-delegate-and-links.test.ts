import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import { PLAN_BILLING_PROFILES, planCancellationImpact } from '../../lib/plan-billing-profile.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import { PLAN_BILLING_WORDS as W } from '../../lib/plan-billing-words.ts';
import { getBillingHref } from '../../lib/billing-urls.ts';
import { kitBillingLink } from '../../lib/admin-kit-nav.ts';
import type { BillingSnapshot, BillingRead } from '../../lib/plan-billing-data.ts';
import type { BillingBodyViewProps } from '../../components/billing/BillingBody.tsx';
import type { OrgPlan, OrgRole } from '../../lib/types.ts';
import { readCode } from './_source-code.ts';

/**
 * Plan & billing Stage 1 Part 3 fix pass (owner ruling 2026-10-29): cancel and downgrade are the OWNER's alone;
 * a member granted `billing` never reaches a door the server refuses. Also pinned here: the demo sandboxes carry no
 * billing row, every emailed/notified billing link resolves the tier, and the `?plan=` panel offers Upgrade.
 */
const load = billingTestLoader();
const { BillingBodyView } = load('components/billing/BillingBody.tsx') as { BillingBodyView: ComponentType<BillingBodyViewProps> };
const ready = <T>(data: T): BillingRead<T> => ({ status: 'ready', data });
const plans = Object.keys(PLAN_CONFIG) as OrgPlan[];

function fixture(key: OrgPlan, canCancel: boolean): BillingBodyViewProps {
  const profile = PLAN_BILLING_PROFILES[key];
  const impact = planCancellationImpact(profile, ['module_public_site'], 9);
  const snapshot: BillingSnapshot = {
    org: { id: 'org-a', slug: 'club-a', name: 'Falcons', planId: key, ownPlanId: key, enabledAddons: ['module_public_site'], subscriptionStatus: 'active', subscriptionPeriod: 'monthly', currentPeriodEnd: '2027-03-01', teamLimit: 15, tournamentLimit: 1 } as BillingSnapshot['org'],
    canManageBilling: true, canCancel,
    usage: ready({ teams: { count: 9, limit: 15 }, tournament_slots: { count: 1, limit: 1 }, staff_seats: { count: 2, limit: profile.config.seatLimit }, officials: 4 }),
    freeTime: ready({ freeTime: null, portal: null, foundingThrough: null, overLimitAfter: false }),
    founding: ready({ isFoundingSeason: false, compUntil: null }),
    gating: ready({ tournament: false, tournament_plus: false, team: false, league: false, club: false, club_large: false }),
    // A delegate never reads this; if a delegate's body ever reached it, the record below would show.
    cancellation: canCancel ? ready({ currentPlan: key, ...impact, activeTeams: 9, activeTournamentCount: 0, tournaments: [], cancelled: null }) : { status: 'loading' },
    move: ready({ live: false, scheduledMove: null }),
  };
  return { snapshot, profile, ownProfile: profile, actions: { busy: null, cycle: 'monthly', setCycle() {}, portal() {}, card() {}, reactivate() {}, keep() {}, cancel() {}, change() {}, details() {}, choose() {}, retry() {} } };
}
const html = (props: BillingBodyViewProps) => renderToStaticMarkup(createElement(BillingBodyView, props)).replaceAll('&#x27;', "'").replaceAll('&amp;', '&');

describe('a billing delegate has no cancel or downgrade door', () => {
  for (const key of plans) for (const state of ['active', 'past_due', 'trialing'] as const) {
    it(`${key}/${state}: no Reduce or cancel, no Downgrade, no cancellation banner or retry`, () => {
      const props = fixture(key, false); props.snapshot.org.subscriptionStatus = state;
      for (const read of [{ status: 'loading' }, { status: 'error', error: 'x' }] as const) {
        props.snapshot.cancellation = read;
        const rendered = html(props);
        assert.doesNotMatch(rendered, /billing-cancel-btn|Reduce or cancel|Downgrade to|cancellation details|cancellation record|Try again/);
      }
    });
    it(`${key}/${state}: the owner still has both doors`, () => {
      const props = fixture(key, true); props.snapshot.org.subscriptionStatus = state;
      const rendered = html(props);
      if (PLAN_BILLING_PROFILES[key].config.monthlyPrice > 0) assert.match(rendered, /billing-cancel-btn/);
      if (props.profile.changes.some(change => change.mechanism === 'downgrade')) assert.match(rendered, /Downgrade to/);
    });
  }
  it('a failed cancellation read raises the retry banner for the owner only', () => {
    const owner = fixture('club', true); owner.snapshot.cancellation = { status: 'error', error: 'x' };
    assert.match(html(owner), /Try again/);
    const delegate = fixture('club', false); delegate.snapshot.cancellation = { status: 'error', error: 'x' };
    assert.doesNotMatch(html(delegate), /Try again|cancellation/);
  });
  it('Tournament Plus: a delegate sees no row for the Tournament downgrade; the owner does', () => {
    assert.match(html(fixture('tournament_plus', true)), /Downgrade to Tournament/);
    const rendered = html(fixture('tournament_plus', false));
    assert.doesNotMatch(rendered, /Downgrade to/);
    assert.doesNotMatch(rendered, />Tournament<\/strong>/, 'the downgrade target is not even listed as a row');
  });
  it('the host: only the owner reads the cancellation record, and the entry passes the role down', () => {
    const body = readCode('components/billing/BillingBody.tsx');
    assert.match(body, /canCancel \? `\/api\/billing\/cancel\/preflight\?\$\{scope\}` : null/);
    assert.match(body, /canCancel=\{userRole === 'owner'\}/);
    assert.match(body, /canManageBilling: true, canCancel,/);
  });
  it('the entry component hands the role to the owner body: owner true, delegate false', () => {
    for (const role of ['owner', 'admin'] as OrgRole[]) {
      const loader = billingTestLoader({
        '@/lib/org-context': { useOrg: () => ({ currentOrg: { id: 'org-b', name: 'Falcons', planId: 'club' }, userRole: role, userCapabilities: { billing: true }, loading: false, refresh: async () => {} }) },
      });
      const Body = (loader('components/billing/BillingBody.tsx') as { default: (props: { billingBase: string; teamsHref: string }) => ReturnType<typeof createElement> }).default;
      const element = Body({ billingBase: '/falcons/admin/org/billing', teamsHref: '/falcons/admin/rep-teams' });
      assert.equal((element.props as { canCancel: boolean }).canCancel, role === 'owner');
    }
  });
  it('the four server doors stay owner-only', () => {
    for (const route of ['cancel/preflight', 'cancel/confirm', 'downgrade/preflight', 'downgrade/confirm']) {
      assert.match(readCode(`app/api/billing/${route}/route.ts`), /ctx\.role !== 'owner'\) return forbidden\(\)/, route);
    }
  });
});

describe('a cancelled organization, seen by a billing delegate', () => {
  for (const key of ['club', 'tournament_plus', 'team'] as OrgPlan[]) it(`${key}: reactivate works, with no cancelled date or kept-until line, and no error`, () => {
    const props = fixture(key, false); props.snapshot.org.subscriptionStatus = 'canceled';
    const rendered = html(props);
    assert.match(rendered, /billing-reactivate-btn/);
    assert.doesNotMatch(rendered, /Kept until|Try again|cancellation record/);
    assert.ok(rendered.includes(W.reactivate.chip(null)), 'the chip reads the plain status, never an empty date');
    assert.doesNotMatch(rendered, /Cancelled (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/);
  });
  it('the owner still sees the date and the kept-until line', () => {
    const props = fixture('club', true); props.snapshot.org.subscriptionStatus = 'canceled';
    const record = props.snapshot.cancellation;
    if (record.status === 'ready') record.data.cancelled = { at: '2027-01-05T12:00:00Z', keptUntil: '2027-04-05T12:00:00Z' };
    const rendered = html(props);
    assert.match(rendered, /Kept until/); assert.match(rendered, /Cancelled Jan/);
  });
});

describe('the plan panel offers Upgrade where the Change plan table does', () => {
  const withDetail = (key: OrgPlan, detail: string, canCancel = true) => { const props = fixture(key, canCancel); props.detail = detail; return props; };
  const panelOnly = (rendered: string) => rendered.slice(rendered.indexOf('Not right now') - 600);
  it('Tournament → Tournament Plus: the owner and a billing delegate both get Upgrade', () => {
    for (const canCancel of [true, false]) assert.match(panelOnly(html(withDetail('tournament', 'tournament_plus', canCancel))), /Upgrade to Tournament Plus/);
  });
  it('no Upgrade when the plan is held back, a staff grant is running, the org is cancelled, or the change is not a checkout', () => {
    const held = withDetail('tournament', 'tournament_plus'); held.snapshot.gating = ready({ tournament: false, tournament_plus: true });
    assert.doesNotMatch(html(held), /Upgrade to Tournament Plus<\/button>|btn-lime btn-data/);
    const free = withDetail('tournament', 'tournament_plus');
    free.snapshot.freeTime = ready({ freeTime: { state: 'running', plan: 'club', ownPlan: 'tournament', lastDay: '2027-03-31', daysLeft: 40 }, portal: null, foundingThrough: null, overLimitAfter: false });
    assert.doesNotMatch(html(free), /btn-lime btn-data/);
    const gone = withDetail('tournament', 'tournament_plus'); gone.snapshot.org.subscriptionStatus = 'canceled';
    assert.doesNotMatch(html(gone), /Upgrade to Tournament Plus<\/button>/);
    assert.doesNotMatch(html(withDetail('tournament_plus', 'club')), /btn-lime btn-data/);
    assert.doesNotMatch(html(withDetail('club', 'club_large')), /btn-lime btn-data/);
  });
  it('the panel upgrade closes the panel and runs the table’s own checkout change, in the chosen cycle', () => {
    const body = readCode('components/billing/BillingBody.tsx');
    assert.match(body, /onUpgrade=\{\(\) => \{ onCloseDetail\(\); if \(detailChange\) a\.change\(detailChange\); \}\}/);
    assert.match(body, /billingCycle=\{a\.cycle\}/);
    assert.match(body, /canUpgrade=\{Boolean\(detailChange\) && controlsReady && ownBilling && !cancelled && sale\(detailProfile\.key\)\}/);
  });
});

describe('small states', () => {
  it('the Change plan cell renders nothing until the free-time and Founding reads are in (no "Contact us" flash)', () => {
    const props = fixture('tournament_plus', true); props.snapshot.freeTime = { status: 'loading' };
    assert.doesNotMatch(html(props), /Contact us to move/);
  });
  it('the retry button names what it is doing while it re-reads', () => {
    const props = fixture('club', true); props.snapshot.usage = { status: 'error', error: 'x' }; props.actions.busy = 'retry';
    assert.ok(html(props).includes(W.errors.retrying));
  });
  it('the reactivate cycle choice is disabled while a request is in flight', () => {
    const props = fixture('club', true); props.snapshot.org.subscriptionStatus = 'canceled'; props.actions.busy = 'checkout';
    assert.match(html(props), /<select[^>]*disabled/);
  });
});

describe('demo sandboxes carry no billing row', () => {
  it('kitBillingLink returns nothing in a sandbox, for every plan, the owner included', () => {
    for (const planId of plans) {
      assert.equal(kitBillingLink({ orgSlug: 'riverdale-minor-ball', planId, role: 'owner', capabilities: null, isSandbox: true }), null, planId);
      assert.ok(kitBillingLink({ orgSlug: 'riverdale-minor-ball', planId, role: 'owner', capabilities: null, isSandbox: false }), planId);
      assert.ok(kitBillingLink({ orgSlug: 'riverdale-minor-ball', planId, role: 'owner', capabilities: null }), 'the default is not a sandbox');
    }
  });
  it('the nav hook passes the sandbox flag, and the More sheet’s You group no longer keys on the link', () => {
    assert.match(readCode('components/admin/kit/useAdminKitNav.ts'), /kitBillingLink\(\{[^}]*isSandbox \}\)/);
    const sheet = readCode('components/admin/kit/AdminKitBottomNav.tsx');
    assert.match(sheet, /\{\(!isSandbox \|\| coachDoor\.show\) && \(/);
    assert.doesNotMatch(sheet, /coachDoor\.show \|\| billingLink/);
  });
});

describe('every billing link resolves the tier', () => {
  const sites: [string, RegExp][] = [
    ['app/api/billing/webhook/route.ts', /getBillingHref\(currentOrg\.slug, currentOrg\.plan_id\)/],
    ['app/api/billing/webhook/route.ts', /getBillingHref\(org\.slug, org\.plan_id\)/],
    // The plan the club holds (plan-reader-door-guard): a billing action never reads the door's planId.
    ['app/api/billing/downgrade/confirm/route.ts', /getBillingHref\(ctx\.org\.slug, ownPlanOf\(ctx\.org\)\)/],
    ['app/api/billing/cancel/confirm/route.ts', /getBillingHref\(ctx\.org\.slug, ownPlanOf\(ctx\.org\)\)/],
    ['lib/billing-retention.ts', /getBillingHref\(orgSlug, planId\)/],
    ['lib/online-payment-owner-notices.ts', /getBillingHref\(org\.slug, org\.planId\)/],
    ['app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts', /getBillingHref\(orgRow\.slug, orgRow\.plan_id\)/],
  ];
  for (const [file, pattern] of sites) it(`${file} builds its billing link with getBillingHref`, () => assert.match(readCode(file), pattern));
  it('no server file hard-codes an organization billing address any more (the one known leftover is named)', () => {
    for (const file of ['app/api/billing/webhook/route.ts', 'app/api/billing/downgrade/confirm/route.ts', 'app/api/billing/cancel/confirm/route.ts', 'lib/billing-retention.ts', 'lib/online-payment-owner-notices.ts', 'app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts']) {
      assert.doesNotMatch(readCode(file), /admin\/org\/billing/, file);
    }
  });
  it('the retention cron reads the plan of every org it emails', () => {
    const source = readCode('lib/billing-retention.ts');
    assert.equal(source.split('organizations(name, slug, plan_id)').length - 1, 2);
    assert.doesNotMatch(source, /organizations\(name, slug\)/);
  });
  it('tournament tiers land on the subscription page, everyone else on the organization page', () => {
    for (const planId of plans) {
      const expected = planId === 'tournament' || planId === 'tournament_plus' ? '/falcons/admin/tournaments/settings/subscription' : '/falcons/admin/org/billing';
      assert.equal(getBillingHref('falcons', planId), expected, planId);
    }
  });
});
