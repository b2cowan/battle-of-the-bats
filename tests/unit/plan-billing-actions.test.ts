import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as React from 'react';
import { billingTestLoader } from './_billing-test-loader.ts';
import type { BillingBodyViewProps } from '../../components/billing/BillingBody.tsx';
import type { BillingCancellation, BillingDowngrade, BillingFounding } from '../../lib/plan-billing-data.ts';
import type { Organization, OrgPlan } from '../../lib/types.ts';
import * as planConfig from '../../lib/plan-config.ts';
import { PLAN_BILLING_WORDS as W } from '../../lib/plan-billing-words.ts';

type Element = React.ReactElement<Record<string, unknown>>;
type Effect = { deps?: readonly unknown[]; cleanup?: () => void };

/**
 * The move window, loaded with the runner's hooks, answering its own window. Since GST/HST Stage 6 step 6.3 (C3) it returns
 * the window AND the Terms window beside it (a fragment, so the Terms window opens over it — Ask 5A); these tests read the
 * move window itself, its footer and body.
 */
function moveDialogOf(runner: ReturnType<typeof hookRunner>) {
  const mod = billingTestLoader({ react: runner.hooks })('components/billing/PlanMoveDialog.tsx') as { default: (p: Record<string, unknown>) => Element };
  return {
    default: (props: Record<string, unknown>) => {
      const out = mod.default(props);
      return (out.type === React.Fragment ? [out.props.children].flat()[0] : out) as Element;
    },
  };
}

/** Execute the real component's hooks, then inspect its returned React elements and invoke their handlers.
 * Effects, state, cleanup and rerenders run deterministically; no replacement action implementation is used. */
function hookRunner() {
  const slots: unknown[] = [];
  const effects: Array<() => void> = [];
  let cursor = 0;
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

function elements(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children)];
}
function find(node: unknown, predicate: (element: Element) => boolean): Element {
  const found = elements(node).find(predicate);
  assert.ok(found, 'Expected a real returned element matching the requested control');
  return found;
}
function click(element: Element) { (element.props.onClick as () => void)(); }
function change(element: Element, value: string) {
  (element.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
}

const cancellation: BillingCancellation = {
  currentPlan: 'tournament_plus', activeTournamentCount: 1, tournaments: [], retentionDays: 90,
  shutsDown: ['Tournaments'], shortShutsDown: ['tournaments'], activeTeams: 0, cancelled: null,
};
const downgrade: BillingDowngrade = {
  currentPlan: 'tournament_plus', targetPlan: 'tournament', targetPlanLabel: 'Tournament', targetTournamentLimit: 1,
  activeTournamentCount: 1, allowedKeepCount: 1, requiresTournamentChoice: false,
  tournaments: [{ id: 'event-kept', name: 'Fall Classic', status: 'active', year: 2026, startDate: null, endDate: null }],
  overLimitTournamentCount: 0, retentionDays: 90,
};
const billingBase = '/falcons-club/admin/org/billing';
function organization(planId: OrgPlan = 'tournament_plus'): Organization {
  return {
    id: 'org-a', slug: 'falcons-club', name: 'Falcons', planId, ownPlanId: planId,
    subscriptionStatus: 'active', subscriptionPeriod: 'monthly', currentPeriodEnd: '2027-03-01',
    enabledAddons: [], teamLimit: 15, tournamentLimit: 1,
    isPublic: false, createdAt: '2026-10-28T12:00:00Z', accountKind: 'organization',
    isDiscoverable: false, clubBookSharingEnabled: false,
  };
}
type Request = { endpoint: string; init?: RequestInit };
type Answer = { ok?: boolean; data: unknown };

function environment() {
  const requests: Request[] = [];
  const answers = new Map<string, Answer[]>();
  const listeners = new Map<string, Set<(event: { persisted: boolean }) => void>>();
  const timers = new Map<number, { callback: () => void; delay: number }>();
  const heldReads: Array<() => void> = [];
  let readsPaused = false;
  let timerId = 0;
  const previousFetch = globalThis.fetch;
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  // The fee read listens for the tab showing again (visibilitychange); nothing in these contracts fires it.
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} } });
  const assigned: string[] = [];
  const replaced: string[] = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    location: { assign: (url: string) => assigned.push(url), replace: (url: string) => replaced.push(url) },
    addEventListener(name: string, handler: (event: { persisted: boolean }) => void) {
      const handlers = listeners.get(name) ?? new Set(); handlers.add(handler); listeners.set(name, handlers);
    },
    removeEventListener(name: string, handler: (event: { persisted: boolean }) => void) { listeners.get(name)?.delete(handler); },
    setTimeout(callback: () => void, delay: number) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id: number) { timers.delete(id); },
  } });
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const endpoint = String(input);
    // GST/HST Stage 1: the billing-address read is a background lookup (an address on file, so every paid button goes on);
    // these contracts are about the money requests, so it is answered here and not logged.
    if (endpoint.startsWith('/api/billing/location') && !init?.method) {
      return { ok: true, json: async () => ({ location: ADDRESS_ON_FILE, buyer: 'club', name: 'Falcons', usSalesOpen: false }) } as Response;
    }
    // Fee invoice alerts Part 3: the Stripe fees are one background read for the line and the list (nothing owed here); like the
    // address lookup, it is not a money request, so it is answered and not logged.
    if (endpoint.startsWith('/api/billing/stripe-fees') && !init?.method) {
      return { ok: true, json: async () => ({ fees: [], invoices: [], planFree: false }) } as Response;
    }
    requests.push({ endpoint, init });
    const queued = answers.get(endpoint)?.shift();
    let data: unknown;
    if (endpoint.startsWith('/api/billing/cancel/preflight')) data = cancellation;
    else if (endpoint.startsWith('/api/billing/usage')) data = { teams: { count: 0, limit: 15 }, tournament_slots: { count: 1, limit: 1 }, staff_seats: { count: 1, limit: 10 }, officials: 0 };
    else if (endpoint.startsWith('/api/admin/org/free-time')) data = { freeTime: null, portal: null, foundingThrough: null, overLimitAfter: false };
    else if (endpoint.startsWith('/api/admin/org/founding-season-status')) data = { isFoundingSeason: false, compUntil: null };
    else if (endpoint === '/api/plan-gating') data = { tournament: false, tournament_plus: false, club: false, club_large: false };
    else if (endpoint.startsWith('/api/billing/move?')) data = { live: true, scheduledMove: null };
    else data = {};
    const response = { ok: queued?.ok ?? true, json: async () => queued ? queued.data : data } as Response;
    if (readsPaused && !init?.method) return new Promise<Response>(resolve => heldReads.push(() => resolve(response)));
    return response;
  }) as typeof fetch;
  return {
    requests, assigned, replaced,
    answer(endpoint: string, data: unknown, ok = true) {
      const queue = answers.get(endpoint) ?? []; queue.push({ data, ok }); answers.set(endpoint, queue);
    },
    restorePage() { for (const handler of listeners.get('pageshow') ?? []) handler({ persisted: true }); },
    fireTimers(delay: number) {
      for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.callback(); }
    },
    pauseReads() { readsPaused = true; },
    dispose() {
      for (const finish of heldReads) finish();
      globalThis.fetch = previousFetch;
      if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
      else Reflect.deleteProperty(globalThis, 'window');
      if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
      else Reflect.deleteProperty(globalThis, 'document');
    },
  };
}

