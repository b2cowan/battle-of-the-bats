/** Public team-page contract and presentation. The preview metadata contains no roster or standings table. */
import type { Division, Game, PublicTeam, Tournament } from './types';
import type { DivisionStandingRow } from './tie-breakers';
import { gameDayWord, gameTimeWord, publicFrameGame, teamMoment, teamPlace, unfilledPlayoffGame } from './public-teams';
import { publishedGameTeams, standingsAdvancing } from './public-standings';
import { nextPlayoffGame } from './public-playoffs';
import { getPlayoffStakes, publicGameRound } from './public-game-detail';
import { fanPlaceholder, gameRowView, gameSideNames, liveCardView } from './public-game-row';
import { DEFAULT_GAME_DURATION_MINUTES, LIVE_GRACE_MINUTES, gameStartMs, publicGameState, selectTeamGames, teamScoreFor } from './game-status';
import { formatStoredDate, tournamentToday } from './timezone';
import { formatPoolName } from './utils';

export interface TeamProfile {
  team: PublicTeam;
  divisionName: string;
  gameDurationMinutes: number;
  tournamentName: string;
  /** The record and the runner-up fact; `teamProfilePreview` adds the pool name and "in a playoff spot" (its own rules). */
  standings: { w: number; l: number; t: number; pts: number; rf: number; ra: number; rd: number; isRunnerUp: boolean };
  games: (Omit<Game, 'notes'> & { homeTeamName: string; awayTeamName: string })[];
  teamNames: Record<string, string>;
}

export function teamProfilePreview(profile: TeamProfile, { division, divisions, teams, games, rows,
  tournament, standingsShown, requireFinalization, now, crownStamp = null, defaultDuration = DEFAULT_GAME_DURATION_MINUTES }: {
  division: Division; divisions: Division[]; teams: PublicTeam[]; games: Game[]; rows: DivisionStandingRow[];
  tournament: Tournament;
  standingsShown: boolean; requireFinalization: boolean; now: Date;
  crownStamp?: string | null;
  defaultDuration?: number;
}) {
  const published = new Set(divisions.filter(d => d.scheduleVisibility === 'published').map(d => d.id));
  const publicTeams = teams.filter(t => t.status === 'accepted' && published.has(t.divisionId));
  const allowedNames = new Map(publicTeams.map(t => [t.id, t.name]));
  const allowedIds = new Set(allowedNames.keys());
  const shownGames = profile.games.map(game => ({ ...publicFrameGame(publishedGameTeams(game, allowedIds)),
    homeTeamName: allowedNames.get(game.homeTeamId) ?? fanPlaceholder(game.homePlaceholder),
    awayTeamName: allowedNames.get(game.awayTeamId) ?? fanPlaceholder(game.awayPlaceholder),
  }));
  const crown = standingsShown ? nextPlayoffGame({ games, teams: publicTeams, divisions,
    divisionId: division.id, requireFinalization, now }) : null;
  const relevant = new Set([division.id, ...shownGames.map(g => g.divisionId)]);
  const poolName = (division.pools?.length ?? 0) > 1 ? division.pools?.find(p => p.id === profile.team.poolId)?.name ?? null : null;
  return { ...profile, games: shownGames, poolName,
    standings: { ...profile.standings,
      inPlayoffSpot: standingsShown && standingsAdvancing(tournament, division, rows).has(profile.team.id) },
    teamNames: Object.fromEntries(Object.entries(profile.teamNames).filter(([id]) => allowedNames.has(id))),
    preview: {
      standingsShown,
      crownStamp,
      requireFinalization,
      place: standingsShown ? teamPlace(profile.team, division, rows) : null,
      champion: crown?.kind === 'champion' && crown.teamId === profile.team.id,
      runnerUp: crown?.kind === 'champion' && profile.standings.isRunnerUp,
      playoffPending: unfilledPlayoffGame(games, division.id),
      divisions: divisions.filter(d => relevant.has(d.id) && published.has(d.id)).map(d => ({
        id: d.id, name: d.name, scheduleVisibility: 'published' as const,
        settings: { game_duration_minutes: d.settings?.game_duration_minutes ?? defaultDuration },
      })),
      stakes: Object.fromEntries(shownGames.flatMap(game => {
        const stakes = getPlayoffStakes(game as Game, games);
        return stakes ? [[game.id, stakes]] : [];
      })) as Record<string, { text: string; gold: boolean }>,
    },
  };
}
export type PreviewTeamProfile = ReturnType<typeof teamProfilePreview>;

