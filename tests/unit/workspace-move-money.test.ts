/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A COACH'S PORTAL BECOMES THE CLUB — THE MONEY (Plan & billing Stage 4b, Part 2; plan §3.3, §3.4, §6).
 *
 * Two ways in, one result. A PAYING Premium coach is moved onto Club on the subscription they have (Stripe proration, interval
 * kept, no second trial); a coach with no subscription (free days) buys Club at an ordinary checkout on the SAME workspace. Both
 * carry the club name, and the flip Part 1 built (`flip_workspace_into_club`) runs when the subscription is settled. Nothing here
 * talks to Stripe or a database: Stripe's methods and the database client are replaced with recorders, so a test can say exactly
 * what the move SENT and what the flip was ASKED.
 *
 *   1 · the club name (one rule, four entries)
 *   2 · the move rules for a Premium source (interval kept, trial, past due, no subscription, name before Stripe)
 *   3 · the preview's lines (and the fallback to the total alone)
 *   4 · the free-time path: checkout in place, the marker, the return address, a coach who leaves
 *   5 · the status read, before and after the flip
 *   6 · the webhook: the reactivation verdict and the event that follows the swap
 *   7 · what the entry routes are held to (owner-only, gated, nothing a user can see changes)
 *   8 · the review's fixes: a declined payment changes nothing, refusals come BEFORE the charge, money taken is never "nothing changed",
 *       and a cancelled portal that becomes the club gets its records back
 *
 * Every test here fails without the change it pins; the how is said beside the ones that are not obvious.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { supabaseAdmin } from '../../lib/supabase-admin.ts';
import { getStripe } from '../../lib/stripe.ts';
import { applyMove, applyPlanChangeSideEffects, hasLiveSubscription, previewMove, type MoveOrg, type MovePreview, type MoveRefusal } from '../../lib/plan-move.ts';
import { flipWorkspaceIntoClub } from '../../lib/workspace-flip.ts';
import { moveDirection } from '../../lib/plan-move-options.ts';
import { trustedPreviewLines, type PreviewInvoiceLike } from '../../lib/plan-move-preview-lines.ts';
import { PLAN_BILLING_WORDS as W } from '../../lib/plan-billing-words.ts';
import { BILLING_TAX_WORDS } from '../../lib/billing-tax.ts';
import {
  CLUB_NAME_MAX, CLUB_NAME_METADATA_KEY, IN_PLACE_METADATA_KEY, IN_PLACE_RETURN_PARAM,
  clubNameFromMetadata, clubUpgradeStateOf, inPlaceMetadata, inPlaceReturnPath, inPlaceUpgradeOf, parseClubName,
} from '../../lib/workspace-upgrade.ts';
import { readClubUpgradeState, workspaceCannotBecomeClub } from '../../lib/workspace-upgrade-status.ts';
import { getBillingHref } from '../../lib/billing-urls.ts';
import { isInAppUpMove, MOVE_METADATA_KEY } from '../../lib/plan-growth.ts';
import { restoreAfterReactivation } from '../../lib/billing-reactivation.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import { previewClubCheckout } from '../../lib/workspace-upgrade-preview.ts';
import { dueTodayOf } from './_club-upgrade-money.ts';

// ── Recorders ───────────────────────────────────────────────────────────────────────────────────────

type Answer = { one?: unknown | ((filters: Record<string, unknown>) => unknown); many?: unknown[]; count?: number };
type Call = { table: string | null; verb: string; args: unknown[] };

const originalFrom = supabaseAdmin.from.bind(supabaseAdmin);
const originalRpc = supabaseAdmin.rpc.bind(supabaseAdmin);
let log: Call[] = [];

/** Every `supabaseAdmin.from(t)...` chain resolves to what the test said for `t` (nothing found, by default) and writes are logged. */
function stubDatabase(answers: Record<string, Answer> = {}, rpcAnswers: Record<string, { data?: unknown; error?: { message: string } | null }> = {}) {
  log = [];
  (supabaseAdmin as any).from = (table: string) => {
    let one = false;
    const filters: Record<string, unknown> = {};
    const chain: any = new Proxy(() => {}, {
      get(_target, prop: string) {
        if (prop === 'then') {
          return (resolve: (value: unknown) => void) => {
            const a = answers[table] ?? {};
            if (one) resolve({ data: typeof a.one === 'function' ? (a.one as (f: Record<string, unknown>) => unknown)(filters) : a.one ?? null, error: null });
            else resolve({ data: a.many ?? [], error: null, count: a.count ?? 0 });
          };
        }
        return (...args: unknown[]) => {
          if (['update', 'insert', 'delete', 'upsert'].includes(prop)) log.push({ table, verb: prop, args });
          else if (prop === 'maybeSingle' || prop === 'single') one = true;
          else if (prop === 'eq') filters[String(args[0])] = args[1];
          return chain;
        };
      },
    });
    return chain;
  };
  (supabaseAdmin as any).rpc = async (name: string, params: unknown) => {
    log.push({ table: null, verb: `rpc:${name}`, args: [params] });
    return rpcAnswers[name] ?? { data: { alreadyFlipped: false, orgId: 'org_1', orgSlug: 'riverdale', workspaceId: 'ws_1', repTeamId: 'team_1', name: 'x' }, error: null };
  };
}

const writesTo = (table: string) => log.filter(c => c.table === table && c.verb !== 'select');
const rpcCalls = (name: string) => log.filter(c => c.verb === `rpc:${name}`).map(c => c.args[0] as Record<string, unknown>);

type StripeCalls = { retrieve: number; update: Array<Record<string, any>>; createPreview: number; release: number; previews: Array<Record<string, any>> };
const stripeOriginals: Record<string, unknown> = {};
let stripeCalls: StripeCalls = { retrieve: 0, update: [], createPreview: 0, release: 0, previews: [] };

function stubStripe(p: { sub: unknown; invoice?: unknown; newPrice?: { unit_amount: number; currency: string }; history?: { status: string; metadata?: Record<string, string> }[]; historyFails?: boolean }) {
  process.env.STRIPE_SECRET_KEY ??= 'sk_test_unit';
  const s: any = getStripe();
  stripeCalls = { retrieve: 0, update: [], createPreview: 0, release: 0, previews: [] };
  for (const [k, target] of [['subs', s.subscriptions], ['prices', s.prices], ['invoices', s.invoices], ['schedules', s.subscriptionSchedules]] as const) {
    stripeOriginals[k] = { ...target };
  }
  s.subscriptions.retrieve = async () => { stripeCalls.retrieve++; return p.sub; };
  s.subscriptions.list = () => (async function* () {
    if (p.historyFails) throw new Error('history unavailable');
    yield* p.history ?? [];
  })();
  s.subscriptions.update = async (_id: string, params: Record<string, any>) => { stripeCalls.update.push(params); return p.sub; };
  s.prices.retrieve = async () => p.newPrice ?? { unit_amount: 9900, currency: 'cad' };
  s.invoices.createPreview = async (params: Record<string, any>) => {
    stripeCalls.createPreview++; stripeCalls.previews.push(params);
    return typeof p.invoice === 'function' ? (p.invoice as (n: number) => unknown)(stripeCalls.createPreview) : p.invoice ?? invoiceOf([]);
  };
  s.subscriptionSchedules.release = async () => { stripeCalls.release++; };
}

function unstubStripe() {
  if (!stripeOriginals.subs) return;
  const s: any = getStripe();
  Object.assign(s.subscriptions, stripeOriginals.subs);
  Object.assign(s.prices, stripeOriginals.prices);
  Object.assign(s.invoices, stripeOriginals.invoices);
  Object.assign(s.subscriptionSchedules, stripeOriginals.schedules);
  for (const k of Object.keys(stripeOriginals)) delete stripeOriginals[k];
}

beforeEach(() => stubDatabase());
afterEach(() => {
  (supabaseAdmin as any).from = originalFrom;
  (supabaseAdmin as any).rpc = originalRpc;
  unstubStripe();
});

// ── Fixtures ────────────────────────────────────────────────────────────────────────────────────────

const NOW = Math.floor(Date.now() / 1000);
const OLD_PRICE = 'price_premium';
const NEW_PRICE = 'price_club';

const subscription = (over: Record<string, unknown> = {}, interval: 'month' | 'year' = 'month') => ({
  id: 'sub_premium', status: 'active', customer: 'cus_1', schedule: null,
  items: { data: [{ id: 'si_1', quantity: 1, price: { id: OLD_PRICE, recurring: { interval } }, current_period_start: NOW - 86400 * 10, current_period_end: NOW + 86400 * 20 }] },
  ...over,
});

const premiumOrg = (over: Partial<MoveOrg> = {}): MoveOrg => ({
  id: 'org_1', planId: 'team', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_premium', subscriptionStatus: 'active', ...over,
});

