/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A SCHEDULE ON SEVERAL PERMITS — the rows' one rule where two permits hold the same time (Session A; plan
 * CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md §4a; drawing tab 1 note 3 and tab 3's statement; owner ruling P4 A, 2026-11-14:
 * "the row's own permit prices it", never a lookup).
 *
 * Two ticked permits can hold the same park at the same hour (Milton spring and Milton June both hold Kinsmen on May 25
 * and 27). A place's hour is held once (`overlappingBlocks` refuses it at the save), so the PERMIT TICKED FIRST keeps those
 * evenings and a later permit's rows lose exactly those days — split into the pieces that are left — and the form says
 * so: "Tue, May 25 and Thu, May 27 at Kinsmen Park are on this schedule already, from Milton spring 2027. They stay as
 * they are, priced there. The new time starts Tue, Jun 1."
 *
 * Settled when the time is SENT (the form's time body), never by cutting the rows the admin edits: unticking the earlier
 * permit gives the later one its evenings back, and nothing an admin narrowed is lost. Typed rows (no permit) never take
 * part — two typed rows that overlap are the save's own refusal, as today. Pure: no React, no database.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { addCalendarDays } from './timezone';
import { clock, weekdayOf } from './permit-time';

/** A row of the schedule's time as the form sends it. Facilities are listed (empty = a venue with none, the venue itself). */
export interface PermitRowBlock {
  venueId: string;
  facilityIds: readonly string[];
  weekdays: readonly number[];
  startTime: string;
  endTime: string;
  fromDate: string | null;
  untilDate: string | null;
  permitId?: string | null;
}

/** Days a later permit's rows lost to an earlier one, at one park. */
export interface PermitOverlap {
  /** The later permit, whose rows lost the days. */
  permitId: string;
  /** The permit ticked first, which keeps them (and prices them). */
  keptBy: string;
  venueId: string;
  /** The club days, in order. */
  days: string[];
  /** The later permit's first day left at this park, when it now starts later than its rows there did — else null. */
  startsOn: string | null;
}

const MAX_DAYS = 400;

/** The days of `weekdays` inside from..until, in order. */
function daysIn(from: string, until: string, weekdays: readonly number[]): string[] {
  const out: string[] = [];
  for (let d = from, i = 0; d <= until && i < MAX_DAYS; d = addCalendarDays(d, 1), i++) if (weekdays.includes(weekdayOf(d))) out.push(d);
  return out;
}

/** The first day of `weekdays` on or after from, up to until (null when none). */
function firstDay(from: string, until: string, weekdays: readonly number[]): string | null {
  for (let d = from, i = 0; d <= until && i < 7; d = addCalendarDays(d, 1), i++) if (weekdays.includes(weekdayOf(d))) return d;
  return null;
}

const sameFacilities = (a: readonly string[], b: readonly string[]) => (!a.length && !b.length) || a.some(f => b.includes(f));

/**
 * Each later permit's rows less what an earlier permit's rows already hold — the same venue, a facility in common, a
 * weekday in common, hours that overlap and dates that overlap. `order` is the permits in the order they were ticked
 * (any permit not in it ranks after, in the order its rows come). `range` is the schedule's own dates (a row with none
 * runs on them). Rows keep their order; a row that is split becomes its pieces in place; a piece with no day left goes.
 */
export function settleOverlaps<B extends PermitRowBlock>(blocks: readonly B[], order: readonly string[], range: { startsOn: string; endsOn: string }):
  { blocks: B[]; overlaps: PermitOverlap[] } {
  const ranked = [...order];
  for (const b of blocks) if (b.permitId && !ranked.includes(b.permitId)) ranked.push(b.permitId);
  const fromOf = (b: PermitRowBlock) => b.fromDate ?? range.startsOn;
  const untilOf = (b: PermitRowBlock) => b.untilDate ?? range.endsOn;
  const pieces = new Map<number, B[]>();
  const kept: B[] = [];
  const lost = new Map<string, PermitOverlap>();

  for (const permitId of ranked) {
    const mine: B[] = [];
    blocks.forEach((b, i) => {
      if (b.permitId !== permitId) return;
      let parts: B[] = [b];
      for (const w of kept) {
        const next: B[] = [];
        for (const p of parts) {
          const lo = fromOf(p) > fromOf(w) ? fromOf(p) : fromOf(w);
          const hi = untilOf(p) < untilOf(w) ? untilOf(p) : untilOf(w);
          const weekdays = p.weekdays.filter(d => w.weekdays.includes(d));
          // (`daysIn` is empty when there is no weekday in common or the dates don't meet.)
          const clash = p.venueId === w.venueId && sameFacilities(p.facilityIds, w.facilityIds)
            && clock(p.startTime) < clock(w.endTime) && clock(w.startTime) < clock(p.endTime);
          const days = clash ? daysIn(lo, hi, weekdays) : [];
          if (!days.length) { next.push(p); continue; }
          const facilities = p.facilityIds.filter(f => w.facilityIds.includes(f));
          const otherFacilities = p.facilityIds.filter(f => !w.facilityIds.includes(f));
          const otherDays = p.weekdays.filter(d => !weekdays.includes(d));
          // The facilities the earlier permit doesn't hold here keep the row whole; so do its other weekdays.
          if (otherFacilities.length) next.push({ ...p, facilityIds: otherFacilities });
          if (otherDays.length) next.push({ ...p, facilityIds: facilities, weekdays: otherDays });
          // The shared facilities and weekdays, before and after the days in common.
          if (lo > fromOf(p)) next.push({ ...p, facilityIds: facilities, weekdays, fromDate: fromOf(p), untilDate: addCalendarDays(lo, -1) });
          if (hi < untilOf(p)) next.push({ ...p, facilityIds: facilities, weekdays, fromDate: addCalendarDays(hi, 1), untilDate: untilOf(p) });
          const key = `${permitId}|${w.permitId}|${p.venueId}`;
          const was = lost.get(key) ?? lost.set(key, { permitId, keptBy: w.permitId!, venueId: p.venueId, days: [], startsOn: null }).get(key)!;
          for (const d of days) if (!was.days.includes(d)) was.days.push(d);
        }
        parts = next.filter(x => firstDay(fromOf(x), untilOf(x), x.weekdays) !== null);
      }
      pieces.set(i, parts);
      mine.push(...parts);
    });
    kept.push(...mine);
  }

  const out: B[] = [];
  blocks.forEach((b, i) => { out.push(...(b.permitId ? pieces.get(i) ?? [] : [b])); });
  const overlaps = [...lost.values()].map(o => {
    const days = [...o.days].sort();
    // The later permit's first day at that park, as its rows held it and as what is left holds it.
    const firstOf = (list: readonly PermitRowBlock[]) => list.filter(x => x.permitId === o.permitId && x.venueId === o.venueId)
      .map(x => firstDay(fromOf(x), untilOf(x), x.weekdays)).filter((d): d is string => !!d).sort()[0] ?? null;
    const was = firstOf(blocks), now = firstOf(out);
    return { ...o, days, startsOn: now && was && now > was ? now : null };
  });
  return { blocks: out, overlaps };
}

/** The dates that cover every permit picked: the first permit's first day to the last one's last. */
export function permitsSpan(permits: readonly { startsOn: string; endsOn: string }[]): { startsOn: string; endsOn: string } | null {
  if (!permits.length) return null;
  return {
    startsOn: permits.reduce((m, p) => (p.startsOn < m ? p.startsOn : m), permits[0].startsOn),
    endsOn: permits.reduce((m, p) => (p.endsOn > m ? p.endsOn : m), permits[0].endsOn),
  };
}