/** The address every harness has on file (GST/HST Stage 1), and the club address "Start your club" sends from it. */
const ADDRESS_ON_FILE = {
  country: 'CA', regionCode: 'ON', line1: '18 Oak Crescent', line2: null, city: 'Guelph', postalCode: 'N1E 2K7',
  confirmedAt: '2026-11-03T12:00:00Z', usDeclarationAt: null, usDeclarationVersion: null,
};
const CLUB_ADDRESS_SENT = { country: 'CA', regionCode: 'ON', line1: '18 Oak Crescent', line2: null, city: 'Guelph', postalCode: 'N1E 2K7', usDeclared: false };

function assertRequest(request: Request | undefined, endpoint: string, method: string, body?: Record<string, unknown>) {
  assert.ok(request, `Missing ${method} ${endpoint}`);
  assert.equal(request.endpoint, endpoint);
  assert.equal(request.init?.method, method);
  assert.deepEqual(request.init?.headers, { 'Content-Type': 'application/json' });
  if (body) assert.deepEqual(JSON.parse(String(request.init?.body)), body);
  else assert.equal(request.init?.body, undefined);
}

async function ownerHarness(options: { plan?: OrgPlan; search?: string; refresh?: () => Promise<void>; returnTo?: string; founding?: BillingFounding; foundingActive?: boolean; cancellation?: BillingCancellation } = {}) {
  const env = environment();
  if (options.founding) env.answer('/api/admin/org/founding-season-status?orgSlug=falcons-club', options.founding);
  if (options.cancellation) env.answer('/api/billing/cancel/preflight?orgSlug=falcons-club', options.cancellation);
  const runner = hookRunner();
  const org = organization(options.plan);
  if (options.returnTo?.endsWith('/coaches/billing')) {
    org.slug = options.returnTo.split('/')[1];
    org.accountKind = 'team_workspace';
  }
  const refresh = options.refresh ?? (async () => {});
  const loader = billingTestLoader({
    react: runner.hooks,
    '@/lib/plan-config': { ...planConfig, isFoundingSeasonActive: () => options.foundingActive ?? true, isFoundingSeasonCardWindowOpen: () => true },
    '@/lib/org-context': { useOrg: () => ({ currentOrg: org, userRole: 'owner', userCapabilities: null, loading: false, refresh }) },
    'next/navigation': { useRouter: () => ({ replace() {} }), useSearchParams: () => new URLSearchParams(options.search) },
  });
  const bodyExports = loader('components/billing/BillingBody.tsx') as {
    default: (props: { billingBase: string; teamsHref: string }) => React.ReactElement<{ org: Organization; refresh: () => Promise<void>; billingBase: string; teamsHref: string }>;
    BillingBodyView: (props: BillingBodyViewProps) => React.ReactNode;
  };
  const owner = bodyExports.default({ billingBase: options.returnTo ?? billingBase, teamsHref: '/falcons-club/admin/rep-teams' });
  const component = owner.type as (props: typeof owner.props) => React.ReactNode;
  let tree: React.ReactNode;
  const render = () => { tree = runner.render(() => {
    const shell = component(owner.props) as Element;
    // The owner return gate mounts either the ordinary billing body or the status-only screen.
    return typeof shell.type === 'function' ? (shell.type as (props: Record<string, unknown>) => React.ReactNode)(shell.props) : shell;
  }); return tree; };
  const settle = async () => { for (let i = 0; i < 5; i++) { await new Promise<void>(resolve => setImmediate(resolve)); render(); } };
  render(); await settle(); env.requests.length = 0;
  const view = () => find(tree, element => Object.hasOwn(element.props, 'snapshot')).props as unknown as BillingBodyViewProps;
  return {
    ...env, org, render, settle,
    view,
    renderedView: () => bodyExports.BillingBodyView(view()),
    review: () => find(tree, element => Object.hasOwn(element.props, 'footer') && element.props.kind === 'form'),
    tree: () => tree,
    dispose() { runner.dispose(); env.dispose(); },
  };
}

