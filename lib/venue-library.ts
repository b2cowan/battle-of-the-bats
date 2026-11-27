/**
 * venue-library.ts — the Venue library's rules and words, client-safe and pure (Club Tier Stage 6b, Ask 9, ratified
 * 2026-10-08 — hub K4MPu4ni53Ct7yrDcmWJd9 v64, Mockups → Stage 6 → specimen 6). The page, its route and the tests
 * read the same rules, so "who may save", "what counts as booked" and the questions' words cannot drift apart.
 *
 * ⚖ WHO SAVES (Ask 9): the owner, an admin, a league admin, and anyone granted the tournament permission — the people
 *   who schedule a program. Everyone else who can open Organization reads it (no Add venue, no pencil). Before 6b the
 *   save needed the tournament permission alone, so the league admin whom house league sends here was refused (D02).
 * ⚖ ARCHIVE WHEN ANYTHING BOOKS IT, DELETE ONLY WHEN NOTHING DOES (Ask 9, design log 2026-10-09 (4)): any booking,
 *   PAST INCLUDED, holds a venue — a venue last used two seasons ago archives, so its history keeps its name. A
 *   delete is hard, and every link it would clear is ON DELETE SET NULL, which is how the old Delete stripped the
 *   venue from every house-league game on it without a word (S6-08).
 * ⚖ A FACILITY a booking holds is renamed, never removed; one nothing books gets its ✕. It has no archive of its own
 *   (decided from the data at 6b, mig 321's header).
 *
 * Copy status: drafted to the hub's drawings, worded by /marketing 2026-10-09 (the lede says what is flagged; Archive's
 * "Existing bookings keep it"; Delete's "Nothing has ever booked it"; "map link", the help's spelling). The plan line keeps
 * the product's "League Plus and Club" — Club · Association is Club's larger size, never named in a lock line.
 */
import { hasCapability } from './roles.ts';
import { canMoveClubMoney } from './member-access.ts';
import type { EntitlementOrg } from './module-entitlements.ts';
import { joinWithAnd, pluralize, possessive } from './utils.ts';
import type { FieldSections } from './field-parts.ts';
import { FACILITY_TYPE_LABELS, type FacilityType, type OrgRole } from './types.ts';

/** THE save rule (Ask 9) — the route checks it on every write, the page reads it to hide Add venue and the pencil. */
export function canSaveVenueLibrary(role: OrgRole | string | null | undefined, capabilities: Record<string, boolean> | null | undefined): boolean {
  if (!role) return false;
  if (role === 'owner' || role === 'admin' || role === 'league_admin') return true;
  return hasCapability(role as OrgRole, capabilities ?? null, 'create_tournaments');
}

/**
 * ⚖ WHO OPENS A PERMIT'S FILE (Board Ready W2 fix E, sweep 3 small finding): the file is the issuer's own copy and may state
 * the fee that the Venue library's screens hide from every seat without Accounting (owner 2026-10-11), so it opens for the
 * library's savers and the seats that hold the club's money — not for every reader of the library. The route checks it, and
 * the window reads the same answer so a reader who cannot open the file is not handed a button that fails.
 */
export function canOpenPermitDocument(canSave: boolean, canMoney: boolean): boolean {
  return canSave || canMoney;
}

/**
 * ⚖ WHO READS the Venue library and the club's permits (Board Ready trust close-out 2, owner 2026-11-18; replaces Stage
 * 13c's "everyone but a coach"): the people who schedule a program, run tournaments or handle the money — the library's
 * savers (owner, admin, league admin, "Run tournaments") and the seats that hold the club's Accounting. A scorekeeper,
 * tournament staff and a registrar no longer read permit names, reference numbers, notes, who booked each block or a
 * venue's bookings contact. A coaching login reads nothing of the club's, whatever it was granted (the library's own rule).
 * It is the same set that opens a permit's file, so no reader is ever shown a file they cannot open.
 *
 * The permits and library routes refuse by it; the Permits row, the Venue library row, the calendar's "See the permit" and
 * both pages hide by it (a gated read behind a still-linked screen is a dead end). The plain venue picker (names and
 * addresses, never the bookings contact) stays every member's: tournament setup and the coach screens pick venues from it.
 */
export function canReadVenueLibrary(
  member: { role: OrgRole | string | null | undefined; capabilities: Record<string, boolean> | null | undefined },
  org: EntitlementOrg,
): boolean {
  if (!member.role || member.role === 'coach') return false;
  return canOpenPermitDocument(
    canSaveVenueLibrary(member.role, member.capabilities),
    canMoveClubMoney({ role: member.role as OrgRole, capabilities: member.capabilities ?? null }, org),
  );
}

