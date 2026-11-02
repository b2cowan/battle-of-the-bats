/**
 * ONE EMAIL, NOT TWO (Signed-in family accounts Stage 2, Part 4; ask 1 = A, ruled 2026-11-01; drawing tabs 1–2,
 * docs/projects/active/SIGNED_IN_FAMILY_STAGE2_DRAWINGS.html).
 *
 * A new coach registering signed out on the live site used to get "Registration Received" (which said their portal account
 * "is ready" while it waited for its email) and then "Confirm your FieldLogicHQ email". Now /api/register makes the waiting
 * account itself, after the entry is filed and the organizer's alert has left, and sends ONE email with the confirm button
 * in it. In one request: a coach email held for a second call from the browser would be lost with a closed tab, and no
 * test could cover a call that never arrives.
 *
 * Pinned here: every row of the drawing's table (lib/registration-email-plan.ts, run, not read), the invariant that a
 * confirm link that was made always goes out, the email's words as rendered, and the route's and form's order (source).
 * The account is made for the registration's OWN address in the same request, so there is no registration id from the
 * browser to check against an address: the prompt's "match refusal" has nothing to refuse in this design.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode } from './_source-code.ts';
import {
  planCoachRegistrationEmails, registrationEmailSubject, registrationPortalPanelHtml, type RegistrationAccountOutcome,
} from '../../lib/registration-email-plan.ts';
import { registrationPortalPath } from '../../lib/coaches-portal-routes.ts';

const at = (src: string, needle: string) => { const i = src.indexOf(needle); assert.ok(i >= 0, `found: ${needle}`); return i; };

/** What the route hands the plan for an account step outcome: only a made link counts. */
const plan = (o: { confirmationOn?: boolean; customised?: boolean; link: boolean }) =>
  planCoachRegistrationEmails({ confirmationOn: o.confirmationOn ?? true, customised: o.customised ?? false, confirmLink: o.link });

describe('the drawing’s table, row by row', () => {
  it('a new coach, team goes in: one email with Confirm my email inside', () => {
    assert.deepEqual(plan({ link: true }), ['registration_with_confirm']);
  });
  it('a new coach, division full: the same one email (the waitlist builder takes the same panel)', () => {
    assert.deepEqual(plan({ link: true }), ['registration_with_confirm']);
    const email = readCode('lib/email.ts');
    const waitlist = email.slice(at(email, 'export function waitlistConfirmationHtml('), at(email, 'export function rejectionHtml('));
    assert.match(waitlist, /\$\{p\.confirmUrl \? registrationPanelHtml\(p\) : coachPortalFooter\(\{ registrationId: p\.registrationId \}\)\}/);
  });
  it('already signed in, or a manager registering for a head coach: one email, Open your Coaches Portal', () => {
    assert.deepEqual(plan({ link: false }), ['registration']);
  });
  it('the address already has an account: the confirm panel while it waits, the signed-in email once confirmed', () => {
    assert.deepEqual(plan({ link: true }), ['registration_with_confirm'], 'waiting: a fresh link');
    assert.deepEqual(plan({ link: false }), ['registration'], 'confirmed: no link');
  });
  it('the organizer switched off the coach confirmation: no registration email, the confirm email still goes', () => {
    assert.deepEqual(plan({ confirmationOn: false, link: true }), ['confirm_only']);
    assert.deepEqual(plan({ confirmationOn: false, link: false }), [], 'as today: nothing was asked of this coach');
  });
  it('the registration email customised in platform admin: still two emails, custom words have no place for the panel', () => {
    assert.deepEqual(plan({ customised: true, link: true }), ['registration', 'confirm_only']);
    assert.deepEqual(plan({ customised: true, link: false }), ['registration']);
  });
});

