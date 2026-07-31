import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveOverviewAnchor,
  resolveBoard,
  resolveCoachingPair,
  resolveCoachingTilesShown,
  summariseAttendance,
  summarisePlayingTime,
  BOARD_SLOT_COUNT,
  type AnchorInput,
  type BoardInput,
} from '../../lib/coach-overview.ts';
import type { CoachCapabilities } from '../../lib/coach-capabilities.ts';

/** A head coach's full-access bundle — the baseline every case overrides from. */
const HEAD_CAPS: CoachCapabilities = {
  isHeadCoach: true,
  schedule: true,
  attendance: true,
  lineups: true,
  roster: 'view',
  rosterWrite: true,
  rosterPii: true,
  notes: true,
  money: 'write',
  documents: 'manage',
  announcementsSend: true,
  tryouts: true,
};

function caps(overrides: Partial<CoachCapabilities> = {}): CoachCapabilities {
  return { ...HEAD_CAPS, ...overrides };
}

function attendanceRow(gamesAttended: number, gamesKnown: number, practicesAttended = 0, practicesKnown = 0) {
  return {
    games: { attended: gamesAttended, known: gamesKnown },
    practices: { attended: practicesAttended, known: practicesKnown },
  };
}

function anchorInput(overrides: Partial<AnchorInput> = {}): AnchorInput {
  return {
    phase: 'in_season',
    hasNextEvent: false,
    nextIsGame: false,
    seasonWindingDown: false,
    hasOpenSetupStep: false,
    hasUpcomingTournament: false,
    caps: HEAD_CAPS,
    canManageSeasons: true,
    ...overrides,
  };
}

function boardInput(overrides: Partial<BoardInput> = {}): BoardInput {
  return {
    phase: 'in_season',
    anchorKind: null,
    caps: HEAD_CAPS,
    moneyStarted: true,
    ...overrides,
  };
}

describe('resolveOverviewAnchor — the collision this module exists to fix', () => {
  it('picks the season check, NOT the lull, when both predicates hold', () => {
    // The reported defect: the lull fires on `in_season && !nextEvent`; the winding-down cue fires
    // on that PLUS four more facts. Both used to render, telling one coach to add an event and to
    // close the season in two stacked cards.
    const decision = resolveOverviewAnchor(anchorInput({
      phase: 'in_season',
      hasNextEvent: false,
      seasonWindingDown: true,
    }));
    assert.equal(decision?.kind, 'season_check');
    assert.equal(decision?.primary, 'close_season');
  });

  it('the season check still offers the door the lull was offering (D2)', () => {
    const decision = resolveOverviewAnchor(anchorInput({ seasonWindingDown: true }));
    assert.ok(decision?.answers.includes('add_event'), 'suppressing the lull must not remove its door');
  });

  it('falls through to the lull when the season is NOT winding down', () => {
    const decision = resolveOverviewAnchor(anchorInput({ hasNextEvent: false, seasonWindingDown: false }));
    assert.equal(decision?.kind, 'lull');
    assert.equal(decision?.primary, 'add_event');
  });

  it('never returns two decisions — one call, one card', () => {
    // Structural: the return type is a single decision. This asserts the ordering holds even when
    // every predicate below game day is simultaneously true.
    const decision = resolveOverviewAnchor(anchorInput({
      phase: 'game_day',
      hasNextEvent: true,
      nextIsGame: true,
      seasonWindingDown: true,
      hasOpenSetupStep: true,
    }));
    assert.equal(decision?.kind, 'game_day');
  });
});

describe('resolveOverviewAnchor — ordering', () => {
  it('game day outranks everything', () => {
    const decision = resolveOverviewAnchor(anchorInput({ phase: 'game_day', hasNextEvent: true, nextIsGame: true }));
    assert.equal(decision?.kind, 'game_day');
    assert.equal(decision?.shape, 'working');
  });

  it('a scheduled event outranks the season check', () => {
    const decision = resolveOverviewAnchor(anchorInput({
      phase: 'in_season',
      hasNextEvent: true,
      nextIsGame: true,
      seasonWindingDown: true,
    }));
    assert.equal(decision?.kind, 'next_event');
  });

  it('pre-season names the next setup step', () => {
    const decision = resolveOverviewAnchor(anchorInput({ phase: 'preseason', hasOpenSetupStep: true }));
    assert.equal(decision?.kind, 'preseason');
    assert.equal(decision?.shape, 'next_step');
    assert.equal(decision?.primary, 'setup_step');
  });

  it('returns null (board-only, D15) when nothing is actionable', () => {
    const decision = resolveOverviewAnchor(anchorInput({ phase: 'preseason', hasOpenSetupStep: false }));
    assert.equal(decision, null);
  });
});

