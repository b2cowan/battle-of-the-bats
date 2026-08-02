import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildTryoutReport, fairnessReceiptLines, decisionLabel } from '../../lib/tryout-report.ts';
import type { RepTryoutRegistration } from '../../lib/types.ts';

/**
 * Tryout Report aggregation (Tryout Insights Phase 1 — rulings R1–R8, memory/design_decisions.md
 * 2026-08-02).
 *
 * The rules worth a test each are the ones that would fail SILENTLY as data drifts:
 *   · candidateRows must be NULL while blind — the full-detail export must be unbuildable (R1/R6);
 *   · the fairness receipt must not exist without scores, and each line only when provable;
 *   · "finalized" must refuse while any offer is still open — a report that stamps itself final
 *     with offers outstanding is a confident lie;
 *   · withdrawn candidates must vanish from every number (matching tryout-overview).
 */

const NOW = Date.parse('2027-08-14T12:00:00Z');

let seq = 0;
function mkReg(over: Partial<RepTryoutRegistration> = {}): RepTryoutRegistration {
  seq += 1;
  return {
    id: over.id ?? `reg-${seq}`,
    programYearId: 'py-1', teamId: 'team-1', orgId: 'org-1',
    playerFirstName: 'Player', playerLastName: `#${seq}`,
    playerDateOfBirth: null, playerNotes: null,
    guardianFirstName: 'G', guardianLastName: 'Uardian',
    guardianEmail: 'g@example.com', guardianPhone: null,
    status: 'pending_review', adminNotes: null,
    consentDataCollection: true, consentEmailComms: null, consentEligibility: true,
    consentAt: null, consentIp: null,
    bibNumber: null, isCheckedIn: false, checkedInAt: null,
    offerSentAt: null, offerExpiresAt: null, offerResponse: null, offerRespondedAt: null,
    submittedAt: '2027-08-01T00:00:00Z', updatedAt: '2027-08-01T00:00:00Z',
    ...over,
  };
}

const RUBRIC = {
  scaleMax: 5,
  categories: [
    { key: 'hit', label: 'Hitting', weight: 1 },
    { key: 'throw', label: 'Throwing', weight: 1 },
  ],
};

const BASE = {
  tryout: { isAnonymous: false, scoresLockedAt: null },
  rubric: RUBRIC,
  registrations: [] as RepTryoutRegistration[],
  scores: [] as { registrationId: string; categoryKey: string; score: number; evaluatorSessionId: string }[],
  roster: [] as { id: string; source: 'tryout' | 'admin_manual'; tryoutRegistrationId: string | null }[],
  continuityLinks: [] as { status: 'suggested' | 'confirmed' | 'rejected'; currentRosterId: string | null; currentRegistrationId: string | null }[],
  priorRegistrationCount: null as number | null,
  priorSeasonName: null as string | null,
  now: NOW,
};

describe('buildTryoutReport — funnel', () => {
  it('counts the stages, names the drop-offs, and counts "offered" as current standing (offered + accepted)', () => {
    const regs = [
      mkReg({ id: 'a', status: 'accepted', isCheckedIn: true }),
      mkReg({ id: 'b', status: 'offered', isCheckedIn: true, offerSentAt: '2027-08-10T00:00:00Z', offerExpiresAt: '2027-08-20T00:00:00Z' }),
      mkReg({ id: 'c', status: 'offered', isCheckedIn: true, offerSentAt: '2027-08-01T00:00:00Z', offerExpiresAt: '2027-08-08T00:00:00Z' }),
      mkReg({ id: 'd', status: 'offered', isCheckedIn: true, offerSentAt: '2027-08-10T00:00:00Z', offerResponse: 'declined', offerRespondedAt: '2027-08-11T00:00:00Z' }),
      mkReg({ id: 'e', status: 'declined', isCheckedIn: true }),
      mkReg({ id: 'f', status: 'pending_review' }),
    ];
    const r = buildTryoutReport({ ...BASE, registrations: regs, scores: [
      { registrationId: 'a', categoryKey: 'hit', score: 4, evaluatorSessionId: 'ev1' },
      { registrationId: 'b', categoryKey: 'hit', score: 3, evaluatorSessionId: 'ev1' },
    ] });
    assert.equal(r.funnel.registered, 6);
    assert.equal(r.funnel.attended, 5);
    assert.equal(r.funnel.neverCheckedIn, 1);
    assert.equal(r.funnel.evaluated, 2);
    // Current standing: 3 currently offered + 1 accepted. NOT "ever offered" — a rescinded offer
    // leaves no durable trace until Phase 2's first_offered_at (see TryoutReportFunnel.offered doc).
    assert.equal(r.funnel.offered, 4);
    assert.equal(r.funnel.accepted, 1);
    assert.equal(r.funnel.familyDeclined, 1);
    // 'c' expired against the injected clock; 'b' still open
    assert.equal(r.funnel.offerExpired, 1);
    assert.equal(r.funnel.awaitingReply, 1);
  });

  it('drops withdrawn candidates from every number', () => {
    const regs = [
      mkReg({ id: 'a', status: 'accepted', isCheckedIn: true }),
      mkReg({ id: 'w', status: 'withdrawn', isCheckedIn: true }),
    ];
    const r = buildTryoutReport({ ...BASE, registrations: regs, scores: [
      { registrationId: 'w', categoryKey: 'hit', score: 5, evaluatorSessionId: 'ev1' },
    ] });
    assert.equal(r.funnel.registered, 1);
    assert.equal(r.funnel.attended, 1);
    assert.equal(r.funnel.evaluated, 0); // the only scores belonged to the withdrawn candidate
    assert.equal(r.turnout.count, 1);
  });
});

