/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * Board Ready · two-step sign-in · Part 4 — what the club sees, and the words (drawings tabs 6 and 8; owner rulings
 * 2026-11-10 asks 6, 7, E, F and 2026-11-12 at the UX summary).
 *
 *   1. The Members column's states: On, Off, "Not set up · N days" (amber), "Not set up" past the deadline (amber, no
 *      count), — for an invitation; a seat no switch covers is only ever On or Off.
 *   2. Who sees it: the club's owners and admins only (the route decides; the screen follows what came back), never The
 *      board tab; the list reads only this club's people (no platform-wide 1,000-account page).
 *   3. The Overview notice: owners and admins; the owner's one-time card closes for good; one spot, two-step first.
 *   4. The emails: no link in any of the five, each with "This email has no link on purpose", no offer (CASL).
 *   5. The grace emails ride the hourly job, after the resets, claimed before they are sent.
 *   6. The account alarms are wired where the change happens.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { daysLeftUntil, memberTwoStep } from '../../lib/two-step-club-status.ts';
import { twoStepIsWaiting, twoStepWords } from '../../components/admin/kit/club/members-types.ts';
import {
  passwordChangedEmail, twoStepGraceReminderEmail, twoStepGraceStartedEmail, twoStepTurnedOffEmail, twoStepTurnedOnEmail,
} from '../../lib/two-step-email-words.ts';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-20T15:00:00.000Z');
const club = (board: string | null, coaches: string | null = null) => ({
  two_step_board_required_since: board, two_step_coaches_required_since: coaches,
  is_test_organization: false, account_kind: null, plan_id: 'club',
});

describe('1 · the column’s states', () => {
  const switchedOn = new Date(NOW - 5 * DAY).toISOString(); // 9 days left

  it('on is On, whatever the seat', () => {
    assert.deepEqual(memberTwoStep(club(switchedOn), 'treasurer', null, true, NOW), { state: 'on' });
    assert.deepEqual(memberTwoStep(club(null), 'staff', null, true, NOW), { state: 'on' });
  });
  it('a seat no switch covers is Off, never amber (staff, volunteers, a coach while only the board is required)', () => {
    for (const role of ['staff', 'official', 'coach']) {
      assert.deepEqual(memberTwoStep(club(switchedOn), role, null, false, NOW), { state: 'off' }, role);
    }
    assert.deepEqual(memberTwoStep(club(null), 'treasurer', null, false, NOW), { state: 'off' });
  });
  it('a required seat inside its 14 days: Not set up · 9 days', () => {
    const s = memberTwoStep(club(switchedOn), 'league_registrar', null, false, NOW);
    assert.equal(s.state, 'not_set_up');
    assert.equal(twoStepWords(s), 'Not set up · 9 days left');
    assert.ok(twoStepIsWaiting(s));
  });
  it('a later seat start moves the deadline later (the person’s own 14 days)', () => {
    const own = new Date(NOW - 1 * DAY).toISOString();
    const s = memberTwoStep(club(switchedOn), 'treasurer', own, false, NOW);
    assert.equal(twoStepWords(s), 'Not set up · 13 days left');
  });
  it('past the deadline: Not set up, amber, no count (ask E)', () => {
    const s = memberTwoStep(club(new Date(NOW - 20 * DAY).toISOString()), 'admin', null, false, NOW);
    assert.equal(s.state, 'overdue');
    assert.equal(twoStepWords(s), 'Not set up');
    assert.ok(twoStepIsWaiting(s));
  });
  it('a test organization never requires it', () => {
    const s = memberTwoStep({ ...club(switchedOn), is_test_organization: true }, 'owner', null, false, NOW);
    assert.deepEqual(s, { state: 'off' });
  });
  it('one day left says "1 day left"; the count never reaches 0 while time remains', () => {
    assert.equal(daysLeftUntil(NOW + 60_000, NOW), 1);
    assert.equal(twoStepWords({ state: 'not_set_up', deadline: '', daysLeft: 1 }), 'Not set up · 1 day left');
  });
});

