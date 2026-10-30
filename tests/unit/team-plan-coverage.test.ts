import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import type { Organization } from '../../lib/types.ts';
import type { TeamWorkspace } from '../../lib/team-workspace-entitlements.ts';
import { PLAN_BILLING_WORDS as W } from '../../lib/plan-billing-words.ts';
import { readSource } from './_source-code.ts';

const club: Organization = {
  id: 'club', name: 'Riverdale Reds', slug: 'riverdale', accountKind: 'organization', planId: 'club',
  subscriptionStatus: 'active', tournamentLimit: 1, teamLimit: 40, enabledAddons: [],
  isPublic: false, isDiscoverable: false, clubBookSharingEnabled: false, createdAt: '2026-10-30',
};
const org = { ...club, id: 'workspace', name: 'The team workspace', accountKind: 'team_workspace', planId: 'team' } as Organization;
const linked: TeamWorkspace = {
  id: 'link', workspaceOrgId: org.id, repTeamId: 'team', activeProgramYearId: null,
  primaryOwnerUserId: 'coach', workspaceState: 'linked', billingMode: 'org_team_addon',
  billingOwnerOrgId: club.id, billingOwnerUserId: null, subscriptionStatus: 'active',
  source: 'org_invite', sourceTournamentId: null, sourceTournamentTeamId: null, basicCoachTeamId: null,
};
const payer = club;

function fixture(workspace: TeamWorkspace | null = linked, payerRow: Organization | null = payer, error: Error | null = null,
  role: string | null = 'coach', roleError: Error | null = null) {
  const reads: string[] = [];
  const load = billingTestLoader({
    './team-workspace-entitlements': { getTeamWorkspaceForRepTeam: async (teamId: string) => {
      assert.equal(teamId, 'team'); reads.push('workspace'); return workspace;
    } },
    './db': { getOrganizationBySlug: async (slug: string) => {
      assert.equal(slug, club.slug); return payerRow;
    } },
    './supabase-admin': { supabaseAdmin: { from(table: string) {
      if (table === 'organization_members') return { select(columns: string) {
        assert.equal(columns, 'role');
        const expected = new Map([['organization_id', club.id], ['user_id', 'coach'], ['status', 'active']]);
        const query = {
          eq(key: string, value: string) { assert.equal(value, expected.get(key)); expected.delete(key); return query; },
          maybeSingle: async () => {
            assert.equal(expected.size, 0); reads.push('member');
            return { data: role ? { role } : null, error: roleError };
          },
        };
        return query;
      } };
      assert.equal(table, 'organizations');
      return { select(columns: string) {
        assert.equal(columns, 'slug');
        return { eq(key: string, value: string) {
          assert.equal(key, 'id'); assert.equal(value, club.id); reads.push('payer');
          return { maybeSingle: async () => ({ data: payerRow ? { slug: club.slug } : null, error }) };
        } };
      } };
    } } },
  });
  const { getTeamPlanCoveragePayer: resolve, getCoachTeamPlanCoverage: coverage } = load('lib/team-plan-coverage.ts') as {
    getTeamPlanCoveragePayer: (org: Organization, teamId: string) => Promise<{ orgId: string; clubName: string } | null>;
    getCoachTeamPlanCoverage: (org: Organization, teamId: string, userId: string) => Promise<{ clubName: string } | null>;
  };
  return { resolve, coverage, reads };
}

