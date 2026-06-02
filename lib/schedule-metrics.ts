import type { Division, Game, Tournament, Venue } from './types';

export type ScheduleIssueSeverity = 'error' | 'warning' | 'info';
export type ScheduleHealthTone = 'good' | 'warning' | 'danger';

export interface ScheduleMetricGame {
  id?: string;
  tournamentId?: string;
  divisionId: string;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeSlotId?: string | null;
  awaySlotId?: string | null;
  homePlaceholder?: string | null;
  awayPlaceholder?: string | null;
  date?: string | null;
  time?: string | null;
  venueId?: string | null;
  venueFacilityId?: string | null;
  scheduleFacilityLaneId?: string | null;
  scheduleFacilityLaneLabel?: string | null;
  location?: string | null;
  status?: string | null;
  isPlayoff?: boolean | null;
}

export interface ScheduleMetricTeam {
  id: string;
  name: string;
  divisionId: string;
  status?: string | null;
}

export interface ScheduleIssue {
  severity: ScheduleIssueSeverity;
  code: string;
  title: string;
  detail: string;
  count: number;
  participantKeys?: string[];
}

export interface TeamScheduleMetrics {
  participantKey: string;
  label: string;
  gameCount: number;
  gamesByDay: Record<string, number>;
  maxGamesInDay: number;
  backToBackCount: number;
  minRestMinutes: number | null;
  venueChanges: number;
  facilityChanges: number;
  earlyGames: number;
  lateGames: number;
}

export interface ScheduleHealthBreakdown {
  gameBalance: number;
  rest: number;
  dayLoad: number;
  movement: number;
  timeSlots: number;
  conflicts: number;
}

export interface ScheduleMetrics {
  totalGames: number;
  participantCount: number;
  expectedGamesPerParticipant?: number;
  teamsAtTarget: number;
  teamsUnderTarget: number;
  teamsOverTarget: number;
  minGamesPerParticipant: number;
  maxGamesPerParticipant: number;
  averageGamesPerParticipant: number;
  backToBackCount: number;
  minRestMinutes: number | null;
  maxGamesInDay: number;
  venueChangeCount: number;
  facilityChangeCount: number;
  earlyGameCount: number;
  lateGameCount: number;
  venueConflictCount: number;
  bufferConflictCount: number;
  unresolvedFacilityLaneCount: number;
  healthScore: number;
  healthTone: ScheduleHealthTone;
  healthBreakdown: ScheduleHealthBreakdown;
  issues: ScheduleIssue[];
  teamMetrics: TeamScheduleMetrics[];
}

export interface BuildScheduleMetricsOptions {
  games: ScheduleMetricGame[];
  teams?: ScheduleMetricTeam[];
  divisions?: Division[];
  venues?: Venue[];
  tournament?: Tournament | null;
  divisionId?: string;
  expectedGamesPerParticipant?: number;
  gameDurationMinutes?: number;
  bufferMinutes?: number;
  maxGamesPerDay?: number;
  includePlayoffs?: boolean;
}

interface Participant {
  key: string;
  label: string;
}

interface ParticipantGame {
  game: ScheduleMetricGame;
  startAbsoluteMinutes: number;
  date: string;
  timeMinutes: number;
  durationMinutes: number;
  venueKey: string | null;
  facilityKey: string | null;
}

const DEFAULT_GAME_DURATION_MINUTES = 90;
const DEFAULT_BUFFER_MINUTES = 15;
const DEFAULT_MAX_GAMES_PER_DAY = 2;
const EARLY_GAME_CUTOFF_MINUTES = 12 * 60;
const LATE_GAME_CUTOFF_MINUTES = 17 * 60;

