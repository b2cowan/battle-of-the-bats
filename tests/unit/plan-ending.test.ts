/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A PLAN ENDS ON ITS RENEWAL DATE (Plans end at renewal, Stage 1; owner ruling 2026-10-31).
 * Prompt: docs/projects/active/PLAN_ENDS_AT_RENEWAL_STAGE1_BUILD_PROMPT.md · plan §3, §3a.
 *
 * lib/plan-ending.ts is the logic only: every database, Stripe and email step is a dependency. Here they are an in-memory
 * world that logs every call in order, so a test can say what the click touched (Stripe first, nothing torn down), what
 * the end date did (once, in the safe order), and what a replay after a crash at each step leaves (one of everything).
 *
 *   1 · the click: Stripe first, nothing taken away; no real subscription ends now
 *   2 · Keep {Plan}: Stripe cleared, the row withdrawn
 *   3 · the end date: the waiting row promoted, the ending once, replays do nothing (G7: a crash at every step)
 *   4 · what Stripe says: portal cancel recorded, Renew withdraws, cancel_at alone (G8), stale ownership (S4)
 *   5 · the one rule for a subscription's future: carry, restore, drop, refuse (G1)
 *   6 · the dates: retention from the end, overdue past three days (G3), one calendar day (G4)
 *   8 · Stage 2 — a move to the free plan waits: the row before Stripe, the date's move (never a suspension), Stripe's
 *       storm and replays, the pick re-read on the date (G2, Ask 8), Cancel replaces it (ruling 4), the safety net (ruling 6)
 *  10 · Stage 2 Part C — a move's emails (each once per row, the date formatter), the log as an append, the operator's
 *       plan change refused while a change waits
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import {
  OVERDUE_GRACE_DAYS, applyEnding, clickedAt, keepInProgress, keptOnTheDate, scheduleDowngrade, waitingState, endedAtFor, endingForDeletedSubscription, finishOverdueEnding, futureMoveAnswer, hasRealSubscription,
  askingDoor, endingEmailTiming, reminderDue, sendDueEndingEmails, stripeIdToStopNow, upcomingDate,
  isOverdueEnding, keepEnding, pickAppliedEnding, recordStripeSignal, retentionUntilFrom, scheduleEnding, stripeCancelSignal,
  waitingMoveOf, waitingMoveView, changeKeptTournaments, operatorPlanChangeRefusal, type EndedEvent, type EndingAccount, type EndingActor, type EndingDeps, type EndingEmail, type EndingIntent,
  type RetainedRecordRow, type DowngradedEvent, type SlotHolder,
} from '../../lib/plan-ending.ts';
import { formatStoredDate } from '../../lib/timezone.ts';
import { endingEmail, type EndingEmailFacts } from '../../lib/plan-ending-emails.ts';
import { PLAN_BILLING_WORDS as W } from '../../lib/plan-billing-words.ts';
import { functionBody, readCode } from './_source-code.ts';

const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const RENEWAL = '2027-01-15T02:00:00.000Z'; // an evening-Eastern instant: Jan 14 in Toronto, Jan 15 in UTC (G4)
const NOW = new Date('2026-11-01T15:00:00.000Z');
const OWNER: EndingActor = { door: 'owner', userId: 'user-owner', email: 'owner@example.com' };
const OPERATOR: EndingActor = { door: 'operator', userId: null, email: 'admin@fieldlogichq.com' };

function account(over: Partial<EndingAccount> = {}): EndingAccount {
  return {
    orgId: 'org-1', name: 'Riverside', slug: 'riverside', ownPlan: 'tournament_plus', accountKind: 'org', enabledAddons: [],
    isCoachesPortal: false, teamWorkspaceId: null, subscriptionStatus: 'active', subscriptionId: 'sub_1', ...over,
  };
}

function subscription(over: Record<string, unknown> = {}): Stripe.Subscription {
  return {
    id: 'sub_1', status: 'active', cancel_at_period_end: false, cancel_at: null, trial_end: null, created: unix('2026-01-15T00:00:00Z'),
    ended_at: null, canceled_at: null, schedule: null, metadata: {}, items: { data: [{ current_period_end: unix(RENEWAL) }] }, ...over,
  } as unknown as Stripe.Subscription;
}

const moveSchedule = (plan = 'tournament_plus') => ({ id: 'sub_sched_1', status: 'active', metadata: { flhq_plan_move: 'down', planKey: plan } });

type World = ReturnType<typeof world>;

/** An in-memory account: intents, kept records, tournaments, a Stripe subscription. Every call is logged, in order. */
function world(opts: { sub?: Stripe.Subscription; tournaments?: string[]; intents?: EndingIntent[]; account?: EndingAccount } = {}) {
  const calls: string[] = [];
  const intents = new Map<string, EndingIntent>((opts.intents ?? []).map(i => [i.id, i]));
  const records: RetainedRecordRow[] = [];
  const live = new Set(opts.tournaments ?? ['t-1', 't-2']);
  /** When each tournament was made (the date's "newest" fallback): in the order given, a month apart; one added later is newer. */
  const created = new Map<string, string>([...live].map((id, i) => [id, new Date(Date.UTC(2026, i, 1)).toISOString()]));
  const plans: string[] = [];
  const moveEvents = new Map<string, DowngradedEvent>();
  const archived = new Set<string>();
  const events = new Map<string, EndedEvent>();
  const emails = new Map<string, number>();
  const suspensions: Array<{ endedAt: string; reason: string | null }> = [];
  const payPages: string[] = [];
  const moves: string[] = [];
  let sub = opts.sub ?? subscription();
  let seq = intents.size;
  const state = { stripeLies: false, failAt: null as string | null, stripeFails: null as string | null, moveFails: false, now: NOW, mailFails: false, mailMaybeWent: false, mailDiesAfterClaim: false, duringMove: null as null | (() => Promise<unknown>) };
  /** Every Part C email that went, in order. */
  const mail: Array<{ kind: string; intentId: string; door: string | null; email: EndingEmail }> = [];
  const cleared: string[] = [];
  const STAMP = { ends_on: 'endsOnEmailSentAt', reminder: 'reminderEmailSentAt', kept: 'keptEmailSentAt', moved: 'endedEmailSentAt' } as const;

  const step = (name: string) => {
    calls.push(name);
    if (state.failAt === name) { state.failAt = null; throw new Error(`crash at ${name}`); }
  };
  const stripeStep = (name: string) => {
    calls.push(name);
    if (state.stripeFails === name) throw new Error('Stripe said no');
  };

  const deps: EndingDeps = {
    now: () => state.now,
    retentionDays: a => (a.isCoachesPortal ? 365 : 90),
    async findPending(orgId) {
      return [...intents.values()].find(i => i.orgId === orgId && i.status === 'pending') ?? null;
    },
    async findAppliedFor(orgId, subscriptionId, createdAt) {
      const rows = [...intents.values()].filter(i => i.orgId === orgId && i.status === 'applied');
      return pickAppliedEnding(rows, subscriptionId, createdAt);
    },
    async insertIntent(row) {
      step('db:insert');
      if (row.status === 'pending' && [...intents.values()].some(i => i.orgId === row.orgId && i.status === 'pending')) return 'conflict';
      const intent: EndingIntent = {
        ...row, id: `intent-${++seq}`, appliedAt: null, endedEmailSentAt: null,
        endsOnEmailSentAt: null, reminderEmailSentAt: null, keptEmailSentAt: null, createdAt: state.now.toISOString(),
      };
      intents.set(intent.id, intent);
      return intent;
    },
    async updateIntent(id, patch, onlyIf) {
      step(patch.status === 'applied' ? 'db:flip' : 'db:update');
      const current = intents.get(id);
      if (!current || !onlyIf.includes(current.status)) return null;
      // The store's append (Stage 2 Part C): `log` is added to the log the row holds NOW, never a writer's earlier read.
      const { log, ...fields } = patch;
      const next = { ...current, ...fields, changeLog: [...current.changeLog, ...(log ?? [])] };
      intents.set(id, next);
      return next;
    },
    async preflight() {
      calls.push('preflight');
      return { tournaments: [...live].map(id => ({ id, name: id, slug: id, status: 'active', year: 2026, startDate: null, endDate: null })), shutsDown: ['Public site'] };
    },
    async recordedFor(intentId) {
      return records.filter(r => r.intentId === intentId).map(r => ({ recordType: r.recordType, recordId: r.recordId, displayName: r.displayName }));
    },
    async supersedeOthers() { step('records:supersede'); },
    async insertRecords(rows) { step('records:insert'); records.push(...rows); },
    async archive(_orgId, ids) { step('archive'); for (const id of ids) { live.delete(id); archived.add(id); } },
    async slotHolders(): Promise<SlotHolder[]> {
      calls.push('slotHolders');
      return [...live].map(id => ({ id, name: id, slug: id, status: 'active', year: 2026, startDate: null, endDate: null, createdAt: created.get(id) ?? '2026-12-01T00:00:00.000Z' }));
    },
    async setPlan(_orgId, plan) { step('plan'); plans.push(plan); },
    async closePayPagesIfPlanHasNone() { step('payPages'); payPages.push('owner downgrade'); },
    async writeDowngradedEvent(e) { step('moveEvent'); if (!moveEvents.has(e.sourceEventId)) moveEvents.set(e.sourceEventId, e); },
    async suspend(_a, p) { step('suspend'); suspensions.push(p); },
    async closePayPages(_orgId, where) { step('payPages'); payPages.push(where); },
    async writeEndedEvent(e) { step('event'); if (!events.has(e.sourceEventId)) events.set(e.sourceEventId, e); },
    async sendEndedEmail(p) { step('email'); const key = `intent:${p.intentId}:ended_email`; emails.set(key, (emails.get(key) ?? 0) + 1); },
    async claimEmail(intentId, stamp, onlyIf) {
      calls.push(`claim:${stamp}`);
      const current = intents.get(intentId);
      if (!current || !onlyIf.includes(current.status) || current[STAMP[stamp]]) return null;
      const at = state.now.toISOString();
      intents.set(intentId, { ...current, [STAMP[stamp]]: at });
      if (state.mailDiesAfterClaim) { state.mailDiesAfterClaim = false; throw new Error('process died after the claim'); }
      return at;
    },
    async releaseEmail(intentId, stamp, claimedAt) {
      calls.push(`release:${stamp}`);
      const current = intents.get(intentId);
      if (current && current[STAMP[stamp]] === claimedAt) intents.set(intentId, { ...current, [STAMP[stamp]]: null });
    },
    async sendEndingEmail(email) {
      calls.push(`mail:${email.kind}`);
      if (state.mailFails) return 'not_sent';
      if (state.mailMaybeWent) return 'unknown';
      mail.push({ kind: email.kind, intentId: email.intent.id, door: 'door' in email ? email.door : null, email });
      return 'sent';
    },
    async clearEndedSubscription(_a, s) { calls.push('clear'); cleared.push(s.id); },
    async retrieveSubscription() { stripeStep('stripe:retrieve'); return sub; },
    async scheduleCancel() {
      if (state.stripeLies) {
        // A timeout that hid a success: Stripe set it, the call still failed.
        calls.push('stripe:schedule');
        sub = { ...sub, cancel_at_period_end: true, cancel_at: sub.items.data[0].current_period_end, schedule: null } as Stripe.Subscription;
        throw new Error('timed out');
      }
      stripeStep('stripe:schedule'); sub = { ...sub, cancel_at_period_end: true, cancel_at: sub.items.data[0].current_period_end, schedule: null } as Stripe.Subscription; return sub;
    },
    async clearCancel(_id, clear) { stripeStep(`stripe:clear:${clear}`); sub = { ...sub, cancel_at_period_end: false, cancel_at: null } as Stripe.Subscription; return sub; },
    async releaseSchedule() { stripeStep('stripe:release'); sub = { ...sub, schedule: null } as Stripe.Subscription; },
    async rescheduleMove(_a, plan) {
      calls.push(`move:${plan}`);
      if (state.duringMove) await state.duringMove();
      if (state.moveFails) return { ok: false, error: 'That plan is retired.' };
      moves.push(plan);
      sub = { ...sub, schedule: moveSchedule(plan) } as unknown as Stripe.Subscription;
      return { ok: true };
    },
  };
  return {
    deps, calls, intents, records, live, archived, events, emails, suspensions, payPages, moves, state, mail, cleared, created, plans, moveEvents,
    get sub() { return sub; },
    set sub(next: Stripe.Subscription) { sub = next; },
    pending: () => [...intents.values()].find(i => i.status === 'pending') ?? null,
    only: () => { assert.equal(intents.size, 1, 'one intent'); return [...intents.values()][0]; },
  };
}

const TEARDOWN = ['records:insert', 'archive', 'suspend', 'event', 'payPages', 'email'];
/** The teardown steps that ran, in order (the two record writes — tournaments, then the account — read as one step). */
const tornDown = (w: World, extra: string[] = []) => w.calls.filter(c => [...TEARDOWN, ...extra].includes(c)).filter((c, i, all) => c !== all[i - 1]);

// ── 1 · The click ────────────────────────────────────────────────────────────────────────────────

