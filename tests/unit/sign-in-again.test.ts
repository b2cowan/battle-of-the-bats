/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * SIGN IN AGAIN (Plans & pricing Stage 0, Part 10; drawn and ruled 2026-11-02).
 *
 *   1. The clock (Ask 3): 10 minutes from the last time THIS SESSION proved the password, read from the session's own
 *      `amr` entry; a magic link, a recovery link or a bare RFC 8176 entry never counts.
 *   2. The gate's place (Asks 1, 2, 13c): on Bulk changes (every run) and on switching a Production price, AFTER the
 *      request's own checks and BEFORE its first write; not on Submit, not on a Test price.
 *   3. The window's password route checks THIS staff member's password: the address is the session's, never the body's.
 *   4. The audit page names the step's rows, and the owner's email kind is our own inbox mail (never logged).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { functionBody, readCode } from './_source-code.ts';
import {
  SIGN_IN_AGAIN_AUDIT, SIGN_IN_AGAIN_MINUTES, SIGN_IN_AGAIN_WORDS, isFreshPassword, passwordEnteredAt,
} from '../../lib/sign-in-again.ts';
import { EMAIL_KINDS } from '../../lib/email-kinds.ts';
import { auditReasonText } from '../../lib/platform-audit-reason.ts';

const NOW = Date.parse('2026-11-02T14:14:00Z');
const secondsAgo = (s: number) => Math.floor((NOW - s * 1000) / 1000);

