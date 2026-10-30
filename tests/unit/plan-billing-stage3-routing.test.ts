import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { isValidElement, type ReactNode } from 'react';
import { billingTestLoader } from './_billing-test-loader.ts';
import { isTeamWorkspaceOrg } from '../../lib/team-workspace-kind.ts';
import type { Organization, OrgRole } from '../../lib/types.ts';
import type { UserAccessContext } from '../../lib/user-contexts.ts';

const workspace: Organization = {
  id: 'workspace-stage3', slug: 'falcons', name: 'Falcons Coaches Portal',
  accountKind: 'team_workspace', planId: 'team', subscriptionStatus: 'active',
  subscriptionPeriod: 'monthly', enabledAddons: [], teamLimit: 1, tournamentLimit: 1,
  isPublic: false, isDiscoverable: false, clubBookSharingEnabled: false, createdAt: '2026-10-01',
};
const portal = '/falcons/coaches';
const tournaments = '/falcons/admin/tournaments/manage';
const userId = 'member-stage3';

class Redirect extends Error {
  href: string;
  status: number;
  constructor(href: string, status: number) {
    super(`Redirect ${status}: ${href}`);
    this.href = href;
    this.status = status;
  }
}

type Scenario = {
  name: string;
  role: OrgRole | null;
  live?: number;
  closed?: number;
  /** The closed-assignments read fails: sign-in and the hub must still land somewhere. */
  closedThrows?: boolean;
  capabilities?: Record<string, boolean> | null;
  org?: Organization;
  expected: string;
};

const scenarios: Scenario[] = [
  { name: 'owner before any team or tournament exists', role: 'owner', expected: portal },
  { name: 'owner with several live teams', role: 'owner', live: 3, expected: portal },
  { name: 'owner between seasons', role: 'owner', closed: 3, expected: portal },
  { name: 'board admin without a team', role: 'admin', expected: tournaments },
  { name: 'board admin with live coaching assignment', role: 'admin', live: 1, expected: portal },
  { name: 'board admin with only closed assignments', role: 'admin', closed: 2, expected: portal },
  { name: 'granted coach without a team', role: 'coach', capabilities: { create_tournaments: true }, expected: tournaments },
  { name: 'granted coach with a live team', role: 'coach', capabilities: { create_tournaments: true }, live: 1, expected: portal },
  { name: 'granted coach with a closed team', role: 'coach', capabilities: { create_tournaments: true }, closed: 1, expected: portal },
  { name: 'granted coach without a team while the closed-assignments read fails', role: 'coach', capabilities: { create_tournaments: true }, closedThrows: true, expected: portal },
  { name: 'coach without the grant', role: 'coach', expected: portal },
  { name: 'admin whose tournament grant was revoked', role: 'admin', capabilities: { create_tournaments: false }, expected: portal },
  { name: 'missing accepted membership', role: null, expected: portal },
  { name: 'cancelled owner', role: 'owner', org: { ...workspace, subscriptionStatus: 'canceled' }, expected: portal },
  { name: 'cancelled board admin', role: 'admin', org: { ...workspace, subscriptionStatus: 'canceled' }, expected: portal },
  { name: 'ended free time effective cancellation', role: 'admin', org: { ...workspace, subscriptionStatus: 'canceled' }, expected: portal },
];

