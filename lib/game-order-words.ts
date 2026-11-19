/**
 * THE GAME-ORDER RULE'S WORDS (Public tournament Stage 9, A10: "the fact that blocks it, then the way out"; every
 * sentence is the drawing's tab 6, `docs/projects/active/BRACKET_GAME_ORDER_RULE_DRAWINGS.html`). The rule itself is
 * `lib/game-order.ts`. The server writes these sentences into its refusal (`error`), the screens show `error` only, so
 * a refusal reads the same at every door. A refusal is `{ lead, rest }`: the lead is the bold fact, the rest the way out.
 *
 * Games are named by round (`bracketGameLabel`: "the Final", "Semifinal 2", "the 3rd Place game"); pool play by its
 * division ("U13 Boys pool play"); times the house way (`formatTime`: "3:00 p.m."); a day only when it differs.
 */
import { bracketGameLabel, bracketRoundLabel, displayBracketRefs } from './playoff-bracket.ts';
import { formatTime, possessive } from './utils.ts';
import { formatShortWeekdayDate } from './timezone.ts';
import { teamOrSlotWords } from './schedule-words.ts';
import {
  dateTimeAt, newOrderProblems, orderGameLength, orderLengthsOf, type OrderGame, type OrderLengths, type OrderProblem,
} from './game-order.ts';

/** A game as the words need it: the rule's game, its division's name, and (for a pool game) its matchup. */
export interface OrderWordsGame extends OrderGame {
  divisionName?: string | null;
  /** A pool game's "Storm vs Aces"; unused for a playoff game. */
  matchup?: string | null;
}

/** Which door is refusing: each has its own way out (tab 6). */
export type OrderDoor =
  | 'game'            // the game window, the move sheet, a drop, Add game
  | 'pair'            // the bracket editor's save, the rain delay's Undo: no one edited game
  | 'rain-delay'
  | 'reinstate'
  | 'playoff-draft'
  | 'pool-draft'
  | 'import'
  | 'length-default'; // A8: a division's or the event's default length

/** Which of the game window's fields the line goes under (tab 3). */
export type OrderField = 'when' | 'length' | 'sources';

export interface OrderWords { lead: string; rest: string }

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** One period at the end, never two ("4:30 p.m." already ends a sentence). */
const fin = (s: string) => (s.endsWith('.') ? s : `${s}.`);

/**
 * A game's name in a sentence: "the Final", "Semifinal 2", "the 3rd Place game"; a pool game by its matchup.
 * `other` is the game this one is named beside: when the two would read the SAME ("Winners Bracket, Game 1" for a game
 * in round 1 and one in round 2 of a double-elimination bracket), this one carries its bracket code in brackets, the
 * code the bracket editor's cards show ("Winners Bracket, Game 1 (SR-1)"). Different games never share a name.
 */
export function orderGameName(
  g: OrderWordsGame | undefined, opts: { division?: boolean; other?: OrderWordsGame } = {},
): string {
  const name = baseGameName(g, opts.division);
  const o = opts.other;
  if (!g || !o || !g.isPlayoff || !o.isPlayoff || !g.bracketCode?.trim() || !o.bracketCode?.trim()) return name;
  const code = g.bracketCode.trim().toUpperCase();
  if (code === o.bracketCode.trim().toUpperCase() || name !== baseGameName(o, opts.division)) return name;
  return `${name} (${displayBracketRefs(code)})`;
}

function baseGameName(g: OrderWordsGame | undefined, division?: boolean): string {
  if (!g) return 'the other game';
  const div = division && g.divisionName ? `${g.divisionName} ` : '';
  if (!g.isPlayoff) return g.matchup?.trim() || 'a pool game';
  if (!g.bracketCode?.trim()) return `the ${div}playoff game`;
  const label = bracketGameLabel(g.bracketCode);
  if (/\d$/.test(label) || label.includes(', Game ')) return `${div}${label}`;
  if (/Place$/.test(label)) return `the ${div}${label} game`;
  return `the ${div}${label}`;
}

