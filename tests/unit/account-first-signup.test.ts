/**
 * ACCOUNT-FIRST SIGN-UP (owner rulings A1–A7, 2026-10-18; hub docs/projects/active/ACCOUNT_FIRST_SIGNUP_HUB.html).
 * Every start sign-up asks for the account alone; the team, league or organization is named after the email link, on
 * the door's step 2. The account remembers its door (lib/start-door.ts) so the link, every resend and Home's waiting
 * workspace (A4, revised 2026-10-19) all lead back there, wherever the link is opened.
 *
 * Part 1 (shared pieces + Start a team + Start a league). The rules are exercised directly; the wiring is pinned by
 * source scans, as signup-verification-guard.test.ts does for the verify-by-link rule this builds on.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readCode } from './_source-code.ts';
import {
  readStartDoor, parseStartDoor, startDoorLinkPath, START_DOOR_PATH, WAITING_WORKSPACE,
} from '../../lib/start-door.ts';

describe('the remembered door', () => {
  it('reads only a well-formed record; anything else is no door', () => {
    assert.deepEqual(readStartDoor({ start: { door: 'team' } }), { door: 'team' });
    for (const md of [null, undefined, {}, { start: null }, { start: 'team' }, { start: { door: 'club' } }, { start: { door: 7 } }]) {
      assert.equal(readStartDoor(md), null, JSON.stringify(md));
    }
    // the finish card's Not now count (before A4 was revised, 2026-10-19) is left on some accounts, and means nothing now
    assert.deepEqual(readStartDoor({ start: { door: 'league', notNow: 2, notNowAt: '2026-10-18T12:00:00.000Z' } }), { door: 'league' });
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

  it('the waiting workspace wears the card it will become, in the words the owner ruled (A4 revised 2026-10-19)', () => {
    assert.deepEqual(WAITING_WORKSPACE.team, { kind: 'coaches_basic', badge: 'Not named yet', title: 'Your team', action: 'Name your team' });
    assert.deepEqual(WAITING_WORKSPACE.league, { kind: 'organization', badge: 'Not named yet', title: 'Your league', action: 'Name your league' });
    assert.deepEqual(WAITING_WORKSPACE.organization, { kind: 'organization', badge: 'Not named yet', title: 'Your organization', action: 'Name your organization' });
    // Coach Premium's step 2 asks for the team, the sport and the plan, so its words are its own
    assert.deepEqual(WAITING_WORKSPACE.premium, { kind: 'coaches_premium', badge: 'Setup not finished', title: 'Your team', action: 'Continue setup' });
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

/**
 * ⚠ The waiting workspace shows beside every other workspace (A4 revised 2026-10-19), so EVERY path that gives the
 * account its own team or league must clear the door — a door left behind is a "Not named yet" card next to the real
 * team. The finish card hid itself once there was any workspace, so before the revision only two paths cleared it.
 * Census 2026-10-19: Premium makes every team through one provisioner (checkout comp + mock paths, both Stripe
 * webhook events); a registration claim creates or adopts a free team in one helper (the join page, a signed-in
 * tournament registration). Not cleared on purpose: a staff seat, a season rollover, a tournament organization
 * (not the team or league the door came to start; the organization door, and its clear, are Part 2's).
 * Each clear names the doors it fulfils (/review 2026-10-19): a team never finishes a waiting league, or the other way
 * round, because the card shows only while the thing "truly is" still owed.
 */