describe('1 · the click schedules the end and takes nothing away', () => {
  it('Stripe is asked BEFORE any database write, and nothing is archived, suspended, closed, counted or emailed', async () => {
    const w = world();
    const result = await scheduleEnding(account(), OWNER, { reason: 'Season over', notifyOwner: true }, w.deps);
    assert.equal(result.outcome, 'scheduled');
    assert.ok(w.calls.indexOf('stripe:schedule') < w.calls.indexOf('db:insert'), w.calls.join(' → '));
    assert.deepEqual(tornDown(w), []);
    const row = w.only();
    assert.equal(row.status, 'pending');
    assert.equal(row.effectiveAt, RENEWAL, 'effective_at is Stripe’s end date');
    assert.equal(row.reason, 'Season over');
    assert.equal(row.stripeSubscriptionId, 'sub_1');
    assert.equal(row.retentionUntil, retentionUntilFrom(RENEWAL, 90), 'the data clock starts on the end date, not the click');
  });

  it('when Stripe refuses, nothing is scheduled and the database is untouched', async () => {
    const w = world();
    w.state.stripeFails = 'stripe:schedule';
    const result = await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps);
    assert.equal(result.outcome, 'refused');
    assert.equal(w.intents.size, 0);
    assert.ok(!w.calls.some(c => c.startsWith('db:')));
  });

  it('a double click (or a cancel already set in Stripe’s portal) writes one row and never asks Stripe twice', async () => {
    const w = world();
    await scheduleEnding(account(), OWNER, { reason: 'first', notifyOwner: true }, w.deps);
    await scheduleEnding(account(), OWNER, { reason: 'second', notifyOwner: true }, w.deps);
    assert.equal(w.calls.filter(c => c === 'stripe:schedule').length, 1);
    assert.equal(w.only().reason, 'second');
  });

  it('a Stripe yes with a failed database write answers "scheduled, not recorded yet", never a plain failure', async () => {
    const w = world();
    w.state.failAt = 'db:insert';
    const result = await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps);
    assert.deepEqual([result.outcome, result.outcome === 'scheduled' && result.recorded], ['scheduled', false]);
  });

  for (const [label, over] of [
    ['comped (no subscription)', { subscriptionId: null }],
    ['a dev mock subscription', { subscriptionId: 'mock_sub_9' }],
    ['a cancelled status', { subscriptionStatus: 'canceled' }],
  ] as const) {
    it(`${label}: no date to wait for — the plan ends now through the same ending, and Stripe is never called`, async () => {
      const w = world();
      const result = await scheduleEnding(account(over), OWNER, { reason: null, notifyOwner: true }, w.deps);
      assert.equal(result.outcome, 'ended');
      assert.ok(!w.calls.some(c => c.startsWith('stripe:')));
      assert.deepEqual(tornDown(w), TEARDOWN);
      assert.equal(w.only().status, 'applied');
    });
  }

  it('the window can tell a real subscription from none (the with-Stripe / no-Stripe sentence)', () => {
    assert.equal(hasRealSubscription({ subscriptionId: 'sub_1', subscriptionStatus: 'trialing' }), true);
    assert.equal(hasRealSubscription({ subscriptionId: 'sub_1', subscriptionStatus: 'past_due' }), true);
    assert.equal(hasRealSubscription({ subscriptionId: 'mock_1', subscriptionStatus: 'active' }), false);
    assert.equal(hasRealSubscription({ subscriptionId: null, subscriptionStatus: 'active' }), false);
  });

  it('the data clock is whole UTC days, the same on any host (across a clock change too)', () => {
    assert.equal(retentionUntilFrom('2026-10-20T02:00:00.000Z', 30), '2026-11-19T02:00:00.000Z');
    assert.equal(retentionUntilFrom('2026-03-01T15:30:00.000Z', 90), new Date(Date.parse('2026-03-01T15:30:00.000Z') + 90 * 86_400_000).toISOString());
  });

  it('a cancel that ends at once stops a real subscription that is not paying, and nothing else', () => {
    for (const status of ['unpaid', 'incomplete', 'paused']) assert.equal(stripeIdToStopNow({ subscriptionId: 'sub_1', subscriptionStatus: status }), 'sub_1');
    // paying: it waits (or End now stops it by name); already ended in Stripe; a dev mock; none at all
    for (const status of ['active', 'trialing', 'past_due', 'canceled', 'incomplete_expired']) assert.equal(stripeIdToStopNow({ subscriptionId: 'sub_1', subscriptionStatus: status }), null);
    assert.equal(stripeIdToStopNow({ subscriptionId: 'mock_1', subscriptionStatus: 'unpaid' }), null);
    assert.equal(stripeIdToStopNow({ subscriptionId: null, subscriptionStatus: 'unpaid' }), null);
  });

  it('both cancel doors stop that Stripe subscription (Part A dropped the call; review 2026-11-02)', () => {
    for (const route of ['app/api/billing/cancel/confirm/route.ts', 'app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts']) {
      assert.match(readCode(route), /stripeIdToStopNow\(account\)/, route);
    }
    assert.match(readCode('app/api/billing/cancel/confirm/route.ts'), /subscriptions\.cancel\(stripeSubscriptionId\)/);
  });
});

// ── 2 · Keep {Plan} ──────────────────────────────────────────────────────────────────────────────

describe('2 · Keep {Plan} undoes a waiting cancel', () => {
  it('Stripe is cleared first, the row is withdrawn, and nothing was ever taken to give back', async () => {
    const w = world();
    await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps);
    const result = await keepEnding(account(), OWNER, w.deps);
    assert.equal(result.outcome, 'kept');
    assert.ok(w.calls.indexOf('stripe:clear:period_end') < w.calls.lastIndexOf('db:update'));
    assert.equal(w.only().status, 'canceled');
    assert.equal(w.only().changeLog.at(-1)?.action, 'kept');
    assert.equal(w.sub.cancel_at_period_end, false);
    assert.deepEqual(tornDown(w), []);
  });

  it('a dated cancel_at alone is cleared as cancel_at (G8)', async () => {
    const w = world({ sub: subscription({ cancel_at: unix('2026-12-31T05:00:00Z') }) });
    await recordStripeSignal(account(), w.sub, w.deps);
    await keepEnding(account(), OWNER, w.deps);
    assert.ok(w.calls.includes('stripe:clear:cancel_at'));
  });

  it('when Stripe refuses the keep, the cancel still waits and nothing changes', async () => {
    const w = world();
    await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps);
    w.state.stripeFails = 'stripe:clear:period_end';
    assert.equal((await keepEnding(account(), OWNER, w.deps)).outcome, 'refused');
    assert.equal(w.only().status, 'pending');
  });

  it('nothing waiting → nothing to keep', async () => {
    assert.equal((await keepEnding(account(), OWNER, world().deps)).outcome, 'nothing');
  });
});

// ── 3 · The end date ─────────────────────────────────────────────────────────────────────────────

describe('3 · the end date runs the ending once', () => {
  it('the deletion promotes the waiting row in place (the owner’s reason kept) and tears down in the safe order', async () => {
    const w = world();
    await scheduleEnding(account(), OWNER, { reason: 'Season over', notifyOwner: true }, w.deps);
    w.state.now = new Date('2027-01-15T02:00:05.000Z');
    const deleted = subscription({ status: 'canceled', ended_at: unix(RENEWAL), cancel_at_period_end: true });
    const result = await endingForDeletedSubscription(account(), deleted, w.deps);
    assert.equal(result.kind, 'ended');
    const row = w.only();
    assert.equal(row.status, 'applied');
    assert.equal(row.reason, 'Season over');
    assert.equal(row.effectiveAt, RENEWAL);
    // Records before the archive; the flip LAST.
    assert.deepEqual(tornDown(w, ['db:flip']), [...TEARDOWN, 'db:flip']);
    assert.equal(w.records.filter(r => r.recordType === 'account').length, 1);
    assert.equal(w.records.filter(r => r.recordType === 'tournament').length, 2);
    assert.equal(w.records[0].metadata.retentionReason, 'account_cancellation', 'reactivation restores by this reason');
    assert.deepEqual([...w.events.keys()], [`intent:${row.id}:subscription_canceled`]);
    assert.equal(w.events.get(`intent:${row.id}:subscription_canceled`)?.requestedBy, 'owner');
    assert.deepEqual(w.payPages, ['owner cancel']);
  });

  it('a replay after it finished does nothing', async () => {
    const w = world();
    await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps);
    const deleted = subscription({ status: 'canceled', ended_at: unix(RENEWAL) });
    await endingForDeletedSubscription(account(), deleted, w.deps);
    const before = w.calls.length;
    const again = await endingForDeletedSubscription(account(), deleted, w.deps);
    assert.deepEqual(again, { kind: 'already', intentType: 'cancellation' });
    assert.deepEqual(w.calls.slice(before).filter(c => TEARDOWN.includes(c)), []);
  });

  for (const crashAt of [...TEARDOWN, 'db:flip']) {
    it(`G7 · a crash at "${crashAt}" then a replay leaves one of everything`, async () => {
      const w = world();
      await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps);
      const deleted = subscription({ status: 'canceled', ended_at: unix(RENEWAL) });
      w.state.failAt = crashAt;
      await assert.rejects(endingForDeletedSubscription(account(), deleted, w.deps));
      await endingForDeletedSubscription(account(), deleted, w.deps);
      const row = w.only();
      assert.equal(row.status, 'applied');
      assert.equal(w.records.filter(r => r.recordType === 'account').length, 1, 'one account record');
      assert.deepEqual(w.records.filter(r => r.recordType === 'tournament').map(r => r.recordId).sort(), ['t-1', 't-2'], 'one record per tournament');
      assert.deepEqual([...w.archived].sort(), ['t-1', 't-2']);
      assert.equal(w.events.size, 1, 'one subscription_canceled');
      assert.equal(w.emails.size, 1, 'one email (the mail service’s once-only key holds a resend)');
      assert.ok(row.endedEmailSentAt);
    });
  }

  it('Stripe ending it with nobody asking: a fresh ending, Stripe’s reason, no email for an org (as before)', async () => {
    const w = world();
    const result = await endingForDeletedSubscription(account(), subscription({ status: 'canceled', ended_at: unix('2026-12-03T10:00:00Z') }), w.deps);
    assert.equal(result.kind, 'ended');
    const row = w.only();
    assert.equal(row.reason, 'Stripe subscription deleted');
    assert.equal(row.createdByEmail, 'stripe-webhook');
    assert.equal(w.records[0].metadata.retentionReason, 'stripe_subscription_deleted');
    assert.equal([...w.events.values()][0].source, 'stripe');
    assert.equal(w.emails.size, 0);
    assert.deepEqual(w.payPages, ['stripe suspension']);
  });

  it('a Coaches Portal: 365 days, the workspace reason, the Premium workspace record, the email always, pay pages close (decision 2)', async () => {
    const portal = account({ ownPlan: 'team', accountKind: 'team_workspace', isCoachesPortal: true, teamWorkspaceId: 'ws-1', name: 'Hawks Coaches Portal' });
    const w = world();
    await endingForDeletedSubscription(portal, subscription({ status: 'canceled', ended_at: unix(RENEWAL) }), w.deps);
    const accountRecord = w.records.find(r => r.recordType === 'account')!;
    assert.equal(accountRecord.displayName, 'Hawks Coaches Portal Premium workspace');
    assert.equal(accountRecord.metadata.retentionReason, 'coaches_portal_cancellation');
    assert.equal(accountRecord.metadata.teamWorkspaceId, 'ws-1');
    assert.equal(w.only().retentionUntil, retentionUntilFrom(RENEWAL, 365));
    assert.equal(w.emails.size, 1);
    assert.equal(w.payPages.length, 1);
    assert.equal([...w.events.values()][0].account.orgId, portal.orgId, 'the portal’s event names its org (it used to name none)');
  });

  it('End now promotes the waiting row in place (one row, effective now) and honours the "tell the owner" tick', async () => {
    const w = world();
    await scheduleEnding(account(), OPERATOR, { reason: 'Chargeback', notifyOwner: false }, w.deps);
    w.state.now = new Date('2026-11-20T12:00:00.000Z');
    await applyEnding(account(), { actor: OPERATOR, reason: 'Chargeback', notifyOwner: false, origin: 'request' }, w.deps);
    const row = w.only();
    assert.equal(row.status, 'applied');
    assert.equal(row.effectiveAt, '2026-11-20T12:00:00.000Z');
    assert.equal(w.emails.size, 0, 'not ticked → no email');
    assert.equal(w.records[0].metadata.initiatedBy, 'platform_admin');
    assert.deepEqual(w.payPages, ['operator cancel']);
  });

  it('an overdue ending (finished late) starts its data clock on the day it should have ended (ruling 6)', async () => {
    const w = world();
    await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps);
    w.state.now = new Date('2027-01-25T12:00:00.000Z');
    await applyEnding(account(), { actor: OWNER, reason: null, notifyOwner: true, origin: 'request' }, w.deps);
    assert.equal(w.only().effectiveAt, RENEWAL);
    assert.equal(w.only().retentionUntil, retentionUntilFrom(RENEWAL, 90));
  });
});

// ── 4 · What Stripe says ─────────────────────────────────────────────────────────────────────────