describe('real owner billing action request contracts', () => {
  for (const returnTo of [billingBase, '/falcons/coaches/billing']) it(`Upgrade asks how to pay first, and the payment step sends the chosen cycle from ${returnTo}`, async () => {
    const h = await ownerHarness({ plan: 'tournament', returnTo });
    try {
      // No cycle dropdown above the table, which already shows both prices.
      assert.ok(!elements(h.renderedView()).some(element => element.type === 'select'));
      h.answer('/api/billing/create-checkout', { url: 'https://stripe.test/upgrade' });
      click(find(h.renderedView(), element => element.type === 'button' && elements(element.props.children).length === 0 && element.props.children === W.change.upgrade(planConfig.PLAN_CONFIG.tournament_plus.label)));
      await h.settle();
      // Clicking Upgrade opens the payment step; nothing is requested until a cycle is chosen.
      assert.equal(h.requests.length, 0);
      const step = find(h.tree(), element => typeof element.props.onContinue === 'function');
      assert.equal(step.props.initial, 'monthly');
      // Choosing a cycle does not relabel the currently subscribed plan or its price.
      assert.equal(h.view().snapshot.org.subscriptionPeriod, 'monthly');
      (step.props.onContinue as (cycle: string) => void)('annual'); await h.settle();
      assertRequest(h.requests[0], '/api/billing/create-checkout', 'POST', { planKey: 'tournament_plus', billingCycle: 'annual', returnTo, orgSlug: h.org.slug });
      assert.deepEqual(h.assigned, ['https://stripe.test/upgrade']);
      assert.ok(!elements(h.tree()).some(element => typeof element.props.onContinue === 'function'), 'the payment step closes once checkout is requested');
    } finally { h.dispose(); }
  });
  it('the details panel carries its own cycle, so its Upgrade goes straight to checkout', async () => {
    const h = await ownerHarness({ plan: 'tournament', search: 'plan=tournament_plus' });
    try {
      h.answer('/api/billing/create-checkout', { url: 'https://stripe.test/panel' });
      const panel = find(h.renderedView(), element => typeof element.props.onBillingCycleChange === 'function');
      (panel.props.onBillingCycleChange as (cycle: string) => void)('annual'); h.render();
      (find(h.renderedView(), element => typeof element.props.onUpgrade === 'function').props.onUpgrade as () => void)(); await h.settle();
      assertRequest(h.requests[0], '/api/billing/create-checkout', 'POST', { planKey: 'tournament_plus', billingCycle: 'annual', returnTo: billingBase, orgSlug: h.org.slug });
    } finally { h.dispose(); }
  });
  for (const returnTo of [billingBase, '/falcons/coaches/billing']) it(`checkout and reactivation preserve all fields for ${returnTo}`, async () => {
    const h = await ownerHarness({ returnTo });
    try {
      h.answer('/api/billing/create-checkout', { url: 'https://stripe.test/checkout' });
      h.view().actions.setCycle('annual'); h.render();
      h.view().actions.change({ target: 'club', mechanism: 'checkout' }, 'annual'); await h.settle();
      assertRequest(h.requests[0], '/api/billing/create-checkout', 'POST', { planKey: 'club', billingCycle: 'annual', returnTo, orgSlug: h.org.slug });
      assert.deepEqual(h.assigned, ['https://stripe.test/checkout']);
      h.restorePage(); h.render(); h.requests.length = 0;
      h.answer('/api/billing/create-checkout', { url: 'https://stripe.test/reactivate' });
      h.view().actions.reactivate(); await h.settle();
      assertRequest(h.requests[0], '/api/billing/create-checkout', 'POST', { planKey: 'tournament_plus', billingCycle: 'annual', returnTo, orgSlug: h.org.slug });
    } finally { h.dispose(); }
  });

  for (const [action, endpoint] of [['portal', '/api/billing/portal'], ['card', '/api/billing/setup-payment-method']] as const) it(`${action} sends only its host return and explicit organization`, async () => {
    const h = await ownerHarness();
    try {
      h.answer(endpoint, { url: `https://stripe.test/${action}` }); h.view().actions[action](); await h.settle();
      assertRequest(h.requests[0], endpoint, 'POST', { returnTo: billingBase, orgSlug: h.org.slug });
      assert.deepEqual(h.assigned, [`https://stripe.test/${action}`]);
    } finally { h.dispose(); }
  });

  it('keep uses scoped DELETE without a body, and a failed refresh preserves its success', async () => {
    const h = await ownerHarness({ plan: 'club_large', refresh: async () => { throw new Error('Refresh unavailable'); } });
    try {
      h.view().actions.keep(); await h.settle();
      assertRequest(h.requests[0], '/api/billing/move?orgSlug=falcons-club', 'DELETE');
      assert.equal(h.view().notice?.tone, 'good'); assert.match(h.view().notice!.text, /stays on/);
    } finally { h.dispose(); }
  });

  it('cancel confirms the real review with its typed reason and organization', async () => {
    const h = await ownerHarness();
    try {
      h.view().actions.cancel(); h.render();
      change(find(h.review().props.children, element => element.props.id === 'billing-reason'), 'Closing our program'); h.render();
      click(find(h.review().props.footer, element => element.type === 'button' && element.props.className === 'btn btn-danger'));
      await h.settle();
      assertRequest(h.requests[0], '/api/billing/cancel/confirm', 'POST', { reason: 'Closing our program', orgSlug: h.org.slug });
    } finally { h.dispose(); }
  });

  it('downgrade preflight and confirmation keep exact field names and selected tournament ids', async () => {
    const h = await ownerHarness();
    try {
      h.answer('/api/billing/downgrade/preflight', downgrade);
      h.view().actions.change({ mechanism: 'downgrade', target: 'tournament' }); await h.settle();
      assertRequest(h.requests[0], '/api/billing/downgrade/preflight', 'POST', { targetPlan: 'tournament', orgSlug: h.org.slug });
      change(find(h.review().props.children, element => element.props.id === 'billing-reason'), 'One event now'); h.render();
      click(find(h.review().props.footer, element => element.type === 'button' && element.props.className === 'btn btn-lime'));
      await h.settle();
      assertRequest(h.requests[1], '/api/billing/downgrade/confirm', 'POST', { targetPlan: 'tournament', keepTournamentIds: ['event-kept'], reason: 'One event now', orgSlug: h.org.slug });
    } finally { h.dispose(); }
  });

  it('next-season choice sends its own cycle, plan, return host and organization', async () => {
    const h = await ownerHarness();
    try {
      h.answer('/api/billing/choose-next-season', { url: 'https://stripe.test/next-season' });
      h.view().actions.choose('tournament_plus', 'annual'); await h.settle();
      assertRequest(h.requests[0], '/api/billing/choose-next-season', 'POST', { planKey: 'tournament_plus', billingCycle: 'annual', returnTo: billingBase, orgSlug: h.org.slug });
      assert.equal(h.view().justChose, true);
      h.restorePage(); h.render(); assert.equal(h.view().justChose, false);
      await h.settle(); h.render(); assert.equal(h.view().actions.busy, null, "the restore's re-read has finished");
    } finally { h.dispose(); }
  });

  it('a same-org retry retains ready data and an open cancellation review, while a changed org cannot reuse it', async () => {
    const h = await ownerHarness();
    try {
      h.view().actions.cancel(); h.render();
      h.pauseReads();
      h.view().actions.retry();
      await h.settle();
      assert.ok(h.requests.some(request => request.endpoint === '/api/admin/org/free-time?orgSlug=falcons-club&billing=1'), 'The revision must actually have started its new reads');
      assert.equal(h.view().snapshot.freeTime.status, 'ready');
      assert.ok(find(h.review().props.footer, element => element.props.className === 'btn btn-danger'));
      h.org.slug = 'other-club'; h.org.id = 'org-b'; h.render();
      assert.equal(h.view().snapshot.freeTime.status, 'loading');
      assert.equal(h.view().snapshot.cancellation.status, 'loading');
    } finally { h.dispose(); }
  });

  it('a webhook-lagged next-season return rereads Founding status until the choice arrives', async () => {
    const h = await ownerHarness({ search: 'next_season=1' });
    try {
      const endpoint = '/api/admin/org/founding-season-status?orgSlug=falcons-club';
      const nextSeason = { planKey: 'tournament_plus', billingCycle: 'annual', chosenAt: '2026-10-28' };
      assert.equal(h.view().justChose, true);
      h.answer(endpoint, { isFoundingSeason: true, compUntil: '2027-09-30', nextSeason });
      h.fireTimers(1500); await h.settle();
      assert.ok(h.requests.some(request => request.endpoint === endpoint));
      const read = h.view().snapshot.founding;
      assert.equal(read.status, 'ready');
      if (read.status === 'ready') assert.deepEqual(read.data.nextSeason, nextSeason);
    } finally { h.dispose(); }
  });

  it('the chosen next-season Change plan or card button opens the portal instead of resubmitting the choice', async () => {
    const h = await ownerHarness({ founding: {
      isFoundingSeason: true, compUntil: '2027-09-30',
      nextSeason: { planKey: 'tournament_plus', billingCycle: 'annual', chosenAt: '2026-10-28' },
    } });
    try {
      h.answer('/api/billing/portal', { url: 'https://stripe.test/change-choice' });
      click(find(h.renderedView(), element => element.type === 'button' && element.props.children === W.founding.change));
      await h.settle();
      assert.equal(h.requests.length, 1);
      assertRequest(h.requests[0], '/api/billing/portal', 'POST', { returnTo: billingBase, orgSlug: h.org.slug });
      assert.deepEqual(h.assigned, ['https://stripe.test/change-choice']);
    } finally { h.dispose(); }
  });

  for (const [isFoundingSeason, foundingActive, expected] of [
    [true, true, W.notice.foundingCardSaved],
    [false, true, W.notice.cardSaved],
    [true, false, W.notice.cardSaved],
  ] as const) it(`card-saved return uses the resolved holder (${isFoundingSeason}) and active season (${foundingActive})`, async () => {
    const h = await ownerHarness({ search: 'card_saved=1', foundingActive, founding: { isFoundingSeason, compUntil: isFoundingSeason ? '2027-09-30' : null } });
    try { assert.deepEqual(h.view().notice, { tone: 'good', text: expected }); }
    finally { h.dispose(); }
  });

  it('five webhook-lag retries without a choice reopen the chooser and leave a retry notice', async () => {
    const founding = { isFoundingSeason: true, compUntil: '2027-09-30' };
    const h = await ownerHarness({ search: 'next_season=1', founding });
    try {
      const endpoint = '/api/admin/org/founding-season-status?orgSlug=falcons-club';
      for (let i = 0; i < 5; i++) { h.answer(endpoint, founding); h.fireTimers(1500); await h.settle(); }
      assert.equal(h.requests.filter(request => request.endpoint === endpoint).length, 5);
      assert.equal(h.view().justChose, false);
      assert.ok(find(h.renderedView(), element => element.type === 'h3' && element.props.children === W.founding.chooseTitle));
      assert.equal(h.view().notice?.tone, 'bad');
      assert.equal(h.view().notice?.text, W.errors.nextSeasonRead);
      assert.equal(h.view().notice?.action?.label, W.errors.retry);
      h.view().notice!.action!.run(); await h.settle();
      assert.equal(h.requests.filter(request => request.endpoint === endpoint).length, 6);
    } finally { h.dispose(); }
  });
});