export function buildScheduleMetrics(options: BuildScheduleMetricsOptions): ScheduleMetrics {
  const {
    teams = [],
    divisions = [],
    tournament = null,
    divisionId,
    expectedGamesPerParticipant,
    maxGamesPerDay = DEFAULT_MAX_GAMES_PER_DAY,
    includePlayoffs = false,
  } = options;

  const scopedGames = options.games.filter(game => {
    if (divisionId && game.divisionId !== divisionId) return false;
    if (!includePlayoffs && game.isPlayoff) return false;
    if (game.status === 'cancelled') return false;
    return true;
  });

  const teamNameById = new Map(teams.map(team => [team.id, team.name]));
  const hasPlaceholderSchedule = scopedGames.some(game =>
    (!game.homeTeamId || !game.awayTeamId) &&
    (game.homeSlotId || game.awaySlotId || game.homePlaceholder || game.awayPlaceholder)
  );

  const participantLabels = new Map<string, string>();
  if (!hasPlaceholderSchedule) {
    teams
      .filter(team => (!divisionId || team.divisionId === divisionId) && (!team.status || team.status === 'accepted'))
      .forEach(team => participantLabels.set(teamParticipantKey(team.id), team.name));
  }

  const participantGames = new Map<string, ParticipantGame[]>();

  for (const game of scopedGames) {
    const home = getParticipant(game, 'home', teamNameById);
    const away = getParticipant(game, 'away', teamNameById);
    if (!home || !away) continue;

    participantLabels.set(home.key, home.label);
    participantLabels.set(away.key, away.label);

    const participantGame = buildParticipantGame(game, options, divisions, tournament);
    appendParticipantGame(participantGames, home.key, participantGame);
    appendParticipantGame(participantGames, away.key, participantGame);
  }

  const allKeys = Array.from(participantLabels.keys()).sort((a, b) =>
    (participantLabels.get(a) ?? a).localeCompare(participantLabels.get(b) ?? b)
  );

  const teamMetrics = allKeys.map(key =>
    buildTeamMetrics(key, participantLabels.get(key) ?? key, participantGames.get(key) ?? [], options.bufferMinutes)
  );

  const conflictSummary = scanVenueConflicts(scopedGames, options, divisions, tournament);
  const aggregate = aggregateMetrics(teamMetrics, expectedGamesPerParticipant, maxGamesPerDay, conflictSummary, scopedGames);
  const issues = buildIssues(teamMetrics, aggregate, expectedGamesPerParticipant, maxGamesPerDay);
  const healthBreakdown = buildHealthBreakdown(teamMetrics, aggregate, expectedGamesPerParticipant, maxGamesPerDay);
  const healthScore = Math.max(0, Math.min(100, Math.round(
    healthBreakdown.gameBalance +
    healthBreakdown.rest +
    healthBreakdown.dayLoad +
    healthBreakdown.movement +
    healthBreakdown.timeSlots +
    healthBreakdown.conflicts
  )));

  return {
    totalGames: scopedGames.length,
    participantCount: teamMetrics.length,
    expectedGamesPerParticipant,
    ...aggregate,
    healthScore,
    healthTone: healthScore >= 85 ? 'good' : healthScore >= 70 ? 'warning' : 'danger',
    healthBreakdown,
    issues,
    teamMetrics,
  };
}

