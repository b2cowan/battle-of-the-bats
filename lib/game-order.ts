/**
 * THE GAME-ORDER RULE (Public tournament Stage 9, owner rulings 2026-10-29 and 2026-11-18, A1–A12). A tournament game
 * can't start before a game it waits for has ENDED: a Final before its Semifinals, a 3rd Place game before the
 * Semifinal whose loser it takes, a later round before its feeders, and any playoff game before its division's last
 * pool game. This module is the ONLY place that answers "what does this game wait for": the server's guard
 * (`lib/tournament-overlap-guard.ts`), the schedule page, the bracket editor and the rain delay all read it, so the
 * screen refuses exactly what the server refuses. Its words are `lib/game-order-words.ts`.
 *
 * - A SOURCE EDGE is a `Winner <code>` / `Loser <code>` side, matched case-insensitively and trimmed (the diagram's
 *   reading, a superset of the advancer's exact one, so the rule never misses a real edge), within the same DIVISION,
 *   and skipped only when both games carry a bracket id and they differ — the advancer's own scope (`lib/db.ts`). So a
 *   game with no bracket id in a division with several brackets waits for EVERY game its code could mean (A9).
 * - A POOL EDGE (A7): every playoff game of a division that has pool games waits for every pool game of it, which is to
 *   say for the latest-ending one. Kept as one pair per pool game, so a save that runs a SECOND pool game late is a
 *   new problem, not the old one again. Playoffs-only divisions have none.
 * - Cancelled games are neither sources nor dependents (a cancelled GF2 is not played); a game with no day or time is
 *   skipped on either side, so a structure-only bracket still saves.
 * - END = start + the one length chain (`gameLengthMinutes`), in calendar minutes (a clocks-change day keeps 24 h).
 *   Refused when the dependent starts BEFORE the source ends: equal starts are refused, a start exactly at the end is
 *   allowed, a start inside the rest time is the bracket health panel's warning, not this rule (A1).
 * - BEFORE / AFTER (A2): a save is refused only for a pair present after it that was not present before, keyed by the
 *   two game ids, so a schedule already out of order is shown, never locked.
 *
 * Pure + dependency-free for `node --test`.
 */
import { gameLengthMinutes } from './booking-length.ts';

/** A game as the rule reads it. Absent placeholders / ids read as none. */
export interface OrderGame {
  id: string;
  divisionId: string | null;
  bracketId?: string | null;
  bracketCode?: string | null;
  isPlayoff: boolean;
  status?: string | null;
  /** 'YYYY-MM-DD' */
  date: string | null;
  /** 'HH:MM' or 'HH:MM:SS' */
  time: string | null;
  /** The game's own length, if it has one. */
  durationMinutes?: number | null;
  homePlaceholder?: string | null;
  awayPlaceholder?: string | null;
}

/** The two defaults under a game's own length: each division's, then the event's (their `settings.game_duration_minutes`). */
export interface OrderLengths {
  divisionMinutes?: ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>>;
  eventMinutes?: unknown;
}

/** What the dependent waits for from its source: the winner, the loser, or the division's pool play (A7). */
export type OrderEdgeKind = 'winner' | 'loser' | 'pool';

export interface OrderEdge {
  sourceId: string;
  dependentId: string;
  kind: OrderEdgeKind;
}

/** A pair out of order: the dependent starts before its source ends. Minutes are calendar minutes (see `minutesAt`). */
export interface OrderProblem extends OrderEdge {
  sourceStart: number;
  sourceEnd: number;
  dependentStart: number;
}

const SOURCE_RE = /^(winner|loser)\s+(.+)$/i;

/** A side's `Winner <code>` / `Loser <code>`, read loosely (trimmed, any case), or null. */
export function sourceSide(placeholder: string | null | undefined): { kind: 'winner' | 'loser'; code: string } | null {
  const m = (placeholder ?? '').trim().match(SOURCE_RE);
  return m ? { kind: m[1].toLowerCase() as 'winner' | 'loser', code: m[2].trim().toUpperCase() } : null;
}

/** A game's start as calendar minutes (its day + its clock), never a local instant: a clocks-change day keeps 24 h. */
export function minutesAt(date: string | null | undefined, time: string | null | undefined): number | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '');
  const tm = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
  if (!dm || !tm) return null;
  return Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3])) / 60_000 + Number(tm[1]) * 60 + Number(tm[2]);
}