/** Render, let the answers arrive, render again, until nothing more is asked (the window's reads land over a few ticks). */
async function settle<T>(render: () => T): Promise<T> {
  let out = render();
  for (let i = 0; i < 6; i++) { await new Promise<void>(resolve => setImmediate(resolve)); out = render(); }
  return out;
}
/** A quote Stripe taxed for the Ontario address on file (GST/HST Stage 2 Part 3). */
const taxedOn = (beforeTax: number, cents: number) => ({ status: 'taxed', lines: [{ label: 'HST 13%', cents }], beforeTax, taxedFor: { country: 'CA', region: 'ON' } });

describe('real move dialog request contracts', () => {
  it('Premium validates an empty name, sends its normalized name and proration date, and never retries a finishing move', async () => {
    const env = environment(), runner = hookRunner();
    try {
      env.answer('/api/billing/move/preview', { direction: 'up', amountDueToday: 10000, currency: 'cad', prorationDate: 123, nextAmount: 21900, renewsAt: null, billingCycle: 'monthly', lines: null, tax: taxedOn(8850, 1150) });
      env.answer('/api/billing/move', { direction: 'up', finishing: true });
      const Dialog = (moveDialogOf(runner) as { default: (p: Record<string, unknown>) => Element }).default;
      const moved: string[] = [];
      const render = () => runner.render(() => Dialog({ org: organization('team'), toPlan: 'club', returnTo: '/falcons-club/coaches/billing', teamsHref: '/teams', onClose() {}, onMoved: (text: string) => moved.push(text) }));
      let dialog = await settle(render);
      assert.equal(dialog.props.kind, 'form');
      assertRequest(env.requests[0], '/api/billing/move/preview', 'POST', { orgSlug: 'falcons-club', planKey: 'club', billingCycle: 'monthly', billingAddress: CLUB_ADDRESS_SENT });
      assert.equal(env.requests.filter(r => r.endpoint === '/api/billing/move/preview').length, 1, 'the quote is asked once, for the prefilled address');
      click(find(dialog.props.footer, e => e.props.children === W.clubUpgrade.start));
      assert.equal(env.requests.length, 1, 'empty name makes no money request');
      dialog = render();
      assert.equal(find(dialog, e => e.type === 'input').props['aria-invalid'], true);
      change(find(dialog, e => e.type === 'input'), '  Falcons   Baseball  ');
      dialog = render();
      click(find(dialog.props.footer, e => e.props.children === W.clubUpgrade.start));
      await new Promise<void>(resolve => setImmediate(resolve)); dialog = render();
      assertRequest(env.requests[1], '/api/billing/move', 'POST', { orgSlug: 'falcons-club', planKey: 'club', prorationDate: 123, expectedAmountDue: 10000, clubName: 'Falcons Baseball', billingAddress: CLUB_ADDRESS_SENT });
      assert.deepEqual(moved, [W.clubUpgrade.finishing]);
      assert.equal(dialog.props.footer, null);
    } finally { runner.dispose(); env.dispose(); }
  });
  for (const trialDays of [90, 0]) it(`Premium checkout carries clubName and the server's trial decision (${trialDays} days)`, async () => {
    const env = environment(), runner = hookRunner();
    try {
      env.answer('/api/billing/move/preview', { code: 'no_live_subscription', error: 'Checkout needed', checkout: { toPlan: 'club', billingCycle: 'monthly', trialDays, amountDueToday: trialDays ? 0 : 24747, nextAmount: 21900, currency: 'cad', firstChargeAt: '2027-01-29', renewsAt: null, tax: trialDays ? null : taxedOn(21900, 2847) } }, false);
      env.answer('/api/billing/create-checkout', { url: 'https://stripe.test/club-checkout' });
      const Dialog = (moveDialogOf(runner) as { default: (p: Record<string, unknown>) => Element }).default;
      const render = () => runner.render(() => Dialog({ org: organization('team'), toPlan: 'club', freeThrough: '2026-12-31', returnTo: '/falcons-club/coaches/billing', teamsHref: '/teams', onClose() {}, onMoved() {} }));
      let dialog = await settle(render);
      const copy = find(dialog, e => e.type === 'p' && e.props.children === (trialDays ? W.clubUpgrade.trial(trialDays) : W.clubUpgrade.noTrial));
      assert.ok(copy);
      // The Monthly/Yearly toggle (named; the club billing address block is a group of its own).
      assert.equal(elements(dialog).some(e => e.props.role === 'group' && e.props['aria-label'] === W.clubUpgrade.billing), trialDays > 0);
      change(find(dialog, e => e.type === 'input'), 'Falcons Club'); dialog = render();
      click(find(dialog.props.footer, e => e.props.children === W.move.checkout));
      await new Promise<void>(resolve => setImmediate(resolve));
      assertRequest(env.requests[1], '/api/billing/create-checkout', 'POST', { orgSlug: 'falcons-club', planKey: 'club', billingCycle: 'monthly', returnTo: '/falcons-club/coaches/billing', clubName: 'Falcons Club', billingAddress: CLUB_ADDRESS_SENT });
      assert.deepEqual(env.assigned, ['https://stripe.test/club-checkout']);
    } finally { runner.dispose(); env.dispose(); }
  });
  for (const code of ['payment_failing', 'cannot_become_club', 'subscription_ending', 'stripe_error']) it(`${code} keeps a notice and exposes no charge confirmation`, async () => {
    const env = environment(), runner = hookRunner();
    try {
      env.answer('/api/billing/move/preview', { code, error: 'A named refusal', endsAt: '2026-12-31' }, false);
      const Dialog = (moveDialogOf(runner) as { default: (p: Record<string, unknown>) => Element }).default;
      const render = () => runner.render(() => Dialog({ org: organization('team'), toPlan: 'club', returnTo: billingBase, teamsHref: '/teams', onClose() {}, onMoved() {} }));
      const dialog = await settle(render);
      assert.equal(elements(dialog.props.footer).some(e => e.props.children === W.clubUpgrade.start || e.props.children === W.move.checkout), false);
      assert.ok(find(dialog, e => Object.hasOwn(e.props, 'notice')));
    } finally { runner.dispose(); env.dispose(); }
  });
  it('band-too-small refusal keeps the required Rep teams destination in its footer', async () => {
    const env = environment(), runner = hookRunner();
    try {
      env.answer('/api/billing/move/preview', { code: 'band_too_small', error: 'Archive teams first', activeTeams: 22, teamLimit: 15 }, false);
      const moveExports = moveDialogOf(runner) as { default: (props: Record<string, unknown>) => Element };
      const teamsHref = '/falcons-club/admin/rep-teams';
      const render = () => runner.render(() => moveExports.default({ org: organization('club_large'), toPlan: 'club', returnTo: billingBase, teamsHref, onClose() {}, onMoved() {} }));
      const dialog = await settle(render);
      const door = find(dialog.props.footer, element => element.props.children === W.move.repTeams);
      assert.equal(door.props.href, teamsHref);
    } finally { runner.dispose(); env.dispose(); }
  });

  for (const direction of ['up', 'down'] as const) it(`${direction} move previews then confirms with only the applicable proration field`, async () => {
    const env = environment(), runner = hookRunner();
    try {
      const org = organization(direction === 'up' ? 'club' : 'club_large');
      const toPlan = direction === 'up' ? 'club_large' : 'club';
      env.answer('/api/billing/move/preview', direction === 'up'
        ? { direction, amountDueToday: 14250, currency: 'cad', prorationDate: 1793188800, nextAmount: 37900, renewsAt: '2026-11-03', billingCycle: 'monthly', lines: null, tax: taxedOn(12611, 1639) }
        : { direction, effectiveAt: '2026-11-03', nextAmount: 21900, currency: 'cad', billingCycle: 'monthly' });
      const moved: string[] = [];
      const moveExports = moveDialogOf(runner) as { default: (props: Record<string, unknown>) => Element };
      const render = () => runner.render(() => moveExports.default({ org, toPlan, returnTo: billingBase, teamsHref: '/falcons-club/admin/rep-teams', onClose() {}, onMoved: (text: string) => moved.push(text) }));
      const dialog = await settle(render);
      assertRequest(env.requests[0], '/api/billing/move/preview', 'POST', { orgSlug: org.slug, planKey: toPlan });
      click(find(dialog.props.footer, element => element.type === 'button' && element.props.className === 'btn btn-lime'));
      await new Promise<void>(resolve => setImmediate(resolve));
      assertRequest(env.requests[1], '/api/billing/move', 'POST', { orgSlug: org.slug, planKey: toPlan, ...(direction === 'up' ? { prorationDate: 1793188800, expectedAmountDue: 14250 } : {}) });
      assert.equal(moved.length, 1);
    } finally { runner.dispose(); env.dispose(); }
  });

  // ── GST/HST Stage 2 Part 3 (drawings tabs 2–4, ruled 2026-11-05) ──
  const loadDialog = (runner: ReturnType<typeof hookRunner>) =>
    (moveDialogOf(runner) as { default: (p: Record<string, unknown>) => Element }).default;
  const rowOf = (dialog: Element, label: string) => elements(dialog).find(e => e.type === 'div' && elements(e.props.children).some(c => c.type === 'dt' && c.props.children === label));
  const text = (node: unknown): string => typeof node === 'string' || typeof node === 'number' ? String(node)
    : Array.isArray(node) ? node.map(text).join('') : React.isValidElement(node) ? text((node as Element).props.children) : '';

  it('a band move shows the amount, the tax by name and Due today; the renewal says plus applicable taxes', async () => {
    const env = environment(), runner = hookRunner();
    try {
      env.answer('/api/billing/move/preview', { direction: 'up', amountDueToday: 10848, currency: 'cad', prorationDate: 5, nextAmount: 37900, renewsAt: '2026-12-03', billingCycle: 'monthly', lines: null, tax: taxedOn(9600, 1248) });
      const Dialog = loadDialog(runner);
      const dialog = await settle(() => runner.render(() => Dialog({ org: organization('club'), toPlan: 'club_large', returnTo: billingBase, teamsHref: '/teams', onClose() {}, onMoved() {} })));
      assert.equal(text(rowOf(dialog, W.move.today)), W.move.today + '$96.00 CAD');
      assert.equal(text(rowOf(dialog, 'HST 13%')), 'HST 13%$12.48 CAD');
      assert.equal(text(rowOf(dialog, W.clubUpgrade.dueToday)), W.clubUpgrade.dueToday + '$108.48 CAD');
      assert.ok(elements(dialog).some(e => e.type === 'small' && e.props.children === W.move.plusTax), 'the renewal figure says plus applicable taxes');
    } finally { runner.dispose(); env.dispose(); }
  });

  it('a band move with no address on file offers the Billing address window, not a Check again that cannot work', async () => {
    const env = environment(), runner = hookRunner();
    try {
      env.answer('/api/billing/move/preview', { code: 'billing_address_required', error: 'Add a billing address before you pay.', buyer: 'club' }, false);
      const Dialog = loadDialog(runner);
      const dialog = await settle(() => runner.render(() => Dialog({ org: organization('club'), toPlan: 'club_large', returnTo: billingBase, teamsHref: '/teams', onClose() {}, onMoved() {} })));
      assert.ok(find(dialog.props.footer, e => e.props.children === W.move.addressDoor));
      assert.equal(elements(dialog.props.footer).some(e => e.props.children === W.clubUpgrade.checkAgain || e.props.children === W.change.move('Club · Association')), false);
    } finally { runner.dispose(); env.dispose(); }
  });

  it('Start your club: a new province waits for a complete address, then loads the charge for it, keeping the name and address on screen', async () => {
    const env = environment(), runner = hookRunner();
    try {
      env.answer('/api/billing/move/preview', { direction: 'up', amountDueToday: 14314, currency: 'cad', prorationDate: 9, nextAmount: 21900, renewsAt: null, billingCycle: 'monthly', lines: null, tax: taxedOn(12667, 1647) });
      const Dialog = loadDialog(runner);
      const render = () => runner.render(() => Dialog({ org: organization('team'), toPlan: 'club', returnTo: '/falcons-club/coaches/billing', teamsHref: '/teams', onClose() {}, onMoved() {} }));
      let dialog = await settle(render);
      const form = () => find(dialog, e => Object.hasOwn(e.props, 'form') && Object.hasOwn(e.props, 'idPrefix')).props.form as { setField: (k: string, v: string) => void };
      assert.ok(rowOf(dialog, 'HST 13%'));
      // Alberta with the Ontario postal code still there: the address fails its check, so nothing is asked and the figures wait.
      form().setField('regionCode', 'AB'); dialog = await settle(render);
      assert.equal(env.requests.filter(r => r.endpoint === '/api/billing/move/preview').length, 1, 'an address that fails its check asks nothing');
      assert.ok(elements(dialog).some(e => e.type === 'p' && e.props.children === W.move.chargeWaits));
      assert.equal(rowOf(dialog, W.clubUpgrade.dueToday), undefined, 'no figure for an address that will be refused');
      assert.ok(find(dialog, e => e.type === 'input'), 'the club name stays on screen');
      assert.equal(find(dialog.props.footer, e => e.props.children === W.clubUpgrade.start).props.disabled, true);
      // The postal code fixed: one new quote, for Alberta.
      env.answer('/api/billing/move/preview', { direction: 'up', amountDueToday: 13300, currency: 'cad', prorationDate: 9, nextAmount: 21900, renewsAt: null, billingCycle: 'monthly', lines: null, tax: { status: 'taxed', lines: [{ label: 'GST 5%', cents: 633 }], beforeTax: 12667, taxedFor: { country: 'CA', region: 'AB' } } });
      form().setField('postalCode', 'T2P 1J9'); form().setField('city', 'Calgary'); dialog = await settle(render);
      const previews = env.requests.filter(r => r.endpoint === '/api/billing/move/preview');
      assert.equal(previews.length, 2);
      assert.equal(JSON.parse(String(previews[1].init?.body)).billingAddress.regionCode, 'AB');
      assert.equal(text(rowOf(dialog, 'GST 5%')), 'GST 5%$6.33 CAD');
      assert.equal(text(rowOf(dialog, W.clubUpgrade.dueToday)), W.clubUpgrade.dueToday + '$133.00 CAD');
      assert.equal(find(dialog.props.footer, e => e.props.children === W.clubUpgrade.start).props.disabled, false);
    } finally { runner.dispose(); env.dispose(); }
  });

  it('/review: a taxed quote Stripe did not say the place of still shows its figures (they are for the place asked)', async () => {
    const env = environment(), runner = hookRunner();
    try {
      env.answer('/api/billing/move/preview', { direction: 'up', amountDueToday: 14314, currency: 'cad', prorationDate: 9, nextAmount: 21900, renewsAt: null, billingCycle: 'monthly', lines: null, tax: { ...taxedOn(12667, 1647), taxedFor: null } });
      const Dialog = loadDialog(runner);
      const dialog = await settle(() => runner.render(() => Dialog({ org: organization('team'), toPlan: 'club', returnTo: '/falcons-club/coaches/billing', teamsHref: '/teams', onClose() {}, onMoved() {} })));
      assert.ok(rowOf(dialog, 'HST 13%'));
      assert.equal(find(dialog.props.footer, e => e.props.children === W.clubUpgrade.start).props.disabled, false);
    } finally { runner.dispose(); env.dispose(); }
  });

  it('a charge that changed when pressed: nothing is charged, the new figures and the amber sentence show, and the second press sends the new figure', async () => {
    const env = environment(), runner = hookRunner();
    try {
      env.answer('/api/billing/move/preview', { direction: 'up', amountDueToday: 10848, currency: 'cad', prorationDate: 5, nextAmount: 37900, renewsAt: null, billingCycle: 'monthly', lines: null, tax: taxedOn(9600, 1248) });
      const changed = { direction: 'up', amountDueToday: 11040, currency: 'cad', prorationDate: 5, nextAmount: 37900, renewsAt: null, billingCycle: 'monthly', lines: null, tax: taxedOn(9600, 1440) };
      env.answer('/api/billing/move', { code: 'charge_changed', error: W.move.chargeChanged(11040, 'cad', W.change.move('Club · Association')), preview: changed }, false);
      env.answer('/api/billing/move', { direction: 'up', toPlan: 'club_large', movedAt: 'now' });
      const moved: string[] = [];
      const Dialog = loadDialog(runner);
      const render = () => runner.render(() => Dialog({ org: organization('club'), toPlan: 'club_large', returnTo: billingBase, teamsHref: '/teams', onClose() {}, onMoved: (t: string) => moved.push(t) }));
      let dialog = await settle(render);
      click(find(dialog.props.footer, e => e.props.className === 'btn btn-lime')); dialog = await settle(render);
      assert.deepEqual(moved, [], 'nothing was moved');
      assert.ok(elements(dialog).some(e => e.props.role === 'status' && e.props.children === W.move.chargeChanged(11040, 'cad', W.change.move('Club · Association'))));
      assert.equal(text(rowOf(dialog, W.clubUpgrade.dueToday)), W.clubUpgrade.dueToday + '$110.40 CAD');
      click(find(dialog.props.footer, e => e.props.className === 'btn btn-lime')); await settle(render);
      const presses = env.requests.filter(r => r.endpoint === '/api/billing/move');
      assert.equal(JSON.parse(String(presses[1].init?.body)).expectedAmountDue, 11040);
      assert.equal(moved.length, 1);
    } finally { runner.dispose(); env.dispose(); }
  });

  it('no-subscription refusal opens checkout with the chosen target, current cycle and host return', async () => {
    const env = environment(), runner = hookRunner();
    try {
      env.answer('/api/billing/move/preview', { code: 'no_live_subscription', error: 'No live subscription' }, false);
      env.answer('/api/billing/create-checkout', { url: 'https://stripe.test/move-checkout' });
      const org = { ...organization('club'), subscriptionPeriod: 'annual' };
      const moveExports = moveDialogOf(runner) as { default: (props: Record<string, unknown>) => Element };
      const render = () => runner.render(() => moveExports.default({ org, toPlan: 'club_large', returnTo: billingBase, teamsHref: '/falcons-club/admin/rep-teams', onClose() {}, onMoved() {} }));
      const dialog = await settle(render);
      click(find(dialog.props.footer, element => element.type === 'button' && element.props.className === 'btn btn-lime'));
      await new Promise<void>(resolve => setImmediate(resolve));
      assertRequest(env.requests[1], '/api/billing/create-checkout', 'POST', { planKey: 'club_large', billingCycle: 'annual', orgSlug: org.slug, returnTo: billingBase });
      assert.deepEqual(env.assigned, ['https://stripe.test/move-checkout']);
    } finally { runner.dispose(); env.dispose(); }
  });
});

