import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  planTournamentGameMirror,
  decideOrphanFate,
  changedOwnedFields,
  ownedFieldsFromGame,
  hasCoachOwnedFields,
  type MirrorSourceGame,
  type ExistingMirrorRow,
} from '../../lib/tournament-game-mirror.ts';

function sourceGame(overrides: Partial<MirrorSourceGame> = {}): MirrorSourceGame {
  return {
    id: 'game-1',
    startsAt: '2026-05-16T09:00',
    gameDate: '2026-05-16',
    opponentName: 'Kanata Selects',
    homeAway: 'away',
    location: 'Millennium Park',
    myScore: null,
    oppScore: null,
    status: 'scheduled',
    result: null,
    tournamentName: 'Spring Classic',
    ...overrides,
  };
}

function mirrorRow(overrides: Partial<ExistingMirrorRow> = {}): ExistingMirrorRow {
  return {
    id: 'event-1',
    source_tournament_game_id: 'game-1',
    name: 'Spring Classic',
    starts_at: '2026-05-16T09:00:00+00:00',
    location: 'Millennium Park',
    opponent: 'Kanata Selects',
    home_away: 'away',
    team_score: null,
    opponent_score: null,
    result: null,
    status: 'scheduled',
    arrival_time: null,
    uniform: null,
    field_number: null,
    description: null,
    resources: [],
    ...overrides,
  };
}

const NO_FLOOR = { seasonFloor: null };

describe('tournament-game mirror — what lands on the calendar', () => {
  it('mirrors a dated tournament game the team has never seen', () => {
    const plan = planTournamentGameMirror([sourceGame()], [], NO_FLOOR);
    assert.equal(plan.inserts.length, 1);
    assert.equal(plan.inserts[0].source_tournament_game_id, 'game-1');
    assert.equal(plan.inserts[0].name, 'Spring Classic');
    assert.equal(plan.inserts[0].opponent, 'Kanata Selects');
    assert.equal(plan.inserts[0].home_away, 'away');
    assert.equal(plan.updates.length, 0);
    assert.equal(plan.orphans.length, 0);
  });

  it('leaves an undated bracket slot alone — there is no start time to hang an event on', () => {
    const plan = planTournamentGameMirror(
      [sourceGame({ id: 'semi', startsAt: null, gameDate: null, opponentName: 'TBD' })],
      [], NO_FLOOR,
    );
    assert.deepEqual(plan, { inserts: [], updates: [], orphans: [] });
  });

  it('drops games played before the season began, so a rollover cannot resurrect them', () => {
    const lastSeason = sourceGame({ id: 'old', gameDate: '2025-08-02', startsAt: '2025-08-02T10:00' });
    const thisSeason = sourceGame({ id: 'new', gameDate: '2026-05-16' });
    const plan = planTournamentGameMirror([lastSeason, thisSeason], [], { seasonFloor: '2026-01-15' });
    assert.equal(plan.inserts.length, 1);
    assert.equal(plan.inserts[0].source_tournament_game_id, 'new');
  });

  it('writes nothing when the organizer has changed nothing', () => {
    const plan = planTournamentGameMirror([sourceGame()], [mirrorRow()], NO_FLOOR);
    assert.deepEqual(plan, { inserts: [], updates: [], orphans: [] });
  });

  it('does not churn on the timestamp format Postgres hands back', () => {
    const changed = changedOwnedFields(
      { ...ownedFieldsFromGame(sourceGame()), starts_at: '2026-05-16T09:00:00+00:00' },
      ownedFieldsFromGame(sourceGame()),
    );
    assert.deepEqual(changed, {});
  });
});

describe('tournament-game mirror — the organizer changes something', () => {
  it('moves the game and touches nothing else', () => {
    const moved = sourceGame({ startsAt: '2026-05-17T14:00', gameDate: '2026-05-17' });
    const plan = planTournamentGameMirror([moved], [mirrorRow()], NO_FLOOR);
    assert.equal(plan.updates.length, 1);
    assert.deepEqual(plan.updates[0], { id: 'event-1', fields: { starts_at: '2026-05-17T14:00' } });
    assert.equal(plan.orphans.length, 0, 'a reschedule is never an orphan — the lineup stays attached');
  });

  it('carries the final score and result through', () => {
    const final = sourceGame({ status: 'completed', myScore: 7, oppScore: 4, result: 'win' });
    const plan = planTournamentGameMirror([final], [mirrorRow()], NO_FLOOR);
    assert.deepEqual(plan.updates[0].fields, { team_score: 7, opponent_score: 4, result: 'win' });
  });

  it('cancels the event when the organizer cancels the game, and restores it when they undo', () => {
    const cancelled = planTournamentGameMirror(
      [sourceGame({ status: 'cancelled' })], [mirrorRow()], NO_FLOOR,
    );
    assert.deepEqual(cancelled.updates[0].fields, { status: 'cancelled' });

    const restored = planTournamentGameMirror(
      [sourceGame()], [mirrorRow({ status: 'cancelled' })], NO_FLOOR,
    );
    assert.deepEqual(restored.updates[0].fields, { status: 'scheduled' });
  });

  it('never proposes a write to a coach-owned field', () => {
    const row = mirrorRow({ arrival_time: '08:15', uniform: 'Home whites', description: 'Gate 4 closed' });
    const plan = planTournamentGameMirror(
      [sourceGame({ startsAt: '2026-05-16T11:00' })], [row], NO_FLOOR,
    );
    const written = Object.keys(plan.updates[0].fields);
    assert.deepEqual(written, ['starts_at']);
  });
});

