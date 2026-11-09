import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import * as React from 'react';
import { billingTestLoader } from './_billing-test-loader.ts';
import { PAYMENTS_TERMS_VERSION } from '../../lib/online-payment-words.ts';

/**
 * GST/HST Stage 2 Part 2b (Ask 8): a club's billing address is asked for BEFORE the payouts connect touches Stripe.
 * Behaviour, not source shape (the source guard is billing-location-every-path-guard.test.ts):
 *   · the route, run for real with the real `requireBillingLocation` over a fake database;
 *   · the card, run through the real hooks: the "Before you set up payouts" window keeps the fee choice and the tick while
 *     the address window replaces it, and the connect goes out with the choice that was made.
 */

const CLUB = '00000000-0000-4000-8000-000000000001';
type Row = Record<string, unknown>;

// ---------------------------------------------------------------- the route

function fakeDb(tables: Record<string, Row[]>) {
  const writes: Array<{ table: string; op: string; payload: Row }> = [];
  const from = (table: string) => {
    let op = 'select';
    let payload: Row = {};
    const filters: Array<(r: Row) => boolean> = [];
    const run = () => {
      const rows = (tables[table] ?? []).filter(r => filters.every(f => f(r)));
      if (op === 'update') { rows.forEach(r => Object.assign(r, payload)); writes.push({ table, op, payload }); return rows; }
      if (op === 'insert' || op === 'upsert') {
        const existing = op === 'upsert' ? (tables[table] ?? []).find(r => r.org_id === payload.org_id) : undefined;
        writes.push({ table, op, payload });
        if (existing) return [existing];
        (tables[table] ??= []).push({ ...payload });
        return [payload];
      }
      return rows.map(r => ({ ...r }));
    };
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => { filters.push(r => r[c] === v); return q; },
      update: (p: Row) => { op = 'update'; payload = p; return q; },
      insert: (p: Row) => { op = 'insert'; payload = p; return q; },
      upsert: (p: Row) => { op = 'upsert'; payload = p; return q; },
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data: run(), error: null }).then(ok, bad),
    };
    return q;
  };
  return { db: { from, auth: { admin: { getUserById: async () => ({ data: { user: null } }) } } }, writes };
}

const ADDRESS_ROW: Row = {
  id: 'loc-club', org_id: CLUB, user_id: null, country: 'CA', region_code: 'ON', line1: '120 Elm Street', line2: null,
  city: 'Guelph', postal_code: 'N1H 4H2', confirmed_at: '2026-11-01T12:00:00Z', us_declaration_at: null, us_declaration_version: null,
  card_country: null, review_reason: null, review_note: null, review_set_at: null,
};
const DISCONNECTED: Row = {
  org_id: CLUB, stripe_account_id: 'acct_old', livemode: false, fee_payer: 'family', connected_at: '2026-09-01T12:00:00Z',
  disconnected_at: '2026-10-01T12:00:00Z', disconnected_by: 'owner-1',
};

let tables: Record<string, Row[]>;
let stripeCalls: string[];

