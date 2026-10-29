import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, isValidElement, type ComponentType, type ReactElement, type ReactNode } from 'react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import { coachBillingLink, isStandaloneCoachOwner } from '../../lib/coach-billing-access.ts';
import { isTeamWorkspaceOrg } from '../../lib/team-workspace-kind.ts';
import type { Organization, OrgRole } from '../../lib/types.ts';
import { readCode } from './_source-code.ts';

const workspace: Organization = {
  id: 'workspace-a', slug: 'falcons', name: 'Falcons Coaches Portal', planId: 'team', ownPlanId: 'team',
  accountKind: 'team_workspace', subscriptionStatus: 'active', enabledAddons: [],
  subscriptionPeriod: 'monthly', teamLimit: 1, tournamentLimit: 1,
  isPublic: false, isDiscoverable: false, clubBookSharingEnabled: false, createdAt: '2026-10-01',
};
const pass = ({ children }: { children?: ReactNode }) => createElement('div', null, children);
const nothing = () => null;

describe('the standalone owner predicate and sandbox billing door', () => {
  for (const role of ['owner', 'admin', 'staff', 'coach', null] as const) {
    for (const standalone of [true, false]) for (const billing of [false, true]) {
      it(`${role}/${standalone ? 'standalone' : 'club'}/stale grant=${billing}`, () => {
        const org = standalone ? workspace : { ...workspace, accountKind: 'organization' as const, planId: 'club' as const };
        const allowed = role === 'owner' && standalone;
        assert.equal(isStandaloneCoachOwner(org, role, { billing }), allowed);
        assert.equal(coachBillingLink(org, role, { billing }, false), allowed ? '/falcons/coaches/billing' : null);
        assert.equal(coachBillingLink(org, role, { billing }, true), null);
      });
    }
  }
  it('the legacy team plan signal still identifies a standalone owner', () => {
    assert.equal(isStandaloneCoachOwner({ accountKind: 'organization', planId: 'team' }, 'owner', null), true);
    assert.equal(coachBillingLink(null, 'owner', null, false), null);
  });
});

describe('the actual coach host mounts the shared body without tournament providers', () => {
  for (const role of ['owner', 'admin', 'staff'] as const) it(role, () => {
    const load = billingTestLoader({
      '@/lib/org-context': { useOrg: () => ({ currentOrg: workspace, userRole: role, userCapabilities: { billing: true }, loading: false, refresh: async () => {} }) },
      '@/lib/usePageTitle': { usePageTitle() {} },
      'next/navigation': { useRouter: () => ({ replace() {}, push() {} }), useSearchParams: () => new URLSearchParams() },
    });
    const Page = (load('app/[orgSlug]/coaches/billing/page.tsx') as { default: ComponentType }).default;
    const html = renderToStaticMarkup(createElement(Page));
    assert.match(html, /<h1[^>]*>Plan &amp; billing<\/h1>/);
    if (role === 'owner') assert.match(html, /Your plan|Loading plan &amp; billing/);
    else {
      assert.match(html, /Billing access required/);
      assert.doesNotMatch(html, /billing-manage-btn|billing-cancel-btn|CAD/);
    }
  });
});

type Element = ReactElement<Record<string, unknown>>;
function allElements(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(allElements);
  if (!isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...allElements(element.props.children)];
}

