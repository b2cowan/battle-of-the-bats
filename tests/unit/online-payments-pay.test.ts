import { describe, it, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { billingTestLoader } from './_billing-test-loader.ts';
import type { PayoutsView } from '../../components/admin/kit/club/PayoutsCard.tsx';
import { payOptions } from '../../lib/team-pay-options.ts';
import { onlineFee } from '../../lib/online-payment-fee.ts';
import { readTeamPayToken, signTeamPayToken, teamPayPath } from '../../lib/team-pay-link.ts';
import { refusalMessage, type RefusalFacts } from '../../lib/team-pay-refusal.ts';
import { factsFromStripe, payoutsState, takesPayments, type PayoutsAccountFacts, type StripeAccountLike } from '../../lib/online-payment-account.ts';

/**
 * Club Tier Stage 12a, Parts 2–4: deposit or full (A7), the signed pay link, the pay route's refusals (copy §18) and the
 * Payouts card's five states.
 */

const fee = (total: number | null, deposit: number | null) => ({
  totalFeeAmount: total, totalFeeDueDate: '2026-11-30', depositAmount: deposit, depositDueDate: '2026-11-01',
});

/** Exercise the shipped card's click handler with held network responses, without a browser or Stripe calls. */
function payoutsHarness(t: TestContext, home: 'club' | 'tournament', state: PayoutsView['state'] = 'taking_payments', blocked = false) {
  const slots: unknown[] = [];
  let cursor = 0;
  const hooks = {
    ...React,
    useState<T>(initial: T) {
      const at = cursor++;
      if (!(at in slots)) slots[at] = initial;
      return [slots[at] as T, (next: T | ((previous: T) => T)) => {
        slots[at] = typeof next === 'function' ? (next as (previous: T) => T)(slots[at] as T) : next;
      }] as const;
    },
    useRef<T>(initial: T) {
      const at = cursor++;
      if (!(at in slots)) slots[at] = { current: initial };
      return slots[at] as { current: T };
    },
    useCallback<T>(callback: T) { return callback; },
  };
  const initial: PayoutsView = {
    state, isOwner: true, testMode: true, rateLabel: '3%', example: { baseCents: 10000, feeCents: 300 },
    feePayer: 'family', refundPolicy: 'Ask the club.', requirementsDue: 0, deadline: null, paymentsOn: true,
    connectedAt: '2026-10-25', disconnectedAt: null, disconnectedBy: null, teamsStillOwing: 0,
  };
  const events: string[] = [];
  const requests: Record<string, unknown>[] = [];
  const assigned: string[] = [];
  let navigations = 0;
  const link = { href: '', target: '', rel: '', referrerPolicy: '', click() { navigations++; } };
  const tab = {
    opener: {} as unknown, closed: false,
    close() { this.closed = true; },
    document: {
      createElement(tag: string) { assert.equal(tag, 'a'); return link; },
      body: { appendChild(child: unknown) { assert.equal(child, link); } },
    },
  };
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    open(url: string, target: string) {
      assert.equal(url, 'about:blank'); assert.equal(target, '_blank');
      events.push('open'); return blocked ? null : tab;
    },
    location: { assign(url: string) { assigned.push(url); } },
  } });
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });
  let resolveResponse!: (response: Response) => void;
  let rejectResponse!: (error: Error) => void;
  t.mock.method(globalThis, 'fetch', (_input: unknown, init: RequestInit) => {
    events.push('fetch');
    if (state === 'taking_payments') assert.equal(tab.opener, null, 'Detach opener before the request');
    requests.push(JSON.parse(String(init.body)));
    return new Promise<Response>((resolve, reject) => { resolveResponse = resolve; rejectResponse = reject; });
  });
  const load = billingTestLoader({ react: hooks });
  const Card = (load('components/admin/kit/club/PayoutsCard.tsx') as { default: React.ComponentType<Record<string, unknown>> }).default;
  type Element = React.ReactElement<Record<string, unknown>>;
  function elements(node: unknown): Element[] {
    if (Array.isArray(node)) return node.flatMap(elements);
    if (!React.isValidElement(node)) return [];
    const element = node as Element;
    return [element, ...elements(element.props.children)];
  }
  function render() {
    cursor = 0;
    return elements((Card as (props: Record<string, unknown>) => unknown)({ orgSlug: 'test-club', clubName: 'Test Club', home, initial }));
  }
  const button = () => render().find(e => e.type === 'button' && e.props.className === 'btn btn-lime')!;
  return {
    tab, link, events, requests, assigned, render, button,
    get navigations() { return navigations; },
    click() { (button().props.onClick as () => void)(); },
    alert() { return render().find(e => e.props.role === 'alert')?.props.children; },
    async reply(data: unknown, ok = true) {
      resolveResponse({ ok, json: async () => data } as Response);
      await new Promise(resolve => setImmediate(resolve));
    },
    async fail() {
      rejectResponse(new Error('Failed to fetch'));
      await new Promise(resolve => setImmediate(resolve));
    },
  };
}

