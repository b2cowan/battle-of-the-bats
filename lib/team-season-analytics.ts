import 'server-only';
import {
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamSeasonLineups,
  getRepTeamEvents,
  getRepRosterPlayers,
  getRepTeamLineupTemplates,
} from './db';
import { getSportPack, DEFAULT_SPORT, positionLabel } from './sports';
import { playerDisplayName } from './coach-roster-name';
import { computeSeasonLineupAnalytics, type SeasonLineupAnalytics } from './lineup-season-analytics';
import { resolveArmCare, type ArmCareConcern, type ArmCareLineup } from './coach-arm-care';
import { analyzeLineup } from './lineup-analysis';
import {
  computePositionRecencyMatrix,
  type PositionRecencyGame,
  type PositionRecencyMatrix,
} from './coach-position-recency';
import { orgDayKey, tournamentToday } from './timezone';

/**
 * ONE shared assembly of the season lineup-analytics inputs. This exact composition
 * (team + season lineups + events + roster → computeSeasonLineupAnalytics) was previously
 * copy-pasted by the lineup-analytics route and the insights digest, and the Player
 * Development card was about to be a third copy — any change to the input mapping (e.g. a
 * new pitcher field) now lands here once. Returns null when the team has no active program
 * year. (insights-digest still assembles its own inputs from pre-fetched data — migrate it
 * here if its fetch pattern ever converges.)
 */
export async function computeTeamSeasonLineupAnalytics(
  teamId: string,
  // Callers that already fetched the team for their own auth check pass it through so the
  // helper doesn't re-fetch it (only `sport` is read here).
  opts?: {
    team?: { sport?: string | null } | null;
    /**
     * Chunk C (wow #2): when set, also resolve the arm-care concerns for THAT event, so the
     * Overview's game-day card can warn without a second round trip. Everything the warning
     * needs — saved lineups, event dates, per-player caps, the season default and the sport's
     * pitcher position — is already loaded here.
     */
    armCareForEventId?: string | null;
    /**
     * Reports Portal P2: also pivot the season's saved lineups into the position-recency matrix.
     *
     * ⚠ It lives HERE rather than in its own route because this helper is already holding every
     * input it needs — the lineups, the events (for calendar days) and the roster. Its previous
     * assembler was the retired `/ask` route, which loaded all three a SECOND time; the caller
     * pass-through below exists because of exactly that. Opt-in, because the Overview's game-day
     * card takes this same helper and has no use for a matrix.
     */
    positionRecency?: boolean;
    /**
     * Anything the CALLER already holds, passed through so this helper doesn't fetch it twice.
     * Same contract as `team` above, extended to the rest of the wave (Ask the Front Office
     * Phase A: its route already loads the season, lineups, events and roster to answer a
     * position question, and re-fetching all four here cost a second full round-trip wave).
     *
     * ⚠ Anything passed MUST belong to `programYear` — this helper cannot re-verify that. Pass
     * only what you fetched for the SAME active season.
     */
    programYear?: { id: string; lineupSettings?: { pitcherMaxInningsDefault?: number | null } | null } | null;
    lineups?: Awaited<ReturnType<typeof getRepTeamSeasonLineups>>;
    events?: Awaited<ReturnType<typeof getRepTeamEvents>>;
    players?: Awaited<ReturnType<typeof getRepRosterPlayers>>;
  },
): Promise<{
  analytics: SeasonLineupAnalytics;
  programYearId: string;
  armCare?: ArmCareConcern[];
  recency?: PositionRecencyMatrix;
  periodLabelPlural?: string;
} | null> {
  const programYear = opts?.programYear ?? (await getActiveRepProgramYear(teamId));
  if (!programYear) return null;

  const [team, lineups, events, players, templates] = await Promise.all([
    opts?.team !== undefined ? Promise.resolve(opts.team) : getRepTeam(teamId),
    opts?.lineups ?? getRepTeamSeasonLineups(programYear.id),
    opts?.events ?? getRepTeamEvents(programYear.id),
    opts?.players ?? getRepRosterPlayers(programYear.id),
    getRepTeamLineupTemplates(teamId, programYear.id),
  ]);

  const sportPack = getSportPack(team?.sport ?? DEFAULT_SPORT);
  const analytics = computeSeasonLineupAnalytics({
    lineups,
    scores: events.map(e => ({ eventId: e.id, teamScore: e.teamScore, opponentScore: e.opponentScore })),
    players: players.map(p => ({
      id: p.id,
      name: playerDisplayName(p),
      isPitcher: !!p.lineupProfile?.pitcher,
      pitcherCap: p.lineupProfile?.pitcher?.maxInnings ?? null,
    })),
    pitcherPosition: sportPack.pitcherPosition,
    seasonPitcherCap: programYear.lineupSettings?.pitcherMaxInningsDefault ?? null,
    templates: templates.map(t => ({
      name: t.name,
      battingOrderPlayerIds: t.entries
        .filter(e => e.battingOrder != null)
        .sort((a, b) => (a.battingOrder as number) - (b.battingOrder as number))
        .map(e => e.playerId),
    })),
    fieldPositions: sportPack.fieldPositions,
  });

  // Each event's calendar day IN THE ORG'S ZONE. Both of the readings below ask a calendar question
  // ("how many days since…"), so neither may be answered from a raw UTC slice.
  const dayByEvent = new Map(events.map(e => [e.id, orgDayKey(e.startsAt)]));
  const pitcherPos = sportPack.pitcherPosition;

  const recency = opts?.positionRecency
    ? buildPositionRecencyMatrix({ lineups, events, players, sportPack, dayByEvent })
    : undefined;

  if (!opts?.armCareForEventId) return { analytics, programYearId: programYear.id, recency };

  // Arm care for one specific game (D-C7). Innings at the pitcher position per player, per saved
  // lineup.
  const armCareLineups: ArmCareLineup[] = pitcherPos
    ? lineups.map(l => ({
        eventId: l.eventId,
        day: dayByEvent.get(l.eventId) ?? '',
        inningsByPlayer: Object.fromEntries(
          l.entries.map(e => [
            e.playerId,
            Object.values(e.inningPositions ?? {}).filter(p => p === pitcherPos).length,
          ]).filter(([, n]) => (n as number) > 0),
        ) as Record<string, number>,
      })).filter(l => l.day)
    : [];

  return {
    analytics,
    programYearId: programYear.id,
    recency,
    armCare: resolveArmCare({
      today: tournamentToday(),
      todayEventId: opts.armCareForEventId,
      lineups: armCareLineups,
      players: players.map(p => ({
        id: p.id,
        name: playerDisplayName(p),
        perGameCap: p.lineupProfile?.pitcher?.maxInnings ?? null,
      })),
      seasonCap: programYear.lineupSettings?.pitcherMaxInningsDefault ?? null,
      pitcherPosition: pitcherPos,
    }),
    periodLabelPlural: sportPack.periodLabelPlural,
  };
}

