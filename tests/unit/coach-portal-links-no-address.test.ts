/**
 * Signed-in family accounts Stage 2, Part 3 (ask 2 = A): no email address inside a coach's portal link.
 *
 * Every coach EMAIL that links to the portal used to write the coach's address into the web address (the registration email,
 * the waitlist email, the accepted email, the schedule email, the night-before reminder, the organizer's invitation and
 * reminders). A forwarded email, a shared screenshot or a browser history showed it. The registrationId stays: it joins
 * the coach to their entry and on its own opens nothing. This guard is what keeps a ninth template from putting it back.
 *
 * ⚠ Source guards: `lib/email.ts` imports through the `@/` alias, which the node test runner cannot resolve, so the
 * builders are read, not called (the same reason every other email guard in this folder reads source).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, readCode } from './_source-code.ts';

const SOURCE = [
  ...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'),
  ...filesUnder('lib', '.ts'), ...filesUnder('components', '.tsx'),
].filter(f => !f.endsWith('.test.ts'));

describe('the portal link builders', () => {
  const email = readCode('lib/email.ts');

  it('coachPortalUrl takes no address and writes none', () => {
    const start = email.indexOf('export function coachPortalUrl(');
    const body = email.slice(start, email.indexOf('\n}', start) + 2);
    assert.ok(start > 0);
    assert.match(body, /p: \{ registrationId\?: string; registered\?: boolean \}/);
    assert.doesNotMatch(body, /email/i, 'no address parameter, no email query');
    assert.match(body, /params\.set\('registrationId', p\.registrationId\)/, 'the registration stays');
    assert.match(body, /params\.set\('registered', '1'\)/);
    assert.match(body, /params\.set\('next'/);
  });

  it('the footer every coach email wears takes no address either', () => {
    assert.match(email, /export function coachPortalFooter\(p: \{ registrationId\?: string \}\)/);
  });

  it('no caller hands either builder an address', () => {
    const offenders = SOURCE.filter(f => /coachPortal(?:Url|Footer)\(\{[^}]*\bemail\b[^}]*\}\)/.test(readCode(f)));
    assert.deepEqual(offenders, [], 'a coachPortalUrl / coachPortalFooter call that carries an email');
  });
});

describe('no link to the join page carries an address', () => {
  it('not in any string, anywhere in the app', () => {
    const offenders: string[] = [];
    for (const f of SOURCE) {
      for (const line of readCode(f).split('\n')) {
        if (/coaches\/join/.test(line) && /[?&]email=/.test(line)) offenders.push(`${f}: ${line.trim().slice(0, 140)}`);
      }
    }
    assert.deepEqual(offenders, []);
  });

  it('the senders of the organizer’s own access emails write the plain link', () => {
    for (const f of [
      'app/api/admin/tournaments/[tournamentId]/registrations/[regId]/resend-access/route.ts',
      'app/api/admin/tournaments/[tournamentId]/chat/remind-signups/route.ts',
    ]) {
      assert.match(readCode(f), /\/coaches\/join\?registrationId=\$\{encodeURIComponent\([\w.]+\)\}&next=/, f);
    }
  });

  it('the Register form’s confirm link returns to the join page with no address', () => {
    // One spelling, shared by the form and /api/register, which builds the link inside the registration email (Part 4).
    const routes = readCode('lib/coaches-portal-routes.ts');
    assert.match(routes, /export function registrationPortalPath\(registrationId: string \| undefined\): string/);
    for (const f of ['components/public/RegisterContent.tsx', 'app/api/register/route.ts']) {
      const src = readCode(f);
      assert.doesNotMatch(src, /function registrationPortalPath\(/, `${f} keeps no copy`);
      assert.doesNotMatch(src, /registrationPortalPath\([^)]*,/, `${f} passes only the id`);
    }
  });
});

describe('the join page asks for the address instead of reading it', () => {
  const join = readCode('app/coaches/join/page.tsx');

  it('reads no `email` from its own address', () => {
    assert.doesNotMatch(join, /searchParams\.get\('email'\)|emailParam/);
  });

  it('puts one email box first for a signed-out visitor with a registration', () => {
    assert.match(join, /title="Open your team"/);
    assert.match(join, /Enter the email you registered with\. We’ll take you to sign in, or set up your account if you don’t have one yet\./);
    assert.match(join, /if \(registrationId && !addressConfirmed\)/);
  });

  it('checks the typed address with the server before saying anything about an account', () => {
    assert.match(join, /registration-account-status\?registrationId=\$\{encodeURIComponent\(registrationId\)\}&email=\$\{encodeURIComponent\(typed\)\}/);
    assert.match(join, /if \(!status\.matches\)/);
    assert.match(join, /if \(status\.accountExists\) setExistingAccount\(/);
  });

  it('a waiting (unconfirmed) account is offered the link again, never "ready, sign in"', () => {
    assert.match(join, /waiting: !!status\.accountWaiting/);
    const start = join.indexOf('if (existingAccount?.waiting && registrationId)');
    const block = join.slice(start, join.indexOf('if (existingAccount && registrationId)'));
    assert.ok(start > -1, 'the waiting screen exists and comes before the "already set up" one');
    assert.match(block, /title="Confirm your email"/);
    assert.match(block, /<ResendLink/);
    assert.doesNotMatch(block, /is ready/);
  });

  it('"Sign in" from the already-set-up screen returns to the join page (which files the registration), not the portal', () => {
    assert.match(join, /const existingLoginHref = `\/auth\/login\?next=\$\{encodeURIComponent\(loginNext\)\}/);
  });

  it('tells a coach signed in as someone else, without naming the address the registration was made with', () => {
    const start = join.indexOf('if (signedInMismatch)');
    const block = join.slice(start, join.indexOf('if (signedInEmail && registrationId)'));
    assert.match(block, /which isn&apos;t linked to this registration/);
    assert.match(block, /Sign out &amp; use a different account/);
    assert.doesNotMatch(block, /invite is for|invited email/i);
  });

  it('the page’s own hand-offs (409, confirm return, sign-in) put no address in the join link', () => {
    assert.doesNotMatch(join, /coaches\/join\?[^`'"]*email=/);
  });
});

describe('the status route behind that box', () => {
  const route = readCode('app/api/coaches/registration-account-status/route.ts');

  it('has limits of its own: per source, together, and per registration', () => {
    assert.match(route, /const ipLimiter = new FixedWindowRateLimiter\(15 \* MINUTE, 20\)/);
    assert.match(route, /const globalLimiter = new FixedWindowRateLimiter\(5 \* MINUTE, 300\)/);
    assert.match(route, /const registrationLimiter = new FixedWindowRateLimiter\(15 \* MINUTE, 10\)/);
    assert.ok(route.indexOf('ipLimiter.take') < route.indexOf("searchParams.get('registrationId')"), 'the first limit is before anything is read');
    assert.ok(route.indexOf('registrationLimiter.take') < route.indexOf('getRegistrationAccountStatus({'), 'the per-registration limit is before the lookup');
  });

  it('answers only for the registration’s own address, and says nothing about any other', () => {
    assert.match(route, /if \(!status\) \{[\s\S]{0,200}?return json\(\{ matches: false, accountExists: false \}\)/);
    assert.match(route, /matches: true,\s*accountExists: status\.accountExists/);
  });

  it('a failed check is an error the page can say, never "no account" and never "wrong address"', () => {
    assert.match(route, /captureAndJson\(error, \{ error: 'We couldn’t check that just now\. Please try again\.' \}, 500\)/);
  });
});
