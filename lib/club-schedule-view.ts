/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB SCHEDULER'S SCREENS — what the page draws, worked out once (Club Tier Stage 11a, part B; hub
 * K4MPu4ni53Ct7yrDcmWJd9 → Mockups → Stages 10 + 11, specimens 4–15). Pure and client-safe: the grid's columns and rows,
 * a one-weekday schedule's dates across (Ask 27, R12), the step through the weeks, the team's colour (R4), the summary
 * line, the closing row's words, the facility noun, prime time in words. The SERVER is the one that decides what a share
 * comes to (`/api/admin/schedules/generate` `previewOnly`) and what the bill is (`computeBill`); nothing here re-decides
 * either — it lays out what the server answered.
 *
 * ⚖ THE GRID IS 6c SPECIMEN 4'S, NOT THE TIMELINE'S AXES (P11-01, Ask 12): facilities down, a week across, each day's
 * slots in clock order, an open slot drawn. A schedule whose time falls on ONE weekday reads that weekday's dates
 * across, seven at a time ("Oct 4 – Nov 15, 2026") — the week grid would draw six empty days and squeeze a Sunday's
 * twelve slots into one column (Ask 27).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { addCalendarDays, formatShortWeekdayDate, formatWeekRange, mondayOfDay, utcToZonedInputs } from './timezone';
import { formatTime, formatTimeRange, joinWithAnd, pluralize } from './utils';
import { weekdayCount, weekdayOne, weekdaysShort } from './permit-words';
import { moveLanding, type PrimeTime, type ScheduleSettings, type slotHolds } from './club-schedule-settings';
import { teamColor } from './team-color';
import type { Slot } from './club-schedule-engine';
import { billShares, pricedMinutes, type BillSlot } from './club-schedule-bill';
import type { ScheduleAsk, ScheduleListRow, ScheduleView, SlotView } from './club-schedule-server';

export type { ScheduleAsk, ScheduleListRow, ScheduleView, SlotView };
export type ScheduleTeam = ScheduleView['teams'][number];
export type SchedulePlace = ScheduleView['places'][number];

// ── The team's colour (R4) ────────────────────────────────────────────────────────────────────────

/** A team's colour: its own (`rep_teams.color`), else the house's colour for its name (`teamColor`, the one every
 *  generated team colour in the product comes from). */
export function teamColour(teams: readonly Pick<ScheduleTeam, 'id' | 'color' | 'name'>[], teamId: string): string {
  const t = teams.find(x => x.id === teamId);
  const own = t?.color ?? null;
  if (own && /^#?[0-9a-f]{3,8}$/i.test(own)) return own.startsWith('#') ? own : `#${own}`;
  return teamColor(t?.name ?? teamId);
}

// ── Groups and shares ─────────────────────────────────────────────────────────────────────────────

/** The group key of a team in no group — one sentinel for every screen that bands teams by group. */
export const NO_GROUP = '~none';

/** "38%" — a part of a whole, said whole; nothing when the whole is nothing. */
export const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '');

// ── The places ────────────────────────────────────────────────────────────────────────────────────

/** A grid row: one facility (or a venue with none), in the venue's own order. */
export interface PlaceRow { key: string; venueId: string; facilityId: string | null; name: string; venueName: string }

export const placeKey = (venueId: string, facilityId: string | null) => `${venueId}|${facilityId ?? ''}`;

/** The rows the grid draws: every place the schedule's slots stand on, in the venue's order. */
export function placeRows(places: readonly SchedulePlace[], slots: readonly Pick<SlotView, 'venueId' | 'facilityId'>[]): PlaceRow[] {
  const used = new Set(slots.map(s => placeKey(s.venueId, s.facilityId)));
  const out: PlaceRow[] = [];
  for (const p of places) {
    if (used.has(placeKey(p.venueId, null))) out.push({ key: placeKey(p.venueId, null), venueId: p.venueId, facilityId: null, name: p.venueName, venueName: p.venueName });
    for (const f of p.facilities) {
      const key = placeKey(p.venueId, f.id);
      if (used.has(key)) out.push({ key, venueId: p.venueId, facilityId: f.id, name: f.name, venueName: p.venueName });
    }
  }
  return out;
}

