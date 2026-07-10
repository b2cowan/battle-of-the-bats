import type { Division, Game, Tournament, Venue } from './types';
import { computeTournamentStandings } from './tie-breakers.ts';
import { isStandardSingleEliminationBracket, nextBracketCodeViaWinner } from './playoff-bracket.ts';

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
  /** This game's own length (minutes), if set — wins over the division/tournament default. */
  durationMinutes?: number | null;
  /** Bracket wiring — only needed to project a resolved seed's schedule through
   *  undetermined rounds (see BuildScheduleMetricsOptions and TeamScheduleMetrics.projectedGameCount). */
  bracketCode?: string | null;
  /** Scopes bracketCode uniqueness for tiered divisions (each tier is its own bracket, and
   *  tiers can reuse identical codes) — undefined/null means "the division's one bracket". */
  bracketId?: string | null;
  /** Only needed to compute standings (see BuildScheduleMetricsOptions.standingsGames). */
  homeScore?: number | null;
  awayScore?: number | null;
}

export interface ScheduleMetricTeam {
  id: string;
  name: string;
  divisionId: string;
  status?: string | null;
  /** Organizer-assigned bracket seed (Teams admin) — resolves a "Seed #N" bracket slot to this team. */
  seed?: number | null;
  poolId?: string | null;
}

export interface ManualTravelBufferSettings {
  venueChangeMinutes?: number;
  facilityChangeMinutes?: number;
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
  travelBufferWarnings: number;
  earlyGames: number;
  lateGames: number;
  /**
   * Set when this row's identity came from resolving a "Seed #N" bracket slot rather than a
   * directly-assigned team: 'manualSeed' (organizer typed a seed number) or 'currentStandings'
   * (derived from live round-robin standings, which can still change before round robin ends —
   * the UI should visibly flag this as provisional, not a locked-in result).
   */
  seedBasis?: 'manualSeed' | 'currentStandings';
  /**
   * Count of this team's games that are PROJECTED rather than confirmed — reached by walking
   * the bracket's Winner-feed graph forward from this team's current slot, assuming they keep
   * winning (Phase 2B, standard single-elimination brackets only). Every number in this row
   * (gameCount, backToBackCount, minRestMinutes, etc.) can include these hypothetical rounds —
   * 0 means every game behind this row's numbers is already a real, scheduled matchup.
   */
  projectedGameCount: number;
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
  travelBufferWarningCount: number;
  unresolvedFacilityLaneCount: number;
  /** Effective "max games/day" threshold used for the day-load rating (organizer rule or default 2). */
  maxGamesPerDay: number;
  /** Effective back-to-back threshold in minutes used for the rest rating (organizer rule or default 15). */
  minRestThresholdMinutes: number;
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
  /**
   * The tournament's full, unfiltered game list (round-robin + playoff, every division) — used
   * ONLY to compute live round-robin standings so a "Seed #N" bracket slot can resolve to the
   * team currently holding that rank. Optional: omit to skip standings-based seed resolution
   * (the manual `teams.seed` path still works without it). `games` above is typically already
   * scoped to one view (e.g. just playoff games), so this is deliberately separate.
   */
  standingsGames?: ScheduleMetricGame[];
  expectedGamesPerParticipant?: number;
  gameDurationMinutes?: number;
  bufferMinutes?: number;
  manualTravelBuffers?: ManualTravelBufferSettings;
  maxGamesPerDay?: number;
  /** Back-to-back threshold: a team's consecutive games closer than this count as back-to-back. */
  minRestMinutes?: number;
  includePlayoffs?: boolean;
}

interface Participant {
  key: string;
  label: string;
  seedBasis?: 'manualSeed' | 'currentStandings';
}