describe('1 · the clock', () => {
  it('reads the password entry from the detailed amr form, the latest when there are several', () => {
    const amr = [{ method: 'password', timestamp: secondsAgo(3600) }, { method: 'password', timestamp: secondsAgo(60) }];
    assert.equal(passwordEnteredAt(amr), secondsAgo(60) * 1000);
  });

  it('never counts a sign-in that did not prove the password, or a form with no time', () => {
    assert.equal(passwordEnteredAt([{ method: 'otp', timestamp: secondsAgo(10) }]), null);
    assert.equal(passwordEnteredAt([{ method: 'recovery', timestamp: secondsAgo(10) }]), null);
    assert.equal(passwordEnteredAt(['pwd']), null);
    assert.equal(passwordEnteredAt(undefined), null);
    assert.equal(passwordEnteredAt([{ method: 'password', timestamp: 'yesterday' }]), null);
  });

  it(`counts for ${SIGN_IN_AGAIN_MINUTES} minutes, then asks`, () => {
    assert.equal(isFreshPassword(NOW - 9 * 60_000, NOW), true);
    assert.equal(isFreshPassword(NOW - SIGN_IN_AGAIN_MINUTES * 60_000, NOW), true);
    assert.equal(isFreshPassword(NOW - SIGN_IN_AGAIN_MINUTES * 60_000 - 1, NOW), false);
    assert.equal(isFreshPassword(null, NOW), false);
    assert.equal(isFreshPassword(NOW + 60_000, NOW), false, 'a time in the future does not count');
  });

  it('the window names the count it was asked about', () => {
    assert.match(SIGN_IN_AGAIN_WORDS.bulkLead(37), /^This changes 37 accounts at once/);
    assert.match(SIGN_IN_AGAIN_WORDS.bulkLead(1), /^This changes 1 account at once/);
    assert.equal(
      SIGN_IN_AGAIN_WORDS.priceLead('Club annual', 'price_1Nx', '$660.00 a year'),
      'From now on, new Club annual customers are charged price_1Nx ($660.00 a year). Customers on today’s price keep it. The switch is made as soon as your password is accepted.',
    );
    assert.doesNotMatch(SIGN_IN_AGAIN_WORDS.priceLead('Club annual', 'price_1Nx', null), /\(/, 'no amount is guessed');
  });
});

describe('2 · where the gate stands', () => {
  it('Bulk changes asks after every check and before the run is written', () => {
    const code = readCode('app/api/platform-admin/bulk-operations/route.ts');
    const gate = code.indexOf('requireFreshSignIn(auth.user)');
    assert.ok(gate > 0, 'Bulk changes no longer asks for the password again');
    for (const check of ['MAX_TARGETS', "'Reason is required'", 'lastDayRefusal(', "'Choose a valid target plan'", 'orgs.length !== orgIds.length']) {
      assert.ok(code.indexOf(check) < gate, `${check} must be checked before the password is asked`);
    }
    assert.ok(gate < code.indexOf(".from('platform_bulk_operations')"), 'the password is asked before the run is written');
    assert.ok(gate < code.indexOf("'run_bulk_operation'"), 'the password is asked before the change log row');
    assert.doesNotMatch(code.slice(gate - 200, gate), /if \(actionType/, 'every action asks, on every run (Ask 2)');
  });

  it('a Production price switch asks after the Stripe check and before its row; a Test price does not', () => {
    const body = functionBody(readCode('app/api/platform-admin/product-catalog/change-requests/route.ts'), 'applyStripePriceUpdateProposal');
    const gate = body.indexOf('requireFreshSignIn(actor)');
    assert.ok(gate > 0, 'switching a price no longer asks for the password again');
    assert.match(body.slice(body.lastIndexOf('if', gate), gate), /current\.environment === 'live'/, 'only a Production price asks');
    assert.ok(body.indexOf('validation.hardBlock') < gate, 'the Stripe check comes first');
    assert.ok(body.indexOf('currentPriceId !== proposal.currentPriceId') < gate, 'a stale request is refused first');
    assert.ok(gate < body.indexOf("'update_stripe_price_id'"), 'the password is asked before the change log row');
    assert.ok(gate < body.search(/\.from\('stripe_prices'\)\s*\.update/), 'the password is asked before the switch');
  });

  it('submitting a request never asks (Ask 1), but a Production price request needs its Why (Ask 13a)', () => {
    const code = readCode('app/api/platform-admin/product-catalog/change-requests/route.ts');
    const post = code.slice(code.indexOf('export const POST'), code.indexOf('export const PATCH'));
    assert.doesNotMatch(post, /requireFreshSignIn/);
    assert.match(post, /environment === 'live' && !priceProposal\.changeNote/);
  });
});

describe('3 · the window checks the signed-in staff member', () => {
  it('the address is the session’s, never the request’s', () => {
    const route = readCode('app/api/platform-admin/sign-in-again/route.ts');
    assert.match(route, /checkPasswordAgain\(auth\.user, password\)/);
    assert.doesNotMatch(route, /body\??\.email/);
    const check = functionBody(readCode('lib/platform-sign-in-again.ts'), 'checkPasswordAgain');
    assert.match(check, /const email = user\.email!/);
    assert.match(check, /result\.data\.user\?\.id === user\.id/, 'a sign-in as anyone else is never accepted');
  });

  it('the gate reads the session’s own sign-in record, verified, never the account-wide last sign-in', () => {
    const gate = functionBody(readCode('lib/platform-sign-in-again.ts'), 'requireFreshSignIn');
    assert.match(gate, /auth\.getClaims\(\)/);
    assert.match(gate, /claims\.sub === user\.id/);
    assert.doesNotMatch(gate, /last_sign_in_at/);
  });
});

describe('4 · the record', () => {
  it('the audit page names each row of the step', () => {
    const page = readCode('app/platform-admin/audit/page.tsx');
    assert.match(page, new RegExp(`${SIGN_IN_AGAIN_AUDIT.signedIn}: 'Signed in again'`));
    assert.match(page, new RegExp(`${SIGN_IN_AGAIN_AUDIT.wrongPassword}: 'Sign in again: wrong password'`));
    assert.match(page, new RegExp(`${SIGN_IN_AGAIN_AUDIT.ownerEmailNotSent}: 'Owner email: not sent'`));
  });

  it('its rows carry no reason of their own, so the audit log never reads them "Not recorded"', () => {
    for (const action of Object.values(SIGN_IN_AGAIN_AUDIT)) {
      assert.deepEqual(auditReasonText(action, null), { text: null, notRecorded: false }, action);
    }
  });

  it('the owner email is our own inbox mail', () => {
    assert.equal(EMAIL_KINDS.staff_change_alert.klass, 'inbox');
  });
});
