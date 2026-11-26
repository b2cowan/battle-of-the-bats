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
  blockDates, blockUnits, bucketByDay, clock, takenAt, unionSpans, weekdayOf, windowOn, without,
  type BookingPlace, type PermitTime, type PlaceUnit, type Span, type TimeBlock, type VenueFacilities,
} from './permit-time';
import { WHOLE, byQuarter, holdsAll, legalMasks, maskOf, maskProp, maskRank, partFactor, partsOverlap, type FieldSections } from './field-parts';

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
  /** How a facility splits (Stage 2, Session 2D); absent = nothing is split (every row is a whole place, as before). */
  sectionsOf?: (unit: string) => FieldSections;
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
  /** The part of the field it brings (Session 2D); absent = the whole field. */
  sectionMask?: number;
  fromDate: string;
  untilDate: string;
  draftDays: string[];
  draftBy: string[];
}

export interface FreeRow {
  venueId: string;
  unit: PlaceUnit;
  /** A part of a split field (Session 2D): its row counts only the days its larger ground does not. Absent = the whole. */
  sectionMask?: number;
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
  /** The count line's facilities: a place once, however many part rows it has (2D design check F6). */
  places: number;
  /** The count line's free minutes, each piece of ground once: a part row adds its minutes only on a day no row over
   *  its ground already counts (Field 1's own row, or the side a quarter is in). Not the sum of the rows'. */
  freeMinutes: number;
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

/** The length of a set of stretches that don't overlap, minutes. */
const spanMinutes = (spans: readonly Span[]) => spans.reduce((m, [s, e]) => m + (e - s) / MIN, 0);

/** The longest piece, minutes. */
const longest = (spans: readonly Span[]) => spans.reduce((m, [s, e]) => Math.max(m, (e - s) / MIN), 0);

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

  // The fields something books or drafts BY PART (Stage 2, Session 2D): only those can offer a part row.
  const partBooked = new Set([...input.booked, ...input.drafts].filter(b => b.facilityId && maskOf(b.sectionMask) !== WHOLE).map(b => b.facilityId!));