/** "Lane 1", or the venue when the slot has no facility — a slot's place in a line. */
export function placeName(places: readonly SchedulePlace[], venueId: string, facilityId: string | null): string {
  const v = places.find(p => p.venueId === venueId);
  if (!facilityId) return v?.venueName ?? '';
  return v?.facilities.find(f => f.id === facilityId)?.name ?? '';
}

/**
 * The word a schedule's places share, plural for the summary: "lanes" for Lane 1 and Lane 2, "fields" for Field 1–6 —
 * the club's own word on its own facilities (at a club venue the facility's kind beats the sport). Names that share no
 * word read "facilities".
 */
export function facilityNoun(names: readonly string[], count: number): string {
  const words = [...new Set(names.map(n => /^(\D+?)\s*\d+$/.exec(n.trim())?.[1]?.trim().toLowerCase() ?? ''))];
  const word = words.length === 1 && words[0] ? words[0] : 'facility';
  if (count === 1) return word;
  return word === 'facility' ? 'facilities' : /(s|x|ch|sh)$/.test(word) ? `${word}es` : `${word}s`;
}

// ── The grid's columns: a week, or one weekday's dates across (Ask 27) ─────────────────────────────

/** The one weekday every slot falls on, or null (the week grid). */
export function oneWeekdayOf(slots: readonly Pick<SlotView, 'weekday'>[]): number | null {
  if (!slots.length) return null;
  const first = slots[0].weekday;
  return slots.every(s => s.weekday === first) ? first : null;
}

/** Every date of `weekday` from the schedule's first to its last day — a date off reads "—" on the grid, never hidden. */
export function weekdayDates(startsOn: string, endsOn: string, weekday: number): string[] {
  const monday = mondayOfDay(startsOn);
  let d = addCalendarDays(monday, weekday - 1);
  if (d < startsOn) d = addCalendarDays(d, 7);
  const out: string[] = [];
  for (; d <= endsOn && out.length < 80; d = addCalendarDays(d, 7)) out.push(d);
  return out;
}

export interface GridColumns {
  /** The dates the columns head, in order. */
  days: string[];
  /** "Jan 4 – 10, 2027" / "Oct 4 – Nov 15, 2026" (C8), and without the year for a phone. */
  range: string;
  rangeShort: string;
  /** The dates mode reads dates; the week mode reads a week (the arrows' words). */
  mode: 'week' | 'dates';
  canBack: boolean;
  canForward: boolean;
}

/**
 * THE COLUMNS for a cursor. Week mode: the cursor's Monday to Sunday (C2). Dates mode (a one-weekday schedule): seven of
 * its dates from the cursor, the cursor snapped to a date of the run. The arrows stop at the schedule's ends.
 */
export function gridColumns(p: { startsOn: string; endsOn: string; oneWeekday: number | null; cursor: string }): GridColumns {
  if (p.oneWeekday == null) {
    const from = mondayOfDay(p.cursor);
    const days = Array.from({ length: 7 }, (_, i) => addCalendarDays(from, i));
    return {
      days, mode: 'week',
      range: formatWeekRange(days[0], days[6]), rangeShort: formatWeekRange(days[0], days[6], false),
      canBack: days[0] > p.startsOn, canForward: days[6] < p.endsOn,
    };
  }
  const all = weekdayDates(p.startsOn, p.endsOn, p.oneWeekday);
  const found = all.findIndex(d => d >= p.cursor);
  const at = found < 0 ? Math.max(0, all.length - 1) : found;
  const start = Math.min(at - (at % 7), Math.max(0, all.length - 1));
  const days = all.slice(start, start + 7);
  const last = days[days.length - 1] ?? p.cursor;
  return {
    days, mode: 'dates',
    range: formatWeekRange(days[0] ?? p.cursor, last), rangeShort: formatWeekRange(days[0] ?? p.cursor, last, false),
    canBack: start > 0, canForward: start + 7 < all.length,
  };
}

