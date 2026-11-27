import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import { billingTestLoader } from './_billing-test-loader.ts';
import { normalizeBillingCycle } from '../../lib/plan-config.ts';
import { readCode } from './_source-code.ts';

/**
 * Stripe's later changes reach a live, self-paid Premium Coaches Portal (2026-11-27). The one-portal guard used to answer
 * a portal's OWN subscription "already exists" before anything synced it, so its status, renewal date and billing cycle
 * froze at the first purchase. These drive the real webhook handler into an in-memory database, so a change that stops
 * short of the record again fails here.
 */

type Row = Record<string, unknown>;

/** Just enough of the database client: equality filters, a single row, updates; `failOn` makes one table's write fail. */
function fakeDb(tables: Record<string, Row[]>, failOn: { table?: string } = {}) {
  const writes: string[] = [];
  return {
    tables, writes,
    from(table: string) {
      const filters: Array<(r: Row) => boolean> = [];
      let patch: Row | null = null;
      const run = () => {
        const rows = (tables[table] ??= []).filter(r => filters.every(f => f(r)));
        if (patch) {
          if (failOn.table === table) return { data: null, error: { message: `write to ${table} failed` } };
          writes.push(table);
          rows.forEach(r => Object.assign(r, patch));
        }
        return { data: rows, error: null };
      };
      const query = {
        select: () => query,
        update(p: Row) { patch = p; return query; },
        eq(c: string, v: unknown) { filters.push(r => r[c] === v); return query; },
        neq(c: string, v: unknown) { filters.push(r => r[c] !== v); return query; },
        in(c: string, v: unknown[]) { filters.push(r => v.includes(r[c])); return query; },
        is(c: string, v: unknown) { filters.push(r => (r[c] ?? null) === v); return query; },
        not: () => query,
        or: () => query,
        order: () => query,
        limit: () => query,
        // A copy, as a real read is: a later write must not change what was read before it.
        async maybeSingle() { const r = run(); return { data: r.data?.[0] ? { ...r.data[0] } : null, error: r.error }; },
        then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) { return Promise.resolve(run()).then(resolve, reject); },
      };
      return query;
    },
  };
}

const OLD_END = '2026-12-01T00:00:00.000Z';
const NEW_END_UNIX = Date.parse('2027-12-01T00:00:00.000Z') / 1000;
const NEW_END = '2027-12-01T00:00:00.000Z';

const metadata = { checkoutKind: 'standalone_team', ownerUserId: 'u1', ownerEmail: 'coach@example.test', teamName: 'Falcons', workspaceName: 'Falcons', seasonName: '2027', billingCycle: 'monthly' };

function subscription(over: { id?: string; status?: string; price?: string; periodEnd?: number | null; metadata?: Record<string, string> } = {}) {
  return {
    id: over.id ?? 'sub_1', status: over.status ?? 'active', customer: 'cus_1', metadata: over.metadata ?? metadata,
    cancel_at_period_end: false, cancel_at: null, latest_invoice: 'in_1',
    items: { data: [{ id: 'si_new', current_period_end: over.periodEnd === undefined ? NEW_END_UNIX : over.periodEnd, price: { id: over.price ?? 'price_annual', unit_amount: 19900, currency: 'cad' } }] },
  };
}

function records(over: { status?: string; orgStatus?: string; entitlement?: string; state?: string } = {}) {
  return {
    team_workspaces: [{ id: 'ws1', workspace_org_id: 'org1', rep_team_id: 'team1', billing_mode: 'team_direct', workspace_state: over.state ?? 'independent', stripe_subscription_id: 'sub_1', stripe_customer_id: 'cus_1', subscription_status: over.status ?? 'active', current_period_end: OLD_END }] as Row[],
    organizations: [{ id: 'org1', subscription_status: over.orgStatus ?? 'active', subscription_period: null, stripe_subscription_id: 'sub_1', stripe_customer_id: 'cus_1', current_period_end: OLD_END }] as Row[],
    team_entitlements: [{ id: 'ent1', team_workspace_id: 'ws1', status: over.entitlement ?? 'active', stripe_subscription_item_id: 'si_old' }] as Row[],
  };
}

