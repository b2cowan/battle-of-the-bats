/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * TWO-STEP SIGN-IN · PART 3, THE SWITCHES, THE GRACE PERIOD, THE RESETS (Board Ready; plan BOARD_READY_PLAN.md §5
 * Stage 0a "Part 3"; drawings tabs 6, 7, 8).
 *
 *   1. Who a club may reset: the rule as behaviour (owner / admin only, never yourself or the owner, only when two-step is
 *      on, and only when the account reaches no other place), and "reaches another place" reads every live tie, failing
 *      toward support. "Lost your phone?" reads the SAME rule.
 *   2. The reset's order: signed out first, then the one removal order (Part 2's, shared), then signed out again. The
 *      club's run re-applies the rule and asks for the viewer's code BEFORE it resets (mutants).
 *   3. The switches: owner-only change, an admin reads; the owner's own two-step before ON; the code before OFF and before
 *      the write; the email on OFF; an audit line each time.
 *   4. A person's own 14 days: written at every place a covered seat begins (the decision point is SEAT_STARTS).
 *   5. Support's reset: the audit line FIRST, the confirmation link stored hashed, the hourly run audits first, re-reads a
 *      hold or a cancel before it resets, and never honours the dev-only short wait on production.
 *   6. A real code cancels a waiting reset, read from the session's own proof.
 *   7. The club's screen at sign-in: only a covered person with two-step off, only on the shared sign-in page.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { clubResetDoorRule } from '../../lib/two-step-club-reset.ts';
import { roleChangeStartsGrace, switchOfRole } from '../../lib/two-step-grace.ts';
import { RESET_WAIT_MS, resetWaitMs } from '../../lib/two-step-reset-wait.ts';

const at = (code: string, needle: string) => {
  const i = code.indexOf(needle);
  assert.ok(i >= 0, `anchor "${needle}" moved`);
  return i;
};

