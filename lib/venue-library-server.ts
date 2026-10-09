/**
 * venue-library-server.ts (server-only — touches supabaseAdmin) — Club Tier Stage 6b, Ask 9.
 *
 * Two jobs the Venue library's route needs and nothing else does:
 *
 *   1. `readVenueUsage` — WHAT BOOKS EACH VENUE. Every booking that links one of the club's venues: rep events and
 *      tryout days (mig 319), house-league games and practices (mig 229), and a tournament's copy that still carries
 *      the library link (`diamonds.source_org_venue_id`, kept by clone and import-from-past since 6a — S6-04) with
 *      its games. It answers the table's "Booked by this season", the window's section, each facility's upcoming
 *      count, and — past bookings included — whether the venue may be deleted at all (`anyBooking`).
 *
 *   2. `carryWordsForward` — A RENAME REACHES THE UPCOMING BOOKINGS THAT LINK IT, and only those. A club venue's words
 *      are COPIED onto a booking (6a's `clubVenueFields`; house league's derived "Venue — Facility"), which is what
 *      keeps the family calendar and the Maps link reading without a join. So renaming "Diamond 2" to "Diamond 2
 *      (big)" rewrites the copy on every booking that starts now or later; a past booking keeps the name it was
 *      played under, as the coach's place book's "Also update the upcoming events" does (`updateUpcomingEventsForPlace`,
 *      the precedent this follows to the column). It writes the rows directly — no route, no notice: the place didn't
 *      move, so nobody is told (the drawing's ruling). A tournament keeps its own copy, untouched.
 *
 * Multi-tenant: every read and write is scoped by the club's `org_id`, or by the club's own venue / facility ids (which
 * the caller has proved are this club's), and a tournament copy counts only when its tournament is this club's.
 */
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { isLiveSeasonStatus } from './season-live';
import { tournamentToday } from './timezone';
import { formatVenueLocation } from './venue-label';
import type { VenueUsage } from './venue-library';

/** A season or tournament that has finished no longer books "this season". */
const FINISHED = new Set(['completed', 'archived']);

type RepRow = { org_venue_id: string; org_venue_facility_id: string | null; team_id: string; program_year_id: string; starts_at: string | null; status: string | null };
type LeagueRow = { org_venue_id: string; org_venue_facility_id: string | null; season_id: string; scheduled_at: string | null; status: string | null };
type CopyRow = { id: string; source_org_venue_id: string; tournament_id: string; tournaments: { id: string; name: string; status: string } };
type FacilityCopyRow = { id: string; source_org_facility_id: string };
type GameRow = { id: string; diamond_id: string; venue_facility_id: string | null; game_date: string | null; status: string | null };

function emptyUsage(facilityIds: readonly string[]): VenueUsage {
  return {
    anyBooking: false, teams: [], seasons: [], tournaments: [], everTeams: [], everSeasons: [], everTournaments: [],
    facilities: Object.fromEntries(facilityIds.map(id => [id, { upcoming: 0, anyBooking: false }])),
  };
}

const byName = (a: string, b: string) => a.localeCompare(b, 'en-CA', { numeric: true });

/**
 * Who books each of the club's venues. `venues` are the club's own (the caller read them by `org_id`). A failed read
 * THROWS — the library never shows "Nothing booked" for a venue it could not read, which would offer a Delete that
 * strips its bookings (S6-08's quiet loss, back through a read failure).
 */