/** The cursor one step back or forward: a week, or seven dates. */
export function stepGrid(p: { startsOn: string; endsOn: string; oneWeekday: number | null; cursor: string }, dir: -1 | 1): string {
  if (p.oneWeekday == null) return addCalendarDays(mondayOfDay(p.cursor), dir * 7);
  const cols = gridColumns(p);
  return addCalendarDays(cols.days[0] ?? p.cursor, dir * 49);
}

/** Where the page opens: the week (or the seven dates) holding today while the schedule runs, else its first. */
export function firstCursor(startsOn: string, endsOn: string, today: string): string {
  return today >= startsOn && today <= endsOn ? today : startsOn;
}

/**
 * A PHONE READS ONE DAY AT A TIME (owner, 2026-10-12, walk §300: "it should only toggle days with actual events"): the
 * dates the schedule has slots on, in order — a Sundays-only schedule steps Sunday to Sunday, and a date off is never a
 * stop. A day whose slots are all open still counts: its time is still the club's.
 */
export function slotDays(slots: readonly Pick<SlotView, 'day'>[]): string[] {
  return [...new Set(slots.map(s => s.day))].sort();
}

/** Where a phone's Day opens: the first day with slots on or after today while the schedule runs (the last one when none
 *  is left), else its first — `firstCursor`'s rule, a day instead of a week. */
export function openingDay(days: readonly string[], startsOn: string, endsOn: string, today: string): string | null {
  if (!days.length) return null;
  if (today >= startsOn && today <= endsOn) return days.find(d => d >= today) ?? days[days.length - 1];
  return days[0];
}

/** A place's slots on a day, in clock order. */
/** Every slot by its cell — a place's row and a day (`cellKey`) — each cell in clock order. Built once per read, never
 *  per cell: a grid draws rows × 7 cells over every slot the schedule holds. */
export function slotsByCell<T extends Pick<SlotView, 'venueId' | 'facilityId' | 'day' | 'startsAt'>>(slots: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const s of slots) {
    const key = cellKey(placeKey(s.venueId, s.facilityId), s.day);
    (out.get(key) ?? out.set(key, []).get(key)!).push(s);
  }
  for (const list of out.values()) list.sort((x, y) => x.startsAt.localeCompare(y.startsAt));
  return out;
}

export const cellKey = (rowKey: string, day: string) => `${rowKey}|${day}`;

// ── A slot, in words ──────────────────────────────────────────────────────────────────────────────

/** "6:00–7:00 p.m." — a slot's range (R9: a club-wide page asks about overlap, so the end matters). */
export const slotTime = (s: Pick<SlotView, 'startClock' | 'endClock'>) => formatTimeRange(s.startClock, s.endClock);

/** "Tryout day · 13U AAA" — a slot a booking already holds, drawn as that booking. */
export function heldWords(h: NonNullable<SlotView['heldBy']>): string {
  const what = h.kind === 'tryout' ? 'Tryout day' : h.kind === 'game' ? 'Game' : h.kind === 'practice' ? 'Practice' : 'Booked';
  return `${what} · ${h.ownerName}`;
}

/** "Mon, Tue, Wed" — a team's usual nights. */
export const nightsWords = (nights: readonly number[]) => (nights.length ? weekdaysShort(nights) : '—');

/** "Weeknights, 6:00–8:00 p.m." — the hours that count as prime time. */
export function primeWords(prime: Pick<PrimeTime, 'weekdays' | 'start' | 'end'> | null): string {
  if (!prime) return 'None';
  const d = [...prime.weekdays].sort((a, b) => a - b).join(',');
  const days = d === '1,2,3,4,5' ? 'Weeknights' : d === '6,7' ? 'Weekends' : d === '1,2,3,4,5,6,7' ? 'Every day' : weekdaysShort(prime.weekdays);
  return `${days}, ${formatTimeRange(prime.start, prime.end)}`;
}

/** The day sets the Prime time field offers, in its order. */
export const PRIME_DAYS: { id: string; label: string; days: number[] }[] = [
  { id: 'weeknights', label: 'Weeknights', days: [1, 2, 3, 4, 5] },
  { id: 'weekends', label: 'Weekends', days: [6, 7] },
  { id: 'every', label: 'Every day', days: [1, 2, 3, 4, 5, 6, 7] },
];