export function formatRestMinutes(minutes: number | null): string {
  if (minutes == null) return 'n/a';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function aggregateMetrics(
  teamMetrics: TeamScheduleMetrics[],
  expectedGamesPerParticipant: number | undefined,
  maxGamesPerDay: number,
  conflictSummary: { venueConflictCount: number; bufferConflictCount: number },
  games: ScheduleMetricGame[],
) {
  const gameCounts = teamMetrics.map(team => team.gameCount);
  const minGamesPerParticipant = gameCounts.length ? Math.min(...gameCounts) : 0;
  const maxGamesPerParticipant = gameCounts.length ? Math.max(...gameCounts) : 0;
  const averageGamesPerParticipant = gameCounts.length
    ? roundToOne(gameCounts.reduce((total, count) => total + count, 0) / gameCounts.length)
    : 0;

  return {
    teamsAtTarget: expectedGamesPerParticipant
      ? teamMetrics.filter(team => team.gameCount === expectedGamesPerParticipant).length
      : 0,
    teamsUnderTarget: expectedGamesPerParticipant
      ? teamMetrics.filter(team => team.gameCount < expectedGamesPerParticipant).length
      : 0,
    teamsOverTarget: expectedGamesPerParticipant
      ? teamMetrics.filter(team => team.gameCount > expectedGamesPerParticipant).length
      : 0,
    minGamesPerParticipant,
    maxGamesPerParticipant,
    averageGamesPerParticipant,
    backToBackCount: teamMetrics.reduce((total, team) => total + team.backToBackCount, 0),
    minRestMinutes: minNullable(teamMetrics.map(team => team.minRestMinutes)),
    maxGamesInDay: teamMetrics.reduce((max, team) => Math.max(max, team.maxGamesInDay), 0),
    venueChangeCount: teamMetrics.reduce((total, team) => total + team.venueChanges, 0),
    facilityChangeCount: teamMetrics.reduce((total, team) => total + team.facilityChanges, 0),
    earlyGameCount: teamMetrics.reduce((total, team) => total + team.earlyGames, 0),
    lateGameCount: teamMetrics.reduce((total, team) => total + team.lateGames, 0),
    venueConflictCount: conflictSummary.venueConflictCount,
    bufferConflictCount: conflictSummary.bufferConflictCount,
    unresolvedFacilityLaneCount: games.filter(hasUnresolvedFacilityLane).length,
    maxGamesPerDay,
  };
}

function buildTeamMetrics(
  participantKey: string,
  label: string,
  games: ParticipantGame[],
  overrideBufferMinutes: number | undefined,
): TeamScheduleMetrics {
  const sortedGames = [...games].sort((a, b) => a.startAbsoluteMinutes - b.startAbsoluteMinutes);
  const gamesByDay: Record<string, number> = {};
  let backToBackCount = 0;
  let minRestMinutes: number | null = null;
  let venueChanges = 0;
  let facilityChanges = 0;
  let earlyGames = 0;
  let lateGames = 0;

  for (const participantGame of sortedGames) {
    gamesByDay[participantGame.date] = (gamesByDay[participantGame.date] ?? 0) + 1;
    if (participantGame.timeMinutes < EARLY_GAME_CUTOFF_MINUTES) earlyGames += 1;
    if (participantGame.timeMinutes >= LATE_GAME_CUTOFF_MINUTES) lateGames += 1;
  }

  for (let i = 1; i < sortedGames.length; i++) {
    const previous = sortedGames[i - 1];
    const current = sortedGames[i];
    const restMinutes = current.startAbsoluteMinutes - (previous.startAbsoluteMinutes + previous.durationMinutes);
    minRestMinutes = minRestMinutes == null ? restMinutes : Math.min(minRestMinutes, restMinutes);
    const backToBackThreshold = overrideBufferMinutes ?? DEFAULT_BUFFER_MINUTES;
    if (restMinutes >= 0 && restMinutes <= backToBackThreshold) backToBackCount += 1;

    if (previous.venueKey && current.venueKey && previous.venueKey !== current.venueKey) venueChanges += 1;
    if (previous.facilityKey && current.facilityKey && previous.facilityKey !== current.facilityKey) facilityChanges += 1;
  }

  return {
    participantKey,
    label,
    gameCount: sortedGames.length,
    gamesByDay,
    maxGamesInDay: Object.values(gamesByDay).reduce((max, count) => Math.max(max, count), 0),
    backToBackCount,
    minRestMinutes,
    venueChanges,
    facilityChanges,
    earlyGames,
    lateGames,
  };
}

function buildIssues(
  teamMetrics: TeamScheduleMetrics[],
  aggregate: ReturnType<typeof aggregateMetrics>,
  expectedGamesPerParticipant: number | undefined,
  maxGamesPerDay: number,
): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];

  if (expectedGamesPerParticipant) {
    const under = teamMetrics.filter(team => team.gameCount < expectedGamesPerParticipant);
    const over = teamMetrics.filter(team => team.gameCount > expectedGamesPerParticipant);
    if (under.length > 0) {
      issues.push({
        severity: 'error',
        code: 'under_target',
        title: 'Teams below target games',
        detail: formatParticipantList(under),
        count: under.length,
        participantKeys: under.map(team => team.participantKey),
      });
    }
    if (over.length > 0) {
      issues.push({
        severity: 'warning',
        code: 'over_target',
        title: 'Teams above target games',
        detail: formatParticipantList(over),
        count: over.length,
        participantKeys: over.map(team => team.participantKey),
      });
    }
  }

  if (aggregate.venueConflictCount > 0) {
    issues.push({
      severity: 'error',
      code: 'venue_overlap',
      title: 'Venue or facility overlaps',
      detail: `${aggregate.venueConflictCount} overlapping slot${aggregate.venueConflictCount === 1 ? '' : 's'} found.`,
      count: aggregate.venueConflictCount,
    });
  }

  if (aggregate.bufferConflictCount > 0) {
    issues.push({
      severity: 'warning',
      code: 'venue_buffer',
      title: 'Tight venue buffers',
      detail: `${aggregate.bufferConflictCount} slot${aggregate.bufferConflictCount === 1 ? '' : 's'} start inside the buffer window.`,
      count: aggregate.bufferConflictCount,
    });
  }

  if (aggregate.unresolvedFacilityLaneCount > 0) {
    issues.push({
      severity: 'warning',
      code: 'unresolved_facility_lanes',
      title: 'Temporary facilities unresolved',
      detail: `${aggregate.unresolvedFacilityLaneCount} game${aggregate.unresolvedFacilityLaneCount === 1 ? '' : 's'} still assigned to temporary facilities.`,
      count: aggregate.unresolvedFacilityLaneCount,
    });
  }

  const overloaded = teamMetrics.filter(team => team.maxGamesInDay > maxGamesPerDay);
  if (overloaded.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'day_load',
      title: 'Heavy same-day loads',
      detail: formatParticipantList(overloaded),
      count: overloaded.length,
      participantKeys: overloaded.map(team => team.participantKey),
    });
  }

  const backToBackTeams = teamMetrics.filter(team => team.backToBackCount > 0);
  if (backToBackTeams.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'back_to_back',
      title: 'Back-to-back games',
      detail: formatParticipantList(backToBackTeams),
      count: aggregate.backToBackCount,
      participantKeys: backToBackTeams.map(team => team.participantKey),
    });
  }

  const venueMoveTeams = teamMetrics.filter(team => team.venueChanges > 1);
  if (venueMoveTeams.length > 0) {
    issues.push({
      severity: 'info',
      code: 'venue_changes',
      title: 'Multiple venue changes',
      detail: formatParticipantList(venueMoveTeams),
      count: venueMoveTeams.length,
      participantKeys: venueMoveTeams.map(team => team.participantKey),
    });
  }

  return issues.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

