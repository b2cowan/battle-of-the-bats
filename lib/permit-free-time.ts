/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * FREE TIME ACROSS EVERY PERMIT — "Find the time" (a schedule on several permits, Session D; plan
 * CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md §4d + Phase 4; drawing CLUB_SCHEDULE_SEVERAL_PERMITS_DRAWINGS.html tab 2; owner
 * rulings 2026-11-14: P4 A, P7 A, P7b A, P12 A).
 *
 * FREE = HELD − TAKEN, one place and one club day at a time:
 *   held   every block of every permit the club holds, on its dates and weekdays, never a date off on its park
 *          (`blockDates` — the one rule), cut to the filters' days and hours;
 *   taken  what is booked there (the caller passes `readClubBookings`, the same bookings a permit's Used figure counts,
 *          plus the schedules' own time: one model of taken time, never a second one), then
 *   held by a draft — another schedule's draft or in-review slots: NOT booked anywhere else in the product, so they are
 *          counted here apart and NAMED on the row ("4 held by a draft (Spring house league 2027)", P7 A).
 * A day COUNTS when at least the shortest useful block is left; it is free, or held by a draft when only a draft stands
 * in the way. One row per place (a facility, or a venue with none); a day two permits both hold is listed once, under
 * both, and the row says which prices it — the newer permit to start (P4 A).
 *
 * ⚖ PURE AND STANDING ON ITS OWN (build-enforced, `tests/unit/permit-free-time.test.ts`): no React, no database, no
 * import from a component and no knowledge of New schedule — the Permits page's later "Free time" view (P12) is a new
 * door on this same reading, not a rebuild. Turning found time into a schedule's rows is the schedule's job
 * (`rowsFromFound`, `lib/club-schedule-permit-rows.ts`).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import {
  blockDates, blockUnits, clock, clubDayOf, subtractSpans, unionSpans, weekdayOf, windowOn,
  type BookingPlace, type PermitTime, type PlaceUnit, type Span, type TimeBlock, type VenueFacilities,
} from './permit-time';

const MIN = 60_000;

/** A permit as the finder reads it: its time, plus what the row says about it. */
export interface FreePermit extends PermitTime {
  name: string;
  /** The town (or whoever issued it); null when none is recorded. */
  issuer: string | null;
  /** When it was recorded — "the newer permit" of two that hold the same day (P4 A). Null falls back to its first day. */
  createdAt: string | null;
}

/** Time something else holds at a place: a booking, or a schedule's slot. `by` names it (a draft's schedule name). */
export interface TakenTime extends BookingPlace {
  by: string;
}

/** What the admin narrows by. An empty list is "every": every day, any time, every kind, every venue, every issuer. */
export interface FreeFilters {
  /** The window, club days `YYYY-MM-DD`, both inclusive. */
  from: string;
  to: string;
  /** 1 = Monday … 7 = Sunday. */
  weekdays: readonly number[];
  /** Hours of the day, "HH:MM" on the club's clock; several ranges are any of them. */
  hours: readonly { start: string; end: string }[];
  /** `org_venue_facilities.facility_type` (diamond, field …); a venue with no facilities has no kind. */
  kinds: readonly string[];
  venueIds: readonly string[];
  /** The permits' issuers, as `FreePermit.issuer` says them. */
  issuers: readonly string[];
  /** The shortest useful block, minutes: a day counts only when this much is left in one piece. */
  minMinutes: number;
}

export interface FreeInput {
  permits: readonly FreePermit[];
  /** The club's facilities at each venue, in the club's order (rows come in this order). */
  venueFacilities: VenueFacilities;
  /** A facility's kind (null for a venue with none, or a facility with none recorded). */
  kindOf: (unit: PlaceUnit, venueId: string) => string | null;
  /** Booked: the club's bookings and every schedule's own time that is not a draft. */
  booked: readonly BookingPlace[];
  /** Other schedules' draft and in-review slots, each naming its schedule. */
  drafts: readonly TakenTime[];
}

/** A weekly stretch: these weekdays, these hours. */
export interface FreePattern { weekdays: number[]; startTime: string; endTime: string }

/** The time a row brings when it is picked: one permit's block on one place, cut to the filters and to the days that
 *  count — its first and last such day, its weekdays among them. `draftDays`: the days in it a draft holds (P7b A: they
 *  come in, said on the card). */
export interface FreePiece extends FreePattern {
  permitId: string;
  venueId: string;
  unit: PlaceUnit;
  fromDate: string;
  untilDate: string;
  draftDays: string[];
  draftBy: string[];
}

export interface FreeRow {
  venueId: string;
  unit: PlaceUnit;
  /** The permits that hold this place in the filters, first day first. */
  permitIds: string[];
  /** Days a permit holds here in the filters (each with at least the shortest block). */
  heldDays: number;
  /** Of those, the days free — at least the shortest block left once bookings and drafts are taken out. */
  freeDays: number;
  /** Days only another schedule's draft stands in the way, and whose drafts. */
  draftDays: number;
  draftBy: string[];
  /** The minutes free on the free days, in pieces at least the shortest block long. */
  freeMinutes: number;
  /** The weekly stretches the row's time runs on ("Tue & Thu 6:00–8:00 p.m."). */
  patterns: FreePattern[];
  /** Every stretch starts at 5:00 p.m. or later — the row counts "evenings", not "days". */
  evening: boolean;
  /** Free days two or more permits hold, in order — listed once, priced by one (P4 A). */
  shared: string[];
  /** The permit that prices the shared days, to start: the newer of those holding them. Null when none are shared. */
  pricedBy: string | null;
  pieces: FreePiece[];
}

export interface FreeTime {
  rows: FreeRow[];
  /** Permits the club holds that meet the window at all — 0 is "The club holds no permit between …". */
  permitsInDates: number;
  /** The weekdays the permits hold in the window, before the other filters (the empty result names them). */
  heldWeekdays: number[];
  /** The choices the filters offer, from the permits in the window before the other filters. */
  kinds: string[];
  venueIds: string[];
  issuers: string[];
}

const EVENING = '17:00';

/** "HH:MM" as minutes of the day. */
const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** A block's hours cut to the filters' ranges (any time = the block's own): each piece "HH:MM"–"HH:MM". */
function cutHours(start: string, end: string, hours: FreeFilters['hours']): { start: string; end: string }[] {
  if (!hours.length) return [{ start, end }];
  // Ranges that overlap are one range first, so two ranges never cut one block into pieces that overlap (ranges that only
  // touch, 6–8 and 8–10, stay two: the stretches the row shows are the ranges asked for).
  const ranges: { start: string; end: string }[] = [];
  for (const h of hours.map(x => ({ start: clock(x.start), end: clock(x.end) })).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))) {
    const last = ranges[ranges.length - 1];
    if (last && h.start < last.end) { if (h.end > last.end) last.end = h.end; } else ranges.push({ ...h });
  }
  const out: { start: string; end: string }[] = [];
  for (const h of ranges) {
    const s = start > h.start ? start : h.start;
    const e = end < h.end ? end : h.end;
    if (s < e) out.push({ start: s, end: e });
  }
  return out;
}

