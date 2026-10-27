/**
 * league-time.ts — HOUSE LEAGUE'S TIME, read and said (Club Tier Stage 11b Part 3; frames k2 + k4, drawings
 * TdXm5jmTEJ9qPvR3T5H9qU tab "11b · club time"; words HOUSE_LEAGUE_STAGE9D2_11B_COPY.md). Client-safe, pure.
 *
 * The club gives House league its time as a whole (9d2·15); a league admin divides it from the house-league season: each
 * house-league slot is a division's GAME time, its PRACTICE time, or Not given yet (`league_slot_uses`, mig 392). The club
 * cuts its time into fixed slots, so a PART is the unit a league admin works with: one weekday, one start and end, one
 * facility, across the weeks ("Tuesdays · 7:30–9:00 p.m. · Diamond 1"). The window reads parts grouped twice:
 *   a STRETCH — one block of the club's schedule (org_time_blocks), titled by the time house league holds in it;
 *   a ROW — the stretch's parts with one use ("U12 games"), or Not given yet.
 *
 * ⚖ What the window holds (the server enforces the same in lib/league-time-server.ts):
 *   - live slots of FINAL schedules that house league holds (only a final schedule's slots can be divided: mig 392);
 *   - still to come (a slot that has started is history, never re-divided);
 *   - inside the season's dates when it has them (a use is owned by a SEASON: house league's time can span two);
 *   - never another season's slot (that season divides it).
 * A use waiting on a slot house league no longer holds (mig 393) is not a slot house league holds, so it never shows.
 */
import { formatTimeRange, isUuid, joinWithAnd, pluralize, possessive } from './utils.ts';
import { formatWeekRange } from './timezone.ts';
import { facilityListWords, hoursNumber, weekdayPlural, weekdaysWords } from './permit-words.ts';
import { houseLeagueUse } from './club-schedule-words.ts';

export type LeagueUseKind = 'games' | 'practices';
export interface LeagueUse { divisionId: string; kind: LeagueUseKind }

/** One house-league slot as the window reads it: its club day and clock already worked out in the club's zone. */
export interface LeagueTimeSlot {
  id: string;
  scheduleId: string;
  blockId: string | null;
  venueId: string;
  facilityId: string | null;
  /** The club day (YYYY-MM-DD) and its weekday, 1 = Monday. */
  day: string;
  weekday: number;
  /** "18:00" — the slot's clock in the club's zone. */
  start: string;
  end: string;
  use: LeagueUse | null;
}

export interface LeagueTimeSchedule { id: string; name: string; startsOn: string; endsOn: string }
export interface LeagueTimeDivision { id: string; name: string }

/** A part: one weekday, one clock and one facility across the weeks, with one use. */
export interface LeagueTimePart {
  key: string;
  weekday: number;
  start: string;
  end: string;
  /** The facility's name, or the venue's when the slot is the venue itself. */
  place: string;
  slotIds: string[];
  firstDay: string;
  lastDay: string;
  /** One week's minutes (one slot a week). */
  minutes: number;
  use: LeagueUse | null;
}

export interface LeagueTimeRow {
  /** `${divisionId}:${kind}`, or `open` for Not given yet. */
  key: string;
  use: LeagueUse | null;
  label: string;
  /** "Tue and Thu · 6:00–7:30 p.m. · Diamond 1 and Diamond 2" — joined with "; " when the parts aren't one shape. */
  detail: string;
  minutesAWeek: number;
  parts: LeagueTimePart[];
}

export interface LeagueTimeStretch { key: string; title: string; minutesAWeek: number; rows: LeagueTimeRow[] }

export interface LeagueTimeSource {
  scheduleId: string;
  name: string;
  /** "Jun 1 – Aug 31, 2027" */
  dates: string;
  /** The venues house league holds time at, in this schedule. */
  venues: string[];
  stretches: LeagueTimeStretch[];
}