export async function readVenueUsage(
  orgId: string,
  venues: readonly { id: string; facilityIds: readonly string[] }[],
  now: Date = new Date(),
): Promise<Record<string, VenueUsage>> {
  const out: Record<string, VenueUsage> = Object.fromEntries(venues.map(v => [v.id, emptyUsage(v.facilityIds)]));
  if (!venues.length) return out;
  const venueIds = venues.map(v => v.id);
  const facilityIds = venues.flatMap(v => v.facilityIds);
  const venueOfFacility = new Map(venues.flatMap(v => v.facilityIds.map(f => [f, v.id] as const)));
  const nowIso = now.toISOString();
  const today = tournamentToday(now);

  const [repRows, tryoutRows, gameRows, practiceRows, copies, facilityCopies] = await Promise.all([
    fetchAll<RepRow>((a, b) => supabaseAdmin.from('rep_team_events')
      .select('org_venue_id, org_venue_facility_id, team_id, program_year_id, starts_at, status')
      .eq('org_id', orgId).not('org_venue_id', 'is', null).order('id').range(a, b)),
    fetchAll<RepRow>((a, b) => supabaseAdmin.from('rep_tryout_sessions')
      .select('org_venue_id, org_venue_facility_id, team_id, program_year_id, starts_at, status')
      .eq('org_id', orgId).not('org_venue_id', 'is', null).order('id').range(a, b)),
    fetchAll<LeagueRow>((a, b) => supabaseAdmin.from('league_games')
      .select('org_venue_id, org_venue_facility_id, season_id, scheduled_at, status')
      .eq('org_id', orgId).not('org_venue_id', 'is', null).order('id').range(a, b)),
    fetchAll<LeagueRow>((a, b) => supabaseAdmin.from('league_practices')
      .select('org_venue_id, org_venue_facility_id, season_id, scheduled_at, status')
      .eq('org_id', orgId).not('org_venue_id', 'is', null).order('id').range(a, b)),
    fetchAllIn<CopyRow>(venueIds, (c, a, b) => supabaseAdmin.from('diamonds')
      .select('id, source_org_venue_id, tournament_id, tournaments!inner(id, name, status, org_id)')
      .in('source_org_venue_id', c).eq('tournaments.org_id', orgId).order('id').range(a, b)),
    fetchAllIn<FacilityCopyRow>(facilityIds, (c, a, b) => supabaseAdmin.from('venue_facilities')
      .select('id, source_org_facility_id').in('source_org_facility_id', c).order('id').range(a, b)),
  ]);

  const [games, teams, years, seasons] = await Promise.all([
    fetchAllIn<GameRow>(copies.map(d => d.id), (c, a, b) => supabaseAdmin.from('games')
      .select('id, diamond_id, venue_facility_id, game_date, status').in('diamond_id', c).order('id').range(a, b)),
    fetchAllIn<{ id: string; name: string }>([...repRows, ...tryoutRows].map(r => r.team_id), (c, a, b) => supabaseAdmin
      .from('rep_teams').select('id, name').in('id', c).order('id').range(a, b)),
    fetchAllIn<{ id: string; status: string }>([...repRows, ...tryoutRows].map(r => r.program_year_id), (c, a, b) => supabaseAdmin
      .from('rep_program_years').select('id, status').in('id', c).order('id').range(a, b)),
    fetchAllIn<{ id: string; name: string; status: string }>([...gameRows, ...practiceRows].map(r => r.season_id), (c, a, b) => supabaseAdmin
      .from('league_seasons').select('id, name, status').in('id', c).order('id').range(a, b)),
  ]);
  const teamName = new Map(teams.map(t => [t.id, t.name]));
  const yearLive = new Map(years.map(y => [y.id, isLiveSeasonStatus(y.status)]));
  const season = new Map(seasons.map(s => [s.id, s]));

  // Per venue, accumulated as sets / counts, then written out sorted.
  type Acc = { teams: Set<string>; everTeams: Set<string>; seasons: Map<string, { games: number; practices: number }>; everSeasons: Set<string>; tournaments: Map<string, number>; everTournaments: Set<string> };
  const acc = new Map<string, Acc>(venueIds.map(id => [id, { teams: new Set(), everTeams: new Set(), seasons: new Map(), everSeasons: new Set(), tournaments: new Map(), everTournaments: new Set() }]));
  const facility = (venueId: string, facilityId: string | null, upcoming: boolean) => {
    const f = facilityId ? out[venueId]?.facilities[facilityId] : undefined;
    if (!f) return;
    f.anyBooking = true;
    if (upcoming) f.upcoming += 1;
  };

  for (const r of [...repRows, ...tryoutRows]) {
    const a = acc.get(r.org_venue_id);
    if (!a) continue;
    out[r.org_venue_id].anyBooking = true;
    const name = teamName.get(r.team_id) ?? 'A team';
    a.everTeams.add(name);
    const live = r.status !== 'cancelled';
    if (live && yearLive.get(r.program_year_id)) a.teams.add(name);
    facility(r.org_venue_id, r.org_venue_facility_id, live && !!r.starts_at && r.starts_at >= nowIso);
  }
  for (const [rows, kind] of [[gameRows, 'games'], [practiceRows, 'practices']] as const) {
    for (const r of rows) {
      const a = acc.get(r.org_venue_id);
      if (!a) continue;
      out[r.org_venue_id].anyBooking = true;
      const s = season.get(r.season_id);
      if (s) a.everSeasons.add(s.name);
      // A cancelled or postponed league booking holds no slot (house league's own rule); it still holds the venue's name.
      const live = r.status !== 'cancelled' && r.status !== 'postponed';
      if (s && live && !FINISHED.has(s.status)) {
        const u = a.seasons.get(s.id) ?? { games: 0, practices: 0 };
        u[kind] += 1;
        a.seasons.set(s.id, u);
      }
      facility(r.org_venue_id, r.org_venue_facility_id, live && !!r.scheduled_at && r.scheduled_at >= nowIso);
    }
  }

  // A tournament that imported the venue holds it (its copy's link would be cleared by a delete), games or not.
  const copyOf = new Map(copies.map(d => [d.id, d]));
  const libraryFacilityOfCopy = new Map(facilityCopies.map(f => [f.id, f.source_org_facility_id]));
  for (const d of copies) {
    const a = acc.get(d.source_org_venue_id);
    if (!a) continue;
    out[d.source_org_venue_id].anyBooking = true;
    a.everTournaments.add(d.tournaments.name);
    if (!FINISHED.has(d.tournaments.status) && !a.tournaments.has(d.tournament_id)) a.tournaments.set(d.tournament_id, 0);
  }
  for (const g of games) {
    const d = copyOf.get(g.diamond_id);
    if (!d) continue;
    const a = acc.get(d.source_org_venue_id)!;
    const live = g.status !== 'cancelled';
    if (live && a.tournaments.has(d.tournament_id)) a.tournaments.set(d.tournament_id, a.tournaments.get(d.tournament_id)! + 1);
    const libFacility = g.venue_facility_id ? libraryFacilityOfCopy.get(g.venue_facility_id) ?? null : null;
    if (libFacility && venueOfFacility.get(libFacility) === d.source_org_venue_id) {
      facility(d.source_org_venue_id, libFacility, live && !!g.game_date && g.game_date >= today);
    }
  }

  const tournamentName = new Map(copies.map(d => [d.tournament_id, d.tournaments.name]));
  for (const [venueId, a] of acc) {
    const u = out[venueId];
    u.teams = [...a.teams].sort(byName);
    u.everTeams = [...a.everTeams].sort(byName);
    u.everSeasons = [...a.everSeasons].sort(byName);
    u.everTournaments = [...a.everTournaments].sort(byName);
    u.seasons = [...a.seasons].map(([id, n]) => ({ id, name: season.get(id)?.name ?? 'House league', ...n })).sort((x, y) => byName(x.name, y.name));
    u.tournaments = [...a.tournaments].map(([id, n]) => ({ id, name: tournamentName.get(id) ?? 'A tournament', games: n })).sort((x, y) => byName(x.name, y.name));
  }
  return out;
}