function buildHealthBreakdown(
  teamMetrics: TeamScheduleMetrics[],
  aggregate: ReturnType<typeof aggregateMetrics>,
  expectedGamesPerParticipant: number | undefined,
  maxGamesPerDay: number,
): ScheduleHealthBreakdown {
  const targetDelta = expectedGamesPerParticipant
    ? teamMetrics.reduce((total, team) => total + Math.abs(team.gameCount - expectedGamesPerParticipant), 0)
    : 0;
  const overloadedGameDays = teamMetrics.reduce(
    (total, team) => total + Object.values(team.gamesByDay).filter(count => count > maxGamesPerDay).length,
    0,
  );
  const edgeCounts = teamMetrics.map(team => team.earlyGames + team.lateGames);
  const edgeRange = edgeCounts.length ? Math.max(...edgeCounts) - Math.min(...edgeCounts) : 0;

  return {
    gameBalance: expectedGamesPerParticipant ? clampScore(20 - targetDelta * 5) : 20,
    rest: clampScore(20 - aggregate.backToBackCount * 4),
    dayLoad: clampScore(15 - overloadedGameDays * 5),
    movement: clampScore(15 - aggregate.venueChangeCount * 1.5 - aggregate.facilityChangeCount * 0.5),
    timeSlots: clampScore(15 - edgeRange * 3),
    conflicts: clampScore(15 - aggregate.venueConflictCount * 7 - aggregate.bufferConflictCount * 3 - aggregate.unresolvedFacilityLaneCount * 1.5),
  };
}

