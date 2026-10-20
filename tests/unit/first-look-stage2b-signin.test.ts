/**
 * THE FIRST LOOK, STAGE 2b — sign-in and the way back into it (owner Ask 8 2026-10-19; U1, U2, U3, U7 2026-10-20 with
 * `/marketing`'s read; four owner calls at the 2b gate, all as recommended; plan docs/projects/active/FIRST_LOOK_SIGNUP_PLAN.md).
 *
 * Pins: sign-in wears the one account step and keeps the ids the UAT scenarios sign in with; each refusal is the
 * drawn notice in the drawn place; a link that fails at the callback reaches sign-in with its reason while every
 * success path is untouched; the three 409 hand-offs say why; and "Email me a new link" never claims it sent one.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode } from './_source-code.ts';
import { SIGN_IN_ERROR_COPY, SIGN_IN_REASON, accountExistsSignInHref, expiredLinkSignInHref } from '../../lib/auth-errors.ts';

const page = readCode('app/(consumer)/auth/login/page.tsx');

describe('sign-in is the one account step (F04)', () => {
  it('the start column, the shared fields and the one loading line; no card, no typewriter capitals', () => {
    assert.match(page, /<StartHead title="Sign in" sub="Welcome back\." \/>/);
    assert.match(page, /<EmailField\s+id="login-email"/);
    assert.match(page, /<PasswordField id="login-password" purpose="current"/);
    assert.match(page, /id="login-submit"/);
    assert.match(page, /\{loading \? 'Signing in…' : 'Sign in'\}/);
    assert.match(page, /const LOADING = <StartColumn><LoadingState label="Loading sign-in…" \/><\/StartColumn>;/);
    assert.match(page, /<Suspense fallback=\{LOADING\}>/);
    assert.doesNotMatch(page, /auth\.module\.css|HudSkeleton|CHECKING SESSION|VERIFYING CREDENTIALS|Authenticating/);
  });
  it('one foot link, which keeps where the person was headed (owner, 2b gate)', () => {
    assert.match(page, /New here\?\{' '\}\s*<Link href=\{getStartedHref\}/);
    assert.match(page, /safeNext \? `\/auth\/signup\?account=1&next=\$\{encodeURIComponent\(safeNext\)\}` : '\/start'/);
    assert.doesNotMatch(page, /Create a free account|Run a tournament|Invited by an organization|Coaches Portal/);
  });
  it('the next handling, the loop breaker and the demo account’s local sign-out are as they were', () => {
    assert.match(page, /const NEXT_LOOP_WINDOW_MS = 10_000;/);
    assert.match(page, /resolveLoginDestination\(consumeNextOnce\(searchParams\.get\('next'\)\)\)/);
    assert.match(page, /signOut\(\{ scope: 'local' \}\)/);
  });
});

describe('every refusal says the way forward (U1, the waiting account, D-F9)', () => {
  it('a wrong password is the one red notice, its way forward right under it', () => {
    assert.match(page, /error === 'invalid_credentials' \? \(\s*<div className=\{accountForm\.noticeError\} role="alert">\s*<strong>That email and password don’t match\.<\/strong>\{' '\}\s*Try again, or use “Forgot your password\?” below\./);
    // the notice comes before the Forgot row, which comes before the button
    const notice = page.indexOf('accountForm.noticeError');
    const forgot = page.indexOf('accountForm.forgotRow');
    const submit = page.indexOf('id="login-submit"');
    assert.ok(notice < forgot && forgot < submit);
  });
  it('the Forgot row is hidden for a waiting account (owner, 2b gate) and carries the destination', () => {
    assert.match(page, /\{!waitingEmail && \(\s*<div className=\{accountForm\.forgotRow\}>/);
    assert.match(page, /`\/auth\/forgot-password\?next=\$\{encodeURIComponent\(next\)\}`/);
  });
  it('any other failure is amber in its own sentence (owner, 2b gate), and no shared line says "verify"', () => {
    assert.match(page, /\) : error \? \(\s*<div className=\{accountForm\.noticeWarn\} role="alert">\{SIGN_IN_ERROR_COPY\[error\] \?\? error\}<\/div>/);
    for (const line of Object.values(SIGN_IN_ERROR_COPY)) assert.doesNotMatch(line, /verif/i);
    // Supabase's own rate-limit code reaches every sign-in screen as the one the copy is keyed on (it showed raw before)
    assert.match(readCode('lib/auth.ts'), /if \(authError\.code === 'over_request_rate_limit'\) return \{ error: 'too_many_requests' \};\s*if \(authError\.code\) return/);
  });
  it('the notice is the kit’s: olive by default, amber, and red composing the one error box', () => {
    const kit = readCode('components/auth/AccountForm.module.css');
    // the neutral notice wears the callout's own olive edge; the red one .error's
    assert.match(kit, /\.notice \{\s*composes: callout;/);
    assert.match(kit, /\.callout \{[^}]*border-left: 3px solid var\(--home-olive\);/);
    // each variant names the box itself (Turbopack's composes is not transitive: `composes: notice` alone drew no box)
    assert.match(kit, /\.noticeWarn \{\s*composes: callout notice;\s*border-left-color: var\(--home-notice-amber\);/);
    assert.match(kit, /\.noticeError \{\s*composes: callout notice error;/);
    assert.match(kit, /\.error \{\s*composes: callout;\s*border-left-color: var\(--home-live\);/);
    assert.match(kit, /\.noticeSent \{\s*composes: callout notice;/);
    const warm = readCode('components/consumer/warmTheme.module.css');
    assert.match(warm, /--home-notice-amber: #B7791F;/);
    assert.match(warm, /--home-notice-amber: var\(--warning\);/);
  });
});

describe('a link that cannot be used reaches sign-in with its reason (F09, U3, U7)', () => {
  const callback = readCode('app/(consumer)/auth/callback/page.tsx');
  it('every success path is as it was', () => {
    assert.match(callback, /const \{ error \} = await supabase\.auth\.exchangeCodeForSession\(code\);\s*if \(!error\) \{\s*router\.replace\(next\);\s*return;/);
    assert.match(callback, /access_token: accessToken,\s*refresh_token: refreshToken,\s*\}\);\s*if \(!error\) \{\s*router\.replace\(next\);\s*return;/);
  });
  it('a backed-out sign-in stays plain; every other fall-through carries the reason and where the link was headed', () => {
    assert.match(callback, /if \(errorName === 'access_denied' && !errorCode\) \{\s*router\.replace\('\/auth\/login'\);\s*return;/);
    assert.match(callback, /const headed = safeNextPath\(searchParams\.get\('next'\), null\);/);
    assert.match(callback, /router\.replace\(expiredLinkSignInHref\(headed\)\);/);
    // an organization invitation's failed link goes to its own expired screen ("Set a password"), never sign-in's
    // "send yourself a new one", which would send a confirmation email or nothing (owner, 2b review)
    assert.match(callback, /if \(headed && headed\.split\('\?'\)\[0\] === '\/auth\/accept-invite'\) \{\s*router\.replace\(headed\);\s*return;/);
    assert.match(readCode('lib/invite-links.ts'), /return `\/auth\/accept-invite\?\$\{qs\.toString\(\)\}`;/, 'the path the callback matches');
    assert.match(readCode('app/(consumer)/auth/accept-invite/AcceptInviteForm.tsx'), /title="This invitation link has expired"/);
    assert.equal(expiredLinkSignInHref('/start/team'), '/auth/login?reason=expired-link&next=%2Fstart%2Fteam');
    assert.equal(expiredLinkSignInHref(null), '/auth/login?reason=expired-link');
  });
  it('sign-in shows the amber notice only for that reason, and "Email me a new link" says "if", never "sent"', () => {
    assert.equal(SIGN_IN_REASON.expiredLink, 'expired-link');
    assert.match(page, /<strong>That link has expired or was already used\.<\/strong>\{' '\}\s*Sign in, or send yourself a new one\./);
    // keyed on the address, so a corrected address can send at once
    assert.match(page, /\{expiredLink && !waitingEmail && \(\s*<ResendLink[\s\S]{0,260}?key=\{email\.trim\(\)\.toLowerCase\(\)\}\s+email=\{email\.trim\(\)\.toLowerCase\(\)\}\s+next=\{next \?\? undefined\}\s+label="Email me a new link"\s+onMissingEmail=\{\(\) => setMissingEmail\(true\)\}/);
    assert.match(page, /<strong>Check your email\.<\/strong>\{' '\}If that address is waiting to be confirmed, a new link is on its way\. Check your spam folder too\./);
    assert.match(page, /Enter your email address first\./);
    const resend = readCode('components/auth/ResendLink.tsx');
    assert.match(resend, /if \(onMissingEmail && !email\.trim\(\)\) \{ onMissingEmail\(\); return; \}/);
    assert.match(resend, /<div className=\{classes\.sent\} role="status">\{sentNotice\}<\/div>/);
  });
});

describe('a sign-up hands an existing address to sign-in with the reason (U2)', () => {
  it('the one hand-off keeps the address and the destination', () => {
    assert.equal(
      accountExistsSignInHref('/start/team?step=2', 'a@b.co'),
      '/auth/login?next=%2Fstart%2Fteam%3Fstep%3D2&email=a%40b.co&reason=account-exists',
    );
  });
  it('all three doors that send a 409 to sign-in use it', () => {
    for (const f of ['app/(consumer)/start/StartDoorForm.tsx', 'app/coaches/join/page.tsx', 'app/(consumer)/auth/accept-assistant-invite/page.tsx']) {
      assert.match(readCode(f), /router\.push\(accountExistsSignInHref\(/, f);
    }
  });
  it('sign-in shows the olive notice above the fields, and not over a later refusal', () => {
    assert.match(page, /reason === SIGN_IN_REASON\.accountExists && !error && !loading \? \(\s*<div className=\{accountForm\.notice\} role="status">\s*<strong>You already have an account with that email\.<\/strong>\{' '\}\s*Sign in below\./);
    assert.ok(page.indexOf('SIGN_IN_REASON.accountExists') < page.indexOf('<EmailField'));
  });
});