/**
 * Shape the season's saved lineups into the pure module's input, and hand it the pivot.
 *
 * ⚠ **THIS FUNCTION IS AN ADAPTER, NOT THE ALGORITHM.** The pivot itself
 * (`computePositionRecencyMatrix`) lives beside `computePositionRecency` in the pure module, where
 * this module's test suite can reach it — a first cut kept it here, which put the matrix's honesty
 * rule in the one file no unit test can load. What legitimately belongs here is DB-row shaping:
 * turning lineups + events + roster rows into games and players.
 *
 * ⚠⚠ **THE ASSEMBLY BELOW IS THE HALF THAT WAS DELETED WITH THE ASK BAR, RECOVERED DELIBERATELY.**
 * `lib/coach-position-recency.ts` is pure and unit-tested and survived; the only code that ever FED
 * it was the `/ask` route, so the module was live and unreachable for a day. Four of its rules are
 * carried here and each is load-bearing:
 *
 *   1. **Cancelled games are excluded.** A lineup saved for a game that was then called off records
 *      a PLAN, not a turn anyone took — counting it would tell a coach a player has had a go at a
 *      position they never actually played.
 *   2. **Innings come from `analyzeLineup`, not from a hand-count of the position map.** The same
 *      analyser the season figures use, so the matrix and the table above it can never disagree
 *      about one player's innings — and a hand-count would ignore the lineup's own `inningCount`,
 *      counting innings from a game that was later shortened.
 *   3. **Oldest → newest, with a START-TIME tie-break.** `computePositionRecency` documents that
 *      ordering as the caller's job. The season-lineups query has no ORDER BY, so on a double-header
 *      the two halves would otherwise arrive in whatever order Postgres returned them and the "last
 *      time was…" cell could cite the wrong half.
 *   4. **Active players only.** A departed player's name in the matrix is a receipt about somebody
 *      who is not on the team, and `computePositionRecency` drops any lineup entry it cannot name.
 */
function buildPositionRecencyMatrix(input: {
  lineups: Awaited<ReturnType<typeof getRepTeamSeasonLineups>>;
  events: Awaited<ReturnType<typeof getRepTeamEvents>>;
  players: Awaited<ReturnType<typeof getRepRosterPlayers>>;
  sportPack: ReturnType<typeof getSportPack>;
  dayByEvent: Map<string, string>;
}): PositionRecencyMatrix {
  const { lineups, events, players, sportPack, dayByEvent } = input;
  const positions = sportPack.fieldPositions;

  const eventById = new Map(events.filter(e => e.status !== 'cancelled').map(e => [e.id, e]));
  const games: PositionRecencyGame[] = lineups
    .map(l => {
      const ev = eventById.get(l.eventId);
      return {
        eventId: l.eventId,
        day: ev ? (dayByEvent.get(l.eventId) ?? '') : '',
        startsAt: ev ? ev.startsAt : '',
        label: ev ? (ev.opponent ? `vs ${ev.opponent}` : (ev.name || 'Game')) : 'Game',
        byPlayer: analyzeLineup(l.entries, l.inningCount, positions)
          .fairPlay.map(f => ({ playerId: f.playerId, positionInnings: f.positionCounts })),
      };
    })
    // A lineup whose event is missing or cancelled has no day and drops out here.
    .filter(g => g.day)
    .sort((a, b) => a.day.localeCompare(b.day) || a.startsAt.localeCompare(b.startsAt));

  return computePositionRecencyMatrix({
    today: tournamentToday(),
    games,
    players: players
      .filter(p => p.status === 'active')
      .map(p => ({ id: p.id, name: playerDisplayName(p) })),
    // The Sport Pack names its own positions; this is the only place that vocabulary is resolved.
    positions: positions.map(code => ({ code, label: positionLabel(sportPack, code) })),
  });
}