describe('resolveOverviewAnchor — state proposes, capability disposes (D14)', () => {
  it('game day steps down to attendance when the coach has no lineup access', () => {
    const decision = resolveOverviewAnchor(anchorInput({
      phase: 'game_day',
      hasNextEvent: true,
      nextIsGame: true,
      caps: caps({ lineups: false }),
    }));
    assert.equal(decision?.kind, 'game_day', 'the card must NOT yield — the game still matters');
    assert.equal(decision?.primary, 'take_attendance');
  });

  it('game day steps down to informational when the coach has neither lineups nor attendance', () => {
    const decision = resolveOverviewAnchor(anchorInput({
      phase: 'game_day',
      hasNextEvent: true,
      nextIsGame: true,
      caps: caps({ lineups: false, attendance: false }),
    }));
    assert.equal(decision?.kind, 'game_day');
    assert.equal(decision?.primary, 'open_schedule');
  });

  it('an event card with no completable action at all renders informationally, never disabled', () => {
    const decision = resolveOverviewAnchor(anchorInput({
      phase: 'game_day',
      hasNextEvent: true,
      nextIsGame: true,
      // schedule false would normally suppress the whole family; forced here to prove the shape.
      caps: caps({ lineups: false, attendance: false }), canManageSeasons: false,
    }));
    assert.notEqual(decision, null);
    assert.equal(decision?.primary, 'open_schedule');
  });

  it('the season check keeps its sentence and drops its button for a coach who cannot close', () => {
    const decision = resolveOverviewAnchor(anchorInput({
      seasonWindingDown: true,
      canManageSeasons: false,
    }));
    assert.equal(decision?.kind, 'season_check');
    assert.equal(decision?.primary, null, 'never a disabled button');
    assert.ok(decision?.answers.includes('got_it'));
    assert.ok(!decision?.answers.includes('not_yet'));
  });

  it('the lull YIELDS for a coach without schedule access', () => {
    // Without schedule access there is no event data at all, so "Nothing on your schedule" would be
    // a confident wrong answer rather than a fact.
    const decision = resolveOverviewAnchor(anchorInput({
      phase: 'in_season',
      hasNextEvent: false,
      caps: caps({ schedule: false }),
    }));
    assert.equal(decision, null);
  });

  it('a non-game event offers attendance, never a lineup', () => {
    const decision = resolveOverviewAnchor(anchorInput({
      phase: 'in_season',
      hasNextEvent: true,
      nextIsGame: false,
    }));
    assert.equal(decision?.kind, 'next_event');
    assert.equal(decision?.primary, 'take_attendance');
  });
});

describe('resolveBoard — the fixed set', () => {
  it('a head coach with money underway gets the money pair', () => {
    const { slots } = resolveBoard(boardInput());
    assert.equal(slots.length, BOARD_SLOT_COUNT);
    assert.ok(slots.includes('dues'));
    assert.ok(slots.includes('budget'));
    assert.ok(!slots.includes('attendance'));
  });

  it('a coach without money access gets the coaching pair instead of a thinner board (D13)', () => {
    const { slots } = resolveBoard(boardInput({ caps: caps({ money: 'off' }) }));
    assert.equal(slots.length, BOARD_SLOT_COUNT, 'the board must not shrink');
    assert.ok(slots.includes('attendance'));
    assert.ok(slots.includes('playingTime'));
    assert.ok(!slots.includes('dues'));
    assert.ok(!slots.includes('budget'));
  });

  it('playing time falls back to development without lineup access', () => {
    const { slots } = resolveBoard(boardInput({
      caps: caps({ money: 'off', lineups: false }),
    }));
    assert.ok(slots.includes('development'));
    assert.ok(!slots.includes('playingTime'));
  });

  it('falls to a shorter board rather than inventing a tile', () => {
    const { slots } = resolveBoard(boardInput({
      caps: caps({ money: 'off', roster: 'off', lineups: false, attendance: false, notes: false }),
    }));
    assert.ok(slots.length < BOARD_SLOT_COUNT);
    assert.ok(!slots.includes('roster'));
    assert.ok(!slots.includes('attendance'));
  });

  it('a read-only money coach still gets the money pair (reading is not doing)', () => {
    const { slots } = resolveBoard(boardInput({ caps: caps({ money: 'read' }) }));
    assert.ok(slots.includes('dues'));
    assert.ok(slots.includes('budget'));
  });
});