describe('4 · the waiting row agrees with Stripe', () => {
  it('a cancel set in Stripe’s portal is recorded, once, however many updates Stripe fires', async () => {
    const w = world({ sub: subscription({ cancel_at_period_end: true, cancel_at: unix(RENEWAL) }) });
    for (let i = 0; i < 5; i += 1) await recordStripeSignal(account(), w.sub, w.deps);
    const row = w.only();
    assert.deepEqual([row.status, row.reason, row.createdByEmail, row.effectiveAt], ['pending', 'Cancelled in the billing portal', 'stripe-webhook', RENEWAL]);
    assert.equal(row.changeLog[0].door, 'stripe_portal');
  });

  it('Renew in the portal (both signals clear) withdraws it', async () => {
    const w = world({ sub: subscription({ cancel_at_period_end: true }) });
    await recordStripeSignal(account(), w.sub, w.deps);
    assert.equal(await recordStripeSignal(account(), subscription(), w.deps), 'withdrawn');
    assert.equal(w.only().status, 'canceled');
  });

  it('G8 · a dated cancel_at alone is a waiting cancel, dated by cancel_at, and is not withdrawn by the flag being false', async () => {
    const custom = unix('2026-12-31T05:00:00Z');
    const w = world({ sub: subscription({ cancel_at: custom, cancel_at_period_end: false }) });
    assert.equal(await recordStripeSignal(account(), w.sub, w.deps), 'recorded');
    assert.equal(await recordStripeSignal(account(), w.sub, w.deps), 'unchanged');
    assert.equal(w.only().status, 'pending');
    assert.equal(w.only().effectiveAt, '2026-12-31T05:00:00.000Z');
  });

  it('a trialing subscription ends at its trial end', () => {
    const trial = unix('2026-11-20T05:00:00Z');
    const signal = stripeCancelSignal(subscription({ status: 'trialing', trial_end: trial, cancel_at_period_end: true, items: { data: [{ current_period_end: trial }] } }));
    assert.deepEqual([signal.scheduled, signal.endsAt], [true, '2026-11-20T05:00:00.000Z']);
  });

  it('an ended subscription writes nothing (its deletion speaks for it)', async () => {
    const w = world();
    assert.equal(await recordStripeSignal(account(), subscription({ status: 'canceled', cancel_at_period_end: true }), w.deps), 'unchanged');
    assert.equal(w.intents.size, 0);
  });

  it('S4 · an applied ending counts only for ITS subscription: a stale downgrade or another subscription’s cancel never does', () => {
    const created = '2026-06-01T00:00:00.000Z';
    const old = { intentType: 'downgrade' as const, targetPlan: 'tournament', stripeSubscriptionId: null, appliedAt: '2025-03-01T00:00:00.000Z' };
    const paidDown = { intentType: 'downgrade' as const, targetPlan: 'tournament_plus', stripeSubscriptionId: null, appliedAt: '2026-07-01T00:00:00.000Z' };
    const other = { intentType: 'cancellation' as const, targetPlan: null, stripeSubscriptionId: 'sub_old', appliedAt: '2026-07-01T00:00:00.000Z' };
    assert.equal(pickAppliedEnding([old, paidDown, other], 'sub_1', created), null);
    const mine = { intentType: 'cancellation' as const, targetPlan: null, stripeSubscriptionId: 'sub_1', appliedAt: '2026-07-01T00:00:00.000Z' };
    assert.equal(pickAppliedEnding([other, mine], 'sub_1', created), mine);
    const legacy = { intentType: 'cancellation' as const, targetPlan: null, stripeSubscriptionId: null, appliedAt: '2026-07-01T00:00:00.000Z' };
    assert.equal(pickAppliedEnding([legacy], 'sub_1', created), legacy, 'older rows: applied after the subscription began');
  });
});

// ── 5 · The one rule for a subscription's future ─────────────────────────────────────────────────

describe('5 · a waiting cheaper move is carried, put back, dropped on the record — never lost (G1)', () => {
  it('cancel with a waiting move → the schedule is released first, the move remembered; keep → the same move put back', async () => {
    const w = world({ sub: subscription({ schedule: moveSchedule('tournament_plus') }) });
    const club = account({ ownPlan: 'club' });
    const scheduled = await scheduleEnding(club, OWNER, { reason: null, notifyOwner: true }, w.deps);
    assert.ok(w.calls.indexOf('stripe:release') < w.calls.indexOf('stripe:schedule'), 'Stripe will not cancel a schedule-managed subscription');
    assert.equal(scheduled.outcome === 'scheduled' && scheduled.heldMovePlan, 'tournament_plus');
    assert.equal(w.only().changeLog[0].move, 'carried');

    const kept = await keepEnding(club, OWNER, w.deps);
    assert.deepEqual(kept.outcome === 'kept' && [kept.renewsAs, kept.moveNotRestored], ['tournament_plus', null]);
    assert.ok(w.calls.indexOf('stripe:clear:period_end') < w.calls.indexOf('move:tournament_plus'), 'the cancel is cleared before the move is rebuilt');
    assert.deepEqual(w.moves, ['tournament_plus']);
    assert.equal(w.only().changeLog.at(-1)?.move, 'restored');
  });

  it('keep when the move can no longer be built: the plan is kept, and it says so plainly', async () => {
    const w = world({ sub: subscription({ schedule: moveSchedule('tournament_plus') }) });
    const club = account({ ownPlan: 'club' });
    await scheduleEnding(club, OWNER, { reason: null, notifyOwner: true }, w.deps);
    w.state.moveFails = true;
    const kept = await keepEnding(club, OWNER, w.deps);
    assert.deepEqual(kept.outcome === 'kept' && [kept.renewsAs, kept.movePlan, kept.moveNotRestored], [null, 'tournament_plus', 'That plan is retired.']);
    assert.equal(w.only().status, 'canceled');
    assert.equal(w.only().changeLog.at(-1)?.move, 'restore_failed');
  });

  it('a refused cancel puts a released move back, so it changes nothing at all', async () => {
    const w = world({ sub: subscription({ schedule: moveSchedule('tournament_plus') }) });
    w.state.stripeFails = 'stripe:schedule';
    const result = await scheduleEnding(account({ ownPlan: 'club' }), OWNER, { reason: null, notifyOwner: true }, w.deps);
    assert.equal(result.outcome, 'refused');
    assert.deepEqual(w.moves, ['tournament_plus']);
  });

  it('the end date drops a carried move on the record, with why', async () => {
    const w = world({ sub: subscription({ schedule: moveSchedule('tournament_plus') }) });
    const club = account({ ownPlan: 'club' });
    await scheduleEnding(club, OWNER, { reason: null, notifyOwner: true }, w.deps);
    await endingForDeletedSubscription(club, subscription({ status: 'canceled', ended_at: unix(RENEWAL) }), w.deps);
    const last = w.only().changeLog.at(-1)!;
    assert.deepEqual([last.action, last.move, last.plan], ['ended', 'dropped', 'tournament_plus']);
    assert.ok(last.note);
  });

  it('a schedule that is not ours refuses the cancel in plain words (never released silently)', async () => {
    const w = world({ sub: subscription({ schedule: { id: 'sub_sched_x', status: 'active', metadata: {} } }) });
    const result = await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps);
    assert.equal(result.outcome, 'refused');
    assert.ok(!w.calls.includes('stripe:release'));
  });

  it('every action has its answer', () => {
    const base = { ownPlan: 'club' as const };
    assert.deepEqual(futureMoveAnswer('schedule_cancel', { ...base, waitingMove: { plan: 'league' } }), { answer: 'carry', plan: 'league' });
    assert.equal(futureMoveAnswer('schedule_cancel', { ...base, waitingMove: 'foreign' }).answer, 'refuse');
    assert.deepEqual(futureMoveAnswer('keep', { ...base, heldMovePlan: 'league' }), { answer: 'restore', plan: 'league' });
    assert.equal(futureMoveAnswer('end', { ...base, heldMovePlan: 'league' }).answer, 'drop');
    for (const action of ['plan_move', 'downgrade', 'operator_plan_change'] as const) {
      const answer = futureMoveAnswer(action, { ...base, pendingEndsAt: RENEWAL });
      assert.equal(answer.answer, 'refuse');
      assert.match(answer.answer === 'refuse' ? answer.reason : '', /Your plan ends on January 14, 2027\. Keep Club first, then change it\./);
      assert.equal(futureMoveAnswer(action, base).answer, 'none');
    }
    assert.match((futureMoveAnswer('plan_move', { ownPlan: 'team', pending: true, pendingEndsAt: RENEWAL }) as { reason: string }).reason, /Keep Premium first/);
    for (const action of ['replace_subscription', 'reactivation'] as const) {
      assert.equal(futureMoveAnswer(action, { ...base, pending: true }).answer, 'withdraw');
    }
    assert.deepEqual(waitingMoveOf(subscription({ schedule: 'sub_sched_unexpanded' })), 'foreign');
    assert.equal(waitingMoveOf(subscription({ schedule: { ...moveSchedule(), status: 'released' } })), null);
  });
});

// ── 6 · The dates ────────────────────────────────────────────────────────────────────────────────

describe('6 · the dates', () => {
  it('G3 · overdue = still pending more than three days past its date', () => {
    const intent = { status: 'pending' as const, effectiveAt: RENEWAL };
    const at = (days: number) => new Date(new Date(RENEWAL).getTime() + days * 86_400_000);
    assert.equal(OVERDUE_GRACE_DAYS, 3);
    assert.equal(isOverdueEnding(intent, at(2.9)), false);
    assert.equal(isOverdueEnding(intent, at(3.1)), true);
    assert.equal(isOverdueEnding(intent, at(-30)), false, 'still in the future');
    assert.equal(isOverdueEnding({ ...intent, status: 'applied' }, at(10)), false);
  });

  it('the ended instant: Stripe’s ended_at, else the earlier of the date and now', () => {
    assert.equal(endedAtFor({ effectiveAt: RENEWAL }, new Date('2026-12-01T00:00:00Z')), '2026-12-01T00:00:00.000Z', 'early (End now, dunning)');
    assert.equal(endedAtFor({ effectiveAt: RENEWAL }, new Date('2027-02-01T00:00:00Z')), RENEWAL, 'late (overdue)');
    assert.equal(endedAtFor(null, NOW, '2027-01-15T02:00:01.000Z'), '2027-01-15T02:00:01.000Z');
  });

  it('G4 · one calendar day: the page, the windows and every email read an evening-Eastern end the same', () => {
    assert.equal(formatStoredDate(RENEWAL, { longMonth: true }), 'January 14, 2027');
    assert.match(readCode('lib/billing-retention.ts'), /export function retentionDateLabel\(iso: string\) \{\s*return formatStoredDate\(iso, \{ longMonth: true \}\);/);
    assert.doesNotMatch(readCode('lib/billing-retention.ts'), /toLocaleDateString/);
  });
});

// ── 7 · Where the doors sit (source guards) ──────────────────────────────────────────────────────

describe('7 · the doors', () => {
  it('cancel and Keep are owner-only (a billing delegate gets 403); Keep runs for a live org only', () => {
    for (const file of ['app/api/billing/cancel/confirm/route.ts', 'app/api/billing/cancel/keep/route.ts']) {
      assert.match(readCode(file), /if \(ctx\.role !== 'owner'\) return forbidden\(\);/, file);
    }
    assert.doesNotMatch(readCode('app/api/billing/cancel/keep/route.ts'), /allowSuspendedOrg/);
  });

  it('End now and the operator Keep are platform-admin-only and refuse without a typed reason', () => {
    const code = readCode('app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts');
    for (const verb of ['POST', 'DELETE']) {
      const body = code.slice(code.indexOf(`export const ${verb}`));
      assert.ok(body.indexOf("requirePlatformPower('club_billing')") < body.indexOf("'Reason is required'"), verb);
    }
    const post = code.slice(code.indexOf('export const POST'), code.indexOf('export const DELETE'));
    assert.ok(post.indexOf("'Reason is required'") < post.indexOf('applyEnding('), 'no End now without a reason');
  });

  it('the webhook: the placeholder block runs before the waiting-cancel record, and its deletion breaks before the ending', () => {
    const code = readCode('app/api/billing/webhook/route.ts');
    const updated = code.slice(code.indexOf("case 'customer.subscription.updated'"), code.indexOf("case 'customer.subscription.deleted'"));
    assert.ok(updated.indexOf("if (state === 'pending') break;") < updated.indexOf('recordStripeSignal('));
    assert.ok(updated.indexOf("if (state === 'withdrawn')") < updated.indexOf('recordStripeSignal('));
    assert.ok(updated.indexOf('stripe.subscriptions.retrieve(eventSub.id)') < updated.indexOf('recordStripeSignal('), 'the live subscription, never the event’s copy');
    const deleted = code.slice(code.indexOf("case 'customer.subscription.deleted'"), code.indexOf("case 'invoice.payment_succeeded'"));
    assert.ok(deleted.indexOf('clearNextSeasonChoice(choiceOrgId)') < deleted.indexOf('endingForDeletedSubscription('));
    assert.doesNotMatch(deleted, /\.eq\('status', 'applied'\)/, 'the unbounded "latest applied" check is gone (S4)');
  });

  it('G5 · no "trial ending — add a card" email while a cancel waits', () => {
    const code = readCode('app/api/billing/webhook/route.ts');
    const trial = code.slice(code.indexOf("case 'customer.subscription.trial_will_end'"));
    assert.ok(trial.indexOf('sub.cancel_at_period_end || sub.cancel_at || await readPendingEnding(org.id)) break;') < trial.indexOf("key: 'trial_ending'"));
  });

  it('while a cancel waits, a move and a downgrade are refused (decision 5); other immediate endings withdraw it', () => {
    // Stage 2: the refusal reads the waiting row to name what comes on the date (an end or a move to the free plan) — and
    // since Part B, the row alone refuses too (a click whose Stripe answer was lost has no flag yet).
    assert.match(readCode('lib/plan-move.ts'), /const ending = stripeCancelSignal\(live\.sub\);[\s\S]{0,400}const waiting = await readPendingEnding\(org\.id\)[^;]*;\s*if \(ending\.scheduled \|\| waiting\) \{[\s\S]{0,200}const answer = futureMoveAnswer\('plan_move'/);
    // Stage 2: the downgrade route writes nothing itself; scheduleDowngrade asks the one rule before its first write.
    const downgrade = readCode('app/api/billing/downgrade/confirm/route.ts');
    assert.doesNotMatch(downgrade, /\.from\('billing_retention_intents'\)/);
    const schedule = functionBody(readCode('lib/plan-ending.ts'), 'scheduleDowngrade');
    assert.ok(schedule.indexOf("futureMoveAnswer('downgrade'") < schedule.indexOf('deps.insertIntent('));
    assert.match(readCode('lib/billing-reactivation.ts'), /await withdrawPendingEnding\(\{ orgId \}, 'Reactivated'\);/);
    assert.match(readCode('lib/team-ownership-transfer.ts'), /await withdrawPendingEnding\(\{ subscriptionId \}, 'The team moved into a club'\);\s*try \{\s*await stripe\.subscriptions\.cancel\(subscriptionId\);/);
    const webhook = readCode('app/api/billing/webhook/route.ts');
    assert.ok(webhook.indexOf("await withdrawPendingEnding({ subscriptionId }, 'Replaced by the club’s subscription');") < webhook.indexOf('await stripe.subscriptions.cancel(subscriptionId);'));
  });

  it('one writer of subscription_canceled: no route or webhook arm writes it at the click any more', () => {
    for (const file of ['app/api/billing/cancel/confirm/route.ts', 'app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts', 'app/api/billing/webhook/route.ts']) {
      assert.doesNotMatch(readCode(file), /eventType: 'subscription_canceled'/, file);
    }
    assert.match(readCode('lib/plan-ending.ts'), /sourceEventId: `intent:\$\{intent\.id\}:subscription_canceled`/);
  });
});

// ── 8 · Part C: the emails, the daily job's steps, Finish this ending now (G3, G4, G6) ──────────────────────────────

const DAY = 86_400_000;
const at = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * DAY);
const sent = (w: World, kind: string) => w.mail.filter(m => m.kind === kind);

describe('8a · "Your plan ends on {date}" — once per waiting cancel, whichever door (G6 a)', () => {
  it('the owner’s cancel sends it once, from the owner’s door, promising the reminder when seven days or more are left', async () => {
    const w = world();
    await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps);
    await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps); // a double click
    assert.equal(sent(w, 'ends_on').length, 1);
    const email = sent(w, 'ends_on')[0].email;
    assert.equal(askingDoor(email.intent), 'owner');
    assert.ok(endingEmailTiming(email.intent, NOW).remindLater);
    assert.ok(w.only().endsOnEmailSentAt, 'stamped on the row');
  });

  it('an operator’s cancel emails the owner only when ticked', async () => {
    const quiet = world();
    await scheduleEnding(account(), OPERATOR, { reason: 'Asked by phone', notifyOwner: false }, quiet.deps);
    assert.equal(sent(quiet, 'ends_on').length, 0);
    assert.equal(quiet.only().endsOnEmailSentAt, null);
    const told = world();
    await scheduleEnding(account(), OPERATOR, { reason: 'Asked by phone', notifyOwner: true }, told.deps);
    assert.equal(askingDoor(sent(told, 'ends_on')[0].email.intent), 'operator');
  });

  it('a cancel set in Stripe’s portal is emailed by the webhook — and an `updated` storm sends one', async () => {
    const w = world({ sub: subscription({ cancel_at_period_end: true }) });
    for (let i = 0; i < 4; i += 1) await recordStripeSignal(account(), w.sub, w.deps);
    assert.equal(sent(w, 'ends_on').length, 1);
    assert.equal(askingDoor(sent(w, 'ends_on')[0].email.intent), 'stripe_portal');
  });

  it('a send that fails hands the claim back (the daily job tries again) and never fails the cancel', async () => {
    const w = world();
    w.state.mailFails = true;
    const result = await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps);
    assert.equal(result.outcome, 'scheduled');
    assert.equal(w.only().endsOnEmailSentAt, null, 'released');
    w.state.mailFails = false;
    const job = await sendDueEndingEmails([w.only()], async () => account(), w.deps);
    assert.deepEqual(job, { endsOn: 1, reminders: 0, failed: 0 });
    assert.equal(sent(w, 'ends_on').length, 1);
    await sendDueEndingEmails([w.only()], async () => account(), w.deps);
    assert.equal(sent(w, 'ends_on').length, 1, 'a re-run sends nothing twice');
  });

  it('a send that MAY have gone (no answer, a 5xx) keeps its claim — never a second copy (owner ruling 2026-11-02)', async () => {
    const w = world();
    w.state.mailMaybeWent = true;
    await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps);
    assert.ok(w.only().endsOnEmailSentAt, 'the claim stays');
    w.state.mailMaybeWent = false;
    await sendDueEndingEmails([w.only()], async () => account(), w.deps);
    assert.equal(sent(w, 'ends_on').length, 0, 'not sent again');
  });

  it('a cancel Stripe gave no end date to sends no "ends on" email (never "ends on {today}")', async () => {
    const w = world({ sub: subscription({ items: { data: [{ current_period_end: null }] } }) });
    await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps);
    assert.equal(sent(w, 'ends_on').length, 0);
  });

  it('no promise of a reminder when under seven days are left; nothing at all for a plan that ends at once', async () => {
    const soon = world();
    soon.state.now = at(RENEWAL, -3);
    await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, soon.deps);
    const email = sent(soon, 'ends_on')[0].email;
    assert.equal(endingEmailTiming(email.intent, soon.state.now).remindLater, false);
    const now = world();
    await scheduleEnding(account({ subscriptionId: 'mock_1' }), OWNER, { reason: null, notifyOwner: true }, now.deps);
    assert.equal(sent(now, 'ends_on').length, 0, 'it ended: the "cancelled" email speaks for it');
  });
});

