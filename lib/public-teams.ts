/** Stage 5 preview only: the shared team moment, place wording and server hand-off. */
import { DEFAULT_GAME_DURATION_MINUTES, selectTeamGames } from './game-status';
import { scheduleGames } from './public-schedule';
import { nextPlayoffGame } from './public-playoffs';
import { decidedFinalFor } from './champions';
import { publishedCompetitionData } from './public-standings';
import { isPublicPageEnabled } from './public-pages';
import { fanPlaceholder, gameSideNames } from './public-game-row';
import { ordinal } from './playoff-bracket';
import { daysBetweenDateStrings, formatShortWeekdayDate, tournamentToday } from './timezone';
import { formatPoolName, formatTime, relativeDayLabel, splitTeamQualifier } from './utils';
import type { Division, Game, PublicTeam, Tournament, Venue, VenueFacility } from './types';
import type { DivisionStandingRow } from './tie-breakers';

export const TEAM_SCHEDULE_WITHHELD = "The schedule isn't published yet";

/** The direct-link exception deliberately contains no coach, seed, pool, games or record. */
export function withheldTeamProfile(team: Pick<PublicTeam, 'id' | 'name' | 'divisionId'>, divisionName: string) {
  return { scheduleWithheld: true as const, team: { id: team.id, name: team.name, divisionId: team.divisionId }, divisionName };
}
export type WithheldTeamProfile = ReturnType<typeof withheldTeamProfile>;

/** The new frame needs game facts, never the scorekeeper's identity or private notes. Legacy feeds retain their DTO. */
export function publicFrameGame<T extends Game>(game: T): T {
  const publicGame = { ...game };
  delete publicGame.notes;
  delete publicGame.scoreSubmittedByEmail;
  delete publicGame.scoreSubmittedByUserId;
  delete publicGame.scoreSubmittedAt;
  delete publicGame.scoreSubmissionSource;
  return publicGame;
}

/** A venue as the public feed sends it: venue and field notes are the organizer's own (owner ruling 2026-11-04, Stage 8
 *  Part 3d — private, like a game's notes); no public page shows them. */
export function publicVenue(venue: Venue): PublicVenue {
  const shown = { ...venue };
  delete shown.notes;
  if (shown.facilities) shown.facilities = shown.facilities.map(f => { const field = { ...f }; delete field.notes; return field; });
  return shown as PublicVenue;
}

/** A venue as the feed sends it. `notes?: never` is what makes the rule compiler-held: a raw {@link Venue} (whose
 *  `notes` is a string) is not assignable here, so a feed branch that forgets {@link publicVenue} fails to build. */
export type PublicVenue = Omit<Venue, 'notes' | 'facilities'> & {
  notes?: never;
  facilities?: (Omit<VenueFacility, 'notes'> & { notes?: never })[];
};

/** Both the initial read and each replacement feed use the same server-only boundary. */
export function publicTeamsData<T extends {
  divisions: Division[]; games: Game[]; teams: PublicTeam[];
  standingsByDivision: Record<string, DivisionStandingRow[]>;
  tournament?: Pick<Tournament, 'publicHiddenPages' | 'settings'> | null;
}>(data: T): T & { teamsWithheld: boolean } {
  const published = publishedCompetitionData(data);
  const standingsShown = isPublicPageEnabled(data.tournament, 'standings') && isPublicPageEnabled(data.tournament, 'schedule');
  return { ...published, standingsByDivision: standingsShown ? published.standingsByDivision : {},
    teamsWithheld: data.divisions.some(d => d.scheduleVisibility !== 'published'), games: published.games.map(publicFrameGame) };
}

export type TeamMoment =
  | { kind: 'live' | 'upcoming'; game: Game; opponent: string }
  | { kind: 'champion'; game: Game }
  | { kind: 'none' | 'empty' | 'pending' };

/** An unfilled, undecided playoff slot is not evidence that this team's tournament is over. */
export function unfilledPlayoffGame(games: Game[], divisionId: string): boolean {
  return games.some(g => g.divisionId === divisionId && g.isPlayoff &&
    !['completed', 'forfeit', 'cancelled'].includes(g.status) &&
    [g.homeTeamId, g.awayTeamId].some(id => !id || id === '00000000-0000-0000-0000-000000000000'));
}

/** Pool and playoff games share the existing selectors; the legacy pages keep their old rules. */
export function teamMoment({ teamId, games, teams, divisions, tournament, requireFinalization, now, champion, playoffPending }: {
  teamId: string; games: Game[]; teams: PublicTeam[]; divisions: Division[];
  tournament: Pick<Tournament, 'settings'> | null; requireFinalization: boolean; now: Date;
  /** The profile feed knows the full division's completion state without shipping its other games. */
  champion?: boolean;
  playoffPending?: boolean;
}): TeamMoment {
  const team = teams.find(t => t.id === teamId);
  const division = divisions.find(d => d.id === team?.divisionId && d.scheduleVisibility === 'published');
  if (!team || team.status !== 'accepted' || !division) return { kind: 'empty' };
  const list = (['pool', 'playoff'] as const).flatMap(stage => scheduleGames({
    games, teams, divisions, division: '', stage, myTeamId: teamId,
  }).games).filter(g => g.status !== 'cancelled').map(g => ({
    ...g, durationMinutes: g.durationMinutes ?? divisions.find(d => d.id === g.divisionId)?.settings?.game_duration_minutes
      ?? tournament?.settings?.game_duration_minutes ?? DEFAULT_GAME_DURATION_MINUTES,
  }));
  const selected = selectTeamGames(list, teamId, tournamentToday(now), now);
  const game = selected.live ?? selected.next;
  if (game) {
    const names = gameSideNames(game, id => teams.find(t => t.id === id)?.name ?? 'TBD', fanPlaceholder);
    return { kind: selected.live ? 'live' : 'upcoming', game,
      opponent: game.homeTeamId === teamId ? names.away : names.home };
  }
  if (champion !== undefined) {
    const final = champion ? decidedFinalFor(list, division.id) : null;
    if (final) return { kind: 'champion', game: final };
    return { kind: list.length ? playoffPending ? 'pending' : 'none' : 'empty' };
  }
  const crown = nextPlayoffGame({ games, teams, divisions, divisionId: division.id, requireFinalization, now });
  if (crown.kind === 'champion' && crown.teamId === teamId) return { kind: 'champion', game: crown.game };
  return { kind: list.length ? unfilledPlayoffGame(games, division.id) ? 'pending' : 'none' : 'empty' };
}