/** A practice still to come on one of the window's slots — what giving that time back would remove. */
export interface LeagueTimePractice { slotId: string; divisionId: string; team: string }

/** What the route answers: every source the club gave, the season's divisions (Give it to's list), and the practices
 *  still to come on the time (the piece's question on Save names their teams). */
export interface LeagueTime {
  sources: LeagueTimeSource[];
  divisions: LeagueTimeDivision[];
  practices: LeagueTimePractice[];
}

export const keyOfUse = (u: LeagueUse | null) => (u ? `${u.divisionId}:${u.kind}` : 'open');

const minutesOf = (clock: string) => {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + (m || 0);
};
const clockOf = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const byName = (a: string, b: string) => a.localeCompare(b, 'en-CA', { numeric: true });

/** "6 hours a week", "1.5 hours a week", "1 hour a week" — every figure in the window. */
export const hoursAWeek = (minutes: number) => `${pluralize(hoursNumber(minutes), 'hour')} a week`;

/** "1.5 hours" — a part's own figure. */
export const hoursOf = (minutes: number) => pluralize(hoursNumber(minutes), 'hour');

/**
 * Some parts said as their shapes: each facility's touching clocks on a day joined ("6:00–7:30" + "7:30–9:00" →
 * "6:00–9:00 p.m."), then the days and facilities that share a clock gathered — "Tue and Thu · 6:00–7:30 p.m. · Diamond 1
 * and Diamond 2". Shapes that don't line up are each said, joined by "; ", Monday first.
 */
export function partsWords(parts: readonly Pick<LeagueTimePart, 'weekday' | 'start' | 'end' | 'place'>[]): string {
  // 1. Each (day, place)'s clocks, touching ones joined.
  const runs = new Map<string, { weekday: number; place: string; spans: [number, number][] }>();
  for (const p of parts) {
    const k = `${p.weekday}|${p.place}`;
    const r = runs.get(k) ?? { weekday: p.weekday, place: p.place, spans: [] };
    r.spans.push([minutesOf(p.start), minutesOf(p.end)]);
    runs.set(k, r);
  }
  // 2. Each clock's days and their places.
  const byClock = new Map<string, { start: number; end: number; days: Map<number, Set<string>> }>();
  for (const r of runs.values()) {
    const merged: [number, number][] = [];
    for (const s of [...r.spans].sort((a, b) => a[0] - b[0])) {
      const last = merged[merged.length - 1];
      if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
      else merged.push([s[0], s[1]]);
    }
    for (const [start, end] of merged) {
      const k = `${start}-${end}`;
      const c = byClock.get(k) ?? { start, end, days: new Map() };
      c.days.set(r.weekday, (c.days.get(r.weekday) ?? new Set()).add(r.place));
      byClock.set(k, c);
    }
  }
  // 3. Within a clock, the days that share the same places.
  const shapes: { firstDay: number; start: number; words: string }[] = [];
  for (const c of byClock.values()) {
    const byPlaces = new Map<string, { places: string[]; days: number[] }>();
    for (const [day, places] of c.days) {
      const sorted = [...places].sort(byName);
      const k = sorted.join('\u0000');
      const g = byPlaces.get(k) ?? { places: sorted, days: [] };
      g.days.push(day);
      byPlaces.set(k, g);
    }
    for (const g of byPlaces.values()) {
      const days = [...g.days].sort((a, b) => a - b);
      shapes.push({
        firstDay: days[0], start: c.start,
        words: `${weekdaysWords(days)} · ${formatTimeRange(clockOf(c.start), clockOf(c.end))} · ${facilityListWords(g.places)}`,
      });
    }
  }
  return shapes.sort((a, b) => a.firstDay - b.firstDay || a.start - b.start).map(s => s.words).join('; ');
}

