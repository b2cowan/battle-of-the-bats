import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as React from 'react';
import { billingTestLoader } from './_billing-test-loader.ts';
import type { BillingBodyViewProps } from '../../components/billing/BillingBody.tsx';
import type { BillingCancellation, BillingDowngrade, BillingFounding } from '../../lib/plan-billing-data.ts';
import type { Organization, OrgPlan, OrgRole } from '../../lib/types.ts';
import * as planConfig from '../../lib/plan-config.ts';
import { PLAN_BILLING_WORDS as W } from '../../lib/plan-billing-words.ts';

type Element = React.ReactElement<Record<string, unknown>>;
type Effect = { deps?: readonly unknown[]; cleanup?: () => void };

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
  const assigned: string[] = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    location: { assign: (url: string) => assigned.push(url) },
    addEventListener(name: string, handler: (event: { persisted: boolean }) => void) {
      const handlers = listeners.get(name) ?? new Set(); handlers.add(handler); listeners.set(name, handlers);
    },
    removeEventListener(name: string, handler: (event: { persisted: boolean }) => void) { listeners.get(name)?.delete(handler); },
    setTimeout(callback: () => void, delay: number) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id: number) { timers.delete(id); },
  } });
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const endpoint = String(input);
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
    requests, assigned,
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
    },
  };
}

function assertRequest(request: Request | undefined, endpoint: string, method: string, body?: Record<string, unknown>) {
  assert.ok(request, `Missing ${method} ${endpoint}`);
  assert.equal(request.endpoint, endpoint);
  assert.equal(request.init?.method, method);
  assert.deepEqual(request.init?.headers, { 'Content-Type': 'application/json' });
  if (body) assert.deepEqual(JSON.parse(String(request.init?.body)), body);
  else assert.equal(request.init?.body, undefined);
}

