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
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import {
  OVERDUE_GRACE_DAYS, applyEnding, endedAtFor, endingForDeletedSubscription, futureMoveAnswer, hasRealSubscription,
  isOverdueEnding, keepEnding, pickAppliedEnding, recordStripeSignal, retentionUntilFrom, scheduleEnding, stripeCancelSignal,
  waitingMoveOf, type EndedEvent, type EndingAccount, type EndingActor, type EndingDeps, type EndingIntent,
  type RetainedRecordRow,
} from '../../lib/plan-ending.ts';
import { formatStoredDate } from '../../lib/timezone.ts';
import { readCode } from './_source-code.ts';

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
  const archived = new Set<string>();
  const events = new Map<string, EndedEvent>();
  const emails = new Map<string, number>();
  const suspensions: Array<{ endedAt: string; reason: string | null }> = [];
  const payPages: string[] = [];
  const moves: string[] = [];
  let sub = opts.sub ?? subscription();
  let seq = intents.size;
  const state = { failAt: null as string | null, stripeFails: null as string | null, moveFails: false, now: NOW };

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
      const rows = [...intents.values()].filter(i => i.orgId === orgId && i.status === 'applied')
        .map(i => ({ ...i, intentType: 'cancellation' as const, targetPlan: null }));
      return pickAppliedEnding(rows, subscriptionId, createdAt);
    },
    async insertIntent(row) {
      step('db:insert');
      if (row.status === 'pending' && [...intents.values()].some(i => i.orgId === row.orgId && i.status === 'pending')) return 'conflict';
      const intent: EndingIntent = { ...row, id: `intent-${++seq}`, appliedAt: null, endedEmailSentAt: null };
      intents.set(intent.id, intent);
      return intent;
    },
    async updateIntent(id, patch, onlyIf) {
      step(patch.status === 'applied' ? 'db:flip' : 'db:update');
      const current = intents.get(id);
      if (!current || !onlyIf.includes(current.status)) return null;
      const next = { ...current, ...patch };
      intents.set(id, next);
      return next;
    },
    async preflight() {
      calls.push('preflight');
      return { tournaments: [...live].map(id => ({ id, name: id, slug: id, status: 'active', year: 2026, startDate: null, endDate: null })), shutsDown: ['Public site'] };
    },
    async recordedFor(intentId) {
      return records.filter(r => r.intentId === intentId).map(r => ({ recordType: r.recordType, recordId: r.recordId }));
    },
    async supersedeOthers() { step('records:supersede'); },
    async insertRecords(rows) { step('records:insert'); records.push(...rows); },
    async archive(_orgId, ids) { step('archive'); for (const id of ids) { live.delete(id); archived.add(id); } },
    async suspend(_a, p) { step('suspend'); suspensions.push(p); },
    async closePayPages(_orgId, where) { step('payPages'); payPages.push(where); },
    async writeEndedEvent(e) { step('event'); if (!events.has(e.sourceEventId)) events.set(e.sourceEventId, e); },
    async sendEndedEmail(p) { step('email'); const key = `intent:${p.intentId}:ended_email`; emails.set(key, (emails.get(key) ?? 0) + 1); },
    async retrieveSubscription() { stripeStep('stripe:retrieve'); return sub; },
    async scheduleCancel() { stripeStep('stripe:schedule'); sub = { ...sub, cancel_at_period_end: true, cancel_at: sub.items.data[0].current_period_end, schedule: null } as Stripe.Subscription; return sub; },
    async clearCancel(_id, clear) { stripeStep(`stripe:clear:${clear}`); sub = { ...sub, cancel_at_period_end: false, cancel_at: null } as Stripe.Subscription; return sub; },
    async releaseSchedule() { stripeStep('stripe:release'); sub = { ...sub, schedule: null } as Stripe.Subscription; },
    async rescheduleMove(_a, plan) {
      calls.push(`move:${plan}`);
      if (state.moveFails) return { ok: false, error: 'That plan is retired.' };
      moves.push(plan);
      sub = { ...sub, schedule: moveSchedule(plan) } as unknown as Stripe.Subscription;
      return { ok: true };
    },
  };
  return {
    deps, calls, intents, records, live, archived, events, emails, suspensions, payPages, moves, state,
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
    assert.match(readCode('lib/plan-move.ts'), /const ending = stripeCancelSignal\(live\.sub\);\s*if \(ending\.scheduled\) \{\s*const answer = futureMoveAnswer\('plan_move'/);
    const downgrade = readCode('app/api/billing/downgrade/confirm/route.ts');
    assert.ok(downgrade.indexOf("futureMoveAnswer('downgrade'") < downgrade.indexOf(".from('billing_retention_intents')"));
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
