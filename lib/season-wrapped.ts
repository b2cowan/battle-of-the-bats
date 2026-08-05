/**
 * lib/season-wrapped.ts
 * Pure Season Wrapped computation (Coach Portal Batch 3, wow #7). No I/O, unit-tested —
 * the server assembly lives in lib/rep-season-wrapped.ts.
 *
 * This is the CANONICAL season-record rule. Before this file the record was tallied three
 * different ways (Overview result card + SeasonRecordWidget/Insights count league_game |
 * tournament_game | scrimmage with scrimmage excluded by default; getRepTeamHistory /
 * getRepCurrentSeasonSummary count league_game | scrimmage | external_tournament). A
 * celebration card that disagrees with the Insights page a tap away would be worse than no
 * card, so Wrapped counts EVERY real-competition type — league_game, tournament_game AND
 * the legacy external_tournament — and excludes scrimmages, matching what the Overview's
 * "That's a wrap" headline shows for the same games.
 *
 * Honesty rule (approved mockups): every stat carries its own "earned it" threshold and is
 * null when the season didn't — the card renders fewer tiles, never padded superlatives.
 */

/** Real-competition event types that count toward the record (scrimmage deliberately out). */
export const WRAPPED_RECORD_EVENT_TYPES = ['league_game', 'tournament_game', 'external_tournament'];

export interface WrappedGameInput {
  eventType: string;
  /** ISO datetime */
  startsAt: string;
  status: string;
  result: string | null;
  teamScore: number | null;
  opponentScore: number | null;
  opponent: string | null;
  homeAway: string | null;
}

/** One player's game-day attendance tallies (reliability "games" bucket). */
export interface WrappedAttendanceInput {
  attended: number;
  /** attended + absent — no-replies are never counted against anyone. */
  known: number;
}

export interface WrappedAwardInput {
  playerId: string;
  typeName: string;
}

export interface WrappedReusedLineupInput {
  label: string;
  games: number;
  scoredGames: number;
  wins: number;
  losses: number;
  ties: number;
}

export interface SeasonWrappedInput {
  events: WrappedGameInput[];
  attendance: WrappedAttendanceInput[];
  awards: WrappedAwardInput[];
  /** Display label per roster player id — first name + jersey only (e.g. "Maya #7"). */
  playerLabelById: Record<string, string>;
  reusedLineups: WrappedReusedLineupInput[];
  gamesWithLineup: number;
  rosterCount: number;
}

export interface SeasonWrappedStats {
  record: { wins: number; losses: number; ties: number; games: number };
  /** ≥3 consecutive wins, else null. Dates are the first/last game of the run. */
  longestStreak: { length: number; startsAt: string; endsAt: string } | null;
  /** Tightest decided margin (wins preferred on equal margin); needs ≥4 decided games. */
  closestGame: {
    opponent: string | null;
    teamScore: number;
    opponentScore: number;
    result: 'win' | 'loss';
    homeAway: string | null;
    startsAt: string;
    margin: number;
  } | null;
  /** Game-day attendance % across the roster (known responses only). Null with no data. */
  attendanceRate: { pct: number; known: number } | null;
  /** Most-awarded player; ties are named, never hidden. */
  topAward: { playerLabel: string; count: number; tiedWith: string[]; topTypeName: string | null } | null;
  /** A reused lineup that never lost (≥3 uses, ≥2 scored wins, 0 losses) — else null. */
  lineupFact: { label: string; uses: number; wins: number; losses: number; ties: number } | null;
  gamesWithLineup: number;
  rosterCount: number;
}

/**
 * Everything the shareable Season Wrapped PNG is allowed to know: the analytic stats plus the
 * three identity fields the card prints. Defined HERE, beside the stats, because this is the
 * shape's real home — `lib/wrapped-share-card.ts` aliases it rather than keeping a second copy.
 */
export interface WrappedShareCardData extends SeasonWrappedStats {
  seasonName: string;
  teamName: string;
  teamColor: string | null;
}

/** The allow-list the card is built from. */
export const WRAPPED_SHARE_CARD_FIELDS = [
  'record', 'longestStreak', 'closestGame', 'attendanceRate', 'topAward', 'lineupFact',
  'gamesWithLineup', 'rosterCount', 'seasonName', 'teamName', 'teamColor',
] as const;

/**
 * Narrow a full Wrapped payload to the share-safe subset.
 *
 * ⚠ ALLOW-LIST, not an omit-list, and that is the whole point. The card used to be handed the
 * entire payload and was safe only because the drawing code happened not to read anything
 * unsafe. Game-Day P2 put coach-written free text about a child into that payload
 * (`momentSlot`), which turned "safe" into luck. A field added to the payload from now on is
 * invisible to the exported image until someone deliberately names it above.
 */
export function wrappedShareCardData<T extends WrappedShareCardData>(payload: T): WrappedShareCardData {
  const out: Record<string, unknown> = {};
  for (const field of WRAPPED_SHARE_CARD_FIELDS) out[field] = payload[field];
  return out as unknown as WrappedShareCardData;
}