/** A stretch's title: the days, the clock and the facilities house league holds in it, as one envelope. */
function stretchTitle(parts: readonly LeagueTimePart[]): string {
  const days = [...new Set(parts.map(p => p.weekday))];
  const start = Math.min(...parts.map(p => minutesOf(p.start)));
  const end = Math.max(...parts.map(p => minutesOf(p.end)));
  const places = [...new Set(parts.map(p => p.place))].sort(byName);
  return `${weekdaysWords(days)} · ${formatTimeRange(clockOf(start), clockOf(end))} · ${facilityListWords(places)}`;
}

/**
 * THE WINDOW'S READ: the slots grouped into sources (one per schedule), stretches (one per block) and rows (one per use,
 * Not given yet last). Rows follow the divisions' order, games before practice time. A slot whose division isn't in
 * `divisions` reads as Not given yet's neighbour under its own key, never dropped: it is still house league's time.
 */
export function groupLeagueTime(p: {
  slots: readonly LeagueTimeSlot[];
  schedules: readonly LeagueTimeSchedule[];
  divisions: readonly LeagueTimeDivision[];
  placeOf: (venueId: string, facilityId: string | null) => string;
  venueOf: (venueId: string) => string;
}): LeagueTimeSource[] {
  const divisionOrder = new Map(p.divisions.map((d, i) => [d.id, i]));
  const divisionName = new Map(p.divisions.map(d => [d.id, d.name]));
  const rowRank = (u: LeagueUse | null) =>
    (u ? (divisionOrder.get(u.divisionId) ?? p.divisions.length) * 2 + (u.kind === 'games' ? 0 : 1) : Number.MAX_SAFE_INTEGER);

  const sources: LeagueTimeSource[] = [];
  for (const schedule of p.schedules) {
    const mine = p.slots.filter(s => s.scheduleId === schedule.id);
    if (!mine.length) continue;
    // Parts: weekday + clock + place + use, across the weeks.
    const parts = new Map<string, LeagueTimePart & { blockKey: string }>();
    for (const s of [...mine].sort((a, b) => a.day.localeCompare(b.day) || a.start.localeCompare(b.start))) {
      const place = p.placeOf(s.venueId, s.facilityId);
      const blockKey = s.blockId ?? 'none';
      const key = `${blockKey}|${s.weekday}|${s.start}|${s.end}|${s.venueId}|${s.facilityId ?? ''}|${keyOfUse(s.use)}`;
      const part = parts.get(key);
      if (part) {
        part.slotIds.push(s.id);
        part.lastDay = s.day;
      } else {
        parts.set(key, {
          key, blockKey, weekday: s.weekday, start: s.start, end: s.end, place, slotIds: [s.id], firstDay: s.day, lastDay: s.day,
          minutes: minutesOf(s.end) - minutesOf(s.start), use: s.use,
        });
      }
    }
    // Stretches: one per block, in the order its first part comes in the week.
    const byBlock = new Map<string, LeagueTimePart[]>();
    for (const part of parts.values()) {
      const { blockKey, ...rest } = part;
      byBlock.set(blockKey, [...(byBlock.get(blockKey) ?? []), rest]);
    }
    const partOrder = (a: LeagueTimePart, b: LeagueTimePart) =>
      a.weekday - b.weekday || a.start.localeCompare(b.start) || byName(a.place, b.place);
    const stretches = [...byBlock.entries()].map(([blockKey, list]): LeagueTimeStretch => {
      list.sort(partOrder);
      const rows = new Map<string, LeagueTimePart[]>();
      for (const part of list) rows.set(keyOfUse(part.use), [...(rows.get(keyOfUse(part.use)) ?? []), part]);
      return {
        key: `${schedule.id}|${blockKey}`,
        title: stretchTitle(list),
        minutesAWeek: list.reduce((n, x) => n + x.minutes, 0),
        rows: [...rows.entries()]
          .map(([key, rowParts]): LeagueTimeRow => {
            const use = rowParts[0].use;
            return {
              key, use,
              label: use ? houseLeagueUse(divisionName.get(use.divisionId) ?? LEAGUE_TIME_WORDS.aDivision, use.kind) : LEAGUE_TIME_WORDS.notGiven,
              detail: partsWords(rowParts),
              minutesAWeek: rowParts.reduce((n, x) => n + x.minutes, 0),
              parts: rowParts,
            };
          })
          .sort((a, b) => rowRank(a.use) - rowRank(b.use)),
      };
    }).sort((a, b) => partOrder(a.rows[0].parts[0], b.rows[0].parts[0]));
    const venues = [...new Set(mine.map(s => p.venueOf(s.venueId)))].filter(Boolean).sort(byName);
    sources.push({ scheduleId: schedule.id, name: schedule.name, dates: formatWeekRange(schedule.startsOn, schedule.endsOn), venues, stretches });
  }
  return sources;
}