describe('buildTryoutReport — finalized', () => {
  it('refuses to finalize while any offer is open, finalizes when all are settled', () => {
    const open = buildTryoutReport({ ...BASE, registrations: [
      mkReg({ status: 'accepted' }), mkReg({ status: 'offered' }),
    ] });
    assert.equal(open.finalized, false);

    const settled = buildTryoutReport({ ...BASE, registrations: [
      mkReg({ status: 'accepted' }), mkReg({ status: 'declined' }), mkReg({ status: 'waitlisted' }),
    ] });
    assert.equal(settled.finalized, true);
  });

  it('never finalizes an empty tryout', () => {
    assert.equal(buildTryoutReport({ ...BASE }).finalized, false);
  });
});

describe('buildTryoutReport — class profile', () => {
  it('averages per candidate (equal weight), not per score row', () => {
    const regs = [mkReg({ id: 'a' }), mkReg({ id: 'b' })];
    // Candidate a: hit avg = (4+2)/2 = 3 across two evaluators. Candidate b: hit = 5.
    // Class hit avg = mean(3, 5) = 4 — NOT mean(4,2,5) = 3.67.
    const r = buildTryoutReport({ ...BASE, registrations: regs, scores: [
      { registrationId: 'a', categoryKey: 'hit', score: 4, evaluatorSessionId: 'ev1' },
      { registrationId: 'a', categoryKey: 'hit', score: 2, evaluatorSessionId: 'ev2' },
      { registrationId: 'b', categoryKey: 'hit', score: 5, evaluatorSessionId: 'ev1' },
    ] });
    assert.ok(r.profile);
    const hit = r.profile!.categories.find(c => c.key === 'hit')!;
    assert.equal(hit.avg, 4);
    // Nobody scored throwing — the category reports null, never zero.
    const thr = r.profile!.categories.find(c => c.key === 'throw')!;
    assert.equal(thr.avg, null);
    assert.equal(r.profile!.evaluatedCount, 2);
  });

  it('is absent entirely without a scorecard or without scores', () => {
    const noScores = buildTryoutReport({ ...BASE, registrations: [mkReg({ status: 'accepted' })] });
    assert.equal(noScores.profile, null);
    const noRubric = buildTryoutReport({
      ...BASE, rubric: null, registrations: [mkReg({ id: 'a' })],
      scores: [{ registrationId: 'a', categoryKey: 'hit', score: 4, evaluatorSessionId: 'ev1' }],
    });
    assert.equal(noRubric.profile, null);
  });
});

describe('fairness receipt', () => {
  it('does not exist without scores', () => {
    const r = buildTryoutReport({ ...BASE, registrations: [mkReg({ status: 'accepted' })] });
    assert.equal(r.fairness, null);
  });

  it('scopes the evaluator count to in-play candidates — a helper who only scored a withdrawn kid does not inflate the receipt', () => {
    const regs = [mkReg({ id: 'a' }), mkReg({ id: 'w', status: 'withdrawn' })];
    const r = buildTryoutReport({ ...BASE, registrations: regs, scores: [
      { registrationId: 'a', categoryKey: 'hit', score: 4, evaluatorSessionId: 'ev1' },
      { registrationId: 'w', categoryKey: 'hit', score: 5, evaluatorSessionId: 'ev1' },
      { registrationId: 'w', categoryKey: 'hit', score: 2, evaluatorSessionId: 'ev2' },
    ] });
    assert.ok(r.fairness);
    assert.equal(r.fairness!.evaluatorsWhoScored, 1);
    assert.equal(r.fairness!.evaluatedCount, 1);
  });

  it('states only what the data proves — blind state, lock line only when locked', () => {
    const regs = [mkReg({ id: 'a' })];
    const scores = [{ registrationId: 'a', categoryKey: 'hit', score: 4, evaluatorSessionId: 'ev1' }];

    const blind = buildTryoutReport({ ...BASE, tryout: { isAnonymous: true, scoresLockedAt: null }, registrations: regs, scores });
    let lines = fairnessReceiptLines(blind.fairness!);
    assert.equal(lines.length, 2);
    assert.match(lines[0], /1 player evaluated by 1 evaluator on one shared scorecard/);
    assert.match(lines[1], /Blind evaluation is on/);

    const revealedLocked = buildTryoutReport({ ...BASE, tryout: { isAnonymous: false, scoresLockedAt: '2027-08-13T00:00:00Z' }, registrations: regs, scores });
    lines = fairnessReceiptLines(revealedLocked.fairness!);
    assert.equal(lines.length, 3);
    assert.match(lines[1], /until names were revealed/);
    assert.match(lines[2], /Scoring was locked/);
  });
});