describe('in-place return mounts only the club status screen', () => {
  it('polls both waiting states, times out after twenty reads, and Check again restarts the same attempt', async () => {
    const h = await ownerHarness({ plan: 'team', search: 'inPlace=club&success=1' });
    try {
      const endpoint = '/api/billing/club-upgrade-status?orgSlug=falcons-club';
      for (let i = 0; i < 20; i++) {
        h.answer(endpoint, { becameClub: false, waitingOnPayment: i % 2 === 0 });
        h.fireTimers(2500); await h.settle();
      }
      assert.equal(h.requests.length, 20);
      assert.ok(h.requests.every(r => r.endpoint === endpoint && r.init?.cache === 'no-store'));
      assert.ok(find(h.tree(), e => e.props.children === W.clubUpgrade.longerTitle));
      click(find(h.tree(), e => e.type === 'button' && e.props['aria-label'] === W.clubUpgrade.checkAgain));
      await h.settle();
      h.answer(endpoint, { becameClub: true, waitingOnPayment: false });
      h.fireTimers(2500); await h.settle();
      // A hop that leaves the page replaces its history entry, so Back never lands on a screen that bounces forward again.
      assert.deepEqual(h.replaced, ['/falcons-club/admin?inPlace=club']);
      assert.equal(h.assigned.length, 0);
    } finally { h.dispose(); }
  });
  it('a failed check shows Couldn’t confirm only after three misses in a row, and never opens payment', async () => {
    const h = await ownerHarness({ plan: 'team', search: 'inPlace=club' });
    try {
      const endpoint = '/api/billing/club-upgrade-status?orgSlug=falcons-club';
      for (let i = 0; i < 2; i++) { h.answer(endpoint, {}, false); h.fireTimers(2500); await h.settle(); }
      assert.ok(!elements(h.tree()).some(e => e.props.children === W.clubUpgrade.unconfirmedTitle), 'two misses are a blip, not an answer');
      h.answer(endpoint, {}, false); h.fireTimers(2500); await h.settle();
      assert.ok(find(h.tree(), e => e.props.children === W.clubUpgrade.unconfirmedTitle));
      assert.equal(h.requests.length, 3);
      assert.equal(h.assigned.length + h.replaced.length, 0);
    } finally { h.dispose(); }
  });
});