interface ParticipantGame {
  game: ScheduleMetricGame;
  startAbsoluteMinutes: number;
  date: string;
  timeMinutes: number;
  durationMinutes: number;
  venueKey: string | null;
  facilityKey: string | null;
  /** True when this game was reached via the Phase 2B Winner-feed projection, not a real row. */
  isProjected?: boolean;
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
    includePlayoffs = false,
  } = options;
  const manualTravelBuffers = resolveManualTravelBuffers(options, tournament);

  // Effective "healthy schedule" thresholds: explicit options win, then the organizer's
  // saved rules (settings.schedule_health_rules), then hard defaults. bufferMinutes stays
  // a back-to-back fallback so callers that pass only it keep their existing behavior.
  const savedRules = getScheduleHealthRules(tournament);
  const maxGamesPerDay = options.maxGamesPerDay ?? savedRules.maxGamesPerDay;
  const backToBackThreshold = options.minRestMinutes ?? options.bufferMinutes ?? savedRules.minRestMinutes;
  const expectedGamesPerParticipant = options.expectedGamesPerParticipant ?? (savedRules.targetGamesPerTeam ?? undefined);

  const scopedGames = options.games.filter(game => {
    if (divisionId && game.divisionId !== divisionId) return false;
    if (!includePlayoffs && game.isPlayoff) return false;
    if (game.status === 'cancelled') return false;
    return true;
  });

  const activeDivision = divisionId ? divisions.find(division => division.id === divisionId) : undefined;

  const teamNameById = new Map(teams.map(team => [team.id, team.name]));
  // A "Seed #N" bracket slot names a real, organizer-assigned team (Teams admin) the moment
  // the bracket is built — independent of any game result — so it resolves the same as a
  // directly-assigned team rather than counting as an anonymous placeholder.
  const teamIdBySeedKey = new Map<string, string>();
  const ambiguousSeedKeys = new Set<string>();
  teams.forEach(team => {
    if (typeof team.seed === 'number' && (!team.status || team.status === 'accepted')) {
      const seedKey = `${team.divisionId}:${team.seed}`;
      if (teamIdBySeedKey.has(seedKey)) ambiguousSeedKeys.add(seedKey);
      else teamIdBySeedKey.set(seedKey, team.id);
    }
  });
  // Two teams sharing a seed number is a data-entry mistake, not a resolvable bracket slot —
  // leave it as an anonymous placeholder rather than silently crediting one team's stats to
  // whichever happened to be inserted first.
  ambiguousSeedKeys.forEach(seedKey => teamIdBySeedKey.delete(seedKey));

  // Brackets seeded from round-robin standings (rather than an organizer-typed seed number)
  // never populate teams.seed — resolve "Seed #N" against the CURRENT live standings instead,
  // using the same ranking math the public Standings page already runs. This can still change
  // while round-robin games remain, so every row resolved this way is tagged 'currentStandings'
  // (see TeamScheduleMetrics.seedBasis) for the UI to flag as provisional, not locked in.
  // Before any round-robin result exists, every team is tied at 0-0-0 — the tie-breaker chain
  // still returns SOME order (whatever its stable sort falls back to), but that order is
  // arbitrary, not a real signal (computeTournamentStandings only flags `needsCoinToss` once a
  // tie is genuinely "settled" — i.e. every relevant game has been played and it's STILL tied —
  // so a plain "nothing played yet" tie doesn't set that flag). Naming a specific team from an
  // arbitrary order would be confidently wrong, not just provisional, so require at least one
  // decided round-robin result in this division before trusting standings-based resolution at
  // all.
  const divisionHasRoundRobinResult = (options.standingsGames ?? []).some(game =>
    game.divisionId === divisionId && !game.isPlayoff && (game.status === 'completed' || game.status === 'forfeit')
  );

  const standingsTeamIdBySeed = new Map<number, string>();
  if (divisionId && divisionHasRoundRobinResult && options.standingsGames?.length) {
    const standingsRows = computeTournamentStandings(
      divisionId,
      teams,
      options.standingsGames,
      activeDivision?.playoffConfig,
      tournament?.settings,
    );
    // A rank still awaiting an admin coin toss has no real order between the tied teams — the
    // sort's placement is arbitrary, not "current." Naming one specific team there would be
    // confidently wrong, not just provisional, so leave the seed unresolved instead.
    standingsRows.forEach((row, index) => {
      if (!row.needsCoinToss) standingsTeamIdBySeed.set(index + 1, row.teamId);
    });
  }

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
  const participantSeedBasis = new Map<string, 'manualSeed' | 'currentStandings'>();

  // Playoffs: "Teams" means "how many seeds is this bracket built for" — known the moment the
  // bracket is created, regardless of how many of those seeds have a resolvable game row yet.
  // Round Robin (and a Generator preview scoring a round-robin draft that merely happens to
  // pass includePlayoffs=true to also weigh existing saved playoff games) has no such fixed
  // count, so it keeps counting participants found in games. Gate on the SCOPED games actually
  // being playoff games, not the raw flag, so this only fires for a genuine playoffs view.
  const isPlayoffScope = includePlayoffs && scopedGames.length > 0 && scopedGames.every(game => game.isPlayoff);

  // Phase 2B: "if this seed keeps winning" — a seed's OWN rest/back-to-back/day-load exposure
  // doesn't depend on WHO occupies it, only on which bracket slot they're in (every round's
  // venue/time is fixed the moment the bracket is built — only the opponent, and sometimes the
  // occupant's name, is unknown). So this walks the bracket's Winner-feed graph forward from
  // EVERY seed's own first-round entry — labeled by the real team name the moment one resolves
  // (via the manual/standings maps above), else literally "Seed #N" — rather than gating the
  // whole projection on name resolution first. `TeamScheduleMetrics.projectedGameCount` tracks
  // how many of a row's games are still hypothetical (their round hasn't actually been decided
  // yet) so the UI can label them distinctly. Scoped to standard single-elimination brackets,
  // grouped per bracketId so a tiered division's non-single-elim tier is skipped without
  // blocking its single-elim siblings — double-elim/consolation/placement formats let a seed
  // legitimately land in either the winner or loser branch, so guessing which would be worse
  // than not projecting at all; those (and any game a seed-walk didn't claim) fall through to
  // the ordinary per-game resolution below, unchanged from Phase 1/2A.
  const seedWalkedGames = new Set<ScheduleMetricGame>();
  if (isPlayoffScope && divisionId) {
    const codedGames = scopedGames.filter(game => !!game.bracketCode);
    const gamesByBracket = new Map<string, ScheduleMetricGame[]>();
    for (const game of codedGames) {
      const bracketKey = game.bracketId ?? '__default__';
      const list = gamesByBracket.get(bracketKey);
      if (list) list.push(game);
      else gamesByBracket.set(bracketKey, [game]);
    }

    for (const [, bracketGames] of gamesByBracket) {
      if (!isStandardSingleEliminationBracket(bracketGames)) continue;

      const codeToGame = new Map<string, ScheduleMetricGame>();
      for (const game of bracketGames) codeToGame.set((game.bracketCode as string).trim().toUpperCase(), game);

      const seedNumbers = new Set<number>();
      for (const game of bracketGames) {
        for (const ph of [game.homePlaceholder, game.awayPlaceholder]) {
          const m = ph ? SEED_REF_RE.exec(ph.trim()) : null;
          if (m) seedNumbers.add(Number(m[1]));
        }
      }

      for (const seedNumber of seedNumbers) {
        const entry = findSeedEntrySide(bracketGames, seedNumber);
        if (!entry) continue; // bracket-build gap — no created row for this seed yet

        // getParticipant never returns null here: entry.side's placeholder is guaranteed
        // truthy (that's exactly how findSeedEntrySide found it).
        const participant = getParticipant(entry.game, entry.side, teamNameById, teamIdBySeedKey, standingsTeamIdBySeed)!;
        // A resolved real team gets its normal `team:<id>` identity (so a direct result on
        // this same team elsewhere still merges); otherwise this seed gets its own stable
        // identity so it shows as its own "Seed #N" row instead of being dropped as an
        // anonymous placeholder.
        const participantKey = participant.key.startsWith('team:') ? participant.key : `seed:${divisionId}:${seedNumber}`;
        participantLabels.set(participantKey, participant.label);
        if (participant.seedBasis) participantSeedBasis.set(participantKey, participant.seedBasis);

        let cursorCode = (entry.game.bracketCode as string);
        let sideOnCurrent = entry.side;
        let currentGame = entry.game;
        let confirmed = true; // round 1 is always a real, already-scheduled matchup
        const visited = new Set<string>([cursorCode.trim().toUpperCase()]);

        for (let guard = 0; guard < 20; guard++) {
          seedWalkedGames.add(currentGame);
          appendParticipantGame(participantGames, participantKey, {
            ...buildParticipantGame(currentGame, options, divisions, tournament),
            isProjected: !confirmed,
          });

          if (confirmed) {
            const decided = decideDecisiveSide(currentGame);
            if (decided == null) confirmed = false; // not decided yet — everything onward is hypothetical
            else if (decided !== sideOnCurrent) break; // this seed lost — no further rounds exist for them
          }

          const step = nextBracketCodeViaWinner(bracketGames, cursorCode);
          if (!step) break;
          const nextKey = step.code.trim().toUpperCase();
          if (visited.has(nextKey)) break; // defends against a malformed/cyclic feed graph
          const nextGame = codeToGame.get(nextKey);
          if (!nextGame) break;
          visited.add(nextKey);
          cursorCode = step.code;
          sideOnCurrent = step.side;
          currentGame = nextGame;
        }
      }
    }
  }

  for (const game of scopedGames) {
    if (seedWalkedGames.has(game)) continue; // already handled by the seed-walk above
    const home = getParticipant(game, 'home', teamNameById, teamIdBySeedKey, standingsTeamIdBySeed);
    const away = getParticipant(game, 'away', teamNameById, teamIdBySeedKey, standingsTeamIdBySeed);
    if (!home || !away) continue;

    participantLabels.set(home.key, home.label);
    participantLabels.set(away.key, away.label);
    if (home.seedBasis) participantSeedBasis.set(home.key, home.seedBasis);
    if (away.seedBasis) participantSeedBasis.set(away.key, away.seedBasis);

    const participantGame = buildParticipantGame(game, options, divisions, tournament);
    appendParticipantGame(participantGames, home.key, participantGame);
    appendParticipantGame(participantGames, away.key, participantGame);
  }

  // { numeric: true } sorts embedded numbers by value, not character-by-character — so "Seed
  // #10" sorts after "Seed #9" instead of after "Seed #1". Harmless for plain team names.
  // The slot:/placeholder: exclusion is PLAYOFFS-ONLY: it hides a still-unresolved bracket slot
  // (double-elim/consolation, out of scope for the seed-walk above) from counting as an
  // anonymous phantom team. Round Robin — and a slot-mode Generator preview, which has NO
  // identity OTHER than `slot:<id>` since no real teams exist yet in a fresh draft — must keep
  // these rows, or the team-detail table and every aggregate stat (health score, back-to-back,
  // max/day) silently go to zero for that entire, unrelated feature.
  const allKeys = Array.from(participantLabels.keys()).sort((a, b) =>
    (participantLabels.get(a) ?? a).localeCompare(participantLabels.get(b) ?? b, undefined, { numeric: true })
  ).filter(key => !isPlayoffScope || (!key.startsWith('slot:') && !key.startsWith('placeholder:')));

  const teamMetrics = allKeys.map(key => ({
    ...buildTeamMetrics(key, participantLabels.get(key) ?? key, participantGames.get(key) ?? [], backToBackThreshold, manualTravelBuffers),
    seedBasis: participantSeedBasis.get(key),
  }));

  const tierSeedCount = activeDivision?.playoffConfig?.tierConfigs?.length
    ? Math.max(...activeDivision.playoffConfig.tierConfigs.map(tier => tier.toSeed))
    : undefined;
  // teamsQualifying is absent when the organizer never capped the field (every accepted team
  // in the division qualifies) — fall back to that accepted-team count rather than reading 0.
  const acceptedTeamCount = divisionId
    ? teams.filter(team => team.divisionId === divisionId && (!team.status || team.status === 'accepted')).length
    : undefined;
  const divisionSeedCount = tierSeedCount ?? activeDivision?.playoffConfig?.teamsQualifying ?? acceptedTeamCount;
  const participantCount = isPlayoffScope && divisionSeedCount != null ? divisionSeedCount : teamMetrics.length;

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
    participantCount,
    expectedGamesPerParticipant,
    ...aggregate,
    minRestThresholdMinutes: backToBackThreshold,
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