function rig(opts: { db?: ReturnType<typeof records>; sub?: ReturnType<typeof subscription>; inForce?: boolean; failOn?: string; afterInForce?: (tables: ReturnType<typeof records>) => void } = {}) {
  const sub = opts.sub ?? subscription();
  const tables = opts.db ?? records();
  const failOn = { table: opts.failOn };
  const db = fakeDb(tables, failOn);
  const events: Array<Record<string, unknown>> = [];
  const emails: unknown[] = [];
  const provisioned: Array<Record<string, unknown>> = [];
  const nothing = async () => null;
  const platformEvents = {
    writePlatformEvent: async (e: Record<string, unknown>) => { events.push(e); },
    writeGrowthEvent: async () => {},
    isPastDueTransition: (a?: string | null, b?: string | null) => a !== 'past_due' && b === 'past_due',
    isRecoveryTransition: (a?: string | null, b?: string | null) => (a === 'past_due' || a === 'canceled') && (b === 'active' || b === 'trialing'),
  };
  const supabase = { supabaseAdmin: db };
  const email = { sendEmail: async (...a: unknown[]) => { emails.push(a); return { status: 'sent' }; }, teamWorkspaceWelcomeHtml: () => '', welcomeBackHtml: () => '', trialEndingHtml: () => '', escapeHtml: (s: string) => s, SITE_URL: 'http://x', ADMIN_EMAIL: 'a@x' };
  const stripe = { stripe: { subscriptions: { retrieve: async () => sub }, customers: { retrieve: async () => ({ deleted: true }), update: async () => {} } } };
  const prices = { getPlanFromPriceId: async (id: string) => ({ planId: 'team', billingCycle: id === 'price_annual' ? 'annual' : 'monthly', retired: false }) };
  const inForce = { workspacesInForce: async (ids: string[]) => { opts.afterInForce?.(tables); return new Set(opts.inForce === false ? [] : ids); } };
  const overrides: Record<string, unknown> = {
    './supabase-admin': supabase, '@/lib/supabase-admin': supabase,
    './platform-events': platformEvents, '@/lib/platform-events': platformEvents,
    './email': email, '@/lib/email': email,
    './portal-in-force-server': inForce,
    '@/lib/stripe': stripe, '@/lib/stripe-prices': prices,
    // The owner's one live portal: this one while it is in force. This is the guard that used to swallow the update.
    './team-workspace-owned': { getActiveOwnedTeamWorkspace: async () => (opts.inForce === false ? { workspaceOrgId: 'org-other', orgSlug: 'other' } : { workspaceOrgId: 'org1', orgSlug: 'falcons' }) },
    './team-workspace-provisioning': { provisionStandaloneTeamWorkspace: async (i: Record<string, unknown>) => { provisioned.push(i); return { org: { id: 'org-new', slug: 'new' }, teamWorkspaceId: 'ws-new' }; }, TeamWorkspaceProvisioningError: Error },
    './team-workspace-claims': { assertTeamWorkspaceClaimAvailableForProvisioning: nothing, markTeamWorkspaceClaimed: nothing },
    './portal-keep-premium': { findKeepPremiumPortal: nothing, convertFreeTimePortal: nothing },
    './portal-retained-restore': { restoreCoachesPortalRetainedRecords: nothing },
    '@/lib/plan-ending': { endingForDeletedSubscription: nothing, recordStripeSignal: nothing },
    '@/lib/plan-ending-server': { endingAccountForSubscription: nothing, endingDeps: {}, readEndingAccount: nothing, readPendingEnding: nothing, withdrawPendingEnding: nothing },
  };
  // Everything else the handler imports is not reached by these events: an empty module stands in.
  for (const spec of ['@/lib/billing-retention', '@/lib/team-org-billing', '@/lib/billing-setup', '@/lib/billing-location-server', '@/lib/plan-move', '@/lib/workspace-upgrade', '@/lib/billing-reactivation', '@/lib/stripe-mode', '@/lib/stripe-subscription-charges', '@/lib/platform-email-templates', '@/lib/email-sender', '@/lib/notify', '@/lib/charge-tax-record-server', '@/lib/notify-recipients', '@/lib/needs-attention', '@/lib/billing-urls', '@/lib/purchase-details-server', '@/lib/stray-subscription-alert']) {
    overrides[spec] = { isSubscriptionChargeEvent: () => false };
  }
  overrides['@/lib/stripe-subscription-charges'] = { isSubscriptionChargeEvent: () => false, handleSubscriptionChargeEvent: nothing };
  const load = billingTestLoader(overrides);
  const handler = load('lib/billing-webhook-handler.ts') as typeof import('../../lib/billing-webhook-handler.ts');
  const deliver = (type = 'customer.subscription.updated') => handler.runVerifiedBillingEvent({
    id: 'evt_1', type,
    data: { object: type === 'checkout.session.completed' ? { id: 'cs_1', mode: 'subscription', subscription: sub.id, metadata } : sub },
  } as unknown as Stripe.Event, 'cus_1');
  const row = () => ({ ws: db.tables.team_workspaces[0], org: db.tables.organizations[0], ent: db.tables.team_entitlements[0] });
  const checkout = () => load('lib/team-checkout.ts') as typeof import('../../lib/team-checkout.ts');
  return { db, deliver, row, events, emails, provisioned, failOn, checkout };
}