/** A Save names at most this many slots (a whole summer of three facilities a night is well under it). */
export const MAX_GIVE = 2000;

/**
 * ONE CHANGE: a slot, the use the window SAW on it (`from`), and the use it gets (`to`); null = Not given yet. `from` is
 * REQUIRED (/ux 2026-10-27): the SQL step (`league_slot_uses_apply`, mig 394) refuses `changed` unless each slot still
 * holds it, so a window left open while someone gave that time to another division never takes it back without a word.
 */
export interface LeagueTimeChange { slotId: string; from: LeagueUse | null; to: LeagueUse | null }

/** A use as a body carries it: `{ divisionId, kind }`, or null for Not given yet. Undefined when malformed or absent. */
function readUse(v: unknown): LeagueUse | null | undefined {
  if (v === null) return null;
  const u = (v ?? {}) as Record<string, unknown>;
  if ((u.kind === 'games' || u.kind === 'practices') && typeof u.divisionId === 'string' && isUuid(u.divisionId)) {
    return { divisionId: u.divisionId, kind: u.kind };
  }
  return undefined;
}

/** A Save's body, read: `{ changes: LeagueTimeChange[] }`, every slot once, each with its `from` and `to`. Null when
 *  malformed. The step applies every change or none (mig 394). */
export function readChangesBody(body: unknown): LeagueTimeChange[] | null {
  const list = ((body ?? {}) as Record<string, unknown>).changes;
  if (!Array.isArray(list) || !list.length || list.length > MAX_GIVE) return null;
  const changes: LeagueTimeChange[] = [];
  const seen = new Set<string>();
  for (const c of list) {
    const r = (c ?? {}) as Record<string, unknown>;
    if (typeof r.slotId !== 'string' || !isUuid(r.slotId) || seen.has(r.slotId) || !('from' in r) || !('to' in r)) return null;
    const from = readUse(r.from), to = readUse(r.to);
    if (from === undefined || to === undefined) return null;
    seen.add(r.slotId);
    changes.push({ slotId: r.slotId, from, to });
  }
  return changes;
}

/** A whole row given in one pick (Give it to): every slot of its parts, from the row's use to `to`. */
export const rowChanges = (row: Pick<LeagueTimeRow, 'use' | 'parts'>, to: LeagueUse | null): LeagueTimeChange[] =>
  row.parts.flatMap(p => p.slotIds.map(slotId => ({ slotId, from: row.use, to })));

/** The practices a Save removes: those still to come on a slot that stops being their division's practice time. */
export function practicesRemovedBy(changes: readonly LeagueTimeChange[], practices: readonly LeagueTimePractice[]): LeagueTimePractice[] {
  const to = new Map(changes.map(c => [c.slotId, c.to]));
  return practices.filter(p => to.has(p.slotId) && !(to.get(p.slotId)?.kind === 'practices' && to.get(p.slotId)?.divisionId === p.divisionId));
}

