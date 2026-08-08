/**
 * league-schedule-conflict.ts
 *
 * Pure clash detection for HOUSE LEAGUE bookings — games and practices in ONE pool
 * (owner decision 2026-08-08: a booking is a booking; a practice occupying a surface
 * blocks a game on it, and vice versa).
 *
 * "Same surface?" is answered by `lib/venue-identity.ts`, reused verbatim — the module the
 * tournament engines share, written module-agnostic for exactly this phase (owner ruling R3).
 * Nothing here re-derives venue keys. League rows carry ORG-library references
 * (`org_venue_id` / `org_venue_facility_id`), which map onto the placement source's
 * venue/facility fields; because every comparison happens inside one org's pool, library ids
 * and the (tournament-scoped) copy-table ids can never meet.
 *
 * Differences from the tournament engine (`lib/schedule-conflict.ts`), all deliberate:
 * - League rows are timestamptz instants, not date+"HH:MM" strings, so windows are compared
 *   in epoch ms — no timezone re-derivation.
 * - League has no per-division timing config. A game's window is `scheduled_at → ends_at`,
 *   falling back to {@link DEFAULT_LEAGUE_BOOKING_MINUTES} when no end is set (same for a
 *   practice missing `ends_at`).
 * - No buffer severity. League play has no configured turnaround time; inventing one would
 *   manufacture warnings. Overlap is the only finding.
 * - Blocking is decided by the CALLER via {@link isBlockingConflict}: a structured match
 *   (both sides picked a real venue/surface) blocks a single save; a typed-text match warns
 *   — same principle as the tournament import ruling: two rows both reading "Home Field"
 *   must not be able to block legitimate work.
 */

import {
  resolveVenuePlacement,
  placementsShareSurface,
  isPlaced,
  type VenuePlacement,
  type VenuePlacementSource,
} from './venue-identity.ts';
// Relative + explicit extension for the same reason as above: value imports must resolve
// under the plain-node test runner.
import { zonedWallClockToUtc } from './timezone.ts';

/** Window assumed for a game (or practice) with no recorded end. */
export const DEFAULT_LEAGUE_BOOKING_MINUTES = 90;

/**
 * An end wall-clock on the booking's own date — rolled forward a day when it lands at or
 * before the start, so an 11:30 PM game ending "00:30" is an hour long, not minus-23. An
 * inverted end must never reach the database: this engine would quietly substitute its
 * 90-minute default while displays and exports showed the corrupt value.
 */
export function resolveEndInstant(
  startIso: string | null,
  dateStr?: string | null,
  endTime?: string | null,
): string | null {
  if (!dateStr || !endTime) return null;
  const end = zonedWallClockToUtc(dateStr, endTime);
  if (!end) return null;
  if (startIso) {
    const s = Date.parse(startIso);
    const e = Date.parse(end);
    if (!Number.isNaN(s) && !Number.isNaN(e) && e <= s) {
      return new Date(e + 24 * 60 * 60_000).toISOString();
    }
  }
  return end;
}

export interface LeagueBooking {
  id: string;
  kind: 'game' | 'practice';
  /** ISO instant (timestamptz). Null = unscheduled — never checked. */
  startsAt: string | null;
  /** ISO instant; null falls back to start + {@link DEFAULT_LEAGUE_BOOKING_MINUTES}. */
  endsAt?: string | null;
  /** 'cancelled' and 'postponed' bookings vacate their slot — excluded from all checks. */
  status?: string | null;
  orgVenueId?: string | null;
  orgVenueFacilityId?: string | null;
  /** Display cache / typed text — matched trim+case-fold only, via venue-identity. */
  location?: string | null;
  /** Human label ("Tigers vs Bears", "Tigers practice") carried through for messages. */
  label?: string;
}

function toPlacementSource(b: LeagueBooking): VenuePlacementSource {
  return {
    venueId: b.orgVenueId,
    venueFacilityId: b.orgVenueFacilityId,
    location: b.location,
  };
}

/** Stable identity across the two source tables (ids from different tables could collide). */
export function bookingKey(b: Pick<LeagueBooking, 'id' | 'kind'>): string {
  return `${b.kind}:${b.id}`;
}

export function resolveBookingPlacement(b: LeagueBooking): VenuePlacement {
  return resolveVenuePlacement(toPlacementSource(b));
}