// ── New schedule's step 1: the summary line and the closing row ────────────────────────────────────

/** What `previewOnly` answers — the server's own count of the time and each share (`/api/admin/schedules/generate`). */
export interface GenerateSummary {
  weeks: number;
  facilities: number;
  slots: number;
  perWeek: number;
  seats: number;
  held: number;
  heldBy: string[];
  /** Who holds them and with what ("13U AAA" · tryout). */
  heldWhat: { name: string; kind: string | null }[];
  /** Each team's practices its share comes to (Stage 11c: a team that shares holds more of them for the same share). */
  targets: { teamId: string; slots: number; prime: number }[];
  /** The slots the shares fill — a shared slot once (fewer than the practices `targets` add up to, when teams share). */
  handedOut: number;
  open: number;
  /** The time's half facilities — a sharing rule never shares one. */
  half: string[];
  kept: number;
  notKept: number;
}

/** [marketing] "12 weeks · 2 lanes · 30 slots a week · 354 slots" / "25 Sundays · 6 fields · 12 slots a Sunday · 300 slots". */
export function summaryLine(s: GenerateSummary, oneWeekday: number | null, noun: string): string {
  return [
    oneWeekday ? weekdayCount(s.weeks, oneWeekday) : pluralize(s.weeks, 'week'),
    `${s.facilities} ${noun}`,
    oneWeekday ? `${s.perWeek} slots a ${weekdayOne(oneWeekday)}` : `${s.perWeek} slots a week`,
    pluralize(s.slots, 'slot'),
  ].join(' · ');
}

/** [marketing] Who holds the slots a booking already holds: "13U AAA’s tryout day" (one), else "bookings already on the books". */
export function heldByWords(s: Pick<GenerateSummary, 'heldWhat'>): string {
  if (s.heldWhat.length !== 1) return 'bookings already on the books';
  const h = s.heldWhat[0];
  const what = h.kind === 'tryout' ? 'tryout day' : h.kind === 'game' ? 'game' : h.kind === 'practice' ? 'practice' : 'booking';
  return `${h.name}’s ${what}`;
}

/**
 * [marketing] The closing row's note (specimen 4): what is left open, and what a booking holds — said in the table,
 * never as a warning above it. By percentage it says the percent left open, or how far over 100% the shares go (which
 * holds Generate drafts).
 */
export function closingNote(p: { summary: GenerateSummary; method: ScheduleSettings['split']['method']; percentHundredths: number; sharing?: string | null }): { words: string; over: boolean } {
  const { summary: s } = p;
  if (p.method === 'percentage' && p.percentHundredths > 10000) {
    return { words: `${trimPercent((p.percentHundredths - 10000) / 100)}% over`, over: true };
  }
  const held = s.held ? `${s.held === 1 ? '1 slot is' : `${s.held} slots are`} held by ${heldByWords(s)}.` : '';
  if (p.method === 'percentage' && p.percentHundredths < 10000) {
    return { words: `${trimPercent((10000 - p.percentHundredths) / 100)}% left open · ${pluralize(s.open, 'slot')}.${held ? ` ${held}` : ''}`, over: false };
  }
  if (s.open === 0) {
    return { words: s.held ? `Nothing left open. ${s.held} of the ${s.slots} slots ${s.held === 1 ? 'is' : 'are'} held by ${heldByWords(s)}.` : 'Nothing left open.', over: false };
  }
  // Sharing freed some of it (Stage 11c): the row says why — "50 slots left open: 9U AA and 11U AA share a facility."
  const freed = s.targets.reduce((n, t) => n + t.slots, 0) > s.handedOut;
  const why = freed && p.sharing ? `: ${p.sharing}.` : '.';
  return { words: `${pluralize(s.open, 'slot')} left open${why}${s.held ? ` ${s.held} more ${s.held === 1 ? 'is' : 'are'} held by ${heldByWords(s)}.` : ''}`, over: false };
}

const trimPercent = (n: number) => String(Math.round(n * 100) / 100);