describe('the team settings payer read', () => {
  it('uses the native club without querying a workspace', async () => {
    const f = fixture();
    assert.deepEqual(await f.resolve(club, 'team'), { orgId: club.id, clubName: club.name });
    assert.deepEqual(f.reads, []);
  });
  for (const billingMode of ['org_team_addon', 'club_included', 'club_extra_team'] as const) {
    for (const subscriptionStatus of ['active', 'trialing', 'past_due'] as const) {
      it(`names the paying club for ${billingMode}, ${subscriptionStatus}`, async () => {
        const f = fixture({ ...linked, billingMode, subscriptionStatus });
        assert.deepEqual(await f.resolve(org, 'team'), { orgId: club.id, clubName: club.name });
        assert.deepEqual(f.reads, ['workspace', 'payer']);
      });
    }
  }
  const absent: Array<[string, TeamWorkspace | null]> = [
    ['missing workspace', null],
    ['another workspace', { ...linked, workspaceOrgId: 'other' }],
    ['direct payment or visibility-only link', { ...linked, billingMode: 'team_direct' }],
    ['staff free time', { ...linked, billingMode: 'platform_override' }],
    ['archived workspace', { ...linked, workspaceState: 'archived' }],
    ['moved workspace (its old address)', { ...linked, workspaceState: 'org_owned' }],
    ['missing club', { ...linked, billingOwnerOrgId: null }],
    ['self billing', { ...linked, billingOwnerOrgId: org.id }],
    ['cancelled coverage', { ...linked, subscriptionStatus: 'canceled' }],
    ['unpaid coverage', { ...linked, subscriptionStatus: 'unpaid' }],
    ['incomplete coverage', { ...linked, subscriptionStatus: 'incomplete' }],
    ['unknown coverage', { ...linked, subscriptionStatus: null }],
  ];
  for (const [name, workspace] of absent) it(`has no payer card for ${name}`, async () => {
    const f = fixture(workspace);
    assert.equal(await f.resolve(org, 'team'), null);
    assert.deepEqual(f.reads, ['workspace']);
  });
  for (const subject of [club, org]) it(`has no card for cancelled ${subject.id}`, async () => {
    const f = fixture();
    assert.equal(await f.resolve({ ...subject, subscriptionStatus: 'canceled' }, 'team'), null);
    assert.deepEqual(f.reads, []);
  });
  for (const row of [null, { ...payer, subscriptionStatus: 'canceled' as const },
    { ...payer, accountKind: org.accountKind, planId: org.planId }]) {
    it(`does not claim club payment when the payer is ${row?.subscriptionStatus ?? 'missing'}/${row?.planId ?? 'missing'}`, async () => {
      assert.equal(await fixture(linked, row).resolve(org, 'team'), null);
    });
  }
  it('propagates a failed payer lookup rather than claiming coverage', async () => {
    await assert.rejects(fixture(linked, null, new Error('database unavailable')).resolve(org, 'team'), /database unavailable/);
  });
  for (const subject of [club, org]) for (const role of ['owner', 'admin', 'coach', 'staff', null]) {
    it(`${subject.id}: ${role ?? 'no membership'} in the paying club gets the ruled card treatment`, async () => {
      const f = fixture(linked, payer, null, role);
      assert.deepEqual(await f.coverage(subject, 'team', 'coach'), role === 'owner' || role === 'admin'
        ? null : { clubName: club.name });
      assert.ok(f.reads.includes('member'));
    });
  }
  it('fails closed on an unreadable payer role', async () => {
    await assert.rejects(fixture(linked, payer, null, null, new Error('role read failed'))
      .coverage(org, 'team', 'coach'), /role read failed/);
  });
});

describe('the ruled coverage card', () => {
  const { default: Card } = billingTestLoader()('components/coaches/TeamPlanCoverageCard.tsx') as {
    default: ComponentType<{ clubName: string | null }>;
  };
  it('names the payer and portal, with no link, button or price', () => {
    const html = renderToStaticMarkup(createElement(Card, { clubName: club.name }));
    assert.ok(html.includes(W.coverage.title(club.name)));
    assert.ok(html.includes(W.coverage.body));
    assert.match(html, />Plan</);
    assert.doesNotMatch(html, /<(a|button|input)\b|\$|tabindex/i);
  });
  it('renders nothing without confirmed coverage', () => {
    assert.equal(renderToStaticMarkup(createElement(Card, { clubName: null })), '');
  });
  it('escapes a long club name as text', () => {
    const name = '<Riverdale & District Sports Association for the Entire Region>';
    const html = renderToStaticMarkup(createElement(Card, { clubName: name }));
    assert.ok(html.includes('&lt;Riverdale &amp; District'));
    assert.doesNotMatch(html, /<Riverdale/);
  });
  it('is the first settings card, before any collapsible settings group', () => {
    const page = readSource('app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx');
    assert.match(page, /<div className=\{styles\.settingsStack\}>\s*<TeamPlanCoverageCard clubName=\{data\.planCoverage\?\.clubName \?\? null\} \/>/);
  });
});

