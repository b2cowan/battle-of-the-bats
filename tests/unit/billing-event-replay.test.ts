import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import {
  REPLAYABLE_TYPES, REPLAY_REFUSED_TYPES, REPLAY_RESULT_ACTION, REPLAY_WINDOW, STRIPE_EVENT_RETENTION_DAYS, lastResultWords, recordRows,
  replayResultWords, replayRowRefusal, resultRowStory,
  type BillingRecord, type ReplayRow,
} from '../../lib/billing-event-replay.ts';
import { fetchedEventFacts, lookupReplayUpdate, replayBillingEvent, type ReplayDeps } from '../../lib/billing-event-replay-run.ts';
import { customerSenders } from '../../lib/billing-event-customer-messages.ts';
import { receiveBillingEvent, type BillingEventClaim, type BillingEventOutcome, type BillingEventStore } from '../../lib/stripe-billing-events.ts';
import { AuditFirstError } from '../../lib/platform-audit.ts';
import { isMoneyEntry } from '../../lib/platform-audit-reason.ts';
import { STRIPE_API_VERSION } from '../../lib/stripe.ts';
import { FEE_INVOICE_META } from '../../lib/online-payment-words.ts';
import { filesUnder, functionBody, readCode } from './_source-code.ts';

/**
 * Plans & pricing Stage 2 Part 5, Session 1: THE GATE ("prove it harmless the second time before it is built", owner ruling
 * 2026-11-06). Build prompt `docs/projects/active/PLANS_PRICING_STAGE2_PART5_BUILD_PROMPT.md` step 7; the audit and the owner's
 * A1/A2 are in the stage prompt's Part 5 block. The fakes keep migration 416's claim rules (including the five-minute lease), and a
 * live delivery and a replay share ONE store, as they share one table. The handler itself needs the server to run; what it does
 * per type is the audit, and what it may send is pinned by the guards at the bottom.
 */

const NOW = new Date('2026-11-08T15:00:00Z');
const LEASE_MS = 5 * 60_000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

type Row = ReplayRow & { attempts: number };

