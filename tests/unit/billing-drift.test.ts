import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  compareBillingRecords, differenceWords, driftSubject, runBillingDriftCheck, standing,
  type BillingDriftDeps, type DriftCheck, type DriftRecord, type DriftSubscription, type PriceFacts,
} from '../../lib/billing-drift.ts';
import { EMAIL_KINDS } from '../../lib/email-kinds.ts';
import { readCode } from './_source-code.ts';

/**
 * Plans & pricing Stage 0, Part 11 (S6): the daily comparison with Stripe names every kind of difference, sends nothing
 * when the two agree, records a failed read as "could not compare" (and still tells the owner, owner 2026-11-01), and never
 * writes anything but its own result row. Prompt: docs/projects/active/PLANS_PRICING_STAGE0_BUILD_PROMPT.md.
 */

const END = 1_800_000_000; // seconds
const record = (over: Partial<DriftRecord> = {}): DriftRecord => ({
  orgId: 'org-1', name: 'Riverdale Minor Ball', subscriptionId: 'sub_1', status: 'active',
  planId: 'tournament_plus', cycle: 'monthly', periodEnd: new Date(END * 1000).toISOString(), ...over,
});
const sub = (over: Partial<DriftSubscription> = {}): DriftSubscription => ({
  id: 'sub_1', status: 'active', customerId: 'cus_1', priceId: 'price_tp_m', periodEnd: END, ...over,
});
const PRICES = new Map<string, PriceFacts>([
  ['price_tp_m', { planId: 'tournament_plus', billingCycle: 'monthly' }],
  ['price_tp_y', { planId: 'tournament_plus', billingCycle: 'annual' }],
  ['price_club_m', { planId: 'club', billingCycle: 'monthly' }],
  ['price_old', { planId: 'tournament_plus', billingCycle: 'monthly' }], // a replaced price, still recognised (Part 5)
  ['price_mystery', null],
]);
const compare = (records: DriftRecord[], subs: DriftSubscription[], followedElsewhere: string[] = []) =>
  compareBillingRecords({ records, subscriptions: new Map(subs.map(s => [s.id, s])), followedElsewhere: new Set(followedElsewhere), priceFacts: PRICES });
const kinds = (ds: { kind: string }[]) => ds.map(d => d.kind);