describe('Open Stripe keeps the organizer page and opens a protected tab', () => {
  for (const home of ['club', 'tournament'] as const) {
    it(`${home}: reserves one tab before fetching and enables another visit after success`, async t => {
      const h = payoutsHarness(t, home);
      h.click();
      assert.deepEqual(h.events, ['open', 'fetch']);
      assert.equal(h.button().props.disabled, true);
      assert.match(JSON.stringify(h.button().props.children), /Opening/);
      h.click();
      assert.equal(h.requests.length, 1);
      assert.deepEqual(h.requests[0], { orgSlug: 'test-club', action: 'dashboard' });
      await h.reply({ url: 'https://connect.stripe.com/express/test-single-use' });
      assert.equal(h.navigations, 1);
      assert.equal(h.link.target, '_self');
      assert.equal(h.link.rel, 'noopener noreferrer');
      assert.equal(h.link.referrerPolicy, 'no-referrer');
      assert.match(h.link.href, /test-single-use$/);
      assert.deepEqual(h.assigned, []);
      assert.equal(h.tab.closed, false);
      assert.equal(h.button().props.disabled, false);
      assert.match(JSON.stringify(h.button().props.children), /opens in a new tab/);
    });
  }

  // Payouts card redraw (drawings tab 2, ask A6, owner "go ahead" 2026-11-05): while the record is being edited the form stands
  // alone — the Stripe door and Disconnect step aside, and the pencil brings them back. Edits autosave, so nothing is lost.
  it('steps aside while the record is edited, and comes back with the pencil', t => {
    const h = payoutsHarness(t, 'club');
    const stripe = () => h.render().some(e => e.type === 'button' && e.props.className === 'btn btn-lime');
    const disconnect = () => h.render().some(e => e.props.children === 'Disconnect payouts');
    assert.ok(stripe() && disconnect(), 'both doors show while reading');
    (h.render().find(e => e.props['aria-pressed'] === false)!.props.onClick as () => void)();
    assert.ok(h.render().some(e => e.props['aria-pressed'] === true), 'the pencil is now the check');
    assert.equal(stripe(), false, 'Open Stripe is hidden while editing');
    assert.equal(disconnect(), false, 'Disconnect is hidden while editing');
    (h.render().find(e => e.props['aria-pressed'] === true)!.props.onClick as () => void)();
    assert.ok(stripe() && disconnect(), 'both doors come back after Done');
  });

  for (const failure of ['network', 'http', 'missing-url'] as const) {
    it(`${failure}: closes the temporary tab, retains the error, and permits retry`, async t => {
      const h = payoutsHarness(t, 'club');
      h.click();
      if (failure === 'network') await h.fail();
      else if (failure === 'http') await h.reply({ error: 'Finish setting up payouts first.' }, false);
      else await h.reply({});
      assert.equal(h.tab.closed, true);
      assert.equal(h.navigations, 0);
      assert.equal(h.button().props.disabled, false);
      assert.equal(h.alert(), failure === 'network' ? 'Failed to fetch'
        : failure === 'http' ? 'Finish setting up payouts first.'
          : 'Something went wrong. Try again.');
      assert.deepEqual(h.assigned, []);
      h.click();
      assert.equal(h.requests.length, 2);
      await h.reply({});
    });
  }

  it('a blocked tab shows how to retry without creating a single-use link', t => {
    const h = payoutsHarness(t, 'club', 'taking_payments', true);
    h.click();
    assert.deepEqual(h.events, ['open']);
    assert.equal(h.alert(), 'Allow pop-ups for this site, then try again.');
    assert.equal(h.button().props.disabled, false);
    assert.deepEqual(h.assigned, []);
  });

  it('does not reopen a tab the organizer closed while waiting', async t => {
    const h = payoutsHarness(t, 'tournament');
    h.click(); h.tab.close();
    await h.reply({ url: 'https://connect.stripe.com/express/test-single-use' });
    assert.equal(h.navigations, 0);
    assert.equal(h.button().props.disabled, false);
    assert.deepEqual(h.events, ['open', 'fetch']);
  });

  for (const state of ['setting_up', 'needs_attention'] as const) {
    it(`${state} keeps onboarding in the original tab`, async t => {
      const h = payoutsHarness(t, 'club', state);
      assert.doesNotMatch(JSON.stringify(h.button().props.children), /opens in a new tab/);
      h.click();
      assert.deepEqual(h.events, ['fetch']);
      assert.equal(h.requests[0].action, 'continue');
      await h.reply({ url: 'https://connect.stripe.com/setup/test' });
      assert.deepEqual(h.assigned, ['https://connect.stripe.com/setup/test']);
      assert.equal(h.button().props.disabled, true);
    });
  }
});