/** One fake world: the event log (mig 416's claim), the club's billing record, Stripe's events and subscription, and every write. */
function world() {
  const rows = new Map<string, Row>();
  const writes: string[] = [];
  const audit: Array<{ action: string; reason: string | null }> = [];
  /** The companion rows (Session 2), kept apart from `writes` so the gate's order assertions stay as Session 1 wrote them. */
  const results: Array<{ orgId: string; reason: string; oldValue: Record<string, string>; newValue: Record<string, string> }> = [];
  const club: BillingRecord = { status: 'past_due', plan: 'league', paidThrough: '2026-11-08T00:00:00.000Z', cycle: 'monthly', planEnds: null };
  const events = new Map<string, Stripe.Event>();
  const stripeSub = { status: 'active', latestInvoice: 'in_2' as string | null, periodEnd: '2026-12-08T00:00:00.000Z' };
  const runs: Array<{ id: string; replay: boolean }> = [];
  let auditBroken = false;
  let failNextRun: Error | null = null;
  let hold: Promise<void> | null = null;
  let beforeAudit: (() => Promise<void>) | null = null;
  const faults = { recordReads: [] as boolean[], noClub: false, doneFails: false, resultFails: false };

  const store: BillingEventStore = {
    async ignore(facts, reason) {
      if (!rows.has(facts.id)) rows.set(facts.id, { ...base(facts.id, facts.type), livemode: facts.livemode, ignoredReason: reason });
    },
    async claim(facts): Promise<BillingEventClaim> {
      writes.push(`claim:${facts.id}`);
      const r = rows.get(facts.id);
      if (!r) { rows.set(facts.id, { ...base(facts.id, facts.type), claimedAt: NOW.toISOString() }); return 'new'; }
      if (!r.processedAt && !r.ignoredReason && (!r.claimedAt || NOW.getTime() - Date.parse(r.claimedAt) >= LEASE_MS)) {
        r.claimedAt = NOW.toISOString(); r.attempts += 1; r.error = null;
        return 'retry';
      }
      return r.processedAt || r.ignoredReason ? 'duplicate' : 'busy';
    },
    async done(id, outcome) {
      writes.push(`done:${id}`);
      const r = rows.get(id)!;
      Object.assign(r, { processedAt: NOW.toISOString(), claimedAt: null, error: null, ignoredReason: outcome === 'processed' ? null : outcome });
    },
    async fail(id, message) {
      writes.push(`fail:${id}`);
      Object.assign(rows.get(id)!, { error: message.slice(0, 500), claimedAt: null });
    },
  };

  /** The handler, as the audit found it for the replayable types: fresh reads, the club written from Stripe's answer. */
  const run = async (event: Stripe.Event, _customerId: string | null, opts: { replay?: boolean } = {}): Promise<BillingEventOutcome> => {
    runs.push({ id: event.id, replay: !!opts.replay });
    // Only the FIRST run waits, so a second run (the bug these tests catch) shows as two runs, never as a hung test.
    if (hold && runs.length === 1) await hold;
    if (failNextRun) { const e = failNextRun; failNextRun = null; throw e; }
    const object = event.data.object as unknown as { lines?: { data: Array<{ period: { end: number } }> } };
    if (event.type === 'invoice.payment_succeeded') {
      club.status = stripeSub.status;
      const end = Math.max(...(object.lines?.data ?? []).map(l => l.period.end));
      club.paidThrough = new Date(end * 1000).toISOString();
    } else if (event.type === 'invoice.payment_failed') {
      if (stripeSub.status === 'past_due') club.status = 'past_due';
    } else if (event.type === 'customer.subscription.updated') {
      club.status = stripeSub.status; club.paidThrough = stripeSub.periodEnd;
    } else if (event.type === 'charge.refunded') {
      return 'not_ours';
    }
    return 'processed';
  };

  const deps: ReplayDeps = {
    live: () => false,
    now: () => NOW,
    apiVersion: STRIPE_API_VERSION,
    async readRow(id) { const r = rows.get(id); return r ? { ...r } : null; },
    async retrieveEvent(id) { return events.get(id) ?? null; },
    async latestInvoiceOf() { return stripeSub.latestInvoice; },
    async findClub() { if (beforeAudit) await beforeAudit(); return faults.noClub ? null : { orgId: 'org_1', name: 'Maple Ridge Ball Association' }; },
    async readRecord() { if (faults.recordReads.shift()) throw new Error('Couldn’t read the club’s billing record: timeout'); return { ...club }; },
    auditFirst: (async (_actor: string, _org: string | null, action: string, _f: unknown, _o: unknown, _n: unknown, opts: { reason?: string | null }) => {
      if (auditBroken) throw new AuditFirstError();
      writes.push(`audit:${action}`);
      audit.push({ action, reason: opts.reason ?? null });
      return async () => { writes.push(`audit:${action}_failed`); audit.push({ action: `${action}_failed`, reason: opts.reason ?? null }); };
    }) as unknown as ReplayDeps['auditFirst'],
    claim: f => store.claim(f),
    done: async (id, o) => { if (faults.doneFails) throw new Error('mark failed'); return store.done(id, o); },
    fail: (id, m) => store.fail(id, m),
    run,
    async recordResult(entry) { if (faults.resultFails) throw new Error('log down'); results.push(entry); },
    report: () => {},
  };

  function base(id: string, type: string): Row {
    return {
      id, type, livemode: false, customerId: 'cus_1', subscriptionId: 'sub_1', objectId: 'obj_1', receivedAt: daysAgo(2),
      claimedAt: null, processedAt: null, error: null, ignoredReason: null, attempts: 1,
    };
  }

  /** A stored event Stripe still holds, and its row: failed by default (the error kept, the claim cleared). */
  function stored(id: string, type: string, row: Partial<Row> = {}, object: Record<string, unknown> = {}) {
    const invoiceLike = type.startsWith('invoice.');
    events.set(id, {
      id, type, livemode: false, api_version: STRIPE_API_VERSION, object: 'event',
      data: {
        object: invoiceLike
          ? { id: 'in_2', object: 'invoice', customer: 'cus_1', parent: { subscription_details: { subscription: 'sub_1' } }, metadata: {},
            lines: { data: [{ period: { end: Date.parse('2026-12-08T00:00:00Z') / 1000 } }] }, ...object }
          : { id: 'obj_1', customer: 'cus_1', ...object },
      },
    } as unknown as Stripe.Event);
    rows.set(id, { ...base(id, type), error: 'Stripe did not answer in time', ...row });
  }

  const replay = (id: string, reason: unknown = 'The club still shows Past due after they paid.') =>
    replayBillingEvent({ eventId: id, actorEmail: 'super@fieldlogichq.ca', reason }, deps);

  return {
    rows, writes, audit, results, club, events, stripeSub, runs, store, deps, run, stored, replay, faults,
    breakAudit() { auditBroken = true; },
    failRunOnce(e: Error) { failNextRun = e; },
    holdRuns() { let release!: () => void; hold = new Promise(r => { release = r; }); return () => { hold = null; release(); }; },
    onBeforeAudit(fn: () => Promise<void>) { beforeAudit = fn; },
  };
}

describe('1 · run twice: the second is refused as finished and writes nothing', () => {
  it('a failed paid-invoice update replays once, then answers "already finished" with no write and no run', async () => {
    const w = world();
    w.stored('evt_paid', 'invoice.payment_succeeded');
    const first = await w.replay('evt_paid');
    assert.equal(first.ok, true);
    assert.deepEqual(w.writes, ['audit:replay_billing_event', 'claim:evt_paid', 'done:evt_paid']);
    assert.equal(w.club.status, 'active');
    const club = { ...w.club };
    const writesBefore = w.writes.length;

    const second = await w.replay('evt_paid');
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.refusal.key, 'finished');
    assert.equal(w.writes.length, writesBefore, 'the second replay wrote nothing (no change-log row, no claim, no outcome)');
    assert.equal(w.runs.length, 1);
    assert.deepEqual(w.club, club);
  });
});