/** A venue as the library's route returns it (`?library=1`). */
export interface LibraryFacility {
  id: string; name: string; facilityType: string; displayOrder: number;
  /** How the field splits (Club schedules Stage 2, mig 541): 1, 2 or 4. Absent (an older read) = not split. */
  sections?: FieldSections;
  /** The library read only: a booking still to come names one of its parts, so its split is locked (round 2 Ask 7 A). */
  partsBooked?: boolean;
}

/**
 * The one line under the Facilities heading while any split is locked (round 2 Ask 7 A, the drawing's tab 2): which
 * fields and why, once for all of them. Working words (the drawing says "practices"; a house-league game on club time can
 * hold a part too, so the line says "bookings"). Null when nothing is locked.
 */
export function splitLockedLine(fields: readonly { name: string; sections: FieldSections }[]): string | null {
  const locked = fields.filter(f => f.sections !== 1);
  if (!locked.length) return null;
  if (locked.length === 1) {
    const f = locked[0];
    return f.sections === 4
      ? `${f.name} has bookings on its quarters, so it stays in four quarters.`
      : `${f.name} has bookings on its sides, so it stays in two sides.`;
  }
  return `${joinWithAnd(locked.map(f => f.name))} have bookings on their parts, so each stays split as it is.`;
}

/** The route's refusal when a stale page changes a locked split (the same sentence as the line). */
export function splitLockedRefusal(name: string, sections: FieldSections): string {
  return splitLockedLine([{ name, sections }]) ?? `${possessive(name)} split can’t change while a part is booked.`;
}
export interface LibraryVenue {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
  /** The venue's booking office (Club Tier 10a, Ask 7) — optional; 11a's schedule send offers it. */
  bookingsEmail: string | null;
  isActive: boolean;
  facilities: LibraryFacility[];
}

/** One program's use of a venue, as the library reads it. */
export interface VenueSeasonUse { id: string; name: string; games: number; practices: number }
export interface VenueTournamentUse { id: string; name: string; games: number }

/**
 * What books a venue. `teams` / `seasons` / `tournaments` are THIS SEASON's (a team's live season; a house-league
 * season that hasn't finished; a tournament that hasn't finished) — the "Booked by this season" column and the
 * window's section. `ever*` are every booking's owners, past included — the Archive question names them when nothing
 * books it this season. `anyBooking` decides Archive vs Delete.
 */
export interface VenueUsage {
  anyBooking: boolean;
  teams: string[];
  seasons: VenueSeasonUse[];
  tournaments: VenueTournamentUse[];
  everTeams: string[];
  everSeasons: string[];
  everTournaments: string[];
  /** Per facility id: bookings that start now or later (not cancelled), and whether any booking holds it at all. */
  facilities: Record<string, { upcoming: number; anyBooking: boolean }>;
}

export const NO_USAGE: VenueUsage = {
  anyBooking: false, teams: [], seasons: [], tournaments: [], everTeams: [], everSeasons: [], everTournaments: [], facilities: {},
};

/**
 * The phone row's one line (the table says the same in three columns): "Booked by 6 teams, house league and
 * 1 tournament". A sentence, never a dotted line (owner 2026-11-26).
 */
export function bookedSentence(u: VenueUsage | undefined): string {
  const parts = u ? [
    u.teams.length ? pluralize(u.teams.length, 'team') : '',
    u.seasons.length ? 'house league' : '',
    u.tournaments.length ? pluralize(u.tournaments.length, 'tournament') : '',
  ].filter(Boolean) : [];
  return parts.length ? `Booked by ${joinWithAnd(parts)}` : VENUE_LIBRARY_WORDS.nothingBooked;
}

/** How many names the table's Facilities cell shows before "and N more"; the venue's window lists them all. */
const FACILITY_NAMES_SHOWN = 4;

/**
 * The table's Facilities cell: the count leads, in the venue's own word when every facility is one named kind
 * ("3 diamonds", otherwise "2 facilities"), and the names sit under it in the club's order. Null when it has none.
 */
export function facilitiesCell(facilities: readonly LibraryFacility[]): { count: string; names: string } | null {
  if (!facilities.length) return null;
  const kinds = new Set(facilities.map(f => f.facilityType));
  const [only] = kinds;
  const label = kinds.size === 1 && only !== 'other' ? FACILITY_TYPE_LABELS[only as FacilityType] : undefined;
  const names = [...facilities].sort((a, b) => a.displayOrder - b.displayOrder).map(f => f.name);
  const more = names.length - FACILITY_NAMES_SHOWN;
  return {
    count: label ? pluralize(names.length, label.toLowerCase()) : pluralize(names.length, 'facility', 'facilities'),
    names: more > 0 ? `${names.slice(0, FACILITY_NAMES_SHOWN).join(', ')} and ${more} more` : names.join(', '),
  };
}

