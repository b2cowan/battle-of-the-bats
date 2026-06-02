import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildScheduleMetrics } from '../../lib/schedule-metrics.ts';
import type { ScheduleMetricGame } from '../../lib/schedule-metrics.ts';
import type { Team } from '../../lib/types.ts';

function team(id: string, name: string): Team {
  return {
    id,
    name,
    tournamentId: 't1',
    divisionId: 'd1',
    coach: '',
    email: '',
    players: [],
    status: 'accepted',
    paymentStatus: 'paid',
    registeredAt: '2026-01-01',
  };
}

function game(id: string, homeTeamId: string, awayTeamId: string, date: string, time: string, venueId = 'v1'): ScheduleMetricGame {
  return {
    id,
    tournamentId: 't1',
    divisionId: 'd1',
    homeTeamId,
    awayTeamId,
    date,
    time,
    venueId,
    location: venueId,
    status: 'scheduled',
  };
}

describe('buildScheduleMetrics', () => {
  it('counts balanced team game totals', () => {
    const metrics = buildScheduleMetrics({
      teams: [team('a', 'A'), team('b', 'B'), team('c', 'C'), team('d', 'D')],
      games: [
        game('g1', 'a', 'b', '2026-07-01', '09:00'),
        game('g2', 'c', 'd', '2026-07-01', '11:00'),
        game('g3', 'a', 'c', '2026-07-02', '09:00'),
        game('g4', 'b', 'd', '2026-07-02', '11:00'),
      ],
      divisionId: 'd1',
      expectedGamesPerParticipant: 2,
      gameDurationMinutes: 90,
      bufferMinutes: 15,
    });

    assert.equal(metrics.participantCount, 4);
    assert.equal(metrics.teamsAtTarget, 4);
    assert.equal(metrics.teamsUnderTarget, 0);
    assert.equal(metrics.minGamesPerParticipant, 2);
    assert.equal(metrics.maxGamesPerParticipant, 2);
  });

  it('detects back-to-back games and minimum rest', () => {
    const metrics = buildScheduleMetrics({
      teams: [team('a', 'A'), team('b', 'B'), team('c', 'C')],
      games: [
        game('g1', 'a', 'b', '2026-07-01', '09:00'),
        game('g2', 'a', 'c', '2026-07-01', '10:45'),
      ],
      divisionId: 'd1',
      gameDurationMinutes: 90,
      bufferMinutes: 15,
    });

    const teamA = metrics.teamMetrics.find(metric => metric.label === 'A');
    assert.equal(teamA?.backToBackCount, 1);
    assert.equal(teamA?.minRestMinutes, 15);
    assert.equal(metrics.backToBackCount, 1);
  });

  it('counts venue changes across consecutive games', () => {
    const metrics = buildScheduleMetrics({
      teams: [team('a', 'A'), team('b', 'B'), team('c', 'C')],
      games: [
        game('g1', 'a', 'b', '2026-07-01', '09:00', 'v1'),
        game('g2', 'a', 'c', '2026-07-01', '12:00', 'v2'),
      ],
      divisionId: 'd1',
      gameDurationMinutes: 90,
      bufferMinutes: 15,
    });

    const teamA = metrics.teamMetrics.find(metric => metric.label === 'A');
    assert.equal(teamA?.venueChanges, 1);
    assert.equal(metrics.venueChangeCount, 1);
  });

  it('ignores cancelled games', () => {
    const cancelled = game('g2', 'a', 'c', '2026-07-01', '12:00');
    cancelled.status = 'cancelled';
    const metrics = buildScheduleMetrics({
      teams: [team('a', 'A'), team('b', 'B'), team('c', 'C')],
      games: [game('g1', 'a', 'b', '2026-07-01', '09:00'), cancelled],
      divisionId: 'd1',
      expectedGamesPerParticipant: 1,
    });

    const teamA = metrics.teamMetrics.find(metric => metric.label === 'A');
    assert.equal(teamA?.gameCount, 1);
    assert.equal(metrics.totalGames, 1);
  });

  it('detects venue overlaps', () => {
    const metrics = buildScheduleMetrics({
      teams: [team('a', 'A'), team('b', 'B'), team('c', 'C'), team('d', 'D')],
      games: [
        game('g1', 'a', 'b', '2026-07-01', '09:00', 'v1'),
        game('g2', 'c', 'd', '2026-07-01', '09:30', 'v1'),
      ],
      divisionId: 'd1',
      gameDurationMinutes: 90,
      bufferMinutes: 15,
    });

    assert.equal(metrics.venueConflictCount, 1);
    assert(metrics.issues.some(issue => issue.code === 'venue_overlap'));
  });

  it('tracks unresolved temporary facility lanes as score-impacting warnings', () => {
    const first = {
      ...game('g1', 'a', 'b', '2026-07-01', '09:00', ''),
      venueId: null,
      location: 'Facility 1',
      scheduleFacilityLaneId: 'lane-1',
      scheduleFacilityLaneLabel: 'Facility 1',
    };
    const second = {
      ...game('g2', 'c', 'd', '2026-07-01', '09:30', ''),
      venueId: null,
      location: 'Facility 1',
      scheduleFacilityLaneId: 'lane-1',
      scheduleFacilityLaneLabel: 'Facility 1',
    };

    const metrics = buildScheduleMetrics({
      teams: [team('a', 'A'), team('b', 'B'), team('c', 'C'), team('d', 'D')],
      games: [first, second],
      divisionId: 'd1',
      gameDurationMinutes: 90,
      bufferMinutes: 15,
    });

    assert.equal(metrics.unresolvedFacilityLaneCount, 2);
    assert.equal(metrics.venueConflictCount, 1);
    assert(metrics.issues.some(issue => issue.code === 'unresolved_facility_lanes'));
  });
});