/** [startMs, endMs) — null when the booking has no valid start instant. */
export function bookingWindow(b: LeagueBooking): { startMs: number; endMs: number } | null {
  if (!b.startsAt) return null;
  const startMs = Date.parse(b.startsAt);
  if (Number.isNaN(startMs)) return null;
  const endParsed = b.endsAt ? Date.parse(b.endsAt) : NaN;
  const endMs = !Number.isNaN(endParsed) && endParsed > startMs
    ? endParsed
    : startMs + DEFAULT_LEAGUE_BOOKING_MINUTES * 60_000;
  return { startMs, endMs };
}

export interface LeagueBookingConflict {
  /** The existing (or sibling-proposed) booking that shares the surface and the window. */
  partner: LeagueBooking;
  /**
   * How the shared surface was identified — 'facility' | 'venue' when both sides picked real
   * records, 'text' when the match is two identical typed strings. Drives block-vs-warn and
   * lets the message say the match was on a typed name.
   */
  matchedOn: 'facility' | 'venue' | 'text';
}

/**
 * A structured match blocks a save; a typed-text match warns. Two games both typed
 * "Riverside Park" MIGHT be the same place — the product says so but does not stand in
 * the way, because a false clash blocking legitimate work is the failure ranked worst.
 */
export function isBlockingConflict(c: LeagueBookingConflict): boolean {
  return c.matchedOn !== 'text';
}

function matchLevel(a: VenuePlacement, b: VenuePlacement): 'facility' | 'venue' | 'text' {
  if (a.kind === 'text' || b.kind === 'text') return 'text';
  return a.facilityId && b.facilityId ? 'facility' : 'venue';
}

interface PlacedBooking {
  booking: LeagueBooking;
  placement: VenuePlacement;
  window: { startMs: number; endMs: number } | null;
}

function toPlaced(b: LeagueBooking): PlacedBooking {
  return { booking: b, placement: resolveBookingPlacement(b), window: bookingWindow(b) };
}

function occupiesSlot(status: string | null | undefined): boolean {
  return status !== 'cancelled' && status !== 'postponed';
}

function isCheckable(p: PlacedBooking): boolean {
  return occupiesSlot(p.booking.status) && isPlaced(p.placement) && p.window !== null;
}

/**
 * All bookings in `pool` that share a surface AND overlap in time with `proposed`.
 * The proposed booking itself (same kind+id) is skipped, so editing a booking never
 * conflicts with its own stored row.
 */
export function findLeagueBookingConflicts(
  proposed: LeagueBooking,
  pool: LeagueBooking[],
): LeagueBookingConflict[] {
  const p = toPlaced(proposed);
  if (!isCheckable(p)) return [];

  const conflicts: LeagueBookingConflict[] = [];
  for (const other of pool) {
    if (bookingKey(other) === bookingKey(proposed)) continue;
    const o = toPlaced(other);
    if (!isCheckable(o)) continue;
    if (p.window!.startMs >= o.window!.endMs || p.window!.endMs <= o.window!.startMs) continue;
    if (!placementsShareSurface(p.placement, o.placement)) continue;
    conflicts.push({ partner: other, matchedOn: matchLevel(p.placement, o.placement) });
  }
  return conflicts;
}

/**
 * Season-wide scan for the schedule page's health strip: every checkable booking with at
 * least one clash, keyed by {@link bookingKey}, carrying its first partner. Quadratic over
 * one season's bookings — a league season is hundreds of rows at most.
 */
export function scanLeagueBookingConflicts(
  bookings: LeagueBooking[],
): Map<string, LeagueBookingConflict> {
  const placed = bookings.map(toPlaced).filter(isCheckable);
  const result = new Map<string, LeagueBookingConflict>();

  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i], b = placed[j];
      if (a.window!.startMs >= b.window!.endMs || a.window!.endMs <= b.window!.startMs) continue;
      if (!placementsShareSurface(a.placement, b.placement)) continue;
      const level = matchLevel(a.placement, b.placement);
      if (!result.has(bookingKey(a.booking))) {
        result.set(bookingKey(a.booking), { partner: b.booking, matchedOn: level });
      }
      if (!result.has(bookingKey(b.booking))) {
        result.set(bookingKey(b.booking), { partner: a.booking, matchedOn: level });
      }
    }
  }
  return result;
}

/**
 * Scheduled bookings the clash check cannot see: they have a start instant but no usable
 * placement (nothing set, or placeholder text like "TBD" — owner ruling R2). Unscheduled
 * bookings are NOT counted; they already surface as "Unscheduled" and have no window to check.
 * This is house league's `venue_unchecked` — silence must not read as a clean bill of health.
 */
export function countUncheckedBookings(bookings: LeagueBooking[]): number {
  return bookings.filter(b =>
    occupiesSlot(b.status)
    && bookingWindow(b) !== null
    && !isPlaced(resolveBookingPlacement(b)),
  ).length;
}
