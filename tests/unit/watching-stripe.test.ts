import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { canViewPlatformArea, isPlatformAreaReadOnly } from '../../lib/platform-areas.ts';
import {
  WS, checkIsStale, figureBand, needsALook, settingsToCheck, shownError, settingChip, settingPassWords, STALE_CHECK_HOURS,
  type FeedRead, type WatchingStripeRead,
} from '../../lib/watching-stripe-words.ts';

/**
 * PLANS & PRICING STAGE 2 PART 3: WATCHING STRIPE (drawings tab 10; owner go 2026-11-07). Read only. The page shows the last
 * morning comparison and cannot run it, has no "Send again" (replay is Part 5), says the failed-try outcome cannot be read
 * rather than drawing a pass or a fail, and never lets a read that failed look like nothing wrong.
 */
const NOW = new Date('2026-11-07T15:00:00Z');
const feed = (over: Partial<FeedRead> = {}): FeedRead => ({
  key: 'plan_billing', lastReceived: '2026-11-07T14:58:00Z', failing: 0, failures: [], stuck: 0,
  ignored: { notOurs: 3, noCustomer: 0, wrongMode: 0 }, ...over,
});
const clean = (): WatchingStripeRead => ({
  billing: feed(),
  connect: feed({ key: 'family_payments', stuck: null, ignored: null }),
  drift: { state: 'read', checkedAt: '2026-11-07T12:15:00Z', outcome: 'equal', subscriptionsRead: 5, recordsCompared: 5, lines: [], differenceCount: 0, error: null },
  settings: [{ key: 'configuration', status: 'PASS', detail: 'ok' }, { key: 'invoice_history', status: 'PASS', detail: 'ok' }],
  mode: 'sandbox',
});

describe('who sees it', () => {
  it('Super admin, Billing, Support and Product read it; Growth and Read only do not', () => {
    for (const role of ['super_admin', 'billing', 'support', 'product'] as const) assert.equal(canViewPlatformArea(role, 'watching_stripe'), true, role);
    for (const role of ['growth', 'read_only'] as const) assert.equal(canViewPlatformArea(role, 'watching_stripe'), false, role);
  });
  it('everyone but Super admin sees the eye (replay is Super admin’s, and is not on this page yet)', () => {
    assert.equal(isPlatformAreaReadOnly('super_admin', 'watching_stripe'), false);
    for (const role of ['billing', 'support', 'product'] as const) assert.equal(isPlatformAreaReadOnly(role, 'watching_stripe'), true, role);
  });
  it('the page asks the area, and the menu holds the entry in Health', () => {
    assert.match(readCode('app/platform-admin/watching-stripe/page.tsx'), /requirePlatformAreaView\('watching_stripe'\)/);
    assert.match(readCode('app/platform-admin/console-menu.ts'), /\{ href: '\/platform-admin\/watching-stripe', label: 'Stripe', icon: 'stripe', area: 'watching_stripe' \}/);
  });
});

