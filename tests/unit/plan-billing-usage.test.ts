import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { billingTestLoader } from './_billing-test-loader.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import type { Organization } from '../../lib/types.ts';
import type { BillingUsage } from '../../lib/plan-billing-data.ts';
import { readCode } from './_source-code.ts';

describe('owner billing usage read', () => {
  function route(role: string | null, fail = false, capabilities: Record<string, boolean> | null = null) {
    const authCalls: unknown[] = [], reads: unknown[] = [];
    const load = billingTestLoader({
      '@/lib/api-auth': {
        getAuthContextWithRole: async (input: { orgSlug?: string; requireOrgSlug: boolean; allowSuspendedOrg: boolean }) => {
          authCalls.push(input);
          return role && input.orgSlug === 'org-b' ? { role, capabilities, org: { id: 'b', slug: 'org-b', subscriptionStatus: 'canceled' } } : null;
        }, forbidden: () => new Response(null, { status: 403 }), unauthorized: () => new Response(null, { status: 401 }),
      },
      '@/lib/billing-usage': { readBillingUsage: async (org: unknown) => { reads.push(org); if (fail) throw new Error('DB unavailable'); return { teams: { count: 7, limit: 21 } }; } },
      '@/lib/observability': { withObservability: (handler: unknown) => handler },
    });
    const { GET } = load('app/api/billing/usage/route.ts') as { GET: (req: Request) => Promise<Response> };
    return { GET, authCalls, reads };
  }
  it('requires explicit org scope and authentication, never falling back to a home org', async () => {
    const r = route('owner'); assert.equal((await r.GET(new Request('http://local/api/billing/usage'))).status, 401);
    assert.equal(r.reads.length, 0);
    assert.deepEqual(r.authCalls[0], { orgSlug: undefined, requireOrgSlug: true, allowSuspendedOrg: true });
    assert.equal((await route(null).GET(new Request('http://local/api/billing/usage?orgSlug=org-b'))).status, 401);
  });
  for (const role of ['admin', 'staff', 'coach', 'treasurer']) it(`${role} cannot read billing counts`, async () => {
    const r = route(role); assert.equal((await r.GET(new Request('http://local/api/billing/usage?orgSlug=org-b'))).status, 403); assert.equal(r.reads.length, 0);
  });
  it('a suspended owner reads only the requested organization, with no PII and no caching', async () => {
    const r = route('owner'), response = await r.GET(new Request('http://local/api/billing/usage?orgSlug=org-b'));
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(r.reads, [{ id: 'b', slug: 'org-b', subscriptionStatus: 'canceled' }]);
    assert.deepEqual(await response.json(), { teams: { count: 7, limit: 21 } });
    assert.equal((await r.GET(new Request('http://local/api/billing/usage?orgSlug=org-a'))).status, 401);
  });
  it('a failed count returns unavailable, never zero', async () => {
    const response = await route('owner', true).GET(new Request('http://local/api/billing/usage?orgSlug=org-b'));
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'Billing usage could not be read. Try again.' });
  });
  it('an explicit billing grant permits suspended comeback reads; revoking it closes them', async () => {
    for (const billing of [true, false]) {
      const r = route('treasurer', false, { billing });
      assert.equal((await r.GET(new Request('http://local/api/billing/usage?orgSlug=org-b'))).status, billing ? 200 : 403);
      assert.equal(r.reads.length, billing ? 1 : 0);
    }
  });
});

