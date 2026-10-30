import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import { getBillingHref, isTournamentTier } from '../../lib/billing-urls.ts';
import { hasCapability } from '../../lib/roles.ts';
import type { OrgPlan, OrgRole } from '../../lib/types.ts';
import { readCode } from './_source-code.ts';
import * as nextSeason from '../../lib/next-season-choice.ts';

const plans = Object.keys(PLAN_CONFIG) as OrgPlan[];
const roles: OrgRole[] = ['owner', 'admin', 'treasurer', 'staff', 'coach'];

describe('one admin billing host for every plan', () => {
  for (const planId of plans) it(`${planId}: both entry pages use the shared body or the standalone coach redirect`, async () => {
    const load = billingTestLoader({
      '@/lib/coach-portal-request': { getCoachPortalAuth: async () => ({ org: { slug: 'falcons', planId, accountKind: 'organization' } }) },
      'next/navigation': { permanentRedirect: (href: string) => { throw new Error(`308:${href}`); } },
      '@/lib/org-context': { useOrg: () => ({ currentOrg: { slug: 'falcons', planId } }) },
      '@/lib/usePageTitle': { usePageTitle() {} },
      '@/components/admin/AdminPageHeader': { __esModule: true, default: ({ eyebrow, title }: { eyebrow?: string; title: string }) => createElement('header', null, eyebrow && createElement('p', null, eyebrow), createElement('h1', null, title)) },
      '@/components/billing/BillingBody': { __esModule: true, default: ({ billingBase, teamsHref }: { billingBase: string; teamsHref: string }) => createElement('div', { 'data-billing': billingBase, 'data-teams': teamsHref }) },
    });
    for (const path of ['app/[orgSlug]/admin/org/billing/page.tsx', 'app/[orgSlug]/admin/tournaments/settings/subscription/page.tsx']) {
      const Page = (load(path) as { default: (props: {
        params: Promise<{ orgSlug: string }>;
        searchParams: Promise<Record<string, string>>;
      }) => Promise<ReactElement> }).default;
      const props = { params: Promise.resolve({ orgSlug: 'falcons' }), searchParams: Promise.resolve({}) };
      if (planId === 'team') {
        await assert.rejects(Page(props), { message: '308:/falcons/coaches/billing' });
        continue;
      }
      const html = renderToStaticMarkup(await Page(props));
      assert.match(html, /<h1>Plan &amp; billing<\/h1>/);
      assert.ok(html.includes(`data-billing="${getBillingHref({ slug: 'falcons', planId }, { host: 'admin' })}"`));
      assert.match(html, /data-teams="\/falcons\/admin\/rep-teams"/);
      assert.equal(html.includes('<p>Organization</p>'), !isTournamentTier(planId));
    }
  });

  for (const planId of plans) for (const role of roles) for (const billing of [false, true]) {
    it(`${planId}/${role}/billing=${billing}: the actual body gates before mounting any billing read`, () => {
      const load = billingTestLoader({
        '@/lib/org-context': { useOrg: () => ({ currentOrg: { id: 'org-b', name: 'Falcons', planId }, userRole: role, userCapabilities: { billing }, loading: false, refresh: async () => {} }) },
      });
      const Body = (load('components/billing/BillingBody.tsx') as { default: (props: { billingBase: string; teamsHref: string }) => ReturnType<typeof createElement> }).default;
      // Calling only the entry component executes no owner effects. A denied result is the locked card,
      // while an allowed result mounts the owner/action component with the explicit workspace identity.
      const element = Body({ billingBase: getBillingHref({ slug: 'falcons', planId }, { host: 'admin' }), teamsHref: '/falcons/admin/rep-teams' });
      if (hasCapability(role, { billing }, 'billing')) {
        assert.equal((element.props as { org: { id: string } }).org.id, 'org-b');
      } else {
        const html = renderToStaticMarkup(element);
        assert.match(html, /Billing access required/);
        assert.doesNotMatch(html, /<button|<a |CAD|billing-manage-btn/);
      }
    });
  }
  it('the legacy component and stylesheet have no remaining runtime references', () => {
    const page = readCode('app/[orgSlug]/admin/org/billing/page.tsx');
    assert.doesNotMatch(page, /BillingPagePlans|isClubPlan|billing\.module\.css/);
  });
});

