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
import { formatTimeRange, isUuid, joinWithAnd, pluralize } from './utils.ts';
import { formatWeekRange } from './timezone.ts';
import { facilityListWords, hoursNumber, weekdaysWords } from './permit-words.ts';
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

/** What the route answers: every source the club gave, and the season's divisions (Give it to's list). */
export interface LeagueTime {
  sources: LeagueTimeSource[];
  divisions: LeagueTimeDivision[];
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

/** A give names at most this many slots (a whole summer of three facilities a night is well under it). */
export const MAX_GIVE = 2000;

/** A use as a body carries it: `{ divisionId, kind }`, or null for Not given yet. Undefined when malformed. */
function readUse(v: unknown): LeagueUse | null | undefined {
  if (v === null) return null;
  const u = (v ?? {}) as Record<string, unknown>;
  if ((u.kind === 'games' || u.kind === 'practices') && typeof u.divisionId === 'string' && isUuid(u.divisionId)) {
    return { divisionId: u.divisionId, kind: u.kind };
  }
  return undefined;
}

/**
 * A give's body, read: the slots, who they go to (`kind` null = back to Not given yet), and `from` — the use the window
 * saw on every one of them (null = Not given yet). `from` is REQUIRED (/ux 2026-10-27): the SQL step overwrites whoever
 * holds a slot, so a window left open while someone gave that time to another division would take it back without a
 * word. The server refuses `changed` unless each slot still holds `from`. Null when malformed.
 */
export function readGiveBody(body: unknown): { slotIds: string[]; divisionId: string | null; kind: LeagueUseKind | null; from: LeagueUse | null } | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const slotIds = Array.isArray(b.slotIds) ? [...new Set(b.slotIds.filter((x): x is string => typeof x === 'string'))] : [];
  if (!slotIds.length || slotIds.length > MAX_GIVE || !slotIds.every(isUuid)) return null;
  const kind = b.kind === 'games' || b.kind === 'practices' ? b.kind : b.kind == null ? null : undefined;
  if (kind === undefined) return null;
  const divisionId = typeof b.divisionId === 'string' && isUuid(b.divisionId) ? b.divisionId : null;
  if (kind && !divisionId) return null;
  if (!('from' in b)) return null;
  const from = readUse(b.from);
  if (from === undefined) return null;
  return { slotIds, divisionId: kind ? divisionId : null, kind, from };
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
} as const;

/** [marketing] The routes' refusals, one sentence each (`error`). */
export const LEAGUE_TIME_REFUSALS = {
  notFound: 'That season or division isn’t this club’s.',
  seasonClosed: 'This season is finished, so its time can’t change.',
  changed: 'House league’s time changed while you were looking. Here it is again.',
  badRequest: 'Pick the time to give, and who it goes to.',
} as const;
