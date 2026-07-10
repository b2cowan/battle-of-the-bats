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

  it('flags organizer-entered travel buffer warnings on tight venue moves', () => {
    const metrics = buildScheduleMetrics({
      teams: [team('a', 'A'), team('b', 'B'), team('c', 'C')],
      games: [
        game('g1', 'a', 'b', '2026-07-01', '09:00', 'v1'),
        game('g2', 'a', 'c', '2026-07-01', '11:00', 'v2'),
      ],
      divisionId: 'd1',
      gameDurationMinutes: 90,
      bufferMinutes: 15,
      manualTravelBuffers: {
        venueChangeMinutes: 45,
      },
    });

    const teamA = metrics.teamMetrics.find(metric => metric.label === 'A');
    assert.equal(teamA?.travelBufferWarnings, 1);
    assert.equal(metrics.travelBufferWarningCount, 1);
    assert(metrics.issues.some(issue => issue.code === 'manual_travel_buffer'));
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

  it('keeps slot-keyed rows for a non-playoff (e.g. slot-mode Generator preview) call', () => {
    // A slot-mode round-robin draft has NO real teams yet — homeSlotId/awaySlotId + a
    // placeholder label are the only identity. The playoffs-only slot:/placeholder: exclusion
    // must not empty this out (it previously did, zeroing the whole team table + health score).
    const slotGame: ScheduleMetricGame = {
      ...game('g1', '', '', '2026-07-01', '09:00'),
      homeTeamId: null,
      awayTeamId: null,
      homeSlotId: 'slot-a',
      awaySlotId: 'slot-b',
      homePlaceholder: 'Division Team 1',
      awayPlaceholder: 'Division Team 2',
    };

    const metrics = buildScheduleMetrics({
      teams: [],
      games: [slotGame],
      divisionId: 'd1',
    });

    assert.equal(metrics.teamMetrics.length, 2);
    assert.equal(metrics.healthScore > 0, true); // not silently zeroed by an empty team list
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

  it('resolves a playoff "Seed #N" slot against current round-robin standings', () => {
    const roundRobinGames: ScheduleMetricGame[] = [
      { ...game('rr1', 'a', 'b', '2026-07-01', '09:00'), status: 'completed', homeScore: 10, awayScore: 0 },
      { ...game('rr2', 'a', 'd', '2026-07-01', '11:00'), status: 'completed', homeScore: 10, awayScore: 0 },
      { ...game('rr3', 'b', 'd', '2026-07-01', '13:00'), status: 'completed', homeScore: 10, awayScore: 0 },
    ];
    const playoffGame: ScheduleMetricGame = {
      ...game('p1', '', '', '2026-07-02', '09:00'),
      homeTeamId: null,
      awayTeamId: null,
      homePlaceholder: 'Seed #1',
      awayPlaceholder: 'Seed #3',
      isPlayoff: true,
    };

    const metrics = buildScheduleMetrics({
      teams: [team('a', 'A'), team('b', 'B'), team('d', 'D')],
      games: [playoffGame],
      standingsGames: roundRobinGames,
      divisionId: 'd1',
      includePlayoffs: true,
    });

    const seed1 = metrics.teamMetrics.find(m => m.label === 'A');
    const seed3 = metrics.teamMetrics.find(m => m.label === 'D');
    assert.equal(seed1?.seedBasis, 'currentStandings');
    assert.equal(seed3?.seedBasis, 'currentStandings');
    assert.equal(seed1?.gameCount, 1);
  });

  it('does not resolve a seed still pending an admin coin toss', () => {
    // b and c are perfectly tied (identical W/L/RF/RA, and their only meeting was a draw),
    // with 'coin' as the deciding breaker and no recorded result — an unresolved tie.
    // d has a clearly worse record, so its own rank is unambiguous.
    const roundRobinGames: ScheduleMetricGame[] = [
      { ...game('rr1', 'b', 'c', '2026-07-01', '09:00'), status: 'completed', homeScore: 5, awayScore: 5 },
      { ...game('rr2', 'd', 'b', '2026-07-01', '11:00'), status: 'completed', homeScore: 0, awayScore: 10 },
      { ...game('rr3', 'd', 'c', '2026-07-01', '13:00'), status: 'completed', homeScore: 0, awayScore: 10 },
    ];
    const playoffGame: ScheduleMetricGame = {
      ...game('p1', '', '', '2026-07-02', '09:00'),
      homeTeamId: null,
      awayTeamId: null,
      homePlaceholder: 'Seed #1', // ambiguous — b or c, pending a coin toss
      awayPlaceholder: 'Seed #3', // unambiguous — d
      isPlayoff: true,
    };

    const metrics = buildScheduleMetrics({
      teams: [team('b', 'B'), team('c', 'C'), team('d', 'D')],
      games: [playoffGame],
      standingsGames: roundRobinGames,
      divisions: [{
        id: 'd1', name: 'Division', tournamentId: 't1',
        playoffConfig: { type: 'single', crossover: 'reseed', hasThirdPlace: false, teamsQualifying: 3, tieBreakers: ['coin'] },
      } as unknown as import('../../lib/types.ts').Division],
      divisionId: 'd1',
      includePlayoffs: true,
    });

    const resolvedViaStandings = metrics.teamMetrics.filter(m => m.seedBasis === 'currentStandings');
    assert.equal(resolvedViaStandings.length, 1);
    assert.equal(resolvedViaStandings[0]?.label, 'D');
  });

  describe('Phase 2B — "if this seed keeps winning" projection', () => {
    // A standard 4-seed single-elim bracket: QF1 (Seed #1 vs Seed #8), QF2 (Seed #4 vs Seed #5),
    // SF1 (Winner QF1 vs Winner QF2), FIN (Winner SF1 vs Winner SF2). QF1 ends 10:30 (90min);
    // SF1 at 10:40 is a deliberate 10min (tight) turnaround to exercise back-to-back.
    function bracketGames(qf1Overrides: Partial<ScheduleMetricGame> = {}): ScheduleMetricGame[] {
      const qf1: ScheduleMetricGame = {
        ...game('qf1', '', '', '2026-07-01', '09:00'),
        homeTeamId: null, awayTeamId: null,
        homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #8',
        isPlayoff: true, bracketCode: 'QF1',
        ...qf1Overrides,
      };
      const qf2: ScheduleMetricGame = {
        ...game('qf2', '', '', '2026-07-01', '09:00'),
        homeTeamId: null, awayTeamId: null,
        homePlaceholder: 'Seed #4', awayPlaceholder: 'Seed #5',
        isPlayoff: true, bracketCode: 'QF2',
      };
      const sf1: ScheduleMetricGame = {
        ...game('sf1', '', '', '2026-07-01', '10:40'),
        homeTeamId: null, awayTeamId: null,
        homePlaceholder: 'Winner QF1', awayPlaceholder: 'Winner QF2',
        isPlayoff: true, bracketCode: 'SF1',
      };
      const fin: ScheduleMetricGame = {
        ...game('fin', '', '', '2026-07-02', '09:00'),
        homeTeamId: null, awayTeamId: null,
        homePlaceholder: 'Winner SF1', awayPlaceholder: 'Winner SF2',
        isPlayoff: true, bracketCode: 'FIN',
      };
      return [qf1, qf2, sf1, fin];
    }

    it('projects a still-anonymous seed through undetermined future rounds, labeled "Seed #N"', () => {
      const metrics = buildScheduleMetrics({
        teams: [], // no roster at all — nothing could resolve "Seed #1" to a real team
        games: bracketGames(),
        divisionId: 'd1',
        includePlayoffs: true,
        gameDurationMinutes: 90,
        bufferMinutes: 15,
      });

      const seed1 = metrics.teamMetrics.find(m => m.label === 'Seed #1');
      assert.ok(seed1, 'Seed #1 should appear as its own row even with no team resolved');
      assert.equal(seed1?.seedBasis, undefined);
      assert.equal(seed1?.projectedGameCount, 2); // SF1 + FIN, both still fully undetermined
      assert.equal(seed1?.gameCount, 3); // QF1 (real) + SF1 + FIN (projected)
      assert.equal(seed1?.backToBackCount, 1); // the projected SF1 lands back-to-back with the real QF1
    });

    it('shows the real team name once a manual seed resolves it, same projected math', () => {
      const teams = [team('a', 'A'), team('b', 'B')];
      teams[0].seed = 1;

      const metrics = buildScheduleMetrics({
        teams,
        games: bracketGames(),
        divisionId: 'd1',
        includePlayoffs: true,
      });

      const teamA = metrics.teamMetrics.find(m => m.label === 'A');
      assert.equal(teamA?.seedBasis, 'manualSeed');
      assert.equal(teamA?.projectedGameCount, 2);
      assert.equal(teamA?.gameCount, 3);
    });

    it('does not trust a standings-based resolution before any round-robin game is decided', () => {
      // Every team tied at 0-0-0 — the tie-breaker chain still returns SOME order, but it's
      // arbitrary, not a real signal. This is the exact bug an owner caught live: teams showing
      // resolved names before a single round-robin game had been played.
      const unplayedRoundRobin: ScheduleMetricGame[] = [
        game('rr1', 'a', 'b', '2026-07-01', '09:00'),
        game('rr2', 'c', 'd', '2026-07-01', '11:00'),
      ];

      const metrics = buildScheduleMetrics({
        teams: [team('a', 'A'), team('b', 'B'), team('c', 'C'), team('d', 'D')],
        games: bracketGames(),
        standingsGames: unplayedRoundRobin,
        divisionId: 'd1',
        includePlayoffs: true,
      });

      const seed1 = metrics.teamMetrics.find(m => m.label === 'Seed #1');
      assert.ok(seed1, 'should stay labeled "Seed #1" — no result exists yet to trust');
      assert.equal(metrics.teamMetrics.some(m => m.seedBasis === 'currentStandings'), false);
    });

    it('stops projecting a seed once they are structurally eliminated (no team identity needed)', () => {
      // QF1 decided: home (Seed #1) loses 2-10 to away (Seed #8) — purely by score, no
      // team roster or seed resolution involved at all.
      const games = bracketGames({ status: 'completed', homeScore: 2, awayScore: 10 });

      const metrics = buildScheduleMetrics({
        teams: [],
        games,
        divisionId: 'd1',
        includePlayoffs: true,
      });

      const seed1 = metrics.teamMetrics.find(m => m.label === 'Seed #1');
      const seed8 = metrics.teamMetrics.find(m => m.label === 'Seed #8');
      assert.equal(seed1?.gameCount, 1); // just their real QF1 loss — eliminated, nothing further
      assert.equal(seed1?.projectedGameCount, 0);
      assert.equal(seed8?.gameCount, 3); // QF1 (real, won) + SF1 (confirmed) + FIN (projected)
      assert.equal(seed8?.projectedGameCount, 1); // only FIN is still hypothetical
    });

    it('does not project across a double-elimination (multi-section) bracket', () => {
      const wb11: ScheduleMetricGame = {
        ...game('wb11', '', '', '2026-07-01', '09:00'),
        homeTeamId: null, awayTeamId: null,
        homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #4',
        isPlayoff: true,
        bracketCode: 'WB1-1',
      };
      const gf: ScheduleMetricGame = {
        ...game('gf', '', '', '2026-07-02', '09:00'),
        homeTeamId: null,
        awayTeamId: null,
        homePlaceholder: 'Winner WB1-1',
        awayPlaceholder: 'Winner LB1-1',
        isPlayoff: true,
        bracketCode: 'GF',
      };

      const metrics = buildScheduleMetrics({
        teams: [],
        games: [wb11, gf],
        divisionId: 'd1',
        includePlayoffs: true,
      });

      // Double-elim is out of scope for the seed-walk redesign — an anonymous seed here gets
      // NO row at all (matches pre-Phase-2B behavior), not a "Seed #1" row.
      assert.equal(metrics.teamMetrics.some(m => m.label === 'Seed #1'), false);
    });

    it('does not double-count a downstream game that has already really resolved', () => {
      const qf1: ScheduleMetricGame = {
        ...game('qf1', 'a', 'b', '2026-07-01', '09:00'),
        homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #8',
        status: 'completed', homeScore: 10, awayScore: 0,
        isPlayoff: true,
        bracketCode: 'QF1',
      };
      // Advancement already ran: SF1's home slot is really Team A now (homeTeamId set),
      // but the placeholder text is never cleared (matches lib/db.ts advancePlayoffs behavior).
      const sf1: ScheduleMetricGame = {
        ...game('sf1', 'a', '', '2026-07-01', '11:00'),
        awayTeamId: null,
        homePlaceholder: 'Winner QF1',
        awayPlaceholder: 'Winner QF2',
        isPlayoff: true,
        bracketCode: 'SF1',
      };

      const metrics = buildScheduleMetrics({
        teams: [team('a', 'A'), team('b', 'B')],
        games: [qf1, sf1],
        divisionId: 'd1',
        includePlayoffs: true,
      });

      const teamA = metrics.teamMetrics.find(m => m.label === 'A');
      assert.equal(teamA?.gameCount, 2); // QF1 + SF1, each counted exactly once
      assert.equal(teamA?.projectedGameCount, 0); // SF1 already really happened — not a projection
    });

    it('sorts "Seed #N" rows by seed number, not alphabetically (10 after 9, not after 1)', () => {
      const entryGames: ScheduleMetricGame[] = [
        { ...game('g1', '', '', '2026-07-01', '09:00'), homeTeamId: null, awayTeamId: null, homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #12', isPlayoff: true, bracketCode: 'G1' },
        { ...game('g2', '', '', '2026-07-01', '09:00'), homeTeamId: null, awayTeamId: null, homePlaceholder: 'Seed #2', awayPlaceholder: 'Seed #11', isPlayoff: true, bracketCode: 'G2' },
        { ...game('g3', '', '', '2026-07-01', '09:00'), homeTeamId: null, awayTeamId: null, homePlaceholder: 'Seed #9', awayPlaceholder: 'Seed #10', isPlayoff: true, bracketCode: 'G3' },
      ];

      const metrics = buildScheduleMetrics({
        teams: [],
        games: entryGames,
        divisionId: 'd1',
        includePlayoffs: true,
      });

      assert.deepEqual(
        metrics.teamMetrics.map(m => m.label),
        ['Seed #1', 'Seed #2', 'Seed #9', 'Seed #10', 'Seed #11', 'Seed #12'],
      );
    });
  });
});