// ── A DIVISION'S PIECE (drawings "A piece's window", ruled 2026-10-27) ──────────────────────────────────────────────
// The piece's level groups parts by weekday + start + end + facility WITHOUT the use, so one part can be partly this
// division's (a mixed part, "8 of 12 dates") — the club extended a schedule, or a one-date Use changed one week. Its
// dates are this piece's (`mine`), Not given yet (`free`), or another division's (`held`). A part with nothing mine or
// free has no box; its holder is a link to that piece. Ticks STAGE; one Save sends every change (mig 394).

export interface PiecePart {
  /** The part without its use: stretch, weekday, clock, venue and facility. */
  key: string;
  weekday: number;
  start: string;
  end: string;
  place: string;
  minutes: number;
  mine: string[];
  free: string[];
  /** Other divisions' dates, the largest holder first. */
  held: { use: LeagueUse; slotIds: string[] }[];
}

export interface PieceDay { weekday: number; parts: PiecePart[] }
export interface PieceStretch { key: string; source: string; title: string; days: PieceDay[] }

/** A part's key without its use (the use is the key's last segment; `keyOfUse` never holds a `|`). */
const partKeyWithoutUse = (key: string) => key.slice(0, key.lastIndexOf('|'));
const sameUse = (a: LeagueUse | null, b: LeagueUse | null) => keyOfUse(a) === keyOfUse(b);

/** The piece's level: every stretch of every source, its parts by weekday, each part's dates sorted three ways. */
export function leaguePiece(sources: readonly LeagueTimeSource[], use: LeagueUse): PieceStretch[] {
  const stretches: PieceStretch[] = [];
  for (const source of sources) {
    for (const stretch of source.stretches) {
      const parts = new Map<string, PiecePart>();
      for (const row of stretch.rows) {
        for (const p of row.parts) {
          const key = partKeyWithoutUse(p.key);
          const part = parts.get(key) ?? {
            key, weekday: p.weekday, start: p.start, end: p.end, place: p.place, minutes: p.minutes, mine: [], free: [], held: [],
          };
          if (!p.use) part.free.push(...p.slotIds);
          else if (sameUse(p.use, use)) part.mine.push(...p.slotIds);
          else {
            const h = part.held.find(x => sameUse(x.use, p.use));
            if (h) h.slotIds.push(...p.slotIds); else part.held.push({ use: p.use, slotIds: [...p.slotIds] });
          }
          parts.set(key, part);
        }
      }
      const days = new Map<number, PiecePart[]>();
      for (const part of [...parts.values()].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start) || byName(a.place, b.place))) {
        part.held.sort((a, b) => b.slotIds.length - a.slotIds.length);
        days.set(part.weekday, [...(days.get(part.weekday) ?? []), part]);
      }
      stretches.push({
        key: stretch.key, source: source.name, title: stretch.title,
        days: [...days.entries()].map(([weekday, list]) => ({ weekday, parts: list })),
      });
    }
  }
  return stretches;
}

/** What a part is staged to become: all of its free dates taken, or all of this piece's given back. */
export type PieceStage = Readonly<Record<string, 'all' | 'none'>>;
export type Tick = 'on' | 'off' | 'mixed';

/** A part's box: null when it has none (nothing mine or free). Staged, then as it is. */
export function partTick(part: PiecePart, stage: PieceStage): Tick | null {
  if (!part.mine.length && !part.free.length) return null;
  const s = stage[part.key];
  if (s === 'all') return 'on';
  if (s === 'none') return 'off';
  return !part.mine.length ? 'off' : !part.free.length ? 'on' : 'mixed';
}

/** A group's box (a weekday, a stretch): its parts with boxes, all on, all off, or some. Null when none has a box. */
export function groupTick(parts: readonly PiecePart[], stage: PieceStage): Tick | null {
  const ticks = parts.map(p => partTick(p, stage)).filter((t): t is Tick => t !== null);
  if (!ticks.length) return null;
  return ticks.every(t => t === 'on') ? 'on' : ticks.every(t => t === 'off') ? 'off' : 'mixed';
}

