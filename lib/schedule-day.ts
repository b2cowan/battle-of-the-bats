/**
 * THE SCHEDULE'S DAY — what the tournament schedule opens on and how it narrows (Tournament admin redesign Stage 3,
 * S1 + A33, ruled 2026-10-09). Pure: the page, the toolbar and a unit test read the same answers.
 *
 *   · The opening: today while the event is on, its first day before it, its last day after it.
 *   · The day: EVERY game of the day — both divisions, both stages, every state — in time order. Today's schedule
 *     showed one division, one stage and unplayed games only (F66), and a waiting score or a forfeit matched no
 *     filter at all (F67).
 *   · One state per game, in Stage 1's words (G5): the board's play-window rule decides Playing now / Needs a score.
 *   · The Filter narrows by Division · Stage · Status · the sport's field, several choices each, quiet until used, and
 *     is not remembered between visits (1 October: nothing on screen would say why the list is short).
 */
import type { Division, Game, Tournament } from './types';
import { resolveGameTiming } from './schedule-conflict.ts';
import { gameWindowState } from './game-live-state.ts';
import { addCalendarDays } from './timezone.ts';

export type ScheduleView = 'day' | 'all' | 'timeline' | 'bracket';
export type ScheduleStage = 'pool' | 'playoff';
/** One state per game (G5's words live in lib/schedule-words.ts SCHEDULE_DAY_WORDS.states). */
export type ScheduleState = 'needsScore' | 'pendingReview' | 'playingNow' | 'scheduled' | 'final' | 'forfeit' | 'cancelled';
/** The Filter's Status order — what an organizer acts on first. */
export const SCHEDULE_STATES: readonly ScheduleState[] = ['needsScore', 'pendingReview', 'playingNow', 'scheduled', 'final', 'forfeit', 'cancelled'];

/**
 * A game's state now. A cancelled game is cancelled; a played one Final or Forfeit; a score waiting for the organizer
 * Pending Review; an unscored game Playing now inside its window (THE length chain, A39), Needs a score after it,
 * Scheduled before it.
 */
export function scheduleStateOf(
  g: Pick<Game, 'status' | 'date' | 'time' | 'divisionId' | 'durationMinutes'>,
  divisions: readonly Division[],
  tournament: Tournament | null | undefined,
  nowMs: number,
  today: string,
): ScheduleState {
  if (g.status === 'cancelled') return 'cancelled';
  if (g.status === 'forfeit') return 'forfeit';
  if (g.status === 'completed') return 'final';
  if (g.status === 'submitted') return 'pendingReview';
  const { durationMinutes } = resolveGameTiming(divisions.find(d => d.id === g.divisionId), tournament, g.durationMinutes);
  const w = gameWindowState({ date: g.date, time: g.time, durationMinutes, nowMs, today });
  return w === 'live' ? 'playingNow' : w === 'overdue' ? 'needsScore' : 'scheduled';
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** A sane cap on the event's stated span (a typo'd end date must not make a year of empty days). */
const MAX_SPAN_DAYS = 31;

/**
 * The event's days, in order: every day of its stated span (start → end) and every day a game is on — a game moved
 * outside the span still has a day to step to. A day with no game inside the span is still a day (the arrows step
 * Thursday → Friday → Saturday whether or not Friday has games yet).
 */
export function eventDays(
  games: ReadonlyArray<Pick<Game, 'date'>>,
  tournament: Pick<Tournament, 'startDate' | 'endDate'> | null | undefined,
): string[] {
  const set = new Set<string>();
  const start = tournament?.startDate && DATE.test(tournament.startDate) ? tournament.startDate : null;
  const end = tournament?.endDate && DATE.test(tournament.endDate) ? tournament.endDate : start;
  if (start && end && end >= start) {
    for (let day = start, n = 0; day <= end && n < MAX_SPAN_DAYS; day = addCalendarDays(day, 1), n++) set.add(day);
  } else if (start) {
    set.add(start);
  }
  for (const g of games) if (g.date && DATE.test(g.date)) set.add(g.date);
  return Array.from(set).sort();
}

