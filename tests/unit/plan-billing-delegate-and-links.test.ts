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
import { hasCapability, hasBillingAccess } from '../../lib/roles.ts';
import type { BillingSnapshot, BillingRead } from '../../lib/plan-billing-data.ts';
import type { BillingBodyViewProps } from '../../components/billing/BillingBody.tsx';
import type { OrgPlan, OrgRole } from '../../lib/types.ts';
import { readCode } from './_source-code.ts';

/**
 * Plan & billing is the OWNER's alone (owner ruling 2026-10-29, reversing the 2026-10-28 delegation): no grant exists and a
 * stray stored one is inert. Also pinned here: the demo sandboxes carry no
 * billing row, every emailed/notified billing link resolves the tier, and the `?plan=` panel offers Upgrade.
 */
const load = billingTestLoader();
const { BillingBodyView } = load('components/billing/BillingBody.tsx') as { BillingBodyView: ComponentType<BillingBodyViewProps> };
const ready = <T>(data: T): BillingRead<T> => ({ status: 'ready', data });
const plans = Object.keys(PLAN_CONFIG) as OrgPlan[];

function fixture(key: OrgPlan): BillingBodyViewProps {
  const profile = PLAN_BILLING_PROFILES[key];
  const impact = planCancellationImpact(profile, ['module_public_site'], 9);
  const snapshot: BillingSnapshot = {
    org: { id: 'org-a', slug: 'club-a', name: 'Falcons', planId: key, ownPlanId: key, enabledAddons: ['module_public_site'], subscriptionStatus: 'active', subscriptionPeriod: 'monthly', currentPeriodEnd: '2027-03-01', teamLimit: 15, tournamentLimit: 1 } as BillingSnapshot['org'],
    canManageBilling: true,
    usage: ready({ teams: { count: 9, limit: 15 }, tournament_slots: { count: 1, limit: 1 }, staff_seats: { count: 2, limit: profile.config.seatLimit }, officials: 4 }),
    freeTime: ready({ freeTime: null, portal: null, foundingThrough: null, overLimitAfter: false }),
    founding: ready({ isFoundingSeason: false, compUntil: null }),
    gating: ready({ tournament: false, tournament_plus: false, team: false, league: false, club: false, club_large: false }),
    cancellation: ready({ currentPlan: key, ...impact, activeTeams: 9, activeTournamentCount: 0, tournaments: [], cancelled: null }),
    move: ready({ live: false, scheduledMove: null }),
  };
  return { snapshot, profile, ownProfile: profile, actions: { busy: null, cycle: 'monthly', setCycle() {}, portal() {}, card() {}, reactivate() {}, keep() {}, cancel() {}, change() {}, details() {}, choose() {}, retry() {} } };
}
const html = (props: BillingBodyViewProps) => renderToStaticMarkup(createElement(BillingBodyView, props)).replaceAll('&#x27;', "'").replaceAll('&amp;', '&');

