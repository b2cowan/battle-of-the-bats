import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { accountKeptReason, isInvitationToOwnAccount } from '../../lib/member-account-keep.ts';

/** Remove member's one decision (Stage 13 fix-now 2, F-A5-10): the account is deleted only when it has no other use. */
describe('is a removed member\'s account kept?', () => {
  const none = { otherOrgCount: 0, basicCoachTeamCount: 0, familyLinkCount: 0 };
  it('no other use: deleted', () => assert.equal(accountKeptReason(none), null));
  it('another organization: kept', () => assert.equal(accountKeptReason({ ...none, otherOrgCount: 2 }), 'other_org'));
  it('a free Coaches Portal team: kept', () => assert.equal(accountKeptReason({ ...none, basicCoachTeamCount: 1 }), 'basic_coach_portal'));
  it('a parent connected to a child\'s team: kept (F-A5-10)', () => assert.equal(accountKeptReason({ ...none, familyLinkCount: 1 }), 'family_link'));
  it('several reasons: the first that holds is the one recorded', () => {
    assert.equal(accountKeptReason({ otherOrgCount: 1, basicCoachTeamCount: 1, familyLinkCount: 1 }), 'other_org');
    assert.equal(accountKeptReason({ ...none, basicCoachTeamCount: 1, familyLinkCount: 3 }), 'basic_coach_portal');
  });
  it('a pending invitation to an account its owner already had: kept (trust close-out 13)', () =>
    assert.equal(accountKeptReason({ ...none, invitedOwnAccount: true }), 'invited_own_account'));
});

describe('is a pending row an invitation to the person\'s OWN account? (trust close-out 13)', () => {
  const at = '2026-11-18T12:00:00Z';
  it('the invite route\'s existing-account row (no invited_email): yes', () =>
    assert.equal(isInvitationToOwnAccount({ status: 'invited', invited_email: null }, at), true));
  it('a self-made account (no auth invited_at), whatever the row says: yes', () =>
    assert.equal(isInvitationToOwnAccount({ status: 'invited', invited_email: 'a@b.ca' }, null), true));
  it('an account this invitation created for a new person: no — it goes with its invitation', () =>
    assert.equal(isInvitationToOwnAccount({ status: 'invited', invited_email: 'a@b.ca' }, at), false));
  it('a joined member is not an invitation at all', () =>
    assert.equal(isInvitationToOwnAccount({ status: 'active', invited_email: null }, null), false));
});
