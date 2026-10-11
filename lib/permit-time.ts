/**
 * permit-time.ts — THE TIME THE CLUB HOLDS, AS ONE RULE (Club Tier Stage 10a — Asks 2, 3, 21, ratified 2026-10-11; hub
 * K4MPu4ni53Ct7yrDcmWJd9 → Mockups → Stages 10 + 11, specimens 2, 3 and 14 step 1). Pure and client-safe: the permits
 * route, the clash checks, every writer's reply, the club calendar and the use workbook all answer through here, and its
 * unit tests are the hub's cases, one by one (`tests/unit/permit-time.test.ts`).
 *
 * ONE MODEL OF THE CLUB'S TIME (Stage 11 Ask 2). A BLOCK is a weekly stretch at one club venue: its facilities (none
 * listed = EVERY facility there, read at the time; a venue with no facilities is one place), weekdays (1 = Monday …
 * 7 = Sunday), a start and an end on the club's clock, and a date range (null = the permit's). A PERMIT is a set of
 * blocks with its own dates and dates off. Stage 11a's schedule cuts the same blocks into slots; nothing else holds the
 * club's time.
 *
 * THREE ANSWERS, beside the clash rule (`lib/venue-clash.ts`), never inside it:
 *   1. `permitAnswer` — is this booking inside a permit the club holds? `inside`, `outside` (what the permit covers,
 *      for the quiet line), or `none` (the club holds no permit at that venue that day — say nothing). A booking against
 *      a permit is not a PAIR of bookings, so it is its own answer and never a third clash kind (P11-04b).
 *   2. `heldTime` / `fieldPrices` — what the permit holds, and what an hour of each field costs (Ask 21).
 *   3. `permitUse` — Held · Booked · Unused · Outside it, per block and per facility, read from the club's bookings.
 *
 * ONE CLOCK: a block's times are wall clocks on the club's clock; each date's window is worked out with
 * `zonedWallClockToUtc` (daylight saving included), and a booking is an instant pair, exactly as the clash rule reads it.
 */
import { ORG_TIME_ZONE, addCalendarDays, zonedWallClockToUtc } from './timezone.ts';

const MIN = 60_000;

let dayFormat: Intl.DateTimeFormat | null = null;
/** The club day an instant falls on, `YYYY-MM-DD` — one formatter for the module (a use reads thousands of bookings,
 *  and building a formatter per call is the expensive part). */