describe('candidateRows — R1/R6', () => {
  const regs = [mkReg({ id: 'a', status: 'offered', offerResponse: 'accepted', playerFirstName: 'Maya', playerLastName: 'Torres' })];
  const scores = [{ registrationId: 'a', categoryKey: 'hit', score: 4, evaluatorSessionId: 'ev1' }];

  it('is NULL while blind — the full-detail export must be unbuildable', () => {
    const r = buildTryoutReport({ ...BASE, tryout: { isAnonymous: true, scoresLockedAt: null }, registrations: regs, scores });
    assert.equal(r.candidateRows, null);
  });

  it('carries names, composites, and decision labels once revealed', () => {
    const r = buildTryoutReport({ ...BASE, registrations: regs, scores });
    assert.ok(r.candidateRows);
    assert.equal(r.candidateRows!.length, 1);
    assert.equal(r.candidateRows![0].name, 'Maya Torres');
    assert.equal(r.candidateRows![0].composite, 4);
    assert.equal(r.candidateRows![0].decision, 'Offered — family accepted');
  });

  it('maps every status to a decision label — an unmapped status must not read as silence', () => {
    assert.equal(decisionLabel({ status: 'declined', offerResponse: null }), 'Not offered');
    assert.equal(decisionLabel({ status: 'withdrawn', offerResponse: null }), 'Withdrew');
    assert.equal(decisionLabel({ status: 'pending_review', offerResponse: null }), 'No decision');
    assert.equal(decisionLabel({ status: 'offered', offerResponse: 'declined' }), 'Offered — family declined');
    assert.equal(decisionLabel({ status: 'offered', offerResponse: null }), 'Offered');
    assert.equal(decisionLabel({ status: 'offered', offerResponse: 'accepted' }), 'Offered — family accepted');
    assert.equal(decisionLabel({ status: 'waitlisted', offerResponse: null }), 'Waitlisted');
    assert.equal(decisionLabel({ status: 'accepted', offerResponse: null }), 'Accepted');
  });

  it('rounds category averages at the assembly point — exports must never print full-precision floats', () => {
    const r = buildTryoutReport({ ...BASE, registrations: [mkReg({ id: 'a' })], scores: [
      { registrationId: 'a', categoryKey: 'hit', score: 4, evaluatorSessionId: 'ev1' },
      { registrationId: 'a', categoryKey: 'hit', score: 3, evaluatorSessionId: 'ev2' },
      { registrationId: 'a', categoryKey: 'hit', score: 3, evaluatorSessionId: 'ev3' },
    ] });
    assert.equal(r.candidateRows![0].categoryAverages.hit, 3.33);
  });
});

describe('roster composition', () => {
  it('counts returning from CONFIRMED links only, via either identity side', () => {
    const roster = [
      { id: 'rp1', source: 'tryout' as const, tryoutRegistrationId: 'reg-x' },
      { id: 'rp2', source: 'tryout' as const, tryoutRegistrationId: null },
      { id: 'rp3', source: 'admin_manual' as const, tryoutRegistrationId: null },
    ];
    const r = buildTryoutReport({
      ...BASE,
      registrations: [mkReg({ status: 'accepted' })],
      roster,
      continuityLinks: [
        { status: 'confirmed', currentRosterId: null, currentRegistrationId: 'reg-x' }, // rp1 via registration
        { status: 'confirmed', currentRosterId: 'rp3', currentRegistrationId: null },   // rp3 via roster row
        { status: 'suggested', currentRosterId: 'rp2', currentRegistrationId: null },   // suggestion proves nothing
      ],
    });
    assert.ok(r.composition);
    assert.equal(r.composition!.rosterTotal, 3);
    assert.equal(r.composition!.fromTryout, 2);
    assert.equal(r.composition!.returning, 2);
    assert.equal(r.composition!.newcomers, 1);
  });

  it('is absent with an empty roster', () => {
    const r = buildTryoutReport({ ...BASE, registrations: [mkReg({ status: 'accepted' })] });
    assert.equal(r.composition, null);
  });
});

describe('hasAnything', () => {
  it('stays false for a tryout with only registrations — the stage keeps its payoff copy', () => {
    const r = buildTryoutReport({ ...BASE, registrations: [mkReg(), mkReg()] });
    assert.equal(r.hasAnything, false);
  });
});