function route() {
  const database = fakeDb(tables);
  const ctx = {
    user: { id: 'owner-1', email: 'owner@falcons.test' }, role: 'owner', capabilities: null,
    org: { id: CLUB, slug: 'falcons-club', name: 'Falcons', planId: 'club', stripeCustomerId: null },
  };
  const calls = (name: string, result: unknown) => async () => { stripeCalls.push(name); return result; };
  const stubs = {
    '@/lib/api-auth': { getAuthContextWithRole: async () => ctx, forbidden: () => Response.json({}, { status: 403 }), unauthorized: () => Response.json({}, { status: 401 }) },
    '@/lib/observability': { withObservability: (handler: unknown) => handler },
    '@/lib/app-origin': { resolveTrustedAppOrigin: () => 'http://localhost' },
    '@/lib/plan-features': { hasPlanFeature: () => true },
    '@/lib/online-payments-switch': { onlinePaymentsOn: () => true, stripeKeyIsTest: () => true, ONLINE_PAYMENTS_OFF_ERROR: 'off' },
    '@/lib/online-payment-access': { canConnectPayouts: () => true, canSeePayouts: () => true },
    '@/lib/stripe-connect': {
      createClubAccount: calls('createClubAccount', { id: 'acct_new' }),
      retrieveAccount: calls('retrieveAccount', { closed: false }),
      onboardingLink: calls('onboardingLink', 'https://stripe.test/onboarding'),
      prefillClubProfile: calls('prefillClubProfile', undefined),
      dashboardLink: calls('dashboardLink', 'https://stripe.test/dashboard'),
    },
    '@/lib/online-payment-landing': { syncPayoutsAccount: async () => null },
    '@/lib/online-payment-profile': { stripeProfileFor: async () => null },
    '@/lib/entitlement-grants': { effectiveOrgFactsForId: async () => null },
    '@/lib/founding-season': { workspaceHoldsFoundingComp: async () => false },
    '@/lib/module-entitlements': { hasModuleEntitlement: () => false },
    '@/lib/online-payment-endings': { endingNotice: () => null, readOutstanding: async () => null, upcomingEnding: async () => null },
    '@/lib/online-pay-pages': { closeClubPayPages: async () => 0 },
    '@/lib/platform-stripe-fees': { clubFeeInvoicePlaceable: async () => true },
    '@/lib/supabase-admin': { supabaseAdmin: database.db },
    // The REAL billing-location-server runs, over the fake database; only its Stripe-facing neighbours are replaced.
    './supabase-admin': { supabaseAdmin: database.db },
    './stripe': { getStripe: () => { throw new Error('the connect must not reach Stripe through the address check'); } },
    './plan-move': { paidOrPromisedToPay: async () => false },
    './observability/capture': { captureError: async () => {} },
  };
  // The loader's default is an always-satisfied address check; the REAL one is wired in here (a getter: it needs `load`).
  Object.defineProperty(stubs, '@/lib/billing-location-server', { enumerable: true, get: () => load('lib/billing-location-server.ts') });
  const load = billingTestLoader(stubs);
  const handlers = load('app/api/admin/payouts/route.ts') as { POST: (req: Request) => Promise<Response> };
  return {
    writes: database.writes,
    connect: (extra: Row = {}) => handlers.POST(new Request('http://localhost/api/admin/payouts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgSlug: 'falcons-club', action: 'connect', feePayer: 'club', agreeToTerms: true, termsVersion: PAYMENTS_TERMS_VERSION, ...extra }),
    })),
  };
}

const accountWrites = (writes: Array<{ table: string }>) => writes.filter(w => w.table === 'org_payment_accounts' || w.table === 'org_audit_log');

beforeEach(() => {
  stripeCalls = [];
  tables = { billing_locations: [], org_payment_accounts: [], org_audit_log: [] };
});