export function clubDayOf(ms: number): string {
  dayFormat ??= new Intl.DateTimeFormat('en-CA', { timeZone: ORG_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
  return dayFormat.format(new Date(ms));
}

/** A block of the club's time (org_time_blocks + org_time_block_facilities). */
export interface TimeBlock {
  id: string;
  venueId: string;
  /** Empty = every facility at the venue, read at the time. */
  facilityIds: readonly string[];
  /** 1 = Monday … 7 = Sunday. */
  weekdays: readonly number[];
  /** "HH:MM" on the club's clock. */
  startTime: string;
  endTime: string;
  /** Inside the permit's dates; null = the permit's own. */
  fromDate: string | null;
  untilDate: string | null;
}

export interface DateOff { day: string; note: string | null }

/** A permit, as the rule reads it — its time only (no money, no names). */
export interface PermitTime {
  id: string;
  startsOn: string;
  endsOn: string;
  blocks: readonly TimeBlock[];
  datesOff: readonly DateOff[];
}

/** The club's facilities at each venue, in the club's order — what "every facility" reads. */
export type VenueFacilities = ReadonlyMap<string, readonly string[]>;

/** One place a block holds: a facility id, or null for a venue that has no facilities (the venue itself). */
export type PlaceUnit = string | null;

// ── Days and clocks ──────────────────────────────────────────────────────────────────────────────

/** 1 = Monday … 7 = Sunday, for a `YYYY-MM-DD` club day. */
export function weekdayOf(day: string): number {
  const d = new Date(`${day}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** "HH:MM" from "HH:MM" or "HH:MM:SS". */
export const clock = (t: string) => t.slice(0, 5);

/** A block's window on one club day, as instants (ms), daylight saving included. */
export function windowOn(day: string, block: Pick<TimeBlock, 'startTime' | 'endTime'>): { startMs: number; endMs: number } {
  const s = zonedWallClockToUtc(day, clock(block.startTime));
  const e = zonedWallClockToUtc(day, clock(block.endTime));
  return { startMs: s ? Date.parse(s) : NaN, endMs: e ? Date.parse(e) : NaN };
}

/** The dates a block spans inside its permit: [first, last], or null when the two don't meet. */
export function blockSpan(permit: Pick<PermitTime, 'startsOn' | 'endsOn'>, block: Pick<TimeBlock, 'fromDate' | 'untilDate'>): { first: string; last: string } | null {
  const first = block.fromDate && block.fromDate > permit.startsOn ? block.fromDate : permit.startsOn;
  const last = block.untilDate && block.untilDate < permit.endsOn ? block.untilDate : permit.endsOn;
  return first <= last ? { first, last } : null;
}

/** Every date a block holds: its span, on its weekdays, never a date off. */
export function blockDates(permit: PermitTime, block: TimeBlock): string[] {
  const span = blockSpan(permit, block);
  if (!span) return [];
  const off = new Set(permit.datesOff.map(d => d.day));
  const days = new Set(block.weekdays);
  const out: string[] = [];
  // At most ~1,100 days (the permit's CHECK), so a walk is cheap and never unbounded.
  for (let d = span.first, n = 0; d <= span.last && n < 1200; d = addCalendarDays(d, 1), n++) {
    if (days.has(weekdayOf(d)) && !off.has(d)) out.push(d);
  }
  return out;
}

/** The places a block holds: its facilities, every facility at its venue, or the venue itself when it has none. */
export function blockUnits(block: Pick<TimeBlock, 'venueId' | 'facilityIds'>, venueFacilities: VenueFacilities): PlaceUnit[] {
  if (block.facilityIds.length) return [...block.facilityIds];
  const all = venueFacilities.get(block.venueId) ?? [];
  return all.length ? [...all] : [null];
}

/** Does a block hold this facility? (A booking with no facility set is answered by `coversBooking`.) */
function blockHoldsFacility(block: TimeBlock, facilityId: string, venueFacilities: VenueFacilities): boolean {
  return blockUnits(block, venueFacilities).includes(facilityId);
}

// ── 1. The permit's answer ───────────────────────────────────────────────────────────────────────

/** A proposed or stored booking, in the rule's terms — the clash rule's `ClubBooking` fits it. */
export interface BookingPlace {
  venueId: string | null;
  facilityId: string | null;
  startMs: number;
  endMs: number;
}

/** What a permit covers at a venue, as the line describes it. Facility ids, or null = every facility there. */
export interface PermitCover {
  facilityIds: string[] | null;
  weekdays: number[];
  startTime: string;
  endTime: string;
}

export interface PermitOutsideIds {
  kind: 'outside';
  /** The booking's club day. */
  day: string;
  /** True when `covers` is about the booking's own facility (the permit holds it); false = every block at the venue. */
  onFacility: boolean;
  covers: PermitCover[];
  /** The last day of the permits that hold the venue that day. */
  until: string;
  /** The date is a date off of a permit that holds the venue. */
  dateOff: DateOff | null;
}

export type PermitAnswer = { kind: 'none' } | { kind: 'inside' } | PermitOutsideIds;

const sameCover = (a: PermitCover, b: PermitCover) =>
  a.startTime === b.startTime && a.endTime === b.endTime && a.weekdays.join() === b.weekdays.join()
  && (a.facilityIds?.join() ?? '*') === (b.facilityIds?.join() ?? '*');

/**
 * THE RULE (Ask 3). A booking is INSIDE when some permit of the club holding its venue that day has a block — on its
 * facility (every facility counts; with no facility set, any block at the venue counts), on that weekday, inside the
 * block's dates, the day not a date off — whose window holds the booking's WHOLE time. Inside any one permit is inside.
 * OUTSIDE when the club holds a permit at that venue covering that day and none of that holds (a date off is outside,
 * and says so). NONE when the club holds no permit at that venue that day — the line says nothing, and so does a booking
 * on a place that isn't one of the club's venues.
 */
export function permitAnswer(b: BookingPlace, permits: readonly PermitTime[], venueFacilities: VenueFacilities): PermitAnswer {
  if (!b.venueId || !Number.isFinite(b.startMs) || !Number.isFinite(b.endMs)) return { kind: 'none' };
  // Most bookings stand where the club holds no permit at all: answered before any date work.
  if (!permits.some(p => p.blocks.some(x => x.venueId === b.venueId))) return { kind: 'none' };
  const day = clubDayOf(b.startMs);
  const holding = permits.filter(p => p.startsOn <= day && day <= p.endsOn && p.blocks.some(x => x.venueId === b.venueId));
  if (!holding.length) return { kind: 'none' };

  for (const p of holding) {
    if (p.datesOff.some(d => d.day === day)) continue;
    for (const block of p.blocks) {
      if (block.venueId !== b.venueId) continue;
      const span = blockSpan(p, block);
      if (!span || day < span.first || day > span.last || !block.weekdays.includes(weekdayOf(day))) continue;
      if (b.facilityId && !blockHoldsFacility(block, b.facilityId, venueFacilities)) continue;
      const w = windowOn(day, block);
      if (w.startMs <= b.startMs && b.endMs <= w.endMs) return { kind: 'inside' };
    }
  }

  const atVenue = holding.flatMap(p => p.blocks.filter(x => x.venueId === b.venueId));
  const onFacilityBlocks = b.facilityId ? atVenue.filter(x => blockHoldsFacility(x, b.facilityId!, venueFacilities)) : [];
  const onFacility = onFacilityBlocks.length > 0;
  const described = onFacility ? onFacilityBlocks : atVenue;
  const covers: PermitCover[] = [];
  for (const x of described) {
    const c: PermitCover = {
      facilityIds: onFacility ? [b.facilityId!] : x.facilityIds.length ? [...x.facilityIds] : null,
      weekdays: [...x.weekdays].sort((m, n) => m - n),
      startTime: clock(x.startTime),
      endTime: clock(x.endTime),
    };
    if (!covers.some(y => sameCover(y, c))) covers.push(c);
  }
  covers.sort((a, z) => (a.weekdays[0] ?? 8) - (z.weekdays[0] ?? 8) || a.startTime.localeCompare(z.startTime));
  const offPermit = holding.find(p => p.datesOff.some(d => d.day === day));
  return {
    kind: 'outside',
    day,
    onFacility,
    covers,
    until: holding.reduce((u, p) => (p.endsOn > u ? p.endsOn : u), holding[0].endsOn),
    dateOff: offPermit ? offPermit.datesOff.find(d => d.day === day) ?? null : null,
  };
}

// ── 2. What a permit holds, and what an hour of each field costs (Ask 21) ─────────────────────────────

export interface BlockHeld {
  blockId: string;
  units: PlaceUnit[];
  dates: string[];
  /** Over every date and every place it holds. */
  heldMinutes: number;
  /** A week's worth, nominal: weekdays × the window × the places. */
  weekMinutes: number;
}

/** Wall-clock minutes of a block's window (a week's nominal length; the held total reads real instants). */
const wallMinutes = (b: Pick<TimeBlock, 'startTime' | 'endTime'>) => {
  const [sh, sm] = clock(b.startTime).split(':').map(Number);
  const [eh, em] = clock(b.endTime).split(':').map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
};

export function heldTime(permit: PermitTime, venueFacilities: VenueFacilities): { blocks: BlockHeld[]; heldMinutes: number; weekMinutes: number } {
  const blocks = permit.blocks.map((block): BlockHeld => {
    const units = blockUnits(block, venueFacilities);
    const dates = blockDates(permit, block);
    let perUnit = 0;
    for (const d of dates) {
      const w = windowOn(d, block);
      if (Number.isFinite(w.startMs) && Number.isFinite(w.endMs) && w.endMs > w.startMs) perUnit += (w.endMs - w.startMs) / MIN;
    }
    return { blockId: block.id, units, dates, heldMinutes: perUnit * units.length, weekMinutes: block.weekdays.length * wallMinutes(block) * units.length };
  });
  return {
    blocks,
    heldMinutes: blocks.reduce((n, b) => n + b.heldMinutes, 0),
    weekMinutes: blocks.reduce((n, b) => n + b.weekMinutes, 0),
  };
}

/** A field's share of a full field's price in this permit: no entry = Full (1). */
export type FieldShares = ReadonlyMap<string, number>;
export const shareOf = (shares: FieldShares, unit: PlaceUnit) => (unit ? shares.get(unit) ?? 1 : 1);

/**
 * WHAT AN HOUR OF EACH FIELD COSTS (Ask 21): cost ÷ Σ(held hours × share) is an hour of a FULL field; an hour of a field
 * is that × its share. The dome: $27,000.00 over Fields 1–4 full and 5–6 half, 25 Sundays × 3 h = 375 full-field hours →
 * $72.00 a full field, $36.00 a half. Null when there is no cost, or nothing held.
 */
export function fieldPrices(permit: PermitTime, venueFacilities: VenueFacilities, shares: FieldShares, cost: number | null): {
  /** Σ(held hours × share) — the full-field hours the cost buys. */
  fullFieldHours: number;
  /** An hour of a full field. */
  fullHour: number | null;
  /** An hour of each place, by unit (null = the venue itself). */
  hourOf: (unit: PlaceUnit) => number | null;
  /** Every field is Full: one price, "an hour held". */
  allFull: boolean;
} {
  const held = heldTime(permit, venueFacilities);
  let weighted = 0;
  let allFull = true;
  for (const b of held.blocks) {
    const perUnit = b.units.length ? b.heldMinutes / b.units.length : 0;
    for (const u of b.units) {
      const s = shareOf(shares, u);
      if (s !== 1) allFull = false;
      weighted += (perUnit / 60) * s;
    }
  }
  const fullHour = cost != null && weighted > 0 ? cost / weighted : null;
  return {
    fullFieldHours: weighted,
    fullHour,
    hourOf: (unit) => (fullHour == null ? null : fullHour * shareOf(shares, unit)),
    allFull,
  };
}

// ── 3. The use: Held · Booked · Unused · Outside it ─────────────────────────────────────────────────

/** A booking as the use reads it (the clash pool's `ClubBooking` fits): its place, its time, who holds it. */
export interface UseBooking extends BookingPlace {
  key: string;
  ownerName: string;
}

type Span = [number, number];

/** The total length of a set of intervals, overlaps counted once. */
function unionMinutes(spans: Span[]): number {
  if (!spans.length) return 0;
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [s, e] = sorted[0];
  for (const [ns, ne] of sorted.slice(1)) {
    if (ns > e) { total += e - s; s = ns; e = ne; } else if (ne > e) e = ne;
  }
  total += e - s;
  return total / MIN;
}

const clip = (b: BookingPlace, w: { startMs: number; endMs: number }): Span | null => {
  const s = Math.max(b.startMs, w.startMs);
  const e = Math.min(b.endMs, w.endMs);
  return e > s ? [s, e] : null;
};

/** The parts of a span no taken span covers. */
function subtractSpans(span: Span, taken: readonly Span[]): Span[] {
  let parts: Span[] = [span];
  for (const [ts, te] of taken) {
    parts = parts.flatMap(([s, e]): Span[] => (te <= s || ts >= e ? [[s, e]] : [
      ...(ts > s ? [[s, ts] as Span] : []),
      ...(te < e ? [[te, e] as Span] : []),
    ]));
  }
  return parts;
}

export interface BlockUse {
  blockId: string;
  heldMinutes: number;
  /** Placed bookings on its places (each place's time counted once) plus bookings with no facility set inside its
   *  hours, never more than it holds. */
  bookedMinutes: number;
  /** The part of `bookedMinutes` from bookings with no facility set ("says so" on the row). */
  unplacedMinutes: number;
  /** Who booked it, in first-booked order. */
  who: string[];
}

export interface PlaceUse {
  venueId: string;
  unit: PlaceUnit;
  heldMinutes: number;
  /** Bookings ON this place only (a booking with no facility set counts on its block, not a place). */
  bookedMinutes: number;
  who: string[];
}

export interface OutsideBooking {
  key: string;
  ownerName: string;
  venueId: string;
  facilityId: string | null;
  startMs: number;
  endMs: number;
  /** The part of it outside every permit the club holds there. */
  outsideMinutes: number;
}

export interface DayUse { day: string; heldMinutes: number; bookedMinutes: number }

export interface PermitUse {
  blocks: BlockUse[];
  places: PlaceUse[];
  days: DayUse[];
  outside: OutsideBooking[];
  totals: { heldMinutes: number; bookedMinutes: number; unusedMinutes: number; outsideMinutes: number };
}

/**
 * THE USE (specimen 2, the facilities person's number for the town). Held = the blocks' time over their dates, less dates
 * off, per place. Booked = the club's bookings on those places inside a block, each clipped to the block, a place's time
 * counted once however many bookings overlap it; a booking with no facility set inside a block's hours counts on that
 * block (never more than the block holds) and the row says so. Outside it = bookings at the permit's venues during its
 * dates, in the part no permit of the club holds (`allPermits` — inside any one permit is inside). Cancelled bookings
 * never reach here (the pool drops them); a postponed league game counts at its new time.
 */
export function permitUse(
  permit: PermitTime,
  bookings: readonly UseBooking[],
  ctx: { venueFacilities: VenueFacilities; allPermits: readonly PermitTime[] },
): PermitUse {
  const { venueFacilities } = ctx;
  const venues = new Set(permit.blocks.map(b => b.venueId));
  const placeKey = (v: string, u: PlaceUnit) => `${v}|${u ?? ''}`;
  const places = new Map<string, PlaceUse>();
  const byDay = new Map<string, DayUse>();
  // The bookings at the permit's venues, bucketed ONCE by venue and club day (a booking past midnight sits on both its
  // days), so each block-date reads only that evening's few bookings rather than the whole pool.
  const dayOfBooking = new Map<string, string>();
  const bucket = new Map<string, UseBooking[]>();
  for (const b of bookings) {
    if (!b.venueId || !venues.has(b.venueId)) continue;
    const start = clubDayOf(b.startMs);
    dayOfBooking.set(b.key, start);
    for (const d of new Set([start, clubDayOf(b.endMs - 1)])) {
      const k = `${b.venueId}|${d}`;
      const list = bucket.get(k);
      if (list) list.push(b); else bucket.set(k, [b]);
    }
  }
  const addName = (list: string[], name: string) => { if (!list.includes(name)) list.push(name); };
  // A booking with no facility set counts once in this permit, however many of its blocks hold those hours (two blocks
  // of one venue's fields at the same hours, Fields 1–3 and 4–6): the part a block already counted is not counted again.
  const looseCounted = new Map<string, Span[]>();

  const blocks = permit.blocks.map((block): BlockUse => {
    const units = blockUnits(block, venueFacilities);
    const real = units.some(u => u !== null);
    const who: string[] = [];
    let held = 0, booked = 0, unplaced = 0;
    for (const day of blockDates(permit, block)) {
      const w = windowOn(day, block);
      if (!(w.endMs > w.startMs)) continue;
      const span = (w.endMs - w.startMs) / MIN;
      // That evening's bookings at the venue, each clipped to the block once.
      const clipped = (bucket.get(`${block.venueId}|${day}`) ?? [])
        .map(b => ({ b, c: clip(b, w) })).filter((x): x is { b: UseBooking; c: Span } => !!x.c);
      let dayHeld = 0, dayPlaced = 0;
      for (const u of units) {
        dayHeld += span;
        const on = clipped.filter(x => !real || x.b.facilityId === u);
        const m = unionMinutes(on.map(x => x.c));
        dayPlaced += m;
        const p = places.get(placeKey(block.venueId, u)) ?? { venueId: block.venueId, unit: u, heldMinutes: 0, bookedMinutes: 0, who: [] };
        p.heldMinutes += span;
        p.bookedMinutes += m;
        for (const x of on) { addName(p.who, x.b.ownerName); addName(who, x.b.ownerName); }
        places.set(placeKey(block.venueId, u), p);
      }
      let dayUnplaced = 0;
      if (real) {
        const fresh: Span[] = [];
        for (const x of clipped) {
          if (x.b.facilityId) continue;
          addName(who, x.b.ownerName);
          const taken = looseCounted.get(x.b.key) ?? [];
          const parts = subtractSpans(x.c, taken);
          fresh.push(...parts);
          looseCounted.set(x.b.key, [...taken, ...parts]);
        }
        dayUnplaced = Math.min(unionMinutes(fresh), Math.max(0, dayHeld - dayPlaced));
      }
      const dayBooked = Math.min(dayHeld, dayPlaced + dayUnplaced);
      held += dayHeld;
      booked += dayBooked;
      unplaced += dayUnplaced;
      const d = byDay.get(day) ?? { day, heldMinutes: 0, bookedMinutes: 0 };
      d.heldMinutes += dayHeld;
      d.bookedMinutes += dayBooked;
      byDay.set(day, d);
    }
    return { blockId: block.id, heldMinutes: held, bookedMinutes: booked, unplacedMinutes: unplaced, who };
  });

  // Outside it: bookings at its venues, on its dates, in the part no permit of the club holds.
  const outside: OutsideBooking[] = [];
  const all = ctx.allPermits.some(p => p.id === permit.id) ? ctx.allPermits : [...ctx.allPermits, permit];
  for (const b of bookings) {
    const day = dayOfBooking.get(b.key);
    if (!b.venueId || !day || day < permit.startsOn || day > permit.endsOn) continue;
    const covered: Span[] = [];
    for (const p of all) {
      if (day < p.startsOn || day > p.endsOn || p.datesOff.some(d => d.day === day)) continue;
      for (const block of p.blocks) {
        if (block.venueId !== b.venueId || !block.weekdays.includes(weekdayOf(day))) continue;
        const span = blockSpan(p, block);
        if (!span || day < span.first || day > span.last) continue;
        if (b.facilityId && !blockHoldsFacility(block, b.facilityId, venueFacilities)) continue;
        const c = clip(b, windowOn(day, block));
        if (c) covered.push(c);
      }
    }
    const length = (b.endMs - b.startMs) / MIN;
    const out = Math.max(0, length - unionMinutes(covered));
    if (out > 0.0001) outside.push({ key: b.key, ownerName: b.ownerName, venueId: b.venueId, facilityId: b.facilityId, startMs: b.startMs, endMs: b.endMs, outsideMinutes: out });
  }
  outside.sort((a, z) => a.startMs - z.startMs);

  const heldMinutes = blocks.reduce((n, x) => n + x.heldMinutes, 0);
  const bookedMinutes = blocks.reduce((n, x) => n + x.bookedMinutes, 0);
  return {
    blocks,
    places: [...places.values()],
    days: [...byDay.values()].sort((a, z) => a.day.localeCompare(z.day)),
    outside,
    totals: {
      heldMinutes, bookedMinutes, unusedMinutes: Math.max(0, heldMinutes - bookedMinutes),
      outsideMinutes: outside.reduce((n, o) => n + o.outsideMinutes, 0),
    },
  };
}

// ── The record's own checks (the form holds, the route refuses — one rule) ───────────────────────────

/** The hours a permit's blocks overlap each other on one place — never allowed: a place's hour is held once. */
export function overlappingBlocks(permit: Pick<PermitTime, 'blocks'>, venueFacilities: VenueFacilities): [string, string] | null {
  const bs = permit.blocks;
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j];
      if (a.venueId !== b.venueId) continue;
      const ua = blockUnits(a, venueFacilities), ub = blockUnits(b, venueFacilities);
      if (!ua.some(u => ub.includes(u))) continue;
      if (!a.weekdays.some(d => b.weekdays.includes(d))) continue;
      const aFrom = a.fromDate ?? '0000-01-01', aTo = a.untilDate ?? '9999-12-31';
      const bFrom = b.fromDate ?? '0000-01-01', bTo = b.untilDate ?? '9999-12-31';
      if (aTo < bFrom || bTo < aFrom) continue;
      if (clock(a.startTime) < clock(b.endTime) && clock(b.startTime) < clock(a.endTime)) return [a.id, b.id];
    }
  }
  return null;
}
