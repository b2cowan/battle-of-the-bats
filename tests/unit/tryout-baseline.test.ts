import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildTryoutBaselineSnapshot,
  suggestBaselineFocus,
  tryoutDateLabel,
  isEmptyBaselineSnapshot,
  MAX_BASELINE_SUGGESTIONS,
} from '../../lib/tryout-baseline.ts';
import { computePlayerSeasonRecap } from '../../lib/player-season-recap.ts';
import type { RepTryoutBaselineSnapshot } from '../../lib/types.ts';

/**
 * The development baseline seeded from a tryout (Tryout Insights Phase 2 — plan §5; rulings
 * R3/R4/R5, memory/design_decisions.md 2026-08-02).
 *
 * The rules worth a test each are the ones that would fail SILENTLY:
 *   · the suggestion rule (R5's arithmetic half) — strictly below midpoint, lowest first, max 2;
 *   · a snapshot is a COPY, and a player nobody scored yields nothing rather than zeroes;
 *   · and — work item B5 — that no family-facing payload builder can reach this data at all.
 */

const RUBRIC = {
  scaleMax: 5,
  categories: [
    { key: 'speed', label: 'Speed', weight: 1 },
    { key: 'hit', label: 'Hitting', weight: 1 },
    { key: 'field', label: 'Fielding', weight: 1 },
    { key: 'throw', label: 'Throwing', weight: 1 },
  ],
};

function snapshotWith(averages: Record<string, number | null>, scaleMax = 5): RepTryoutBaselineSnapshot {
  return buildTryoutBaselineSnapshot({
    ranked: { composite: 3.2, evaluatorCount: 4, categoryAverages: averages },
    rubric: { ...RUBRIC, scaleMax },
    tryoutId: 'tryout-1',
    seasonLabel: '2027 Season',
    dateLabel: 'Aug 12–13',
    blindUsed: true,
  });
}

describe('buildTryoutBaselineSnapshot', () => {
  it('copies the rubric labels and scale in, so a later rename cannot rewrite the record', () => {
    const snap = snapshotWith({ speed: 4.4, hit: 3.6, field: 2.8, throw: 2.4 });
    assert.deepEqual(snap.categories.map(c => c.label), ['Speed', 'Hitting', 'Fielding', 'Throwing']);
    assert.equal(snap.scaleMax, 5);
    assert.equal(snap.composite, 3.2);
    assert.equal(snap.evaluatorCount, 4);
    assert.equal(snap.blindUsed, true);
    assert.equal(snap.version, 1);
  });

  it('rounds to two places — a stored snapshot must never carry a full-precision float', () => {
    const snap = snapshotWith({ speed: 3.3333333333333335, hit: null, field: null, throw: null });
    assert.equal(snap.categories[0].avg, 3.33);
  });

  it('keeps unscored categories as null, never zero', () => {
    const snap = snapshotWith({ speed: 4, hit: null, field: null, throw: null });
    assert.equal(snap.categories[1].avg, null);
    assert.equal(snap.categories[1].avg === 0, false);
  });

  it('an unscored player yields an EMPTY snapshot, not a card of zeroes', () => {
    const snap = buildTryoutBaselineSnapshot({
      ranked: null, rubric: RUBRIC, tryoutId: 't', seasonLabel: '2027', dateLabel: null, blindUsed: false,
    });
    assert.equal(snap.composite, null);
    assert.ok(isEmptyBaselineSnapshot(snap));
    assert.deepEqual(suggestBaselineFocus(snap), []);
  });

  it('falls back to a scale of 5 rather than 0 when there is no rubric — bars divide by it', () => {
    const snap = buildTryoutBaselineSnapshot({
      ranked: null, rubric: null, tryoutId: null, seasonLabel: '2027', dateLabel: null, blindUsed: false,
    });
    assert.equal(snap.scaleMax, 5);
    assert.deepEqual(snap.categories, []);
  });
});