describe('resolveBoard — D16, the money pair collapses while wholly empty', () => {
  it('collapses to one setup tile and promotes a coaching tile', () => {
    const { slots } = resolveBoard(boardInput({ moneyStarted: false }));
    assert.ok(slots.includes('moneySetup'));
    assert.ok(!slots.includes('dues'));
    assert.ok(!slots.includes('budget'));
    assert.ok(slots.includes('attendance'), 'the freed slot fills rather than sitting empty');
    assert.equal(slots.length, BOARD_SLOT_COUNT, 'a brand-new coach still gets a full board');
  });

  it('restores the pair the moment money is underway', () => {
    const { slots } = resolveBoard(boardInput({ moneyStarted: true }));
    assert.ok(!slots.includes('moneySetup'));
    assert.ok(slots.includes('dues'));
  });

  it('does not apply to a coach with no money access at all', () => {
    const { slots } = resolveBoard(boardInput({
      moneyStarted: false,
      caps: caps({ money: 'off' }),
    }));
    assert.ok(!slots.includes('moneySetup'), 'a coach who cannot see money is not asked to set it up');
  });
});

describe('resolveBoard — the anchor subject drops out (D3)', () => {
  it('the schedule slot reports this week when the anchor is already about what is next', () => {
    for (const anchorKind of ['game_day', 'next_event'] as const) {
      const { slots, scheduleFace } = resolveBoard(boardInput({ anchorKind }));
      assert.equal(scheduleFace, 'thisWeek', `${anchorKind} must not have its subject repeated`);
      assert.ok(slots.includes('schedule'), 'the slot is reused, never emptied');
    }
  });

  it('the schedule slot reports next up otherwise', () => {
    for (const anchorKind of ['season_check', 'lull', 'preseason', null] as const) {
      const { scheduleFace } = resolveBoard(boardInput({ anchorKind }));
      assert.equal(scheduleFace, 'nextUp');
    }
  });
});

describe('resolveBoard — spatial memory', () => {
  it('every phase returns the same SET, only a different order', () => {
    const phases = ['preseason', 'in_season', 'game_day', 'result'] as const;
    const sets = phases.map(phase => [...resolveBoard(boardInput({ phase })).slots].sort().join(','));
    assert.equal(new Set(sets).size, 1, 'the tile set must not vary by phase — only the order may');
  });

  it('orders differ between game day and an in-season lull', () => {
    const gameDay = resolveBoard(boardInput({ phase: 'game_day' })).slots.join(',');
    const inSeason = resolveBoard(boardInput({ phase: 'in_season' })).slots.join(',');
    assert.notEqual(gameDay, inSeason);
  });

  it('never exceeds six tiles in any capability combination', () => {
    const moneyOptions = ['off', 'read', 'write'] as const;
    for (const money of moneyOptions) {
      for (const moneyStarted of [true, false]) {
        for (const lineups of [true, false]) {
          for (const attendance of [true, false]) {
            const { slots } = resolveBoard(boardInput({
              moneyStarted,
              caps: caps({ money, lineups, attendance }),
            }));
            assert.ok(slots.length <= BOARD_SLOT_COUNT, `${money}/${moneyStarted}/${lineups}/${attendance} produced ${slots.length}`);
            assert.equal(new Set(slots).size, slots.length, 'no tile may appear twice');
          }
        }
      }
    }
  });
});

