/**
 * Signed-in family accounts Stage 2, Part 1 (ask 4 = A): the tournament Register form gets a limit of its own.
 *
 * Same numbers and same words as the family forms, but its own buckets in both directions (a coach registering
 * a team never spends a family's budget, nor the other way round), and the first step's account check keeps
 * the limits it already had.
 *
 * ⚠ Source guards, not behaviour: `lib/rate-limit.ts` declares a TypeScript parameter property, which the node test
 * runner's strip-only mode cannot load, so no test can import the limiter (the Stage 7 Part 8 lead-form guard reads
 * source for the same reason).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';

const throttle = readCode('lib/public-form-throttle.ts');
const route = readCode('app/api/register/route.ts');

/** One top-level function's text: from its declaration to the first closing brace in column 0. */
const functionBody = (code: string, name: string): string => {
  const start = code.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' exists');
  return code.slice(start, code.indexOf('\n}', start) + 2);
};

describe('Register form · its own limit', () => {
  it('has buckets of its own with the family forms’ numbers: 30 an hour per source, 150 in five minutes together, 8 an hour per address', () => {
    assert.match(throttle, /const registerIpLimiter = new FixedWindowRateLimiter\(60 \* MINUTE, 30\)/);
    assert.match(throttle, /const registerGlobalLimiter = new FixedWindowRateLimiter\(5 \* MINUTE, 150\)/);
    assert.match(throttle, /const registerRecipientLimiter = new FixedWindowRateLimiter\(60 \* MINUTE, 8\)/);
  });

  it('refuses with a 429 in the one sentence every public form uses', () => {
    assert.match(throttle, /export const TOO_MANY = 'Too many attempts\. Please wait a few minutes and try again\.'/);
    for (const name of ['throttleRegisterForm', 'throttleRegisterRecipient']) {
      const body = functionBody(throttle, name);
      assert.match(body, /NextResponse\.json\(\{ error: TOO_MANY \}, \{ status: 429 \}\)/, `${name} refuses in the shared words`);
    }
  });

  it('spends only its own buckets, and the family forms’ buckets are untouched', () => {
    assert.match(functionBody(throttle, 'throttleRegisterForm'), /registerIpLimiter\.take\(clientIpFrom\(req\)\) \|\| !registerGlobalLimiter\.take\('global'\)/);
    assert.match(functionBody(throttle, 'throttleRegisterRecipient'), /registerRecipientLimiter\.take\(/);
    assert.doesNotMatch(functionBody(throttle, 'throttleRegisterForm'), /\b(ipLimiter|globalLimiter|recipientLimiter|lead\w+Limiter)\b/);
    assert.doesNotMatch(functionBody(throttle, 'throttleRegisterRecipient'), /\b(recipientLimiter|ipLimiter)\b/);
    assert.match(throttle, /const ipLimiter = new FixedWindowRateLimiter\(60 \* MINUTE, 30\)/);
    assert.match(throttle, /const globalLimiter = new FixedWindowRateLimiter\(5 \* MINUTE, 150\)/);
    assert.match(throttle, /const recipientLimiter = new FixedWindowRateLimiter\(60 \* MINUTE, 8\)/);
    assert.match(functionBody(throttle, 'throttlePublicForm'), /!ipLimiter\.take\(clientIpFrom\(req\)\) \|\| !globalLimiter\.take\('global'\)/);
    assert.match(functionBody(throttle, 'throttlePublicFormRecipient'), /!recipientLimiter\.take\(/);
  });
});

describe('Register form · where the limit sits', () => {
  it('is the first thing the handler does, before the body is read', () => {
    assert.match(route, /throttleRegisterForm\(req\)/);
    assert.ok(route.indexOf('throttleRegisterForm(req)') < route.indexOf('parseRegistrationRequest(req)'), 'the throttle comes first');
  });

  it('checks the address as soon as it is known, before anything is looked up, written or sent', () => {
    assert.match(route, /throttleRegisterRecipient\(email\)/);
    const at = route.indexOf('throttleRegisterRecipient(email)');
    assert.ok(at > route.indexOf('const email = cleanString(body.email)'), 'after the address is read');
    assert.ok(at < route.indexOf('isPlatformAdminEmail(email)'), 'before any lookup');
    const handler = route.indexOf('export const POST');
    assert.ok(at < route.indexOf('supabaseAdmin', handler), 'before the first database call in the handler');
  });

  it('leaves the first step’s account check on its own limits', () => {
    const check = readCode('app/api/register/account-check/route.ts');
    assert.match(check, /const ipLimiter = new FixedWindowRateLimiter\(15 \* MINUTE, 30\)/);
    assert.match(check, /const globalLimiter = new FixedWindowRateLimiter\(5 \* MINUTE, 300\)/);
    assert.match(check, /const emailLimiter = new FixedWindowRateLimiter\(15 \* MINUTE, 10\)/);
    assert.doesNotMatch(check, /public-form-throttle/);
  });

  it('shows a refusal in the form’s existing error card, verbatim', () => {
    const form = readCode('components/public/RegisterContent.tsx');
    // the route's error becomes the thrown message, which the catch puts in the card
    assert.match(form, /throw new Error\(error \?\? 'Registration failed'\)/);
    assert.match(form, /setErrorMsg\(err instanceof Error \? err\.message/);
  });
});