describe('Part 11: what the comparison names', () => {
  it('equal records give no difference (a replaced price still counts as its plan)', () => {
    assert.deepEqual(compare([record()], [sub()]), []);
    assert.deepEqual(compare([record()], [sub({ priceId: 'price_old' })]), []);
  });

  it('a renewal date a few minutes off is not a difference; more than an hour is', () => {
    assert.deepEqual(compare([record()], [sub({ periodEnd: END + 600 })]), []);
    const d = compare([record()], [sub({ periodEnd: END + 86_400 })]);
    assert.deepEqual(kinds(d), ['renewal']);
    assert.equal(d[0].stripe, new Date((END + 86_400) * 1000).toISOString());
  });

  it('a missing renewal date on our side is a difference', () => {
    assert.deepEqual(kinds(compare([record({ periodEnd: null })], [sub()])), ['renewal']);
  });

  it('an unreadable renewal date on our side counts as not recorded, never as a match', () => {
    assert.deepEqual(kinds(compare([record({ periodEnd: 'not a date' })], [sub()])), ['renewal']);
    assert.deepEqual(compare([record({ periodEnd: 'not a date' })], [sub({ periodEnd: null })]), []);
  });

  it('a record whose subscription Stripe does not have is "gone"', () => {
    const [d] = compare([record()], []);
    assert.equal(d.kind, 'gone');
    assert.equal(d.orgId, 'org-1');
  });

  it('status, plan and cycle are each named with both sides', () => {
    const d = compare([record({ status: 'active', planId: 'club', cycle: 'annual' })], [sub({ status: 'past_due' })]);
    assert.deepEqual(kinds(d), ['status', 'plan', 'cycle']);
    assert.deepEqual(d.map(x => [x.ours, x.stripe]), [['active', 'past_due'], ['club', 'tournament_plus'], ['annual', 'monthly']]);
  });

  it('statuses are folded alike: a portal\'s mapped status and Stripe\'s raw one compare equal', () => {
    assert.equal(standing('unpaid'), standing('past_due'));
    assert.equal(standing('incomplete'), standing('active'));
    assert.equal(standing('incomplete_expired'), 'ended');
    assert.deepEqual(compare([record({ status: 'past_due' })], [sub({ status: 'unpaid' })]), []);
  });

  it('an ended subscription the record still calls active: the status alone, nothing else compared', () => {
    const d = compare([record()], [sub({ status: 'canceled', priceId: 'price_club_m', periodEnd: END - 999_999 })]);
    assert.deepEqual(kinds(d), ['status']);
  });

  it('a price no slot has used is named, and plan and cycle are not guessed', () => {
    const d = compare([record()], [sub({ priceId: 'price_mystery' })]);
    assert.deepEqual(kinds(d), ['price']);
    assert.equal(d[0].stripe, 'price_mystery');
  });

  it('a subscription Stripe bills that nothing of ours follows is named; a club-paid portal or next-season one is not', () => {
    const subs = [sub(), sub({ id: 'sub_stray', customerId: 'cus_9' }), sub({ id: 'sub_portal' }), sub({ id: 'sub_next', status: 'trialing' }),
      sub({ id: 'sub_left', status: 'incomplete_expired' })];
    const d = compare([record()], subs, ['sub_portal', 'sub_next']);
    assert.deepEqual(d.map(x => [x.kind, x.subscriptionId, x.stripe]), [['not_followed', 'sub_stray', 'cus_9']]);
  });

  it('every kind has words, and none of them says a thing was changed', () => {
    for (const kind of ['gone', 'status', 'plan', 'cycle', 'renewal', 'price', 'not_followed'] as const) {
      const words = differenceWords({ kind, subscriptionId: 'sub_1', orgId: 'org-1', name: 'X', ours: 'monthly', stripe: 'annual' });
      assert.ok(words.length > 10, kind);
      assert.doesNotMatch(words, /fixed|repaired|updated|changed to/i, kind);
    }
    assert.match(differenceWords({ kind: 'plan', subscriptionId: 's', orgId: 'o', name: 'X', ours: 'club', stripe: 'tournament_plus' }), /Tournament Plus/);
  });
});

function harness(opts: { list?: () => Promise<DriftSubscription[]>; retrieve?: (id: string) => Promise<DriftSubscription | null>; records?: DriftRecord[]; sent?: boolean } = {}) {
  const mails: { subject: string; key: string }[] = [];
  const saved: DriftCheck[] = [];
  const retrieved: string[] = [];
  const deps: BillingDriftDeps = {
    environment: 'sandbox',
    listSubscriptions: opts.list ?? (async () => [sub()]),
    async retrieveSubscription(id) { retrieved.push(id); return opts.retrieve ? opts.retrieve(id) : null; },
    async loadRecords() { return opts.records ?? [record()]; },
    async loadFollowedElsewhere() { return new Set(); },
    async planOfPrice(priceId) { return PRICES.get(priceId) ?? null; },
    async sendAlert(subject, _html, key) { mails.push({ subject, key }); return opts.sent ?? true; },
    async saveCheck(check) { saved.push(structuredClone(check)); },
    emailHtml: () => '<p>x</p>',
    now: new Date('2026-11-01T12:15:00Z'),
  };
  return { deps, mails, saved, retrieved };
}

