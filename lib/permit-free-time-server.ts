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
import { readPermitTimes } from './permit-lookup';
import { permitIssuers } from './permit-server';
import { blockDates, blockUnits, windowOn, type BookingPlace, type PermitTime } from './permit-time';
import { freeTime, type FreeFilters, type FreeTime, type TakenTime } from './permit-free-time';

/** The time the asking schedule already holds, when it is not saved yet (New schedule's rows): its own dates and dates off. */
export type OwnTime = Omit<PermitTime, 'id'>;

/** Every place this time holds, day by day, as bookings (a venue with no facilities is the venue itself). */
function ownBookings(own: OwnTime, venueFacilities: ReadonlyMap<string, readonly string[]>): BookingPlace[] {
  const permit: PermitTime = { id: 'own', ...own };
  const out: BookingPlace[] = [];
  for (const raw of own.blocks) {
    // The form's rows are a request body: only the club's own places count. A venue no permit holds cannot overlap a permit;
    // a facility that is not at the venue is dropped (never read as "all of it"), so a stuffed list costs nothing.
    const atVenue = venueFacilities.get(raw.venueId);
    if (!atVenue) continue;
    const facilityIds = raw.facilityIds.filter(f => atVenue.includes(f));
    if (raw.facilityIds.length && !facilityIds.length) continue;
    const b = { ...raw, facilityIds };
    const units = blockUnits(b, venueFacilities);
    for (const day of blockDates(permit, b)) {
      const w = windowOn(day, b);
      if (!(w.endMs > w.startMs)) continue;
      for (const u of units) out.push({ venueId: b.venueId, facilityId: u, startMs: w.startMs, endMs: w.endMs });
    }
  }
  return out;
}

interface SlotRow {
  schedule_id: string; family_id: string; org_venue_id: string; facility_id: string | null; starts_at: string; ends_at: string;
  club_schedules: { name: string; state: 'draft' | 'in_review' | 'final' } | null;
}

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
    fetchAll<{ id: string; facility_type: string | null }>((a, b) => supabaseAdmin.from('org_venue_facilities')
      .select('id, facility_type').eq('org_id', orgId).order('id').range(a, b)),
    readClubBookings(orgId, fromMs, toMs),
    // Every schedule's live slots in the window (a slot taken off by Send the changes is gone).
    fetchAll<SlotRow>((a, b) => supabaseAdmin.from('club_schedule_slots')
      .select('schedule_id, family_id, org_venue_id, facility_id, starts_at, ends_at, club_schedules!inner(name, state)')
      .eq('org_id', orgId).is('removed_at', null)
      .lt('starts_at', new Date(toMs).toISOString()).gt('ends_at', new Date(fromMs).toISOString())
      .order('id').range(a, b)),
  ]);
  const kindOf = new Map(kinds.map(k => [k.id, k.facility_type]));

  // Every venue, a venue with no facilities too, by name; each venue's facilities in the club's order.
  const venueFacilities = new Map<string, string[]>(
    [...times.venueName].sort(([, a], [, b]) => a.localeCompare(b)).map(([id]) => [id, times.venueFacilities.get(id) ?? []]),
  );

  const booked: BookingPlace[] = pool.bookings.map(b => ({ venueId: b.venueId, facilityId: b.facilityId, startMs: b.startMs, endMs: b.endMs }));
  const drafts: TakenTime[] = [];
  for (const s of slots) {
    const place = { venueId: s.org_venue_id, facilityId: s.facility_id, startMs: Date.parse(s.starts_at), endMs: Date.parse(s.ends_at) };
    const state = s.club_schedules?.state;
    if (s.family_id === opts.scheduleId || state === 'final') booked.push(place);
    else if (state === 'draft' || state === 'in_review') drafts.push({ ...place, by: s.club_schedules!.name });
  }
  if (opts.own) booked.push(...ownBookings(opts.own, venueFacilities));

  return freeTime({
    permits: times.permits.map(p => ({
      id: p.id, startsOn: p.startsOn, endsOn: p.endsOn, blocks: p.blocks, datesOff: p.datesOff,
      name: p.name, issuer: issuers.get(p.id) ?? null, createdAt: p.createdAt ?? null,
    })),
    venueFacilities,
    kindOf: unit => (unit ? kindOf.get(unit) ?? null : null),
    booked,
    drafts,
  }, filters);
}