describe('deposit or full (A7)', () => {
  it('offers the deposit, pre-selected, and the whole fee when nothing is paid', () => {
    const o = payOptions({ totalPaid: 0, depositPaid: 0 }, fee(300, 100), 'family')!;
    assert.deepEqual(o.choices.map(c => c.scope), ['deposit', 'full']);
    assert.equal(o.preselected, 'deposit');
    assert.equal(o.choices[0].fee.baseCents, 10_000);
    assert.equal(o.choices[1].fee.baseCents, 30_000);
  });

  it('shows the saving of paying in full only while the team pays the fee, and it is one flat part', () => {
    const family = payOptions({ totalPaid: 0, depositPaid: 0 }, fee(300, 100), 'family')!;
    const split = onlineFee(10_000, 'family').feeCents + onlineFee(20_000, 'family').feeCents;
    assert.equal(family.savingCents, split - onlineFee(30_000, 'family').feeCents);
    assert.ok((family.savingCents ?? 0) > 0);
    assert.equal(payOptions({ totalPaid: 0, depositPaid: 0 }, fee(300, 100), 'club')!.savingCents, null);
  });

  it('offers one choice, the whole fee, with no deposit step', () => {
    const o = payOptions({ totalPaid: 0, depositPaid: 0 }, fee(300, null), 'family')!;
    assert.deepEqual(o.choices.map(c => c.scope), ['full']);
    assert.equal(o.savingCents, null);
  });

  it('offers only the balance once anything is paid — after the deposit or a part-payment', () => {
    for (const paid of [100, 40]) {
      const o = payOptions({ totalPaid: paid, depositPaid: Math.min(paid, 100) }, fee(300, 100), 'family')!;
      assert.deepEqual(o.choices.map(c => c.scope), ['balance']);
      assert.equal(o.choices[0].fee.baseCents, (300 - paid) * 100);
    }
  });

  it('offers nothing when paid in full or when no fee is set', () => {
    assert.equal(payOptions({ totalPaid: 300, depositPaid: 100 }, fee(300, 100), 'family'), null);
    assert.equal(payOptions({ totalPaid: 0, depositPaid: 0 }, fee(null, null), 'family'), null);
  });

  it('the club-pays total is the base; the family-pays total adds the fee', () => {
    const club = payOptions({ totalPaid: 0, depositPaid: 0 }, fee(300, null), 'club')!.choices[0].fee;
    const fam = payOptions({ totalPaid: 0, depositPaid: 0 }, fee(300, null), 'family')!.choices[0].fee;
    assert.equal(club.totalCents, 30_000);
    assert.equal(fam.totalCents, 30_000 + fam.feeCents);
  });
});