describe('a live portal\'s own subscription changes', () => {
  it('status, cycle, renewal date and item reach all three records; nothing is sent and nothing new is made', async () => {
    const r = rig({ sub: subscription({ status: 'past_due' }) });
    await r.deliver();
    const { ws, org, ent } = r.row();
    assert.deepEqual([ws.subscription_status, ws.current_period_end], ['past_due', NEW_END]);
    assert.deepEqual([org.subscription_status, org.subscription_period, org.current_period_end], ['past_due', 'annual', NEW_END]);
    assert.deepEqual([ent.status, ent.stripe_subscription_item_id], ['past_due', 'si_new']);
    assert.deepEqual(r.events.map(e => [e.eventType, e.sourceEventId]), [['subscription_past_due', 'evt_1:team_workspace_created:subscription_past_due']]);
    assert.equal(r.emails.length, 0);
    assert.equal(r.provisioned.length, 0);
  });
  it('a payment that recovers is recorded once; the same status again records nothing', async () => {
    const r = rig({ db: records({ status: 'past_due', orgStatus: 'past_due', entitlement: 'past_due' }) });
    await r.deliver();
    await r.deliver();
    assert.equal(r.row().ent.status, 'active');
    assert.deepEqual(r.events.map(e => e.eventType), ['subscription_recovered']);
  });
  it('unpaid reads past due, and keeps access as past due does', async () => {
    const r = rig({ sub: subscription({ status: 'unpaid' }) });
    await r.deliver();
    const { ws, org, ent } = r.row();
    assert.deepEqual([ws.subscription_status, org.subscription_status, ent.status], ['unpaid', 'past_due', 'past_due']);
  });
  it('a missing renewal date or item keeps the one on file', async () => {
    const sub = subscription({ periodEnd: null });
    delete (sub.items.data[0] as { id?: string }).id;
    const r = rig({ sub });
    await r.deliver();
    assert.equal(r.row().ws.current_period_end, OLD_END);
    assert.equal(r.row().org.current_period_end, OLD_END);
    assert.equal(r.row().ent.stripe_subscription_item_id, 'si_old');
  });
  it('a portal that ended while the change was being read is not switched back on', async () => {
    // The deletion's ending finishes between "is it in force?" and the writes.
    const r = rig({ sub: subscription({ status: 'past_due' }), afterInForce: t => {
      t.team_workspaces[0].subscription_status = 'canceled';
      t.organizations[0].subscription_status = 'canceled';
      t.team_entitlements[0].status = 'canceled';
    } });
    await r.deliver();
    const { ws, org, ent } = r.row();
    assert.deepEqual([ws.subscription_status, org.subscription_status, ent.status], ['canceled', 'canceled', 'canceled']);
    assert.equal(r.events.length, 0);
  });
  for (const table of ['team_entitlements', 'organizations']) {
    it(`a retry after a failed ${table} write still records the turn to past due, once`, async () => {
      const r = rig({ failOn: table, sub: subscription({ status: 'past_due' }) });
      await assert.rejects(r.deliver());
      r.failOn.table = undefined;
      await r.deliver();
      assert.deepEqual(r.events.map(e => e.eventType), ['subscription_past_due']);
    });
  }
  for (const status of ['canceled', 'incomplete', 'incomplete_expired', 'paused']) {
    it(`${status} writes nothing: the deletion ends a portal, and nothing is paid on the others`, async () => {
      const r = rig({ sub: subscription({ status }) });
      await r.deliver();
      assert.deepEqual(r.db.writes.filter(t => t !== 'organizations'), []);
      const { ws, org, ent } = r.row();
      assert.deepEqual([ws.subscription_status, org.subscription_status, org.subscription_period, ent.status], ['active', 'active', null, 'active']);
      assert.equal(r.events.length, 0);
    });
  }
  it('a replayed checkout writes the cycle the subscription is on now, not the one first bought', async () => {
    const r = rig();
    await r.deliver('checkout.session.completed');
    assert.equal(r.row().org.subscription_period, 'annual');
  });
  for (const table of ['team_workspaces', 'organizations', 'team_entitlements']) {
    it(`a failed ${table} write fails the event, so Stripe sends it again`, async () => {
      const r = rig({ failOn: table, sub: subscription({ status: 'past_due' }) });
      await assert.rejects(r.deliver(), (e: { message: string }) => e.message === `write to ${table} failed`);
    });
  }
});