describe('suggestBaselineFocus — R5 / OQ-2', () => {
  it('suggests the lowest categories first, capped at two', () => {
    const snap = snapshotWith({ speed: 4.4, hit: 1.2, field: 2.8, throw: 2.4 });
    const out = suggestBaselineFocus(snap);
    assert.equal(out.length, MAX_BASELINE_SUGGESTIONS);
    assert.deepEqual(out.map(c => c.key), ['hit', 'throw']);
  });

  it('is STRICTLY below the midpoint — a category exactly on it is not a weakness', () => {
    const snap = snapshotWith({ speed: 4, hit: 2.5, field: 2.5, throw: 2.49 });
    assert.deepEqual(suggestBaselineFocus(snap).map(c => c.key), ['throw']);
  });

  it('suggests NOTHING for a player who was strong everywhere', () => {
    const snap = snapshotWith({ speed: 4.4, hit: 4.1, field: 3.8, throw: 3.5 });
    assert.deepEqual(suggestBaselineFocus(snap), []);
  });

  it('scales with the scorecard — 4.5 is weak on a 1–10 card and strong on a 1–5 one', () => {
    assert.deepEqual(
      suggestBaselineFocus(snapshotWith({ speed: 9, hit: 8, field: 7, throw: 4.5 }, 10)).map(c => c.key),
      ['throw'],
    );
    assert.deepEqual(suggestBaselineFocus(snapshotWith({ speed: 4.9, hit: 4.8, field: 4.7, throw: 4.5 })), []);
  });

  it('breaks ties in the coach’s own scorecard order, never at random', () => {
    const snap = snapshotWith({ speed: 2.4, hit: 4, field: 2.4, throw: 2.4 });
    assert.deepEqual(suggestBaselineFocus(snap).map(c => c.key), ['speed', 'field']);
  });

  it('ignores unscored categories rather than treating them as the weakest', () => {
    const snap = snapshotWith({ speed: 4.4, hit: null, field: null, throw: 2.4 });
    assert.deepEqual(suggestBaselineFocus(snap).map(c => c.key), ['throw']);
  });
});

describe('tryoutDateLabel', () => {
  const s = (startsAt: string, status: 'scheduled' | 'cancelled' = 'scheduled') => ({ startsAt, status });

  it('renders one day, a same-month span, and a cross-month span', () => {
    assert.equal(tryoutDateLabel([s('2027-08-12T18:00:00Z')], 'America/Toronto'), 'Aug 12');
    assert.equal(
      tryoutDateLabel([s('2027-08-12T18:00:00Z'), s('2027-08-13T18:00:00Z')], 'America/Toronto'),
      'Aug 12–13',
    );
    assert.equal(
      tryoutDateLabel([s('2027-08-30T18:00:00Z'), s('2027-09-01T18:00:00Z')], 'America/Toronto'),
      'Aug 30 – Sep 1',
    );
  });

  it('names both years across a year boundary — the label is frozen, so it may never be ambiguous', () => {
    assert.equal(
      tryoutDateLabel([s('2027-12-30T18:00:00Z'), s('2028-01-02T18:00:00Z')], 'America/Toronto'),
      'Dec 30, 2027 – Jan 2, 2028',
    );
  });

  it('excludes cancelled sessions — a date the tryout did not happen on is not part of the record', () => {
    assert.equal(
      tryoutDateLabel([s('2027-08-12T18:00:00Z'), s('2027-08-20T18:00:00Z', 'cancelled')], 'America/Toronto'),
      'Aug 12',
    );
  });

  it('reads the date in the ORG zone, not UTC — a 9pm Toronto session is not the next day', () => {
    // 2027-08-13T01:30Z is Aug 12, 9:30pm in Toronto.
    assert.equal(tryoutDateLabel([s('2027-08-13T01:30:00Z')], 'America/Toronto'), 'Aug 12');
  });

  it('returns null rather than substituting today when there are no sessions', () => {
    assert.equal(tryoutDateLabel([], 'America/Toronto'), null);
    assert.equal(tryoutDateLabel([s('2027-08-12T18:00:00Z', 'cancelled')], 'America/Toronto'), null);
  });
});