describe('payouts connect asks for the billing address before Stripe', () => {
  it('a connect sent with another payments-terms version is refused 409 terms_changed before anything (6.3 A6)', async () => {
    tables.billing_locations.push({ ...ADDRESS_ROW });
    for (const termsVersion of ['an-older-version', undefined]) {
      const api = route();
      const res = await api.connect({ termsVersion });
      assert.equal(res.status, 409);
      const body = await res.json();
      assert.equal(body.code, 'terms_changed');
      assert.equal(body.error, 'The payments terms changed while this window was open. Read them again.');
      assert.deepEqual(stripeCalls, []);
      assert.deepEqual(accountWrites(api.writes), []);
    }
    assert.equal(tables.org_payment_accounts.length, 0);
  });

  it('a club with no address is refused 409 billing_address_required: no Stripe account, no payout row, no audit', async () => {
    const api = route();
    const res = await api.connect();
    assert.equal(res.status, 409);
    assert.equal((await res.json()).code, 'billing_address_required');
    assert.deepEqual(stripeCalls, []);
    assert.deepEqual(accountWrites(api.writes), []);
    assert.equal(tables.org_payment_accounts.length, 0);
  });

  it('a club with an address connects as before: the account is created, the row is written, the onboarding link comes back', async () => {
    tables.billing_locations.push({ ...ADDRESS_ROW });
    const api = route();
    const res = await api.connect();
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { url: 'https://stripe.test/onboarding' });
    assert.deepEqual(stripeCalls, ['createClubAccount', 'onboardingLink']);
    assert.equal(tables.org_payment_accounts.length, 1);
    assert.equal(tables.org_payment_accounts[0].stripe_account_id, 'acct_new');
    assert.equal(tables.org_payment_accounts[0].fee_payer, 'club');
  });

  it('a disconnected club reconnecting with no address is asked too: the row stays disconnected and Stripe is not touched', async () => {
    tables.org_payment_accounts.push({ ...DISCONNECTED });
    const api = route();
    const res = await api.connect();
    assert.equal(res.status, 409);
    assert.equal((await res.json()).code, 'billing_address_required');
    assert.deepEqual(stripeCalls, []);
    assert.deepEqual(accountWrites(api.writes), []);
    assert.equal(tables.org_payment_accounts[0].disconnected_at, DISCONNECTED.disconnected_at);
    assert.equal(tables.org_payment_accounts[0].fee_payer, 'family');
  });

  it('a disconnected club WITH an address reconnects: the disconnect clears and the fee choice is recorded', async () => {
    tables.billing_locations.push({ ...ADDRESS_ROW });
    tables.org_payment_accounts.push({ ...DISCONNECTED });
    const api = route();
    const res = await api.connect();
    assert.equal(res.status, 200);
    assert.deepEqual(stripeCalls, ['retrieveAccount', 'onboardingLink']);
    assert.equal(tables.org_payment_accounts[0].disconnected_at, null);
    assert.equal(tables.org_payment_accounts[0].fee_payer, 'club');
  });

  it('the terms are still asked first: no tick answers 400 and Stripe is not touched', async () => {
    const api = route();
    const res = await api.connect({ agreeToTerms: false });
    assert.equal(res.status, 400);
    assert.deepEqual(stripeCalls, []);
  });
});

// ---------------------------------------------------------------- the card

type Element = React.ReactElement<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any

function hookRunner() {
  const slots: unknown[] = [];
  const effects: Array<() => void> = [];
  let cursor = 0;
  type Effect = { deps?: readonly unknown[]; cleanup?: () => void };
  const hooks = {
    ...React,
    useState<T>(initial: T | (() => T)) {
      const at = cursor++;
      type State = { value: T; set: (value: T | ((previous: T) => T)) => void };
      if (!(at in slots)) {
        const state: State = {
          value: typeof initial === 'function' ? (initial as () => T)() : initial,
          set(value) { state.value = typeof value === 'function' ? (value as (previous: T) => T)(state.value) : value; },
        };
        slots[at] = state;
      }
      const state = slots[at] as State;
      return [state.value, state.set] as const;
    },
    useRef<T>(initial: T) {
      const at = cursor++;
      if (!(at in slots)) slots[at] = { current: initial };
      return slots[at] as { current: T };
    },
    useCallback<T>(callback: T, deps: readonly unknown[]) {
      const at = cursor++;
      const previous = slots[at] as { callback: T; deps: readonly unknown[] } | undefined;
      if (!previous || deps.some((value, index) => !Object.is(value, previous.deps[index]))) slots[at] = { callback, deps };
      return (slots[at] as { callback: T }).callback;
    },
    useEffect(callback: () => void | (() => void), deps?: readonly unknown[]) {
      const at = cursor++;
      const previous = slots[at] as Effect | undefined;
      if (!previous || !deps || deps.some((value, index) => !Object.is(value, previous.deps?.[index]))) {
        slots[at] = { deps };
        effects.push(() => {
          previous?.cleanup?.();
          (slots[at] as Effect).cleanup = callback() || undefined;
        });
      }
    },
  };
  return {
    hooks,
    render<T>(component: () => T): T {
      cursor = 0;
      const result = component();
      while (effects.length) effects.shift()!();
      return result;
    },
    dispose() { for (const slot of slots) (slot as Effect | undefined)?.cleanup?.(); },
  };
}