async function layoutFixture({ role = 'owner', org = workspace, pathname = '/falcons/coaches', teams = 0, closed = false, freeTimeEnded = false, carriesPortal = true, renderBilling = false }:
  { role?: OrgRole | null; org?: Organization; pathname?: string; teams?: number; closed?: boolean; freeTimeEnded?: boolean; carriesPortal?: boolean; renderBilling?: boolean } = {}) {
  let membershipReads = 0;
  let assignmentReads = 0;
  const assignments = Array.from({ length: teams }, (_, index) => ({ teamId: `team-${index}`, teamName: `Team ${index}` }));
  const load = billingTestLoader({
    'next/headers': { headers: async () => new Headers({ 'x-pathname': pathname }) },
    'next/navigation': { useRouter: () => ({ replace() {}, push() {} }), useSearchParams: () => new URLSearchParams() },
    '@/lib/usePageTitle': { usePageTitle() {} },
    '@/lib/coach-portal-request': {
      getCoachPortalAuth: async () => ({ org, user: { id: 'owner-a' } }),
      getCoachPortalAssignments: async () => { assignmentReads++; return closed ? [] : assignments; },
      getCoachPortalClosedAssignments: async () => closed ? assignments : [],
      getCoachPortalPublicHref: async () => null,
    },
    // The shared accepted-membership read (status 'active' lives in it): the layout must go through it.
    '@/lib/api-auth': {
      getAuthenticatedUser: async () => ({ id: 'owner-a' }),
      getAcceptedMember: async () => { membershipReads++; return role ? { role } : null; },
    },
    '@/lib/team-workspace-entitlements': { isTeamWorkspaceOrg },
    '@/lib/coach-portal-plan': { orgPlanCarriesCoachesPortal: () => carriesPortal },
    '@/lib/member-names': { orgOwnerDisplayName: async () => 'The owner' },
    '@/lib/user-preferences': { getCoachOnboardingPrefs: async () => ({}) },
    '@/lib/demo-org': { getDemoOrgBySlug: () => null },
    '@/lib/portal-free-time-server': { endedPortalFreeTime: async () => freeTimeEnded ? { lastDay: '2026-10-20', basicTeamId: 'basic-a' } : null },
    '@/lib/org-context': { OrgProvider: pass, useOrg: () => ({ currentOrg: org, userRole: role, userCapabilities: null, loading: false, refresh: async () => {} }) },
    '@/lib/coaches-context': { CoachesProvider: pass },
    '@/lib/coaches-overlay': { CoachesOverlayProvider: pass },
    '@/components/help/HelpDrawerProvider': { __esModule: true, default: pass },
    '@/components/coaches/ConfirmProvider': { __esModule: true, default: pass },
    '@/components/coaches/CoachesChrome': { __esModule: true, default: pass },
    '@/components/coaches/CoachTopStrip': { __esModule: true, default: nothing },
    '@/components/coaches/CoachThemeColor': { __esModule: true, default: nothing },
    '@/components/coaches/CoachWallSignOut': { __esModule: true, default: nothing },
    '@/components/coaches/CoachPlanWall': { __esModule: true, default: () => createElement('h2', null, 'Plan wall') },
    '@/components/InstallAppPrompt': { __esModule: true, default: nothing },
  });
  const Layout = (load('app/[orgSlug]/coaches/layout.tsx') as { default: (props: { params: Promise<{ orgSlug: string }>; children: ReactNode }) => Promise<ReactNode> }).default;
  const Page = renderBilling ? (load('app/[orgSlug]/coaches/billing/page.tsx') as { default: ComponentType }).default : null;
  const tree = await Layout({ params: Promise.resolve({ orgSlug: org.slug }), children: Page ? createElement(Page) : createElement('p', { id: 'billing-child' }, 'Billing destination') });
  return { tree, html: renderToStaticMarkup(tree), membershipReads, assignmentReads };
}