describe('2 · who sees it, and whose accounts are read', () => {
  const route = readCode('app/api/admin/members/route.ts');
  it('the route sends the state only to an owner or admin viewer, and never guesses a state it could not read', () => {
    assert.match(route, /const seesTwoStep = viewer\?\.role === 'owner' \|\| viewer\?\.role === 'admin';/);
    assert.match(route, /\.\.\.\(seesTwoStep \? \{ twoStep \} : \{\}\)/);
    assert.match(route, /!switches || status === 'invited' || !authUsers*? null/);
  });
  it('a suspended person reads only On or Off, never the amber count (the Overview counts active seats only)', () => {
    assert.match(route, /: status === 'suspended'\s*\? \{ state: authUser\.twoStepOn \? 'on' : 'off' \}/);
  });
  it('the list reads only this club’s people (owner ruling 2026-11-12), never the platform-wide account page', () => {
    assert.doesNotMatch(route, /listUsers/);
    assert.match(route, /peopleSignInFacts\(members\.map/);
  });
  it('the screen follows what came back (never a guess from the viewer’s role), in every place it shows', () => {
    const screen = readCode('components/admin/kit/club/MembersKit.tsx');
    assert.match(screen, /const twoStepShown = members\.some\(m => m\.twoStep !== undefined\);/);
    assert.match(screen, /\{twoStepShown && <th scope="col">Two-step<\/th>\}/);
    assert.match(screen, /twoStepShown\s*\? \[\.\.\.EXPORT_COLS\.slice\(0, 4\), EXPORT_TWO_STEP_COL/);
  });
  it('never on The board tab (ask 6)', () => {
    assert.doesNotMatch(readCode('app/[orgSlug]/admin/org/board/page.tsx'), /twoStep|two-step/i);
    assert.doesNotMatch(readCode('app/api/admin/board/route.ts'), /twoStep|two_step|people_sign_in_facts/);
  });
  it('the people read is the server key’s alone (mig 475)', () => {
    const mig = readCode('supabase/migrations/475_the_club_reads_its_own_people.sql');
    assert.match(mig, /REVOKE ALL ON FUNCTION public\.people_sign_in_facts\(uuid\[\]\) FROM PUBLIC, anon, authenticated;/);
    assert.match(mig, /SECURITY DEFINER SET search_path = public, pg_temp/);
  });
});

describe('3 · the Overview notice', () => {
  const route = readCode('app/api/admin/org-settings/two-step/overview/route.ts');
  it('owners and admins read it; only the owner closes the card; the card is the owner’s alone', () => {
    const get = route.slice(route.indexOf('export const GET'), route.indexOf('export const POST'));
    const post = route.slice(route.indexOf('export const POST'));
    assert.match(get, /if \(ctx\.role !== 'owner' && ctx\.role !== 'admin'\) return forbidden\(\);/);
    assert.match(get, /const prompt = ctx\.role === 'owner' && !anyOn && !org\.two_step_prompt_closed_at;/);
    assert.match(post, /if \(ctx\.role !== 'owner'\) return forbidden\(\);/);
    assert.match(post, /\.is\('two_step_prompt_closed_at', null\)/, 'the first close is the one kept');
  });
  it('turning a requirement on, and opening Settings, close the card for good', () => {
    assert.match(readCode('app/api/admin/org-settings/two-step/route.ts'), /if \(on\) \{\s*await supabaseAdmin\.from\('organizations'\)\.update\(\{ two_step_prompt_closed_at: nowIso \}\)/);
    assert.match(readCode('components/admin/kit/club/TwoStepRequirementCard.tsx'), /two-step\/overview\$\{orgQuery\}`, \{ method: 'POST' \}/);
  });
  it('one spot under the bar: the two-step notice first, the What’s-new line as its fallback (owner 2026-11-12)', () => {
    const hub = readCode('components/admin/kit/club/ClubHubKit.tsx');
    assert.match(hub, /<TwoStepOverviewNotice[\s\S]{0,200}fallback=\{<WhatsNewNote \/>\}/);
    assert.doesNotMatch(hub.replace(/fallback=\{<WhatsNewNote \/>\}/, ''), /<WhatsNewNote \/>/, 'never a second What’s-new line');
  });
});

describe('4 · the five emails: no link, said so, no offer', () => {
  const mails = [
    twoStepGraceStartedEmail({ orgName: 'Milton Minor Ball', which: 'board', roleWord: 'Treasurer', deadlineIso: '2026-11-26T15:00:00.000Z' }),
    twoStepGraceStartedEmail({ orgName: 'Milton Minor Ball', which: 'coaches', roleWord: 'Coach', deadlineIso: '2026-11-26T15:00:00.000Z' }),
    twoStepGraceReminderEmail({ orgName: 'Milton Minor Ball', which: 'board', roleWord: 'Registrar', deadlineIso: '2026-11-26T15:00:00.000Z', daysLeft: 3 }),
    twoStepTurnedOnEmail({ atIso: '2026-11-12T15:00:00.000Z', newPhone: false }),
    twoStepTurnedOnEmail({ atIso: '2026-11-12T15:00:00.000Z', newPhone: true }),
    twoStepTurnedOffEmail({ atIso: '2026-11-12T15:00:00.000Z' }),
    passwordChangedEmail({ atIso: '2026-11-12T15:00:00.000Z', othersSignedOut: true }),
    passwordChangedEmail({ atIso: '2026-11-12T15:00:00.000Z', othersSignedOut: false }),
    twoStepTurnedOnEmail({ atIso: '2026-11-12T15:00:00.000Z', newPhone: true, oldRemoved: false }),
  ];
  for (const m of mails) {
    it(m.subject, () => {
      assert.doesNotMatch(m.html, /<a\s|href=/i, 'no link');
      assert.match(m.html, /This email has no link on purpose/);
      assert.doesNotMatch(m.html, /\$\d|price|upgrade|plan|offer|discount/i, 'no offer (CASL: a security notice)');
      assert.doesNotMatch(m.html, /\.\./, 'no doubled full stop after a time that ends "p.m."');
    });
  }
  it('the grace emails say how to set it up without a link', () => {
    assert.match(mails[0].html, /open Account, then Sign-in &amp; security/);
    assert.match(mails[2].subject, /^3 days left/);
  });
});

describe('5 · the grace emails ride the hourly job', () => {
  it('the job runs the resets first, then the emails, and a failure in one never stops the other', () => {
    const job = readCode('app/api/platform-admin/two-step-resets-hourly/route.ts');
    const resets = job.indexOf('report = await runDueResets(actor);');
    const emails = job.indexOf('graceEmails = await sendDueGraceEmails(');
    assert.ok(resets > 0 && emails > resets);
    assert.match(job.slice(resets, emails), /catch \(e\)/);
  });
  it('each email is claimed before it is sent, and a failed send gives back only its own claim', () => {
    const lib = readCode('lib/two-step-grace-emails.ts');
    assert.ok(lib.indexOf('await claim(') < lib.indexOf('await sendTwoStepEmail('));
    assert.match(lib, /await giveBack\(org\.id, person\.userId, column, person\.deadline\)/);
    assert.match(lib, /\.eq\(column, deadline\);/, 'never clears a newer deadline');
    assert.match(lib, /\.or\(`\$\{column\}\.is\.null,\$\{column\}\.neq\."\$\{deadline\}"`\)/);
  });
  it('the job fits inside the app’s ~30-second limit: a budget from the request’s start, a limit per send (/review)', () => {
    const lib = readCode('lib/two-step-grace-emails.ts');
    assert.match(lib, /export const GRACE_EMAIL_BUDGET_MS = 15_000;/);
    assert.match(lib, /timeoutMs: SEND_TIMEOUT_MS/);
    assert.match(lib, /if \(!process\.env\.RESEND_API_KEY\) return report;/, 'no mail key: nothing claimed, nothing failed');
    assert.match(readCode('app/api/platform-admin/two-step-resets-hourly/route.ts'), /sendDueGraceEmails\(\{ stopAt: startedAt \+ GRACE_EMAIL_BUDGET_MS \}\)/);
  });
  it('the switch route sends no grace email inside the owner’s press', () => {
    assert.doesNotMatch(readCode('app/api/admin/org-settings/two-step/route.ts'), /twoStepGraceStartedEmail/);
  });
});

describe('6 · the account alarms', () => {
  const cases: [string, RegExp][] = [
    ['app/api/auth/two-step/set-up/verify/route.ts', /twoStepTurnedOnEmail\(/],
    ['app/api/auth/two-step/turn-off/route.ts', /twoStepTurnedOffEmail\(/],
    ['app/api/auth/password/route.ts', /passwordChangedEmail\(/],
    ['app/api/auth/two-step/reset-password/route.ts', /passwordChangedEmail\(/],
    ['app/api/auth/password-reset-notice/route.ts', /passwordChangedEmail\(/],
  ];
  for (const [file, call] of cases) {
    it(`${file} tells the account after the change`, () => assert.match(readCode(file), call));
  }
  it('the turn-off email goes only after every authenticator is removed', () => {
    const code = readCode('app/api/auth/two-step/turn-off/route.ts');
    assert.ok(code.indexOf('removeEveryAuthenticator(user.id)') < code.indexOf('twoStepTurnedOffEmail('));
  });
  it('the password email waits until this device is signed back in and the others are sent away (/review)', () => {
    const code = readCode('app/api/auth/password/route.ts');
    assert.ok(code.indexOf("signOut({ scope: 'others' })") < code.indexOf('passwordChangedEmail('));
  });
  it('the ordinary reset page asks for the notice (it saves straight with the sign-in service), and only outside the backup-code save', () => {
    assert.match(readCode('app/(consumer)/auth/reset-password/page.tsx'), /if \(!viaBackupCode\) void fetch\('\/api\/auth\/password-reset-notice'/);
  });
  it('the reset notice goes only to a person signed in with both steps, within the freshness window, after the others are signed out', () => {
    const code = readCode('app/api/auth/password-reset-notice/route.ts');
    // Both steps, never the password alone (owner 2026-11-26).
    assert.match(code, /const user = await getSignedInUser\(supabase\);/);
    assert.doesNotMatch(code, /auth\.getUser\(|readSessionTwoStep|getSessionTwoStep|\?\?\s*\(await/);
    const refuses = code.indexOf('if (!user?.email) return');
    assert.ok(refuses >= 0 && refuses < code.indexOf("signOut({ scope: 'others' })"), 'refused before anyone is signed out');
    assert.match(code, /user\.updated_at/);
    assert.match(code, /FRESH_MS/);
    assert.ok(code.indexOf("signOut({ scope: 'others' })") < code.indexOf('passwordChangedEmail('));
  });
  for (const [file] of cases) {
    it(`${file}: the alarm has a short time limit`, () => assert.match(readCode(file), /timeoutMs: 5_000/));
  }
});
