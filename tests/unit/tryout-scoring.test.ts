import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  weightedComposite,
  evaluatorCompositesByCandidate,
  rankTryoutCandidates,
} from '../../lib/tryout-scoring';
import type { RepTryoutRegistration } from '../../lib/types';

/* The scorecard used throughout: shares 40/20/15/15/10 on a 1–5 scale, the shape a baseball
   tryout actually runs. Weights are the raw numbers a coach types; the UI shows their SHARE. */
const CATS = [
  { key: 'hit', weight: 40 },
  { key: 'fld', weight: 20 },
  { key: 'thr', weight: 15 },
  { key: 'spd', weight: 15 },
  { key: 'att', weight: 10 },
];

const mkReg = (over: Partial<RepTryoutRegistration> & { id: string }): RepTryoutRegistration => ({
  id: over.id,
  programYearId: 'py1',
  teamId: 't1',
  orgId: 'o1',
  playerFirstName: over.playerFirstName ?? 'Ava',
  playerLastName: over.playerLastName ?? 'Thompson',
  bibNumber: over.bibNumber ?? '14',
  status: over.status ?? 'pending_review',
  isCheckedIn: over.isCheckedIn ?? true,
  submittedAt: '2027-08-01T00:00:00Z',
  updatedAt: '2027-08-01T00:00:00Z',
} as RepTryoutRegistration);

describe('weightedComposite', () => {
  it('weights by share, not by an even mean', () => {
    // Hitting carries 40% and is the strongest, so the composite must sit ABOVE the plain mean.
    const avgs = { hit: 5, fld: 3, thr: 3, spd: 3, att: 3 };
    const plainMean = 3.4;
    const composite = weightedComposite(avgs, CATS)!;
    assert.ok(composite > plainMean, `${composite} should exceed the even mean ${plainMean}`);
    assert.equal(composite, 3.8);   // (5*40 + 3*55) / 100
  });

  it('re-normalizes over the categories that were actually scored', () => {
    // Only Hitting scored: the answer is 4, not 4 × 0.4 — an unscored category is absent from the
    // arithmetic, never a zero. A coach half-way through scoring must not see everyone at 1.6.
    assert.equal(weightedComposite({ hit: 4, fld: null, thr: null, spd: null, att: null }, CATS), 4);
  });

  it('falls back to an even mean when every weight is zero', () => {
    const flat = CATS.map(c => ({ ...c, weight: 0 }));
    assert.equal(weightedComposite({ hit: 5, fld: 3, thr: 3, spd: 3, att: 3 }, flat), 3.4);
  });

  it('returns null — not zero — when nothing was scored', () => {
    assert.equal(weightedComposite({ hit: null, fld: null, thr: null, spd: null, att: null }, CATS), null);
  });
});

describe('evaluatorCompositesByCandidate — the numbers behind the average', () => {
  /**
   * ⚠ The reason the Decide board's breakdown exists: these two candidates have the SAME composite
   * and are not the same player. One is a consensus 4.0; the other is a 5.0 and a 3.0 averaged.
   * The board flags the second, so this test holds the arithmetic that lets it.
   */
  const scores = [
    // agreed: both evaluators say 4 across the board
    ...['ev1', 'ev2'].flatMap(ev => CATS.map(c => ({ registrationId: 'agreed', categoryKey: c.key, score: 4, evaluatorSessionId: ev }))),
    // split: ev1 says 5 everywhere, ev2 says 3 everywhere
    ...CATS.map(c => ({ registrationId: 'split', categoryKey: c.key, score: 5, evaluatorSessionId: 'ev1' })),
    ...CATS.map(c => ({ registrationId: 'split', categoryKey: c.key, score: 3, evaluatorSessionId: 'ev2' })),
  ];

  it('separates two candidates the composite cannot tell apart', () => {
    const ranked = rankTryoutCandidates(
      [mkReg({ id: 'agreed' }), mkReg({ id: 'split' })], CATS, scores, { blind: false },
    );
    // Identical headline number...
    assert.equal(ranked.find(r => r.registrationId === 'agreed')!.composite, 4);
    assert.equal(ranked.find(r => r.registrationId === 'split')!.composite, 4);

    // ...and a spread the headline hides.
    const per = evaluatorCompositesByCandidate(CATS, scores);
    assert.deepEqual(per.get('agreed')!.map(e => e.composite), [4, 4]);
    assert.deepEqual(per.get('split')!.map(e => e.composite), [5, 3]);   // sorted high → low
  });

  it('composites a partial evaluator on what they scored', () => {
    // ev2 filled in Hitting only. Their own number is 4 — not 4 scaled down by the missing 60%.
    const partial = [
      ...CATS.map(c => ({ registrationId: 'a', categoryKey: c.key, score: 2, evaluatorSessionId: 'ev1' })),
      { registrationId: 'a', categoryKey: 'hit', score: 4, evaluatorSessionId: 'ev2' },
    ];
    const per = evaluatorCompositesByCandidate(CATS, partial);
    assert.deepEqual(per.get('a')!.map(e => e.composite), [4, 2]);
  });

  it('has no entry for a candidate nobody scored', () => {
    assert.equal(evaluatorCompositesByCandidate(CATS, []).get('a'), undefined);
  });

  it('agrees with the headline composite when one evaluator scored alone', () => {
    // The single-evaluator case is where a second copy of the weighting rule would show up as a
    // contradiction between the row and the panel it opens.
    const solo = CATS.map(c => ({
      registrationId: 'a', categoryKey: c.key,
      score: c.key === 'hit' ? 5 : 3, evaluatorSessionId: 'ev1',
    }));
    const ranked = rankTryoutCandidates([mkReg({ id: 'a' })], CATS, solo, { blind: false });
    const per = evaluatorCompositesByCandidate(CATS, solo);
    assert.equal(per.get('a')![0].composite, ranked[0].composite);
  });
});