describe('summariseAttendance — earned-it thresholds', () => {
  it('counts games AND practices toward the team share', () => {
    const summary = summariseAttendance([attendanceRow(4, 5, 3, 5)]);
    assert.equal(summary.sessions, 10);
    assert.equal(summary.share, 0.7);
  });

  it('reports no verdict until the season has enough recorded sessions', () => {
    const summary = summariseAttendance([attendanceRow(1, 2)]);
    assert.equal(summary.share, null, 'a verdict from two sessions is not a verdict');
    assert.equal(summary.lowCount, 0);
  });

  it('flags players below 70% once THEY have enough sessions', () => {
    const summary = summariseAttendance([
      attendanceRow(10, 10),
      attendanceRow(5, 10),   // 50% over ten sessions — genuinely slipping
    ]);
    assert.equal(summary.lowCount, 1);
  });

  it('does not flag a player who has barely any recorded sessions', () => {
    const summary = summariseAttendance([
      attendanceRow(10, 10),
      attendanceRow(0, 2),    // a new player, not a slipping one
    ]);
    assert.equal(summary.lowCount, 0);
  });

  it('handles an empty roster without dividing by zero', () => {
    const summary = summariseAttendance([]);
    assert.equal(summary.share, null);
    assert.equal(summary.sessions, 0);
  });
});

describe('summarisePlayingTime — earned-it thresholds', () => {
  const even = [
    { fieldInnings: 12, benchInnings: 6 },
    { fieldInnings: 12, benchInnings: 6 },
    { fieldInnings: 11, benchInnings: 7 },
  ];

  it('reports no verdict below three games with a lineup', () => {
    assert.equal(summarisePlayingTime(even, 2).verdict, 'insufficient');
  });

  it('reports no verdict when only one player has played', () => {
    assert.equal(summarisePlayingTime([{ fieldInnings: 10, benchInnings: 2 }], 10).verdict, 'insufficient');
  });

  it('calls a balanced season even', () => {
    const summary = summarisePlayingTime(even, 10);
    assert.equal(summary.verdict, 'even');
    assert.equal(summary.belowCount, 0);
  });

  it('names players sitting well below the team average', () => {
    const summary = summarisePlayingTime([
      { fieldInnings: 18, benchInnings: 0 },
      { fieldInnings: 18, benchInnings: 0 },
      { fieldInnings: 18, benchInnings: 0 },
      { fieldInnings: 4, benchInnings: 14 },
    ], 10);
    assert.equal(summary.verdict, 'uneven');
    assert.equal(summary.belowCount, 1);
  });

  it('measures SHARE, not raw innings — a player who missed games is not treated as benched', () => {
    // Three players dressed for every game, one dressed for a single game but played all of it.
    const summary = summarisePlayingTime([
      { fieldInnings: 12, benchInnings: 6 },
      { fieldInnings: 12, benchInnings: 6 },
      { fieldInnings: 12, benchInnings: 6 },
      { fieldInnings: 2, benchInnings: 1 },   // same 2/3 share, far fewer innings
    ], 10);
    assert.equal(summary.verdict, 'even');
  });
});

describe('resolveCoachingPair — the fetch gate and the board cannot disagree', () => {
  // The Attendance and Playing-time tiles are the only ones backed by their own request. If the
  // page decided eligibility separately from the board, an established coach would pay two HTTP
  // round trips on every Overview load for tiles that are never drawn. One function answers both.
  it('every tile the board shows from the pair is one the pair function returned', () => {
    const moneyOptions = ['off', 'read', 'write'] as const;
    for (const money of moneyOptions) {
      for (const moneyStarted of [true, false]) {
        for (const lineups of [true, false]) {
          for (const attendance of [true, false]) {
            for (const notes of [true, false]) {
              const c = caps({ money, lineups, attendance, notes });
              const pair = resolveCoachingPair(c);
              const { slots } = resolveBoard(boardInput({ caps: c, moneyStarted }));
              for (const key of ['attendance', 'playingTime', 'development'] as const) {
                if (slots.includes(key)) {
                  assert.ok(pair.includes(key), `board drew ${key} but the fetch gate would have skipped it`);
                }
              }
            }
          }
        }
      }
    }
  });

  it('offers attendance and playing time to a fully-capable coach', () => {
    assert.deepEqual(resolveCoachingPair(caps()), ['attendance', 'playingTime']);
  });

  it('falls back to development, then to nothing, as access narrows', () => {
    assert.deepEqual(resolveCoachingPair(caps({ lineups: false })), ['attendance', 'development']);
    assert.deepEqual(
      resolveCoachingPair(caps({ lineups: false, attendance: false, notes: false, roster: 'off' })),
      [],
    );
  });

  it('respects the shared nav gate — attendance needs roster visibility too', () => {
    // The attendance report lists players by name, so its route rides roster visibility. Granting
    // attendance alone would otherwise put a tile on the board that 403s when tapped.
    assert.ok(!resolveCoachingPair(caps({ roster: 'off' })).includes('attendance'));
  });
});

