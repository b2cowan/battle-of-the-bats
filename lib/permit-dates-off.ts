/**
 * permit-dates-off.ts (server-only — reads through the club's server readers) — WHAT A PERMIT'S DATES OFF TOOK (Club Tier
 * Stage 13c, C2 = A and C3 = A, owner 2026-11-08; drawing CLUB_TIER_STAGE13C_DRAWINGS.html, the permit and the form).
 *
 * ONE ANSWER, every surface: the Permits row's flag, the permit window's notice, the form's "Booked that day", and (Session
 * B) the Overview's "Outside the permit · N", the Permits row's count, the Calendar's day mark and house league's Schedule
 * health. The rule is `tookByDateOff` (lib/permit-time.ts §4): a booking this permit's own hours would hold that day, were
 * the day not off, that no other permit of the club still covers. ⚖ NOT the removed "Outside it" (owner 2026-10-11).
 *
 * ⚠ NO QUERY OF ITS OWN (build-enforced, tests/unit/permit-dates-off.test.ts): the permits come from `readPermitTimes`,
 * the bookings from `readClubBookings` (every program, cancelled and postponed already gone), and the words a reader may see
 * from `readClubCalendar` (the Calendar's own read — so a booking is named the way the Calendar names it, and a door is
 * drawn only into a program the reader can open). No second booking query, no second "on a date off".
 *
 * BOUNDED: dates off from TODAY on only (a past one took nothing anyone can still move — the notice goes when the days pass),
 * and bookings read only on those days, near days read together.
 * The callers gate the plan (permits ride the Venue library: `hasOrgVenueLibrary`) and the reader; nothing here writes.
 */
import { addCalendarDays, daysBetweenDateStrings, zonedWallClockToUtc } from './timezone';
import { readDatesOffAhead, readPermitTimes, type ClubPlaces, type PermitTimes } from './permit-lookup';
import { readClubBookings } from './venue-clash-lookup';
import { calendarPrograms, readClubCalendar, MAX_CALENDAR_DAYS, type CalendarReader } from './club-calendar';
import { datesOffTaken, type PermitTime, type VenueFacilities } from './permit-time';
import type { TakenKind } from './permit-words';
import { buildDatesOffNotice, type DatesOffNotice, type TakenDay } from './permit-dates-off-view';
import { canOpenClubSchedules } from './club-schedule-gate';
import type { ClubBooking } from './venue-clash';
import type { CalendarBooking } from './club-calendar-view';

/** Near days are read as one window (a permit's Saturdays a week apart); farther ones each on their own. */
const NEAR_DAYS = 8;

/** Days, sorted, into runs no longer than `maxSpan` days whose neighbours are at most `gap` days apart. */
function dayRuns(days: readonly string[], gap = NEAR_DAYS, maxSpan = MAX_CALENDAR_DAYS): { from: string; to: string }[] {
  const sorted = [...new Set(days)].sort();
  const runs: { from: string; to: string }[] = [];
  for (const d of sorted) {
    const last = runs[runs.length - 1];
    if (last && daysBetweenDateStrings(last.to, d) <= gap && daysBetweenDateStrings(last.from, d) < maxSpan) last.to = d;
    else runs.push({ from: d, to: d });
  }
  return runs;
}

/** The club's bookings on these days (each run padded by the pool's own day either side), once each. */
async function bookingsOnDays(orgId: string, days: readonly string[]): Promise<ClubBooking[]> {
  const runs = dayRuns(days);
  const parts = await Promise.all(runs.map(r => readClubBookings(
    orgId,
    Date.parse(zonedWallClockToUtc(r.from, '00:00')!),
    Date.parse(zonedWallClockToUtc(addCalendarDays(r.to, 1), '00:00')!),
  )));
  const seen = new Set<string>();
  const out: ClubBooking[] = [];
  for (const p of parts) for (const b of p.bookings) if (!seen.has(b.key)) { seen.add(b.key); out.push(b); }
  return out;
}

/** Per permit: its dates off from today on that took something, in day order. A permit whose dates off took nothing is absent. */
type TakenByPermit = Map<string, TakenDay[]>;

const NO_TIMES = (): PermitTimes => ({ permits: [], venueFacilities: new Map(), venueName: new Map(), facilityName: new Map() });

/**
 * The club's permits (or the ones asked for) and what each one's dates off from `from` (today, or a later range start) to
 * `through` (when asked) took. MEASURED (13c Session B): one small read of the dates off in range — a club with none stops
 * there — then, together, the permits still running (every one: another permit may still cover the day) and the bookings
 * on those days only. A booking that has ended (`nowMs`) is not counted (owner 2026-11-08, item d).
 */
