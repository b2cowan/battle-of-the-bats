import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  COVERAGE_MIN_PLANS,
  planCoverageFinding,
  summarizePlanCoverage,
  uncoveredFocusTags,
} from '../../lib/rep-practice-coverage.ts';
import type { PracticePlan } from '../../lib/types.ts';

/**
 * "Is everyone getting attention?" — the coverage answers, Practice Plans Phase 3.
 *
 * ⚠ This is the ONE surface in the feature that names children, so these tests are as much about
 * what the module must NOT produce as what it must. Every case below corresponds to a §4 rule
 * that would otherwise be enforced only by whoever last edited the page.
 */

const plan = (blocks: PracticePlan['blocks']): PracticePlan => ({ version: 1, blocks });

const namingPlan = (playerIds: string[]): PracticePlan =>
  plan([{ id: 'b1', title: 'A', duration: { minutes: 10 }, playerIds }]);

/** Enough plans to clear COVERAGE_MIN_PLANS, all naming the given players. */
const enoughPlans = (playerIds: string[]) =>
  Array.from({ length: COVERAGE_MIN_PLANS }, () => ({ plan: namingPlan(playerIds) }));

describe('summarizePlanCoverage — one walk, three answers', () => {
  it('finds players named on a block, on a station, and in a rotation group', () => {
    const coverage = summarizePlanCoverage([
      { plan: plan([{ id: 'b1', title: 'A', duration: { minutes: 10 }, playerIds: ['p1'] }]) },
      { plan: plan([{ id: 'b2', title: 'B', duration: { minutes: 10 }, stations: [{ id: 's', name: 'Tees', playerIds: ['p2'] }] }]) },
      {
        plan: plan([{
          id: 'b3', title: 'C', duration: { minutes: 10 },
          rotation: { intervalMinutes: 5, groupSource: 'manual', groups: [{ id: 'g', name: 'A', playerIds: ['p3'] }] },
        }]),
      },
    ]);
    assert.deepEqual([...coverage.namedPlayerIds].sort(), ['p1', 'p2', 'p3']);
    assert.equal(coverage.planCount, 3);
  });

  it('collects covered tags from the practice, its drill stations, and legacy free text', () => {
    const coverage = summarizePlanCoverage([
      { plan: plan([]), tagNames: ['Hitting'] },
      { plan: plan([{ id: 'b', title: 'B', duration: { minutes: 5 }, stations: [{ id: 's', name: 'Tees', drillTags: ['Fielding'] }] }]) },
      // ⚠ Read, never written and never migrated: a plan typed before tags existed still counts as
      // being about what it said it was about.
      { plan: { version: 1, practiceTypes: ['Pitching'], blocks: [] } },
    ]);
    assert.deepEqual([...coverage.coveredTagNames].sort(), ['fielding', 'hitting', 'pitching']);
  });

  it('⚠ is UNANSWERABLE when no plan names anyone — assigning players is optional', () => {
    // A coach whose practice is "everyone rotates through four stations" names nobody. Flagging
    // their entire roster would be the product misreading its own data as a coaching failure.
    const coverage = summarizePlanCoverage(
      Array.from({ length: COVERAGE_MIN_PLANS + 2 }, () => ({ plan: plan([{ id: 'b', title: 'A', duration: { minutes: 10 } }]) })),
    );
    assert.equal(coverage.answerable, false);
  });

  it('⚠ is UNANSWERABLE on thin data — one plan in is not a habit', () => {
    const coverage = summarizePlanCoverage([{ plan: namingPlan(['p1']) }]);
    assert.equal(coverage.answerable, false);
    assert.equal(summarizePlanCoverage(enoughPlans(['p1'])).answerable, true);
  });
});

describe('planCoverageFinding — count-only, nameless, and silent until it means something', () => {
  const coverage = summarizePlanCoverage(enoughPlans(['p1']));

  it('states a count and never a name', () => {
    const text = planCoverageFinding(coverage, ['p1', 'p2', 'p3'])!;
    assert.match(text, /^2 players haven’t been named in a plan yet/);
    for (const id of ['p1', 'p2', 'p3']) assert.doesNotMatch(text, new RegExp(id));
  });

  it('agrees with itself on one', () => {
    assert.match(planCoverageFinding(coverage, ['p1', 'p2'])!, /^1 player hasn’t been named/);
  });

  it('says nothing when everyone is covered, when the roster is empty, or when unanswerable', () => {
    assert.equal(planCoverageFinding(coverage, ['p1']), null);
    assert.equal(planCoverageFinding(coverage, []), null);
    assert.equal(planCoverageFinding(summarizePlanCoverage([{ plan: namingPlan(['p1']) }]), ['p1', 'p2']), null);
  });

  it('⚠ counts by INTERSECTING with the roster, never by subtracting set sizes', () => {
    // A plan can name a player who has since left. Subtraction under-counts the gap — and with
    // enough departures it goes NEGATIVE and the finding vanishes, which is the worst possible
    // failure for the one surface meant to catch a child being missed.
    const withDepartures = summarizePlanCoverage(enoughPlans(['gone-1', 'gone-2', 'gone-3', 'p1']));
    assert.equal(withDepartures.namedPlayerIds.size, 4);
    assert.match(planCoverageFinding(withDepartures, ['p1', 'p2'])!, /^1 player hasn’t been named/);
  });

  it('never uses done-language about what was planned', () => {
    const text = planCoverageFinding(coverage, ['p1', 'p2', 'p3'])!;
    assert.doesNotMatch(text, /\bworked on\b|\bcovered\b|\bdid\b|\bran\b|\bcompleted\b/i);
  });
});

