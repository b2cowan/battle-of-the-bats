/**
 * ACCOUNT-FIRST SIGN-UP (owner rulings A1–A7, 2026-10-18; hub docs/projects/active/ACCOUNT_FIRST_SIGNUP_HUB.html).
 * Every start sign-up asks for the account alone; the team, league or organization is named after the email link, on
 * the door's step 2. The account remembers its door (lib/start-door.ts) so the link, every resend and Home's waiting
 * workspace (A4, revised 2026-10-19) all lead back there, wherever the link is opened.
 *
 * Part 1 (shared pieces + Start a team + Start a league) and Part 2 (Run a tournament, the pricing plan, the Founding
 * Season rule). The rules are exercised directly; the wiring is pinned by source scans, as
 * signup-verification-guard.test.ts does for the verify-by-link rule this builds on.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readCode } from './_source-code.ts';
import {
  readStartDoor, parseStartDoor, parseStartPricing, planStepPath, startDoorLinkPath, START_DOOR_PATH, WAITING_WORKSPACE,
} from '../../lib/start-door.ts';
import { FOUNDING_SEASON_END, FOUNDING_SEASON_SIGNUP_CLOSE, isFoundingSeasonOpenFor } from '../../lib/plan-config.ts';
import { hasSavedSetupWork } from '../../lib/first-run-plan.ts';

describe('the remembered door', () => {
  it('reads only a well-formed record; anything else is no door', () => {
    assert.deepEqual(readStartDoor({ start: { door: 'team' } }), { door: 'team' });
    for (const md of [null, undefined, {}, { start: null }, { start: 'team' }, { start: { door: 'club' } }, { start: { door: 7 } }]) {
      assert.equal(readStartDoor(md), null, JSON.stringify(md));
    }
    // the finish card's Not now count (before A4 was revised, 2026-10-19) is left on some accounts, and means nothing now
    assert.deepEqual(readStartDoor({ start: { door: 'league', notNow: 2, notNowAt: '2026-10-18T12:00:00.000Z' } }), { door: 'league' });
  });

  it('the organization door carries the pricing page’s plan and billing (A6); nothing else does', () => {
    assert.deepEqual(
      readStartDoor({ start: { door: 'organization', plan: 'tournament_plus', billing: 'annual' } }),
      { door: 'organization', pricing: { plan: 'tournament_plus', billing: 'annual' } },
    );
    assert.deepEqual(readStartDoor({ start: { door: 'organization' } }), { door: 'organization' });
    assert.deepEqual(readStartDoor({ start: { door: 'team', plan: 'league', billing: 'monthly' } }), { door: 'team' });
    // only the paid plans the pricing cards send; billing defaults to monthly
    assert.deepEqual(parseStartPricing('league', undefined), { plan: 'league', billing: 'monthly' });
    for (const plan of ['tournament', 'team', 'bogus', 7, null]) assert.equal(parseStartPricing(plan, 'annual'), null, String(plan));
  });

  it('Coach Premium’s door carries the billing chosen before the account was made (Part 3); never a claim', () => {
    assert.deepEqual(readStartDoor({ start: { door: 'premium', billing: 'annual' } }), { door: 'premium', billing: 'annual' });
    assert.deepEqual(readStartDoor({ start: { door: 'premium', billing: 'weekly', claim: 'abc' } }), { door: 'premium' });
    assert.equal(startDoorLinkPath('premium'), '/coaches/start?confirmed=1');
  });

  it('the plan step opens with that plan, or as it always has', () => {
    assert.equal(planStepPath('milton', { plan: 'tournament_plus', billing: 'monthly' }), '/milton/admin/onboarding?choosePlan=1&plan=tournament_plus&billing=monthly');
    assert.equal(planStepPath('milton', null), '/milton/admin/onboarding?choosePlan=1');
  });

  it('a route takes only the doors it serves', () => {
    assert.equal(parseStartDoor('team', ['team', 'league']), 'team');
    assert.equal(parseStartDoor('organization', ['team', 'league']), null);
    assert.equal(parseStartDoor(undefined, ['team', 'league']), null);
  });

  it('the link lands on the door’s create step, marked as just confirmed', () => {
    assert.equal(startDoorLinkPath('team'), '/start/team?confirmed=1');
    assert.equal(startDoorLinkPath('league'), '/start/league?confirmed=1');
    assert.equal(startDoorLinkPath('organization'), '/start/tournament?confirmed=1');
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
    for (const f of ['lib/plan-config.ts', 'lib/founding-season.ts', 'app/api/billing/create-checkout/route.ts', 'app/api/billing/create-team-checkout/route.ts']) {
      assert.doesNotMatch(readCode(f), /start-door/, `${f} never reads the remembered door`);
    }
    // the offer reads the LOCKED copy on app_metadata, which only the service role can write — never user_metadata
    assert.doesNotMatch(readCode('lib/founding-season.ts'), /user_metadata/);
  });
});

/**
 * THE FOUNDING SEASON OFFER AT A CREATION (A5 Decided 2026-10-18; edges (a) and (b) ratified by the owner 2026-10-19).
 * The account step and the creation now fall on different days, so "free … when you sign up by December 31" is read
 * against the account. After the close, only the start the account came for counts — and that is read from a locked
 * copy of the door, because the remembered door is the account holder's to edit.
 */