describe('the club landing after an in-place upgrade', () => {
  for (const sample of [
    { role: 'owner', search: 'inPlace=club', show: true },
    { role: 'owner', search: '', show: false },
    { role: 'admin', search: 'inPlace=club', show: false },
  ]) it(`${sample.role}/${sample.search || 'no marker'}: setup list and the real team belong only to this arrival`, async () => {
    const env = environment(), runner = hookRunner();
    try {
      let search = sample.search;
      const replaced: string[] = [];
      env.answer('/api/coaches/falcons-club/assignments', { assignments: [{ teamId: 'team-preserved', teamName: 'Falcons U12' }] });
      const load = billingTestLoader({
        react: runner.hooks,
        'next/navigation': { useSearchParams: () => new URLSearchParams(search), useRouter: () => ({ replace: (href: string) => { replaced.push(href); search = ''; } }) },
        '@/lib/org-context': { useOrg: () => ({ currentOrg: organization('club'), userRole: sample.role, canOpen: () => false, loading: false }) },
        '@/lib/usePageTitle': { usePageTitle() {} },
        '@/lib/use-plan-gating': { usePlanGating: () => null },
        '../useAdminKitNav': { useAdminKitNav: () => ({ base: '/falcons-club/admin', programs: [], alsoOnPlan: [] }) },
        './ClubBriefProvider': { useClubBrief: () => ({ status: 'ready', brief: null, reload() {} }), briefProgramCount: () => 0 },
      });
      const Hub = (load('components/admin/kit/club/ClubHubKit.tsx') as { default: () => Element }).default;
      const render = () => runner.render(Hub);
      render(); await new Promise<void>(resolve => setImmediate(resolve)); const tree = render();
      assert.equal(elements(tree).some(e => e.props.children === W.clubUpgrade.ready), sample.show);
      const teamDoor = elements(tree).find(e => e.props.href === '/falcons-club/coaches/teams/team-preserved');
      assert.equal(Boolean(teamDoor), sample.show);
      if (sample.show) {
        assert.deepEqual(replaced, ['/falcons-club/admin']);
        for (const href of ['/falcons-club/admin/org/settings', '/falcons-club/admin/org/members', '/falcons-club/admin/public-site']) assert.ok(elements(tree).some(e => e.props.href === href));
      } else assert.equal(replaced.length, 0);
    } finally { runner.dispose(); env.dispose(); }
  });
});

