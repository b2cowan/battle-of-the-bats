/**
 * THE SPONSOR EDIT ASKS THE PAYOUT FLOOR BEFORE IT WRITES — pinned as arithmetic (SP-1,
 * sponsorship lifecycle plan Phase A, owner-ruled 2026-08-28).
 *
 * The hazard: a sponsor's family credit can be shrunk four ways — amount lowered, family
 * changed, family removed, status flipped back to a pledge — and until this guard existed every
 * one of them silently proceeded after cash had already been handed back against that credit,
 * leaving the family holding money the books no longer said they were owed. The general
 * per-credit route refuses sponsor credits with "edit it there" specifically so the sponsor door
 * can be the one safe editor; these tests are what make that claim true rather than polite.
 *
 * Pinned here: the projection (which credit set survives the edit, seen from the family that
 * holds the credit today), the action words the refusal names, the floor arithmetic itself with
 * forgiveness excluded, and the exposure figure the Settings sheet warns with.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  projectSponsorCreditChange,
  payoutFloorViolation,
  payoutFloorMessage,
  creditExposure,
} from '../../lib/dues-credit-guards.ts';

const CREDIT = { id: 'c1', playerId: 'riley', amount: 75 };
const FAMILY = [
  { id: 'c1', amount: 75, creditType: 'fundraiser' },
  { id: 'c2', amount: 20, creditType: 'contribution' },
];

describe('projectSponsorCreditChange — what the edit would make true', () => {
  it('keeping or growing the credit on the same family asks no floor question', () => {
    assert.equal(projectSponsorCreditChange({
      existing: CREDIT, familyCredits: FAMILY,
      next: { received: true, playerId: 'riley', credit: 75 }, wasReceived: true,
    }), null);
    assert.equal(projectSponsorCreditChange({
      existing: CREDIT, familyCredits: FAMILY,
      next: { received: true, playerId: 'riley', credit: 90 }, wasReceived: true,
    }), null);
  });

  it('lowering the credit substitutes the new amount in the family set', () => {
    const change = projectSponsorCreditChange({
      existing: CREDIT, familyCredits: FAMILY,
      next: { received: true, playerId: 'riley', credit: 60 }, wasReceived: true,
    });
    assert.ok(change);
    assert.equal(change.action, 'lowering this credit');
    assert.deepEqual(change.projected.map(c => c.amount), [60, 20]);
  });

  it('moving the credit to another family removes it from the losing family’s set', () => {
    const change = projectSponsorCreditChange({
      existing: CREDIT, familyCredits: FAMILY,
      next: { received: true, playerId: 'avery', credit: 75 }, wasReceived: true,
    });
    assert.ok(change);
    assert.equal(change.action, 'moving this credit to another family');
    assert.deepEqual(change.projected.map(c => c.id), ['c2']);
  });

  it('removing the family removes the credit', () => {
    const change = projectSponsorCreditChange({
      existing: CREDIT, familyCredits: FAMILY,
      next: { received: true, playerId: null, credit: 0 }, wasReceived: true,
    });
    assert.ok(change);
    assert.equal(change.action, 'removing this credit');
  });

  it('flipping back to a pledge is named as exactly that', () => {
    const change = projectSponsorCreditChange({
      existing: CREDIT, familyCredits: FAMILY,
      next: { received: false, playerId: 'riley', credit: 75 }, wasReceived: true,
    });
    assert.ok(change);
    assert.equal(change.action, 'moving this sponsorship back to a pledge');
    assert.deepEqual(change.projected.map(c => c.id), ['c2']);
  });
});

describe('payoutFloorViolation — the floor arithmetic', () => {
  it('refuses when the projected credits no longer cover what went out', () => {
    // $75 credit deleted; $20 remains; $40 already handed back → $20 cannot cover $40.
    const v = payoutFloorViolation([{ amount: 20, creditType: 'contribution' }], [{ amount: 40 }]);
    assert.ok(v);
    assert.equal(v.paidOut, 40);
  });

  it('allows when the remaining credits still cover the payouts', () => {
    assert.equal(
      payoutFloorViolation(
        [{ amount: 60, creditType: 'fundraiser' }, { amount: 20, creditType: 'contribution' }],
        [{ amount: 40 }],
      ),
      null,
    );
  });

  it('a forgiven balance never counts toward the ceiling', () => {
    // $50 of forgiveness is debt relief, not the family’s money — it cannot cover a $40 payout.
    const v = payoutFloorViolation([{ amount: 50, creditType: 'forgiven' }], [{ amount: 40 }]);
    assert.ok(v);
  });

  it('the sentence names the dollars and the act', () => {
    assert.equal(
      payoutFloorMessage(40, 'lowering this credit'),
      '$40.00 has already been paid out to this family — lowering this credit would leave the books owing them less than they have received. Remove the payout first.',
    );
  });
});

describe('creditExposure — the figure the Settings sheet warns with', () => {
  it('is zero while the family’s other credits cover everything paid out', () => {
    assert.equal(creditExposure({ id: 'c1', amount: 75 }, FAMILY, [{ amount: 20 }]), 0);
  });

  it('names the dollars of THIS credit that payouts depend on', () => {
    // $40 out; the other credit covers $20; this credit is on the hook for the remaining $20.
    assert.equal(creditExposure({ id: 'c1', amount: 75 }, FAMILY, [{ amount: 40 }]), 20);
  });

  it('never exceeds the credit’s own amount', () => {
    assert.equal(creditExposure({ id: 'c1', amount: 75 }, FAMILY, [{ amount: 500 }]), 75);
  });
});