describe('2 · a later update already fixed the club: "Nothing changed"', () => {
  it('the failed paid invoice, then the subscription update that fixed it, then the replay: every row unchanged', async () => {
    const w = world();
    w.stored('evt_paid', 'invoice.payment_succeeded');
    // The later live update arrives and runs (through the receiver, as the webhook does).
    w.stored('evt_sub', 'customer.subscription.updated', { error: null, claimedAt: null });
    w.rows.delete('evt_sub');
    const live = await receiveBillingEvent(w.events.get('evt_sub')!, w.run, { store: w.store, live: () => false, report: () => {} });
    assert.equal(live.status, 200);
    assert.equal(w.club.status, 'active');

    const answer = await w.replay('evt_paid');
    assert.equal(answer.ok, true);
    if (!answer.ok) return;
    assert.equal(answer.result.kind, 'unchanged');
    assert.ok(answer.result.rows.length === 5 && answer.result.rows.every(r => !r.changed));
    assert.equal(replayResultWords(answer.result).title, 'Replayed. Nothing changed.');
  });

  it('a paid invoice that is no longer the plan’s latest is refused before anything is written (its period would go backwards)', async () => {
    const w = world();
    w.stored('evt_old', 'invoice.payment_succeeded', {}, { id: 'in_1' });
    w.stripeSub.latestInvoice = 'in_2';
    const answer = await w.replay('evt_old');
    assert.equal(answer.ok, false);
    if (!answer.ok) assert.equal(answer.refusal.key, 'later_bill');
    assert.deepEqual(w.writes, []);
    assert.equal(w.runs.length, 0);
  });

  it('the result that changed the record shows Before and After with the changed rows marked', async () => {
    const w = world();
    w.stored('evt_paid', 'invoice.payment_succeeded');
    const answer = await w.replay('evt_paid');
    assert.equal(answer.ok, true);
    if (!answer.ok) return;
    assert.equal(answer.result.kind, 'changed');
    const changed = answer.result.rows.filter(r => r.changed).map(r => [r.label, r.before, r.after]);
    assert.deepEqual(changed.map(c => c[0]), ['Status', 'Paid through']);
    assert.deepEqual(changed[0].slice(1), ['Past due', 'Active']);
    assert.match(replayResultWords(answer.result).foot, /No message was sent to the customer/);
  });
});

describe('3 · a live retry and a replay at the same moment: exactly one runs', () => {
  it('Stripe’s retry takes the claim while the replay is between its checks and its claim: the replay is busy and runs nothing', async () => {
    const w = world();
    w.stored('evt_paid', 'invoice.payment_succeeded');
    const release = w.holdRuns();
    let liveDelivery: Promise<Response> | null = null;
    w.onBeforeAudit(async () => {
      liveDelivery = receiveBillingEvent(w.events.get('evt_paid')!, w.run, { store: w.store, live: () => false, report: () => {} });
      await new Promise(r => setImmediate(r)); // the live delivery has claimed and is running
    });
    const answer = await w.replay('evt_paid');
    release();
    const live = await liveDelivery!;
    assert.equal(answer.ok, false);
    if (!answer.ok) assert.equal(answer.refusal.key, 'busy');
    assert.equal(live.status, 200);
    assert.deepEqual(w.runs.map(r => r.replay), [false], 'only the live delivery ran');
    assert.deepEqual(w.audit.map(a => a.action), ['replay_billing_event', 'replay_billing_event_failed']);
  });

  it('the replay takes the claim first: the live delivery is busy (500, Stripe retries later) and never runs it', async () => {
    const w = world();
    w.stored('evt_paid', 'invoice.payment_succeeded');
    const release = w.holdRuns();
    const replaying = w.replay('evt_paid');
    await new Promise(r => setImmediate(r));
    while (w.runs.length === 0) await new Promise(r => setImmediate(r));
    const live = await receiveBillingEvent(w.events.get('evt_paid')!, w.run, { store: w.store, live: () => false, report: () => {} });
    release();
    const answer = await replaying;
    assert.equal(live.status, 500);
    assert.equal(answer.ok, true);
    assert.deepEqual(w.runs.map(r => r.replay), [true], 'only the replay ran');
  });

  it('a row claimed under five minutes ago is "being delivered right now" before anything is written', async () => {
    const w = world();
    w.stored('evt_paid', 'invoice.payment_succeeded', { error: null, claimedAt: new Date(NOW.getTime() - 60_000).toISOString() });
    const answer = await w.replay('evt_paid');
    assert.equal(answer.ok, false);
    if (!answer.ok) assert.equal(answer.refusal.key, 'busy');
    assert.deepEqual(w.writes, []);
  });

  it('a row taken more than five minutes ago and never finished (stuck) is replayed', async () => {
    const w = world();
    w.stored('evt_paid', 'invoice.payment_succeeded', { error: null, claimedAt: new Date(NOW.getTime() - 6 * 60_000).toISOString() });
    const answer = await w.replay('evt_paid');
    assert.equal(answer.ok, true);
  });
});