const line = (amount: number, price: string, over: Record<string, unknown> = {}) => ({
  amount, currency: 'cad', taxes: [], discount_amounts: [],
  parent: { type: 'subscription_item_details', subscription_item_details: { proration: true } },
  pricing: { price_details: { price } },
  ...over,
});

const invoiceOf = (lines: any[], over: Record<string, unknown> = {}): PreviewInvoiceLike & Record<string, unknown> => ({
  amount_due: lines.reduce((n, l) => n + l.amount, 0), currency: 'cad', starting_balance: 0,
  total_excluding_tax: lines.reduce((n, l) => n + l.amount, 0), automatic_tax: { enabled: true, status: 'complete' },
  total_taxes: [], total_discount_amounts: [], lines: { has_more: false, data: lines }, ...over,
});
/** What every move up below was shown: the default preview's figure (the press-time check compares the charge to it). */
const SHOWN = 0;

const PRICES = { stripe_prices: { one: (f: Record<string, unknown>) => ({ price_id: `price_${f.plan_id}_${f.billing_cycle}` }) } };
const ends = { fromPriceId: OLD_PRICE, toPriceId: NEW_PRICE, fromPlan: 'team' as const, toPlan: 'club' as const };
const isRefusal = (r: unknown): r is MoveRefusal => !!r && typeof r === 'object' && 'code' in r;

describe('Part 3 · before the owner confirms money', () => {
  it('a subscription set to end is refused before preview or charge — a Premium coach, and since Plans end at renewal every plan', async () => {
    stubDatabase(PRICES);
    stubStripe({ sub: subscription({ cancel_at_period_end: true }), invoice: invoiceOf([line(9900, NEW_PRICE)]) });
    for (const result of [await previewMove(premiumOrg(), 'club'), await applyMove(premiumOrg(), 'club', { expectedAmountDue: SHOWN, actor: 'test', clubName: 'Falcons' })]) {
      assert.ok('code' in result && result.code === 'subscription_ending');
      assert.ok('endsAt' in result && result.endsAt);
      assert.match(result.error, /Keep Premium first, then change it\./);
    }
    assert.equal(stripeCalls.createPreview, 0);
    assert.equal(stripeCalls.update.length, 0);
    // Decision 5 (owner 2026-11-01): the rule the owner ruled for a Premium coach now holds for every plan and both directions.
    const club = await previewMove(premiumOrg({ planId: 'club' }), 'club_large');
    assert.ok(isRefusal(club) && club.code === 'subscription_ending');
    assert.match(club.error, /Keep Club first, then change it\./);
  });
  for (const cycle of ['monthly', 'annual'] as const) {
    it(`${cycle}: first purchase quotes the effective trial and server price without creating anything`, async () => {
      stubDatabase({ ...PRICES, plan_config_overrides: { many: [{ plan_id: 'club', trial_days: 45 }] } });
      stubStripe({ sub: subscription(), newPrice: { unit_amount: 54321, currency: 'cad' } });
      const result = await previewClubCheckout(premiumOrg({ stripeSubscriptionId: null, stripeCustomerId: null }), 'club', cycle);
      assert.ok(!isRefusal(result));
      assert.equal(result.trialDays, 45);
      assert.equal(result.amountDueToday, 0);
      assert.equal(result.nextAmount, 54321);
      assert.equal(result.billingCycle, cycle);
      assert.ok(result.firstChargeAt);
      assert.equal(stripeCalls.update.length, 0);
      assert.equal(stripeCalls.createPreview, 0);
      assert.equal(log.length, 0, 'the quote writes no database rows');
    });
  }
  for (const status of ['active', 'trialing', 'canceled']) it(`earlier ${status}: no second trial and Stripe supplies due today, including customer credits`, async () => {
    stubDatabase(PRICES);
    stubStripe({ sub: subscription(), history: [{ status }], invoice: { amount_due: 12345, currency: 'cad', lines: { data: [] } } });
    const result = await previewClubCheckout(premiumOrg({ stripeSubscriptionId: null }), 'club', 'monthly');
    assert.ok(!isRefusal(result));
    assert.equal(result.trialDays, 0);
    assert.equal(result.amountDueToday, 12345);
    assert.equal(result.firstChargeAt, null);
    assert.equal(stripeCalls.createPreview, 1);
    assert.equal(stripeCalls.update.length, 0);
  });
  it('abandoned checkouts and next-season promises do not consume a trial', async () => {
    stubDatabase(PRICES);
    stubStripe({ sub: subscription(), history: [{ status: 'incomplete' }, { status: 'incomplete_expired' }, { status: 'trialing', metadata: { choiceKind: 'next_season' } }] });
    const result = await previewClubCheckout(premiumOrg({ stripeSubscriptionId: null }), 'club', 'monthly');
    assert.ok(!isRefusal(result));
    assert.equal(result.trialDays, PLAN_CONFIG.club.trialDays);
  });
  it('a zero trial override still quotes a new subscription, and expanded price lines preserve its renewal date', async () => {
    stubDatabase({ ...PRICES, plan_config_overrides: { many: [{ plan_id: 'club', trial_days: 0 }] } });
    stubStripe({ sub: subscription(), invoice: { amount_due: 9900, currency: 'cad', lines: { data: [{ pricing: { price_details: { price: { id: 'price_club_annual' } } }, period: { end: 1800000000 } }] } } });
    const result = await previewClubCheckout(premiumOrg({ stripeCustomerId: null, stripeSubscriptionId: null }), 'club', 'annual');
    assert.ok(!isRefusal(result));
    assert.equal(result.trialDays, 0);
    assert.equal(result.amountDueToday, 9900);
    assert.equal(result.renewsAt, new Date(1800000000 * 1000).toISOString());
  });
  it('ineligible workspaces are refused before Stripe, and a history failure never promises a trial', async () => {
    stubDatabase({ ...PRICES, team_workspaces: { one: { workspace_state: 'active' } }, rep_teams: { count: 2 } });
    stubStripe({ sub: subscription(), historyFails: true });
    assert.equal((await previewClubCheckout(premiumOrg(), 'club', 'monthly') as MoveRefusal).code, 'cannot_become_club');
    stubDatabase(PRICES);
    assert.equal((await previewClubCheckout(premiumOrg(), 'club', 'monthly') as MoveRefusal).code, 'stripe_error');
  });
});

// ── 1 · the club name ───────────────────────────────────────────────────────────────────────────────

describe('1 · the club name: one rule', () => {
  it('trims, collapses inner white space, and holds exactly 40 characters', () => {
    assert.deepEqual(parseClubName('  Riverdale   Ridge  Hawks '), { ok: true, name: 'Riverdale Ridge Hawks' });
    assert.equal(CLUB_NAME_MAX, 40);
    assert.equal(parseClubName('a'.repeat(40)).ok, true);
    const long = parseClubName('a'.repeat(41));
    assert.equal(long.ok, false);
    assert.equal(!long.ok && long.code, 'club_name_too_long');
  });

  it('counts a character once, however many bytes it takes', () => {
    assert.equal(parseClubName('⚾'.repeat(40)).ok, true);
    assert.equal(parseClubName('⚾'.repeat(41)).ok, false);
  });

  it('refuses nothing, blanks and non-text, in plain words', () => {
    for (const value of [undefined, null, '', '   ', 42, {}]) {
      const r = parseClubName(value);
      assert.equal(r.ok, false);
      assert.equal(!r.ok && r.code, 'club_name_required');
      assert.match(!r.ok ? r.error : '', /name for your club/);
    }
  });

  it('reads the name back off a Stripe record, and drops one that fails the rule instead of refusing the webhook', () => {
    assert.equal(clubNameFromMetadata({ [CLUB_NAME_METADATA_KEY]: ' Hawks ' }), 'Hawks');
    assert.equal(clubNameFromMetadata({ [CLUB_NAME_METADATA_KEY]: 'x'.repeat(41) }), null);
    assert.equal(clubNameFromMetadata({}), null);
    assert.equal(clubNameFromMetadata(null), null);
  });

  it('reaches the flip as p_club_name from all four entries — and the operator route, which sends none, keeps the name', async () => {
    stubDatabase({ team_workspaces: { one: { id: 'ws_1' } } });
    await flipWorkspaceIntoClub({ orgId: 'org_1', plan: 'club', actor: 'coach@example.com', clubName: 'Riverdale Hawks' });
    assert.equal(rpcCalls('flip_workspace_into_club')[0].p_club_name, 'Riverdale Hawks');
    // The operator's plan change passes no name: the RPC reads NULL as "keep today's".
    await flipWorkspaceIntoClub({ orgId: 'org_1', plan: 'club', actor: 'staff@example.com' });
    assert.equal(rpcCalls('flip_workspace_into_club')[1].p_club_name, null);
    const operator = readCode('lib/operator-plan-change.ts');
    assert.doesNotMatch(operator.slice(operator.indexOf('applyPlanChangeSideEffects({')), /clubName/, 'the operator change names no club');
    // The four entries, each by its source (the routes need a signed-in request, so these read the code):
    assert.match(readCode('lib/plan-move.ts'), /await applyPlanChangeSideEffects\(\{ orgId: org\.id, fromPlan: ownPlanOf\(org\), toPlan, actor: opts\.actor, clubName \}\)/, 'the move');
    assert.match(readCode('app/api/billing/webhook/route.ts'), /clubName: clubNameFromMetadata\(sub\.metadata\)/, 'the Stripe checkout, read back off the subscription');
    assert.match(readCode('app/api/billing/create-checkout/route.ts'), /actor: auth\.user\.email \?\? 'mock-checkout', clubName: inPlaceClubName \}\)/, 'the mock checkout');
  });
});