/** Does any booking — past or upcoming, cancelled or not — hold this venue (or, given, this facility)? */
export async function venueIsBooked(orgId: string, venueId: string): Promise<boolean> {
  const head = (table: string) => supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('org_venue_id', venueId);
  const [rep, tryout, game, practice, copy] = await Promise.all([
    head('rep_team_events'), head('rep_tryout_sessions'), head('league_games'), head('league_practices'),
    supabaseAdmin.from('diamonds').select('id, tournaments!inner(org_id)', { count: 'exact', head: true })
      .eq('source_org_venue_id', venueId).eq('tournaments.org_id', orgId),
  ]);
  for (const r of [rep, tryout, game, practice, copy]) if (r.error) throw r.error;
  return [rep, tryout, game, practice, copy].some(r => (r.count ?? 0) > 0);
}

/** Which of these facilities any booking holds — past or upcoming, a tournament copy included. Existence only: one row each. */
export async function facilitiesBooked(orgId: string, facilityIds: readonly string[]): Promise<Set<string>> {
  const checks = facilityIds.flatMap(id => [
    ...(['rep_team_events', 'rep_tryout_sessions', 'league_games', 'league_practices'] as const).map(t =>
      supabaseAdmin.from(t).select('id').eq('org_id', orgId).eq('org_venue_facility_id', id).limit(1).then(r => ({ id, r }))),
    supabaseAdmin.from('venue_facilities').select('id').eq('source_org_facility_id', id).limit(1).then(r => ({ id, r })),
  ]);
  const booked = new Set<string>();
  for (const { id, r } of await Promise.all(checks)) {
    if (r.error) throw r.error;
    if (r.data?.length) booked.add(id);
  }
  return booked;
}