export function resolveManualTravelBuffers(
  options: Pick<BuildScheduleMetricsOptions, 'manualTravelBuffers'>,
  tournament?: Tournament | null,
): Required<ManualTravelBufferSettings> {
  const venueSetting = normalizeManualBufferMinutes(options.manualTravelBuffers?.venueChangeMinutes)
    ?? normalizeManualBufferMinutes(tournament?.settings?.schedule_travel_venue_buffer_minutes)
    ?? 0;
  const facilitySetting = normalizeManualBufferMinutes(options.manualTravelBuffers?.facilityChangeMinutes)
    ?? normalizeManualBufferMinutes(tournament?.settings?.schedule_travel_facility_buffer_minutes)
    ?? 0;

  return {
    venueChangeMinutes: venueSetting,
    facilityChangeMinutes: facilitySetting,
  };
}

function normalizeRuleInt(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < min || i > max) return null;
  return i;
}

/**
 * The organizer's saved "healthy schedule" thresholds with hard defaults applied.
 * Pure read of `tournament.settings.schedule_health_rules` — used by the Schedule
 * Health editor for its initial values, and by `buildScheduleMetrics` as the fallback
 * when explicit options aren't supplied. `targetGamesPerTeam` of null = no target.
 */
export function getScheduleHealthRules(
  tournament?: Tournament | null,
): { maxGamesPerDay: number; minRestMinutes: number; targetGamesPerTeam: number | null } {
  const saved = tournament?.settings?.schedule_health_rules;
  return {
    maxGamesPerDay: normalizeRuleInt(saved?.maxGamesPerDay, 1, 10) ?? DEFAULT_MAX_GAMES_PER_DAY,
    minRestMinutes: normalizeRuleInt(saved?.minRestMinutes, 0, 600) ?? DEFAULT_BUFFER_MINUTES,
    targetGamesPerTeam: normalizeRuleInt(saved?.targetGamesPerTeam, 1, 99),
  };
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
    travelBufferWarningCount: teamMetrics.reduce((total, team) => total + team.travelBufferWarnings, 0),
    unresolvedFacilityLaneCount: games.filter(hasUnresolvedFacilityLane).length,
    maxGamesPerDay,
  };
}