/** [marketing] New schedule's foot: what Generate hands out — "288 slots for 8 teams." */
export const footCount = (handedOut: number, teams: number) => `${pluralize(handedOut, 'slot')} for ${pluralize(teams, 'team')}.`;

// ── Dates, said once ──────────────────────────────────────────────────────────────────────────────

/** "Jan 4 – Mar 28, 2027" — a schedule's dates (C8). */
export const scheduleDates = (startsOn: string, endsOn: string) => formatWeekRange(startsOn, endsOn);

/** "Mon, Jan 4" — a day as the grid heads it. */
export const dayHead = (day: string) => formatShortWeekdayDate(day);

/** A schedule's time a year on — New schedule's "Copy a schedule" (its settings a year on, the Budget's "Start from
 *  last year's plan"): 52 weeks later, so every weekday stays the weekday it was. */
export const yearOn = (day: string) => addCalendarDays(day, 364);

// ── Moving slots by hand (Ask 13): the engine's view of the page, and a drop's verdict ─────────────

/** The page's slots as the engine reads them — what `planMove` and `teamTwice` work over. */
export function engineSlotsOf(slots: readonly SlotView[]): Slot[] {
  return slots.map(s => ({
    key: s.key, venueId: s.venueId, facilityId: s.facilityId, blockIndex: 0, day: s.day, weekday: s.weekday, week: s.week,
    startClock: s.startClock, endClock: s.endClock, startMs: Date.parse(s.startsAt), endMs: Date.parse(s.endsAt),
    pos: `${s.weekday}|${s.startClock}|${s.venueId}|${s.facilityId ?? ''}`, prime: s.prime, weight: s.weight,
  }));
}

export type DropKind = 'free' | 'warn' | 'bad' | 'none';

/** Where a drop lands (Stage 11c) — the settings' one rule (`moveLanding`), which `planMove` asks each week too. */
export const dropLanding = moveLanding;

/** The schedule's sharing rules read against its teams (`sharingPools`) — what a slot's room is asked of. */
export type SharingRead = Parameters<typeof slotHolds>[2];

/**
 * A DROP'S VERDICT, as the Timeline's drag shows it (its behaviour, not its axes): green where the slot is free (or a
 * swap with the one team there), amber where a booking already on the books holds it or one of the schedule's rules
 * would be broken (it still drops: across programs a clash warns, never blocks), red ONLY for the schedule's own rule —
 * a team twice at once — which refuses and springs back. `none`: nothing would move (the team's own slot, or a slot
 * with no room for it and no one team to swap with).
 */
export function dropVerdict(p: {
  slots: readonly SlotView[];
  from: SlotView;
  to: SlotView;
  teamId: string;
  sharing: SharingRead;
  settings: Pick<ScheduleSettings, 'rules'>;
  nameOf: (teamId: string) => string;
  groupOf?: (teamId: string) => string | null;
}): { kind: DropKind; reason: string } {
  const { from, to, teamId } = p;
  if (to.key === from.key || to.teamIds.includes(teamId)) return { kind: 'none', reason: '' };
  const landing = dropLanding(from, to, teamId, p.sharing);
  if (!landing) return { kind: 'none', reason: '' };
  const swapWith = landing.kind === 'swap' ? landing.withTeam : null;
  const overlaps = (a: Pick<SlotView, 'startsAt' | 'endsAt'>, b: Pick<SlotView, 'startsAt' | 'endsAt'>) => a.startsAt < b.endsAt && b.startsAt < a.endsAt;
  // The one refusal: the team (or the team it swaps with) in two slots at once.
  const twice = (team: string, at: SlotView, leaving: SlotView) =>
    p.slots.some(s => s.key !== leaving.key && s.key !== at.key && s.teamIds.includes(team) && overlaps(s, at));
  if (twice(teamId, to, from)) return { kind: 'bad', reason: `${p.nameOf(teamId)} would be in two slots at once.` };
  if (swapWith && twice(swapWith, from, to)) return { kind: 'bad', reason: `${p.nameOf(swapWith)} would be in two slots at once.` };
  // Warnings: a booking holds it, or a rule the generator honours.
  if (to.heldBy) return { kind: 'warn', reason: `${heldWords(to.heldBy)} holds it` };
  const broken = ruleBroken(p.settings.rules, teamId, to, p.groupOf);
  if (broken) return { kind: 'warn', reason: broken };
  if (swapWith) {
    const back = ruleBroken(p.settings.rules, swapWith, from, p.groupOf);
    if (back) return { kind: 'warn', reason: back };
  }
  return { kind: 'free', reason: swapWith ? `swaps with ${p.nameOf(swapWith)}` : to.teamIds.length ? `shares with ${joinWithAnd(to.teamIds.map(p.nameOf))}` : 'open' };
}