/** The longest piece, minutes. */
const longest = (spans: readonly Span[]) => spans.reduce((m, [s, e]) => Math.max(m, (e - s) / MIN), 0);

/** Taken spans out of a set of spans. */
const without = (spans: readonly Span[], taken: readonly Span[]) => spans.flatMap(s => subtractSpans(s, taken));

/** Bookings bucketed once by venue and club day (one past midnight sits on both its days), as `permitUse` does. */
function bucketByDay<T extends BookingPlace>(list: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const b of list) {
    if (!b.venueId || !(b.endMs > b.startMs)) continue;
    for (const d of new Set([clubDayOf(b.startMs), clubDayOf(b.endMs - 1)])) {
      const k = `${b.venueId}|${d}`;
      const at = out.get(k);
      if (at) at.push(b); else out.set(k, [b]);
    }
  }
  return out;
}

/** The spans a set of bookings takes at one place: its own, and any at the venue with no facility set ("busy then" —
 *  the whole venue, never offered as free). A venue with no facilities is taken by any booking there. */
function takenAt<T extends BookingPlace>(list: readonly T[] | undefined, unit: PlaceUnit): T[] {
  return (list ?? []).filter(b => unit === null || b.facilityId === null || b.facilityId === unit);
}

/** "Newer": recorded later; a permit with no record date reads by its first day. */
const newness = (p: FreePermit) => p.createdAt ?? p.startsOn;

/**
 * THE FINDER. Every place the club holds on any permit in the filters, each with its days held, free and held by a
 * draft, its free minutes, its weekly stretches and the pieces of time it brings when picked.
 */
