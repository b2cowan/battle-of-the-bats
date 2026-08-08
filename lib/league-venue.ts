/**
 * league-venue.ts (server-only — touches supabaseAdmin)
 *
 * The two server rails for house-league venues:
 *
 * 1. {@link resolveLeagueVenueSelection} — the ONLY way a venue reference gets onto a league
 *    game or practice. Validates the picked venue/surface against the ORG venue library
 *    (league fields reference `org_venues` DIRECTLY — owner decision 2026-08-08, no
 *    per-season copies) and DERIVES the display string, so `location` can never disagree
 *    with the reference. Free text survives only when nothing is picked.
 *
 * 2. {@link checkLeagueBookings} — the save-time clash check. Fetches the org-wide booking
 *    pool (games AND practices, all seasons — one booking pool, owner decision 2026-08-08)
 *    around the proposed window and reports conflicts, split into blocking (structured
 *    match) and warnings (typed-text match), with human-readable messages.
 *
 * Multi-tenant: the pool query is `.eq('org_id', …)` on both tables, and the selection
 * resolver rejects any venue/facility not owned by the org — text matching is looser than
 * id matching, so nothing from another org may ever enter the comparison set.
 */

import { supabaseAdmin } from './supabase-admin';
import { ORG_TIME_ZONE } from './timezone';
import {
  findLeagueBookingConflicts,
  isBlockingConflict,
  DEFAULT_LEAGUE_BOOKING_MINUTES,
  type LeagueBooking,
  type LeagueBookingConflict,
} from './league-schedule-conflict';

// Pure end-time resolution lives with the engine (unit-testable); routes import it from here.
export { resolveEndInstant } from './league-schedule-conflict';

// ---------------------------------------------------------------------------
// Venue selection → validated refs + derived display string
// ---------------------------------------------------------------------------

export interface LeagueVenueSelection {
  orgVenueId: string | null;
  orgVenueFacilityId: string | null;
  /** Derived "Venue — Facility" when picked; the trimmed typed text otherwise. */
  location: string | null;
}

export type LeagueVenueSelectionResult =
  | { ok: true; value: LeagueVenueSelection }
  | { ok: false; error: string };