type JsonPost = (req: Request) => Promise<Response>;
const post = (body: unknown) => new Request('http://local/api/billing', { method: 'POST', body: JSON.stringify(body) });
const origin = process.env.NEXT_PUBLIC_APP_URL ?? '';

describe('Stripe and mock returns keep every plan inside its billing tier boundary', () => {
  for (const planId of plans) for (const mock of [true, false]) it(`${planId}/${mock ? 'mock' : 'Stripe'}: portal, card and no-customer fallback`, async () => {
    const authCalls: unknown[] = [], capabilityCalls: unknown[] = [], portalCalls: Array<{ return_url: string }> = [], setups: unknown[] = [];
    const org = { id: 'org-b', slug: 'falcons', planId, stripeCustomerId: 'cus_b' as string | null, accountKind: 'organization' };
    const load = billingTestLoader({
      '@/lib/observability': { withObservability: (fn: unknown) => fn },
      '@/lib/api-auth': {
        getAuthContext: async (input: unknown) => { authCalls.push(input); return { org, user: { email: 'billing@example.test' } }; },
        requireCapability: async (_ctx: unknown, capability: string) => { capabilityCalls.push(capability); return null; },
        unauthorized: () => new Response(null, { status: 401 }),
      },
      '@/lib/billing-mock': { isBillingMockEnabled: () => mock, isStripeConfigured: () => true },
      '@/lib/billing-setup': { createCardSetupSession: async (input: unknown) => { setups.push(input); return 'https://stripe.test/setup'; } },
      '@/lib/stripe': { stripe: { billingPortal: { sessions: { create: async (params: { return_url: string }) => { portalCalls.push(params); return { url: 'https://stripe.test/portal' }; } } } } },
    });
    const portal = (load('app/api/billing/portal/route.ts') as { POST: JsonPost }).POST;
    const card = (load('app/api/billing/setup-payment-method/route.ts') as { POST: JsonPost }).POST;
    const base = getBillingHref(org, { purpose: 'return' });
    const portalResponse = await portal(post({ orgSlug: org.slug, returnTo: '//untrusted.test' }));
    assert.equal(portalResponse.status, 200);
    assert.equal((await portalResponse.json()).url, mock ? `${origin}${base}${planId === 'team' ? '' : '/mock-portal'}` : 'https://stripe.test/portal');
    if (!mock) assert.equal(portalCalls[0].return_url, `${origin}${base}`);
    const cardResponse = await card(post({ orgSlug: org.slug }));
    assert.equal((await cardResponse.json()).url, mock ? `${origin}${base}?card_saved=1` : 'https://stripe.test/setup');
    org.stripeCustomerId = null;
    await portal(post({ orgSlug: org.slug }));
    if (!mock) assert.deepEqual(setups, [org, org]);
    assert.deepEqual(capabilityCalls, ['billing', 'billing', 'billing']);
    assert.ok(authCalls.every(input => JSON.stringify(input) === JSON.stringify({ orgSlug: 'falcons', allowSuspendedOrg: true })));
  });

  for (const planId of plans) it(`${planId}: real card setup uses the resolver for both checkout exits`, async () => {
    const calls: Array<{ mode: string; success_url: string; cancel_url: string }> = [];
    const load = billingTestLoader({
      '@/lib/supabase-admin': {},
      '@/lib/stripe': { stripe: { checkout: { sessions: { create: async (params: typeof calls[number]) => { calls.push(params); return { url: 'https://stripe.test/setup' }; } } } } },
    });
    const { createCardSetupSession } = load('lib/billing-setup.ts') as { createCardSetupSession: (org: unknown, email: string) => Promise<string> };
    await createCardSetupSession({ id: 'org-b', slug: 'falcons', planId, stripeCustomerId: 'cus_b', accountKind: 'organization' }, 'billing@example.test');
    assert.equal(calls[0].mode, 'setup');
    assert.equal(calls[0].success_url, `${origin}${getBillingHref({ slug: 'falcons', planId }, { purpose: 'return' })}?card_saved=1`);
    assert.equal(calls[0].cancel_url, `${origin}${getBillingHref({ slug: 'falcons', planId }, { purpose: 'return' })}`);
  });

  it('the mock portal returns according to the refreshed plan, and scopes its apply request', () => {
    const mock = readCode('app/[orgSlug]/admin/org/billing/mock-portal/MockPortalClient.tsx');
    assert.match(mock, /router\.push\(getBillingHref\(currentOrg, \{ purpose: 'return' \}\)\)/);
    assert.match(mock, /JSON\.stringify\(\{ orgSlug: currentOrg\?\.slug, plan, status \}\)/);
    assert.match(readCode('app/[orgSlug]/admin/tournaments/settings/subscription/mock-portal/page.tsx'), /export \{ default \} from/);
  });

  for (const planId of ['tournament_plus', 'team'] as const) for (const effectivePlan of [planId, 'league'] as const) for (const mock of [true, false]) it(`${planId}/${effectivePlan}/${mock ? 'mock' : 'Stripe'}: next-season buys the own plan and returns through the effective tier boundary`, async () => {
    const checkout: Array<{ success_url: string; cancel_url: string }> = [];
    const db = { from(table: string) {
      const query = { select() { return query; }, eq() { return query; }, in() { return query; }, is() { return query; }, limit() { return query; },
        maybeSingle: async () => ({ data: table === 'org_overrides' ? { id: 'comp-b' } : null }) };
      return query;
    } };
    const load = billingTestLoader({
      '@/lib/observability': { withObservability: (fn: unknown) => fn },
      '@/lib/api-auth': { getAuthContext: async () => ({ org: { id: 'org-b', slug: 'falcons', planId: effectivePlan, ownPlanId: planId, accountKind: planId === 'team' ? 'team_workspace' : 'organization' }, user: { email: 'billing@example.test' } }), requireCapability: async () => null },
      '@/lib/founding-season': { foundingCompAppliesToPlan: () => true },
      '@/lib/entitlement-grants': { ownPlanOf: (org: { ownPlanId: string }) => org.ownPlanId },
      '@/lib/supabase-admin': { supabaseAdmin: db },
      '@/lib/billing-mock': { isBillingMockEnabled: () => mock, isStripeConfigured: () => true },
      '@/lib/billing-setup': { ensureStripeCustomer: async () => 'cus_b', recordNextSeasonChoice: async () => {}, getOrgBillingFacts: async () => null },
      '@/lib/plan-gating-server': { getPlanGatingMap: async () => ({ tournament_plus: false, team: false }) },
      '@/lib/stripe-prices': { getStripePriceId: async () => 'price_b' },
      '@/lib/next-season-choice': { ...nextSeason, isNextSeasonChoiceOpen: () => true },
      '@/lib/stripe': { stripe: { checkout: { sessions: { create: async (params: typeof checkout[number]) => { checkout.push(params); return { url: 'https://stripe.test/next' }; } } } } },
    });
    const handler = (load('app/api/billing/choose-next-season/route.ts') as { POST: JsonPost }).POST;
    const response = await handler(post({ orgSlug: 'falcons', planKey: planId, billingCycle: 'annual' }));
    assert.equal(response.status, 200);
    const base = `${origin}${getBillingHref({ slug: 'falcons', planId: effectivePlan, accountKind: planId === 'team' ? 'team_workspace' : 'organization' }, { purpose: 'return' })}`;
    if (mock) assert.equal((await response.json()).url, `${base}?next_season=1`);
    else { assert.equal(checkout[0].success_url, `${base}?next_season=1`); assert.equal(checkout[0].cancel_url, base); }
  });
});