// ── 2 · the move rules for a Premium source ────────────────────────────────────────────────────────

describe('2 · Premium → Club: the move rules', () => {
  it('Premium moves up to Club and Club · Association — and only those', () => {
    assert.equal(moveDirection('team', 'club'), 'up');
    assert.equal(moveDirection('team', 'club_large'), 'up');
    assert.equal(moveDirection('team', 'tournament_plus'), null);
    assert.equal(moveDirection('club', 'team'), null, 'no way back down to Premium');
    assert.equal(moveDirection('club_large', 'team'), null);
  });

  it('keeps the billing interval: a monthly Premium prices Club monthly, an annual one annual', async () => {
    for (const [interval, cycle] of [['month', 'monthly'], ['year', 'annual']] as const) {
      stubDatabase(PRICES);
      stubStripe({ sub: subscription({}, interval), invoice: invoiceOf([line(5000, NEW_PRICE), line(-2000, OLD_PRICE)]) });
      const r = await previewMove(premiumOrg(), 'club');
      assert.ok(!isRefusal(r), JSON.stringify(r));
      assert.equal((r as MovePreview).billingCycle, cycle);
      unstubStripe();
    }
  });

  it('asks the price table for the SAME interval the subscription has', async () => {
    let askedCycle: unknown;
    stubDatabase({ stripe_prices: { one: (f: Record<string, unknown>) => { askedCycle = f.billing_cycle; return { price_id: NEW_PRICE }; } } });
    stubStripe({ sub: subscription({}, 'year'), invoice: invoiceOf([line(5000, NEW_PRICE), line(-2000, OLD_PRICE)]) });
    await previewMove(premiumOrg(), 'club');
    assert.equal(askedCycle, 'annual');
  });

  it('sends the swap with no second trial: a price change and a proration, never a trial, an anchor reset or a new subscription', async () => {
    stubDatabase(PRICES);
    stubStripe({ sub: subscription() });
    const r = await applyMove(premiumOrg(), 'club', { expectedAmountDue: SHOWN, actor: 'coach@example.com', clubName: 'Riverdale Hawks' });
    assert.ok(!isRefusal(r), JSON.stringify(r));
    assert.equal(stripeCalls.update.length, 1);
    const sent = stripeCalls.update[0];
    assert.deepEqual(sent.items, [{ id: 'si_1', price: 'price_club_monthly' }]);
    assert.equal(sent.proration_behavior, 'always_invoice');
    for (const key of ['trial_end', 'trial_period_days', 'billing_cycle_anchor', 'trial_settings']) assert.ok(!(key in sent), `${key} must not be sent`);
    assert.doesNotMatch(readCode('lib/plan-move.ts').slice(readCode('lib/plan-move.ts').indexOf('export async function applyMove')), /subscriptions\.create|checkout\.sessions/);
  });

  it('a trialing Premium coach moves too — on the trial they already have', async () => {
    stubDatabase(PRICES);
    stubStripe({ sub: subscription({ status: 'trialing' }) });
    const r = await applyMove(premiumOrg({ subscriptionStatus: 'trialing' }), 'club', { expectedAmountDue: SHOWN, actor: 'coach@example.com', clubName: 'Hawks' });
    assert.ok(!isRefusal(r), JSON.stringify(r));
    assert.ok(!('trial_end' in stripeCalls.update[0]));
  });

  it('REFUSES a move while the payment is failing — before any price is shown or any charge is made (new refusal: payment_failing)', async () => {
    for (const org of [premiumOrg({ subscriptionStatus: 'past_due' }), premiumOrg()]) {
      stubDatabase(PRICES);
      // Our record says past due, or only Stripe does (the record can lag): either refuses.
      stubStripe({ sub: subscription({ status: 'past_due' }), invoice: invoiceOf([]) });
      const preview = await previewMove(org, 'club');
      assert.ok(isRefusal(preview) && preview.code === 'payment_failing', JSON.stringify(preview));
      assert.match(isRefusal(preview) ? preview.error : '', /payment method/);
      assert.doesNotMatch(isRefusal(preview) ? preview.error : '', /\bcard\b/i);
      assert.equal(stripeCalls.createPreview, 0, 'no preview is priced');
      const applied = await applyMove(org, 'club', { expectedAmountDue: SHOWN, actor: 'coach@example.com', clubName: 'Hawks' });
      assert.ok(isRefusal(applied) && applied.code === 'payment_failing');
      assert.equal(stripeCalls.update.length, 0, 'nothing is charged');
      unstubStripe();
    }
  });

  it('only Premium is held to it: a past-due Tournament Plus owner is moved as before', async () => {
    stubDatabase(PRICES);
    stubStripe({ sub: subscription({ status: 'past_due' }), invoice: invoiceOf([line(5000, NEW_PRICE), line(-2000, OLD_PRICE)]) });
    const r = await previewMove(premiumOrg({ planId: 'tournament_plus', subscriptionStatus: 'past_due' }), 'club');
    assert.ok(!isRefusal(r));
  });

  it('a coach with no subscription is not moved — free days, a stale or dev subscription, a cancelled one — they go to checkout', async () => {
    stubDatabase(PRICES);
    stubStripe({ sub: subscription() });
    for (const org of [
      premiumOrg({ stripeSubscriptionId: null, subscriptionStatus: 'active' }),        // a free-time portal: no subscription id
      premiumOrg({ stripeSubscriptionId: 'mock_sub_team_monthly_1' }),                  // a dev subscription Stripe never heard of
      premiumOrg({ subscriptionStatus: 'canceled' }),
    ]) {
      const r = await previewMove(org, 'club');
      assert.ok(isRefusal(r) && r.code === 'no_live_subscription', JSON.stringify(r));
      assert.equal((await applyMove(org, 'club', { expectedAmountDue: SHOWN, actor: 'x', clubName: 'Hawks' }) as MoveRefusal).code, 'no_live_subscription');
    }
    assert.equal(stripeCalls.retrieve, 0, 'Stripe is not even asked');
  });

  it('REFUSES without a club name BEFORE Stripe is touched (a Premium portal becoming the club has to be called something)', async () => {
    stubDatabase(PRICES);
    stubStripe({ sub: subscription() });
    for (const clubName of [undefined, null, '', '   ', 'x'.repeat(41)]) {
      const r = await applyMove(premiumOrg(), 'club', { expectedAmountDue: SHOWN, actor: 'x', clubName });
      assert.ok(isRefusal(r) && r.code === 'club_name_invalid', JSON.stringify(r));
    }
    assert.equal(stripeCalls.retrieve + stripeCalls.update.length, 0);
  });

  it('puts the name and the in-place marker on the SUBSCRIPTION (a webhook retry has no request), and hands the flip the same name', async () => {
    stubDatabase(PRICES, {});
    stubStripe({ sub: subscription() });
    await applyMove(premiumOrg(), 'club', { expectedAmountDue: SHOWN, actor: 'coach@example.com', clubName: '  Riverdale   Hawks ' });
    const md = stripeCalls.update[0].metadata;
    assert.equal(md[CLUB_NAME_METADATA_KEY], 'Riverdale Hawks');
    assert.equal(md[IN_PLACE_METADATA_KEY], '1');
    assert.equal(md[MOVE_METADATA_KEY], 'up');
    assert.equal(md.planKey, 'club');
  });

  it('runs the flip with the name on the way out (the plan write precedes it, as the webhook retry expects)', async () => {
    stubDatabase({ ...PRICES, team_workspaces: { one: { id: 'ws_1' } } });
    stubStripe({ sub: subscription() });
    await applyMove(premiumOrg(), 'club', { expectedAmountDue: SHOWN, actor: 'coach@example.com', clubName: 'Riverdale Hawks' });
    const planWrite = log.findIndex(c => c.table === 'organizations' && c.verb === 'update' && (c.args[0] as any)?.plan_id === 'club');
    const flip = log.findIndex(c => c.verb === 'rpc:flip_workspace_into_club');
    assert.ok(planWrite >= 0 && flip > planWrite, 'plan written, then flipped');
    assert.deepEqual(rpcCalls('flip_workspace_into_club')[0], {
      p_org_id: 'org_1', p_plan: 'club', p_club_name: 'Riverdale Hawks', p_tournament_limit: PLAN_CONFIG.club.tournamentLimit, p_actor: 'coach@example.com',
    });
  });

  it('a move that is not a portal becoming the club asks for no name (Tournament Plus → Club)', async () => {
    stubDatabase({ ...PRICES });
    stubStripe({ sub: subscription() });
    const r = await applyMove(premiumOrg({ planId: 'tournament_plus' }), 'club', { expectedAmountDue: SHOWN, actor: 'x' });
    assert.ok(!isRefusal(r), JSON.stringify(r));
    assert.ok(!(IN_PLACE_METADATA_KEY in stripeCalls.update[0].metadata));
    assert.equal(rpcCalls('flip_workspace_into_club').length, 0, 'no workspace row: the flip answers without calling the database function');
  });

  it('an organization that carries plan team but is not a workspace is moved, and the flip answers "not a workspace" without writing', async () => {
    stubDatabase({ ...PRICES });                      // team_workspaces finds nothing
    stubStripe({ sub: subscription() });
    const r = await applyMove(premiumOrg(), 'club', { expectedAmountDue: SHOWN, actor: 'x', clubName: 'Hawks' });
    assert.ok(!isRefusal(r), JSON.stringify(r));
    assert.equal(rpcCalls('flip_workspace_into_club').length, 0);
    assert.deepEqual(await flipWorkspaceIntoClub({ orgId: 'org_1', plan: 'club', actor: 'x', clubName: 'Hawks' }), { status: 'skipped', reason: 'not_a_workspace' });
  });

  it('team-limit refusals can never offer a Premium coach the move: a portal has no team cap to reach', () => {
    // teamLimitRefusal picks its move-up target from MOVES; it is only called when the cap is under 9999.
    assert.ok(PLAN_CONFIG.team.teamLimit >= 9999);
    for (const route of ['app/api/admin/rep-teams/teams/route.ts', 'app/api/admin/rep-teams/teams/[teamId]/route.ts']) {
      assert.match(readCode(route), /cap < 9999|teamLimit < 9999|cap\s*<\s*9999/, `${route} guards on a finite cap`);
    }
  });

  it('the checkout 409 for a live Premium subscription now carries the move, and a free-time portal gets no 409', () => {
    const live = (over: Partial<MoveOrg> = {}) => hasLiveSubscription(premiumOrg(over));
    assert.equal(live(), true);
    assert.equal(live({ stripeSubscriptionId: null }), false, 'free days: no subscription, so the checkout is accepted');
    assert.equal(moveDirection('team', 'club'), 'up', '… and the 409 for a paying one names the move');
  });
});