const clock = (minutes: number) => formatTime(dateTimeAt(minutes).time);
const dayOf = (minutes: number) => dateTimeAt(minutes).date;
/** "4:30 p.m.", or "on Sun, Nov 22 at 4:30 p.m." when it falls on another day than `from`. */
const at = (minutes: number, from: number) =>
  dayOf(minutes) === dayOf(from) ? `at ${clock(minutes)}` : `on ${formatShortWeekdayDate(dayOf(minutes))} at ${clock(minutes)}`;
/** "4:30 p.m. or later" — and when that time falls on another day than `from`, the day too ("Sun, Nov 22 at 4:30 p.m. or later"). */
const orLater = (minutes: number, from: number) =>
  dayOf(minutes) === dayOf(from) ? `${clock(minutes)} or later` : `${formatShortWeekdayDate(dayOf(minutes))} at ${clock(minutes)} or later`;
const poolPlay = (g: OrderWordsGame | undefined) => `${g?.divisionName?.trim() || 'the division’s'} pool play`;

/** The round shared by several sources, in the plural ("the semifinals"), or "its earlier games". */
function sourcesPlural(sources: readonly (OrderWordsGame | undefined)[]): string {
  const rounds = new Set(sources.map(s => (s?.isPlayoff ? bracketRoundLabel(s.bracketCode) : '')));
  const [round] = [...rounds];
  if (rounds.size === 1 && round && /^(Quarterfinal|Semifinal)$/.test(round)) return `the ${round.toLowerCase()}s`;
  return 'its earlier games';
}

const waitsFor = (kinds: readonly ('winner' | 'loser' | 'pool')[]) => {
  const same = kinds.every(k => k === kinds[0]);
  const noun = same ? `${kinds[0]}s` : 'results';
  return kinds.length === 2 ? `both ${noun}` : `all ${kinds.length} ${noun}`;
};

export interface OrderRefusalInput {
  /** The pairs this change creates (`newOrderProblems`), at least one. */
  problems: readonly OrderProblem[];
  games: ReadonlyMap<string, OrderWordsGame>;
  lengths?: OrderLengths;
  door: OrderDoor;
  /** The game the organizer changed, when there is one. */
  editedId?: string | null;
  /** The game window's field that changed (`'when'` when unsure). */
  field?: OrderField;
  /** A8: the default length being saved and the one it replaces. */
  length?: { minutes: number; was: number };
}

/** The pair a refusal speaks of: the edited game's first, the one that ends latest among its sources. */
export function pickOrderProblem(problems: readonly OrderProblem[], editedId?: string | null): OrderProblem {
  const mine = editedId ? problems.filter(p => p.sourceId === editedId || p.dependentId === editedId) : [];
  const pool = mine.length ? mine : problems;
  return [...pool].sort((a, b) => b.sourceEnd - a.sourceEnd || a.dependentStart - b.dependentStart)[0];
}

/**
 * The refusal, by door and side. The edited game is the dependent ("The Final waits for its winner") or the source
 * ("It waits for Semifinal 1's winner"); a door with no one edited game names the pair.
 */