describe('billing and settings can never be handed out (owner, 2026-10-29)', () => {
  async function patch(role: OrgRole, capabilities: Record<string, boolean> | null, grant: Record<string, boolean> | null, stored: Record<string, boolean> | null = null) {
    const writes: unknown[] = [], audits: unknown[] = [];
    const db = {
      auth: { admin: { getUserById: async () => ({ data: { user: null } }) } },
      from(table: string) {
        assert.equal(table, 'organization_members');
        const query = {
          select() { return query; }, eq() { return query; },
          single: async () => ({ data: { id: 'member-b', role: 'treasurer', user_id: 'member-user', capabilities: stored, status: 'active' } }),
          update(value: unknown) { writes.push(value); return query; },
          then(resolve: (value: unknown) => unknown) { return Promise.resolve({ error: null }).then(resolve); },
        };
        return query;
      },
    };
    const load = billingTestLoader({
      'next/server': { NextResponse: Response },
      '@/lib/api-auth': { getAuthContextWithRole: async () => ({ role, capabilities, user: { id: 'viewer-user' }, org: { id: 'org-b', name: 'Falcons', planId: 'club', subscriptionStatus: 'active', enabledAddons: [] } }), GROUP_UNSCOPED_ROLES: ['owner', 'admin', 'treasurer'], forbidden: () => new Response(null, { status: 403 }) },
      '@/lib/supabase-admin': { supabaseAdmin: db },
      '@/lib/observability': { withObservability: (fn: unknown) => fn },
      '@/lib/board-roles': {}, '@/lib/org-membership-policy': {}, '@/lib/basic-coach-teams': {}, '@/lib/email': {},
      '@/lib/org-audit': { writeOrgAudit: async (...args: unknown[]) => { audits.push(args); } },
    });
    const { PATCH } = load('app/api/admin/members/[memberId]/route.ts') as { PATCH: (req: Request, ctx: { params: Promise<{ memberId: string }> }) => Promise<Response> };
    const response = await PATCH(new Request('http://local/api/admin/members/member-b?orgSlug=falcons', { method: 'PATCH', body: JSON.stringify({ capabilities: grant }) }), { params: Promise.resolve({ memberId: 'member-b' }) });
    return { response, writes, audits };
  }
  it('even the owner cannot grant billing or settings: the request is refused and nothing is written', async () => {
    const billing = await patch('owner', null, { billing: true });
    assert.equal(billing.response.status, 400); assert.deepEqual(billing.writes, []); assert.deepEqual(billing.audits, []);
    const settings = await patch('owner', null, { org_settings: true });
    assert.equal(settings.response.status, 400); assert.deepEqual(settings.writes, []);
  });
  it('a mixed body is refused whole, with no partial write', async () => {
    const mixed = await patch('owner', null, { module_accounting: true, billing: true });
    assert.equal(mixed.response.status, 400); assert.deepEqual(mixed.writes, []); assert.deepEqual(mixed.audits, []);
  });
  it('a stale stored grant never blocks the editor and is dropped on save, never stored again', async () => {
    const saved = await patch('owner', null, { billing: true, module_accounting: true }, { billing: true });
    assert.equal(saved.response.status, 200); assert.deepEqual(saved.writes, [{ capabilities: { module_accounting: true } }]);
    const fresh = await patch('owner', null, { billing: true, module_accounting: true }, { module_accounting: true });
    assert.equal(fresh.response.status, 400); assert.deepEqual(fresh.writes, []);
  });
  it('a body of owner-only revokes changes nothing instead of clearing every override', async () => {
    const revoke = await patch('owner', null, { billing: false }, { module_accounting: true });
    assert.equal(revoke.response.status, 200); assert.deepEqual(revoke.writes, []); assert.deepEqual(revoke.audits, []);
  });
  it('the owner can still clear a member’s overrides, and an admin cannot change access at all', async () => {
    const cleared = await patch('owner', null, null);
    assert.equal(cleared.response.status, 200); assert.deepEqual(cleared.writes, [{ capabilities: null }]);
    const denied = await patch('admin', { billing: true }, { billing: true });
    assert.equal(denied.response.status, 403); assert.deepEqual(denied.writes, []);
  });
});
