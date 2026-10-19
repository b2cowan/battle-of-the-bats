/**
 * ACCOUNT-FIRST SIGN-UP (owner rulings A1–A7, 2026-10-18; hub docs/projects/active/ACCOUNT_FIRST_SIGNUP_HUB.html).
 * Every start sign-up asks for the account alone; the team, league or organization is named after the email link, on
 * the door's step 2. The account remembers its door (lib/start-door.ts) so the link, every resend and Home's finish
 * card all lead back there, wherever the link is opened.
 *
 * Part 1 (shared pieces + Start a team + Start a league). The rules are exercised directly; the wiring is pinned by
 * source scans, as signup-verification-guard.test.ts does for the verify-by-link rule this builds on.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode } from './_source-code.ts';
import {
  readStartDoor, parseStartDoor, sessionSignedInAt, startCardVisible, startDoorLinkPath, withNotNow, START_DOOR_PATH, START_CARD_COPY,
} from '../../lib/start-door.ts';

describe('the remembered door', () => {
  it('reads only a well-formed record; anything else is no door', () => {
    assert.deepEqual(readStartDoor({ start: { door: 'team' } }), { door: 'team' });
    assert.deepEqual(readStartDoor({ start: { door: 'league', notNow: 1, notNowAt: '2026-10-18T12:00:00.000Z' } }),
      { door: 'league', notNow: 1, notNowAt: '2026-10-18T12:00:00.000Z' });
    for (const md of [null, undefined, {}, { start: null }, { start: 'team' }, { start: { door: 'club' } }, { start: { door: 7 } }]) {
      assert.equal(readStartDoor(md), null, JSON.stringify(md));
    }
    // a hand-edited count or date is dropped, never trusted as a number or a time
    assert.deepEqual(readStartDoor({ start: { door: 'team', notNow: 'lots', notNowAt: 'yesterday' } }), { door: 'team' });
  });

  it('a route takes only the doors it serves', () => {
    assert.equal(parseStartDoor('team', ['team', 'league']), 'team');
    assert.equal(parseStartDoor('organization', ['team', 'league']), null);
    assert.equal(parseStartDoor(undefined, ['team', 'league']), null);
  });

  it('the link lands on the door’s create step, marked as just confirmed', () => {
    assert.equal(startDoorLinkPath('team'), '/start/team?confirmed=1');
    assert.equal(startDoorLinkPath('league'), '/start/league?confirmed=1');
    assert.equal(START_DOOR_PATH.organization, '/start/tournament');
    assert.equal(START_DOOR_PATH.premium, '/coaches/start');
  });

  it('Not now: the first hides the card until the next sign-in, the second hides it for good (A4)', () => {
    const fresh = { door: 'team' as const };
    const at = (signedInAt: string | null) => ({ signedInAt, hasWorkspace: false });
    assert.equal(startCardVisible(fresh, at('2026-10-18T09:00:00.000Z')), true);

    const once = withNotNow(fresh, new Date('2026-10-18T10:00:00.000Z'));
    assert.deepEqual(once, { door: 'team', notNow: 1, notNowAt: '2026-10-18T10:00:00.000Z' });
    assert.equal(startCardVisible(once, at('2026-10-18T09:00:00.000Z')), false, 'same sign-in: hidden');
    assert.equal(startCardVisible(once, at('2026-10-19T08:00:00.000Z')), true, 'signed in again: back');
    assert.equal(startCardVisible(once, at(null)), false, 'no sign-in on record: stays hidden');

    const twice = withNotNow(once, new Date('2026-10-19T08:30:00.000Z'));
    assert.equal(twice.notNow, 2);
    assert.equal(startCardVisible(twice, at('2026-11-01T08:00:00.000Z')), false, 'for good');
  });

  it('never for an account that already has a workspace, however it was made', () => {
    assert.equal(startCardVisible({ door: 'team' }, { signedInAt: '2026-10-18T09:00:00.000Z', hasWorkspace: true }), false);
  });

  it('"the next sign-in" is the session’s own sign-in time, which a token refresh does not move', () => {
    // 2026-10-18T10:00:00Z = 1792317600
    assert.equal(sessionSignedInAt([{ method: 'password', timestamp: 1792317600 }, { method: 'totp', timestamp: 1792318200 }]), '2026-10-18T10:00:00.000Z');
    assert.equal(sessionSignedInAt(['password']), null, 'the string-only claim format carries no time');
    assert.equal(sessionSignedInAt(undefined), null);
  });

  it('Coach Premium has its own card words; the others name what is left to make', () => {
    assert.equal(START_CARD_COPY.team.title, 'Finish creating your team');
    assert.equal(START_CARD_COPY.league.title, 'Finish creating your league');
    assert.equal(START_CARD_COPY.organization.title, 'Finish creating your organization');
    assert.deepEqual([START_CARD_COPY.premium.title, START_CARD_COPY.premium.action], ['Finish setting up your Coaches Portal', 'Continue setup']);
  });

  it('steers screens only: no entitlement, price or Founding Season rule reads it', () => {
    const lib = readCode('lib/start-door.ts');
    assert.deepEqual([...lib.matchAll(/from '([^']+)'/g)].map(m => m[1]), ['./coaches-portal-routes'], 'framework-free: route constants only');
    for (const f of ['lib/plan-config.ts', 'app/api/billing/create-checkout/route.ts', 'app/api/billing/create-team-checkout/route.ts']) {
      assert.doesNotMatch(readCode(f), /start-door/, `${f} never reads the remembered door`);
    }
  });
});

describe('the coach sign-up remembers the door', () => {
  const route = readCode('app/api/auth/coach-signup/route.ts');
  it('records only the doors it serves, on the account it creates, and points the link at step 2', () => {
    assert.match(route, /const startDoor = parseStartDoor\(body\.startDoor, \['team', 'league'\] as const\);/);
    assert.match(route, /\.\.\.\(startDoor \? \{ start: \{ door: startDoor \} \} : \{\}\),/);
    assert.match(route, /options: \{ data: userMetadata, redirectTo: verificationRedirect\(origin, next\) \}/);
    assert.match(route, /user_metadata: userMetadata,/, 'the instant path (localhost) remembers it too');
    assert.match(route, /const next = verificationReturnPath\(body\.next, '\/coaches', startDoor\);/);
  });
  it('one rule for where a link returns: the caller’s own destination, else the door’s step 2, else the fallback', () => {
    // the registration form's resend names the join page that links its registration; it must never lose it (/review)
    assert.match(readCode('lib/signup-verification.ts'), /return safeNextPath\(next, door \? startDoorLinkPath\(door\) : fallback\);/);
    const resend = readCode('app/api/auth/resend-verification/route.ts');
    assert.match(resend, /const next = verificationReturnPath\(body\.next, '\/home', readStartDoor\(user\.user_metadata\)\?\.door\);/);
  });
});

/**
 * ⚠ THE NEW GUARD: a signed-out sign-up route makes the auth account and nothing else. An organization, team or league
 * built before the email is proven outlives an abandoned sign-up and lets anyone claim a club's name and address (F01).
 * The org sign-up (app/api/auth/signup/route.ts) still builds its organization before the link and joins this list in
 * Part 2, when that moves to step 2. Mutation-checked 2026-10-18: an `.insert(` added to the coach sign-up fails it.
 */
