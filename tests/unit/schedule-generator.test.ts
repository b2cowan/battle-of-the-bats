import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  defaultSchedulePriorities,
  generateScoredSchedule,
  type ScheduleDraftMatchup,
  type ScheduleDraftParticipant,
  type ScheduleDraftSlot,
} from '../../lib/schedule-generator.ts';

const participants: ScheduleDraftParticipant[] = ['a', 'b', 'c', 'd'].map(id => ({
  id,
  label: id.toUpperCase(),
  divisionId: 'd1',
  status: 'accepted',
}));

function matchup(home: string, away: string): ScheduleDraftMatchup {
  return {
    homeParticipantId: home,
    awayParticipantId: away,
    homeLabel: home.toUpperCase(),
    awayLabel: away.toUpperCase(),
    homeMetric: { teamId: home },
    awayMetric: { teamId: away },
    payload: {},
  };
}

function slot(date: string, time: string, venueId = 'v1'): ScheduleDraftSlot {
  return { date, time, venueId, venueName: venueId };
}

function temporarySlot(date: string, time: string, laneNumber: number): ScheduleDraftSlot {
  return {
    date,
    time,
    venueId: null,
    venueName: `Facility ${laneNumber}`,
    venueFacilityId: null,
    scheduleFacilityLaneId: `draft-facility-${laneNumber}`,
    scheduleFacilityLaneLabel: `Facility ${laneNumber}`,
  };
}

describe('generateScoredSchedule', () => {
  it('selects a draft that respects one game per participant per day when possible', () => {
    const draft = generateScoredSchedule({
      tournamentId: 't1',
      divisionId: 'd1',
      participants,
      matchups: [
        matchup('a', 'b'),
        matchup('c', 'd'),
        matchup('a', 'c'),
        matchup('b', 'd'),
      ],
      slots: [
        slot('2026-07-01', '09:00'),
        slot('2026-07-01', '11:00'),
        slot('2026-07-01', '13:00'),
        slot('2026-07-02', '09:00'),
        slot('2026-07-02', '11:00'),
        slot('2026-07-02', '13:00'),
      ],
      expectedGamesPerParticipant: 2,
      gameDurationMinutes: 90,
      bufferMinutes: 15,
      priorities: {
        ...defaultSchedulePriorities(),
        maxGamesPerDay: 1,
        candidateCount: 16,
      },
    });

    assert(draft);
    assert.equal(draft.assignments.length, 4);
    assert.equal(draft.metrics.maxGamesInDay, 1);
  });

  it('hard-blocks overlapping games for the same participant', () => {
    const draft = generateScoredSchedule({
      tournamentId: 't1',
      divisionId: 'd1',
      participants,
      matchups: [
        matchup('a', 'b'),
        matchup('a', 'c'),
      ],
      slots: [
        slot('2026-07-01', '09:00', 'v1'),
        slot('2026-07-01', '09:15', 'v2'),
        slot('2026-07-01', '11:00', 'v1'),
      ],
      expectedGamesPerParticipant: 1,
      gameDurationMinutes: 90,
      bufferMinutes: 15,
      priorities: defaultSchedulePriorities(),
    });

    assert(draft);
    const aGames = draft.assignments.filter(assignment =>
      assignment.homeParticipantId === 'a' || assignment.awayParticipantId === 'a'
    );

    assert.equal(aGames.length, 2);
    assert.notEqual(aGames[0].time, '09:15');
    assert.notEqual(aGames[0].time, aGames[1].time);
  });

  it('can draft schedules against temporary facility lanes', () => {
    const draft = generateScoredSchedule({
      tournamentId: 't1',
      divisionId: 'd1',
      participants,
      matchups: [
        matchup('a', 'b'),
        matchup('c', 'd'),
      ],
      slots: [
        temporarySlot('2026-07-01', '09:00', 1),
        temporarySlot('2026-07-01', '09:00', 2),
        temporarySlot('2026-07-01', '11:00', 1),
      ],
      expectedGamesPerParticipant: 1,
      gameDurationMinutes: 90,
      bufferMinutes: 15,
      priorities: defaultSchedulePriorities(),
    });

    assert(draft);
    assert.equal(draft.assignments.length, 2);
    assert(draft.assignments.every(assignment => assignment.scheduleFacilityLaneId));
    assert.equal(draft.metrics.unresolvedFacilityLaneCount, 2);
  });
});
