// Arm care for the game-day card — PURE, no I/O, no React.
//
// Chunk C (wow #2 remainder), D-C7. The binding constraint is what this module may CLAIM:
//
//   ⚠ This product has NO season innings ceiling. Every cap it stores is PER GAME — a per-player
//     `lineup_profile.pitcher.maxInnings`, falling back to the season default
//     `lineup_settings.pitcherMaxInningsDefault`. Both are numbers the COACH set.
//
// So there are exactly two things we can say honestly, and this module says only those:
//   1. today's saved lineup puts a pitcher over the cap THE COACH THEMSELVES SET, and
//   2. how many days it has been since that player last pitched, from saved lineups.
//
// Inventing a season ceiling to warn against would be the D-G1 error — the product proposing a
// figure as though it were a rule — in the one place where the cost is a child's arm. It warns; it
// never blocks a save, never changes a lineup, and never tells the coach what to do.
//
// Relative imports WITH the .ts extension so the unit tests run under plain `node --test`.
import { daysBetweenDateStrings } from './timezone.ts';
import { resolvePlayerPitcherCap } from './lineup-caps.ts';

/** A saved lineup, reduced to what arm care needs. */
export interface ArmCareLineup {
  eventId: string;
  /** The event's calendar day in the ORG'S zone, `YYYY-MM-DD`. */
  day: string;
  /** playerId → innings at the pitcher position in THAT game. */
  inningsByPlayer: Record<string, number>;
}

export interface ArmCarePlayer {
  id: string;
  name: string;
  /** Per-GAME cap for this player; null falls back to the season default. */
  perGameCap: number | null;
}

export interface ArmCareConcern {
  playerId: string;
  name: string;
  /** Innings this player is down for in TODAY's saved lineup (0 when not pitching today). */
  inningsToday: number;
  /** The cap that applies to them — always a number the coach set. null = no cap set. */
  cap: number | null;
  /** True when today's saved lineup exceeds their own cap. */
  overCap: boolean;
  /** Days since their last outing, or null when they have not pitched in a saved lineup. */
  daysSinceLastOuting: number | null;
  /** Innings in that last outing, when there was one. */
  lastOutingInnings: number | null;
}

export interface ArmCareInput {
  /** Today, `YYYY-MM-DD`, in the org's zone. */
  today: string;
  /** The event the game-day card is about. */
  todayEventId: string;
  /** Every saved lineup for the season, including today's if one exists. */
  lineups: ArmCareLineup[];
  players: ArmCarePlayer[];
  /** Season default per-game cap. */
  seasonCap: number | null;
  /** The sport's pitcher position — null for a sport with no such role, which skips this entirely. */
  pitcherPosition: string | null;
}

/**
 * Concerns worth putting in front of the coach before first pitch, most serious first.
 *
 * Returns [] when the sport has no pitching role, when today has no saved lineup, or when nothing
 * is worth saying — a card that warns about nothing teaches the coach to ignore it.
 */
export function resolveArmCare(input: ArmCareInput): ArmCareConcern[] {
  const { today, todayEventId, lineups, players, seasonCap, pitcherPosition } = input;
  if (!pitcherPosition) return [];

  const todayLineup = lineups.find(l => l.eventId === todayEventId);
  if (!todayLineup) return [];

  const byId = new Map(players.map(p => [p.id, p]));
  const concerns: ArmCareConcern[] = [];

  for (const [playerId, inningsToday] of Object.entries(todayLineup.inningsByPlayer)) {
    if (!inningsToday) continue;
    const player = byId.get(playerId);
    if (!player) continue;
    // ONE spelling of "the cap that applies to them", shared with the game-day console's chip
    // (lib/lineup-caps.ts) — two surfaces quoting a child's arm-care ceiling must never differ.
    const cap = resolvePlayerPitcherCap(player.perGameCap, seasonCap);

    // The most recent prior outing. A FUTURE game is not rest they did not get, so it is ignored —
    // but ANOTHER GAME TODAY absolutely counts. A double-header is the single situation this
    // warning exists for, and skipping same-day outings would have made it silent in exactly that
    // case. Innings pitched earlier today are added to today's own total for the cap comparison.
    let lastDay: string | null = null;
    let lastInnings: number | null = null;
    let sameDayInnings = 0;
    for (const l of lineups) {
      if (l.eventId === todayEventId) continue;
      const innings = l.inningsByPlayer[playerId] ?? 0;
      if (!innings) continue;
      const daysAgo = daysBetweenDateStrings(l.day, today);
      if (daysAgo < 0) continue; // a game that has not happened yet
      if (daysAgo === 0) sameDayInnings += innings;
      if (lastDay === null || daysBetweenDateStrings(lastDay, l.day) > 0) {
        lastDay = l.day;
        lastInnings = innings;
      }
    }

    // The cap is a per-GAME ceiling, so a second game today is compared on its own innings — but
    // the coach still needs to know the arm has already thrown, which the rest line says.
    const totalToday = inningsToday + sameDayInnings;

    // Over the cap on this game alone, or across both halves of a double-header.
    const overCap = cap != null && (inningsToday > cap || totalToday > cap);
    const daysSince = lastDay ? daysBetweenDateStrings(lastDay, today) : null;

    // Say something only when there is something to say: over their own cap, or they threw
    // recently. "Recently" is deliberately generous (3 days) and is a PROMPT TO LOOK, not a rule —
    // the product does not know this child, this league, or this pitch count.
    if (overCap || (daysSince != null && daysSince <= 3)) {
      concerns.push({
        playerId, name: player.name, inningsToday, cap, overCap,
        daysSinceLastOuting: daysSince, lastOutingInnings: lastInnings,
      });
    }
  }

  // Over-cap first, then the shortest rest, then the heaviest load today.
  return concerns.sort((a, b) =>
    Number(b.overCap) - Number(a.overCap)
    || (a.daysSinceLastOuting ?? 99) - (b.daysSinceLastOuting ?? 99)
    || b.inningsToday - a.inningsToday);
}

/**
 * The one-line headline and the supporting sentence for a concern.
 *
 * Addressed to the coach's judgement, never a verdict — "worth a look" rather than "do not pitch".
 * The period noun comes from the Sport Pack so this file never says "innings" itself.
 */
export function armCareCopy(
  concern: ArmCareConcern,
  periodLabelPlural: string,
): { headline: string; detail: string } {
  const unit = periodLabelPlural.toLowerCase();
  const rest = concern.daysSinceLastOuting == null
    ? ''
    : concern.daysSinceLastOuting === 0
      ? `They already pitched today.`
      : concern.daysSinceLastOuting === 1
        ? `They pitched ${concern.lastOutingInnings} yesterday.`
        : `They last pitched ${concern.daysSinceLastOuting} days ago.`;

  if (concern.overCap) {
    return {
      headline: `${concern.name} is down for ${concern.inningsToday} ${unit} at pitcher.`,
      detail: [`Your cap for them is ${concern.cap}.`, rest].filter(Boolean).join(' '),
    };
  }
  return {
    headline: `${concern.name} is pitching again today.`,
    detail: [rest, 'Worth a look before first pitch.'].filter(Boolean).join(' '),
  };
}
