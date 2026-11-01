import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stripeEnvironment, stripeKeyIsLive, stripeKeyIsTest } from '../../lib/stripe-mode.ts';
import { onlinePaymentsOn } from '../../lib/online-payments-switch.ts';
import { filesUnder, readCode } from './_source-code.ts';

/**
 * Plans & pricing Stage 0, Part 1 (S7): one live/test decision. A restricted live key (`rk_live_`) must read as live
 * everywhere a mode is chosen, or production checkout would pick sandbox prices the day the key is swapped.
 * Prompt: docs/projects/active/PLANS_PRICING_STAGE0_BUILD_PROMPT.md.
 */

describe('the live/test decision', () => {
  it('reads both secret and restricted keys', () => {
    assert.equal(stripeKeyIsLive('sk_live_x'), true);
    assert.equal(stripeKeyIsLive('rk_live_x'), true);
    assert.equal(stripeKeyIsLive('sk_test_x'), false);
    assert.equal(stripeKeyIsLive('rk_test_x'), false);
    assert.equal(stripeKeyIsTest('sk_test_x'), true);
    assert.equal(stripeKeyIsTest('rk_test_x'), true);
    assert.equal(stripeKeyIsTest('sk_live_x'), false);
    assert.equal(stripeKeyIsTest('rk_live_x'), false);
  });

  it('an empty or missing key is neither live nor test, and its environment is the sandbox', () => {
    for (const key of ['', undefined]) {
      assert.equal(stripeKeyIsLive(key), false);
      assert.equal(stripeKeyIsTest(key), false);
      assert.equal(stripeEnvironment(key), 'sandbox');
    }
  });

  it('the environment is live only for a live key', () => {
    assert.equal(stripeEnvironment('sk_live_x'), 'live');
    assert.equal(stripeEnvironment('rk_live_x'), 'live');
    assert.equal(stripeEnvironment('sk_test_x'), 'sandbox');
    assert.equal(stripeEnvironment('rk_test_x'), 'sandbox');
    assert.equal(stripeEnvironment('pk_live_x'), 'sandbox', 'a publishable key is never a server key');
  });

  it('a prefix is only a prefix', () => {
    assert.equal(stripeKeyIsLive('xsk_live_'), false);
    assert.equal(stripeKeyIsTest(' sk_test_x'), false);
  });
});

describe('the family-payments switch stays strict on purpose', () => {
  it('a restricted live key does not open family payments, even with the switch on', () => {
    assert.equal(onlinePaymentsOn({ ONLINE_PAYMENTS_ENABLED: 'true', STRIPE_SECRET_KEY: 'rk_live_x' }), false);
  });
  it('a restricted test key opens it in test mode, like a secret test key', () => {
    assert.equal(onlinePaymentsOn({ ONLINE_PAYMENTS_ENABLED: 'true', STRIPE_SECRET_KEY: 'rk_test_x' }), true);
  });
  it('its live branch still names sk_live_ alone', () => {
    assert.match(readCode('lib/online-payments-switch.ts'), /LIVE_PAYMENTS_ALLOWED && !!env\.STRIPE_SECRET_KEY\?\.startsWith\('sk_live_'\)/);
  });
});

describe('no other file reads a key prefix', () => {
  // The helper itself, and the one deliberate exception (above). Anything else is a second rule waiting to drift.
  const ALLOWED: Record<string, string> = {
    'lib/stripe-mode.ts': 'the one place the prefix is read',
    'lib/online-payments-switch.ts': 'onlinePaymentsOn stays on sk_live_ alone (family payments safety switch)',
  };
  const PREFIX = /\b(sk|rk)_(live|test)_|\(sk\|rk\)_|startsWith\(['"](sk|rk|pk)_/;

  it('app, lib, components and scripts carry no prefix test outside the allow-list', () => {
    const files = ['app', 'lib', 'components', 'scripts']
      .flatMap(dir => ['.ts', '.tsx', '.mjs', '.cjs', '.mts', '.js', '.jsx'].flatMap(ext => filesUnder(dir, ext)))
      .filter(f => !/\.test\.tsx?$/.test(f));
    const offenders = files.filter(f => !(f in ALLOWED) && PREFIX.test(readCode(f)));
    assert.deepEqual(offenders, [], 'decide live/test with lib/stripe-mode.ts, never a prefix test of your own');
  });
});