function buildTeamMetrics(
  participantKey: string,
  label: string,
  games: ParticipantGame[],
  backToBackThresholdMinutes: number,
  manualTravelBuffers: Required<ManualTravelBufferSettings>,
): TeamScheduleMetrics {
  const sortedGames = [...games].sort((a, b) => a.startAbsoluteMinutes - b.startAbsoluteMinutes);
  const gamesByDay: Record<string, number> = {};
  let backToBackCount = 0;
  let minRestMinutes: number | null = null;
  let venueChanges = 0;
  let facilityChanges = 0;
  let travelBufferWarnings = 0;
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
    if (restMinutes >= 0 && restMinutes <= backToBackThresholdMinutes) backToBackCount += 1;

    const venueChanged = Boolean(previous.venueKey && current.venueKey && previous.venueKey !== current.venueKey);
    const facilityChanged = Boolean(previous.facilityKey && current.facilityKey && previous.facilityKey !== current.facilityKey);
    if (venueChanged) venueChanges += 1;
    if (facilityChanged) facilityChanges += 1;

    const requiredMoveBuffer = venueChanged
      ? manualTravelBuffers.venueChangeMinutes
      : facilityChanged
        ? manualTravelBuffers.facilityChangeMinutes
        : 0;
    if (restMinutes >= 0 && requiredMoveBuffer > 0 && restMinutes < requiredMoveBuffer) {
      travelBufferWarnings += 1;
    }
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
    travelBufferWarnings,
    earlyGames,
    lateGames,
    projectedGameCount: sortedGames.filter(game => game.isProjected).length,
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

  const tightTravelTeams = teamMetrics.filter(team => team.travelBufferWarnings > 0);
  if (tightTravelTeams.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'manual_travel_buffer',
      title: 'Tight travel/setup moves',
      detail: `${aggregate.travelBufferWarningCount} move${aggregate.travelBufferWarningCount === 1 ? '' : 's'} have less than the organizer-entered buffer. ${formatParticipantList(tightTravelTeams)}`,
      count: aggregate.travelBufferWarningCount,
      participantKeys: tightTravelTeams.map(team => team.participantKey),
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
    movement: clampScore(15 - aggregate.venueChangeCount * 1.5 - aggregate.facilityChangeCount * 0.5 - aggregate.travelBufferWarningCount * 2),
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
  // A game's own length wins (playoff games, a longer final, etc.).
  if (typeof game.durationMinutes === 'number' && game.durationMinutes > 0) {
    return game.durationMinutes;
  }
  const division = divisions.find(item => item.id === game.divisionId);
  const divDuration = division?.settings?.game_duration_minutes;
  if (typeof divDuration === 'number' && divDuration > 0) return divDuration;
  const tournamentDuration = tournament?.settings?.game_duration_minutes;
  if (typeof tournamentDuration === 'number' && tournamentDuration > 0) return tournamentDuration;
  return DEFAULT_GAME_DURATION_MINUTES;
}

const SEED_REF_RE = /^Seed #(\d+)$/;

function getParticipant(
  game: ScheduleMetricGame,
  side: 'home' | 'away',
  teamNameById: Map<string, string>,
  teamIdBySeedKey: Map<string, string>,
  standingsTeamIdBySeed: Map<number, string>,
): Participant | null {
  const teamId = side === 'home' ? game.homeTeamId : game.awayTeamId;
  if (teamId) return { key: teamParticipantKey(teamId), label: teamNameById.get(teamId) ?? teamId };

  const slotId = side === 'home' ? game.homeSlotId : game.awaySlotId;
  const placeholder = side === 'home' ? game.homePlaceholder : game.awayPlaceholder;

  const seedMatch = placeholder ? SEED_REF_RE.exec(placeholder.trim()) : null;
  if (seedMatch) {
    const seedNumber = Number(seedMatch[1]);
    const manualTeamId = teamIdBySeedKey.get(`${game.divisionId}:${seedNumber}`);
    if (manualTeamId) {
      return { key: teamParticipantKey(manualTeamId), label: teamNameById.get(manualTeamId) ?? placeholder!, seedBasis: 'manualSeed' };
    }
    const standingsTeamId = standingsTeamIdBySeed.get(seedNumber);
    if (standingsTeamId) {
      return { key: teamParticipantKey(standingsTeamId), label: teamNameById.get(standingsTeamId) ?? placeholder!, seedBasis: 'currentStandings' };
    }
  }

  if (slotId) return { key: `slot:${slotId}`, label: placeholder || slotId };
  if (placeholder) return { key: `placeholder:${game.divisionId}:${placeholder}`, label: placeholder };
  return null;
}

/** The first game (in bracket-build order) whose Home/Away is exactly `Seed #<seedNumber>`,
 *  and which side it's on — the starting point for that seed's Phase 2B forward walk. */
function findSeedEntrySide(
  games: ScheduleMetricGame[],
  seedNumber: number,
): { game: ScheduleMetricGame; side: 'home' | 'away' } | null {
  for (const game of games) {
    const homeMatch = game.homePlaceholder ? SEED_REF_RE.exec(game.homePlaceholder.trim()) : null;
    if (homeMatch && Number(homeMatch[1]) === seedNumber) return { game, side: 'home' };
    const awayMatch = game.awayPlaceholder ? SEED_REF_RE.exec(game.awayPlaceholder.trim()) : null;
    if (awayMatch && Number(awayMatch[1]) === seedNumber) return { game, side: 'away' };
  }
  return null;
}

/**
 * Which side actually won a decided elimination game, purely from scores — no team identity
 * needed. Mirrors `resolvePlayoffWinner` in lib/playoff-bracket.ts (same tie/forfeit rule), but
 * that helper requires non-null team ids, which an unresolved bracket slot doesn't have yet.
 * Returns null for a not-yet-decided game (nothing to walk past) or a genuine tie (shouldn't
 * happen for a completed elimination game, but never treated as a winner either way).
 */
function decideDecisiveSide(game: ScheduleMetricGame): 'home' | 'away' | null {
  if (game.status !== 'completed' && game.status !== 'forfeit') return null;
  const home = game.homeScore ?? 0;
  const away = game.awayScore ?? 0;
  if (game.status !== 'forfeit' && home === away) return null;
  return home > away ? 'home' : 'away';
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

function normalizeManualBufferMinutes(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.min(240, Math.round(n));
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
