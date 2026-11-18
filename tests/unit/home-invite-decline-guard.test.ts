import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { NOTIFICATION_CATEGORY, NOTIFICATION_EVENT_LABELS, PUSH_DEFAULT_ON_EVENTS } from '../../lib/notification-labels.ts';

/**
 * A decline on Home asks first, and tells the club (owner 2026-11-18). A decline cannot be taken back, and the two
 * buttons sit side by side — so a Decline button that answers on its own tap is the regression this holds.
 */
describe('Home invitation decline', () => {
  it('both Decline buttons open the question rather than answering', () => {
    const card = readCode('components/home/PendingInvitationsCard.tsx');
    assert.match(card, /onClick=\{\(\) => setDeclineAsk\(\{ kind: 'coach'/);
    assert.match(card, /onClick=\{\(\) => setDeclineAsk\(\{ kind: 'member'/);
    // The only decline calls are the window's own.
    assert.doesNotMatch(card, /respondCoach\(invite\.inviteId, 'decline'/);
    assert.doesNotMatch(card, /respond\(invite\.memberId, 'decline'/);
    assert.match(card, /respondCoach\(ask\.id, 'decline'\)/);
    assert.match(card, /respond\(ask\.id, 'decline', ask\.role\)/);
    assert.match(card, /title="Decline this invitation\?"/);
  });

  it('a staff invitation declined tells the club, as a coach invitation does', () => {
    const route = readCode('app/api/auth/invitations/[memberId]/route.ts');
    // One call for both declines (P2b): a pending row's, and a club coach's waiting board role, named by the role offered.
    assert.match(route, /await tellClubMemberInviteDeclined\(\{ \.\.\.member, role: offeredRole \}, user\)/);
    assert.match(route, /eventType: 'member_invite_declined'/);
    assert.equal(NOTIFICATION_CATEGORY.member_invite_declined, 'know');
    assert.ok(NOTIFICATION_EVENT_LABELS.member_invite_declined);
    assert.ok(PUSH_DEFAULT_ON_EVENTS.has('member_invite_declined'));
  });
});