describe('tournament-game mirror — the game disappears', () => {
  it('orphans the event when the game is gone but the tournament is still showing others', () => {
    const stillThere = sourceGame({ id: 'game-2', opponentName: 'Barrhaven Blue' });
    const plan = planTournamentGameMirror([stillThere], [mirrorRow(), mirrorRow({ id: 'event-2', source_tournament_game_id: 'game-2', opponent: 'Barrhaven Blue' })], NO_FLOOR);
    assert.equal(plan.orphans.length, 1);
    assert.equal(plan.orphans[0].id, 'event-1');
    assert.equal(plan.inserts.length, 0);
  });

  it('leaves rows alone when the tournament stops showing ANY games — that is a retracted schedule, not a cancellation', () => {
    // An organizer reopening registration takes the division's schedule offline automatically, and
    // a withdrawn registration does the same. Marking the coach's whole weekend "Cancelled" would
    // be untrue; staying quiet lets it heal when the schedule comes back.
    const plan = planTournamentGameMirror([], [mirrorRow()], NO_FLOOR);
    assert.deepEqual(plan, { inserts: [], updates: [], orphans: [] });
  });

  it('heals when the schedule is published again', () => {
    const plan = planTournamentGameMirror([sourceGame()], [mirrorRow({ status: 'cancelled' })], NO_FLOOR);
    assert.equal(plan.orphans.length, 0);
    assert.deepEqual(plan.updates[0].fields, { status: 'scheduled' });
  });

  it('re-points to a same-day replacement instead of killing it — delete-and-recreate', () => {
    const replacement = sourceGame({ id: 'game-2' });
    const plan = planTournamentGameMirror([replacement], [mirrorRow()], NO_FLOOR);
    assert.equal(plan.orphans.length, 0, 'the coach’s lineup follows the game to its new identity');
    assert.equal(plan.inserts.length, 0, 'and no empty duplicate is created');
    assert.equal(plan.updates.length, 1);
    assert.equal(plan.updates[0].id, 'event-1');
    assert.equal(plan.updates[0].fields.source_tournament_game_id, 'game-2');
  });

  it('re-points a replacement that also moved — recreated on a different day', () => {
    const replacement = sourceGame({ id: 'game-2', gameDate: '2026-05-18', startsAt: '2026-05-18T16:00' });
    const plan = planTournamentGameMirror([replacement], [mirrorRow()], NO_FLOOR);
    assert.equal(plan.orphans.length, 0);
    assert.equal(plan.updates[0].fields.source_tournament_game_id, 'game-2');
    assert.equal(plan.updates[0].fields.starts_at, '2026-05-18T16:00');
  });

  it('re-points a whole regenerated bracket, each game to its own opponent', () => {
    const existing = [
      mirrorRow({ id: 'e1', source_tournament_game_id: 'old-1', opponent: 'Kanata Selects' }),
      mirrorRow({ id: 'e2', source_tournament_game_id: 'old-2', opponent: 'Barrhaven Blue' }),
    ];
    const regenerated = [
      sourceGame({ id: 'new-1', opponentName: 'Kanata Selects' }),
      sourceGame({ id: 'new-2', opponentName: 'Barrhaven Blue' }),
    ];
    const plan = planTournamentGameMirror(regenerated, existing, NO_FLOOR);
    assert.equal(plan.orphans.length, 0);
    assert.equal(plan.inserts.length, 0);
    const byEvent = Object.fromEntries(plan.updates.map(u => [u.id, u.fields.source_tournament_game_id]));
    assert.deepEqual(byEvent, { e1: 'new-1', e2: 'new-2' });
  });

  it('refuses to guess when two games against the same opponent could be the replacement', () => {
    const plan = planTournamentGameMirror(
      [sourceGame({ id: 'a' }), sourceGame({ id: 'b', startsAt: '2026-05-16T13:00' })],
      [mirrorRow()],
      NO_FLOOR,
    );
    assert.equal(plan.orphans.length, 1, 'the coach’s work stays put rather than riding a coin flip');
    assert.equal(plan.inserts.length, 2);
  });

  it('resolves the same pairings whatever order the rows arrive in', () => {
    // Three orphans, three replacements, one opponent shared by two of them on different days:
    // the answer must be a fixed point, not a function of array order.
    const existing = [
      mirrorRow({ id: 'e1', source_tournament_game_id: 'o1', opponent: 'Kanata Selects', starts_at: '2026-05-16T09:00:00+00:00' }),
      mirrorRow({ id: 'e2', source_tournament_game_id: 'o2', opponent: 'Kanata Selects', starts_at: '2026-05-17T09:00:00+00:00' }),
      mirrorRow({ id: 'e3', source_tournament_game_id: 'o3', opponent: 'Barrhaven Blue', starts_at: '2026-05-16T13:00:00+00:00' }),
    ];
    const replacements = [
      sourceGame({ id: 'n1', opponentName: 'Kanata Selects', gameDate: '2026-05-16', startsAt: '2026-05-16T10:00' }),
      sourceGame({ id: 'n2', opponentName: 'Kanata Selects', gameDate: '2026-05-17', startsAt: '2026-05-17T10:00' }),
      sourceGame({ id: 'n3', opponentName: 'Barrhaven Blue', gameDate: '2026-05-16', startsAt: '2026-05-16T14:00' }),
    ];
    const expected = { e1: 'n1', e2: 'n2', e3: 'n3' };
    for (const rows of [existing, [...existing].reverse()]) {
      for (const games of [replacements, [...replacements].reverse()]) {
        const plan = planTournamentGameMirror(games, rows, NO_FLOOR);
        assert.equal(plan.orphans.length, 0);
        assert.equal(plan.inserts.length, 0);
        assert.deepEqual(
          Object.fromEntries(plan.updates.map(u => [u.id, u.fields.source_tournament_game_id])),
          expected,
        );
      }
    }
  });

  it('refuses to guess when two of the coach’s games compete for one replacement', () => {
    const existing = [
      mirrorRow({ id: 'e1', source_tournament_game_id: 'old-1' }),
      mirrorRow({ id: 'e2', source_tournament_game_id: 'old-2' }),
    ];
    const plan = planTournamentGameMirror([sourceGame({ id: 'new-1' })], existing, NO_FLOOR);
    assert.equal(plan.orphans.length, 2);
    assert.equal(plan.inserts.length, 1);
  });

  it('never re-points on a placeholder opponent — "TBD" is not an identity', () => {
    const plan = planTournamentGameMirror(
      [sourceGame({ id: 'new-1', opponentName: 'TBD' })],
      [mirrorRow({ opponent: 'TBD' })],
      NO_FLOOR,
    );
    assert.equal(plan.orphans.length, 1);
    assert.equal(plan.inserts.length, 1);
  });

  it('does not re-point across different tournaments', () => {
    const plan = planTournamentGameMirror(
      [sourceGame({ id: 'new-1', tournamentName: 'Summer Slam' })],
      [mirrorRow()],
      NO_FLOOR,
    );
    // The Summer Slam game is a new fixture, not a replacement for the Spring Classic one …
    assert.equal(plan.inserts.length, 1);
    assert.equal(plan.inserts[0].source_tournament_game_id, 'new-1');
    assert.equal(plan.updates.length, 0, 'the Spring Classic row is never re-pointed at it');
    // … and because Spring Classic is now showing nothing at all, its row is left alone rather
    // than being declared cancelled.
    assert.equal(plan.orphans.length, 0);
  });
});