describe('the pay link: signed, one team, never stored', () => {
  const secret = 'x'.repeat(40);
  const team = '44e793cd-617d-40bd-bad3-406a6304a1bc';

  it('reads back the team it was signed for', () => {
    assert.equal(readTeamPayToken(signTeamPayToken(team, secret), secret), team);
  });

  it('refuses a token signed under another secret, a changed team, or a mangled token', () => {
    const t = signTeamPayToken(team, secret);
    assert.equal(readTeamPayToken(t, 'y'.repeat(40)), null);
    const other = signTeamPayToken('e54b9845-ed78-4a9d-be6f-dbbfff184f10', secret);
    assert.equal(readTeamPayToken(`${other.split('.')[0]}.${t.split('.')[1]}`, secret), null);
    assert.equal(readTeamPayToken('not-a-token', secret), null);
    assert.equal(readTeamPayToken(`${t}x`, secret), null);
  });

  it('lives under the tournament’s own address, never a top-level /pay', () => {
    assert.equal(teamPayPath('dev-club', 'spring-cup', 'abc.def'), '/dev-club/spring-cup/pay/abc.def');
  });
});

describe('the pay route’s refusals (copy §18)', () => {
  const facts = (refusal: RefusalFacts['refusal'], over: Partial<RefusalFacts> = {}): RefusalFacts => ({
    refusal, teamName: 'Riverdale 13U', teamStatus: 'accepted', totalPaid: 0, org: { name: 'Dev Club' }, tournament: { name: 'Spring Cup' }, ...over,
  });

  it('says nothing when the team may pay', () => {
    assert.equal(refusalMessage(facts(null)), null);
  });

  it('refuses an unaccepted team, and names a declined one as no longer in the tournament', () => {
    assert.match(refusalMessage(facts('not_accepted', { teamStatus: 'pending' }))!, /hasn’t been accepted yet/);
    assert.match(refusalMessage(facts('not_accepted', { teamStatus: 'rejected' }))!, /no longer in Spring Cup/);
    assert.match(refusalMessage(facts('tournament_over'))!, /no longer in Spring Cup/);
  });

  it('refuses a paid team as paid in full, and an owing-nothing team as nothing to pay', () => {
    assert.match(refusalMessage(facts('nothing_owed', { totalPaid: 300 }))!, /already paid in full/);
    assert.match(refusalMessage(facts('nothing_owed'))!, /nothing to pay/);
    assert.match(refusalMessage(facts('our_team'))!, /nothing to pay/);
  });

  it('refuses when the club is not taking payments, and when the switch is off', () => {
    assert.match(refusalMessage(facts('not_taking_payments'))!, /Dev Club isn’t taking online payments/);
    assert.match(refusalMessage(facts('not_tracked'))!, /Dev Club isn’t taking online payments/);
    assert.match(refusalMessage(facts('switch_off'))!, /aren’t available/);
  });
});