describe('Plan & billing is the owner’s alone', () => {
  for (const key of plans) for (const state of ['active', 'past_due', 'trialing'] as const) {
    it(`${key}/${state}: the owner has both doors`, () => {
      const props = fixture(key); props.snapshot.org.subscriptionStatus = state;
      const rendered = html(props);
      if (PLAN_BILLING_PROFILES[key].config.monthlyPrice > 0) assert.match(rendered, /billing-cancel-btn/);
      if (props.profile.changes.some(change => change.mechanism === 'downgrade')) assert.match(rendered, /Downgrade to/);
    });
  }
  it('a failed cancellation read raises the retry banner', () => {
    const owner = fixture('club'); owner.snapshot.cancellation = { status: 'error', error: 'x' };
    assert.match(html(owner), /Try again/);
  });
  it('Tournament Plus: the owner sees the Tournament downgrade', () => {
    assert.match(html(fixture('tournament_plus')), /Downgrade to Tournament/);
  });
  it('the host reads the cancellation record unconditionally and carries no delegate plumbing', () => {
    const body = readCode('components/billing/BillingBody.tsx');
    assert.match(body, /useBillingRead<BillingCancellation>\(`\/api\/billing\/cancel\/preflight\?\$\{scope\}`, version\)/);
    assert.doesNotMatch(body, /canCancel/);
    assert.doesNotMatch(body, /userCapabilities/);
  });
  it('the entry component opens for the owner only: a stray billing grant on any other role gets the locked card', () => {
    for (const role of ['owner', 'admin', 'staff', 'treasurer'] as OrgRole[]) {
      const loader = billingTestLoader({
        '@/lib/org-context': { useOrg: () => ({ currentOrg: { id: 'org-b', name: 'Falcons', planId: 'club' }, userRole: role, userCapabilities: { billing: true }, loading: false, refresh: async () => {} }) },
      });
      const Body = (loader('components/billing/BillingBody.tsx') as { default: (props: { billingBase: string; teamsHref: string }) => ReturnType<typeof createElement> }).default;
      const element = Body({ billingBase: '/falcons/admin/org/billing', teamsHref: '/falcons/admin/rep-teams' });
      assert.equal(typeof element.type === 'function' && element.type.name === 'BillingOwnerBody', role === 'owner', role);
    }
  });
  it('the server doors stay owner-only', () => {
    for (const route of ['cancel/preflight', 'cancel/confirm', 'downgrade/preflight', 'downgrade/confirm']) {
      assert.match(readCode(`app/api/billing/${route}/route.ts`), /ctx\.role !== 'owner'\) return forbidden\(\)/, route);
    }
  });
  it('no role default and no stored override can give billing or settings to anyone but the owner', () => {
    for (const role of ['admin', 'staff', 'treasurer', 'coach', 'official', 'league_admin', 'league_registrar'] as OrgRole[]) {
      assert.equal(hasCapability(role, { billing: true, org_settings: true }, 'billing'), false, role);
      assert.equal(hasCapability(role, { billing: true, org_settings: true }, 'org_settings'), false, role);
      assert.equal(hasBillingAccess(role, { billing: true }), false, role);
    }
    assert.equal(hasBillingAccess('owner', null), true);
    assert.equal(hasBillingAccess(null, { billing: true }), false);
  });
});

describe('a cancelled organization, seen by the owner', () => {
  it('the owner sees the date and the kept-until line', () => {
    const props = fixture('club'); props.snapshot.org.subscriptionStatus = 'canceled';
    const record = props.snapshot.cancellation;
    if (record.status === 'ready') record.data.cancelled = { at: '2027-01-05T12:00:00Z', keptUntil: '2027-04-05T12:00:00Z' };
    const rendered = html(props);
    assert.match(rendered, /billing-reactivate-btn/);
    assert.match(rendered, /Kept until/); assert.match(rendered, /Cancelled Jan/);
  });
});