/** Ticking a box: off or mixed → on (takes the free dates); on → off (gives this piece's back). A stage equal to how the
 *  part already is drops out, so the count is only real changes. */
export function stageParts(parts: readonly PiecePart[], stage: PieceStage, to: 'all' | 'none'): PieceStage {
  const next: Record<string, 'all' | 'none'> = { ...stage };
  for (const p of parts) {
    if (!p.mine.length && !p.free.length) continue;
    const noChange = to === 'all' ? !p.free.length : !p.mine.length;
    if (noChange) delete next[p.key]; else next[p.key] = to;
  }
  return next;
}

/** The box's own toggle: whatever is ticked (wholly) goes off; anything else comes on. */
export const toggleParts = (parts: readonly PiecePart[], stage: PieceStage): PieceStage =>
  stageParts(parts, stage, groupTick(parts, stage) === 'on' ? 'none' : 'all');

/** The Save: one change per date the stage moves. */
export function pieceChanges(stretches: readonly PieceStretch[], use: LeagueUse, stage: PieceStage): LeagueTimeChange[] {
  const changes: LeagueTimeChange[] = [];
  for (const part of stretches.flatMap(s => s.days.flatMap(d => d.parts))) {
    if (stage[part.key] === 'all') changes.push(...part.free.map(slotId => ({ slotId, from: null, to: use })));
    if (stage[part.key] === 'none') changes.push(...part.mine.map(slotId => ({ slotId, from: use, to: null })));
  }
  return changes;
}

/** The piece's figure: a week's hours of the parts it has (or is staged to have), a mixed part counted whole. */
export const pieceMinutes = (stretches: readonly PieceStretch[], stage: PieceStage) =>
  stretches.flatMap(s => s.days.flatMap(d => d.parts)).reduce((n, p) => n + (partTick(p, stage) === 'on' || partTick(p, stage) === 'mixed' ? p.minutes : 0), 0);

/**
 * Some parts said as days and clocks alone, no facilities (the time line): each weekday's clocks joined across its
 * facilities, then the days that share them gathered — "Tue and Thu, 6:00–7:30 p.m.", shapes joined by "; ".
 */
export function daysAndClocksWords(parts: readonly Pick<LeagueTimePart, 'weekday' | 'start' | 'end'>[]): string {
  const byDay = new Map<number, [number, number][]>();
  for (const p of parts) byDay.set(p.weekday, [...(byDay.get(p.weekday) ?? []), [minutesOf(p.start), minutesOf(p.end)]]);
  const shapes = new Map<string, { days: number[]; spans: [number, number][] }>();
  for (const [day, spans] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    const merged: [number, number][] = [];
    for (const s of [...spans].sort((a, b) => a[0] - b[0])) {
      const last = merged[merged.length - 1];
      if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]); else merged.push([s[0], s[1]]);
    }
    const k = merged.map(m => m.join('-')).join(',');
    const shape = shapes.get(k) ?? { days: [], spans: merged };
    shape.days.push(day);
    shapes.set(k, shape);
  }
  return [...shapes.values()]
    .map(s => `${weekdaysWords(s.days)}, ${joinWithAnd(s.spans.map(([a, b]) => formatTimeRange(clockOf(a), clockOf(b))))}`)
    .join('; ');
}

/** The time line under the Schedule page's title (ruled 2026-10-27, card 8): where a division's time comes from. Null
 *  `games` / `practices` drop their clause; no schedules at all is "no time from the club yet". */
export interface DivisionTimeLine { schedules: string[]; games: string | null; practices: string | null }