// ── 3 · the preview's lines ─────────────────────────────────────────────────────────────────────────

describe('2b · GST/HST Stage 2 Part 3: the quote is taxed, and the charge is checked against it when pressed', () => {
  const taxedPreview = (due: number, tax: number) => invoiceOf([line(due - tax, NEW_PRICE)], {
    amount_due: due, total_excluding_tax: due - tax, total_taxes: [{ amount: tax, tax_behavior: 'exclusive' }],
    customer_address: { country: 'CA', state: 'AB' },
  });

  it('the quote asks Stripe for the tax, by a typed address when there is one, and reads it back by name and place', async () => {
    stubDatabase(PRICES);
    stubStripe({ sub: subscription(), invoice: taxedPreview(1050, 50) });
    const address = { line1: '200 8 Ave SW', line2: '', city: 'Calgary', state: 'AB', postal_code: 'T2P 1J9', country: 'CA' };
    const quoted = await previewMove(premiumOrg(), 'club', { kind: 'typed', address }) as Extract<MovePreview, { direction: 'up' }>;
    assert.deepEqual(stripeCalls.previews[0].automatic_tax, { enabled: true });
    assert.deepEqual(stripeCalls.previews[0].customer_details, { address });
    assert.equal(quoted.amountDueToday, 1050, 'Due today includes the tax');
    assert.deepEqual(quoted.tax, { status: 'taxed', lines: [{ label: 'Tax', cents: 50 }], beforeTax: 1000, taxedFor: { country: 'CA', region: 'AB' } });
  });

  it('an address not complete yet asks Stripe for no tax and says the figures wait', async () => {
    stubDatabase(PRICES);
    stubStripe({ sub: subscription(), invoice: taxedPreview(1050, 50) });
    const quoted = await previewMove(premiumOrg(), 'club', { kind: 'wait' }) as Extract<MovePreview, { direction: 'up' }>;
    assert.ok(!('automatic_tax' in stripeCalls.previews[0]) && !('customer_details' in stripeCalls.previews[0]));
    assert.deepEqual(quoted.tax, { status: 'needs_address' });
  });

  it('a quote Stripe could not place is never a figure to pay', async () => {
    stubDatabase(PRICES);
    stubStripe({ sub: subscription(), invoice: invoiceOf([line(1000, NEW_PRICE)], { automatic_tax: { enabled: true, status: 'requires_location_inputs' } }) });
    const quoted = await previewMove(premiumOrg(), 'club') as Extract<MovePreview, { direction: 'up' }>;
    assert.equal(quoted.tax.status, 'not_worked_out');
  });

  it('the charge that equals the quote is made; the check asks by the customer’s own address (the club’s, stamped first)', async () => {
    stubDatabase(PRICES);
    stubStripe({ sub: subscription(), invoice: taxedPreview(1050, 50) });
    const r = await applyMove(premiumOrg(), 'club', { expectedAmountDue: 1050, prorationDate: 1, actor: 'x', clubName: 'Hawks' });
    assert.ok(!isRefusal(r), JSON.stringify(r));
    assert.equal(stripeCalls.update.length, 1);
    assert.deepEqual(stripeCalls.update[0].automatic_tax, { enabled: true });
    assert.ok(!('customer_details' in stripeCalls.previews[0]), 'the check is the charge’s own question');
    assert.equal(stripeCalls.previews[0].subscription_details.proration_date, stripeCalls.update[0].proration_date, 'the same proration date both ways');
  });

  it('a charge that changed is NOT made: nothing in Stripe is touched, and the new quote comes back for a second press', async () => {
    for (const expectedAmountDue of [1130, undefined]) {
      stubDatabase(PRICES);
      stubStripe({ sub: subscription({ schedule: { id: 'sub_sched_1' } }), invoice: taxedPreview(1050, 50) });
      const r = await applyMove(premiumOrg(), 'club', { expectedAmountDue, actor: 'x', clubName: 'Hawks' });
      assert.ok(isRefusal(r) && r.code === 'charge_changed', JSON.stringify(r));
      assert.equal(stripeCalls.update.length, 0, 'nothing is charged');
      assert.equal(stripeCalls.release, 0, 'a waiting move down is not released either');
      if (isRefusal(r) && r.code === 'charge_changed') {
        assert.equal(r.preview.direction === 'up' && r.preview.amountDueToday, 1050);
        assert.equal(r.error, W.move.chargeChanged(1050, 'cad', W.clubUpgrade.start));
      }
      unstubStripe();
    }
  });

  it('a check Stripe could not place refuses with the sentence, before any change', async () => {
    stubDatabase(PRICES);
    stubStripe({ sub: subscription(), invoice: invoiceOf([line(1000, NEW_PRICE)], { automatic_tax: { enabled: true, status: 'requires_location_inputs' } }) });
    const r = await applyMove(premiumOrg(), 'club', { expectedAmountDue: 1000, actor: 'x', clubName: 'Hawks' });
    assert.ok(isRefusal(r) && r.code === 'stripe_error' && r.error === BILLING_TAX_WORDS.notWorkedOut, JSON.stringify(r));
    assert.equal(stripeCalls.update.length, 0);
  });
});