describe('8b · Keep {Plan} — "Your plan will renew on {date}" (G6 b)', () => {
  it('the owner’s keep sends it once, with the renewal date', async () => {
    const w = world();
    await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps);
    await keepEnding(account(), OWNER, w.deps);
    await keepEnding(account(), OWNER, w.deps);
    assert.equal(sent(w, 'kept').length, 1);
    const email = sent(w, 'kept')[0].email;
    assert.ok(email.kind === 'kept' && email.renewsOn === RENEWAL && email.renewsAs === null);
  });

  it('the operator’s keep emails only when ticked', async () => {
    const quiet = world();
    await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, quiet.deps);
    await keepEnding(account(), OPERATOR, quiet.deps, { notifyOwner: false });
    assert.equal(sent(quiet, 'kept').length, 0);
    const told = world();
    await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, told.deps);
    await keepEnding(account(), OPERATOR, told.deps, { notifyOwner: true });
    assert.equal(sent(told, 'kept')[0]?.door, 'operator');
  });

  it('a kept cheaper move: Stripe’s own "renewed" event mid-keep leaves the row to the keep — one email, naming the cheaper plan (G1)', async () => {
    const club = account({ ownPlan: 'club' });
    const w = world({ account: club, sub: subscription({ schedule: moveSchedule('league') }) });
    await scheduleEnding(club, OWNER, { reason: null, notifyOwner: true }, w.deps);
    // The event Keep's own clear fires, landing while the move is being put back.
    w.state.duringMove = () => recordStripeSignal(club, subscription({ cancel_at_period_end: false }), w.deps);
    await keepEnding(club, OWNER, w.deps);
    assert.equal(w.only().status, 'canceled');
    assert.equal(w.only().changeLog.at(-1)?.move, 'restored');
    assert.equal(sent(w, 'kept').length, 1);
    const email = sent(w, 'kept')[0].email;
    assert.ok(email.kind === 'kept' && email.renewsAs === 'league' && email.door === 'owner');
  });

  it('a keep that dies while the move is put back leaves the row waiting — Keep again finishes it, the move included', async () => {
    const club = account({ ownPlan: 'club' });
    const w = world({ account: club, sub: subscription({ schedule: moveSchedule('league') }) });
    await scheduleEnding(club, OWNER, { reason: null, notifyOwner: true }, w.deps);
    // The move is back; the process dies on the write that withdraws the row.
    w.state.duringMove = async () => { w.state.failAt = 'db:update'; };
    await keepEnding(club, OWNER, w.deps).catch(() => undefined);
    assert.equal(w.only().status, 'pending', 'still waiting, so the page still offers Keep');
    w.state.duringMove = null;
    const again = await keepEnding(club, OWNER, w.deps);
    assert.ok(again.outcome === 'kept' && again.renewsAs === 'league');
    assert.equal(w.only().status, 'canceled');
  });

  it('Renew in Stripe’s portal is a keep too: one email from the portal’s door, however many events arrive', async () => {
    const w = world();
    await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps);
    w.sub = subscription({ cancel_at_period_end: false });
    await recordStripeSignal(account(), w.sub, w.deps);
    await recordStripeSignal(account(), w.sub, w.deps);
    assert.equal(sent(w, 'kept').length, 1);
    assert.equal(sent(w, 'kept')[0].door, 'stripe_portal');
  });
});

describe('8c · the seven-day reminder, a step of the daily job (G6 c)', () => {
  const base = { status: 'pending' as const, effectiveAt: RENEWAL, notifyOwner: true, reminderEmailSentAt: null, changeLog: [], createdAt: NOW.toISOString() };

  it('due from seven days out — never for a withdrawn row, an untold owner, a row already reminded, or after the date', () => {
    assert.equal(reminderDue(base, at(RENEWAL, -8)), false, 'eight days out');
    assert.equal(reminderDue(base, at(RENEWAL, -6)), true, 'six days out');
    assert.equal(reminderDue({ ...base, status: 'canceled' }, at(RENEWAL, -6)), false);
    assert.equal(reminderDue({ ...base, notifyOwner: false }, at(RENEWAL, -6)), false);
    assert.equal(reminderDue({ ...base, reminderEmailSentAt: NOW.toISOString() }, at(RENEWAL, -6)), false);
    assert.equal(reminderDue(base, at(RENEWAL, 1)), false);
  });

  it('skipped when the cancel was made with under seven days left (the click, not a later date move, decides)', () => {
    const clicked = at(RENEWAL, -5).toISOString();
    const row = { ...base, createdAt: clicked, changeLog: [{ at: clicked, action: 'scheduled' as const, door: 'owner' as const, by: null }] };
    assert.equal(reminderDue(row, at(RENEWAL, -4)), false);
    assert.equal(clickedAt(row), clicked);
  });

  it('the job sends it once; a re-run sends nothing; a failed send is tried again next run', async () => {
    const w = world();
    await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps);
    w.state.now = at(RENEWAL, -6);
    w.state.mailFails = true;
    assert.deepEqual(await sendDueEndingEmails([w.only()], async () => account(), w.deps), { endsOn: 0, reminders: 0, failed: 1 });
    w.state.mailFails = false;
    assert.deepEqual(await sendDueEndingEmails([w.only()], async () => account(), w.deps), { endsOn: 0, reminders: 1, failed: 0 });
    assert.deepEqual(await sendDueEndingEmails([w.only()], async () => account(), w.deps), { endsOn: 0, reminders: 0, failed: 0 });
    assert.equal(sent(w, 'reminder').length, 1);
  });

  it('a crash between the claim and the send loses that one email — it never sends two (owner ruling 2026-11-02)', async () => {
    const w = world();
    await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps);
    w.state.now = at(RENEWAL, -6);
    w.state.mailDiesAfterClaim = true;
    await sendDueEndingEmails([w.only()], async () => account(), w.deps);
    await sendDueEndingEmails([w.only()], async () => account(), w.deps);
    assert.equal(sent(w, 'reminder').length, 0);
  });

  it('a row whose "ends on" email is caught up this run waits for the next run for its reminder', async () => {
    const w = world();
    w.state.mailFails = true;
    await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps);
    w.state.mailFails = false;
    w.state.now = at(RENEWAL, -6);
    assert.deepEqual(await sendDueEndingEmails([w.only()], async () => account(), w.deps), { endsOn: 1, reminders: 0, failed: 0 });
    assert.deepEqual(await sendDueEndingEmails([w.only()], async () => account(), w.deps), { endsOn: 0, reminders: 1, failed: 0 });
  });
});