describe('the first-run plan choice ends when setup starts', () => {
  it('saved setup work ends it; the plan task does not', () => {
    assert.equal(hasSavedSetupWork({ venues: { status: 'complete' } }), true);
    assert.equal(hasSavedSetupWork({ plan: { status: 'complete' } }), false);
    assert.equal(hasSavedSetupWork({ tournament: { status: 'skipped' } }), false);
    for (const v of [null, undefined, [], 'x', {}]) assert.equal(hasSavedSetupWork(v), false);
  });
});

describe('the Founding Season offer at a creation', () => {
  const close = Date.parse(FOUNDING_SEASON_SIGNUP_CLOSE);
  const end = Date.parse(FOUNDING_SEASON_END);
  const day = 86_400_000;
  const before = new Date(close - day).toISOString();
  const after = new Date(close + day).toISOString();
  it('while the window is open, every creation gets it, as before', () => {
    assert.equal(isFoundingSeasonOpenFor(null, false, close - 1), true);
  });
  it('after the close: an account made by then, finishing the start it came for', () => {
    assert.equal(isFoundingSeasonOpenFor(before, true, close + 2 * day), true, 'signed up on the 31st, named it on the 2nd');
    assert.equal(isFoundingSeasonOpenFor(before, false, close + 2 * day), false, 'edge (a): any other creation follows the window');
    assert.equal(isFoundingSeasonOpenFor(after, true, close + 2 * day), false, 'an account made after the close');
    assert.equal(isFoundingSeasonOpenFor(null, true, close + 2 * day), false, 'no creation date is no offer');
    assert.equal(isFoundingSeasonOpenFor(before, true, end), false, 'nothing once the season has ended');
  });
  it('one rule for every creation path, read off the signed-in account', () => {
    const lib = readCode('lib/founding-season.ts');
    // signed out (no account) is the window alone, so a screen and the checkout read the same answer
    assert.match(lib, /return isFoundingSeasonOpenFor\(user\?\.created_at, lockedStartDoorOf\(user\?\.app_metadata\) === creates\);/);
    assert.match(readCode('app/api/org/create/route.ts'), /if \(foundingSeasonOfferFor\(user, 'organization'\)\) \{/);
    assert.match(readCode('app/api/league/create/route.ts'), /if \(foundingSeasonOfferFor\(user, 'league'\)\) \{/);
    // edge (b): Coach Premium on the same rule (Part 3)
    assert.match(readCode('app/api/billing/create-team-checkout/route.ts'), /if \(foundingSeasonOfferFor\(user, 'premium'\)\) \{/);
    for (const f of ['app/api/org/create/route.ts', 'app/api/league/create/route.ts', 'app/api/billing/create-checkout/route.ts', 'app/api/auth/signup/route.ts', 'app/api/billing/create-team-checkout/route.ts']) {
      assert.doesNotMatch(readCode(f), /isFoundingSeasonSignupOpen\(\)/, `${f} reads the one rule, not the bare window`);
    }
  });
  it('the start doors that carry an offer lock their door, and a failed lock undoes the account', () => {
    assert.match(readCode('lib/founding-season.ts'), /const OFFER_DOORS = \['organization', 'league', 'premium'\] as const;/);
    const signup = readCode('app/api/auth/signup/route.ts');
    // one lock-or-undo for every sign-up route that makes a start door's account
    assert.match(readCode('lib/founding-season.ts'), /if \(!failure\) return true;[\s\S]{0,300}?await supabaseAdmin\.auth\.admin\.deleteUser\(userId\);[\s\S]{0,300}?return false;/);
    assert.match(signup, /if \(organizationDoor && !\(await lockStartDoorOrUndo\(userId, 'organization'\)\)\) \{/);
    const coach = readCode('app/api/auth/coach-signup/route.ts');
    assert.match(coach, /if \(linkData\.user && !\(await lockStartDoorOrUndo\(linkData\.user\.id, startDoor\)\)\) \{/);
    assert.match(coach, /if \(created\.user && !\(await lockStartDoorOrUndo\(created\.user\.id, startDoor\)\)\) \{/);
    assert.match(readCode('app/api/auth/team-signup/route.ts'), /if \(!\(await lockStartDoorOrUndo\(userId, premiumDoor\)\)\) \{/, 'Coach Premium (Part 3)');
  });
  it('the plan step after the close: $0 Tournament Plus while an organization holding the comp makes its FIRST-RUN plan choice', () => {
    const lib = readCode('lib/founding-season.ts');
    const rule = lib.slice(lib.indexOf('export async function foundingSeasonOfferOnPlanChoice('));
    assert.match(rule, /if \(!foundingCompAppliesToPlan\(org\.planId\)\) return false;\s*if \(isFoundingSeasonSignupOpen\(\)\) return true;/, 'Club never (2026-09-25), even in the window');
    assert.match(rule, /\.is\('revoked_at', null\)/);
    assert.match(rule, /if \(comp\.error \|\| tournaments\.error \|\| row\.error \|\| !row\.data\) return false;/, 'fails closed: a read error is the list price');
    // server facts only — the first run ends when setup starts, as the free-plan route's own lock reads it
    assert.match(rule, /&& \(tournaments\.count \?\? 0\) === 0\s*&& !row\.data\.onboarding_completed_at\s*&& !hasSavedSetupWork\(row\.data\.startup_tasks\);/);
    // ⚠ never the browser-written plan task: every first-run plan change wipes it, so an abandoned checkout reopened $0 (/review)
    assert.doesNotMatch(rule, /\.plan\b|planTask/);
    assert.match(readCode('app/api/admin/org/onboarding-plan/route.ts'), /hasSavedSetupWork\(startupRead\.data\?\.startup_tasks\)/, 'one rule for when the first run ends');
    assert.match(readCode('app/api/billing/create-checkout/route.ts'), /auth\.org\.planId === 'tournament' &&\s*\(await foundingSeasonOfferOnPlanChoice\(auth\.org\)\);/);
    // the card shows what the checkout will charge
    assert.match(readCode('app/api/admin/org/founding-season-status/route.ts'), /return NextResponse\.json\(\{ offerOnPlanChoice: await foundingSeasonOfferOnPlanChoice\(ctx\.org\) \}\);/);
    assert.match(readCode('components/PricingSection.tsx'), /: \(foundingOfferHeld && plan\.key === 'tournament_plus'\) \|\| isFoundingSeasonPromoActive\(plan\.key\)/);
    const onboarding = readCode('app/[orgSlug]/admin/onboarding/page.tsx');
    assert.match(onboarding, /foundingOfferHeld=\{foundingOfferHeld\}/);
    // asked again each time the chooser appears, and shown only for the state it was asked in (/review)
    assert.match(onboarding, /const offerKey = offerSlug \? \[offerSlug, planChoiceRequired, planChooserOpen, activeModal\]\.join\(':'\) : null;/);
    assert.match(onboarding, /const foundingOfferHeld = !!offerKey && offerAnswer\?\.key === offerKey && offerAnswer\.held;/);
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

describe('Run a tournament: the organization sign-up makes the account alone (Part 2, F01)', () => {
  const route = readCode('app/api/auth/signup/route.ts');
  it('remembers the organization door with the pricing page’s plan, and the link lands on step 2', () => {
    assert.match(route, /const organizationDoor = parseStartDoor\(startDoor, \['organization'\] as const\) !== null\s*\|\| \(orgName !== undefined && orgName !== null\);/, 'a page loaded before the release still sends a name: it is the door');
    assert.match(route, /const pricing = organizationDoor \? parseStartPricing\(plan, billing\) : null;/);
    assert.match(route, /\.\.\.\(organizationDoor \? \{ start: \{ door: 'organization', \.\.\.\(pricing \?\? \{\}\) \} \} : \{\}\),/);
    assert.match(route, /const returnPath = organizationDoor \? startDoorLinkPath\('organization'\) : safeNextPath\(next, '\/discover'\);/);
    assert.match(route, /redirectTo: verificationRedirect\(origin, returnPath\),/);
    assert.match(route, /user_metadata: userMetadata,/, 'the instant path (localhost) remembers it too');
    // no name in the email: it is asked on step 2
    assert.match(route, /await sendSignupVerificationEmail\(\{ to: normalizedEmail, origin, actionLink, firstName: normalizedFirstName \}\);/);
  });
  it('keeps the Sign-up Invite Guard and the staff refusal', () => {
    assert.match(route, /return NextResponse\.json\(\{ inviteBranch: 'invited', orgName: pendingInvite\.orgName \}\);/);
    // an existing account answers both forms the same way: sign in (the organization door's step 2 follows)
    assert.match(route, /if \(await authAccountExistsForEmail\(normalizedEmail\)\) \{\s*return NextResponse\.json\(\s*\{ error: 'An account already exists for this email\. Please sign in instead\.' \},\s*\{ status: 409 \},/);
    // and a second submit that raced past it gets the same answer, never the auth service's own text (/review)
    assert.match(route, /if \(linkError\?\.status === 422\) \{\s*return NextResponse\.json\(\{ error: 'An account already exists for this email\. Please sign in instead\.' \}, \{ status: 409 \}\);/);
  });
  it('step 2 is the shared name step: the add-organization form, its address in olive, then the plan step', () => {
    const page = readCode('app/(consumer)/start/tournament/page.tsx');
    // the newer choice (in the address, carried through sign-in) wins over the one remembered at sign-up (/review)
    assert.match(page, /const pricing = parseStartPricing\(first\(sp\.plan\), first\(sp\.billing\)\) \?\? readStartDoor\(user\.user_metadata\)\?\.pricing \?\? null;/);
    const form = readCode('app/(consumer)/start/tournament/StartTournamentForm.tsx');
    assert.match(form, /return planStepPath\(data\.orgSlug, pricing\);/);
    assert.match(form, /Your public address: <strong>fieldlogichq\.ca\/\{slugifyOrgName\(name\) \|\| 'your-org'\}<\/strong> — you can change this later\./, 'F08: olive (.fieldHelp strong), not pale lime');
    assert.equal(existsSync(new URL('../../app/(consumer)/start/tournament/AddOrgForm.tsx', import.meta.url)), false, 'the old form is gone');
    // the plan step features the plan from the pricing page (A6)
    assert.match(readCode('app/[orgSlug]/admin/onboarding/page.tsx'), /featuredPlan=\{pricingPlan \?\? 'tournament_plus'\}/);
  });
  it('step 1 lives at /start/tournament (the intro folded in, Ask 6); /auth/signup forwards there with its plan; account-only stays', () => {
    const tournament = readCode('app/(consumer)/start/tournament/page.tsx');
    assert.match(tournament, /if \(!user\?\.email\) \{\s*return <StartTournamentForm viewer=\{null\} pricing=\{parseStartPricing\(first\(sp\.plan\), first\(sp\.billing\)\)\} \/>;/);
    assert.doesNotMatch(tournament, /Create your free account|I already have an account/, 'the intro page is gone');
    // the forward runs before any render; Next passes the query (the pricing page's plan and billing) through
    assert.match(readCode('next.config.ts'), /\{ source: '\/auth\/signup', missing: \[\{ type: 'query', key: 'account', value: '1' \}\], destination: '\/start\/tournament', permanent: false \}/, '?account=1 is the account-only page and never forwards');
    assert.match(readCode('app/(consumer)/auth/signup/page.tsx'), /return <AccountOnlySignup \/>;/);
    const accountOnly = readCode('app/(consumer)/auth/signup/AccountOnlySignup.tsx');
    assert.doesNotMatch(accountOnly, /orgName|Create Organization|inviteBranch/, 'the account-only form makes no organization');
  });
});

/**
 * ⚠ THE NEW GUARD: a signed-out sign-up route makes the auth account and nothing else. An organization, team or league
 * built before the email is proven outlives an abandoned sign-up and lets anyone claim a club's name and address (F01).
 * The org sign-up (app/api/auth/signup/route.ts) joined the list in Part 2 (2026-10-19), when its organization moved to
 * step 2. Mutation-checked 2026-10-18 (an `.insert(` added to the coach sign-up fails it) and 2026-10-19 (the old
 * `createOrganization(` and an `.from('organizations')` read put back in the org sign-up each fail it).
 */
const SIGNED_OUT_SIGNUP_ROUTES = ['app/api/auth/coach-signup/route.ts', 'app/api/auth/team-signup/route.ts', 'app/api/auth/signup/route.ts'];
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
    const step1 = form.slice(form.indexOf('function StartAccountStep('), form.indexOf('function InvitedInstead('));
    assert.doesNotMatch(step1, /copy\.label|continueName/, 'no name field, no name in the email');
    assert.match(step1, /startDoor: door,/);
    assert.match(step1, /\{loading \? 'Creating…' : 'Create account'\}/, 'The first look, Ask 3: one spelling at every door');
    assert.match(step1, /steps=\{<StartSteps current=\{1\} labels=\{copy\.steps\} \/>\}/);
    assert.match(step1, /<AccountFields\b/, 'the one account form (The first look, rule 4)');
    assert.match(step1, /It brings you straight to \{copy\.nextStep\}\./);
  });
  it('Run a tournament’s step 1: its own words, the organization sign-up, the pricing plan riding along (A6)', () => {
    assert.match(form, /title: 'Run a tournament',\s*sub: 'Free to start\. You\\'ll name your organization next\.',/);
    assert.match(form, /steps: \['Account', 'Organization', 'Plan'\],/, 'the plan step shows in the step line');
    assert.match(form, /organization: '\/api\/auth\/signup',/, 'it keeps the Sign-up Invite Guard');
    assert.match(form, /\.\.\.\(pricing \? \{ plan: pricing\.plan, billing: pricing\.billing \} : \{\}\),/);
    assert.match(form, /<strong>\{PLAN_CONFIG\[pricing\.plan\]\.label\}, billed \{pricing\.billing === 'annual' \? 'annually' : 'monthly'\}<\/strong>, from\s+the pricing page\. You&apos;ll confirm it after naming your organization\./);
    // an account that signs in instead keeps the plan through the sign-in
    assert.match(form, /router\.push\(`\/auth\/login\?next=\$\{encodeURIComponent\(nextStep\)\}&email=\$\{encodeURIComponent\(emailNorm\)\}`\);/);
    // on localhost every door's page renders its own step 2 at the same address (Run a tournament's too, since Ask 6)
    assert.match(form, /const \{ error: signInErr \} = await signIn\(emailNorm, password\);[\s\S]{0,260}?router\.refresh\(\);\s*\}/);
    // the invited branch keeps its words
    assert.match(form, /You don&apos;t need to create an organization — just accept your invitation to get started\./);
    assert.match(form, /'Email me my invitation link'/);
    assert.match(form, /Not you\? Create a new organization instead/);
    // D10: the plan chip's edge is solid (the white callout with an olive edge); D6: the quiet way out is a 44px row
    assert.match(form, /<p className=\{accountForm\.calloutIcon\}>/);
    const css = readCode('components/auth/AccountForm.module.css');
    assert.match(css, /\.callout \{[^}]*border: 1px solid[^}]*border-left: 3px solid var\(--home-olive\);/);
    assert.match(css, /\.textBtn \{[^}]*min-height: 44px;/);
    assert.equal(existsSync(new URL('../../app/(consumer)/start/startForm.module.css', import.meta.url)), false, 'the doors carry no form styles of their own');
  });
  it('keeps the Verify Every Sign-up block: check your email, resend, keep entries, sign in', () => {
    assert.match(form, /if \(created\.requiresEmailVerification\) \{\s*setPassword\(''\);\s*setVerifyEmail\(emailNorm\);/);
    assert.match(form, /<VerifyEmailSent\s+tone="start"/);
    // back to the form, entries kept, the cursor in the email field (the Stage 1 screen-reader pass)
    assert.match(form, /onChangeEmail=\{\(\) => \{ setVerifyEmail\(null\); setChangingEmail\(true\); \}\}/);
    assert.match(form, /focusEmail=\{changingEmail\}/);
    assert.match(form, /resendNext=\{startDoorLinkPath\(door\)\}/);
  });
  it('step 2 is the name, empty and focused (A3), confirmed in a plain sentence (D5), one tap to create (V1)', () => {
    const step2 = form.slice(form.indexOf('function NameStep('));
    assert.match(step2, /autoFocus/);
    assert.match(step2, /\{confirmed && <p className=\{accountForm\.body\}>Your email is confirmed\.<\/p>\}/);
    assert.match(step2, /steps=\{viewer\.firstRun \? <StartSteps current=\{2\} labels=\{copy\.steps\} \/> : undefined\}/);
    // step 2 keeps step 1's heading; the "Adding a team to <email>" line is gone (The first look, F19)
    assert.match(step2, /title=\{copy\.title\}/);
    assert.doesNotMatch(form, /Adding a|viewer\.email/);
    assert.match(step2, /\{viewer\.firstRun \? 'Not now, go to Home' : '← Back to your workspaces'\}/, 'F07');
    assert.match(step2, /async function handleSubmit\(e: React\.FormEvent\)/);
    assert.doesNotMatch(form, /useEffect/, 'nothing creates on its own');
    // a link sent before account-first carried the name; it keeps filling in for one release
    assert.match(step2, /useState\(initialName\)/);
  });
  it('the step line is the register page’s step bar, and not a control', () => {
    const steps = readCode('components/auth/StartSteps.tsx');
    assert.match(steps, /<ol className=\{styles\.steps\} aria-label="Sign-up steps"/);
    assert.doesNotMatch(steps, /<(button|a)\b/, 'no step is clickable');
    assert.match(form, /import StartSteps from '@\/components\/auth\/StartSteps';/);
    assert.match(readCode('components/auth/StartSteps.module.css'), /\.stepNum \{[^}]*width: 24px;[^}]*height: 24px;/);
    // a screen reader hears "Step 1 of 2: Account" (The first look, the screen-reader pass)
    assert.match(steps, /<span className="sr-only">Step \{n\} of \{steps\.length\}: <\/span>/);
    const css = readCode('components/auth/AccountForm.module.css');
    assert.match(css, /\.footLink \{[^}]*min-height: 44px;/, 'D6');
  });
  for (const [f, door] of [
    ['app/(consumer)/start/team/StartTeamForm.tsx', 'team'],
    ['app/(consumer)/start/league/StartLeagueForm.tsx', 'league'],
    ['app/(consumer)/start/tournament/StartTournamentForm.tsx', 'organization'],
  ] as const) {
    it(`${door} is the shared form, with only its create call`, () => {
      assert.match(readCode(f), new RegExp(`<StartDoorForm door="${door}" create=\\{create\\w+\\}`));
    });
  }
  it('the pages pass who is looking, and whether it is their first day', () => {
    for (const f of ['app/(consumer)/start/team/page.tsx', 'app/(consumer)/start/league/page.tsx', 'app/(consumer)/start/tournament/page.tsx']) {
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
 * tournament registration). Not cleared on purpose: a staff seat, a season rollover, a team moved into a club.
 * Part 2 (2026-10-19): the add-organization route clears the organization door — the one place an account makes its
 * own tournament organization.
 * Each clear names the doors it fulfils (/review 2026-10-19): a team never finishes a waiting league, or the other way
 * round, because the card shows only while the thing "truly is" still owed.
 */
describe('a creation clears the door it fulfils', () => {
  it('the free team, the free league and the organization', () => {
    assert.match(readCode('app/api/coaches/teams/route.ts'), /await Promise\.all\(\[welcome, clearStartDoor\(user\.id, \['team'\]\)\]\);\s*return json\(\{ ok: true, id \}\);/);
    assert.match(readCode('app/api/league/create/route.ts'), /await clearStartDoor\(user\.id, \['league'\]\);\s*return NextResponse\.json\(\{ ok: true, orgSlug: org\.slug \}\);/);
    assert.match(readCode('app/api/org/create/route.ts'), /await clearStartDoor\(user\.id, \['organization'\]\);\s*return NextResponse\.json\(\{ ok: true, orgSlug: org\.slug \}\);/);
  });
  it('a Coach Premium team, once its provisioning is committed', () => {
    assert.match(readCode('lib/team-workspace-provisioning.ts'), /createdOrgId = null;[\s\S]{0,500}?await clearStartDoor\(ownerUserId, \['team', 'premium'\]\);/);
  });
  it('a free team a registration claim creates or adopts', () => {
    const lib = readCode('lib/basic-coach-teams.ts');
    assert.match(lib, /status: 'active' \}\);[\s\S]{0,500}?await clearStartDoor\(params\.userId, \['team'\]\);\s*return \{ basicCoachTeamId: foreignLink, createdTeam: false \};/, 'adopting an orphaned team');
    assert.match(lib, /if \(createdTeam\) await clearStartDoor\(params\.userId, \['team'\]\);\s*return \{ basicCoachTeamId, createdTeam \};/, 'a team made for the claim');
  });
  it('a Coach Premium portal brought back clears the door too, so no lock outlives it (/review, Part 3)', () => {
    assert.match(readCode('lib/team-checkout.ts'), /await clearStartDoor\(parsed\.ownerUserId, \['team', 'premium'\]\);\s*return \{\s*provisioned: false,\s*reason: 'reactivated',/);
  });
  it('only a matching door clears, and the locked copy goes with it (edge (a): only the start’s own creation counts)', () => {
    const lib = readCode('lib/start-door-server.ts');
    assert.match(lib, /export async function clearStartDoor\(userId: string, fulfils: readonly StartDoor\[\]\)/);
    assert.match(lib, /const clearDoor = !!start && fulfils\.includes\(start\.door\);/);
    assert.match(lib, /const clearLock = !!locked && fulfils\.includes\(locked\);/);
    assert.match(lib, /\.\.\.\(clearLock \? \{ app_metadata: \{ \[START_DOOR_LOCK_KEY\]: null \} \} : \{\}\),/);
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
  it('never leads to a step that would not open: the league and organization doors carry their pages’ gates', () => {
    // an account already in a real organization is turned away by both pages and both create routes (/review)
    assert.match(route, /const makesAnOrganization = start\?\.door === 'league' \|\| start\?\.door === 'organization';/);
    assert.match(route, /const leagueBetaOff = start\?\.door === 'league' && process\.env\.LEAGUE_STARTER_BETA !== 'true';/);
    // Coach Premium's step turns away a closed checkout (an interest form) and an account that owns a live portal (Part 3)
    // a failed read hides the card (a way in, never the gate)
    assert.match(route, /const premiumOpens = start\?\.door !== 'premium' \|\| await Promise\.all\(\[getPlanGatingMap\(\), getActiveOwnedTeamWorkspace\(user\.id\)\]\)\s*\.then\(\(\[gating, portal\]\) => !gating\.team && !portal, \(\) => false\);/);
    assert.match(route, /const stepOpens = premiumOpens && \(!makesAnOrganization \|\| \(\s*!leagueBetaOff && pendingInvites\.length === 0 && !\(await userBelongsToOtherRealOrg\(user\.id\)\)\s*\)\);/);
    assert.match(readCode('app/(consumer)/start/league/page.tsx'), /if \(user\?\.id && \(await userBelongsToOtherRealOrg\(user\.id\)\)\) \{/, 'the page gate this mirrors');
    const tournament = readCode('app/(consumer)/start/tournament/page.tsx');
    assert.match(tournament, /userBelongsToOtherRealOrg\(user\.id\),/);
    assert.match(tournament, /if \(inRealOrg\) \{/);
    assert.match(tournament, /\.eq\('status', 'invited'\),/);
    assert.match(tournament, /if \(\(pendingInvites \?\? 0\) > 0\) \{\s*redirect\('\/discover'\);/);
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

/**
 * PART 3 — COACH PREMIUM AND THE CLAIM LINK (2026-10-19). Step 1 is the account card alone (Create / Sign in kept); the
 * team, the sport and the plan are step 2 — today's signed-in card. Nothing typed lives in the browser tab any more (F02):
 * the billing rides on the account. The claim link keeps its server re-fill; its token is never kept on the account.
 */
describe('Coach Premium, account first (Part 3)', () => {
  const route = readCode('app/api/auth/team-signup/route.ts');
  const card = readCode('app/team/TeamSignupClient.tsx');
  it('the sign-up makes the account alone, remembers the door and its billing, and never the claim token', () => {
    assert.match(route, /const premiumDoor = parseStartDoor\(startDoor, \['premium'\] as const\);/);
    // a claim sign-up remembers no door: Home and a resend would open the blank step, where the claim could be left open
    assert.match(route, /const startRecord = premiumDoor && claim !== true\s*\? \{ door: premiumDoor, \.\.\.\(premiumBilling && \{ billing: premiumBilling \}\) \}\s*: null;/);
    assert.doesNotMatch(route, /claim\s*:/, 'a claim token is a secret that grants the team; account metadata rides in every session');
    assert.match(route, /const safeNext = normalizeNext\(next, premiumDoor \? startDoorLinkPath\('premium'\) : COACHES_START_PATH\);/);
  });
  it('an existing account is told to sign in BEFORE a sign-up link is generated (it had no check)', () => {
    const check = route.indexOf('if (await authAccountExistsForEmail(normalizedEmail)) {');
    assert.ok(check > 0 && check < route.indexOf('supabaseAdmin.auth.admin.generateLink('), 'checked before the link');
  });
  it('the card: no browser-tab draft; step 1 is the account; step 2 is today’s signed-in card', () => {
    assert.doesNotMatch(card, /sessionStorage|DRAFT_KEY|saveDraft/, 'F02');
    // who is signed in comes from the server: no session check in the browser, no flash of the wrong step
    assert.match(card, /const \[isAuthenticated, setIsAuthenticated\] = useState\(!!signedInEmail\);/);
    assert.doesNotMatch(card, /getUser\(|checkingAuth/);
    assert.match(card, /const onAccountStep = !isAuthenticated;/);
    assert.match(card, /onSubmit=\{onAccountStep \? handleAccount : handleSubmit\}/);
    // a reactivation is no start; a claim says so, keeping the offer's locked door but no remembered one (/review)
    assert.match(card, /\.\.\.\(isReactivation \? \{\} : \{ startDoor: 'premium', billing: billingCycle, \.\.\.\(claim \? \{ claim: true \} : \{\}\) \}\),/);
    // signing in on the card re-asks the server, so the offer and the billing are the account's (/review)
    assert.match(card, /setIsAuthenticated\(true\);[\s\S]{0,300}?router\.refresh\(\);/);
    // a waiting account that signs in gets the check-your-email block with its resend, not a dead end (/review)
    assert.match(card, /if \(signin\.error === 'email_not_confirmed'\) \{[\s\S]{0,200}?setVerificationEmail\(/);
    assert.match(card, /<StartSteps current=\{onAccountStep \? 1 : 2\} second="Your team" \/>/, 'D3');
    assert.match(card, /import StartSteps from '@\/components\/auth\/StartSteps';/, 'one step line, shared with the start forms');
    assert.match(card, /\{busyLabel \|\| \(authMode === 'signup' \? 'Create account' : 'Sign in'\)\}<\/span>\s*<\/button>/, 'D7: no arrow');
    assert.match(card, /Next, confirm your email\. Then name your team, pick the sport and the plan you\\'ll move to\./);
    assert.match(card, /\{confirmed && <p className=\{styles\.confirmedLine\}>Your email is confirmed\.<\/p>\}/, 'D5');
    // the one check-your-email block, with Send the link again (V3)
    assert.match(card, /<VerifyEmailSent\s+tone="start"/);
    assert.match(card, /resendNext=\{linkPath\}/);
    // the billing from the address, else remembered on the account
    assert.match(card, /normalizeBillingCycle\(searchParams\.get\('billing'\) \?\? rememberedBilling\)/);
  });
  it('the card shows the price the checkout will charge: the server’s answer, not the bare window', () => {
    assert.match(card, /foundingOffer: foundingPromoActive,/);
    assert.doesNotMatch(card, /isFoundingSeasonPromoActive/);
    for (const f of ['app/coaches/start/page.tsx', 'app/coaches/claim/[token]/page.tsx']) {
      assert.match(readCode(f), /foundingOffer=\{foundingSeasonOfferFor\(user, 'premium'\)\}/, f);
      assert.match(readCode(f), /signedInEmail=\{user\?\.email \?\? null\}/, f);
      assert.match(readCode(f), /rememberedBilling=\{readStartDoor\(user\?\.user_metadata\)\?\.billing \?\? null\}/, f);
    }
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