describe('resolveBoard — the money signal is not guessed (review finding)', () => {
  it('claims NO tile for slots 5-6 until the money signal has landed', () => {
    // Guessing either way made two tiles change identity after first paint — label, icon and
    // destination all moving — which is exactly the reshuffle the fixed-set rule forbids.
    const { slots, pendingSlots } = resolveBoard(boardInput({ moneyStarted: null }));
    assert.equal(pendingSlots, 2, 'the two undecided slots are held, not filled with a guess');
    assert.ok(!slots.includes('dues'));
    assert.ok(!slots.includes('budget'));
    assert.ok(!slots.includes('moneySetup'));
    assert.equal(slots.length + pendingSlots, BOARD_SLOT_COUNT, 'the board still holds six places');
  });

  it('a coach with no money access never waits — their pair has no unknown', () => {
    const { slots, pendingSlots } = resolveBoard(boardInput({
      moneyStarted: null,
      caps: caps({ money: 'off' }),
    }));
    assert.equal(pendingSlots, 0);
    assert.ok(slots.includes('attendance'));
  });
});

describe('resolveCoachingTilesShown — the fetch gate matches the board EXACTLY (review finding)', () => {
  // The earlier gate used the full eligible pair, so a coach with money-access-but-not-started
  // fetched Development for a slot the board never gave it — a wasted request on the landing page.
  it('never fetches for a tile the board does not draw, in any combination', () => {
    for (const money of ['off', 'read', 'write'] as const) {
      for (const moneyStarted of [true, false, null]) {
        for (const lineups of [true, false]) {
          for (const attendance of [true, false]) {
            for (const notes of [true, false]) {
              const c = caps({ money, lineups, attendance, notes });
              const shown = resolveCoachingTilesShown(c, moneyStarted);
              const { slots } = resolveBoard(boardInput({ caps: c, moneyStarted }));
              const drawn = slots.filter(s => s === 'attendance' || s === 'playingTime' || s === 'development');
              // Both directions: nothing drawn without a fetch, nothing fetched without a tile.
              assert.deepEqual(
                [...drawn].sort(), [...shown].sort(),
                `money=${money} started=${moneyStarted} lineups=${lineups} attendance=${attendance} notes=${notes}`,
              );
            }
          }
        }
      }
    }
  });

  it('a collapsed money pair frees exactly ONE slot, so only one coaching read is needed', () => {
    const c = caps({ money: 'write', lineups: false });
    const shown = resolveCoachingTilesShown(c, false);
    assert.equal(shown.length, 1);
    assert.equal(shown[0], 'attendance');
    assert.ok(!shown.includes('development'), 'development would have been a wasted request');
  });

  it('fetches nothing while the money signal is unknown', () => {
    assert.deepEqual(resolveCoachingTilesShown(caps(), null), []);
  });
});

describe('resolveCoachingPair — a tile is only offered when its NUMBER is real (review finding)', () => {
  it('does not offer Development to a coach whose goals are redacted', () => {
    // The Development SECTION is visible on roster view (measurables ride roster), but this tile's
    // value is a goal count and goals are notes-gated — the route redacts them. Offering the tile
    // would print a confident "No goals yet" at someone not cleared to see them.
    const rosterOnly = caps({ lineups: false, notes: false, roster: 'view' });
    assert.ok(!resolveCoachingPair(rosterOnly).includes('development'));
  });

  it('offers Development to a coach who can actually see goals', () => {
    assert.ok(resolveCoachingPair(caps({ lineups: false, notes: true })).includes('development'));
  });
});

describe('resolveOverviewAnchor — the lull keeps its tournament door (review finding)', () => {
  it('offers View tournaments when a registered tournament is what keeps the season alive', () => {
    const decision = resolveOverviewAnchor(anchorInput({
      phase: 'in_season',
      hasNextEvent: false,
      hasUpcomingTournament: true,
    }));
    assert.equal(decision?.kind, 'lull');
    assert.ok(decision?.answers.includes('view_tournaments'));
  });

  it('offers no such door when there is no tournament', () => {
    const decision = resolveOverviewAnchor(anchorInput({ phase: 'in_season', hasNextEvent: false }));
    assert.deepEqual(decision?.answers, []);
  });
});