describe('8d · Finish this ending now — Stripe first, then only what Stripe confirms (G3)', () => {
  async function overdueWorld(sub: Stripe.Subscription) {
    const w = world();
    await scheduleEnding(account(), OWNER, { reason: 'Season over', notifyOwner: true }, w.deps);
    w.state.now = at(RENEWAL, OVERDUE_GRACE_DAYS + 1);
    w.sub = sub;
    w.calls.length = 0;
    return w;
  }

  it('Stripe says it ended: the ending the missed message would have run, once, the clock from the day it should have ended', async () => {
    const w = await overdueWorld(subscription({ status: 'canceled', cancel_at_period_end: true, ended_at: unix(RENEWAL) }));
    const result = await finishOverdueEnding(account(), OPERATOR, 'Webhook never arrived', w.deps);
    assert.ok(result.outcome === 'finished', JSON.stringify(result));
    assert.equal(result.endedAt, RENEWAL);
    assert.equal(result.emailed, true);
    assert.equal(result.retainedTournaments, 2);
    const row = w.only();
    assert.equal(row.status, 'applied');
    assert.equal(row.retentionUntil, retentionUntilFrom(RENEWAL, 90), 'Stage 0 ruling 6: from the day it should have ended');
    assert.match(row.changeLog.at(-1)?.note ?? '', /Finished by admin@fieldlogichq\.com: Webhook never arrived/);
    assert.deepEqual(w.cleared, ['sub_1'], 'the record’s subscription fields cleared, as the webhook clears them');
    assert.ok(w.calls.indexOf('clear') < w.calls.indexOf('suspend'), 'cleared BEFORE the row flips to applied, so it can never be stranded');
    assert.equal(w.calls.indexOf('stripe:retrieve'), 0, 'Stripe is read before anything changes');
    const again = await finishOverdueEnding(account(), OPERATOR, 'twice', w.deps);
    assert.equal(again.outcome, 'refused', 'a second finish finds nothing waiting');
    assert.equal(w.suspensions.length, 1);
  });

  it('a finish that dies part-way is finished by finishing again — one of everything', async () => {
    const w = await overdueWorld(subscription({ status: 'canceled', ended_at: unix(RENEWAL) }));
    w.state.failAt = 'suspend';
    await finishOverdueEnding(account(), OPERATOR, 'first try', w.deps).catch(() => undefined);
    assert.equal(w.only().status, 'pending');
    const result = await finishOverdueEnding(account({ subscriptionId: null }), OPERATOR, 'second try', w.deps);
    assert.equal(result.outcome, 'finished');
    assert.equal(w.only().status, 'applied');
    assert.equal(w.suspensions.length, 1);
    assert.equal(w.events.size, 1);
    assert.equal(w.emails.size, 1);
  });

  it('never ends a club for an OLD subscription when it now pays on another', async () => {
    const w = await overdueWorld(subscription({ status: 'canceled', ended_at: unix(RENEWAL) }));
    const result = await finishOverdueEnding(account({ subscriptionId: 'sub_new' }), OPERATOR, 'x', w.deps);
    assert.equal(result.outcome, 'refused');
    assert.deepEqual(w.calls, [], 'nothing read, nothing touched');
    assert.equal(w.only().status, 'pending');
  });

  it('Stripe says it is still live with no cancel: the account is untouched and the waiting cancel is withdrawn (owner 2026-11-02)', async () => {
    const w = await overdueWorld(subscription({ status: 'active' }));
    const result = await finishOverdueEnding(account(), OPERATOR, 'Check', w.deps);
    assert.ok(result.outcome === 'live', JSON.stringify(result));
    assert.equal(result.status, 'active');
    assert.equal(result.nextDate, RENEWAL);
    assert.equal(result.cancelScheduled, false);
    assert.equal(result.record, 'withdrawn');
    assert.deepEqual(tornDown(w), [], 'the account is not ended');
    assert.equal(w.only().status, 'canceled');
    assert.equal(sent(w, 'kept').length, 1, 'the owner hears the plan renews, as from a Renew in the portal');
  });

  it('Stripe still live and set to end LATER: our record moves to Stripe’s date and is no longer overdue', async () => {
    const later = unix('2027-02-15T02:00:00Z');
    const w = await overdueWorld(subscription({ status: 'active', cancel_at_period_end: true, items: { data: [{ current_period_end: later }] } }));
    const result = await finishOverdueEnding(account(), OPERATOR, 'Check', w.deps);
    assert.ok(result.outcome === 'live' && result.record === 'rescheduled' && result.cancelScheduled);
    assert.equal(w.only().status, 'pending');
    assert.equal(w.only().effectiveAt, '2027-02-15T02:00:00.000Z');
    assert.equal(isOverdueEnding(w.only(), w.state.now), false);
    assert.deepEqual(tornDown(w), []);
  });

  it('Stripe still live on the same date our record holds: nothing changes, and the notice says so', async () => {
    const w = await overdueWorld(subscription({ status: 'past_due', cancel_at_period_end: true }));
    const result = await finishOverdueEnding(account(), OPERATOR, 'Check', w.deps);
    assert.ok(result.outcome === 'live' && result.record === 'unchanged');
    assert.equal(w.only().status, 'pending');
    assert.match(W.cancel.finish.live(RENEWAL, true, 'unchanged'), /Our record is wrong, not the account/);
  });

  it('refuses an ending that is not overdue yet, and a Stripe it cannot read — touching nothing', async () => {
    const early = world();
    await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, early.deps);
    early.state.now = at(RENEWAL, 1);
    assert.equal((await finishOverdueEnding(account(), OPERATOR, 'x', early.deps)).outcome, 'refused');
    const w = await overdueWorld(subscription({ status: 'canceled' }));
    w.state.stripeFails = 'stripe:retrieve';
    const result = await finishOverdueEnding(account(), OPERATOR, 'x', w.deps);
    assert.ok(result.outcome === 'refused' && result.status === 502);
    assert.equal(w.only().status, 'pending');
  });
});