export async function readDatesOffTaken(orgId: string, opts: { from: string; nowMs: number; permitIds?: readonly string[]; through?: string }): Promise<{ taken: TakenByPermit; times: PermitTimes }> {
  const taken: TakenByPermit = new Map();
  const ahead = await readDatesOffAhead(orgId, { fromDay: opts.from, toDay: opts.through, permitIds: opts.permitIds });
  if (!ahead.length) return { taken, times: NO_TIMES() };
  const wanted = new Set(ahead.map(d => d.permitId));
  const [times, pool] = await Promise.all([
    readPermitTimes(orgId, { fromDay: opts.from }),
    bookingsOnDays(orgId, ahead.map(d => d.day)),
  ]);
  for (const p of times.permits) {
    if (!wanted.has(p.id)) continue;
    const hit = datesOffTaken(p, pool, times.permits, times.venueFacilities as VenueFacilities, { from: opts.from, nowMs: opts.nowMs, through: opts.through })
      .filter(d => d.bookings.length);
    if (hit.length) taken.set(p.id, hit);
  }
  return { taken, times };
}

/** The flag and the count, said once: how many dates off took something, and how many bookings they took. */
export const takenTotals = (days: readonly TakenDay[]) => ({ dates: days.length, bookings: days.reduce((n, d) => n + d.bookings.length, 0) });

/**
 * THE FORM'S COUNT (drawing, the form): what one day holds that this permit's hours — AS THE FORM HAS THEM, saved or not —
 * would hold, were the day not off. `permit` is the form's time; `permitId` the stored permit it edits (so its stored self
 * is not "another permit" covering the day), or null in Add permit. A past day is never counted (null). `places` is the
 * club's venues and facilities the caller already read (the route reads them to check the form's blocks).
 */
export async function readDayTaken(orgId: string, opts: { today: string; nowMs: number; day: string; permit: PermitTime; permitId: string | null; places: ClubPlaces }): Promise<TakenKind[] | null> {
  if (opts.day < opts.today) return null;
  const venueIds = [...new Set(opts.permit.blocks.map(b => b.venueId))];
  if (!venueIds.length) return [];
  const [times, pool] = await Promise.all([
    readPermitTimes(orgId, { venueIds, fromDay: opts.day, toDay: opts.day }),
    bookingsOnDays(orgId, [opts.day]),
  ]);
  const others = times.permits.filter(p => p.id !== opts.permitId);
  const [day] = datesOffTaken({ ...opts.permit, id: opts.permitId ?? 'draft' }, pool, others, opts.places.byVenue, { from: opts.today, nowMs: opts.nowMs, days: [opts.day] });
  return (day?.bookings ?? []).map(kindOf);
}

const kindOf = (b: ClubBooking): TakenKind => ({ program: b.program, kind: b.kind });

// ── The permit window's notice (drawing, the permit) — its words and doors are `buildDatesOffNotice`'s (pure) ─────────

/**
 * The notice, as this reader may see it: what the reader's Calendar shows of these days (only its programs; none for a
 * reader with no Calendar), then the pure builder names the rows and draws only the doors the reader can open.
 */
export async function describeDatesOffTaken(reader: CalendarReader, days: readonly TakenDay[], names: Pick<PermitTimes, 'venueName'>): Promise<DatesOffNotice | null> {
  if (!days.length) return null;
  const seesCalendar = calendarPrograms(reader.member, reader.org).length > 0;
  const shown = new Map<string, CalendarBooking>();
  if (seesCalendar) {
    const reads = await Promise.all(dayRuns(days.map(d => d.day), MAX_CALENDAR_DAYS).map(r => readClubCalendar(reader, r.from, r.to)));
    // By the pool's key, found the Calendar's way (a tournament game is its day's booking, or a team's mirrored copy).
    for (const read of reads) {
      const byKey = new Map(read.bookings.map(b => [b.key, b]));
      for (const [poolKey, calendarKey] of read.calendarKeyOf) { const c = byKey.get(calendarKey); if (c) shown.set(poolKey, c); }
    }
  }
  return buildDatesOffNotice(days, shown, {
    slug: reader.org.slug,
    seesCalendar,
    canSchedules: canOpenClubSchedules({ planId: reader.org.planId, role: reader.member.role }),
  }, names.venueName);
}
