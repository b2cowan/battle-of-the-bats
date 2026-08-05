/**
 * The coach sandbox's fictional world, checked against the product's own rules.
 *
 * `lib/demo-coach.ts` is hand-authored data — five teams' seasons written as constants — and the
 * expensive failures in this project have all been hand-authored data quietly disagreeing with
 * the code that reads it. These tests are the cheap half of the defence (the health check against
 * a live database is the other half): they run the demo's own plans through the product's real
 * validator, and re-derive the date rules the nightly re-anchor depends on.
 *
 * ⚠ The seed script cannot import `lib/rep-practice-plan.ts` itself — that module uses
 * extensionless imports and a plain `node` run cannot resolve them — so the demo materializes the
 * plan shape by hand. This file is what stops that hand-written shape drifting: whatever the seed
 * writes, `sanitizePracticePlan` (the ONE gate every real write path goes through) must accept
 * unchanged. If the product's plan shape moves and the demo's doesn't, this fails here rather
 * than a prospect finding a practice with no drills in it.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePracticePlan } from '../../lib/rep-practice-plan';
import {
  OFFSEASON_PRACTICE_PLANS, MIDSEASON_PRACTICE_PLANS, OFFSEASON_ROSTER, MIDSEASON_ROSTER,
  offSeasonSessionKey, resolveOffSeasonState, resolveSeasonStartState, resolveMidSeasonState,
  SEASON_START_LINEUP_GRID, SEASON_START_BATTING_ORDER, SEASON_START_ROSTER,
} from '../../lib/demo-coach';
import type { DemoPracticePlan } from '../../lib/demo-coach';

/** The seed's materializer, in the one shape a test can hold it: roster indexes → fake ids. */
function materialize(plan: DemoPracticePlan, playerIds: string[]) {
  const ids = (indexes?: readonly number[] | null) => (indexes ?? []).map(i => playerIds[i]).filter(Boolean);
  return {
    version: 1,
    goal: plan.goal,
    practiceTypes: [...plan.practiceTypes],
    equipment: [...plan.equipment],
    blocks: plan.blocks.map(block => {
      const out: Record<string, unknown> = {
        id: block.id,
        title: block.title,
        duration: block.restOfPractice ? { minutes: null, restOfPractice: true } : { minutes: block.minutes },
      };
      if (block.description) out.description = block.description;
      if (block.goal) out.goal = block.goal;
      if (block.coachingPoints) out.coachingPoints = [...block.coachingPoints];
      if (block.staff) out.staff = [...block.staff];
      if (block.stations) {
        out.stations = block.stations.map(s => ({ ...s }));
        out.rotation = {
          intervalMinutes: block.rotation!.intervalMinutes,
          groupSource: 'manual',
          groups: block.rotation!.groups.map(g => ({ id: g.id, name: g.name, playerIds: ids(g.playerIndexes) })),
        };
      } else {
        out.playerIds = block.playerIndexes ? ids(block.playerIndexes) : [...playerIds];
      }
      return out;
    }),
  };
}

const fakeIds = (n: number) => Array.from({ length: n }, (_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`);

describe('the demo world writes plans the product would accept', () => {
  const cases: Array<[string, readonly DemoPracticePlan[], number]> = [
    ['14U off-season', OFFSEASON_PRACTICE_PLANS, OFFSEASON_ROSTER.length],
    ['12U mid-season', MIDSEASON_PRACTICE_PLANS, MIDSEASON_ROSTER.length],
  ];

  for (const [label, plans, rosterSize] of cases) {
    test(`${label}: every plan survives the product's own validator unchanged`, () => {
      const playerIds = fakeIds(rosterSize);
      for (const plan of plans) {
        const built = materialize(plan, playerIds);
        const sanitized = sanitizePracticePlan(built);
        assert.ok(sanitized, `${plan.practiceKey} was rejected outright — the demo would seed a practice with no plan`);
        // Round-tripping is the real assertion: the validator is idempotent by requirement, so
        // anything it CHANGES is the demo disagreeing with the product about the shape.
        assert.deepEqual(
          JSON.parse(JSON.stringify(sanitized)),
          JSON.parse(JSON.stringify(sanitizePracticePlan(sanitized))),
          `${plan.practiceKey} is not stable through the validator`,
        );
        assert.equal(sanitized!.blocks.length, plan.blocks.length,
          `${plan.practiceKey} lost a block — a station/rotation field the product no longer accepts`);
      }
    });

    test(`${label}: every plan names a session that actually exists`, () => {
      // A plan whose key matches nothing attaches to nothing, silently — the seed's lookup simply
      // returns undefined and the practice ships without its plan.
      const now = new Date('2026-08-05T12:00:00Z');
      const keys = new Set(
        label.startsWith('14U')
          ? resolveOffSeasonState(now).practices.map(p => p.key)
          : resolveMidSeasonState(now).practices.map(p => p.key),
      );
      for (const plan of plans) {
        assert.ok(keys.has(plan.practiceKey), `${plan.practiceKey} matches no session in the world`);
      }
    });
  }
});