export function divisionTimeLine(sources: readonly LeagueTimeSource[], divisionId: string): DivisionTimeLine {
  const schedules: string[] = [];
  const of = (kind: LeagueUseKind) => sources.flatMap(s => s.stretches.flatMap(x => x.rows
    .filter(r => r.use?.divisionId === divisionId && r.use.kind === kind).flatMap(r => r.parts)));
  for (const s of sources) {
    if (s.stretches.some(x => x.rows.some(r => r.use?.divisionId === divisionId))) schedules.push(s.name);
  }
  const games = of('games'), practices = of('practices');
  return { schedules, games: games.length ? daysAndClocksWords(games) : null, practices: practices.length ? daysAndClocksWords(practices) : null };
}

/** The time line said: "U12’s time comes from the club’s schedule, {A}. Games: … Practice time: …" (the link follows). */
export function timeLineWords(division: string, line: DivisionTimeLine): { lead: string; schedules: string[]; tail: string } | null {
  if (!line.schedules.length) return null;
  // A clause ends in its clock's own "p.m." — never a second period after it.
  const end = (s: string) => (s.endsWith('.') ? s : `${s}.`);
  const clauses = [line.games && end(`Games: ${line.games}`), line.practices && end(`Practice time: ${line.practices}`)].filter(Boolean);
  return {
    lead: `${possessive(division)} time comes from the club’s ${line.schedules.length > 1 ? 'schedules' : 'schedule'}, `,
    schedules: line.schedules,
    tail: `. ${clauses.join(' ')}`,
  };
}

/** The window's whole figure: every hour house league holds in a week, across the sources. */
export const leagueTimeMinutes = (sources: readonly LeagueTimeSource[]) =>
  sources.reduce((n, s) => n + s.stretches.reduce((m, x) => m + x.minutesAWeek, 0), 0);

/** Not given yet, anywhere: something to give. */
export const hasNotGiven = (sources: readonly LeagueTimeSource[]) =>
  sources.some(s => s.stretches.some(x => x.rows.some(r => !r.use)));