describe('what the one-portal rule still holds', () => {
  it('a second subscription makes no second portal and writes nothing onto the first', async () => {
    const r = rig({ sub: subscription({ id: 'sub_2', status: 'past_due' }) });
    await r.deliver();
    // Only `recordSubscriptionAmount`, keyed on the second subscription's own id, runs: it matches no record.
    assert.equal(r.row().org.stripe_subscription_id, 'sub_1');
    assert.equal(r.row().ws.subscription_status, 'active');
    assert.equal(r.row().org.subscription_period, null);
    assert.equal(r.provisioned.length, 0);
  });
  it('a portal that is not in force is not followed: the owner\'s other live portal still answers', async () => {
    const r = rig({ inForce: false, db: records({ status: 'canceled', orgStatus: 'canceled', entitlement: 'canceled' }) });
    await r.deliver();
    assert.equal(r.row().ent.status, 'canceled');
    assert.equal(r.row().org.subscription_status, 'canceled');
  });
  it('a portal that became a club is never followed', async () => {
    const r = rig({ db: records({ state: 'org_owned' }), sub: subscription({ status: 'past_due' }) });
    await r.deliver();
    assert.equal(r.row().ws.subscription_status, 'active');
    assert.equal(r.row().ent.status, 'active');
    assert.equal(r.events.length, 0);
  });
});

describe('the portal sync itself (the deletion, a finished-by-hand ending, a subscription made by hand)', () => {
  const call = (r: ReturnType<typeof rig>, over: Record<string, string>) => r.checkout().syncTeamWorkspaceSubscription({
    stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1', subscriptionStatus: 'canceled', ...over,
  });
  it('an ending writes canceled over all three, and the cycle goes blank', async () => {
    const r = rig({ db: records({ status: 'canceled', orgStatus: 'canceled' }) });
    r.row().org.subscription_period = 'annual';
    assert.equal(await call(r, {}), true);
    const { ws, org, ent } = r.row();
    assert.deepEqual([ws.subscription_status, org.subscription_status, org.subscription_period, ent.status], ['canceled', 'canceled', null, 'canceled']);
  });
  for (const status of ['incomplete_expired', 'paused']) {
    it(`${status} is the portal's, and nothing is written`, async () => {
      const r = rig();
      assert.equal(await call(r, { subscriptionStatus: status }), true);
      assert.deepEqual(r.db.writes, []);
    });
  }
});

describe('a first purchase records its cycle', () => {
  it('the checkout hands the cycle to the new portal', async () => {
    const empty = { team_workspaces: [] as Row[], organizations: [] as Row[], team_entitlements: [] as Row[] };
    const r = rig({ db: empty, inForce: true });
    const load = billingTestLoader({
      './supabase-admin': { supabaseAdmin: r.db }, './platform-events': { writePlatformEvent: async () => {} },
      './email': { sendEmail: async () => ({}), teamWorkspaceWelcomeHtml: () => '', SITE_URL: 'http://x' },
      './portal-in-force-server': { workspacesInForce: async () => new Set() },
      './team-workspace-owned': { getActiveOwnedTeamWorkspace: async () => null },
      './team-workspace-provisioning': { provisionStandaloneTeamWorkspace: async (i: Record<string, unknown>) => { r.provisioned.push(i); return { org: { id: 'o', slug: 's' }, teamWorkspaceId: 'w' }; }, TeamWorkspaceProvisioningError: Error },
      './team-workspace-claims': { assertTeamWorkspaceClaimAvailableForProvisioning: async () => {}, markTeamWorkspaceClaimed: async () => {} },
      './portal-keep-premium': { findKeepPremiumPortal: async () => null },
      './portal-retained-restore': {},
    });
    const checkout = load('lib/team-checkout.ts') as typeof import('../../lib/team-checkout.ts');
    for (const billingCycle of ['annual', 'monthly', null]) {
      await checkout.provisionTeamWorkspaceFromCheckoutMetadata({ metadata, stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_new', subscriptionStatus: 'active', billingCycle, eventSource: 'stripe' });
    }
    assert.deepEqual(r.provisioned.map(p => p.billingCycle), ['annual', normalizeBillingCycle('monthly'), 'monthly']);
  });
  it('and the new portal\'s account row stores it', () => {
    assert.match(readCode('lib/team-workspace-provisioning.ts'), /if \(input\.billingCycle !== undefined\) orgPatch\.subscription_period = input\.billingCycle;/);
  });
});