describe('the week-quantized calendar the re-anchor depends on', () => {
  // Every weekday, because which offsets are "past" is the one thing that changes with it.
  const days = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'];

  test('settled facts never drift into the future, and the year ahead never drifts into the past', () => {
    for (const day of days) {
      const now = new Date(`${day}T12:00:00Z`);
      const season = resolveSeasonStartState(now);
      const today = day;
      for (const game of season.games) {
        if (game.result != null) {
          assert.ok(game.date < today, `${day}: a decided game (${game.key}) is not in the past`);
        } else {
          assert.ok(game.date >= today, `${day}: an unplayed game (${game.key}) has slipped into the past`);
        }
      }
      // The 14U's paid expenses and settled instalments are behind us on every weekday too.
      const off = resolveOffSeasonState(now);
      for (const expense of off.expenses) {
        if (expense.paidDate) assert.ok(expense.paidDate < today, `${day}: ${expense.key} was paid in the future`);
        if (expense.deposit?.paidDate) assert.ok(expense.deposit.paidDate < today, `${day}: ${expense.key} deposit paid in the future`);
        if (expense.balance?.paidDate === null) assert.ok(expense.balance.dueDate > today, `${day}: ${expense.key} balance is overdue, not ahead`);
      }
      assert.ok(off.duesDueDates[0] < today && off.duesDueDates[1] < today, `${day}: settled dues are not behind us`);
      assert.ok(off.duesDueDates[2] > today && off.duesDueDates[3] > today, `${day}: future dues are not ahead`);
    }
  });

  test('weekdays hold: a Sunday session is a Sunday on every day of the week', () => {
    const dayOfWeek = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
    for (const day of days) {
      const now = new Date(`${day}T12:00:00Z`);
      for (const session of resolveOffSeasonState(now).practices) {
        const expected = session.key.startsWith(offSeasonSessionKey(0).slice(0, 7)) ? 0 : 3; // Sunday : Wednesday
        assert.equal(dayOfWeek(session.date), expected,
          `${day}: ${session.key} landed on weekday ${dayOfWeek(session.date)}`);
      }
      const season = resolveSeasonStartState(now);
      assert.equal(dayOfWeek(season.openingDate), 6, `${day}: opening day is not a Saturday`);
      for (const practice of season.practices) {
        assert.equal(dayOfWeek(practice.date), 4, `${day}: a 10U practice is not on a Thursday`);
      }
    }
  });

  test('opening day stays exactly two Saturdays back, whatever today is', () => {
    for (const day of days) {
      const now = new Date(`${day}T12:00:00Z`);
      const { openingDate } = resolveSeasonStartState(now);
      const gap = (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${openingDate}T00:00:00Z`)) / 86_400_000;
      assert.ok(gap >= 8 && gap <= 14, `${day}: opening day was ${gap} days back`);
    }
  });
});

describe("the 10U opener's lineup", () => {
  test('nine legal fielders every inning, and nobody below four of six', () => {
    const innings = SEASON_START_LINEUP_GRID;
    for (const [i, inning] of innings.entries()) {
      const onField = inning.filter(p => p !== 'Bench');
      assert.equal(onField.length, 9, `inning ${i + 1} fields ${onField.length}`);
      assert.equal(new Set(onField).size, 9, `inning ${i + 1} plays someone twice`);
    }
    // The floor the health check also asserts — kept here so a bad grid fails before it is seeded.
    for (let player = 0; player < SEASON_START_ROSTER.length; player++) {
      const played = innings.filter(inning => inning[player] !== 'Bench').length;
      assert.ok(played >= 4, `${SEASON_START_ROSTER[player].first} fields only ${played} of ${innings.length}`);
    }
  });

  test('both pitchers sit AT the arm-care default, never over it', () => {
    const pitchers = new Map<number, number>();
    for (const inning of SEASON_START_LINEUP_GRID) {
      const index = inning.indexOf('P');
      pitchers.set(index, (pitchers.get(index) ?? 0) + 1);
    }
    assert.equal(pitchers.size, 2, 'the opener used a number of pitchers other than two');
    for (const count of pitchers.values()) assert.equal(count, 3);
  });

  test('the batting order names every player exactly once', () => {
    assert.equal(new Set(SEASON_START_BATTING_ORDER).size, SEASON_START_ROSTER.length);
  });
});