const finalized = (e: WrappedGameInput) => e.result != null && e.status !== 'cancelled';

export function computeSeasonWrapped(input: SeasonWrappedInput): SeasonWrappedStats {
  const recordGames = input.events
    .filter(e => WRAPPED_RECORD_EVENT_TYPES.includes(e.eventType) && finalized(e))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const record = {
    wins: recordGames.filter(e => e.result === 'win').length,
    losses: recordGames.filter(e => e.result === 'loss').length,
    ties: recordGames.filter(e => e.result === 'tie').length,
    games: recordGames.length,
  };

  // ── Longest win streak (chronological run of wins; a tie breaks it) ──
  let longestStreak: SeasonWrappedStats['longestStreak'] = null;
  {
    let run = 0;
    let runStart = -1;
    let best = 0;
    let bestStart = -1;
    let bestEnd = -1;
    recordGames.forEach((e, i) => {
      if (e.result === 'win') {
        if (run === 0) runStart = i;
        run += 1;
        if (run > best) { best = run; bestStart = runStart; bestEnd = i; }
      } else {
        run = 0;
      }
    });
    if (best >= 3) {
      longestStreak = {
        length: best,
        startsAt: recordGames[bestStart].startsAt,
        endsAt: recordGames[bestEnd].startsAt,
      };
    }
  }

  // ── Closest game (min decided margin; win beats loss on the same margin) ──
  let closestGame: SeasonWrappedStats['closestGame'] = null;
  {
    const decided = recordGames.filter(e =>
      (e.result === 'win' || e.result === 'loss') && e.teamScore != null && e.opponentScore != null);
    if (decided.length >= 4) {
      let bestGame: WrappedGameInput | null = null;
      let bestMargin = Infinity;
      for (const e of decided) {
        const margin = Math.abs((e.teamScore as number) - (e.opponentScore as number));
        const better = margin < bestMargin
          || (margin === bestMargin && e.result === 'win' && bestGame?.result !== 'win');
        if (better) { bestGame = e; bestMargin = margin; }
      }
      if (bestGame) {
        closestGame = {
          opponent: bestGame.opponent,
          teamScore: bestGame.teamScore as number,
          opponentScore: bestGame.opponentScore as number,
          result: bestGame.result as 'win' | 'loss',
          homeAway: bestGame.homeAway,
          startsAt: bestGame.startsAt,
          margin: bestMargin,
        };
      }
    }
  }

  // ── Game-day attendance rate (aggregate of known responses; no-replies excluded) ──
  let attendanceRate: SeasonWrappedStats['attendanceRate'] = null;
  {
    let attended = 0;
    let known = 0;
    for (const a of input.attendance) { attended += a.attended; known += a.known; }
    if (known > 0) attendanceRate = { pct: Math.round((attended / known) * 100), known };
  }

  // ── Top award-winner (ties named, never silently dropped) ──
  let topAward: SeasonWrappedStats['topAward'] = null;
  if (input.awards.length > 0) {
    const countByPlayer = new Map<string, number>();
    const typeCounts = new Map<string, Map<string, number>>();
    for (const a of input.awards) {
      countByPlayer.set(a.playerId, (countByPlayer.get(a.playerId) ?? 0) + 1);
      let t = typeCounts.get(a.playerId);
      if (!t) { t = new Map(); typeCounts.set(a.playerId, t); }
      t.set(a.typeName, (t.get(a.typeName) ?? 0) + 1);
    }
    const max = Math.max(...countByPlayer.values());
    const leaders = [...countByPlayer.entries()].filter(([, c]) => c === max).map(([id]) => id);
    const label = (id: string) => input.playerLabelById[id] ?? 'A player';
    // Deterministic leader among ties: alphabetical by label, the rest named beside them.
    const sorted = leaders.map(label).sort((a, b) => a.localeCompare(b));
    const leaderId = leaders.find(id => label(id) === sorted[0]) ?? leaders[0];
    const leaderTypes = typeCounts.get(leaderId);
    const topTypeName = leaderTypes
      ? [...leaderTypes.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : null;
    topAward = { playerLabel: sorted[0], count: max, tiedWith: sorted.slice(1), topTypeName };
  }

  // ── Never-beaten reused lineup (mirrors the Insights good-news rule, stricter uses floor) ──
  let lineupFact: SeasonWrappedStats['lineupFact'] = null;
  {
    const candidates = input.reusedLineups
      .filter(r => r.games >= 3 && r.scoredGames >= 2 && r.wins >= 2 && r.losses === 0)
      .sort((a, b) => b.wins - a.wins);
    if (candidates[0]) {
      const c = candidates[0];
      lineupFact = { label: c.label, uses: c.games, wins: c.wins, losses: c.losses, ties: c.ties };
    }
  }

  return {
    record,
    longestStreak,
    closestGame,
    attendanceRate,
    topAward,
    lineupFact,
    gamesWithLineup: input.gamesWithLineup,
    rosterCount: input.rosterCount,
  };
}