function scanVenueConflicts(
  games: ScheduleMetricGame[],
  options: BuildScheduleMetricsOptions,
  divisions: Division[],
  tournament: Tournament | null,
) {
  let venueConflictCount = 0;
  let bufferConflictCount = 0;
  const timedGames = games
    .map(game => buildParticipantGame(game, options, divisions, tournament))
    .filter(game => game.game.date && game.game.time && game.venueKey);

  for (let i = 0; i < timedGames.length; i++) {
    for (let j = i + 1; j < timedGames.length; j++) {
      const a = timedGames[i];
      const b = timedGames[j];
      if (a.date !== b.date) continue;
      if (!sameVenueConflictScope(a, b)) continue;
      const aEnd = a.startAbsoluteMinutes + a.durationMinutes;
      const bEnd = b.startAbsoluteMinutes + b.durationMinutes;
      const overlaps = a.startAbsoluteMinutes < bEnd && aEnd > b.startAbsoluteMinutes;
      if (overlaps) {
        venueConflictCount += 1;
        continue;
      }
      const bufferMinutes = options.bufferMinutes ?? DEFAULT_BUFFER_MINUTES;
      const tightAfterA = b.startAbsoluteMinutes >= aEnd && b.startAbsoluteMinutes < aEnd + bufferMinutes;
      const tightAfterB = a.startAbsoluteMinutes >= bEnd && a.startAbsoluteMinutes < bEnd + bufferMinutes;
      if (tightAfterA || tightAfterB) bufferConflictCount += 1;
    }
  }

  return { venueConflictCount, bufferConflictCount };
}

function sameVenueConflictScope(a: ParticipantGame, b: ParticipantGame): boolean {
  if (a.game.venueFacilityId || b.game.venueFacilityId) {
    return !!a.game.venueFacilityId && a.game.venueFacilityId === b.game.venueFacilityId;
  }
  const aLaneKey = getScheduleFacilityLaneKey(a.game);
  const bLaneKey = getScheduleFacilityLaneKey(b.game);
  if (aLaneKey || bLaneKey) return !!aLaneKey && aLaneKey === bLaneKey;
  return !!a.venueKey && a.venueKey === b.venueKey;
}

function buildParticipantGame(
  game: ScheduleMetricGame,
  options: BuildScheduleMetricsOptions,
  divisions: Division[],
  tournament: Tournament | null,
): ParticipantGame {
  const timeMinutes = timeToMinutes(game.time ?? '');
  const dateIndex = dateToIndex(game.date ?? '');
  return {
    game,
    startAbsoluteMinutes: dateIndex * 24 * 60 + (Number.isFinite(timeMinutes) ? timeMinutes : 0),
    date: game.date ?? '',
    timeMinutes: Number.isFinite(timeMinutes) ? timeMinutes : 0,
    durationMinutes: resolveDuration(game, options, divisions, tournament),
    venueKey: getVenueKey(game),
    facilityKey: getFacilityKey(game),
  };
}