describe('3 · the preview’s lines', () => {
  it('maps a charge on the new plan and a credit on the old, and they add up to the amount due', () => {
    const lines = trustedPreviewLines(invoiceOf([line(5000, NEW_PRICE), line(-1800, OLD_PRICE)]), ends);
    assert.deepEqual(lines, [{ kind: 'charge', plan: 'club', amount: 5000 }, { kind: 'credit', plan: 'team', amount: 1800 }]);
    assert.equal(dueTodayOf(lines!), 3200);
  });

  it('adds lines of one price together, so the screen draws one charge and one credit', () => {
    const lines = trustedPreviewLines(invoiceOf([line(3000, NEW_PRICE), line(2000, NEW_PRICE), line(-1000, OLD_PRICE), line(-500, OLD_PRICE)]), ends);
    assert.deepEqual(lines, [{ kind: 'charge', plan: 'club', amount: 5000 }, { kind: 'credit', plan: 'team', amount: 1500 }]);
  });

  it('keys on the price Stripe reports (an id, or an expanded price) and never on its wording', () => {
    const expanded = invoiceOf([line(5000, { id: NEW_PRICE } as any), line(-2000, { id: OLD_PRICE } as any)]);
    assert.equal(trustedPreviewLines(expanded, ends)?.length, 2);
    assert.doesNotMatch(readCode('lib/plan-move-preview-lines.ts'), /description/, 'the line text is Stripe’s, and Part 3 supplies the words');
  });

  it('GST/HST Stage 2 Part 3: a tax added on top keeps the lines (they are before tax, the tax is its own row)', () => {
    const taxed = invoiceOf([line(5000, NEW_PRICE, { taxes: [{ amount: 650 }] }), line(-2000, OLD_PRICE, { taxes: [{ amount: -260 }] })],
      { total_taxes: [{ amount: 390, tax_behavior: 'exclusive' }], amount_due: 3390 });
    assert.deepEqual(trustedPreviewLines(taxed, ends), [{ kind: 'charge', plan: 'club', amount: 5000 }, { kind: 'credit', plan: 'team', amount: 2000 }]);
  });

  it('falls back to the total alone whenever a line cannot be trusted', () => {
    const good = () => [line(5000, NEW_PRICE), line(-2000, OLD_PRICE)];
    const cases: Record<string, PreviewInvoiceLike> = {
      'no lines': invoiceOf([]),
      'more lines than Stripe sent': invoiceOf(good(), { lines: { has_more: true, data: good() } }),
      'a tax included in the price': invoiceOf(good(), { total_taxes: [{ amount: 100, tax_behavior: 'inclusive' }], amount_due: 3100 }),
      'a tax whose kind Stripe did not say': invoiceOf(good(), { total_taxes: [{ amount: 100 }], amount_due: 3100 }),
      'a tax on top that does not add up': invoiceOf(good(), { total_taxes: [{ amount: 390, tax_behavior: 'exclusive' }], amount_due: 3000 }),
      'a discount on the invoice': invoiceOf(good(), { total_discount_amounts: [{ amount: 100 }] }),
      'a customer balance in play': invoiceOf(good(), { starting_balance: -500 }),
      'a discount on a line': invoiceOf([line(5000, NEW_PRICE, { discount_amounts: [{ amount: 1 }] }), line(-2000, OLD_PRICE)]),
      'another currency': invoiceOf([line(5000, NEW_PRICE, { currency: 'usd' }), line(-2000, OLD_PRICE)]),
      'a line that is not a proration': invoiceOf([line(5000, NEW_PRICE, { parent: { type: 'subscription_item_details', subscription_item_details: { proration: false } } }), line(-2000, OLD_PRICE)]),
      'a line from something else': invoiceOf([line(5000, NEW_PRICE, { parent: { type: 'invoice_item_details', subscription_item_details: null } }), line(-2000, OLD_PRICE)]),
      'a price we do not know': invoiceOf([line(5000, NEW_PRICE), line(-2000, 'price_other')]),
      'a credit on the new price': invoiceOf([line(5000, NEW_PRICE), line(-2000, NEW_PRICE)]),
      'a charge on the old price': invoiceOf([line(5000, OLD_PRICE), line(-2000, NEW_PRICE)]),
      'a fraction of a cent': invoiceOf([line(5000.5, NEW_PRICE), line(-2000, OLD_PRICE)]),
      'lines that do not add up to what is due': invoiceOf(good(), { amount_due: 3001 }),
    };
    for (const [why, invoice] of Object.entries(cases)) assert.equal(trustedPreviewLines(invoice, ends), null, why);
    assert.equal(trustedPreviewLines(invoiceOf(good()), { ...ends, toPriceId: OLD_PRICE }), null, 'the same price both ways');
  });

  it('is on the preview the move returns — lines when trusted, the total alone (lines: null, amount kept) when not', async () => {
    stubDatabase({ stripe_prices: { one: { price_id: NEW_PRICE } } });
    stubStripe({ sub: subscription(), invoice: invoiceOf([line(5000, NEW_PRICE), line(-2000, OLD_PRICE)]) });
    const trusted = await previewMove(premiumOrg(), 'club') as Extract<MovePreview, { direction: 'up' }>;
    assert.equal(trusted.amountDueToday, 3000);
    assert.deepEqual(trusted.lines, [{ kind: 'charge', plan: 'club', amount: 5000 }, { kind: 'credit', plan: 'team', amount: 2000 }]);
    assert.equal(dueTodayOf(trusted.lines!), trusted.amountDueToday, 'the lines the screen draws add up to the figure it charges');
    unstubStripe();
    stubStripe({ sub: subscription(), invoice: invoiceOf([line(5000, NEW_PRICE), line(-2000, OLD_PRICE)], { total_taxes: [{ amount: 390 }], amount_due: 3390 }) });
    const untrusted = await previewMove(premiumOrg(), 'club') as Extract<MovePreview, { direction: 'up' }>;
    assert.equal(untrusted.amountDueToday, 3390);
    assert.equal(untrusted.lines, null);
  });

  it('the dialog reads the preview’s trusted lines with the total-only fallback', () => {
    assert.match(readCode('components/billing/PlanMoveDialog.tsx'), /lines\s*:/);
    assert.match(readCode('components/billing/PlanMoveDialog.tsx'), /preview\.lines\?\.map/);
  });
});

// ── 4 · the free-time path: checkout in place ──────────────────────────────────────────────────────