/** Every element reachable through children and the dialog's footer slots (a dialog's buttons live in `footer`). */
function walk(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(walk);
  if (!React.isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...walk(element.props.children), ...walk(element.props.footer), ...walk(element.props.footerStart)];
}
function find(node: unknown, predicate: (element: Element) => boolean, what: string): Element {
  const found = walk(node).find(predicate);
  assert.ok(found, `Expected ${what}`);
  return found;
}
const named = (name: string) => (element: Element) => typeof element.type === 'function' && (element.type as { name?: string }).name === name;
const click = (element: Element) => (element.props.onClick as () => void)();
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise<void>(resolve => setImmediate(resolve)); };

type Sent = { endpoint: string; method: string; body: Record<string, unknown> | null };
const SAVED_LOCATION = {
  country: 'CA', regionCode: 'ON', line1: '18 Oak Crescent', line2: null, city: 'Guelph', postalCode: 'N1E 2K7',
  confirmedAt: '2026-11-05T12:00:00Z', usDeclarationAt: null, usDeclarationVersion: null,
};

function cardHarness(options: { location: unknown; connectAnswers: Array<{ status: number; data: unknown }> }) {
  const sent: Sent[] = [];
  const assigned: string[] = [];
  const connectAnswers = [...options.connectAnswers];
  const previousFetch = globalThis.fetch;
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { assign: (url: string) => assigned.push(url), reload() {} } } });
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const endpoint = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    const reply = (status: number, data: unknown) => ({ ok: status < 400, status, json: async () => data }) as Response;
    if (endpoint.startsWith('/api/billing/location')) {
      if (method === 'GET') return reply(200, { location: options.location, buyer: 'club', name: 'Falcons', usSalesOpen: false });
      sent.push({ endpoint, method, body });
      return reply(200, { location: SAVED_LOCATION });
    }
    sent.push({ endpoint, method, body });
    if (endpoint === '/api/admin/payouts' && method === 'POST') {
      const next = connectAnswers.shift();
      assert.ok(next, 'an unexpected extra connect request');
      return reply(next.status, next.data);
    }
    return reply(200, {});
  }) as typeof fetch;

  const runner = hookRunner();
  const load = billingTestLoader({ react: runner.hooks });
  const PayoutsCard = (load('components/admin/kit/club/PayoutsCard.tsx') as { default: (props: Record<string, unknown>) => React.ReactElement }).default;
  const view = {
    state: 'not_set_up', isOwner: true, testMode: false, rateLabel: '2.9% + 30¢', bankRateLabel: null,
    example: { baseCents: 16500, feeCents: 508, bankFeeCents: null }, feePayer: 'family', refundPolicy: '', requirementsDue: 0,
    deadline: null, paymentsOn: false, connectedAt: null, disconnectedAt: null, disconnectedBy: null, teamsStillOwing: null,
    addressMissing: false,
  };

  /** One render of the card, the "Before" window it mounts, and the address window that window shows in its place. */
  const screen = () => runner.render(() => {
    const card = PayoutsCard({ orgSlug: 'falcons-club', clubName: 'Falcons', home: 'club', initial: view });
    const beforeElement = walk(card).find(named('BeforeWindow'));
    const before = beforeElement ? (beforeElement.type as (p: unknown) => React.ReactElement)(beforeElement.props) : null;
    const dialogElement = before && named('BillingAddressDialog')(before as Element) ? (before as Element) : null;
    const dialog = dialogElement ? (dialogElement.type as (p: unknown) => React.ReactElement)(dialogElement.props) : null;
    return { card, before: dialogElement ? null : before, dialog };
  });

  return {
    sent, assigned, screen,
    dispose() {
      runner.dispose();
      globalThis.fetch = previousFetch;
      if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
      else Reflect.deleteProperty(globalThis, 'window');
    },
  };
}

/** Open the Before window, choose "the club pays", tick the terms; returns the screen at that point. */
async function chooseClubAndTick(h: ReturnType<typeof cardHarness>) {
  let s = h.screen();
  click(find(s.card, e => e.props.className === 'btn btn-lime', 'the set-up button'));
  s = h.screen(); await flush(); s = h.screen();
  assert.ok(s.before, 'the Before window opened');
  const radios = walk(s.before).filter(e => e.type === 'input' && e.props.type === 'radio');
  assert.equal(radios.length, 2);
  (radios[1].props.onChange as () => void)();
  (find(s.before, e => e.type === 'input' && e.props.type === 'checkbox', 'the terms tick').props.onChange as (e: unknown) => void)({ target: { checked: true } });
  s = h.screen();
  return s;
}

