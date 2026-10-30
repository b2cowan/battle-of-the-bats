import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as React from 'react';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import { coachDoorFor, type OrgCoachAccess } from '../../lib/use-current-org-coach-access.ts';
import type { Organization, OrgRole } from '../../lib/types.ts';

const workspace: Organization = {
  id: 'workspace-admin-doors', slug: 'falcons', name: 'Falcons Coaches Portal',
  accountKind: 'team_workspace', planId: 'team', subscriptionStatus: 'active',
  subscriptionPeriod: 'monthly', enabledAddons: [], teamLimit: 1, tournamentLimit: 1,
  isPublic: false, isDiscoverable: false, clubBookSharingEnabled: false, createdAt: '2026-10-01',
};
const club: Organization = { ...workspace, accountKind: 'organization', planId: 'club' };
const none: OrgCoachAccess = { hasRepAccess: false, hasBasicCoachTeam: false };
const shape = { runsHouseLeague: false, hostsTournaments: true };
const nothing = () => null;

describe('the tournament shell’s Coaches Portal door', () => {
  for (const hasRepAccess of [false, true]) for (const hasBasicCoachTeam of [false, true]) {
    const access = { hasRepAccess, hasBasicCoachTeam };
    it(`the standalone owner returns to this workspace with rep=${hasRepAccess}, Basic=${hasBasicCoachTeam}`, () => {
      assert.deepEqual(coachDoorFor(access, 'falcons', true), { show: true, href: '/falcons/coaches' });
    });
    it(`other people keep the existing rep=${hasRepAccess}, Basic=${hasBasicCoachTeam} rule`, () => {
      assert.deepEqual(coachDoorFor(access, 'falcons'), {
        show: hasRepAccess || hasBasicCoachTeam,
        href: hasRepAccess ? '/falcons/coaches' : '/coaches',
      });
    });
  }
});

interface NavResult {
  coachDoor: { show: boolean; href: string };
  billingLink: { href: string; label: string } | null;
  orgLinks: Array<{ key: string; label: string; href: string }>;
}

function navFixture(org: Organization, role: OrgRole, access: OrgCoachAccess = none) {
  const assignmentReads: Array<{ slug: string; enabled: boolean }> = [];
  const load = billingTestLoader({
    'next/navigation': { usePathname: () => '/falcons/admin/tournaments/manage' },
    '@/lib/org-context': { useOrg: () => ({
      currentOrg: org, userRole: role, userCapabilities: null,
      canOpen: (capability: string) => ['module_tournaments', 'module_members'].includes(capability),
    }) },
    '@/lib/tournament-context': { useTournament: () => ({ currentTournament: null }) },
    '@/components/sandbox/SandboxProvider': { useIsSandbox: () => false },
    './club/ClubBriefProvider': { useClubBrief: () => ({ shape, brief: null }) },
    '@/lib/use-current-org-coach-access': {
      coachDoorFor,
      useCurrentOrgCoachAccess: (slug: string, enabled: boolean) => {
        assignmentReads.push({ slug, enabled });
        return access;
      },
    },
  });
  const { useAdminKitNav } = load('components/admin/kit/useAdminKitNav.ts') as { useAdminKitNav: () => NavResult };
  let nav!: NavResult;
  function NavHarness() {
    nav = useAdminKitNav();
    return null;
  }
  renderToStaticMarkup(createElement(NavHarness));
  return { nav, assignmentReads };
}