export async function resolveLeagueVenueSelection(args: {
  orgId: string;
  orgVenueId?: string | null;
  orgVenueFacilityId?: string | null;
  /** Typed free text — used ONLY when no venue is picked. */
  locationText?: string | null;
}): Promise<LeagueVenueSelectionResult> {
  const { orgId, orgVenueId, orgVenueFacilityId, locationText } = args;

  if (!orgVenueId) {
    if (orgVenueFacilityId) {
      return { ok: false, error: 'A surface cannot be picked without its venue.' };
    }
    const text = locationText?.trim() || null;
    return { ok: true, value: { orgVenueId: null, orgVenueFacilityId: null, location: text } };
  }

  const { data: venue } = await supabaseAdmin
    .from('org_venues')
    .select('id, org_id, name')
    .eq('id', orgVenueId)
    .single();
  // "not found" for a foreign org's venue too — don't confirm it exists.
  if (!venue || venue.org_id !== orgId) {
    return { ok: false, error: 'Venue not found.' };
  }

  if (!orgVenueFacilityId) {
    return {
      ok: true,
      value: { orgVenueId: venue.id, orgVenueFacilityId: null, location: venue.name },
    };
  }

  const { data: facility } = await supabaseAdmin
    .from('org_venue_facilities')
    .select('id, org_venue_id, org_id, name')
    .eq('id', orgVenueFacilityId)
    .single();
  if (!facility || facility.org_id !== orgId || facility.org_venue_id !== venue.id) {
    return { ok: false, error: 'Surface not found at that venue.' };
  }

  return {
    ok: true,
    value: {
      orgVenueId: venue.id,
      orgVenueFacilityId: facility.id,
      // Same shape resolveGameVenueLabel renders for tournaments — one label everywhere.
      location: `${venue.name} — ${facility.name}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Save-time clash check against the org-wide pool
// ---------------------------------------------------------------------------

export interface LeagueConflictReport {
  /** Label of the proposed booking that clashes (matters for bulk saves). */
  proposedLabel: string;
  partnerKind: 'game' | 'practice';
  partnerLabel: string;
  /** ISO instant of the partner booking's start. */
  partnerStartsAt: string | null;
  /** The surface both bookings are on, as displayed. */
  fieldLabel: string;
  /** 'text' = both sides carry the same typed name rather than a picked field. */
  matchedOn: 'facility' | 'venue' | 'text';
  message: string;
}

export interface LeagueBookingCheck {
  blocking: LeagueConflictReport[];
  warnings: LeagueConflictReport[];
}

/** Row shape shared by the two pool queries. */
interface PoolRow {
  id: string;
  status: string;
  scheduled_at: string | null;
  ends_at?: string | null;
  org_venue_id: string | null;
  org_venue_facility_id: string | null;
  location: string | null;
  home_team_id?: string;
  away_team_id?: string;
  team_id?: string;
}

function report(
  proposed: LeagueBooking,
  conflict: LeagueBookingConflict,
): LeagueConflictReport {
  const { partner, matchedOn } = conflict;
  const fieldLabel = partner.location ?? proposed.location ?? 'the same surface';
  const when = partner.startsAt
    ? new Date(partner.startsAt).toLocaleString('en-CA', {
        timeZone: ORG_TIME_ZONE,
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
      })
    : 'an unknown time';
  const partnerNoun = partner.kind === 'practice' ? 'practice' : 'game';
  const typedNote = matchedOn === 'text'
    ? ' Both entries use the same typed location name — if these are different places, no action is needed.'
    : '';
  return {
    proposedLabel: proposed.label ?? 'This booking',
    partnerKind: partner.kind,
    partnerLabel: partner.label ?? `another ${partnerNoun}`,
    partnerStartsAt: partner.startsAt ?? null,
    fieldLabel,
    matchedOn,
    message:
      `${proposed.label ?? 'This booking'} overlaps ${partner.label ?? `another ${partnerNoun}`}`
      + ` (${partnerNoun}, ${when}) on ${fieldLabel}.${typedNote}`,
  };
}

/**
 * Check proposed bookings against everything the org has scheduled — games and practices,
 * every season — inside the proposed time range (padded a day each side), PLUS against each
 * other (two rows inside one bulk save can clash; the tournament import learned this the
 * hard way).
 *
 * `excludeGameIds` / `excludePracticeIds`: the rows being edited, so a reschedule never
 * conflicts with its own stored version.
 */
export async function checkLeagueBookings(args: {
  orgId: string;
  proposed: LeagueBooking[];
  excludeGameIds?: string[];
  excludePracticeIds?: string[];
}): Promise<LeagueBookingCheck> {
  const { orgId, proposed, excludeGameIds = [], excludePracticeIds = [] } = args;
  const empty: LeagueBookingCheck = { blocking: [], warnings: [] };

  const starts = proposed
    .map(b => (b.startsAt ? Date.parse(b.startsAt) : NaN))
    .filter(ms => !Number.isNaN(ms));
  if (!starts.length) return empty;

  const DAY = 24 * 60 * 60_000;
  const rangeStart = new Date(Math.min(...starts) - DAY).toISOString();
  const rangeEnd = new Date(
    Math.max(...starts) + DEFAULT_LEAGUE_BOOKING_MINUTES * 60_000 + DAY,
  ).toISOString();

  const [gamesRes, practicesRes] = await Promise.all([
    supabaseAdmin
      .from('league_games')
      .select('id, status, scheduled_at, ends_at, org_venue_id, org_venue_facility_id, location, home_team_id, away_team_id')
      .eq('org_id', orgId)
      .neq('status', 'cancelled')
      .neq('status', 'postponed')
      .gte('scheduled_at', rangeStart)
      .lte('scheduled_at', rangeEnd),
    supabaseAdmin
      .from('league_practices')
      .select('id, status, scheduled_at, ends_at, org_venue_id, org_venue_facility_id, location, team_id')
      .eq('org_id', orgId)
      .neq('status', 'cancelled')
      .gte('scheduled_at', rangeStart)
      .lte('scheduled_at', rangeEnd),
  ]);

  const gameRows = ((gamesRes.data ?? []) as PoolRow[])
    .filter(r => !excludeGameIds.includes(r.id));
  const practiceRows = ((practicesRes.data ?? []) as PoolRow[])
    .filter(r => !excludePracticeIds.includes(r.id));

  // Resolve team names once, for readable partner labels.
  const teamIds = new Set<string>();
  for (const r of gameRows) { if (r.home_team_id) teamIds.add(r.home_team_id); if (r.away_team_id) teamIds.add(r.away_team_id); }
  for (const r of practiceRows) { if (r.team_id) teamIds.add(r.team_id); }
  const teamName = new Map<string, string>();
  if (teamIds.size) {
    const { data: teams } = await supabaseAdmin
      .from('league_teams')
      .select('id, name')
      .in('id', [...teamIds]);
    for (const t of teams ?? []) teamName.set(t.id, t.name);
  }

  const pool: LeagueBooking[] = [
    ...gameRows.map((r): LeagueBooking => ({
      id: r.id, kind: 'game',
      startsAt: r.scheduled_at, endsAt: r.ends_at ?? null, status: r.status,
      orgVenueId: r.org_venue_id, orgVenueFacilityId: r.org_venue_facility_id,
      location: r.location,
      label: `${teamName.get(r.home_team_id ?? '') ?? 'Home'} vs ${teamName.get(r.away_team_id ?? '') ?? 'Away'}`,
    })),
    ...practiceRows.map((r): LeagueBooking => ({
      id: r.id, kind: 'practice',
      startsAt: r.scheduled_at, endsAt: r.ends_at ?? null, status: r.status,
      orgVenueId: r.org_venue_id, orgVenueFacilityId: r.org_venue_facility_id,
      location: r.location,
      label: `${teamName.get(r.team_id ?? '') ?? 'Team'} practice`,
    })),
  ];

  const result: LeagueBookingCheck = { blocking: [], warnings: [] };
  const seen = new Set<string>();

  proposed.forEach((b, i) => {
    // Siblings in the same save are part of each booking's pool (minus itself).
    const siblings = proposed.filter((_, j) => j !== i);
    for (const conflict of findLeagueBookingConflicts(b, [...pool, ...siblings])) {
      // One report per unordered pair, so a sibling clash isn't listed twice.
      const pairKey = [`${b.kind}:${b.id}`, `${conflict.partner.kind}:${conflict.partner.id}`]
        .sort().join('|');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      const r = report(b, conflict);
      (isBlockingConflict(conflict) ? result.blocking : result.warnings).push(r);
    }
  });

  return result;
}