/**
 * Carry the library's words forward onto the UPCOMING bookings that link the venue (see the header), given the venue's
 * FINAL words — the names this save will write. ⚠ The route calls it BEFORE it writes the library's own rows (/review 6b):
 * written after them, a failure in between left the library renamed and the bookings not, and the retry — seeing no change
 * any more — never carried. This way a failure leaves the library's old words, so the retry sees the change again; the
 * carry is idempotent. Returns how many booking rows took new words.
 */
export async function carryWordsForward(orgId: string, venueId: string, final: {
  name: string; address: string | null; facilities: readonly { id: string; name: string }[];
}, changed: { venueName: boolean; address: boolean; facilityIds: readonly string[] }, now: Date = new Date()): Promise<number> {
  if (!changed.venueName && !changed.address && !changed.facilityIds.length) return 0;
  const nowIso = now.toISOString();
  const stamp = { updated_at: nowIso };
  const writes: PromiseLike<{ data: unknown[] | null; error: unknown }>[] = [];
  const renamed = final.facilities.filter(f => changed.facilityIds.includes(f.id));

  // A rep booking keeps three copies: the venue's name, its address, the facility's name.
  for (const table of ['rep_team_events', 'rep_tryout_sessions'] as const) {
    const repPatch: Record<string, unknown> = {};
    if (changed.venueName) repPatch.location = final.name;
    if (changed.address) repPatch.location_address = final.address;
    if (Object.keys(repPatch).length) {
      writes.push(supabaseAdmin.from(table).update({ ...repPatch, ...stamp })
        .eq('org_id', orgId).eq('org_venue_id', venueId).gte('starts_at', nowIso).select('id'));
    }
    for (const f of renamed) {
      writes.push(supabaseAdmin.from(table).update({ field_number: f.name, ...stamp })
        .eq('org_id', orgId).eq('org_venue_id', venueId).eq('org_venue_facility_id', f.id).gte('starts_at', nowIso).select('id'));
    }
  }

  // House league keeps ONE line, "Venue — Facility" (lib/venue-label.ts): a renamed venue rewrites every upcoming line
  // on it, a renamed facility only that facility's. It keeps no address.
  if (changed.venueName || renamed.length) {
    const lines: { facilityId: string | null; text: string }[] = changed.venueName
      ? [{ facilityId: null, text: final.name }, ...final.facilities.map(f => ({ facilityId: f.id, text: formatVenueLocation(final.name, f.name) }))]
      : renamed.map(f => ({ facilityId: f.id, text: formatVenueLocation(final.name, f.name) }));
    for (const table of ['league_games', 'league_practices'] as const) {
      for (const line of lines) {
        const q = supabaseAdmin.from(table).update({ location: line.text, ...stamp })
          .eq('org_id', orgId).eq('org_venue_id', venueId).gte('scheduled_at', nowIso);
        writes.push((line.facilityId ? q.eq('org_venue_facility_id', line.facilityId) : q.is('org_venue_facility_id', null)).select('id'));
      }
    }
  }
  // The rows each write touches are disjoint (a table, a venue, a facility), so the writes run together.
  let moved = 0;
  for (const r of await Promise.all(writes)) {
    if (r.error) throw r.error;
    moved += r.data?.length ?? 0;
  }
  return moved;
}