describe('read only', () => {
  it('the reader and the page write nothing and call Stripe only to list', () => {
    const lib = readCode('lib/watching-stripe.ts');
    assert.doesNotMatch(lib, /\.(insert|update|upsert|delete|rpc)\(/);
    assert.doesNotMatch(lib, /\.(create|update|del|cancel|retry|pay)\(/);
    const page = readCode('app/platform-admin/watching-stripe/page.tsx');
    assert.doesNotMatch(page, /'use client'|<form|<button|method: '(POST|PATCH|PUT|DELETE)'|fetch\(/);
  });
  it('no "Check now" and no "Send again" (owner go 2026-11-07; replay is Part 5)', () => {
    const shown = readCode('app/platform-admin/watching-stripe/page.tsx') + JSON.stringify(WS);
    assert.doesNotMatch(shown, /Check now|Send again|Resend/i);
  });
  it('the settings read is the ONE audit the scripts run, not a copy', () => {
    assert.match(readCode('lib/watching-stripe.ts'), /import \{ auditPortal \} from '\.\.\/scripts\/lib\/stripe-portal-audit\.mjs'/);
    assert.doesNotMatch(readCode('lib/watching-stripe.ts'), /billingPortal/);
  });
  it('the morning comparison is read from its table for this site’s mode, never re-run', () => {
    const lib = readCode('lib/watching-stripe.ts');
    assert.match(lib, /from\('stripe_billing_drift_checks'\)[\s\S]*?\.eq\('environment', stripeEnvironment\(\)\)/);
    assert.doesNotMatch(lib, /runBillingDriftCheck|runTodaysBillingDriftCheck/);
  });
});

describe('the failed-try outcome is neither a pass nor a fail', () => {
  it('it is said as "cannot be read", with a way to check it in Stripe', () => {
    assert.equal(WS.settings.failedTry.state, 'Cannot be read from here');
    assert.match(WS.settings.failedTry.link, /Check it in Stripe/);
    const page = readCode('app/platform-admin/watching-stripe/page.tsx');
    assert.match(page, /kit\.chipInfo\}`\}>\{F\.state\}/);
  });
  it('it never adds to "need a look" (the clean read already carries no failed-try setting)', () => {
    assert.equal(needsALook(clean(), NOW), 0);
    assert.equal(settingsToCheck(clean().settings), 0);
  });
});

describe('what counts as needing a look', () => {
  it('a clean read is all clear', () => {
    assert.equal(needsALook(clean(), NOW), 0);
    assert.equal(WS.chip(0), 'All clear');
  });
  it('a feed still failing, a stuck delivery or a wrong-mode update each count once per feed', () => {
    assert.equal(needsALook({ ...clean(), billing: feed({ failing: 2 }) }, NOW), 1);
    assert.equal(needsALook({ ...clean(), billing: feed({ stuck: 1 }) }, NOW), 1);
    assert.equal(needsALook({ ...clean(), billing: feed({ ignored: { notOurs: 0, noCustomer: 0, wrongMode: 4 } }) }, NOW), 1);
    assert.equal(needsALook({ ...clean(), billing: feed({ failing: 2, stuck: 1 }) }, NOW), 1);
  });
  it('set-aside updates that are not ours are quiet (they are normal)', () => {
    assert.equal(needsALook({ ...clean(), billing: feed({ ignored: { notOurs: 96, noCustomer: 1, wrongMode: 0 } }) }, NOW), 0);
  });
  it('a read that failed counts: "could not read" is never "nothing wrong"', () => {
    assert.equal(needsALook({ ...clean(), billing: null }, NOW), 1);
    assert.equal(needsALook({ ...clean(), connect: null }, NOW), 1);
    assert.equal(needsALook({ ...clean(), drift: null }, NOW), 1);
    assert.equal(needsALook({ ...clean(), settings: null }, NOW), 1);
  });
  it('the morning check: none yet, differing, could not compare, or gone stale each count once', () => {
    const base = clean();
    const read = (over: object) => ({ ...base, drift: { ...base.drift!, ...over } as WatchingStripeRead['drift'] });
    assert.equal(needsALook({ ...base, drift: { state: 'none' } }, NOW), 1);
    assert.equal(needsALook(read({ outcome: 'differs', differenceCount: 11 }), NOW), 1);
    assert.equal(needsALook(read({ outcome: 'could_not_compare' }), NOW), 1);
    assert.equal(needsALook(read({ checkedAt: '2026-11-04T12:15:00Z' }), NOW), 1);
  });
  it('a check is stale past 36 hours, not before', () => {
    assert.equal(STALE_CHECK_HOURS, 36);
    assert.equal(checkIsStale('2026-11-06T04:00:00Z', NOW), false);
    assert.equal(checkIsStale('2026-11-06T02:00:00Z', NOW), true);
  });
  it('each warning or failing setting counts', () => {
    const settings = [
      { key: 'configuration', status: 'PASS' as const, detail: '' },
      { key: 'subscription_update', status: 'FAIL' as const, detail: 'x' },
      { key: 'old_versions', status: 'WARN' as const, detail: 'y' },
    ];
    assert.equal(needsALook({ ...clean(), settings }, NOW), 2);
  });
  it('the chip is singular and plural', () => {
    assert.equal(WS.chip(1), '1 needs a look');
    assert.equal(WS.chip(4), '4 need a look');
  });
});

describe('the four figures at the top', () => {
  it('a clean read shows real zeros and the newest update from either feed', () => {
    const f = figureBand({ ...clean(), connect: feed({ key: 'family_payments', lastReceived: '2026-11-07T14:59:00Z', stuck: null, ignored: null }) });
    assert.deepEqual(f, { lastUpdate: '2026-11-07T14:59:00Z', feedsUnknown: false, failing: 0, disagree: 0, settingsToCheck: 0 });
  });
  it('a read that failed is a dash (null), never a zero', () => {
    const f = figureBand({ ...clean(), billing: null, drift: null, settings: null });
    assert.equal(f.feedsUnknown, true);
    assert.equal(f.failing, null);
    assert.equal(f.disagree, null);
    assert.equal(f.settingsToCheck, null);
    assert.equal(figureBand({ ...clean(), drift: { state: 'none' } }).disagree, null);
    assert.equal(figureBand({ ...clean(), drift: { ...clean().drift!, outcome: 'could_not_compare' } as WatchingStripeRead['drift'] }).disagree, null);
  });
  it('failures are counted across both feeds even when one feed could not be read', () => {
    assert.equal(figureBand({ ...clean(), billing: feed({ failing: 2 }), connect: feed({ key: 'family_payments', failing: 3, stuck: null, ignored: null }) }).failing, 5);
    assert.equal(figureBand({ ...clean(), billing: null, connect: feed({ key: 'family_payments', failing: 3, stuck: null, ignored: null }) }).failing, 3);
  });
  it('differing records show how many differ', () => {
    assert.equal(figureBand({ ...clean(), drift: { ...clean().drift!, outcome: 'differs', differenceCount: 11 } as WatchingStripeRead['drift'] }).disagree, 11);
  });
});

describe('stored error text', () => {
  it('a secret key in a stored error is never printed, in either place the text is shown', () => {
    const raw = 'Invalid API Key provided: sk_live_****abcd';
    assert.equal(shownError(raw), 'Invalid API Key provided: a Stripe key');
    assert.doesNotMatch(WS.drift.couldNot(raw), /sk_live|abcd/);
    assert.match(readCode('app/platform-admin/watching-stripe/page.tsx'), /shownError\(f\.error\)/);
  });
  it('a failure line is cut to the cap', () => {
    assert.equal(shownError('x'.repeat(500)).length, 200);
  });
});

describe('words', () => {
  it('a setting chip is said in words, and every audited check has a label and a pass sentence', () => {
    assert.deepEqual(settingChip('PASS'), { text: 'OK', tone: 'ok' });
    assert.equal(settingChip('FAIL').tone, 'bad');
    const keys = ['configuration', 'old_versions', 'payment_method_update', 'invoice_history', 'customer_update', 'subscription_update', 'subscription_cancel', 'subscription_pause'];
    for (const key of keys) {
      assert.ok(WS.settings.label[key], `${key}: label`);
      assert.notEqual(settingPassWords(key), 'As expected.', `${key}: pass sentence`);
    }
  });
  it('the audit’s check keys are exactly the labelled ones (a new check needs a label)', () => {
    const audit = readCode('scripts/lib/stripe-portal-audit.mjs');
    const used = new Set([...audit.matchAll(/check\('(?:PASS|WARN|FAIL)', 'portal', '(\w+)'/g)].map(m => m[1]));
    for (const m of audit.matchAll(/assert\('(\w+)'/g)) used.add(m[1]);
    for (const key of used) assert.ok(WS.settings.label[key], `${key} has no label on the Stripe page`);
  });
  it('set-aside words and the failure list', () => {
    assert.equal(WS.feeds.ignoredWords({ notOurs: 2, noCustomer: 1 }), '2 not ours, 1 with no customer');
    assert.equal(WS.feeds.ignoredWords({ notOurs: 0, noCustomer: 0 }), 'None');
    assert.equal(WS.drift.counted(1, 5), '1 difference across 5 records compared');
    assert.equal(WS.drift.counted(11, 22), '11 differences across 22 records compared');
  });
});