describe('billing counts follow enforcement and effective limits', () => {
  async function read(planId: Organization['planId'], broken?: 'error' | 'null') {
    const queries: { table: string; filters: unknown[][]; select?: unknown[] }[] = [];
    const db = { from(table: string) {
      const record = { table, filters: [] as unknown[][], select: undefined as unknown[] | undefined }; queries.push(record);
      const query = {
        select: (...args: unknown[]) => { record.select = args; return query; },
        eq: (...args: unknown[]) => { record.filters.push(['eq', ...args]); return query; },
        in: (...args: unknown[]) => { record.filters.push(['in', ...args]); return query; },
        not: (...args: unknown[]) => { record.filters.push(['not', ...args]); return query; },
        then: (done: (value: unknown) => unknown) => Promise.resolve({ count: broken === 'null' ? null : table === 'tournaments' ? 2 : 5, error: broken === 'error' ? new Error('failed') : null }).then(done),
      };
      return query;
    } };
    let teamOrg: string | undefined;
    const load = billingTestLoader({ './supabase-admin': { supabaseAdmin: db }, './db': { getNonArchivedRepTeamCount: async (id: string) => { teamOrg = id; return 8; } } });
    const service = load('lib/billing-usage.ts') as { readBillingUsage: (org: Organization) => Promise<BillingUsage> };
    const result = await service.readBillingUsage({ id: 'b', planId, tournamentLimit: 7, teamLimit: 21 } as Organization);
    return { result, queries, teamOrg };
  }
  it('uses effective org caps, only draft/active slots, and the actual team enforcement source', async () => {
    const { result, queries, teamOrg } = await read('club');
    assert.equal(teamOrg, 'b'); assert.deepEqual(result.teams, { count: 8, limit: 21 }); assert.deepEqual(result.tournament_slots, { count: 2, limit: 7 });
    assert.equal(result.staff_seats.limit, PLAN_CONFIG.club.seatLimit);
    for (const query of queries) { assert.deepEqual(query.select, ['id', { count: 'exact', head: true }]); assert.ok(query.filters.some(f => f[0] === 'eq' && f[2] === 'b')); }
    assert.ok(queries[0].filters.some(f => f[0] === 'in' && f[1] === 'status' && JSON.stringify(f[2]) === '["draft","active"]'));
    const teamCount = readCode('lib/db.ts').split('export async function getNonArchivedRepTeamCount')[1].split('\n}')[0];
    assert.match(teamCount, /\.eq\('org_id', orgId\)/); assert.match(teamCount, /\.eq\('is_archived', false\)/); assert.match(teamCount, /if \(error\) throw error/);
  });
  it('coaches and free officials are exempt exactly as in invite enforcement', async () => {
    const { queries } = await read('tournament');
    assert.ok(queries[1].filters.some(f => JSON.stringify(f) === '["not","role","in","(coach,official)"]'));
    assert.match(readCode('app/api/admin/members/invite/route.ts'), /seatExemptRoles\(planCfg\)/);
  });
  for (const failure of ['error', 'null'] as const) it(`${failure} counts reject instead of returning an empty meter`, async () => {
    await assert.rejects(read('club', failure), /could not be read/);
  });
  it('cancellation uses the same active-team source, held plan, add-ons and short projection', () => {
    const src = readCode('lib/billing-retention.ts'); assert.match(src, /billingActiveTeamCount\(org\.id\)/);
    assert.match(src, /shortOrganizationShutdownAreas\(PLAN_CONFIG\[ownPlanOf\(org\)\], org\.enabledAddons, activeTeams\)/);
  });
});

describe('billing free time never confuses an old ended grant or a read failure with cancellation', () => {
  function freeTimeRoute(failure: boolean, role = 'owner', capabilities: Record<string, boolean> | null = null) {
    const load = billingTestLoader({
      'next/server': { NextResponse: Response },
      '@/lib/api-auth': { getAuthContextWithRole: async () => ({ role, capabilities, org: { id: 'b', accountKind: 'team_workspace' } }), unauthorized: () => new Response(null, { status: 401 }), forbidden: () => new Response(null, { status: 403 }) },
      '@/lib/observability': { withObservability: (handler: unknown) => handler },
      '@/lib/supabase-admin': {},
      '@/lib/entitlement-grants': {},
      '@/lib/portal-free-time-server': {
        customerPortalFreeTime: async () => { if (failure) throw new Error('No read'); return null; },
        endedPortalFreeTime: async () => ({ lastDay: '2026-01-01', basicTeamId: 'private-id' }),
      },
    });
    return (load('app/api/admin/org/free-time/route.ts') as { GET: (request: Request) => Promise<Response> }).GET;
  }
  it('billing keeps the ended state beyond the informational 30-day band, without leaking team ids', async () => {
    const response = await freeTimeRoute(false)(new Request('http://local/api/admin/org/free-time?orgSlug=org-b&billing=1'));
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { freeTime: null, overLimitAfter: false, foundingThrough: null, portal: { state: 'ended', lastDay: '2026-01-01' } });
  });
  it('a failed billing read is unavailable, while other consumers keep their existing informational behavior', async () => {
    const get = freeTimeRoute(true);
    assert.equal((await get(new Request('http://local/api/admin/org/free-time?orgSlug=org-b&billing=1'))).status, 503);
    assert.equal((await get(new Request('http://local/api/admin/org/free-time?orgSlug=org-b'))).status, 200);
  });
  it('the extended billing read requires billing access', async () => {
    assert.equal((await freeTimeRoute(false, 'coach')(new Request('http://local/api/admin/org/free-time?orgSlug=org-b&billing=1'))).status, 403);
    assert.equal((await freeTimeRoute(false, 'treasurer', { billing: true })(new Request('http://local/api/admin/org/free-time?orgSlug=org-b&billing=1'))).status, 200);
  });
});