/** Calendar minutes back to the stored 'YYYY-MM-DD' and 'HH:MM'. */
export function dateTimeAt(minutes: number): { date: string; time: string } {
  const day = Math.floor(minutes / 1440);
  const d = new Date(day * 86_400_000);
  const min = minutes - day * 1440;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(Math.floor(min / 60))}:${pad(min % 60)}`,
  };
}

type WithLength = { settings?: { game_duration_minutes?: unknown } | null };

/** The defaults as stored: each division's and the event's `settings.game_duration_minutes`. */
export function orderLengthsOf(
  divisions: readonly ({ id: string } & WithLength)[],
  tournament?: WithLength | null,
): OrderLengths {
  return {
    divisionMinutes: new Map(divisions.map(d => [d.id, d.settings?.game_duration_minutes])),
    eventMinutes: tournament?.settings?.game_duration_minutes,
  };
}

const divisionDefault = (lengths: OrderLengths, divisionId: string | null): unknown => {
  const m = lengths.divisionMinutes;
  if (!m || !divisionId) return undefined;
  return m instanceof Map ? m.get(divisionId) : (m as Record<string, unknown>)[divisionId];
};

/** A game's length by the one chain: its own, else its division's, else the event's, else the one booking length. */
export function orderGameLength(g: OrderGame, lengths: OrderLengths = {}): number {
  return gameLengthMinutes(g.durationMinutes, divisionDefault(lengths, g.divisionId), lengths.eventMinutes);
}

const isPlayed = (g: OrderGame) => (g.status ?? 'scheduled') !== 'cancelled';

/**
 * Every edge among these games: who waits for whom. Dates play no part here (an edge is structure), so a game with no
 * time still has its edges; `findOrderProblems` skips it when judging.
 */
export function orderEdges(games: readonly OrderGame[]): OrderEdge[] {
  const live = games.filter(isPlayed);
  const byDivision = new Map<string, OrderGame[]>();
  for (const g of live) {
    const key = g.divisionId ?? '';
    const list = byDivision.get(key);
    if (list) list.push(g); else byDivision.set(key, [g]);
  }

  const out: OrderEdge[] = [];
  const seen = new Set<string>();
  const push = (e: OrderEdge) => {
    const key = `${e.sourceId}>${e.dependentId}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(e);
  };

  for (const group of byDivision.values()) {
    // The division's codes, each to every game wearing it (tiers and per-pool brackets reuse SF1, FIN, …).
    const byCode = new Map<string, OrderGame[]>();
    for (const g of group) {
      const code = g.bracketCode?.trim().toUpperCase();
      if (!code) continue;
      const list = byCode.get(code);
      if (list) list.push(g); else byCode.set(code, [g]);
    }
    for (const y of group) {
      for (const ph of [y.awayPlaceholder, y.homePlaceholder]) {
        const side = sourceSide(ph);
        if (!side) continue;
        for (const x of byCode.get(side.code) ?? []) {
          if (x.id === y.id) continue;
          if (x.bracketId && y.bracketId && x.bracketId !== y.bracketId) continue;
          push({ sourceId: x.id, dependentId: y.id, kind: side.kind });
        }
      }
    }
    // A7: pool play, division-wide.
    const pool = group.filter(g => !g.isPlayoff);
    if (!pool.length) continue;
    for (const y of group) {
      if (!y.isPlayoff) continue;
      for (const x of pool) push({ sourceId: x.id, dependentId: y.id, kind: 'pool' });
    }
  }
  return out;
}

/** Every pair out of order in this picture. */
export function findOrderProblems(games: readonly OrderGame[], lengths: OrderLengths = {}): OrderProblem[] {
  const byId = new Map(games.map(g => [g.id, g]));
  const out: OrderProblem[] = [];
  for (const e of orderEdges(games)) {
    const x = byId.get(e.sourceId);
    const y = byId.get(e.dependentId);
    if (!x || !y) continue;
    const sourceStart = minutesAt(x.date, x.time);
    const dependentStart = minutesAt(y.date, y.time);
    if (sourceStart == null || dependentStart == null) continue;
    const sourceEnd = sourceStart + orderGameLength(x, lengths);
    if (dependentStart < sourceEnd) out.push({ ...e, sourceStart, sourceEnd, dependentStart });
  }
  return out;
}

export const orderPairKey = (p: { sourceId: string; dependentId: string }) => `${p.sourceId}>${p.dependentId}`;

/**
 * The pairs a change CREATES (A2): out of order after it, not before. `beforeLengths` defaults to `afterLengths` — they
 * differ only when the change is a division's or the event's default length (A8).
 */
export function newOrderProblems(
  before: readonly OrderGame[],
  after: readonly OrderGame[],
  afterLengths: OrderLengths = {},
  beforeLengths: OrderLengths = afterLengths,
): OrderProblem[] {
  const old = new Set(findOrderProblems(before, beforeLengths).map(orderPairKey));
  return findOrderProblems(after, afterLengths).filter(p => !old.has(orderPairKey(p)));
}

/** Each game's pairs, both sides (A5: the chip on both games of a pair). */
export function orderProblemsById(problems: readonly OrderProblem[]): Map<string, OrderProblem[]> {
  const out = new Map<string, OrderProblem[]>();
  for (const p of problems) {
    for (const id of [p.sourceId, p.dependentId]) {
      const list = out.get(id);
      if (list) list.push(p); else out.set(id, [p]);
    }
  }
  return out;
}
