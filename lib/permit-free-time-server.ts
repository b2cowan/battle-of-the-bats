/**
 * FREE TIME ACROSS EVERY PERMIT — the reads behind "Find the time" (a schedule on several permits, Session D; plan
 * CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md §4d). The arithmetic is `freeTime` (`lib/permit-free-time.ts`, pure); this file
 * only gathers what it subtracts, from the same sources the rest of the product reads:
 *
 *   - the permits the club holds in the window (`readPermitTimes`), each with its issuer as the Permits view says it;
 *   - BOOKED: `readClubBookings` — finalized practices, house league games and practices, tryouts, tournament games: the
 *     bookings a permit's Used figure already counts (one model of taken time; nothing here is a second one) — plus the
 *     schedules' own time, which no booking carries: a FINAL schedule's slots (its house-league time before the league
 *     divides it is a slot and nothing else) and the time the asking schedule already holds (New schedule's rows, or a
 *     saved schedule's slots);
 *   - HELD BY A DRAFT: other schedules' draft and in-review slots, named by their schedule (P7 A). This is the only place
 *     the product reads a draft as holding time — nothing is booked by it.
 */
import { supabaseAdmin } from './supabase-admin';
import { fetchAll } from './supabase-paging';
import { addCalendarDays, zonedWallClockToUtc } from './timezone';
import { readClubBookings } from './venue-clash-lookup';
import { readScheduleSlotsIn } from './club-schedule-others-server';
import { takesFrom } from './club-schedule-engine';
import { maskProp, sectionsOf } from './field-parts';
import { readPermitTimes } from './permit-lookup';
import { permitIssuers } from './permit-server';
import { placesHeld, type BookingPlace, type PartBlock, type PermitTime } from './permit-time';
import { freeTime, type FreeFilters, type FreeTime, type TakenTime } from './permit-free-time';

/** The time the asking schedule already holds, when it is not saved yet (New schedule's rows): its own dates and dates off. */
export type OwnTime = Omit<PermitTime, 'id' | 'blocks'> & { blocks: readonly PartBlock[] };

/**
 * The club's free time in the filters. `scheduleId`: a saved schedule asking (Add time) — the FAMILY's first schedule
 * (Phase 8: the schedule itself, or the one a part was added to) — its family's slots are taken, never "held by a draft". `own`: New schedule's rows, not saved yet — taken too, so what the form already holds is not offered
 * again.
 */
export async function readFreeTime(orgId: string, filters: FreeFilters, opts: { scheduleId?: string | null; own?: OwnTime | null } = {}): Promise<FreeTime> {
  const fromMs = Date.parse(zonedWallClockToUtc(filters.from, '00:00')!);
  const toMs = Date.parse(zonedWallClockToUtc(addCalendarDays(filters.to, 1), '00:00')!);
  // The permits bring the club's places with them (a venue's name and facilities); their issuers read beside the rest.
  const timesRead = readPermitTimes(orgId, { fromDay: filters.from, toDay: filters.to });
  const [times, issuers, kinds, pool, slots] = await Promise.all([
    timesRead,
    timesRead.then(t => permitIssuers(orgId, t.permits)),
    fetchAll<{ id: string; facility_type: string | null; sections: number | null }>((a, b) => supabaseAdmin.from('org_venue_facilities')
      .select('id, facility_type, sections').eq('org_id', orgId).order('id').range(a, b)),
    readClubBookings(orgId, fromMs, toMs),
    // Every schedule's live slots in the window (a slot taken off by Send the changes is gone) — the one read the builder
    // and the permit's Used line make too (Session 2D).
    readScheduleSlotsIn(orgId, fromMs, toMs),
  ]);
  const kindOf = new Map(kinds.map(k => [k.id, k.facility_type]));
  const splitOf = new Map(kinds.map(k => [k.id, sectionsOf(k.sections)]));

  // Every venue, a venue with no facilities too, by name; each venue's facilities in the club's order.
  const venueFacilities = new Map<string, string[]>(
    [...times.venueName].sort(([, a], [, b]) => a.localeCompare(b)).map(([id]) => [id, times.venueFacilities.get(id) ?? []]),
  );

  // Each booking and slot keeps its part (Stage 2, Session 2D): side A taken leaves side B offered.
  const booked: BookingPlace[] = pool.bookings.map(b => ({ venueId: b.venueId, facilityId: b.facilityId, ...maskProp(b.sectionMask), startMs: b.startMs, endMs: b.endMs }));
  const drafts: TakenTime[] = [];
  for (const s of slots) {
    // The asker here is never final (a new schedule, a draft, a new part): every final schedule takes its time.
    if (s.familyId === opts.scheduleId || takesFrom(s, null)) booked.push(s);
    else drafts.push(s);
  }
  if (opts.own) booked.push(...placesHeld(opts.own, venueFacilities));

  return freeTime({
    permits: times.permits.map(p => ({
      id: p.id, startsOn: p.startsOn, endsOn: p.endsOn, blocks: p.blocks, datesOff: p.datesOff,
      name: p.name, issuer: issuers.get(p.id) ?? null, createdAt: p.createdAt ?? null,
    })),
    venueFacilities,
    kindOf: unit => (unit ? kindOf.get(unit) ?? null : null),
    sectionsOf: unit => splitOf.get(unit) ?? 1,
    booked,
    drafts,
  }, filters);
}