/** Only auth, data and rendering boundaries are replaced; the landing resolver and gates execute. */
function fixture(sample: Scenario) {
  const org = sample.org ?? workspace;
  const live = Array.from({ length: sample.live ?? 0 }, (_, index) => ({ teamId: `live-${index}`, teamName: `Live ${index}` }));
  const closed = Array.from({ length: sample.closed ?? 0 }, (_, index) => ({ teamId: `closed-${index}`, teamName: `Closed ${index}` }));
  const member = {
    id: 'membership-stage3', organization_id: org.id, role: sample.role,
    capabilities: sample.capabilities ?? null,
    organizations: {
      id: org.id, slug: org.slug, name: org.name, plan_id: org.planId, account_kind: org.accountKind,
      subscription_status: org.subscriptionStatus, enabled_addons: org.enabledAddons,
      onboarding_completed_at: '2026-10-01', free_floor: org.freeFloor ?? null,
    },
  };
  const assignmentReads: Array<{ kind: string; orgId: string; user: string; standalone?: boolean }> = [];
  const authCalls: unknown[] = [];
  const apiAuth = {
    getAuthContext: async (options: unknown) => { authCalls.push(options); return { org, user: { id: userId } }; },
    getAuthContextWithRole: async (options: unknown) => {
      authCalls.push(options);
      return sample.role ? { org, user: { id: userId }, role: sample.role, capabilities: sample.capabilities ?? null } : null;
    },
    getAcceptedMember: async (requestedOrg: string, requestedUser: string) => {
      assert.equal(requestedOrg, org.id);
      assert.equal(requestedUser, userId);
      return sample.role ? member : null;
    },
  };
  function query() {
    return {
      select() { return this; }, eq() { return this; }, limit() { return this; },
      maybeSingle: async () => ({ data: sample.role ? member : null, error: null }),
      then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
        return Promise.resolve({ data: sample.role ? [member] : [], error: null }).then(resolve, reject);
      },
    };
  }
  const nothing = () => null;
  const load = billingTestLoader({
    'next/navigation': {
      redirect: (href: string) => { throw new Redirect(href, 307); },
      permanentRedirect: (href: string) => { throw new Redirect(href, 308); },
    },
    './api-auth': apiAuth, '@/lib/api-auth': apiAuth,
    './db': {
      getCoachingAssignmentsForUser: async (orgId: string, user: string, options?: { isTeamWorkspace?: boolean }) => {
        assignmentReads.push({ kind: 'live', orgId, user, standalone: options?.isTeamWorkspace });
        return live;
      },
      getClosedCoachingAssignmentsForUser: async (orgId: string, user: string, options?: { isTeamWorkspace?: boolean }) => {
        assignmentReads.push({ kind: 'closed', orgId, user, standalone: options?.isTeamWorkspace });
        if (sample.closedThrows) throw new Error('closed read failed');
        return closed;
      },
    },
    './supabase-admin': { supabaseAdmin: { from: (table: string) => { assert.equal(table, 'organization_members'); return query(); } } },
    './entitlement-grants': { effectiveOrgFacts: async () => new Map() },
    './basic-coach-teams': { getBasicCoachTournamentSummary: async () => ({ teamCount: 0 }), countClaimableRegistrationsForUser: async () => 0 },
    './fan-follows': { getFanFollowSummary: async () => ({ followCount: 0 }) },
    './house-league-coach': { getCoachTeamCards: async () => [] },
    './house-league-coach-invites': {},
    './team-workspace-entitlements': { isTeamWorkspaceOrg },
    './AdminHub': { __esModule: true, default: nothing },
    '@/components/admin/kit/club/BillingKit': { __esModule: true, default: nothing },
  });
  return { load, org, member, assignmentReads, authCalls };
}