/**
 * ── B5: R3 as a build-time contract, not a convention ────────────────────────────────────────
 *
 * "Tryout evaluation content is coach-eyes-only, PERMANENTLY." The failure mode this guards is
 * not malice — it is a future session adding one more field to the recap payload because it was
 * available. Nothing would look wrong; a child's tryout score would simply appear on a guardian's
 * phone. So the rule is stated over the SOURCE of every family-facing payload builder, in the
 * same spirit as the coach-season write guard.
 */
describe('B5 — no tryout evaluation data can reach a family-facing payload (R3)', () => {
  const ROOT = process.cwd();

  /**
   * Every module that assembles something a GUARDIAN reads. Adding a family payload builder
   * without adding it here is the gap; the "did we list them all" test below is what closes it.
   */
  const FAMILY_PAYLOAD_FILES = [
    'lib/rep-player-season-recap.ts',
    'lib/player-season-recap.ts',
    'lib/family-guardian-view.ts',
    'lib/family-view.ts',
    'lib/family-recap.ts',
    'lib/keepsake-card.ts',
    'components/family/PlayerRecapView.tsx',
  ];

  /** Anything that would carry an evaluation number (or the table that stores one) outward. */
  const FORBIDDEN = [
    'rep_player_tryout_baselines',
    'getRepPlayerTryoutBaseline',
    'RepTryoutBaselineSnapshot',
    'tryoutBaseline',
    'tryout-baseline',
    'rep_tryout_scores',
    'getRepTryoutScores',
    'rankTryoutCandidates',
    'buildTryoutReport',
    'categoryAverages',
  ];

  for (const file of FAMILY_PAYLOAD_FILES) {
    it(`${file} names nothing that carries a tryout evaluation`, () => {
      const full = join(ROOT, file);
      assert.ok(existsSync(full), `${file} has moved — update this guard rather than deleting it`);
      const src = readFileSync(full, 'utf8');
      for (const needle of FORBIDDEN) {
        assert.equal(
          src.includes(needle), false,
          `${file} references "${needle}". Tryout evaluation content is coach-eyes-only (R3) — ` +
          'the recap may state the FACT that a player earned a roster spot, never a number.',
        );
      }
    });
  }

  it('the family layer is fully listed — a new lib/family-*.ts must join the guard', () => {
    const listed = new Set(FAMILY_PAYLOAD_FILES);
    const familyModules = readdirSync(join(ROOT, 'lib'))
      .filter(f => /^family-.*\.ts$/.test(f))
      .map(f => `lib/${f}`);
    for (const mod of familyModules) {
      if (listed.has(mod)) continue;
      // Not every family-* module builds a payload (email, notify, consent, routing). Those are
      // allowed to be absent from the list — but they must still be clean, so they are checked
      // here rather than waived.
      const src = readFileSync(join(ROOT, mod), 'utf8');
      for (const needle of FORBIDDEN) {
        assert.equal(
          src.includes(needle), false,
          `${mod} references "${needle}" — tryout evaluation content is coach-eyes-only (R3).`,
        );
      }
    }
  });

  it('the assembled recap payload carries no tryout wording at all', () => {
    const stats = computePlayerSeasonRecap({
      attendanceGames: { attended: 8, known: 10, recorded: 10 },
      attendancePractices: { attended: 12, known: 14, recorded: 14 },
      goals: [{ focusArea: 'Arm strength', status: 'working' }],
      measurables: [
        { typeId: 't1', typeName: '30m sprint', value: 5.1, unit: 's', recordedOn: '2027-05-01' },
        { typeId: 't1', typeName: '30m sprint', value: 4.9, unit: 's', recordedOn: '2027-06-01' },
      ],
      awards: [{ name: 'Hustle', emoji: '⚡', awardedAt: '2027-06-02' }],
      playingTime: { fieldInnings: 40, benchInnings: 10, gamesWithLineup: 10, teamFieldInnings: [40, 38, 42] },
    });
    const serialized = JSON.stringify(stats).toLowerCase();
    for (const word of ['tryout', 'baseline', 'composite', 'evaluator', 'scorecard']) {
      assert.equal(serialized.includes(word), false, `the recap payload contains "${word}" (R3)`);
    }
  });
});
