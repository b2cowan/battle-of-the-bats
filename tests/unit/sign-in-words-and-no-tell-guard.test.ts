/**
 * ONE SET OF SIGN-IN WORDS, AND NO-TELL ROUTES THAT CANNOT BE COUNTED OR TIMED (owner, 2026-10-20, after the First Look
 * 2c review's findings).
 *
 * Pins: every screen that signs someone in with a password words a failure through `signInErrorCopy` (the shared map, a
 * screen's own override, else one fallback sentence), so no screen keeps its own old copy ("Incorrect email or
 * password", "Please verify…") or shows a raw code; forgot password has the same budget as "Send the link again" and
 * says so as a wait; and both no-tell routes answer no sooner than a fixed floor, so a found account is not slower.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode } from './_source-code.ts';
import { SIGN_IN_ERROR_COPY, SIGN_IN_ERROR_FALLBACK, signInErrorCopy } from '../../lib/auth-errors.ts';
import { holdUntilFloor } from '../../lib/no-tell-floor.ts';

const SIGN_IN_SCREENS = [
  'app/(consumer)/auth/login/page.tsx',
  'components/public/RegisterContent.tsx',
  'app/team/TeamSignupClient.tsx',
  'app/platform-admin/login/page.tsx',
  'app/(consumer)/auth/signup/AccountOnlySignup.tsx',
];

describe('one set of sign-in words', () => {
  it('the shared map, then a screen’s override, then one fallback — never the code itself', () => {
    assert.equal(signInErrorCopy('invalid_credentials'), SIGN_IN_ERROR_COPY.invalid_credentials);
    assert.equal(signInErrorCopy('invalid_credentials', { invalid_credentials: 'Own words.' }), 'Own words.');
    assert.equal(signInErrorCopy('some_new_provider_code'), SIGN_IN_ERROR_FALLBACK);
    assert.equal(signInErrorCopy('Database error querying schema'), SIGN_IN_ERROR_FALLBACK);
    assert.doesNotMatch(SIGN_IN_ERROR_FALLBACK, /verif/i);
  });
  it('every password sign-in screen words its failure through signInErrorCopy and keeps no copy of its own', () => {
    for (const f of SIGN_IN_SCREENS) {
      const src = readCode(f);
      assert.match(src, /signInErrorCopy\(/, `${f} uses the one set of words`);
      assert.doesNotMatch(src, /Incorrect email or password|Please verify your email|Account not yet confirmed|check your credentials/i, f);
      assert.doesNotMatch(src, /\b(ERROR_MAP|AUTH_ERRORS)\b/, `${f} keeps no map of its own`);
      assert.doesNotMatch(src, /SIGN_IN_ERROR_COPY\[[^\]]+\]\s*\?\?/, `${f} looks up through the helper, so a code never shows raw`);
    }
  });
});

describe('forgot password and "Send the link again" cannot be counted or timed', () => {
  const forgot = readCode('app/api/auth/forgot-password/route.ts');
  const resend = readCode('app/api/auth/resend-verification/route.ts');
  it('forgot password has the resend route’s budget: three an hour per address, ten per network in 15 minutes, a ceiling', () => {
    for (const limiter of [
      /const ipLimiter = new FixedWindowRateLimiter\(15 \* MINUTE, 10\);/,
      /const emailLimiter = new FixedWindowRateLimiter\(60 \* MINUTE, 3\);/,
      /const globalLimiter = new FixedWindowRateLimiter\(5 \* MINUTE, 60\);/,
    ]) {
      assert.match(forgot, limiter);
      assert.match(resend, limiter);
    }
    assert.match(forgot, /if \(!ipLimiter\.take\(clientIpFrom\(req\)\) \|\| !emailLimiter\.take\(email\) \|\| !globalLimiter\.take\('global'\)\) \{\s*return NextResponse\.json\(\{ error: [^}]+\}, \{ status: 429 \}\);/);
  });
  it('both answer their no-tell 200 no sooner than the floor', () => {
    assert.match(forgot, /try \{\s*await sendReset\(req, email, body\.next\);\s*\} finally \{[\s\S]{0,200}await holdUntilFloor\(startedAt\);\s*\}/);
    assert.match(forgot, /if \(!email\) \{\s*await holdUntilFloor\(startedAt\);/);
    assert.match(resend, /const res = await resend\(req\);[\s\S]{0,300}if \(res\.ok\) await holdUntilFloor\(startedAt\);/);
  });
  it('the floor holds an early answer and lets a late one go at once', async () => {
    let t = Date.now();
    await holdUntilFloor(t, 60);
    assert.ok(Date.now() - t >= 55, 'an early answer waits for the floor');
    t = Date.now();
    await holdUntilFloor(t - 1000, 60);
    assert.ok(Date.now() - t < 30, 'an answer already past the floor is not held');
  });
  it('the platform admin’s own "forgot password" never says sent when the route refused (review 2026-10-20)', () => {
    const src = readCode('app/platform-admin/login/page.tsx');
    assert.match(src, /if \(res\.status === 429\) \{ setResetError\([^)]+\); return; \}\s*if \(!res\.ok\) \{ setResetError\([^)]+\); return; \}\s*setResetSent\(true\);/);
  });
  it('the forgot page says a limit is a wait, not a lost connection', () => {
    const page = readCode('app/(consumer)/auth/forgot-password/page.tsx');
    assert.match(page, /if \(res\.status === 429\) \{ setStatus\('limited'\); return; \}/);
    assert.match(page, /\{status === 'limited' && \(\s*<div className=\{accountForm\.noticeWarn\} role="alert">\s*<strong>Too many tries\.<\/strong>/);
  });
});
