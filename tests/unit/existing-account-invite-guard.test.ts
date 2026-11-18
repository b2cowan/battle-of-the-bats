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
 *   5. cancelling a pending invitation sends no "access removed" email and never deletes an account its owner already had.
 * ⚠ The one branch left on the spot is a club's own COACH made a board member (an owner call, recorded in the sweep report).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, between } from './_source-code.ts';

const invite = readCode('app/api/admin/members/invite/route.ts');
// The existing-account branch's new pending write, up to the coach-row upgrade that follows it.
const pendingBranch = between(invite, 'if (!sameMember && existingUser.email_confirmed_at) {', 'const { error: insertError } = await supabaseAdmin');

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
    assert.match(readCode('app/api/auth/invitations/[memberId]/route.ts'), /startTwoStepGrace\(user\.id, member\.organization_id, member\.role\)/);
  });
  it('the only `active` write left in the route is the coach-row upgrade', () => {
    assert.equal((invite.match(/status: 'active'/g) ?? []).length, 1);
    assert.match(invite, /\.update\(\{ role, status: 'active', accepted_at: nowIso, capabilities \}\)[\s\S]{0,160}\.eq\('role', 'coach'\)/);
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
  it('the route sends the invitation email in its existing-account form, to Home', () => {
    assert.match(pendingBranch, /orgInviteHtml\(\{[^}]*existingAccount: true \}\)/);
    assert.match(pendingBranch, /inviteUrl: existingAccountInviteUrl\(appUrl\)/);
    assert.match(pendingBranch, /ctaLabel: INVITE_EMAIL_ACTION\.signInToAccept/);
    assert.doesNotMatch(pendingBranch, /orgMemberAddedHtml|generateLink|acceptInvitePath/);
  });
  it('the link is a plain sign-in that lands on Home, never the set-up page', () => {
    const links = readCode('lib/invite-links.ts');
    assert.match(links, /return `\$\{appUrl\}\/auth\/login\?next=\$\{encodeURIComponent\('\/discover'\)\}`;/);
  });
  it('a resend of such an invitation goes the same way, with no generated link and no email backfill', () => {
    const links = readCode('lib/invite-links.ts');
    const own = between(links, 'if (memberRow && authUser.email_confirmed_at && isInvitationToOwnAccount(memberRow, authUser.invited_at)) {', "return { ok: true, existingAccount: true };");
    assert.match(own, /existingAccount: true/);
    assert.doesNotMatch(own, /generateLink|invited_email/);
    assert.ok(links.indexOf('isInvitationToOwnAccount(memberRow') < links.indexOf('generateLink(genParams)'), 'the link is generated first');
  });
  it('the existing-account email drops the set-up and the 24 hours', () => {
    const email = readCode('lib/email.ts');
    const fn = between(email, 'export function orgInviteHtml(', 'export function assistantCoachInviteHtml(');
    assert.match(fn, /p\.existingAccount\s*\?\s*'<p>You already have a FieldLogicHQ account, so there’s nothing to set up\./);
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
    assert.match(accept, /if \(typeof body\?\.role === 'string' && body\.role !== member\.role\) \{[\s\S]{0,200}code: 'invitation_changed'/);
    assert.ok(accept.indexOf("code: 'invitation_changed'") < accept.indexOf(".update(memberUpdate)"));
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