export function freeTime(input: FreeInput, f: FreeFilters): FreeTime {
  const { venueFacilities, kindOf } = input;
  const inDates = input.permits.filter(p => p.startsOn <= f.to && p.endsOn >= f.from);
  const minMinutes = Math.max(1, f.minMinutes);

  // A block's places and dates are read once, for the filters' choices and again for the held pass.
  const unitsMemo = new Map<object, PlaceUnit[]>(), datesMemo = new Map<object, string[]>();
  const unitsOf = (b: TimeBlock) => unitsMemo.get(b) ?? unitsMemo.set(b, blockUnits(b, venueFacilities)).get(b)!;
  const datesOf = (p: PermitTime, b: TimeBlock) => datesMemo.get(b) ?? datesMemo.set(b, blockDates(p, b)).get(b)!;

  // The filters' own choices, from the permits in the window as they stand (never narrowed by themselves).
  const heldWeekdays = new Set<number>(), kinds = new Set<string>(), venueIds = new Set<string>(), issuers = new Set<string>();
  for (const p of inDates) {
    if (p.issuer) issuers.add(p.issuer);
    for (const b of p.blocks) {
      venueIds.add(b.venueId);
      for (const u of unitsOf(b)) { const k = kindOf(u, b.venueId); if (k) kinds.add(k); }
      for (const d of datesOf(p, b)) if (d >= f.from && d <= f.to) heldWeekdays.add(weekdayOf(d));
    }
  }

  // ── Held: per place and day, each permit's spans; per piece (permit · block · hours · place), its days. ──
  type Cell = { spans: Span[]; permits: Set<string> };
  const cells = new Map<string, Map<string, Cell>>();
  const placeOf = new Map<string, { venueId: string; unit: PlaceUnit }>();
  type Piece = { permitId: string; venueId: string; unit: PlaceUnit; startTime: string; endTime: string; days: string[] };
  const pieces = new Map<string, Piece[]>();

  for (const p of inDates) {
    if (f.issuers.length && (!p.issuer || !f.issuers.includes(p.issuer))) continue;
    for (const b of p.blocks) {
      if (f.venueIds.length && !f.venueIds.includes(b.venueId)) continue;
      const units = unitsOf(b).filter(u => !f.kinds.length || f.kinds.includes(kindOf(u, b.venueId) ?? ''));
      if (!units.length) continue;
      const cuts = cutHours(clock(b.startTime), clock(b.endTime), f.hours)
        .filter(c => minutesOf(c.end) - minutesOf(c.start) >= minMinutes);
      if (!cuts.length) continue;
      const days = datesOf(p, b).filter(d => d >= f.from && d <= f.to && (!f.weekdays.length || f.weekdays.includes(weekdayOf(d))));
      // Each cut's real instants on each day, worked out once (the same on every facility the block holds).
      const windows = cuts.map(c => days.map(d => windowOn(d, { startTime: c.start, endTime: c.end })));
      for (const u of units) {
        const key = `${b.venueId}|${u ?? ''}`;
        placeOf.set(key, { venueId: b.venueId, unit: u });
        const byDay = cells.get(key) ?? cells.set(key, new Map()).get(key)!;
        const mine = pieces.get(key) ?? pieces.set(key, []).get(key)!;
        for (const [ci, c] of cuts.entries()) {
          const piece: Piece = { permitId: p.id, venueId: b.venueId, unit: u, startTime: c.start, endTime: c.end, days: [] };
          for (const [di, d] of days.entries()) {
            const w = windows[ci][di];
            if (!(w.endMs > w.startMs)) continue;
            const cell = byDay.get(d) ?? byDay.set(d, { spans: [], permits: new Set() }).get(d)!;
            cell.spans.push([w.startMs, w.endMs]);
            cell.permits.add(p.id);
            piece.days.push(d);
          }
          if (piece.days.length) mine.push(piece);
        }
      }
    }
  }

  // ── Taken, then held by a draft: day by day, at each place. ──
  const booked = bucketByDay(input.booked);
  const drafts = bucketByDay(input.drafts);
  const permitById = new Map(inDates.map(p => [p.id, p]));
  const order = new Map<string, number>();
  let n = 0;
  for (const [venueId, units] of venueFacilities) {
    if (!units.length) order.set(`${venueId}|`, n++);
    for (const u of units) order.set(`${venueId}|${u}`, n++);
  }

  const rows: FreeRow[] = [];
  for (const [key, byDay] of cells) {
    const { venueId, unit } = placeOf.get(key)!;
    const status = new Map<string, 'free' | 'draft'>();
    const draftByDay = new Map<string, string[]>();
    const draftBy: string[] = [];
    const shared: string[] = [];
    let freeMinutes = 0, heldDays = 0, freeDays = 0, draftDays = 0;
    for (const [day, cell] of [...byDay].sort(([a], [b]) => a.localeCompare(b))) {
      const held = unionSpans(cell.spans);
      if (longest(held) < minMinutes) continue;
      heldDays++;
      const open = without(held, takenAt(booked.get(`${venueId}|${day}`), unit).map(b => [b.startMs, b.endMs] as Span));
      if (longest(open) < minMinutes) continue;
      const onDay = takenAt(drafts.get(`${venueId}|${day}`), unit);
      const free = without(open, onDay.map(b => [b.startMs, b.endMs] as Span));
      if (longest(free) >= minMinutes) {
        freeDays++;
        status.set(day, 'free');
        freeMinutes += free.reduce((m, [s, e]) => m + ((e - s) / MIN >= minMinutes ? (e - s) / MIN : 0), 0);
        if (cell.permits.size > 1) shared.push(day);
      } else {
        draftDays++;
        status.set(day, 'draft');
        // The drafts that stand in the way: those meeting the time left once the bookings are out.
        const who = [...new Set(onDay.filter(b => open.some(([s, e]) => b.startMs < e && b.endMs > s)).map(b => b.by))];
        draftByDay.set(day, who);
        for (const w of who) if (!draftBy.includes(w)) draftBy.push(w);
      }
    }
    if (!heldDays) continue;

    // The pieces a pick brings: each cut to the days that count (free, or held by a draft), dropped when none do.
    const rowPieces: FreePiece[] = [];
    for (const pc of pieces.get(key) ?? []) {
      const counted = pc.days.filter(d => status.has(d));
      if (!counted.length) continue;
      const dd = counted.filter(d => status.get(d) === 'draft');
      rowPieces.push({
        permitId: pc.permitId, venueId: pc.venueId, unit: pc.unit, startTime: pc.startTime, endTime: pc.endTime,
        weekdays: [...new Set(counted.map(weekdayOf))].sort((a, b) => a - b),
        fromDate: counted[0], untilDate: counted[counted.length - 1],
        draftDays: dd, draftBy: [...new Set(dd.flatMap(d => draftByDay.get(d) ?? []))],
      });
    }
    // The stretches the row says: by hours, the weekdays that run at them; earliest weekday first.
    const byHours = new Map<string, FreePattern>();
    for (const pc of rowPieces) {
      const k = `${pc.startTime}|${pc.endTime}`;
      const at = byHours.get(k) ?? byHours.set(k, { weekdays: [], startTime: pc.startTime, endTime: pc.endTime }).get(k)!;
      for (const w of pc.weekdays) if (!at.weekdays.includes(w)) at.weekdays.push(w);
    }
    const patterns = [...byHours.values()].map(x => ({ ...x, weekdays: x.weekdays.sort((a, b) => a - b) }))
      .sort((a, b) => a.weekdays[0] - b.weekdays[0] || a.startTime.localeCompare(b.startTime));

    const permitIds = [...new Set((pieces.get(key) ?? []).map(pc => pc.permitId))]
      .sort((a, b) => permitById.get(a)!.startsOn.localeCompare(permitById.get(b)!.startsOn) || newness(permitById.get(a)!).localeCompare(newness(permitById.get(b)!)));
    const sharing = [...new Set(shared.flatMap(d => [...byDay.get(d)!.permits]))];
    const pricedBy = sharing.length
      ? sharing.reduce((best, id) => (newness(permitById.get(id)!) > newness(permitById.get(best)!) ? id : best))
      : null;

    rows.push({
      venueId, unit, permitIds, heldDays, freeDays, draftDays, draftBy, freeMinutes,
      patterns, evening: patterns.length > 0 && patterns.every(x => x.startTime >= EVENING),
      shared, pricedBy, pieces: rowPieces,
    });
  }
  rows.sort((a, b) => (order.get(`${a.venueId}|${a.unit ?? ''}`) ?? n) - (order.get(`${b.venueId}|${b.unit ?? ''}`) ?? n));

  return {
    rows,
    permitsInDates: inDates.length,
    heldWeekdays: [...heldWeekdays].sort((a, b) => a - b),
    kinds: [...kinds].sort(),
    venueIds: [...venueIds],
    issuers: [...issuers].sort(),
  };
}