describe('the plan panel offers Upgrade where the Change plan table does', () => {
  const withDetail = (key: OrgPlan, detail: string) => { const props = fixture(key); props.detail = detail; return props; };
  const panelOnly = (rendered: string) => rendered.slice(rendered.indexOf('Not right now') - 600);
  it('Tournament → Tournament Plus: the owner gets Upgrade', () => {
    assert.match(panelOnly(html(withDetail('tournament', 'tournament_plus'))), /Upgrade to Tournament Plus/);
  });
  it('the panel offers Monthly / Yearly only where its Upgrade can commit one', () => {
    const open = html(withDetail('tournament', 'tournament_plus'));
    assert.match(open, /aria-pressed="true"[^>]*>Monthly<\/button>/); assert.match(open, />Yearly<\/button>/);
    assert.match(open, /Upgrade to Tournament Plus · \$39 \/ month/);
    const held = withDetail('tournament', 'tournament_plus'); held.snapshot.gating = ready({ tournament: false, tournament_plus: true });
    assert.doesNotMatch(html(held), />Yearly<\/button>/);
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
  it('the panel upgrade closes the panel and runs the table’s own checkout change, in the cycle chosen beside the price', () => {
    const body = readCode('components/billing/BillingBody.tsx');
    assert.match(body, /onUpgrade=\{\(\) => \{ onCloseDetail\(\); if \(detailChange\) a\.change\(detailChange, a\.cycle\); \}\}/);
    assert.match(body, /billingCycle=\{a\.cycle\}/);
    assert.match(body, /onBillingCycleChange=\{a\.setCycle\}/);
    assert.match(body, /canUpgrade=\{Boolean\(detailChange\) && controlsReady && ownBilling && !cancelled && sale\(detailProfile\.key\)\}/);
  });
});

describe('small states', () => {
  it('the Change plan cell renders nothing until the free-time and Founding reads are in (no "Contact us" flash)', () => {
    const props = fixture('tournament_plus'); props.snapshot.freeTime = { status: 'loading' };
    assert.doesNotMatch(html(props), /Contact us to move/);
  });
  it('the retry button names what it is doing while it re-reads', () => {
    const props = fixture('club'); props.snapshot.usage = { status: 'error', error: 'x' }; props.actions.busy = 'retry';
    assert.ok(html(props).includes(W.errors.retrying));
  });
  it('the reactivate cycle choice is disabled while a request is in flight', () => {
    const props = fixture('club'); props.snapshot.org.subscriptionStatus = 'canceled'; props.actions.busy = 'checkout';
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
    ['app/api/billing/webhook/route.ts', /getBillingHref\(billingUrlOrgFromRow\(currentOrg, 'past_due'\)\)/],
    ['app/api/billing/webhook/route.ts', /getBillingHref\(billingUrlOrgFromRow\(org\)\)/],
    // The plan the club holds (plan-reader-door-guard): a billing action never reads the door's planId.
    ['app/api/billing/downgrade/confirm/route.ts', /getBillingHref\(\{ \.\.\.ctx\.org, planId: ownPlanOf\(ctx\.org\) \}\)/],
    ['app/api/billing/cancel/confirm/route.ts', /getBillingHref\(\{ \.\.\.ctx\.org, planId: ownPlanOf\(ctx\.org\), subscriptionStatus: 'canceled' \}\)/],
    ['lib/billing-retention.ts', /getBillingHref\(billingUrlOrgFromRow\(org\)\)/],
    ['lib/online-payment-owner-notices.ts', /getBillingHref\(org\)/],
    ['app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts', /getBillingHref\(billingUrlOrgFromRow\(orgRow, 'canceled'\)\)/],
  ];
  for (const [file, pattern] of sites) it(`${file} builds its billing link with getBillingHref`, () => assert.match(readCode(file), pattern));
  it('no server file hard-codes an organization billing address any more (the one known leftover is named)', () => {
    for (const file of ['app/api/billing/webhook/route.ts', 'app/api/billing/downgrade/confirm/route.ts', 'app/api/billing/cancel/confirm/route.ts', 'lib/billing-retention.ts', 'lib/online-payment-owner-notices.ts', 'app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts']) {
      assert.doesNotMatch(readCode(file), /admin\/org\/billing/, file);
    }
  });
  it('the retention cron reads the plan of every org it emails', () => {
    const source = readCode('lib/billing-retention.ts');
    assert.equal(source.split('organizations(name, slug, plan_id, account_kind, subscription_status)').length - 1, 2);
    assert.doesNotMatch(source, /organizations\(name, slug\)/);
  });
  it('tournament tiers land on the subscription page, standalone coaches on their portal, other organizations on billing', () => {
    for (const planId of plans) {
      const expected = planId === 'team' ? '/falcons/coaches/billing' : planId === 'tournament' || planId === 'tournament_plus' ? '/falcons/admin/tournaments/settings/subscription' : '/falcons/admin/org/billing';
      assert.equal(getBillingHref({ slug: 'falcons', planId }), expected, planId);
    }
  });
});
