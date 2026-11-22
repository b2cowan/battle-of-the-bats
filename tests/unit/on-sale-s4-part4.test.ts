/**
 * On-sale pages S4 Part 4 (prompt docs/projects/active/CLUB_ON_SALE_S4_PART4_PROMPT.md):
 *  - call 45: a second subscription that slips through tells the owner ONCE, naming the club, both subscriptions, the plan
 *    and the charge; only from the second-subscription branch (never the ended-subscription guard), never for a mock one;
 *  - call 43: the onboarding window's added sentence per gate state;
 *  - W71 (call 44): the /for-tournament-organizers line per gate state, and its guard (no move, no line).
 * The page renders of W71 are in public-plan-pages-both-states.test.ts.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import {
  tellOwnerOfStraySubscription, straySubscriptionKey, strayChargeWords, type StraySubscriptionDeps,
} from '../../lib/stray-subscription-alert.ts';
import { moreThanTournamentsSentence, alreadyRunningTournamentsLine } from '../../lib/plan-cross-sell-words.ts';
import { moveDirection } from '../../lib/plan-move-options.ts';
import { EMAIL_KINDS } from '../../lib/email-kinds.ts';
import type { PlatformEventInput } from '../../lib/platform-events.ts';
import type { OrgPlan } from '../../lib/types.ts';
import { readCode, functionBody } from './_source-code.ts';

const stray = (over: Record<string, unknown> = {}) => ({
  id: 'sub_stray', status: 'active', latest_invoice: 'in_stray',
  items: { data: [{ quantity: 1, price: { unit_amount: 21900, currency: 'cad', recurring: { interval: 'month' } } }] },
  ...over,
}) as unknown as Stripe.Subscription;

/** A store that remembers what was told, as platform_events does, and an inbox. */
function harness(opts: { send?: StraySubscriptionDeps['send']; invoice?: Awaited<ReturnType<StraySubscriptionDeps['latestInvoice']>>; current?: StraySubscriptionDeps['current']; live?: boolean } = {}) {
  const events: PlatformEventInput[] = [];
  const inbox: Array<{ subject: string; html: string; key: string }> = [];
  const deps: StraySubscriptionDeps = {
    alreadyTold: async key => events.some(e => e.sourceEventId === key),
    current: opts.current ?? (async sub => sub),
    latestInvoice: async () => opts.invoice === undefined ? { number: 'ABC-0002', amountPaidCents: 24747, totalCents: 24747, currency: 'cad', status: 'paid' } : opts.invoice,
    send: opts.send ?? (async alert => { inbox.push(alert); return 'sent'; }),
    record: async e => { events.push(e); },
    live: () => opts.live ?? false,
    siteUrl: 'https://www.fieldlogichq.ca',
  };
  return { deps, events, inbox };
}

const input = (sub = stray()) => ({ sub, org: { id: 'org_1', name: 'Riverdale Minor Ball' }, onFileId: 'sub_first', planId: 'club', customerId: 'cus_1' });

