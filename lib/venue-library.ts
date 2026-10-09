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
import { joinWithAnd, pluralize } from './utils.ts';
import type { OrgRole } from './types';

/** THE save rule (Ask 9) — the route checks it on every write, the page reads it to hide Add venue and the pencil. */
export function canSaveVenueLibrary(role: OrgRole | string | null | undefined, capabilities: Record<string, boolean> | null | undefined): boolean {
  if (!role) return false;
  if (role === 'owner' || role === 'admin' || role === 'league_admin') return true;
  return hasCapability(role as OrgRole, capabilities ?? null, 'create_tournaments');
}

/** A venue as the library's route returns it (`?library=1`). */
export interface LibraryFacility { id: string; name: string; facilityType: string; displayOrder: number }
export interface LibraryVenue {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
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

/** "6 teams · house league · 1 tournament" — the table's Booked by column; null when nothing books it this season. */
export function bookedBySummary(u: VenueUsage): string | null {
  const parts = [
    u.teams.length ? pluralize(u.teams.length, 'team') : '',
    u.seasons.length ? 'house league' : '',
    u.tournaments.length ? pluralize(u.tournaments.length, 'tournament') : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
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
  nothingBooked: 'Nothing booked',
  noFacilities: 'No facilities',
  addressHint: 'Used for the map link on every schedule and family calendar.',
  /** A facility a booking holds, in the form where its ✕ would be. */
  inUse: 'In use',
  /** The window's sections. */
  facilitiesHeading: 'Facilities',
  bookedByHeading: 'Booked by this season',
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