async function ownerHarness(options: { plan?: OrgPlan; search?: string; refresh?: () => Promise<void>; returnTo?: string; founding?: BillingFounding; foundingActive?: boolean; role?: OrgRole; capabilities?: Record<string, boolean> } = {}) {
  const env = environment();
  if (options.founding) env.answer('/api/admin/org/founding-season-status?orgSlug=falcons-club', options.founding);
  const runner = hookRunner();
  const org = organization(options.plan);
  const refresh = options.refresh ?? (async () => {});
  const loader = billingTestLoader({
    react: runner.hooks,
    '@/lib/plan-config': { ...planConfig, isFoundingSeasonActive: () => options.foundingActive ?? true, isFoundingSeasonCardWindowOpen: () => true },
    '@/lib/org-context': { useOrg: () => ({ currentOrg: org, userRole: options.role ?? 'owner', userCapabilities: options.capabilities ?? null, loading: false, refresh }) },
    'next/navigation': { useRouter: () => ({ replace() {} }), useSearchParams: () => new URLSearchParams(options.search) },
  });
  const bodyExports = loader('components/billing/BillingBody.tsx') as {
    default: (props: { billingBase: string; teamsHref: string }) => React.ReactElement<{ org: Organization; refresh: () => Promise<void>; billingBase: string; teamsHref: string }>;
    BillingBodyView: (props: BillingBodyViewProps) => React.ReactNode;
  };
  const owner = bodyExports.default({ billingBase: options.returnTo ?? billingBase, teamsHref: '/falcons-club/admin/rep-teams' });
  const component = owner.type as (props: typeof owner.props) => React.ReactNode;
  let tree: React.ReactNode;
  const render = () => { tree = runner.render(() => component(owner.props)); return tree; };
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
  it('the shipped upgrade-cycle select sends the selected cycle, including for delegated billing', async () => {
    const h = await ownerHarness({ plan: 'tournament', role: 'treasurer', capabilities: { billing: true } });
    try {
      change(find(h.renderedView(), element => element.type === 'select'), 'annual'); h.render();
      // Choosing an upgrade cycle does not relabel the currently subscribed plan or its price.
      assert.equal(h.view().snapshot.org.subscriptionPeriod, 'monthly');
      h.answer('/api/billing/create-checkout', { url: 'https://stripe.test/upgrade' });
      click(find(h.renderedView(), element => element.type === 'button' && elements(element.props.children).length === 0 && element.props.children === W.change.upgrade(planConfig.PLAN_CONFIG.tournament_plus.label)));
      await h.settle();
      assertRequest(h.requests[0], '/api/billing/create-checkout', 'POST', { planKey: 'tournament_plus', billingCycle: 'annual', returnTo: billingBase, orgSlug: h.org.slug });
    } finally { h.dispose(); }
  });
  for (const returnTo of [billingBase, '/coaches/workspace/plan']) it(`checkout and reactivation preserve all fields for ${returnTo}`, async () => {
    const h = await ownerHarness({ returnTo });
    try {
      h.answer('/api/billing/create-checkout', { url: 'https://stripe.test/checkout' });
      h.view().actions.setCycle('annual'); h.render();
      h.view().actions.change({ target: 'club', mechanism: 'checkout' }); await h.settle();
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

describe('real move dialog request contracts', () => {
  it('band-too-small refusal keeps the required Rep teams destination in its footer', async () => {
    const env = environment(), runner = hookRunner();
    try {
      env.answer('/api/billing/move/preview', { code: 'band_too_small', error: 'Archive teams first', activeTeams: 22, teamLimit: 15 }, false);
      const moveExports = billingTestLoader({ react: runner.hooks })('components/billing/PlanMoveDialog.tsx') as { default: (props: Record<string, unknown>) => Element };
      const teamsHref = '/falcons-club/admin/rep-teams';
      const render = () => runner.render(() => moveExports.default({ org: organization('club_large'), toPlan: 'club', returnTo: billingBase, teamsHref, onClose() {}, onMoved() {} }));
      render(); await new Promise<void>(resolve => setImmediate(resolve)); const dialog = render();
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
        ? { direction, amountDueToday: 14250, currency: 'cad', prorationDate: 1793188800, nextAmount: 37900, renewsAt: '2026-11-03', billingCycle: 'monthly' }
        : { direction, effectiveAt: '2026-11-03', nextAmount: 21900, currency: 'cad', billingCycle: 'monthly' });
      const moved: string[] = [];
      const moveExports = billingTestLoader({ react: runner.hooks })('components/billing/PlanMoveDialog.tsx') as { default: (props: Record<string, unknown>) => Element };
      const render = () => runner.render(() => moveExports.default({ org, toPlan, returnTo: billingBase, teamsHref: '/falcons-club/admin/rep-teams', onClose() {}, onMoved: (text: string) => moved.push(text) }));
      render(); await new Promise<void>(resolve => setImmediate(resolve)); const dialog = render();
      assertRequest(env.requests[0], '/api/billing/move/preview', 'POST', { orgSlug: org.slug, planKey: toPlan });
      click(find(dialog.props.footer, element => element.type === 'button' && element.props.className === 'btn btn-lime'));
      await new Promise<void>(resolve => setImmediate(resolve));
      assertRequest(env.requests[1], '/api/billing/move', 'POST', { orgSlug: org.slug, planKey: toPlan, ...(direction === 'up' ? { prorationDate: 1793188800 } : {}) });
      assert.equal(moved.length, 1);
    } finally { runner.dispose(); env.dispose(); }
  });

  it('no-subscription refusal opens checkout with the chosen target, current cycle and host return', async () => {
    const env = environment(), runner = hookRunner();
    try {
      env.answer('/api/billing/move/preview', { code: 'no_live_subscription', error: 'No live subscription' }, false);
      env.answer('/api/billing/create-checkout', { url: 'https://stripe.test/move-checkout' });
      const org = { ...organization('club'), subscriptionPeriod: 'annual' };
      const moveExports = billingTestLoader({ react: runner.hooks })('components/billing/PlanMoveDialog.tsx') as { default: (props: Record<string, unknown>) => Element };
      const render = () => runner.render(() => moveExports.default({ org, toPlan: 'club_large', returnTo: billingBase, teamsHref: '/falcons-club/admin/rep-teams', onClose() {}, onMoved() {} }));
      render(); await new Promise<void>(resolve => setImmediate(resolve)); const dialog = render();
      click(find(dialog.props.footer, element => element.type === 'button' && element.props.className === 'btn btn-lime'));
      await new Promise<void>(resolve => setImmediate(resolve));
      assertRequest(env.requests[1], '/api/billing/create-checkout', 'POST', { planKey: 'club_large', billingCycle: 'annual', orgSlug: org.slug, returnTo: billingBase });
      assert.deepEqual(env.assigned, ['https://stripe.test/move-checkout']);
    } finally { runner.dispose(); env.dispose(); }
  });
});