/** No place before this group has played: alphabetical order is not a standing. */
export function teamPlace(team: Pick<PublicTeam, 'id' | 'poolId'>, division: Division, rows: DivisionStandingRow[]) {
  const hasPools = (division.pools?.length ?? 0) > 1;
  const pool = hasPools ? division.pools?.find(p => p.id === team.poolId) : undefined;
  const group = pool ? rows.filter(r => r.poolId === pool.id)
    : hasPools ? rows.filter(r => !division.pools?.some(p => p.id === r.poolId)) : rows;
  const rank = group.findIndex(r => r.teamId === team.id) + 1;
  if (!rank || !group.some(r => r.w + r.l + r.t > 0)) return null;
  const short = ordinal(rank);
  const groupName = pool ? formatPoolName(pool.name) : hasPools ? 'Awaiting assignment' : division.name;
  const full = `${short} of ${group.length}${hasPools ? ` in ${groupName}` : ''}`;
  return { rank, total: group.length, short, full, row: pool ? full : short,
    label: `Place in ${groupName}`, value: `${short} of ${group.length}` };
}

/** The one day and time wording for a team's next game, on Teams and on the team page. Today says nothing. */
export function gameDayWord(date: string, today: string): string {
  const days = daysBetweenDateStrings(today, date);
  return days === 0 ? '' : days === 1 ? relativeDayLabel(date, today) : formatShortWeekdayDate(date);
}
export const gameTimeWord = (time: string | null | undefined): string => time ? formatTime(time) : 'Time TBD';

/** The quiet line on Teams; all day/time words come from the shared date/clock helpers. */
export function teamRowLine(record: Pick<DivisionStandingRow, 'w' | 'l' | 't'> | undefined,
  place: ReturnType<typeof teamPlace>, moment: TeamMoment, now: Date, standingsShown = true): string {
  let next: string;
  if (moment.kind === 'live') next = `Live now vs ${moment.opponent}`;
  else if (moment.kind === 'upcoming') {
    const day = gameDayWord(moment.game.date, tournamentToday(now));
    next = `next ${[day === 'Tomorrow' ? 'tomorrow' : day, gameTimeWord(moment.game.time)].filter(Boolean).join(' ')} vs ${moment.opponent}`;
  } else next = moment.kind === 'empty' ? 'no games scheduled yet' : moment.kind === 'pending' ? 'next game to be confirmed' : 'no more games';
  return [standingsShown ? record ? `${record.w}-${record.l}-${record.t}` : '0-0-0' : null,
    standingsShown ? place?.row : null, next].filter(Boolean).join(' · ');
}

/** List order never depends on a follow or a remembered Schedule selection. Search stays within the chosen division. */
export function teamsGroups({ teams, divisions, standingsByDivision, divisionId = '', query = '' }: {
  teams: PublicTeam[]; divisions: Division[]; standingsByDivision: Record<string, DivisionStandingRow[]>;
  divisionId?: string; query?: string;
}) {
  const search = query.trim().toLowerCase();
  return divisions.filter(d => d.scheduleVisibility === 'published' && (!divisionId || d.id === divisionId)).flatMap(division => {
    const rows = standingsByDivision[division.id] ?? [];
    const ranks = new Map(rows.map((row, index) => [row.teamId, index]));
    const members = teams.filter(t => t.status === 'accepted' && t.divisionId === division.id);
    const pools = division.pools ?? [];
    const grouped = pools.length > 1
      ? [...pools.map(pool => ({ id: pool.id, name: formatPoolName(pool.name), teams: members.filter(t => t.poolId === pool.id) })),
        { id: '', name: 'Awaiting assignment', teams: members.filter(t => !pools.some(pool => pool.id === t.poolId)) }]
      : [{ id: '', name: '', teams: members }];
    const groups = grouped.flatMap(group => {
      const started = group.teams.some(t => rows.some(r => r.teamId === t.id && r.w + r.l + r.t > 0));
      const list = group.teams.filter(t => !search || [t.name, t.coach].some(value => value?.toLowerCase().includes(search)))
        .sort((a, b) => (started ? (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity) : 0)
          || splitTeamQualifier(a.name).base.localeCompare(splitTeamQualifier(b.name).base) || a.id.localeCompare(b.id));
      return list.length ? [{ ...group, teams: list }] : [];
    });
    return groups.length ? [{ division, groups, count: groups.reduce((total, group) => total + group.teams.length, 0) }] : [];
  });
}