function profileGames(profile: PreviewTeamProfile) {
  return profile.games.map(game => ({ ...game, durationMinutes: game.durationMinutes ??
    profile.preview.divisions.find(d => d.id === game.divisionId)?.settings?.game_duration_minutes ?? profile.gameDurationMinutes }));
}

/** The local clock changes at kickoff/end independently of the 30-second network poll, including offline. */
export function teamProfileNextChange(profile: PreviewTeamProfile, now: Date): number | null {
  const boundaries = profileGames(profile).flatMap(game => {
    if (['completed', 'forfeit', 'cancelled'].includes(game.status)) return [];
    const start = gameStartMs(game);
    return start === null ? [] : [start, start + (game.durationMinutes + LIVE_GRACE_MINUTES) * 60_000];
  }).filter(time => time > now.getTime());
  return boundaries.length ? Math.min(...boundaries) : null;
}

/** Both the list and page select the same game; the profile supplies only public names already needed by its games. */
export function teamProfileView(profile: PreviewTeamProfile, now: Date) {
  const { preview } = profile;
  const divisions = preview.divisions as Division[];
  const teams = Object.entries(profile.teamNames).map(([id, name]) => ({
    id, name, divisionId: profile.team.divisionId, status: 'accepted', coach: '', tournamentId: profile.team.tournamentId,
  })) as PublicTeam[];
  const games = profileGames(profile);
  const moment = teamMoment({ teamId: profile.team.id, teams, games, divisions, tournament: null,
    requireFinalization: preview.requireFinalization, champion: preview.champion, playoffPending: preview.playoffPending, now });
  const focus = moment.kind === 'live' || moment.kind === 'upcoming' ? moment.game : null;
  const today = tournamentToday(now);
  const round = (game: Game) => game.isPlayoff ? `Playoff · ${publicGameRound(game)}` : 'Pool';
  // The same two faces as the Schedule (a live card, a game row), with the team being read listed first. Directions
  // live on the game's own page; the day leads the time because this page has no day headings.
  function card(game: Game, live = false) {
    const names = gameSideNames(game, id => profile.teamNames[id] ?? 'TBD', fanPlaceholder);
    const own = game.homeTeamId === profile.team.id;
    const view = liveCardView(live ? game : { ...game, homeScore: null, awayScore: null }, names, round(game), null, null);
    if (!live) view.noScore = null;
    if (own) view.sides.reverse();
    const time = [gameDayWord(game.date, today), gameTimeWord(game.time)].filter(Boolean).join(' · ');
    const pool = game.isPlayoff || !profile.poolName ? null : formatPoolName(profile.poolName);
    const row = { ...gameRowView(game, own ? { away: names.home, home: names.away } : names, profile.divisionName, today,
      { state: 'upcoming', round: game.isPlayoff ? publicGameRound(game) : null, poolTag: pool, schedule: true }), head: time };
    return { game, view, row, time, division: profile.divisionName, pool, round: game.isPlayoff ? publicGameRound(game) : null,
      stakes: preview.stakes[game.id] ?? null };
  }
  const upcoming = games.filter(game => game.id !== focus?.id && publicGameState(game, preview.requireFinalization, now) === 'upcoming'
    && selectTeamGames([game], profile.team.id, today, now).next?.id === game.id)
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));
  const results = games.filter(game => ['final', 'unofficial'].includes(publicGameState(game, preview.requireFinalization, now)))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || '')).map(game => {
      const names = gameSideNames(game, id => profile.teamNames[id] ?? 'TBD', fanPlaceholder);
      const scores = teamScoreFor(game, profile.team.id);
      const scored = scores.my != null && scores.opp != null;
      const result = scored ? scores.my! > scores.opp! ? 'W' : scores.my! < scores.opp! ? 'L' : 'T' : null;
      return { id: game.id, date: formatStoredDate(game.date, { withYear: false }), round: round(game),
        opponent: game.homeTeamId === profile.team.id ? names.away : names.home,
        score: scored ? `${result} ${scores.my}–${scores.opp}` : 'No score yet',
        unofficial: publicGameState(game, preview.requireFinalization, now) === 'unofficial' };
    });
  return { moment, focus: focus ? card(focus, moment.kind === 'live') : null, next: upcoming.map(game => card(game)), results,
    chip: preview.champion ? 'Division Champion' : preview.runnerUp ? 'Runner-up'
      : focus && preview.place && profile.standings.inPlayoffSpot ? 'In playoff spot' : null,
    noMoreGames: moment.kind === 'none' && results.length > 0 && !preview.runnerUp,
    standingsLabel: `${profile.divisionName} standings${profile.poolName ? ` · ${formatPoolName(profile.poolName)}` : ''}` };
}