/** A schedule rule this slot breaks for this team, in words — or null. */
export function ruleBroken(rules: ScheduleSettings['rules'], teamId: string, slot: Pick<SlotView, 'day' | 'weekday' | 'startClock' | 'endClock' | 'facilityId'>, groupOf: (teamId: string) => string | null = () => null): string | null {
  for (const w of rules.windows) {
    if (!w.teamIds.includes(teamId)) continue;
    if (w.startAfter && slot.startClock < w.startAfter) return `starts before ${formatTimeRange(w.startAfter, null)}`;
    if (w.startBy && slot.startClock > w.startBy) return `starts after ${formatTimeRange(w.startBy, null)}`;
    if (w.finishBy && slot.endClock > w.finishBy) return `finishes after ${formatTimeRange(w.finishBy, null)}`;
  }
  for (const d of rules.daysOff) {
    if (d.teamId !== teamId) continue;
    if ((d.date && d.date === slot.day) || (d.weekday && d.weekday === slot.weekday)) return d.note ? `a day off: ${d.note}` : 'a day off';
  }
  for (const f of rules.fieldsBy) {
    if (!slot.facilityId || !f.facilityIds.includes(slot.facilityId)) continue;
    const group = groupOf(teamId);
    if (!f.teamIds.includes(teamId) && !(group && f.groupIds.includes(group))) return 'kept for other teams';
  }
  return null;
}

/**
 * Each team's shortfall THIS WEEK: what its share comes to over the week's slots (its share of the whole time, in the
 * week's proportion), against what it has — the Fair shares panel's amber rows. A weekly split reads its own figure.
 */
/** The view's slots as the bill reads them (a shared slot's time is SPLIT among its teams) — one conversion, so Fair
 *  shares' estimate and Bill the teams price the same minutes the server does. */
export const viewBillSlots = (slots: readonly SlotView[]): BillSlot[] =>
  slots.map(s => ({ day: s.day, startMs: Date.parse(s.startsAt), endMs: Date.parse(s.endsAt), weight: s.weight, teamIds: s.teamIds }));

/**
 * FAIR SHARES' BILL, by team, in cents (Stage 11d part B — Not drawn: Fair shares; D4). Once the schedule made its bill,
 * what each team PAYS for its time (`pays` — billed less credited, plus corrections, less money given back), so it agrees
 * with Money › Club: a plain hand-back leaves it as billed, an accepted ask takes its figure off, whichever way it
 * settled. Before Finalize, the bill riding with the schedule; with only a permit behind it, what Bill the teams would
 * make of it — its own rule, so the shares add up to the same total to the cent. Empty for a reader without money.
 */
export function fairBill(view: Pick<ScheduleView, 'pays' | 'bill' | 'pricing' | 'slots' | 'teamOrder'>): Map<string, number> {
  if (view.pays) return new Map(Object.entries(view.pays));
  if (view.bill) return new Map(view.bill.teams.map(t => [t.teamId, t.cents]));
  if (view.pricing?.fullHour == null) return new Map();
  // The bill's own minutes (a shared slot split among its teams) in the club's team order — never the engine's per-team
  // count, which gives each team in a shared slot the whole of it (/review).
  return new Map(billShares(pricedMinutes(viewBillSlots(view.slots)), { fullHour: view.pricing.fullHour, amount: null, teamOrder: view.teamOrder })?.shares ?? []);
}

