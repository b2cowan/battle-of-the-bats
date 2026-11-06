import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { accountKeptReason } from '../../lib/member-account-keep.ts';

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
});