describe('1 · who a club may reset', () => {
  const base = {
    viewerRole: 'admin', isSelf: false, targetRole: 'treasurer', targetOn: true,
    orgIsTeamWorkspace: false, resettableAccount: true, reachesAnotherPlace: false, viewerOn: true,
  };
  it('the door: an owner or admin, for someone else who is not the owner, with two-step on, reaching nowhere else', () => {
    assert.equal(clubResetDoorRule(base), 'club');
    assert.equal(clubResetDoorRule({ ...base, viewerRole: 'owner' }), 'club');
  });
  it('no door and nothing said: another seat, yourself, the owner, two-step off', () => {
    for (const viewerRole of ['treasurer', 'staff', 'coach', 'league_admin', null]) {
      assert.equal(clubResetDoorRule({ ...base, viewerRole }), 'none', String(viewerRole));
    }
    assert.equal(clubResetDoorRule({ ...base, isSelf: true }), 'none');
    assert.equal(clubResetDoorRule({ ...base, targetRole: 'owner' }), 'none');
    assert.equal(clubResetDoorRule({ ...base, targetOn: false }), 'none');
  });
  it('support only, one line, no reason given: another place, a coach’s own team, staff or a demo account', () => {
    assert.equal(clubResetDoorRule({ ...base, reachesAnotherPlace: true }), 'support');
    assert.equal(clubResetDoorRule({ ...base, orgIsTeamWorkspace: true }), 'support');
    assert.equal(clubResetDoorRule({ ...base, resettableAccount: false }), 'support');
  });
  it('a viewer whose OWN two-step is off gets a line instead of the door (owner ruling 2026-11-11, review call 1)', () => {
    assert.equal(clubResetDoorRule({ ...base, viewerOn: false }), 'own_first');
    assert.equal(clubResetDoorRule({ ...base, viewerOn: false, reachesAnotherPlace: true }), 'support', 'support first: nothing to set up for');
    assert.equal(clubResetDoorRule({ ...base, viewerOn: false, targetOn: false }), 'none');
    const run = readCode('lib/two-step-club-reset-run.ts');
    assert.ok(run.indexOf("if (door === 'own_first')") < run.indexOf('await args.askFreshCode()'), 'the run refuses before asking for a code');
  });
  it('turning a requirement on OR off needs the owner’s own two-step, before anything is written', () => {
    const route = readCode('app/api/admin/org-settings/two-step/route.ts');
    const patch = route.slice(route.indexOf('export const PATCH'));
    const own = patch.indexOf('if (!hasVerifiedFactor(state?.user)) {');
    assert.ok(own > 0 && own < patch.indexOf("if (!on) {") && own < patch.indexOf(".from('organizations').update("));
  });
  it('"reaches another place" reads every live tie (owner ruling 2026-11-11: any live tie), and fails toward support', () => {
    const code = readCode('lib/two-step-club-reset.ts');
    const fn = code.slice(at(code, 'export async function accountReachesAnotherPlace'), at(code, 'export async function accountIsClubResettable'));
    assert.match(fn, /from\('organization_members'\)[\s\S]*?\.neq\('organization_id', orgId\)/, 'a seat in another organization, any status');
    assert.doesNotMatch(fn.slice(0, fn.indexOf("from('basic_coach_team_users')")), /\.eq\('status'/, 'a seat elsewhere counts in ANY status');
    assert.match(fn, /from\('basic_coach_team_users'\)[\s\S]*?\.eq\('status', 'active'\)/, 'a free Coaches Portal team');
    assert.match(fn, /from\('league_team_coaches'\)[\s\S]*?\.neq\('org_id', orgId\)\.is\('removed_at', null\)/, 'a house-league team elsewhere');
    assert.match(fn, /from\('family_links'\)[\s\S]*?\.neq\('org_id', orgId\)\.not\('status', 'in', '\(declined,revoked\)'\)/, 'a family link elsewhere');
    assert.match(fn, /if \(r\.error \|\| r\.count === null\) return true;/, 'an unreadable answer is "reaches another place"');
  });
  it('"Lost your phone?" shows the club version by the SAME rule, never a looser one', () => {
    const chooser = readCode('lib/two-step-lost-phone.ts');
    assert.match(chooser, /export const CLUB_RESET_DOOR_BUILT = true;/);
    assert.match(chooser, /accountIsClubResettable\(email\)/);
    assert.match(chooser, /accountReachesAnotherPlace\(userId, orgId\)/);
    assert.match(chooser, /return resettable && !elsewhere \? 'club' : 'support';/);
  });
});

/** Signed out first → the shared removal order → signed out again. */
function resetOrderHolds(code: string): boolean {
  const fn = code.slice(code.indexOf('export async function resetTwoStep'));
  const first = fn.indexOf('signOutEverywhere(userId)');
  const remove = fn.indexOf('removeEveryAuthenticator(userId)');
  const again = fn.indexOf('signOutEverywhere(userId)', first + 1);
  return first > 0 && remove > first && again > remove && /if \(!\(await signOutEverywhere\(userId\)\)\) return 'not_signed_out';/.test(fn);
}

/** The club's run: the rule re-applied, the code asked, THEN the reset; the audit line after it. */
function clubRunOrderHolds(code: string): boolean {
  const rule = code.indexOf("if (door === 'none')");
  const support = code.indexOf("if (door === 'support')");
  const ask = code.indexOf('await args.askFreshCode()');
  const reset = code.indexOf('await resetTwoStep(target.userId)');
  const audit = code.indexOf("'two_step_reset'");
  return [rule, support, ask, reset, audit].every(i => i > 0) && rule < ask && support < ask && ask < reset && reset < audit;
}

describe('2 · the reset’s order', () => {
  const reset = readCode('lib/two-step-reset.ts');
  const run = readCode('lib/two-step-club-reset-run.ts');
  it('signed out first (a failure there changes nothing), then the one removal order, then signed out again', () => {
    assert.equal(resetOrderHolds(reset), true);
  });
  it('the club’s run re-applies the door’s rule and asks for the viewer’s code before it resets', () => {
    assert.equal(clubRunOrderHolds(run), true);
  });
  it('mutants: each swap is caught', () => {
    const removeFirst = reset
      .replace("if (!(await signOutEverywhere(userId))) return 'not_signed_out';", '@@OUT@@')
      .replace("if (!(await removeEveryAuthenticator(userId))) return 'not_removed';", "if (!(await signOutEverywhere(userId))) return 'not_signed_out';")
      .replace('@@OUT@@', "if (!(await removeEveryAuthenticator(userId))) return 'not_removed';");
    assert.equal(resetOrderHolds(removeFirst), false);
    const resetBeforeCode = run
      .replace('const stale = await args.askFreshCode();', '@@ASK@@')
      .replace('const outcome = await resetTwoStep(target.userId);', 'const stale = await args.askFreshCode();')
      .replace('@@ASK@@', 'const outcome = await resetTwoStep(target.userId);');
    assert.equal(clubRunOrderHolds(resetBeforeCode), false);
  });
  it('Part 2’s turn off uses the same removal order (one copy of it)', () => {
    assert.match(readCode('app/api/auth/two-step/turn-off/route.ts'), /removeEveryAuthenticator\(user\.id\)/);
    assert.doesNotMatch(readCode('app/api/auth/two-step/turn-off/route.ts'), /deleteFactor\(/);
  });
  it('the Members route gates owners and admins, refuses a coach row, and hands the code check to the run', () => {
    const route = readCode('app/api/admin/members/[memberId]/two-step/route.ts');
    assert.match(route, /if \(!\['owner', 'admin'\]\.includes\(ctx\.role\)\) return \{ response: forbidden\(\) \};/);
    assert.match(route, /if \(target\.role === 'coach'\) return \{ response: coachingStaffRowRefusal\(\) \};/);
    assert.match(route, /askFreshCode: requireFreshCode,/);
  });
});

describe('2b · a coach’s door, on the club’s team staff page (ask A, drawn and approved 2026-11-11)', () => {
  const route = readCode('app/api/admin/rep-teams/teams/[teamId]/coaches/[membershipId]/two-step/route.ts');
  it('the page’s own write gate (the owner, or an admin with Rep Teams), the same rule, and the same run', () => {
    assert.ok(route.includes('resolveClubTeam(req, teamId, { write: true })'));
    assert.ok(route.includes('clubResetDoorFor('));
    assert.match(route, /clubResetTwoStep\(\{[\s\S]*askFreshCode: requireFreshCode,/);
  });
  it('the coach is judged by their seat in THIS club (an owner who also coaches is never the club’s to reset)', () => {
    assert.match(route, /\.eq\('organization_id', c(?:tx)?\.(?:ctx\.)?org\.id\)\s*\.eq\('user_id', member\.userId\)/);
  });
  it('the window reads the door only for the page’s writers, and never shows it without the rule’s yes', () => {
    const dlg = readCode('components/admin/kit/club/CoachDialogs.tsx');
    assert.ok(dlg.includes('if (!canWrite) return;'));
    assert.ok(dlg.includes("{twoStep?.door === 'club' && ("));
  });
});

describe('3 · the switches', () => {
  const route = readCode('app/api/admin/org-settings/two-step/route.ts');
  const patch = route.slice(at(route, 'export const PATCH'));
  it('the owner changes them; an admin reads them; nobody else', () => {
    assert.match(route, /if \(ctx\.role !== 'owner' && ctx\.role !== 'admin'\) return forbidden\(\);/);
    assert.match(patch, /if \(ctx\.role !== 'owner'\) return NextResponse\.json\(\{ error: 'Only the owner changes this\.' \}, \{ status: 403 \}\);/);
  });
  it('ON needs the owner’s own two-step; OFF asks for the code; both before the write', () => {
    const write = at(patch, ".from('organizations').update(");
    assert.ok(at(patch, 'if (!hasVerifiedFactor(state?.user))') < write);
    assert.ok(at(patch, 'const stale = await requireFreshCode();') < write);
    assert.ok(patch.indexOf('if (!on) {') > 0 && patch.indexOf('requireFreshCode()') > patch.indexOf('if (!on) {'), 'only turning OFF asks for the code');
  });
  it('every change is a club audit line, and OFF emails the club’s other owners, admins and treasurer', () => {
    assert.match(patch, /writeOrgAudit\(ctx\.org\.id, ctx\.user\.id, null, on \? 'two_step_requirement_on' : 'two_step_requirement_off', \{ which \}\)/);
    assert.match(patch, /if \(!on\) \{[\s\S]*boardRecipients\(ctx\.org\.id, ctx\.user\.id\)[\s\S]*'two_step_requirement_off'/);
  });
  it('the Settings tab is listed for an admin, and the page shows an admin the two-step card alone', () => {
    assert.match(readCode('lib/admin-kit-nav.ts'), /\(role === 'owner' \|\| role === 'admin'\) && \{ key: 'org\/settings'/);
    const page = readCode('components/admin/kit/club/SettingsKit.tsx');
    const admin = page.slice(at(page, "if (userRole === 'admin') {\n    return ("), at(page, "if (userRole !== 'owner') return <NotYours"));
    assert.match(admin, /<TwoStepRequirementCard/);
    assert.doesNotMatch(admin, /BirthdayCutoffCard|PayoutsCard|settings-delete|settings-name/);
  });
});

/** Every place a covered seat begins, and the call it makes. ⚖ A NEW place a seat begins joins this list. */
const SEAT_STARTS: Record<string, RegExp> = {
  'app/api/auth/accept-invite/route.ts': /startTwoStepGrace\(user\.id, member\.organization_id, member\.role\)/,
  'app/api/auth/invitations/[memberId]/route.ts': /startTwoStepGrace\(user\.id, member\.organization_id, member\.role\)/,
  'app/api/admin/members/invite/route.ts': /startTwoStepGrace\(existingUser\.id, org\.id, role\)/,
  'app/api/admin/members/[memberId]/route.ts': /startTwoStepGrace\(target\.user_id, org\.id, resultingRole\)/,
  'app/api/platform-admin/orgs/[id]/transfer-ownership/route.ts': /startTwoStepGrace\(newOwnerUserId, id, 'owner'\)/,
  'lib/assistant-invites.ts': /startTwoStepGrace\(userId, row\.org_id, 'coach'\)/,
  'lib/team-ownership-transfer.ts': /startTwoStepGrace\(uid, club\.id, 'coach'\)/,
};

describe('4 · a person’s own 14 days', () => {
  for (const [file, call] of Object.entries(SEAT_STARTS)) {
    it(`${file} starts them where a covered seat begins`, () => assert.match(readCode(file), call));
  }
  it('it writes only when the seat’s switch is already on, and never fails the change it rides on', () => {
    const grace = readCode('lib/two-step-grace.ts');
    assert.match(grace, /if \(seatTwoStepRequirement\(org, role, null\)\.kind === 'none'\) return;/);
    assert.match(grace, /\} catch \(err\) \{\s*console\.error/);
  });
  it('a role change starts them only under a DIFFERENT switch', () => {
    assert.equal(switchOfRole('treasurer'), 'board');
    assert.equal(switchOfRole('coach'), 'coaches');
    assert.equal(switchOfRole('staff'), null);
    assert.equal(roleChangeStartsGrace('coach', 'treasurer'), true);
    assert.equal(roleChangeStartsGrace('staff', 'admin'), true);
    assert.equal(roleChangeStartsGrace('admin', 'treasurer'), false, 'admin → treasurer stays under the board’s switch');
    assert.equal(roleChangeStartsGrace('treasurer', 'staff'), false, 'out of every switch');
  });
});

describe('5 · support’s reset', () => {
  const lib = readCode('lib/two-step-support-reset.ts');
  it('the request: the audit line FIRST (strict), then the row; the link’s token stored only as a hash', () => {
    const start = lib.slice(at(lib, 'export async function startSupportReset'), at(lib, 'export async function confirmSupportReset'));
    assert.ok(at(start, "writeAuditBeforeChange(staffEmail") < at(start, ".from('two_step_owner_resets')\n    .insert("));
    assert.match(start, /confirm_token_hash: hashNoLoginToken\(token\)/);
    assert.doesNotMatch(start, /confirm_token_hash: token\b/);
  });
  it('the confirm finds the row by the token’s hash, refuses a cancelled, done or expired one, and claims it once', () => {
    const confirm = lib.slice(at(lib, 'export async function confirmSupportReset'), at(lib, 'export async function changeSupportReset'));
    assert.match(confirm, /\.eq\('confirm_token_hash', hash\)/);
    assert.match(confirm, /if \(!row \|\| row\.cancelled_at \|\| row\.completed_at\) return gone;/);
    assert.match(confirm, /Date\.parse\(row\.confirm_expires_at\) < now\) return gone;/);
    assert.match(confirm, /\.is\('confirmed_at', null\)\s*\.is\('cancelled_at', null\)/);
  });
  it('the hourly run: only confirmed, due, not held, not cancelled, not done; audit first; CLAIMED before the reset', () => {
    const run = lib.slice(at(lib, 'export async function runDueResets'));
    assert.match(run, /\.not\('confirmed_at', 'is', null\)\s*\.lte\('runs_at'[\s\S]*?\.is\('held_at', null\)\s*\.is\('cancelled_at', null\)\s*\.is\('completed_at', null\)/);
    const audit = at(run, "writeAuditBeforeChange(actor, null, 'two_step_reset_run'");
    const claim = at(run, '.update({ completed_at: claimedAt })');
    const reset = at(run, 'await resetTwoStep(row.user_id)');
    assert.ok(audit < claim && claim < reset, 'audit, then the claim, then the reset');
    assert.match(run, /\.update\(\{ completed_at: claimedAt \}\)\s*\.eq\('id', row\.id\)\.is\('held_at', null\)\.is\('cancelled_at', null\)\.is\('completed_at', null\)/,
      'the claim refuses a held, cancelled or done row');
    assert.match(run, /if \(!claim\?\.length\) \{/);
    assert.match(run, /\.update\(\{ completed_at: null \}\)\.eq\('id', row\.id\)\.eq\('completed_at', claimedAt\)/, 'a failed reset gives back only its own claim');
  });
  it('mutant: a reset before its audit line is caught', () => {
    const run = lib.slice(lib.indexOf('export async function runDueResets'));
    const AUDIT = "failed = await writeAuditBeforeChange(actor, null, 'two_step_reset_run'";
    const RESET = 'const outcome = await resetTwoStep(row.user_id);';
    const holds = (code: string) => code.indexOf(AUDIT) >= 0 && code.indexOf(RESET) >= 0 && code.indexOf(AUDIT) < code.indexOf(RESET);
    assert.equal(holds(run), true);
    const swapped = run.replace(AUDIT, '@@A@@').replace(RESET, AUDIT).replace('@@A@@', RESET);
    assert.equal(holds(swapped), false);
  });
  it('the dev-only short wait is never honoured on production', () => {
    const dev = { TWO_STEP_RESET_WAIT_MINUTES: '5', NEXT_PUBLIC_SUPABASE_URL: 'https://devproject.supabase.co', NODE_ENV: 'development' } as NodeJS.ProcessEnv;
    assert.equal(resetWaitMs(dev), 5 * 60_000);
    assert.equal(resetWaitMs({ ...dev, NODE_ENV: 'production' }), RESET_WAIT_MS);
    assert.equal(resetWaitMs({ ...dev, NEXT_PUBLIC_SUPABASE_URL: 'https://qcttcboqysynwcdyghil.supabase.co' }), RESET_WAIT_MS);
    assert.equal(resetWaitMs({ ...dev, TWO_STEP_RESET_WAIT_MINUTES: '' }), RESET_WAIT_MS);
    assert.equal(resetWaitMs({ ...dev, TWO_STEP_RESET_WAIT_MINUTES: '99999' }), RESET_WAIT_MS, 'never longer than the real wait');
  });
  it('the console door: the one front door, and a START asks for the staff member’s code before the request', () => {
    const route = readCode('app/api/platform-admin/users/[id]/two-step-reset/route.ts');
    const post = route.slice(at(route, 'export const POST'));
    assert.match(post, /await personActionContext<Body>\(req, id\)/);
    assert.ok(at(post, 'const stale = await requireFreshCode();') < at(post, 'startSupportReset('));
  });
  it('the hourly job: the scheduler’s secret, or a person with run_jobs', () => {
    const job = readCode('app/api/platform-admin/two-step-resets-hourly/route.ts');
    assert.match(job, /if \(!isCronRequest\(req\)\) \{\s*const auth = await requirePlatformPower\('run_jobs'\);/);
  });
  it('the confirmation route is POST only (an email scanner confirms nothing)', () => {
    const route = readCode('app/api/auth/two-step/confirm-reset/route.ts');
    assert.match(route, /export const POST/);
    assert.doesNotMatch(route, /export const GET/);
  });
});

describe('6 · a real code cancels a waiting reset', () => {
  it('read from the session’s own proof, never from the call', () => {
    const route = readCode('app/api/auth/two-step/proved/route.ts');
    assert.match(route, /if \(!state\?\.passed \|\| !state\.hasFactor \|\| !provedWithin\(state, JUST_NOW_MINUTES\)\) return/);
    assert.ok(at(route, 'provedWithin(state') < at(route, 'cancelResetsOnProof(state.user.id)'));
  });
  it('the code step tells the server after the app’s code and after a backup code', () => {
    const step = readCode('components/auth/TwoStepCodeStep.tsx');
    assert.ok(at(step, 'await tellProved();\n      await onDone();') > 0);
    assert.ok(at(step, 'await tellProved();\n      setMode(\'afterBackup\');') > 0);
  });
});

describe('7 · the club’s screen at sign-in', () => {
  it('only for a covered person with two-step off, and only on the one shared sign-in page', () => {
    const login = readCode('app/(consumer)/auth/login/page.tsx');
    assert.match(login, /if \(!status \|\| status\.hasFactor \|\| !status\.passed\) return null;/);
    assert.match(login, /twoStepStepUrl\('set_up', dest, \{ why: 'club' \}\)/);
    assert.doesNotMatch(readCode('lib/auth.ts'), /why: 'club'/, 'the other doors sign in mid-task; the server check covers them');
  });
  it('the server’s set-up redirect carries why=required, so the page opens on the club’s screen', () => {
    assert.match(readCode('lib/two-step-gate.ts'), /need === 'set_up' \? \{ why: 'required' \} : \{\}/);
  });
  it('the set-up page starts nothing until the person presses Set it up now on the club’s screen', () => {
    const page = readCode('app/(consumer)/auth/two-step/page.tsx');
    assert.ok(at(page, 'if (club) { setScreen(club); return; }') < at(page, 'await begin();'));
  });
});

describe('8 · the fixes from the review', () => {
  it('a failed removal never takes the mark off for an authenticator that was not the person’s own before it began', () => {
    const code = readCode('lib/two-step-reset.ts');
    assert.ok(code.includes('const ownIds = new Set('), 'the person’s own authenticators are read before the mark');
    assert.ok(code.includes('if (verified.some(f => ownIds.has(f.id))) {'));
    assert.ok(code.indexOf('const ownIds = new Set(') < code.indexOf('const { error: markErr }'));
  });
  it('the coach door refuses when the coach’s seat in the club cannot be read (never assumes a plain coach)', () => {
    const route = readCode('app/api/admin/rep-teams/teams/[teamId]/coaches/[membershipId]/two-step/route.ts');
    assert.ok(route.includes('if (seatErr || !seat?.role) return'));
    assert.ok(!route.includes("?? 'coach'"));
  });
  it('releasing a hold asks for the staff member’s code; "Run it now" runs only this person’s due reset', () => {
    const route = readCode('app/api/platform-admin/users/[id]/two-step-reset/route.ts');
    const release = route.indexOf("if (action === 'release') {");
    assert.ok(release > 0 && route.indexOf('requireFreshCode()', release) < route.indexOf('changeSupportReset(', release));
    assert.ok(route.includes('runDueResets(staffEmail, Date.now(), person.id)'));
  });
  it('a real code cancels a waiting reset on the server too: at a backup code, and at the sign-in landing', () => {
    assert.ok(readCode('app/api/auth/two-step/backup-code/route.ts').includes('cancelResetsOnProof(state.user.id)'));
    const dest = readCode('app/api/auth/destination/route.ts');
    assert.ok(dest.includes('if (two?.passed && two.hasFactor && provedWithin(two, 10)) await cancelResetsOnProof(two.user.id)'));
  });
  it('a team moving in starts grace only for staff who held no seat in the club before', () => {
    const move = readCode('lib/team-ownership-transfer.ts');
    assert.ok(move.indexOf('const alreadySeated = new Set(') < move.indexOf("supabaseAdmin.rpc('move_team_into_club'"));
    assert.ok(move.includes('staffIds.filter(uid => !alreadySeated.has(uid))'));
  });
});