describe('tournament-game mirror — never destroy the coach’s work', () => {
  it('removes an untouched orphan cleanly, leaving no phantom', () => {
    assert.equal(decideOrphanFate(mirrorRow(), false), 'delete');
  });

  it('cancels instead of deleting when attendance or a lineup exists', () => {
    assert.equal(decideOrphanFate(mirrorRow(), true), 'cancel');
  });

  it('cancels instead of deleting when the coach set anything of their own on the game', () => {
    assert.equal(decideOrphanFate(mirrorRow({ arrival_time: '08:15' }), false), 'cancel');
    assert.equal(decideOrphanFate(mirrorRow({ uniform: 'Home whites' }), false), 'cancel');
    assert.equal(decideOrphanFate(mirrorRow({ field_number: 'D3' }), false), 'cancel');
    assert.equal(decideOrphanFate(mirrorRow({ description: 'Gate 4 closed' }), false), 'cancel');
    assert.equal(decideOrphanFate(mirrorRow({ resources: [{ label: 'Map', url: 'https://x' }] }), false), 'cancel');
  });

  it('treats whitespace-only notes as no work', () => {
    assert.equal(hasCoachOwnedFields(mirrorRow({ description: '   ' })), false);
    assert.equal(decideOrphanFate(mirrorRow({ description: '   ' }), false), 'delete');
  });

  it('does not re-cancel a game it already cancelled', () => {
    assert.equal(decideOrphanFate(mirrorRow({ status: 'cancelled' }), true), 'noop');
  });
});