describe('call 45: the second-subscription alert', () => {
  it('tells the owner once per stray subscription, however often it arrives (created, updated, re-sends)', async () => {
    const h = harness();
    assert.equal(await tellOwnerOfStraySubscription(input(), h.deps), true);
    assert.equal(await tellOwnerOfStraySubscription(input(), h.deps), false, 'a replay');
    assert.equal(await tellOwnerOfStraySubscription(input(stray({ status: 'past_due' })), h.deps), false, 'a later update');
    assert.equal(h.inbox.length, 1);
    assert.equal(h.events.length, 1);
    // The mail key names the subscription AND the exact words, so a later delivery with other words is never refused.
    assert.match(h.inbox[0].key, new RegExp(`^${straySubscriptionKey('sub_stray')}:[0-9a-f]{8}$`));
    assert.equal(h.events[0].sourceEventId, straySubscriptionKey('sub_stray'));
    assert.equal(h.events[0].eventType, 'second_subscription');
    // A different stray subscription is its own alert.
    assert.equal(await tellOwnerOfStraySubscription(input(stray({ id: 'sub_stray2' })), h.deps), true);
    assert.equal(h.inbox.length, 2);
  });

  it('names the club, both subscriptions, the plan and the charge; cancels and refunds nothing', async () => {
    const h = harness();
    await tellOwnerOfStraySubscription(input(), h.deps);
    const { subject, html } = h.inbox[0];
    assert.match(subject, /Riverdale Minor Ball/);
    for (const fact of ['Riverdale Minor Ball', 'sub_stray', 'sub_first', 'Plan: Club', '$219.00 a month before tax', '$247.47 paid on invoice ABC-0002 (the whole invoice, with any tax)', 'Refund the charge for invoice ABC-0002', 'not the other subscription’s charge', 'credit for unused time off']) {
      assert.ok(html.includes(fact), fact);
    }
    assert.match(html, /Nothing has been cancelled or refunded/);
    assert.match(html, /dashboard\.stripe\.com\/test\/subscriptions\/sub_stray/);
    assert.match(html, /\/platform-admin\/orgs\/org_1/);
    // No person: the record names a club and Stripe ids only.
    assert.ok(!/@/.test(html), 'no email address');
    assert.deepEqual(Object.keys(h.events[0].metadata ?? {}).sort(),
      ['amountPaidCents', 'currency', 'onFileSubscriptionId', 'price', 'straySubscriptionId', 'stripeCustomerId']);
  });

  it('a stray that charged nothing says so, and asks for no refund', async () => {
    const h = harness({ invoice: { number: 'ABC-0003', amountPaidCents: 0, totalCents: 0, currency: 'cad', status: 'paid' } });
    await tellOwnerOfStraySubscription(input(stray({ status: 'trialing' })), h.deps);
    assert.ok(h.inbox[0].html.includes('Charged so far: nothing yet: it is in its free trial, and charges when the trial ends'));
    assert.match(h.inbox[0].html, /nothing to refund/);
    assert.ok(!h.inbox[0].html.includes('Money tab'));
  });

  it('only a stray that bills, as Stripe holds it now: incomplete waits (unmarked), cancelled-since is not told', async () => {
    const h = harness();
    assert.equal(await tellOwnerOfStraySubscription(input(stray({ status: 'incomplete' })), h.deps), false);
    assert.equal(h.events.length, 0, 'not marked, so its update to active tells');
    const gone = harness({ current: async sub => ({ ...sub, status: 'canceled' }) as Stripe.Subscription });
    assert.equal(await tellOwnerOfStraySubscription(input(), gone.deps), false);
    const missing = harness({ current: async () => null });
    assert.equal(await tellOwnerOfStraySubscription(input(), missing.deps), false);
    assert.equal(gone.inbox.length + missing.inbox.length, 0);
    assert.equal(await tellOwnerOfStraySubscription(input(stray({ status: 'incomplete' })), h.deps), false);
    assert.equal(await tellOwnerOfStraySubscription(input(stray({ status: 'active' })), h.deps), true);
  });

  it('live, a send with no mail key is a failure, never marked told', async () => {
    const h = harness({ live: true, send: async () => 'skipped' });
    await assert.rejects(tellOwnerOfStraySubscription(input(), h.deps));
    assert.equal(h.events.length, 0);
    const dev = harness({ send: async () => 'skipped' });
    assert.equal(await tellOwnerOfStraySubscription(input(), dev.deps), true, 'on a dev machine the record is the alarm');
  });

  it('the owner is told what still works for the club', async () => {
    const h = harness();
    await tellOwnerOfStraySubscription(input(), h.deps);
    assert.match(h.inbox[0].html, /a press to start another plan on the club’s Plan &amp; billing is refused/);
    assert.match(h.inbox[0].html, /Moving or cancelling its own plan still works/);
  });

  it('an unread invoice still tells, and says so', async () => {
    const h = harness({ invoice: null });
    await tellOwnerOfStraySubscription(input(), h.deps);
    assert.match(h.inbox[0].html, /not read from Stripe/);
  });

  it('a failed send throws and marks nothing, so the next delivery tells', async () => {
    let fail = true;
    const h = harness({ send: async () => (fail ? 'failed' : 'sent') });
    await assert.rejects(tellOwnerOfStraySubscription(input(), h.deps));
    assert.equal(h.events.length, 0);
    fail = false;
    assert.equal(await tellOwnerOfStraySubscription(input(), h.deps), true);
    assert.equal(h.events.length, 1);
  });

  it('never for a mock subscription', async () => {
    const h = harness();
    assert.equal(await tellOwnerOfStraySubscription(input(stray({ id: 'mock_sub' })), h.deps), false);
    assert.equal(await tellOwnerOfStraySubscription({ ...input(), onFileId: 'mock_first' }, h.deps), false);
    assert.equal(h.inbox.length + h.events.length, 0);
  });

  it('the price line reads quantity and interval', () => {
    assert.equal(strayChargeWords(stray({ items: { data: [{ quantity: 2, price: { unit_amount: 8900, currency: 'cad', recurring: { interval: 'year' } } }] } })), '$178.00 a year before tax');
    assert.equal(strayChargeWords(stray({ items: { data: [] } })), null);
  });

  it('the webhook raises it from the second-subscription branch only, not the ended-subscription guard', () => {
    const code = readCode('lib/billing-webhook-handler.ts');
    const calls = code.split('tellOwnerOfStraySubscription(').length - 1;
    assert.equal(calls, 1, 'one call site');
    const at = code.indexOf('tellOwnerOfStraySubscription(');
    const branch = code.lastIndexOf('already follows live subscription', at);
    const guard = code.lastIndexOf("sub.status === 'canceled' || (isEndedSubscriptionStatus(sub.status)", at);
    assert.ok(guard > 0 && branch > guard, 'after the ended guard, inside the branch that keeps the record on the first');
    const guardBlock = code.slice(guard, code.indexOf('break;', guard));
    assert.ok(!guardBlock.includes('tellOwner'), 'the ended guard tells no one');
    // Its email never goes through the error alert's hourly bucket, and a failed send is failed, not dropped.
    const deps = functionBody(code, 'straySubscriptionDeps');
    assert.match(deps, /sendEmail\(ADMIN_EMAIL/);
    assert.ok(!/maybeSendCriticalAlert|takeAlertToken/.test(deps));
    assert.match(deps, /provider_error[^\n]*'failed'/);
    assert.equal(EMAIL_KINDS.second_subscription_alert.klass, 'inbox');
  });

  it('the club’s Story shows it for every role', () => {
    const story = readCode('lib/platform-story.ts');
    const list = story.slice(story.indexOf(".in('event_type', ["), story.indexOf('...(opts.money'));
    assert.ok(list.includes("'second_subscription'"), 'in the always-read list, not the money-only one');
  });
});

type Gating = Partial<Record<OrgPlan, boolean>>;
const BOTH_CLOSED: Gating = { tournament: false, tournament_plus: false, league: true, club: true, club_large: true };
const LEAGUE_OPEN: Gating = { ...BOTH_CLOSED, league: false };
const CLUB_OPEN: Gating = { ...BOTH_CLOSED, club: false };
const BOTH_OPEN: Gating = { ...BOTH_CLOSED, league: false, club: false };

describe('call 43: the onboarding window’s sentence', () => {
  it('a Tournament organization: names only the open plans', () => {
    for (const own of ['tournament', 'tournament_plus'] as const) {
      assert.equal(moreThanTournamentsSentence(BOTH_CLOSED, own), null);
      assert.equal(moreThanTournamentsSentence(LEAGUE_OPEN, own), 'Running more than tournaments? League Plus adds house league seasons.');
      assert.equal(moreThanTournamentsSentence(CLUB_OPEN, own), 'Running more than tournaments? Club adds rep teams and the club’s books.');
      assert.equal(moreThanTournamentsSentence(BOTH_OPEN, own),
        'Running more than tournaments? League Plus adds house league seasons, and Club adds rep teams and the club’s books.');
      assert.equal(moreThanTournamentsSentence({}, own), null, 'an unread gate reads as closed');
    }
  });

  it('only plans the organization can reach (owner 2026-11-22): a League Plus owner, who opens this window today, reads today’s words', () => {
    assert.equal(moreThanTournamentsSentence(BOTH_OPEN, 'league'), null, 'League Plus is theirs; League Plus → Club is after launch');
    assert.equal(moreThanTournamentsSentence(BOTH_OPEN, 'club'), null);
    const noMove = (from: OrgPlan, to: OrgPlan) => (from === 'tournament_plus' && to === 'league' ? null : moveDirection(from, to));
    assert.equal(moreThanTournamentsSentence(BOTH_OPEN, 'tournament_plus', noMove), 'Running more than tournaments? Club adds rep teams and the club’s books.');
  });

  it('the window keeps today’s sentence and its four cards, and adds the open plans’ clause', () => {
    const page = readCode('app/[orgSlug]/admin/onboarding/page.tsx');
    const chooser = functionBody(page, 'renderPlanChooser');
    assert.match(chooser, /Start free with an invite-only event, where you add the teams, or choose Tournament Plus/);
    assert.match(chooser, /moreThanTournamentsSentence\(gatingMap, activePlanId\)/);
    assert.match(chooser, /order=\{\['tournament_plus', 'tournament', 'league', 'club'\]\}/);
  });
});

describe('W71 (call 44): the tournament organizers’ line', () => {
  it('each line only while its own plan is open', () => {
    assert.equal(alreadyRunningTournamentsLine('league', BOTH_CLOSED), null);
    assert.equal(alreadyRunningTournamentsLine('club', BOTH_CLOSED), null);
    assert.ok(alreadyRunningTournamentsLine('league', LEAGUE_OPEN));
    assert.equal(alreadyRunningTournamentsLine('club', LEAGUE_OPEN), null);
    assert.equal(alreadyRunningTournamentsLine('league', CLUB_OPEN), null);
    const club = alreadyRunningTournamentsLine('club', CLUB_OPEN)!;
    assert.equal(`${club.before}${club.link}${club.after}`,
      'Already running tournaments here? Start Club from Plan & billing. Your events, teams and staff stay where they are.');
    assert.equal(club.href, '/start/club');
    const league = alreadyRunningTournamentsLine('league', BOTH_OPEN)!;
    assert.equal(`${league.before}${league.link}${league.after}`,
      'Already running tournaments here? Start League Plus from Plan & billing. Your events, teams and staff stay where they are.');
    assert.equal(league.href, '/start/league');
  });

  it('GUARD: the League Plus line cannot render while moveDirection(tournament_plus, league) is null', () => {
    const noMove = (from: OrgPlan, to: OrgPlan) => (from === 'tournament_plus' && to === 'league' ? null : moveDirection(from, to));
    assert.equal(alreadyRunningTournamentsLine('league', BOTH_OPEN, noMove), null);
    assert.ok(alreadyRunningTournamentsLine('club', BOTH_OPEN, noMove), 'only the missing move takes its own line away');
    const noClubMove = (from: OrgPlan, to: OrgPlan) => (from === 'tournament_plus' && to === 'club' ? null : moveDirection(from, to));
    assert.equal(alreadyRunningTournamentsLine('club', BOTH_OPEN, noClubMove), null);
    // The shipped table has the move today; if it is ever taken out, the line goes with it.
    assert.equal(moveDirection('tournament_plus', 'league') !== null, alreadyRunningTournamentsLine('league', BOTH_OPEN) !== null);
    // The page reads the line only through the guarded helper.
    const page = readCode('app/for-tournament-organizers/page.tsx');
    assert.match(page, /alreadyRunningTournamentsLine\(cs\.alreadyRunning, gatingMap\)/);
    assert.ok(!page.includes('Already running tournaments here'), 'the words live in the helper only');
  });
});

describe('a Premium coach’s Plan & billing is unchanged by Part 4', () => {
  it('only the free-time line gains the gap; the portal line keeps the plain hint', () => {
    const body = readCode('components/billing/BillingBody.tsx');
    assert.match(body, /freeCopy\?\.billingCard && <p className=\{`\$\{styles\.hint\} \$\{styles\.freeTimeHint\}`\}>/);
    assert.match(body, /portalCopy\?\.billingCard && <p className=\{styles\.hint\}>/);
  });
});