/** Words. The settled ones are HOUSE_LEAGUE_STAGE9D2_11B_COPY.md's (k2, k4); [marketing] marks the build's own. */
export const LEAGUE_TIME_WORDS = {
  title: 'House league’s time',
  source: (schedule: string, dates: string, venues: readonly string[]) =>
    ['Given by the club in ' + schedule, dates, joinWithAnd([...venues])].filter(Boolean).join(' · '),
  hoursLine: 'Hours add up across facilities: 3 hours on 2 facilities is 6.',
  notGiven: 'Not given yet',
  giveItTo: 'Give it to',
  foot: 'Only an owner or an admin changes how much time house league has.',
  done: 'Done',
  close: 'Close',
  /** k4, adapted to this window (owner 2026-10-27): a league admin when the club gave nothing — no link. */
  noneGivenLeagueAdmin: 'The club hasn’t given house league any time yet. An owner or an admin gives it, in Schedules.',
  /** k4's owner-or-admin sentence and door, where they are true here: everything divided (the door ends the body). */
  noneLeftClub: 'House league has no time left to give.',
  giveMore: 'Give house league more time',
  /** [marketing] An owner or an admin when the club gave nothing (/ux + /design 2026-10-27: "no time left" and "more"
   *  were k4's words for a different moment). The sentence is the league admin's first, the lime door names the act. */
  noneGivenClub: 'The club hasn’t given house league any time yet.',
  noneGivenClubHint: 'Give it some from one of the club’s permits, then come back here.',
  giveSome: 'Give house league time',
  nothingSaved: 'Nothing is saved yet.',
  /** [marketing] a division that is no longer the season's, still holding a piece. */
  aDivision: 'Former division',
  /** [marketing] the read, refused or failed. */
  loadFailed: 'House league’s time didn’t load. Try again.',
  giveFailed: 'That change wasn’t saved. Try again.',
  /** The door to the club's schedule, on the source line's schedule name (club view, drawn tab 5). */
  openSchedule: (schedule: string) => `Open ${schedule}`,
  /** Give it to's last item, after the pairs and a separator (ruled card 2). [marketing] */
  chooseParts: 'Choose parts…',
  /** The piece's level (drawings "A piece's window"). */
  piece: {
    /** The two kinds' hints (settled in the drawing). */
    hint: (division: string, kind: LeagueUseKind) =>
      `Tick the time for ${possessive(division)} ${kind === 'games' ? 'games' : 'practices'}. A tick gives it to ${division} when you save. Unticked time goes back to Not given yet.`,
    open: (label: string) => `Open ${label}`,
    /** [marketing] */
    ofDates: (n: number, of: number) => `${n} of ${of} dates`,
    /** [marketing] */
    giveAllBack: 'Give all of it back',
    /** [marketing] the foot's count. */
    changes: (n: number) => pluralize(n, 'change'),
    cancel: 'Cancel',
    save: 'Save',
    /** The tick on a weekday's line and a stretch's heading, for a screen reader. */
    tickAll: (what: string) => `All of ${what}`,
    /** A part another division holds: a link to that piece (ruled card 5). */
    heldBy: (label: string) => `${label} ›`,
    /** [marketing] The registrar's read when the piece holds nothing. */
    nothing: (label: string) => `${label} has no time yet.`,
  },
  /** The question on Save when practices still to come sit on time being given back (ruled card 6). [marketing] */
  ask: {
    title: (division: string, kind: LeagueUseKind, parts: number, all: boolean) => {
      const piece = `${possessive(division)} ${kind === 'games' ? 'games' : 'practice time'}`;
      return all ? `Give back all of ${piece}?` : `Give back ${pluralize(parts, 'part')} of ${piece}?`;
    },
    body: (minutes: number) => `That time, ${hoursAWeek(minutes)}, goes back to Not given yet.`,
    note: (teams: readonly string[]) =>
      `${joinWithAnd([...teams])} ${teams.length === 1 ? 'has' : 'have'} practices on this time. Saving removes the ones still to come. Past practices stay.`,
    confirm: (n: number) => `Save and remove ${pluralize(n, 'practice')}`,
    /** The club's schedule's one-date Use (tab 5): the same question, one date. */
    titleOneDate: (date: string) => `Change ${date}?`,
    bodyOneDate: 'That date stops being this division’s practice time.',
  },
  /** Choose parts…'s small step: whose piece to open (ruled card 2). [marketing] */
  choose: {
    title: 'Choose parts',
    hint: 'Whose time are you choosing?',
    next: 'Choose the parts',
  },
  /** The time line under the Schedule page's title (ruled card 8; settled except where marked). */
  line: {
    none: (division: string) => `${division} has no time from the club yet.`,
    door: 'House league’s time →',
    /** [marketing] a phone's one line. */
    phone: 'Time from the club’s schedule',
  },
  /** Tools on the house-league Schedule page (ruled card 7). */
  tools: 'Tools',
  exportHeading: 'Export',
  excel: 'Excel',
  csv: 'CSV',
  calendar: 'Calendar file',
} as const;

/** A part as the piece's level says it: "6:00–7:30 p.m. · Diamond 1" under its weekday's line ("Tuesdays"). */
export const piecePartWords = (p: Pick<PiecePart, 'start' | 'end' | 'place'>) => `${formatTimeRange(p.start, p.end)} · ${p.place}`;
export const pieceDayWords = (weekday: number) => weekdayPlural(weekday);

/** [marketing] The routes' refusals, one sentence each (`error`). */
export const LEAGUE_TIME_REFUSALS = {
  notFound: 'That season or division isn’t this club’s.',
  seasonClosed: 'This season is finished, so its time can’t change.',
  changed: 'House league’s time changed while you were looking. Here it is again.',
  badRequest: 'Pick the time to give, and who it goes to.',
  /** [marketing] The club's schedule's one-date Use, when that date changed (drawn tab 5, b2). */
  changedOneDate: 'That time changed while you were looking. Close this and try again.',
} as const;