describe('server wall order and exact owner billing exception', () => {
  for (const sample of [{ teams: 0, closed: false }, { teams: 3, closed: false }, { teams: 3, closed: true }]) {
    it(`renders the actual host and body through the layout with ${sample.teams} ${sample.closed ? 'closed' : 'live'} teams`, async () => {
      // A hosted tournament has no provider here: the body reads workspace counts through its own usage endpoint.
      const result = await layoutFixture({ ...sample, pathname: '/falcons/coaches/billing', renderBilling: true });
      assert.match(result.html, /<h1[^>]*>Plan &amp; billing<\/h1>/);
      assert.match(result.html, /Your plan|Loading plan &amp; billing/);
      assert.doesNotMatch(result.html, /Coaches Portal not ready|Billing access required/);
    });
  }
  it('zero teams: the owner has a full-request door and only the exact billing page renders', async () => {
    const wall = await layoutFixture();
    assert.match(wall.html, /Coaches Portal not ready/);
    assert.match(wall.html, /href="\/falcons\/coaches\/billing"[^>]*>Plan &amp; billing/);
    assert.doesNotMatch(wall.html, /billing-child/);
    assert.equal(wall.membershipReads, 1, 'the wall reads the accepted membership once, through the shared helper');
    for (const pathname of ['/falcons/coaches/billing', '/falcons/coaches/notifications', '/falcons/coaches/billing/anything', '/other/coaches/billing']) {
      const result = await layoutFixture({ pathname });
      assert.equal(result.html.includes('billing-child'), pathname === '/falcons/coaches/billing', pathname);
      if (pathname === '/falcons/coaches/billing') {
        assert.equal(allElements(result.tree).find(element => 'billingOnlyHref' in element.props)?.props.billingOnlyHref, pathname);
      }
    }
  });
  for (const role of ['admin', 'staff', 'coach', null] as const) it(`${role}: no zero-team door or bypass`, async () => {
    const result = await layoutFixture({ role, pathname: '/falcons/coaches/billing' });
    assert.match(result.html, /Coaches Portal not ready/);
    assert.doesNotMatch(result.html, /billing-child|>Plan &amp; billing/);
  });
  for (const freeTimeEnded of [false, true]) for (const role of ['owner', 'admin', null] as const) {
    it(`cancelled/${freeTimeEnded ? 'free-time-ended' : 'subscription-ended'}/${role}: owner recovery only, no working shell`, async () => {
      const result = await layoutFixture({ org: { ...workspace, subscriptionStatus: 'canceled' }, role, pathname: '/falcons/coaches/billing', freeTimeEnded });
      assert.doesNotMatch(result.html, /billing-child/);
      assert.equal(result.assignmentReads, 0);
      const provider = allElements(result.tree).find(element => element.type === pass && 'initialUserRole' in element.props);
      assert.equal(provider?.props.initialUserRole, null, 'the wall never seeds an operational role');
      assert.equal(result.html.includes('reactivateOrgSlug=falcons'), role === 'owner');
      assert.equal(result.html.includes('&amp;keep=1'), freeTimeEnded && role === 'owner');
    });
  }
  it('the plan wall precedes even the owner billing exception', async () => {
    const result = await layoutFixture({ pathname: '/falcons/coaches/billing', carriesPortal: false });
    assert.match(result.html, /Plan wall/);
    assert.doesNotMatch(result.html, /billing-child/);
  });
  for (const closed of [false, true]) it(`several ${closed ? 'closed' : 'live'} teams: workspace billing bypasses no season gate`, async () => {
    const result = await layoutFixture({ pathname: '/falcons/coaches/billing', teams: 3, closed });
    assert.match(result.html, /billing-child/);
    assert.doesNotMatch(result.html, /Coaches Portal not ready/);
    assert.equal(allElements(result.tree).find(element => 'billingOnlyHref' in element.props)?.props.billingOnlyHref, null);
  });
});