function resolveDuration(
  game: ScheduleMetricGame,
  options: BuildScheduleMetricsOptions,
  divisions: Division[],
  tournament: Tournament | null,
): number {
  if (typeof options.gameDurationMinutes === 'number' && options.gameDurationMinutes > 0) {
    return options.gameDurationMinutes;
  }
  const division = divisions.find(item => item.id === game.divisionId);
  const divDuration = division?.settings?.game_duration_minutes;
  if (typeof divDuration === 'number' && divDuration > 0) return divDuration;
  const tournamentDuration = tournament?.settings?.game_duration_minutes;
  if (typeof tournamentDuration === 'number' && tournamentDuration > 0) return tournamentDuration;
  return DEFAULT_GAME_DURATION_MINUTES;
}

function getParticipant(
  game: ScheduleMetricGame,
  side: 'home' | 'away',
  teamNameById: Map<string, string>,
): Participant | null {
  const teamId = side === 'home' ? game.homeTeamId : game.awayTeamId;
  if (teamId) return { key: teamParticipantKey(teamId), label: teamNameById.get(teamId) ?? teamId };

  const slotId = side === 'home' ? game.homeSlotId : game.awaySlotId;
  const placeholder = side === 'home' ? game.homePlaceholder : game.awayPlaceholder;
  if (slotId) return { key: `slot:${slotId}`, label: placeholder || slotId };
  if (placeholder) return { key: `placeholder:${game.divisionId}:${placeholder}`, label: placeholder };
  return null;
}

function appendParticipantGame(map: Map<string, ParticipantGame[]>, key: string, game: ParticipantGame) {
  const games = map.get(key) ?? [];
  games.push(game);
  map.set(key, games);
}

function getVenueKey(game: ScheduleMetricGame): string | null {
  if (game.venueId) return `venue:${game.venueId}`;
  const laneKey = getScheduleFacilityLaneKey(game);
  if (laneKey) return laneKey;
  if (game.location) return `location:${game.location.trim().toLowerCase()}`;
  return null;
}

function getFacilityKey(game: ScheduleMetricGame): string | null {
  if (game.venueFacilityId) return `facility:${game.venueFacilityId}`;
  const laneKey = getScheduleFacilityLaneKey(game);
  if (laneKey) return laneKey;
  return getVenueKey(game);
}

function getScheduleFacilityLaneKey(game: ScheduleMetricGame): string | null {
  if (game.venueId || game.venueFacilityId) return null;
  if (game.scheduleFacilityLaneId) return `lane:${game.scheduleFacilityLaneId}`;
  const label = game.scheduleFacilityLaneLabel?.trim() || '';
  return label ? `lane-label:${label.toLowerCase()}` : null;
}

function hasUnresolvedFacilityLane(game: ScheduleMetricGame): boolean {
  return Boolean((game.scheduleFacilityLaneId || game.scheduleFacilityLaneLabel) && !game.venueId && !game.venueFacilityId);
}

function timeToMinutes(time: string): number {
  const [hourRaw, minuteRaw] = time.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return NaN;
  return hour * 60 + minute;
}

function dateToIndex(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return 0;
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function teamParticipantKey(teamId: string): string {
  return `team:${teamId}`;
}

function minNullable(values: Array<number | null>): number | null {
  const realValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return realValues.length ? Math.min(...realValues) : null;
}

function formatParticipantList(teams: TeamScheduleMetrics[]): string {
  const labels = teams.slice(0, 3).map(team => team.label);
  const suffix = teams.length > 3 ? ` and ${teams.length - 3} more` : '';
  return `${labels.join(', ')}${suffix}`;
}

function severityRank(severity: ScheduleIssueSeverity): number {
  if (severity === 'error') return 0;
  if (severity === 'warning') return 1;
  return 2;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(value, value));
}

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}

export function asScheduleMetricGames(games: Game[]): ScheduleMetricGame[] {
  return games;
}
