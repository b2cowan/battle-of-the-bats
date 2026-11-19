/**
 * BOARD READY TRUST CLOSE-OUT 13, OPEN CALL (b) (owner ruling 2026-11-18, queue P2c): AN UNACCEPTED INVITATION RUNS OUT.
 *
 * 30 days from its last send (a Resend restarts it), an invitation holds no seat, is off Home, can't be accepted at either
 * door, and Members shows it as run out with Resend and Cancel. These checks keep the rule in one place and at every door:
 *   1. the rule itself (lib/invitation-lapse.ts): the 30 days, the cutoff, a missing date reads as run out;
 *   2. Home's list, the sign-up message, the self-serve resend and sign-in's claim read only live invitations;
 *   3. both accept doors refuse a run-out one, and their writes re-check it;
 *   4. the seat and volunteer counts carry the cutoff on both kinds of pending row;
 *   5. a Resend stamps the date FIRST, and a failed stamp refuses the resend;
 *   6. Members marks a run-out row, and a run-out invitation never blocks starting a club or league.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, between } from './_source-code.ts';
import {
  INVITATION_LIFETIME_DAYS, LAPSED_INVITATION_KEPT_DAYS, invitationHasLapsed, invitationLapseCutoff, invitationPurgeCutoff,
  livePendingInvitationFilter, lapsedInvitationMessage,
} from '../../lib/invitation-lapse.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-18T12:00:00.000Z');
const ago = (days: number, extraMs = 0) => new Date(NOW.getTime() - days * DAY - extraMs).toISOString();

describe('1. the rule', () => {
  it('30 days, then a further 30 before the sweep', () => {
    assert.equal(INVITATION_LIFETIME_DAYS, 30);
    assert.equal(LAPSED_INVITATION_KEPT_DAYS, 30);
    assert.equal(invitationLapseCutoff(NOW), ago(30));
    assert.equal(invitationPurgeCutoff(NOW), ago(60));
  });
  it('lapses after 30 days, not before; a missing or broken date reads as run out', () => {
    assert.equal(invitationHasLapsed(ago(29), NOW), false);
    assert.equal(invitationHasLapsed(ago(30), NOW), false, 'exactly 30 days is the last live instant');
    assert.equal(invitationHasLapsed(ago(30, 1), NOW), true);
    assert.equal(invitationHasLapsed(null, NOW), true);
    assert.equal(invitationHasLapsed('not a date', NOW), true);
  });
  it('the live filter carries the cutoff on both kinds of pending row', () => {
    const c = invitationLapseCutoff(NOW);
    assert.equal(
      livePendingInvitationFilter(NOW),
      `and(status.eq.invited,invited_at.gte.${c}),and(status.eq.active,role.eq.coach,pending_role.not.is.null,pending_invited_at.gte.${c})`,
    );
  });
  it('the refusal names the club, or says "the club"', () => {
    assert.equal(lapsedInvitationMessage('Riverdale'), 'This invitation has run out. Ask Riverdale to send it again.');
    assert.equal(lapsedInvitationMessage(null), 'This invitation has run out. Ask the club to send it again.');
  });
});

describe('2. only a live invitation is offered', () => {
  const rec = readCode('lib/invite-reconciliation.ts');
  it('Home, the badge and the sign-in landing (listPendingInvitesForUser)', () => {
    const list = between(rec, 'export async function listPendingInvitesForUser(', 'export type PendingInviteDetails');
    assert.match(list, /\.or\(livePendingInvitationFilter\(\)\)/);
    assert.doesNotMatch(list, /PENDING_INVITATION_FILTER/);
  });
  it('the sign-up message and the self-serve resend (findPendingInviteByEmail)', () => {
    const find = between(rec, 'export async function findPendingInviteByEmail(', 'export async function listPendingInvitesForUser(');
    assert.match(find, /\.gte\('invited_at', invitationLapseCutoff\(\)\)/);
  });
  it('sign-in claims only a live invitation by email', () => {
    const claim = between(rec, 'export async function reconcilePendingInvitesForUser(', 'export type PendingInviteForEmail');
    assert.match(claim, /\.eq\('invited_email', email\)\s*\.gte\('invited_at', invitationLapseCutoff\(\)\)/);
  });
});

describe('3. neither accept door takes a run-out invitation', () => {
  it('Home\'s card: refused before the yes, and the pending write re-checks the date', () => {
    const route = readCode('app/api/auth/invitations/[memberId]/route.ts');
    const acceptPart = route.slice(route.indexOf("if (action === 'decline')"));
    assert.match(acceptPart, /if \(invitationHasLapsed\(waiting \? member\.pending_invited_at : member\.invited_at\)\) \{[\s\S]{0,200}code: 'invitation_lapsed'/);
    assert.ok(acceptPart.indexOf('invitationHasLapsed(') < acceptPart.indexOf('checkCrossOrgJoin('), 'the lapse check runs before the join');
    assert.match(route, /write\.eq\('status', 'invited'\)\.gte\('invited_at', invitationLapseCutoff\(\)\)/);
  });
  it('the set-up page: only a live row is joined; a run-out one is said as one, never as "already accepted"', () => {
    const route = readCode('app/api/auth/accept-invite/route.ts');
    const post = route.slice(route.indexOf('export const POST'));
    assert.match(post, /\.eq\('status', 'invited'\)\s*\.gte\('invited_at', cutoff\)/);
    const noLive = between(post, 'if (!member) {', 'alreadyAccepted: true');
    assert.match(noLive, /\.lt\('invited_at', cutoff\)[\s\S]*code: 'invitation_lapsed'/);
    assert.match(post, /\.update\(memberUpdate\)\s*\.eq\('id', member\.id\)\s*\.eq\('status', 'invited'\)/);
    const get = route.slice(route.indexOf('export const GET'), route.indexOf('export const POST'));
    assert.match(get, /invitationHasLapsed\(member\.invited_at as string \| null\) \? 'lapsed'/);
  });
  it('the set-up page shows a run-out invitation instead of a form, and never offers "Try again" for one', () => {
    const form = readCode('app/(consumer)/auth/accept-invite/AcceptInviteForm.tsx');
    assert.match(form, /if \(data\?\.code === 'invitation_lapsed'\) return 'lapsed';/);
    assert.match(form, /invite\?\.status !== 'lapsed'/);
  });
});

describe('4. a run-out invitation holds no seat', () => {
  it('both counts carry the cutoff; the Members banner agrees', () => {
    const roles = readCode('lib/roles.ts');
    assert.match(roles, /or\(status\.neq\.invited,invited_at\.gte\.\$\{c\}\)/);
    assert.match(roles, /export function volunteerRowsFilter\(/);
    assert.doesNotMatch(roles, /VOLUNTEER_ROWS_FILTER/);
    for (const file of ['app/api/admin/members/count/route.ts', 'lib/billing-usage.ts']) {
      assert.match(readCode(file), /\.or\(volunteerRowsFilter\(\)\)/, file);
    }
    assert.match(readCode('components/admin/kit/club/MembersKit.tsx'), /members\.filter\(m => !m\.lapsed && countsAsSeat\(m\.role, planCfg\)\)/);
  });
  it('reviving one gives it a seat back, so Resend asks the seat question first (/review)', () => {
    const route = readCode('app/api/admin/members/[memberId]/reinvite/route.ts');
    const check = between(route, 'if (invitationHasLapsed(waiting ? member.pending_invited_at : member.invited_at) && countsAsSeat(offered, planCfg)) {', 'const result = await sendPendingInviteLink(');
    assert.match(check, /\.or\(seatRowsFilter\(planCfg\)\)/);
    assert.match(check, /if \(\(seatCount \?\? 0\) >= planCfg\.seatLimit\) \{[\s\S]{0,300}code: 'seat_limit_reached'/);
  });
});

describe('5. a Resend restarts the 30 days, or says it did not', () => {
  const links = readCode('lib/invite-links.ts');
  it('the waiting role: stamped before the email, and a failed or empty stamp refuses', () => {
    const waiting = between(links, 'if (memberRow && waiting) {', 'isInvitationToOwnAccount(memberRow, authUser.invited_at)');
    assert.ok(waiting.indexOf('pending_invited_at: new Date()') < waiting.indexOf('sendExistingAccountInvite('));
    assert.match(waiting, /if \(refreshError\) return \{ ok: false/);
  });
  it('a pending row: one stamp helper, before each email, guarded on still pending', () => {
    const helper = links.slice(links.indexOf('async function restampPendingRow('));
    assert.match(helper, /\.update\(\{ invited_at: new Date\(\)\.toISOString\(\), \.\.\.extra \}\)\s*\.eq\('id', memberId\)\s*\.eq\('status', 'invited'\)/);
    const send = links.slice(links.indexOf('export async function sendPendingInviteLink('), links.indexOf('async function restampPendingRow('));
    assert.ok(send.indexOf("restampPendingRow(memberId, {})") < send.lastIndexOf('sendExistingAccountInvite('));
    assert.ok(send.indexOf('restampPendingRow(memberId, { invited_email: invitedEmail })') < send.lastIndexOf('await sendEmail('));
    assert.doesNotMatch(send, /console\.error\('\[sendPendingInviteLink\] invite (date|metadata) refresh failed/);
  });
});

describe('7. the nightly sweep removes cautiously', () => {
  const sweep = readCode('lib/invitation-sweep.ts');
  it('reads 60 days back, and every write re-checks the row as read', () => {
    assert.match(sweep, /const cutoff = invitationPurgeCutoff\(now\);/);
    assert.match(sweep, /\.update\(WAITING_ROLE_CLEARED\)[\s\S]{0,200}\.eq\('pending_role', row\.pending_role\)\s*\.eq\('pending_invited_at', row\.pending_invited_at\)/);
    assert.match(sweep, /\.delete\(\)\s*\.eq\('id', row\.id\)\s*\.eq\('status', 'invited'\)\s*\.eq\('invited_at', row\.invited_at\)/);
  });
  it('a coach row is never deleted: the waiting part only clears', () => {
    const waitingPart = between(sweep, '.not(\'pending_role\', \'is\', null)', 'const { data: pending');
    assert.doesNotMatch(waitingPart, /\.delete\(\)|deleteUser/);
  });
  it('an account is deleted only if the shared keep rule finds no use for it AND it was never used', () => {
    const pendingPart = sweep.slice(sweep.indexOf('for (const row of pending ?? [])'));
    // The keep rule reads this club's row (an invitation to an account its owner already had), so it runs BEFORE the delete.
    assert.ok(pendingPart.indexOf('readAccountKeepFacts(row.user_id, row.organization_id).catch(() => null)') < pendingPart.indexOf('.delete()'));
    // …and everything is read AGAIN just before the delete (/review: another club's invitation, or a confirm, in between),
    // and only an account created with this club's first invitation goes (/review: a self-made sign-up is its owner's).
    assert.match(sweep, /const neverUsed = !!fresh && !fresh\.email_confirmed_at && !fresh\.last_sign_in_at;/);
    assert.match(sweep, /if \(neverUsed && again && again\.reason === null && await madeByThisInvitation\(row\.organization_id, row\.user_id, fresh\.created_at\)\) \{\s*const \{ error: deleteError \} = await supabaseAdmin\.auth\.admin\.deleteUser\(row\.user_id\);/);
    assert.equal(sweep.match(/deleteUser\(/g)?.length, 1, 'one account delete, behind every test');
    const made = between(sweep, 'async function madeByThisInvitation(', 'export interface InvitationSweepReport');
    assert.match(made, /if \(!accountCreatedAt\) return false;/);
    assert.match(made, /if \(error \|\| !data\) return false;/, 'no invitation on record is a doubt, and a doubt keeps');
  });
  it('each removal is a club audit line that says it ran out', () => {
    assert.match(sweep, /'member_removed', \{[\s\S]{0,120}pendingInvite: true, lapsed: true/);
    assert.match(readCode('lib/member-audit.ts'), /p\.lapsed === true \? 'Invitation removed after it ran out' : 'Invitation cancelled'/);
  });
  it('the job is a receipt-checked scheduled call, scheduled nightly by mig 504', () => {
    const route = readCode('app/api/platform-admin/invitation-sweep-nightly/route.ts');
    assert.match(route, /const \{ machine, refused \} = await scheduledCall\(req\);\s*if \(refused\) return refused;/);
    assert.match(route, /requirePlatformPower\('run_jobs'\)/);
    assert.match(readCode('supabase/migrations/504_a_run_out_invitation_is_swept_nightly.sql'), /app_cron_http_tick\('invitation_sweep_tick', '\/api\/platform-admin\/invitation-sweep-nightly'\)/);
  });
});

describe('6. Members and the creation doors', () => {
  it('Members marks a run-out row from the same rule', () => {
    const route = readCode('app/api/admin/members/route.ts');
    assert.match(route, /const invitedAt = waiting \? m\.pending_invited_at : m\.invited_at;/);
    assert.match(route, /const lapsed = status === 'invited' && invitationHasLapsed\(invitedAt, asOf\);/);
  });
  it('a run-out invitation never blocks starting a club or a league: one question, asked by every door', () => {
    const rec = readCode('lib/invite-reconciliation.ts');
    const has = between(rec, 'export async function hasLiveInvitation(', 'export type PendingInviteForEmail');
    assert.match(has, /\.eq\('status', 'invited'\)\s*\.gte\('invited_at', invitationLapseCutoff\(\)\)/);
    for (const file of ['app/api/org/create/route.ts', 'app/(consumer)/start/tournament/page.tsx', 'lib/start-plan-server.ts']) {
      const code = readCode(file);
      assert.match(code, /hasLiveInvitation\(user\.id\)/, file);
      assert.doesNotMatch(code, /\.eq\('status', 'invited'\)/, `${file}: its own pending read, without the clock`);
    }
  });
});

describe('8. every door that reads pending invitations is accounted for', () => {
  // ⚖ The rule is read at use, so a new door that reads `organization_members` pending rows without the clock would offer
  // a run-out invitation as live. Any file that does must be named here, with why it may (/simplify altitude, 2026-11-18).
  const ALLOWED: Record<string, string> = {
    'lib/invitation-lapse.ts': 'the rule itself',
    'lib/waiting-board-role.ts': 'defines the unclocked filter',
    'lib/invite-reconciliation.ts': 'every read carries the cutoff (section 2); the re-point write re-checks a row already read live',
    'lib/invite-links.ts': 'Resend restamps a pending row, which is what revives a run-out one',
    'lib/invitation-sweep.ts': 'the sweep: removes run-out rows 60 days after the last send',
    'lib/user-contexts.ts': 'findInvitedMembershipSlug carries the cutoff',
    'lib/club-group-email-board.ts': 'the board email names everyone it leaves out, an unanswered invitee included',
    'app/api/auth/invitations/[memberId]/route.ts': 'finds a run-out invitation to refuse it by name; the accept write re-checks the clock',
    'app/api/auth/accept-invite/route.ts': 'the live read carries the cutoff; the run-out read exists to refuse it',
  };
  const PENDING_READ = /\.eq\('status', 'invited'\)|status\.eq\.invited|PENDING_INVITATION_FILTER|\.in\('status', \[[^\]]*'invited'/;
  it('no unlisted file reads organization_members pending rows', async () => {
    const { readdirSync, statSync } = await import('node:fs');
    const { join, relative } = await import('node:path');
    const root = process.cwd();
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) files.push(relative(root, p).replace(/\\/g, '/'));
      }
    };
    for (const d of ['app', 'lib', 'components']) walk(join(root, d));
    const offenders = files.filter(f => {
      const code = readCode(f);
      return code.includes("'organization_members'") && PENDING_READ.test(code) && !(f in ALLOWED);
    });
    assert.deepEqual(offenders, [], 'a door reads pending invitations without the 30-day rule (lib/invitation-lapse.ts); use it, or list the file here with why');
    // The list stays honest: every file on it still reads pending rows (a stale entry would excuse a future door).
    for (const f of Object.keys(ALLOWED)) assert.ok(files.includes(f) && PENDING_READ.test(readCode(f)), `${f}: listed but no longer a pending read`);
  });
});