describe('the Payouts card’s five states', () => {
  const acct = (over: Partial<PayoutsAccountFacts> = {}): PayoutsAccountFacts => ({
    stripeAccountId: 'acct_1', livemode: false, cardPayments: 'restricted', cardPaymentsReason: 'requirements_past_due',
    onboardingFinishedAt: null, requirementsDue: [], requirementsDeadline: null, feePayer: 'family', refundPolicy: null,
    disconnectedAt: null, ...over,
  });
  const done = '2026-10-25T18:00:00Z';

  it('reads not set up, setting up, taking payments, needs attention and disconnected', () => {
    assert.equal(payoutsState(null), 'not_set_up');
    assert.equal(payoutsState(acct({ requirementsDue: ['defaults.profile.business_url'] })), 'setting_up', 'mid sign-up');
    assert.equal(payoutsState(acct({ onboardingFinishedAt: done, cardPaymentsReason: null })), 'setting_up', 'just submitted, nothing due: still a wait');
    assert.equal(payoutsState(acct({ onboardingFinishedAt: done, cardPaymentsReason: 'requirements_pending_verification' })), 'setting_up');
    assert.equal(payoutsState(acct({ onboardingFinishedAt: done, cardPayments: 'pending', cardPaymentsReason: 'determining_status' })), 'setting_up');
    assert.equal(payoutsState(acct({ onboardingFinishedAt: done, cardPayments: 'active', cardPaymentsReason: null })), 'taking_payments');
    assert.equal(payoutsState(acct({ onboardingFinishedAt: done, cardPayments: 'active', cardPaymentsReason: null, requirementsDue: ['individual.verification.document'] })), 'needs_attention');
    assert.equal(payoutsState(acct({ onboardingFinishedAt: done, requirementsDue: ['x'] })), 'needs_attention');
    assert.equal(payoutsState(acct({ onboardingFinishedAt: done, cardPaymentsReason: 'restricted_other' })), 'needs_attention', 'Stripe stopped it for a reason that is not a wait');
    assert.equal(payoutsState(acct({ cardPayments: 'active', disconnectedAt: '2026-10-25T00:00:00Z' })), 'disconnected');
    assert.equal(payoutsState(acct({ onboardingFinishedAt: done, cardPayments: 'unsupported', cardPaymentsReason: null })), 'needs_attention',
      'Stripe will not turn an unsupported account on by itself (review 2026-10-25)');
  });

  it('takes payments only on Stripe’s word and never once disconnected', () => {
    assert.equal(takesPayments(acct({ cardPayments: 'active' })), true);
    assert.equal(takesPayments(acct({ cardPayments: 'active', requirementsDue: ['x'] })), true, 'a deadline still takes payments');
    assert.equal(takesPayments(acct({ cardPayments: 'pending' })), false);
    assert.equal(takesPayments(acct({ cardPayments: 'active', disconnectedAt: '2026-10-25T00:00:00Z' })), false);
    assert.equal(takesPayments(null), false);
  });
});