describe('uncoveredFocusTags — tags, never focus areas and never players', () => {
  const coverage = summarizePlanCoverage([
    { plan: plan([]), tagNames: ['Hitting'] },
    { plan: plan([]), tagNames: ['Fielding'] },
    { plan: plan([]) },
  ]);

  it('lists tags a plan never covered, alphabetically', () => {
    const out = uncoveredFocusTags([
      { tagId: 't-pitch', tagName: 'Pitching' },
      { tagId: 't-bunt', tagName: 'Bunting' },
      { tagId: 't-hit', tagName: 'Hitting' },
    ], coverage);
    assert.deepEqual(out.map(t => t.name), ['Bunting', 'Pitching']);
  });

  it('matches case-insensitively, so a re-cased tag is never falsely reported as a gap', () => {
    assert.deepEqual(uncoveredFocusTags([{ tagId: 't', tagName: 'hitting' }], coverage), []);
  });

  it('⚠ never reports an UNTAGGED focus area — absence of data is not absence of need', () => {
    assert.deepEqual(uncoveredFocusTags([
      { tagId: null, tagName: null },
      { tagId: 't-x', tagName: null },
      { tagId: null, tagName: 'Orphan' },
    ], coverage), []);
  });

  it('⚠ says NOTHING until the season has enough plans to judge by', () => {
    // One plan tagged "Fielding" and a player working on "Hitting" is not evidence that hitting is
    // being neglected — it is evidence the season just started. Gating the per-player column and
    // the finding while leaving THIS section ungated would let one corner of the screen make a
    // confident claim its neighbours are refusing to make.
    const thin = summarizePlanCoverage([{ plan: plan([]), tagNames: ['Fielding'] }]);
    assert.equal(thin.planCount, 1);
    assert.deepEqual(uncoveredFocusTags([{ tagId: 't-hit', tagName: 'Hitting' }], thin), []);
  });

  it('⚠ says nothing when the practices read FAILED, rather than blaming the coach for it', () => {
    // The board route swallows a failed practices read (`.catch(() => [])`) so the rest of the
    // report survives. Without the gate, that empty result would look exactly like "you have
    // planned nothing" and every active focus tag would be listed as a gap — a confident wrong
    // answer manufactured out of an error, which is the worst thing this surface can do.
    const readFailed = summarizePlanCoverage([]);
    assert.deepEqual(uncoveredFocusTags([{ tagId: 't-hit', tagName: 'Hitting' }], readFailed), []);
  });

  it('answers once there ARE enough plans, even if no plan ever named a player', () => {
    // Gated on planCount, NOT on `answerable`: naming players is optional, and this question is
    // about tags, not people. A coach who plans three practices and assigns nobody still deserves
    // an honest answer here.
    const enough = Array.from({ length: COVERAGE_MIN_PLANS }, () => ({ plan: plan([]), tagNames: ['Fielding'] }));
    const coverage = summarizePlanCoverage(enough);
    assert.equal(coverage.answerable, false, 'no plan named anyone, so the per-player column stays away');
    assert.deepEqual(
      uncoveredFocusTags([{ tagId: 't-hit', tagName: 'Hitting' }], coverage).map(t => t.name),
      ['Hitting'],
    );
  });

  it('de-duplicates by tag, so a tag five players share appears once', () => {
    const shared = Array.from({ length: 5 }, () => ({ tagId: 't-bunt', tagName: 'Bunting' }));
    assert.deepEqual(uncoveredFocusTags(shared, coverage).length, 1);
  });

  it('⚠ orders by NAME, never by how many players share a tag', () => {
    // Sorting by share count would rank areas against each other and, one step on, the children
    // behind them. Two tags, the rarer one alphabetically first, must stay first.
    const goals = [
      { tagId: 't-z', tagName: 'Zone coverage' },
      { tagId: 't-z', tagName: 'Zone coverage' },
      { tagId: 't-z', tagName: 'Zone coverage' },
      { tagId: 't-a', tagName: 'Arm care' },
    ];
    assert.deepEqual(uncoveredFocusTags(goals, coverage).map(t => t.name), ['Arm care', 'Zone coverage']);
  });
});
