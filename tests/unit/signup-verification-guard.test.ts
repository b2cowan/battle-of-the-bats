/**
 * VERIFY EVERY SIGN-UP (owner ruling 2026-10-16; hub docs/projects/active/SIGNUP_EMAIL_VERIFICATION_HUB.html, V1–V3 as
 * recommended). Every new account proves its email by link before it is used; a live invitation emailed to the
 * address already proves it and stays instant. Closes the second sweep's third finding: an account made for someone
 * else's email collected the invitations and team claims later sent to it.
 *
 * These scans pin the one rule, the coach sign-up's order (check → verify or prove → create), the resend's safe link,
 * and that every screen handles the "check your email" answer. The route behaviour itself was proven by direct calls
 * with verification on (.probe/sv-route-probe.mjs 10/10, .probe/sv-invite-probe.mjs 3/3) and on dev with it off.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode } from './_source-code.ts';

const at = (src: string, needle: string) => { const i = src.indexOf(needle); assert.ok(i >= 0, `found: ${needle}`); return i; };

describe('one rule', () => {
  const lib = readCode('lib/signup-verification.ts');
  it('lives in lib/signup-verification.ts: production, or the explicit switch', () => {
    assert.match(lib, /export function shouldRequireEmailVerification\(\): boolean \{\s*const explicit = process\.env\.REQUIRE_SIGNUP_EMAIL_VERIFICATION;\s*if \(explicit !== undefined\) return explicit === 'true';\s*return process\.env\.NODE_ENV === 'production';/);
  });
  it('every sign-up reads it; none keeps a copy', () => {
    for (const f of ['app/api/auth/signup/route.ts', 'app/api/auth/team-signup/route.ts', 'app/api/auth/coach-signup/route.ts', 'app/api/auth/resend-verification/route.ts', 'app/api/register/account-check/route.ts']) {
      const src = readCode(f);
      assert.doesNotMatch(src, /function shouldRequireEmailVerification\(/, `${f} keeps no copy`);
      assert.match(src, /shouldRequireEmailVerification[,\s}][\s\S]*from '@\/lib\/signup-verification'/, `${f} imports the rule`);
    }
  });
  it('the email escapes what an anonymous form typed, and the link is wrapped against mail scanners', () => {
    // the built-in email escapes; a customised template escapes its variables itself, so it gets the raw name
    assert.match(lib, /orgName: continueName \? escapeHtml\(continueName\) : null,/);
    assert.match(lib, /firstName: p\.firstName \? escapeHtml\(p\.firstName\) : undefined,/);
    assert.match(lib, /vars: \{ verifyUrl, orgName: continueName \?\? 'your account' \},/);
    assert.match(lib, /`\$\{p\.origin\}\/auth\/signup-confirm\?link=\$\{encodeURIComponent\(p\.actionLink\)\}`/);
    // a start door's step 2 first (Account-First Sign-up, 2026-10-18), else a same-site path
    assert.match(lib, /return safeNextPath\(next, door \? startDoorLinkPath\(door\) : fallback\);/);
  });
  it('every sign-up sends the verification email through the one helper (simplify 2026-10-17)', () => {
    for (const f of ['app/api/auth/signup/route.ts', 'app/api/auth/team-signup/route.ts', 'app/api/auth/coach-signup/route.ts', 'app/api/auth/resend-verification/route.ts']) {
      const src = readCode(f);
      assert.doesNotMatch(src, /signup-confirm\?link=/, `${f} builds no confirm link of its own`);
      assert.doesNotMatch(src, /key: 'signup_verification'/, `${f} sends no verification email of its own`);
      assert.doesNotMatch(src, /\/auth\/callback\?next=/, `${f} builds no callback URL of its own`);
      assert.match(src, /sendSignupVerificationEmail\(/, `${f} uses the helper`);
    }
  });
});

describe('the coach sign-up', () => {
  const route = readCode('app/api/auth/coach-signup/route.ts');
  it('verifies unless off or a live invitation addressed to this email proves the inbox — before any account is made', () => {
    const gate = at(route, 'if (shouldRequireEmailVerification() && !(await inviteProvesEmail(body.inviteToken, email))) {');
    assert.ok(gate < at(route, 'supabaseAdmin.auth.admin.createUser('), 'the instant path comes after the verify branch');
    assert.match(route, /return !!invite && invite\.status === 'pending' && !invite\.expired && invite\.invitedEmail\.trim\(\)\.toLowerCase\(\) === email;/);
  });
  it('answers an existing account as before, never generating a signup link over it', () => {
    assert.ok(at(route, "if (await authAccountExistsForEmail(email)) return json({ error: 'email_exists' }, 409);") < at(route, "type: 'signup',"));
  });
  it('makes the account wait and says so; the link returns to the caller’s screen', () => {
    assert.match(route, /redirectTo: verificationRedirect\(origin, next\)/);
    // A start door's link returns to that door's step 2 (Account-First Sign-up, 2026-10-18); every other caller's own screen.
    assert.match(route, /const next = verificationReturnPath\(body\.next, '\/coaches', startDoor\);/);
    assert.match(route, /return json\(\{ ok: true, requiresEmailVerification: true, email \}\);/);
  });
  it('refuses a staff address and keeps its throttle', () => {
    assert.ok(at(route, 'if (await isPlatformAdminEmail(email))') < at(route, "type: 'signup',"));
    assert.ok(at(route, "if (!ipLimiter.take(ip) || !emailLimiter.take(email) || !globalLimiter.take('global'))") < at(route, "type: 'signup',"));
  });
});

describe('Send the link again', () => {
  const route = readCode('app/api/auth/resend-verification/route.ts');
  it('sends a magic link, never a new signup link (which would overwrite the waiting account’s password)', () => {
    assert.match(route, /type: 'magiclink',/);
    assert.doesNotMatch(route, /type: 'signup'/);
  });
  it('only to an account still waiting, with the same answer either way', () => {
    assert.match(route, /const user = await findAuthUserByEmail\(email\);\s*if \(!user \|\| user\.email_confirmed_at\) return NextResponse\.json\(SENT\);/);
    assert.match(route, /if \(!shouldRequireEmailVerification\(\) \|\| await isPlatformAdminEmail\(email\)\) return NextResponse\.json\(SENT\);/);
    assert.match(route, /if \(!ipLimiter\.take\(ip\) \|\| !emailLimiter\.take\(email\) \|\| !globalLimiter\.take\('global'\)\)/);
  });
});

describe('every sign-up refuses a staff address', () => {
  for (const f of ['app/api/auth/signup/route.ts', 'app/api/auth/team-signup/route.ts']) {
    it(f, () => {
      assert.match(readCode(f), /if \(await isPlatformAdminEmail\(normalizedEmail\)\) \{\s*return NextResponse\.json\(\{ error: 'This email address cannot be used to create an account\.' \}, \{ status: 403 \}\);/);
    });
  }
});

describe('the screens', () => {
  it('the two /start forms: one account step that names its door, shows the block and keeps entries', () => {
    // Account-first (2026-10-18): the name moved to step 2, so the link carries the door, not the name. The full
    // shape is pinned in account-first-signup.test.ts.
    const step = readCode('app/(consumer)/start/StartDoorForm.tsx');
    assert.match(step, /startDoor: door,/);
    assert.match(step, /setPassword\(''\);\s*setVerifyEmail\(emailNorm\);/);
    assert.match(step, /<VerifyEmailSent\s+tone="start"/);
    assert.match(step, /onChangeEmail=\{\(\) => setVerifyEmail\(null\)\}/);
    for (const [f, door] of [
      ['app/(consumer)/start/team/StartTeamForm.tsx', 'team'],
      ['app/(consumer)/start/league/StartLeagueForm.tsx', 'league'],
    ] as const) {
      assert.match(readCode(f), new RegExp(`<StartDoorForm door="${door}"`));
    }
  });
  it('the coach join page: returns to itself and, back from the link with nothing to choose, links the registration', () => {
    const src = readCode('app/coaches/join/page.tsx');
    assert.match(src, /next: verifyReturnPath\(\),/);
    assert.match(src, /<VerifyEmailSent\s+tone="auth"/);
    assert.match(src, /&verified=1`/);
  });
  it('the join page links only on a team list that LOADED, and sends one request per visit (review 2026-10-16)', () => {
    const src = readCode('app/coaches/join/page.tsx');
    // null = the list could not load — never "no teams", or a coach with teams gets a new profile on a blip.
    assert.match(src, /if \(verifiedParam && teams !== null && !teams\.some\(isChoosableTeam\)\) \{/);
    // a re-run of the effect awaits the request already sent instead of creating a second team profile
    assert.match(src, /autoLinkRef\.current \?\?= fetch\('\/api\/coaches\/basic-teams'/);
    assert.match(src, /const linked = await autoLinkRef\.current;/);
  });
  it('the email’s click-through page follows only a link to our own Supabase project (review 2026-10-16)', () => {
    const src = readCode('app/(consumer)/auth/signup-confirm/page.tsx');
    assert.match(src, /return url\.protocol === project\.protocol && url\.host === project\.host \? url\.href : null;/);
    assert.match(src, /const link = verifyLink\(searchParams\.get\('link'\)\);/);
    assert.doesNotMatch(src, /searchParams\.get\('link'\);/, 'the raw parameter is never followed');
  });
  it('the tournament form never answers a waiting account with "wrong password" (review 2026-10-16)', () => {
    const src = readCode('components/public/RegisterContent.tsx');
    assert.match(src, /if \(signInErr === 'email_not_confirmed'\) \{\s*await registerForWaitingAccount\(emailNorm\);\s*return;/);
    assert.match(src, /if \(waitingEmail === emailNorm\) \{\s*await registerForWaitingAccount\(emailNorm\);/);
    // the three ways to reach a waiting account share one answer: registration, then a fresh link
    assert.equal([...src.matchAll(/await registerForWaitingAccount\(emailNorm\);/g)].length, 3);
    const helper = src.slice(at(src, 'const registerForWaitingAccount = async'), at(src, 'if (!signedIn && verifies) {'));
    assert.ok(at(helper, 'setWaitingEmail(emailNorm);') < at(helper, 'await postRegistration();'), 'remembered before the registration can fail');
    assert.ok(at(helper, 'await postRegistration();') < at(helper, 'requestVerificationLink('), 'registration first (V2)');
    // the check-your-email address rides on the confirmation, so it can't outlive the registration it belongs to
    assert.match(src, /email=\{confirmation\.verifyEmail\}/);
    assert.doesNotMatch(src, /setVerifyEmail|setSuccessNote/, 'no separate verify/note state');
  });
  it('the assistant-invite page sends its invitation as the proof', () => {
    assert.match(readCode('app/(consumer)/auth/accept-assistant-invite/page.tsx'), /inviteToken: token \}\)/);
  });
  it('the tournament form: the registration goes FIRST, then the waiting account (V2); the card says check your email', () => {
    const src = readCode('components/public/RegisterContent.tsx');
    assert.match(src, /setVerifies\(data\.verifies === true\);/);
    const branch = src.slice(at(src, 'if (!signedIn && verifies) {'));
    assert.ok(at(branch, 'const registered = await postRegistration();') < at(branch, "fetch('/api/auth/coach-signup'"), 'registration before the account');
    assert.match(branch, /next: portalNext,\s*continueName: form\.teamName\.trim\(\),/);
    assert.match(src, /<VerifyEmailSent\s+tone="register"/);
    assert.match(src, /function registrationPortalPath\(registrationId: string \| undefined, email: string\): string \{/);
    assert.equal([...src.matchAll(/new FormData\(\)/g)].length, 1, 'one registration post, shared by both paths');
  });
  it('the org sign-up shows the same block, with resend (V3)', () => {
    // Run a tournament is the shared start form since Account-First Part 2 (2026-10-19) — the block above, tone
    // "start". The account-only sign-up on the same address keeps its own, returning where it was going.
    const src = readCode('app/(consumer)/auth/signup/page.tsx');
    assert.match(src, /return <StartAccountStep door="organization"/);
    assert.match(src, /<VerifyEmailSent\s+tone="auth"/);
    assert.match(src, /resendNext=\{safeNext \?\? '\/discover'\}/);
  });
});

describe('the block', () => {
  // The resend control is its own component since Account-First Sign-up (2026-10-18), shared with sign-in.
  const src = readCode('components/auth/ResendLink.tsx');
  const css = readCode('components/auth/VerifyEmailSent.module.css');
  it('resends through the safe route, and gives way to a sentence after a send (absent beats disabled)', () => {
    assert.match(readCode('components/auth/VerifyEmailSent.tsx'), /<ResendLink\b/);
    assert.match(src, /fetch\('\/api\/auth\/resend-verification'/);
    assert.match(src, /Sent again at \{clock\}\. Check your spam folder too\./);
    assert.match(src, /formatTime\(/, 'the house clock: lowercase, with periods');
  });
  it('its controls meet the 44px tap floor', () => {
    assert.match(css, /\.resend \{[^}]*min-height: 44px;/);
    assert.match(css, /\.sentAgain \{[^}]*min-height: 44px;/);
  });
});