/** What the schedule opens on (A33): today while the event is on, its first day before it, its last after it. */
export function openingDay(days: readonly string[], today: string): string {
  if (days.length === 0) return today;
  if (days.includes(today)) return today;
  if (today < days[0]) return days[0];
  if (today > days[days.length - 1]) return days[days.length - 1];
  // Between two of the event's days (a gap in a long event): the next one.
  return days.find(d => d > today) ?? days[days.length - 1];
}

/** The day before / after `day` among the event's days, or null at either end. */
export function stepDay(days: readonly string[], day: string, dir: -1 | 1): string | null {
  const at = days.indexOf(day);
  if (at < 0) {
    const next = dir > 0 ? days.find(d => d > day) : [...days].reverse().find(d => d < day);
    return next ?? null;
  }
  return days[at + dir] ?? null;
}

// ── The Filter ────────────────────────────────────────────────────────────────────────────────────────────────

export interface ScheduleFilter {
  divisions: readonly string[];
  stages: readonly ScheduleStage[];
  states: readonly ScheduleState[];
  /** Field keys (`fieldKeyOf`). */
  fields: readonly string[];
}
/** Nothing ticked: every game shows (the point of F67). */
export const NO_SCHEDULE_FILTER: ScheduleFilter = { divisions: [], stages: [], states: [], fields: [] };

/** How many groups narrow the list — "Filter, N on". */
export function filtersOn(f: ScheduleFilter): number {
  return [f.divisions, f.stages, f.states, f.fields].filter(group => group.length > 0).length;
}

/** One key per field a game can be on: the venue's facility, a whole venue, a temporary lane, or typed words. */
export function fieldKeyOf(g: Pick<Game, 'venueId' | 'venueFacilityId' | 'scheduleFacilityLaneId' | 'location'>): string {
  if (g.venueId) return g.venueFacilityId ? `venue:${g.venueId}:${g.venueFacilityId}` : `venue:${g.venueId}`;
  if (g.scheduleFacilityLaneId) return `lane:${g.scheduleFacilityLaneId}`;
  return `custom:${(g.location || '').trim().toLowerCase() || '__none__'}`;
}

/** Does a game pass the Filter? An empty group passes everything; a ticked group passes what it ticks. */
export function matchesScheduleFilter(
  g: Pick<Game, 'divisionId' | 'isPlayoff' | 'venueId' | 'venueFacilityId' | 'scheduleFacilityLaneId' | 'location'>,
  state: ScheduleState,
  f: ScheduleFilter,
): boolean {
  if (f.divisions.length > 0 && !f.divisions.includes(g.divisionId)) return false;
  if (f.stages.length > 0 && !f.stages.includes(g.isPlayoff ? 'playoff' : 'pool')) return false;
  if (f.states.length > 0 && !f.states.includes(state)) return false;
  if (f.fields.length > 0 && !f.fields.includes(fieldKeyOf(g))) return false;
  return true;
}

/** Search: a team's name (or its slot's words) contains the text. */
export function matchesScheduleSearch(homeName: string, awayName: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === '' || homeName.toLowerCase().includes(q) || awayName.toLowerCase().includes(q);
}

/** Time order: the day, then the start (an untimed game last on its day), then the field's words, then the id. */
function byStart(
  a: Pick<Game, 'id' | 'date' | 'time'> & { field?: string },
  b: Pick<Game, 'id' | 'date' | 'time'> & { field?: string },
): number {
  return (a.date || '9999-99-99').localeCompare(b.date || '9999-99-99')
    || (a.time || '99:99').localeCompare(b.time || '99:99')
    || (a.field ?? '').localeCompare(b.field ?? '')
    || a.id.localeCompare(b.id);
}

/** All games, by day: each day's games in time order, then the games with no day yet. */
export function gamesByDay<G extends Pick<Game, 'id' | 'date' | 'time'>>(games: readonly G[]): Array<{ day: string | null; games: G[] }> {
  const map = new Map<string | null, G[]>();
  for (const g of games) {
    const key = g.date && DATE.test(g.date) ? g.date : null;
    const list = map.get(key);
    if (list) list.push(g); else map.set(key, [g]);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b)))
    .map(([day, list]) => ({ day, games: [...list].sort(byStart) }));
}