type Entry = (props: { params: Promise<{ orgSlug: string }>; children?: ReactNode }) => Promise<ReactNode>;
type BillingEntry = (props: { params: Promise<{ orgSlug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) => Promise<ReactNode>;

describe('retired standalone hub and setup entry paths', () => {
  for (const path of ['app/[orgSlug]/admin/page.tsx', 'app/[orgSlug]/admin/onboarding/layout.tsx']) {
    for (const sample of scenarios) it(`${path}: ${sample.name}`, async () => {
      const { load, assignmentReads, authCalls } = fixture(sample);
      const entry = (load(path) as { default: Entry }).default;
      await assert.rejects(entry({ params: Promise.resolve({ orgSlug: 'falcons' }), children: 'setup child' }),
        error => error instanceof Redirect && error.status === 307 && error.href === sample.expected);
      assert.deepEqual(authCalls, [{ orgSlug: 'falcons', allowSuspendedOrg: true }]);
      for (const read of assignmentReads) {
        assert.equal(read.orgId, workspace.id);
        assert.equal(read.user, userId);
        assert.equal(read.standalone, true);
      }
      if (sample.role === 'owner' || sample.org?.subscriptionStatus === 'canceled') {
        assert.equal(assignmentReads.length, 0, 'recovery and owner landings must not depend on assignment reads');
      }
    });
    it(`${path}: a club keeps its existing content`, async () => {
      const { load } = fixture({ name: 'club', role: 'owner', expected: '', org: { ...workspace, accountKind: 'organization', planId: 'club' } });
      const entry = (load(path) as { default: Entry }).default;
      const tree = await entry({ params: Promise.resolve({ orgSlug: 'falcons' }), children: 'club setup' });
      assert.ok(isValidElement(tree));
      if (path.endsWith('/layout.tsx')) assert.equal((tree.props as { children: ReactNode }).children, 'club setup');
    });
  }
});

describe('old billing and email addresses temporarily retain payment return flags', () => {
  for (const path of ['app/[orgSlug]/admin/org/billing/page.tsx', 'app/[orgSlug]/admin/tournaments/settings/subscription/page.tsx']) {
    for (const planId of ['team', 'tournament', 'tournament_plus'] as const) for (const status of ['active', 'canceled'] as const) it(`${path}: standalone ${planId}/${status}`, async () => {
      const { load, authCalls, assignmentReads } = fixture({ name: status, role: 'owner', expected: portal, org: { ...workspace, planId, subscriptionStatus: status } });
      const page = (load(path) as { default: BillingEntry }).default;
      const searchParams = { success: '1', card_saved: '1', next_season: 'kept', plan: 'team', tag: ['one', 'two'], ignored: undefined };
      let destination = '';
      await assert.rejects(page({ params: Promise.resolve({ orgSlug: 'falcons' }), searchParams: Promise.resolve(searchParams) }), error => {
        if (!(error instanceof Redirect) || error.status !== 307) return false;
        destination = error.href;
        return true;
      });
      const url = new URL(destination, 'https://fieldlogic.test');
      assert.equal(url.pathname, '/falcons/coaches/billing');
      assert.equal(url.searchParams.get('success'), '1');
      assert.equal(url.searchParams.get('card_saved'), '1');
      assert.equal(url.searchParams.get('next_season'), 'kept');
      assert.equal(url.searchParams.get('plan'), 'team');
      assert.deepEqual(url.searchParams.getAll('tag'), ['one', 'two']);
      assert.equal(url.searchParams.has('ignored'), false);
      assert.deepEqual(authCalls, [{ orgSlug: 'falcons', allowSuspendedOrg: true }]);
      assert.equal(assignmentReads.length, 0);
    });
    for (const planId of ['tournament', 'tournament_plus', 'club'] as const) it(`${path}: ${planId} stays on its admin host`, async () => {
      const { load } = fixture({ name: planId, role: 'owner', expected: '', org: { ...workspace, accountKind: 'organization', planId } });
      const page = (load(path) as { default: BillingEntry }).default;
      assert.ok(isValidElement(await page({ params: Promise.resolve({ orgSlug: 'falcons' }), searchParams: Promise.resolve({}) })));
    });
  }
});

describe('the organization parent lets standalone routes reach their destinations', () => {
  for (const planId of ['team', 'tournament', 'tournament_plus'] as const) {
    for (const status of ['active', 'canceled'] as const) it(`standalone ${planId}/${status}: parent retains children and billing reaches its temporary coach target`, async () => {
      const { load, authCalls } = fixture({ name: planId, role: 'owner', expected: portal, org: { ...workspace, planId, subscriptionStatus: status } });
      const parent = (load('app/[orgSlug]/admin/org/layout.tsx') as { default: Entry }).default;
      const tree = await parent({ params: Promise.resolve({ orgSlug: 'falcons' }), children: 'standalone child' });
      assert.ok(isValidElement(tree));
      assert.equal((tree.props as { children: ReactNode }).children, 'standalone child');
      assert.deepEqual(authCalls, [{ orgSlug: 'falcons', allowSuspendedOrg: true }]);
      const page = (load('app/[orgSlug]/admin/org/billing/page.tsx') as { default: BillingEntry }).default;
      await assert.rejects(page({ params: Promise.resolve({ orgSlug: 'falcons' }), searchParams: Promise.resolve({ card_saved: '1' }) }),
        error => error instanceof Redirect && error.status === 307 && error.href === '/falcons/coaches/billing?card_saved=1');
    });
    it(`standalone ${planId}: a board admin without a team can open the hosted list parent`, async () => {
      const { load } = fixture({ name: planId, role: 'admin', expected: tournaments, org: { ...workspace, planId } });
      const parent = (load('app/[orgSlug]/admin/org/layout.tsx') as { default: Entry }).default;
      const tree = await parent({ params: Promise.resolve({ orgSlug: 'falcons' }), children: 'hosted tournaments' });
      assert.ok(isValidElement(tree));
      assert.equal((tree.props as { children: ReactNode }).children, 'hosted tournaments');
    });
  }
  for (const planId of ['tournament', 'tournament_plus'] as const) it(`organization ${planId}: the existing tier boundary still redirects`, async () => {
    const { load, authCalls } = fixture({ name: planId, role: 'owner', expected: '', org: { ...workspace, accountKind: 'organization', planId } });
    const parent = (load('app/[orgSlug]/admin/org/layout.tsx') as { default: Entry }).default;
    await assert.rejects(parent({ params: Promise.resolve({ orgSlug: 'falcons' }), children: 'blocked child' }),
      error => error instanceof Redirect && error.status === 307 && error.href === '/falcons/admin/tournaments');
    assert.deepEqual(authCalls, [{ orgSlug: 'falcons', allowSuspendedOrg: true }]);
  });
});

describe('sign-in contexts and accepted invitations use the same standalone landing', () => {
  for (const sample of scenarios.filter(s => s.role && s.org?.subscriptionStatus !== 'canceled')) {
    it(`actual access contexts: ${sample.name}`, async () => {
      const { load, assignmentReads } = fixture(sample);
      const { getUserAccessContexts } = load('lib/user-contexts.ts') as { getUserAccessContexts: (user: { id: string; email: string }) => Promise<UserAccessContext[]> };
      const contexts = await getUserAccessContexts({ id: userId, email: 'member@example.test' });
      assert.equal(contexts.length, 1);
      assert.equal(contexts[0].kind, 'coaches_premium');
      assert.equal(contexts[0].isTeamWorkspace, true);
      assert.equal(contexts[0].destination, sample.expected);
      assert.ok(assignmentReads.every(read => read.orgId === workspace.id && read.user === userId));
    });
    it(`accepted invitation: ${sample.name}`, async () => {
      const { load } = fixture(sample);
      const { destinationAfterAccept } = load('lib/invite-acceptance.ts') as { destinationAfterAccept: (user: string, orgSlug: string) => Promise<string> };
      assert.equal(await destinationAfterAccept(userId, 'falcons'), sample.expected);
    });
  }
});

describe('the Coaches Portal layout seeds the per-member switches of the viewer', () => {
  // With an initial org the client OrgProvider never fetches /api/org-context, so a provider seeded with
  // the role alone leaves every switch null for the life of the portal: the Tournaments you run door then
  // never shows for a coach who was given the switch (the rail and phone sheet read it from this context).
  it('every working-portal OrgProvider that carries a role also carries the capabilities', () => {
    const source = readFileSync(new URL('../../app/[orgSlug]/coaches/layout.tsx', import.meta.url), 'utf8');
    const seeded = source.match(/<OrgProvider [^>]*initialUserRole={initialUserRole}[^>]*>/g) ?? [];
    assert.ok(seeded.length >= 3, 'the working portal mounts the provider on three paths');
    for (const tag of seeded) assert.match(tag, /initialUserCapabilities={initialUserCapabilities}/);
  });
});
