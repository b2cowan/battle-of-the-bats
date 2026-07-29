import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  diffSeenTimes,
  findDuplicateSelfEntries,
  pickNextOrMostRecent,
  COACH_GAME_EVENT_TYPES,
} from '../../lib/coach-tournament-games.ts';
import type { RepTeamEvent } from '../../lib/types.ts';

function event(overrides: Partial<RepTeamEvent> = {}): RepTeamEvent {
  return {
    id: 'e1',
    programYearId: 'py',
    teamId: 't',
    orgId: 'o',
    eventType: 'tournament_game',
    name: 'Spring Classic',
    description: null,
    startsAt: '2026-05-16T09:00:00+00:00',
    endsAt: null,
    location: null,
    locationAddress: null,
    arrivalTime: null,
    fieldNumber: null,
    uniform: null,
    resources: [],
    opponent: 'Kanata Selects',
    homeAway: 'away',
    teamScore: null,
    opponentScore: null,
    result: null,
    parentEventId: null,
    isRecurring: false,
    recurrenceRule: null,
    recurrenceParentId: null,
    status: 'scheduled',
    sourceTournamentGameId: 'game-1',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('mirrored games — telling the coach it moved', () => {
  it('says nothing the first time a game is seen', () => {
    const { moved, nextSeen } = diffSeenTimes([event()], {});
    assert.deepEqual(moved, []);
    assert.deepEqual(nextSeen, { e1: '2026-05-16T09:00' });
  });

  it('flags a game whose time changed since this device last showed it', () => {
    const { moved } = diffSeenTimes(
      [event({ startsAt: '2026-05-16T11:30:00+00:00' })],
      { e1: '2026-05-16T09:00' },
    );
    assert.equal(moved.length, 1);
    assert.equal(moved[0].previous, '2026-05-16T09:00');
    assert.equal(moved[0].dayChanged, false, 'same day — no reason to re-check attendance');
  });

  it('marks a day change, which is when attendance replies are worth re-checking', () => {
    const { moved } = diffSeenTimes(
      [event({ startsAt: '2026-05-17T14:00:00+00:00' })],
      { e1: '2026-05-16T09:00' },
    );
    assert.equal(moved[0].dayChanged, true);
  });

  it('keeps the marker up until the coach acknowledges it', () => {
    const seen = { e1: '2026-05-16T09:00' };
    const first = diffSeenTimes([event({ startsAt: '2026-05-17T14:00:00+00:00' })], seen);
    const second = diffSeenTimes([event({ startsAt: '2026-05-17T14:00:00+00:00' })], first.nextSeen);
    assert.equal(second.moved.length, 1, 'a reload must not silently clear it');
  });

  it('ignores the coach’s own events entirely', () => {
    const { moved, nextSeen } = diffSeenTimes(
      [event({ sourceTournamentGameId: null, startsAt: '2026-05-17T14:00:00+00:00' })],
      { e1: '2026-05-16T09:00' },
    );
    assert.deepEqual(moved, []);
    assert.deepEqual(nextSeen, {});
  });

  it('forgets games that are no longer on the calendar', () => {
    const { nextSeen } = diffSeenTimes([], { gone: '2026-01-01T10:00' });
    assert.deepEqual(nextSeen, {});
  });
});

describe('which event to take attendance for', () => {
  const NOW = new Date('2026-05-16T12:00:00Z').getTime();
  const at = (id: string, iso: string, over: Partial<RepTeamEvent> = {}) =>
    event({ id, startsAt: iso, sourceTournamentGameId: null, ...over });
  const opts = { types: COACH_GAME_EVENT_TYPES, now: NOW };

  it('prefers the soonest upcoming event', () => {
    const picked = pickNextOrMostRecent(
      [at('late', '2026-05-20T18:00:00Z'), at('soon', '2026-05-17T18:00:00Z'), at('past', '2026-05-01T18:00:00Z')],
      opts,
    );
    assert.equal(picked?.id, 'soon');
  });

  it('falls back to the most recent when the season is behind them', () => {
    const picked = pickNextOrMostRecent(
      [at('older', '2026-05-01T18:00:00Z'), at('newer', '2026-05-10T18:00:00Z')],
      opts,
    );
    assert.equal(picked?.id, 'newer');
  });

  it('treats an event happening right now as upcoming, not past', () => {
    const picked = pickNextOrMostRecent([at('now', '2026-05-16T12:00:00Z'), at('past', '2026-05-01T18:00:00Z')], opts);
    assert.equal(picked?.id, 'now');
  });

  it('ignores cancelled events and types it was not asked for', () => {
    assert.equal(pickNextOrMostRecent([at('x', '2026-05-17T18:00:00Z', { status: 'cancelled' })], opts), null);
    assert.equal(pickNextOrMostRecent([at('p', '2026-05-17T18:00:00Z', { eventType: 'practice' })], opts), null);
  });

  it('returns null for an empty calendar', () => {
    assert.equal(pickNextOrMostRecent([], opts), null);
  });
});

describe('mirrored games — the hand-entered duplicates', () => {
  const mirror = event({ id: 'mirror', sourceTournamentGameId: 'game-1' });

  it('pairs a coach’s own game with the real one on the same day', () => {
    const own = event({
      id: 'own', sourceTournamentGameId: null, name: 'Tournament Game vs Kanata',
      opponent: 'Kanata', startsAt: '2026-05-16T09:00:00+00:00',
    });
    const pairs = findDuplicateSelfEntries([mirror, own]);
    assert.deepEqual(pairs.map(p => [p.mirrorId, p.ownId]), [['mirror', 'own']]);
  });

  it('matches on the event name when the coach left the opponent blank', () => {
    const own = event({
      id: 'own', sourceTournamentGameId: null, name: 'vs Kanata Selects', opponent: null,
    });
    assert.equal(findDuplicateSelfEntries([mirror, own]).length, 1);
  });

  it('does not pair games on different days', () => {
    const own = event({
      id: 'own', sourceTournamentGameId: null, opponent: 'Kanata',
      startsAt: '2026-05-18T09:00:00+00:00',
    });
    assert.deepEqual(findDuplicateSelfEntries([mirror, own]), []);
  });

  it('does not pair a genuinely different opponent on the same day', () => {
    const own = event({ id: 'own', sourceTournamentGameId: null, opponent: 'Barrhaven Blue' });
    assert.deepEqual(findDuplicateSelfEntries([mirror, own]), []);
  });

  it('does not pair two different clubs that merely share a generic word', () => {
    // "Kanata United" and "Barrhaven United" are different teams; flagging them as duplicates
    // would nag a coach to delete a game that is not one.
    const united = event({ id: 'm-united', opponent: 'Kanata United' });
    const own = event({ id: 'own', sourceTournamentGameId: null, opponent: 'Barrhaven United' });
    assert.deepEqual(findDuplicateSelfEntries([united, own]), []);
  });

  it('never pairs on a bare "Game" with no opponent — a false pair is worse than none', () => {
    const own = event({ id: 'own', sourceTournamentGameId: null, name: 'Game', opponent: null });
    assert.deepEqual(findDuplicateSelfEntries([mirror, own]), []);
    const vagueMirror = event({ id: 'm2', opponent: 'TBD' });
    assert.deepEqual(findDuplicateSelfEntries([vagueMirror, own]), []);
  });

  it('ignores practices and cancelled rows', () => {
    const practice = event({ id: 'p', sourceTournamentGameId: null, eventType: 'practice', opponent: 'Kanata' });
    const cancelled = event({ id: 'c', sourceTournamentGameId: null, opponent: 'Kanata', status: 'cancelled' });
    assert.deepEqual(findDuplicateSelfEntries([mirror, practice, cancelled]), []);
  });

  it('still pairs the same club written two ways', () => {
    const own = event({ id: 'own', sourceTournamentGameId: null, name: 'Tournament Game vs Kanata', opponent: null });
    assert.equal(findDuplicateSelfEntries([mirror, own]).length, 1);
  });

  it('claims each of the coach’s games at most once', () => {
    const mirrorB = event({ id: 'mirror2', sourceTournamentGameId: 'game-2', startsAt: '2026-05-16T13:00:00+00:00' });
    const own = event({ id: 'own', sourceTournamentGameId: null, opponent: 'Kanata Selects' });
    const pairs = findDuplicateSelfEntries([mirror, mirrorB, own]);
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0].mirrorId, 'mirror');
  });
});