  const rows: FreeRow[] = [];
  let groundMinutes = 0;
  for (const [key, byDay] of cells) {
    const { venueId, unit } = placeOf.get(key)!;
    // Each day's held time, in order, once: every row of the place (the field and its parts) reads the same days.
    const days = [...byDay].sort(([a], [b]) => a.localeCompare(b))
      .map(([day, cell]) => ({ day, cell, held: unionSpans(cell.spans) }))
      .filter(d => longest(d.held) >= minMinutes);
    if (!days.length) continue;
    const heldDays = days.length;
    const permitIds = [...new Set((pieces.get(key) ?? []).map(pc => pc.permitId))]
      .sort((a, b) => permitById.get(a)!.startsOn.localeCompare(permitById.get(b)!.startsOn) || newness(permitById.get(a)!).localeCompare(newness(permitById.get(b)!)));
    // A SPLIT FIELD (Stage 2, Session 2D): the field's own row as before (any part taken takes the whole), then a row per
    // part that offers something its larger ground doesn't — side B on a Sunday side A is taken; a quarter only when its
    // side doesn't either. A part's row counts EVERY day the part is free (owner 2026-11-26: picking side B alone brings
    // every Sunday side B is free; a field's rows are one pick at a time, `tickFound`), so a day can show on the field's
    // row and its side's. A field nothing books by part has no part row, so it reads exactly as before.
    const masks = unit !== null && partBooked.has(unit) ? legalMasks(input.sectionsOf?.(unit) ?? 1) : [WHOLE];
    const counts = new Map<number, Map<string, 'free' | 'draft'>>();
    /** Each shown row's free stretches by day, for the count line's ground-once total. */
    const shownFree = new Map<number, Map<string, Span[]>>();
    for (const mask of masks) {
      const larger = masks.filter(m => m !== mask && holdsAll(m, mask));
      const status = new Map<string, 'free' | 'draft'>();
      /** Each free day's stretches long enough to count, and each draft-held day's drafts. A day sits in one. */
      const freeByDay = new Map<string, Span[]>();
      const draftByDay = new Map<string, string[]>();
      const shared: string[] = [];
      for (const { day, cell, held } of days) {
        const open = without(held, takenAt(booked.get(`${venueId}|${day}`), unit, mask).map(b => [b.startMs, b.endMs] as Span));
        if (longest(open) < minMinutes) continue;
        const onDay = takenAt(drafts.get(`${venueId}|${day}`), unit, mask);
        const free = without(open, onDay.map(b => [b.startMs, b.endMs] as Span));
        if (longest(free) >= minMinutes) {
          status.set(day, 'free');
          freeByDay.set(day, free.filter(([s, e]) => (e - s) / MIN >= minMinutes));
          if (cell.permits.size > 1) shared.push(day);
        } else {
          status.set(day, 'draft');
          // The drafts that stand in the way: those meeting the time left once the bookings are out.
          draftByDay.set(day, [...new Set(onDay.filter(b => open.some(([s, e]) => b.startMs < e && b.endMs > s)).map(b => b.by))]);
        }
      }
      counts.set(mask, status);
      // A part's row stands only when it offers a day no larger ground does (free where none is free, held by a draft
      // where none counts).
      const offersMore = [...status].some(([day, s]) => !larger.some(m => (s === 'free' ? counts.get(m)?.get(day) === 'free' : counts.get(m)?.has(day))));
      if (mask !== WHOLE && !offersMore) continue;
      shownFree.set(mask, freeByDay);
      const freeDays = freeByDay.size, draftDays = draftByDay.size;
      // A part counts its share.
      const freeMinutes = partFactor(mask) * spanMinutes([...freeByDay.values()].flat());
      const draftBy = [...new Set([...draftByDay.values()].flat())];

      // The pieces a pick brings: each cut to the days that count (free, or held by a draft), dropped when none do.
      const rowPieces: FreePiece[] = [];
      for (const pc of pieces.get(key) ?? []) {
        const counted = pc.days.filter(d => status.has(d));
        if (!counted.length) continue;
        const dd = counted.filter(d => status.get(d) === 'draft');
        rowPieces.push({
          permitId: pc.permitId, venueId: pc.venueId, unit: pc.unit, ...maskProp(mask), startTime: pc.startTime, endTime: pc.endTime,
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

      const sharing = [...new Set(shared.flatMap(d => [...byDay.get(d)!.permits]))];
      const pricedBy = sharing.length
        ? sharing.reduce((best, id) => (newness(permitById.get(id)!) > newness(permitById.get(best)!) ? id : best))
        : null;

      rows.push({
        venueId, unit, ...maskProp(mask), permitIds, heldDays, freeDays, draftDays, draftBy, freeMinutes,
        patterns, evening: patterns.length > 0 && patterns.every(x => x.startTime >= EVENING),
        shared, pricedBy, pieces: rowPieces,
      });
    }
    // The count line's minutes (2D design check F6): per day and quarter, the time ANY shown row over that ground offers,
    // once. So side B's Sundays add nothing while Field 1's own row is free, and add their share for the hours only side B is.
    for (const { day } of days) {
      groundMinutes += byQuarter(q => spanMinutes(unionSpans(
        [...shownFree].flatMap(([mask, freeByDay]) => (partsOverlap(mask, q) ? freeByDay.get(day) ?? [] : [])),
      )));
    }
  }
  // A field's parts follow it, in the part order (`maskRank`: sides, then quarters); the sort is stable.
  rows.sort((a, b) => (order.get(`${a.venueId}|${a.unit ?? ''}`) ?? n) - (order.get(`${b.venueId}|${b.unit ?? ''}`) ?? n)
    || maskRank(a.sectionMask) - maskRank(b.sectionMask));

  return {
    rows,
    places: new Set(rows.map(r => `${r.venueId}|${r.unit ?? ''}`)).size,
    freeMinutes: groundMinutes,
    permitsInDates: inDates.length,
    heldWeekdays: [...heldWeekdays].sort((a, b) => a - b),
    kinds: [...kinds].sort(),
    venueIds: [...venueIds],
    issuers: [...issuers].sort(),
  };
}
