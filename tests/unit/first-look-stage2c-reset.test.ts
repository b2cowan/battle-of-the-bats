/**
 * THE FIRST LOOK, STAGE 2c — the Continue page, forgot password and reset (owner Ask 8 2026-10-19; U3, U4 2026-10-20
 * with `/marketing`'s Reset screens row; three owner calls at the 2c gate, all as recommended; plan
 * docs/projects/archive/FIRST_LOOK_SIGNUP_PLAN.md).
 *
 * Pins: the four screens wear the one account step in the drawn words; a link that cannot be used has no screen of its
 * own (the Continue page's goes to sign-in, a reset link's to the forgot screen, both with the expired-link notice);
 * every safety the restyle had to keep is still there — the scanner-safe tap, the two link checks, the registration
 * return across the reset, and where a saved password lands; and no screen says "verify".
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode } from './_source-code.ts';
import { SIGN_IN_REASON, expiredResetLinkHref } from '../../lib/auth-errors.ts';

const confirm = readCode('app/(consumer)/auth/signup-confirm/page.tsx');
const forgot = readCode('app/(consumer)/auth/forgot-password/page.tsx');
const tap = readCode('app/(consumer)/auth/reset-confirm/page.tsx');
const reset = readCode('app/(consumer)/auth/reset-password/page.tsx');
const PAGES = { confirm, forgot, tap, reset };

describe('every Stage 2 screen is on the kit (only suspended wears the old card)', () => {
  it('the four pages wear the start column and the one loading line, never the old card or typewriter capitals', () => {
    for (const [name, src] of Object.entries(PAGES)) {
      assert.match(src, /from '@\/components\/auth\/AccountForm'/, name);
      assert.match(src, /<StartColumn>/, name);
      assert.match(src, /const LOADING = <StartColumn><LoadingState label="Loading [a-z ]+…" \/><\/StartColumn>;/, name);
      assert.doesNotMatch(src, /auth\.module\.css|var\(--font-data\)|var\(--logic-lime\)|iconWrap|submitBtn/, name);
    }
  });
  it('no customer word on them says "verify" (the code’s own verifyLink is not a word a customer reads)', () => {
    for (const [name, src] of Object.entries(PAGES)) {
      const words = src.replace(/verifyLink/g, '').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
      assert.doesNotMatch(words, /verif/i, name);
    }
  });
  it('the old stylesheet keeps only what suspended and the layout read', () => {
    const css = readCode('app/(consumer)/auth/auth.module.css');
    assert.doesNotMatch(css, /\.(form|pwWrap|pwToggle|error|footerLink)\b/);
    assert.match(css, /\.authSurface \{ min-width: 0; \}/);
  });
});

describe('the Continue page (F11, U3)', () => {
  it('says confirm, in the drawn words, and keeps the extra tap', () => {
    assert.match(confirm, /<StartHead title="Confirm your email" sub="One tap and you’re back to finish setting up\." \/>/);
    assert.match(confirm, /Confirm my email/);
    assert.match(confirm, /Already confirmed\?\{' '\}\s*<Link href="\/auth\/login" className=\{accountForm\.footLink\}>Sign in<\/Link>/);
    // the navigation happens on the tap only: a mail scanner that opens links cannot spend the one-time link
    assert.match(confirm, /onClick=\{\(\) => \{ window\.location\.href = link; \}\}/);
    assert.doesNotMatch(confirm, /href=\{link\}/);
  });
  it('a broken or missing link opens sign-in with the expired-link notice; no Create account door', () => {
    assert.match(confirm, /if \(!link\) router\.replace\(expiredLinkSignInHref\(null\)\);/);
    assert.match(confirm, /if \(!link\) return LOADING;/);
    assert.doesNotMatch(confirm, /\/auth\/signup|Create account/);
  });
});

describe('forgot password (U4 screens 1–3)', () => {
  it('the drawn words, the shared email field, the 48px lime button', () => {
    assert.match(forgot, /<StartHead title="Reset your password" sub="Enter your email and we’ll send you a link\." \/>/);
    assert.match(forgot, /<EmailField id="forgot-email"/);
    assert.match(forgot, /\{status === 'sending' \? 'Sending…' : 'Send me a reset link'\}/);
    assert.match(forgot, /Remembered it\?\{' '\}\s*<Link href=\{signInHref\}/);
    // owner at the 2c gate: the coach note is dropped, like sign-in's coach lines at 2b
    assert.doesNotMatch(forgot, /Coaches Portal account was\s+created/);
  });
  it('sent: the same answer for every address, the address in bold, the two ways out; the registration line for that coach only', () => {
    assert.match(forgot, /title="Check your email"/);
    assert.match(forgot, /If an account exists for <strong>\{email\}<\/strong>, a reset link is on its way\. Check your spam folder too\./);
    assert.match(forgot, /\{returnTo && ' Once you set a new password, you’ll come back to your registration\.'\}/);
    assert.match(forgot, /<StartFoot split>/);
    assert.match(forgot, /Use a different email/);
    assert.match(forgot, /Back to sign in/);
  });
  it('an unusable reset link lands here with the amber notice, gone once a new link is on its way', () => {
    assert.match(forgot, /const showExpired = searchParams\.get\('reason'\) === SIGN_IN_REASON\.expiredLink && !sentOnce;/);
    // under the notice the cursor stays out of the field, so a screen reader starts at the sentence
    // and held while sending, so "Check your email" names the address the link went to (/review 2026-10-20)
    assert.match(forgot, /<EmailField id="forgot-email" value=\{email\} onChange=\{setEmail\} autoFocus=\{!showExpired\} disabled=\{status === 'sending'\} \/>/);
    assert.match(forgot, /\{showExpired && \(\s*<div className=\{accountForm\.noticeWarn\} role="status">\s*<strong>That link has expired or was already used\.<\/strong>\{' '\}\s*Request a new one below\./);
  });
  it('a send that did not happen says so (owner at the 2c gate); it never shows "Check your email"', () => {
    assert.match(forgot, /if \(!res\.ok\) throw new Error/);
    assert.match(forgot, /<strong>We couldn’t send the link\.<\/strong>\{' '\}\s*Check your connection and try again\./);
    assert.ok(forgot.indexOf("setStatus('failed')") > forgot.indexOf('} catch {'), 'the failure is set in the catch');
    assert.ok(forgot.indexOf("setStatus('sent')") > forgot.indexOf('if (!res.ok) throw'), 'sent only after the route answered');
  });
  it('the registration return still rides to the route, checked', () => {
    assert.match(forgot, /const returnTo = registrationReturnPath\(searchParams\.get\('next'\)\);/);
    assert.match(forgot, /body: JSON\.stringify\(\{ email, \.\.\.\(returnTo \? \{ next: returnTo \} : \{\}\) \}\)/);
  });
});

describe('the reset tap page (U4 screen 4)', () => {
  it('the drawn words; Back to sign in keeps the registration', () => {
    assert.match(tap, /<StartHead title="Reset your password" sub="One tap and you can choose a new password\." \/>/);
    assert.match(tap, /Reset my password/);
    assert.match(tap, /<Link href=\{signInHrefFor\(returnTo \?\? ''\)\} className=\{accountForm\.footLink\}>Back to sign in<\/Link>/);
    assert.doesNotMatch(tap, /Set New Password|Request a new/);
  });
  it('keeps the Supabase-origin check, the tap-only navigation and the return stamp, exactly', () => {
    assert.match(tap, /if \(url\.origin !== provider\.origin\) return null;/);
    assert.match(tap, /if \(url\.protocol !== 'https:' && !\(url\.protocol === 'http:' && local\)\) return null;/);
    assert.match(tap, /const link = authActionLink\(searchParams\.get\('link'\)\);/);
    assert.match(tap, /if \(returnTo\) sessionStorage\.setItem\(RESET_RETURN_KEY, stampResetReturn\(returnTo\)\);\s*else sessionStorage\.removeItem\(RESET_RETURN_KEY\);/);
    assert.match(tap, /window\.location\.href = link;/);
    assert.doesNotMatch(tap, /href=\{link\}/);
  });
  it('a broken link opens the forgot screen with the notice, keeping the registration', () => {
    assert.match(tap, /if \(!link\) router\.replace\(expiredResetLinkHref\(returnTo\)\);/);
  });
});

describe('choose a new password (U4 screens 5–6)', () => {
  it('the shared password field labelled "New password", its rule as the hint; Save password', () => {
    assert.match(reset, /<StartHead title="Choose a new password" \/>/);
    assert.match(reset, /<PasswordField id="reset-password" label="New password"/);
    assert.match(reset, /\{loading \? 'Saving…' : 'Save password'\}/);
    assert.match(reset, /<StartHead title="Password saved" sub="Taking you to your account…" \/>/);
    assert.doesNotMatch(reset, /Eye|pwToggle|Password updated|Redirecting/);
  });
  it('the link reading and where a saved password lands are as they were', () => {
    assert.match(reset, /supabase\.auth\.exchangeCodeForSession\(code\)/);
    assert.match(reset, /supabase\.auth\.setSession\(\{ access_token: accessToken, refresh_token: refreshToken \}\)/);
    assert.match(reset, /returnTo = readResetReturn\(sessionStorage\.getItem\(RESET_RETURN_KEY\)\);\s*sessionStorage\.removeItem\(RESET_RETURN_KEY\);/);
    assert.match(reset, /dest = '\/platform-admin';/);
    assert.match(reset, /fetch\('\/api\/auth\/destination\?flow=password_reset'\)/);
  });
  it('an unusable link — and a save whose session is gone — opens the forgot screen with the notice', () => {
    assert.match(reset, /router\.replace\(expiredResetLinkHref\(returnTo\)\);/);
    // the note moves into the forgot screen's address and is cleared, so it never rides a later, unrelated reset
    assert.match(reset, /if \(pageState !== 'expired'\) return;[\s\S]{0,200}returnTo = readResetReturn\(sessionStorage\.getItem\(RESET_RETURN_KEY\)\);\s*sessionStorage\.removeItem\(RESET_RETURN_KEY\);/);
    // a failed code exchange asks for the session first: the client may have exchanged the code itself
    assert.match(reset, /const \{ data \} = await supabase\.auth\.getSession\(\);\s*setPageState\(data\.session \? 'ready' : 'expired'\);/);
    assert.match(reset, /if \(error\.name === 'AuthSessionMissingError' \|\| SESSION_GONE\.has\(error\.code \?\? ''\)\) \{\s*setPageState\('expired'\);/);
  });
  it('a refused save is an amber notice in plain words, never the provider’s own English (owner at the 2c gate)', () => {
    assert.match(reset, /\{failure && <div className=\{accountForm\.noticeWarn\} role="alert">\{failure\}<\/div>\}/);
    assert.match(reset, /case 'same_password':/);
    assert.match(reset, /case 'weak_password':/);
    assert.doesNotMatch(reset, /error\.message/);
  });
});

describe('the way back to the forgot screen', () => {
  it('carries the expired-link reason and a registration only when there is one', () => {
    assert.equal(expiredResetLinkHref(null), `/auth/forgot-password?reason=${SIGN_IN_REASON.expiredLink}`);
    assert.equal(
      expiredResetLinkHref('/acme/spring-classic/register'),
      `/auth/forgot-password?reason=${SIGN_IN_REASON.expiredLink}&next=%2Facme%2Fspring-classic%2Fregister`,
    );
  });
});