describe('a creation clears the door it fulfils', () => {
  it('the free team and the free league', () => {
    assert.match(readCode('app/api/coaches/teams/route.ts'), /await Promise\.all\(\[welcome, clearStartDoor\(user\.id, \['team'\]\)\]\);\s*return json\(\{ ok: true, id \}\);/);
    assert.match(readCode('app/api/league/create/route.ts'), /await clearStartDoor\(user\.id, \['league'\]\);\s*return NextResponse\.json\(\{ ok: true, orgSlug: org\.slug \}\);/);
  });
  it('a Coach Premium team, once its provisioning is committed', () => {
    assert.match(readCode('lib/team-workspace-provisioning.ts'), /createdOrgId = null;[\s\S]{0,500}?await clearStartDoor\(ownerUserId, \['team', 'premium'\]\);/);
  });
  it('a free team a registration claim creates or adopts', () => {
    const lib = readCode('lib/basic-coach-teams.ts');
    assert.match(lib, /status: 'active' \}\);[\s\S]{0,500}?await clearStartDoor\(params\.userId, \['team'\]\);\s*return \{ basicCoachTeamId: foreignLink, createdTeam: false \};/, 'adopting an orphaned team');
    assert.match(lib, /if \(createdTeam\) await clearStartDoor\(params\.userId, \['team'\]\);\s*return \{ basicCoachTeamId, createdTeam \};/, 'a team made for the claim');
  });
  it('only a matching door clears', () => {
    const lib = readCode('lib/start-door-server.ts');
    assert.match(lib, /export async function clearStartDoor\(userId: string, fulfils: readonly StartDoor\[\]\)/);
    assert.match(lib, /if \(!start \|\| !fulfils\.includes\(start\.door\)\) return;/);
  });
});

describe('Home’s waiting workspace (A4 revised 2026-10-19)', () => {
  const route = readCode('app/api/consumer/home/route.ts');
  const home = readCode('components/consumer/HomePersonalization.tsx');
  it('for an account with a remembered door, beside any other workspace, with nothing to dismiss', () => {
    assert.match(route, /const waitingWorkspace = start && stepOpens \? \{ door: start\.door \} : null;/);
    assert.doesNotMatch(route, /hasWorkspace|getClaims|notNow|last_sign_in_at/, 'no workspace check and no Not now timing');
    // resolved from the repo root, not the working directory, so the check cannot pass vacuously (/review)
    assert.equal(existsSync(new URL('../../app/api/account/start-door/route.ts', import.meta.url)), false, 'the Not now route is gone');
    assert.doesNotMatch(home, /Not now|api\/account\/start-door/);
  });
  it('never leads to a step that would not open: the league door carries /start/league’s three gates', () => {
    // an account already in a real organization is turned away by the page and by /api/league/create (/review)
    assert.match(route, /const stepOpens = start\?\.door !== 'league' \|\| \(\s*process\.env\.LEAGUE_STARTER_BETA === 'true' && pendingInvites\.length === 0 && !\(await userBelongsToOtherRealOrg\(user\.id\)\)\s*\);/);
    const page = readCode('app/(consumer)/start/league/page.tsx');
    assert.match(page, /if \(user\?\.id && \(await userBelongsToOtherRealOrg\(user\.id\)\)\) \{/, 'the page gate this mirrors');
  });
  it('sits in Workspaces after the workspaces in use, and Home is not empty while it shows', () => {
    assert.match(home, /\{workspaces\.map\(ws => <WorkspaceCard key=\{ws\.id\} ctx=\{ws\} \/>\)\}\s*\{waiting && <WaitingWorkspaceCard door=\{waiting\.door\} \/>\}/);
    assert.match(home, /\{\(workspaces\.length > 0 \|\| waiting\) && \(/);
    assert.match(home, /const signedInEmpty =\s*loaded && signedIn && !waiting &&/);
  });
  it('is the workspace card itself: that family’s label and icon, an amber badge, the step in the meta line’s place', () => {
    const card = home.slice(home.indexOf('function WaitingWorkspaceCard('), home.indexOf('function WorkspaceCard('));
    assert.match(card, /className=\{styles\.wsCard\}/);
    assert.match(card, /<span className=\{styles\.wsKind\}>\{KIND_LABEL\[card\.kind\]\}<\/span>/);
    assert.match(card, /<span className=\{styles\.wsBadge\} data-accent="amber">\{card\.badge\}<\/span>/);
    assert.match(card, /<span className=\{styles\.wsAction\}>\{card\.action\}<\/span>/);
    assert.match(card, /href=\{START_DOOR_PATH\[door\]\}/);
    // /design D13: the one line that must be read is the sans at the support size, not the meta line's data face
    assert.match(readCode('components/consumer/HomePersonalization.module.css'), /\.wsAction \{[^}]*font-family: var\(--font-sans[^}]*font-size: 0\.75rem;/);
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
