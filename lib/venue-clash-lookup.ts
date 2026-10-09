/**
 * venue-clash-lookup.ts (server-only — touches supabaseAdmin) — Club Tier Stage 6a.
 *
 * The ONE read behind the clash check: one club's bookings on its own venues, in a time window, across every
 * program (rep events, tryout days, house-league games and practices, the club's tournaments' games on venues
 * that still carry their library link). Every writer runs it after it saves, and the forms' live check runs the
 * same read before Save, so the line a coach sees while typing is the line the server answers with.
 *
 * Beside the read:
 *   - `getClubVenueLibrary` — is this a club with a Venue library (the plan carries it AND it holds an active
 *     venue)? Its venues and facilities, in the club's order. "In a club" means exactly this everywhere in 6a: the
 *     picker's Club venues group and the quiet "isn't checked" line both read it.
 *   - `proveLibraryVenue` — THE tenant check for a pick from the library: the venue is this club's, the facility
 *     that venue's. House league's resolver (`lib/league-venue.ts`) and the rep one below both stand on it.
 *   - the writers' reports — proposed bookings in, findings (and the line) per booking out; never fatal.
 *
 * Multi-tenant: every query is scoped by `org_id` (or by the club's own venue ids); a booking from another club
 * can never enter the comparison set. Nothing here writes.
 */
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { hasOrgVenueLibrary } from './plan-features';
import { orgDayKey, addCalendarDays } from './timezone';
import {
  findClubClashesFor,
  repEventBooking,
  tryoutSessionBooking,
  leagueBooking,
  tournamentGameBooking,
  tournamentGameMinutes,
  type ClubBooking,
  type ClashFinding,
} from './venue-clash';
import { clashLine, clashLineText } from './venue-clash-words';
import type { ClubVenueOption, OrgPlan, RepTeamEvent, RepTryoutSession } from './types';

const DAY = 86_400_000;
/** The furthest one check reaches past its first date — two years, past the longest series a form can make. */
const MAX_CHECK_SPAN_MS = 800 * DAY;
type OrgRef = { id: string; planId?: OrgPlan | null };

// ---------------------------------------------------------------------------
// The library, as a picker offers it
// ---------------------------------------------------------------------------

export interface ClubVenueLibrary {
  /** True when the club has a Venue library: the plan carries it and it holds at least one active venue. */
  inClub: boolean;
  venues: ClubVenueOption[];
}

const NO_LIBRARY: ClubVenueLibrary = { inClub: false, venues: [] };

/**
 * The club's active venues and their facilities, in the club's order (venues by name, facilities by the club's
 * display order). A plan without the library, or a library with no active venue, is "not a club" for 6a: the
 * picker shows only the team's own places, exactly as built, and no quiet line appears.
 * ⚠ A failed read THROWS — never an empty list that reads as "this club has no venues" (S6-09's lesson; the reason
 * this does not reuse `getOrgVenues`, which swallows errors).
 */
export async function getClubVenueLibrary(org: OrgRef): Promise<ClubVenueLibrary> {
  if (!hasOrgVenueLibrary(org.planId ?? null)) return NO_LIBRARY;
  const { data, error } = await supabaseAdmin
    .from('org_venues')
    .select('id, name, address, is_active, org_venue_facilities(id, name, display_order)')
    .eq('org_id', org.id)
    .order('name', { ascending: true });
  if (error) throw error;
  const active = ((data ?? []) as { id: string; name: string; address: string | null; is_active: boolean | null; org_venue_facilities: { id: string; name: string; display_order: number }[] | null }[])
    .filter(v => v.is_active !== false);
  if (!active.length) return NO_LIBRARY;
  return {
    inClub: true,
    venues: active.map(v => ({
      id: v.id,
      name: v.name,
      address: v.address ?? null,
      facilities: [...(v.org_venue_facilities ?? [])]
        .sort((a, b) => a.display_order - b.display_order)
        .map(f => ({ id: f.id, name: f.name })),
    })),
  };
}