export function orderRefusalWords(input: OrderRefusalInput): OrderWords & { gameId: string; otherGameId: string } {
  const { problems, games, door } = input;
  const p = pickOrderProblem(problems, input.editedId);
  const src = games.get(p.sourceId);
  const dep = games.get(p.dependentId);
  const pool = p.kind === 'pool';
  const srcName = pool ? poolPlay(dep) : orderGameName(src, { other: dep });
  const depName = orderGameName(dep, { other: src });
  const end = p.sourceEnd;
  const start = p.dependentStart;
  const editedIsSource = !!input.editedId && input.editedId === p.sourceId && input.editedId !== p.dependentId;
  const ids = editedIsSource
    ? { gameId: p.sourceId, otherGameId: p.dependentId }
    : { gameId: p.dependentId, otherGameId: p.sourceId };
  const say = (lead: string, rest: string) => ({ lead: fin(lead), rest: rest ? ` ${fin(rest)}` : '', ...ids });

  // Everything this dependent newly waits on, for "the semifinals end at 1:00 p.m." (bracket sources only).
  const mineAsDependent = problems.filter(q => q.dependentId === p.dependentId && q.kind !== 'pool');

  switch (door) {
    case 'rain-delay':
      return say(`${cap(srcName)} would end ${at(end, start)}, after ${depName} starts (${clock(start)})`,
        `Push ${depName} as well, or push the games by less`);
    case 'reinstate':
      if (editedIsSource) {
        const who = pool ? orderGameName(src, { other: dep }) : srcName;
        return say(`${cap(who)} is ${at(p.sourceStart, start)} and would end after ${depName} starts (${clock(start)})`,
          `Move ${depName} later first, then put ${pool ? 'this game' : srcName} back`);
      }
      return say(`${cap(srcName)} ends ${at(end, start)}`, `Move ${depName} to ${orLater(end, start)} first, then put it back`);
    case 'playoff-draft':
      return say(`The schedule changed while you were choosing: this draft starts ${depName} before ${srcName} ends`,
        'Make the drafts again');
    case 'pool-draft':
    case 'import':
      if (pool) {
        return say(`This ${door === 'import' ? 'import' : 'draft'} ends ${poolPlay(dep)} ${at(end, start)}, after ${depName} starts (${clock(start)})`,
          'Move the playoffs later first, or end pool play earlier');
      }
      break;
    case 'length-default': {
      const len = input.length;
      const depFull = cap(orderGameName(dep, { division: true }));
      const many = mineAsDependent.length > 1;
      const what = pool ? poolPlay(dep) : many ? sourcesPlural(mineAsDependent.map(q => games.get(q.sourceId))) : srcName;
      const latest = many ? Math.max(...mineAsDependent.map(q => q.sourceEnd)) : end;
      return say(`${depFull} starts ${at(start, p.sourceStart)}`,
        `${len ? `At ${len.minutes} min, ` : ''}${fin(`${what} would end at ${clock(latest)}`)} Move ${depName} first${len ? `, or keep ${len.was} min` : ''}`);
    }
    default:
      break;
  }

  if (door === 'game' && input.editedId) {
    const field = input.field ?? 'when';
    if (editedIsSource) {
      // The edited game runs into a game that waits for it.
      if (pool) return say(`${cap(depName)} starts ${at(start, p.sourceStart)}`, `It waits for ${poolPlay(dep)}, so this game has to end by then`);
      const srcLen = src ? orderGameLength(src, input.lengths) : end - p.sourceStart;
      const room = start - p.sourceStart;
      if (field === 'length' && room > 0) {
        return say(`${cap(depName)} starts ${at(start, p.sourceStart)}`,
          `At ${srcLen} min, ${fin(`${srcName} would end at ${clock(end)}`)} Keep it to ${room} min, or move ${depName} later`);
      }
      return say(`${cap(depName)} starts ${at(start, p.sourceStart)}`,
        `It waits for ${possessive(srcName)} ${p.kind}: start ${srcName} by ${clock(start - srcLen)}${dayOf(start - srcLen) === dayOf(p.sourceStart) ? '' : ` on ${formatShortWeekdayDate(dayOf(start - srcLen))}`}, or move ${depName} later`);
    }
    // The edited game waits for a game that isn't over by then.
    if (pool) {
      const laterDay = dayOf(end) !== dayOf(start);
      const matchup = src?.matchup?.trim();
      return say(`${cap(srcName)} ends ${at(end, start)}`,
        `${matchup ? `(${matchup}). ` : ''}${cap(depName)} waits for the standings: ${laterDay ? `move it to that day, ${clock(end)} or later` : `start it at ${clock(end)} or later`}`);
    }
    if (field === 'sources') {
      return say(`${cap(srcName)} ends ${at(end, start)}`,
        `This game starts at ${clock(start)}, before ${possessive(srcName)} ${p.kind} is known. Pick another game, or change the time`);
    }
    if (mineAsDependent.length > 1) {
      const latest = Math.max(...mineAsDependent.map(q => q.sourceEnd));
      const laterDay = dayOf(latest) !== dayOf(start);
      return say(`${cap(sourcesPlural(mineAsDependent.map(q => games.get(q.sourceId))))} end ${at(latest, start)}`,
        `${cap(depName)} waits for ${waitsFor(mineAsDependent.map(q => q.kind))}: ${laterDay ? `move it to that day, ${clock(latest)} or later` : `start it at ${clock(latest)} or later`}`);
    }
    if (dayOf(p.sourceStart) !== dayOf(start)) {
      return say(`${cap(srcName)} is on ${formatShortWeekdayDate(dayOf(p.sourceStart))} at ${clock(p.sourceStart)}`,
        `${cap(depName)} waits for its ${p.kind}: move it to that day, ${clock(end)} or later`);
    }
    return say(`${cap(srcName)} ends at ${clock(end)}`,
      `${cap(depName)} waits for its ${p.kind}: start it at ${clock(end)} or later, or move ${srcName} earlier`);
  }

  // A door with no one edited game ('pair', and any door's fallback): name the pair.
  return say(`${cap(depName)} starts ${at(start, p.sourceStart)}, before ${srcName} ends ${at(end, start)}`,
    pool ? `Move ${depName} to ${orLater(end, start)}, or end pool play earlier`
      : `Move ${depName} to ${orLater(end, start)}, or move ${srcName} earlier`);
}

