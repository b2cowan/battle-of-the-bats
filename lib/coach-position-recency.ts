// Position recency — "Who hasn't played catcher recently?" — PURE, no I/O, no React.
//
// Ask the Front Office, Phase A (ASK_FRONT_OFFICE_PLAN.md). The binding constraint is the same one
// `lib/coach-arm-care.ts` states for pitching: **this module may only claim what a saved lineup
// records.** It knows who was written into a position, in which game, for how many innings. It does
// NOT know who *can* play a position, who the coach was resting, or who was absent — so it never
// says a player "should" get a turn, only how long it has been since they had one.
//
// Two consequences, both deliberate:
//   • A player who has never played the position this season is ABSENT from the answer, not listed
//     with a gap of "all season". A primary-position field on a roster row is an intention, not a
//     record — treating it as one would invent a fact the receipts can't show.
//   • A game with no saved lineup contributes nothing. A team that stopped saving lineups in July
//     gets an honest "3 weeks", not a silent zero.
//
// Vocabulary comes from the Sport Pack (`fieldPositions`), never from a list typed here — softball
// and hockey ask the same question with their own words.
//
// Relative import WITH the .ts extension so the unit tests run under plain `node --test`.
import { daysBetweenDateStrings } from './timezone.ts';

/** One game with a saved lineup, reduced to what position recency needs. */
export interface PositionRecencyGame {
  eventId: string;
  /** The event's calendar day in the ORG'S zone, `YYYY-MM-DD`. */
  day: string;
  /** How the receipt names this game, e.g. "vs Falcons". Caller supplies the words. */
  label: string;
  /** Optional start timestamp — the caller's tie-break for two games on one day. Never read here;
   *  this module trusts the array order it documents below. */
  startsAt?: string;
  /** Per player in the saved lineup: position → innings played there in THIS game. */
  byPlayer: { playerId: string; positionInnings: Record<string, number> }[];
}

export interface PositionRecencyPlayer {
  id: string;
  name: string;
}

/** One player's turn at the position, in one game — a receipt line. */
export interface PositionAppearance {
  eventId: string;
  day: string;
  label: string;
  playerId: string;
  name: string;
  innings: number;
}

/** One player's standing at the position. */
export interface PositionRecencyRow {
  playerId: string;
  name: string;
  /** Their most recent day at this position, `YYYY-MM-DD`. */
  lastDay: string;
  /** Innings they played there that day. */
  lastInnings: number;
  /** Calendar days between that day and today. 0 = today. */
  daysSince: number;
}

export interface PositionRecency {
  position: string;
  /** Games (already played, with a saved lineup) in which anyone filled this position. */
  gamesCovered: number;
  /** Every player who has filled it this season — longest gap first. Empty = nobody has. */
  players: PositionRecencyRow[];
  /** Appearances at this position, most recent first. The receipts. */
  appearances: PositionAppearance[];
  /** Distinct names who have filled it SINCE the longest-gap player's last turn, most recent
   *  first. Empty when that player is also the most recent. */
  coveredSince: string[];
}

export interface PositionRecencyInput {
  /** Today, `YYYY-MM-DD`, in the org's zone. Passed in so this stays pure and testable. */
  today: string;
  /**
   * Games with a saved lineup, **sorted oldest → newest**. Two games on one day keep their input
   * order, which is the caller's start-time order — the only ordering a date string can't supply.
   */
  games: PositionRecencyGame[];
  players: PositionRecencyPlayer[];
  position: string;
}

/**
 * Everything recorded about one position this season, ordered so the longest gap is first.
 *
 * Games dated in the FUTURE are excluded: a lineup saved for Saturday is a plan, and counting it
 * would tell a coach someone has already played a game they haven't played.
 */
export function computePositionRecency(input: PositionRecencyInput): PositionRecency {
  const { today, games, players, position } = input;
  const nameById = new Map(players.map(p => [p.id, p.name]));

  // Oldest → newest, already-played only.
  const played = games.filter(g => g.day && daysBetweenDateStrings(g.day, today) >= 0);

  const appearancesOldestFirst: PositionAppearance[] = [];
  for (const g of played) {
    for (const p of g.byPlayer) {
      const innings = p.positionInnings[position] ?? 0;
      if (innings <= 0) continue;
      const name = nameById.get(p.playerId);
      // A lineup entry for a player no longer on the roster can't be named, and an unnamed
      // receipt line is not a receipt — skip rather than print a blank.
      if (!name) continue;
      appearancesOldestFirst.push({
        eventId: g.eventId, day: g.day, label: g.label,
        playerId: p.playerId, name, innings,
      });
    }
  }

  // Games in which SOMEONE filled it — the denominator for "games since", and the honest
  // count behind "covered every game since".
  const coveredGameDays: string[] = [];
  const seenEvents = new Set<string>();
  for (const a of appearancesOldestFirst) {
    if (seenEvents.has(a.eventId)) continue;
    seenEvents.add(a.eventId);
    coveredGameDays.push(a.day);
  }

  // Last turn per player (appearances are oldest-first, so the last write wins).
  const lastByPlayer = new Map<string, PositionAppearance>();
  for (const a of appearancesOldestFirst) lastByPlayer.set(a.playerId, a);

  const rows: PositionRecencyRow[] = [...lastByPlayer.values()].map(a => ({
    playerId: a.playerId,
    name: a.name,
    lastDay: a.day,
    lastInnings: a.innings,
    daysSince: daysBetweenDateStrings(a.day, today),
  }));

  // Longest gap first; ties broken by name so the order never wobbles between requests.
  rows.sort((a, b) => b.daysSince - a.daysSince || a.name.localeCompare(b.name));

  const appearances = [...appearancesOldestFirst].reverse();

  const stalest = rows[0];
  const coveredSince: string[] = [];
  if (stalest) {
    for (const a of appearances) {
      if (daysBetweenDateStrings(stalest.lastDay, a.day) <= 0) break; // reached their own turn
      if (a.playerId !== stalest.playerId && !coveredSince.includes(a.name)) coveredSince.push(a.name);
    }
  }

  return { position, gamesCovered: coveredGameDays.length, players: rows, appearances, coveredSince };
}

/**
 * Which position to open the picker on: the one whose longest-waiting player has waited longest.
 *
 * Positions nobody has ever played sort LAST, not first. An empty position is a coverage fact, not
 * a recency fact — opening the picker on it would answer a question the coach didn't ask with a
 * blank. Positions with a single ever-player rank on that player's gap like any other.
 */
export function rankPositionsByStaleness(input: {
  today: string;
  games: PositionRecencyGame[];
  players: PositionRecencyPlayer[];
  positions: string[];
}): { position: string; daysSince: number | null }[] {
  const { today, games, players, positions } = input;
  return positions
    .map(position => {
      const r = computePositionRecency({ today, games, players, position });
      return { position, daysSince: r.players[0]?.daysSince ?? null };
    })
    .sort((a, b) => {
      if (a.daysSince === null && b.daysSince === null) return 0;
      if (a.daysSince === null) return 1;
      if (b.daysSince === null) return -1;
      return b.daysSince - a.daysSince;
    });
}