/**
 * The facility this team used LAST at each club venue — the place book's "usual diamond", learned rather than
 * typed (Ask 2): the facility dropdown opens on it. Across the team's seasons, newest first.
 */
async function getUsualFacilityByVenue(teamId: string): Promise<Record<string, string>> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_events')
    .select('org_venue_id, org_venue_facility_id, starts_at')
    .eq('team_id', teamId)
    .not('org_venue_facility_id', 'is', null)
    .order('starts_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const r of data ?? []) {
    if (r.org_venue_id && r.org_venue_facility_id && !out[r.org_venue_id]) out[r.org_venue_id] = r.org_venue_facility_id;
  }
  return out;
}

/** A team's Venue field: the club's library and, only in a club, the facility it used last at each venue. */
export async function getClubVenuesForTeam(org: OrgRef, teamId: string): Promise<ClubVenueLibrary & { usualFacilityByVenue: Record<string, string> }> {
  const library = await getClubVenueLibrary(org);
  return { ...library, usualFacilityByVenue: library.inClub ? await getUsualFacilityByVenue(teamId) : {} };
}

// ---------------------------------------------------------------------------
// The proof, and the rep selection rail
// ---------------------------------------------------------------------------

export type LibraryVenueProof =
  | { ok: true; venue: { id: string; name: string; address: string | null }; facility: { id: string; name: string } | null }
  | { ok: false; missing: 'venue' | 'facility' };

/**
 * THE tenant check for a pick from the club's library — one home for it. The venue must be this club's (a
 * foreign venue reads as "not found": never confirm it exists), the facility that same venue's. House league's
 * resolver and the rep one below each word their own refusal from `missing`.
 */