// ── The screens' half: the same judgement the server makes, on the games the page holds ────────────────────────────

/** A game as the admin schedule holds it (`Game` in `lib/types.ts`). */
export interface ScheduleGameLike {
  id: string;
  divisionId: string | null;
  bracketId?: string | null;
  bracketCode?: string | null;
  isPlayoff?: boolean | null;
  status?: string | null;
  date: string | null;
  time: string | null;
  durationMinutes?: number | null;
  homePlaceholder?: string | null;
  awayPlaceholder?: string | null;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
}

type Named = { id: string; name?: string | null };

/** The page's game, as the words read it: its division's name and, for a pool game, "Storm vs Aces". */
export function orderWordsGameOf(g: ScheduleGameLike, divisions: readonly Named[], teams: readonly Named[]): OrderWordsGame {
  const team = (id: string | null | undefined) => (id ? teams.find(t => t.id === id)?.name ?? null : null);
  return {
    id: g.id,
    divisionId: g.divisionId ?? null,
    divisionName: divisions.find(d => d.id === g.divisionId)?.name ?? null,
    bracketId: g.bracketId ?? null,
    bracketCode: g.bracketCode ?? null,
    isPlayoff: !!g.isPlayoff,
    status: g.status ?? 'scheduled',
    date: g.date || null,
    time: g.time ? g.time.slice(0, 5) : null,
    durationMinutes: g.durationMinutes ?? null,
    homePlaceholder: g.homePlaceholder ?? null,
    awayPlaceholder: g.awayPlaceholder ?? null,
    matchup: `${teamOrSlotWords(team(g.awayTeamId), g.awayPlaceholder)} vs ${teamOrSlotWords(team(g.homeTeamId), g.homePlaceholder)}`,
  };
}

/**
 * The refusal a one-game change would get from the server, or null (Stage 9: the screen refuses exactly what the
 * server refuses). `change.id` absent = a game being added. The game window, the move sheet and Add game call it.
 */
export interface OrderChangeInput {
  games: readonly ScheduleGameLike[];
  change: Partial<ScheduleGameLike> & { id?: string };
  divisions: readonly (Named & { settings?: { game_duration_minutes?: unknown } | null })[];
  tournament?: { settings?: { game_duration_minutes?: unknown } | null } | null;
  teams: readonly Named[];
  field?: OrderField;
}