const SIGNED_OUT_SIGNUP_ROUTES = ['app/api/auth/coach-signup/route.ts', 'app/api/auth/team-signup/route.ts'];
describe('no signed-out sign-up creates an organization, team or league', () => {
  for (const f of SIGNED_OUT_SIGNUP_ROUTES) {
    it(f, () => {
      const src = readCode(f);
      assert.doesNotMatch(src, /\.(insert|upsert|update|delete)\(|\.rpc\(/, 'writes no table row');
      assert.doesNotMatch(src, /\bcreate(Organization|OrganizationMember|BasicCoachTeam|TeamWorkspace|League)\w*\(/, 'calls no create helper');
      assert.doesNotMatch(src, /\.from\('/, 'reads or writes no table at all');
    });
  }
});

describe('the start forms', () => {
  const form = readCode('app/(consumer)/start/StartDoorForm.tsx');
  it('step 1 is the account alone, and says what comes next (A1, A2)', () => {
    const step1 = form.slice(form.indexOf('function AccountStep('), form.indexOf('function NameStep('));
    assert.doesNotMatch(step1, /copy\.label|continueName/, 'no name field, no name in the email');
    assert.match(step1, /startDoor: door,/);
    assert.match(step1, /\{loading \? 'Creating…' : 'Create Account'\}/, 'D7');
    assert.match(step1, /steps=\{<StartSteps current=\{1\} second=\{copy\.step\} \/>\}/);
    assert.match(step1, /It brings you straight to \{copy\.nextStep\}\./);
  });
  it('keeps the Verify Every Sign-up block: check your email, resend, keep entries, sign in', () => {
    assert.match(form, /if \(created\.requiresEmailVerification\) \{\s*setPassword\(''\);\s*setVerifyEmail\(emailNorm\);/);
    assert.match(form, /<VerifyEmailSent\s+tone="start"/);
    assert.match(form, /onChangeEmail=\{\(\) => setVerifyEmail\(null\)\}/);
    assert.match(form, /resendNext=\{startDoorLinkPath\(door\)\}/);
  });
  it('step 2 is the name, empty and focused (A3), confirmed in a plain sentence (D5), one tap to create (V1)', () => {
    const step2 = form.slice(form.indexOf('function NameStep('));
    assert.match(step2, /autoFocus/);
    assert.match(step2, /\{confirmed && <p className=\{styles\.confirmed\}>Your email is confirmed\.<\/p>\}/);
    assert.match(step2, /steps=\{viewer\.firstRun \? <StartSteps current=\{2\} second=\{copy\.step\} \/> : undefined\}/);
    assert.match(step2, /\{viewer\.firstRun \? 'Not now, go to Home' : '← Back to your workspaces'\}/, 'F07');
    assert.match(step2, /async function handleSubmit\(e: React\.FormEvent\)/);
    assert.doesNotMatch(form, /useEffect/, 'nothing creates on its own');
    // a link sent before account-first carried the name; it keeps filling in for one release
    assert.match(step2, /useState\(initialName\)/);
  });
  it('the step line is the register page’s step bar, and not a control', () => {
    assert.match(form, /<ol className=\{styles\.steps\} aria-label="Sign-up steps">/);
    assert.doesNotMatch(form, /<(button|a)\b[^>]*styles\.step/, 'no step is clickable');
    const css = readCode('app/(consumer)/start/startForm.module.css');
    assert.match(css, /\.stepNum \{[^}]*width: 24px;[^}]*height: 24px;/);
    assert.match(css, /\.footerLink \{[^}]*min-height: 44px;/, 'D6');
  });
  for (const [f, door] of [
    ['app/(consumer)/start/team/StartTeamForm.tsx', 'team'],
    ['app/(consumer)/start/league/StartLeagueForm.tsx', 'league'],
  ] as const) {
    it(`${door} is the shared form, with only its create call`, () => {
      assert.match(readCode(f), new RegExp(`<StartDoorForm door="${door}" create=\\{create\\w+\\}`));
    });
  }
  it('the pages pass who is looking, and whether it is their first day', () => {
    for (const f of ['app/(consumer)/start/team/page.tsx', 'app/(consumer)/start/league/page.tsx']) {
      assert.match(readCode(f), /viewer=\{await startStepViewer\(user\)\}/, f);
    }
    assert.match(readCode('lib/start-door-server.ts'), /firstRun: workspaces\.length === 0/);
  });
});

describe('a creation clears the door', () => {
  it('the free team and the free league', () => {
    assert.match(readCode('app/api/coaches/teams/route.ts'), /await Promise\.all\(\[welcome, clearStartDoor\(user\.id\)\]\);\s*return json\(\{ ok: true, id \}\);/);
    assert.match(readCode('app/api/league/create/route.ts'), /await clearStartDoor\(user\.id\);\s*return NextResponse\.json\(\{ ok: true, orgSlug: org\.slug \}\);/);
  });
});

describe('Home’s finish card (A4)', () => {
  it('only for an account with a remembered door and nowhere to go yet', () => {
    const route = readCode('app/api/consumer/home/route.ts');
    assert.match(route, /startCardVisible\(start, \{ signedInAt, hasWorkspace: workspaces\.length > 0 \}\)/);
    assert.match(route, /sessionSignedInAt\(\(await supabase\.auth\.getClaims\(\)\)\.data\?\.claims\?\.amr\)/);
    assert.doesNotMatch(route, /last_sign_in_at/, 'a token refresh re-stamps it');
  });
  it('never leads to a step that would not open', () => {
    assert.match(readCode('app/api/consumer/home/route.ts'), /const stepOpens = start\?\.door !== 'league' \|\| \(process\.env\.LEAGUE_STARTER_BETA === 'true' && pendingInvites\.length === 0\);/);
  });
  it('hides "Nothing here yet" while it shows, and Not now is counted on the account', () => {
    const home = readCode('components/consumer/HomePersonalization.tsx');
    assert.match(home, /const signedInEmpty =\s*loaded && signedIn && !startCard &&/);
    assert.match(home, /fetch\('\/api\/account\/start-door', \{ method: 'POST' \}\)/);
    assert.match(readCode('app/api/account/start-door/route.ts'), /await recordStartDoorNotNow\(user\);/);
  });
});

describe('sign-in offers the link again (A7)', () => {
  const page = readCode('app/(consumer)/auth/login/page.tsx');
  it('inside the error box, only for a waiting account, through the one resend control', () => {
    assert.match(page, /if \(err === 'email_not_confirmed'\) setWaitingEmail\(/);
    assert.match(page, /<div className=\{styles\.error\}>\s*\{error\}\s*\{waitingEmail && \(\s*<ResendLink/);
    assert.match(page, /classes=\{\{ button: styles\.errorAction, sent: styles\.errorSent, error: styles\.errorNote \}\}/);
    // no destination of its own unless the sign-in was opened with one, so the account's door decides
    assert.match(page, /next=\{searchParams\.get\('next'\) \?\? undefined\}/);
    assert.match(readCode('components/auth/VerifyEmailSent.tsx'), /<ResendLink\b/, 'the check-your-email block renders the same control');
    assert.match(readCode('components/auth/ResendLink.tsx'), /<p className=\{classes\.sent\} role="status">Sent again at \{clock\}\. Check your spam folder too\.<\/p>/, 'D12, announced');
    assert.match(readCode('app/(consumer)/auth/auth.module.css'), /\.errorAction \{[^}]*min-height: 44px;/);
  });
});
