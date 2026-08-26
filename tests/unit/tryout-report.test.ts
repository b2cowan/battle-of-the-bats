import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildTryoutReport, fairnessReceiptLines, decisionLabel,
  buildTryoutMemoryPair, canShowTryoutMemory, returningImprovementAggregate,
  inPlayTryoutCandidates, MIN_MEMORY_AGGREGATE_PAIRS, wasBlindThroughout,
  type TryoutMemorySnapshot, type TryoutMemoryPair,
} from '../../lib/tryout-report.ts';
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
    firstOfferedAt: null,
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
  tryout: { isAnonymous: false, namesShownAt: '2027-08-12T16:00:00Z', scoresLockedAt: null },
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
  it('counts the stages, names the drop-offs, and counts "offered" as offers EVER extended', () => {
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
    // 3 currently offered + 1 accepted, none with a sticky stamp — the union's legacy half.
    assert.equal(r.funnel.offered, 4);
    assert.equal(r.funnel.accepted, 1);
    assert.equal(r.funnel.familyDeclined, 1);
    // 'c' expired against the injected clock; 'b' still open
    assert.equal(r.funnel.offerExpired, 1);
    assert.equal(r.funnel.awaitingReply, 1);
  });

  // The whole point of the sticky stamp (mig 223): a coach who offers a player and then changes
  // their mind used to erase the offer from the record entirely, because clearTryoutOffer wipes
  // every live offer column. "Offers extended" must survive that.
  it('counts a RESCINDED offer — the sticky stamp is what makes "ever offered" provable', () => {
    const regs = [
      // Offered, then re-decided to 'declined': every live offer column was cleared, only the
      // sticky stamp remains.
      mkReg({ id: 'a', status: 'declined', isCheckedIn: true, firstOfferedAt: '2027-08-10T00:00:00Z' }),
      mkReg({ id: 'b', status: 'waitlisted', isCheckedIn: true }),
    ];
    const r = buildTryoutReport({ ...BASE, registrations: regs });
    assert.equal(r.funnel.offered, 1);
    assert.equal(r.funnel.accepted, 0);
    // ⚠ And it must not leak into the CURRENT-standing tallies the decision board shows.
    assert.equal(r.decisions.offered, 0);
    assert.equal(r.decisions.declined, 1);
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

    const blind = buildTryoutReport({ ...BASE, tryout: { isAnonymous: true, namesShownAt: null, scoresLockedAt: null }, registrations: regs, scores });
    let lines = fairnessReceiptLines(blind.fairness!);
    assert.equal(lines.length, 2);
    assert.match(lines[0], /1 player evaluated by 1 evaluator on one shared scorecard/);
    assert.match(lines[1], /bib numbers only, start to finish/);

    const revealedLocked = buildTryoutReport({ ...BASE, tryout: { isAnonymous: false, namesShownAt: '2027-08-12T16:00:00Z', scoresLockedAt: '2027-08-13T00:00:00Z' }, registrations: regs, scores });
    lines = fairnessReceiptLines(revealedLocked.fairness!);
    assert.equal(lines.length, 3);
    assert.match(lines[1], /until names were shown on Aug 12, 2027/);
    assert.match(lines[2], /Scoring was locked/);
  });

  /**
   * ⚠ THE TEST THE WHOLE `namesShownAt` COLUMN EXISTS FOR (owner ruling 2026-08-25).
   *
   * Showing names became a two-way switch, which quietly demoted `isAnonymous` from evidence to
   * view state. A coach could show every name, score the tryout with them on screen, flip back to
   * bib-only and export a report claiming the scoring was blind. The receipt reads the write-once
   * stamp instead — so the ONLY input that differs between these two cases is the stamp, and the
   * live flag is identical (blind) in both.
   */
  it('cannot claim blind-throughout once names have EVER been shown, even if switched back', () => {
    const regs = [mkReg({ id: 'a' })];
    const scores = [{ registrationId: 'a', categoryKey: 'hit', score: 4, evaluatorSessionId: 'ev1' }];

    const neverShown = buildTryoutReport({
      ...BASE, tryout: { isAnonymous: true, namesShownAt: null, scoresLockedAt: null },
      registrations: regs, scores,
    });
    assert.equal(neverShown.fairness!.blind, 'throughout');
    assert.match(fairnessReceiptLines(neverShown.fairness!)[1], /start to finish/);

    const shownThenHidden = buildTryoutReport({
      ...BASE, tryout: { isAnonymous: true, namesShownAt: '2027-08-12T16:00:00Z', scoresLockedAt: null },
      registrations: regs, scores,
    });
    assert.equal(shownThenHidden.fairness!.blind, 'names_shown');
    assert.match(fairnessReceiptLines(shownThenHidden.fairness!)[1], /until names were shown on Aug 12, 2027/);
    assert.doesNotMatch(fairnessReceiptLines(shownThenHidden.fairness!)[1], /start to finish/);
  });

  /**
   * ⚠ ONE definition of "was this blind?", because two features answered it separately and
   * disagreed (/review 2026-08-25): the development baseline was still stamping each player's
   * PERMANENT card with the word "blind" off the live switch, so a coach who showed names, scored
   * the tryout, then hid them again froze a claim their own report contradicted. Both now call
   * `wasBlindThroughout`; this pins the truth table so they cannot drift apart again.
   */
  it('wasBlindThroughout is the single rule the report and the development baseline share', () => {
    // hidden + never shown = the only true case
    assert.equal(wasBlindThroughout({ isAnonymous: true, namesShownAt: null }), true);
    // hidden NOW, but shown at some point — the case the stamp exists for
    assert.equal(wasBlindThroughout({ isAnonymous: true, namesShownAt: '2027-08-12T16:00:00Z' }), false);
    // currently showing
    assert.equal(wasBlindThroughout({ isAnonymous: false, namesShownAt: '2027-08-12T16:00:00Z' }), false);
    // legacy: revealed before the stamp existed, backfill could not date it
    assert.equal(wasBlindThroughout({ isAnonymous: false, namesShownAt: null }), false);
    // fails closed
    assert.equal(wasBlindThroughout(null), false);
    assert.equal(wasBlindThroughout(undefined), false);
  });

  /** The pre-migration rows: revealed under the old one-way rule, so `is_anonymous` is false but
   *  the stamp the backfill dates from `updated_at` could be absent on a row written between the
   *  two. The claim must still fail closed — state the fact, skip the date. */
  it('treats an un-stamped but visible tryout as names-shown, not blind-throughout', () => {
    const regs = [mkReg({ id: 'a' })];
    const scores = [{ registrationId: 'a', categoryKey: 'hit', score: 4, evaluatorSessionId: 'ev1' }];
    const legacy = buildTryoutReport({
      ...BASE, tryout: { isAnonymous: false, namesShownAt: null, scoresLockedAt: null },
      registrations: regs, scores,
    });
    assert.equal(legacy.fairness!.blind, 'names_shown');
    assert.match(fairnessReceiptLines(legacy.fairness!)[1], /until names were shown$/);
  });
});