export async function proveLibraryVenue(orgId: string, venueId: string, facilityId: string | null): Promise<LibraryVenueProof> {
  const [venueRes, facRes] = await Promise.all([
    supabaseAdmin.from('org_venues').select('id, org_id, name, address').eq('id', venueId).maybeSingle(),
    facilityId
      ? supabaseAdmin.from('org_venue_facilities').select('id, org_venue_id, org_id, name').eq('id', facilityId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const venue = venueRes.data;
  if (!venue || venue.org_id !== orgId) return { ok: false, missing: 'venue' };
  const fac = facRes.data;
  if (facilityId && (!fac || fac.org_id !== orgId || fac.org_venue_id !== venue.id)) return { ok: false, missing: 'facility' };
  return {
    ok: true,
    venue: { id: venue.id as string, name: venue.name as string, address: (venue.address as string | null) ?? null },
    facility: fac ? { id: fac.id as string, name: fac.name as string } : null,
  };
}

export interface ClubVenueSelection {
  venue: { id: string; name: string; address: string | null } | null;
  facility: { id: string; name: string } | null;
}

export type ClubVenueSelectionResult = { ok: true; value: ClubVenueSelection } | { ok: false; error: string };

/**
 * Prove a rep booking's club-venue pick before it is written. null/'' venue = no club venue. A venue that isn't
 * this club's, or a facility that isn't that venue's, is REFUSED (400) rather than silently dropped: unlike a stale
 * place id, a wrong club venue would put a booking on someone else's diamond.
 *
 * `storedVenueId` (an edit): the venue the booking already stands on. Keeping it skips the PLAN gate — a club whose
 * plan stopped carrying the library must still be able to move or rename an event that stands on its venue, rather
 * than meet "Venue not found." on every edit — but never the tenant proof. A new pick needs the library.
 */
export async function resolveClubVenueSelection(args: { org: OrgRef; orgVenueId?: unknown; orgVenueFacilityId?: unknown; storedVenueId?: string | null }): Promise<ClubVenueSelectionResult> {
  const venueId = typeof args.orgVenueId === 'string' && args.orgVenueId ? args.orgVenueId : null;
  const facilityId = typeof args.orgVenueFacilityId === 'string' && args.orgVenueFacilityId ? args.orgVenueFacilityId : null;
  if (!venueId) {
    if (facilityId) return { ok: false, error: 'A facility can’t be picked without its venue.' };
    return { ok: true, value: { venue: null, facility: null } };
  }
  if (venueId !== args.storedVenueId && !hasOrgVenueLibrary(args.org.planId ?? null)) return { ok: false, error: 'Venue not found.' };
  const proof = await proveLibraryVenue(args.org.id, venueId, facilityId);
  if (!proof.ok) return { ok: false, error: proof.missing === 'venue' ? 'Venue not found.' : 'That isn’t one of this venue’s facilities.' };
  return { ok: true, value: { venue: proof.venue, facility: proof.facility } };
}

// ---------------------------------------------------------------------------
// The read
// ---------------------------------------------------------------------------

/** The club's own names for its venues and facilities, read once per check. */
interface LibraryNames {
  venue: Map<string, string>;
  facility: Map<string, string>;
}

type GameRow = {
  id: string; tournament_id: string; division_id: string | null; game_date: string | null; game_time: string | null;
  status: string | null; duration_minutes: number | null; diamond_id: string | null; venue_facility_id: string | null;
};
const GAME_COLUMNS = 'id, tournament_id, division_id, game_date, game_time, status, duration_minutes, diamond_id, venue_facility_id';
type TournamentRef = { name: string; settings: { game_duration_minutes?: unknown } | null };

/**
 * Tournament games as the rule reads them — ONE builder for the pool and for a tournament writer's report: the
 * library link of the game's venue copy and facility copy (S6-04), and the tournament's own length chain.
 */
async function tournamentBookingsFor(
  games: readonly GameRow[],
  libraryVenueOfDiamond: Map<string, string>,
  tournamentOf: Map<string, TournamentRef>,
  names?: LibraryNames,
): Promise<ClubBooking[]> {
  const linked = games.filter(g => g.diamond_id && libraryVenueOfDiamond.has(g.diamond_id) && tournamentOf.has(g.tournament_id));
  if (!linked.length) return [];
  const divisionIds = [...new Set(linked.map(g => g.division_id).filter(Boolean) as string[])];
  const facilityCopyIds = [...new Set(linked.map(g => g.venue_facility_id).filter(Boolean) as string[])];
  const [divs, facCopies] = await Promise.all([
    divisionIds.length ? supabaseAdmin.from('divisions').select('id, settings').in('id', divisionIds) : Promise.resolve({ data: [], error: null }),
    facilityCopyIds.length ? supabaseAdmin.from('venue_facilities').select('id, source_org_facility_id').in('id', facilityCopyIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (divs.error) throw divs.error;
  if (facCopies.error) throw facCopies.error;
  const divisionMinutes = new Map(((divs.data ?? []) as { id: string; settings: { game_duration_minutes?: unknown } | null }[]).map(d => [d.id, d.settings?.game_duration_minutes]));
  const libraryFacility = new Map(((facCopies.data ?? []) as { id: string; source_org_facility_id: string | null }[]).map(f => [f.id, f.source_org_facility_id]));
  const out: ClubBooking[] = [];
  for (const g of linked) {
    const t = tournamentOf.get(g.tournament_id)!;
    const venueId = libraryVenueOfDiamond.get(g.diamond_id!)!;
    const facilityId = g.venue_facility_id ? libraryFacility.get(g.venue_facility_id) ?? null : null;
    const minutes = tournamentGameMinutes(g, g.division_id ? divisionMinutes.get(g.division_id) : undefined, t.settings?.game_duration_minutes);
    const b = tournamentGameBooking(g, { venueId, facilityId, minutes }, {
      tournament: t.name,
      venue: names?.venue.get(venueId) ?? null,
      facility: facilityId ? names?.facility.get(facilityId) ?? null : null,
    });
    if (b) out.push(b);
  }
  return out;
}

// The pool's rows, as the rule's constructors read them.
type RepRow = Parameters<typeof repEventBooking>[0];
type TryoutRow = Parameters<typeof tryoutSessionBooking>[0];
type LeagueRow = Omit<Parameters<typeof leagueBooking>[0], 'kind'> & { season_id: string };
type DiamondRow = { id: string; tournament_id: string; source_org_venue_id: string; tournaments: TournamentRef & { id: string } };
type NameRow = { id: string; name: string };

/**
 * Every booking on one of the club's venues that could overlap [fromMs, toMs] — padded a day each side so a
 * booking that starts the evening before and runs late is still in the set (the house-league read pads the same) —
 * and the club's names, so a writer's report needs no second read of them.
 */
async function readClubPool(orgId: string, fromMs: number, toMs: number): Promise<{ bookings: ClubBooking[]; names: LibraryNames }> {
  const fromIso = new Date(fromMs - DAY).toISOString();
  const toIso = new Date(toMs + DAY).toISOString();

  const { data: orgVenues, error: vErr } = await supabaseAdmin.from('org_venues').select('id, name').eq('org_id', orgId);
  if (vErr) throw vErr;
  const names: LibraryNames = { venue: new Map((orgVenues ?? []).map(v => [v.id as string, v.name as string])), facility: new Map() };
  const venueIds = [...names.venue.keys()];
  if (!venueIds.length) return { bookings: [], names };

  // Every read pages past the 1,000-row cap (`fetchAll`): a season-long series asks about a season of a busy club's
  // bookings, and a page cut off at the cap would drop clashes without a word.
  const [repRows, tryoutRows, gameRows, practiceRows, diamonds, facilities] = await Promise.all([
    fetchAll<RepRow>((a, b) => supabaseAdmin.from('rep_team_events')
      .select('id, team_id, event_type, starts_at, ends_at, status, org_venue_id, org_venue_facility_id, source_tournament_game_id')
      .eq('org_id', orgId).not('org_venue_id', 'is', null)
      .neq('status', 'cancelled')
      .gte('starts_at', fromIso).lte('starts_at', toIso)
      .order('id').range(a, b)),
    fetchAll<TryoutRow>((a, b) => supabaseAdmin.from('rep_tryout_sessions')
      .select('id, team_id, starts_at, ends_at, status, org_venue_id, org_venue_facility_id')
      .eq('org_id', orgId).not('org_venue_id', 'is', null)
      .neq('status', 'cancelled')
      .gte('starts_at', fromIso).lte('starts_at', toIso)
      .order('id').range(a, b)),
    fetchAll<LeagueRow>((a, b) => supabaseAdmin.from('league_games')
      .select('id, season_id, scheduled_at, ends_at, status, org_venue_id, org_venue_facility_id')
      .eq('org_id', orgId).not('org_venue_id', 'is', null)
      .gte('scheduled_at', fromIso).lte('scheduled_at', toIso)
      .order('id').range(a, b)),
    fetchAll<LeagueRow>((a, b) => supabaseAdmin.from('league_practices')
      .select('id, season_id, scheduled_at, ends_at, status, org_venue_id, org_venue_facility_id')
      .eq('org_id', orgId).not('org_venue_id', 'is', null)
      .gte('scheduled_at', fromIso).lte('scheduled_at', toIso)
      .order('id').range(a, b)),
    // A tournament's venue copy that still carries its library link (S6-04) — only those can be the club's diamond.
    fetchAll<DiamondRow>((a, b) => supabaseAdmin.from('diamonds')
      .select('id, tournament_id, source_org_venue_id, tournaments!inner(id, org_id, name, settings)')
      .in('source_org_venue_id', venueIds)
      .eq('tournaments.org_id', orgId)
      .order('id').range(a, b)),
    fetchAll<NameRow>((a, b) => supabaseAdmin.from('org_venue_facilities').select('id, name').eq('org_id', orgId).order('id').range(a, b)),
  ]);
  for (const f of facilities) names.facility.set(f.id, f.name);

  // Team and season names, once.
  const [teams, seasons] = await Promise.all([
    fetchAllIn<NameRow>([...repRows, ...tryoutRows].map(r => r.team_id), (c, a, b) => supabaseAdmin
      .from('rep_teams').select('id, name').in('id', c).order('id').range(a, b)),
    fetchAllIn<NameRow>([...gameRows, ...practiceRows].map(r => r.season_id), (c, a, b) => supabaseAdmin
      .from('league_seasons').select('id, name').in('id', c).order('id').range(a, b)),
  ]);
  const teamName = new Map(teams.map(t => [t.id, t.name]));
  const seasonName = new Map(seasons.map(s => [s.id, s.name]));
  const words = (venueId: string | null | undefined, facilityId: string | null | undefined) => ({
    venue: venueId ? names.venue.get(venueId) ?? null : null,
    facility: facilityId ? names.facility.get(facilityId) ?? null : null,
  });

  const out: ClubBooking[] = [];
  for (const r of repRows) {
    // A team's mirrored copy of a tournament game: the tournament game IS the booking (S6-06).
    if (r.source_tournament_game_id) continue;
    const b = repEventBooking(r, { team: teamName.get(r.team_id) ?? 'A team', ...words(r.org_venue_id, r.org_venue_facility_id) });
    if (b) out.push(b);
  }
  for (const r of tryoutRows) {
    const b = tryoutSessionBooking(r, { team: teamName.get(r.team_id) ?? 'A team', ...words(r.org_venue_id, r.org_venue_facility_id) });
    if (b) out.push(b);
  }
  for (const [rows, kind] of [[gameRows, 'game'], [practiceRows, 'practice']] as const) {
    for (const r of rows) {
      const b = leagueBooking({ ...r, kind }, { season: seasonName.get(r.season_id) ?? 'House league', ...words(r.org_venue_id, r.org_venue_facility_id) });
      if (b) out.push(b);
    }
  }

  // Tournament games on the linked copies, by local date (padded a day: the window is instants, the column a date).
  if (diamonds.length) {
    const fromDay = addCalendarDays(orgDayKey(new Date(fromMs).toISOString()), -1);
    const toDay = addCalendarDays(orgDayKey(new Date(toMs).toISOString()), 1);
    const games = await fetchAllIn<GameRow>(diamonds.map(d => d.id), (c, a, b) => supabaseAdmin.from('games')
      .select(GAME_COLUMNS)
      .in('diamond_id', c)
      .neq('status', 'cancelled')
      .gte('game_date', fromDay)
      .lte('game_date', toDay)
      .order('id').range(a, b));
    out.push(...await tournamentBookingsFor(
      games,
      new Map(diamonds.map(d => [d.id, d.source_org_venue_id])),
      new Map(diamonds.map(d => [d.tournament_id, d.tournaments])),
      names,
    ));
  }
  return { bookings: out, names };
}

/** The window a set of proposed bookings spans. */
function windowOf(bookings: readonly ClubBooking[]): [number, number] {
  return [Math.min(...bookings.map(b => b.startMs)), Math.max(...bookings.map(b => b.endMs))];
}

/**
 * Run the one rule for some proposed bookings against the club's others (the forms' live checks). Proposed bookings
 * not on a club venue cost no read; a proposed booking whose key is a stored row (an edit) never meets itself.
 * Findings per proposed key (absent = nothing clashes).
 */
export async function checkClubClashes(orgId: string, proposed: readonly ClubBooking[]): Promise<Map<string, ClashFinding[]>> {
  // One read spans the earliest date to the latest, so a request is held to the longest series a form can make (24
  // monthly dates): two dates years apart would otherwise read years of the club's bookings, on every keystroke.
  const first = Math.min(...proposed.map(p => p.startMs));
  const placed = proposed.filter(p => p.venueId && p.startMs - first <= MAX_CHECK_SPAN_MS);
  if (!placed.length) return new Map();
  const { bookings: pool } = await readClubPool(orgId, ...windowOf(placed));
  return findClubClashesFor(placed, pool);
}

// ---------------------------------------------------------------------------
// A writer's report: findings and the line, per booking — never fatal
// ---------------------------------------------------------------------------

export interface ClashReport {
  /** Per booking id: what clashes (absent = nothing). */
  findings: Record<string, ClashFinding[]>;
  /** Per booking id: the line, in the program's sport's words (`lib/venue-clash-words.ts`). */
  lines: Record<string, string>;
}

/** A report that found nothing (a fresh object every time — callers fill their own). */
export function emptyReport(): ClashReport {
  return { findings: {}, lines: {} };
}

const idOf = (key: string) => key.slice(key.indexOf(':') + 1);

/**
 * The report for bookings a writer has ALREADY saved: a read failing here must not turn a saved booking into an
 * error the person would retry (and double-book with), so it reports nothing and logs instead. The club's names are
 * the pool's, read once. `sportOf` gives each booking's sport for the line's word.
 */
async function report(orgId: string, bookings: readonly (ClubBooking | null)[], sportOf: (b: ClubBooking) => string | null | undefined): Promise<ClashReport> {
  const out = emptyReport();
  const placed = bookings.filter((b): b is ClubBooking => !!b?.venueId);
  if (!placed.length) return out;
  try {
    const { bookings: pool, names } = await readClubPool(orgId, ...windowOf(placed));
    const named = placed.map(b => ({
      ...b,
      venueName: b.venueName ?? names.venue.get(b.venueId!) ?? null,
      facilityName: b.facilityName ?? (b.facilityId ? names.facility.get(b.facilityId) ?? null : null),
    }));
    for (const [key, f] of findClubClashesFor(named, pool)) {
      const b = named.find(x => x.key === key)!;
      out.findings[idOf(key)] = f;
      out.lines[idOf(key)] = clashLineText(clashLine(f, { sport: sportOf(b), venueName: b.venueName ?? '', facilityName: b.facilityName }));
    }
  } catch (e) {
    console.error('[venue-clash] report failed (the save stands):', e);
  }
  return out;
}

/** House league: the games or practices a writer just saved (camelCase rows, as `lib/db.ts` returns them). */
export function clashReportForLeagueRows(
  orgId: string,
  season: { name: string; sport?: string | null },
  kind: 'game' | 'practice',
  rows: readonly { id: string; scheduledAt: string | null; endsAt?: string | null; status?: string | null; orgVenueId?: string | null; orgVenueFacilityId?: string | null }[],
): Promise<ClashReport> {
  return report(orgId, rows.map(r => bookingOfLeagueRow(r, kind, season.name)), () => season.sport);
}

/** A house-league booking as the rule reads it — the window's live check builds its proposed ones the same way. */
export function bookingOfLeagueRow(row: {
  id: string; scheduledAt: string | null; endsAt?: string | null; status?: string | null;
  orgVenueId?: string | null; orgVenueFacilityId?: string | null;
}, kind: 'game' | 'practice', seasonName: string): ClubBooking | null {
  return leagueBooking({
    id: row.id, kind, scheduled_at: row.scheduledAt, ends_at: row.endsAt ?? null, status: row.status ?? 'scheduled',
    org_venue_id: row.orgVenueId ?? null, org_venue_facility_id: row.orgVenueFacilityId ?? null,
  }, { season: seasonName });
}

/**
 * Tournaments: the games a writer just placed or moved (Add/Edit Game, a drop on the timeline, the generator's
 * commit, playoffs, the rain-delay shift, lanes resolved to real venues, typed locations resolved, the import). Only
 * a club with a Venue library can have a clash to report, so every other organizer pays NOTHING; and only games on a
 * venue copy still linked to the library can be the club's diamond (S6-04). Never touches the tournament's own rule
 * (S6-03 is Tournament Stage 3's).
 */
export async function clashReportForTournamentGames(org: OrgRef, gameIds: readonly string[]): Promise<ClashReport> {
  const ids = [...new Set(gameIds.filter(Boolean))];
  if (!ids.length || !hasOrgVenueLibrary(org.planId ?? null)) return emptyReport();
  try {
    const games = await fetchAllIn<GameRow>(ids, (c, a, b) => supabaseAdmin.from('games')
      .select(GAME_COLUMNS).in('id', c).order('id').range(a, b));
    const diamondIds = games.map(g => g.diamond_id).filter((id): id is string => !!id);
    if (!diamondIds.length) return emptyReport();
    const linked = await fetchAllIn<{ id: string; source_org_venue_id: string; tournaments: TournamentRef & { id: string; sport: string | null } }>(
      diamondIds, (c, a, b) => supabaseAdmin.from('diamonds')
        .select('id, source_org_venue_id, tournaments!inner(id, org_id, name, sport, settings)')
        .in('id', c).not('source_org_venue_id', 'is', null)
        // Only this club's tournaments: a copy linked to this club's library is never another club's booking.
        .eq('tournaments.org_id', org.id)
        .order('id').range(a, b));
    if (!linked.length) return emptyReport();
    const sportOf = new Map(linked.map(d => [d.tournaments.id, d.tournaments.sport]));
    const bookings = await tournamentBookingsFor(
      games,
      new Map(linked.map(d => [d.id, d.source_org_venue_id])),
      new Map(linked.map(d => [d.tournaments.id, d.tournaments])),
    );
    // One read of the club's pool for the whole batch, whatever mix of tournaments (and sports) it holds.
    const tournamentOfGame = new Map(games.map(g => [`tournament_game:${g.id}`, g.tournament_id]));
    return report(org.id, bookings, b => sportOf.get(tournamentOfGame.get(b.key) ?? '') ?? null);
  } catch (e) {
    console.error('[venue-clash] tournament report failed (the save stands):', e);
    return emptyReport();
  }
}

// ---------------------------------------------------------------------------
// The rep writers' one call
// ---------------------------------------------------------------------------

/** Findings per booking id for bookings a rep writer just saved — never fatal; no club venue, no read. */
async function findingsFor(orgId: string, bookings: readonly (ClubBooking | null)[]): Promise<Record<string, ClashFinding[]>> {
  const placed = bookings.filter((b): b is ClubBooking => !!b?.venueId);
  const out: Record<string, ClashFinding[]> = {};
  if (!placed.length) return out;
  try {
    for (const [key, f] of await checkClubClashes(orgId, placed)) out[idOf(key)] = f;
  } catch (e) {
    console.error('[venue-clash] lookup failed (the save stands):', e);
  }
  return out;
}

/** After a rep writer saves: the findings for what it saved, per event id (only the ones that clash). */
export function clashesForSavedRepEvents(orgId: string, teamName: string, saved: readonly RepTeamEvent[]): Promise<Record<string, ClashFinding[]>> {
  return findingsFor(orgId, saved.map(e => repEventBooking({
    id: e.id, team_id: e.teamId, event_type: e.eventType, starts_at: e.startsAt, ends_at: e.endsAt, status: e.status,
    org_venue_id: e.orgVenueId, org_venue_facility_id: e.orgVenueFacilityId, source_tournament_game_id: e.sourceTournamentGameId,
  }, { team: teamName, venue: e.location, facility: e.fieldNumber })));
}

/** The same, for tryout days. */
export function clashesForSavedTryoutSessions(orgId: string, teamName: string, saved: readonly RepTryoutSession[]): Promise<Record<string, ClashFinding[]>> {
  return findingsFor(orgId, saved.map(s => tryoutSessionBooking({
    id: s.id, team_id: s.teamId, starts_at: s.startsAt, ends_at: s.endsAt, status: s.status,
    org_venue_id: s.orgVenueId, org_venue_facility_id: s.orgVenueFacilityId,
  }, { team: teamName, venue: s.location, facility: s.fieldNumber })));
}
