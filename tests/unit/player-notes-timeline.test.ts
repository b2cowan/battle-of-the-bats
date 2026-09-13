/**
 * The Notes timeline is ONE read over four sources, and the thing it decides is ORDER — so the
 * merge is pinned with hand-built rows (roster + player page review, hub F20 / Q10, 2026-09-13).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPlayerNotesTimeline, groupPlayerNotesByMonth } from '../../lib/player-notes-timeline.ts';
import type {
  RepDevelopmentGoalReview, RepPlayerDevelopmentGoal, RepPlayerNote, RepPlayerObservation,
  RepTeamEvent, RepTeamGameMoment, RepTeamMeasurableType,
} from '../../lib/types.ts';

const playerBase = '/club/coaches/teams/T1/roster/P1';
const teamBase = '/club/coaches/teams/T1';

const note = (id: string, on: string, body: string, extra: Partial<RepPlayerNote> = {}): RepPlayerNote => ({
  id, orgId: 'O', teamId: 'T1', playerId: 'P1', notedOn: on, body, goalId: null, eventId: null,
  createdBy: 'U1', createdAt: `${on}T12:00:00Z`, updatedAt: `${on}T12:00:00Z`, ...extra,
});
const moment = (id: string, at: string, body: string): RepTeamGameMoment => ({
  id, teamId: 'T1', orgId: 'O', programYearId: 'Y', eventId: 'E1', playerId: 'P1', body,
  happenedAt: at, createdBy: 'U2', createdByName: 'Coach Marc', createdAt: at,
});
const observation = (id: string, on: string, o: Partial<RepPlayerObservation> = {}): RepPlayerObservation => ({
  id, orgId: 'O', teamId: 'T1', playerId: 'P1', measurableTypeId: 'S1', observedOn: on,
  note: 'Used the routine after one cue.', descriptor: 'With a reminder', goalId: 'G1', sessionId: null,
  createdBy: 'U1', createdAt: `${on}T09:00:00Z`, updatedAt: `${on}T09:00:00Z`, ...o,
});
const review = (id: string, on: string): RepDevelopmentGoalReview => ({
  id, goalId: 'G1', playerId: 'P1', reviewedOn: on, status: 'working', note: 'Better on the second read.',
  nextReviewOn: null, evidenceMeasurableIds: [], evidenceObservationIds: [], createdBy: 'U1', createdAt: `${on}T18:00:00Z`,
});
const goals = [{ id: 'G1', focusArea: 'First-step quickness' } as RepPlayerDevelopmentGoal];
const types = [{ id: 'S1', name: 'Sets feet before throwing' } as RepTeamMeasurableType];
const events = [{ id: 'E1', name: 'vs Milton' } as RepTeamEvent];

describe('buildPlayerNotesTimeline', () => {
  it('merges the four sources newest-first, later creation first within a day, key as the final tiebreak', () => {
    const rows = buildPlayerNotesTimeline({
      notes: [note('n1', '2026-09-09', 'Asked to try second base.')],
      moments: [moment('m1', '2026-09-06T19:40:00Z', 'Turned two from the 4-6-3.')],
      observations: [observation('o1', '2026-09-06')],
      reviews: [review('r1', '2026-09-02')],
      goals, types, events, playerBase, teamBase,
    });
    assert.deepEqual(rows.map(r => r.key), ['note:n1', 'moment:m1', 'observation:o1', 'review:r1']);
    // Same day: the moment (19:40) outranks the observation (09:00).
    assert.equal(rows[1].on, '2026-09-06');
    assert.equal(rows[2].on, '2026-09-06');
  });

  it('names what each entry is about, in the coach\'s words, and where the chip opens', () => {
    const rows = buildPlayerNotesTimeline({
      notes: [note('n1', '2026-09-09', 'x', { goalId: 'G1' }), note('n2', '2026-09-08', 'y', { eventId: 'E1' }), note('n3', '2026-09-07', 'z')],
      moments: [moment('m1', '2026-09-06T19:40:00Z', 'm')],
      observations: [observation('o1', '2026-09-05')],
      reviews: [review('r1', '2026-09-04')],
      goals, types, events, playerBase, teamBase,
    });
    const by = Object.fromEntries(rows.map(r => [r.key, r]));
    assert.equal(by['note:n1'].about, 'Note · First-step quickness');
    assert.equal(by['note:n1'].aboutHref, `${playerBase}?tab=skills&section=development&view=goals`);
    assert.equal(by['note:n2'].about, 'Note · vs Milton');
    assert.equal(by['note:n2'].aboutHref, `${teamBase}/schedule`);
    assert.equal(by['note:n3'].about, 'Note');
    assert.equal(by['note:n3'].aboutHref, null);
    assert.equal(by['moment:m1'].about, 'Game · vs Milton');
    assert.equal(by['observation:o1'].about, 'Skill · Sets feet before throwing');
    assert.equal(by['observation:o1'].qualifier, 'With a reminder');
    assert.equal(by['review:r1'].about, 'Goal · First-step quickness');
    assert.equal(by['review:r1'].qualifier, 'Working on it');
  });

  it('only a general note is editable here — every other entry is edited at its source', () => {
    const rows = buildPlayerNotesTimeline({
      notes: [note('n1', '2026-09-09', 'x')], moments: [moment('m1', '2026-09-06T19:40:00Z', 'm')],
      observations: [observation('o1', '2026-09-05')], reviews: [review('r1', '2026-09-04')],
      goals, types, events, playerBase, teamBase,
    });
    assert.deepEqual(rows.map(r => [r.source, r.editable]), [['note', true], ['moment', false], ['observation', false], ['review', false]]);
  });

  it('a deleted goal or an unknown skill reads as absent, never as a crash', () => {
    const rows = buildPlayerNotesTimeline({
      notes: [], moments: [], observations: [observation('o1', '2026-09-05', { measurableTypeId: 'gone' })],
      reviews: [{ ...review('r1', '2026-09-04'), goalId: 'gone' }], goals, types, events, playerBase, teamBase,
    });
    assert.equal(rows[0].about, 'Skill · observed skill');
    assert.equal(rows[1].about, 'Goal · a goal no longer on record');
  });

  it('an observation with only a descriptor reads the descriptor as the qualifier and an empty body', () => {
    const rows = buildPlayerNotesTimeline({
      notes: [], moments: [], observations: [observation('o1', '2026-09-05', { note: null })], reviews: [],
      goals, types, events, playerBase, teamBase,
    });
    assert.equal(rows[0].body, '');
    assert.equal(rows[0].qualifier, 'With a reminder');
  });

  it('dates a bench moment by the org calendar day, not the UTC day (a 9:00 p.m. game is tomorrow in UTC)', () => {
    // 01:30Z on the 7th is 9:30 p.m. Eastern on the 6th — the moment belongs to the game night.
    const rows = buildPlayerNotesTimeline({
      notes: [note('n1', '2026-09-06', 'Same night, from the record.')],
      moments: [moment('m1', '2026-09-07T01:30:00Z', 'Late-inning composure.')],
      observations: [], reviews: [], goals, types, events, playerBase, teamBase,
    });
    assert.equal(rows.find(r => r.source === 'moment')?.on, '2026-09-06');
    assert.deepEqual(rows.map(r => r.on), ['2026-09-06', '2026-09-06']);
  });
});

describe('groupPlayerNotesByMonth', () => {
  it('groups a sorted timeline by calendar month, newest month first, in the reader\'s words', () => {
    const rows = buildPlayerNotesTimeline({
      notes: [note('n1', '2026-09-09', 'a'), note('n2', '2026-08-30', 'b'), note('n3', '2026-08-12', 'c')],
      moments: [], observations: [], reviews: [], goals, types, events, playerBase, teamBase,
    });
    const months = groupPlayerNotesByMonth(rows);
    assert.deepEqual(months.map(m => [m.label, m.entries.length]), [['September 2026', 1], ['August 2026', 2]]);
  });
  it('an empty timeline is no months, not one empty month', () => {
    assert.deepEqual(groupPlayerNotesByMonth([]), []);
  });
});
