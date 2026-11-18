/**
 * BOARD READY TRUST CLOSE-OUT 13 (owner 2026-11-18): AN EXISTING ACCOUNT IS INVITED, NEVER ADDED ON THE SPOT.
 *
 * Inviting an email that already had a FieldLogicHQ account used to write an ACTIVE membership with no yes from its owner,
 * start their two-step days and email "You've been added". Now it writes the same pending row a new person gets; the
 * person accepts or declines on Home. These checks keep each door of that shut:
 *   1. the invite route's existing-account write is `invited`, with no accepted_at and no two-step start before the yes;
 *   2. its email says "sign in to accept", never "you now have access", and never the set-up page (whose form sets a password);
 *   3. a demo's shared account and FieldLogicHQ support are refused as invitees, and a demo account can't accept;
 *   4. no member edit turns a pending row into a membership — only the person does;
 *   5. cancelling a pending invitation sends no "access removed" email and never deletes an account its owner already had;
 *   6. a club's own COACH given a board role accepts it too (owner 2026-11-18, P2b, mig 503): the role WAITS on their coach
 *      row, which accept, decline and Cancel never delete; "You've been added" is retired.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, between } from './_source-code.ts';

const invite = readCode('app/api/admin/members/invite/route.ts');
// The existing-account branch's new pending write, up to the coach-row branch that follows it.
// (`readCode` strips comments, so every anchor is code.)
const pendingBranch = between(invite, 'if (!sameMember && existingUser.email_confirmed_at) {', 'if (sameMember) {');
// The coach-row branch (P2b), to the new person's set-up invitation.
const coachBranch = between(invite, 'if (sameMember) {', 'const next = encodeURIComponent(acceptInvitePath(');
const links = readCode('lib/invite-links.ts');
const existingSender = between(links, 'export async function sendExistingAccountInvite(', 'export async function sendPendingInviteLink(');

describe('1. the existing-account write is a pending invitation', () => {
  it('writes status invited, with no accepted_at', () => {
    assert.match(pendingBranch, /status: 'invited',/);
    assert.doesNotMatch(pendingBranch, /status: 'active'|accepted_at/, 'the existing account is joined on the spot again');
  });
  it('leaves invited_email empty — the mark a resend and a Cancel read', () => {
    assert.doesNotMatch(pendingBranch, /invited_email/);
  });
  it('starts no two-step days: those begin on the yes, in the accept routes', () => {
    assert.doesNotMatch(pendingBranch, /startTwoStepGrace/);
    assert.match(readCode('app/api/auth/invitations/[memberId]/route.ts'), /startTwoStepGrace\(user\.id, member\.organization_id, offeredRole\)/);
  });
  it('the route writes no membership at all: no `active` status, no accepted_at, no two-step start (P2b)', () => {
    assert.doesNotMatch(invite, /status: 'active'/);
    assert.doesNotMatch(invite, /accepted_at:/);
    assert.doesNotMatch(invite, /startTwoStepGrace\(/);
  });
  it('a second invitation to someone already pending says so — a pending coaching row included, before the coach upgrade', () => {
    assert.match(invite, /if \(sameMember\?\.status === 'invited'\) \{[\s\S]{0,400}code: 'already_invited'/);
    assert.ok(invite.indexOf("sameMember?.status === 'invited'") < invite.indexOf("sameMember.role !== 'coach'"));
  });
  it('only a CONFIRMED account takes the sign-in path; an unconfirmed one gets the set-up invitation', () => {
    assert.match(invite, /if \(!sameMember && existingUser\.email_confirmed_at\) \{/);
    assert.match(readCode('lib/invite-links.ts'), /if \(memberRow && authUser\.email_confirmed_at && isInvitationToOwnAccount\(/);
  });
});

describe('2. the email asks them to sign in and accept', () => {
  it('the route sends the invitation email in its existing-account form, to Home, from the one sender', () => {
    assert.match(pendingBranch, /await sendExistingAccountInvite\(\{/);
    assert.doesNotMatch(pendingBranch, /orgMemberAddedHtml|generateLink|acceptInvitePath/);
    assert.match(existingSender, /inviteUrl: existingAccountInviteUrl\(appUrl\)/);
    assert.match(existingSender, /ctaLabel: INVITE_EMAIL_ACTION\.signInToAccept/);
    assert.match(existingSender, /existingAccount: true,/);
    assert.match(existingSender, /opens: memberOpensSentence\(p\.role, p\.capabilities\)/);
  });
  it('the link is a plain sign-in that lands on Home, never the set-up page', () => {
    const links = readCode('lib/invite-links.ts');
    assert.match(links, /return `\$\{appUrl\}\/auth\/login\?next=\$\{encodeURIComponent\('\/discover'\)\}`;/);
  });
  it('a resend of such an invitation goes the same way, with no generated link and no email backfill', () => {
    const own = between(links, 'if (memberRow && authUser.email_confirmed_at && isInvitationToOwnAccount(memberRow, authUser.invited_at)) {', "return { ok: true, existingAccount: true };");
    assert.match(own, /await sendExistingAccountInvite\(\{/);
    assert.doesNotMatch(own, /generateLink|invited_email/);
    assert.ok(links.indexOf('isInvitationToOwnAccount(memberRow') < links.indexOf('generateLink(genParams)'), 'the link is generated first');
  });
  it('the existing-account email drops the set-up and the 24 hours', () => {
    const email = readCode('lib/email.ts');
    const fn = between(email, 'export function orgInviteHtml(', 'export function assistantCoachInviteHtml(');
    assert.match(fn, /p\.existingAccount\s*\?\s*`<p>You already have a FieldLogicHQ account, so there’s nothing to set up\./);
  });
});

describe('3. demo and support addresses', () => {
  it('the invite refuses both, with ONE neutral answer, before anything is read or written', () => {
    const at = invite.indexOf('if (isDemoOrganizerEmail(email) || await isPlatformAdminEmail(email))');
    assert.ok(at > 0);
    assert.ok(at < invite.indexOf('findAuthUserByEmail(email)'));
    assert.ok(at < invite.indexOf(".from('organization_members')"), 'the seat count runs first');
    assert.doesNotMatch(invite, /belongs to FieldLogicHQ support|code: 'platform_staff'/, 'a refusal that names support is an oracle');
  });
  it('a yes from Home is to the role the card showed', () => {
    const accept = readCode('app/api/auth/invitations/[memberId]/route.ts');
    assert.match(accept, /if \(typeof body\?\.role === 'string' && body\.role !== offeredRole\) \{[\s\S]{0,200}code: 'invitation_changed'/);
    assert.match(accept, /const offeredRole = waiting \?\? \(member\.role as string\);/);
    assert.ok(accept.indexOf("code: 'invitation_changed'") < accept.indexOf('.update(memberUpdate)'));
    assert.match(readCode('components/home/PendingInvitationsCard.tsx'), /body: JSON\.stringify\(\{ action, role \}\)/);
  });
  it('a demo account can accept at neither accept door', () => {
    for (const file of ['app/api/auth/invitations/[memberId]/route.ts', 'app/api/auth/accept-invite/route.ts']) {
      const code = readCode(file);
      const post = code.slice(code.indexOf('export const POST'));
      assert.ok(post.indexOf('isDemoOrganizerEmail(user.email)') > 0, file);
      assert.ok(post.indexOf('isDemoOrganizerEmail(user.email)') < post.indexOf(".from('organization_members')"), `${file}: refused after the read`);
    }
  });
});

describe('4. only the person turns an invitation into a membership', () => {
  it('a member edit that sets a status on a pending row is refused', () => {
    const route = readCode('app/api/admin/members/[memberId]/route.ts');
    const patch = route.slice(route.indexOf('export const PATCH'));
    assert.match(patch, /if \(hasStatusUpdate && target\.status === 'invited'\) \{[\s\S]{0,200}code: 'invitation_pending'/);
    assert.ok(patch.indexOf("target.status === 'invited'") < patch.indexOf('.update(update)'));
  });
});

describe('5. cancelling a pending invitation', () => {
  const route = readCode('app/api/admin/members/[memberId]/route.ts');
  const del = route.slice(route.indexOf('export const DELETE'), route.indexOf('export const PATCH'));
  it('sends no "access removed" email', () => {
    assert.match(del, /const pendingInvite = target\.status === 'invited';/);
    assert.match(del, /if \(targetEmail && !pendingInvite\) \{[\s\S]{0,200}memberRemovedHtml/);
  });
  it('the keep-the-account answer counts an invitation to the person\'s own account', () => {
    const helper = readCode('lib/member-account-keep-server.ts');
    assert.match(helper, /invitedOwnAccount: thisRow\.data \? isInvitationToOwnAccount\(thisRow\.data, authUser\.data\.user\?\.invited_at\) : false/);
    assert.match(helper, /if \(thisRow\.error\) throw thisRow\.error;/);
    assert.match(helper, /if \(authUser\.error\) throw authUser\.error;/);
  });
  it('the window calls it what it is', () => {
    const dialog = readCode('components/admin/kit/club/ManageMemberDialog.tsx');
    assert.match(dialog, /\{pending \? 'Cancel invitation…' : 'Remove…'\}/);
  });
});

describe('6. a club\'s own coach given a board role accepts it too (P2b, owner 2026-11-18)', () => {
  it('the invite parks the role on the coach row, never rewriting it', () => {
    assert.match(coachBranch, /\.update\(\{ pending_role: role, pending_capabilities: capabilities, pending_invited_at: nowIso \}\)/);
    assert.match(coachBranch, /\.eq\('role', 'coach'\)\s*\.eq\('status', 'active'\)\s*\.is\('pending_role', null\)/);
    assert.doesNotMatch(coachBranch, /update\(\{ role[,\s]/, 'the coach row is given the board role on the spot again');
    assert.match(coachBranch, /await sendExistingAccountInvite\(\{[^}]*keepsCoaching: true/);
    assert.match(invite, /if \(sameMember\?\.pending_role\) \{[\s\S]{0,200}code: 'already_invited'/);
  });
  it('"You\'ve been added" is retired: no template, no sender, no volunteer note, no bare "Sign in" button', () => {
    for (const file of ['lib/email.ts', 'app/api/admin/members/invite/route.ts', 'lib/invite-links.ts']) {
      assert.doesNotMatch(readCode(file), /orgMemberAddedHtml|kind: 'org_member_added'/, file);
    }
    const words = readCode('lib/volunteer-words.ts');
    assert.doesNotMatch(words, /\badded: \{/);
    assert.doesNotMatch(words, /signIn: 'Sign in'/);
  });
  it('one test, one filter and one clear for a waiting role, shared by every door', () => {
    const w = readCode('lib/waiting-board-role.ts');
    assert.match(w, /row\.role === 'coach' && row\.status === 'active' && row\.pending_role \? row\.pending_role : null/);
    assert.match(w, /PENDING_INVITATION_FILTER = 'status\.eq\.invited,and\(status\.eq\.active,role\.eq\.coach,pending_role\.not\.is\.null\)'/);
    for (const file of ['app/api/auth/invitations/[memberId]/route.ts', 'lib/invite-reconciliation.ts']) {
      assert.match(readCode(file), /\.or\(PENDING_INVITATION_FILTER\)/, file);
    }
  });
  it('accept moves the waiting role onto the row and starts two-step on it; decline clears it and never deletes the row', () => {
    const accept = readCode('app/api/auth/invitations/[memberId]/route.ts');
    const decline = between(accept, "if (action === 'decline') {", '} else {');
    assert.match(decline, /if \(waiting\) \{[\s\S]*\.update\(WAITING_ROLE_CLEARED\)/);
    assert.doesNotMatch(decline, /\.delete\(\)/, 'a decline deletes their coaching row');
    assert.match(accept, /\? \{ role: waiting, capabilities: member\.pending_capabilities \?\? null, accepted_at: new Date\(\)\.toISOString\(\), \.\.\.WAITING_ROLE_CLEARED \}/);
    assert.match(accept, /write\.eq\('role', 'coach'\)\.eq\('pending_role', waiting\)/);
    assert.match(accept, /startTwoStepGrace\(user\.id, member\.organization_id, offeredRole\)/);
  });
  it('Cancel and Resend reach the waiting role; Cancel never deletes the coach row', () => {
    const route = readCode('app/api/admin/members/[memberId]/route.ts');
    const del = route.slice(route.indexOf('export const DELETE'), route.indexOf('export const PATCH'));
    const coachCancel = between(del, 'if (waiting) {', "if (target.role === 'coach') return coachingStaffRowRefusal();");
    assert.match(coachCancel, /\.update\(WAITING_ROLE_CLEARED\)/);
    assert.doesNotMatch(coachCancel, /\.delete\(\)|deleteUser|sendEmail/);
    const resend = readCode('app/api/admin/members/[memberId]/reinvite/route.ts');
    assert.match(resend, /if \(member\.role === 'coach' && !waiting\) return coachingStaffRowRefusal\(\);/);
    const send = between(links, 'const waiting = waitingBoardRole(memberRow);', 'isInvitationToOwnAccount(memberRow, authUser.invited_at)');
    assert.match(send, /role: waiting, capabilities: memberRow\.pending_capabilities,[\s\S]{0,200}keepsCoaching: true/);
    assert.match(send, /\.update\(\{ pending_invited_at: new Date\(\)\.toISOString\(\) \}\)/);
  });
  it('a waiting board role holds its seat in every seat count', () => {
    assert.match(readCode('lib/roles.ts'), /return `role\.not\.in\.\$\{exempt\},and\(status\.eq\.active,pending_role\.not\.in\.\$\{exempt\}\)`;/);
    for (const file of ['app/api/admin/members/invite/route.ts', 'app/api/admin/members/[memberId]/route.ts', 'app/api/admin/members/count/route.ts', 'lib/billing-usage.ts']) {
      const code = readCode(file);
      assert.match(code, /\.or\(seatRowsFilter\((planCfg|plan)\)\)/, file);
      assert.doesNotMatch(code, /\.not\('role', 'in'/, `${file}: a seat count that misses a waiting board role`);
    }
  });
  it('a coach taken off their last team keeps the invitation, as an ordinary pending one', () => {
    const cleanup = between(readCode('lib/coach-membership.ts'), 'async function cleanupOrphanedGuestOrgMembership(', 'export interface CalendarLinkState');
    assert.match(cleanup, /\.delete\(\)[\s\S]{0,160}\.eq\('role', 'coach'\)\s*\.is\('pending_role', null\)/, 'the waiting role is deleted with the row');
    assert.match(cleanup, /role: kept\.pending_role,[\s\S]{0,200}status: 'invited',/);
  });
});