const connectRequests = (h: ReturnType<typeof cardHarness>) => h.sent.filter(r => r.endpoint === '/api/admin/payouts');

describe('the Before window keeps the fee choice while the address window is open', () => {
  let h: ReturnType<typeof cardHarness> | null = null;
  afterEach(() => { h?.dispose(); h = null; });

  it('no address on file: Continue opens the address window and sends nothing; saving it sends the connect with feePayer "club"', async () => {
    h = cardHarness({ location: null, connectAnswers: [{ status: 200, data: { url: 'https://stripe.test/onboarding' } }] });
    let s = await chooseClubAndTick(h);
    click(find(s.before, e => e.props.className === 'btn btn-lime', 'Continue'));
    await flush();
    s = h.screen();
    assert.equal(connectRequests(h).length, 0, 'nothing is sent before the address is saved');
    assert.ok(s.dialog, 'the address window is shown instead of the Before window');
    assert.equal(s.before, null);

    // Fill the form through the real fields, then press Continue in the address window.
    const fields = find(s.dialog, named('BillingAddressFields'), 'the address fields');
    const rendered = (fields.type as (p: unknown) => React.ReactElement)(fields.props);
    const type = (id: string, value: string) => (find(rendered, e => e.props.id === `billing-address-${id}`, id).props.onChange as (e: unknown) => void)({ target: { value } });
    type('region', 'ON'); type('line1', '18 Oak Crescent'); type('city', 'Guelph'); type('postal', 'N1E 2K7');
    s = h.screen();
    click(find(s.dialog, e => e.props.className === 'btn btn-lime', 'the address Continue'));
    await flush();

    const put = h.sent.find(r => r.endpoint === '/api/billing/location' && r.method === 'PUT');
    assert.ok(put, 'the address was saved');
    const posts = connectRequests(h);
    assert.equal(posts.length, 1);
    assert.deepEqual(posts[0].body, { orgSlug: 'falcons-club', action: 'connect', feePayer: 'club', agreeToTerms: true, termsVersion: PAYMENTS_TERMS_VERSION });
    assert.deepEqual(h.assigned, ['https://stripe.test/onboarding']);
  });

  it('an address on file but refused by the server: the window opens, and the retry after saving still carries "club"', async () => {
    h = cardHarness({
      location: SAVED_LOCATION,
      connectAnswers: [
        { status: 409, data: { error: 'Add your billing address first.', code: 'billing_address_required' } },
        { status: 200, data: { url: 'https://stripe.test/onboarding' } },
      ],
    });
    let s = await chooseClubAndTick(h);
    click(find(s.before, e => e.props.className === 'btn btn-lime', 'Continue'));
    await flush();
    s = h.screen();
    assert.equal(connectRequests(h).length, 1, 'the connect went out once and was refused');
    assert.ok(s.dialog, 'the refusal opens the address window rather than showing an error');
    click(find(s.dialog, e => e.props.className === 'btn btn-lime', 'the address Continue'));
    await flush();
    const posts = connectRequests(h);
    assert.equal(posts.length, 2);
    assert.equal(posts[1].body?.feePayer, 'club');
    assert.equal(posts[1].body?.agreeToTerms, true);
    assert.deepEqual(h.assigned, ['https://stripe.test/onboarding']);
  });

  it('an address on file and accepted: no address window, one connect', async () => {
    h = cardHarness({ location: SAVED_LOCATION, connectAnswers: [{ status: 200, data: { url: 'https://stripe.test/onboarding' } }] });
    const s = await chooseClubAndTick(h);
    click(find(s.before, e => e.props.className === 'btn btn-lime', 'Continue'));
    await flush();
    assert.equal(h.screen().dialog, null);
    assert.equal(connectRequests(h).length, 1);
    assert.equal(connectRequests(h)[0].body?.feePayer, 'club');
  });
});