// Plans end at the renewal date, Stage 1 Part B: the owner's Keep {Plan} window and the cancel that waits for its date.
describe('a waiting cancel: Keep {Plan} and the dated Cancel window', () => {
  const endsAt = '2027-03-01T05:00:00Z';
  const label = planConfig.PLAN_CONFIG.tournament_plus.label;
  const waiting = (heldMovePlan: OrgPlan | null = null): BillingCancellation => ({
    ...cancellation, ending: { waits: true, endsOn: endsAt, pending: { endsAt, heldMovePlan, kind: 'cancellation', move: null } },
  });
  const keepWindow = (tree: React.ReactNode) => find(tree, element => element.props.kind === 'question' && Object.hasOwn(element.props, 'footer'));
  const text = (node: unknown) => elements(node).filter(e => e.type === 'p').map(e => e.props.children);

  it('Keep names the date and the charge, posts the owner Keep with only its organization, and says it stayed', async () => {
    const h = await ownerHarness({ cancellation: waiting() });
    try {
      h.view().actions.keepPlan(); h.render();
      const keep = keepWindow(h.tree());
      assert.equal(keep.props.title, `Keep ${label}?`);
      const price = W.plan.price(planConfig.PLAN_CONFIG.tournament_plus.monthlyPrice, 'monthly');
      assert.deepEqual(text(keep.props.children), [W.cancel.keepRenews('Falcons', label, endsAt, price), W.cancel.keepNothingElse]);
      h.answer('/api/billing/cancel/keep', { ok: true, renewsOn: endsAt, renewsAs: null });
      click(find(keep.props.footer, element => element.type === 'button' && element.props.className === 'btn btn-lime'));
      await h.settle();
      assertRequest(h.requests[0], '/api/billing/cancel/keep', 'POST', { orgSlug: h.org.slug });
      assert.equal(h.view().notice?.text, W.plan.kept('Falcons', label));
      assert.equal(elements(h.tree()).some(element => element.props.kind === 'question'), false, 'the window closes once kept');
    } finally { h.dispose(); }
  });

  it('a carried cheaper move renews as that plan, and a move that could not come back is said as a wait, never a clean keep (G1)', async () => {
    const h = await ownerHarness({ plan: 'club_large', cancellation: waiting('club') });
    try {
      h.view().actions.keepPlan(); h.render();
      const keep = keepWindow(h.tree());
      const club = planConfig.PLAN_CONFIG.club;
      assert.deepEqual(text(keep.props.children), [
        W.cancel.keepStaysUntil('Falcons', planConfig.PLAN_CONFIG.club_large.label, endsAt),
        W.cancel.keepThenMove(club.label, W.plan.price(club.monthlyPrice, 'monthly')),
      ]);
      const notice = W.cancel.moveNotRestored(planConfig.PLAN_CONFIG.club_large.label, club.label, endsAt);
      h.answer('/api/billing/cancel/keep', { ok: true, renewsOn: endsAt, renewsAs: null, notice, moveToChooseAgain: 'club' });
      click(find(keep.props.footer, element => element.type === 'button' && element.props.children === W.cancel.keepAndMove(club.label)));
      await h.settle();
      assert.equal(h.view().waitNotice, notice);
      assert.notEqual(h.view().notice?.tone, 'good', 'never a clean "stays on" beside it');
    } finally { h.dispose(); }
  });

  it('a refused Keep stays in its window with the server’s sentence', async () => {
    const h = await ownerHarness({ cancellation: waiting() });
    try {
      h.view().actions.keepPlan(); h.render();
      h.answer('/api/billing/cancel/keep', { error: W.cancel.keepRefused }, false);
      click(find(keepWindow(h.tree()).props.footer, element => element.type === 'button' && element.props.className === 'btn btn-lime'));
      await h.settle();
      assert.ok(elements(keepWindow(h.tree()).props.children).some(element => element.props.children === W.cancel.keepRefused));
    } finally { h.dispose(); }
  });

  it('keep_plan=1 opens the Keep window once the waiting cancel has loaded, and only then', async () => {
    const h = await ownerHarness({ cancellation: waiting(), search: 'keep_plan=1' });
    try { assert.equal(keepWindow(h.tree()).props.title, `Keep ${label}?`); } finally { h.dispose(); }
    const none = await ownerHarness({ search: 'keep_plan=1' });
    try { assert.equal(elements(none.tree()).some(element => element.props.kind === 'question'), false); } finally { none.dispose(); }
  });

  it('a paying plan’s Cancel names its date on the red button and the foot, and a scheduled cancel says when it ends', async () => {
    const h = await ownerHarness({ cancellation: { ...cancellation, ending: { waits: true, endsOn: endsAt, pending: null } } });
    try {
      h.view().actions.cancel(); h.render();
      const review = h.review();
      assert.equal(review.props.title, W.cancel.waitTitle(label));
      assert.equal(review.props.footerStart, undefined, 'the red button carries the date; the foot no longer repeats it');
      const confirm = find(review.props.footer, element => element.type === 'button' && element.props.className === 'btn btn-danger');
      assert.equal(confirm.props.children, 'Cancel on March 1');
      const body = text(review.props.children);
      assert.ok(body.includes(W.cancel.stays('Falcons', endsAt)));
      // The lead says what stays and the way back; the list says what goes offline once; the line under it says when and how long.
      assert.ok(body.includes(W.cancel.keepAnyTime(label, endsAt)));
      const listed = elements(review.props.children).filter(e => e.type === 'li').map(e => e.props.children);
      assert.deepEqual(listed, cancellation.shutsDown, 'the full list is open in the window');
      assert.ok(body.includes(W.cancel.suspendedThen('Falcons', endsAt, 90)));
      assert.ok(!body.some(line => typeof line === 'string' && line.includes(cancellation.shortShutsDown[0] ?? '\u0000') && /go offline/.test(line)), 'the areas are not named a second time in a sentence');
      assert.ok(!body.some(line => typeof line === 'string' && /suspended the moment/.test(line)), 'the click suspends nothing');
      h.answer('/api/billing/cancel/confirm', { ok: true, outcome: 'scheduled', endsAt, recorded: true });
      click(confirm); await h.settle();
      assert.equal(h.view().notice?.text, W.notice.ending('Falcons', endsAt));
    } finally { h.dispose(); }
  });

  it('an account with no paid period keeps today’s immediate window, and says why it does not wait', async () => {
    const tournaments = [{ id: 't1', name: 'Spring Classic', status: 'active', year: 2026, startDate: null, endDate: null }, { id: 't2', name: 'Fall Cup', status: 'draft', year: 2026, startDate: null, endDate: null }];
    const h = await ownerHarness({ cancellation: { ...cancellation, tournaments, ending: { waits: false, endsOn: null, pending: null } } });
    try {
      h.view().actions.cancel(); h.render();
      const review = h.review();
      assert.equal(review.props.title, W.cancel.orgTitle('Falcons'));
      // The list is open and said once; the 90 days and the archive count are one quiet line under it.
      assert.deepEqual(elements(review.props.children).filter(e => e.type === 'li').map(e => e.props.children), cancellation.shutsDown);
      const quiet = elements(review.props.children).filter(e => e.type === 'p' && /afterList/.test(String(e.props.className ?? ''))).map(e => [e.props.children].flat().join(''));
      assert.deepEqual(quiet, [`${W.cancel.retained(90)} ${W.cancel.archived(2)}`]);
      assert.ok(elements(review.props.children).some(e => /calloutDanger/.test(String(e.props.className ?? ''))), 'the lead is the one red-edged line');
      assert.ok(text(review.props.children).includes(W.cancel.noPeriod('Falcons')));
      assert.ok(text(review.props.children).includes(W.cancel.suspendedNow('Falcons')), 'the one red lead says it is suspended at the click');
      assert.equal(review.props.footerStart, undefined, 'the 90 days is said under the list, not again in the foot');
      assert.equal(find(review.props.footer, element => element.type === 'button' && element.props.className === 'btn btn-danger').props.children, W.cancel.confirm);
    } finally { h.dispose(); }
  });

  it('the plan-change window refuses with the one ending sentence and offers Keep {Plan}, in place or on the billing page', async () => {
    for (const inPlace of [true, false]) {
      const env = environment(), runner = hookRunner();
      try {
        env.answer('/api/billing/move/preview', { code: 'subscription_ending', error: 'refused', endsAt }, false);
        const Dialog = (moveDialogOf(runner) as { default: (p: Record<string, unknown>) => Element }).default;
        const kept: string[] = [];
        const render = () => runner.render(() => Dialog({ org: organization('club_large'), toPlan: 'club', returnTo: billingBase, teamsHref: '/teams', onClose() {}, onMoved() {},
          ...(inPlace ? { onKeep: () => kept.push('keep') } : {}) }));
        render(); await new Promise<void>(resolve => setImmediate(resolve)); const dialog = render();
        const notice = find(dialog, element => Object.hasOwn(element.props, 'notice')).props.notice as { text: string };
        assert.equal(notice.text, W.cancel.endingRefusal('club_large', endsAt));
        const door = find(dialog.props.footer, element => element.props.children === W.cancel.keepDoor('club_large'));
        if (inPlace) { click(door); assert.deepEqual(kept, ['keep']); } else assert.equal(door.props.href, `${billingBase}?keep_plan=1`);
      } finally { runner.dispose(); env.dispose(); }
    }
  });
});