describe('a confirm link that was made is never dropped (the zero-emails invariant)', () => {
  const bools = [true, false];
  it('in every combination of switch, template and link', () => {
    for (const confirmationOn of bools) for (const customised of bools) for (const confirmLink of bools) {
      const sent = planCoachRegistrationEmails({ confirmationOn, customised, confirmLink });
      const label = JSON.stringify({ confirmationOn, customised, confirmLink });
      if (confirmLink) assert.ok(sent.includes('registration_with_confirm') || sent.includes('confirm_only'), `${label} carries the link`);
      if (confirmationOn) assert.ok(sent.length >= 1, `${label} sends the coach something`);
      if (customised) assert.ok(!sent.includes('registration_with_confirm'), `${label} never puts the panel in custom words`);
      assert.equal(new Set(sent).size, sent.length, `${label} sends nothing twice`);
      assert.ok(!(sent.includes('registration') && sent.includes('registration_with_confirm')), `${label} one registration email`);
    }
  });

  // Every way the account step can fail ends in one of these outcomes with no link (lib/registration-account.ts below):
  // the coach still gets the registration email, whose Open your Coaches Portal sets an account up.
  const failures: Array<[string, RegistrationAccountOutcome]> = [
    ['throttled', 'failed'], ['bad password or name', 'failed'], ['sign-in service error', 'failed'], ['thrown', 'failed'],
    ['made between lookup and link (422)', 'exists'], ['waiting, but its fresh link failed', 'exists'],
  ];
  for (const [branch] of failures) {
    it(`account step ${branch}: the registration email still goes`, () => {
      assert.deepEqual(plan({ link: false }), ['registration']);
    });
  }

  it('the account step returns one of those outcomes on every failure and never throws', () => {
    const lib = readCode('lib/registration-account.ts');
    assert.match(lib, /if \(p\.password\.length < 8 \|\| !p\.firstName \|\| !p\.lastName\) return FAILED;/);
    assert.match(lib, /if \(!takeCoachSignupBudget\(p\.ip, p\.email\)\) \{\s*console\.warn\([^;]*;\s*return FAILED;\s*\}/);
    assert.match(lib, /if \(error\?\.status === 422\) return \{ outcome: 'exists', actionLink: null \};/);
    // no mail service: no account left waiting for an email that cannot go (/review 2026-11-01)
    assert.ok(at(lib, 'if (!process.env.RESEND_API_KEY) {') < at(lib, "type: 'signup'"));
    assert.match(lib, /\} catch \(err\) \{\s*await captureError\([^;]*;\s*return FAILED;\s*\}\s*\}\s*$/);
    // everything that can throw sits inside the try
    const tryAt = at(lib, 'try {');
    for (const call of ['findAuthUserByEmail(', "type: 'magiclink'", "type: 'signup'"]) assert.ok(tryAt < at(lib, call), `${call} inside the try`);
  });

  it('the account step looks for an existing account FIRST, and a waiting one gets a magic link, never a signup link', () => {
    const lib = readCode('lib/registration-account.ts');
    assert.ok(at(lib, 'const existing = await findAuthUserByEmail(p.email);') < at(lib, "type: 'signup'"), 'a signup link over an account would overwrite its password');
    const existing = lib.slice(at(lib, 'if (existing) {'), at(lib, "type: 'signup'"));
    assert.match(existing, /if \(existing\.email_confirmed_at\) return \{ outcome: 'exists', actionLink: null \};/);
    assert.match(existing, /type: 'magiclink'/);
    // the coach sign-up's own budget, shared, so alternating the two doors cannot double it (/simplify 2026-11-01;
    // coach-signup-throttle-guard pins the numbers)
    assert.match(lib, /import \{ takeCoachSignupBudget, verificationRedirect \} from '\.\/signup-verification';/);
    assert.doesNotMatch(lib, /new FixedWindowRateLimiter/);
  });

  it('a template check that errors cannot fail the request after the entry is filed', () => {
    const lib = readCode('lib/platform-email-templates.ts');
    assert.match(lib, /export async function isPlatformTemplateCustomised\(key: EmailKind\): Promise<boolean> \{\s*try \{[\s\S]*?\} catch \{\s*return false;\s*\}/);
  });
});

describe('the route: entry, organizer, account, then the coach', () => {
  const route = readCode('app/api/register/route.ts');
  it('files the entry and sends the organizer’s alert BEFORE the account step (the organizer never waits)', () => {
    const account = at(route, 'await openRegistrationAccount({');
    assert.ok(at(route, ".from('teams')\n      .insert({") < account, 'the entry first');
    assert.ok(at(route, "{ kind: 'registration_admin_alert' },") < account, 'the alert is on its way first');
    assert.ok(account < at(route, 'planCoachRegistrationEmails({'), 'then the coach’s emails');
  });
  it('runs the account step only for a signed-out coach who sent a password, on the live site', () => {
    assert.match(route, /const accountPassword = typeof body\.password === 'string' \? body\.password : '';\s*const withAccount = !!accountPassword && !signedInCoach && shouldRequireEmailVerification\(\);/);
    assert.match(route, /const account = withAccount\s*\? await openRegistrationAccount\(\{\s*ip: clientIpFrom\(req\), email, password: accountPassword,/);
    assert.match(route, /next: portalNext,/);
    assert.match(route, /const portalNext = registrationPortalPath\(data\.id\);/);
  });
  it('asks about a customised template only when there is a panel to place', () => {
    // started beside the account step (both never throw, so an early start leaves no unhandled rejection)
    assert.match(route, /const customisedCheck = withAccount && confirmationOn \? isPlatformTemplateCustomised\(emailKey\) : null;/);
    assert.match(route, /customised: !!actionLink && \(await customisedCheck\) === true,/);
    assert.ok(at(route, 'const customisedCheck =') < at(route, 'await openRegistrationAccount({'));
    assert.match(route, /const onlineCheck = confirmationOn && !isWaitlist \? tournamentTakesOnlinePayments\(tournamentId\) : null;/);
    assert.match(route, /online: await \(onlineCheck \?\? tournamentTakesOnlinePayments\(tournamentId\)\),/);
  });
  it('sends the combined email as built, so a template customised since the check cannot drop the button', () => {
    const combined = route.slice(at(route, "if (coachEmails.includes('registration_with_confirm') && actionLink) {"));
    assert.match(combined, /^[^}]*sendEmail\(email, subject, html\(signupConfirmUrl\(origin, actionLink\)\), \{ kind: emailKey, orgId: tournament\.org_id \}\)/);
    assert.match(route, /if \(coachEmails\.includes\('registration'\)\) \{\s*emailSends\.push\(sendTransactionalEmail\(\{\s*key: emailKey,/);
    assert.match(route, /if \(coachEmails\.includes\('confirm_only'\) && actionLink\) \{\s*emailSends\.push\(sendSignupVerificationEmail\(\{/);
  });
  it('tells the form what happened, never whether an account has been confirmed', () => {
    // `linkSent` says only that a confirm link went (a link made always goes), never confirmed vs waiting (/review 2026-11-01)
    assert.match(route, /return NextResponse\.json\(\{ ok: true, id: data\.id, status: finalStatus, account: account\?\.outcome, linkSent: !!actionLink \}\);/);
    assert.doesNotMatch(readCode('lib/registration-account.ts'), /outcome: 'waiting'|outcome: 'confirmed'/);
  });
  it('keeps the email’s key, so a platform admin’s customised version still resolves', () => {
    assert.match(route, /const emailKey = isWaitlist \? 'tournament_registration_waitlist' : 'tournament_registration_confirmation';/);
  });
});

describe('the form: one post, no second email', () => {
  const form = readCode('components/public/RegisterContent.tsx');
  it('sends the account with the entry only when asked, and never calls the sign-up on the live-site path', () => {
    assert.match(form, /if \(withAccount\) \{\s*payload\.append\('password', form\.password\);\s*payload\.append\('firstName', form\.firstName\.trim\(\)\);\s*payload\.append\('lastName', form\.lastName\.trim\(\)\);\s*\}/);
    const branch = form.slice(at(form, 'if (!signedIn && verifies) {'), at(form, 'if (!signedIn) {'));
    assert.doesNotMatch(branch, /coach-signup|requestVerificationLink/);
    assert.match(branch, /showVerifySuccess\(registered, registrationPortalPath\(registered\.id\), signedOutFinish\(registered, emailNorm\)\);/);
  });
  it('no card says a link went unless one did (/review 2026-11-01, twice): both signed-out paths read `linkSent`', () => {
    const helper = form.slice(at(form, 'const registerForWaitingAccount = async'), at(form, 'if (!signedIn && verifies) {'));
    assert.match(helper, /signedOutFinish\(registered, emailNorm\)/);
    // registration-finish-screen.test.ts pins the mapping itself
    assert.match(form, /registered\.linkSent \? \{ verifyEmail: emailNorm \}/);
  });
  it('the dev path (verification off) still signs in through the sign-up before it registers', () => {
    const dev = form.slice(at(form, 'if (!signedIn) {'));
    assert.ok(at(dev, "fetch('/api/auth/coach-signup'") < at(dev, 'const result = await postRegistration();'));
  });
});

describe('the email, as rendered', () => {
  const confirmUrl = 'https://fieldlogichq.com/auth/signup-confirm?link=abc';
  const joinUrl = 'https://fieldlogichq.com/coaches/join?registrationId=r1&registered=1';

  it('with a confirm link: the drawing’s panel, button and two small lines', () => {
    const html = registrationPortalPanelHtml({ confirmUrl, joinUrl });
    assert.ok(html.includes('Confirm your email to open your Coaches Portal'));
    assert.ok(html.includes('Your free Coaches Portal tracks this registration, shows your game schedule once it’s published, and brings you the organizer’s announcements.'));
    assert.ok(html.includes(`href="${confirmUrl}"`) && html.includes('>Confirm my email</a>'));
    assert.ok(html.includes('The button works for 1 hour. After that it opens sign-in, where you can send yourself a new link.'));
    assert.ok(html.includes('If you didn’t register this team, you can ignore this email.'));
    assert.ok(!html.includes('Open your Coaches Portal') && !html.includes(joinUrl), 'one button');
  });
  it('without: Open your Coaches Portal, and no “is ready”', () => {
    const html = registrationPortalPanelHtml({ joinUrl });
    assert.ok(html.includes('Track your registration'));
    assert.ok(html.includes(`href="${joinUrl}"`) && html.includes('>Open your Coaches Portal</a>'));
    assert.ok(!html.includes('Confirm my email'));
  });
  it('“is ready” appears nowhere', () => {
    for (const html of [registrationPortalPanelHtml({ confirmUrl, joinUrl }), registrationPortalPanelHtml({ joinUrl })]) {
      assert.doesNotMatch(html, /is ready/);
    }
    assert.doesNotMatch(readCode('lib/email.ts'), /Coaches Portal account is ready/);
  });
  it('the subject and heading are “We’ve got your registration”; the waitlist keeps its own subject', () => {
    assert.equal(registrationEmailSubject('Lakeshore Lightning', false), 'We’ve got your registration · Lakeshore Lightning');
    assert.equal(registrationEmailSubject('Lakeshore Lightning', true), 'Waitlist Confirmation - Lakeshore Lightning');
    assert.match(readCode('lib/email.ts'), /margin:0 0 1rem;">We’ve got your registration<\/h2>/);
  });
  it('the confirm link returns to the join page with the registration and no address', () => {
    const next = registrationPortalPath('r-1');
    assert.equal(next, `/coaches/join?registered=1&registrationId=r-1&next=${encodeURIComponent('/coaches/tournaments/r-1?welcome=1')}&verified=1`);
    assert.doesNotMatch(next, /email=/);
    assert.equal(registrationPortalPath(undefined), '/coaches/tournaments');
  });
});
