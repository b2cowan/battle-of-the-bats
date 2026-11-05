/**
 * Plans end at the renewal date · Stage 3 — the test-clock rehearsal's pure parts (scripts/lib/plan-ending-rehearsal.mjs)
 * and the shared portal audit (scripts/lib/stripe-portal-audit.mjs). The run itself is the integration evidence; this pins
 * the refusal, the comparer, the one copy of the portal assertions, the reset's reach, and the cases' own consistency.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  CASES, MARKER, DEV_REF, refusal, evaluate, classify, notYet, portalGate, resetSelection, renderReport, unknownRoots,
  must, assumed, is, count, sameAs, equals, daysAfter, laterThan, includes, excludes, inOrder, allProcessed, absent, present,
} from '../../scripts/lib/plan-ending-rehearsal.mjs';
import { auditPortal } from '../../scripts/lib/stripe-portal-audit.mjs';
import { PORTAL_CONFIG_KEY, PORTAL_CONFIG_VERSION, PORTAL_FEATURES } from '../../lib/stripe-portal-settings.ts';
import { readCode } from './_source-code.ts';

const DEV_URL = `https://${DEV_REF}.supabase.co`;
const TEST_KEY = ['sk', 'test', 'x'].join('_');
const LIVE_KEY = ['sk', 'live', 'x'].join('_');
const RESTRICTED_LIVE = ['rk', 'live', 'x'].join('_');
const RESTRICTED_TEST = ['rk', 'test', 'x'].join('_');

describe('the refusal: a test key and the dev database, or nothing runs', () => {
  it('refuses a live key, a restricted live key, an empty key and no key', () => {
    for (const stripeKey of [LIVE_KEY, RESTRICTED_LIVE, '', undefined]) {
      assert.match(refusal({ stripeKey, supabaseUrl: DEV_URL }) ?? '', /not a Stripe TEST key/, String(stripeKey));
    }
  });
  it('refuses any database that is not the dev project, a look-alike URL included', () => {
    for (const supabaseUrl of ['https://prodref.supabase.co', `https://evil.example.com/${DEV_REF}`, `https://x.supabase.co/?${DEV_REF}`,
      `https://${DEV_REF}.evil.com`, `http://${DEV_REF}`, '', undefined]) {
      assert.match(refusal({ stripeKey: TEST_KEY, supabaseUrl }) ?? '', /not the dev project/, String(supabaseUrl));
    }
  });
  it('lets a test key (full or restricted) on the dev project through', () => {
    assert.equal(refusal({ stripeKey: TEST_KEY, supabaseUrl: DEV_URL }), null);
    assert.equal(refusal({ stripeKey: RESTRICTED_TEST, supabaseUrl: DEV_URL }), null);
  });
  it('the script exits on a live key before any call (no network, exit 2)', () => {
    const res = spawnSync(process.execPath, ['scripts/rehearse-plan-ending.mjs', '--reset'], {
      encoding: 'utf8', env: { NODE_ENV: 'test', PATH: process.env.PATH ?? '', STRIPE_SECRET_KEY: LIVE_KEY, NEXT_PUBLIC_SUPABASE_URL: DEV_URL, SUPABASE_SERVICE_ROLE_KEY: 'x' },
    });
    assert.equal(res.status, 2, res.stderr);
    assert.match(res.stderr, /not a Stripe TEST key/);
  });
  it('the script exits on the production database before any call', () => {
    const res = spawnSync(process.execPath, ['scripts/rehearse-plan-ending.mjs', '--reset'], {
      encoding: 'utf8', env: { NODE_ENV: 'test', PATH: process.env.PATH ?? '', STRIPE_SECRET_KEY: TEST_KEY, NEXT_PUBLIC_SUPABASE_URL: 'https://prodref.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'x' },
    });
    assert.equal(res.status, 2, res.stderr);
    assert.match(res.stderr, /not the dev project/);
  });
  it('--site takes only the dev site or a local server (sign-ins and a signed webhook go to it), before any call', () => {
    for (const site of ['https://www.fieldlogichq.ca', 'https://dev.fieldlogichq.ca.evil.com', 'http://example.com']) {
      const res = spawnSync(process.execPath, ['scripts/rehearse-plan-ending.mjs', '--run', '--inbox', 'a@b.co', '--site', site], {
        encoding: 'utf8', env: { NODE_ENV: 'test', PATH: process.env.PATH ?? '', STRIPE_SECRET_KEY: TEST_KEY, NEXT_PUBLIC_SUPABASE_URL: DEV_URL, SUPABASE_SERVICE_ROLE_KEY: 'x' },
      });
      assert.equal(res.status, 2, `${site}: ${res.stderr}`);
      assert.match(res.stderr, /--site must be/, site);
    }
  });
  it('the refusal comes before the first Stripe client and database client in the script', () => {
    const code = readCode('scripts/rehearse-plan-ending.mjs');
    const at = code.indexOf('refusal({');
    assert.ok(at > 0);
    assert.ok(at < code.indexOf('new Stripe('), 'refusal before the Stripe client');
    assert.ok(at < code.indexOf('createClient(process.env'), 'refusal before the database client');
  });
  it('decides test/live only through lib/stripe-mode.ts, in the one guard the billing walk fixtures share', () => {
    const guard = readCode('scripts/lib/billing-walk-fixture.mjs');
    assert.match(guard, /import \{ stripeKeyIsTest \} from '\.\.\/\.\.\/lib\/stripe-mode\.ts'/);
    assert.doesNotMatch(guard, /supabase-ops/, 'never a module that fills unset variables from .env.local');
    for (const seed of ['scripts/seed-plan-ending-walk.mjs', 'scripts/seed-plan-move-walk.mjs']) {
      const code = readCode(seed);
      assert.match(code, /refusal\(\{ stripeKey: process\.env\.STRIPE_SECRET_KEY, supabaseUrl: url \}\)/, seed);
      assert.doesNotMatch(code, /url\.includes\(DEV_REF\)|async function findUserByEmail/, `${seed} keeps no copy of its own`);
    }
  });
  it('talks to Stripe with the app\'s own API version (one copy, in lib/stripe.ts)', () => {
    assert.match(readCode('lib/stripe.ts'), /export const STRIPE_API_VERSION = '[^']+';[\s\S]*apiVersion: STRIPE_API_VERSION/);
    assert.match(readCode('scripts/rehearse-plan-ending.mjs'), /import \{ STRIPE_API_VERSION \} from '\.\.\/lib\/stripe\.ts'/);
  });
  it('signs in through @supabase/ssr\'s own cookie writer, never a hand-built cookie', () => {
    const fixture = readCode('scripts/lib/billing-walk-fixture.mjs');
    assert.match(fixture, /createServerClient\(/);
    assert.doesNotMatch(readCode('scripts/rehearse-plan-ending.mjs'), /base64-|auth-token/);
  });
});

describe('the comparer', () => {
  const observed = {
    setup: { periodEnd: '2026-12-05T04:00:00.000Z', price: 3900 },
    end: {
      org: { subscription_status: 'canceled', stripe_subscription_id: null },
      intent: { effective_at: '2026-12-05T04:00:30.000Z', retention_until: '2027-03-05T04:00:00.000Z' },
      stripe: { ended_at: '2026-12-05T04:00:00.000Z', last_paid_cents: 3900 },
      emails: { cancellation_confirmation: 1 },
      stripeEvents: ['customer.subscription.updated', 'invoice.created', 'customer.subscription.deleted'],
      ledger: [{ type: 'a', processed: true }, { type: 'b', processed: false, ignored: 'no_customer' }],
    },
  };
  it('matchers read what they say', () => {
    assert.equal(evaluate(must('x', 'end.org.subscription_status', is('canceled')), observed).ok, true);
    assert.equal(evaluate(must('x', 'end.org.stripe_subscription_id', absent()), observed).ok, true);
    assert.equal(evaluate(must('x', 'end.org.subscription_status', present()), observed).ok, true);
    assert.equal(evaluate(must('x', 'end.emails.cancellation_confirmation', count(1)), observed).ok, true);
    assert.equal(evaluate(must('x', 'end.emails.plan_ends_on', count(0)), observed).ok, true, 'a count nobody recorded is 0');
    assert.equal(evaluate(must('x', 'end.intent.effective_at', sameAs('end.stripe.ended_at')), observed).ok, true, 'within the minute');
    assert.equal(evaluate(must('x', 'end.intent.retention_until', daysAfter('end.stripe.ended_at', 90)), observed).ok, true);
    assert.equal(evaluate(must('x', 'end.intent.retention_until', daysAfter('end.stripe.ended_at', 89)), observed).ok, false);
    assert.equal(evaluate(must('x', 'end.intent.retention_until', laterThan('setup.periodEnd')), observed).ok, true);
    assert.equal(evaluate(must('x', 'end.stripe.last_paid_cents', equals('setup.price')), observed).ok, true);
    assert.equal(evaluate(must('x', 'end.stripe.last_paid_cents', equals('setup.nothing')), observed).ok, false);
    assert.equal(evaluate(must('x', 'end.stripeEvents', includes('customer.subscription.deleted')), observed).ok, true);
    assert.equal(evaluate(must('x', 'end.stripeEvents', excludes('invoice.created')), observed).ok, false);
    assert.equal(evaluate(must('x', 'end.ledger', allProcessed()), observed).ok, true, 'an ignored row counts as handled');
    assert.equal(evaluate(must('x', 'end.ledger', allProcessed()), { end: { ledger: [{ type: 'c', processed: true, error: 'boom' }] } }).ok, false);
  });
  it('a time an hour off is not the same instant', () => {
    const off = { a: '2026-12-05T04:00:00Z', b: '2026-12-05T05:00:00Z' };
    assert.equal(evaluate(must('x', 'a', sameAs('b')), off).ok, false);
    assert.equal(evaluate(must('x', 'a', sameAs('missing')), off).ok, false);
  });
  it('an event-order assertion catches the wrong order', () => {
    const list = { e: ['customer.subscription.deleted', 'invoice.payment_failed'] };
    assert.equal(evaluate(must('x', 'e', inOrder(['invoice.payment_failed', 'customer.subscription.deleted'])), list).ok, false);
    assert.equal(evaluate(must('x', 'e', inOrder(['customer.subscription.deleted', 'invoice.payment_failed'])), list).ok, true);
    assert.equal(evaluate(must('x', 'e', inOrder(['a', 'b'])), { e: ['a', 'x', 'b'] }).ok, true, 'other events may sit between');
    assert.match(evaluate(must('x', 'e', inOrder(['a', 'b'])), { e: ['b', 'a'] }).detail, /out of order or missing: b/);
  });
  it('PASS when every expectation holds', () => {
    const r = classify({ expectations: [must('suspended', 'end.org.subscription_status', is('canceled'))], observed });
    assert.equal(r.verdict, 'PASS');
  });
  it('FAIL when a must is wrong, naming it', () => {
    const r = classify({ expectations: [must('still active', 'end.org.subscription_status', is('active'))], observed });
    assert.equal(r.verdict, 'FAIL');
    assert.match(r.reasons[0], /still active/);
  });
  it('SURPRISE when only an assumption about Stripe is wrong', () => {
    const r = classify({ expectations: [
      must('suspended', 'end.org.subscription_status', is('canceled')),
      assumed('no invoice at the end', 'end.stripeEvents', excludes('invoice.created')),
    ], observed });
    assert.equal(r.verdict, 'SURPRISE');
    assert.match(r.reasons[0], /^SURPRISE · no invoice at the end/);
  });
  it('a must beats a surprise', () => {
    const r = classify({ expectations: [
      must('still active', 'end.org.subscription_status', is('active')),
      assumed('no invoice', 'end.stripeEvents', excludes('invoice.created')),
    ], observed });
    assert.equal(r.verdict, 'FAIL');
  });
  it('a timeout is a FAIL that names what never arrived', () => {
    const waitingFor = [must('the ending applied', 'end.intent.status', is('applied'))];
    const missing = notYet(waitingFor, observed);
    assert.deepEqual(missing, ['the ending applied']);
    const r = classify({ expectations: [], observed, timedOut: missing });
    assert.equal(r.verdict, 'FAIL');
    assert.deepEqual(r.reasons, ['timed out waiting for: the ending applied']);
  });
  it('a failed step is a FAIL, naming it', () => {
    const r = classify({ expectations: [], observed, stepErrors: ['owner cancel: HTTP 409'] });
    assert.equal(r.verdict, 'FAIL');
    assert.deepEqual(r.reasons, ['step failed: owner cancel: HTTP 409']);
  });
});

describe('the portal assertion: one copy, read from the app\'s own constants', () => {
  const fakeStripe = (configs: unknown[]) => ({
    billingPortal: { configurations: { list: () => (async function* () { yield* configs; })() } },
  });
  const ours = (features: unknown) => ({ id: 'bpc_ours', features, metadata: { [PORTAL_CONFIG_KEY]: PORTAL_CONFIG_VERSION } });

  it('a configuration built from the app\'s constants passes every check', async () => {
    const checks = await auditPortal(fakeStripe([ours(PORTAL_FEATURES)]));
    assert.deepEqual(checks.filter(c => c.status !== 'PASS'), []);
    assert.equal(portalGate(checks).ok, true);
  });
  it('an immediate cancel or plan switching fails and stops the rehearsal', async () => {
    const drifted = { ...PORTAL_FEATURES, subscription_cancel: { enabled: true, mode: 'immediately' }, subscription_update: { enabled: true } };
    const checks = await auditPortal(fakeStripe([ours(drifted)]));
    assert.deepEqual(checks.filter(c => c.status === 'FAIL').map(c => c.key).sort(), ['subscription_cancel', 'subscription_update']);
    assert.equal(portalGate(checks).ok, false);
  });
  it('a missing configuration is MISSING, never a pass (the WARN is not good enough)', async () => {
    const checks = await auditPortal(fakeStripe([{ id: 'bpc_default', features: PORTAL_FEATURES, metadata: {} }]));
    assert.equal(checks[0].status, 'WARN');
    const gate = portalGate(checks);
    assert.equal(gate.missing, true);
    assert.equal(gate.ok, false);
  });
  it('the audit and the rehearsal both call the shared copy, and the audit keeps no copy of its own', () => {
    const audit = readCode('scripts/audit-stripe-billing.mjs');
    assert.match(audit, /import \{ auditPortal, check \} from '\.\/lib\/stripe-portal-audit\.mjs'/);
    assert.doesNotMatch(audit, /async function auditPortal|subscription_cancel/);
    assert.match(readCode('scripts/rehearse-plan-ending.mjs'), /import \{ auditPortal \} from '\.\/lib\/stripe-portal-audit\.mjs'/);
    assert.match(readCode('scripts/lib/stripe-portal-audit.mjs'), /from '\.\.\/\.\.\/lib\/stripe-portal-settings\.ts'/);
  });
  it('the shared audit only reads (lists; never creates or updates)', () => {
    const code = readCode('scripts/lib/stripe-portal-audit.mjs');
    assert.match(code, /configurations\.list\(/);
    assert.doesNotMatch(code, /\.create\(|\.update\(|\.del\(/);
  });
});

describe('reset removes exactly the marker', () => {
  it('only clubs carrying the marker and only clocks named with it', () => {
    const { orgIds, clockIds } = resetSelection({
      orgs: [
        { id: 'o1', internal_notes: MARKER },
        { id: 'o2', internal_notes: 'plan-ending-walk-fixture' },
        { id: 'o3', internal_notes: `${MARKER}-ish` },
        { id: 'o4', internal_notes: null },
      ],
      clocks: [
        { id: 'c1', name: `${MARKER} 2 2026-11-05` },
        { id: 'c2', name: 'someone else\'s clock' },
        { id: 'c3', name: `${MARKER}x 1` },
        { id: 'c4', name: null },
      ],
    });
    assert.deepEqual(orgIds, ['o1']);
    assert.deepEqual(clockIds, ['c1']);
  });
  it('with case ids, only those cases (case 1 never catches 10 or 11)', () => {
    const { orgIds, clockIds } = resetSelection({
      caseIds: ['1', '6b'],
      orgs: [
        { id: 'o1', name: 'Rehearsal 1 Club', internal_notes: MARKER },
        { id: 'o10', name: 'Rehearsal 10 Club', internal_notes: MARKER },
        { id: 'o6b', name: 'Rehearsal 6b Club', internal_notes: MARKER },
        { id: 'oX', name: 'Rehearsal 1 Club', internal_notes: 'someone else' },
      ],
      clocks: [
        { id: 'c1', name: `${MARKER} 1 2026-11-05` },
        { id: 'c11', name: `${MARKER} 11 2026-11-05` },
        { id: 'c6b', name: `${MARKER} 6b 2026-11-05` },
      ],
    });
    assert.deepEqual(orgIds, ['o1', 'o6b']);
    assert.deepEqual(clockIds, ['c1', 'c6b']);
  });
  it('the reset removes the clubs before the clocks', () => {
    const code = readCode('scripts/rehearse-plan-ending.mjs');
    const body = code.slice(code.indexOf('async function reset('));
    assert.ok(body.indexOf("from('organizations').delete()") < body.indexOf('testClocks.del('));
  });
});

describe('the cases', () => {
  const STEPS = ['ownerCancel', 'ownerKeep', 'ownerDowngrade', 'ownerMove', 'operatorEndNow', 'stripeFlag', 'rawFlagOnScheduled', 'failingCard',
    'createTournament', 'touchMetadata', 'advance', 'wait', 'snapshot', 'resendEvent', 'signedReplay'];
  it('ids are unique and cover the prompt\'s list', () => {
    const ids = CASES.map(c => c.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(ids, ['1', '2', '3', '4', '5', '6a', '6b', '7', '8', '9', '10', '11', '12a', '12b']);
  });
  it('every expectation reads a snapshot its case takes', () => {
    for (const c of CASES) assert.deepEqual(unknownRoots(c), [], `case ${c.id}`);
  });
  it('every step is one the driver performs', () => {
    const driver = readCode('scripts/rehearse-plan-ending.mjs');
    for (const c of CASES) for (const s of c.steps) {
      assert.ok(STEPS.includes(s.do), `case ${c.id}: ${s.do}`);
      assert.match(driver, new RegExp(`case '${s.do}'`), `the driver handles ${s.do}`);
    }
  });
  it('every case writes its expected state, and an ending case checks the email went once', () => {
    for (const c of CASES) assert.ok(c.expect.length >= 5, `case ${c.id}`);
    for (const id of ['2', '3', '4', '5', '10']) {
      assert.ok(CASES.find(c => c.id === id)!.expect.some(e => e.path === 'end.emails.cancellation_confirmation'), id);
    }
  });
});

describe('the report', () => {
  it('names every case with its verdict and what was not proven', () => {
    const md = renderReport({
      startedAt: '2026-11-05T00:00:00Z', site: 'https://dev.fieldlogichq.ca', portal: { ok: true, checks: [{ status: 'PASS', key: 'configuration', detail: 'ours' }] },
      cases: [
        { id: '1', title: 'Control', verdict: 'PASS', steps: [], checks: [{ ok: true, level: 'must', label: 'renewed', detail: 'a | b' }], reasons: [] },
        { id: '2', title: 'Cancel', verdict: 'SURPRISE', steps: [{ label: 'ownerCancel', result: '200' }], stripeEvents: ['x', 'y'], checks: [], reasons: ['SURPRISE · thing'] },
      ],
    });
    assert.match(md, /## 1 · Control — ✅ PASS/);
    assert.match(md, /## 2 · Cancel — ⚠️ SURPRISE/);
    assert.match(md, /x → y/);
    assert.match(md, /a \\\| b/, 'a pipe in a detail does not break the table');
    assert.match(md, /Not proven here/);
  });
});
