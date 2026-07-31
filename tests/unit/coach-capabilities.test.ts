import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ASSISTANT_DEFAULTS,
  resolveCoachCapabilities,
  canViewDocuments,
  canManageDocuments,
  canViewPlayerDocuments,
  canManagePlayerDocuments,
  redactRosterPlayer,
  type CoachCapabilities,
  type AssistantCapabilityGrants,
} from '../../lib/coach-capabilities.ts';

/** Resolve an assistant with the given grants over the least-privilege defaults. */
const assistant = (grants?: AssistantCapabilityGrants): CoachCapabilities =>
  resolveCoachCapabilities('assistant_coach', grants);

const head = (): CoachCapabilities => resolveCoachCapabilities('head_coach');

describe('player documents require BOTH documents and rosterPii', () => {
  it('denies the default assistant, who has documents:view but no guardian PII', () => {
    const caps = assistant();
    // The exact shape that caused the defect: the coach CAN see team templates...
    assert.equal(caps.documents, 'view');
    assert.equal(caps.rosterPii, false);
    assert.equal(canViewDocuments(caps), true);
    // ...but must NOT reach a player's signed waiver / medical consent.
    assert.equal(canViewPlayerDocuments(caps), false);
    assert.equal(canManagePlayerDocuments(caps), false);
  });

  it('denies documents access alone, at every level', () => {
    for (const documents of ['view', 'manage'] as const) {
      const caps = assistant({ documents });
      assert.equal(canViewPlayerDocuments(caps), false, `documents:${documents} without rosterPii must not view`);
      assert.equal(canManagePlayerDocuments(caps), false, `documents:${documents} without rosterPii must not manage`);
    }
  });

  it('denies guardian-PII access alone — PII does not imply documents', () => {
    const caps = assistant({ rosterPii: true, documents: 'off' });
    assert.equal(caps.rosterPii, true);
    assert.equal(canViewPlayerDocuments(caps), false);
    assert.equal(canManagePlayerDocuments(caps), false);
  });

  it('allows viewing only when both are granted', () => {
    const caps = assistant({ documents: 'view', rosterPii: true });
    assert.equal(canViewPlayerDocuments(caps), true);
    // 'view' is not 'manage' — no upload/delete.
    assert.equal(canManagePlayerDocuments(caps), false);
  });

  it('allows managing only at documents:manage plus rosterPii', () => {
    const caps = assistant({ documents: 'manage', rosterPii: true });
    assert.equal(canViewPlayerDocuments(caps), true);
    assert.equal(canManagePlayerDocuments(caps), true);
  });

  it('is a strict no-op for head coaches', () => {
    const caps = head();
    assert.equal(caps.rosterPii, true);
    assert.equal(canViewPlayerDocuments(caps), canViewDocuments(caps));
    assert.equal(canManagePlayerDocuments(caps), canManageDocuments(caps));
    assert.equal(canViewPlayerDocuments(caps), true);
    assert.equal(canManagePlayerDocuments(caps), true);
  });

  it('never grants player documents to a coach whose PII is redacted', () => {
    // The invariant the defect broke: if redaction strips this player's guardian and medical
    // fields, the same coach must not be able to open the file those fields came from.
    const cases: AssistantCapabilityGrants[] = [
      {}, { documents: 'view' }, { documents: 'manage' }, { documents: 'manage', notes: true },
    ];
    for (const grants of cases) {
      const caps = assistant(grants);
      const redacted = redactRosterPlayer(
        { guardianEmail: 'parent@example.com', medicalNotes: 'allergy', playerDateOfBirth: '2012-04-01' },
        caps,
      );
      const wasRedacted = redacted.guardianEmail === null;
      assert.equal(wasRedacted, true, 'precondition: these grants redact PII');
      assert.equal(canViewPlayerDocuments(caps), false, `redacted PII but could open documents: ${JSON.stringify(grants)}`);
    }
  });
});

describe('team-level document templates keep gating on `documents` alone', () => {
  it('lets the default assistant see blank team forms', () => {
    // The locked 2026-06-25 decision ("documents view-only by default") stays true: an assistant
    // who needs a blank waiver to hand a parent still gets one.
    assert.equal(ASSISTANT_DEFAULTS.documents, 'view');
    assert.equal(canViewDocuments(assistant()), true);
  });

  it('is unaffected by rosterPii in either direction', () => {
    assert.equal(canViewDocuments(assistant({ documents: 'view', rosterPii: false })), true);
    assert.equal(canViewDocuments(assistant({ documents: 'view', rosterPii: true })), true);
    assert.equal(canViewDocuments(assistant({ documents: 'off', rosterPii: true })), false);
  });
});