describe('workspace billing stays outside the team nav and season gates', () => {
  for (const sample of [
    { pathname: '/falcons/coaches/billing', billingOnlyHref: '/falcons/coaches/billing', reload: false },
    { pathname: '/falcons/coaches/notifications', billingOnlyHref: '/falcons/coaches/billing', reload: true },
    { pathname: '/falcons/coaches/notifications', billingOnlyHref: null, reload: false },
  ]) it(`retained shell ${sample.billingOnlyHref ?? 'ordinary'}/${sample.pathname}: another page cannot inherit the zero-team exception`, () => {
    const effects: Array<() => void> = [], destinations: string[] = [];
    const load = billingTestLoader({
      react: { ...React, useEffect: (effect: () => void) => { effects.push(effect); } },
      'next/navigation': { usePathname: () => sample.pathname },
      './CoachTopStrip': { __esModule: true, default: nothing },
      './CoachesSidebar': { __esModule: true, default: nothing },
      './CoachesBottomNav': { __esModule: true, default: nothing },
    });
    const Chrome = (load('components/coaches/CoachesChrome.tsx') as { default: ComponentType<{ orgSlug: string; billingOnlyHref: string | null; children?: ReactNode }> }).default;
    const markup = renderToStaticMarkup(createElement(Chrome, { orgSlug: 'falcons', billingOnlyHref: sample.billingOnlyHref }, createElement('p', null, 'Destination child')));
    assert.equal(markup.includes('Destination child'), !sample.reload, 'the forbidden child never mounts');
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    try {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: {
        search: '?focus=payment', hash: '#top', replace: (url: string) => destinations.push(url),
      } } });
      effects.forEach(effect => effect());
      assert.deepEqual(destinations, sample.reload ? [`${sample.pathname}?focus=payment#top`] : []);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
      else Reflect.deleteProperty(globalThis, 'window');
    }
  });
  for (const scenario of ['owner', 'helper', 'club-owner', 'sandbox', 'closed-owner', 'zero-team-owner'] as const) {
    it(`${scenario}: the real rail and open More sheet render the correct billing door`, () => {
      const org = scenario === 'club-owner' ? { ...workspace, planId: 'club', accountKind: 'organization' } : workspace;
      const role = scenario === 'helper' ? 'admin' : 'owner';
      const closed = scenario === 'closed-owner';
      const noTeam = scenario === 'zero-team-owner';
      const assignment = { teamId: 'team-a', teamName: 'Falcons', programYearName: '2026 Season', capabilities: { isHeadCoach: true } };
      const assignments = closed || noTeam ? [] : [assignment];
      const closedAssignments = closed ? [assignment] : [];
      const allowed = !['helper', 'club-owner', 'sandbox'].includes(scenario);
      for (const mobile of [false, true]) {
        let stateCalls = 0;
        const load = billingTestLoader({
          react: mobile ? { ...React, useState<T>(initial: T | (() => T)) {
            stateCalls++;
            return React.useState<T>(stateCalls === 1 ? true as T : initial);
          } } : React,
          'next/navigation': { usePathname: () => '/falcons/coaches/billing', useRouter: () => ({ push() {} }) },
          '@/lib/org-context': { useOrg: () => ({ currentOrg: org, userRole: role, userCapabilities: { billing: true } }) },
          '@/lib/coaches-context': {
            useCoaches: () => ({ assignments, closedAssignments }),
            resolveLiveSeason: () => assignments[0] ?? null,
            resolveClosedSeason: () => closedAssignments[0] ?? null,
          },
          '@/components/sandbox/SandboxProvider': { useIsSandbox: () => scenario === 'sandbox' },
          '@/lib/use-chat-unread': { useChatUnread: () => 0 },
          '@/lib/use-notification-unread': { useNotificationUnread: () => ({ count: 0 }) },
          '@/lib/coaches-overlay': { useAnyOverlayOpen: () => false },
          '@/components/whats-new/ReleaseDot': { __esModule: true, default: nothing },
          '@/components/shared/SidebarStrip': {
            CollapseSidebarRow: nothing, SidebarStripMenu: nothing, SidebarStripTile: nothing,
            SidebarStripTip: nothing, StripMenuGroup: pass, StripMenuLink: nothing,
            useStripMenu: () => ({ openKey: null, anchorRef: { current: null }, toggle() {}, close() {} }),
          },
        });
        const path = mobile ? 'components/coaches/CoachesBottomNav.tsx' : 'components/coaches/CoachesSidebar.tsx';
        const Nav = (load(path) as { default: ComponentType<{ orgSlug: string }> }).default;
        const html = renderToStaticMarkup(createElement(Nav, { orgSlug: 'falcons' }));
        assert.equal(html.includes(mobile ? 'id="coaches-mob-billing"' : 'id="coaches-billing"'), allowed, path);
        if (allowed) assert.match(html, /href="\/falcons\/coaches\/billing"/);
        if (closed) {
          assert.match(html, /Season&#x27;s End/);
          assert.doesNotMatch(html, /href="[^"]*\/practice"/);
        }
      }
    });
  }
  it('both navs use the shared sandbox-aware row and the phone lights More on billing', () => {
    const rail = readCode('components/coaches/CoachesSidebar.tsx');
    const phone = readCode('components/coaches/CoachesBottomNav.tsx');
    for (const source of [rail, phone]) assert.match(source, /coachBillingLink\(currentOrg, userRole, userCapabilities, inSandbox\)/);
    assert.ok(rail.indexOf('id="coaches-billing"') > rail.indexOf('>Help</span>'));
    const ids = ['id="coaches-mob-account"', 'id="coaches-mob-home"', 'id="coaches-mob-billing"', 'id="coaches-mob-back-to-admin"', '<MoreSheetFoot'];
    for (let index = 1; index < ids.length; index++) assert.ok(phone.indexOf(ids[index - 1]) < phone.indexOf(ids[index]));
    assert.match(phone, /const isOnBilling = pathname === `\$\{base\}\/billing`/);
    assert.match(phone, /const isOnTeamMore = isOnNotifications \|\| isOnBilling/);
    assert.ok(phone.indexOf('id="coaches-mob-billing"') > phone.indexOf('{seasonFinished ? null : ('));
    const page = readCode('app/[orgSlug]/coaches/billing/page.tsx');
    assert.doesNotMatch(page, /useTournament|TournamentProvider|CoachTeamSeasonGate|teamId/);
  });
});