/** The pairs a one-game change creates, with the picture after it (null when it creates none). */
function orderChangeCheck(input: OrderChangeInput): {
  id: string; problems: OrderProblem[]; games: Map<string, OrderWordsGame>; lengths: OrderLengths;
} | null {
  const before = input.games.map(g => orderWordsGameOf(g, input.divisions, input.teams));
  const id = input.change.id ?? 'new:0';
  const base = input.games.find(g => g.id === id) ?? { id, divisionId: null, date: null, time: null };
  const defined = Object.fromEntries(Object.entries(input.change).filter(([, v]) => v !== undefined));
  const proposed = orderWordsGameOf({ ...base, ...defined, id } as ScheduleGameLike, input.divisions, input.teams);
  const after = [...before.filter(g => g.id !== id), proposed];
  const lengths = orderLengthsOf(input.divisions, input.tournament);
  const problems = newOrderProblems(before, after, lengths);
  if (!problems.length) return null;
  return { id, problems, games: new Map(after.map(g => [g.id, g])), lengths };
}

/**
 * The game window's red line for a one-game change (tab 3): the bold fact, the way out, and the save pill's held words
 * ("Not saved: Semifinal 2 isn’t over by then"); null when the change creates no problem.
 */
export function orderLineForChange(input: OrderChangeInput): (OrderWords & { pill: string }) | null {
  const c = orderChangeCheck(input);
  if (!c) return null;
  const w = orderRefusalWords({
    problems: c.problems, games: c.games, door: 'game', editedId: c.id, field: input.field ?? 'when', lengths: c.lengths,
  });
  return { lead: w.lead, rest: w.rest, pill: orderPillWords(pickOrderProblem(c.problems, c.id), c.games, c.id) };
}

/** The same judgement as one sentence (the server's `error`), or null. */
export function orderRefusalForChange(input: OrderChangeInput): string | null {
  const w = orderLineForChange(input);
  return w ? w.lead + w.rest : null;
}

/** The timeline's red spot for a drag (A4), or null: the reason chip's words. */
export function orderDragReasonForChange(input: OrderChangeInput): string | null {
  const c = orderChangeCheck(input);
  return c ? orderDragReason(c.problems.filter(p => p.sourceId === c.id || p.dependentId === c.id), c.games, c.id) : null;
}

/**
 * The pairs as an organizer counts them: a playoff game that starts before pool play ends is ONE problem, however many
 * pool games run late (the rule keeps one pair per pool game, A7); the latest-ending pool game speaks for it.
 */
export function orderIssuePairs(problems: readonly OrderProblem[]): OrderProblem[] {
  const out: OrderProblem[] = [];
  const pool = new Map<string, OrderProblem>();
  for (const p of problems) {
    if (p.kind !== 'pool') { out.push(p); continue; }
    const had = pool.get(p.dependentId);
    if (!had || p.sourceEnd > had.sourceEnd) pool.set(p.dependentId, p);
  }
  return [...out, ...pool.values()].sort((a, b) => a.dependentStart - b.dependentStart || b.sourceEnd - a.sourceEnd);
}

/**
 * A server reply's game-order refusal as the red line draws it (bold lead, then the way out), or null when the reply is
 * another refusal. The server sends `lead` beside `error` (`lib/tournament-overlap-guard.ts`).
 */
export function orderLineOfReply(body: unknown): OrderWords | null {
  const b = body as { code?: unknown; error?: unknown; lead?: unknown } | null;
  if (!b || b.code !== 'game-order' || typeof b.error !== 'string') return null;
  const lead = typeof b.lead === 'string' && b.error.startsWith(b.lead) ? b.lead : '';
  return { lead, rest: b.error.slice(lead.length) };
}

// ── The screens' words (Part 2 reads these; written here so the rule's sentences have one home) ──────────────────

// The chip on both games of a pair (A6) is `SCHEDULE_DAY_WORDS.conflicts.order`: the chip and the Filter row are one string.

