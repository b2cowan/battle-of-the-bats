import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { billingTestLoader } from './_billing-test-loader.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import { isTeamWorkspaceOrg } from '../../lib/team-workspace-kind.ts';
import type { UserAccessContext } from '../../lib/user-contexts.ts';

type JsonPost = (req: Request) => Promise<Response>;
const origin = process.env.NEXT_PUBLIC_APP_URL ?? '';

describe('checkout returns to an allowed destination in the same workspace', () => {
  const cases = [
    { standalone: true, returnTo: '/falcons/coaches/billing', expected: '/falcons/coaches/billing' },
    { standalone: true, returnTo: '/falcons/admin/tournaments/settings/subscription', expected: '/falcons/admin/tournaments/settings/subscription' },
    { standalone: true, returnTo: '//untrusted.test/falcons/coaches/billing', expected: '/falcons/coaches/billing' },
    { standalone: true, returnTo: 'https://untrusted.test/falcons/coaches/billing', expected: '/falcons/coaches/billing' },
    { standalone: true, returnTo: '/other/coaches/billing', expected: '/falcons/coaches/billing' },
    { standalone: true, returnTo: '/falcons/coaches/billing?next=https://untrusted.test', expected: '/falcons/coaches/billing' },
    { standalone: true, returnTo: '/falcons/coaches/teams/a', expected: '/falcons/coaches/billing' },
    { standalone: false, returnTo: '/falcons/coaches/billing', expected: '/falcons/admin/tournaments/settings/subscription' },
  ];
  for (const sample of cases) it(`${sample.standalone ? 'standalone' : 'organization'}: ${sample.returnTo}`, async () => {
    const checkout: Array<{ success_url: string; cancel_url: string }> = [];
    const org = { id: 'org-b', slug: 'falcons', planId: 'tournament', accountKind: sample.standalone ? 'team_workspace' : 'organization', subscriptionStatus: 'active' };
    const load = billingTestLoader({
      '@/lib/observability': { withObservability: (fn: unknown) => fn },
      '@/lib/api-auth': { getAuthContext: async () => ({ org, user: { id: 'owner', email: 'owner@example.test' } }), requireCapability: async () => null },
      '@/lib/billing-retention': {}, '@/lib/billing-reactivation': {},
      '@/lib/billing-mock': { isBillingMockEnabled: () => false, isStripeConfigured: () => true },
      '@/lib/founding-season': { foundingSeasonOfferOnPlanChoice: async () => false },
      '@/lib/plan-move': { hasLiveSubscription: () => false, hadSubscriptionBefore: async () => false },
      '@/lib/team-workspace-entitlements': { isTeamWorkspaceOrg },
      '@/lib/plan-config-db': { getPlanConfigOverride: async () => ({ ...PLAN_CONFIG.tournament_plus, trialDays: 0 }) },
      '@/lib/stripe-prices': { getStripePriceId: async () => 'price-b' },
      '@/lib/plan-gating-server': { getPlanGatingMap: async () => ({ tournament_plus: false }) },
      '@/lib/platform-events': {}, '@/lib/supabase-admin': {}, '@/lib/email': {}, '@/lib/platform-email-templates': {},
      '@/lib/email-sender': {}, '@/lib/unsubscribe-token': {},
      '@/lib/entitlement-grants': { ownPlanOf: () => 'tournament' },
      '@/lib/billing-setup': { ensureStripeCustomer: async () => 'cus_b' },
      '@/lib/stripe': { stripe: { checkout: { sessions: { create: async (params: typeof checkout[number]) => { checkout.push(params); return { url: 'https://stripe.test/checkout' }; } } } } },
    });
    const handler = (load('app/api/billing/create-checkout/route.ts') as { POST: JsonPost }).POST;
    const response = await handler(new Request('http://local/api/billing/create-checkout', {
      method: 'POST', body: JSON.stringify({ planKey: 'tournament_plus', orgSlug: org.slug, billingCycle: 'annual', returnTo: sample.returnTo }),
    }));
    assert.equal(response.status, 200);
    assert.equal(checkout[0].success_url, `${origin}${sample.expected}?success=1`);
    assert.equal(checkout[0].cancel_url, `${origin}${sample.expected}`);
  });
});

describe('pricing finds the standalone owner without inventing an Admin door', () => {
  function resolve(contexts: UserAccessContext[], adminHref: string | null = null) {
    const load = billingTestLoader({
      './db': {}, './supabase-admin': {}, './entitlement-grants': {}, './basic-coach-teams': {}, './fan-follows': {},
      './team-workspace-entitlements': { isTeamWorkspaceOrg }, './module-entitlements': {}, './house-league-coach': {}, './house-league-coach-invites': {},
    });
    const { getPrimaryOrgPlanContext } = load('lib/user-contexts.ts') as { getPrimaryOrgPlanContext: (contexts: UserAccessContext[], href: string | null) => { planId: string | null; billingHref: string | null } };
    return getPrimaryOrgPlanContext(contexts, adminHref);
  }
  const workspace = { id: 'coach-premium:b', kind: 'coaches_premium', isTeamWorkspace: true, orgSlug: 'falcons', title: 'Falcons Coaches Portal', planId: 'league', role: 'owner', destination: '/falcons/coaches', subtitle: '', detail: '', badgeLabel: 'Owner', sortOrder: 20 } satisfies UserAccessContext;
  it('uses the workspace identity even when a grant changed its effective plan', () => {
    assert.deepEqual(resolve([workspace]), { planId: 'league', billingHref: '/falcons/coaches/billing' });
    assert.equal(resolve([workspace]).billingHref?.split('/')[1], 'falcons');
  });
  it('offers no billing destination for a helper or a club-owned coach', () => {
    for (const role of ['admin', 'staff', 'coach']) assert.deepEqual(resolve([{ ...workspace, role }]), { planId: null, billingHref: null });
    assert.deepEqual(resolve([{ ...workspace, isTeamWorkspace: false }]), { planId: null, billingHref: null });
  });
  it('keeps an existing primary organization as the pricing context for a multi-workspace owner', () => {
    const organization = { ...workspace, id: 'org:c', kind: 'organization' as const, isTeamWorkspace: false, orgSlug: 'club', planId: 'club', destination: '/club/admin' };
    assert.deepEqual(resolve([organization, workspace], organization.destination), { planId: 'club', billingHref: '/club/admin/org/billing' });
  });
});