describe('4 · a replay sends no customer message; a live delivery still does', () => {
  const spies = () => {
    const sent: string[] = [];
    return { sent, real: { email: async (_: unknown) => { sent.push('email'); }, notify: async (_: unknown) => { sent.push('notify'); } } };
  };

  it('the gate: with { replay: true } neither sender is called; with nothing, both are', async () => {
    const s = spies();
    const silent = customerSenders(s.real, { replay: true });
    await silent.email({}); await silent.notify({});
    assert.deepEqual(s.sent, []);
    const live = customerSenders(s.real);
    await live.email({}); await live.notify({});
    assert.deepEqual(s.sent, ['email', 'notify']);
    assert.equal(customerSenders(s.real, {}), s.real, 'a live delivery gets the real senders, unchanged');
  });

  it('the engine runs the seam with { replay: true }, every time', async () => {
    const w = world();
    w.stored('evt_failed', 'invoice.payment_failed');
    w.stored('evt_trial', 'customer.subscription.trial_will_end');
    await w.replay('evt_failed');
    await w.replay('evt_trial');
    assert.deepEqual(w.runs, [{ id: 'evt_failed', replay: true }, { id: 'evt_trial', replay: true }]);
  });

  it('the handler reaches a customer only through the gate (both welcome-backs, the trial email, the failed-payment notice)', () => {
    const code = readCode('lib/billing-webhook-handler.ts');
    assert.match(code, /const say = customerSenders\(\{ email: sendTransactionalEmail, notify \}, opts\);/);
    assert.equal((code.match(/sendTransactionalEmail\(/g) ?? []).length, 0, 'no direct customer email');
    assert.equal((code.match(/(?<![.\w])notify\(/g) ?? []).length, 0, 'no direct in-app notice');
    assert.equal((code.match(/say\.email\(/g) ?? []).length, 3);
    assert.equal((code.match(/say\.notify\(/g) ?? []).length, 1);
    // `sendEmail` here is the owner's own inbox only.
    for (const m of code.matchAll(/sendEmail\(([^,]+),/g)) assert.equal(m[1].trim(), 'ADMIN_EMAIL');
    assert.match(code, /export async function runVerifiedBillingEvent\(event: Stripe\.Event, customerId: string \| null, opts: RunOptions = \{\}\)/);
    assert.match(code, /runPlanWork\(event, customerId, opts\)/);
  });

  it('a live delivery passes no replay input: the receiver calls the seam with two arguments, the route hands it over as is', () => {
    assert.match(functionBody(readCode('lib/stripe-billing-events.ts'), 'receiveBillingEvent'), /outcome = await run\(event, facts\.customerId\);/);
    assert.match(readCode('app/api/billing/webhook/route.ts'), /receiveBillingEvent\(event, runVerifiedBillingEvent\)/);
  });
});

describe('5 · refused before any claim or write', () => {
  const cases: Array<[string, (w: ReturnType<typeof world>) => void, string]> = [
    ['a wrong-mode row', w => w.stored('evt_x', 'invoice.payment_failed', { error: null, ignoredReason: 'wrong_mode', livemode: true }), 'other_account'],
    ['a not-ours row', w => w.stored('evt_x', 'charge.refunded', { error: null, processedAt: daysAgo(1), ignoredReason: 'not_ours' }), 'not_ours'],
    ['a set-aside (no customer) row (A2)', w => w.stored('evt_x', 'invoice.payment_failed', { error: null, processedAt: daysAgo(1), ignoredReason: 'no_customer' }), 'set_aside'],
    ['an unknown id', () => {}, 'unknown'],
    ['an event Stripe no longer holds', w => { w.stored('evt_x', 'invoice.payment_failed'); w.events.delete('evt_x'); }, 'too_old'],
    ['a row older than Stripe keeps', w => w.stored('evt_x', 'invoice.payment_failed', { receivedAt: daysAgo(STRIPE_EVENT_RETENTION_DAYS + 11) }), 'too_old'],
    ['a type the audit refused (A1)', w => w.stored('evt_x', 'customer.subscription.updated'), 'not_replayable'],
    ['a club’s Stripe-fees bill', w => w.stored('evt_x', 'invoice.payment_failed', {}, { metadata: { [FEE_INVOICE_META]: 'fee_1' } }), 'fee_invoice'],
    ['a bill for no plan (made by hand)', w => w.stored('evt_x', 'invoice.payment_succeeded', {}, { parent: null }), 'not_plan_bill'],
    ['another Stripe format', w => { w.stored('evt_x', 'invoice.payment_failed'); (w.events.get('evt_x') as { api_version: string }).api_version = '2025-01-27.acacia'; }, 'format'],
    ['no reason', w => w.stored('evt_x', 'invoice.payment_failed'), 'reason'],
  ];
  for (const [name, plant, key] of cases) {
    it(`${name} → ${key}`, async () => {
      const w = world();
      plant(w);
      const answer = await w.replay('evt_x', key === 'reason' ? '   ' : undefined);
      assert.equal(answer.ok, false);
      if (!answer.ok) assert.equal(answer.refusal.key, key);
      assert.deepEqual(w.writes, [], 'nothing written: no change-log row, no claim, no outcome');
      assert.equal(w.runs.length, 0);
    });
  }

  it('the refusal words are the drawings’ (tab 2)', () => {
    const row = { id: 'evt_x', type: 'invoice.paid', livemode: true, customerId: null, subscriptionId: null, objectId: null, receivedAt: daysAgo(1),
      claimedAt: null, processedAt: null, error: null, ignoredReason: 'wrong_mode' };
    assert.equal(replayRowRefusal(row, { live: false, now: NOW })?.body,
      'It was sent by Stripe’s live account and this site reads the test account, so it was set aside when it arrived. It cannot be replayed here.');
    assert.match(replayRowRefusal({ ...row, livemode: false, ignoredReason: null, receivedAt: daysAgo(41) }, { live: false, now: NOW })!.body,
      /Stripe keeps its updates for 30 days and this one is 41 days old\./);
  });
});

describe('6 · the change-log row comes first', () => {
  it('order: change log, claim, run, outcome', async () => {
    const w = world();
    w.stored('evt_paid', 'invoice.payment_succeeded');
    await w.replay('evt_paid', '  Stripe timed out on Nov 6.  ');
    assert.deepEqual(w.writes, ['audit:replay_billing_event', 'claim:evt_paid', 'done:evt_paid']);
    assert.deepEqual(w.audit, [{ action: 'replay_billing_event', reason: 'Stripe timed out on Nov 6.' }]);
  });

  it('when it cannot be written the run never starts and nothing is claimed', async () => {
    const w = world();
    w.stored('evt_paid', 'invoice.payment_succeeded');
    w.breakAudit();
    const answer = await w.replay('evt_paid');
    assert.equal(answer.ok, false);
    if (!answer.ok) { assert.equal(answer.refusal.key, 'change_log'); assert.equal(answer.status, 503); }
    assert.deepEqual(w.writes, []);
    assert.equal(w.runs.length, 0);
  });

  it('a run that throws keeps the error on the row, clears the claim, writes the _failed row and stays replayable', async () => {
    const w = world();
    w.stored('evt_paid', 'invoice.payment_succeeded');
    w.failRunOnce(new Error('Stripe did not answer in time'));
    const answer = await w.replay('evt_paid');
    assert.equal(answer.ok, true);
    if (answer.ok) { assert.equal(answer.result.kind, 'failed'); assert.equal(answer.result.error, 'Stripe did not answer in time'); }
    const row = w.rows.get('evt_paid')!;
    assert.equal(row.processedAt, null);
    assert.equal(row.claimedAt, null);
    assert.equal(row.error, 'Stripe did not answer in time');
    assert.deepEqual(w.audit.map(a => a.action), ['replay_billing_event', 'replay_billing_event_failed']);
    const again = await w.replay('evt_paid');
    assert.equal(again.ok && again.result.kind, 'changed');
  });
});

describe('the answer never claims what it did not see (/review 2026-11-08)', () => {
  it('a before-read that fails runs nothing, keeps the row’s own error, releases the claim and writes the _failed row', async () => {
    const w = world();
    w.stored('evt_paid', 'invoice.payment_succeeded');
    w.faults.recordReads = [true];
    const answer = await w.replay('evt_paid');
    assert.equal(answer.ok, false);
    if (!answer.ok) assert.equal(answer.refusal.key, 'record_unread');
    assert.equal(w.runs.length, 0);
    const row = w.rows.get('evt_paid')!;
    assert.equal(row.error, 'Stripe did not answer in time', 'the original failure is kept');
    assert.equal(row.claimedAt, null);
    assert.deepEqual(w.audit.map(a => a.action), ['replay_billing_event', 'replay_billing_event_failed']);
  });

  it('an after-read that fails says it could not be read, never "Nothing changed"', async () => {
    const w = world();
    w.stored('evt_paid', 'invoice.payment_succeeded');
    w.faults.recordReads = [false, true];
    const answer = await w.replay('evt_paid');
    assert.equal(answer.ok && answer.result.kind, 'ran');
    if (answer.ok) { assert.equal(answer.result.recordRead, false); assert.match(replayResultWords(answer.result).sentence, /could not be read afterwards/); }
  });

  it('an update that names no one club (a dispute) ran: no Before and After, and no claim that the record matched', async () => {
    const w = world();
    w.stored('evt_d', 'charge.dispute.created', { customerId: null, subscriptionId: null });
    w.faults.noClub = true;
    const answer = await w.replay('evt_d');
    assert.equal(answer.ok && answer.result.kind, 'ran');
    if (answer.ok) assert.doesNotMatch(replayResultWords(answer.result).sentence, /already matched/);
  });

  it('a run that finished but could not be marked says so', async () => {
    const w = world();
    w.stored('evt_paid', 'invoice.payment_succeeded');
    w.faults.doneFails = true;
    const answer = await w.replay('evt_paid');
    assert.equal(answer.ok && answer.result.marked, false);
    if (answer.ok) assert.match(replayResultWords(answer.result).foot, /could not be marked finished/);
  });

  it('a claim of exactly five minutes is still held, as the claim function holds it', () => {
    const row = { id: 'evt_x', type: 'invoice.paid', livemode: false, customerId: null, subscriptionId: null, objectId: null,
      receivedAt: daysAgo(1), claimedAt: new Date(NOW.getTime() - 5 * 60_000).toISOString(), processedAt: null, error: null, ignoredReason: null };
    assert.equal(replayRowRefusal(row, { live: false, now: NOW })?.key, 'busy');
  });
});

describe('7 · every replayable type, run twice, leaves the club’s record identical after the second', () => {
  for (const type of REPLAYABLE_TYPES) {
    it(type, async () => {
      const w = world();
      w.stored('evt_t', type);
      const first = await w.replay('evt_t');
      assert.equal(first.ok, true, `${type} replays`);
      const club = { ...w.club };
      const writes = w.writes.length;
      const second = await w.replay('evt_t');
      assert.equal(second.ok, false);
      if (!second.ok) assert.ok(['finished', 'not_ours'].includes(second.refusal.key));
      assert.deepEqual(w.club, club);
      assert.equal(w.writes.length, writes);
    });
  }
});

describe('the audit, held by the build', () => {
  it('every type the seam acts on is either audited replayable or refused, never neither (a new type is refused until audited)', () => {
    const handler = readCode('lib/billing-webhook-handler.ts');
    const named = [...functionBody(handler, 'runPlanWork').matchAll(/case '([a-z_.]+)':/g)].map(m => m[1]);
    const lists = readCode('lib/charge-tax-record.ts') + readCode('lib/stripe-subscription-charges.ts');
    const listed = ['CHARGE_TAX_INVOICE_EVENTS', 'CHARGE_TAX_CREDIT_NOTE_EVENTS', 'SUBSCRIPTION_CHARGE_EVENT_TYPES'].flatMap(name => {
      const m = new RegExp(`${name}[^=]*=\\s*\\[([^\\]]*)\\]`).exec(lists);
      assert.ok(m, `${name} is found`);
      return [...m![1].matchAll(/'([a-z_.]+)'/g)].map(x => x[1]);
    });
    assert.ok(named.length >= 9 && listed.length >= 13);
    for (const type of [...named, ...listed]) {
      assert.ok(REPLAYABLE_TYPES.has(type) || REPLAY_REFUSED_TYPES.has(type), `${type} has not been audited for replay`);
      assert.ok(!(REPLAYABLE_TYPES.has(type) && REPLAY_REFUSED_TYPES.has(type)), `${type} is in both lists`);
    }
  });

  it('the refused types are the ones the audit found writing Stripe’s old copy (or to Stripe) — the safe list holds none of them', () => {
    for (const t of ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated',
      'customer.subscription.deleted', 'payment_method.attached']) assert.ok(REPLAY_REFUSED_TYPES.has(t) && !REPLAYABLE_TYPES.has(t), t);
  });

  it('the route: Super admin’s power before anything is read; the engine is the only write', () => {
    const route = readCode('app/api/platform-admin/watching-stripe/replay/route.ts');
    assert.ok(route.indexOf("requirePlatformPower('replay_events')") > -1);
    assert.ok(route.indexOf("requirePlatformPower('replay_events')") < route.indexOf('req.json('));
    assert.doesNotMatch(route, /supabaseAdmin|getStripe|stripe\./);
  });

  it('the engine stores no copy of the event and writes nothing to Stripe', () => {
    const engine = readCode('lib/billing-event-replay-run.ts');
    assert.doesNotMatch(engine, /\.(update|create|cancel|del|pay|finalizeInvoice|expire)\(/i, 'no Stripe or table write of its own');
    assert.doesNotMatch(engine, /payload|data\.object\)\s*\}/);
    assert.match(engine, /getStripe\(\)\.events\.retrieve\(id\)/);
  });

  it('the fetched facts read the handler’s own fee mark and the invoice’s subscription', () => {
    const facts = fetchedEventFacts({
      id: 'evt_1', type: 'invoice.payment_failed', livemode: false, api_version: STRIPE_API_VERSION,
      data: { object: { id: 'in_9', metadata: { [FEE_INVOICE_META]: 'x' }, parent: { subscription_details: { subscription: { id: 'sub_9' } } } } },
    } as unknown as Stripe.Event);
    assert.deepEqual([facts.feeInvoice, facts.invoiceSubscriptionId, facts.invoiceId], [true, 'sub_9', 'in_9']);
  });

  it('two stored instants at the same moment are not a change (Postgres and JS print one differently)', () => {
    const a: BillingRecord = { status: 'active', plan: 'league', paidThrough: '2026-12-08T00:00:00+00:00', cycle: 'monthly', planEnds: null };
    const b: BillingRecord = { ...a, paidThrough: '2026-12-08T00:00:00.000Z' };
    assert.ok(recordRows(a, b).every(r => !r.changed));
  });
});

// ── Session 2 · the screen ─────────────────────────────────────────────────────────────────────────────────────────────

describe('S2 · the change log keeps what a replay changed (owner call 2026-11-08: a companion row after the run)', () => {
  it('a replay that changed the record writes one companion row: the record before and after, in words, with the same reason', async () => {
    const w = world();
    w.stored('evt_paid', 'invoice.payment_succeeded');
    const answer = await w.replay('evt_paid');
    assert.equal(answer.ok && answer.result.kind, 'changed');
    assert.equal(w.results.length, 1);
    const [r] = w.results;
    assert.equal(r.orgId, 'org_1');
    assert.equal(r.reason, 'The club still shows Past due after they paid.');
    assert.equal(r.oldValue.Update, 'invoice.payment_succeeded · evt_paid');
    assert.equal(r.oldValue.Status, 'Past due');
    assert.equal(r.newValue.Status, 'Active');
    assert.equal(r.newValue.Run, undefined);
    const story = resultRowStory(r.oldValue, r.newValue);
    assert.equal(story.title, 'Replayed a Stripe update');
    assert.match(story.sub, /^Status: Past due → Active · Paid through: /);
  });
  it('"Nothing changed" is kept too: the Story says so', async () => {
    const w = world();
    w.stored('evt_paid', 'invoice.payment_succeeded');
    w.club.status = 'active';
    w.club.paidThrough = '2026-12-08T00:00:00.000Z';
    const answer = await w.replay('evt_paid');
    assert.equal(answer.ok && answer.result.kind, 'unchanged');
    assert.equal(w.results.length, 1);
    assert.equal(resultRowStory(w.results[0].oldValue, w.results[0].newValue).sub, 'Nothing changed');
  });
  it('no companion row when nothing was compared (a dispute names no club) or a failed run changed nothing', async () => {
    const dispute = world();
    dispute.faults.noClub = true;
    dispute.stored('evt_dsp', 'charge.dispute.created');
    assert.equal((await dispute.replay('evt_dsp')).ok, true);
    assert.equal(dispute.results.length, 0);

    const failed = world();
    failed.stored('evt_paid', 'invoice.payment_succeeded');
    failed.failRunOnce(new Error('Stripe did not answer in time'));
    const answer = await failed.replay('evt_paid');
    assert.equal(answer.ok && answer.result.kind, 'failed');
    assert.equal(failed.results.length, 0, 'its _failed row already says so');
  });
  it('a run the handler set aside (not ours) is no replay of the club’s record: no companion row, and no "Nothing changed" on its Story', async () => {
    const w = world();
    w.stored('evt_paid', 'invoice.payment_succeeded');
    w.deps.run = async () => 'not_ours';
    const answer = await w.replay('evt_paid');
    assert.equal(answer.ok && answer.result.kind, 'set_aside');
    assert.equal(w.results.length, 0);
  });
  it('a lost report of a lost companion row cannot break the answer either', async () => {
    const w = world();
    w.faults.resultFails = true;
    w.deps.report = async () => { throw new Error('observability down'); };
    w.stored('evt_paid', 'invoice.payment_succeeded');
    const answer = await w.replay('evt_paid');
    assert.equal(answer.ok && answer.result.kind, 'changed');
  });
  it('a replay’s entries are money entries: the reason and details are read only by the roles that read Stripe, and the Story line is theirs alone', () => {
    for (const a of ['replay_billing_event', 'replay_billing_event_failed', 'replay_billing_event_result']) assert.equal(isMoneyEntry(a), true, a);
    assert.match(readCode('lib/platform-story.ts'), /r\.action === REPLAY_RESULT_ACTION && opts\.money/);
  });
  it('a run that failed partway is kept, and says it failed partway', async () => {
    const w = world();
    w.stored('evt_paid', 'invoice.payment_succeeded');
    w.deps.run = async () => { w.club.status = 'active'; throw new Error('timed out after the status was saved'); };
    const answer = await w.replay('evt_paid');
    assert.equal(answer.ok && answer.result.kind, 'failed');
    assert.equal(w.results.length, 1);
    assert.equal(w.results[0].newValue.Run, 'Failed partway');
    assert.equal(resultRowStory(w.results[0].oldValue, w.results[0].newValue).title, 'Replay of a Stripe update failed partway');
  });
  it('a companion row that cannot be written changes nothing about the answer (best-effort: the change already happened)', async () => {
    const w = world();
    w.faults.resultFails = true;
    w.stored('evt_paid', 'invoice.payment_succeeded');
    const answer = await w.replay('evt_paid');
    assert.equal(answer.ok && answer.result.kind, 'changed');
    assert.equal(answer.ok && answer.result.marked, true);
  });
  it('not audit-first (written after the change), with the reason, a label, a door and a Story line', () => {
    const engine = readCode('lib/billing-event-replay-run.ts');
    // The Strict write throws on a rejected insert, so the engine's `.catch` really reports a lost companion row.
    assert.match(engine, /writePlatformAuditLogStrict\(actorEmail, orgId, REPLAY_RESULT_ACTION, 'billing_record', oldValue, newValue, \{ reason \}\)/);
    assert.ok(engine.indexOf('deps.recordResult(') > engine.indexOf('deps.done(eventId, ran)'), 'after the outcome');
    assert.equal(REPLAY_RESULT_ACTION, 'replay_billing_event_result');
    assert.match(readCode('app/platform-admin/audit/page.tsx'), /replay_billing_event_result: 'Replay result'/);
    const doors = readCode('lib/platform-audit-doors.ts');
    assert.match(doors, /const STRIPE_PAGE: Target = \{ label: 'Open Stripe', href: '\/platform-admin\/watching-stripe'/);
    assert.match(doors, /replay_billing_event: STRIPE_PAGE,\s*replay_billing_event_result: STRIPE_PAGE,/);
    assert.match(readCode('lib/platform-story.ts'), /r\.action === REPLAY_RESULT_ACTION/);
  });
});

describe('S2 · the window’s read before the click (GET): our row’s facts, read-only', () => {
  it('a failed row: its facts, the club, its last result, and no refusal; nothing written, nothing run', async () => {
    const w = world();
    w.stored('evt_paid', 'invoice.payment_succeeded');
    const a = await lookupReplayUpdate('evt_paid', w.deps);
    assert.equal(a.ok, true);
    if (!a.ok) return;
    assert.equal(a.refusal, null);
    assert.deepEqual(a.update, {
      eventId: 'evt_paid', eventType: 'invoice.payment_succeeded', receivedAt: daysAgo(2),
      clubName: 'Maple Ridge Ball Association', lastResult: 'Failed: Stripe did not answer in time',
    });
    assert.deepEqual(w.writes, []);
    assert.deepEqual(w.results, []);
    assert.equal(w.runs.length, 0);
  });
  it('the row’s own refusals are told before a reason is asked (finished, not replayable, set aside, the other account)', async () => {
    const w = world();
    w.stored('evt_done', 'invoice.payment_succeeded', { processedAt: daysAgo(1), error: null });
    w.stored('evt_sub', 'customer.subscription.updated');
    w.stored('evt_aside', 'invoice.payment_failed', { ignoredReason: 'no_customer', error: null });
    w.stored('evt_live', 'invoice.payment_failed', { livemode: true });
    const key = async (id: string) => { const a = await lookupReplayUpdate(id, w.deps); return a.ok ? a.refusal?.key : `status:${a.status}`; };
    assert.deepEqual(await Promise.all(['evt_done', 'evt_sub', 'evt_aside', 'evt_live'].map(key)), ['finished', 'not_replayable', 'set_aside', 'other_account']);
    assert.deepEqual(w.writes, []);
  });
  it('an unknown or malformed id is 404 "No update with that id"; a record that cannot be read is 503', async () => {
    const w = world();
    for (const id of ['evt_nope', 'in_123', '', null]) {
      const a = await lookupReplayUpdate(id, w.deps);
      assert.equal(!a.ok && a.status, 404, String(id));
      assert.equal(!a.ok && a.refusal.key, 'unknown');
    }
    const a = await lookupReplayUpdate('evt_x', { ...w.deps, readRow: async () => { throw new Error('timeout'); } });
    assert.equal(!a.ok && a.status, 503);
  });
  it('a club that cannot be read just now is no refusal: the window shows no name', async () => {
    const w = world();
    w.stored('evt_paid', 'invoice.payment_succeeded');
    const a = await lookupReplayUpdate('evt_paid', { ...w.deps, findClub: async () => { throw new Error('timeout'); } });
    assert.equal(a.ok && a.refusal, null);
    assert.equal(a.ok && a.update.clubName, null);
  });
  it('last result reads our row in words, and a stored key is never printed', () => {
    const r = (over: Partial<ReplayRow>): ReplayRow => ({
      id: 'evt_1', type: 't', livemode: false, customerId: null, subscriptionId: null, objectId: null, receivedAt: daysAgo(1),
      claimedAt: null, processedAt: null, error: null, ignoredReason: null, ...over,
    });
    assert.equal(lastResultWords(r({ error: 'Invalid API Key provided: sk_test_abcd' })), 'Failed: Invalid API Key provided: a Stripe key');
    assert.equal(lastResultWords(r({ claimedAt: daysAgo(1) })), 'Taken but never finished');
    assert.equal(lastResultWords(r({ ignoredReason: 'no_customer' })), 'Set aside when it arrived');
    assert.match(lastResultWords(r({ processedAt: daysAgo(1) })), /^Finished /);
  });
});

describe('S2 · the screen’s words and the shared window', () => {
  it('Stripe keeps an update for 30 days (not "about"); the window’s fact is Messages, not only emails', () => {
    assert.equal(REPLAY_WINDOW.find.caption, 'Stripe keeps an update for 30 days.');
    assert.equal(REPLAY_WINDOW.facts.messages, 'Messages');
    assert.equal(REPLAY_WINDOW.messages, 'No message is sent to the customer by a replay');
    assert.doesNotMatch(JSON.stringify(REPLAY_WINDOW), /about 30|Set aside again|Send again/);
  });
  it('the window’s answer state is the replay’s alone: every other caller of RecordWindow passes none', () => {
    // Each `<RecordWindow …` opening tag, to the line that closes it (`/>` or `>` on its own line, the house JSX layout).
    const tags = (code: string) => [...code.matchAll(/<RecordWindow\b([\s\S]*?)\n\s*\/?>/g)].map(m => m[1]);
    const withAnswer = [...filesUnder('app', '.tsx'), ...filesUnder('components', '.tsx')]
      .filter(f => tags(readCode(f)).some(t => /\banswer=\{/.test(t)));
    assert.deepEqual(withAnswer, ['app/platform-admin/watching-stripe/ReplayDoors.tsx']);
    // A refusal, before or after the click, is the answer state (no Why, nothing to discard), never a hidden-Why question.
    assert.doesNotMatch(readCode('app/platform-admin/watching-stripe/ReplayDoors.tsx'), /confirmHidden|askWhy=\{false\}/);
  });
});