describe('Part 11: one day\'s run', () => {
  it('equal: recorded, no email', async () => {
    const h = harness();
    const check = await runBillingDriftCheck(h.deps);
    assert.equal(check.outcome, 'equal');
    assert.equal(h.mails.length, 0);
    assert.equal(h.saved.length, 1);
    assert.equal(h.saved[0].ownerEmailed, false);
    assert.equal(h.saved[0].recordsCompared, 1);
  });

  it('a difference: one email, keyed to the day and the outcome, and the row says it went', async () => {
    const h = harness({ records: [record({ planId: 'club' })] });
    const check = await runBillingDriftCheck(h.deps);
    assert.equal(check.outcome, 'differs');
    assert.deepEqual(h.mails.map(m => m.key), ['billing-drift:sandbox:differs:2026-11-01']);
    assert.match(h.mails[0].subject, /1 difference$/);
    assert.equal(h.saved[0].ownerEmailed, true);
    assert.deepEqual(kinds(h.saved[0].differences), ['plan']);
  });

  it('a record not in the list is retrieved by itself: a cancelled one compares, a missing one is gone', async () => {
    const h = harness({ list: async () => [], retrieve: async () => sub({ status: 'canceled' }) });
    assert.deepEqual(kinds((await runBillingDriftCheck(h.deps)).differences), ['status']);
    assert.deepEqual(h.retrieved, ['sub_1']);
    const g = harness({ list: async () => [] });
    assert.deepEqual(kinds((await runBillingDriftCheck(g.deps)).differences), ['gone']);
  });

  it('a Stripe failure is "could not compare", never a difference, and the owner is told once that day', async () => {
    const h = harness({ list: async () => { throw new Error('Stripe timed out'); } });
    const check = await runBillingDriftCheck(h.deps);
    assert.equal(check.outcome, 'could_not_compare');
    assert.deepEqual(check.differences, []);
    assert.equal(check.error, 'Stripe timed out');
    assert.deepEqual(h.mails.map(m => m.key), ['billing-drift:sandbox:could_not_compare:2026-11-01']);
    assert.equal(h.mails[0].subject, driftSubject(check));
    assert.equal(h.saved[0].outcome, 'could_not_compare');
  });

  it('a failed single retrieve or price lookup is also "could not compare"', async () => {
    const h = harness({ list: async () => [], retrieve: async () => { throw new Error('500'); } });
    assert.equal((await runBillingDriftCheck(h.deps)).outcome, 'could_not_compare');
    const p = harness();
    p.deps.planOfPrice = async () => { throw new Error('db down'); };
    assert.equal((await runBillingDriftCheck(p.deps)).outcome, 'could_not_compare');
  });

  it('an email that did not go is recorded as not sent', async () => {
    const h = harness({ records: [record({ cycle: 'annual' })], sent: false });
    await runBillingDriftCheck(h.deps);
    assert.equal(h.saved[0].ownerEmailed, false);
  });

  it('a failed save throws, so the job is marked failed', async () => {
    const h = harness();
    h.deps.saveCheck = async () => { throw new Error('no table'); };
    await assert.rejects(runBillingDriftCheck(h.deps), /no table/);
  });
});

describe('Part 11: guards (read-only, the door, the schedule)', () => {
  const server = readCode('lib/billing-drift-server.ts');
  const route = readCode('app/api/platform-admin/billing-drift-daily/route.ts');

  it('the server half writes ONE thing: its own result row (no update, upsert or delete; no Stripe write)', () => {
    assert.doesNotMatch(server, /\.(update|upsert|delete)\(/);
    assert.equal(server.match(/\.insert\(/g)?.length, 1);
    assert.match(server, /from\('stripe_billing_drift_checks'\)\.insert\(/);
    assert.doesNotMatch(server, /subscriptions\.(update|cancel|create|del|resume)\(/);
    assert.doesNotMatch(server, /customers\.|invoices\./);
  });

  it('the route answers the scheduler secret or the run_jobs power, and a failed comparison is not a green 200', () => {
    assert.match(route, /isCronRequest\(req\)/);
    assert.match(route, /requirePlatformPower\('run_jobs'\)/);
    assert.match(route, /status: ok \? 200 : 207/);
    assert.match(route, /could_not_compare/);
  });

  it('the email is an inbox kind', () => {
    assert.equal(EMAIL_KINDS.billing_drift_alert.klass, 'inbox');
    assert.match(server, /kind: 'billing_drift_alert'/);
  });

  it('the schedule calls this route, daily', () => {
    const sql = readFileSync('supabase/migrations/422_the_daily_billing_check_is_scheduled.sql', 'utf8');
    assert.match(sql, /cron\.schedule\(\s*'billing-drift-daily',\s*'15 12 \* \* \*'/);
    assert.match(sql, /app_cron_http_tick\('billing_drift_tick', '\/api\/platform-admin\/billing-drift-daily'\)/);
  });

  it('the result table is service-role only and its outcome words are the module\'s', () => {
    const sql = readFileSync('supabase/migrations/421_the_daily_billing_check_keeps_its_results.sql', 'utf8');
    assert.match(sql, /REVOKE ALL ON public\.stripe_billing_drift_checks FROM anon, authenticated/);
    assert.match(sql, /CHECK \(outcome IN \('equal', 'differs', 'could_not_compare'\)\)/);
  });
});
