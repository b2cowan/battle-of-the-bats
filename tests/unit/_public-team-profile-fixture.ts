import type { TeamProfile } from '../../lib/public-team-profile.ts';
import { zonedWallClockToUtc } from '../../lib/timezone.ts';
import type { Division, Game, PublicTeam, Tournament } from '../../lib/types.ts';
import type { DivisionStandingRow } from '../../lib/tie-breakers.ts';

export const now = new Date(zonedWallClockToUtc('2026-10-30', '14:15')!);
export function profileFixture() {
  const division = { id: 'd', name: 'U11', scheduleVisibility: 'published', pools: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] } as Division;
  const teams = ['Riverdale Rapids', 'Cedar Hollow Cyclones', 'Maple Ridge Marauders'].map((name, i) => ({
    id: ['me', 'other', 'third'][i], name, tournamentId: 't', divisionId: 'd', status: 'accepted', coach: '', poolId: 'a', seed: null,
  })) as PublicTeam[];
  const game = (patch: Partial<Game>): TeamProfile['games'][number] => ({ id: '', tournamentId: 't', divisionId: 'd', homeTeamId: 'me', awayTeamId: 'other',
    homeTeamName: teams[0].name, awayTeamName: teams[1].name, date: '2026-10-30', time: '14:00', status: 'scheduled', location: 'Park — Diamond 2',
    venueId: 'v', venueFacilityId: 'f', ...patch });
  const games = [game({ id: 'older', date: '2026-10-28', status: 'completed', homeScore: 6, awayScore: 2 }),
    game({ id: 'recent', date: '2026-10-29', status: 'completed', homeScore: 4, awayScore: 2 }),
    game({ id: 'final', isPlayoff: true, bracketCode: 'FIN' })];
  const profile: TeamProfile = { team: teams[0], divisionName: 'U11', gameDurationMinutes: 90, tournamentName: 'Classic',
    teamNames: Object.fromEntries(teams.map(t => [t.id, t.name])), games,
    standings: { w: 2, l: 0, t: 0, pts: 4, rf: 10, ra: 4, rd: 6, isRunnerUp: false } };
  const rows = teams.map((t, i) => ({ teamId: t.id, teamName: t.name, poolId: 'a', w: 2-i, l:i, t:0, gp: 2 })) as DivisionStandingRow[];
  return { profile, options: { division, divisions: [division], teams, games, rows,
    tournament: { id: 't', settings: {} } as Tournament, standingsShown: true, requireFinalization: true, now } };
}