/** The health window's issue row ("Playoff games out of order") and its detail for one pair. */
export const ORDER_ISSUE_TITLE = 'Playoff games out of order';

export function orderIssueWords(p: OrderProblem, games: ReadonlyMap<string, OrderWordsGame>): string {
  const dep = games.get(p.dependentId);
  const srcName = p.kind === 'pool' ? poolPlay(dep) : orderGameName(games.get(p.sourceId), { other: dep });
  // A day only when the two differ ("… starts on Sat, Nov 21 at 9:00 a.m., before Quarterfinal 2 ends on Sun, Nov 22 …").
  return fin(`${cap(orderGameName(dep, { other: games.get(p.sourceId) }))} starts ${at(p.dependentStart, p.sourceEnd)}, before ${srcName} ends ${at(p.sourceEnd, p.dependentStart)}`);
}

/** The game window's read view, under When, from this game's own side (A5). */
export function orderReadWords(p: OrderProblem, games: ReadonlyMap<string, OrderWordsGame>, gameId: string): OrderWords {
  const dep = games.get(p.dependentId);
  const pool = p.kind === 'pool';
  const srcName = pool ? poolPlay(dep) : orderGameName(games.get(p.sourceId), { other: dep });
  const depName = orderGameName(dep, { other: games.get(p.sourceId) });
  if (gameId === p.dependentId) {
    return {
      lead: 'Out of order.',
      rest: ` ${cap(srcName)} ends ${at(p.sourceEnd, p.dependentStart)}, after this game starts. Move this game to ${orLater(p.sourceEnd, p.dependentStart)}, or ${pool ? 'end pool play earlier' : `move ${srcName} earlier`}.`,
    };
  }
  return {
    lead: 'Out of order.',
    rest: ` ${cap(depName)} starts ${at(p.dependentStart, p.sourceEnd)}, before this game ends. Move this game earlier, or move ${depName} to ${orLater(p.sourceEnd, p.dependentStart)}.`,
  };
}

/** The timeline's red spot while dragging (A4): "Semifinal 2 runs until 4:30 p.m., so the Final can't go here". */
export function orderDragReason(
  list: readonly OrderProblem[],
  games: ReadonlyMap<string, OrderWordsGame>,
  draggedId: string,
): string {
  const p = pickOrderProblem(list, draggedId);
  const dep = games.get(p.dependentId);
  const srcName = p.kind === 'pool' ? poolPlay(dep) : orderGameName(games.get(p.sourceId), { other: dep });
  // "The semifinals run until 1:00 p.m.": the dragged game waits for several (tab 2).
  const mine = list.filter(q => q.dependentId === draggedId && q.kind !== 'pool');
  if (draggedId === p.dependentId && p.kind !== 'pool' && mine.length > 1) {
    const latest = Math.max(...mine.map(q => q.sourceEnd));
    return `${cap(sourcesPlural(mine.map(q => games.get(q.sourceId))))} run until ${clock(latest)}, so ${orderGameName(dep)} can’t go here`;
  }
  if (draggedId === p.dependentId) return `${cap(srcName)} runs until ${clock(p.sourceEnd)}, so ${orderGameName(dep, { other: games.get(p.sourceId) })} can’t go here`;
  const who = p.kind === 'pool' ? 'this game' : srcName;
  return `${cap(orderGameName(dep, { other: games.get(p.sourceId) }))} starts at ${clock(p.dependentStart)}, so ${who} can’t go here`;
}

/** The game window's save pill while an order line stands: "Not saved: Semifinal 2 isn't over by then". */
export function orderPillWords(p: OrderProblem, games: ReadonlyMap<string, OrderWordsGame>, gameId: string): string {
  const dep = games.get(p.dependentId);
  if (gameId === p.dependentId) {
    return `Not saved: ${p.kind === 'pool' ? 'pool play' : orderGameName(games.get(p.sourceId), { other: dep })} isn’t over by then`;
  }
  return `Not saved: ${orderGameName(dep, { other: games.get(p.sourceId) })} starts before this ends`;
}