describe('a v2 account reads into the five states (plan §0d)', () => {
  type Entry = NonNullable<NonNullable<StripeAccountLike['requirements']>['entries']>[number];
  const entry = (description: string, over: Partial<Entry> = {}): Entry => ({
    awaiting_action_from: 'user', description, errors: [], minimum_deadline: { status: 'past_due' },
    requested_reasons: [{ code: 'routine_onboarding' }], ...over,
  });
  const v2 = (card: { status: string; code?: string } | null, entries: Entry[] = [], summary?: { status: string; time?: string | null }): StripeAccountLike => ({
    id: 'acct_1', closed: false, identity: { country: 'CA' },
    configuration: card ? { merchant: { capabilities: { card_payments: { status: card.status, status_details: card.code ? [{ code: card.code, resolution: 'provide_info' } as never] : [] } } } } : {},
    requirements: { entries, summary: summary ? { minimum_deadline: summary } : {} },
  });
  /** What the sync stores, then what the card reads — `finishedBefore` is a stamp an earlier sync already wrote. */
  const read = (a: StripeAccountLike, finishedBefore = false) => {
    const { columns, onboardingFinished } = factsFromStripe(a);
    return payoutsState({
      stripeAccountId: a.id, livemode: false, cardPayments: columns.card_payments_status ?? null, cardPaymentsReason: columns.card_payments_reason ?? null,
      onboardingFinishedAt: finishedBefore || onboardingFinished ? '2026-10-25T18:00:00Z' : null,
      requirementsDue: columns.requirements_due ?? [], requirementsDeadline: columns.requirements_deadline ?? null,
      feePayer: 'family', refundPolicy: null, disconnectedAt: null,
    });
  };

  it('a fresh account (the sandbox probe’s own shape) is setting up, never needs attention', () => {
    const fresh = v2({ status: 'restricted', code: 'requirements_past_due' },
      [entry('defaults.profile.business_url'), entry('external_account'), entry('configuration.merchant.support.phone')],
      { status: 'past_due', time: null });
    const f = factsFromStripe(fresh);
    assert.equal(f.onboardingFinished, false);
    assert.deepEqual(f.columns.requirements_due, ['configuration.merchant.support.phone', 'defaults.profile.business_url', 'external_account']);
    assert.equal(f.columns.country, 'CA');
    assert.equal(read(fresh), 'setting_up');
  });

  it('sign-up given, Stripe checking: still setting up; then active: taking payments', () => {
    const checking = v2({ status: 'restricted', code: 'requirements_pending_verification' },
      [entry('individual.id_number', { awaiting_action_from: 'stripe' })]);
    assert.equal(factsFromStripe(checking).onboardingFinished, true, 'only what waits on the club keeps sign-up open');
    assert.equal(read(checking), 'setting_up');
    const active = v2({ status: 'active' });
    assert.equal(factsFromStripe(active).columns.card_payments_reason, null);
    assert.equal(read(active), 'taking_payments');
  });

  it('a later demand is needs attention, with its deadline, and payments keep working until it passes', () => {
    const later = v2({ status: 'active' },
      [entry('individual.verification.document', { minimum_deadline: { status: 'currently_due' }, requested_reasons: [{ code: 'routine_verification' }] })],
      { status: 'currently_due', time: '2026-11-20T00:00:00.000Z' });
    const f = factsFromStripe(later);
    assert.equal(f.columns.requirements_deadline, '2026-11-20T00:00:00.000Z');
    assert.equal(read(later, true), 'needs_attention');
  });

  it('a sign-up answer Stripe refused is needs attention, not an unfinished form', () => {
    const refused = v2({ status: 'restricted', code: 'requirements_past_due' },
      [entry('individual.dob.year', { errors: [{ code: 'invalid_dob_age_under_18' }] })]);
    assert.equal(factsFromStripe(refused).onboardingFinished, true);
    assert.equal(read(refused), 'needs_attention');
  });

  it('a new sign-up question after the stamp reads needs attention, never setting up again', () => {
    const asked = v2({ status: 'restricted', code: 'requirements_past_due' }, [entry('defaults.profile.product_description')]);
    assert.equal(read(asked), 'setting_up', 'no stamp yet: still the first sign-up');
    assert.equal(read(asked, true), 'needs_attention', 'stamped earlier: the stamp is kept');
  });

  it('eventually-due items wait; an unread capability is never called finished; a closed account says so', () => {
    const eventually = v2({ status: 'active' }, [entry('company.tax_id', { minimum_deadline: { status: 'eventually_due' } })], { status: 'eventually_due', time: '2027-03-01T00:00:00.000Z' });
    assert.deepEqual(factsFromStripe(eventually).columns.requirements_due, []);
    assert.equal(factsFromStripe(eventually).columns.requirements_deadline, null, 'a deadline shows only for what is due now');
    assert.equal(read(eventually), 'taking_payments');
    assert.equal(factsFromStripe(v2(null)).onboardingFinished, false);
    assert.equal(factsFromStripe(v2({ status: 'something_new' })).columns.card_payments_status, null, 'an unknown status is stored as unread');
    assert.equal(factsFromStripe({ ...v2({ status: 'active' }), closed: true }).closed, true);
  });

  it('a stamp is never written early (review 2026-10-25): eventually-due sign-up questions keep it open, a short read never stamps', () => {
    const later = v2({ status: 'pending', code: 'determining_status' }, [entry('company.tax_id', { minimum_deadline: { status: 'eventually_due' } })]);
    assert.equal(factsFromStripe(later).onboardingFinished, false, 'the link collects eventually-due items: still the first sign-up');
    assert.equal(read(later), 'setting_up');
    const noRequirements = { ...v2({ status: 'restricted', code: 'requirements_past_due' }), requirements: null };
    assert.equal(factsFromStripe(noRequirements).onboardingFinished, false);
  });

  it('a part of the account that did not come back writes nothing, so a short read never switches payments off', () => {
    const short = factsFromStripe({ id: 'acct_1', identity: null, configuration: null, requirements: null });
    assert.deepEqual(short.columns, { stripe_account_id: 'acct_1' });
    const full = factsFromStripe(v2({ status: 'active' }));
    assert.equal(full.columns.card_payments_status, 'active');
    assert.deepEqual(full.columns.requirements_due, []);
  });
});