describe('8e · the words and the wiring', () => {
  const facts = (over: Partial<EndingEmailFacts> = {}): EndingEmailFacts => ({
    kind: 'ends_on', move: null, portal: false, orgName: 'Riverside', plan: 'tournament_plus', planLabel: 'Tournament Plus', door: 'owner',
    clickedAt: NOW.toISOString(), date: RENEWAL, retentionUntil: retentionUntilFrom(RENEWAL, 90), tournaments: 3, trialing: false,
    remindLater: true, daysLeft: 7, renewsAs: null, price: '$39 CAD / month', keepUrl: 'https://x/billing?keep_plan=1', billingUrl: 'https://x/billing', ...over,
  });

  it('G4 · every email reads an evening-Eastern end on the page’s own day', () => {
    for (const kind of ['ends_on', 'reminder', 'kept'] as const) {
      for (const portal of [false, true]) {
        const out = endingEmail(facts({ kind, portal, ...(portal ? { plan: 'team' as const, planLabel: 'Premium' } : {}) }));
        assert.match(out.html, /January 14, 2027/, `${kind} ${portal}`);
        assert.doesNotMatch(out.html + out.subject, /January 15, 2027/, `${kind} ${portal}`);
      }
    }
  });

  it('the first sentence names the door; the button is Keep {Plan}; Premium for a Coaches Portal', () => {
    assert.match(endingEmail(facts({ door: 'operator' })).html, /We cancelled .* at your request\./);
    assert.match(endingEmail(facts({ door: 'stripe_portal' })).html, /in the billing portal on/);
    assert.match(endingEmail(facts()).html, />Keep Tournament Plus</);
    assert.match(endingEmail(facts({ portal: true, plan: 'team', planLabel: 'Premium' })).html, />Keep Premium</);
    assert.equal(endingEmail(facts({ portal: true, plan: 'team', planLabel: 'Premium' })).key, 'team_workspace_ends_on');
    assert.doesNotMatch(endingEmail(facts({ remindLater: false })).html, /remind you/);
    assert.match(endingEmail(facts({ kind: 'kept', renewsAs: 'Club' })).subject, /will renew as Club on January 14, 2027/);
    assert.doesNotMatch(endingEmail(facts({ orgName: '<b>x</b>' })).html, /<b>x<\/b>/, 'names are escaped');
  });

  it('a stored renewal date already past is no end date to promise (Part C, a)', () => {
    assert.equal(upcomingDate('2026-10-01T00:00:00Z', NOW), null);
    assert.equal(upcomingDate(RENEWAL, NOW), RENEWAL);
    assert.equal(upcomingDate(null, NOW), null);
  });

  it('the daily job carries both steps and never acts on an overdue ending by itself', () => {
    const job = readCode('app/api/platform-admin/stripe-fees-daily/route.ts');
    assert.match(job, /run\('plan_ending_emails', \(\) => sendEndingEmails\(now\)\)/);
    assert.match(job, /run\('overdue_endings', \(\) => countOverdueEndings\(now\)\)/);
    assert.doesNotMatch(job, /finishOverdueEnding|applyEnding/);
  });

  it('Finish this ending now’s two outcomes are the drawn notices (Stage 0 Tab 6, "After")', () => {
    assert.equal(W.cancel.finish.finished('Riverside', RENEWAL, 3, retentionUntilFrom(RENEWAL, 90), true),
      'Stripe ended this subscription on January 14, 2027. Riverside is suspended and its 3 tournaments are archived until April 14, 2027. The owner was emailed.');
    assert.match(W.cancel.finish.live(RENEWAL, false, 'withdrawn'), /^Stripe says this subscription is still live and renews January 14, 2027\. Nothing was cancelled there, so the waiting cancel is withdrawn here/);
  });

  it('Finish this ending now is billing staff only, asks why, and writes its audit row before the change', () => {
    const code = readCode('app/api/platform-admin/orgs/[id]/finish-ending/route.ts');
    assert.ok(code.indexOf("requirePlatformPower('club_billing')") < code.indexOf("'Reason is required'"));
    assert.ok(code.indexOf('writeAuditBeforeChange') < code.indexOf('finishOverdueEnding('));
  });

  it('a cancel that waits says its own dated payments words — never a downgrade’s "moving back up"', () => {
    assert.match(readCode('components/billing/BillingBody.tsx'), /ending=\{\{ kind: 'cancelOn', dateLong: moveDateLong\(endsOn\)/);
    assert.match(readCode('app/platform-admin/orgs/[id]/ClubRecord.tsx'), /LEAVING_WORDS\.operator\(pre\.onlinePayments\.outstanding, endsOn \? `on \$\{consoleDate\(endsOn\)\}` : 'now'\)/);
  });
});

// ── 8 · Stage 2: a move to the free plan waits for the renewal date ──────────────────────────────

describe('8 · a move to the free plan waits for the renewal date (Stage 2)', () => {
  const MOVE = { targetPlan: 'tournament' as const, keepTournamentIds: ['t-1'], reason: 'Smaller season' };
  const ended = (w: World, over: Record<string, unknown> = {}) =>
    ({ ...w.sub, status: 'canceled', ended_at: unix(RENEWAL), ...over }) as unknown as Stripe.Subscription;
  async function waitingMove(opts: Parameters<typeof world>[0] = {}) {
    const w = world(opts);
    const result = await scheduleDowngrade(account(), OWNER, MOVE, w.deps);
    assert.equal(result.outcome, 'scheduled');
    return w;
  }

  it('the click writes the waiting MOVE before Stripe hears anything, and takes nothing away (limits, status, tournaments)', async () => {
    const w = world();
    const result = await scheduleDowngrade(account(), OWNER, MOVE, w.deps);
    assert.equal(result.outcome, 'scheduled');
    assert.ok(w.calls.indexOf('db:insert') < w.calls.indexOf('stripe:schedule'), w.calls.join(' → '));
    assert.deepEqual(tornDown(w, ['plan', 'moveEvent']), [], 'nothing archived, no plan change, no suspension, no event');
    const row = w.only();
    assert.equal(row.intentType, 'downgrade');
    assert.equal(row.status, 'pending');
    assert.equal(row.targetPlan, 'tournament');
    assert.deepEqual(row.keepTournamentIds, ['t-1']);
    assert.equal(row.effectiveAt, RENEWAL, 'it waits for the renewal date');
    assert.equal(row.retentionUntil, retentionUntilFrom(RENEWAL, 90), 'ruling 2: the data clock starts on the END date');
    assert.equal(row.stripeSubscriptionId, 'sub_1');
    assert.equal(w.sub.cancel_at_period_end, true);
    assert.deepEqual([...w.live].sort(), ['t-1', 't-2'], 'the kept and the unkept both survive to the date');
  });

  it('when Stripe refuses, the row is withdrawn — nothing waits, nothing changed', async () => {
    const w = world();
    w.state.stripeFails = 'stripe:schedule';
    const result = await scheduleDowngrade(account(), OWNER, MOVE, w.deps);
    assert.equal(result.outcome, 'refused');
    assert.equal(w.pending(), null);
    assert.equal(w.only().status, 'canceled');
  });

  it('a Stripe timeout that hid a success is asked about, and the move stays scheduled', async () => {
    const w = world();
    w.state.stripeLies = true;
    const result = await scheduleDowngrade(account(), OWNER, MOVE, w.deps);
    assert.equal(result.outcome, 'scheduled');
    assert.equal(w.pending()?.intentType, 'downgrade');
  });

  it('ruling 3 · no live paid period (a dev mock, comped, nothing to bill): the move happens now — never a null check', async () => {
    for (const a of [account({ subscriptionId: 'mock_1' }), account({ subscriptionId: null }), account({ subscriptionStatus: 'canceled' })]) {
      const w = world();
      const result = await scheduleDowngrade(a, OWNER, MOVE, w.deps);
      assert.equal(result.outcome, 'moved');
      assert.ok(!w.calls.includes('stripe:schedule'));
      assert.deepEqual(tornDown(w, ['plan', 'moveEvent']), ['records:insert', 'archive', 'plan', 'moveEvent', 'payPages'], 'records BEFORE the archive (G11)');
      assert.deepEqual([...w.archived], ['t-2']);
      assert.deepEqual(w.plans, ['tournament']);
      assert.equal(w.suspensions.length, 0, 'a move is never a suspension');
      assert.equal(w.only().status, 'applied');
    }
  });

  it('one waiting change at a time: a move while a cancel waits, or a second move, is refused in plain words', async () => {
    const w = world();
    await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps);
    const overCancel = await scheduleDowngrade(account(), OWNER, MOVE, w.deps);
    assert.equal(overCancel.outcome, 'refused');
    assert.match(overCancel.outcome === 'refused' ? overCancel.error : '', /^Your plan ends on January 14, 2027\. Keep Tournament Plus first/);

    const m = await waitingMove();
    const second = await scheduleDowngrade(account(), OWNER, MOVE, m.deps);
    assert.equal(second.outcome, 'refused');
    assert.match(second.outcome === 'refused' ? second.error : '', /^Your plan moves to Tournament on January 14, 2027\. Keep Tournament Plus first/);
  });

  it('a cheaper move waiting in Stripe is CARRIED (released, held on the row) and Keep puts it back; a foreign schedule refuses', async () => {
    const w = world({ sub: subscription({ schedule: moveSchedule('league') }), account: account({ ownPlan: 'club' }) });
    const result = await scheduleDowngrade(account({ ownPlan: 'club' }), OWNER, MOVE, w.deps);
    assert.equal(result.outcome, 'scheduled');
    assert.ok(w.calls.indexOf('db:insert') < w.calls.indexOf('stripe:release'));
    assert.equal(w.pending()?.heldMovePlan, 'league');
    const kept = await keepEnding(account({ ownPlan: 'club' }), OWNER, w.deps);
    assert.equal(kept.outcome === 'kept' && kept.renewsAs, 'league');

    const f = world({ sub: subscription({ schedule: 'sched_foreign' }) });
    const refused = await scheduleDowngrade(account(), OWNER, MOVE, f.deps);
    assert.equal(refused.outcome, 'refused');
    assert.equal(f.intents.size, 0, 'nothing written');
  });

  it('an `updated` storm on a scheduled move writes NO cancellation and keeps ONE downgrade row', async () => {
    const w = await waitingMove();
    for (let i = 0; i < 4; i += 1) assert.equal(await recordStripeSignal(account(), w.sub, w.deps), 'unchanged');
    assert.equal(w.intents.size, 1);
    assert.equal(w.only().intentType, 'downgrade');
    // Stripe moving the date moves the row and its data clock.
    const later = '2027-02-15T02:00:00.000Z';
    assert.equal(await recordStripeSignal(account(), { ...w.sub, cancel_at: unix(later) } as Stripe.Subscription, w.deps), 'rescheduled');
    assert.equal(w.only().effectiveAt, later);
    assert.equal(w.only().retentionUntil, retentionUntilFrom(later, 90));
  });

  it('Renew in Stripe’s portal withdraws the move — but not while our own click is still between the row and Stripe', async () => {
    const w = await waitingMove();
    const renewed = { ...w.sub, cancel_at_period_end: false, cancel_at: null } as Stripe.Subscription;
    assert.equal(await recordStripeSignal(account(), renewed, w.deps), 'unchanged', 'minutes after the click: the click is mid-way');
    w.state.now = new Date(NOW.getTime() + 60 * 60_000);
    assert.equal(await recordStripeSignal(account(), renewed, w.deps), 'withdrawn');
    assert.equal(w.pending(), null);
    assert.equal(w.mail.filter(m => m.kind === 'kept').length, 1);
    assert.equal(keepInProgress(w.only(), w.state.now), false);
  });

  it('the `deleted` arm MOVES the club (plan → free, the unpicked archived with records) and NEVER suspends', async () => {
    const w = await waitingMove();
    const result = await endingForDeletedSubscription(account(), ended(w), w.deps);
    assert.equal(result.kind, 'moved');
    assert.equal(w.suspensions.length, 0);
    assert.deepEqual(w.plans, ['tournament']);
    assert.deepEqual([...w.live], ['t-1'], 'the kept tournament survives the date');
    assert.deepEqual(w.records.map(r => [r.recordId, r.metadata.retentionReason]), [['t-2', 'plan_downgrade']]);
    assert.equal(w.records[0].retentionUntil, retentionUntilFrom(RENEWAL, 90));
    assert.deepEqual(w.payPages, ['owner downgrade'], 'pay pages close only if the free plan has no online payments');
    assert.equal(w.moveEvents.size, 1);
    assert.equal(w.events.size, 0, 'no subscription_canceled: nobody churned');
    const row = w.only();
    assert.equal(row.status, 'applied');
    assert.equal(w.calls.at(-1), 'db:flip', 'the flip is LAST');
  });

  it('G2 · a tournament made during the wait is archived with restore records on the date', async () => {
    const w = await waitingMove();
    w.live.add('t-new');
    w.created.set('t-new', '2026-12-01T00:00:00.000Z');
    await endingForDeletedSubscription(account(), ended(w), w.deps);
    assert.deepEqual([...w.live], ['t-1']);
    assert.deepEqual(w.records.map(r => r.recordId).sort(), ['t-2', 't-new']);
  });

  it('Ask 8 · the kept one gone by the date → the NEWEST slot holder is kept, said on the record', async () => {
    const w = await waitingMove();
    w.live.delete('t-1'); // deleted during the wait
    w.live.add('t-new');
    w.created.set('t-new', '2026-12-01T00:00:00.000Z');
    const result = await endingForDeletedSubscription(account(), ended(w), w.deps);
    assert.equal(result.kind === 'moved' && result.result.keptByDefault, true);
    assert.deepEqual([...w.live], ['t-new']);
    assert.match(w.only().changeLog.at(-1)?.note ?? '', /the newest, t-new, was kept/);
  });

  it('a replayed `deleted` leaves one of everything (the applied move is THIS subscription’s)', async () => {
    const w = await waitingMove();
    await endingForDeletedSubscription(account(), ended(w), w.deps);
    const again = await endingForDeletedSubscription(account({ ownPlan: 'tournament' }), ended(w), w.deps);
    assert.deepEqual(again, { kind: 'already', intentType: 'downgrade' });
    assert.equal(w.records.length, 1);
    assert.equal(w.moveEvents.size, 1);
    assert.deepEqual(w.plans, ['tournament']);
    assert.equal(w.suspensions.length, 0);
  });

  for (const crashAt of ['records:insert', 'archive', 'plan', 'moveEvent', 'payPages', 'db:flip']) {
    it(`G7 · a crash at ${crashAt}, then Stripe's resend: one of everything, and the row applied`, async () => {
      const w = await waitingMove();
      w.live.add('t-new');
      w.state.failAt = crashAt;
      await assert.rejects(endingForDeletedSubscription(account(), ended(w), w.deps));
      await endingForDeletedSubscription(account(), ended(w), w.deps);
      assert.deepEqual(w.records.map(r => r.recordId).sort(), ['t-2', 't-new']);
      assert.deepEqual([...w.live], ['t-1']);
      assert.equal(w.moveEvents.size, 1);
      assert.equal(w.only().status, 'applied');
      assert.equal(w.suspensions.length, 0);
    });
  }

  it('Keep withdraws the move and clears Stripe; the plan renews as it is', async () => {
    const w = await waitingMove();
    const kept = await keepEnding(account(), OWNER, w.deps);
    assert.equal(kept.outcome, 'kept');
    assert.ok(w.calls.includes('stripe:clear:period_end'));
    assert.equal(w.sub.cancel_at_period_end, false);
    assert.equal(w.only().status, 'canceled');
    assert.equal(w.plans.length, 0);
  });

  it('ruling 4 · Cancel REPLACES a waiting move, and Keep afterwards returns the FULL plan — not the move', async () => {
    const w = await waitingMove();
    const cancel = await scheduleEnding(account(), OWNER, { reason: 'Closing down', notifyOwner: true }, w.deps);
    assert.equal(cancel.outcome, 'scheduled');
    const rows = [...w.intents.values()];
    assert.equal(rows.find(r => r.intentType === 'downgrade')?.status, 'canceled');
    assert.match(rows.find(r => r.intentType === 'downgrade')?.changeLog.at(-1)?.note ?? '', /Replaced by a cancel/);
    assert.equal(w.pending()?.intentType, 'cancellation');
    const kept = await keepEnding(account(), OWNER, w.deps);
    assert.equal(kept.outcome, 'kept');
    assert.equal(w.pending(), null, 'nothing waits: the move does not come back');
    assert.equal(w.sub.cancel_at_period_end, false);
  });

  it('ruling 4 · a cancel replacing a move that carried a cheaper move carries it on (Keep restores it)', async () => {
    const w = world({ sub: subscription({ schedule: moveSchedule('league') }) });
    await scheduleDowngrade(account({ ownPlan: 'club' }), OWNER, MOVE, w.deps);
    await scheduleEnding(account({ ownPlan: 'club' }), OWNER, { reason: null, notifyOwner: true }, w.deps);
    assert.equal(w.pending()?.heldMovePlan, 'league');
  });

  it('End now over a waiting move replaces it and ends (the operator’s door, leftover c)', async () => {
    const w = await waitingMove();
    await applyEnding(account(), { actor: OPERATOR, reason: 'Fraud', notifyOwner: false, origin: 'request' }, w.deps);
    const rows = [...w.intents.values()];
    assert.equal(rows.find(r => r.intentType === 'downgrade')?.status, 'canceled');
    assert.equal(rows.find(r => r.intentType === 'cancellation')?.status, 'applied');
    assert.equal(w.suspensions.length, 1);
  });

  it('ruling 6 · Finish this ending now on an overdue MOVE: Stripe ended → the move (clock from the date); still live → the record agrees', async () => {
    const w = await waitingMove();
    w.state.now = new Date(new Date(RENEWAL).getTime() + 5 * 86_400_000);
    w.sub = ended(w, { ended_at: null, canceled_at: null });
    const done = await finishOverdueEnding(account(), OPERATOR, 'Webhook missed', w.deps);
    assert.equal(done.outcome === 'finished' && done.moved, true);
    assert.equal(w.suspensions.length, 0);
    assert.equal(w.only().retentionUntil, retentionUntilFrom(RENEWAL, 90), 'from the day it should have moved');

    const l = await waitingMove();
    l.state.now = new Date(new Date(RENEWAL).getTime() + 5 * 86_400_000);
    l.sub = { ...l.sub, cancel_at_period_end: false, cancel_at: null } as Stripe.Subscription;
    const live = await finishOverdueEnding(account(), OPERATOR, 'Webhook missed', l.deps);
    assert.equal(live.outcome === 'live' && live.record, 'withdrawn');
    assert.equal(l.plans.length, 0);
  });

  it('the daily email step sends a waiting move its own reminder — the move’s, never a cancel’s (Part C)', async () => {
    const w = await waitingMove();
    w.state.now = new Date(new Date(RENEWAL).getTime() - 3 * 86_400_000);
    const tally = await sendDueEndingEmails([w.only()], async () => account(), w.deps);
    assert.deepEqual(tally, { endsOn: 0, reminders: 1, failed: 0 });
    assert.deepEqual(w.mail.map(m => [m.kind, m.email.intent.intentType]), [['ends_on', 'downgrade'], ['reminder', 'downgrade']]);
  });

  it('keptOnTheDate: the pick as far as it lives, capped at the limit; nothing left → the newest', () => {
    const t = (id: string, createdAt: string): SlotHolder => ({ id, name: id, slug: id, status: 'draft', year: 2026, startDate: null, endDate: null, createdAt });
    const holders = [t('a', '2026-01-01'), t('b', '2026-03-01'), t('c', '2026-02-01')];
    assert.deepEqual(keptOnTheDate(holders, ['c'], 1).kept.map(x => x.id), ['c']);
    assert.deepEqual(keptOnTheDate(holders, ['c'], 1).archive.map(x => x.id), ['a', 'b']);
    assert.deepEqual(keptOnTheDate(holders, ['gone'], 1), { kept: [holders[1]], archive: [holders[0], holders[2]], fellBack: true });
    assert.deepEqual(keptOnTheDate([], ['gone'], 1), { kept: [], archive: [], fellBack: false });
  });

  it('/review · an immediate move that died part-way is FINISHED by the owner’s retry, never refused', async () => {
    const w = world();
    w.state.failAt = 'archive';
    await assert.rejects(scheduleDowngrade(account({ subscriptionId: 'mock_1' }), OWNER, MOVE, w.deps));
    assert.equal(w.pending()?.intentType, 'downgrade');
    const retry = await scheduleDowngrade(account({ subscriptionId: 'mock_1' }), OWNER, MOVE, w.deps);
    assert.equal(retry.outcome, 'moved');
    assert.equal(w.only().status, 'applied');
    assert.deepEqual([...w.live], ['t-1']);
    assert.equal(w.records.length, 1);
  });

  it('/review · a cancel Stripe holds that our record has not caught up with is refused — never turned into a move unseen', async () => {
    const w = world({ sub: subscription({ cancel_at_period_end: true }) });
    const result = await scheduleDowngrade(account(), OWNER, MOVE, w.deps);
    assert.equal(result.outcome, 'refused');
    assert.match(result.outcome === 'refused' ? result.error : '', /^Your plan ends on January 14, 2027\. Keep Tournament Plus first/);
    assert.equal(w.intents.size, 0);
  });

  it('/review · Stripe’s answer AND the re-read both lost: the row stays (a flag with no row would suspend the club)', async () => {
    const w = world();
    let reads = 0;
    const retrieve = w.deps.retrieveSubscription;
    w.deps.retrieveSubscription = async id => { reads += 1; if (reads > 1) throw new Error('Stripe unreachable'); return retrieve(id); };
    w.state.stripeLies = true;
    const result = await scheduleDowngrade(account(), OWNER, MOVE, w.deps);
    assert.equal(result.outcome, 'scheduled');
    assert.equal(w.pending()?.intentType, 'downgrade');
  });

  it('/review · Keep in another tab mid-click: the row is gone, so Stripe’s flag is cleared again and the click is refused', async () => {
    const w = world();
    const schedule = w.deps.scheduleCancel;
    w.deps.scheduleCancel = async id => {
      const row = w.pending()!;
      w.intents.set(row.id, { ...row, status: 'canceled' }); // the other tab's Keep landed first
      return schedule(id);
    };
    const result = await scheduleDowngrade(account(), OWNER, MOVE, w.deps);
    assert.equal(result.outcome, 'refused');
    assert.ok(w.calls.includes('stripe:clear:period_end'), w.calls.join(' → '));
    assert.equal(w.sub.cancel_at_period_end, false, 'no flag left with nothing to say it is a move');
  });

  it('/review · a cancel that could not replace the waiting move says so — it is never "scheduled" over a move', async () => {
    const w = await waitingMove();
    w.state.failAt = 'db:update';
    const result = await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, w.deps);
    assert.equal(result.outcome, 'refused');
    assert.equal(result.outcome === 'refused' ? result.error : '', W.cancel.moveStillWaiting);
    assert.equal(w.pending()?.intentType, 'downgrade', 'the move still waits, honestly');
  });

  it('/review · the date’s note says WHY the newest was kept: nothing picked, or the pick no longer holds a slot', async () => {
    const none = world({ tournaments: [] });
    await scheduleDowngrade(account(), OWNER, { ...MOVE, keepTournamentIds: [] }, none.deps);
    none.live.add('t-new');
    await endingForDeletedSubscription(account(), ended(none), none.deps);
    assert.deepEqual([...none.live], ['t-new'], 'no choice by the date → the newest is kept (Ask 8)');
    assert.match(none.only().changeLog.at(-1)?.note ?? '', /^No tournament was picked to keep, so the newest, t-new, was kept\.$/);

    const finished = await waitingMove();
    finished.live.delete('t-1'); // the pick finished: it stays online and holds no slot
    await endingForDeletedSubscription(account(), ended(finished), finished.deps);
    assert.match(finished.only().changeLog.at(-1)?.note ?? '', /no longer holds a slot \(finished, archived or deleted\), so the newest, t-2, was kept/);
  });

  it('/review · Finish this ending now on a move says the club MOVED and is not suspended', () => {
    assert.equal(W.cancel.finish.moved('Riverside', 'Tournament', RENEWAL, 2, retentionUntilFrom(RENEWAL, 90)),
      'Stripe ended this subscription on January 14, 2027, so Riverside moved to Tournament as it chose. It is not suspended. 2 tournaments it did not keep are archived until April 14, 2027.');
    assert.match(readCode('app/api/platform-admin/orgs/[id]/finish-ending/route.ts'), /result\.moved\s*\?\s*W\.cancel\.finish\.moved\(/);
  });

  it('the one rule, per action, with a move to the free plan waiting', () => {
    const move = { ownPlan: 'tournament_plus' as const, ...waitingState({ intentType: 'downgrade', targetPlan: 'tournament', effectiveAt: RENEWAL }) };
    assert.deepEqual(futureMoveAnswer('schedule_cancel', move), { answer: 'replace' });
    assert.equal(futureMoveAnswer('downgrade', move).answer, 'refuse');
    assert.equal(futureMoveAnswer('plan_move', move).answer, 'refuse');
    assert.equal(futureMoveAnswer('operator_plan_change', move).answer, 'refuse');
    assert.match((futureMoveAnswer('plan_move', move) as { reason: string }).reason, /^Your plan moves to Tournament on January 14, 2027\. Keep Tournament Plus first, then change it\.$/);
    assert.deepEqual(futureMoveAnswer('reactivation', move), { answer: 'withdraw' });
    assert.deepEqual(futureMoveAnswer('replace_subscription', move), { answer: 'withdraw' });
    // Nothing waiting: a move to free carries a cheaper move, and refuses a schedule that isn't ours.
    assert.deepEqual(futureMoveAnswer('downgrade', { ownPlan: 'club', waitingMove: { plan: 'league' } }), { answer: 'carry', plan: 'league' });
    assert.equal(futureMoveAnswer('downgrade', { ownPlan: 'club', waitingMove: 'foreign' }).answer, 'refuse');
    assert.deepEqual(futureMoveAnswer('downgrade', { ownPlan: 'club' }), { answer: 'none' });
  });

  it('the confirm route: the old immediate paid branch is closed for EVERY account; a move to free goes through scheduleDowngrade', () => {
    const code = readCode('app/api/billing/downgrade/confirm/route.ts');
    // /review 2026-11-03: without a paying subscription the paid branch handed out a cheaper paid plan unbilled.
    assert.match(code, /if \(targetPlan !== 'tournament'\) return Response\.json\(\{ error: W\.downgrade\.useTheMove/);
    // A Coaches Portal and a cancelled account are refused before anything is read or written.
    assert.ok(code.indexOf('account.isCoachesPortal') < code.indexOf('scheduleDowngrade('));
    assert.ok(code.indexOf("account.subscriptionStatus === 'canceled'") < code.indexOf('scheduleDowngrade('));
    assert.match(code, /scheduleDowngrade\(account,/);
    assert.doesNotMatch(code, /create_prorations|subscriptions\.update|\.from\('tournaments'\)/, 'no immediate price swap, no archive of its own');
  });
});

// Plans end at the renewal date, Stage 2 Part B (screens): the band's view of a waiting move and Change which you keep (G2).
describe('9 · a waiting move: the band and Change which tournament you keep (Stage 2 Part B)', () => {
  const MOVE = { targetPlan: 'tournament' as const, keepTournamentIds: ['t-1'], reason: null };
  async function waitingMove(tournaments = ['t-1', 't-2']) {
    const w = world({ tournaments });
    const result = await scheduleDowngrade(account(), OWNER, MOVE, w.deps);
    assert.equal(result.outcome, 'scheduled');
    return w;
  }
  const holdersOf = (w: World) => w.deps.slotHolders('org-1');

  it('the band says what the DATE would do — the same rule, so it can never name another tournament', async () => {
    const w = await waitingMove();
    const view = waitingMoveView(w.only(), await holdersOf(w));
    const onTheDate = keptOnTheDate(await holdersOf(w), w.only().keepTournamentIds, 1);
    assert.deepEqual(view.kept.map(t => t.id), onTheDate.kept.map(t => t.id));
    assert.deepEqual(view.kept.map(t => t.id), ['t-1']);
    assert.deepEqual(view.archived.map(t => t.id), ['t-2']);
    assert.equal(view.fellBack, false);
    assert.equal(view.choose, true, 'two slot holders, the free plan holds one: there is a choice');
    assert.equal(view.targetPlan, 'tournament');
    assert.equal(view.since, clickedAt(w.only()), 'the click: a tournament made after it reads "added {date}"');
  });

  it('a tournament made during the wait is in the band as archived — and choosable', async () => {
    const w = await waitingMove();
    w.live.add('t-new');
    w.created.set('t-new', '2026-12-01T00:00:00.000Z');
    const view = waitingMoveView(w.only(), await holdersOf(w));
    assert.deepEqual(view.archived.map(t => t.id).sort(), ['t-2', 't-new']);
    const saved = await changeKeptTournaments(account(), OWNER, ['t-new'], w.deps);
    assert.deepEqual(saved, { outcome: 'saved', keepIds: ['t-new'] });
    assert.deepEqual(w.only().keepTournamentIds, ['t-new']);
    assert.equal(w.only().status, 'pending', 'the move still waits');
    assert.equal(w.only().changeLog.at(-1)?.action, 'pick_changed');
  });

  it('the kept one gone: the band falls back to the newest, and asks again only when there is a choice', async () => {
    const w = await waitingMove(['t-1', 't-2', 't-3']);
    w.live.delete('t-1');
    const gone = waitingMoveView(w.only(), await holdersOf(w));
    assert.equal(gone.fellBack, true);
    assert.equal(gone.choose, true);
    assert.deepEqual(gone.kept.map(t => t.id), ['t-3'], 'the newest (Stage 0 Ask 8)');
    w.live.delete('t-2');
    const one = waitingMoveView(w.only(), await holdersOf(w));
    assert.equal(one.choose, false, 'one left: it is simply kept — no amber ask, no door');
    assert.deepEqual(one.kept.map(t => t.id), ['t-3']);
  });

  it('changing the pick touches nothing else: no Stripe call, no archive, no plan change', async () => {
    const w = await waitingMove();
    const before = w.calls.length;
    await changeKeptTournaments(account(), OWNER, ['t-2'], w.deps);
    const after = w.calls.slice(before);
    assert.ok(after.every(c => c === 'slotHolders' || c === 'db:update'), after.join(' → '));
    assert.deepEqual([...w.live].sort(), ['t-1', 't-2']);
    assert.equal(w.sub.cancel_at_period_end, true);
  });

  it('refuses in plain words: nothing waiting, a cancel waiting, nothing to choose, the wrong count, a gone tournament', async () => {
    const none = world();
    assert.deepEqual(await changeKeptTournaments(account(), OWNER, ['t-1'], none.deps), { outcome: 'refused', error: W.downgrade.noMoveWaiting, status: 409 });
    const cancelling = world();
    await scheduleEnding(account(), OWNER, { reason: null, notifyOwner: true }, cancelling.deps);
    assert.deepEqual(await changeKeptTournaments(account(), OWNER, ['t-1'], cancelling.deps), { outcome: 'refused', error: W.downgrade.noMoveWaiting, status: 409 });
    const single = await waitingMove(['t-1']);
    assert.deepEqual(await changeKeptTournaments(account(), OWNER, ['t-1'], single.deps), { outcome: 'refused', error: W.downgrade.nothingToChoose, status: 409 });
    const w = await waitingMove();
    assert.deepEqual(await changeKeptTournaments(account(), OWNER, ['t-1', 't-2'], w.deps), { outcome: 'refused', error: W.downgrade.chooseCount(1), status: 400 });
    assert.deepEqual(await changeKeptTournaments(account(), OWNER, ['t-gone'], w.deps), { outcome: 'refused', error: W.downgrade.pickGone, status: 409 });
    assert.deepEqual(w.only().keepTournamentIds, ['t-1'], 'a refusal changes nothing');
  });

  it('a pick saved over a row Keep withdrew a moment before is refused, never written', async () => {
    const w = await waitingMove();
    const row = w.only();
    const deps: EndingDeps = { ...w.deps, findPending: async () => row }; // read before Keep landed
    w.intents.set(row.id, { ...row, status: 'canceled' });
    assert.deepEqual(await changeKeptTournaments(account(), OWNER, ['t-2'], deps), { outcome: 'refused', error: W.downgrade.changedMeanwhile, status: 409 });
    assert.deepEqual(w.only().keepTournamentIds, ['t-1']);
  });

  it('/review · the choice closes on the date: the move may already be running, so a pick then is refused, not "saved" and lost', async () => {
    const w = await waitingMove();
    w.state.now = new Date(RENEWAL);
    assert.deepEqual(await changeKeptTournaments(account(), OWNER, ['t-2'], w.deps), { outcome: 'refused', error: W.downgrade.pickTooLate, status: 409 });
    w.state.now = new Date(new Date(RENEWAL).getTime() + 5 * 86_400_000);
    assert.equal((await changeKeptTournaments(account(), OWNER, ['t-2'], w.deps)).outcome, 'refused', 'overdue too');
    assert.deepEqual(w.only().keepTournamentIds, ['t-1']);
  });

  it('a changed pick does not reset the click’s 15-minute window (a late Stripe event of the click is still ours)', async () => {
    const w = await waitingMove();
    await changeKeptTournaments(account(), OWNER, ['t-2'], w.deps);
    assert.equal(keepInProgress(w.only(), NOW), true, 'the click’s "scheduled" is still the entry that counts');
    assert.equal(keepInProgress(w.only(), new Date(NOW.getTime() + 16 * 60_000)), false);
  });

  it('the date keeps the CHANGED pick, and moves — never suspends', async () => {
    const w = await waitingMove();
    await changeKeptTournaments(account(), OWNER, ['t-2'], w.deps);
    const result = await endingForDeletedSubscription(account(), { ...w.sub, status: 'canceled', ended_at: unix(RENEWAL) } as unknown as Stripe.Subscription, w.deps);
    assert.equal(result.kind, 'moved');
    assert.deepEqual([...w.live], ['t-2']);
    assert.deepEqual([...w.archived], ['t-1']);
    assert.equal(w.suspensions.length, 0);
  });

  it('the wiring: the pick route is owner-only, live accounts only, and goes through the one function', () => {
    const code = readCode('app/api/billing/downgrade/pick/route.ts');
    assert.match(code, /ctx\.role !== 'owner'\) return forbidden\(\)/);
    assert.doesNotMatch(code, /allowSuspendedOrg/);
    assert.match(code, /changeKeptTournaments\(\{ orgId: ctx\.org\.id \},/);
    assert.doesNotMatch(code, /\.from\('billing_retention_intents'\)|getStripe/, 'no write of its own, no Stripe');
    const review = readCode('app/api/billing/cancel/preflight/route.ts');
    assert.match(review, /waitingMoveView\(pending, await getSlotHoldingTournaments/);
    assert.match(review, /kind: 'downgrade', move: waitingMoveView/);
    // /billing 2026-11-04: our waiting row alone refuses a move (a click whose Stripe answer was lost has no flag yet).
    const move = readCode('lib/plan-move.ts');
    assert.match(move, /const waiting = await readPendingEnding\(org\.id\)[^\n]*\n\s*if \(ending\.scheduled \|\| waiting\) \{/);
    const downgradeReview = readCode('app/api/billing/downgrade/preflight/route.ts');
    assert.match(downgradeReview, /waitingDate\(account, ctx\.org\.currentPeriodEnd, new Date\(\)\)/);
  });
});

// ── 10 · Stage 2 Part C: a move's emails, the log as an append, the operator's plan change ───────

describe('10 · a move’s emails, the log as an append, the operator’s plan change (Stage 2 Part C)', () => {
  const MOVE = { targetPlan: 'tournament' as const, keepTournamentIds: ['t-1'], reason: 'Smaller season' };
  const ended = (w: World) => ({ ...w.sub, status: 'canceled', ended_at: unix(RENEWAL) }) as unknown as Stripe.Subscription;
  const mailed = (w: World, kind: string) => w.mail.filter(m => m.kind === kind);

  it('ruling 5 · the click sends "scheduled for {date}" once, only after Stripe holds it; a refused click sends nothing', async () => {
    const w = world();
    await scheduleDowngrade(account(), OWNER, MOVE, w.deps);
    assert.deepEqual(w.mail.map(m => [m.kind, m.email.intent.intentType]), [['ends_on', 'downgrade']]);
    assert.ok(w.calls.indexOf('stripe:schedule') < w.calls.indexOf('claim:ends_on'), w.calls.join(' → '));
    for (let i = 0; i < 3; i += 1) await recordStripeSignal(account(), w.sub, w.deps);
    assert.equal(w.mail.length, 1, 'an updated storm sends no second');

    const refused = world();
    refused.state.stripeFails = 'stripe:schedule';
    assert.equal((await scheduleDowngrade(account(), OWNER, MOVE, refused.deps)).outcome, 'refused');
    assert.equal(refused.mail.length, 0);
  });

  it('a "scheduled" email that failed is caught up by the daily job, once', async () => {
    const w = world();
    w.state.mailFails = true;
    await scheduleDowngrade(account(), OWNER, MOVE, w.deps);
    assert.equal(w.only().endsOnEmailSentAt, null, 'a definite refusal hands the claim back');
    w.state.mailFails = false;
    assert.equal((await sendDueEndingEmails([w.only()], async () => account(), w.deps)).endsOn, 1);
    await sendDueEndingEmails([w.only()], async () => account(), w.deps);
    assert.equal(mailed(w, 'ends_on').length, 1);
  });

  it('the seven-day reminder goes once for a move; never for one made with under seven days left', async () => {
    const w = world();
    await scheduleDowngrade(account(), OWNER, MOVE, w.deps);
    w.state.now = at(RENEWAL, -6);
    assert.equal((await sendDueEndingEmails([w.only()], async () => account(), w.deps)).reminders, 1);
    await sendDueEndingEmails([w.only()], async () => account(), w.deps);
    assert.equal(mailed(w, 'reminder').length, 1);

    const soon = at(NOW.toISOString(), 3).toISOString();
    const late = world({ sub: subscription({ items: { data: [{ current_period_end: unix(soon) }] } }) });
    await scheduleDowngrade(account(), OWNER, MOVE, late.deps);
    late.state.now = at(NOW.toISOString(), 1);
    assert.equal((await sendDueEndingEmails([late.only()], async () => account(), late.deps)).reminders, 0);
  });

  it('no paid period: the move happens at the click and sends ONLY "now on" (never "scheduled")', async () => {
    const w = world();
    const result = await scheduleDowngrade(account({ subscriptionId: 'mock_1' }), OWNER, MOVE, w.deps);
    assert.ok(result.outcome === 'moved' && result.moved.emailed);
    assert.deepEqual(w.mail.map(m => m.kind), ['moved']);
  });

  it('the date sends "now on" once, from the move itself — a crash after it and a replayed deletion send nothing twice', async () => {
    const w = world();
    await scheduleDowngrade(account(), OWNER, MOVE, w.deps);
    w.state.failAt = 'db:flip';
    await assert.rejects(endingForDeletedSubscription(account(), ended(w), w.deps));
    assert.equal(mailed(w, 'moved').length, 1);
    assert.ok(w.calls.indexOf('claim:moved') < w.calls.lastIndexOf('db:flip'), 'claimed while the row still waits');
    assert.equal((await endingForDeletedSubscription(account(), ended(w), w.deps)).kind, 'moved');
    await endingForDeletedSubscription(account(), ended(w), w.deps);
    assert.equal(mailed(w, 'moved').length, 1);
    assert.equal(w.only().status, 'applied');
    const email = mailed(w, 'moved')[0].email;
    assert.ok(email.kind === 'moved');
    assert.deepEqual([email.kept, email.archived, email.movedAt], [['t-1'], ['t-2'], new Date(RENEWAL).toISOString()]);
  });

  it('/review · a crash after the archive: the replay’s "now on" email still names what this move archived', async () => {
    const w = world();
    await scheduleDowngrade(account(), OWNER, MOVE, w.deps);
    w.state.failAt = 'plan';
    await assert.rejects(endingForDeletedSubscription(account(), ended(w), w.deps));
    assert.deepEqual([...w.archived], ['t-2']);
    assert.equal(mailed(w, 'moved').length, 0);
    await endingForDeletedSubscription(account(), ended(w), w.deps);
    const email = mailed(w, 'moved')[0].email;
    assert.ok(email.kind === 'moved');
    assert.deepEqual([email.kept, email.archived], [['t-1'], ['t-2']], 't-2 is no slot holder any more, but this move archived it');
  });

  it('ruling 6 · Finish this ending now on an overdue move tells the owner, with the clock from the date', async () => {
    const w = world();
    await scheduleDowngrade(account(), OWNER, MOVE, w.deps);
    w.state.now = at(RENEWAL, OVERDUE_GRACE_DAYS + 2);
    w.sub = { ...w.sub, status: 'canceled', ended_at: null, canceled_at: null } as Stripe.Subscription;
    const done = await finishOverdueEnding(account(), OPERATOR, 'Webhook missed', w.deps);
    assert.ok(done.outcome === 'finished' && done.moved && done.emailed);
    const email = mailed(w, 'moved')[0].email;
    assert.ok(email.kind === 'moved' && email.movedAt === RENEWAL && email.retentionUntil === retentionUntilFrom(RENEWAL, 90));
  });

  it('Keep over a move sends the kept email once, on the move’s row', async () => {
    const w = world();
    await scheduleDowngrade(account(), OWNER, MOVE, w.deps);
    assert.equal((await keepEnding(account(), OWNER, w.deps)).outcome, 'kept');
    assert.deepEqual(mailed(w, 'kept').map(m => m.email.intent.intentType), ['downgrade']);
  });

  describe('the words', () => {
    const facts = (over: Partial<EndingEmailFacts> = {}): EndingEmailFacts => ({
      kind: 'ends_on', move: { target: 'Tournament', kept: ['Spring Classic'], archived: ['Fall Cup'], fellBack: false, picked: true, choose: true },
      portal: false, orgName: 'Riverside', plan: 'tournament_plus', planLabel: 'Tournament Plus', door: 'owner', clickedAt: NOW.toISOString(), date: RENEWAL,
      retentionUntil: retentionUntilFrom(RENEWAL, 90), tournaments: 0, trialing: false, remindLater: true, daysLeft: 7, renewsAs: null,
      price: '$39 CAD / month', keepUrl: 'https://x/billing?keep_plan=1', billingUrl: 'https://x/billing', ...over,
    });

    it('a move’s keys (owner 2026-11-04), and the page’s own day in every one (G4)', () => {
      const keys = { ends_on: 'plan_downgrade_scheduled', reminder: 'plan_downgrade_reminder', moved: 'plan_downgraded', kept: 'plan_kept' } as const;
      for (const [kind, key] of Object.entries(keys) as Array<[keyof typeof keys, string]>) {
        const out = endingEmail(facts({ kind }));
        assert.equal(out.key, key, kind);
        assert.match(out.html, /January 14, 2027/, kind);
        assert.doesNotMatch(out.html + out.subject, /January 15, 2027/, kind);
      }
      assert.equal(endingEmail(facts({ move: null })).key, 'plan_ends_on', 'a cancel keeps its own');
    });

    it('scheduled: the date, what is kept, what is archived and until when, the Keep door, the change door', () => {
      const out = endingEmail(facts());
      assert.equal(out.subject, 'Your move to Tournament is scheduled for January 14, 2027');
      assert.match(out.html, /You keep <strong>Spring Classic<\/strong>\./);
      assert.match(out.html, /<strong>Fall Cup<\/strong> is archived then and kept until <strong>April 14, 2027<\/strong>/);
      // The Downgrade window's own dated words (W.downgrade.whenOn), so the email and the window say the same thing.
      assert.ok(out.html.includes(W.downgrade.whenOn(RENEWAL, 'Tournament Plus')));
      assert.match(out.html, />Keep Tournament Plus</);
      assert.match(out.html, /To change which tournament you keep, open Plan (&amp;|&) billing\./);
      assert.ok(endingEmail(facts({ trialing: true })).html.includes(W.downgrade.whenOn(RENEWAL, 'Tournament Plus', true)));
      assert.doesNotMatch(endingEmail(facts({ move: { ...facts().move!, choose: false } })).html, /To change which tournament/);
      assert.equal(out.vars.keptTournaments, 'Spring Classic');
      assert.deepEqual([out.vars.fromPlanLabel, out.vars.toPlanLabel], ['Tournament Plus', 'Tournament'], 'the old template’s names still fill in');
    });

    it('the reminder asks again when the kept one is gone, naming the newest it keeps otherwise (Stage 0 Ask 8)', () => {
      const out = endingEmail(facts({ kind: 'reminder', move: { target: 'Tournament', kept: ['Winter Cup'], archived: ['Fall Cup'], fellBack: true, picked: true, choose: true } }));
      assert.equal(out.subject, 'Your move to Tournament is in 7 days');
      assert.match(out.html, /no longer a draft or active event, so choose the one you keep\. If you don’t choose by January 14, we keep Winter Cup, your newest\./);
    });

    it('now on: what was kept (or why the newest was), and what was archived — never a promise about Stripe’s billing', () => {
      const out = endingEmail(facts({ kind: 'moved' }));
      assert.equal(out.subject, 'Riverside is now on Tournament');
      assert.match(out.html, /moved from <strong>Tournament Plus<\/strong> to <strong>Tournament<\/strong> on January 14, 2027, as you chose\./);
      assert.match(out.html, /You kept <strong>Spring Classic<\/strong>\. <strong>Fall Cup<\/strong> is archived and kept until <strong>April 14, 2027<\/strong>\. Upgrade before then and it comes back\./);
      assert.match(endingEmail(facts({ kind: 'moved', move: { ...facts().move!, fellBack: true } })).html,
        /The tournament you chose to keep was no longer a draft or active event, so we kept <strong>Spring Classic<\/strong>, your newest\./);
      assert.match(endingEmail(facts({ kind: 'moved', move: { ...facts().move!, fellBack: true, picked: false } })).html,
        /You hadn’t chosen a tournament to keep, so we kept <strong>Spring Classic<\/strong>, your newest\./);
      assert.throws(() => endingEmail(facts({ kind: 'moved', move: null })), /needs the move/);
      assert.match(endingEmail(facts({ kind: 'moved', move: { ...facts().move!, archived: [] } })).html, /No tournament needed to be archived\./);
    });

    it('kept over a move: the Keep window’s own sentence in place of "Nothing else changes."', () => {
      const out = endingEmail(facts({ kind: 'kept' }));
      assert.match(out.html, /The move to Tournament is called off, and no tournament is archived\./);
      assert.doesNotMatch(out.html, /Nothing else changes\./);
      assert.match(endingEmail(facts({ kind: 'kept', move: null })).html, /Nothing else changes\./);
    });
  });

  it('the log is an APPEND: a line written between another writer’s read and its write is kept (owner 2026-11-04)', async () => {
    const w = world({ tournaments: ['t-1', 't-2', 't-3'] });
    await scheduleDowngrade(account(), OWNER, MOVE, w.deps);
    const update = w.deps.updateIntent;
    let raced = false;
    w.deps.updateIntent = async (id, patch, onlyIf) => {
      // Stripe moves the date while the owner's changed pick is being saved.
      if (!raced && patch.keepTournamentIds) {
        raced = true;
        await recordStripeSignal(account(), { ...w.sub, cancel_at: unix('2027-02-15T02:00:00.000Z') } as Stripe.Subscription, w.deps);
      }
      return update(id, patch, onlyIf);
    };
    assert.equal((await changeKeptTournaments(account(), OWNER, ['t-2'], w.deps)).outcome, 'saved');
    assert.deepEqual(w.only().changeLog.map(e => e.action), ['scheduled', 'rescheduled', 'pick_changed']);
  });

  it('no writer rewrites the log from its own read; the store appends under a compare-and-swap on updated_at', () => {
    for (const file of ['lib/plan-ending.ts', 'lib/plan-ending-store.ts']) assert.doesNotMatch(readCode(file), /changeLog: \[\.\.\./, file);
    const store = functionBody(readCode('lib/plan-ending-store.ts'), 'updateIntent');
    assert.match(store, /if \(readStamp\) query = query\.eq\('updated_at', readStamp\)/);
    assert.match(store, /change_log: \[\.\.\.\(Array\.isArray\(current\.change_log\) \? current\.change_log : \[\]\), \.\.\.log\], updated_at: stamp \},\s*current\.updated_at,/);
    assert.match(store, /new Date\(current\.updated_at\)\.getTime\(\) \+ 1/, 'the new stamp is always later than the one read');
  });

  it('the operator’s plan change is refused while a change waits, naming the record’s door that comes first', () => {
    const move = { intentType: 'downgrade' as const, targetPlan: 'tournament' as const, effectiveAt: RENEWAL, status: 'pending' as const };
    assert.equal(operatorPlanChangeRefusal('tournament_plus', move, NOW),
      'A move to Tournament is waiting for January 14, 2027. Use Keep the plan on the club’s record first, then try again.');
    assert.equal(operatorPlanChangeRefusal('tournament_plus', { ...move, intentType: 'cancellation', targetPlan: null }, at(RENEWAL, 1)),
      'A cancel due on January 14, 2027 hasn’t finished yet. Use Keep the plan on the club’s record, or Finish this ending now after January 17, 2027, then try again.');
    assert.equal(operatorPlanChangeRefusal('tournament_plus', move, at(RENEWAL, OVERDUE_GRACE_DAYS + 1)),
      'A move to Tournament that should have happened on January 14, 2027 is still waiting. Use Finish this ending now on the club’s record first, then try again.');
    assert.equal(operatorPlanChangeRefusal('tournament_plus', null, NOW), null);
    assert.equal(operatorPlanChangeRefusal('tournament_plus', { ...move, status: 'canceled' }, NOW), null);
  });

  it('wiring: every operator plan door runs the refusal (the one shared change), after Q9 and before any write; bulk skips the club', () => {
    const body = functionBody(readCode('lib/operator-plan-change.ts'), 'applyOperatorPlanChange');
    const refusalAt = body.indexOf('operatorPlanChangeRefusal(');
    assert.ok(refusalAt > body.indexOf('throw new PlanRefusedError();') && refusalAt < body.indexOf('const updatePayload'));
    for (const route of ['app/api/platform-admin/orgs/[id]/plan/route.ts', 'app/api/platform-admin/orgs/[id]/record/route.ts',
      'app/api/platform-admin/orgs/[id]/put-back/route.ts', 'app/api/platform-admin/bulk-operations/route.ts']) {
      assert.match(readCode(route), /applyOperatorPlanChange\(/, route);
    }
    const bulk = readCode('app/api/platform-admin/bulk-operations/route.ts');
    assert.match(bulk, /waiting: err\.code === 'change_waiting' \|\| undefined/);
    assert.match(bulk, /waiting: results\.filter\(result => result\.waiting\)\.length/, 'the owner’s alert counts them as skipped');
  });

  it('wiring: the confirm route sends no email of its own — the move sends "now on"', () => {
    assert.doesNotMatch(readCode('app/api/billing/downgrade/confirm/route.ts'), /sendTransactionalEmail/);
    assert.match(functionBody(readCode('lib/plan-ending.ts'), 'applyDowngrade'), /kind: 'moved'/);
  });
});
