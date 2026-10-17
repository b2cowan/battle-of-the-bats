/**
 * THE COACH SIGN-UP IS THROTTLED (2026-10-16; the second sweep's third finding). Added as the interim before "verify
 * every sign-up" and kept with it: each request now sends an email, so the limits also cap how often a stranger can
 * fill someone's inbox. Per source, per address, and a global ceiling — spent only by a well-formed request, before
 * the account is made (signup-verification-guard.test.ts holds the verification itself).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode } from './_source-code.ts';

const at = (src: string, needle: string) => { const i = src.indexOf(needle); assert.ok(i >= 0, `found: ${needle}`); return i; };

describe('the coach sign-up throttle', () => {
  const route = readCode('app/api/auth/coach-signup/route.ts');

  it('has the three limits', () => {
    assert.match(route, /const ipLimiter = new FixedWindowRateLimiter\(15 \* MINUTE, 15\);/);
    assert.match(route, /const emailLimiter = new FixedWindowRateLimiter\(60 \* MINUTE, 5\);/);
    assert.match(route, /const globalLimiter = new FixedWindowRateLimiter\(5 \* MINUTE, 60\);/);
  });

  it('refuses with 429 after the request is well-formed and before the account is made', () => {
    const check = at(route, "if (!ipLimiter.take(ip) || !emailLimiter.take(email) || !globalLimiter.take('global')) {");
    assert.ok(at(route, "return json({ error: 'Please enter a valid email address.' }, 400);") < check, 'after the shape checks');
    assert.ok(check < at(route, 'supabaseAdmin.auth.admin.createUser('), 'before the account is made');
    assert.match(route, /return json\(\{ error: 'Too many sign-up attempts\. Please wait a few minutes and try again\.' \}, 429\);/);
  });
});