describe('4 · a coach with no subscription buys Club on the same workspace', () => {
  const portal = { accountKind: 'team_workspace', planId: 'team' };

  it('is an in-place upgrade only for a portal buying a Club band — and then it needs a name', () => {
    assert.deepEqual(inPlaceUpgradeOf(portal, 'club', ' Hawks '), { kind: 'in_place', clubName: 'Hawks' });
    assert.deepEqual(inPlaceUpgradeOf(portal, 'club_large', 'Hawks'), { kind: 'in_place', clubName: 'Hawks' });
    assert.equal(inPlaceUpgradeOf(portal, 'club', '').kind, 'refused');
    assert.equal(inPlaceUpgradeOf(portal, 'club', 'x'.repeat(41)).kind, 'refused');
    for (const [org, plan] of [
      [portal, 'tournament_plus'], [portal, 'league'],
      [{ accountKind: 'organization', planId: 'club' }, 'club_large'],               // a club moving bands
      [{ accountKind: 'organization', planId: 'tournament_plus' }, 'club'],          // a tournament organization buying Club
    ] as const) assert.equal(inPlaceUpgradeOf(org, plan, undefined).kind, 'not_in_place', `${org.accountKind}/${org.planId} → ${plan}`);
  });

  it('carries the marker and the name in ONE metadata object that goes on both the session and the subscription', () => {
    const md = inPlaceMetadata({ orgId: 'o', planKey: 'club', billingCycle: 'annual' }, 'Hawks');
    assert.deepEqual(md, { orgId: 'o', planKey: 'club', billingCycle: 'annual', [IN_PLACE_METADATA_KEY]: '1', [CLUB_NAME_METADATA_KEY]: 'Hawks' });
    const checkout = readCode('app/api/billing/create-checkout/route.ts');
    const stripeCall = checkout.slice(checkout.indexOf('stripe.checkout.sessions.create'));
    assert.match(stripeCall, /subscription_data: \{[\s\S]*?\n {6}metadata,\n {4}\},/, 'the subscription');
    assert.match(stripeCall, /\n    metadata,\n/, 'the session');
    assert.match(checkout, /const metadata = inPlaceClubName \? inPlaceMetadata\(checkoutMetadata, inPlaceClubName\) : checkoutMetadata;/, 'one object, built from the in-place name');
    assert.equal(clubNameFromMetadata(md), 'Hawks', '… and the webhook reads it back');
  });

  it('is asked for the name AFTER the live-subscription 409 and BEFORE either checkout, and answers 400 with the code', () => {
    const checkout = readCode('app/api/billing/create-checkout/route.ts');
    const live = checkout.indexOf("code: 'subscription_exists'");
    const named = checkout.indexOf('inPlaceUpgradeOf(auth.org, planKey, body.clubName)');
    const mock = checkout.indexOf('if (shouldApplyDirectly)');
    const real = checkout.indexOf('stripe.checkout.sessions.create');
    assert.ok(live > 0 && named > live && named < mock && mock < real, 'order: 409 → name → mock → Stripe');
    assert.match(checkout, /if \(inPlace\.kind === 'refused'\) \{[\s\S]*?code: inPlace\.code[\s\S]*?status: 400/);
  });

  it('returns to an address that works BEFORE and AFTER the flip; leaving the payment page returns to where the coach was', () => {
    const slug = 'riverdale-ridge';
    const success = inPlaceReturnPath(slug);
    assert.equal(success, `/${slug}/admin/org/billing?${IN_PLACE_RETURN_PARAM}=club`);
    // After the flip the club's billing address IS that page …
    assert.equal(getBillingHref({ slug, planId: 'club', accountKind: 'organization' }), `/${slug}/admin/org/billing`);
    // … before it, the coach's own billing page is a DIFFERENT address, which stops existing at the flip — so it is not the return.
    assert.equal(getBillingHref({ slug, planId: 'team', accountKind: 'team_workspace' }, { purpose: 'return' }), `/${slug}/coaches/billing`);
    assert.ok(!success.startsWith(`/${slug}/coaches/`));
    // … and until the flip lands that page sends the coach on to the portal's billing page, query string intact.
    const page = readCode('app/[orgSlug]/admin/org/billing/page.tsx');
    assert.match(page, /isTeamWorkspaceOrg\(auth\.org\)[\s\S]*redirect\(pathWithSearchParams\(getBillingHref\(auth\.org, \{ host: 'coach', purpose: 'return' \}\), await searchParams\)\)/);
    const checkout = readCode('app/api/billing/create-checkout/route.ts');
    assert.match(checkout, /const successReturnTo = inPlaceClubName \? inPlaceReturnPath\(auth\.org\.slug\) : safeReturnTo;/);
    assert.match(checkout, /success_url: appendSuccess\(`\$\{appUrl\}\$\{successReturnTo\}`\),\s*cancel_url: `\$\{appUrl\}\$\{safeReturnTo\}`,/, 'cancel is unchanged: the coach keeps what they had');
    assert.match(checkout, /url: appendSuccess\(`\$\{appUrl\}\$\{successReturnTo\}`\),\s*applied: true,\s*planKey,\s*billingCycle,\s*restoredCount/, 'the dev checkout returns the same place');
  });

  it('a coach who leaves the payment page keeps their free time: the checkout writes nothing before Stripe confirms', () => {
    const checkout = readCode('app/api/billing/create-checkout/route.ts');
    const real = checkout.slice(checkout.indexOf('// ── Production: real Stripe checkout'));
    assert.doesNotMatch(real, /\.update\(|\.insert\(|\.delete\(|org_overrides|applyPlanChangeSideEffects|flipWorkspaceIntoClub/, 'no database write on the way to Stripe (but the startup-task reset)');
  });

  it('ends the staff-given free days at the upgrade through the flip’s own revoke — proved, not rebuilt', () => {
    assert.match(flipMigration(), /update public\.org_overrides set revoked_at = v_now/i);
  });

  it('the trial: an ordinary Club checkout still withholds it from a customer that ever held a subscription — and cannot see another customer’s history', () => {
    const checkout = readCode('app/api/billing/create-checkout/route.ts');
    assert.match(checkout, /mergedConfig\.trialDays > 0 && !\(await hadSubscriptionBefore\(customerId\)\)/);
    assert.match(readCode('lib/plan-move.ts'), /subscriptions\.list\(\{ customer: customerId/, 'scoped to ONE Stripe customer — the limit reported in the hand-off');
  });
});

/** The migration that defines the flip, read as text (the RPC itself has not run anywhere). */
function flipMigration(): string {
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const file = readdirSync(dir).filter(f => /becomes_the_club/.test(f) && f.endsWith('.sql')).sort().pop();
  assert.ok(file, 'the flip migration is missing');
  return readFileSync(new URL(file, dir), 'utf8').replace(/\r\n/g, '\n').split('\n').map(l => l.replace(/--.*$/, '')).join('\n');
}

// ── 5 · the status read ────────────────────────────────────────────────────────────────────────────

describe('5 · the status read, before and after the flip', () => {
  const orgRow = (over: Record<string, unknown> = {}) => ({ account_kind: 'team_workspace', plan_id: 'team', subscription_status: 'active', stripe_subscription_id: null, ...over });
  const workspace = (over: Record<string, unknown> = {}) => ({ workspace_state: 'independent', billing_mode: 'team_direct', ...over });

  it('BEFORE: a portal with free days has not become anything and is waiting on nothing', () => {
    assert.deepEqual(clubUpgradeStateOf(orgRow(), workspace()), { becameClub: false, waitingOnPayment: false });
  });

  it('WAITING: Club is on the organization but the subscription is not settled — the flip’s own gate', () => {
    for (const [status, sub] of [['past_due', 'sub_1'], ['incomplete', 'sub_1'], ['canceled', 'sub_1'], ['active', null]] as const) {
      assert.deepEqual(clubUpgradeStateOf(orgRow({ plan_id: 'club', subscription_status: status, stripe_subscription_id: sub }), workspace()),
        { becameClub: false, waitingOnPayment: true }, `${status}/${sub}`);
    }
    for (const status of ['active', 'trialing']) {
      assert.equal(clubUpgradeStateOf(orgRow({ plan_id: 'club_large', subscription_status: status, stripe_subscription_id: 'sub_1' }), workspace()).waitingOnPayment, false, `${status} is settled: the flip is about to run`);
    }
  });

  it('AFTER: the flip’s own idempotency test — the tag is off and the workspace row is its tombstone', () => {
    assert.deepEqual(
      clubUpgradeStateOf(orgRow({ account_kind: 'organization', plan_id: 'club', subscription_status: 'trialing', stripe_subscription_id: 'sub_1' }),
        workspace({ workspace_state: 'org_owned', billing_mode: 'club_included' })),
      { becameClub: true, waitingOnPayment: false });
  });

  it('half-way is not "became": the tag alone, or the tombstone alone', () => {
    assert.equal(clubUpgradeStateOf(orgRow({ account_kind: 'organization' }), workspace()).becameClub, false);
    assert.equal(clubUpgradeStateOf(orgRow(), workspace({ workspace_state: 'org_owned', billing_mode: 'club_included' })).becameClub, false);
  });

  it('an ordinary club (no workspace row) was never a portal and is waiting on nothing', () => {
    assert.deepEqual(clubUpgradeStateOf(orgRow({ account_kind: 'organization', plan_id: 'club', subscription_status: 'past_due' }), null), { becameClub: false, waitingOnPayment: false });
  });

  it('reads both rows fresh by organization id, on either side of the flip', async () => {
    stubDatabase({
      organizations: { one: orgRow({ account_kind: 'organization', plan_id: 'club', subscription_status: 'active', stripe_subscription_id: 'sub_1' }) },
      team_workspaces: { one: workspace({ workspace_state: 'org_owned', billing_mode: 'club_included' }) },
    });
    assert.deepEqual(await readClubUpgradeState('org_1'), { becameClub: true, waitingOnPayment: false });
    stubDatabase({ organizations: { one: orgRow() }, team_workspaces: { one: workspace() } });
    assert.deepEqual(await readClubUpgradeState('org_1'), { becameClub: false, waitingOnPayment: false });
    stubDatabase({});
    assert.deepEqual(await readClubUpgradeState('missing'), { becameClub: false, waitingOnPayment: false });
  });

  it('is owner-only, names the organization, tolerates a lapsed one, and answers nothing beyond the two facts', () => {
    const route = readCode('app/api/billing/club-upgrade-status/route.ts');
    assert.match(route, /getAuthContext\(\{ orgSlug, requireOrgSlug: true, allowSuspendedOrg: true \}\)/);
    assert.match(route, /requireCapability\(auth, 'billing'\)/);
    assert.match(route, /NextResponse\.json\(await readClubUpgradeState\(auth\.org\.id\)/);
    assert.match(route, /no-store/);
    assert.doesNotMatch(route, /auth\.org\.(name|stripe|slug)|auth\.user/, 'no name, no Stripe id, no person in the answer');
    assert.ok(route.indexOf('requireCapability') < route.indexOf('readClubUpgradeState('), 'the owner check precedes the read');
  });
});

// ── 6 · the webhook ────────────────────────────────────────────────────────────────────────────────

describe('6 · the webhook: the reactivation verdict, and the event that follows the swap', () => {
  it('REACTIVATION ON A FRESHLY FLIPPED ORGANIZATION IS HARMLESS: it unsuspends nothing, restores nothing, and only closes the old cancellation clock', async () => {
    // The state after the flip: not suspended (the flip cleared it), no retained records filed under the organization reasons
    // (a portal's cancellation is filed under its own tag), and an old applied cancellation intent. The only write is closing it.
    // The withdraw's log append (Plans end at renewal Stage 2 Part C) reads the row's status, log and stamp first.
    stubDatabase({
      organizations: { one: { billing_suspended_at: null, is_public: true } },
      billing_retained_records: { many: [] },
      tournaments: { count: 0 },
      billing_retention_intents: { many: [{ id: 'intent_1' }], one: { id: 'intent_1', status: 'pending', change_log: [], updated_at: '2026-11-01T00:00:00.000000+00:00' } },
    });
    const result = await restoreAfterReactivation('org_1', PLAN_CONFIG.club.tournamentLimit);
    assert.deepEqual(result, { unsuspended: false, siteBackOnline: false, restoredTournamentIds: [], stillRetainedTournaments: 0, closedIntents: 1 });
    // Plans end at renewal (Stage 1): the second write withdraws a waiting cancel the old subscription left (this stub answers
    // every read of the table with the same row, so it finds one).
    assert.deepEqual(log.filter(c => c.verb !== 'select').map(c => [c.table, c.verb]), [['billing_retention_intents', 'update'], ['billing_retention_intents', 'update']]);
    assert.deepEqual(writesTo('billing_retention_intents')[0].args, [{ status: 'restored' }]);
    assert.equal((writesTo('billing_retention_intents')[1].args[0] as { status: string }).status, 'canceled');
    for (const untouched of ['organizations', 'tournaments', 'billing_retained_records']) assert.equal(writesTo(untouched).length, 0, untouched);
  });

  it('… because a portal’s own cancellation records are not the ones it reads (a different reason tag)', () => {
    const reactivation = readCode('lib/billing-reactivation.ts');
    assert.match(reactivation, /const CANCELLATION_REASONS = \['account_cancellation', 'stripe_subscription_deleted'\];/);
    // Its records are restored by their own module — and, since the review, by the flip too (section 8) — never by this one.
    assert.match(readCode('lib/portal-retained-restore.ts'), /'coaches_portal_cancellation'/);
    assert.doesNotMatch(reactivation, /coaches_portal_cancellation/);
  });

  it('the flip runs BEFORE reactivation in the webhook, so the suspension the flip clears is never left for it', () => {
    const webhook = readCode('app/api/billing/webhook/route.ts');
    const flip = webhook.indexOf("actor: 'stripe-webhook',");
    const restore = webhook.indexOf('await restoreAfterReactivation(updatedOrg.id');
    assert.ok(flip > 0 && restore > flip);
  });

  it('the event that follows the swap does not re-enter the Premium arm: it is entered by the PRICE, never by the old keys the move leaves on the subscription', async () => {
    stubDatabase({ ...PRICES });
    stubStripe({ sub: subscription() });
    await applyMove(premiumOrg(), 'club', { expectedAmountDue: SHOWN, actor: 'coach@example.com', clubName: 'Hawks' });
    // Stripe MERGES the move's metadata onto what the Premium subscription already carried:
    const merged = { checkoutKind: 'team', teamWorkspaceId: 'ws_1', ...stripeCalls.update[0].metadata } as Record<string, string>;
    assert.equal(merged.planKey, 'club', 'the move overwrote the plan key the Premium checkout wrote');
    assert.ok(isInAppUpMove(merged, 'club'), 'the growth event is not counted twice');
    assert.ok(!('choiceKind' in merged), 'the move never makes it a next-season choice');
    const webhook = readCode('app/api/billing/webhook/route.ts');
    const arm = webhook.slice(webhook.indexOf("case 'customer.subscription.created':"), webhook.indexOf("case 'customer.subscription.deleted':"));
    assert.match(arm, /const matchedPlan = await getPlanFromPriceId\(priceId\);/);
    assert.match(arm, /const planKey = matchedPlan\.planId as OrgPlan;/);
    assert.match(arm, /if \(planKey === 'team'\) \{[\s\S]*?provisionTeamWorkspaceFromCheckoutMetadata[\s\S]*?break;\s*\}/, 'the Premium arm is the plan key and nothing else');
    assert.equal((arm.match(/provisionTeamWorkspaceFromCheckoutMetadata/g) ?? []).length, 1);
    const before = arm.slice(0, arm.indexOf("if (planKey === 'team')"));
    assert.doesNotMatch(before, /metadata\??\.checkoutKind/, 'nothing before the arm reads the Premium checkout key');
    const choice = before.slice(before.indexOf('NEXT_SEASON_CHOICE_KIND &&'), before.indexOf('const matchedPlan'));
    assert.equal((before.match(/metadata\??\.teamWorkspaceId/g) ?? []).length, (choice.match(/metadata\??\.teamWorkspaceId/g) ?? []).length,
      'the only earlier read of the workspace key is the next-season choice, which needs choiceKind');
  });

  it('the mock checkout skips reactivation for a workspace; the webhook runs it only when the stored status was cancelled', () => {
    assert.match(readCode('app/api/billing/create-checkout/route.ts'), /auth\.org\.subscriptionStatus === 'canceled' && !isTeamWorkspaceOrg\(auth\.org\)/);
    assert.match(readCode('app/api/billing/webhook/route.ts'), /currentOrg\?\.subscription_status === 'canceled'\s*&& \(sub\.status === 'active' \|\| sub\.status === 'trialing'\)/);
  });
});

// ── 7 · what the entry routes are held to ──────────────────────────────────────────────────────────

describe('7 · the entry routes', () => {
  it('the move routes are owner-only and gated by the one source (Club answers 403 until it is on sale), and refuse a bad name with a 400', () => {
    const route = readCode('lib/plan-move-route.ts');
    assert.match(route, /requireCapability\(auth, 'billing'\)/);
    assert.match(route, /refusal\.code === 'club_name_invalid' \? 400/);
    assert.match(readCode('app/api/billing/move/route.ts'), /const gated = await refuseIfGated\(toPlan\);\s*if \(gated\) return gated;/);
    assert.match(readCode('app/api/billing/move/preview/route.ts'), /const gated = await refuseIfGated\(toPlan\);\s*if \(gated\) return gated;/);
    assert.match(readCode('app/api/billing/create-checkout/route.ts'), /if \(gatingMap\[planKey\]\) \{[\s\S]*?status: 403/);
  });

  it('Part 3 exposes only the Club door, leaving the larger band reachable afterwards', () => {
    assert.match(readCode('lib/plan-billing-profile.ts'), /checkoutAndMoves\('team'\)\.filter\(change => change\.target === 'club'\)/);
  });

  it('every refusal a coach can read is in plain words — "payment method", never "card"', () => {
    const plan = readCode('lib/plan-move.ts');
    const work = readCode('lib/workspace-upgrade.ts');
    for (const message of [...plan.matchAll(/code: '(?:payment_failing|club_name_invalid)'[^}]*error: ['`]([^'`]+)['`]/g)].map(m => m[1])) assert.doesNotMatch(message, /\bcard\b/i);
    assert.doesNotMatch(work, /\bcard\b/i);
  });
});

// ── 8 · the review's fixes ──────────────────────────────────────────────────────────────────────────

describe('8 · after the review: money, refusals and records', () => {
  const ONE_TEAM = { team_workspaces: { one: { workspace_state: 'independent' } }, rep_teams: { count: 1 } };

  it('a DECLINED proration charge leaves the subscription as it was (fails without it: the key is absent and Stripe swaps the price anyway)', async () => {
    stubDatabase({ ...PRICES, ...ONE_TEAM });
    stubStripe({ sub: subscription() });
    await applyMove(premiumOrg(), 'club', { expectedAmountDue: SHOWN, actor: 'coach@example.com', clubName: 'Hawks' });
    assert.equal(stripeCalls.update[0].payment_behavior, 'error_if_incomplete');
  });

  it('REFUSES a portal that holds more than one team BEFORE any charge — preview and apply alike (fails without it: charged, then the flip refuses)', async () => {
    stubDatabase({ ...PRICES, team_workspaces: { one: { workspace_state: 'independent' } }, rep_teams: { count: 2 } });
    stubStripe({ sub: subscription(), invoice: invoiceOf([line(5000, NEW_PRICE), line(-2000, OLD_PRICE)]) });
    const preview = await previewMove(premiumOrg(), 'club');
    assert.ok(isRefusal(preview) && preview.code === 'cannot_become_club', JSON.stringify(preview));
    assert.match(isRefusal(preview) ? preview.error : '', /more than one team/);
    const applied = await applyMove(premiumOrg(), 'club', { expectedAmountDue: SHOWN, actor: 'x', clubName: 'Hawks' });
    assert.ok(isRefusal(applied) && applied.code === 'cannot_become_club');
    assert.equal(stripeCalls.update.length, 0, 'nothing is charged');
    assert.equal(stripeCalls.createPreview, 0, 'no price is shown for a move that cannot happen');
  });

  it('REFUSES a workspace that already moved into another club, and lets the ordinary one-team portal through', async () => {
    for (const state of ['archived', 'org_owned']) {
      stubDatabase({ ...PRICES, team_workspaces: { one: { workspace_state: state } }, rep_teams: { count: 1 } });
      assert.match(await workspaceCannotBecomeClub('org_1') ?? '', /moved into a club/);
    }
    stubDatabase({ ...PRICES, ...ONE_TEAM });
    assert.equal(await workspaceCannotBecomeClub('org_1'), null);
    // An ordinary club has no workspace row and is never refused, whatever its team count.
    stubDatabase({ rep_teams: { count: 40 } });
    assert.equal(await workspaceCannotBecomeClub('org_1'), null);
  });

  it('refusals read in plain words (no "card", no code names)', async () => {
    stubDatabase({ team_workspaces: { one: { workspace_state: 'archived' } }, rep_teams: { count: 3 } });
    assert.doesNotMatch(await workspaceCannotBecomeClub('org_1') ?? '', /\bcard\b|workspace_flip/i);
    stubDatabase({ team_workspaces: { one: { workspace_state: 'independent' } }, rep_teams: { count: 3 } });
    assert.doesNotMatch(await workspaceCannotBecomeClub('org_1') ?? '', /\bcard\b|workspace_flip/i);
  });

  it('the in-place checkout asks BEFORE it opens a Stripe session (read from the route: it needs a signed-in request)', () => {
    const route = readCode('app/api/billing/create-checkout/route.ts');
    const asked = route.indexOf('workspaceCannotBecomeClub(auth.org.id)');
    assert.ok(asked > 0, 'the checkout asks');
    assert.ok(asked < route.indexOf('stripe.checkout.sessions.create'), 'before the session');
    assert.ok(asked < route.indexOf('const shouldApplyDirectly'), 'and before the mock path can write anything');
    assert.match(route, /code: 'cannot_become_club' \}\),\s*\{\s*status: 409/);
  });

  it('money taken and a database step failing is NOT "Nothing was changed": the move is made and says it is finishing', async () => {
    stubDatabase({ ...PRICES, ...ONE_TEAM }, { flip_workspace_into_club: { error: { message: 'connection lost' } } });
    stubStripe({ sub: subscription() });
    const r = await applyMove(premiumOrg(), 'club', { expectedAmountDue: SHOWN, actor: 'coach@example.com', clubName: 'Hawks' });
    assert.ok(!isRefusal(r), JSON.stringify(r));
    assert.equal((r as { finishing?: boolean }).finishing, true);
    assert.equal(stripeCalls.update.length, 1, 'Stripe was asked exactly once');
  });

  it('a flip that says "not settled yet" is finishing too; a flip that worked carries no flag at all', async () => {
    stubDatabase({ ...PRICES, ...ONE_TEAM }, { flip_workspace_into_club: { error: { message: 'workspace_flip_not_settled' } } });
    stubStripe({ sub: subscription() });
    const waiting = await applyMove(premiumOrg(), 'club', { expectedAmountDue: SHOWN, actor: 'x', clubName: 'Hawks' });
    assert.equal((waiting as { finishing?: boolean }).finishing, true);
    unstubStripe();
    stubDatabase({ ...PRICES, ...ONE_TEAM });
    stubStripe({ sub: subscription() });
    const done = await applyMove(premiumOrg(), 'club', { expectedAmountDue: SHOWN, actor: 'x', clubName: 'Hawks' });
    assert.ok(!isRefusal(done) && !('finishing' in done), JSON.stringify(done));
  });

  describe('a portal that CANCELLED Premium and becomes the club gets its archived records back', () => {
    const retained = [
      { id: 'rr_1', record_type: 'tournament', record_id: 't_1', metadata: { previousStatus: 'active', retentionReason: 'coaches_portal_cancellation' } },
      { id: 'rr_2', record_type: 'account', record_id: null, metadata: { retentionReason: 'coaches_portal_cancellation', teamWorkspaceId: 'ws_1' } },
    ];
    const ask = () => applyPlanChangeSideEffects({ orgId: 'org_1', fromPlan: 'team', toPlan: 'club', actor: 'stripe-webhook', clubName: 'Hawks' });

    it('on the flip: the tournaments come back as they were, and the records are closed so the sweep never warns or purges them', async () => {
      stubDatabase({ team_workspaces: { one: { id: 'ws_1' } }, billing_retained_records: { many: retained } });
      await ask();
      const tournament = writesTo('tournaments').find(c => (c.args[0] as { status?: string })?.status === 'active');
      assert.ok(tournament, 'the tournament is back to active');
      const closed = writesTo('billing_retained_records').find(c => (c.args[0] as { retained_state?: string })?.retained_state === 'restored');
      assert.ok(closed, 'the retained rows are marked restored');
    });

    it('on a RETRIED event (already flipped) it still restores — a failure after the flip must not strand them', async () => {
      stubDatabase({ team_workspaces: { one: { id: 'ws_1' } }, billing_retained_records: { many: retained } },
        { flip_workspace_into_club: { data: { alreadyFlipped: true, orgId: 'org_1', orgSlug: 'riverdale', workspaceId: 'ws_1' } } });
      await ask();
      assert.ok(writesTo('billing_retained_records').some(c => (c.args[0] as { retained_state?: string })?.retained_state === 'restored'));
    });

    it('an ordinary club moving between bands touches no retained record (no workspace row: the flip answers without writing)', async () => {
      stubDatabase({ billing_retained_records: { many: retained } });
      await applyPlanChangeSideEffects({ orgId: 'org_1', fromPlan: 'club', toPlan: 'club_large', actor: 'stripe-webhook' });
      assert.equal(writesTo('billing_retained_records').length, 0);
      assert.equal(writesTo('tournaments').length, 0);
    });

    it('a flip that was REFUSED restores nothing (the portal is still a portal; its records stay where they are)', async () => {
      stubDatabase({ team_workspaces: { one: { id: 'ws_1' } }, billing_retained_records: { many: retained } },
        { flip_workspace_into_club: { error: { message: 'workspace_flip_not_settled' } } });
      await ask();
      assert.equal(writesTo('billing_retained_records').length, 0);
    });
  });
});

describe('F3 · the plan-ending flow can put back the move it released (Stage 3 test-clock rehearsal, 2026-11-05)', () => {
  // The REAL move check, not a stand-in: the rehearsal's case 7 found Keep's own put-back refused by the waiting row.
  const clubLarge = (over: Partial<MoveOrg> = {}): MoveOrg => ({
    id: 'org_1', planId: 'club_large', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_premium', subscriptionStatus: 'active', ...over,
  });
  const waitingCancel = {
    id: 'intent_1', org_id: 'org_1', intent_type: 'cancellation', status: 'pending', effective_at: new Date((NOW + 86400 * 20) * 1000).toISOString(),
    retention_until: null, reason: null, from_plan: 'club_large', created_by: null, created_by_email: 'owner@example.com', applied_at: null,
    stripe_subscription_id: 'sub_premium', held_move_plan: 'club', notify_owner: true, keep_tournament_ids: [], target_plan: null,
    created_at: new Date().toISOString(), change_log: [{ at: new Date().toISOString(), action: 'kept', door: 'owner', by: 'owner@example.com' }],
  };
  function scheduleStubs() {
    const s: any = getStripe();
    const made: unknown[] = [];
    s.subscriptionSchedules.create = async (p: unknown) => { made.push(p); return { id: 'sub_sched_1', phases: [{ start_date: NOW - 86400 * 10 }] }; };
    s.subscriptionSchedules.update = async (id: string) => ({ id });
    return made;
  }

  it('Keep mid-way (its row still waiting, Stripe shows no cancel): an owner’s move is refused, the flow’s put-back goes through', async () => {
    stubDatabase({ ...PRICES, billing_retention_intents: { one: waitingCancel } });
    stubStripe({ sub: subscription() });
    const made = scheduleStubs();
    const asked = await applyMove(clubLarge(), 'club', { expectedAmountDue: SHOWN, actor: 'owner' });
    assert.ok(isRefusal(asked) && asked.code === 'subscription_ending', 'a person’s move still waits for the change');
    const restored = await applyMove(clubLarge(), 'club', { expectedAmountDue: SHOWN, actor: 'plan-ending', restore: true });
    assert.ok(!isRefusal(restored), JSON.stringify(restored));
    assert.equal(made.length, 1, 'the schedule holding the cheaper move is built again');
  });

  it('a put-back is still refused while Stripe holds a cancel (never a schedule on a subscription set to cancel)', async () => {
    stubDatabase({ ...PRICES, billing_retention_intents: { one: waitingCancel } });
    stubStripe({ sub: subscription({ cancel_at_period_end: true }) });
    const made = scheduleStubs();
    const restored = await applyMove(clubLarge(), 'club', { expectedAmountDue: SHOWN, actor: 'plan-ending', restore: true });
    assert.ok(isRefusal(restored) && restored.code === 'subscription_ending');
    assert.equal(made.length, 0);
  });

  it('a put-back is only ever a move down', async () => {
    stubDatabase({ ...PRICES });
    stubStripe({ sub: subscription() });
    const up = await applyMove(clubLarge({ planId: 'club' }), 'club_large', { expectedAmountDue: SHOWN, actor: 'plan-ending', restore: true });
    assert.ok(isRefusal(up) && up.code === 'not_a_move');
  });

  it('only the plan-ending flow asks for a put-back: no route passes `restore`', () => {
    for (const file of ['app/api/billing/move/route.ts']) assert.doesNotMatch(readCode(file), /restore\s*:/, file);
    assert.match(readCode('lib/plan-ending-server.ts'), /applyMove\([\s\S]*?\{ actor, restore: true \}\)/);
  });
});
