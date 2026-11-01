import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ourPortalConfigurationId, resetPortalConfigurationCache } from '../../lib/stripe-portal-config.ts';
import { PORTAL_CONFIG_KEY, PORTAL_CONFIG_VERSION, PORTAL_FEATURES } from '../../lib/stripe-portal-settings.ts';
import { filesUnder, readCode } from './_source-code.ts';

/**
 * Plans & pricing Stage 0, Part 3 (S8): the app creates and pins its own Stripe customer-portal configuration, so a
 * dashboard toggle can no longer change what a customer may do there. Prompt: docs/projects/active/PLANS_PRICING_STAGE0_BUILD_PROMPT.md.
 */

type Config = { id: string; active: boolean; metadata: Record<string, string> };

function fakeStripe(existing: Config[], opts: { listFails?: boolean } = {}) {
  const calls = { list: 0, created: [] as Array<{ features?: unknown; metadata?: unknown }>, deactivated: [] as string[] };
  const configs = [...existing];
  const stripe = {
    billingPortal: {
      configurations: {
        list: (params: { active?: boolean }) => {
          calls.list++;
          return (async function* () {
            if (opts.listFails) throw new Error('Stripe is down');
            yield* configs.filter(c => params.active === undefined || c.active === params.active) as never[];
          })();
        },
        create: async (params: { features?: unknown; metadata?: unknown }) => {
          calls.created.push(params);
          const made = { id: `bpc_new_${calls.created.length}`, active: true, metadata: params.metadata as Record<string, string> };
          configs.push(made);
          return made as never;
        },
        update: async (id: string, params: { active?: boolean }) => {
          if (params.active === false) calls.deactivated.push(id);
          return { id } as never;
        },
      },
    },
  };
  return { stripe, calls };
}

const ours = (id: string, version: string): Config => ({ id, active: true, metadata: { [PORTAL_CONFIG_KEY]: version } });
const dashboardDefault: Config = { id: 'bpc_dashboard', active: true, metadata: {} };

describe('our pinned portal configuration', () => {
  beforeEach(() => resetPortalConfigurationCache());

  it('none of ours yet: it is created with our settings, and the dashboard default is left alone', async () => {
    const { stripe, calls } = fakeStripe([dashboardDefault]);
    assert.equal(await ourPortalConfigurationId(stripe), 'bpc_new_1');
    assert.equal(calls.created.length, 1);
    assert.deepEqual(calls.created[0].features, PORTAL_FEATURES);
    assert.deepEqual(calls.created[0].metadata, { [PORTAL_CONFIG_KEY]: PORTAL_CONFIG_VERSION });
    assert.deepEqual(calls.deactivated, []);
  });

  it('ours at this version exists: it is reused, nothing created', async () => {
    const { stripe, calls } = fakeStripe([dashboardDefault, ours('bpc_ours', PORTAL_CONFIG_VERSION)]);
    assert.equal(await ourPortalConfigurationId(stripe), 'bpc_ours');
    assert.equal(calls.created.length, 0);
  });

  it('only an older version of ours: a new one is created and the old one switched off, never edited', async () => {
    const { stripe, calls } = fakeStripe([ours('bpc_old', '0')]);
    assert.equal(await ourPortalConfigurationId(stripe), 'bpc_new_1');
    assert.deepEqual(calls.deactivated, ['bpc_old']);
  });

  it('asks Stripe once per process and mode, even for two portals opened at the same moment', async () => {
    const { stripe, calls } = fakeStripe([ours('bpc_ours', PORTAL_CONFIG_VERSION)]);
    const [a, b] = await Promise.all([ourPortalConfigurationId(stripe), ourPortalConfigurationId(stripe)]);
    assert.equal(a, 'bpc_ours');
    assert.equal(b, 'bpc_ours');
    await ourPortalConfigurationId(stripe);
    assert.equal(calls.list, 1);
  });

  it('a failure throws (no fallback to the dashboard default) and is not remembered', async () => {
    const broken = fakeStripe([], { listFails: true });
    await assert.rejects(ourPortalConfigurationId(broken.stripe), /Stripe is down/);
    const working = fakeStripe([ours('bpc_ours', PORTAL_CONFIG_VERSION)]);
    assert.equal(await ourPortalConfigurationId(working.stripe), 'bpc_ours');
  });
});

describe('what our portal offers (owner ruling 2026-10-31; GST/HST Stage 2)', () => {
  it('cancel at period end, no plan switching', () => {
    assert.deepEqual(PORTAL_FEATURES.subscription_cancel, { enabled: true, mode: 'at_period_end', proration_behavior: 'none' });
    assert.deepEqual(PORTAL_FEATURES.subscription_update, { enabled: false });
  });
  it('card, invoices, and name, email, address and tax ID', () => {
    assert.equal(PORTAL_FEATURES.payment_method_update?.enabled, true);
    assert.equal(PORTAL_FEATURES.invoice_history?.enabled, true);
    assert.deepEqual([...(PORTAL_FEATURES.customer_update?.allowed_updates as string[])].sort(), ['address', 'email', 'name', 'tax_id']);
  });
});

describe('every portal session names our configuration', () => {
  it('the portal route passes it, and refuses rather than falling back', () => {
    const route = readCode('app/api/billing/portal/route.ts');
    assert.match(route, /configuration = await ourPortalConfigurationId\(stripe\)/);
    assert.match(route, /billingPortal\.sessions\.create\(\{[^}]*\n\s*configuration,/);
  });
  it('no other file opens a portal session', () => {
    const openers = ['app', 'lib', 'components']
      .flatMap(dir => ['.ts', '.tsx'].flatMap(ext => filesUnder(dir, ext)))
      .filter(f => /billingPortal\.sessions\.create/.test(readCode(f)));
    assert.deepEqual(openers, ['app/api/billing/portal/route.ts']);
  });
});