describe('the actual admin nav binds workspace identity and role to its doors', () => {
  for (const scenario of [
    { name: 'standalone owner without a team', org: workspace, role: 'owner', access: none, show: true, href: '/falcons/coaches' },
    { name: 'standalone admin without a team', org: workspace, role: 'admin', access: none, show: false, href: '/coaches' },
    { name: 'club owner without a team', org: club, role: 'owner', access: none, show: false, href: '/coaches' },
    { name: 'club owner with a Basic team', org: club, role: 'owner', access: { ...none, hasBasicCoachTeam: true }, show: true, href: '/coaches' },
    { name: 'standalone admin with a closed assignment', org: workspace, role: 'admin', access: { ...none, hasRepAccess: true }, show: true, href: '/falcons/coaches' },
    { name: 'club coach with a closed assignment', org: club, role: 'coach', access: { ...none, hasRepAccess: true }, show: true, href: '/falcons/coaches' },
    { name: 'effective standalone owner on another plan', org: { ...club, accountKind: 'team_workspace' }, role: 'owner', access: none, show: true, href: '/falcons/coaches' },
    { name: 'effective standalone owner on Tournament', org: { ...workspace, planId: 'tournament' }, role: 'owner', access: none, show: true, href: '/falcons/coaches' },
  ] satisfies Array<{ name: string; org: Organization; role: OrgRole; access: OrgCoachAccess; show: boolean; href: string }>) {
    it(scenario.name, () => {
      const { nav, assignmentReads } = navFixture(scenario.org, scenario.role, scenario.access);
      assert.deepEqual(assignmentReads, [{ slug: 'falcons', enabled: true }]);
      assert.deepEqual(nav.coachDoor, { show: scenario.show, href: scenario.href });
      const standalone = scenario.org.accountKind === 'team_workspace';
      const members = nav.orgLinks.find(link => link.key === 'org/members');
      assert.equal(members?.label, scenario.role === 'coach' ? undefined : standalone ? 'Staff & access' : 'Members');
      assert.equal(members?.href, scenario.role === 'coach' ? undefined : '/falcons/admin/org/members');
      assert.equal(nav.billingLink?.href ?? null, scenario.role === 'owner'
        ? standalone ? '/falcons/coaches/billing' : '/falcons/admin/org/billing'
        : null);
    });
  }
});

function membersFixture(org: Organization) {
  const titles: string[] = [];
  let stateCalls = 0;
  const staff = ['owner', 'admin', 'staff'].map((role, index) => ({ id: `member-${index}`, role, section: 'board' }));
  const load = billingTestLoader({
    react: { ...React, useState<T>(initial: T | (() => T)) {
      stateCalls++;
      return React.useState<T>(stateCalls === 1 ? staff as T : initial);
    } },
    'next/navigation': { useSearchParams: () => new URLSearchParams() },
    '@/lib/org-context': { useOrg: () => ({
      currentOrg: org, userRole: 'owner', userCapabilities: null,
      user: { id: 'owner-a' }, loading: false, canOpen: () => true,
    }) },
    '@/lib/usePageTitle': { usePageTitle: (title: string) => titles.push(title) },
    '@/lib/export': {},
    '@/components/admin/ExportMenu': { __esModule: true, default: nothing },
    './ClubBriefProvider': { useClubBrief: () => ({ shape }) },
    './InviteMemberDialog': { __esModule: true, default: nothing },
    './ManageMemberDialog': { __esModule: true, default: nothing },
    './RoleGuide': { __esModule: true, default: nothing },
    './PageNotice': { __esModule: true, default: nothing, useNotice: () => [null, nothing] },
  });
  const Members = (load('components/admin/kit/club/MembersKit.tsx') as { default: ComponentType }).default;
  return { html: renderToStaticMarkup(createElement(Members)), titles };
}

describe('the actual staff page keeps its heading, document title and seats consistent', () => {
  for (const scenario of [
    { name: 'standalone team plan', org: workspace, title: 'Staff & access', seats: true, billingHref: '/falcons/coaches/billing' },
    { name: 'legacy team plan identity', org: { ...workspace, accountKind: 'organization' }, title: 'Staff & access', seats: true, billingHref: '/falcons/coaches/billing' },
    { name: 'effective standalone identity', org: { ...club, accountKind: 'team_workspace' }, title: 'Staff & access', seats: false },
    { name: 'club', org: club, title: 'Members', seats: false },
    { name: 'Tournament', org: { ...club, planId: 'tournament' }, title: 'Members', seats: true, billingHref: '/falcons/admin/tournaments/settings/subscription' },
    { name: 'effective standalone Tournament', org: { ...workspace, planId: 'tournament' }, title: 'Staff & access', seats: true, billingHref: '/falcons/coaches/billing' },
  ] satisfies Array<{ name: string; org: Organization; title: string; seats: boolean; billingHref?: string }>) {
    it(scenario.name, () => {
      const { html, titles } = membersFixture(scenario.org);
      assert.deepEqual(titles, [scenario.title]);
      assert.match(html, new RegExp(`<h1[^>]*>${scenario.title.replace('&', '&amp;')}</h1>`));
      if (scenario.seats) {
        assert.match(html, /3 of 3<\/span> staff seats used/);
        assert.ok(html.includes(`href="${scenario.billingHref}"`), 'the existing full-seat upgrade door uses this workspace’s billing home');
      } else assert.doesNotMatch(html, /staff seats used/);
    });
  }
});