// ── An ask on the schedule (Stage 11d part B — the callout, the ringed Sundays, the slot window) ──────

/**
 * THE SUNDAYS RINGED ON THE GRID, by slot (D1): each Sunday a waiting ask still counts — still to come, still the team's —
 * keeps its chip, ringed, with Hand back's glyph. A LATE ask rings none: its Sundays left the team at the hand-back and
 * are already open (part C's Not drawn: "without ringed Sundays"). A shared slot asked by two of its teams reads the
 * older ask.
 */
export function askedSlots(asks: readonly ScheduleAsk[]): Map<string, ScheduleAsk> {
  const out = new Map<string, ScheduleAsk>();
  for (const a of [...asks].sort((x, y) => x.askedOn.localeCompare(y.askedOn))) {
    if (a.late) continue;
    for (const s of a.sundays) if (s.slotId && !out.has(s.slotId)) out.set(s.slotId, a);
  }
  return out;
}

/** A Sunday in the callout (drawn): "Sun, Mar 7, 9:30 a.m. · Field 1" — the club's day and clock, the slot's place. */
export function askSundayLine(s: ScheduleAsk['sundays'][number], places: readonly SchedulePlace[]): string {
  const z = utcToZonedInputs(s.startsAt);
  const place = s.venueId ? placeName(places, s.venueId, s.facilityId) : '';
  return `${formatShortWeekdayDate(z.date)}, ${formatTime(z.time)}${place ? ` · ${place}` : ''}`;
}

/**
 * How many weeks the days on screen stand for: one in a week grid; in a one-weekday schedule's seven dates, each date
 * that holds time is a week (Ask 27). "A week" figures are the count over the screen divided by this.
 */
export function weeksOnScreen(mode: GridColumns['mode'], days: readonly string[], slots: readonly Pick<SlotView, 'day'>[]): number {
  if (mode === 'week') return 1;
  const withTime = new Set(slots.map(x => x.day));
  return Math.max(1, days.filter(d => withTime.has(d)).length);
}

/** A count over the screen, said a week: whole in a week grid, to one decimal across a one-weekday schedule's dates. */
export const perWeek = (n: number, weeks: number) => (weeks > 1 ? Math.round((n / weeks) * 10) / 10 : n);

/** A refusal because the schedule changed since the page read it — the page re-reads, so a retry sends the version it
 *  now holds (a window that only said so left every retry refused, /review). */
export const isStale = (data: unknown): boolean => (data as { code?: unknown } | null)?.code === 'changed';

/** Each team's slots on the days given — one pass, read by Fair shares, By team, By group and the week's shortfalls. */
export function weekCounts(slots: readonly Pick<SlotView, 'day' | 'teamIds'>[], week: readonly string[]): Map<string, number> {
  const inWeek = new Set(week);
  const out = new Map<string, number>();
  for (const s of slots) if (inWeek.has(s.day)) for (const t of s.teamIds) out.set(t, (out.get(t) ?? 0) + 1);
  return out;
}

export function weekShortfalls(p: {
  slots: readonly SlotView[];
  week: readonly string[];
  results: readonly { teamId: string; target: number }[];
  settings: Pick<ScheduleSettings, 'split'>;
  /** `weekCounts` for the same week, when the caller has it. */
  counts?: ReadonlyMap<string, number>;
  /** The weeks the days stand for (`weeksOnScreen`) — a weekly figure is owed once for each. */
  weeks?: number;
}): Map<string, number> {
  const inWeek = new Set(p.week);
  const all = p.slots.length;
  const here = p.slots.reduce((n, s) => n + (inWeek.has(s.day) ? 1 : 0), 0);
  if (!all || !here) return new Map();
  const counts = p.counts ?? weekCounts(p.slots, p.week);
  const out = new Map<string, number>();
  for (const r of p.results) {
    const expected = p.settings.split.method === 'weekly'
      ? Number(p.settings.split.values[r.teamId] ?? 0) * (p.weeks ?? 1)
      : Math.round((r.target * here) / all);
    const got = counts.get(r.teamId) ?? 0;
    if (got < expected) out.set(r.teamId, expected - got);
  }
  return out;
}
