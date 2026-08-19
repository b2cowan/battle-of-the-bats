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

/**
 * The position-recency MATRIX — every player against every position on the field, each cell holding
 * how long it has been since a saved lineup put them there (Reports Portal P2, 2026-08-19).
 *
 * ⚠⚠ **THIS SHAPE IS A PIVOT OF `computePositionRecency`, NOT A SECOND ANSWER.** That module is the
 * one place the rule lives, and the rule is what makes the matrix honest: **a player who has never
 * played a position this season is ABSENT from `byPosition`, never a zero and never a season-long
 * gap.** A roster's stated primary position is an INTENTION, and an intention is not a record — a
 * cell filled from one would invent a fact the receipts cannot show. Renderers must draw a missing
 * key as "never", not as a large number.
 *
 * ⚠ It says how long it has been. It never says a player is OWED a turn
 * (`memory/decision_playing_time_vocabulary.md`: measurement in context, never a verdict).
 */
export interface PositionRecencyMatrix {
  /** The columns, in the SPORT PACK's own order — softball and hockey ask this with their words. */
  positions: { code: string; label: string }[];
  /** One row per player who appears in at least one saved lineup. Ordered by name; a caller that
   *  renders this beside another table should order it to match, so the two read down together. */
  rows: {
    playerId: string;
    name: string;
    /** position code → their most recent turn there. A position they have never played is ABSENT. */
    byPosition: Record<string, { daysSince: number; innings: number; day: string }>;
  }[];
  /** Games ALREADY PLAYED that had a saved lineup — the honest denominator for "nothing here yet". */
  gamesRead: number;
}

export interface PositionRecencyMatrixInput {
  /** Today, `YYYY-MM-DD`, in the org's zone. Passed in so this stays pure and testable. */
  today: string;
  /** Games with a saved lineup, oldest → newest — the same contract `computePositionRecency` states. */
  games: PositionRecencyGame[];
  players: PositionRecencyPlayer[];
  /** The columns, in the SPORT PACK's own order. **The caller supplies the words** — the same rule
   *  `PositionRecencyGame.label` states, so softball and hockey name their own positions and this
   *  module never types a list of its own. */
  positions: { code: string; label: string }[];
}

/**
 * Pivot the season into the matrix — one pass per position, accumulated per player.
 *
 * ⚠ It lives HERE, beside the function it pivots and beside `rankPositionsByStaleness` (its
 * structural twin), rather than in the server-only assembler that first held it. The rule it
 * enforces — *only positions a player HAS played get a key* — is the honesty rule of this whole
 * module, and a rule that cannot be reached by this module's own test suite is a rule guarded by
 * nothing. The DB-row adapter that feeds it stays server-side, where it belongs.
 */
export function computePositionRecencyMatrix(input: PositionRecencyMatrixInput): PositionRecencyMatrix {
  const { today, games, players, positions } = input;

  const byPlayer = new Map<string, PositionRecencyMatrix['rows'][number]>();
  const playedEvents = new Set<string>();

  /**
   * ⚠⚠ **SEED A ROW FOR EVERYONE WHO WAS IN A LINEUP, INCLUDING THE PLAYER WHO NEVER LEFT THE
   * BENCH.** The first version built rows only inside the per-position loop below — so a row
   * existed only for a player who had taken a position. A player written into every saved lineup
   * and benched all season therefore had no row AT ALL, and the panel (which drops a miss) simply
   * omitted them.
   *
   * That is precisely backwards: they are the most extreme answer this report has, they sit at the
   * TOP of the table above it (which orders most-benched first), and they were the one player
   * missing from the grid underneath. A row of dashes is the honest rendering — "no saved lineup
   * has put them anywhere", which is a fact, not an absence of one.
   *
   * ⚠ Seeded from the GAMES, never from the roster: a player who has never appeared in any lineup
   * still gets no row, because there is nothing recorded about them to show.
   */
  const nameById = new Map(players.map(p => [p.id, p.name]));
  for (const g of games) {
    // Same "already played" rule `computePositionRecency` applies — a lineup saved for Saturday is
    // a plan, and a plan must not put anyone in this grid.
    if (!g.day || daysBetweenDateStrings(g.day, today) < 0) continue;
    for (const p of g.byPlayer) {
      const name = nameById.get(p.playerId);
      // An unnamed row is no row — same rule the appearance list applies.
      if (!name || byPlayer.has(p.playerId)) continue;
      byPlayer.set(p.playerId, { playerId: p.playerId, name, byPosition: {} });
    }
  }

  for (const { code } of positions) {
    const r = computePositionRecency({ today, games, players, position: code });
    for (const a of r.appearances) playedEvents.add(a.eventId);
    for (const row of r.players) {
      let entry = byPlayer.get(row.playerId);
      if (!entry) {
        entry = { playerId: row.playerId, name: row.name, byPosition: {} };
        byPlayer.set(row.playerId, entry);
      }
      // ⚠ Only positions they HAVE played get a key. The absence IS the answer for the rest.
      entry.byPosition[code] = { daysSince: row.daysSince, innings: row.lastInnings, day: row.lastDay };
    }
  }

  return {
    positions,
    // Name order, so the matrix is stable between requests. A caller rendering it beside another
    // table should re-order it to match that table — never re-sort it by staleness, which would
    // make a ranking out of a measurement.
    rows: [...byPlayer.values()].sort((a, b) => a.name.localeCompare(b.name)),
    gamesRead: playedEvents.size,
  };
}