/** "24 games", "3 practices", "24 games, 3 practices" — a house-league season's use, in the window. */
export function seasonUseWords(s: Pick<VenueSeasonUse, 'games' | 'practices'>): string {
  const parts = [s.games ? pluralize(s.games, 'game') : '', s.practices ? pluralize(s.practices, 'practice') : ''].filter(Boolean);
  return parts.length ? parts.join(', ') : 'nothing scheduled yet';
}

/** "12 games" — a tournament's games on the venue's copy; "not scheduled yet" before its schedule exists. */
export function tournamentUseWords(t: Pick<VenueTournamentUse, 'games'>): string {
  return t.games ? pluralize(t.games, 'game') : 'not scheduled yet';
}

/** Who a question names: one team by its name, several as a count; then each season and tournament by name. */
function whoList(teams: readonly string[], seasons: readonly string[], tournaments: readonly string[]): string {
  const teamPart = teams.length === 1 ? teams[0] : teams.length > 1 ? pluralize(teams.length, 'team') : '';
  return joinWithAnd([teamPart, ...seasons, ...tournaments].filter(Boolean));
}

/**
 * The Archive question (specimen 6): "Archive Lions Park?" — who books it, then what Archive does. Names this season's
 * bookers; with none this season, the past ones ("…booked it before."). /marketing words the sentences.
 */
export function archiveQuestion(venueName: string, u: VenueUsage): { title: string; who: string; what: string } {
  const now = whoList(u.teams, u.seasons.map(s => s.name), u.tournaments.map(t => t.name));
  const before = whoList(u.everTeams, u.everSeasons, u.everTournaments);
  return {
    title: `Archive ${venueName}?`,
    who: now ? `${now} book it.` : before ? `${before} booked it before.` : 'It has bookings.',
    what: 'Archiving takes it out of every picker. Existing bookings keep it, and the calendar still shows it. You can bring it back.',
  };
}

/** The Delete question (specimen 6), offered only when nothing books the venue. Red, asking first. */
export function deleteQuestion(venueName: string): { title: string; body: string } {
  return { title: `Delete ${venueName}?`, body: 'Nothing has ever booked it. It leaves the library for good.' };
}

/** Every other sentence the library says, one spelling each. /marketing words the ones marked. */
export const VENUE_LIBRARY_WORDS = {
  /** The toolbar's lede (/marketing). */
  lede: 'The club’s venues and their facilities. Teams, house league and tournaments book them from here, and two bookings on the same facility at the same time are flagged.',
  loadFailed: 'We couldn’t load the Venue library.',
  emptyTitle: 'No venues yet',
  emptyBody: 'Add a venue once, with its facilities. Teams, house league and tournaments book it from here.',
  /** The quiet line under the table: "1 archived venue". */
  archivedLine: (n: number) => pluralize(n, 'archived venue'),
  nothingBooked: 'Nothing booked this season',
  noFacilities: 'No facilities',
  addressHint: 'Used for the map link on every schedule and family calendar.',
  /** A facility a booking holds, in the form where its ✕ would be. */
  inUse: 'In use',
  /** The window's sections. */
  facilitiesHeading: 'Facilities',
  bookedByHeading: 'Booked by this season',
  /** The table's three booking columns and the heading over them (the window keeps the heading above). */
  bookedColumns: { group: 'Booked this season', teams: 'Teams', league: 'House league', tournaments: 'Tournaments', leagueYes: 'Yes' },
  nothingThisSeason: 'Nothing books it this season.',
  archivedEyebrow: 'Venue library · Archived',
  /** Said once in the window's pill after Bring back / Archive. */
  broughtBack: (name: string) => `${name} is back in every picker.`,
  archived: (name: string) => `${name} is archived.`,
  deleted: (name: string) => `${name} is deleted.`,
  added: (name: string) => `${name} added.`,
  /** The edit form's held saves. */
  nameHeld: 'Give the venue a name to save it.',
  facilityNameHeld: 'Give every facility a name to save it.',
  facilityTwiceHeld: 'Two facilities can’t share a name.',
  planLocked: 'The Venue library comes with League Plus and Club.',
} as const;

/** A bookings contact that can't be one (the form holds, the route refuses — mig 322's CHECK is the floor). */
export function bookingsEmailProblem(email: string | null | undefined): string | null {
  const e = email?.trim() ?? '';
  if (!e) return null;
  return e.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? null : 'Enter the bookings contact as an email address.';
}

/** Facility names that clash within one venue (case and spacing folded) — the form holds the save, the route refuses. */
export function duplicateFacilityName(names: readonly string[]): string | null {
  const seen = new Set<string>();
  for (const n of names) {
    const k = n.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!k) continue;
    if (seen.has(k)) return n.trim();
    seen.add(k);
  }
  return null;
}