describe('candidateRows — R1/R6', () => {
  const regs = [mkReg({ id: 'a', status: 'offered', offerResponse: 'accepted', playerFirstName: 'Maya', playerLastName: 'Torres' })];
  const scores = [{ registrationId: 'a', categoryKey: 'hit', score: 4, evaluatorSessionId: 'ev1' }];

  it('is NULL while blind — the full-detail export must be unbuildable', () => {
    const r = buildTryoutReport({ ...BASE, tryout: { isAnonymous: true, namesShownAt: null, scoresLockedAt: null }, registrations: regs, scores });
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

/* ══════════════════════════════════════════════════════════════════════════════════════════════
 * Candidate memory — Tryout Insights Phase 3 (plan §6; rulings R6/R7/R8).
 *
 * The rules worth a test each are, again, the ones that would fail SILENTLY: a delta quietly
 * appearing across two different scorecards reads as authoritative and is meaningless, and an
 * "improved +X" line built from one lucky pair reads as a finding.
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

function snap(over: Partial<TryoutMemorySnapshot> = {}): TryoutMemorySnapshot {
  return {
    seasonLabel: '2026', scaleMax: 5, composite: 3, evaluatorCount: 4,
    categories: [
      { key: 'hit', label: 'Hitting', avg: 3 },
      { key: 'throw', label: 'Throwing', avg: 2 },
    ],
    decision: 'Waitlisted',
    ...over,
  };
}

describe('one definition of "in play"', () => {
  /**
   * The report derives its own candidate set; the two routes hand the SAME set to the memory
   * resolver. Before /simplify those were two independently-written filters, so a future change
   * to "in play" could have made the memory strip's current-season composite disagree with the
   * composite the report shows for the same candidate. This test is the tie.
   */
  it('drops withdrawn candidates, and is the function the report itself uses', () => {
    const regs = [mkReg({ id: 'a' }), mkReg({ id: 'w', status: 'withdrawn' }), mkReg({ id: 'b', status: 'accepted' })];
    assert.deepEqual(inPlayTryoutCandidates(regs).map(r => r.id), ['a', 'b']);
    // Same population the report counts — proven against the report's own output, not by reading it.
    assert.equal(buildTryoutReport({ ...BASE, registrations: regs }).funnel.registered, 2);
  });
});

describe('R6 — canShowTryoutMemory fails closed', () => {
  it('refuses while blind, refuses without a tryout at all, allows once revealed', () => {
    assert.equal(canShowTryoutMemory({ isAnonymous: true }), false);
    assert.equal(canShowTryoutMemory(null), false);
    assert.equal(canShowTryoutMemory(undefined), false);
    assert.equal(canShowTryoutMemory({ isAnonymous: false }), true);
  });
});

describe('R7 — present, don’t judge', () => {
  it('computes a delta when the scales match, on the composite and on matched categories', () => {
    const pair = buildTryoutMemoryPair(
      'reg-1', 'prior-1',
      snap({ composite: 2.9 }),
      snap({ seasonLabel: 'This tryout', composite: 3.6, decision: 'Undecided', categories: [
        { key: 'hit', label: 'Hitting', avg: 3.8 },
        { key: 'throw', label: 'Throwing', avg: 3.4 },
      ] }),
    );
    assert.equal(pair.delta, 0.7);
    assert.deepEqual(pair.categories.map(c => [c.key, c.delta]), [['hit', 0.8], ['throw', 1.4]]);
  });

  it('refuses ALL arithmetic across different scales — the whole ruling in one assertion', () => {
    const pair = buildTryoutMemoryPair(
      'reg-1', 'prior-1',
      snap({ scaleMax: 10, composite: 7.1, categories: [{ key: 'hit', label: 'Hitting', avg: 7 }] }),
      snap({ seasonLabel: 'This tryout', scaleMax: 5, composite: 4 }),
    );
    // The ABSENCE of the number is the ruling — there is no separate `comparable` flag that could
    // one day say "yes" while the delta says nothing.
    assert.equal(pair.delta, null);
    // ⚠ Not "no composite delta" — no category deltas either. Normalizing to a percentage would
    // look like a comparison and would smuggle in a claim the club never made.
    assert.deepEqual(pair.categories, []);
    // Both cards still travel: side by side always.
    assert.equal(pair.prior.composite, 7.1);
    assert.equal(pair.current.composite, 4);
  });

  it('refuses a delta when either season has no composite — an unscored tryout is not a zero', () => {
    const noPrior = buildTryoutMemoryPair('reg-1', 'prior-1', snap({ composite: null }), snap({ composite: 4 }));
    assert.equal(noPrior.delta, null);
    const noCurrent = buildTryoutMemoryPair('reg-1', 'prior-1', snap({ composite: 3 }), snap({ composite: null }));
    assert.equal(noCurrent.delta, null);
  });

  it('compares categories by KEY only, and drops keys either season left unscored', () => {
    const pair = buildTryoutMemoryPair(
      'reg-1', 'prior-1',
      snap({ categories: [
        { key: 'hit', label: 'Hitting', avg: 3 },
        { key: 'field', label: 'Fielding', avg: 4 },   // absent from this year's scorecard
        { key: 'throw', label: 'Throwing', avg: null }, // matched key, nobody scored it then
      ] }),
      snap({ categories: [
        { key: 'hit', label: 'Hitting', avg: 4 },
        { key: 'throw', label: 'Throwing', avg: 3 },
        { key: 'speed', label: 'Speed', avg: 5 },       // new category this year
      ] }),
    );
    assert.deepEqual(pair.categories.map(c => c.key), ['hit']);
  });

  it('rounds deltas — a strip must never print a full-precision float', () => {
    const pair = buildTryoutMemoryPair('reg-1', 'prior-1', snap({ composite: 2.9 }), snap({ composite: 3.2 }));
    assert.equal(pair.delta, 0.3);
  });
});

describe('C4 — the returning-improvement aggregate', () => {
  let priorSeq = 0;
  /** A comparable pair against a DISTINCT prior person unless one is named explicitly. */
  const pairAt = (delta: number, priorKey = `prior-${++priorSeq}`): TryoutMemoryPair =>
    buildTryoutMemoryPair('r', priorKey, snap({ composite: 3 }), snap({ composite: 3 + delta }));

  it('does not exist below three comparable pairs — silence beats a confident lie', () => {
    assert.equal(MIN_MEMORY_AGGREGATE_PAIRS, 3);
    assert.equal(returningImprovementAggregate([]), null);
    assert.equal(returningImprovementAggregate([pairAt(0.5), pairAt(0.7)]), null);
  });

  it('counts only COMPARABLE pairs toward the threshold', () => {
    const incomparable = buildTryoutMemoryPair(
      'r', 'prior-x', snap({ scaleMax: 10, composite: 8 }), snap({ scaleMax: 5, composite: 4 }),
    );
    // Three pairs on the table, but only two of them can be subtracted.
    assert.equal(returningImprovementAggregate([pairAt(0.5), pairAt(0.7), incomparable]), null);
  });

  it('averages the deltas and names the pair count, not the candidate count', () => {
    const agg = returningImprovementAggregate([pairAt(0.4), pairAt(0.6), pairAt(0.8)])!;
    assert.equal(agg.pairs, 3);
    assert.equal(agg.avg, 0.6);
    assert.equal(agg.line, '3 returning candidates improved +0.6 on average since their last tryout.');
  });

  it('never says "improved" over a flat or falling average', () => {
    const down = returningImprovementAggregate([pairAt(-0.2), pairAt(-0.4), pairAt(-0.6)])!;
    assert.equal(down.avg, -0.4);
    assert.match(down.line, /scored 0\.4 lower on average/);
    assert.doesNotMatch(down.line, /improved/);

    const flat = returningImprovementAggregate([pairAt(0), pairAt(0), pairAt(0)])!;
    assert.match(flat.line, /scored the same on average/);
  });

  /**
   * The database allows at most one confirmed link per CURRENT candidate — but nothing stops two
   * different current candidates being confirmed against the SAME historical player (siblings on
   * one guardian email, or a duplicated old record). Counting links instead of people would let a
   * single person's improvement carry the line over its own three-pair floor (/review 2026-08-03).
   */
  it('counts one returning PERSON once, however many candidates claim them', () => {
    const twice = [pairAt(0.4, 'prior-same'), pairAt(0.6, 'prior-same'), pairAt(0.8)];
    assert.equal(returningImprovementAggregate(twice), null);

    const three = [pairAt(0.4, 'prior-same'), pairAt(0.6, 'prior-same'), pairAt(0.8), pairAt(0.6)];
    const agg = returningImprovementAggregate(three)!;
    assert.equal(agg.pairs, 3);          // not 4
    assert.equal(agg.avg, 0.6);          // mean(0.4, 0.8, 0.6) — the duplicate's 0.6 is dropped
    assert.match(agg.line, /^3 returning candidates/);
  });

  it('rides into the report, and is absent when the route resolved no pairs', () => {
    const withPairs = buildTryoutReport({
      ...BASE, registrations: [mkReg({ status: 'accepted' })],
      memoryPairs: [pairAt(0.4), pairAt(0.6), pairAt(0.8)],
    });
    assert.equal(withPairs.returningImprovement!.avg, 0.6);
    assert.equal(buildTryoutReport({ ...BASE, registrations: [mkReg()] }).returningImprovement, null);
  });
});

/**
 * ── C5: R6 as a build-time contract ───────────────────────────────────────────────────────────
 *
 * "Memory never breaks the blindfold." The failure mode is not malice — it is a future session
 * adding the strip to the live scoreboard because the data was already in hand, and nothing
 * looking wrong. So the rule is stated over the SOURCE of every surface that runs while
 * evaluation is blind, in the same spirit as the B5 family-payload guard and the coach-season
 * write guard.
 *
 * ⚠ Check-in is on this list even though it shows an identity-only "tried out in {season}"
 * marker. Identity is not a score, and that marker is UNCHANGED — what must never appear there
 * is a number.
 */
describe('C5 — no blind surface can reach candidate memory (R6)', () => {
  const ROOT = process.cwd();

  /** Every surface an evaluator (or the coach) uses while names are still hidden. */
  const BLIND_SURFACES = [
    'components/rep-teams/TryoutScorerSurface.tsx',
    'components/rep-teams/TryoutScoreboardCard.tsx',
    'components/rep-teams/TryoutCheckIn.tsx',
    'app/api/coaches/[orgSlug]/teams/[teamId]/tryout-scoreboard/route.ts',
    'app/api/coaches/[orgSlug]/teams/[teamId]/tryout-self-score/route.ts',
    'app/api/coaches/[orgSlug]/teams/[teamId]/tryout-candidates/route.ts',
    'app/api/coaches/[orgSlug]/teams/[teamId]/tryout-evaluators/route.ts',
  ];

  /** Anything that would carry a PRIOR season's evaluation onto one of those screens. */
  const FORBIDDEN = [
    'TryoutMemoryStrip',
    'tryout-memory',
    'tryout-report',
    'resolveTryoutMemoryPairs',
    'buildTryoutMemoryPair',
    'TryoutMemoryPair',
    'resolveCoachTeamCapabilities',
    'getRepTeamContinuityLinks',
  ];

  for (const file of BLIND_SURFACES) {
    it(`${file} names nothing that carries a prior season's evaluation`, () => {
      const full = join(ROOT, file);
      assert.ok(existsSync(full), `${file} has moved — update this guard rather than deleting it`);
      const src = readFileSync(full, 'utf8');
      for (const needle of FORBIDDEN) {
        assert.equal(
          src.includes(needle), false,
          `${file} references "${needle}". Prior-year evaluation data appears ONLY at Decide, ` +
          'post-reveal, and on the report (R6). A bib number is just a bib number.',
        );
      }
    });
  }

  it('the memory route gates on canShowTryoutMemory BEFORE it reads anything', () => {
    const src = readFileSync(join(ROOT,
      'app/api/coaches/[orgSlug]/teams/[teamId]/tryout-memory/route.ts'), 'utf8');
    assert.ok(src.includes('canShowTryoutMemory'),
      'The memory route must apply the R6 gate itself. A client-side render gate does not ' +
      'survive the network tab.');
    // The gate has to precede the continuity read — pairing prior named records to bibs is the
    // de-anonymization, and it happens at fetch time, not at render time. (Call sites, not the
    // import block, or the assertion would pass on import order alone.)
    const gate = src.indexOf('if (!canShowTryoutMemory(tryout))');
    const read = src.indexOf('getRepTeamContinuityLinks(teamId)');
    assert.ok(gate > 0 && read > 0 && gate < read,
      'The blind check must come BEFORE the continuity links are fetched.');
  });

  it('the resolver refuses to build pairs while blind, whatever it was handed', () => {
    // Belt and braces: even a caller that forgot the route-level gate gets nothing back.
    // (The async resolver is exercised here only for its synchronous fail-closed branch.)
    const src = readFileSync(join(ROOT, 'lib/tryout-memory.ts'), 'utf8');
    assert.ok(src.includes('if (!canShowTryoutMemory(input.tryout)) return [];'),
      'lib/tryout-memory.ts must fail closed on the blind gate before any DB read.');
  });
});