describe('settings API integration preserves the existing team access gate', () => {
  function routeFixture(allowed: boolean, coverage: { clubName: string } | Error | null, foreignTeam = false) {
    const reads: string[] = [];
    const load = billingTestLoader({
      '@/lib/api-auth': {
        getAuthContext: async (options: { orgSlug: string; requireOrgSlug: boolean }) => {
          assert.deepEqual(options, { orgSlug: club.slug, requireOrgSlug: true });
          return { org: club, user: { id: 'coach' } };
        },
        unauthorized: () => new Response(null, { status: 401 }), forbidden: () => new Response(null, { status: 403 }),
      },
      '@/lib/db': {
        getRepTeam: async () => ({ id: 'team', orgId: foreignTeam ? 'other' : club.id }),
        getActiveRepProgramYear: async () => ({ id: 'season', year: 2026, status: 'active' }),
        getSeasonName: async () => null,
      },
      '@/lib/coach-membership': {
        getEntitledTeamMembership: async () => allowed ? { coachRole: 'assistant_coach', showNamePublic: false } : null,
        resolveMembershipCapabilities: () => ({ isHeadCoach: false, money: 'off', scheduleManage: false }),
      },
      '@/lib/coach-club-book': { resolveClubBookAccessFor: () => ({ showTeamSwitch: false, teamSharing: false }) },
      '@/lib/public-club-access': { isPublicClubSiteOpen: () => false },
      '@/lib/module-entitlements': { hasModuleEntitlement: () => false },
      '@/lib/family-access': { isFamilyLayerEnabled: async () => false },
      '@/lib/team-plan-coverage': { getCoachTeamPlanCoverage: async (subject: Organization, teamId: string, userId: string) => {
        assert.equal(subject, club); assert.equal(teamId, 'team'); assert.equal(userId, 'coach');
        reads.push('coverage');
        if (coverage instanceof Error) throw coverage;
        return coverage;
      } },
      '@/lib/observability': { withObservability: (handler: unknown) => handler },
    });
    const { GET } = load('app/api/coaches/[orgSlug]/teams/[teamId]/route.ts') as {
      GET: (request: Request, context: { params: Promise<{ orgSlug: string; teamId: string }> }) => Promise<Response>;
    };
    return { run: () => GET(new Request('http://localhost/api/settings'), { params: Promise.resolve({ orgSlug: club.slug, teamId: 'team' }) }), reads };
  }
  for (const coverage of [null, { clubName: club.name }]) it(`serves coverage=${!!coverage} to an entitled assistant without widening their settings grants`, async () => {
    const f = routeFixture(true, coverage);
    const response = await f.run();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.planCoverage, coverage);
    assert.equal(body.capabilities.isHeadCoach, false);
    assert.deepEqual(f.reads, ['coverage']);
  });
  it('a failed payer or role read hides the card and keeps the rest of the settings', async () => {
    const logged: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { logged.push(args); };
    try {
      const f = routeFixture(true, new Error('role read failed'));
      const response = await f.run();
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.planCoverage, null);
      assert.equal(body.team.id, 'team');
      assert.equal(logged.length, 1);
    } finally {
      console.error = original;
    }
  });
  for (const foreignTeam of [false, true]) it(`never reads payer metadata for denied/foreign team access (${foreignTeam})`, async () => {
    const f = routeFixture(foreignTeam, { clubName: club.name }, foreignTeam);
    const response = await f.run();
    assert.equal(response.status, foreignTeam ? 404 : 403);
    assert.deepEqual(f.reads, []);
  });
});
